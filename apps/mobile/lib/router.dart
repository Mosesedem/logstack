import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/onboarding_provider.dart';
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

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);
  final onboarding = ref.watch(onboardingProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      if (onboarding.isLoading || authState.isLoading) return null;

      final location = state.matchedLocation;
      final isOnboardingRoute = location.startsWith('/onboarding') ||
          location == '/splash';
      final isAuthRoute = location == '/login' ||
          location == '/qr-scanner' ||
          location == '/pin-login' ||
          location == '/email-login';

      if (!onboarding.isComplete) {
        if (!isOnboardingRoute) return '/splash';
        return null;
      }

      if (isOnboardingRoute) {
        return authState.isAuthenticated ? '/' : '/login';
      }

      final isAuthenticated = authState.isAuthenticated;

      if (!isAuthenticated && !isAuthRoute) {
        return '/login';
      }
      if (isAuthenticated && isAuthRoute) {
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
});