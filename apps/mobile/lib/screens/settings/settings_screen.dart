import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/providers/billing_provider.dart';
import 'package:logstack_mobile/widgets/usage_card.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    // Load billing data when the screen is first shown
    Future.microtask(() {
      ref.read(billingProvider.notifier).loadBillingData();
    });
  }

  Future<void> _openBillingPage() async {
    // Open the web billing page
    const billingUrl = 'https://logstack.io/dashboard/billing';
    final uri = Uri.parse(billingUrl);

    if (await canLaunchUrl(uri)) {
      await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open billing page'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final billingState = ref.watch(billingProvider);

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(billingProvider.notifier).loadBillingData();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Usage Card
          if (billingState.usage != null)
            UsageCard(
              usage: billingState.usage!,
              onUpgradePressed: _openBillingPage,
            )
          else if (billingState.isLoading)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                  child: CircularProgressIndicator(),
                ),
              ),
            ),

          const SizedBox(height: 16),

          // Subscription info
          if (billingState.subscription != null)
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.credit_card),
                    title: const Text('Current Plan'),
                    subtitle: Text(
                      billingState.subscription!.tierName,
                    ),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: billingState.subscription!.isActive
                            ? Colors.green.withValues(alpha: 0.1)
                            : Colors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        billingState.subscription!.isActive
                            ? 'Active'
                            : 'Inactive',
                        style: TextStyle(
                          color: billingState.subscription!.isActive
                              ? Colors.green
                              : Colors.red,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.credit_card),
                    title: const Text('Manage Subscription'),
                    trailing: const Icon(Icons.open_in_new),
                    onTap: _openBillingPage,
                  ),
                ],
              ),
            ),

          const SizedBox(height: 16),

          // Account Card
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.person),
                  title: const Text('Account'),
                  subtitle: Text(authState.user?.email ?? 'Not signed in'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.logout),
                  title: const Text('Sign Out'),
                  onTap: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Sign Out'),
                        content:
                            const Text('Are you sure you want to sign out?'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Cancel'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Sign Out'),
                          ),
                        ],
                      ),
                    );

                    if (confirmed == true) {
                      await ref.read(authProvider.notifier).logout();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.notifications),
                  title: const Text('Push Notifications'),
                  trailing: Switch(
                    value: true,
                    onChanged: (value) {
                      // TODO: Implement notification settings
                    },
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: const [
                ListTile(
                  leading: Icon(Icons.info),
                  title: Text('About'),
                  subtitle: Text('LogStack v1.0.0'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
