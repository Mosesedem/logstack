import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:logstack_mobile/services/storage_service.dart';

final biometricServiceProvider = Provider<BiometricService>((ref) {
  return BiometricService(ref.watch(storageServiceProvider));
});

class BiometricService {
  BiometricService(this._storage);

  final StorageService _storage;
  final _auth = LocalAuthentication();

  Future<bool> isAvailable() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final supported = await _auth.isDeviceSupported();
      if (!canCheck && !supported) return false;
      final enrolled = await _auth.getAvailableBiometrics();
      return enrolled.isNotEmpty || supported;
    } catch (_) {
      return false;
    }
  }

  Future<bool> isEnabled() => _storage.isBiometricEnabled();

  Future<void> setEnabled(bool enabled) => _storage.setBiometricEnabled(enabled);

  Future<bool> authenticate({String reason = 'Unlock Logstack'}) async {
    if (!await isEnabled()) return true;
    if (!await isAvailable()) return true;
    try {
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
    }
  }

  Future<bool> shouldLock() async {
    if (!await isEnabled()) return false;
    final refreshToken = await _storage.getRefreshToken();
    return refreshToken != null;
  }
}