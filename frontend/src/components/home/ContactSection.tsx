import React, { useState, useEffect } from 'react';
import { MapPin, Mail, Phone, Clock, CheckCircle2, AlertCircle, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/api';

interface ContactSectionProps {
  onOpenLogin?: () => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({ onOpenLogin }) => {
  const { user, token } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{ inquiryId: string; subject: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [institutionalInfo, setInstitutionalInfo] = useState<{ address: string; email: string; phone: string; timings: string }>({ address: '', email: '', phone: '', timings: '' });

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/public/institutional-info`).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.success && data.info) setInstitutionalInfo({ address: data.info.address || '', email: data.info.email || '', phone: data.info.phone || '', timings: data.info.timings || '' }); }).catch(() => undefined);
  }, []);

  // Auto-populate when user is logged in
  useEffect(() => {
    if (user) {
      const rankPrefix = user.role === 'CADET' ? 'CDT ' : '';
      setFullName(`${rankPrefix}${user.fullName}`);
      setEmail(user.email);
    } else {
      setFullName('');
      setEmail('');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user || !token) {
      if (onOpenLogin) {
        onOpenLogin();
      } else {
        alert('Authentication required. Please log in with your institutional cadet account to submit an official inquiry.');
      }
      return;
    }

    if (!subject.trim() || subject.trim().length < 3) {
      setErrorMsg('Please enter an inquiry subject (at least 3 characters).');
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      setErrorMsg('Message content cannot be empty (at least 5 characters).');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/requests/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          priority: 'NORMAL',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessResult({
          inquiryId: data.inquiryId,
          subject: subject.trim(),
        });
        setSubject('');
        setMessage('');
      } else {
        setErrorMsg(data.message || 'Unable to submit inquiry. Please try again.');
      }
    } catch (err) {
      console.error('Submit inquiry error:', err);
      setErrorMsg('Unable to connect to Command Desk server. Please check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="section-py" aria-label="Official Unit Contact">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Mail size={16} />
            Institutional Liaison
          </span>
          <h2 className="cinzel-title">Contact</h2>
          <p className="description">
            Send an inquiry to the NCC team.
          </p>
        </div>

        <div className="grid-2">
          {/* Verified campus information only */}
          <div className="institutional-card">
            <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', marginBottom: '1.25rem' }}>Headquarters &amp; Training Grounds</h3>
            <div style={{ display: 'grid', gap: '.85rem' }}>
              <p style={{ display: 'flex', gap: '.65rem', margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}><MapPin size={18} /><span>{institutionalInfo.address || 'Army Institute of Technology, Dighi Hills, Pune - 411015.'}</span></p>
              {institutionalInfo.email && <p style={{ display: 'flex', gap: '.65rem', margin: 0 }}><Mail size={18} /><a href={`mailto:${institutionalInfo.email}`}>{institutionalInfo.email}</a></p>}
              {institutionalInfo.phone && <p style={{ display: 'flex', gap: '.65rem', margin: 0 }}><Phone size={18} /><a href={`tel:${institutionalInfo.phone}`}>{institutionalInfo.phone}</a></p>}
              {institutionalInfo.timings && <p style={{ display: 'flex', gap: '.65rem', margin: 0 }}><Clock size={18} /><span>{institutionalInfo.timings}</span></p>}
            </div>
            <a href="https://www.aitpune.com" target="_blank" rel="noopener noreferrer">Visit the official AIT website</a>
          </div>

          {/* Right Column: Database-Backed Inquiry Form */}
          <div className="institutional-card" style={{ position: 'relative' }}>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', marginBottom: '0.75rem' }}>
              Institutional Inquiry Protocol
            </h3>
            <p style={{ marginBottom: '1.25rem', fontSize: '0.92rem', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
              Use this form for cadet verification, certificate, camp, or admissions enquiries.
            </p>

            {/* Success Confirmation Banner */}
            {successResult && (
              <div
                style={{
                  backgroundColor: 'var(--color-success-soft)',
                  border: '2px solid var(--color-success)',
                  borderRadius: '6px',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  animation: 'fadeIn 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-success)', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
                  <strong style={{ fontSize: '0.95rem' }}>Official inquiry submitted successfully.</strong>
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--color-success)', marginBottom: '0.75rem' }}>
                  Inquiry ID: <strong style={{ letterSpacing: '0.05em', color: 'var(--navy-primary)' }}>{successResult.inquiryId}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessResult(null)}
                  className="btn-secondary btn-sm"
                  style={{ marginTop: '0.85rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  Submit Another Inquiry
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'var(--color-error-soft)',
                  border: '1px solid var(--color-error)',
                  borderRadius: '4px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: 'var(--color-error)',
                  fontSize: '0.85rem',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Authentication Notice if Visitor is not Logged In */}
            {!user && (
              <div
                style={{
                  backgroundColor: 'var(--color-info-soft)',
                  border: '1px solid var(--color-info-border)',
                  borderRadius: '4px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={16} style={{ color: 'var(--navy-primary)' }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-accent)' }}>
                    Authenticated session required to file official inquiries.
                  </span>
                </div>
                {onOpenLogin && (
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--navy-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: 0,
                    }}
                  >
                    <span>Cadet Login</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="contact-field-1">
                  FULL NAME / CADET RANK
                </label>
                <input id="contact-field-1"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!!user}
                  placeholder={user ? user.fullName : 'e.g. CDT Arjun Singh (Login to auto-fill)'}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    backgroundColor: user ? 'var(--color-surface)' : 'var(--color-background)',
                    cursor: user ? 'not-allowed' : 'text',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="contact-field-2">
                  INSTITUTIONAL EMAIL
                </label>
                <input id="contact-field-2"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!user}
                  placeholder={user ? user.email : 'name@aitpune.edu.in'}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    backgroundColor: user ? 'var(--color-surface)' : 'var(--color-background)',
                    cursor: user ? 'not-allowed' : 'text',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="contact-field-3">
                  INQUIRY SUBJECT
                </label>
                <input id="contact-field-3"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Annual Training Camp Nomination Query"
                  maxLength={200}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="contact-field-4">
                  MESSAGE CONTENT
                </label>
                <textarea id="contact-field-4"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter details of your official inquiry..."
                  maxLength={5000}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  opacity: submitting ? 0.75 : 1,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                <Mail size={16} />
                <span>{submitting ? 'LOGGING TO COMMAND DESK...' : 'SUBMIT OFFICIAL INQUIRY'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
