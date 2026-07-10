package tech.logstack.mobile

// FlutterFragmentActivity is required by local_auth (biometrics / device
// credential) on Android. FlutterActivity alone leaves fingerprint/face unlock
// non-functional.
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity : FlutterFragmentActivity()
