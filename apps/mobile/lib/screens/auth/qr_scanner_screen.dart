import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';

/// QR scanner screen that allows a mobile user to confirm a QR login session
/// initiated on the web.
///
/// Flow:
///   1. User enters their email + password in the fields at the bottom.
///   2. User points the camera at a Logstack QR code on the web dashboard.
///   3. The screen extracts the `token` query parameter from the scanned URL
///      (e.g. `https://app.logstack.io/link-mobile?token=<uuid>`).
///   4. Calls `POST /v1/auth/qr/:token/confirm` with the supplied credentials.
///   5. On success: stores both the access token and refresh token, then
///      navigates to `'/'`.
///   6. On error: shows an inline banner with a "Try Again" button.
class QRScannerScreen extends ConsumerStatefulWidget {
  const QRScannerScreen({super.key});

  @override
  ConsumerState<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends ConsumerState<QRScannerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final MobileScannerController _scannerController = MobileScannerController();

  bool _isConfirming = false;
  bool _scanProcessed = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  /// Extracts the `token` query parameter from a scanned Logstack QR URL such
  /// as `https://app.logstack.io/link-mobile?token=<uuid>`.
  ///
  /// Returns `null` if the barcode value is not a valid URL or lacks the token.
  String? _extractToken(String? rawValue) {
    if (rawValue == null || rawValue.isEmpty) return null;
    try {
      final uri = Uri.parse(rawValue);
      return uri.queryParameters['token'];
    } catch (_) {
      return null;
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    // Ignore subsequent detections while we are confirming or have already
    // processed a barcode in this session.
    if (_isConfirming || _scanProcessed) return;

    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final token = _extractToken(barcodes.first.rawValue);
    if (token == null) {
      setState(() {
        _error = 'Invalid QR code. Please scan a Logstack login QR.';
      });
      return;
    }

    // Validate credentials form before proceeding.
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isConfirming = true;
      _scanProcessed = true;
      _error = null;
    });

    // Pause the scanner while we confirm to avoid re-entrant calls.
    await _scannerController.stop();

    try {
      final authService = ref.read(authServiceProvider);
      final tokenPair = await authService.confirmQR(
        token,
        _emailController.text.trim(),
        _passwordController.text,
      );

      // Persist refresh token in secure storage before updating auth state.
      final storage = ref.read(storageServiceProvider);
      await storage.setRefreshToken(tokenPair.refreshToken);

      await ref.read(authProvider.notifier).setTokensFromPair(tokenPair);

      if (mounted) {
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isConfirming = false;
          _scanProcessed = false;
        });
        // Resume the scanner so the user can try again.
        await _scannerController.start();
      }
    }
  }

  void _handleTryAgain() {
    setState(() {
      _error = null;
      _isConfirming = false;
      _scanProcessed = false;
    });
    _scannerController.start();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        leading: BackButton(
          onPressed: () => context.canPop() ? context.pop() : context.go('/login'),
        ),
      ),
      body: Column(
        children: [
          // ── Scanner viewport ────────────────────────────────────────────
          Expanded(
            child: Stack(
              alignment: Alignment.center,
              children: [
                MobileScanner(
                  controller: _scannerController,
                  onDetect: _onDetect,
                ),
                // Viewfinder overlay
                Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: theme.colorScheme.primary,
                      width: 3,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                // Loading overlay while confirming
                if (_isConfirming)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                      child: CircularProgressIndicator(),
                    ),
                  ),
              ],
            ),
          ),

          // ── Credentials + error section ─────────────────────────────────
          SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Enter your credentials to confirm login',
                    style: theme.textTheme.titleSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),

                  // Error banner
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.error_outline,
                            color: theme.colorScheme.onErrorContainer,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: theme.colorScheme.onErrorContainer,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _handleTryAgain,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Try Again'),
                    ),
                    const SizedBox(height: 16),
                  ],

                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!value.contains('@')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock_outlined),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      if (value.length < 8) {
                        return 'Password must be at least 8 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Point the camera at the QR code shown on the web login page.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
