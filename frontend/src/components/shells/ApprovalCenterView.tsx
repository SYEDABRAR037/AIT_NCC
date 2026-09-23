import React, { useState, useEffect } from 'react';
import {
  Users,
  CalendarCheck,
  FileText,
  RefreshCw,
  CheckCircle2,
  X,
  Shield,
} from 'lucide-react';

interface ApprovalCenterViewProps {
  role?: string;
  token?: string | null;
  pendingRegistrations?: any[];
  onReviewRegistration?: (cadet: any) => void;
  onRefreshRegistrations?: () => void;
  leaveApplications?: any[];
  onProcessLeave?: (leave: any, action: string, remarks: string) => Promise<void>;
  onRefreshLeaves?: () => void;
  officerRequests?: any[];
  onProcessRequest?: (request: any, action: string, remarks: string) => Promise<void>;
  onRefreshRequests?: () => void;
}

export const ApprovalCenterView: React.FC<ApprovalCenterViewProps> = ({
  role = 'ADMIN_ANO',
  token: propToken,
  pendingRegistrations: propRegistrations,
  leaveApplications: propLeaves,
  officerRequests: propRequests,
}) => {
  const token = propToken || localStorage.getItem('token');
  const [activeApprovalTab, setActiveApprovalTab] = useState<'registrations' | 'leaves' | 'requests'>('registrations');

  const [registrations, setRegistrations] = useState<any[]>(propRegistrations || []);
  const [leaves, setLeaves] = useState<any[]>(propLeaves || []);
  const [requests, setRequests] = useState<any[]>(propRequests || []);
  const [loading, setLoading] = useState(false);

  const [actionModal, setActionModal] = useState<{
    type: 'registration' | 'leave' | 'request';
    item: any;
    action: string;
  } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchAllData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const [regRes, leaveRes, reqRes] = await Promise.all([
        fetch('/api/reviews/pending', { headers })
          .then((r) => r.json())
          .catch(() => ({ applications: [] })),
        fetch('/api/leave/pending', { headers })
          .then((r) => r.json())
          .catch(() => ({ leaves: [] })),
        fetch('/api/requests/officer', { headers })
          .then((r) => r.json())
          .catch(() => ({ requests: [] })),
      ]);

      let pendingRegs = regRes.applications || regRes.users || [];
      if (pendingRegs.length === 0) {
        try {
          const offlineCadets: any[] = JSON.parse(localStorage.getItem('ncc_offline_cadets') || '[]');
          pendingRegs = offlineCadets.filter((c: any) => c.status === 'UNDER_REVIEW' || c.status === 'HOLD');
        } catch {}
      }

      setRegistrations(pendingRegs);
      setLeaves(leaveRes.leaves || []);
      setRequests(reqRes.requests || []);
    } catch (err) {
      console.error('Error fetching approval desk data:', err);
      try {
        const offlineCadets: any[] = JSON.parse(localStorage.getItem('ncc_offline_cadets') || '[]');
        setRegistrations(offlineCadets.filter((c: any) => c.status === 'UNDER_REVIEW' || c.status === 'HOLD'));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token, role]);

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal || !token) return;
    setProcessing(true);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      if (actionModal.type === 'registration') {
        try {
          await fetch(`/api/reviews/${actionModal.item.id}/action`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              action: actionModal.action,
              remarks,
            }),
          });
        } catch (netErr) {
          console.warn('Network action fallback for registration review:', netErr);
        }

        // Update local offline registry as well
        try {
          const offlineCadets: any[] = JSON.parse(localStorage.getItem('ncc_offline_cadets') || '[]');
          const idx = offlineCadets.findIndex((c: any) => c.id === actionModal.item.id);
          if (idx !== -1) {
            offlineCadets[idx].status = actionModal.action === 'APPROVE' ? 'APPROVED' : actionModal.action === 'REJECT' ? 'REJECTED' : 'HOLD';
            localStorage.setItem('ncc_offline_cadets', JSON.stringify(offlineCadets));
          }
        } catch (storageErr) {
          console.warn('Storage update warning:', storageErr);
        }
      } else if (actionModal.type === 'leave') {
        await fetch(`/api/leave/${actionModal.item.id}/review`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: actionModal.action,
            remarks,
          }),
        });
      } else if (actionModal.type === 'request') {
        await fetch(`/api/requests/${actionModal.item.id}/action`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: actionModal.action,
            remarks,
          }),
        });
      }
      setActionModal(null);
      setRemarks('');
      fetchAllData();
    } catch (err) {
      console.error('Error processing approval action:', err);
    } finally {
      setProcessing(false);
    }
  };

  const totalPending = registrations.length + leaves.length + requests.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div
        className="institutional-card"
        style={{
          borderLeft: '5px solid var(--navy-primary)',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--navy-primary)', margin: 0 }}>
              Central Command Approval Center
            </h2>
            <span className="badge-institutional" style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 800 }}>
              {totalPending} ACTIONABLE ITEMS PENDING
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
            Consolidated officer command desk for cadet registrations, multi-tier leave sanctions, and regimental requests.
          </p>
        </div>

        <button
          onClick={fetchAllData}
          disabled={loading}
          className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>SYNC APPROVAL DESK</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--white-border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveApprovalTab('registrations')}
          style={{
            background: activeApprovalTab === 'registrations' ? 'var(--navy-primary)' : 'var(--white-surface)',
            color: activeApprovalTab === 'registrations' ? 'var(--white-pure)' : 'var(--navy-primary)',
            border: '1px solid var(--white-border)',
            borderRadius: '4px',
            padding: '0.6rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Users size={16} />
          <span>Cadet Registrations ({registrations.length})</span>
        </button>

        <button
          onClick={() => setActiveApprovalTab('leaves')}
          style={{
            background: activeApprovalTab === 'leaves' ? 'var(--navy-primary)' : 'var(--white-surface)',
            color: activeApprovalTab === 'leaves' ? 'var(--white-pure)' : 'var(--navy-primary)',
            border: '1px solid var(--white-border)',
            borderRadius: '4px',
            padding: '0.6rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CalendarCheck size={16} />
          <span>Leave Sanctions ({leaves.length})</span>
        </button>

        <button
          onClick={() => setActiveApprovalTab('requests')}
          style={{
            background: activeApprovalTab === 'requests' ? 'var(--navy-primary)' : 'var(--white-surface)',
            color: activeApprovalTab === 'requests' ? 'var(--white-pure)' : 'var(--navy-primary)',
            border: '1px solid var(--white-border)',
            borderRadius: '4px',
            padding: '0.6rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FileText size={16} />
          <span>Unit Cadet Requests ({requests.length})</span>
        </button>
      </div>

      {/* Content for Active Tab */}
      {/* 1. CADET REGISTRATIONS TAB */}
      {activeApprovalTab === 'registrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {registrations.length === 0 ? (
            <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <CheckCircle2 size={36} style={{ color: '#047857', margin: '0 auto 1rem' }} />
              <h4>Registration Queue Clear</h4>
              <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>
                All pending cadet registration dossiers have been evaluated.
              </p>
            </div>
          ) : (
            registrations.map((cadet) => (
              <div key={cadet.id} className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)' }}>{cadet.name || cadet.fullName}</h3>
                      <span className="badge-institutional" style={{ background: '#FEF3C7', color: '#92400E' }}>
                        {cadet.status}
                      </span>
                      <span className="badge-institutional">{cadet.platoon || cadet.platoonName || 'Platoon'}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      Regimental No: <strong>{cadet.regimentalNumber}</strong> &bull; Roll: <strong>{cadet.collegeRollNumber}</strong> &bull; Email: <strong>{cadet.email}</strong> &bull; Branch: <strong>{cadet.branch} ({cadet.year})</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() =>
                        setActionModal({
                          type: 'registration',
                          item: cadet,
                          action: role === 'ADMIN_ANO' ? 'APPROVE' : 'FORWARD',
                        })
                      }
                      className="btn-primary btn-sm"
                    >
                      {role === 'ADMIN_ANO' ? 'Sanction & Commission' : 'Forward to Command'}
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'registration', item: cadet, action: 'HOLD' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#D97706', borderColor: '#FCD34D' }}
                    >
                      Return
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'registration', item: cadet, action: 'REJECT' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {/* 3-Stage Cadet Registration Pipeline Stepper */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.65rem 0.85rem', margin: '0.65rem 0' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--navy-primary)', letterSpacing: '0.08em', marginBottom: '0.45rem' }}>
                    CADET ONBOARDING PIPELINE:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857' }}>✓ 1. Registered</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Online Application</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: role === 'ADMIN_ANO' ? '#047857' : '#D97706' }}>
                        {role === 'ADMIN_ANO' ? '✓ 2. Senior Endorsed' : '● 2. Senior Scrutiny'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Platoon Senior / Senior</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: role === 'ADMIN_ANO' ? '#D97706' : '#94A3B8' }}>
                        {role === 'ADMIN_ANO' ? '● 3. Awaiting Sanction' : '3. ANO Final Approval'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Associate NCC Officer</div>
                    </div>
                  </div>
                </div>

                {cadet.enrollmentDetails && (
                  <div style={{ fontSize: '0.82rem', background: 'var(--white-surface)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                    <strong>Enrollment Bio / Prior Certifications:</strong> {cadet.enrollmentDetails}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. LEAVE APPLICATIONS TAB */}
      {activeApprovalTab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {leaves.length === 0 ? (
            <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <CheckCircle2 size={36} style={{ color: '#047857', margin: '0 auto 1rem' }} />
              <h4>No Pending Leave Sanctions</h4>
              <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>
                There are currently no leave requests awaiting action at your level.
              </p>
            </div>
          ) : (
            leaves.map((leave) => {
              const cadetName = leave.cadet?.fullName || leave.user?.name || 'Cadet';
              const regNo = leave.cadet?.regimentalNumber || leave.user?.regimentalNumber || 'N/A';
              const platoon = leave.cadet?.platoonName || leave.cadet?.platoon || 'Unit Platoon';
              const reviews = leave.leaveReviews || leave.reviewRecords || [];

              // Multi-tier workflow status helpers
              const isApproved = leave.status === 'APPROVED';
              const isRejected = leave.status === 'REJECTED';
              const isReturned = leave.status === 'RETURNED';
              const isCancelled = leave.status === 'CANCELLED';

              const isSeniorPending = ['SUBMITTED', 'SENIOR_REVIEW', 'PENDING'].includes(leave.status);
              const isPlatoonSeniorPending = leave.status === 'PLATOON_SENIOR_REVIEW';
              const isAnoPending = leave.status === 'ANO_REVIEW';

              // Determine whether current user role can act on this leave
              const canAct =
                !isApproved && !isRejected && !isCancelled &&
                ((role === 'SENIOR' && isSeniorPending) ||
                 (role === 'PLATOON_SENIOR' && (isPlatoonSeniorPending || isSeniorPending)) ||
                 (role === 'ADMIN_ANO'));

              return (
                <div
                  key={leave.id}
                  className="institutional-card"
                  style={{
                    borderLeft: `4px solid ${
                      isApproved ? '#047857' :
                      isRejected ? '#DC2626' :
                      isReturned ? '#D97706' :
                      isCancelled ? '#94A3B8' : '#2563EB'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                          {cadetName} ({regNo})
                        </span>
                        <span
                          className="badge-institutional"
                          style={{
                            background: isApproved ? '#D1FAE5' : isRejected ? '#FEE2E2' : isReturned ? '#FEF3C7' : '#DBEAFE',
                            color: isApproved ? '#047857' : isRejected ? '#DC2626' : isReturned ? '#92400E' : '#1E40AF',
                            fontWeight: 700,
                          }}
                        >
                          {leave.status === 'SUBMITTED' ? 'STAGE 1: SENIOR REVIEW' :
                           leave.status === 'SENIOR_REVIEW' ? 'STAGE 1: SENIOR REVIEW' :
                           leave.status === 'PLATOON_SENIOR_REVIEW' ? 'STAGE 2: PLATOON SR. REVIEW' :
                           leave.status === 'ANO_REVIEW' ? 'STAGE 3: AWAITING ANO SANCTION' :
                           leave.status}
                        </span>
                        <span className="badge-institutional">{leave.leaveType} LEAVE</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                        Platoon: <strong>{platoon}</strong> &bull; Duration: <strong>{new Date(leave.startDate).toLocaleDateString('en-IN')}</strong> to <strong>{new Date(leave.endDate).toLocaleDateString('en-IN')}</strong>
                      </div>
                    </div>

                    {canAct && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setActionModal({
                            type: 'leave',
                            item: leave,
                            action: role === 'ADMIN_ANO' ? 'APPROVE' : 'FORWARD',
                          })}
                          className="btn-primary btn-sm"
                        >
                          {role === 'ADMIN_ANO'
                            ? 'Sanction & Final Approve'
                            : role === 'PLATOON_SENIOR'
                            ? 'Recommend & Forward to ANO'
                            : 'Endorse & Forward to Platoon Senior'}
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'leave', item: leave, action: 'RETURN' })}
                          className="btn-secondary btn-sm"
                          style={{ color: '#D97706', borderColor: '#FCD34D' }}
                        >
                          Return
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'leave', item: leave, action: 'REJECT' })}
                          className="btn-secondary btn-sm"
                          style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Multi-tier Stage Progression Bar */}
                  <div style={{ background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Workflow Stage:</span>
                    <span style={{ color: leave.status !== 'SUBMITTED' ? '#047857' : '#1D4ED8', fontWeight: 600 }}>
                      1. Cadet Submission ✓
                    </span>
                    <span style={{ color: '#94A3B8' }}>➔</span>
                    <span style={{
                      color: ['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' :
                             leave.status === 'SUBMITTED' || leave.status === 'SENIOR_REVIEW' ? '#B45309' : '#94A3B8',
                      fontWeight: 600,
                    }}>
                      2. Senior Endorsement {['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                    </span>
                    <span style={{ color: '#94A3B8' }}>➔</span>
                    <span style={{
                      color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' :
                             leave.status === 'PLATOON_SENIOR_REVIEW' ? '#B45309' : '#94A3B8',
                      fontWeight: 600,
                    }}>
                      3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                    </span>
                    <span style={{ color: '#94A3B8' }}>➔</span>
                    <span style={{
                      color: isApproved ? '#047857' : isAnoPending ? '#B45309' : '#94A3B8',
                      fontWeight: 600,
                    }}>
                      4. ANO Final Sanction {isApproved ? '✓' : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                    <strong>Grounds for Leave:</strong> {leave.reason}
                    {leave.remarks && (
                      <div style={{ marginTop: '0.25rem', color: '#1E293B' }}>
                        <strong>Latest Remarks:</strong> {leave.remarks}
                      </div>
                    )}
                  </div>

                  {reviews && reviews.length > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--white-border)', fontSize: '0.8rem', color: 'var(--navy-text-muted)' }}>
                      <strong>Review Trail:</strong>{' '}
                      {reviews.map((r: any) => `${r.reviewer?.fullName || r.reviewerRole || 'Reviewer'} (${r.action}): "${r.remarks || 'No remarks'}"`).join(' → ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. UNIT CADET REQUESTS TAB */}
      {activeApprovalTab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.length === 0 ? (
            <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <CheckCircle2 size={36} style={{ color: '#047857', margin: '0 auto 1rem' }} />
              <h4>No Formal Requests Pending</h4>
              <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>
                All cadet profile corrections, certificate verifications, and special requests are processed.
              </p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="institutional-card"
                style={{ borderLeft: '4px solid var(--navy-hover)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                        {req.cadet?.name || 'Cadet'}
                      </span>
                      <span className="badge-institutional">{req.requestType}</span>
                      <span className="badge-institutional" style={{ background: '#E0E7FF', color: '#3730A3' }}>
                        {req.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      {req.cadet?.regimentalNumber} &bull; {req.cadet?.platoon || 'Unit Platoon'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setActionModal({ type: 'request', item: req, action: role === 'ADMIN_ANO' ? 'APPROVE' : 'FORWARD' })}
                      className="btn-primary btn-sm"
                    >
                      {role === 'ADMIN_ANO' ? 'Resolve & Sanction' : 'Forward to ANO'}
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'request', item: req, action: 'RETURN' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#D97706', borderColor: '#FCD34D' }}
                    >
                      Request Info
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'request', item: req, action: 'REJECT' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>

                <h4 style={{ fontSize: '0.95rem', color: 'var(--navy-primary)', margin: '0.25rem 0' }}>{req.title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', lineHeight: '1.5' }}>
                  {req.description}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal && (
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
          onClick={() => setActionModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                backgroundColor: 'var(--navy-primary)',
                color: 'var(--white-pure)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} />
                Execute Command Action: {actionModal.action}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmAction} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  COMMANDING OFFICER REMARKS *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter turnout notes, compliance observations, or grounds for action..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--navy-border)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--white-border)' }}>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="btn-primary btn-sm"
                >
                  {processing ? 'Processing...' : 'Confirm & Sanction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalCenterView;
