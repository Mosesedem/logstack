import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:logger/logger.dart';
import 'package:logstack_mobile/app.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/services/notification_service.dart';

final _logger = Logger();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Hive.initFlutter();

  if (DefaultFirebaseOptions.isConfigured) {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await NotificationService.instance.initialize();
  } else {
    _logger.w(
      'Firebase is not configured — push notifications are disabled. '
      'Run `flutterfire configure` to generate firebase_options.dart.',
    );
  }

  runApp(const ProviderScope(child: LogstackApp()));
}
