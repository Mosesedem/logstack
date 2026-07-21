import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';

/// Entry point for mobile auth — PIN, QR, or email link (no account creation on device).
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

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
                'Accounts are created on the web — not in this app.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.push('/signup'),
                child: const Text('Create Account'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
