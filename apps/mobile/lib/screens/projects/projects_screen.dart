import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/providers/project_provider.dart';

class ProjectsScreen extends ConsumerStatefulWidget {
  const ProjectsScreen({super.key});

  @override
  ConsumerState<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends ConsumerState<ProjectsScreen> {
  final _nameController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _showCreateDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create Project'),
        content: TextField(
          controller: _nameController,
          decoration: const InputDecoration(
            labelText: 'Project Name',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (_nameController.text.isNotEmpty) {
                await ref
                    .read(projectProvider.notifier)
                    .createProject(_nameController.text);
                _nameController.clear();
                if (mounted) Navigator.pop(context);
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(String projectId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Project'),
        content: const Text(
          'Are you sure you want to delete this project? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              await ref.read(projectProvider.notifier).deleteProject(projectId);
              if (mounted) Navigator.pop(context);
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _copyApiKey(String apiKey) {
    Clipboard.setData(ClipboardData(text: apiKey));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('API key copied to clipboard')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final projectState = ref.watch(projectProvider);

    return Scaffold(
      body: projectState.isLoading && projectState.projects.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : projectState.projects.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('No projects yet'),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _showCreateDialog,
                        child: const Text('Create Project'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () =>
                      ref.read(projectProvider.notifier).loadProjects(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: projectState.projects.length,
                    itemBuilder: (context, index) {
                      final project = projectState.projects[index];
                      final isSelected =
                          project.id == projectState.currentProject?.id;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: Icon(
                            isSelected ? Icons.folder : Icons.folder_outlined,
                            color: isSelected
                                ? Theme.of(context).colorScheme.primary
                                : null,
                          ),
                          title: Text(project.name),
                          subtitle: project.apiKey != null
                              ? Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${project.apiKey!.substring(0, project.apiKey!.length.clamp(0, 16))}...',
                                        style: const TextStyle(
                                            fontFamily: 'monospace'),
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.copy, size: 18),
                                      onPressed: () =>
                                          _copyApiKey(project.apiKey!),
                                      tooltip: 'Copy API key',
                                      visualDensity: VisualDensity.compact,
                                    ),
                                  ],
                                )
                              : const Text('API key hidden'),
                          trailing: PopupMenuButton(
                            itemBuilder: (context) => [
                              PopupMenuItem(
                                onTap: () {
                                  ref
                                      .read(projectProvider.notifier)
                                      .setCurrentProject(project);
                                },
                                child: const Text('Set as active'),
                              ),
                              PopupMenuItem(
                                onTap: () {
                                  ref
                                      .read(projectProvider.notifier)
                                      .rotateApiKey(project.id);
                                },
                                child: const Text('Rotate API key'),
                              ),
                              PopupMenuItem(
                                onTap: () =>
                                    _showDeleteConfirmation(project.id),
                                child: Text(
                                  'Delete',
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          onTap: () {
                            ref
                                .read(projectProvider.notifier)
                                .setCurrentProject(project);
                          },
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        child: const Icon(Icons.add),
      ),
    );
  }
}
