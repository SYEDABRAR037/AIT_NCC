import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/app_colors.dart';
import '../providers/auth_provider.dart';

class PasswordRecoveryScreen extends StatefulWidget {
  const PasswordRecoveryScreen({super.key});

  @override
  State<PasswordRecoveryScreen> createState() => _PasswordRecoveryScreenState();
}

class _PasswordRecoveryScreenState extends State<PasswordRecoveryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _regimentalController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  int _step = 0;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _emailController.dispose();
    _regimentalController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final accepted = await auth.requestPasswordRecovery(
      email: _emailController.text,
      regimentalNumber: _regimentalController.text,
    );
    if (accepted && mounted) setState(() => _step = 1);
  }

  Future<void> _resendCode() async {
    final auth = context.read<AuthProvider>();
    final accepted = await auth.resendPasswordRecoveryOtp();
    if (!mounted) return;
    if (accepted) {
      _otpController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('The server accepted a new code for dispatch.'),
        ),
      );
    }
  }

  Future<void> _verifyCode() async {
    if (!_formKey.currentState!.validate()) return;
    final accepted = await context
        .read<AuthProvider>()
        .verifyPasswordRecoveryOtp(_otpController.text);
    if (accepted && mounted) setState(() => _step = 2);
  }

  Future<void> _savePassword() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final saved = await auth.resetPassword(
      newPassword: _passwordController.text,
      confirmPassword: _confirmController.text,
    );
    if (saved && mounted) setState(() => _step = 3);
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Enter your registered email address.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      backgroundColor: AppColors.backgroundLight,
      appBar: AppBar(title: const Text('Password recovery')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Card(
                color: AppColors.white,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _title,
                          style: const TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navyPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _description(auth),
                          style: const TextStyle(
                            height: 1.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (auth.errorMessage != null) ...[
                          Semantics(
                            liveRegion: true,
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.errorLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                auth.errorMessage!,
                                style: const TextStyle(color: AppColors.error),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        if (_step == 0) _requestFields(),
                        if (_step == 1) _otpFields(auth),
                        if (_step == 2) _passwordFields(),
                        if (_step == 3) _completeState(),
                        const SizedBox(height: 20),
                        if (_step < 3)
                          FilledButton(
                            onPressed: auth.isLoading ? null : _primaryAction,
                            child: auth.isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.white,
                                    ),
                                  )
                                : Text(_primaryLabel),
                          ),
                        if (_step == 3)
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(true),
                            child: const Text('Return to sign in'),
                          ),
                        if (_step == 1)
                          TextButton(
                            onPressed: auth.isLoading ? null : _resendCode,
                            child: const Text('Request another code'),
                          ),
                        if (_step == 1 || _step == 2)
                          TextButton(
                            onPressed: auth.isLoading
                                ? null
                                : () {
                                    auth.clearPasswordRecovery();
                                    setState(() => _step = 0);
                                  },
                            child: const Text('Start over'),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String get _title => switch (_step) {
    0 => 'Request a verification code',
    1 => 'Verify your code',
    2 => 'Choose a new password',
    _ => 'Password updated',
  };

  String _description(AuthProvider auth) => switch (_step) {
    0 =>
      'Enter the email address and regimental number registered to your account.',
    1 =>
      'Enter the six-digit code sent to ${auth.recoveryMaskedEmail ?? 'your registered email'}. The code expires shortly.',
    2 =>
      'The code was verified by the server. Choose a new password for your account.',
    _ =>
      'The server confirmed the password change. You can now sign in with your new password.',
  };

  String get _primaryLabel => switch (_step) {
    0 => 'Send verification code',
    1 => 'Verify code',
    _ => 'Update password',
  };

  VoidCallback get _primaryAction => switch (_step) {
    0 => _requestCode,
    1 => _verifyCode,
    _ => _savePassword,
  };

  Widget _requestFields() => Column(
    children: [
      TextFormField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        autofillHints: const [AutofillHints.email],
        decoration: const InputDecoration(
          labelText: 'Registered email',
          prefixIcon: Icon(Icons.email_outlined),
        ),
        validator: _validateEmail,
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _regimentalController,
        textCapitalization: TextCapitalization.characters,
        decoration: const InputDecoration(
          labelText: 'Regimental number',
          prefixIcon: Icon(Icons.badge_outlined),
        ),
        validator: (value) => value == null || value.trim().isEmpty
            ? 'Enter your regimental number.'
            : null,
      ),
    ],
  );

  Widget _otpFields(AuthProvider auth) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (auth.recoveryExpiresAt != null)
        Text(
          'Expires at ${auth.recoveryExpiresAt!.toLocal().toString().substring(0, 16)}',
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
      const SizedBox(height: 10),
      TextFormField(
        controller: _otpController,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        textAlign: TextAlign.center,
        autofillHints: const [AutofillHints.oneTimeCode],
        style: const TextStyle(
          fontSize: 22,
          letterSpacing: 8,
          fontWeight: FontWeight.w700,
        ),
        decoration: const InputDecoration(
          labelText: 'Six-digit code',
          prefixIcon: Icon(Icons.password_outlined),
        ),
        validator: (value) =>
            value == null || !RegExp(r'^\d{6}$').hasMatch(value)
            ? 'Enter all six digits.'
            : null,
      ),
    ],
  );

  Widget _passwordFields() => Column(
    children: [
      TextFormField(
        controller: _passwordController,
        obscureText: _obscurePassword,
        autofillHints: const [AutofillHints.newPassword],
        decoration: InputDecoration(
          labelText: 'New password',
          prefixIcon: const Icon(Icons.lock_outline),
          suffixIcon: IconButton(
            tooltip: _obscurePassword ? 'Show password' : 'Hide password',
            onPressed: () =>
                setState(() => _obscurePassword = !_obscurePassword),
            icon: Icon(
              _obscurePassword
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
            ),
          ),
        ),
        validator: (value) => value == null || value.length < 6
            ? 'Use at least 6 characters.'
            : null,
      ),
      const SizedBox(height: 14),
      TextFormField(
        controller: _confirmController,
        obscureText: _obscureConfirm,
        decoration: InputDecoration(
          labelText: 'Confirm new password',
          prefixIcon: const Icon(Icons.lock_outline),
          suffixIcon: IconButton(
            tooltip: _obscureConfirm ? 'Show password' : 'Hide password',
            onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
            icon: Icon(
              _obscureConfirm
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
            ),
          ),
        ),
        validator: (value) => value != _passwordController.text
            ? 'Passwords do not match.'
            : null,
      ),
    ],
  );

  Widget _completeState() => const Row(
    children: [
      Icon(Icons.check_circle_outline, color: AppColors.success),
      SizedBox(width: 10),
      Expanded(child: Text('Password change confirmed by the server.')),
    ],
  );
}
