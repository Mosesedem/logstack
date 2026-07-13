import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/onboarding_provider.dart';
import 'package:logstack_mobile/providers/security_provider.dart';
import 'package:logstack_mobile/screens/auth/login_screen.dart';
import 'package:logstack_mobile/screens/auth/email_login_screen.dart';
import 'package:logstack_mobile/screens/auth/qr_scanner_screen.dart';
import 'package:logstack_mobile/screens/auth/pin_login_screen.dart';
import 'package:logstack_mobile/screens/home/home_screen.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/screens/logs/log_detail_screen.dart';
import 'package:logstack_mobile/screens/logs/logs_screen.dart';
import 'package:logstack_mobile/screens/onboarding/push_permission_screen.dart';
import 'package:logstack_mobile/screens/onboarding/security_setup_screen.dart';
import 'package:logstack_mobile/screens/onboarding/splash_screen.dart';
import 'package:logstack_mobile/screens/settings/settings_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  // Create GoRouter once — never recreate when auth/onboarding changes (that crashes).
  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/splash',
    redirect: (context, state) {
      final onboarding = ref.read(onboardingProvider);
      final authState = ref.read(authProvider);
      final security = ref.read(securityProvider);

      if (onboarding.isLoading ||
          authState.isLoading ||
          security.isLoading) {
        return null;
      }

      final location = state.matchedLocation;
      final isOnboardingRoute = location.startsWith('/onboarding') ||
          location == '/splash';
      final isPushRoute = location == '/onboarding/push';
      final isSettingsPushRoute = location == '/settings/push';
      final isSecurityRoute = location == '/onboarding/security';
      final isAuthRoute = location == '/login' ||
          state.matchedLocation == '/qr-scanner' ||
          state.matchedLocation == '/pin-login' ||
          state.matchedLocation == '/email-login';

      if (!onboarding.isComplete) {
        if (location != '/splash' && !isPushRoute) return '/splash';
        return null;
      }

      if (isSettingsPushRoute && !authState.isAuthenticated) {
        return '/login';
      }

      // First-run onboarding only — not post-login security re-setup.
      if (isOnboardingRoute && !isSecurityRoute && !isPushRoute) {
        return authState.isAuthenticated ? '/' : '/login';
      }

      if (isPushRoute && onboarding.isComplete) {
        return authState.isAuthenticated ? '/' : '/login';
      }

      final isAuthenticated = authState.isAuthenticated;

      if (!isAuthenticated) {
        if (isSecurityRoute) return '/login';
        if (!isAuthRoute) return '/login';
      }

      if (isAuthenticated && security.needsSetup && !isSecurityRoute) {
        return '/onboarding/security';
      }

      if (isAuthenticated && isAuthRoute) {
        return security.needsSetup ? '/onboarding/security' : '/';
      }

      if (isAuthenticated && isSecurityRoute && !security.needsSetup) {
        return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/onboarding/push',
        builder: (context, state) => const PushPermissionScreen(),
      ),
      GoRoute(
        path: '/onboarding/security',
        builder: (context, state) => const SecuritySetupScreen(),
      ),
      GoRoute(
        path: '/settings/push',
        builder: (context, state) => const PushPermissionScreen(
          flow: PushPermissionFlow.settings,
        ),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/email-login',
        builder: (context, state) => const EmailLoginScreen(),
      ),
      GoRoute(
        path: '/qr-scanner',
        builder: (context, state) => const QRScannerScreen(),
      ),
      GoRoute(
        path: '/pin-login',
        builder: (context, state) => const PINLoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => HomeScreen(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const LogsScreen(),
          ),
          GoRoute(
            path: '/logs/:id',
            builder: (context, state) => LogDetailScreen(
              logId: state.pathParameters['id']!,
              initialLog: state.extra is Log ? state.extra as Log : null,
            ),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsScreen(),
          ),
        ],
      ),
    ],
  );

  ref.listen(onboardingProvider, (_, __) => router.refresh());
  ref.listen(authProvider, (prev, next) {
    if (!next.isLoading) {
      ref
          .read(securityProvider.notifier)
          .refresh(isAuthenticated: next.isAuthenticated);
    }
    router.refresh();
  });
  ref.listen(securityProvider, (_, __) => router.refresh());
  ref.onDispose(router.dispose);
  return router;
});