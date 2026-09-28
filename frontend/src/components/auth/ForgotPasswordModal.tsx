import React, { useState, useEffect } from 'react';
import { X, Shield, Mail, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { safeApiFetch } from '../../utils/api';
import { OTPVerification } from '../common/OTPVerification';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onBackToLogin,
}) => {
  // Step 1: 'IDENTIFY', Step 2: 'OTP', Step 3: 'NEW_PASSWORD', Step 4: 'SUCCESS'
  const [step, setStep] = useState<'IDENTIFY' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS'>('IDENTIFY');

  // Form states
  const [email, setEmail] = useState('');
  const [regimentalNumber, setRegimentalNumber] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Timers and UI states
  const [timerSeconds, setTimerSeconds] = useState(60); // 60 seconds
  const [resendCooldown, setResendCooldown] = useState(0); // 45s cooldown
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(isOpen, onClose);

  const maskEmailAddress = (address: string) => {
    const [localPart, domain] = address.split('@');
    if (!localPart || !domain) return 'your registered email address';
    return `${localPart[0]}${'*'.repeat(Math.max(3, localPart.length - 1))}@${domain}`;
  };

  const otpErrorMessage = (message: unknown, fallback: string) => {
    const text = typeof message === 'string' ? message : '';
    if (/too many|attempt limit|maximum.*attempt/i.test(text)) {
      return 'Too many attempts. Please request a new verification code.';
    }
    if (/expired/i.test(text)) return 'This verification code has expired. Please request a new one.';
    if (/invalid.*(otp|verification)|(?:otp|verification code).*invalid/i.test(text)) {
      return 'Invalid verification code. Please try again.';
    }
    const cooldown = text.match(/please wait\s+(\d+)\s+seconds?/i);
    if (cooldown) return `Please wait ${cooldown[1]} seconds before requesting another code.`;
    return fallback;
  };

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessNotice(null);
    } else {
      setStep('IDENTIFY');
      setEmail('');
      setRegimentalNumber('');
      setRecoveryId('');
      setMaskedEmail('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setTimerSeconds(60);
      setResendCooldown(0);
    }
  }, [isOpen]);

  // OTP Expiry Countdown (5 mins)
  useEffect(() => {
    let interval: any;
    if (isOpen && step === 'OTP' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, step, timerSeconds]);

  // Resend Cooldown Countdown
  useEffect(() => {
    let interval: any;
    if (isOpen && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  // 1. Request OTP (Phase 8, 9)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const { ok, data } = await safeApiFetch('/api/auth/recovery/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          regimentalNumber: regimentalNumber.trim(),
        }),
      });

      const isSuccessful =
        ok &&
        (data?.success === true ||
          data?.otpSent === true ||
          data?.nextStep === 'VERIFY_OTP' ||
          data?.status === 'OTP_SENT' ||
          Boolean(data?.recoveryId) ||
          Boolean(data?.verificationId));

      if (isSuccessful) {
        const id = data?.recoveryId || data?.verificationId || '';
        const masked = data?.maskedEmail || maskEmailAddress(email.trim());
        const seconds = Number(data?.expiresInSeconds) || 60;
        setRecoveryId(id);
        setMaskedEmail(masked);
        setTimerSeconds(seconds);
        setResendCooldown(45);
        setLoading(false);
        setStep('OTP');
      } else {
        setErrorMsg(data?.message || 'Unable to verify the provided account details.');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('too long') || msg.includes('timed out') || msg.includes('AbortError')) {
        setErrorMsg('Account recovery service is taking too long to respond. Please try again.');
      } else if (msg.includes('returned HTML') || msg.includes('Failed to parse') || msg.includes('failed to fetch') || msg.includes('504')) {
        setErrorMsg('Unable to contact the account recovery service. Please try again.');
      } else {
        setErrorMsg(msg || 'Unable to contact the account recovery service. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Resend OTP (Phase 17)
  const handleResendOtp = async (): Promise<boolean> => {
    if (resendCooldown > 0 || loading) return false;
    setErrorMsg(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const { ok, data } = await safeApiFetch('/api/auth/recovery/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ recoveryId }),
      });

      const isSuccessful =
        ok &&
        (data?.success === true ||
          data?.otpSent === true ||
          data?.nextStep === 'VERIFY_OTP' ||
          data?.status === 'OTP_SENT' ||
          Boolean(data?.recoveryId) ||
          Boolean(data?.verificationId));

      if (isSuccessful) {
        const id = data?.recoveryId || data?.verificationId || recoveryId;
        const masked = data?.maskedEmail || maskedEmail;
        const seconds = Number(data?.expiresInSeconds) || 60;
        setRecoveryId(id);
        setMaskedEmail(masked);
        setTimerSeconds(seconds);
        setResendCooldown(45);
        setSuccessNotice('A fresh verification code has been dispatched.');
        return true;
      } else {
        setErrorMsg(otpErrorMessage(data?.message, 'Unable to resend the verification code. Please try again.'));
        return false;
      }
    } catch (err: any) {
      const msg = err?.message || '';
      setErrorMsg(otpErrorMessage(msg, 'Unable to resend the verification code. Please try again.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP (Phase 14, 15, 16)
  const handleVerifyOtp = async (otpValue: string) => {
    setErrorMsg(null);
    setSuccessNotice(null);

    if (timerSeconds <= 0) {
      setErrorMsg('The verification OTP has expired. Please request a new one.');
      return;
    }

    setLoading(true);

    try {
      const { ok, data } = await safeApiFetch('/api/auth/recovery/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          recoveryId,
          otp: otpValue.trim(),
        }),
      });

      const isSuccessful =
        ok &&
        (data?.success === true ||
          data?.verified === true ||
          data?.nextStep === 'RESET_PASSWORD' ||
          data?.status === 'OTP_VERIFIED' ||
          Boolean(data?.resetToken));

      if (isSuccessful) {
        setResetToken(data?.resetToken || '');
        setLoading(false);
        setStep('NEW_PASSWORD');
      } else {
        setErrorMsg(otpErrorMessage(data?.message, 'Unable to verify the code. Please try again.'));
      }
    } catch (err: any) {
      const msg = err?.message || '';
      setErrorMsg(otpErrorMessage(msg, 'Unable to verify the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // 4. Reset Password (Phase 18, 19)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const { ok, data } = await safeApiFetch('/api/auth/recovery/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });

      const isSuccessful =
        ok &&
        (data?.success === true ||
          data?.passwordReset === true ||
          data?.nextStep === 'LOGIN' ||
          data?.status === 'PASSWORD_RESET_SUCCESS');

      if (isSuccessful) {
        setLoading(false);
        setStep('SUCCESS');
      } else {
        const rawMsg = data?.message || '';
        if (rawMsg.includes('column') || rawMsg.includes('relation') || rawMsg.includes('database') || rawMsg.includes('SQL')) {
          setErrorMsg('Unable to reset your password right now. Please try again.');
        } else {
          setErrorMsg(rawMsg || 'Unable to reset your password right now. Please try again.');
        }
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('returned HTML') || msg.includes('Failed to parse')) {
        setErrorMsg('Account recovery service is temporarily unavailable. Please try again.');
      } else {
        setErrorMsg('Unable to reset your password right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 26, 51, 0.8)',
        backdropFilter: 'blur(5px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--white-pure)',
          border: '2px solid var(--navy-primary)',
          borderRadius: '6px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--navy-primary)',
            color: 'var(--white-pure)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px solid var(--gold-accent, var(--color-gold))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <KeyRound size={20} color="var(--gold-accent, var(--color-gold))" />
            <h3 id="recovery-modal-title" style={{ color: 'var(--white-pure)', fontSize: '1.05rem', margin: 0, letterSpacing: '0.04em' }}>
              {step === 'IDENTIFY' && 'ACCOUNT RECOVERY'}
              {step === 'OTP' && 'VERIFY OTP'}
              {step === 'NEW_PASSWORD' && 'RESET PASSWORD'}
              {step === 'SUCCESS' && 'CREDENTIALS UPDATED'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer' }}
            aria-label="Close Recovery Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Error Message Display */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                backgroundColor: 'var(--color-error-soft)',
                border: '1px solid var(--color-error)',
                color: 'var(--color-error)',
                padding: '0.85rem 1rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  RECOVERY NOTICE
                </strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Success Notification */}
          {successNotice && (
            <div
              role="status"
              aria-live="polite"
              style={{
                backgroundColor: 'var(--color-success-soft)',
                border: '1px solid var(--color-success)',
                color: 'var(--color-success)',
                padding: '0.85rem 1rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successNotice}</span>
            </div>
          )}

          {/* STEP 1: Identification (Email + Regimental Number) */}
          {step === 'IDENTIFY' && (
            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--navy-text-muted)', lineHeight: '1.45' }}>
                Please provide both institutional identifiers linked to your cadet account to receive a secure one-time password (OTP).
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }} htmlFor="forgotpassword-field-1">
                  REGISTERED EMAIL ID *
                </label>
                <div style={{ position: 'relative' }}>
                  <input id="forgotpassword-field-1"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. cadet.name@aitpune.edu.in"
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.85rem 0.7rem 2.4rem',
                      borderRadius: '4px',
                      border: '1px solid var(--white-border)',
                      fontSize: '0.92rem',
                    }}
                  />
                  <Mail size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }} htmlFor="forgotpassword-field-2">
                  REGIMENTAL NUMBER *
                </label>
                <div style={{ position: 'relative' }}>
                  <input id="forgotpassword-field-2"
                    type="text"
                    required
                    value={regimentalNumber}
                    onChange={(e) => setRegimentalNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH24SDA100303"
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.85rem 0.7rem 2.4rem',
                      borderRadius: '4px',
                      border: '1px solid var(--white-border)',
                      fontSize: '0.92rem',
                      textTransform: 'uppercase',
                    }}
                  />
                  <Shield size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', fontWeight: 700 }}
              >
                {loading ? 'VERIFYING IDENTIFIERS...' : 'CONFIRM & SEND OTP'}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--navy-hover)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  marginTop: '0.25rem',
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Login</span>
              </button>
            </form>
          )}

          {/* STEP 2: OTP Verification */}
          {step === 'OTP' && (
            <OTPVerification
              destination={maskedEmail}
              expiresInSeconds={timerSeconds}
              verifyDisabled={timerSeconds <= 0}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => setStep('IDENTIFY')}
              loading={loading}
              error={errorMsg}
              cooldown={resendCooldown}
            />
          )}

          {/* STEP 3: Reset Password */}
          {step === 'NEW_PASSWORD' && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                OTP verified successfully. Create a strong new password for your cadet command account.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }} htmlFor="forgotpassword-field-3">
                  NEW PASSWORD *
                </label>
                <input id="forgotpassword-field-3"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.92rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }} htmlFor="forgotpassword-field-4">
                  CONFIRM NEW PASSWORD *
                </label>
                <input id="forgotpassword-field-4"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.92rem',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', fontWeight: 700 }}
              >
                {loading ? 'RESETTING PASSWORD...' : 'RESET PASSWORD'}
              </button>
            </form>
          )}

          {/* STEP 4: Success Notice (Phase 19) */}
          {step === 'SUCCESS' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-soft)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem auto',
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--navy-primary)', fontSize: '1.2rem' }}>
                Password Reset Successfully!
              </h4>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                Your institutional credentials have been securely updated in the production database. You may now log in using your new password.
              </p>
              <button
                type="button"
                onClick={onBackToLogin}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
              >
                CONTINUE TO LOGIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
