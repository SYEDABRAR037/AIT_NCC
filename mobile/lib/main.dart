import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/constants/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/shells/main_shell.dart';

import 'features/digital_id/providers/digital_id_provider.dart';
import 'features/attendance/providers/attendance_provider.dart';
import 'features/notices/providers/notice_provider.dart';
import 'features/leave/providers/leave_provider.dart';
import 'features/camps/providers/camp_provider.dart';
import 'features/inquiries/providers/inquiry_provider.dart';
import 'features/staff/providers/staff_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NccMobileApp());
}

class NccMobileApp extends StatelessWidget {
  const NccMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..initAuth()),
        ChangeNotifierProvider(create: (_) => DigitalIdProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
        ChangeNotifierProvider(create: (_) => NoticeProvider()),
        ChangeNotifierProvider(create: (_) => LeaveProvider()),
        ChangeNotifierProvider(create: (_) => CampProvider()),
        ChangeNotifierProvider(create: (_) => InquiryProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
      ],
      child: MaterialApp(
        title: 'NCC AIT Pune',
        theme: AppTheme.lightTheme,
        debugShowCheckedModeBanner: false,
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // Initial session restoration splash
    if (auth.isLoading && !auth.isAuthenticated && !auth.otpRequired) {
      return const Scaffold(
        backgroundColor: AppColors.navyDark,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.shield, size: 54, color: AppColors.gold),
              SizedBox(height: 16),
              CircularProgressIndicator(color: AppColors.gold, strokeWidth: 2.5),
              SizedBox(height: 16),
              Text(
                'INITIALIZING COMMAND SYSTEM',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.0,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (auth.isAuthenticated) {
      return const MainShell();
    }

    return const LoginScreen();
  }
}
