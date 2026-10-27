import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';
import 'package:mobile/features/auth/screens/login_screen.dart';
import 'package:mobile/features/auth/screens/password_recovery_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    ApiService.setDemoMode(false);
  });

  testWidgets(
    'Recovery screen validates inputs and does not invent OTP success',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
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

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: const MaterialApp(home: PasswordRecoveryScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Request a verification code'), findsOneWidget);
      expect(find.text('Forgot password?'), findsNothing);

      await tester.tap(find.text('Send verification code'));
      await tester.pumpAndSettle();
      expect(find.text('Enter your registered email address.'), findsOneWidget);
      expect(find.text('Verify your code'), findsNothing);

      await tester.enterText(
        find.byType(TextFormField).at(0),
        'synthetic@example.invalid',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'TEST/CADET/001',
      );
      await tester.tap(find.text('Send verification code'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('If the details match an eligible account'),
        findsOneWidget,
      );
      expect(find.text('Verify your code'), findsNothing);
      expect(tester.takeException(), isNull);

      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );

  testWidgets('Login opens the password recovery flow', (tester) async {
    final auth = AuthProvider(
      api: ApiService.withClient(
        MockClient((_) async => http.Response('{}', 500)),
      ),
    );
    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>.value(
        value: auth,
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Forgot password?'));
    await tester.pumpAndSettle();

    expect(find.text('Request a verification code'), findsOneWidget);
    expect(find.text('Registered email'), findsOneWidget);
    expect(find.text('Regimental number'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Login layout adapts from compact phones to desktop widths', (
    tester,
  ) async {
    final auth = AuthProvider(
      api: ApiService.withClient(
        MockClient((_) async => http.Response('{}', 500)),
      ),
    );
    for (final size in const [
      Size(360, 800),
      Size(375, 812),
      Size(390, 844),
      Size(393, 852),
      Size(768, 1024),
      Size(1440, 900),
    ]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: const MaterialApp(home: LoginScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Institutional Sign In'),
        findsOneWidget,
        reason: '$size',
      );
      expect(tester.takeException(), isNull, reason: '$size');
    }
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
