import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/project.dart';
import 'package:logstack_mobile/providers/project_provider.dart';
import 'package:logstack_mobile/theme/logstack_colors.dart';
import 'package:logstack_mobile/widgets/loading_states.dart';

class ProjectPicker extends ConsumerWidget {
  const ProjectPicker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectState = ref.watch(projectProvider);

    if (projectState.isLoading) {
      return const ProjectPickerSkeleton();
    }

    final current = projectState.currentProject;
    if (current == null) {
      return Text(
        'Logstack',
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
      );
    }

    return InkWell(
      onTap: () => _showProjectSheet(context, ref, projectState),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                current.name,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.unfold_more,
              size: 20,
              color: LogstackColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showProjectSheet(
    BuildContext context,
    WidgetRef ref,
    ProjectState projectState,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: LogstackColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _ProjectPickerSheet(
        projects: projectState.projects,
        currentId: projectState.currentProject?.id,
        onSelect: (project) {
          ref.read(projectProvider.notifier).setCurrentProject(project);
          Navigator.pop(context);
        },
      ),
    );
  }
}

class _ProjectPickerSheet extends StatefulWidget {
  const _ProjectPickerSheet({
    required this.projects,
    required this.currentId,
    required this.onSelect,
  });

  final List<Project> projects;
  final String? currentId;
  final ValueChanged<Project> onSelect;

  @override
  State<_ProjectPickerSheet> createState() => _ProjectPickerSheetState();
}

class _ProjectPickerSheetState extends State<_ProjectPickerSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Project> get _filtered {
    if (_query.isEmpty) return widget.projects;
    final q = _query.toLowerCase();
    return widget.projects.where((p) {
      if (p.name.toLowerCase().contains(q)) return true;
      final env = p.environment?.toLowerCase();
      return env != null && env.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: LogstackColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text(
                'Switch project',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search projects…',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _query.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                          },
                        )
                      : null,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
                onChanged: (v) => setState(() => _query = v.trim()),
              ),
            ),
            const SizedBox(height: 8),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  'No projects match "$_query"',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: LogstackColors.textSecondary),
                ),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.45,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final project = filtered[index];
                    final selected = project.id == widget.currentId;
                    return ListTile(
                      selected: selected,
                      leading: Icon(
                        selected ? Icons.folder : Icons.folder_outlined,
                        color: selected
                            ? LogstackColors.accentBlue
                            : LogstackColors.textMuted,
                      ),
                      title: Text(project.name),
                      subtitle: project.environment != null
                          ? Text(
                              project.environment!,
                              style: const TextStyle(fontSize: 12),
                            )
                          : null,
                      trailing: selected
                          ? const Icon(
                              Icons.check_circle,
                              color: LogstackColors.accentBlue,
                              size: 20,
                            )
                          : null,
                      onTap: () => widget.onSelect(project),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}