import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/onboarding_provider.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:logstack_mobile/widgets/loading_states.dart';
import 'package:url_launcher/url_launcher.dart';

enum PushPermissionFlow { onboarding, settings }

/// Explains push alerts and triggers the OS permission dialog only when the
/// user taps Enable — never on screen load or app launch.
/// Onboarding always offers Skip / set up later (Guideline 4.5.4).
class PushPermissionScreen extends ConsumerStatefulWidget {
  const PushPermissionScreen({
    super.key,
    this.flow = PushPermissionFlow.onboarding,
  });

  final PushPermissionFlow flow;

  @override
  ConsumerState<PushPermissionScreen> createState() =>
      _PushPermissionScreenState();
}

class _PushPermissionScreenState extends ConsumerState<PushPermissionScreen> {
  bool _requesting = false;
  bool _declined = false;
  String? _statusMessage;

  bool get _fromSettings => widget.flow == PushPermissionFlow.settings;

  Future<void> _finishOnboarding() async {
    final onboarding = ref.read(onboardingProvider.notifier);
    await onboarding.markComplete();
    // Router redirect sends the user to /login once onboarding is complete.
    unawaited(_completePushSetup());
  }

  Future<void> _skipOnboarding() async {
    final storage = ref.read(storageServiceProvider);
    await storage.setPushNotificationsEnabled(false);
    final onboarding = ref.read(onboardingProvider.notifier);
    await onboarding.markComplete();
  }

  Future<void> _finishFromSettings() async {
    final storage = ref.read(storageServiceProvider);
    await storage.setPushNotificationsEnabled(true);
    final auth = ref.read(authProvider.notifier);
    if (mounted) context.pop();
    unawaited(_completePushSetup(auth: auth));
  }

  Future<void> _completePushSetup({AuthNotifier? auth}) async {
    try {
      await NotificationService.instance.completeSetupAfterPermission();
    } catch (_) {
      // Simulator often lacks APNS — permission is still granted; token
      // registration can happen later when a real token is available.
    }
    if (auth != null) {
      await auth.registerPushAfterPermission();
    }
  }

  Future<void> _requestPermission() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      if (_fromSettings) {
        if (mounted) context.pop();
      } else {
        final storage = ref.read(storageServiceProvider);
        await storage.setPushNotificationsEnabled(false);
        await _finishOnboardingWithoutSetup();
      }
      return;
    }

    setState(() {
      _requesting = true;
      _declined = false;
      _statusMessage = null;
    });

    final settings = await NotificationService.instance.requestPermission();

    if (!mounted) return;

    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      final storage = ref.read(storageServiceProvider);
      await storage.setPushNotificationsEnabled(true);
      if (_fromSettings) {
        await _finishFromSettings();
      } else {
        await _finishOnboarding();
      }
      return;
    }

    setState(() {
      _requesting = false;
      _declined = true;
      _statusMessage = _fromSettings
          ? 'Notifications were not enabled. You can allow them in system settings, then try again — or leave them off.'
          : 'Notifications are optional. You can enable them later in Settings, or open system settings if you previously declined.';
    });
  }

  Future<void> _finishOnboardingWithoutSetup() async {
    final onboarding = ref.read(onboardingProvider.notifier);
    await onboarding.markComplete();
  }

  Future<void> _openSystemNotificationSettings() async {
    if (Platform.isIOS) {
      await launchUrl(Uri.parse('app-settings:'));
      return;
    }
    if (Platform.isAndroid) {
      await launchUrl(Uri.parse('package:tech.logstack.mobile'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _fromSettings
          ? AppBar(
              title: const Text('Push notifications'),
            )
          : null,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!_fromSettings) ...[
                const SizedBox(height: 16),
                const Center(child: AppLogo(size: 72)),
                const SizedBox(height: 32),
              ],
              Icon(
                Icons.notifications_active_outlined,
                size: 48,
                color: _declined
                    ? LogstackColors.warnAmber
                    : LogstackColors.accentBlue,
              ),
              const SizedBox(height: 20),
              Text(
                'Enable push notifications',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                'Logstack can send alerts and escalations to this device. '
                'Notifications are optional — you can turn them on or off anytime in Settings.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: LogstackColors.textSecondary,
                      height: 1.5,
                    ),
              ),
              if (_statusMessage != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: LogstackColors.warnAmber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: LogstackColors.warnAmber.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.info_outline,
                        color: LogstackColors.warnAmber,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _statusMessage!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: LogstackColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const Spacer(),
              if (_requesting)
                const LogstackLoading(message: 'Requesting permission…')
              else ...[
                FilledButton.icon(
                  onPressed: _requestPermission,
                  icon: const Icon(Icons.notifications_outlined),
                  label: Text(_declined ? 'Try again' : 'Enable notifications'),
                ),
                if (_declined) ...[
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _openSystemNotificationSettings,
                    child: const Text('Open system settings'),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'If you previously declined, open Settings → Logstack → Notifications and enable alerts, then tap Try again.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: LogstackColors.textMuted,
                        ),
                  ),
                ],
                const SizedBox(height: 12),
                if (_fromSettings)
                  TextButton(
                    onPressed: () => context.pop(),
                    child: const Text('Not now'),
                  )
                else
                  TextButton(
                    onPressed: _requesting ? null : _skipOnboarding,
                    child: const Text('Skip — set up later'),
                  ),
              ],
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
