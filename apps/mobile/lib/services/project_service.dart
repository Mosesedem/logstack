import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logstack_mobile/models/project.dart';
import 'package:logstack_mobile/services/api_client.dart';

final projectServiceProvider = Provider<ProjectService>((ref) {
  final api = ref.watch(apiClientProvider);
  return ProjectService(api);
});

class ProjectService {
  final ApiClient _api;

  ProjectService(this._api);

  Future<List<Project>> getProjects() async {
    final response = await _api.get<List<dynamic>>('/projects');
    return response.map((p) => Project.fromJson(p)).toList();
  }

  Future<Project> createProject(String name) async {
    return await _api.post(
      '/projects',
      data: {'name': name},
      fromJson: (data) => Project.fromJson(data),
    );
  }

  Future<void> deleteProject(String id) async {
    await _api.delete('/projects/$id');
  }

  Future<String> rotateApiKey(String id) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/projects/$id/rotate-key',
    );
    return response['apiKey'] as String;
  }
}
