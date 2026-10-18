import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/notice_model.dart';
import '../providers/notice_provider.dart';

class NoticesScreen extends StatefulWidget {
  const NoticesScreen({super.key});

  @override
  State<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends State<NoticesScreen> {
  String _selectedCategory = 'ALL';
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<NoticeProvider>(context, listen: false);
      if (provider.notices.isEmpty) {
        provider.fetchNotices();
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
    final provider = context.watch<NoticeProvider>();

    if (provider.isLoading && provider.notices.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary));
    }

    if (provider.errorMessage != null && provider.notices.isEmpty) {
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
                onPressed: () => provider.fetchNotices(),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('RETRY'),
              ),
            ],
          ),
        ),
      );
    }

    final notices = provider.notices;

    final filteredNotices = notices.where((n) {
      if (_selectedCategory == 'URGENT' && !n.isUrgent) return false;
      if (_selectedCategory != 'ALL' && _selectedCategory != 'URGENT' && n.category != _selectedCategory) return false;
      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        return n.title.toLowerCase().contains(query) || n.content.toLowerCase().contains(query);
      }
      return true;
    }).toList();

    return RefreshIndicator(
      onRefresh: () => provider.fetchNotices(),
      color: AppColors.navyPrimary,
      child: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // Search Input
          TextField(
            controller: _searchController,
            onChanged: (val) => setState(() => _searchQuery = val.trim()),
            decoration: InputDecoration(
              hintText: 'Search orders and notices...',
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
          const SizedBox(height: 12),

          // Category Chips
          Row(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  child: Row(
                    children: ['ALL', 'URGENT', 'ROUTINE_ORDER', 'TRAINING_CIRCULAR', 'GENERAL'].map((cat) {
                      final isSelected = _selectedCategory == cat;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(cat.replaceAll('_', ' ')),
                          selected: isSelected,
                          onSelected: (_) => setState(() => _selectedCategory = cat),
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
              ),
              const Padding(
                padding: EdgeInsets.only(left: 4.0),
                child: Icon(Icons.arrow_forward_ios, size: 10, color: AppColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (filteredNotices.isEmpty)
            _buildEmptyState()
          else
            ...filteredNotices.map(_buildNoticeCard),
        ],
      ),
    );
  }

  Widget _buildNoticeCard(NoticeModel notice) {
    final dateFormatted = notice.createdAt != null
        ? DateFormat('dd MMM yyyy, hh:mm a').format(notice.createdAt!)
        : 'Official Notice';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => _showNoticeDetails(notice),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (notice.isUrgent) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.warning, size: 11, color: AppColors.white),
                          SizedBox(width: 3),
                          Text(
                            'URGENT ORDER',
                            style: TextStyle(color: AppColors.white, fontSize: 9, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.navyPrimary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      notice.category.replaceAll('_', ' '),
                      style: const TextStyle(
                        color: AppColors.navyPrimary,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.textMuted),
                ],
              ),
              const SizedBox(height: 10),

              Text(
                notice.title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navyPrimary,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 6),

              Text(
                notice.content,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 10),

              Row(
                children: [
                  const Icon(Icons.access_time, size: 12, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    dateFormatted,
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showNoticeDetails(NoticeModel notice) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (notice.isUrgent)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('PRIORITY NOTICE', style: TextStyle(color: AppColors.white, fontSize: 10, fontWeight: FontWeight.w800)),
              ),
            Text(
              notice.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                notice.content,
                style: const TextStyle(fontSize: 14, color: AppColors.textPrimary, height: 1.5),
              ),
              if (notice.createdAt != null) ...[
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),
                Text(
                  'Issued: ${DateFormat('dd MMMM yyyy, hh:mm a').format(notice.createdAt!)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ],
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('DISMISS'),
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
          children: [
            Icon(Icons.campaign_outlined, size: 48, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 12),
            const Text(
              'No matching notices or circulars',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 4),
            const Text(
              'Official unit orders issued by the ANO and Command HQ will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
