import React, { useState } from 'react';
import { X, LogIn, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setErrorMsg(null);
      setAccountStatus(null);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAccountStatus(null);
    setSubmitting(true);

    try {
      const res = await login(identifier, password);
      if (res.success && res.user) {
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

  const handleQuickFill = (email: string, pass: string) => {
    setIdentifier(email);
    setPassword(pass);
    setErrorMsg(null);
    setAccountStatus(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 11, 23, 0.75)',
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
            <h3 style={{ color: 'var(--white-pure)', fontSize: '1.15rem' }}>COMMAND PORTAL LOGIN</h3>
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
          {errorMsg && (
            <div
              style={{
                backgroundColor: accountStatus === 'UNDER_REVIEW' ? '#FEF3C7' : '#FEE2E2',
                border: accountStatus === 'UNDER_REVIEW' ? '1px solid #F59E0B' : '1px solid #EF4444',
                color: accountStatus === 'UNDER_REVIEW' ? '#92400E' : '#B91C1C',
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                REGIMENTAL NUMBER / OFFICIAL EMAIL / ROLL NO *
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. MH24SDA100303 or active.cadet@aitpune.edu.in"
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
                PASSWORD *
              </label>
              <input
                type="password"
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
                  outline: 'none',
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
          </form>

          {/* Official Institutional Leadership Command Helper */}
          <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--white-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--navy-hover)', letterSpacing: '0.08em', marginBottom: '0.65rem' }}>
              OFFICIAL COMMAND ACCESS:
            </div>
            <div>
              <button
                type="button"
                className="shells-item"
                style={{ width: '100%', fontSize: '0.8rem', border: '1px solid var(--white-border)', padding: '0.6rem', textAlign: 'center', background: 'var(--white-surface)' }}
                onClick={() => handleQuickFill('ano.admin@aitpune.edu.in', 'AdminCommand@2026')}
              >
                <span>🛡️ Quick-fill ANO / Admin Credentials (Lt. Col. Sanjeev Sharma)</span>
              </button>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--navy-text-muted)', marginTop: '0.65rem', textAlign: 'center', lineHeight: '1.4' }}>
              New Cadets & Appointees: Please register via <strong>Cadet Registration</strong>. Credentials activate once approved by the ANO Command.
            </div>
          </div>
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
