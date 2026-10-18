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
          : RefreshIndicator(
              onRefresh: () => provider.fetchCamps(),
              color: AppColors.navyPrimary,
              child: provider.camps.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: provider.camps.length,
                      itemBuilder: (ctx, i) => _buildCampCard(provider.camps[i], provider, currentUserId),
                    ),
            ),
    );
  }

  Widget _buildCampCard(CampModel camp, CampProvider provider, String currentUserId) {
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
            else
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(40),
                ),
                icon: const Icon(Icons.how_to_reg, size: 16),
                label: const Text('APPLY FOR NOMINATION', style: TextStyle(fontSize: 12)),
                onPressed: () => _confirmNomination(camp, provider),
              ),
          ],
        ),
      ),
    );
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
                    content: Text(success ? 'Nomination request submitted.' : 'Failed to apply for camp.'),
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
}
