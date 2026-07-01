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
      return await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<bool> authenticate({String reason = 'Unlock Logstack'}) async {
    if (!await isAvailable()) return true;
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }

  Future<bool> shouldLock() async {
    final token = await _storage.getToken();
    return token != null;
  }
}