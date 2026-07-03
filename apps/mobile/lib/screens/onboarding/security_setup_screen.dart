import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/onboarding_provider.dart';
import 'package:logstack_mobile/providers/security_provider.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/pin_pad.dart';

enum _PinStep { create, confirm }

class SecuritySetupScreen extends ConsumerStatefulWidget {
  const SecuritySetupScreen({super.key});

  @override
  ConsumerState<SecuritySetupScreen> createState() =>
      _SecuritySetupScreenState();
}

class _SecuritySetupScreenState extends ConsumerState<SecuritySetupScreen> {
  AppLockMode _lockMode = AppLockMode.immediate;
  _PinStep _pinStep = _PinStep.create;
  String _draftPin = '';
  String _pin = '';
  String? _error;
  bool _biometricAvailable = false;
  bool _enableBiometric = false;
  bool _saving = false;

  static const _pinLength = 4;

  @override
  void initState() {
    super.initState();
    _loadBiometric();
  }

  Future<void> _loadBiometric() async {
    final lock = ref.read(appLockServiceProvider);
    final available = await lock.isBiometricAvailable();
    if (mounted) setState(() => _biometricAvailable = available);
  }

  void _onDigit(String digit) {
    if (_saving) return;
    setState(() {
      _error = null;
      if (_pinStep == _PinStep.create) {
        _draftPin += digit;
        if (_draftPin.length >= _pinLength) {
          _pinStep = _PinStep.confirm;
        }
      } else {
        _pin += digit;
        if (_pin.length >= _pinLength) {
          _finishPinSetup();
        }
      }
    });
  }

  void _onBackspace() {
    if (_saving) return;
    setState(() {
      _error = null;
      if (_pinStep == _PinStep.create && _draftPin.isNotEmpty) {
        _draftPin = _draftPin.substring(0, _draftPin.length - 1);
      } else if (_pinStep == _PinStep.confirm && _pin.isNotEmpty) {
        _pin = _pin.substring(0, _pin.length - 1);
      }
    });
  }

  Future<void> _finishPinSetup() async {
    if (_pin != _draftPin) {
      setState(() {
        _error = 'PINs do not match. Try again.';
        _pinStep = _PinStep.create;
        _draftPin = '';
        _pin = '';
      });
      return;
    }

    setState(() => _saving = true);
    final lock = ref.read(appLockServiceProvider);

    await lock.setPin(_draftPin);
    await lock.setLockMode(_lockMode);

    if (_enableBiometric && _biometricAvailable) {
      final ok = await lock.authenticateWithBiometrics(
        reason: 'Confirm to enable biometric unlock',
        requireEnabled: false,
      );
      if (ok) {
        await lock.setBiometricEnabled(true);
      }
    }

    await _finishSecuritySetup();
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _finishSecuritySetup() async {
    final onboarding = ref.read(onboardingProvider);
    if (!onboarding.isComplete) {
      await ref.read(onboardingProvider.notifier).markComplete();
    }
    await ref.read(securityProvider.notifier).markConfigured();

    if (!mounted) return;
    final signedIn = ref.read(authProvider).isAuthenticated;
    context.go(signedIn ? '/' : '/login');
  }

  int get _filledCount =>
      _pinStep == _PinStep.create ? _draftPin.length : _pin.length;

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(authProvider).isAuthenticated;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                signedIn ? 'Set up your PIN' : 'Secure your app',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                signedIn
                    ? 'Create a new PIN for this session. Your previous PIN was cleared when you signed out.'
                    : 'Choose how Logstack locks and set a PIN to protect your logs.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: LogstackColors.textSecondary,
                    ),
              ),
              const SizedBox(height: 24),
              Card(
                child: Column(
                  children: [
                    RadioListTile<AppLockMode>(
                      title: const Text('Lock immediately'),
                      subtitle: const Text(
                        'Require PIN or biometrics when returning to the app',
                      ),
                      value: AppLockMode.immediate,
                      groupValue: _lockMode,
                      onChanged: _saving
                          ? null
                          : (v) => setState(() => _lockMode = v!),
                    ),
                    const Divider(height: 1),
                    RadioListTile<AppLockMode>(
                      title: const Text('Do not lock'),
                      subtitle: const Text(
                        'Stay unlocked until you sign out',
                      ),
                      value: AppLockMode.never,
                      groupValue: _lockMode,
                      onChanged: _saving
                          ? null
                          : (v) => setState(() => _lockMode = v!),
                    ),
                  ],
                ),
              ),
              if (_lockMode == AppLockMode.immediate) ...[
                const SizedBox(height: 24),
                Text(
                  _pinStep == _PinStep.create
                      ? 'Create a 4-digit PIN'
                      : 'Confirm your PIN',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 20),
                PinPad(
                  pinLength: _pinLength,
                  filledCount: _filledCount,
                  onDigit: _onDigit,
                  onBackspace: _onBackspace,
                  errorText: _error,
                ),
                if (_biometricAvailable &&
                    _pinStep == _PinStep.create &&
                    _draftPin.isEmpty) ...[
                  const SizedBox(height: 24),
                  SwitchListTile(
                    secondary: const Icon(Icons.fingerprint),
                    title: const Text('Enable biometrics'),
                    subtitle: const Text('Use Face ID or fingerprint to unlock'),
                    value: _enableBiometric,
                    onChanged: _saving
                        ? null
                        : (v) => setState(() => _enableBiometric = v),
                  ),
                ],
              ],
              const Spacer(),
              if (_lockMode == AppLockMode.never)
                FilledButton(
                  onPressed: _saving
                      ? null
                      : () async {
                          setState(() => _saving = true);
                          final lock = ref.read(appLockServiceProvider);
                          await lock.setLockMode(AppLockMode.never);
                          await _finishSecuritySetup();
                        },
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Continue'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}