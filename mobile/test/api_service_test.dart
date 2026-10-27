import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/core/services/api_service.dart';

void main() {
  setUp(() => ApiService.setDemoMode(false));

  test('PATCH requests use the HTTP PATCH method', () async {
    String? method;
    final api = ApiService.withClient(
      MockClient((request) async {
        method = request.method;
        return http.Response('{"success":true}', 200);
      }),
    );

    final response = await api.patch(
      'https://unit.test/api/attendance/sessions/session-1/mark',
      body: const {'cadetId': 'cadet-1', 'status': 'PRESENT'},
      requiresAuth: false,
    );

    expect(method, 'PATCH');
    expect(response.success, isTrue);
  });

  test('Demo mode rejects requests before the HTTP client is called', () async {
    var requestCount = 0;
    final api = ApiService.withClient(
      MockClient((request) async {
        requestCount++;
        return http.Response('{"success":true}', 200);
      }),
    );
    ApiService.setDemoMode(true);

    final response = await api.patch(
      'https://unit.test/api/attendance/sessions/session-1/mark',
      body: const {'cadetId': 'cadet-1', 'status': 'PRESENT'},
    );

    expect(response.success, isFalse);
    expect(response.statusCode, 0);
    expect(requestCount, 0);
  });

  test('A 2xx API response with success false remains a failure', () async {
    final api = ApiService.withClient(
      MockClient(
        (_) async =>
            http.Response('{"success":false,"message":"Not accepted"}', 200),
      ),
    );

    final response = await api.post(
      'https://unit.test/api/auth/recovery/request-otp',
      body: const {},
      requiresAuth: false,
    );

    expect(response.success, isFalse);
    expect(response.message, 'Not accepted');
  });
}
