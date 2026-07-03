import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/screens/auth/login_screen.dart';
import 'package:logstack_mobile/screens/auth/email_login_screen.dart';
import 'package:logstack_mobile/screens/auth/qr_scanner_screen.dart';
import 'package:logstack_mobile/screens/auth/pin_login_screen.dart';
import 'package:logstack_mobile/screens/home/home_screen.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/screens/logs/log_detail_screen.dart';
import 'package:logstack_mobile/screens/logs/logs_screen.dart';
import 'package:logstack_mobile/screens/settings/settings_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      if (authState.isLoading) return null;

      final isAuthenticated = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation == '/login' ||
          state.matchedLocation == '/qr-scanner' ||
          state.matchedLocation == '/pin-login' ||
          state.matchedLocation == '/email-login';

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