import React, { useState } from 'react';
import { X, LogIn, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { OTPVerification } from '../common/OTPVerification';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login, verifyLoginOtp, resendAuthOtp } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [loginOtp, setLoginOtp] = useState<{ id: string; destination: string; expiresAt: string; serverNow: string } | null>(null);
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(30);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(isOpen, onClose);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setAccountStatus(null);
      setLoginOtp(null);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAccountStatus(null);
    setSubmitting(true);

    try {
      const res = await login(identifier, password);
      if (res.success && res.otpRequired && res.challengeId && res.destination && res.expiresAt && res.serverNow) {
        setLoginOtp({ id: res.challengeId, destination: res.destination, expiresAt: res.expiresAt, serverNow: res.serverNow });
        setOtpCooldown(30);
      } else if (res.success && res.user) {
        onLoginSuccess(res.user.role);
        onClose();
      } else {
        setAccountStatus(res.status || null);
        setErrorMsg(res.message || 'Authentication rejected.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!loginOtp) return;
    const ttl = Math.max(0, Math.ceil((new Date(loginOtp.expiresAt).getTime() - new Date(loginOtp.serverNow).getTime()) / 1000));
    setOtpSeconds(ttl);
    const timer = window.setInterval(() => setOtpSeconds((value) => Math.max(0, value - 1)), 1000);
    const cooldown = window.setInterval(() => setOtpCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => { window.clearInterval(timer); window.clearInterval(cooldown); };
  }, [loginOtp?.expiresAt, loginOtp?.serverNow]);

  const handleLoginOtp = async (otp: string) => {
    if (!loginOtp) return;
    setErrorMsg(null); setSubmitting(true);
    try {
      const result = await verifyLoginOtp(loginOtp.id, otp);
      if (!result.success || !result.user) { setErrorMsg(result.message || 'Code verification failed.'); return; }
      onLoginSuccess(result.user.role); onClose();
    } finally { setSubmitting(false); }
  };

  const resendLoginOtp = async () => {
    if (!loginOtp) return false;
    const result = await resendAuthOtp(loginOtp.id);
    if (!result.success) { setErrorMsg(result.message || 'Unable to resend OTP.'); return false; }
    setLoginOtp({ ...loginOtp, expiresAt: result.expiresAt, serverNow: result.serverNow });
    setOtpCooldown(30); return true;
  };


  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 26, 51, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
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
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            backgroundColor: 'var(--navy-primary)',
            color: 'var(--white-pure)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Shield size={20} />
            <h3 id="login-modal-title" style={{ color: 'var(--white-pure)', fontSize: '1.15rem' }}>COMMAND PORTAL LOGIN</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer' }}
            aria-label="Close Login Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {/* Status Message Display */}
          {errorMsg && !loginOtp && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                backgroundColor: accountStatus === 'UNDER_REVIEW' ? 'var(--color-warning-soft)' : 'var(--color-error-soft)',
                border: accountStatus === 'UNDER_REVIEW' ? '1px solid var(--color-gold)' : '1px solid var(--color-error)',
                color: accountStatus === 'UNDER_REVIEW' ? 'var(--color-primary)' : 'var(--color-error)',
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
                {accountStatus && (
                  <strong style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                    STATUS: {accountStatus.replace('_', ' ')}
                  </strong>
                )}
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {loginOtp ? (
            <OTPVerification key={`${loginOtp.id}-${loginOtp.expiresAt}`} destination={loginOtp.destination} heading="Verify your identity" instruction={`Enter the 6-digit code sent to ${loginOtp.destination}.`} expiresInSeconds={otpSeconds} verifyDisabled={otpSeconds <= 0} onVerify={handleLoginOtp} onResend={resendLoginOtp} loading={submitting} error={errorMsg} cooldown={otpCooldown} />
          ) : <form onSubmit={handleSubmit} aria-busy={submitting} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="login-identifier" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                REGIMENTAL NUMBER *
              </label>
              <input
                type="text"
                id="login-identifier"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. MH24SDA100303"
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
              <label htmlFor="login-password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                PASSWORD *
              </label>
              <input
                type="password"
                id="login-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.7rem 0.85rem',
                  borderRadius: '4px',
                  border: '1px solid var(--white-border)',
                  fontSize: '0.92rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.35rem' }}>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--navy-hover)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '0.2rem 0',
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
              <LogIn size={16} />
              <span>{submitting ? 'AUTHENTICATING...' : 'AUTHENTICATE & ENTER'}</span>
            </button>
          </form>}

        </div>
      </div>

      {/* Forgot Password OTP Recovery Modal (Phases 8-19) */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onBackToLogin={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
