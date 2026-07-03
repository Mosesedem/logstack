import 'package:flutter_test/flutter_test.dart';
import 'package:logstack_mobile/config/app_config.dart';

void main() {
  group('AppConfig.logStreamUrl', () {
    test('does not include :0 port for default production base', () {
      final url = AppConfig.logStreamUrl(
        projectId: 'proj-1',
        token: 'jwt-token',
      );
      expect(url, isNot(contains(':0')));
      expect(url, startsWith('wss://'));
      expect(url, contains('/v1/stream?'));
      expect(url, contains('projectId=proj-1'));
      expect(url, contains('token=jwt-token'));
    });

    test('omits token query param when token is absent', () {
      final url = AppConfig.logStreamUrl(projectId: 'proj-1');
      expect(url, contains('projectId=proj-1'));
      expect(url, isNot(contains('token=')));
    });
  });
}