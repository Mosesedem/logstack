import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/biometric_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';

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
      setState(() => _unlocked = false);
      _unlockIfNeeded();
    }
  }

  Future<void> _unlockIfNeeded() async {
    final biometric = ref.read(biometricServiceProvider);
    if (!await biometric.shouldLock()) {
      setState(() {
        _unlocked = true;
        _checking = false;
      });
      return;
    }
    setState(() => _checking = true);
    final ok = await biometric.authenticate();
    if (!mounted) return;
    setState(() {
      _unlocked = ok;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Material(
        color: LogstackColors.background,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (!_unlocked) {
      return Material(
        color: LogstackColors.background,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const AppLogo(size: 72),
                const SizedBox(height: 24),
                Text(
                  'Logstack is locked',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'Authenticate to continue',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: LogstackColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _unlockIfNeeded,
                  child: const Text('Unlock'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return widget.child;
  }
}