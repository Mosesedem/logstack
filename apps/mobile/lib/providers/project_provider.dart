import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/project.dart';
import 'package:logstack_mobile/providers/auth_provider.dart';
import 'package:logstack_mobile/services/project_service.dart';
import 'package:logstack_mobile/services/storage_service.dart';

final projectProvider =
    StateNotifierProvider<ProjectNotifier, ProjectState>((ref) {
  final projectService = ref.watch(projectServiceProvider);
  final storage = ref.watch(storageServiceProvider);
  final notifier = ProjectNotifier(projectService, storage);

  // Session boundary: never keep another account's project in memory.
  ref.listen<AuthState>(
    authProvider,
    (prev, next) {
      if (next.isLoading) return;

      if (!next.isAuthenticated) {
        unawaited(notifier.clearForLogout());
        return;
      }

      final prevUserId = prev?.user?.id;
      final nextUserId = next.user?.id;
      final becameAuth =
          prev == null || prev.isLoading || !prev.isAuthenticated;
      final userSwitched = prevUserId != null &&
          nextUserId != null &&
          prevUserId != nextUserId;

      if (becameAuth || userSwitched) {
        // Drop previous account's selection immediately, then load this user's.
        notifier.prepareForNewSession();
        unawaited(notifier.loadProjects());
      }
    },
    fireImmediately: true,
  );

  return notifier;
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
    bool clearCurrentProject = false,
    bool clearError = false,
  }) {
    return ProjectState(
      projects: projects ?? this.projects,
      currentProject: clearCurrentProject
          ? null
          : (currentProject ?? this.currentProject),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class ProjectNotifier extends StateNotifier<ProjectState> {
  ProjectNotifier(this._projectService, this._storage)
      : super(ProjectState());

  final ProjectService _projectService;
  final StorageService _storage;

  /// Bumped on logout / new session so in-flight [loadProjects] cannot apply
  /// stale results from a previous account.
  int _sessionEpoch = 0;

  /// In-memory wipe only (storage is cleared by [StorageService.clearSession]).
  Future<void> clearForLogout() async {
    _sessionEpoch++;
    state = ProjectState();
  }

  /// Called when a new account session starts — wipe selection before fetch.
  void prepareForNewSession() {
    _sessionEpoch++;
    state = ProjectState(isLoading: true);
  }

  Future<void> loadProjects() async {
    final epoch = _sessionEpoch;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final projects = await _projectService.getProjects();
      if (epoch != _sessionEpoch) return;

      final savedProjectId = await _storage.getCurrentProject();
      if (epoch != _sessionEpoch) return;

      Project? currentProject;
      if (projects.isNotEmpty) {
        if (savedProjectId != null) {
          // Only restore if this user actually owns the saved id.
          final match = projects.where((p) => p.id == savedProjectId);
          currentProject = match.isNotEmpty ? match.first : projects.first;
        } else {
          currentProject = projects.first;
        }
        await _storage.setCurrentProject(currentProject.id);
      } else {
        await _storage.clearCurrentProject();
        currentProject = null;
      }

      if (epoch != _sessionEpoch) return;
      state = ProjectState(
        projects: projects,
        currentProject: currentProject,
      );
    } catch (e) {
      if (epoch != _sessionEpoch) return;
      // Never keep a previous account's project after a failed reload.
      state = ProjectState(
        isLoading: false,
        error: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  Future<void> setCurrentProject(Project project) async {
    await _storage.setCurrentProject(project.id);
    state = state.copyWith(currentProject: project, clearError: true);
  }

  Future<void> createProject(String name) async {
    final project = await _projectService.createProject(name);
    state = state.copyWith(
      projects: [...state.projects, project],
      currentProject: project,
      clearError: true,
    );
    await _storage.setCurrentProject(project.id);
  }

  Future<void> deleteProject(String id) async {
    await _projectService.deleteProject(id);
    final projects = state.projects.where((p) => p.id != id).toList();
    final currentProject = state.currentProject?.id == id
        ? (projects.isNotEmpty ? projects.first : null)
        : state.currentProject;
    if (currentProject != null) {
      await _storage.setCurrentProject(currentProject.id);
      state = state.copyWith(
        projects: projects,
        currentProject: currentProject,
      );
    } else {
      state = ProjectState(projects: projects);
    }
  }

  Future<void> rotateApiKey(String id) async {
    final newKey = await _projectService.rotateApiKey(id);
    final projects = state.projects.map((p) {
      if (p.id == id) {
        return Project(
          id: p.id,
          ownerId: p.ownerId,
          name: p.name,
          apiKey: newKey,
          environment: p.environment,
          createdAt: p.createdAt,
        );
      }
      return p;
    }).toList();
    state = state.copyWith(projects: projects);
  }
}
