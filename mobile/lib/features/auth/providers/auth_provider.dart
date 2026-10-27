import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/secure_storage_service.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({ApiService? api, SecureStorageService? storage})
      : _api = api ?? ApiService(),
        _storage = storage ?? SecureStorageService();

  final ApiService _api;
  final SecureStorageService _storage;

  UserModel? _currentUser;
  String? _token;
  bool _isLoading = false;
  String? _errorMessage;

  // 2-Step OTP State
  bool _otpRequired = false;
  String? _challengeId;
  String? _maskedDestination;
  DateTime? _otpExpiresAt;

  String? _recoveryId;
  String? _recoveryMaskedEmail;
  DateTime? _recoveryExpiresAt;
  String? _recoveryResetToken;

  // Getters
  UserModel? get currentUser => _currentUser;
  String? get token => _token;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _token != null && _currentUser != null;
  bool get isDemo => _token != null && _token!.startsWith('DEMO_');

  bool get otpRequired => _otpRequired;
  String? get challengeId => _challengeId;
  String? get maskedDestination => _maskedDestination;
  DateTime? get otpExpiresAt => _otpExpiresAt;
  String? get recoveryId => _recoveryId;
  String? get recoveryMaskedEmail => _recoveryMaskedEmail;
  DateTime? get recoveryExpiresAt => _recoveryExpiresAt;
  bool get recoveryOtpVerified => _recoveryResetToken != null;

  // Restore authenticated session from secure storage
  Future<void> initAuth() async {
    ApiService.setDemoMode(false);
    _isLoading = true;
    notifyListeners();

    try {
      final savedToken = await _storage.getToken();
      final savedUserJson = await _storage.getUserJson();

      if (savedToken != null && savedUserJson != null) {
        _token = savedToken;
        final Map<String, dynamic> userMap = jsonDecode(savedUserJson);
        _currentUser = UserModel.fromJson(userMap);
        notifyListeners();

        // Verify active token validity with backend
        final response = await _api.get(ApiConstants.me);
        if (response.success && response.rawJson?['user'] != null) {
          _currentUser = UserModel.fromJson(response.rawJson!['user']);
          await _storage.saveUserJson(jsonEncode(_currentUser!.toJson()));
        } else if (response.statusCode == 401) {
          await logout();
          return;
        }
      }
    } catch (_) {
      // Offline fallback: keep cached credentials if available
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Step 1: Initiate Login (Identifier + Password)
  Future<bool> initiateLogin(String identifier, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.post(
        ApiConstants.login,
        body: {'identifier': identifier.trim(), 'password': password},
        requiresAuth: false,
      );

      if (response.success && response.rawJson?['otpRequired'] == true) {
        _otpRequired = true;
        _challengeId = response.rawJson!['challengeId']?.toString();
        _maskedDestination = response.rawJson!['destination']?.toString() ?? 'registered mobile/email';
        if (response.rawJson!['expiresAt'] != null) {
          _otpExpiresAt = DateTime.tryParse(response.rawJson!['expiresAt'].toString());
        }
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = response.message ?? 'Authentication failed. Please verify credentials.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Login error: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Step 2: Verify OTP
  Future<bool> verifyLoginOtp(String otp) async {
    if (_challengeId == null) {
      _errorMessage = 'Invalid verification session. Please log in again.';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.post(
        ApiConstants.verifyLoginOtp,
        body: {
          'challengeId': _challengeId,
          'otp': otp.trim(),
        },
        requiresAuth: false,
      );

      if (response.success && response.rawJson != null) {
        final token = response.rawJson!['token']?.toString();
        final userJson = response.rawJson!['user'];

        if (token != null && userJson is Map<String, dynamic>) {
          final user = UserModel.fromJson(userJson);
          // Persist securely before exposing the authenticated state. Storage errors fail closed.
          await _storage.saveUserJson(jsonEncode(user.toJson()));
          await _storage.saveToken(token);
          _token = token;
          _currentUser = user;

          _otpRequired = false;
          _challengeId = null;
          _maskedDestination = null;
          _isLoading = false;
          notifyListeners();
          return true;
        }
      }

      _errorMessage = response.message ?? 'Invalid verification code.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Verification error: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Resend OTP code
  Future<bool> resendOtp() async {
    if (_challengeId == null) return false;
    try {
      final response = await _api.post(
        ApiConstants.resendOtp,
        body: {'challengeId': _challengeId},
        requiresAuth: false,
      );
      return response.success;
    } catch (_) {
      return false;
    }
  }

  /// Starts account recovery only when the backend confirms OTP dispatch.
  Future<bool> requestPasswordRecovery({
    required String email,
    required String regimentalNumber,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    _clearRecoveryState();
    notifyListeners();
    try {
      final response = await _api.post(
        ApiConstants.recoveryRequestOtp,
        body: {
          'email': email.trim(),
          'regimentalNumber': regimentalNumber.trim(),
        },
        requiresAuth: false,
      );
      final payload = response.rawJson;
      final recoveryId = payload?['recoveryId']?.toString();
      if (response.success &&
          payload?['challengeAccepted'] == true &&
          recoveryId != null &&
          recoveryId.isNotEmpty) {
        _recoveryId = recoveryId;
        _recoveryMaskedEmail = payload?['maskedEmail']?.toString();
        _recoveryExpiresAt = DateTime.tryParse(payload?['expiresAt']?.toString() ?? '');
        return true;
      }
      _errorMessage = response.message ??
          'The server could not confirm code delivery. Check the details or try again later.';
      return false;
    } catch (_) {
      _errorMessage = 'Could not reach the recovery service. Check your connection and try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> resendPasswordRecoveryOtp() async {
    final recoveryId = _recoveryId;
    if (recoveryId == null) {
      _errorMessage = 'Start a new recovery request before asking for another code.';
      notifyListeners();
      return false;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _api.post(
        ApiConstants.recoveryResendOtp,
        body: {'recoveryId': recoveryId},
        requiresAuth: false,
      );
      final payload = response.rawJson;
      final nextRecoveryId = payload?['recoveryId']?.toString();
      if (response.success &&
          payload?['challengeAccepted'] == true &&
          nextRecoveryId != null &&
          nextRecoveryId.isNotEmpty) {
        _recoveryId = nextRecoveryId;
        _recoveryMaskedEmail = payload?['maskedEmail']?.toString();
        _recoveryExpiresAt = DateTime.tryParse(payload?['expiresAt']?.toString() ?? '');
        _recoveryResetToken = null;
        return true;
      }
      _errorMessage = response.message ?? 'The server did not confirm a new code.';
      return false;
    } catch (_) {
      _errorMessage = 'Could not reach the recovery service. Try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> verifyPasswordRecoveryOtp(String otp) async {
    final recoveryId = _recoveryId;
    if (recoveryId == null) {
      _errorMessage = 'Start a new recovery request before verifying a code.';
      notifyListeners();
      return false;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _api.post(
        ApiConstants.recoveryVerifyOtp,
        body: {'recoveryId': recoveryId, 'otp': otp.trim()},
        requiresAuth: false,
      );
      final payload = response.rawJson;
      final resetToken = payload?['resetToken']?.toString();
      if (response.success &&
          payload?['verified'] == true &&
          resetToken != null &&
          resetToken.isNotEmpty) {
        _recoveryResetToken = resetToken;
        return true;
      }
      _errorMessage = response.message ?? 'The verification code was not accepted.';
      return false;
    } catch (_) {
      _errorMessage = 'Could not reach the verification service. Try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> resetPassword({
    required String newPassword,
    required String confirmPassword,
  }) async {
    final resetToken = _recoveryResetToken;
    if (resetToken == null) {
      _errorMessage = 'Verify the code before setting a new password.';
      notifyListeners();
      return false;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final response = await _api.post(
        ApiConstants.recoveryResetPassword,
        body: {
          'resetToken': resetToken,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        },
        requiresAuth: false,
      );
      if (response.success && response.rawJson?['success'] == true) {
        _clearRecoveryState();
        return true;
      }
      _errorMessage = response.message ?? 'The server did not confirm the password change.';
      return false;
    } catch (_) {
      _errorMessage = 'Could not reach the password service. Try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearPasswordRecovery() {
    _clearRecoveryState();
    _errorMessage = null;
    notifyListeners();
  }

  void _clearRecoveryState() {
    _recoveryId = null;
    _recoveryMaskedEmail = null;
    _recoveryExpiresAt = null;
    _recoveryResetToken = null;
  }

  void cancelOtp() {
    _otpRequired = false;
    _challengeId = null;
    _maskedDestination = null;
    _errorMessage = null;
    notifyListeners();
  }

  // Logout session
  Future<void> logout() async {
    try {
      await _api.post(ApiConstants.logout, requiresAuth: true);
    } catch (_) {}
    ApiService.setDemoMode(false);
    await _storage.clearAll();
    _token = null;
    _currentUser = null;
    _otpRequired = false;
    _challengeId = null;
    _maskedDestination = null;
    _errorMessage = null;
    notifyListeners();
  }

  // Test Harness / Interactive Demo Session
  void setSessionForDemo({required UserModel user, required String demoToken}) {
    ApiService.setDemoMode(demoToken.startsWith('DEMO_'));
    _currentUser = user;
    _token = demoToken;
    _isLoading = false;
    _otpRequired = false;
    _errorMessage = null;
    notifyListeners();
  }
}
