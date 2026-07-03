import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/auth_service.dart';
import 'package:logstack_mobile/services/biometric_service.dart';

/// QR scanner — scan the code from the web dashboard to link this device.
/// No credentials required; the web user is bound when the QR is generated.
class QRScannerScreen extends ConsumerStatefulWidget {
  const QRScannerScreen({super.key});

  @override
  ConsumerState<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends ConsumerState<QRScannerScreen> {
  final MobileScannerController _scannerController = MobileScannerController();

  bool _isConfirming = false;
  bool _scanProcessed = false;
  String? _error;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

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

    setState(() {
      _isConfirming = true;
      _scanProcessed = true;
      _error = null;
    });

    await _scannerController.stop();

    try {
      final authService = ref.read(authServiceProvider);
      final tokenPair = await authService.confirmQR(token);
      await ref.read(authProvider.notifier).setTokensFromPair(tokenPair);

      if (!mounted) return;
      await _maybeOfferBiometric();
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isConfirming = false;
          _scanProcessed = false;
        });
        await _scannerController.start();
      }
    }
  }

  Future<void> _maybeOfferBiometric() async {
    final biometric = ref.read(biometricServiceProvider);
    if (!await biometric.isAvailable() || await biometric.isEnabled()) {
      return;
    }
    if (!mounted) return;
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
      await biometric.setEnabled(true);
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
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/login'),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              alignment: Alignment.center,
              children: [
                MobileScanner(
                  controller: _scannerController,
                  onDetect: _onDetect,
                ),
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
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Point the camera at the QR code on the web dashboard.',
                  style: theme.textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Your account is linked automatically — no password needed.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
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
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}