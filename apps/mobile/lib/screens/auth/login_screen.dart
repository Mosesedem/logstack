import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:url_launcher/url_launcher.dart';

/// Entry point for mobile auth — PIN or QR only (no account creation on device).
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  static const _webUrl = 'https://logstack.tech';

  Future<void> _openWebSignup(BuildContext context) async {
    final uri = Uri.parse('$_webUrl/signup');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open logstack.tech')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Center(child: AppLogo()),
              const SizedBox(height: 32),
              Text(
                'Logstack',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Link this device to your existing account',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 48),
              FilledButton.icon(
                onPressed: () => context.push('/qr-scanner'),
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scan QR Code'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => context.push('/pin-login'),
                icon: const Icon(Icons.pin_outlined),
                label: const Text('Enter PIN'),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => context.push('/email-login'),
                icon: const Icon(Icons.email_outlined),
                label: const Text('Sign in with email'),
              ),
              const SizedBox(height: 32),
              Text(
                'Accounts are created on the web dashboard — not in this app.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => _openWebSignup(context),
                child: const Text('Create account at logstack.tech'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}