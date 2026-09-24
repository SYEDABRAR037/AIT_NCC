import React, { useState, useEffect } from 'react';
import { X, Shield, Mail, KeyRound, AlertCircle, CheckCircle2, RotateCw, ArrowLeft } from 'lucide-react';
import { safeApiFetch } from '../../utils/api';

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
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Timers and UI states
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes
  const [resendCooldown, setResendCooldown] = useState(0); // 45s cooldown
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

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
      setOtp('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setTimerSeconds(300);
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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

      if (ok && data?.success) {
        setRecoveryId(data.recoveryId);
        setMaskedEmail(data.maskedEmail || email.trim());
        setTimerSeconds(data.expiresInSeconds || 300);
        setResendCooldown(45);
        setStep('OTP');
      } else {
        setErrorMsg(data?.message || 'Unable to verify the provided account details.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Institutional recovery service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Resend OTP (Phase 17)
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMsg(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const { ok, data } = await safeApiFetch('/api/auth/recovery/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ recoveryId }),
      });

      if (ok && data?.success) {
        setRecoveryId(data.recoveryId);
        setMaskedEmail(data.maskedEmail || maskedEmail);
        setTimerSeconds(data.expiresInSeconds || 300);
        setResendCooldown(45);
        setOtp('');
        setSuccessNotice('A fresh verification code has been dispatched.');
      } else {
        setErrorMsg(data?.message || 'Failed to resend OTP. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP (Phase 14, 15, 16)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (otp.trim().length !== 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

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
          otp: otp.trim(),
        }),
      });

      if (ok && data?.success) {
        setResetToken(data.resetToken);
        setStep('NEW_PASSWORD');
      } else {
        setErrorMsg(data?.message || 'Invalid OTP. Please check the code and try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP verification failed. Please try again.');
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

      if (ok && data?.success) {
        setStep('SUCCESS');
      } else {
        setErrorMsg(data?.message || 'Password reset failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 11, 23, 0.8)',
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
            borderBottom: '3px solid var(--gold-accent, #C59A27)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <KeyRound size={20} color="var(--gold-accent, #C59A27)" />
            <h3 style={{ color: 'var(--white-pure)', fontSize: '1.05rem', margin: 0, letterSpacing: '0.04em' }}>
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
              style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #EF4444',
                color: '#B91C1C',
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
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #10B981',
                color: '#065F46',
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
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  REGISTERED EMAIL ID *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
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
                      outline: 'none',
                    }}
                  />
                  <Mail size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  REGIMENTAL NUMBER *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
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
                      outline: 'none',
                    }}
                  />
                  <Shield size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
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
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.85rem', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', lineHeight: '1.45' }}>
                  We have sent a 6-digit verification OTP to your registered email address:
                </p>
                <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--navy-primary)', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                  {maskedEmail}
                </strong>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                    ENTER 6-DIGIT OTP *
                  </label>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: timerSeconds < 60 ? '#DC2626' : '#D97706',
                      fontFamily: 'monospace',
                    }}
                  >
                    OTP valid for: {formatTimer(timerSeconds)}
                  </span>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="_ _ _ _ _ _"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '4px',
                    border: '2px solid var(--navy-primary)',
                    fontSize: '1.4rem',
                    textAlign: 'center',
                    letterSpacing: '0.35em',
                    fontWeight: 800,
                    color: 'var(--navy-primary)',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || timerSeconds <= 0}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
              >
                {loading ? 'VERIFYING CODE...' : 'VERIFY OTP'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--white-border)' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Didn't receive the OTP?</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendCooldown > 0 ? '#94A3B8' : 'var(--navy-hover)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>
                    {resendCooldown > 0 ? `RESEND OTP (${resendCooldown}s)` : 'RESEND OTP'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Reset Password */}
          {step === 'NEW_PASSWORD' && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                OTP verified successfully. Create a strong new password for your cadet command account.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  NEW PASSWORD *
                </label>
                <input
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
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  CONFIRM NEW PASSWORD *
                </label>
                <input
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
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', fontWeight: 700 }}
              >
                {loading ? 'UPDATING CREDENTIALS...' : 'RESET PASSWORD'}
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
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
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
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem', color: '#64748B', lineHeight: '1.5' }}>
                Your institutional credentials have been securely updated in the production database. You may now log in using your new password.
              </p>
              <button
                type="button"
                onClick={onBackToLogin}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
              >
                GO TO LOGIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
