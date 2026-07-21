import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/router.dart';
import 'package:shared_preferences/shared_preferences.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Background message received — no further processing needed at this layer
}

class NotificationService {
  static final NotificationService instance = NotificationService._();
  NotificationService._();

  static const _iosPushChannel = MethodChannel('tech.logstack.mobile/push');

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Logger _logger = Logger();

  final StreamController<String> _tokenController =
      StreamController<String>.broadcast();
  Stream<String> get tokenStream => _tokenController.stream;

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  String? _apnsToken;
  String? get apnsToken => _apnsToken;

  Future<void> initialize() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      _logger.w(
        'Skipping notification setup — Firebase options are still placeholders.',
      );
      return;
    }

    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await _initializeLocalNotifications();

    // Apply before permission / FCM setup so foreground banners work as soon as
    // the first remote notification arrives after the user grants access.
    if (Platform.isIOS) {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }

    // Attach message handlers early so cold-start + already-granted sessions
    // still surface foreground alerts (token setup may happen later).
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);
  }

  Future<NotificationSettings> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    _logger.i('Notification permission: ${settings.authorizationStatus}');
    return settings;
  }

  Future<void> completeSetupAfterPermission() async {
    await _ensureIOSRemoteNotificationRegistration();
    await _initializeFCM();
  }

  /// Returns the current FCM token without rotating it.
  Future<String?> fetchFCMToken() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      return null;
    }
    if (!await hasPushPermission()) {
      return null;
    }

    await _ensureIOSRemoteNotificationRegistration();

    try {
      final token = await _messaging.getToken();
      if (token != null && token != _fcmToken) {
        _fcmToken = token;
        _tokenController.add(token);
      }
      return token ?? _fcmToken;
    } catch (error, stackTrace) {
      _logger.w('FCM getToken failed', error: error, stackTrace: stackTrace);
      return _fcmToken;
    }
  }

  /// Forces a new FCM token from Firebase and emits it on [tokenStream].
  /// Use only from explicit "Re-register" — not on resume or API test.
  Future<String?> refreshFCMToken() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      return null;
    }
    if (!await hasPushPermission()) {
      return null;
    }

    await _ensureIOSRemoteNotificationRegistration();

    try {
      await _messaging.deleteToken();
    } catch (error, stackTrace) {
      _logger.w('FCM deleteToken failed', error: error, stackTrace: stackTrace);
    }

    _fcmToken = null;
    _apnsToken = null;

    if (Platform.isIOS) {
      for (var attempt = 0; attempt < 10; attempt++) {
        try {
          _apnsToken = await _messaging
              .getAPNSToken()
              .timeout(const Duration(seconds: 5));
        } catch (_) {
          _apnsToken = null;
        }
        if (_apnsToken != null) break;
        await Future<void>.delayed(Duration(milliseconds: 300 * (attempt + 1)));
      }
    }

    try {
      _fcmToken = await _messaging.getToken();
    } catch (error, stackTrace) {
      _logger.w('FCM getToken after refresh failed', error: error, stackTrace: stackTrace);
      return null;
    }

    if (_fcmToken != null) {
      _tokenController.add(_fcmToken!);
      _logger.i('FCM token refreshed: $_fcmToken');
    }
    return _fcmToken;
  }

  /// iOS must call registerForRemoteNotifications after the user grants permission.
  /// Doing it only at cold start (before permission) often leaves APNS/FCM without a token.
  Future<void> _ensureIOSRemoteNotificationRegistration() async {
    if (!Platform.isIOS) return;
    try {
      await _iosPushChannel.invokeMethod<void>('registerForRemoteNotifications');
    } catch (error, stackTrace) {
      _logger.w(
        'iOS registerForRemoteNotifications failed',
        error: error,
        stackTrace: stackTrace,
      );
    }
  }

  Future<AuthorizationStatus> getPermissionStatus() async {
    final settings = await _messaging.getNotificationSettings();
    return settings.authorizationStatus;
  }

  Future<bool> hasPushPermission() async {
    final status = await getPermissionStatus();
    return status == AuthorizationStatus.authorized ||
        status == AuthorizationStatus.provisional;
  }

  /// Called from Settings when the user opts in to push alerts.
  Future<bool> enablePushFromSettings() async {
    final settings = await requestPermission();
    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) {
      return false;
    }
    await completeSetupAfterPermission();
    return true;
  }

  /// Stops receiving FCM on this install (user turned notifications off in-app).
  /// OS permission may remain; re-enable re-fetches a new token after grant.
  Future<void> disablePush() async {
    try {
      await _messaging.deleteToken();
    } catch (error, stackTrace) {
      _logger.w('FCM deleteToken on disable failed', error: error, stackTrace: stackTrace);
    }
    _fcmToken = null;
    _apnsToken = null;
  }

  Future<void> _initializeLocalNotifications() async {
    // Use the monochrome icon for notifications (looks correct when system tints it white).
    const androidSettings = AndroidInitializationSettings(
      '@drawable/ic_launcher_monochrome',
    );
    // Do not request OS permission here — only from Settings when the user opts in.
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    if (Platform.isAndroid) {
      // Create all tone channels defensively on startup so that even background
      // or first-launch FCM notifications have a valid channel to target.
      for (final tone in ['default', 'urgent', 'subtle']) {
        await _createChannelForTone(tone, activate: false);
      }

      // Restore the user's last chosen tone (if any) so local notifications use it.
      String activeTone = 'default';
      try {
        final prefs = await SharedPreferences.getInstance();
        final saved = prefs.getString('notification_tone');
        if (saved != null && ['default', 'urgent', 'subtle'].contains(saved)) {
          activeTone = saved;
        }
      } catch (_) {}

      await _createChannelForTone(activeTone, activate: true);
    }
  }

  /// Creates (or recreates) the Android notification channel for [tone].
  /// This also marks it as the active channel for local notifications.
  /// Call this from Settings when the user changes tone.
  Future<void> applyToneChannel(String tone) async {
    await _createChannelForTone(tone, activate: true);
  }

  /// Internal helper to create a channel. When [activate] is false we only
  /// ensure the channel exists (used at startup for all tones).
  Future<void> _createChannelForTone(String tone, {required bool activate}) async {
    if (!Platform.isAndroid) return;

    final channelId = 'logstack_alerts_$tone';
    final importance = tone == 'subtle'
        ? Importance.defaultImportance
        : tone == 'urgent'
            ? Importance.max
            : Importance.high;

    final channel = AndroidNotificationChannel(
      channelId,
      'Logstack Alerts ($tone)',
      description: 'Alert and escalation notifications',
      importance: importance,
      playSound: true,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    if (activate) {
      _activeAndroidChannelId = channelId;
    }
  }

  String _activeAndroidChannelId = 'logstack_alerts_default';

  bool _fcmHandlersReady = false;

  Future<void> _initializeFCM() async {
    bool apnsReady = true;

    // Reinforce foreground presentation (also set in [initialize]).
    if (Platform.isIOS) {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }

    if (Platform.isIOS) {
      String? apnsToken;
      for (var attempt = 0; attempt < 10; attempt++) {
        try {
          apnsToken = await _messaging
              .getAPNSToken()
              .timeout(const Duration(seconds: 5));
        } catch (_) {
          apnsToken = null;
        }
        if (apnsToken != null) break;
        await Future<void>.delayed(Duration(milliseconds: 300 * (attempt + 1)));
      }

      _apnsToken = apnsToken;
      if (apnsToken == null) {
        apnsReady = false;
        _logger.w(
          'APNS token not yet available — will rely on getToken() + onTokenRefresh. '
          'On a physical device this usually means either (1) the Firebase project is missing '
          'an APNs Authentication Key (.p8) under Project Settings > Cloud Messaging, or '
          '(2) the build APS environment does not match how you installed the app '
          '(Xcode Debug needs development; TestFlight/App Store needs production).',
        );
      } else {
        _logger.i('APNS token obtained on iOS');
      }
    }

    // Always attempt to fetch an FCM token. On iOS the plugin may resolve it
    // even if the explicit getAPNSToken loop above was empty (or later via refresh).
    try {
      _fcmToken = await _messaging.getToken();
    } catch (error, stackTrace) {
      _logger.w(
        'FCM token not available on this attempt — registration will happen via onTokenRefresh or retry',
        error: error,
        stackTrace: stackTrace,
      );
      // Do NOT return. We still want listeners attached below so that a token
      // arriving later (refresh, delayed APNS) is captured and can trigger registration.
    }

    if (_fcmToken != null) {
      _tokenController.add(_fcmToken!);
      debugPrint('[push_trace] fcm_token ${_fcmToken!}');
      _logger.i('FCM Token: $_fcmToken');
    } else if (Platform.isIOS && !apnsReady) {
      _logger.i('No FCM token yet on iOS (expected until APNS is ready / Firebase APNs key is configured).');
    }

    // Token refresh only once per process (message handlers attach in initialize).
    if (!_fcmHandlersReady) {
      _messaging.onTokenRefresh.listen((token) {
        _fcmToken = token;
        _tokenController.add(token);
        _logger.i('FCM Token refreshed: $token');
      });
      _fcmHandlersReady = true;
    }

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleInitialMessage(initialMessage);
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final trace =
        '[push_trace] foreground id=${message.messageId} '
        'title=${message.notification?.title} '
        'body=${message.notification?.body} '
        'data=${message.data}';
    debugPrint(trace);
    _logger.i(trace);

    // Prefer system notification payload; fall back to data keys.
    final hasSystemNotification = message.notification != null;
    final title = message.notification?.title ??
        message.data['title'] ??
        'Logstack';
    final body = message.notification?.body ??
        message.data['body'] ??
        message.data['message'] ??
        '';

    if (title.isEmpty && body.isEmpty) {
      return;
    }

    // iOS: remote notification banners are presented by AppDelegate
    // userNotificationCenter:willPresent: when [notification] is present.
    // Showing a local copy would double-fire. Use local only for data-only
    // messages (or Android, where system may not surface foreground alerts).
    if (Platform.isIOS && hasSystemNotification) {
      return;
    }

    unawaited(
      _showLocalNotification(
        title: title,
        body: body,
        payload: message.data.isEmpty ? null : jsonEncode(message.data),
      ),
    );
  }

  void _navigateToLogDetail(Map<String, dynamic> data) {
    final logId = data['logId'];
    if (logId != null) {
      _logger.i('Deep linking to log: $logId');
      Future.delayed(const Duration(milliseconds: 500), () {
        final context = rootNavigatorKey.currentContext;
        if (context != null) {
          GoRouter.of(context).push('/logs/$logId');
        } else {
          _logger.w('Could not navigate: context is null');
        }
      });
    }
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    _logger.i('Message opened app: ${message.messageId}');
    _navigateToLogDetail(message.data);
  }

  void _handleInitialMessage(RemoteMessage message) {
    _logger.i('Initial message: ${message.messageId}');
    _navigateToLogDetail(message.data);
  }

  void _onNotificationTapped(NotificationResponse response) {
    _logger.i('Notification tapped: ${response.payload}');
    if (response.payload != null) {
      try {
        final data = jsonDecode(response.payload!) as Map<String, dynamic>;
        _navigateToLogDetail(data);
      } catch (error) {
        _logger.e('Failed to parse notification payload', error: error);
      }
    }
  }

  Future<void> _showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    final androidDetails = AndroidNotificationDetails(
      _activeAndroidChannelId,
      'Logstack Alerts',
      channelDescription: 'Notifications for Logstack alert triggers',
      icon: '@drawable/ic_launcher_monochrome',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      details,
      payload: payload,
    );
  }

  void dispose() {
    _tokenController.close();
  }

  // ── Test helpers ───────────────────────────────────────────────────────────

  /// Emits [token] directly onto [tokenStream]. Visible for testing only.
  @visibleForTesting
  void emitTokenForTesting(String token) {
    _tokenController.add(token);
  }

  /// Testable variant of [_initializeFCM] that accepts injected dependencies.
  /// This allows property tests to verify APNS-gating behaviour without
  /// requiring a real Firebase connection.
  @visibleForTesting
  Future<void> initializeFcmWithDeps({
    required Future<String?> Function() getApnsToken,
    required Future<String?> Function() getFcmToken,
    required bool isIOS,
  }) async {
    if (isIOS) {
      String? apnsToken;
      try {
        apnsToken =
            await getApnsToken().timeout(const Duration(seconds: 3));
      } catch (_) {
        apnsToken = null;
      }
      if (apnsToken == null) return;
    }
    final token = await getFcmToken();
    if (token != null) {
      _fcmToken = token;
      _tokenController.add(token);
    }
  }
}
