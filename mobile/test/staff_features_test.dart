import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/features/staff/models/staff_models.dart';
import 'package:mobile/features/staff/providers/staff_provider.dart';
import 'package:mobile/features/staff/screens/staff_approvals_screen.dart';
import 'package:mobile/features/staff/screens/staff_roster_screen.dart';
import 'package:mobile/features/staff/screens/staff_session_attendance_screen.dart';

class PreloadedStaffProvider extends StaffProvider {
  @override
  List<StaffCadetSummaryModel> get roster => [
    StaffCadetSummaryModel(
      id: 'cadet-001',
      fullName: 'Aman Kumar',
      regimentalNumber: 'MH/22/SDA/1001',
      platoonName: 'Alpha Platoon',
      year: 'Third Year',
      branch: 'Computer Engineering',
      total: 20,
      present: 18,
      absent: 1,
      excused: 1,
      percentage: 90,
    ),
  ];

  @override
  List<StaffSessionModel> get sessions => [
    StaffSessionModel(
      id: 'session-001',
      title: 'Command Drill & Weapon Training',
      activity: 'WEAPON_TRAINING',
      date: DateTime.parse('2026-10-18T06:00:00Z'),
      timing: '06:00 - 08:30 AM',
      location: 'AIT Obstacle Ground',
      status: 'ACTIVE',
    ),
  ];

  @override
  List<PendingApprovalModel> get pendingApprovals => [
    PendingApprovalModel(
      id: 'app-001',
      fullName: 'Rahul Sharma',
      regimentalNumber: 'MH/23/SDA/2005',
      collegeRollNumber: '23045',
      email: 'rahul.s@aitpune.edu.in',
      phone: '+919123456789',
      platoonName: 'Bravo Platoon',
      year: 'Second Year',
      status: 'UNDER_REVIEW',
      createdAt: DateTime.parse('2026-10-18T08:00:00Z'),
    ),
  ];

  @override
  bool get isLoadingRoster => false;

  @override
  bool get isLoadingSessions => false;

  @override
  bool get isLoadingApprovals => false;

  @override
  Future<void> fetchCadetRoster() async {}

  @override
  Future<void> fetchSessions() async {}

  @override
  Future<void> fetchPendingApprovals() async {}
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('Staff Models Unit Tests', () {
    test('StaffCadetSummaryModel accurately parses attendance metrics', () {
      final json = {
        'id': 'c-10',
        'fullName': 'Suresh Raina',
        'regimentalNumber': 'MH/22/SDA/1010',
        'platoonName': 'Alpha Platoon',
        'year': 'Third Year',
        'branch': 'Mechanical',
        'stats': {
          'total': 15,
          'present': 12,
          'absent': 2,
          'excused': 1,
          'percentage': 80,
        },
      };

      final cadet = StaffCadetSummaryModel.fromJson(json);

      expect(cadet.id, 'c-10');
      expect(cadet.fullName, 'Suresh Raina');
      expect(cadet.total, 15);
      expect(cadet.present, 12);
      expect(cadet.percentage, 80);
    });

    test('StaffSessionModel parses date, timing, and active flag', () {
      final json = {
        'id': 'sess-100',
        'title': 'Range Firing Practice',
        'activity': 'FIRING',
        'date': '2026-10-25T07:00:00.000Z',
        'timing': '07:00 - 10:00 AM',
        'location': 'Southern Command Range',
        'status': 'ACTIVE',
      };

      final session = StaffSessionModel.fromJson(json);

      expect(session.id, 'sess-100');
      expect(session.title, 'Range Firing Practice');
      expect(session.isActive, isTrue);
      expect(session.location, 'Southern Command Range');
    });

    test('PendingApprovalModel parses cadet applicant fields', () {
      final json = {
        'id': 'pending-1',
        'fullName': 'Aditya Verma',
        'regimentalNumber': 'MH/23/SDA/2050',
        'collegeRollNumber': '23050',
        'email': 'aditya@aitpune.edu.in',
        'phone': '+919988776655',
        'platoonName': 'Charlie Platoon',
        'year': 'Second Year',
        'status': 'UNDER_REVIEW',
        'createdAt': '2026-10-18T09:00:00.000Z',
      };

      final app = PendingApprovalModel.fromJson(json);

      expect(app.id, 'pending-1');
      expect(app.fullName, 'Aditya Verma');
      expect(app.regimentalNumber, 'MH/23/SDA/2050');
      expect(app.status, 'UNDER_REVIEW');
    });
  });

  group('Staff Screens Widget Tests', () {
    testWidgets('StaffRosterScreen renders cadet cards and platoon filter chips', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<StaffProvider>(
            create: (_) => PreloadedStaffProvider(),
            child: const StaffRosterScreen(),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(StaffRosterScreen), findsOneWidget);
      expect(find.text('Unit Cadet Roster'), findsOneWidget);
      expect(find.text('All Platoons'), findsOneWidget);
      expect(find.text('Aman Kumar'), findsOneWidget);
      expect(find.text('MH/22/SDA/1001'), findsOneWidget);
      expect(find.text('90%'), findsOneWidget);
    });

    testWidgets('StaffSessionAttendanceScreen renders session card and muster action', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<StaffProvider>(
            create: (_) => PreloadedStaffProvider(),
            child: const StaffSessionAttendanceScreen(),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(StaffSessionAttendanceScreen), findsOneWidget);
      expect(find.text('Parade Muster Sessions'), findsOneWidget);
      expect(find.text('Command Drill & Weapon Training'), findsOneWidget);
      expect(find.text('MARK CADET MUSTER ROLL'), findsOneWidget);
    });

    testWidgets('StaffApprovalsScreen renders applicant card and action buttons', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<StaffProvider>(
            create: (_) => PreloadedStaffProvider(),
            child: const StaffApprovalsScreen(),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(StaffApprovalsScreen), findsOneWidget);
      expect(find.text('Cadet Registration Approvals'), findsOneWidget);
      expect(find.text('Rahul Sharma'), findsOneWidget);
      expect(find.text('APPROVE'), findsOneWidget);
      expect(find.text('REJECT'), findsOneWidget);
    });
  });
}
