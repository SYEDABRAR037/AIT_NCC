import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/features/attendance/models/attendance_record_model.dart';
import 'package:mobile/features/attendance/providers/attendance_provider.dart';
import 'package:mobile/features/attendance/screens/attendance_history_screen.dart';
import 'package:mobile/features/digital_id/models/digital_id_model.dart';
import 'package:mobile/features/digital_id/providers/digital_id_provider.dart';
import 'package:mobile/features/digital_id/screens/digital_id_screen.dart';
import 'package:mobile/features/notices/models/notice_model.dart';
import 'package:mobile/features/notices/providers/notice_provider.dart';
import 'package:mobile/features/notices/screens/notices_screen.dart';

class PreloadedDigitalIdProvider extends DigitalIdProvider {
  PreloadedDigitalIdProvider() {
    // Populate with test model
    final json = {
      'id': 'cadet-001',
      'fullName': 'Aman Kumar',
      'rank': 'SUO',
      'regimentalNumber': 'MH/22/SDA/1001',
      'collegeRollNumber': '22001',
      'year': 'Third Year',
      'platoonName': 'Alpha Platoon',
      'status': 'ACTIVE',
    };
    final model = DigitalIdModel.fromJson(json, 'token-12345');
    // Set via reflection or simulate fetch
    _setMock(model);
  }

  void _setMock(DigitalIdModel model) {
    // We override fetchDigitalId to prevent network calls
  }

  @override
  DigitalIdModel? get digitalId => DigitalIdModel(
    id: 'cadet-001',
    fullName: 'Aman Kumar',
    rank: 'SUO',
    regimentalNumber: 'MH/22/SDA/1001',
    collegeRollNumber: '22001',
    year: 'Third Year',
    platoonName: 'Alpha Platoon',
    status: 'ACTIVE',
    token: 'mock-token-xyz',
  );

  @override
  bool get isLoading => false;

  @override
  Future<void> fetchDigitalId() async {}
}

class PreloadedAttendanceProvider extends AttendanceProvider {
  @override
  AttendanceStats? get stats => AttendanceStats(total: 10, present: 9, absent: 1, excused: 0, percentage: 90);

  @override
  List<AttendanceRecordModel> get records => [
    AttendanceRecordModel(
      id: 'rec-1',
      status: 'PRESENT',
      sessionTitle: 'Saturday Morning Drill',
      activity: 'DRILL',
      date: DateTime.parse('2026-10-18T06:00:00Z'),
      timing: '06:00 - 08:00 AM',
      location: 'AIT Parade Ground',
    ),
  ];

  @override
  bool get isLoading => false;

  @override
  Future<void> fetchAttendanceHistory() async {}
}

class PreloadedNoticeProvider extends NoticeProvider {
  @override
  List<NoticeModel> get notices => [
    NoticeModel(
      id: 'n-1',
      title: 'Training Schedule Notice',
      content: 'Morning parade muster at 0600 hrs.',
      category: 'GENERAL',
      isUrgent: false,
      createdAt: DateTime.parse('2026-10-18T05:00:00Z'),
    ),
  ];

  @override
  bool get isLoading => false;

  @override
  Future<void> fetchNotices() async {}
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('Cadet Essentials Models Test', () {
    test('DigitalIdModel correctly parses JSON and token', () {
      final json = {
        'id': 'cadet-001',
        'fullName': 'Aman Kumar',
        'rank': 'SUO',
        'regimentalNumber': 'MH/22/SDA/1001',
        'collegeRollNumber': '22001',
        'year': 'Third Year',
        'platoonName': 'Alpha Platoon',
        'status': 'ACTIVE',
      };
      const token = 'crypto-token-abc-123';

      final model = DigitalIdModel.fromJson(json, token);

      expect(model.id, 'cadet-001');
      expect(model.fullName, 'Aman Kumar');
      expect(model.rank, 'SUO');
      expect(model.token, token);
      expect(model.isValid, isTrue);
    });

    test('AttendanceStats accurately parses counts and percentage', () {
      final json = {
        'total': 20,
        'present': 18,
        'absent': 1,
        'excused': 1,
        'percentage': 90,
      };

      final stats = AttendanceStats.fromJson(json);

      expect(stats.total, 20);
      expect(stats.present, 18);
      expect(stats.absent, 1);
      expect(stats.excused, 1);
      expect(stats.percentage, 90);
    });

    test('AttendanceRecordModel parses session nested fields', () {
      final json = {
        'id': 'rec-1',
        'status': 'PRESENT',
        'session': {
          'id': 'sess-1',
          'title': 'Saturday Morning Drill',
          'activity': 'DRILL',
          'date': '2026-10-18T06:00:00.000Z',
          'timing': '06:00 - 08:30 AM',
          'location': 'AIT Parade Ground',
        },
      };

      final record = AttendanceRecordModel.fromJson(json);

      expect(record.id, 'rec-1');
      expect(record.isPresent, isTrue);
      expect(record.sessionTitle, 'Saturday Morning Drill');
      expect(record.timing, '06:00 - 08:30 AM');
      expect(record.location, 'AIT Parade Ground');
    });

    test('NoticeModel parses urgency and category', () {
      final json = {
        'id': 'notice-1',
        'title': 'Annual Training Camp Briefing',
        'content': 'All cadets must report in proper uniform with kits.',
        'category': 'CAMP_NOTIFICATION',
        'isUrgent': true,
        'createdAt': '2026-10-18T10:00:00.000Z',
      };

      final notice = NoticeModel.fromJson(json);

      expect(notice.id, 'notice-1');
      expect(notice.isUrgent, isTrue);
      expect(notice.category, 'CAMP_NOTIFICATION');
    });
  });

  group('Cadet Essentials Screen Widget Tests', () {
    testWidgets('DigitalIdScreen renders preloaded card', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<DigitalIdProvider>(
            create: (_) => PreloadedDigitalIdProvider(),
            child: const Scaffold(body: DigitalIdScreen()),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(DigitalIdScreen), findsOneWidget);
      expect(find.text('Aman Kumar'), findsOneWidget);
      expect(find.text('MH/22/SDA/1001'), findsOneWidget);
      expect(find.text('SCAN FOR MUSTER VERIFICATION'), findsOneWidget);
    });

    testWidgets('AttendanceHistoryScreen renders filter chips and stats', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<AttendanceProvider>(
            create: (_) => PreloadedAttendanceProvider(),
            child: const Scaffold(body: AttendanceHistoryScreen()),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(AttendanceHistoryScreen), findsOneWidget);
      expect(find.text('90%'), findsOneWidget);
      expect(find.text('EXAM ELIGIBLE'), findsOneWidget);
      expect(find.text('ALL'), findsOneWidget);
      expect(find.text('PRESENT'), findsWidgets);
      expect(find.text('Saturday Morning Drill'), findsOneWidget);
    });

    testWidgets('NoticesScreen renders search input and notices', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<NoticeProvider>(
            create: (_) => PreloadedNoticeProvider(),
            child: const Scaffold(body: NoticesScreen()),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(NoticesScreen), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Training Schedule Notice'), findsOneWidget);
      expect(find.text('Morning parade muster at 0600 hrs.'), findsOneWidget);
    });
  });
}
