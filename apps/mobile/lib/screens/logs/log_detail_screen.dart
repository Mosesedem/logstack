import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/providers/project_provider.dart';
import 'package:logstack_mobile/services/log_escalation_service.dart';
import 'package:logstack_mobile/services/log_service.dart';
import 'package:logstack_mobile/theme/app_theme.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/utils/log_share.dart';
import 'package:logstack_mobile/widgets/level_badge.dart';
import 'package:share_plus/share_plus.dart';

class LogDetailScreen extends ConsumerStatefulWidget {
  const LogDetailScreen({super.key, required this.logId, this.initialLog});

  final String logId;
  final Log? initialLog;

  @override
  ConsumerState<LogDetailScreen> createState() => _LogDetailScreenState();
}

class _LogDetailScreenState extends ConsumerState<LogDetailScreen> {
  Log? _log;
  bool _loading = false;
  String? _error;
  bool _escalating = false;
  bool _escalated = false;
  String? _escalationMessage;

  @override
  void initState() {
    super.initState();
    _log = widget.initialLog;
    if (_log == null) _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final projectId = ref.read(projectProvider).currentProject?.id;
      if (projectId == null) {
        throw Exception('No project selected');
      }
      final log = await ref.read(logServiceProvider).getLog(
            projectId: projectId,
            id: int.parse(widget.logId),
          );
      if (mounted) setState(() => _log = log);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _shareLog(Log log, BuildContext ctx) async {
    // Resolve the share button's position for the iPad share popover anchor.
    Rect? origin;
    final box = ctx.findRenderObject() as RenderBox?;
    if (box != null && box.hasSize) {
      final position = box.localToGlobal(Offset.zero);
      origin = position & box.size;
    }

    try {
      final result = await SharePlus.instance.share(
        ShareParams(
          text: formatLogForShare(log),
          subject: 'Logstack log #${log.id}',
          sharePositionOrigin: origin,
        ),
      );

      if (!mounted) return;

      // Show feedback based on the share result.
      if (result.status == ShareResultStatus.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Log shared successfully')),
        );
      } else if (result.status == ShareResultStatus.dismissed) {
        // User dismissed the share sheet — no action needed.
      }
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) debugPrint('Share failed: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open share sheet')),
      );
    }
  }

  Future<void> _copyRawJson(Log log) async {
    await Clipboard.setData(ClipboardData(text: formatLogRawJson(log)));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Raw JSON copied')),
      );
    }
  }

  Future<void> _escalate(Log log) async {
    if (_escalating || _escalated) return;

    final projectId = ref.read(projectProvider).currentProject?.id;
    if (projectId == null) return;

    setState(() {
      _escalating = true;
      _escalationMessage = null;
    });

    try {
      final result = await ref.read(logEscalationServiceProvider).escalate(
            projectId: projectId,
            logId: log.id,
          );
      if (!mounted) return;
      setState(() {
        _escalated = true;
        _escalationMessage = result.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.alreadyDone ? result.message : result.message,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _escalating = false;
        _escalationMessage = e.toString().replaceAll('Exception: ', '');
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Escalation failed: $_escalationMessage'),
          action: SnackBarAction(
            label: 'Retry',
            onPressed: () => _escalate(log),
          ),
        ),
      );
      return;
    }

    if (mounted) setState(() => _escalating = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Log detail'),
        actions: [
          if (_log != null) ...[
            Builder(
              builder: (buttonCtx) => IconButton(
                icon: const Icon(Icons.share_outlined),
                tooltip: 'Share',
                onPressed: () => _shareLog(_log!, buttonCtx),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.copy_outlined),
              tooltip: 'Copy raw JSON',
              onPressed: () => _copyRawJson(_log!),
            ),
          ],
        ],
      ),
      body: _buildBody(context),
      floatingActionButton: _log != null && !_escalated
          ? FloatingActionButton.extended(
              onPressed: _escalating ? null : () => _escalate(_log!),
              icon: _escalating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.priority_high),
              label: Text(_escalating ? 'Escalating…' : 'Escalate'),
            )
          : null,
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading && _log == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _log == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: LogstackColors.errorRed)),
            const SizedBox(height: 12),
            FilledButton(onPressed: _fetch, child: const Text('Retry')),
          ],
        ),
      );
    }
    final log = _log;
    if (log == null) {
      return const Center(child: Text('Log not found'));
    }

    final mono = context.logMono;
    final metadata = redactMetadata(log.metadata);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        Row(
          children: [
            LevelBadge(level: log.level),
            if (log.source != null && log.source!.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: LogstackColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: LogstackColors.borderSubtle),
                ),
                child: Text(
                  log.source!,
                  style: mono.labelSmall?.copyWith(
                    color: LogstackColors.textSecondary,
                  ),
                ),
              ),
            ],
          ],
        ),
        if (_escalated) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: LogstackColors.warnAmberBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: LogstackColors.warnAmber.withValues(alpha: 0.4)),
            ),
            child: Text(
              _escalationMessage ?? 'Escalated',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
        const SizedBox(height: 16),
        Text('Message', style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: LogstackColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: LogstackColors.borderSubtle),
          ),
          child: Text(
            log.message,
            style: mono.bodyMedium?.copyWith(height: 1.45),
          ),
        ),
        const SizedBox(height: 16),
        _MetaRow(label: 'Time', value: log.createdAt.toIso8601String()),
        const SizedBox(height: 16),
        Text('Metadata', style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: LogstackColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: LogstackColors.borderSubtle),
          ),
          child: Text(
            metadata.isEmpty
                ? '{}'
                : const JsonEncoder.withIndent('  ').convert(metadata),
            style: mono.bodySmall?.copyWith(color: LogstackColors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(label, style: Theme.of(context).textTheme.labelMedium),
          ),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}