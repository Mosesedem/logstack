import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
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
  bool _checking = true;
  String _pin = '';
  String? _error;
  bool _biometricAvailable = false;

  static const _pinLength = 4;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _unlockIfNeeded();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      setState(() {
        _unlocked = false;
        _pin = '';
        _error = null;
      });
      _unlockIfNeeded();
    }
  }

  Future<void> _unlockIfNeeded() async {
    final lock = ref.read(appLockServiceProvider);
    if (!await lock.shouldLock()) {
      if (mounted) {
        setState(() {
          _unlocked = true;
          _checking = false;
        });
      }
      return;
    }

    final bioAvailable = await lock.isBiometricAvailable();
    if (mounted) setState(() => _biometricAvailable = bioAvailable);

    if (await lock.isBiometricEnabled()) {
      final ok = await lock.authenticateWithBiometrics();
      if (!mounted) return;
      if (ok) {
        setState(() {
          _unlocked = true;
          _checking = false;
          _pin = '';
          _error = null;
        });
        return;
      }
    }

    if (mounted) {
      setState(() {
        _checking = false;
        _unlocked = false;
      });
    }
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
    setState(() => _checking = true);
    final lock = ref.read(appLockServiceProvider);
    final ok = await lock.authenticateWithBiometrics();
    if (!mounted) return;
    setState(() {
      _checking = false;
      if (ok) {
        _unlocked = true;
        _pin = '';
        _error = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Material(
        color: LogstackColors.background,
        child: LogstackLoading(message: 'Checking security…'),
      );
    }
    if (!_unlocked) {
      return Material(
        color: LogstackColors.background,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Spacer(),
                const AppLogo(size: 72),
                const SizedBox(height: 24),
                Text(
                  'Logstack is locked',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter your PIN to continue',
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
                if (_biometricAvailable) ...[
                  const SizedBox(height: 24),
                  TextButton.icon(
                    onPressed: _tryBiometric,
                    icon: const Icon(Icons.fingerprint),
                    label: const Text('Use biometrics'),
                  ),
                ],
                const Spacer(),
              ],
            ),
          ),
        ),
      );
    }
    return widget.child;
  }
}