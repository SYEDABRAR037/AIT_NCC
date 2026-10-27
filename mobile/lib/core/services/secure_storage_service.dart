import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecureStorageService {
  static final SecureStorageService _instance = SecureStorageService._internal();
  factory SecureStorageService() => _instance;
  SecureStorageService._internal();

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const String _keyToken = 'ncc_jwt_token';
  static const String _keyUserJson = 'ncc_user_json';
  static const String _keyActiveBaseUrl = 'ncc_active_base_url';

  // Save auth JWT
  Future<void> saveToken(String token) async {
    // Authentication tokens must never fall back to plaintext preferences.
    await _secureStorage.write(key: _keyToken, value: token);
  }

  // Retrieve auth JWT
  Future<String?> getToken() async {
    final token = await _secureStorage.read(key: _keyToken);
    return token != null && token.isNotEmpty ? token : null;
  }

  // Delete auth JWT
  Future<void> deleteToken() async {
    // Remove any credentials written by the former insecure SharedPreferences fallback.
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyToken);
    } catch (_) {}
    await _secureStorage.delete(key: _keyToken);
  }

  // Save serialized User JSON
  Future<void> saveUserJson(String userJson) async {
    await _secureStorage.write(key: _keyUserJson, value: userJson);
  }

  // Get serialized User JSON
  Future<String?> getUserJson() async {
    final json = await _secureStorage.read(key: _keyUserJson);
    return json != null && json.isNotEmpty ? json : null;
  }

  // Delete serialized User JSON
  Future<void> deleteUserJson() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyUserJson);
    } catch (_) {}
    await _secureStorage.delete(key: _keyUserJson);
  }

  // Clear all credentials
  Future<void> clearAll() async {
    await deleteToken();
    await deleteUserJson();
  }

  // Custom Base URL persistence (for network switching)
  Future<void> saveActiveBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyActiveBaseUrl, url);
  }

  Future<String?> getActiveBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyActiveBaseUrl);
  }
}
