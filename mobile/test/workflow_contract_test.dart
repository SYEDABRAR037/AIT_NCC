import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/constants/api_constants.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/inquiries/providers/inquiry_provider.dart';
import 'package:mobile/features/camps/providers/camp_provider.dart';
import 'package:mobile/features/leave/providers/leave_provider.dart';

void main() {
  const base = 'https://unit.test/api';

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    FlutterSecureStorage.setMockInitialValues({});
    ApiService.setDemoMode(false);
    ApiConstants.activeBaseUrl = base;
  });

  tearDown(() => ApiConstants.activeBaseUrl = ApiConstants.defaultBaseUrl);

  test(
    'official inquiry provider uses list, thread, reply, status and submit contracts',
    () async {
      final calls = <http.Request>[];
      final api = ApiService.withClient(
        MockClient((request) async {
          calls.add(request);
          if (request.method == 'GET' &&
              request.url.path.endsWith('/requests/inquiries')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'inquiries': [_inquiry],
              }),
              200,
            );
          }
          if (request.method == 'GET' &&
              request.url.path.endsWith('/requests/inquiry/inq-1')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'inquiry': {
                  ..._inquiry,
                  'replies': [_reply],
                },
              }),
              200,
            );
          }
          return http.Response('{"success":true}', 200);
        }),
      );
      final provider = InquiryProvider(api: api);

      await provider.fetchInquiries();
      expect(provider.inquiries.single.requestNumber, 'REQ-TEST-1');
      expect(provider.inquiries.single.cadetName, 'Synthetic Cadet');
      expect(provider.inquiries.single.replyCount, 1);

      final thread = await provider.fetchThread('inq-1');
      expect(thread?.replies.single.message, 'Synthetic officer reply');
      expect(
        await provider.replyToInquiry(id: 'inq-1', message: 'Follow up'),
        isTrue,
      );
      expect(
        await provider.updateStatus(id: 'inq-1', status: 'FORWARDED'),
        isTrue,
      );
      expect(
        await provider.submitInquiry(
          title: 'Test subject',
          description: 'Test details',
        ),
        isTrue,
      );

      expect(
        calls.any((request) => request.url.path == '/api/requests/inquiries'),
        isTrue,
      );
      expect(
        calls.any(
          (request) => request.url.path == '/api/requests/inquiry/inq-1',
        ),
        isTrue,
      );
      expect(
        calls.any(
          (request) =>
              request.url.path.endsWith('/reply') &&
              jsonDecode(request.body)['message'] == 'Follow up',
        ),
        isTrue,
      );
      expect(
        calls.any(
          (request) =>
              request.url.path.endsWith('/status') && request.method == 'PATCH',
        ),
        isTrue,
      );
      final submit = calls.firstWhere(
        (request) =>
            request.method == 'POST' &&
            request.url.path == '/api/requests/inquiry',
      );
      expect(jsonDecode(submit.body), containsPair('subject', 'Test subject'));
      expect(jsonDecode(submit.body), containsPair('message', 'Test details'));
    },
  );

  test(
    'leave review provider sends the existing review action contract',
    () async {
      final calls = <http.Request>[];
      final api = ApiService.withClient(
        MockClient((request) async {
          calls.add(request);
          if (request.method == 'GET') {
            return http.Response(
              jsonEncode({
                'success': true,
                'leaves': [_leave],
              }),
              200,
            );
          }
          return http.Response('{"success":true}', 200);
        }),
      );
      final provider = LeaveProvider(api: api);

      await provider.fetchReviewLeaves();
      expect(provider.reviewLeaves.single.applicantName, 'Synthetic Cadet');
      expect(
        await provider.processReview(
          leaveId: 'leave-1',
          action: 'FORWARD',
          remarks: 'Reviewed',
        ),
        isTrue,
      );
      final action = calls.firstWhere((request) => request.method == 'PATCH');
      expect(action.url.path, '/api/leave/leave-1/action');
      expect(jsonDecode(action.body), containsPair('action', 'FORWARD'));
      expect(jsonDecode(action.body), containsPair('remarks', 'Reviewed'));
    },
  );

  test(
    'camp progression provider uses the existing participant status route',
    () async {
      final calls = <http.Request>[];
      final api = ApiService.withClient(
        MockClient((request) async {
          calls.add(request);
          if (request.method == 'GET') {
            return http.Response('{"success":true,"camps":[]}', 200);
          }
          return http.Response('{"success":true}', 200);
        }),
      );
      final provider = CampProvider(api: api);

      expect(
        await provider.updateParticipantStatus(
          campId: 'camp-1',
          cadetId: 'cadet-1',
          status: 'RECOMMENDED',
        ),
        isTrue,
      );
      final update = calls.firstWhere((request) => request.method == 'PATCH');
      expect(update.url.path, '/api/camps/camp-1/participants/cadet-1');
      expect(jsonDecode(update.body), containsPair('status', 'RECOMMENDED'));
    },
  );
}

const _inquiry = {
  'id': 'inq-1',
  'requestNumber': 'REQ-TEST-1',
  'requestType': 'OFFICIAL_INQUIRY',
  'title': 'Test inquiry',
  'description': 'Synthetic details',
  'status': 'SUBMITTED',
  'cadetId': 'cadet-1',
  'currentReviewerRole': 'SENIOR',
  'cadet': {
    'id': 'cadet-1',
    'fullName': 'Synthetic Cadet',
    'regimentalNumber': 'TEST-001',
  },
  '_count': {'replies': 1},
};

const _reply = {
  'id': 'reply-1',
  'senderId': 'senior-1',
  'senderName': 'Synthetic Officer',
  'senderRole': 'SENIOR',
  'message': 'Synthetic officer reply',
};

const _leave = {
  'id': 'leave-1',
  'leaveType': 'ACADEMIC',
  'startDate': '2026-10-20T00:00:00.000Z',
  'endDate': '2026-10-22T00:00:00.000Z',
  'reason': 'Synthetic exam leave',
  'status': 'SUBMITTED',
  'cadet': {
    'id': 'cadet-1',
    'fullName': 'Synthetic Cadet',
    'regimentalNumber': 'TEST-001',
  },
  'leaveReviews': [],
};
