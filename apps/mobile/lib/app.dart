import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/router.dart';
import 'package:logstack_mobile/theme/app_theme.dart';
import 'package:logstack_mobile/widgets/app_lock_gate.dart';

/// Stable key so AppLockGate's internal state survives root widget rebuilds
/// triggered by router/auth/security provider notifications.
final _appLockGateKey = GlobalKey();

class LogstackApp extends ConsumerWidget {
  const LogstackApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Logstack',
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      builder: (context, child) => AppLockGate(
        key: _appLockGateKey,
        child: child ?? const SizedBox(),
      ),
    );
  }
}
