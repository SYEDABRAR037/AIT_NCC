import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/features/auth/models/user_model.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/services/secure_storage_service.dart';

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    ApiService.setDemoMode(false);
  });

  group('UserModel Serialization & Role Tests', () {
    test('Correctly deserializes cadet user JSON', () {
      final json = {
        'id': 'cadet-123',
        'fullName': 'Aman Kumar',
        'regimentalNumber': 'MH/22/SDA/1001',
        'collegeRollNumber': '22001',
        'email': 'aman@aitpune.edu.in',
        'phone': '+919876543210',
        'year': 'Third Year',
        'branch': 'Computer Engineering',
        'platoonName': 'Alpha Platoon',
        'role': 'CADET',
        'status': 'ACTIVE',
      };

      final user = UserModel.fromJson(json);

      expect(user.id, 'cadet-123');
      expect(user.fullName, 'Aman Kumar');
      expect(user.regimentalNumber, 'MH/22/SDA/1001');
      expect(user.isCadet, isTrue);
      expect(user.isStaff, isFalse);
      expect(user.isActive, isTrue);
      expect(user.roleDisplayName, 'Cadet');
    });

    test('Correctly deserializes officer user JSON', () {
      final json = {
        'id': 'ano-001',
        'fullName': 'Major Officer',
        'regimentalNumber': 'ANO/001',
        'email': 'ano@aitpune.edu.in',
        'role': 'ADMIN_ANO',
        'status': 'ACTIVE',
      };

      final user = UserModel.fromJson(json);

      expect(user.isCadet, isFalse);
      expect(user.isStaff, isTrue);
      expect(user.isAno, isTrue);
      expect(user.roleDisplayName, 'Associate NCC Officer');
    });
  });

  group('AuthProvider State Tests', () {
    test('Initializes with unauthenticated state', () {
      final auth = AuthProvider();
      expect(auth.isAuthenticated, isFalse);
      expect(auth.currentUser, isNull);
      expect(auth.token, isNull);
      expect(auth.otpRequired, isFalse);
    });

    test('Cancels OTP challenge resetting OTP state', () {
      final auth = AuthProvider();
      auth.cancelOtp();
      expect(auth.otpRequired, isFalse);
      expect(auth.challengeId, isNull);
      expect(auth.maskedDestination, isNull);
    });

    test('Demo session isolation: isDemo flag and logout cleanup', () async {
      final auth = AuthProvider();
      expect(auth.isDemo, isFalse);

      auth.setSessionForDemo(
        user: UserModel(
          id: 'demo-1',
          fullName: 'Demo Cadet',
          regimentalNumber: 'MH/22/SDA/1001',
          email: 'demo@aitpune.edu.in',
          role: 'CADET',
          status: 'ACTIVE',
        ),
        demoToken: 'DEMO_CADET_TOKEN',
      );

      expect(auth.isDemo, isTrue);
      expect(auth.isAuthenticated, isTrue);
      expect(auth.token, 'DEMO_CADET_TOKEN');

      // Logout strictly clears demo state
      await auth.logout();
      expect(auth.isDemo, isFalse);
      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.currentUser, isNull);
    });

    test('Real tokens do not trigger isDemo flag', () {
      final auth = AuthProvider();
      auth.setSessionForDemo(
        user: UserModel(
          id: 'real-1',
          fullName: 'Real Cadet',
          regimentalNumber: 'MH/22/SDA/9999',
          email: 'real@aitpune.edu.in',
          role: 'CADET',
          status: 'ACTIVE',
        ),
        demoToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realjwttoken',
      );

      expect(auth.isDemo, isFalse);
      expect(auth.isAuthenticated, isTrue);
    });

    test(
      'Session credentials are not read from plaintext preferences',
      () async {
        SharedPreferences.setMockInitialValues({
          'ncc_jwt_token': 'legacy-plaintext-token',
          'ncc_user_json': '{"id":"legacy-user"}',
        });
        final storage = SecureStorageService();

        expect(await storage.getToken(), isNull);
        expect(await storage.getUserJson(), isNull);
        await storage.deleteToken();
        expect(
          (await SharedPreferences.getInstance()).containsKey('ncc_jwt_token'),
          isFalse,
        );
        await storage.saveToken('secure-token');
        expect(await storage.getToken(), 'secure-token');
        await storage.deleteToken();
        expect(await storage.getToken(), isNull);
      },
    );

    test(
      'Demo sessions block all API verbs even if a real token remains stored',
      () async {
        await SecureStorageService().saveToken('previous-real-session-token');
        final auth = AuthProvider();
        auth.setSessionForDemo(
          user: UserModel(
            id: 'demo-1',
            fullName: 'Demo Cadet',
            regimentalNumber: 'MH/22/SDA/1001',
            email: 'demo@aitpune.edu.in',
            role: 'CADET',
            status: 'ACTIVE',
          ),
          demoToken: 'DEMO_CADET_TOKEN',
        );

        final api = ApiService();
        const url = 'https://ait-ncc.onrender.com/api/test-only';
        final responses = await Future.wait([
          api.get(url),
          api.post(url, body: const {}),
          api.put(url, body: const {}),
          api.patch(url, body: const {}),
          api.delete(url),
        ]);

        expect(
          responses,
          everyElement(
            predicate<ApiResponse>(
              (response) => !response.success && response.statusCode == 0,
            ),
          ),
        );
        expect(
          responses,
          everyElement(
            predicate<ApiResponse>(
              (response) => response.message!.contains('disabled in demo'),
            ),
          ),
        );
      },
    );
  });
}
