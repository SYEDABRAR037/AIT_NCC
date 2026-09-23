import React, { useState, useEffect } from 'react';
import { MapPin, Mail, Phone, Clock, Shield, CheckCircle2, AlertCircle, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
          <h2 className="cinzel-title">Official Unit Contact & Command Desk</h2>
          <p className="description">
            Official communications desk for Army Institute of Technology NCC Unit.
          </p>
        </div>

        <div className="grid-2">
          {/* Left Column: Contact Details */}
          <div className="institutional-card">
            <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', marginBottom: '1.25rem' }}>
              Headquarters & Training Grounds
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <MapPin size={20} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--navy-primary)' }}>Unit Address</strong>
                  <span style={{ fontSize: '0.92rem' }}>
                    NCC Detachment, Army Institute of Technology (AIT),<br />
                    Alandi Road, Dighi, Pune, Maharashtra - 411015, India
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Mail size={20} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--navy-primary)' }}>Official Email</strong>
                  <span style={{ fontSize: '0.92rem' }}>ncc@aitpune.edu.in</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Phone size={20} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--navy-primary)' }}>Unit Office Phone</strong>
                  <span style={{ fontSize: '0.92rem' }}>+91 (020) 2715-7534 / Ext. NCC Command Desk</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Clock size={20} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: 'var(--navy-primary)' }}>Parade & Reporting Timings</strong>
                  <span style={{ fontSize: '0.92rem' }}>
                    Parades: Tue & Thu (0600 - 0800 hrs)<br />
                    Command Desk Hours: Mon - Fri (1530 - 1730 hrs)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Database-Backed Inquiry Form */}
          <div className="institutional-card" style={{ position: 'relative' }}>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', marginBottom: '0.75rem' }}>
              Institutional Inquiry Protocol
            </h3>
            <p style={{ marginBottom: '1.25rem', fontSize: '0.92rem', lineHeight: '1.6', color: '#475569' }}>
              For queries related to cadet verification, B/C Certificate exams, camp nominations, or
              defence admissions, please submit through official institutional channels.
            </p>

            {/* Success Confirmation Banner */}
            {successResult && (
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '2px solid #10B981',
                  borderRadius: '6px',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  animation: 'fadeIn 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#065F46', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={20} style={{ color: '#10B981' }} />
                  <strong style={{ fontSize: '0.95rem' }}>Official inquiry submitted successfully.</strong>
                </div>
                <div style={{ fontSize: '0.88rem', color: '#047857', marginBottom: '0.75rem' }}>
                  Inquiry ID: <strong style={{ letterSpacing: '0.05em', color: 'var(--navy-primary)' }}>{successResult.inquiryId}</strong>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: '1.5', margin: 0 }}>
                  Your official inquiry has been permanently logged in the Command Center ledger. You can view the live thread, officer replies, and follow up inside your Cadet Panel.
                </p>
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
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #EF4444',
                  borderRadius: '4px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: '#991B1B',
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
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #93C5FD',
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
                  <span style={{ fontSize: '0.82rem', color: '#1E3A8A' }}>
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
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  FULL NAME / CADET RANK
                </label>
                <input
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
                    outline: 'none',
                    backgroundColor: user ? '#F8FAFC' : '#FFFFFF',
                    cursor: user ? 'not-allowed' : 'text',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  INSTITUTIONAL EMAIL
                </label>
                <input
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
                    outline: 'none',
                    backgroundColor: user ? '#F8FAFC' : '#FFFFFF',
                    cursor: user ? 'not-allowed' : 'text',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  INQUIRY SUBJECT
                </label>
                <input
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
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  MESSAGE CONTENT
                </label>
                <textarea
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
                    outline: 'none',
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
                <Shield size={16} />
                <span>{submitting ? 'LOGGING TO COMMAND DESK...' : 'SUBMIT OFFICIAL INQUIRY'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
