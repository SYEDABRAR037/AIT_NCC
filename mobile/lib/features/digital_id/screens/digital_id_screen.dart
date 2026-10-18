import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/constants/app_colors.dart';
import '../models/digital_id_model.dart';
import '../providers/digital_id_provider.dart';

class DigitalIdScreen extends StatefulWidget {
  const DigitalIdScreen({super.key});

  @override
  State<DigitalIdScreen> createState() => _DigitalIdScreenState();
}

class _DigitalIdScreenState extends State<DigitalIdScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<DigitalIdProvider>(context, listen: false);
      if (provider.digitalId == null) {
        provider.fetchDigitalId();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DigitalIdProvider>();

    if (provider.isLoading && provider.digitalId == null) {
      return const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary));
    }

    if (provider.errorMessage != null && provider.digitalId == null) {
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
                onPressed: () => provider.fetchDigitalId(),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('RETRY'),
              ),
            ],
          ),
        ),
      );
    }

    final cadet = provider.digitalId;
    if (cadet == null) {
      return const Center(child: Text('No Digital ID available.'));
    }

    return RefreshIndicator(
      onRefresh: () => provider.fetchDigitalId(),
      color: AppColors.navyPrimary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            _buildIdCard(cadet),
            const SizedBox(height: 20),
            _buildSecurityNotice(cadet),
          ],
        ),
      ),
    );
  }

  Widget _buildIdCard(DigitalIdModel cadet) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.gold, width: 1.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Institutional Top Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.navyPrimary,
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.shield, color: AppColors.navyDark, size: 18),
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'NATIONAL CADET CORPS',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                        ),
                      ),
                      Text(
                        'ARMY INSTITUTE OF TECHNOLOGY, PUNE',
                        style: TextStyle(
                          color: AppColors.gold,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'ACTIVE',
                    style: TextStyle(color: AppColors.white, fontSize: 9, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),

          // Tri-Color Band (NCC Colors)
          Row(
            children: [
              Expanded(child: Container(height: 4, color: AppColors.error)),
              Expanded(child: Container(height: 4, color: AppColors.navyPrimary)),
              Expanded(child: Container(height: 4, color: AppColors.info)),
            ],
          ),

          // Main Card Body
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              children: [
                // Avatar + Rank + Name
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.navyPrimary,
                  child: CircleAvatar(
                    radius: 34,
                    backgroundColor: AppColors.backgroundLight,
                    child: Text(
                      cadet.fullName.isNotEmpty ? cadet.fullName[0] : 'C',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: AppColors.navyPrimary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.navyPrimary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    cadet.rank,
                    style: const TextStyle(color: AppColors.gold, fontSize: 11, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(height: 8),

                Text(
                  cadet.fullName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    color: AppColors.navyPrimary,
                  ),
                ),
                const SizedBox(height: 4),

                Text(
                  cadet.regimentalNumber,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 16),

                const Divider(),
                const SizedBox(height: 14),

                // Cadet Details Grid
                _buildInfoRow('Platoon', cadet.platoonName ?? 'Unit Platoon'),
                const SizedBox(height: 8),
                _buildInfoRow('College Roll', cadet.collegeRollNumber ?? 'N/A'),
                const SizedBox(height: 8),
                _buildInfoRow('Academic Year', cadet.year ?? 'N/A'),
                const SizedBox(height: 16),

                // Cryptographic QR Code Container
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.navyBorder.withValues(alpha: 0.3)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      QrImageView(
                        data: cadet.token.isNotEmpty ? cadet.token : cadet.regimentalNumber,
                        version: QrVersions.auto,
                        size: 150.0,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: AppColors.navyDark,
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: AppColors.navyDark,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'SCAN FOR MUSTER VERIFICATION',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textSecondary,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Bottom Security Stripe
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            color: AppColors.backgroundLight,
            child: const Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.verified, size: 14, color: AppColors.success),
                  SizedBox(width: 6),
                  Text(
                    'OFFICIALLY ISSUED DIGITAL IDENTITY • TAMPER PROTECTED',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textSecondary,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
        ),
        Text(
          value,
          style: const TextStyle(fontSize: 13, color: AppColors.navyPrimary, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }

  Widget _buildSecurityNotice(DigitalIdModel cadet) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.security, size: 20, color: AppColors.navyPrimary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Institutional Security Policy',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.navyPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  'Present this digital credential to the Drill Instructor or Platoon Senior during roll call and camp muster. Token: ${cadet.token.isNotEmpty ? cadet.token.substring(0, 8) : "N/A"}...',
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
