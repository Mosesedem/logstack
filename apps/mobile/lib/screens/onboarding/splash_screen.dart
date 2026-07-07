import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/onboarding_provider.dart';
import 'package:logstack_mobile/providers/security_provider.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:logstack_mobile/widgets/loading_states.dart';

/// SplashScreen serves two distinct purposes:
/// - While onboarding/auth/security state is still loading: a minimal *loading* screen.
/// - For true first-run (onboarding not complete): the *onboarding welcome* screen.
/// This prevents the onboarding visuals from flashing for returning/logged-in users.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Animation<Offset> _slide;
  bool _canContinue = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.85, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _startWelcomeAnimation() {
    if (_controller.isAnimating || _controller.isCompleted) return;
    _controller.forward();
    Timer(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => _canContinue = true);
    });
  }

  Future<void> _continue() async {
    if (!_canContinue) return;
    if (mounted) context.go('/onboarding/push');
  }

  @override
  Widget build(BuildContext context) {
    final onboarding = ref.watch(onboardingProvider);
    final auth = ref.watch(authProvider);
    final security = ref.watch(securityProvider);

    final isLoading = onboarding.isLoading || auth.isLoading || security.isLoading;

    // General loading screen (used on cold start, auth checks, returning users).
    // Distinct from the first-run onboarding welcome.
    if (isLoading) {
      return const _AppLoadingScreen();
    }

    // If we know onboarding is already complete, show neutral loading.
    // Router will redirect to login or home.
    if (onboarding.isComplete) {
      return const _AppLoadingScreen();
    }

    // First-run only: show the distinctive onboarding welcome screen.
    // Schedule animation start after this frame to avoid calling setState during build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _startWelcomeAnimation();
    });

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              FadeTransition(
                opacity: _fade,
                child: ScaleTransition(
                  scale: _scale,
                  child: const Center(child: AppLogo(size: 88)),
                ),
              ),
              const SizedBox(height: 32),
              SlideTransition(
                position: _slide,
                child: FadeTransition(
                  opacity: _fade,
                  child: Column(
                    children: [
                      Text(
                        'Logstack',
                        textAlign: TextAlign.center,
                        style:
                            Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Real-time alerts and logs in your pocket',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: LogstackColors.textSecondary,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              AnimatedOpacity(
                opacity: _canContinue ? 1 : 0.4,
                duration: const Duration(milliseconds: 300),
                child: FilledButton(
                  onPressed: _canContinue ? _continue : null,
                  child: const Text('Get started'),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Tap to continue',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: LogstackColors.textMuted,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Minimal branded loading screen for app startup / auth resolution.
/// Different visuals and no "Get started" CTA.
class _AppLoadingScreen extends StatelessWidget {
  const _AppLoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AppLogo(size: 72),
              const SizedBox(height: 24),
              const LogstackLoading(),
              const SizedBox(height: 12),
              Text(
                'Loading…',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: LogstackColors.textSecondary,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}