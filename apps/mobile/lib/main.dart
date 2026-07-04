import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:logger/logger.dart';
import 'package:logstack_mobile/app.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/services/notification_service.dart';

final _logger = Logger();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    _logger.e(
      'Flutter error',
      error: details.exception,
      stackTrace: details.stack,
    );
    FlutterError.presentError(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    _logger.e('Uncaught error', error: error, stackTrace: stack);
    return true;
  };

  await Hive.initFlutter();

  if (DefaultFirebaseOptions.isConfigured) {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      await NotificationService.instance.initialize();
    } catch (error, stackTrace) {
      _logger.e('Firebase init failed', error: error, stackTrace: stackTrace);
    }
  } else {
    _logger.w('Firebase is not configured — push notifications are disabled.');
  }

  runApp(const ProviderScope(child: LogstackApp()));
}