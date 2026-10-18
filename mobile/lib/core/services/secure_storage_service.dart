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
    try {
      await _secureStorage.write(key: _keyToken, value: token);
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyToken, token);
    }
  }

  // Retrieve auth JWT
  Future<String?> getToken() async {
    try {
      final token = await _secureStorage.read(key: _keyToken);
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  // Delete auth JWT
  Future<void> deleteToken() async {
    try {
      await _secureStorage.delete(key: _keyToken);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
  }

  // Save serialized User JSON
  Future<void> saveUserJson(String userJson) async {
    try {
      await _secureStorage.write(key: _keyUserJson, value: userJson);
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyUserJson, userJson);
    }
  }

  // Get serialized User JSON
  Future<String?> getUserJson() async {
    try {
      final json = await _secureStorage.read(key: _keyUserJson);
      if (json != null && json.isNotEmpty) return json;
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUserJson);
  }

  // Delete serialized User JSON
  Future<void> deleteUserJson() async {
    try {
      await _secureStorage.delete(key: _keyUserJson);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUserJson);
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
