import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'secure_storage_service.dart';

class ApiResponse {
  final bool success;
  final int statusCode;
  final dynamic data;
  final String? message;
  final Map<String, dynamic>? rawJson;

  ApiResponse({
    required this.success,
    required this.statusCode,
    this.data,
    this.message,
    this.rawJson,
  });
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal() : _client = http.Client();
  ApiService.withClient(http.Client client) : _client = client;

  final http.Client _client;
  final SecureStorageService _storage = SecureStorageService();
  static const Duration _timeout = Duration(seconds: 15);
  static bool _demoMode = false;

  static void setDemoMode(bool enabled) => _demoMode = enabled;

  ApiResponse? _demoModeResponse() => _demoMode
      ? ApiResponse(
          success: false,
          statusCode: 0,
          message: 'Live API requests are disabled in demo presentation mode.',
        )
      : null;

  Future<Map<String, String>> _getHeaders({bool requiresAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (requiresAuth) {
      final token = await _storage.getToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  // GET request
  Future<ApiResponse> get(String url, {bool requiresAuth = true}) async {
    final demoResponse = _demoModeResponse();
    if (demoResponse != null) return demoResponse;
    try {
      final headers = await _getHeaders(requiresAuth: requiresAuth);
      final response = await _client.get(Uri.parse(url), headers: headers).timeout(_timeout);
      return _processResponse(response);
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Unable to reach NCC Command Server. Please check network connection.',
      );
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please try again.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: -1,
        message: 'Network error: $e',
      );
    }
  }

  // POST request
  Future<ApiResponse> post(String url, {dynamic body, bool requiresAuth = true}) async {
    final demoResponse = _demoModeResponse();
    if (demoResponse != null) return demoResponse;
    try {
      final headers = await _getHeaders(requiresAuth: requiresAuth);
      final encodedBody = body != null ? jsonEncode(body) : null;
      final response = await _client
          .post(Uri.parse(url), headers: headers, body: encodedBody)
          .timeout(_timeout);
      return _processResponse(response);
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Unable to reach NCC Command Server. Please check network connection.',
      );
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please try again.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: -1,
        message: 'Network error: $e',
      );
    }
  }

  // PUT request
  Future<ApiResponse> put(String url, {dynamic body, bool requiresAuth = true}) async {
    final demoResponse = _demoModeResponse();
    if (demoResponse != null) return demoResponse;
    try {
      final headers = await _getHeaders(requiresAuth: requiresAuth);
      final encodedBody = body != null ? jsonEncode(body) : null;
      final response = await _client
          .put(Uri.parse(url), headers: headers, body: encodedBody)
          .timeout(_timeout);
      return _processResponse(response);
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Unable to reach NCC Command Server. Please check network connection.',
      );
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please try again.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: -1,
        message: 'Network error: $e',
      );
    }
  }

  // PATCH request
  Future<ApiResponse> patch(String url, {dynamic body, bool requiresAuth = true}) async {
    final demoResponse = _demoModeResponse();
    if (demoResponse != null) return demoResponse;
    try {
      final headers = await _getHeaders(requiresAuth: requiresAuth);
      final encodedBody = body != null ? jsonEncode(body) : null;
      final response = await _client
          .patch(Uri.parse(url), headers: headers, body: encodedBody)
          .timeout(_timeout);
      return _processResponse(response);
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Unable to reach NCC Command Server. Please check network connection.',
      );
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please try again.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: -1,
        message: 'Network error: $e',
      );
    }
  }

  // DELETE request
  Future<ApiResponse> delete(String url, {bool requiresAuth = true}) async {
    final demoResponse = _demoModeResponse();
    if (demoResponse != null) return demoResponse;
    try {
      final headers = await _getHeaders(requiresAuth: requiresAuth);
      final response = await _client.delete(Uri.parse(url), headers: headers).timeout(_timeout);
      return _processResponse(response);
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 0,
        message: 'Unable to reach NCC Command Server. Please check network connection.',
      );
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please try again.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: -1,
        message: 'Network error: $e',
      );
    }
  }

  ApiResponse _processResponse(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final success = decoded.containsKey('success')
            ? decoded['success'] == true
            : response.statusCode >= 200 && response.statusCode < 300;
        final message = decoded['message']?.toString();
        return ApiResponse(
          success: success,
          statusCode: response.statusCode,
          data: decoded['data'] ?? decoded,
          message: message,
          rawJson: decoded,
        );
      }
      return ApiResponse(
        success: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode,
        data: decoded,
      );
    } catch (_) {
      return ApiResponse(
        success: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode,
        message: response.body.isNotEmpty ? response.body : 'Server returned ${response.statusCode}',
      );
    }
  }
}
