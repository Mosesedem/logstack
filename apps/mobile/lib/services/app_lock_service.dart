import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:logstack_mobile/services/storage_service.dart';

enum AppLockMode { immediate, never }

final appLockServiceProvider = Provider<AppLockService>((ref) {
  return AppLockService(ref.watch(storageServiceProvider));
});

class AppLockService {
  AppLockService(this._storage);

  final StorageService _storage;
  final _auth = LocalAuthentication();

  /// True while a system biometric sheet is showing.
  /// [AppLockGate] must not re-lock on lifecycle pause/resume during this window
  /// (that causes an infinite Face ID / fingerprint prompt loop).
  bool biometricAuthInProgress = false;

  /// Ignore lock-on-resume until this time (covers late lifecycle events after
  /// [authenticateWithBiometrics] returns on iOS/Android).
  DateTime? suppressLifecycleLockUntil;

  /// Whether AppLockGate should treat lifecycle as "biometric auth busy".
  bool get shouldSuppressLifecycleLock {
    if (biometricAuthInProgress) return true;
    final until = suppressLifecycleLockUntil;
    return until != null && DateTime.now().isBefore(until);
  }

  Future<AppLockMode> getLockMode() async {
    final mode = await _storage.getAppLockMode();
    return mode == AppLockMode.never.name
        ? AppLockMode.never
        : AppLockMode.immediate;
  }

  Future<void> setLockMode(AppLockMode mode) =>
      _storage.setAppLockMode(mode.name);

  Future<bool> hasPin() async => (await _storage.getAppPinHash()) != null;

  Future<void> setPin(String pin) async {
    final hash = _hashPin(pin);
    await _storage.setAppPinHash(hash);
  }

  Future<bool> verifyPin(String pin) async {
    final stored = await _storage.getAppPinHash();
    if (stored == null) return false;
    return stored == _hashPin(pin);
  }

  Future<void> clearPin() => _storage.clearAppPinHash();

  Future<bool> isBiometricAvailable() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final supported = await _auth.isDeviceSupported();
      if (!canCheck && !supported) return false;
      // On Android, canCheckBiometrics can be true with no enrolled biometrics.
      final enrolled = await _auth.getAvailableBiometrics();
      return enrolled.isNotEmpty || supported;
    } catch (_) {
      return false;
    }
  }

  Future<bool> isBiometricEnabled() => _storage.isBiometricEnabled();

  Future<void> setBiometricEnabled(bool enabled) =>
      _storage.setBiometricEnabled(enabled);

  Future<bool> authenticateWithBiometrics({
    String reason = 'Unlock Logstack',
    bool requireEnabled = true,
  }) async {
    if (requireEnabled && !await isBiometricEnabled()) return false;
    if (!await isBiometricAvailable()) return false;
    biometricAuthInProgress = true;
    try {
      // biometricOnly:false allows Android device credential fallback when the
      // user dismisses biometrics or has none enrolled but has a screen lock.
      // stickyAuth keeps the prompt alive across brief activity pauses (Android).
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
          sensitiveTransaction: true,
        ),
      );
    } catch (_) {
      return false;
    } finally {
      biometricAuthInProgress = false;
      // Late paused/resumed events often arrive after the Future completes.
      suppressLifecycleLockUntil =
          DateTime.now().add(const Duration(milliseconds: 1200));
    }
  }

  Future<bool> shouldLock() async {
    final mode = await getLockMode();
    if (mode == AppLockMode.never) return false;
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) return false;
    // PIN is saved mid-setup before biometrics; do not show AppLockGate
    // over SecuritySetupScreen (biometric sheet would re-lock forever).
    if (!await _storage.isSessionSecurityComplete()) return false;
    return await hasPin() || await isBiometricEnabled();
  }

  String _hashPin(String pin) {
    final bytes = utf8.encode('logstack:$pin');
    return sha256.convert(bytes).toString();
  }
}