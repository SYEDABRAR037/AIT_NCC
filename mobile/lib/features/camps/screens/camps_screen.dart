import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/camp_model.dart';
import '../providers/camp_provider.dart';

class CampsScreen extends StatefulWidget {
  const CampsScreen({super.key});

  @override
  State<CampsScreen> createState() => _CampsScreenState();
}

class _CampsScreenState extends State<CampsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<CampProvider>(context, listen: false);
      if (provider.camps.isEmpty) {
        provider.fetchCamps();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CampProvider>();
    final auth = context.watch<AuthProvider>();
    final currentUserId = auth.currentUser?.id ?? '';
    final role = auth.currentUser?.role;
    final canApply = role == 'CADET';
    final canManage = role == 'SENIOR' || role == 'PLATOON_SENIOR' || role == 'ADMIN_ANO';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Camps & Training'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () => provider.fetchCamps(),
          ),
        ],
      ),
      body: provider.isLoading && provider.camps.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary))
          : provider.errorMessage != null && provider.camps.isEmpty
              ? _buildLoadError(provider)
          : RefreshIndicator(
              onRefresh: () => provider.fetchCamps(),
              color: AppColors.navyPrimary,
              child: provider.camps.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: provider.camps.length,
                      itemBuilder: (ctx, i) => _buildCampCard(provider.camps[i], provider, currentUserId, role ?? '', canApply, canManage),
                    ),
            ),
    );
  }

  Widget _buildCampCard(CampModel camp, CampProvider provider, String currentUserId, String role, bool canApply, bool canManage) {
    final startFmt = DateFormat('dd MMM yyyy').format(camp.startDate);
    final endFmt = DateFormat('dd MMM yyyy').format(camp.endDate);
    final registrationStatus = camp.cadetRegistrationStatus(currentUserId);
    final isRegistered = registrationStatus != null;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
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
                    camp.campType,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: AppColors.gold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: camp.status == 'UPCOMING' ? AppColors.info.withValues(alpha: 0.15) : AppColors.backgroundLight,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    camp.status,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                      color: camp.status == 'UPCOMING' ? AppColors.info : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Text(
              camp.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),

            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 15, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    camp.location,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),

            Row(
              children: [
                const Icon(Icons.calendar_month_outlined, size: 15, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  '$startFmt  –  $endFmt',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Action / Status Area
            if (isRegistered)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.successLight,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle, size: 16, color: AppColors.success),
                    const SizedBox(width: 6),
                    Text(
                      'NOMINATION STATUS: $registrationStatus',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: AppColors.success),
                    ),
                  ],
                ),
              )
            else if (canApply && camp.status == 'OPEN')
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(40),
                ),
                icon: const Icon(Icons.how_to_reg, size: 16),
                label: const Text('APPLY FOR NOMINATION', style: TextStyle(fontSize: 12)),
                onPressed: () => _confirmNomination(camp, provider),
              ),
            if (canManage && camp.participants.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('Nomination progression', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.navyPrimary)),
              const SizedBox(height: 6),
              ...camp.participants.map((participant) => _participantRow(camp, participant, provider, role)),
            ],
          ],
        ),
      ),
    );
  }

  List<String> _allowedParticipantStatuses(String role) => switch (role) {
        'SENIOR' => const ['RECOMMENDED', 'WAITLISTED', 'REJECTED'],
        'PLATOON_SENIOR' => const ['SELECTED', 'WAITLISTED', 'REJECTED'],
        'ADMIN_ANO' => const ['CONFIRMED', 'PARTICIPATED', 'COMPLETED', 'REJECTED'],
        _ => const [],
      };

  Widget _participantRow(CampModel camp, CampParticipantModel participant, CampProvider provider, String role) {
    final statuses = _allowedParticipantStatuses(role);
    final selected = statuses.contains(participant.status) ? participant.status : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(participant.cadetName ?? 'Cadet', style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('${participant.cadetRegimentalNumber ?? ''}${participant.cadetPlatoon == null ? '' : ' • ${participant.cadetPlatoon}'}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                Text(participant.status, style: const TextStyle(fontSize: 11, color: AppColors.navyPrimary)),
              ],
            ),
          ),
          DropdownButton<String>(
            value: selected,
            hint: const Text('Update'),
            items: statuses.map((status) => DropdownMenuItem(value: status, child: Text(status))).toList(),
            onChanged: (status) {
              if (status != null && status != participant.status) {
                _updateParticipant(camp, participant, status, provider);
              }
            },
          ),
        ],
      ),
    );
  }

  Future<void> _updateParticipant(CampModel camp, CampParticipantModel participant, String status, CampProvider provider) async {
    final success = await provider.updateParticipantStatus(
      campId: camp.id,
      cadetId: participant.cadetId,
      status: status,
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? 'Nomination updated to $status.' : (provider.errorMessage ?? 'Nomination update failed.')),
          backgroundColor: success ? AppColors.success : AppColors.error,
        ),
      );
    }
  }

  void _confirmNomination(CampModel camp, CampProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Camp Nomination', style: TextStyle(fontWeight: FontWeight.w800)),
        content: Text('Do you wish to submit your nomination request for "${camp.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await provider.applyForCamp(camp.id);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? 'Nomination request submitted.' : (provider.errorMessage ?? 'Failed to apply for camp.')),
                    backgroundColor: success ? AppColors.success : AppColors.error,
                  ),
                );
              }
            },
            child: const Text('Confirm Nomination'),
          ),
        ],
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
            Icon(Icons.terrain, size: 54, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 14),
            const Text(
              'No Active Training Camps',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'Official annual training camps (ATC, CATC, RDC, TSC) will be posted here when scheduled.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadError(CampProvider provider) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(provider.errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: provider.fetchCamps,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
}
