import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/attendance/providers/attendance_provider.dart';
import 'package:mobile/features/auth/models/user_model.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';
import 'package:mobile/features/shells/main_shell.dart';

UserModel demoUser(String role) => UserModel(
  id: 'demo-1',
  fullName: 'Demo User',
  regimentalNumber: 'MH/22/SDA/1001',
  email: 'demo@aitpune.edu.in',
  role: role,
  status: 'ACTIVE',
);

Future<void> pumpShell(WidgetTester tester, String role) async {
  final auth = AuthProvider();
  auth.setSessionForDemo(user: demoUser(role), demoToken: 'DEMO_TEST_TOKEN');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider<AttendanceProvider>(
          create: (_) => AttendanceProvider(),
        ),
      ],
      child: const MaterialApp(home: MainShell()),
    ),
  );
  await tester.pump();
}

void main() {
  setUp(() => ApiService.setDemoMode(false));

  testWidgets('Dashboard does not show the hardcoded attendance percentage', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    await pumpShell(tester, 'CADET');

    expect(find.text('92%'), findsNothing);
    expect(find.text('DEMO'), findsNWidgets(2));
    expect(find.text('Attendance'), findsWidgets);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('Drill instructors do not see registration approval controls', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    await pumpShell(tester, 'DRILL_INSTRUCTOR');

    expect(find.text('Unit Cadet Roster'), findsOneWidget);
    expect(find.text('Parade Muster Sessions'), findsOneWidget);
    expect(find.text('Cadet Registration Approvals'), findsNothing);
    expect(find.text('Leave Review'), findsNothing);
    final navigation = tester.widget<BottomNavigationBar>(
      find.byType(BottomNavigationBar),
    );
    expect(navigation.items.map((item) => item.label), [
      'Dashboard',
      'Notices',
    ]);
    expect(find.text('Leave Applications'), findsNothing);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('Cadet panel exposes cadet workflows and no staff approvals', (
    tester,
  ) async {
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
      await pumpShell(tester, 'CADET');

      expect(find.text('Digital ID Card'), findsOneWidget, reason: '$size');
      expect(find.text('Leave Applications'), findsOneWidget, reason: '$size');
      expect(find.text('Unit Cadet Roster'), findsNothing, reason: '$size');
      expect(
        find.text('Cadet Registration Approvals'),
        findsNothing,
        reason: '$size',
      );
      expect(tester.takeException(), isNull, reason: '$size');
    }

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets(
    'Senior, Platoon Senior, and ANO/Admin share backend staff role visibility',
    (tester) async {
      tester.view.physicalSize = const Size(768, 1024);
      tester.view.devicePixelRatio = 1;
      for (final role in ['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']) {
        await pumpShell(tester, role);
        expect(find.text('Unit Cadet Roster'), findsOneWidget, reason: role);
        expect(
          find.text('Parade Muster Sessions'),
          findsOneWidget,
          reason: role,
        );
        expect(
          find.text('Cadet Registration Approvals'),
          findsOneWidget,
          reason: role,
        );
        expect(find.text('Leave Review'), findsOneWidget, reason: role);
        if (role == 'ADMIN_ANO') {
          expect(find.text('Leave Applications'), findsNothing, reason: role);
        } else {
          expect(find.text('Leave Applications'), findsOneWidget, reason: role);
        }
        expect(tester.takeException(), isNull, reason: role);
        final navigation = tester.widget<BottomNavigationBar>(
          find.byType(BottomNavigationBar),
        );
        expect(navigation.items.map((item) => item.label), [
          'Dashboard',
          'Notices',
        ], reason: role);
      }
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
}
