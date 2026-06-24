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
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Request permission
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    _logger.i('Notification permission: ${settings.authorizationStatus}');

    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      await _initializeLocalNotifications();
      await _initializeFCM();
    }
  }

  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // Create notification channel for Android
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'logstack_alerts',
        'Logstack Alerts',
        description: 'Notifications for Logstack alert triggers',
        importance: Importance.high,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  Future<void> _initializeFCM() async {
    if (Platform.isIOS) {
      String? apnsToken;
      try {
        apnsToken = await _messaging
            .getAPNSToken()
            .timeout(const Duration(seconds: 3));
      } catch (_) {
        apnsToken = null;
      }

      if (apnsToken == null) {
        _logger.w(
          'APNS token is null — FCM token unavailable on this iOS device. '
          'Ensure APNS is configured correctly (sandbox for TestFlight).',
        );
        return;
      }
    }

    _fcmToken = await _messaging.getToken();
    if (_fcmToken != null) {
      _tokenController.add(_fcmToken!);
      _logger.i('FCM Token: $_fcmToken');
    }

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
    const androidDetails = AndroidNotificationDetails(
      'logstack_alerts',
      'Logstack Alerts',
      channelDescription: 'Notifications for Logstack alert triggers',
      importance: Importance.high,
      priority: Priority.high,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
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
