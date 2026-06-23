import 'package:flutter/material.dart';
import 'package:logstack_mobile/models/log.dart';
import 'package:logstack_mobile/widgets/level_badge.dart';

class LogDetailScreen extends StatelessWidget {
  final String logId;

  const LogDetailScreen({super.key, required this.logId});

  @override
  Widget build(BuildContext context) {
    // In a real implementation we would fetch by ID using logsProvider or service
    // and pass the full Log via go_router `extra`. For now we show a placeholder.
    return Scaffold(
      appBar: AppBar(
        title: Text('Log #$logId'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Log ID', style: Theme.of(context).textTheme.labelSmall),
            Text(logId, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            const LevelBadge(level: LogLevel.info),
            const SizedBox(height: 16),
            const Text('Message', style: TextStyle(fontWeight: FontWeight.bold)),
            const Text('Detailed log message would appear here. In production connect to the logs provider/service to load by ID and pass the Log object.'),
            const SizedBox(height: 16),
            const Text('Metadata', style: TextStyle(fontWeight: FontWeight.bold)),
            const Text('{ "source": "mobile", "details": "..." }'),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back to logs'),
            ),
          ],
        ),
      ),
    );
  }
}
