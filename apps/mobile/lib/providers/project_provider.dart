import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/project.dart';
import 'package:logstack_mobile/services/project_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';

final projectProvider =
    StateNotifierProvider<ProjectNotifier, ProjectState>((ref) {
  final projectService = ref.watch(projectServiceProvider);
  final storage = ref.watch(storageServiceProvider);
  return ProjectNotifier(projectService, storage);
});

class ProjectState {
  final List<Project> projects;
  final Project? currentProject;
  final bool isLoading;
  final String? error;

  ProjectState({
    this.projects = const [],
    this.currentProject,
    this.isLoading = false,
    this.error,
  });

  ProjectState copyWith({
    List<Project>? projects,
    Project? currentProject,
    bool? isLoading,
    String? error,
  }) {
    return ProjectState(
      projects: projects ?? this.projects,
      currentProject: currentProject ?? this.currentProject,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ProjectNotifier extends StateNotifier<ProjectState> {
  final ProjectService _projectService;
  final StorageService _storage;

  ProjectNotifier(this._projectService, this._storage) : super(ProjectState()) {
    loadProjects();
  }

  Future<void> loadProjects() async {
    state = state.copyWith(isLoading: true);
    try {
      final projects = await _projectService.getProjects();
      final savedProjectId = await _storage.getCurrentProject();

      Project? currentProject;
      if (projects.isNotEmpty) {
        if (savedProjectId != null) {
          currentProject = projects.firstWhere(
            (p) => p.id == savedProjectId,
            orElse: () => projects.first,
          );
        } else {
          currentProject = projects.first;
        }
      }

      state = ProjectState(
        projects: projects,
        currentProject: currentProject,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> setCurrentProject(Project project) async {
    await _storage.setCurrentProject(project.id);
    state = state.copyWith(currentProject: project);
  }

  Future<void> createProject(String name) async {
    final project = await _projectService.createProject(name);
    state = state.copyWith(
      projects: [...state.projects, project],
      currentProject: project,
    );
    await _storage.setCurrentProject(project.id);
  }

  Future<void> deleteProject(String id) async {
    await _projectService.deleteProject(id);
    final projects = state.projects.where((p) => p.id != id).toList();
    final currentProject = state.currentProject?.id == id
        ? projects.firstOrNull
        : state.currentProject;
    state = state.copyWith(projects: projects, currentProject: currentProject);
  }

  Future<void> rotateApiKey(String id) async {
    final newKey = await _projectService.rotateApiKey(id);
    final projects = state.projects.map((p) {
      if (p.id == id) {
        return Project(
          id: p.id,
          userId: p.userId,
          name: p.name,
          apiKey: newKey,
          createdAt: p.createdAt,
        );
      }
      return p;
    }).toList();
    state = state.copyWith(projects: projects);
  }
}
