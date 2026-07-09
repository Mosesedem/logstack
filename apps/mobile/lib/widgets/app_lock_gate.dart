import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
import 'package:logstack_mobile/theme/app_theme.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:logstack_mobile/widgets/loading_states.dart';
import 'package:logstack_mobile/widgets/pin_pad.dart';

class AppLockGate extends ConsumerStatefulWidget {
  const AppLockGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends ConsumerState<AppLockGate>
    with WidgetsBindingObserver {
  bool _unlocked = false;
  bool _checking = true; // only true during very first cold start check
  bool _attemptingBiometric = false;
  bool _autoBioAttempted = false;
  String _pin = '';
  String? _error;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  /// True after a real background ([AppLifecycleState.paused] / hidden).
  /// Face ID / fingerprint sheets typically only go inactive→resumed, and
  /// on some platforms they also pause — we still must not re-lock while
  /// [_attemptingBiometric] is true, and must clear this after auth.
  bool _requiresLockOnResume = false;

  static const _pinLength = 4;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _unlockIfNeeded(isInitial: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  bool get _bioAuthBusy {
    if (_attemptingBiometric) return true;
    return ref.read(appLockServiceProvider).shouldSuppressLifecycleLock;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      // System biometric sheets can pause the app. Do not schedule a
      // re-lock while we are mid-auth — that is the infinite Face ID loop.
      if (_bioAuthBusy) return;
      _requiresLockOnResume = true;
      if (_unlocked && mounted) {
        // Hide app content while backgrounded (app switcher privacy).
        setState(() {
          _unlocked = false;
          _pin = '';
          _error = null;
          _autoBioAttempted = false;
          _checking = false;
        });
      }
      return;
    }

    if (state == AppLifecycleState.resumed) {
      _onResumed();
    }
    // inactive / detached: Face ID and system overlays use inactive —
    // never re-lock on those alone.
  }

  void _onResumed() {
    // Resume from biometric dialog (gate or settings/setup) — do not re-prompt.
    if (_bioAuthBusy) {
      // Auth sheet caused pause; ignore so we don't re-lock after success.
      _requiresLockOnResume = false;
      return;
    }

    if (!_requiresLockOnResume) {
      // inactive → resumed only (control center, notification shade, etc.)
      return;
    }

    _requiresLockOnResume = false;
    if (!mounted) return;

    setState(() {
      _unlocked = false;
      _pin = '';
      _error = null;
      _attemptingBiometric = false;
      _autoBioAttempted = false;
      _checking = false;
    });
    _unlockIfNeeded(isInitial: false);
  }

  Future<void> _unlockIfNeeded({bool isInitial = false}) async {
    final lock = ref.read(appLockServiceProvider);

    final should = await lock.shouldLock();
    if (!mounted) return;

    if (!should) {
      setState(() {
        _unlocked = true;
        _checking = false;
        _attemptingBiometric = false;
        _autoBioAttempted = false;
      });
      return;
    }

    // Determine bio capability (once per gate lifetime is fine)
    if (!_biometricAvailable) {
      final bioAvailable = await lock.isBiometricAvailable();
      if (mounted) setState(() => _biometricAvailable = bioAvailable);
    }

    final bioEnabled = await lock.isBiometricEnabled();
    if (mounted) {
      setState(() => _biometricEnabled = bioEnabled);
    }
    if (!mounted) return;

    if (bioEnabled && !_autoBioAttempted) {
      _autoBioAttempted = true;
      await _runBiometricAuth(
        lock: lock,
        showChecking: isInitial,
      );
      return;
    }

    // No auto bio (or already attempted this cycle), show PIN UI
    setState(() {
      _checking = false;
      _unlocked = false;
      _attemptingBiometric = false;
    });
  }

  /// Runs system biometric auth without treating lifecycle resume as a new lock.
  Future<void> _runBiometricAuth({
    required AppLockService lock,
    bool showChecking = false,
    bool requireEnabled = true,
    String reason = 'Unlock Logstack',
  }) async {
    setState(() {
      _attemptingBiometric = true;
      _error = null;
      if (showChecking) _checking = true;
    });

    // Auth UI will pause/resume the app; those events must not re-lock.
    _requiresLockOnResume = false;

    final ok = await lock.authenticateWithBiometrics(
      reason: reason,
      requireEnabled: requireEnabled,
    );

    // Drop any pause that occurred during the sheet so a late resumed
    // event does not immediately re-lock and re-prompt.
    _requiresLockOnResume = false;

    if (!mounted) return;

    setState(() {
      _attemptingBiometric = false;
      _checking = false;
      if (ok) {
        _unlocked = true;
        _pin = '';
        _error = null;
      }
      // on fail/cancel: fall through to show stable PIN pad + manual button
    });
  }

  void _onDigit(String digit) {
    if (_pin.length >= _pinLength) return;
    setState(() {
      _error = null;
      _pin += digit;
    });
    if (_pin.length == _pinLength) {
      _verifyPin();
    }
  }

  void _onBackspace() {
    if (_pin.isEmpty) return;
    setState(() {
      _error = null;
      _pin = _pin.substring(0, _pin.length - 1);
    });
  }

  Future<void> _verifyPin() async {
    final lock = ref.read(appLockServiceProvider);
    final ok = await lock.verifyPin(_pin);
    if (!mounted) return;
    if (ok) {
      setState(() {
        _unlocked = true;
        _pin = '';
        _error = null;
      });
    } else {
      setState(() {
        _error = 'Incorrect PIN';
        _pin = '';
      });
    }
  }

  Future<void> _tryBiometric() async {
    final lock = ref.read(appLockServiceProvider);
    await _runBiometricAuth(lock: lock);
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return Theme(
        data: AppTheme.dark,
        child: const Material(
          color: LogstackColors.background,
          child: LogstackLoading(message: 'Checking security…'),
        ),
      );
    }

    if (!_unlocked) {
      final bioLabel =
          _attemptingBiometric ? 'Authenticating…' : 'Use biometrics';

      return Theme(
        data: AppTheme.dark,
        child: Material(
          color: LogstackColors.background,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Spacer(),
                  const AppLogo(),
                  const SizedBox(height: 24),
                  Text(
                    'Logstack is locked',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _attemptingBiometric
                        ? 'Unlocking with biometrics…'
                        : 'Enter your PIN to continue',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: LogstackColors.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 32),
                  PinPad(
                    pinLength: _pinLength,
                    filledCount: _pin.length,
                    onDigit: _onDigit,
                    onBackspace: _onBackspace,
                    errorText: _error,
                  ),
                  if (_biometricAvailable && _biometricEnabled) ...[
                    const SizedBox(height: 24),
                    TextButton.icon(
                      onPressed: _attemptingBiometric ? null : _tryBiometric,
                      icon: const Icon(Icons.fingerprint),
                      label: Text(bioLabel),
                    ),
                  ],
                  const Spacer(),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return widget.child;
  }
}
