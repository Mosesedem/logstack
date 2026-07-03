import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/biometric_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/notification_tone_service.dart';
import 'package:url_launcher/url_launcher.dart';

/// Minimal settings: notification tone, biometric lock, account, logout.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool? _biometricAvailable;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadBiometricState();
  }

  Future<void> _loadBiometricState() async {
    final biometric = ref.read(biometricServiceProvider);
    final available = await biometric.isAvailable();
    final enabled = await biometric.isEnabled();
    if (mounted) {
      setState(() {
        _biometricAvailable = available;
        _biometricEnabled = enabled;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final tone = ref.watch(notificationToneProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Notification tone',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Sound for alert and escalation pushes. If notifications are muted at the OS level, change system settings.',
                  style: TextStyle(fontSize: 13, color: Colors.grey),
                ),
              ),
              ...NotificationToneNotifier.tones.map((t) {
                return RadioListTile<String>(
                  title: Text(t[0].toUpperCase() + t.substring(1)),
                  value: t,
                  groupValue: tone,
                  onChanged: (value) async {
                    if (value == null) return;
                    await ref
                        .read(notificationToneProvider.notifier)
                        .setTone(value);
                    await NotificationService.instance
                        .applyToneChannel(value);
                  },
                );
              }),
              const SizedBox(height: 8),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (_biometricAvailable == true)
          Card(
            child: SwitchListTile(
              secondary: const Icon(Icons.fingerprint),
              title: const Text('Biometric unlock'),
              subtitle: const Text(
                'Require Face ID or fingerprint when opening the app',
              ),
              value: _biometricEnabled,
              onChanged: (value) async {
                final biometric = ref.read(biometricServiceProvider);
                if (value) {
                  final ok = await biometric.authenticate(
                    reason: 'Confirm to enable biometric unlock',
                  );
                  if (!ok) return;
                }
                await biometric.setEnabled(value);
                if (mounted) setState(() => _biometricEnabled = value);
              },
            ),
          ),
        if (_biometricAvailable == true) const SizedBox(height: 16),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Account'),
                subtitle: Text(authState.user?.email ?? 'Not signed in'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.open_in_new),
                title: const Text('Manage account on web'),
                subtitle: const Text('Billing, alerts, API keys — logstack.tech'),
                onTap: () => launchUrl(
                  Uri.parse('https://logstack.tech'),
                  mode: LaunchMode.externalApplication,
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Sign out'),
                onTap: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Sign out?'),
                      content: const Text(
                        'Your session and cached logs on this device will be cleared.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Cancel'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Sign out'),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true) {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) context.go('/login');
                  }
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}