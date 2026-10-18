import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/secure_storage_service.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final SecureStorageService _storage = SecureStorageService();

  UserModel? _currentUser;
  String? _token;
  bool _isLoading = false;
  String? _errorMessage;

  // 2-Step OTP State
  bool _otpRequired = false;
  String? _challengeId;
  String? _maskedDestination;
  DateTime? _otpExpiresAt;

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

  // Restore authenticated session from secure storage
  Future<void> initAuth() async {
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
          _token = token;
          _currentUser = UserModel.fromJson(userJson);

          await _storage.saveToken(token);
          await _storage.saveUserJson(jsonEncode(_currentUser!.toJson()));

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
    _currentUser = user;
    _token = demoToken;
    _isLoading = false;
    _otpRequired = false;
    _errorMessage = null;
    notifyListeners();
  }
}
