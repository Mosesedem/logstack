import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/services/notification_tone_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/pin_pad.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Security, notifications, account — companion settings only.
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
  bool _pushOptedIn = true;
  bool _loadingPush = true;
  bool _togglingPush = false;
  String? _appVersion;

  @override
  void initState() {
    super.initState();
    _loadSecurityState();
    _loadPushPermission();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() => _appVersion = '${info.version} (${info.buildNumber})');
      }
    } catch (_) {
      // Version is cosmetic only.
    }
  }

  Future<void> _loadPushPermission() async {
    if (!DefaultFirebaseOptions.isConfigured) {
      if (mounted) setState(() => _loadingPush = false);
      return;
    }
    final status = await NotificationService.instance.getPermissionStatus();
    final optedIn =
        await ref.read(storageServiceProvider).isPushNotificationsEnabled();
    if (mounted) {
      setState(() {
        _pushPermission = status;
        _pushOptedIn = optedIn;
        _loadingPush = false;
      });
    }
  }

  bool get _osPushGranted =>
      _pushPermission == AuthorizationStatus.authorized ||
      _pushPermission == AuthorizationStatus.provisional;

  /// Toggle is on only when the user opted in and OS permission is granted.
  bool get _pushEnabled => _pushOptedIn && _osPushGranted;

  String _pushPermissionLabel() {
    if (!DefaultFirebaseOptions.isConfigured) {
      return 'Not available in this build';
    }
    if (_pushEnabled) {
      return _pushPermission == AuthorizationStatus.provisional
          ? 'On (quiet delivery)'
          : 'On — alerts will notify this device';
    }
    if (!_pushOptedIn) {
      return 'Off — enable anytime to receive alert pushes';
    }
    return switch (_pushPermission) {
      AuthorizationStatus.denied => 'Off — allow in system Settings first',
      AuthorizationStatus.notDetermined => 'Off — not enabled yet',
      _ => 'Off',
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

  /// Confirm + PIN (when set) before turning off app lock.
  Future<void> _disableAppLock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Turn off app lock?'),
        content: const Text(
          'Logstack will stay unlocked on this device until you sign out. '
          'Anyone who can open the app will see your logs without a PIN.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: LogstackColors.errorRed,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final lock = ref.read(appLockServiceProvider);
    if (await lock.hasPin()) {
      if (!mounted) return;
      final pinOk = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: LogstackColors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        builder: (context) => const _VerifyPinSheet(
          title: 'Enter PIN to disable lock',
          subtitle: 'Confirm it is you before turning off app lock.',
        ),
      );
      if (pinOk != true || !mounted) return;
    }

    await lock.setLockMode(AppLockMode.never);
    if (mounted) {
      setState(() => _lockMode = AppLockMode.never);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('App lock turned off')),
      );
    }
  }

  Future<void> _enableAppLock() async {
    final lock = ref.read(appLockServiceProvider);
    await lock.setLockMode(AppLockMode.immediate);
    if (!await lock.hasPin()) {
      await _changePin();
    }
    if (mounted) {
      setState(() => _lockMode = AppLockMode.immediate);
      await _loadSecurityState();
    }
  }

  Future<void> _onPushToggle(bool enable) async {
    if (!DefaultFirebaseOptions.isConfigured || _togglingPush) return;

    if (!enable) {
      setState(() => _togglingPush = true);
      try {
        await ref.read(authProvider.notifier).disablePushNotifications();
        if (mounted) {
          setState(() {
            _pushOptedIn = false;
            _togglingPush = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Alert notifications turned off')),
          );
        }
      } catch (_) {
        if (mounted) setState(() => _togglingPush = false);
      }
      return;
    }

    // Enabling: if OS already granted, opt in and register; else request.
    setState(() => _togglingPush = true);
    try {
      if (_osPushGranted) {
        await ref.read(storageServiceProvider).setPushNotificationsEnabled(true);
        await NotificationService.instance.completeSetupAfterPermission();
        await ref.read(authProvider.notifier).registerPushAfterPermission();
        if (mounted) {
          setState(() {
            _pushOptedIn = true;
            _togglingPush = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Alert notifications enabled')),
          );
        }
        return;
      }

      if (_pushPermission == AuthorizationStatus.denied) {
        if (mounted) setState(() => _togglingPush = false);
        await _openSystemNotificationSettings();
        return;
      }

      // notDetermined or unknown — dedicated consent screen
      if (mounted) setState(() => _togglingPush = false);
      await context.push('/settings/push');
      await _loadPushPermission();
    } catch (_) {
      if (mounted) setState(() => _togglingPush = false);
    }
  }

  Future<void> _openSystemNotificationSettings() async {
    try {
      await launchUrl(Uri.parse('app-settings:'));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Open Settings → Logstack → Notifications')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final tone = ref.watch(notificationToneProvider);
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const _SectionHeader(
          icon: Icons.shield_outlined,
          title: 'Security',
          subtitle: 'PIN and unlock when returning to the app',
        ),
        const SizedBox(height: 8),
        Card(
          child: _loadingSecurity
              ? const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Column(
                  children: [
                    RadioListTile<AppLockMode>(
                      title: const Text('Lock immediately'),
                      subtitle: const Text(
                        'Require PIN or biometrics when you leave the app',
                      ),
                      value: AppLockMode.immediate,
                      groupValue: _lockMode,
                      onChanged: (value) async {
                        if (value == null || value == _lockMode) return;
                        await _enableAppLock();
                      },
                    ),
                    const Divider(height: 1),
                    RadioListTile<AppLockMode>(
                      title: const Text('Do not lock'),
                      subtitle: const Text(
                        'Stay unlocked until you sign out',
                      ),
                      value: AppLockMode.never,
                      groupValue: _lockMode,
                      onChanged: (value) async {
                        if (value == null || value == _lockMode) return;
                        await _disableAppLock();
                      },
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(
                        Icons.pin_outlined,
                        color: LogstackColors.textSecondary,
                      ),
                      title: const Text('App PIN'),
                      subtitle: Text(
                        _hasPin ? 'Change your 4-digit unlock PIN' : 'Set a 4-digit unlock PIN',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _changePin,
                    ),
                    if (_biometricAvailable == true) ...[
                      const Divider(height: 1),
                      SwitchListTile(
                        secondary: const Icon(
                          Icons.fingerprint,
                          color: LogstackColors.textSecondary,
                        ),
                        title: const Text('Biometric unlock'),
                        subtitle: const Text(
                          'Face ID or fingerprint instead of PIN',
                        ),
                        value: _biometricEnabled,
                        onChanged: (value) async {
                          final lock = ref.read(appLockServiceProvider);
                          final messenger = ScaffoldMessenger.of(context);
                          if (value) {
                            if (!await lock.hasPin()) {
                              messenger.showSnackBar(
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
                ),
        ),
        const SizedBox(height: 24),
        const _SectionHeader(
          icon: Icons.notifications_outlined,
          title: 'Notifications',
          subtitle: 'Alert pushes and sound',
        ),
        const SizedBox(height: 8),
        Card(
          child: _loadingPush
              ? const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SwitchListTile(
                      secondary: Icon(
                        _pushEnabled
                            ? Icons.notifications_active_outlined
                            : Icons.notifications_off_outlined,
                        color: _pushEnabled
                            ? LogstackColors.liveGreen
                            : LogstackColors.textSecondary,
                      ),
                      title: const Text('Alert notifications'),
                      subtitle: Text(_pushPermissionLabel()),
                      value: _pushEnabled,
                      onChanged: !DefaultFirebaseOptions.isConfigured ||
                              _togglingPush
                          ? null
                          : _onPushToggle,
                    ),
                    if (DefaultFirebaseOptions.isConfigured && !_pushEnabled)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Notifications are optional. Turn them on to get alert and escalation pushes on this device.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: LogstackColors.textMuted,
                              ),
                            ),
                            if (_pushPermission == AuthorizationStatus.denied) ...[
                              const SizedBox(height: 8),
                              TextButton.icon(
                                onPressed: _openSystemNotificationSettings,
                                icon: const Icon(Icons.settings_outlined, size: 18),
                                label: const Text('Open system settings'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      child: Text(
                        'Notification tone',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                      child: Text(
                        'Sound for alert and escalation pushes. System mute still applies.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: LogstackColors.textMuted,
                        ),
                      ),
                    ),
                    ...NotificationToneNotifier.tones.map((t) {
                      final label = t[0].toUpperCase() + t.substring(1);
                      return RadioListTile<String>(
                        title: Text(label),
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
                    const SizedBox(height: 4),
                  ],
                ),
        ),
        const SizedBox(height: 24),
        const _SectionHeader(
          icon: Icons.warning_amber_outlined,
          title: 'Escalation',
          subtitle: 'Email recipient for escalated log alerts',
        ),
        const SizedBox(height: 8),
        _EscalationSettingsCard(),
        const SizedBox(height: 24),
        _SectionHeader(
          icon: Icons.person_outline,
          title: 'Account',
          subtitle: authState.user?.email ?? 'Not signed in',
        ),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(
                  Icons.open_in_new,
                  color: LogstackColors.textSecondary,
                ),
                title: const Text('Manage your Projects'),
                subtitle: const Text(
                  'Usage, alerts, API keys — logstack.tech',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => launchUrl(
                  Uri.parse('https://logstack.tech'),
                  mode: LaunchMode.externalApplication,
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(
                  Icons.logout,
                  color: LogstackColors.errorRed,
                ),
                title: const Text(
                  'Sign out',
                  style: TextStyle(color: LogstackColors.errorRed),
                ),
                subtitle: const Text('Logout from this device.'),
                onTap: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Sign out?'),
                      content: const Text(
                        'You will be logged out of this device.',
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
        if (_appVersion != null) ...[
          const SizedBox(height: 28),
          Center(
            child: Text(
              'Logstack $_appVersion',
              style: theme.textTheme.bodySmall?.copyWith(
                color: LogstackColors.textMuted,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: LogstackColors.textSecondary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: LogstackColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Bottom sheet: verify current PIN (returns true if correct).
class _VerifyPinSheet extends ConsumerStatefulWidget {
  const _VerifyPinSheet({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  ConsumerState<_VerifyPinSheet> createState() => _VerifyPinSheetState();
}

class _VerifyPinSheetState extends ConsumerState<_VerifyPinSheet> {
  String _pin = '';
  String? _error;
  bool _busy = false;

  static const _pinLength = 4;

  void _onDigit(String digit) {
    if (_busy) return;
    setState(() {
      _error = null;
      _pin += digit;
      if (_pin.length >= _pinLength) {
        unawaited(_verify());
      }
    });
  }

  void _onBackspace() {
    if (_busy || _pin.isEmpty) return;
    setState(() {
      _error = null;
      _pin = _pin.substring(0, _pin.length - 1);
    });
  }

  Future<void> _verify() async {
    setState(() => _busy = true);
    final ok = await ref.read(appLockServiceProvider).verifyPin(_pin);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context, true);
      return;
    }
    setState(() {
      _error = 'Incorrect PIN';
      _pin = '';
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: LogstackColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              widget.subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: LogstackColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            PinPad(
              pinLength: _pinLength,
              filledCount: _pin.length,
              onDigit: _onDigit,
              onBackspace: _onBackspace,
              errorText: _error,
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
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
        if (_confirm.length >= _pinLength) unawaited(_savePin());
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
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: LogstackColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              _step == _ChangeStep.verify
                  ? 'Verify your current PIN before changing it.'
                  : 'Your 4-digit app unlock PIN.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: LogstackColors.textSecondary,
                  ),
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
                'Forgot your PIN? Sign out and set up security again after re-linking.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: LogstackColors.textMuted,
                    ),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      ),
    );
  }
}

/// Card widget for escalation email settings.
class _EscalationSettingsCard extends ConsumerStatefulWidget {
  @override
  ConsumerState<_EscalationSettingsCard> createState() =>
      _EscalationSettingsCardState();
}

class _EscalationSettingsCardState
    extends ConsumerState<_EscalationSettingsCard> {
  final _controller = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = true;
  bool _saving = false;
  String? _savedEmail;

  @override
  void initState() {
    super.initState();
    _loadEscalationEmail();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadEscalationEmail() async {
    try {
      final user = await ref.read(authServiceProvider).fetchCurrentUser();
      if (mounted) {
        setState(() {
          _controller.text = user.escalationEmail ?? '';
          _savedEmail = user.escalationEmail ?? '';
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _hasChanges => _controller.text.trim() != (_savedEmail ?? '');

  String? _validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) return null; // optional field
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!emailRegex.hasMatch(value.trim())) {
      return 'Enter a valid email address';
    }
    return null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final updated = await ref.read(authServiceProvider).updateProfile(
            escalationEmail: _controller.text.trim(),
          );
      if (mounted) {
        setState(() {
          _savedEmail = updated.escalationEmail ?? '';
          _saving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Escalation email saved')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Escalation email',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'When a log is escalated, a detailed alert email will be '
                'sent to this address. Leave empty to use your account email.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: LogstackColors.textMuted,
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _controller,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                textInputAction: TextInputAction.done,
                validator: _validateEmail,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'escalation@example.com',
                  prefixIcon: Icon(Icons.alternate_email),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  onPressed: _hasChanges && !_saving ? _save : null,
                  icon: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.save_outlined, size: 18),
                  label: Text(_saving ? 'Saving\u2026' : 'Save'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
