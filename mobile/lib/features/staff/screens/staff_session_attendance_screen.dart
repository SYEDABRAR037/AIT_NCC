import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/staff_models.dart';
import '../providers/staff_provider.dart';

class StaffSessionAttendanceScreen extends StatefulWidget {
  const StaffSessionAttendanceScreen({super.key});

  @override
  State<StaffSessionAttendanceScreen> createState() => _StaffSessionAttendanceScreenState();
}

class _StaffSessionAttendanceScreenState extends State<StaffSessionAttendanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<StaffProvider>(context, listen: false);
      if (provider.sessions.isEmpty) {
        provider.fetchSessions();
      }
      if (provider.roster.isEmpty) {
        provider.fetchCadetRoster();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<StaffProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parade Muster Sessions'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () {
              provider.fetchSessions();
              provider.fetchCadetRoster();
            },
          ),
        ],
      ),
      body: provider.isLoadingSessions && provider.sessions.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary))
          : RefreshIndicator(
              onRefresh: () async {
                await provider.fetchSessions();
                await provider.fetchCadetRoster();
              },
              color: AppColors.navyPrimary,
              child: provider.sessions.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: provider.sessions.length,
                      itemBuilder: (ctx, i) => _buildSessionCard(provider.sessions[i], provider),
                    ),
            ),
    );
  }

  Widget _buildSessionCard(StaffSessionModel session, StaffProvider provider) {
    final dateFormatted = DateFormat('EEEE, dd MMM yyyy').format(session.date);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.navyPrimary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    session.activity,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 10, color: AppColors.gold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: session.isActive ? AppColors.successLight : AppColors.backgroundLight,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    session.status,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                      color: session.isActive ? AppColors.success : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Text(
              session.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 4),

            Row(
              children: [
                const Icon(Icons.access_time, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  '$dateFormatted • ${session.timing ?? ""}'.trim(),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
            if (session.location != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    session.location!,
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 14),

            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(40),
              ),
              icon: Icon(session.isActive ? Icons.playlist_add_check : Icons.lock_outline, size: 18),
              label: Text(session.isActive ? 'MARK CADET MUSTER ROLL' : 'SESSION CLOSED', style: const TextStyle(fontSize: 12)),
              onPressed: session.isActive ? () => _openMusterMarkingSheet(session, provider) : null,
            ),
          ],
        ),
      ),
    );
  }

  void _openMusterMarkingSheet(StaffSessionModel session, StaffProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final roster = provider.roster;

          return DraggableScrollableSheet(
            initialChildSize: 0.8,
            minChildSize: 0.5,
            maxChildSize: 0.95,
            expand: false,
            builder: (ctx, scrollController) => Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.borderLight,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Muster: ${session.title}',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
                  ),
                  const Text(
                    'Tap a status button to mark cadet attendance.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  const Divider(),

                  Expanded(
                    child: roster.isEmpty
                        ? const Center(child: Text('No cadets found in unit roster.'))
                        : ListView.separated(
                            controller: scrollController,
                            itemCount: roster.length,
                            separatorBuilder: (context, index) => const Divider(height: 1),
                            itemBuilder: (ctx, i) {
                              final cadet = roster[i];

                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            cadet.fullName,
                                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                          ),
                                          Text(
                                            cadet.regimentalNumber,
                                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        _buildMarkButton(ctx, session.id, cadet.id, 'PRESENT', AppColors.success, provider),
                                        const SizedBox(width: 4),
                                        _buildMarkButton(ctx, session.id, cadet.id, 'EXCUSED', AppColors.warning, provider),
                                        const SizedBox(width: 4),
                                        _buildMarkButton(ctx, session.id, cadet.id, 'ABSENT', AppColors.error, provider),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMarkButton(
    BuildContext context,
    String sessionId,
    String cadetId,
    String status,
    Color color,
    StaffProvider provider,
  ) {
    return InkWell(
      onTap: () async {
        final messenger = ScaffoldMessenger.of(context);
        final success = await provider.markCadetAttendance(
          sessionId: sessionId,
          cadetId: cadetId,
          status: status,
        );
        messenger.showSnackBar(
          SnackBar(
            content: Text(success ? 'Marked $status.' : 'Failed to mark attendance.'),
            duration: const Duration(milliseconds: 1200),
            backgroundColor: success ? color : AppColors.error,
          ),
        );
      },
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: color),
        ),
        child: Text(
          status[0],
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: color),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.event_available, size: 54, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 14),
            const Text(
              'No Scheduled Parade Sessions',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'New drill training sessions created by the unit will appear here for muster call.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
