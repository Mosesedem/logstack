import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/services/log_service.dart';
import 'package:logstack_mobile/theme/app_theme.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/level_badge.dart';

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
      final log = await ref.read(logServiceProvider).getLog(widget.logId);
      if (mounted) setState(() => _log = log);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Log detail')),
      body: _buildBody(context),
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
    final metadata = log.metadata;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LevelBadge(level: log.level),
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
        if (log.source != null) _MetaRow(label: 'Source', value: log.source!),
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
            metadata == null || metadata.isEmpty
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