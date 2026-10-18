import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/staff_models.dart';
import '../providers/staff_provider.dart';

class StaffRosterScreen extends StatefulWidget {
  const StaffRosterScreen({super.key});

  @override
  State<StaffRosterScreen> createState() => _StaffRosterScreenState();
}

class _StaffRosterScreenState extends State<StaffRosterScreen> {
  String _searchQuery = '';
  String _selectedPlatoon = 'ALL';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<StaffProvider>(context, listen: false);
      if (provider.roster.isEmpty) {
        provider.fetchCadetRoster();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<StaffProvider>();

    final filteredRoster = provider.roster.where((cadet) {
      if (_selectedPlatoon != 'ALL' && cadet.platoonName != null && !cadet.platoonName!.toUpperCase().contains(_selectedPlatoon)) {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        return cadet.fullName.toLowerCase().contains(query) ||
            cadet.regimentalNumber.toLowerCase().contains(query);
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Unit Cadet Roster'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () => provider.fetchCadetRoster(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Header
          Container(
            padding: const EdgeInsets.all(16),
            color: AppColors.white,
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  decoration: InputDecoration(
                    hintText: 'Search by cadet name or regimental number...',
                    prefixIcon: const Icon(Icons.search, color: AppColors.navyPrimary),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 10),

                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: ['ALL', 'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'].map((platoon) {
                      final isSelected = _selectedPlatoon == platoon;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(platoon == 'ALL' ? 'All Platoons' : '$platoon Platoon'),
                          selected: isSelected,
                          onSelected: (_) => setState(() => _selectedPlatoon = platoon),
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
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Cadet List
          Expanded(
            child: provider.isLoadingRoster && provider.roster.isEmpty
                ? const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary))
                : RefreshIndicator(
                    onRefresh: () => provider.fetchCadetRoster(),
                    color: AppColors.navyPrimary,
                    child: filteredRoster.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: filteredRoster.length,
                            itemBuilder: (ctx, i) => _buildCadetCard(filteredRoster[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCadetCard(StaffCadetSummaryModel cadet) {
    final isEligible = cadet.percentage >= 75;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: AppColors.navyPrimary,
                  child: Text(
                    cadet.fullName.isNotEmpty ? cadet.fullName[0] : 'C',
                    style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.gold, fontSize: 16),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cadet.fullName,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.navyPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        cadet.regimentalNumber,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${cadet.platoonName ?? "Platoon"} • ${cadet.year ?? "Year"}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isEligible ? AppColors.successLight : AppColors.errorLight,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: isEligible ? AppColors.success : AppColors.error),
                  ),
                  child: Text(
                    '${cadet.percentage}%',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: isEligible ? AppColors.success : AppColors.error,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 8),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStat('Parades', '${cadet.total}', AppColors.navyPrimary),
                _buildStat('Present', '${cadet.present}', AppColors.success),
                _buildStat('Excused', '${cadet.excused}', AppColors.warning),
                _buildStat('Absent', '${cadet.absent}', AppColors.error),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 54, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 14),
            const Text(
              'No Matching Cadets',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'Try adjusting your search criteria or platoon filter.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
