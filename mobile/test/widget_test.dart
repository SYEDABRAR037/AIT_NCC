import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/main.dart';

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('NCC Mobile App root initialization smoke test', (WidgetTester tester) async {
    await tester.runAsync(() async {
      await tester.pumpWidget(const NccMobileApp());
      // Let initial async microtasks complete
      await Future.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Verify NCC branding and authentication elements render
    expect(find.text('NCC AIT PUNE'), findsWidgets);
    expect(find.text('DIGITAL COMMAND & CADET MANAGEMENT SYSTEM'), findsOneWidget);
    expect(find.text('Institutional Sign In'), findsOneWidget);
  });
}
