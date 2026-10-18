import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';
import 'package:mobile/features/camps/models/camp_model.dart';
import 'package:mobile/features/camps/providers/camp_provider.dart';
import 'package:mobile/features/camps/screens/camps_screen.dart';
import 'package:mobile/features/inquiries/models/inquiry_model.dart';
import 'package:mobile/features/inquiries/providers/inquiry_provider.dart';
import 'package:mobile/features/inquiries/screens/inquiries_screen.dart';
import 'package:mobile/features/leave/models/leave_model.dart';
import 'package:mobile/features/leave/providers/leave_provider.dart';
import 'package:mobile/features/leave/screens/leave_screen.dart';

class PreloadedLeaveProvider extends LeaveProvider {
  @override
  List<LeaveModel> get leaves => [
    LeaveModel(
      id: 'leave-1',
      leaveType: 'ACADEMIC',
      startDate: DateTime.parse('2026-10-20T00:00:00Z'),
      endDate: DateTime.parse('2026-10-22T00:00:00Z'),
      reason: 'Mid-term Engineering Examination',
      status: 'APPROVED',
      remarks: 'Sanctioned by Platoon Commander',
    ),
  ];

  @override
  bool get isLoading => false;

  @override
  Future<void> fetchLeaves() async {}
}

class PreloadedCampProvider extends CampProvider {
  @override
  List<CampModel> get camps => [
    CampModel(
      id: 'camp-1',
      name: 'Combined Annual Training Camp (CATC)',
      location: 'Pune Cantonment Grounds',
      startDate: DateTime.parse('2026-11-01T00:00:00Z'),
      endDate: DateTime.parse('2026-11-10T00:00:00Z'),
      campType: 'CATC',
      status: 'UPCOMING',
      participants: [
        CampParticipantModel(id: 'part-1', cadetId: 'cadet-001', status: 'SELECTED'),
      ],
    ),
  ];

  @override
  bool get isLoading => false;

  @override
  Future<void> fetchCamps() async {}
}

class PreloadedInquiryProvider extends InquiryProvider {
  @override
  List<InquiryModel> get inquiries => [
    InquiryModel(
      id: 'inq-1',
      requestNumber: 'REQ-2026-0042',
      requestType: 'PROFILE_CORRECTION',
      title: 'Roll Number Update',
      description: 'Please rectify college roll number on digital muster.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
      currentReviewerRole: 'PLATOON_SENIOR',
      createdAt: DateTime.parse('2026-10-18T10:00:00Z'),
    ),
  ];

  @override
  bool get isLoading => false;

  @override
  Future<void> fetchInquiries() async {}
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('Service Workflows Models Unit Tests', () {
    test('LeaveModel accurately parses approval and remarks', () {
      final json = {
        'id': 'l-100',
        'leaveType': 'MEDICAL',
        'startDate': '2026-10-18T00:00:00.000Z',
        'endDate': '2026-10-20T00:00:00.000Z',
        'reason': 'Severe viral fever and medical rest',
        'status': 'APPROVED',
        'leaveReviews': [
          {'remarks': 'Approved based on medical certificate'},
        ],
      };

      final leave = LeaveModel.fromJson(json);

      expect(leave.id, 'l-100');
      expect(leave.isApproved, isTrue);
      expect(leave.isPending, isFalse);
      expect(leave.leaveType, 'MEDICAL');
      expect(leave.remarks, 'Approved based on medical certificate');
    });

    test('CampModel accurately checks cadet nomination status', () {
      final json = {
        'id': 'c-200',
        'name': 'Thal Sainik Camp (TSC) Prep',
        'location': 'Kirkee Military Station',
        'startDate': '2026-12-01T00:00:00.000Z',
        'endDate': '2026-12-12T00:00:00.000Z',
        'campType': 'TSC',
        'status': 'UPCOMING',
        'participants': [
          {'id': 'p-1', 'cadetId': 'cadet-001', 'status': 'CONFIRMED'},
        ],
      };

      final camp = CampModel.fromJson(json);

      expect(camp.id, 'c-200');
      expect(camp.isCadetRegistered('cadet-001'), isTrue);
      expect(camp.cadetRegistrationStatus('cadet-001'), 'CONFIRMED');
      expect(camp.isCadetRegistered('cadet-999'), isFalse);
    });

    test('InquiryModel parses request identifier and status', () {
      final json = {
        'id': 'req-300',
        'requestNumber': 'REQ-2026-0099',
        'requestType': 'DOCUMENT_REQUEST',
        'title': 'B Certificate Attestation',
        'description': 'Required for higher education application.',
        'priority': 'URGENT',
        'status': 'RESOLVED',
        'currentReviewerRole': 'ADMIN_ANO',
      };

      final inq = InquiryModel.fromJson(json);

      expect(inq.id, 'req-300');
      expect(inq.requestNumber, 'REQ-2026-0099');
      expect(inq.isResolved, isTrue);
      expect(inq.isPending, isFalse);
      expect(inq.currentReviewerRole, 'ADMIN_ANO');
    });
  });

  group('Service Workflows Screen Widget Tests', () {
    testWidgets('LeaveScreen renders leave list and floating apply button', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<LeaveProvider>(
            create: (_) => PreloadedLeaveProvider(),
            child: const LeaveScreen(),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(LeaveScreen), findsOneWidget);
      expect(find.text('Leave Applications'), findsOneWidget);
      expect(find.text('APPLY LEAVE'), findsOneWidget);
      expect(find.text('ACADEMIC'), findsOneWidget);
      expect(find.text('Mid-term Engineering Examination'), findsOneWidget);
      expect(find.text('Reviewer Remarks: Sanctioned by Platoon Commander'), findsOneWidget);
    });

    testWidgets('CampsScreen renders camps list and registration status', (WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<CampProvider>(create: (_) => PreloadedCampProvider()),
            ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
          ],
          child: const MaterialApp(home: CampsScreen()),
        ),
      );
      await tester.pump();

      expect(find.byType(CampsScreen), findsOneWidget);
      expect(find.text('Camps & Training'), findsOneWidget);
      expect(find.text('Combined Annual Training Camp (CATC)'), findsOneWidget);
      expect(find.text('CATC'), findsOneWidget);
      expect(find.text('Pune Cantonment Grounds'), findsOneWidget);
    });

    testWidgets('InquiriesScreen renders inquiry cards and new inquiry button', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<InquiryProvider>(
            create: (_) => PreloadedInquiryProvider(),
            child: const InquiriesScreen(),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(InquiriesScreen), findsOneWidget);
      expect(find.text('Inquiry & Command Desk'), findsOneWidget);
      expect(find.text('NEW INQUIRY'), findsOneWidget);
      expect(find.text('REQ-2026-0042'), findsOneWidget);
      expect(find.text('Roll Number Update'), findsOneWidget);
      expect(find.text('Assigned to: PLATOON_SENIOR'), findsOneWidget);
    });
  });
}
