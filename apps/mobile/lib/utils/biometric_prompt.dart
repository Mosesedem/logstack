import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/services/app_lock_service.dart';

Future<void> maybeOfferBiometricUnlock(
  BuildContext context,
  WidgetRef ref,
) async {
  final lock = ref.read(appLockServiceProvider);
  if (!await lock.isBiometricAvailable() || await lock.isBiometricEnabled()) {
    return;
  }
  if (!await lock.hasPin()) return;
  if (!context.mounted) return;

  final enable = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Enable biometric unlock?'),
      content: const Text(
        'Use Face ID or fingerprint to unlock Logstack when you return to the app.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Not now'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Enable'),
        ),
      ],
    ),
  );

  if (enable == true) {
    final ok = await lock.authenticateWithBiometrics(
      reason: 'Confirm to enable biometric unlock',
      requireEnabled: false,
    );
    if (ok) await lock.setBiometricEnabled(true);
  }
}