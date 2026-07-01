// Generated from google-services.json and GoogleService-Info.plist.
// Re-run `flutterfire configure` if you add platforms or rotate Firebase apps.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static bool isConfiguredFor(FirebaseOptions options) {
    return !options.appId.startsWith('YOUR_') &&
        !options.apiKey.startsWith('YOUR_') &&
        !options.projectId.startsWith('YOUR_');
  }

  static bool get isConfigured {
    if (kIsWeb) {
      return false;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return isConfiguredFor(android);
      case TargetPlatform.iOS:
        return isConfiguredFor(ios);
      default:
        return false;
    }
  }

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web - '
        'you can reconfigure this by running the FlutterFire CLI again.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for macos - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyA_JdTwqGj-ey0YxphZ9VHKVmKi0eBxgl0',
    appId: '1:826122369446:android:d30206fba1ce55035ef767',
    messagingSenderId: '826122369446',
    projectId: 'general-saas-project',
    storageBucket: 'general-saas-project.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyATSfaHlP2IjrSNcOgoyfHz6M4nEZp4ijQ',
    appId: '1:826122369446:ios:85cd13300740cf075ef767',
    messagingSenderId: '826122369446',
    projectId: 'general-saas-project',
    storageBucket: 'general-saas-project.firebasestorage.app',
    iosBundleId: 'tech.logstack.mobile',
  );
}