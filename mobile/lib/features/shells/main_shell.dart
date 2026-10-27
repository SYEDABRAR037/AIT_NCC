import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../auth/providers/auth_provider.dart';
import '../attendance/providers/attendance_provider.dart';
import '../digital_id/screens/digital_id_screen.dart';
import '../attendance/screens/attendance_history_screen.dart';
import '../notices/screens/notices_screen.dart';
import '../leave/screens/leave_screen.dart';
import '../camps/screens/camps_screen.dart';
import '../inquiries/screens/inquiries_screen.dart';
import '../staff/screens/staff_roster_screen.dart';
import '../staff/screens/staff_session_attendance_screen.dart';
import '../staff/screens/staff_approvals_screen.dart';
import '../staff/screens/staff_leave_review_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final auth = context.read<AuthProvider>();
      if (auth.currentUser?.isCadet == true && !auth.isDemo) {
        context.read<AttendanceProvider>().fetchAttendanceHistory();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final navigationItems = user.isCadet
        ? const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.badge_outlined),
              activeIcon: Icon(Icons.badge),
              label: 'Digital ID',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.event_available_outlined),
              activeIcon: Icon(Icons.event_available),
              label: 'Attendance',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.notifications_outlined),
              activeIcon: Icon(Icons.notifications),
              label: 'Notices',
            ),
          ]
        : const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.notifications_outlined),
              activeIcon: Icon(Icons.notifications),
              label: 'Notices',
            ),
          ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.gold,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Icon(
                Icons.shield,
                color: AppColors.navyDark,
                size: 18,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'NCC AIT PUNE',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Text(
                    user.roleDisplayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (auth.isDemo)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Tooltip(
                message: 'Demo presentation mode. Live API access is disabled.',
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'DEMO',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: AppColors.navyDark,
                    ),
                  ),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            tooltip: 'Terminate Session',
            onPressed: () => _confirmLogout(context, auth),
          ),
        ],
      ),
      body: _buildCurrentView(user),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        selectedItemColor: AppColors.navyPrimary,
        unselectedItemColor: AppColors.textSecondary,
        selectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 11,
        ),
        type: BottomNavigationBarType.fixed,
        items: navigationItems,
      ),
    );
  }

  Widget _buildCurrentView(dynamic user) {
    switch (_selectedIndex) {
      case 0:
        return _buildDashboardPlaceholder(user);
      case 1:
        return user.isCadet ? const DigitalIdScreen() : const NoticesScreen();
      case 2:
        return user.isCadet
            ? const AttendanceHistoryScreen()
            : const SizedBox.shrink();
      case 3:
        return const NoticesScreen();
      default:
        return const SizedBox();
    }
  }

  Widget _buildDashboardPlaceholder(dynamic user) {
    final auth = context.watch<AuthProvider>();
    final attendance = context.watch<AttendanceProvider>();
    final attendanceValue = auth.isDemo
        ? 'DEMO'
        : attendance.stats != null
        ? '${attendance.stats!.percentage}%'
        : attendance.isLoading
        ? '…'
        : attendance.errorMessage != null
        ? 'Unavailable'
        : '—';
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Cadet Profile Card
          Card(
            color: AppColors.navyPrimary,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.gold,
                    child: Text(
                      user.fullName.isNotEmpty ? user.fullName[0] : 'C',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navyDark,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.fullName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user.regimentalNumber,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.gold,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${user.platoonName ?? "Platoon"} • ${user.year ?? "Year"}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.borderLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      user.status,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Quick Operational Metric Cards
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  'Account Status',
                  user.status,
                  Icons.shield_outlined,
                  AppColors.navyPrimary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  'Attendance',
                  attendanceValue,
                  Icons.fact_check_outlined,
                  AppColors.success,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          const Text(
            'Operational Sections',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.navyPrimary,
            ),
          ),
          const SizedBox(height: 12),

          if (user.isCadet) ...[
            _buildActionTile(
              'Digital ID Card',
              'Display secure QR code for parade muster',
              Icons.qr_code,
              1,
            ),
            _buildActionTile(
              'My Attendance',
              'View parade muster history and excused duties',
              Icons.fact_check_outlined,
              2,
            ),
          ],
          _buildActionTile(
            'Unit Orders & Notices',
            'Official broadcasts and training circulars',
            Icons.campaign_outlined,
            3,
          ),
          const SizedBox(height: 20),

          const Text(
            'Service Workflows',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.navyPrimary,
            ),
          ),
          const SizedBox(height: 12),

          if (user.role == 'CADET' ||
              user.role == 'SENIOR' ||
              user.role == 'PLATOON_SENIOR')
            _buildCustomActionTile(
              'Leave Applications',
              'Request official parade absence or view decision status',
              Icons.event_busy_outlined,
              const LeaveScreen(),
            ),
          _buildCustomActionTile(
            'Camps & Training',
            user.isCadet
                ? 'View training camps and apply for nomination'
                : 'View training camps and review nomination progress',
            Icons.terrain_outlined,
            const CampsScreen(),
          ),
          _buildCustomActionTile(
            'Inquiry & Command Desk',
            'Submit queries, corrections, or document requests',
            Icons.contact_support_outlined,
            const InquiriesScreen(),
          ),

          if (user.isStaff) ...[
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'OFFICER ACCESS',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 10,
                      color: AppColors.navyDark,
                    ),
                  ),
                ),
                const Text(
                  'Command & Staff Operations',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.navyPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildCustomActionTile(
              'Unit Cadet Roster',
              'View muster roll rates, filter by platoon, and monitor cadet readiness',
              Icons.groups_outlined,
              const StaffRosterScreen(),
            ),
            _buildCustomActionTile(
              'Parade Muster Sessions',
              'Mark attendance for active drill training sessions',
              Icons.checklist_rtl_outlined,
              const StaffSessionAttendanceScreen(),
            ),
            if (user.role != 'DRILL_INSTRUCTOR')
              _buildCustomActionTile(
                'Cadet Registration Approvals',
                'Review and verify newly submitted cadet applications',
                Icons.verified_user_outlined,
                const StaffApprovalsScreen(),
              ),
            if (user.role != 'DRILL_INSTRUCTOR')
              _buildCustomActionTile(
                'Leave Review',
                'Review applications at your authorized workflow stage',
                Icons.fact_check_outlined,
                const StaffLeaveReviewScreen(),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetricCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionTile(
    String title,
    String subtitle,
    IconData icon,
    int targetTab,
  ) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.navyPrimary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, color: AppColors.navyPrimary, size: 20),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: AppColors.navyPrimary,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        trailing: const Icon(
          Icons.arrow_forward_ios,
          size: 14,
          color: AppColors.textMuted,
        ),
        onTap: () => setState(() => _selectedIndex = targetTab),
      ),
    );
  }

  Widget _buildCustomActionTile(
    String title,
    String subtitle,
    IconData icon,
    Widget targetScreen,
  ) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.navyPrimary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, color: AppColors.navyPrimary, size: 20),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: AppColors.navyPrimary,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        trailing: const Icon(
          Icons.arrow_forward_ios,
          size: 14,
          color: AppColors.textMuted,
        ),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => targetScreen),
        ),
      ),
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Confirm Logout',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        content: const Text(
          'Are you sure you want to terminate this command session?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () {
              Navigator.pop(ctx);
              auth.logout();
            },
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
