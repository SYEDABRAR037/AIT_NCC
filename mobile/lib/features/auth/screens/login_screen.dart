import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _obscurePassword = true;
  bool _resendingOtp = false;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleLoginSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.initiateLogin(
      _identifierController.text,
      _passwordController.text,
    );
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Authentication failed.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  Future<void> _handleOtpSubmit() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid 6-digit security code.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.verifyLoginOtp(otp);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Invalid verification code.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  Future<void> _handleResendOtp() async {
    setState(() => _resendingOtp = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final sent = await auth.resendOtp();
    if (mounted) {
      setState(() => _resendingOtp = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(sent ? 'A new verification code has been dispatched.' : 'Failed to resend code. Please try again.'),
          backgroundColor: sent ? AppColors.success : AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.navyDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header & Insignia
                _buildHeader(),
                const SizedBox(height: 28),

                // Card Container
                Card(
                  color: AppColors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: auth.otpRequired
                        ? _buildOtpForm(auth)
                        : _buildCredentialsForm(auth),
                  ),
                ),
                const SizedBox(height: 20),

                // Institutional Footer
                const Center(
                  child: Text(
                    'ARMY INSTITUTE OF TECHNOLOGY • NCC UNIT\nNATIONAL CADET CORPS',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.8,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.navyPrimary,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.gold, width: 2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Center(
            child: Icon(
              Icons.shield,
              color: AppColors.gold,
              size: 40,
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'NCC AIT PUNE',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 22,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'DIGITAL COMMAND & CADET MANAGEMENT SYSTEM',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.gold,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }

  Widget _buildCredentialsForm(AuthProvider auth) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Institutional Sign In',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.navyPrimary,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Enter your credentials to access the command portal.',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),

          // Identifier (Regimental / Email)
          TextFormField(
            controller: _identifierController,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              labelText: 'Regimental Number or Email',
              hintText: 'e.g. MH/22/SDA/... or officer email',
              prefixIcon: Icon(Icons.badge_outlined, color: AppColors.navyPrimary),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter your Regimental Number or Email';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Password
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Security Password',
              prefixIcon: const Icon(Icons.lock_outline, color: AppColors.navyPrimary),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  color: AppColors.textSecondary,
                ),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your password';
              }
              return null;
            },
          ),
          const SizedBox(height: 24),

          // Sign In Button
          ElevatedButton(
            onPressed: auth.isLoading ? null : _handleLoginSubmit,
            child: auth.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2.5),
                  )
                : const Text('AUTHENTICATE SESSION'),
          ),
          const SizedBox(height: 16),

          // Notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.backgroundLight,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 16, color: AppColors.navyPrimary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Cadets must sign in using their official Regimental Number. 2-factor OTP verification will be required.',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOtpForm(AuthProvider auth) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.goldLight.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: AppColors.gold),
              ),
              child: const Text(
                'TWO-FACTOR 2FA',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navyDark,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'Security Verification',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.navyPrimary,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Enter the 6-digit security code sent to: ${auth.maskedDestination}',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
        ),
        const SizedBox(height: 20),

        // OTP Code Field
        TextField(
          controller: _otpController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            letterSpacing: 8,
            color: AppColors.navyPrimary,
          ),
          decoration: const InputDecoration(
            counterText: '',
            hintText: '••••••',
            prefixIcon: Icon(Icons.key, color: AppColors.navyPrimary),
          ),
        ),
        const SizedBox(height: 20),

        // Verify Button
        ElevatedButton(
          onPressed: auth.isLoading ? null : _handleOtpSubmit,
          child: auth.isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2.5),
                )
              : const Text('VERIFY & ENTER COMMAND'),
        ),
        const SizedBox(height: 12),

        // Resend & Back actions
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: auth.isLoading ? null : () => auth.cancelOtp(),
              child: const Text(
                'Back to Login',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ),
            TextButton(
              onPressed: _resendingOtp || auth.isLoading ? null : _handleResendOtp,
              child: _resendingOtp
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text(
                      'Resend Code',
                      style: TextStyle(color: AppColors.navyPrimary, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
            ),
          ],
        ),
      ],
    );
  }
}
