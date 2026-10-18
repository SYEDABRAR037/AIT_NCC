import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/attendance_record_model.dart';
import '../providers/attendance_provider.dart';

class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  State<AttendanceHistoryScreen> createState() => _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  String _selectedFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<AttendanceProvider>(context, listen: false);
      if (provider.stats == null) {
        provider.fetchAttendanceHistory();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AttendanceProvider>();

    if (provider.isLoading && provider.stats == null) {
      return const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary));
    }

    if (provider.errorMessage != null && provider.stats == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 12),
              Text(
                provider.errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => provider.fetchAttendanceHistory(),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('RETRY'),
              ),
            ],
          ),
        ),
      );
    }

    final stats = provider.stats;
    final records = provider.records;

    final filteredRecords = records.filter((r) {
      if (_selectedFilter == 'PRESENT') return r.isPresent;
      if (_selectedFilter == 'ABSENT') return r.isAbsent;
      if (_selectedFilter == 'EXCUSED') return r.isExcused;
      return true;
    }).toList();

    return RefreshIndicator(
      onRefresh: () => provider.fetchAttendanceHistory(),
      color: AppColors.navyPrimary,
      child: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          if (stats != null) _buildSummaryHeader(stats),
          const SizedBox(height: 16),

          _buildFilterBar(),
          const SizedBox(height: 12),

          if (filteredRecords.isEmpty)
            _buildEmptyState()
          else
            ...filteredRecords.map(_buildRecordCard),
        ],
      ),
    );
  }

  Widget _buildSummaryHeader(AttendanceStats stats) {
    final isEligible = stats.percentage >= 75;

    return Card(
      color: AppColors.navyPrimary,
      child: Padding(
        padding: const EdgeInsets.all(18.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OVERALL ATTENDANCE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: AppColors.gold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${stats.percentage}%',
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: AppColors.white,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isEligible ? AppColors.success : AppColors.error,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(isEligible ? Icons.check_circle : Icons.warning_amber, size: 14, color: AppColors.white),
                      const SizedBox(width: 4),
                      Text(
                        isEligible ? 'EXAM ELIGIBLE' : 'SHORTAGE (<75%)',
                        style: const TextStyle(color: AppColors.white, fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: AppColors.navyBorder),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(child: _buildMetricItem('Total', '${stats.total}', AppColors.white)),
                Expanded(child: _buildMetricItem('Present', '${stats.present}', AppColors.success)),
                Expanded(child: _buildMetricItem('Excused', '${stats.excused}', AppColors.gold)),
                Expanded(child: _buildMetricItem('Absent', '${stats.absent}', AppColors.error)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.borderLight)),
      ],
    );
  }

  Widget _buildFilterBar() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: ['ALL', 'PRESENT', 'EXCUSED', 'ABSENT'].map((filter) {
          final isSelected = _selectedFilter == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(filter),
              selected: isSelected,
              onSelected: (_) => setState(() => _selectedFilter = filter),
              selectedColor: AppColors.navyPrimary,
              labelStyle: TextStyle(
                color: isSelected ? AppColors.white : AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildRecordCard(AttendanceRecordModel record) {
    Color statusColor;
    Color statusBg;
    IconData statusIcon;

    if (record.isPresent) {
      statusColor = AppColors.success;
      statusBg = AppColors.successLight;
      statusIcon = Icons.check_circle;
    } else if (record.isExcused) {
      statusColor = AppColors.warning;
      statusBg = AppColors.warningLight;
      statusIcon = Icons.info;
    } else {
      statusColor = AppColors.error;
      statusBg = AppColors.errorLight;
      statusIcon = Icons.cancel;
    }

    final dateFormatted = record.date != null ? DateFormat('dd MMM yyyy').format(record.date!) : 'Scheduled Session';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: statusBg,
                shape: BoxShape.circle,
              ),
              child: Icon(statusIcon, color: statusColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        dateFormatted,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.navyPrimary),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: statusBg,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          record.status,
                          style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    record.sessionTitle,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                  ),
                  if (record.location != null || record.timing != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${record.timing ?? ""} • ${record.location ?? ""}'.trim(),
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          children: [
            Icon(Icons.event_note, size: 48, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 12),
            const Text(
              'No matching attendance records',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 4),
            const Text(
              'Parade attendance marked by the drill instructor will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

extension IterableExtension<T> on Iterable<T> {
  Iterable<T> filter(bool Function(T) test) sync* {
    for (final element in this) {
      if (test(element)) yield element;
    }
  }
}
