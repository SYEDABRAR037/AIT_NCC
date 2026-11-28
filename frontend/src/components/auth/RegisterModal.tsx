import React, { useState } from 'react';
import { X, UserPlus, Shield, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { OTPVerification } from '../common/OTPVerification';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose }) => {
  const { registerCadet, requestRegistrationOtp, verifyRegistrationOtp, resendAuthOtp } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    regimentalNumber: '',
    collegeRollNumber: '',
    email: '',
    phone: '',
    year: 'FE (1st Year)',
    branch: 'Computer Engineering',
    enrollmentDetails: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    password: '',
    confirmPassword: '',
  });

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);


  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailProofId, setEmailProofId] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [activeOtp, setActiveOtp] = useState<{ channel: 'email'; id: string; destination: string; expiresAt: string; serverNow: string } | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSeconds, setOtpSeconds] = useState(0);

  const resetFormState = () => {
    setFormData({
      fullName: '',
      regimentalNumber: '',
      collegeRollNumber: '',
      email: '',
      phone: '',
      year: 'FE (1st Year)',
      branch: 'Computer Engineering',
      enrollmentDetails: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      password: '',
      confirmPassword: '',
    });
    setProfilePhoto(null);
    setPhotoStatus(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmailProofId(''); setVerifiedEmail(false); setActiveOtp(null);
  };

  const handleCloseModal = () => {
    resetFormState();
    onClose();
  };

  const dialogRef = useAccessibleDialog<HTMLDivElement>(isOpen, handleCloseModal);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, onClose]);

  // DEF-FIX: Moved above early return — Rules of Hooks require all hooks unconditionally.
  React.useEffect(() => {
    if (!activeOtp) return;
    const update = () => {
      const ttl = Math.max(0, Math.ceil((new Date(activeOtp.expiresAt).getTime() - new Date(activeOtp.serverNow).getTime()) / 1000));
      setOtpSeconds(ttl);
    };
    update();
    const timer = window.setInterval(() => setOtpSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    const cooldownTimer = window.setInterval(() => setOtpCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => { window.clearInterval(timer); window.clearInterval(cooldownTimer); };
  }, [activeOtp?.expiresAt, activeOtp?.serverNow]);

  // All hooks above — early return safe here (Rules of Hooks satisfied)
  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((old) => ({ ...old, [name]: value }));
    if (name === 'email') { setVerifiedEmail(false); setEmailProofId(''); if (activeOtp?.channel === 'email') setActiveOtp(null); }
  };

  const requestOtp = async () => {
    setOtpError(null); setOtpLoading(true);
    try {
      const result = await requestRegistrationOtp('email', formData.email, formData.fullName);
      if (!result.success) { setOtpError(result.message || 'Unable to send OTP. Please try again.'); return; }
      setActiveOtp({ channel: 'email', id: result.challengeId, destination: result.destination, expiresAt: result.expiresAt, serverNow: result.serverNow });
      setOtpCooldown(30);
    } catch { setOtpError('Could not reach the verification service. Check your connection and try again.'); }
    finally { setOtpLoading(false); }
  };

  const verifyOtp = async (otp: string) => {
    if (!activeOtp) return;
    setOtpError(null); setOtpLoading(true);
    try {
      const result = await verifyRegistrationOtp(activeOtp.channel, activeOtp.id, otp);
      if (!result.success) { setOtpError(result.message || 'Code verification failed.'); return; }
      setEmailProofId(activeOtp.id); setVerifiedEmail(true);
      setActiveOtp(null);
    } catch { setOtpError('Unable to verify code. Please try again.'); }
    finally { setOtpLoading(false); }
  };

  const resendOtp = async () => {
    if (!activeOtp) return false;
    setOtpError(null); setOtpLoading(true);
    try {
      const result = await resendAuthOtp(activeOtp.id, formData.fullName);
      if (!result.success) { setOtpError(result.message || 'Could not confirm OTP delivery. Please try again.'); return false; }
      setActiveOtp({ ...activeOtp, expiresAt: result.expiresAt, serverNow: result.serverNow });
      setOtpCooldown(30); return true;
    } catch { setOtpError('Could not reach the verification service. Check your connection and try again.'); return false; }
    finally { setOtpLoading(false); }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setProfilePhoto(result);
        setPhotoStatus('Profile photo saved successfully.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Password and Confirm Password must match.');
      return;
    }

    if (formData.password.length < 12 || !/[a-z]/.test(formData.password) || !/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password) || !/[^A-Za-z0-9]/.test(formData.password)) {
      setErrorMsg('Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol.');
      return;
    }


    if (!verifiedEmail || !emailProofId) {
      setErrorMsg('Verify your email before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        emailChallengeId: emailProofId,
        profilePhotoUrl: profilePhoto,
        profilePhoto,
      };
      const res = await registerCadet(payload);
      if (res.success) {
        setSuccessMsg(res.message || 'Registration submitted. Your application is under review.');
      } else {
        setErrorMsg(res.message || 'Registration failed. Please check the entered fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-modal-title"
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
          maxWidth: '740px',
          maxHeight: '92vh',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Shield size={20} />
            <h3 id="register-modal-title" style={{ color: 'var(--white-pure)', fontSize: '1.15rem' }}>CADET ENROLLMENT REGISTRATION</h3>
          </div>
          <button
            onClick={handleCloseModal}
            style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer' }}
            aria-label="Close Registration"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
          {/* Success Banner */}
          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              style={{
                backgroundColor: 'var(--color-success-soft)',
                border: '1px solid var(--color-success)',
                color: 'var(--color-success)',
                padding: '1rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  CADET APPLICATION FILED
                </strong>
                <span>{successMsg}</span>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-success)' }}>
                  Your account status is currently <strong>UNDER_REVIEW</strong>. After approval by either your Senior or Platoon Senior, Admin/ANO will complete the final review.
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
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
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div
            style={{
              backgroundColor: 'var(--navy-badge-bg)',
              border: '1px solid var(--navy-badge-border)',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              fontSize: '0.82rem',
              color: 'var(--navy-primary)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              Real PostgreSQL duplicate validation is active on Email, Regimental Number, and College Roll Number.
            </span>
          </div>

          <form onSubmit={handleSubmit} aria-busy={submitting} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-1">
                  FULL NAME (AS PER COLLEGE ID) *
                </label>
                <input id="register-field-1"
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Vikramaditya Rathore"
                  value={formData.fullName}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-2">
                  REGIMENTAL NUMBER *
                </label>
                <input id="register-field-2"
                  type="text"
                  name="regimentalNumber"
                  required
                  placeholder="e.g. MH26SDA109999"
                  value={formData.regimentalNumber}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-3">
                  COLLEGE ROLL NUMBER *
                </label>
                <input id="register-field-3"
                  type="text"
                  name="collegeRollNumber"
                  required
                  placeholder="e.g. 261099"
                  value={formData.collegeRollNumber}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>
            </div>

            {/* Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-4">
                  OFFICIAL EMAIL *
                </label>
                <input id="register-field-4"
                  type="email"
                  name="email"
                  required
                  placeholder="cadet@aitpune.edu.in"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
                <button type="button" disabled={!formData.email || otpLoading || verifiedEmail} onClick={requestOtp} className="btn-secondary" style={{ marginTop: '0.45rem' }}>
                  {verifiedEmail ? '✓ Email Verified' : 'Verify Email'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-5">
                  MOBILE NUMBER *
                </label>
                <input id="register-field-5"
                  type="tel"
                  name="phone"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-6">
                  DATE OF JOINING
                </label>
                <input id="register-field-6"
                  type="date"
                  name="dateOfJoining"
                  value={formData.dateOfJoining}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>
            </div>

            {activeOtp && (
              <OTPVerification
                key={`${activeOtp.id}-${activeOtp.expiresAt}`}
                destination={activeOtp.destination}
                embedded
                heading="Verify Email"
                instruction={`Enter the 6-digit code sent to ${activeOtp.destination}.`}
                expiresInSeconds={otpSeconds}
                verifyDisabled={otpSeconds <= 0}
                onVerify={verifyOtp}
                onResend={resendOtp}
                loading={otpLoading}
                error={otpError}
                cooldown={otpCooldown}
              />
            )}
            {otpError && !activeOtp && <p role="alert" style={{ color: 'var(--color-error)' }}>{otpError}</p>}
            <p aria-live="polite" style={{ margin: 0, fontSize: '0.85rem', color: verifiedEmail ? 'var(--color-success)' : 'var(--color-muted)' }}>
              {verifiedEmail ? '✓ Email verified' : 'Email verification required.'}
            </p>

            {/* Academic & Branch Allocation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-7">
                  ACADEMIC YEAR *
                </label>
                <select id="register-field-7"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                >
                  <option value="FE (1st Year)">FE (1st Year)</option>
                  <option value="SE (2nd Year)">SE (2nd Year)</option>
                  <option value="TE (3rd Year)">TE (3rd Year)</option>
                  <option value="BE (4th Year)">BE (4th Year)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-8">
                  ENGINEERING BRANCH *
                </label>
                <select id="register-field-8"
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                >
                  <option value="Computer Engineering">Computer Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Robotics & Automation">Robotics & Automation</option>
                </select>
              </div>
            </div>

            {/* Profile Photo Upload */}
            <div>
              <label htmlFor="register-field-9" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                CADET UNIFORM / PROFILE PHOTO
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '4px',
                    border: '1px dashed var(--navy-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundColor: 'var(--white-surface)',
                  }}
                >
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile photo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Camera size={24} style={{ color: 'var(--navy-text-muted)' }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <input
                    id="register-field-9"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ fontSize: '0.85rem' }}
                  />
                  {photoStatus && (
                    <span role="status" aria-live="polite" style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>
                      ✓ {photoStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Enrollment Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-10">
                NCC ENROLLMENT DETAILS & PRIOR CERTIFICATES (A / B / C)
              </label>
              <textarea id="register-field-10"
                name="enrollmentDetails"
                rows={2}
                placeholder="Mention previous NCC experience, schooling certificates (NCC A Certificate), sports honours, or blood group..."
                value={formData.enrollmentDetails}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-11">
                  ACCOUNT PASSWORD *
                </label>
                <input id="register-field-11"
                  type="password"
                  name="password"
                  minLength={12}
                  maxLength={72}
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-12">
                  CONFIRM PASSWORD *
                </label>
                <input id="register-field-12"
                  type="password"
                  name="confirmPassword"
                  minLength={12}
                  maxLength={72}
                  required
                  placeholder="••••••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>
            </div>

            <div role="note" style={{ backgroundColor: 'var(--navy-badge-bg)', border: '1px solid var(--navy-badge-border)', borderRadius: '6px', padding: '1rem', color: 'var(--navy-primary)' }}>
              <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Biometric enrollment is optional</strong>
              <span style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                Face capture is not part of registration. After your account is approved, NCC staff may offer a separate enrollment process. Declining biometric enrollment does not affect your application, normal portal access, or manual attendance.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !verifiedEmail}
                className="btn-primary"
                style={{
                  opacity: !verifiedEmail ? 0.65 : 1,
                  cursor: !verifiedEmail ? 'not-allowed' : 'pointer',
                }}
                title={!verifiedEmail ? 'Verify your email before submitting' : ''}
              >
                <UserPlus size={16} />
                <span>{submitting ? 'VALIDATING WITH DATABASE...' : 'SUBMIT APPLICATION'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
