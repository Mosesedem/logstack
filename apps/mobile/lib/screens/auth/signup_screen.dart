import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/app_logo.dart';
import 'package:url_launcher/url_launcher.dart';

/// In-app info only — no registration form (App Store Guideline 4).
/// Directs users to docs on the website to create an account via the dashboard.
class SignupScreen extends StatelessWidget {
  const SignupScreen({super.key});

  static const _docsUrl = 'https://logstack.tech/docs';

  Future<void> _openDocs(BuildContext context) async {
    final uri = Uri.parse(_docsUrl);
    // Prefer in-app Safari View Controller so users stay in the app shell.
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.inAppBrowserView,
    );
    if (!launched && context.mounted) {
      final fallback = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!fallback && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open logstack.tech/docs')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
        leading: BackButton(
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Center(child: AppLogo()),
              const SizedBox(height: 16),
              Text(
                'Create a Logstack account',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Account creation is on the web',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'This companion app links to an existing Logstack account. '
                      'To create a new account, open our documentation on the website, '
                      'follow the setup guide, and sign up from the web dashboard.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Docs: logstack.tech/docs',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: LogstackColors.accentBlue,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Already have an account? Sign in below, or link this device '
                'from the web dashboard using QR code or PIN.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: () => _openDocs(context),
                icon: const Icon(Icons.menu_book_outlined),
                label: const Text('Open documentation'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/login'),
                child: const Text('Back to Sign In'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
