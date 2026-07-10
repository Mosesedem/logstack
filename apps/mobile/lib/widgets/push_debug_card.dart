import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/firebase_options.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/notification_service.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';

class PushDebugCard extends ConsumerStatefulWidget {
  const PushDebugCard({super.key});

  @override
  ConsumerState<PushDebugCard> createState() => _PushDebugCardState();
}

class _PushDebugCardState extends ConsumerState<PushDebugCard> {
  bool _isRetrying = false;
  bool _isTestingApi = false;
  StreamSubscription<String>? _tokenSubscription;

  @override
  void initState() {
    super.initState();
    _tokenSubscription =
        NotificationService.instance.tokenStream.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tokenSubscription?.cancel();
    super.dispose();
  }

  String? get _displayToken {
    final authState = ref.watch(authProvider);
    return authState.pushToken ?? NotificationService.instance.fcmToken;
  }

  PushRegistrationStatus _effectiveStatus(
    AuthState authState,
    bool firebaseConfigured,
    String? token,
  ) {
    if (!firebaseConfigured) {
      return PushRegistrationStatus.notConfigured;
    }
    if (token == null) {
      return PushRegistrationStatus.awaitingToken;
    }
    if (!authState.isAuthenticated) {
      return PushRegistrationStatus.notAuthenticated;
    }
    return authState.pushStatus;
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final firebaseConfigured = DefaultFirebaseOptions.isConfigured;
    final token = _displayToken;
    final status = _effectiveStatus(authState, firebaseConfigured, token);

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            leading: const Icon(Icons.notifications_active_outlined),
            title: const Text('Push Notifications'),
            subtitle: const Text('Debug status'),
            trailing: _StatusChip(status: status),
          ),
          const Divider(height: 1),
          _DebugRow(
            label: 'Firebase',
            value: firebaseConfigured ? 'Configured' : 'Not configured',
            valueColor: firebaseConfigured
                ? LogstackColors.liveGreen
                : LogstackColors.warnAmber,
          ),
          _DebugRow(
            label: 'FCM token',
            value: token == null ? 'Unavailable' : _truncateToken(token),
            valueColor: token == null
                ? LogstackColors.textMuted
                : LogstackColors.textPrimary,
            monospace: token != null,
          ),
          if (Platform.isIOS)
            _DebugRow(
              label: 'APNS token',
              value: NotificationService.instance.apnsToken == null
                  ? 'Unavailable (check Firebase APNs key + APS env)'
                  : 'Ready',
              valueColor: NotificationService.instance.apnsToken == null
                  ? LogstackColors.warnAmber
                  : LogstackColors.liveGreen,
            ),
          if (authState.user != null)
            _DebugRow(
              label: 'User ID',
              value: '${authState.user!.id}',
              valueColor: LogstackColors.textPrimary,
              monospace: true,
            ),
          _DebugRow(
            label: 'Backend',
            value: _backendStatusLabel(status),
            valueColor: _statusColor(status),
          ),
          if (authState.backendMaskedToken != null)
            _DebugRow(
              label: 'API token',
              value: authState.backendMaskedToken!,
              valueColor: _tokenMatchesBackend(token, authState.backendMaskedToken!)
                  ? LogstackColors.liveGreen
                  : LogstackColors.warnAmber,
              monospace: true,
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: token == null
                        ? null
                        : () => _copyToken(context, token),
                    icon: const Icon(Icons.copy, size: 18),
                    label: const Text('Copy token'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _isRetrying || !authState.isAuthenticated
                        ? null
                        : () => _retryRegistration(),
                    icon: _isRetrying
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh, size: 18),
                    label: Text(_isRetrying ? 'Registering…' : 'Re-register'),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _isTestingApi ||
                        !authState.isAuthenticated ||
                        authState.isOfflineAuth
                    ? null
                    : () => _sendApiPushTest(context),
                icon: _isTestingApi
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_outlined, size: 18),
                label: Text(_isTestingApi ? 'Sending API test…' : 'Send API test push'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _retryRegistration() async {
    setState(() => _isRetrying = true);
    try {
      await ref.read(authProvider.notifier).retryPushRegistration();
    } finally {
      if (mounted) {
        setState(() => _isRetrying = false);
      }
    }
  }

  Future<void> _sendApiPushTest(BuildContext context) async {
    setState(() => _isTestingApi = true);
    try {
      final response = await ref.read(authProvider.notifier).sendApiPushTest();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_formatApiTestResult(response)),
          duration: const Duration(seconds: 8),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('API test push failed: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isTestingApi = false);
      }
    }
  }

  Future<void> _copyToken(BuildContext context, String token) async {
    await Clipboard.setData(ClipboardData(text: token));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('FCM token copied')),
    );
  }

  static String _truncateToken(String token) {
    if (token.length <= 28) return token;
    return '${token.substring(0, 14)}…${token.substring(token.length - 10)}';
  }

  static String _maskToken(String token) {
    if (token.length <= 20) return '***';
    return '${token.substring(0, 10)}...${token.substring(token.length - 10)}';
  }

  static bool _tokenMatchesBackend(String? token, String masked) {
    if (token == null) return false;
    return _maskToken(token) == masked;
  }

  static String _formatApiTestResult(Map<String, dynamic> response) {
    final results = response['results'];
    if (results is! Map) {
      return 'API test: ${response['message'] ?? response['error'] ?? response}';
    }

    final iosTokens = results['iosTokens'];
    final iosSent = results['iosSent'];
    final iosFailed = results['iosFailed'];
    final errors = results['errors'];

    if (Platform.isIOS) {
      if (iosTokens == 0) {
        return 'API found no iOS token for your user — tap Re-register, then retry';
      }
      if (iosSent == 1) {
        return 'FCM accepted iOS delivery (iosSent=1). If no banner, check Focus/DND and notification settings for Logstack.';
      }
      if (iosFailed != null && iosFailed > 0) {
        final detail = errors is List && errors.isNotEmpty
            ? errors.first.toString()
            : response['error']?.toString();
        return 'iOS push failed: $detail';
      }
    }

    return 'API test: ${response['message'] ?? response['error'] ?? results}';
  }

  static String _backendStatusLabel(PushRegistrationStatus status) {
    switch (status) {
      case PushRegistrationStatus.notConfigured:
        return 'Firebase not configured';
      case PushRegistrationStatus.awaitingToken:
        return 'Waiting for FCM token';
      case PushRegistrationStatus.notAuthenticated:
        return 'Sign in to register';
      case PushRegistrationStatus.registering:
        return 'Registering…';
      case PushRegistrationStatus.registered:
        return 'Registered';
      case PushRegistrationStatus.failed:
        return 'Registration failed';
    }
  }

  static Color _statusColor(PushRegistrationStatus status) {
    switch (status) {
      case PushRegistrationStatus.registered:
        return LogstackColors.liveGreen;
      case PushRegistrationStatus.registering:
        return LogstackColors.infoBlue;
      case PushRegistrationStatus.failed:
        return LogstackColors.errorRed;
      case PushRegistrationStatus.awaitingToken:
      case PushRegistrationStatus.notAuthenticated:
        return LogstackColors.warnAmber;
      case PushRegistrationStatus.notConfigured:
        return LogstackColors.textMuted;
    }
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final PushRegistrationStatus status;

  @override
  Widget build(BuildContext context) {
    final color = _PushDebugCardState._statusColor(status);
    final label = switch (status) {
      PushRegistrationStatus.registered => 'OK',
      PushRegistrationStatus.registering => '…',
      PushRegistrationStatus.failed => 'Error',
      PushRegistrationStatus.awaitingToken => 'Pending',
      PushRegistrationStatus.notAuthenticated => 'No auth',
      PushRegistrationStatus.notConfigured => 'Off',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _DebugRow extends StatelessWidget {
  const _DebugRow({
    required this.label,
    required this.value,
    required this.valueColor,
    this.monospace = false,
  });

  final String label;
  final String value;
  final Color valueColor;
  final bool monospace;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: LogstackColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: (monospace
                      ? theme.textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                        )
                      : theme.textTheme.bodyMedium)
                  ?.copyWith(color: valueColor),
            ),
          ),
        ],
      ),
    );
  }
}