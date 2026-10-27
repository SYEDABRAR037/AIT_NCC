import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/services/secure_storage_service.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    ApiService.setDemoMode(false);
  });

  test(
    'Login waits for server OTP verification before storing a session',
    () async {
      final requests = <http.Request>[];
      final responses = <http.Response>[
        http.Response(
          jsonEncode({
            'success': true,
            'otpRequired': true,
            'challengeId': 'login-challenge-1',
            'destination': '***1234',
          }),
          200,
        ),
        http.Response(
          jsonEncode({
            'success': true,
            'token': 'synthetic-session-token',
            'user': {
              'id': 'test-user-1',
              'fullName': 'Synthetic Cadet',
              'regimentalNumber': 'TEST/CADET/001',
              'email': 'synthetic@example.invalid',
              'role': 'CADET',
              'status': 'ACTIVE',
            },
          }),
          200,
        ),
      ];
      final auth = AuthProvider(
        api: ApiService.withClient(
          MockClient((request) async {
            requests.add(request);
            return responses.removeAt(0);
          }),
        ),
      );

      expect(
        await auth.initiateLogin('TEST/CADET/001', 'synthetic-password'),
        isTrue,
      );
      expect(auth.otpRequired, isTrue);
      expect(auth.isAuthenticated, isFalse);
      expect(await auth.verifyLoginOtp('123456'), isTrue);
      expect(auth.currentUser?.role, 'CADET');
      expect(auth.isAuthenticated, isTrue);
      expect(
        await SecureStorageService().getToken(),
        'synthetic-session-token',
      );
      expect(requests.map((request) => request.url.path.split('/').last), [
        'login',
        'verify-otp',
      ]);
    },
  );

  test('Invalid credentials stay unauthenticated', () async {
    final auth = AuthProvider(
      api: ApiService.withClient(
        MockClient(
          (_) async => http.Response(
            jsonEncode({'success': false, 'message': 'Invalid credentials.'}),
            401,
          ),
        ),
      ),
    );

    expect(
      await auth.initiateLogin('TEST/CADET/001', 'wrong-password'),
      isFalse,
    );
    expect(auth.isAuthenticated, isFalse);
    expect(auth.otpRequired, isFalse);
    expect(auth.errorMessage, 'Invalid credentials.');
  });

  test('Expired restored session is cleared after backend 401', () async {
    final storage = SecureStorageService();
    await storage.saveToken('expired-synthetic-token');
    await storage.saveUserJson(
      jsonEncode({
        'id': 'test-user-1',
        'fullName': 'Synthetic Cadet',
        'regimentalNumber': 'TEST/CADET/001',
        'email': 'synthetic@example.invalid',
        'role': 'CADET',
        'status': 'ACTIVE',
      }),
    );
    final auth = AuthProvider(
      api: ApiService.withClient(
        MockClient(
          (request) async => request.method == 'GET'
              ? http.Response(
                  jsonEncode({'success': false, 'message': 'Expired'}),
                  401,
                )
              : http.Response(jsonEncode({'success': true}), 200),
        ),
      ),
    );

    await auth.initAuth();

    expect(auth.isAuthenticated, isFalse);
    expect(auth.currentUser, isNull);
    expect(await storage.getToken(), isNull);
  });

  test(
    'Neutral recovery response does not advance to OTP verification',
    () async {
      final auth = AuthProvider(
        api: ApiService.withClient(
          MockClient(
            (_) async => http.Response(
              jsonEncode({
                'success': false,
                'challengeAccepted': false,
                'message':
                    'If the details match an eligible account, a code may be sent.',
              }),
              200,
            ),
          ),
        ),
      );

      final accepted = await auth.requestPasswordRecovery(
        email: 'synthetic@example.invalid',
        regimentalNumber: 'TEST/CADET/001',
      );

      expect(accepted, isFalse);
      expect(auth.recoveryId, isNull);
      expect(auth.recoveryMaskedEmail, isNull);
      expect(auth.errorMessage, contains('If the details match'));
    },
  );

  test(
    'Recovery follows server-confirmed request, verify, and reset responses',
    () async {
      final requests = <http.Request>[];
      final responses = <http.Response>[
        http.Response(
          jsonEncode({
            'success': true,
            'challengeAccepted': true,
            'recoveryId': 'recovery-test-1',
            'maskedEmail': 's***@example.invalid',
            'expiresAt': '2026-10-18T12:01:00.000Z',
          }),
          200,
        ),
        http.Response(
          jsonEncode({
            'success': true,
            'verified': true,
            'resetToken': 'server-reset-token',
          }),
          200,
        ),
        http.Response(
          jsonEncode({'success': true, 'passwordReset': true}),
          200,
        ),
      ];
      final auth = AuthProvider(
        api: ApiService.withClient(
          MockClient((request) async {
            requests.add(request);
            return responses.removeAt(0);
          }),
        ),
      );

      expect(
        await auth.requestPasswordRecovery(
          email: 'synthetic@example.invalid',
          regimentalNumber: 'TEST/CADET/001',
        ),
        isTrue,
      );
      expect(auth.recoveryId, 'recovery-test-1');
      expect(auth.recoveryMaskedEmail, 's***@example.invalid');
      expect(await auth.verifyPasswordRecoveryOtp('123456'), isTrue);
      expect(auth.recoveryOtpVerified, isTrue);
      expect(
        await auth.resetPassword(
          newPassword: 'new-test-pass',
          confirmPassword: 'new-test-pass',
        ),
        isTrue,
      );
      expect(auth.recoveryId, isNull);
      expect(auth.recoveryOtpVerified, isFalse);

      expect(requests.map((request) => request.url.path.split('/').last), [
        'request-otp',
        'verify-otp',
        'reset-password',
      ]);
      expect(jsonDecode(requests[1].body)['recoveryId'], 'recovery-test-1');
      expect(jsonDecode(requests[2].body)['resetToken'], 'server-reset-token');
    },
  );
}
