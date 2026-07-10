import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/notification_tone_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/pin_pad.dart';
import 'package:logstack_mobile/widgets/push_debug_card.dart';
import 'package:url_launcher/url_launcher.dart';

/// Minimal settings: security, notification tone, account, logout.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  AppLockMode _lockMode = AppLockMode.immediate;
  bool? _biometricAvailable;
  bool _biometricEnabled = false;
  bool _hasPin = false;
  bool _loadingSecurity = true;
  AuthorizationStatus? _pushPermission;
  bool _loadingPush = true;

  @override
  void initState() {
    super.initState();
    _loadSecurityState();
    _loadPushPermission();
  }

  Future<void> _loadPushPermission() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      if (mounted) setState(() => _loadingPush = false);
      return;
    }
    final status = await NotificationService.instance.getPermissionStatus();
    if (mounted) {
      setState(() {
        _pushPermission = status;
        _loadingPush = false;
      });
    }
  }

  bool get _pushEnabled =>
      _pushPermission == AuthorizationStatus.authorized ||
      _pushPermission == AuthorizationStatus.provisional;

  String _pushPermissionLabel() {
    if (!DefaultFirebaseOptions.isConfigured) {
      return 'Not available in this build';
    }
    return switch (_pushPermission) {
      AuthorizationStatus.authorized => 'Enabled',
      AuthorizationStatus.provisional => 'Enabled (provisional)',
      AuthorizationStatus.denied => 'Denied — enable in system settings',
      AuthorizationStatus.notDetermined => 'Not enabled',
      _ => 'Unknown',
    };
  }

  Future<void> _loadSecurityState() async {
    final lock = ref.read(appLockServiceProvider);
    final mode = await lock.getLockMode();
    final available = await lock.isBiometricAvailable();
    final enabled = await lock.isBiometricEnabled();
    final hasPin = await lock.hasPin();
    if (mounted) {
      setState(() {
        _lockMode = mode;
        _biometricAvailable = available;
        _biometricEnabled = enabled;
        _hasPin = hasPin;
        _loadingSecurity = false;
      });
    }
  }

  Future<void> _changePin() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: LogstackColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _ChangePinSheet(
        onComplete: () {
          _loadSecurityState();
          Navigator.pop(context);
        },
      ),
    );
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
                  'Security',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              if (_loadingSecurity)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                )
              else ...[
                RadioListTile<AppLockMode>(
                  title: const Text('Lock immediately'),
                  subtitle: const Text('Require unlock when returning to the app'),
                  value: AppLockMode.immediate,
                  groupValue: _lockMode,
                  onChanged: (value) async {
                    if (value == null) return;
                    final lock = ref.read(appLockServiceProvider);
                    await lock.setLockMode(value);
                    if (value == AppLockMode.immediate && !await lock.hasPin()) {
                      await _changePin();
                    }
                    setState(() => _lockMode = value);
                  },
                ),
                const Divider(height: 1),
                RadioListTile<AppLockMode>(
                  title: const Text('Do not lock'),
                  subtitle: const Text('Stay unlocked until sign out'),
                  value: AppLockMode.never,
                  groupValue: _lockMode,
                  onChanged: (value) async {
                    if (value == null) return;
                    await ref.read(appLockServiceProvider).setLockMode(value);
                    setState(() => _lockMode = value);
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.pin_outlined),
                  title: const Text('App PIN'),
                  subtitle: Text(_hasPin ? 'PIN is set' : 'No PIN configured'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _changePin,
                ),
                if (_biometricAvailable == true) ...[
                  const Divider(height: 1),
                  SwitchListTile(
                    secondary: const Icon(Icons.fingerprint),
                    title: const Text('Biometric unlock'),
                    subtitle: const Text(
                      'Use Face ID or fingerprint instead of PIN',
                    ),
                    value: _biometricEnabled,
                    onChanged: (value) async {
                      final lock = ref.read(appLockServiceProvider);
                      if (value) {
                        if (!await lock.hasPin()) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Set an app PIN first'),
                            ),
                          );
                          return;
                        }
                        final ok = await lock.authenticateWithBiometrics(
                          reason: 'Confirm to enable biometric unlock',
                          requireEnabled: false,
                        );
                        if (!ok) return;
                      }
                      await lock.setBiometricEnabled(value);
                      if (mounted) {
                        setState(() => _biometricEnabled = value);
                      }
                    },
                  ),
                ],
              ],
              const SizedBox(height: 8),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Push notifications',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              if (_loadingPush)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                )
              else ...[
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: const Text('Alert notifications'),
                  subtitle: Text(_pushPermissionLabel()),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: !DefaultFirebaseOptions.isConfigured
                      ? null
                      : () async {
                          if (!_pushEnabled) {
                            await context.push('/settings/push');
                            await _loadPushPermission();
                          }
                          if (_pushEnabled) {
                            await ref
                                .read(authProvider.notifier)
                                .registerPushAfterPermission();
                          }
                        },
                ),
                if (DefaultFirebaseOptions.isConfigured && !_pushEnabled)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Text(
                      'Open the setup screen to enable alert and escalation notifications. The system permission prompt appears only when you tap Enable there.',
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                  ),
              ],
              const SizedBox(height: 8),
            ],
          ),
        ),
        if (DefaultFirebaseOptions.isConfigured) ...[
          const SizedBox(height: 16),
          const PushDebugCard(),
        ],
        const SizedBox(height: 16),
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
                    await NotificationService.instance.applyToneChannel(value);
                  },
                );
              }),
              const SizedBox(height: 8),
            ],
          ),
        ),
        const SizedBox(height: 16),
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

class _ChangePinSheet extends ConsumerStatefulWidget {
  const _ChangePinSheet({required this.onComplete});

  final VoidCallback onComplete;

  @override
  ConsumerState<_ChangePinSheet> createState() => _ChangePinSheetState();
}

enum _ChangeStep { verify, create, confirm }

class _ChangePinSheetState extends ConsumerState<_ChangePinSheet> {
  _ChangeStep _step = _ChangeStep.verify;
  bool _hasExisting = false;
  bool _loading = true;
  String _verify = '';
  String _draft = '';
  String _confirm = '';
  String? _error;

  static const _pinLength = 4;

  @override
  void initState() {
    super.initState();
    _loadHasPin();
  }

  Future<void> _loadHasPin() async {
    final lock = ref.read(appLockServiceProvider);
    final has = await lock.hasPin();
    if (!mounted) return;
    setState(() {
      _hasExisting = has;
      _step = has ? _ChangeStep.verify : _ChangeStep.create;
      _loading = false;
    });
  }

  void _onDigit(String digit) {
    if (_loading) return;
    setState(() {
      _error = null;
      if (_step == _ChangeStep.verify) {
        _verify += digit;
        if (_verify.length >= _pinLength) {
          unawaited(_verifyCurrent());
        }
      } else if (_step == _ChangeStep.create) {
        _draft += digit;
        if (_draft.length >= _pinLength) _step = _ChangeStep.confirm;
      } else {
        _confirm += digit;
        if (_confirm.length >= _pinLength) _savePin();
      }
    });
  }

  void _onBackspace() {
    if (_loading) return;
    setState(() {
      _error = null;
      if (_step == _ChangeStep.verify && _verify.isNotEmpty) {
        _verify = _verify.substring(0, _verify.length - 1);
      } else if (_step == _ChangeStep.create && _draft.isNotEmpty) {
        _draft = _draft.substring(0, _draft.length - 1);
      } else if (_step == _ChangeStep.confirm && _confirm.isNotEmpty) {
        _confirm = _confirm.substring(0, _confirm.length - 1);
      }
    });
  }

  Future<void> _verifyCurrent() async {
    final lock = ref.read(appLockServiceProvider);
    final ok = await lock.verifyPin(_verify);
    if (!mounted) return;
    if (ok) {
      setState(() {
        _step = _ChangeStep.create;
        _verify = '';
        _error = null;
      });
    } else {
      setState(() {
        _error = 'Incorrect PIN';
        _verify = '';
      });
    }
  }

  Future<void> _savePin() async {
    if (_confirm != _draft) {
      setState(() {
        _error = 'PINs do not match';
        _step = _ChangeStep.create;
        _draft = '';
        _confirm = '';
      });
      return;
    }
    await ref.read(appLockServiceProvider).setPin(_draft);
    widget.onComplete();
  }

  String get _title {
    if (_loading) return 'App PIN';
    if (_step == _ChangeStep.verify) return 'Enter current PIN';
    if (_step == _ChangeStep.create) {
      return _hasExisting ? 'New PIN' : 'Choose PIN';
    }
    return 'Confirm PIN';
  }

  int get _filled {
    if (_step == _ChangeStep.verify) return _verify.length;
    if (_step == _ChangeStep.create) return _draft.length;
    return _confirm.length;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SafeArea(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              _step == _ChangeStep.verify
                  ? 'Verify your current PIN before changing it.'
                  : 'Your 4-digit app unlock PIN.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: LogstackColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            PinPad(
              pinLength: _pinLength,
              filledCount: _filled,
              onDigit: _onDigit,
              onBackspace: _onBackspace,
              errorText: _error,
            ),
            const SizedBox(height: 16),
            if (_step == _ChangeStep.verify)
              Text(
                'Forgot your PIN? You can sign out and complete setup again after re-linking.',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: LogstackColors.textMuted),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      ),
    );
  }
}