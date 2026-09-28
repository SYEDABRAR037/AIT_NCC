import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Clock,
  Send,
  X,
  UserCheck,
  Award,
  Tent,
  Briefcase,
  HelpCircle,
} from 'lucide-react';

interface RequestCenterViewProps {
  token?: string | null;
  defaultType?: string;
}

export const RequestCenterView: React.FC<RequestCenterViewProps> = ({ token: propToken, defaultType }) => {
  const token = propToken || localStorage.getItem('token');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);


  const [form, setForm] = useState({
    requestType: defaultType || 'LEAVE',
    title: '',
    description: '',
    priority: 'NORMAL',
    supportingDocUrl: '',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultType) {
      setForm((prev) => ({ ...prev, requestType: defaultType }));
      setNewModalOpen(true);
    }
  }, [defaultType]);

  const fetchMyRequests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/requests/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/requests/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Request ${data.request.requestNumber} successfully filed.`);
        setNewModalOpen(false);
        setForm({
          requestType: 'LEAVE',
          title: '',
          description: '',
          priority: 'NORMAL',
          supportingDocUrl: '',
        });
        fetchMyRequests();
      } else {
        alert(data.message || 'Failed to submit request');
      }
    } catch (err) {
      console.error('Submit request error:', err);
      alert('Error submitting request to Command Center');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string, reqNum: string) => {
    if (!window.confirm(`Are you sure you want to withdraw request ${reqNum}?`)) return;
    try {
      const res = await fetch(`/api/requests/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Request ${reqNum} has been withdrawn.`);
        fetchMyRequests();
      } else {
        alert(data.message || 'Failed to cancel request');
      }
    } catch (err) {
      console.error('Cancel request error:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: 'var(--color-success-soft)', color: 'var(--color-success)', border: 'var(--color-success)', label: '🟢 APPROVED' };
      case 'REJECTED':
        return { bg: 'var(--color-error-soft)', color: 'var(--color-error)', border: 'var(--color-error)', label: '🔴 REJECTED' };
      case 'RETURNED':
        return { bg: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: 'var(--color-disabled)', label: '⚪ RETURNED FOR CORRECTION' };
      case 'FORWARDED':
        return { bg: 'var(--color-info-soft)', color: 'var(--color-accent)', border: 'var(--color-info-border)', label: '🟣 FORWARDED TO HIGHER COMMAND' };
      case 'UNDER_REVIEW':
        return { bg: 'var(--color-info-soft)', color: 'var(--color-accent)', border: 'var(--color-accent)', label: '🔵 UNDER REVIEW' };
      case 'CANCELLED':
        return { bg: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: 'var(--color-border)', label: '⚫ CANCELLED' };
      case 'SUBMITTED':
      default:
        return { bg: 'var(--color-warning-soft)', color: 'var(--color-primary)', border: 'var(--color-gold)', label: '🟡 SUBMITTED' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PROFILE_CORRECTION':
        return <UserCheck size={16} style={{ color: 'var(--color-accent)' }} />;
      case 'CERTIFICATE_VERIFICATION':
        return <Award size={16} style={{ color: 'var(--color-gold)' }} />;
      case 'CAMP_PARTICIPATION':
        return <Tent size={16} style={{ color: 'var(--color-accent)' }} />;
      case 'DUTY_RELATED':
        return <Briefcase size={16} style={{ color: 'var(--color-success)' }} />;
      case 'DOCUMENT_REQUEST':
        return <FileText size={16} style={{ color: 'var(--color-accent)' }} />;
      default:
        return <HelpCircle size={16} style={{ color: 'var(--color-text-secondary)' }} />;
    }
  };

  const renderNotingSheetStepper = (req: any) => {
    const status = req.status;
    const isApproved = status === 'APPROVED';
    const isRejected = status === 'REJECTED';

    const step1Done = true;
    const step2Done = ['UNDER_REVIEW', 'FORWARDED', 'APPROVED', 'REJECTED'].includes(status);
    const step2Active = status === 'UNDER_REVIEW';
    const step3Done = ['FORWARDED', 'APPROVED', 'REJECTED'].includes(status);
    const step3Active = status === 'FORWARDED';
    const step4Done = isApproved || isRejected;

    const steps = [
      { num: '1', label: 'Cadet Filed', role: 'Applicant', done: step1Done, active: status === 'SUBMITTED' },
      { num: '2', label: 'Senior Scrutiny', role: 'Senior Cadet', done: step2Done && !step2Active, active: step2Active },
      { num: '3', label: 'Platoon Endorsement', role: 'SUO / JUO', done: step3Done && !step3Active, active: step3Active },
      { num: '4', label: isRejected ? 'Rejection' : 'ANO Sanction', role: 'Associate NCC Officer', done: step4Done, active: isApproved, isReject: isRejected },
    ];

    return (
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.85rem 1rem', margin: '0.75rem 0' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy-primary)', letterSpacing: '0.08em', marginBottom: '0.65rem' }}>
          OFFICIAL NOTING SHEET ROUTING TRAIL:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', position: 'relative' }}>
          {steps.map((s, idx) => {
            const bg = s.isReject ? 'var(--color-error-soft)' : s.done ? 'var(--color-success-soft)' : s.active ? 'var(--color-warning-soft)' : 'var(--color-surface)';
            const border = s.isReject ? 'var(--color-error)' : s.done ? 'var(--color-success)' : s.active ? 'var(--color-gold)' : 'var(--color-border)';
            const text = s.isReject ? 'var(--color-error)' : s.done ? 'var(--color-success)' : s.active ? 'var(--color-primary)' : 'var(--color-text-secondary)';
            const icon = s.isReject ? '✕' : s.done ? '✓' : s.active ? '●' : s.num;

            return (
              <div key={idx} style={{ textAlign: 'center', position: 'relative' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: bg,
                    border: `2px solid ${border}`,
                    color: text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.35rem',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                  }}
                >
                  {icon}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: '1.2' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
                  {s.role}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', margin: 0 }}>
            Central NCC Request Center
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
            Submit official requests, track stage reviews, and inspect decision history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchMyRequests} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} />
            <span>REFRESH</span>
          </button>
          <button
            onClick={() => setNewModalOpen(true)}
            className="btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={15} />
            <span>FILE NEW REQUEST</span>
          </button>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Clock size={32} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
          <p>Loading personal request records...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={40} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
          <h4 style={{ color: 'var(--navy-primary)' }}>No Requests on Record</h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
            You have not filed any official requests yet. You can submit leave, profile corrections, certificate verifications, or camp nominations.
          </p>
          <button onClick={() => setNewModalOpen(true)} className="btn-primary btn-sm">
            File Your First Request
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.map((req) => {
            const badge = getStatusBadge(req.status);
            const isCancellable = ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'].includes(req.status);

            return (
              <div
                key={req.id}
                className="institutional-card"
                style={{
                  borderLeft: `4px solid ${badge.border}`,
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--navy-primary)', fontSize: '0.95rem' }}>
                        {req.requestNumber}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'var(--color-surface)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {getTypeIcon(req.requestType)}
                        {req.requestType.replace(/_/g, ' ')}
                      </span>
                      <span
                        className="badge-institutional"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          borderColor: badge.border,
                        }}
                      >
                        {badge.label}
                      </span>
                      {req.priority === 'URGENT' && (
                        <span className="badge-institutional" style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
                          ⚡ URGENT
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', margin: '0.4rem 0 0.2rem' }}>
                      {req.title}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.5' }}>
                      {req.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {isCancellable && (
                      <button
                        onClick={() => handleCancel(req.id, req.requestNumber)}
                        className="btn-secondary btn-sm"
                        style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-border)' }}
                      >
                        Withdraw Request
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Stage Military Noting Sheet Routing Stepper */}
                {renderNotingSheetStepper(req)}

                {/* Supporting Document Link */}
                {req.supportingDocUrl && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-accent)', marginBottom: '0.75rem' }}>
                    Attachment / Supporting Document:{' '}
                    <a href={req.supportingDocUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                      View Uploaded Document
                    </a>
                  </div>
                )}

                {/* Complete Processing History Audit */}
                {req.history && req.history.length > 0 && (
                  <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--navy-hover)', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                      PROCESSING AUDIT TIMELINE:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {req.history.map((h: any) => (
                        <div key={h.id} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                            {new Date(h.createdAt).toLocaleDateString()} {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          &bull;
                          <span>
                            {h.officer?.role || 'SYSTEM'}: Marked <strong>{h.action}</strong> ({h.previousStatus} &rarr; {h.newStatus})
                          </span>
                          {h.remarks && (
                            <span style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                              &mdash; "{h.remarks}"
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Request Modal */}
      {newModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="institutional-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--color-background)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-primary)', margin: 0 }}>
                File Official NCC Request
              </h3>
              <button onClick={() => setNewModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  REQUEST CATEGORY *
                </label>
                <select
                  value={form.requestType}
                  onChange={(e) => setForm({ ...form, requestType: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                  required
                >
                  <option value="LEAVE">Leave Request (Medical / Academic / Personal)</option>
                  <option value="PROFILE_CORRECTION">Profile Correction Request</option>
                  <option value="CERTIFICATE_VERIFICATION">Certificate Verification / Addition Request</option>
                  <option value="CAMP_PARTICIPATION">Camp Nomination / Participation Request</option>
                  <option value="DUTY_RELATED">Duty-related Request / Exemption</option>
                  <option value="DOCUMENT_REQUEST">Official NCC Document / Bonafide Request</option>
                  <option value="OTHER">Other Institutional Request</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  REQUEST SUBJECT / TITLE *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Correct Phone Number in Digital Bio / Camp Nomination"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  PRIORITY LEVEL
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                >
                  <option value="NORMAL">Normal Priority (Standard processing)</option>
                  <option value="HIGH">High Priority (Time sensitive)</option>
                  <option value="URGENT">Urgent Command Attention</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  DETAILED JUSTIFICATION / PARTICULARS *
                </label>
                <textarea
                  rows={4}
                  placeholder="State the exact particulars, regimental reason, and desired institutional action..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem', resize: 'vertical' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  SUPPORTING DOCUMENT URL (OPTIONAL)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or uploaded document link"
                  value={form.supportingDocUrl}
                  onChange={(e) => setForm({ ...form, supportingDocUrl: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Send size={14} />
                  <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
