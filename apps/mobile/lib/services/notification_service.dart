import 'dart:async';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:logger/logger.dart';
import 'package:logstack_mobile/firebase_options.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Background message received — no further processing needed at this layer
}

class NotificationService {
  static final NotificationService instance = NotificationService._();
  NotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Logger _logger = Logger();

  final StreamController<String> _tokenController =
      StreamController<String>.broadcast();
  Stream<String> get tokenStream => _tokenController.stream;

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  Future<void> initialize() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      _logger.w(
        'Skipping notification setup — Firebase options are still placeholders.',
      );
      return;
    }

    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await _initializeLocalNotifications();
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
    await _initializeFCM();
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

  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
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
      await applyToneChannel('default');
    }
  }

  /// Creates (or recreates) the Android notification channel for [tone].
  /// Android 8+ cannot change sound on an existing channel — use a new ID per tone.
  Future<void> applyToneChannel(String tone) async {
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

    _activeAndroidChannelId = channelId;
  }

  String _activeAndroidChannelId = 'logstack_alerts_default';

  Future<void> _initializeFCM() async {
    bool apnsReady = true;

    if (Platform.isIOS) {
      String? apnsToken;
      for (var attempt = 0; attempt < 3; attempt++) {
        try {
          apnsToken = await _messaging
              .getAPNSToken()
              .timeout(const Duration(seconds: 3));
        } catch (_) {
          apnsToken = null;
        }
        if (apnsToken != null) break;
        await Future<void>.delayed(const Duration(milliseconds: 400));
      }

      if (apnsToken == null) {
        apnsReady = false;
        _logger.w(
          'APNS token not yet available — will rely on getToken() + onTokenRefresh. '
          'On physical devices + TestFlight this usually means the Firebase project '
          'is missing an APNs Authentication Key (p8) under Project Settings > Cloud Messaging. '
          'Push will not be deliverable until that is configured.',
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
      _logger.i('FCM Token: $_fcmToken');
    } else if (Platform.isIOS && !apnsReady) {
      _logger.i('No FCM token yet on iOS (expected until APNS is ready / Firebase APNs key is configured).');
    }

    // Always attach refresh + message handlers. Early return previously prevented this
    // on iOS when the first APNS probe failed, breaking later recovery.
    _messaging.onTokenRefresh.listen((token) {
      _fcmToken = token;
      _tokenController.add(token);
      _logger.i('FCM Token refreshed: $token');
    });

    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleInitialMessage(initialMessage);
    }

    // Listeners are attached. On iOS the native AppDelegate calls registerForRemoteNotifications()
    // after launch + after permission grant. That + the onTokenRefresh listener give us the best
    // chance of obtaining a usable FCM token even if the first APNS probe was slow.
  }

  void _handleForegroundMessage(RemoteMessage message) {
    _logger.i('Foreground message: ${message.messageId}');

    final notification = message.notification;
    if (notification != null) {
      _showLocalNotification(
        title: notification.title ?? 'Logstack Alert',
        body: notification.body ?? '',
        payload: message.data.toString(),
      );
    }
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    _logger.i('Message opened app: ${message.messageId}');
    // Navigate to relevant screen based on message data
  }

  void _handleInitialMessage(RemoteMessage message) {
    _logger.i('Initial message: ${message.messageId}');
    // Navigate to relevant screen based on message data
  }

  void _onNotificationTapped(NotificationResponse response) {
    _logger.i('Notification tapped: ${response.payload}');
    // Navigate to relevant screen based on payload
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
