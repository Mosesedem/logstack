import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:logstack_mobile/widgets/loading_states.dart';

class PushPermissionScreen extends StatefulWidget {
  const PushPermissionScreen({super.key});

  @override
  State<PushPermissionScreen> createState() => _PushPermissionScreenState();
}

class _PushPermissionScreenState extends State<PushPermissionScreen> {
  bool _requesting = false;
  bool _declined = false;
  String? _statusMessage;

  Future<void> _requestPermission() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      if (mounted) context.go('/onboarding/security');
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
      await NotificationService.instance.completeSetupAfterPermission();
      if (mounted) context.go('/onboarding/security');
      return;
    }

    setState(() {
      _requesting = false;
      _declined = true;
      _statusMessage =
          'Push notifications are required for alert delivery. Please enable them to continue.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              const AppLogo(size: 56),
              const SizedBox(height: 32),
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
                'Logstack sends alerts and escalations to this device. Without notifications, you may miss critical incidents.',
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
                  Text(
                    'If you previously declined, open Settings → Logstack → Notifications and enable alerts, then tap Try again.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: LogstackColors.textMuted,
                        ),
                  ),
                ],
              ],
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}