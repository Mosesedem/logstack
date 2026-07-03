import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/providers/security_provider.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:logstack_mobile/widgets/pin_pad.dart';

enum _SecurityStep { chooseProtection, createPin, confirmPin, biometrics, done }

class SecuritySetupScreen extends ConsumerStatefulWidget {
  const SecuritySetupScreen({super.key});

  @override
  ConsumerState<SecuritySetupScreen> createState() =>
      _SecuritySetupScreenState();
}

class _SecuritySetupScreenState extends ConsumerState<SecuritySetupScreen>
    with SingleTickerProviderStateMixin {
  static const _pinLength = 4;
  static const _weakPins = {'0000', '1111', '1234', '1212', '4321', '9999'};

  late _SecurityStep _step;
  late final AnimationController _shakeController;
  late final Animation<double> _shakeAnimation;

  AppLockMode _lockMode = AppLockMode.immediate;
  String _draftPin = '';
  String _pin = '';
  String? _error;
  String? _pinHint;
  bool _biometricAvailable = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 10.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 10.0, end: -6.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -6.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeController, curve: Curves.easeOut));

    _step = _SecurityStep.chooseProtection;
    _loadBiometrics();
  }

  Future<void> _loadBiometrics() async {
    final lock = ref.read(appLockServiceProvider);
    final available = await lock.isBiometricAvailable();
    if (mounted) setState(() => _biometricAvailable = available);
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  int get _progressIndex {
    switch (_step) {
      case _SecurityStep.chooseProtection:
        return 0;
      case _SecurityStep.createPin:
        return 1;
      case _SecurityStep.confirmPin:
        return 2;
      case _SecurityStep.biometrics:
      case _SecurityStep.done:
        return 3;
    }
  }

  static const _progressTotal = 4;

  void _goTo(_SecurityStep step) {
    setState(() {
      _step = step;
      _error = null;
      _pinHint = null;
    });
  }

  Future<void> _shake() async {
    HapticFeedback.mediumImpact();
    await _shakeController.forward(from: 0);
  }

  void _onDigit(String digit) {
    if (_saving) return;
    setState(() {
      _error = null;
      _pinHint = null;
      if (_step == _SecurityStep.createPin) {
        _draftPin += digit;
        if (_draftPin.length >= _pinLength) {
          if (_weakPins.contains(_draftPin)) {
            _pinHint =
                'That PIN is easy to guess — consider something less obvious.';
          }
          _goTo(_SecurityStep.confirmPin);
          _pin = '';
        }
      } else if (_step == _SecurityStep.confirmPin) {
        _pin += digit;
        if (_pin.length >= _pinLength) {
          unawaited(_confirmPin());
        }
      }
    });
  }

  void _onBackspace() {
    if (_saving) return;
    setState(() {
      _error = null;
      if (_step == _SecurityStep.createPin && _draftPin.isNotEmpty) {
        _draftPin = _draftPin.substring(0, _draftPin.length - 1);
      } else if (_step == _SecurityStep.confirmPin && _pin.isNotEmpty) {
        _pin = _pin.substring(0, _pin.length - 1);
      }
    });
  }

  Future<void> _confirmPin() async {
    if (_pin != _draftPin) {
      await _shake();
      setState(() {
        _error = 'PINs did not match — let\'s try again.';
        _draftPin = '';
        _pin = '';
        _step = _SecurityStep.createPin;
      });
      return;
    }

    setState(() => _saving = true);
    final lock = ref.read(appLockServiceProvider);
    await lock.setPin(_draftPin);
    await lock.setLockMode(_lockMode);

    if (!mounted) return;
    setState(() => _saving = false);

    if (_biometricAvailable) {
      _goTo(_SecurityStep.biometrics);
    } else {
      await _completeFlow();
    }
  }

  Future<void> _enableBiometrics() async {
    setState(() => _saving = true);
    final lock = ref.read(appLockServiceProvider);
    final ok = await lock.authenticateWithBiometrics(
      reason: 'Confirm to enable biometric unlock',
      requireEnabled: false,
    );
    if (ok) {
      await lock.setBiometricEnabled(true);
    }
    if (!mounted) return;
    setState(() => _saving = false);
    await _completeFlow();
  }

  Future<void> _skipBiometrics() async {
    final lock = ref.read(appLockServiceProvider);
    await lock.setBiometricEnabled(false);
    await _completeFlow();
  }

  Future<void> _chooseNoLock() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Skip app lock?'),
        content: const Text(
          'Without a PIN, anyone with access to this device can view your '
          'logs until you sign out.\n\nYou can enable protection later in Settings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Go back'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Stay open'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _saving = true);
    final lock = ref.read(appLockServiceProvider);
    await lock.setLockMode(AppLockMode.never);
    await lock.clearPin();
    await lock.setBiometricEnabled(false);
    if (!mounted) return;
    setState(() => _saving = false);
    await _completeFlow();
  }

  Future<void> _chooseProtected() async {
    setState(() => _lockMode = AppLockMode.immediate);
    _draftPin = '';
    _pin = '';
    _goTo(_SecurityStep.createPin);
  }

  Future<void> _completeFlow() async {
    _goTo(_SecurityStep.done);
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    await ref.read(securityProvider.notifier).markConfigured();
    if (!mounted) return;
    context.go('/');
  }

  void _back() {
    switch (_step) {
      case _SecurityStep.confirmPin:
        _pin = '';
        _goTo(_SecurityStep.createPin);
      case _SecurityStep.createPin:
        _draftPin = '';
        _goTo(_SecurityStep.chooseProtection);
      default:
        break;
    }
  }

  int get _filledCount {
    if (_step == _SecurityStep.createPin) return _draftPin.length;
    if (_step == _SecurityStep.confirmPin) return _pin.length;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_step != _SecurityStep.done) ...[
                _StepProgress(
                  index: _progressIndex,
                  total: _progressTotal,
                ),
                const SizedBox(height: 20),
              ],
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 320),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  transitionBuilder: (child, animation) {
                    final slide = Tween<Offset>(
                      begin: const Offset(0.04, 0),
                      end: Offset.zero,
                    ).animate(animation);
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(position: slide, child: child),
                    );
                  },
                  child: KeyedSubtree(
                    key: ValueKey(_step),
                    child: _buildStep(context),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(BuildContext context) {
    switch (_step) {
      case _SecurityStep.chooseProtection:
        return _ChooseProtectionStep(
          saving: _saving,
          onProtected: _chooseProtected,
          onOpen: _chooseNoLock,
        );
      case _SecurityStep.createPin:
      case _SecurityStep.confirmPin:
        return _PinStep(
          isConfirm: _step == _SecurityStep.confirmPin,
          filledCount: _filledCount,
          error: _error,
          hint: _pinHint,
          saving: _saving,
          shakeAnimation: _shakeAnimation,
          onDigit: _onDigit,
          onBackspace: _onBackspace,
          onBack: _canGoBack ? _back : null,
        );
      case _SecurityStep.biometrics:
        return _BiometricsStep(
          saving: _saving,
          onEnable: _enableBiometrics,
          onSkip: _skipBiometrics,
        );
      case _SecurityStep.done:
        return const _DoneStep();
    }
  }

  bool get _canGoBack =>
      _step == _SecurityStep.confirmPin || _step == _SecurityStep.createPin;
}

// ── Step widgets ─────────────────────────────────────────────────────────────

class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.index, required this.total});

  final int index;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(total, (i) {
        final active = i <= index;
        return Expanded(
          child: Container(
            margin: EdgeInsets.only(right: i < total - 1 ? 6 : 0),
            height: 3,
            decoration: BoxDecoration(
              color: active
                  ? LogstackColors.accentBlue
                  : LogstackColors.surfaceElevated,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      }),
    );
  }
}

class _ChooseProtectionStep extends StatelessWidget {
  const _ChooseProtectionStep({
    required this.saving,
    required this.onProtected,
    required this.onOpen,
  });

  final bool saving;
  final VoidCallback onProtected;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: AppLogo(size: 72)),
        const SizedBox(height: 28),
        Text(
          'How should Logstack protect your logs?',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 10),
        Text(
          'You can change this anytime in Settings.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: LogstackColors.textSecondary,
              ),
        ),
        const SizedBox(height: 32),
        _ProtectionCard(
          icon: Icons.shield_outlined,
          title: 'Protected',
          badge: 'Recommended',
          description:
              'Lock with PIN or Face ID when you leave the app. Best for shared or work devices.',
          accent: LogstackColors.accentBlue,
          onTap: saving ? null : onProtected,
        ),
        const SizedBox(height: 12),
        _ProtectionCard(
          icon: Icons.lock_open_outlined,
          title: 'Stay open',
          description:
              'No lock screen until you sign out. Fine if this phone is only yours.',
          accent: LogstackColors.textSecondary,
          onTap: saving ? null : onOpen,
        ),
        const Spacer(),
        if (saving)
          const Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
      ],
    );
  }
}

class _ProtectionCard extends StatelessWidget {
  const _ProtectionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.accent,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String title;
  final String? badge;
  final String description;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: LogstackColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: LogstackColors.borderSubtle),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: accent, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          title,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: LogstackColors.liveGreen
                                  .withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              badge!,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: LogstackColors.liveGreen,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: LogstackColors.textSecondary,
                            height: 1.45,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: LogstackColors.textMuted,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PinStep extends StatelessWidget {
  const _PinStep({
    required this.isConfirm,
    required this.filledCount,
    required this.error,
    required this.hint,
    required this.saving,
    required this.shakeAnimation,
    required this.onDigit,
    required this.onBackspace,
    required this.onBack,
  });

  final bool isConfirm;
  final int filledCount;
  final String? error;
  final String? hint;
  final bool saving;
  final Animation<double> shakeAnimation;
  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (onBack != null)
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              onPressed: saving ? null : onBack,
              icon: const Icon(Icons.arrow_back),
              tooltip: 'Back',
            ),
          )
        else
          const SizedBox(height: 48),
        const SizedBox(height: 8),
        Icon(
          isConfirm ? Icons.verified_outlined : Icons.pin_outlined,
          size: 40,
          color: LogstackColors.accentBlue,
        ),
        const SizedBox(height: 20),
        Text(
          isConfirm ? 'Confirm your PIN' : 'Choose a 4-digit PIN',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          isConfirm
              ? 'Enter the same 4 digits once more.'
              : 'You\'ll use this to unlock Logstack when returning to the app.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: LogstackColors.textSecondary,
              ),
        ),
        if (hint != null && !isConfirm) ...[
          const SizedBox(height: 14),
          _HintBanner(message: hint!),
        ],
        const Spacer(),
        AnimatedBuilder(
          animation: shakeAnimation,
          builder: (context, child) {
            return Transform.translate(
              offset: Offset(shakeAnimation.value, 0),
              child: child,
            );
          },
          child: PinPad(
            pinLength: 4,
            filledCount: filledCount,
            onDigit: onDigit,
            onBackspace: onBackspace,
            errorText: error,
          ),
        ),
        const Spacer(),
        if (saving)
          const Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
      ],
    );
  }

}

class _HintBanner extends StatelessWidget {
  const _HintBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: LogstackColors.warnAmber.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: LogstackColors.warnAmber.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.lightbulb_outline,
            size: 18,
            color: LogstackColors.warnAmber,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 13,
                color: LogstackColors.textPrimary,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BiometricsStep extends StatelessWidget {
  const _BiometricsStep({
    required this.saving,
    required this.onEnable,
    required this.onSkip,
  });

  final bool saving;
  final VoidCallback onEnable;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(),
        Container(
          width: 88,
          height: 88,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: LogstackColors.accentBlue.withValues(alpha: 0.12),
          ),
          child: const Icon(
            Icons.fingerprint,
            size: 48,
            color: LogstackColors.accentBlue,
          ),
        ),
        const SizedBox(height: 28),
        Text(
          'Skip the PIN next time?',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 10),
        Text(
          'Use Face ID or fingerprint to unlock Logstack instantly. Your PIN stays as backup.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: LogstackColors.textSecondary,
                height: 1.45,
              ),
        ),
        const Spacer(),
        FilledButton.icon(
          onPressed: saving ? null : onEnable,
          icon: saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: LogstackColors.background,
                  ),
                )
              : const Icon(Icons.fingerprint),
          label: Text(saving ? 'Enabling…' : 'Enable biometrics'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: saving ? null : onSkip,
          child: const Text('Use PIN only'),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _DoneStep extends StatelessWidget {
  const _DoneStep();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: LogstackColors.liveGreen.withValues(alpha: 0.15),
          ),
          child: const Icon(
            Icons.check_rounded,
            size: 40,
            color: LogstackColors.liveGreen,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'You\'re all set',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          'Security preferences saved.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: LogstackColors.textSecondary,
              ),
        ),
      ],
    );
  }
}