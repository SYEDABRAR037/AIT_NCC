import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/features/auth/models/user_model.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
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
  });
}
