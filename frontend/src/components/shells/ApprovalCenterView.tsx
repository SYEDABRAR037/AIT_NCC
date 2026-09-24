import React, { useState, useEffect } from 'react';
import {
  Users,
  CalendarCheck,
  FileText,
  RefreshCw,
  CheckCircle2,
  X,
  Shield,
  Eye,
} from 'lucide-react';
import { safeApiFetch } from '../../utils/api';

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
  const [viewCadetDossier, setViewCadetDossier] = useState<any | null>(null);
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
  const [designatedSeniorId, setDesignatedSeniorId] = useState('');
  const [availableSeniors, setAvailableSeniors] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [regRes, leaveRes, reqRes, usersRes] = await Promise.all([
        safeApiFetch('/api/reviews/pending').then((r) => r.data).catch(() => ({ applications: [] })),
        safeApiFetch('/api/leave/pending').then((r) => r.data).catch(() => ({ leaves: [] })),
        safeApiFetch('/api/requests/officer').then((r) => r.data).catch(() => ({ requests: [] })),
        role === 'ADMIN_ANO'
          ? safeApiFetch('/api/admin/users').then((r) => r.data).catch(() => ({ users: [] }))
          : Promise.resolve({ users: [] }),
      ]);

      const pendingRegs = regRes?.applications || regRes?.users || [];
      setRegistrations(pendingRegs);
      setLeaves(leaveRes?.leaves || []);
      setRequests(reqRes?.requests || []);
      if (usersRes?.users) {
        setAvailableSeniors(
          usersRes.users.filter((u: any) => u.role === 'SENIOR' || u.role === 'PLATOON_SENIOR')
        );
      }
    } catch (err) {
      console.error('Error fetching approval desk data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token, role]);

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    setProcessing(true);

    try {
      if (actionModal.type === 'registration') {
        const { ok, data } = await safeApiFetch(`/api/reviews/${actionModal.item.id}/action`, {
          method: 'POST',
          body: JSON.stringify({
            action: actionModal.action,
            remarks,
            seniorId: designatedSeniorId || undefined,
          }),
        });

        if (!ok) {
          alert(data?.message || 'Failed to process registration review');
          return;
        }

        alert(data?.message || `Registration action executed successfully.`);
      } else if (actionModal.type === 'leave') {
        const { ok, data } = await safeApiFetch(`/api/leave/${actionModal.item.id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            action: actionModal.action,
            remarks,
          }),
        });
        if (!ok) {
          alert(data?.message || 'Failed to process leave action');
          return;
        }
      } else if (actionModal.type === 'request') {
        const { ok, data } = await safeApiFetch(`/api/requests/${actionModal.item.id}/action`, {
          method: 'POST',
          body: JSON.stringify({
            action: actionModal.action,
            remarks,
          }),
        });
        if (!ok) {
          alert(data?.message || 'Failed to process request action');
          return;
        }
      }

      setActionModal(null);
      setRemarks('');
      setDesignatedSeniorId('');
      if (viewCadetDossier && viewCadetDossier.id === actionModal.item.id) {
        setViewCadetDossier(null);
      }
      fetchAllData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ncc:data-updated'));
      }
    } catch (err: any) {
      console.error('Error processing approval action:', err);
      alert(err.message || 'Error processing action');
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
            registrations.map((cadet) => {
              const seniorReview = cadet.applicationReviews?.find((r: any) =>
                (r.stage === 'SENIOR_REVIEW' || r.stage === 'SENIOR_FORWARDED') && ['FORWARD', 'APPROVE'].includes(r.action)
              );
              const hasSeniorReviewed = !!seniorReview;
              const seniorReviewerName = seniorReview?.reviewer?.fullName || 'Senior Cadet';

              const platoonReview = cadet.applicationReviews?.find((r: any) =>
                (r.stage === 'PLATOON_SENIOR_REVIEW' || r.stage === 'PLATOON_SENIOR_FORWARDED') && ['FORWARD', 'APPROVE'].includes(r.action)
              );
              const hasPlatoonReviewed = !!platoonReview;
              const platoonReviewerName = platoonReview?.reviewer?.fullName || 'Platoon Senior';

              const isSeniorOfficer = role === 'SENIOR';
              const isPlatoonSeniorOfficer = role === 'PLATOON_SENIOR';
              const isAnoOfficer = role === 'ADMIN_ANO';

              return (
                <div key={cadet.id} className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', margin: 0 }}>
                          {cadet.name || cadet.fullName}
                        </h3>
                        <span className="badge-institutional" style={{ background: '#FEF3C7', color: '#92400E' }}>
                          {hasPlatoonReviewed ? 'PLATOON SENIOR REVIEWED' : hasSeniorReviewed ? 'SENIOR REVIEWED' : (cadet.status || 'UNDER_REVIEW')}
                        </span>
                        <span className="badge-institutional">{cadet.platoon || cadet.platoonName || 'Platoon'}</span>
                        {cadet.biometricTemplate ? (
                          <span className="badge-institutional" style={{ background: '#ECFDF5', color: '#047857' }}>
                            ✓ Biometrics Ready
                          </span>
                        ) : (
                          <span className="badge-institutional" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                            Face Not Registered
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginTop: '0.35rem' }}>
                        Regimental No: <strong>{cadet.regimentalNumber}</strong> &bull; Roll: <strong>{cadet.collegeRollNumber}</strong> &bull; Email: <strong>{cadet.email}</strong> &bull; Branch: <strong>{cadet.branch} ({cadet.year})</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        onClick={() => setViewCadetDossier(cadet)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: 'var(--navy-primary)', color: 'var(--navy-primary)' }}
                      >
                        <Eye size={14} />
                        <span>VIEW FULL PROFILE</span>
                      </button>

                      {isAnoOfficer ? (
                        <>
                          <button
                            onClick={() =>
                              setActionModal({
                                type: 'registration',
                                item: cadet,
                                action: 'APPROVE',
                              })
                            }
                            className="btn-primary btn-sm"
                          >
                            Sanction &amp; Commission (ACTIVE)
                          </button>
                          <button
                            onClick={() => setActionModal({ type: 'registration', item: cadet, action: 'RETURN' })}
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
                        </>
                      ) : isSeniorOfficer ? (
                        hasSeniorReviewed ? (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: '#047857',
                              fontWeight: 700,
                              padding: '0.4rem 0.75rem',
                              background: '#ECFDF5',
                              borderRadius: '4px',
                              border: '1px solid #A7F3D0',
                            }}
                          >
                            ✓ Senior Review Completed
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: 'registration',
                                  item: cadet,
                                  action: 'FORWARD',
                                })
                              }
                              className="btn-primary btn-sm"
                            >
                              Endorse &amp; Forward (Senior Review)
                            </button>
                            <button
                              onClick={() => setActionModal({ type: 'registration', item: cadet, action: 'RETURN' })}
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
                          </>
                        )
                      ) : isPlatoonSeniorOfficer ? (
                        hasPlatoonReviewed ? (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: '#047857',
                              fontWeight: 700,
                              padding: '0.4rem 0.75rem',
                              background: '#ECFDF5',
                              borderRadius: '4px',
                              border: '1px solid #A7F3D0',
                            }}
                          >
                            ✓ Platoon Senior Endorsed
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: 'registration',
                                  item: cadet,
                                  action: 'FORWARD',
                                })
                              }
                              className="btn-primary btn-sm"
                            >
                              Endorse &amp; Forward to ANO
                            </button>
                            <button
                              onClick={() => setActionModal({ type: 'registration', item: cadet, action: 'RETURN' })}
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
                          </>
                        )
                      ) : null}
                    </div>
                  </div>

                  {/* 4-Stage Cadet Registration Pipeline Stepper */}
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.65rem 0.85rem', margin: '0.65rem 0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--navy-primary)', letterSpacing: '0.08em', marginBottom: '0.45rem' }}>
                      CADET ONBOARDING PIPELINE:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857' }}>✓ 1. Registered</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748B' }}>Online Application</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: hasSeniorReviewed ? '#047857' : '#D97706' }}>
                          {hasSeniorReviewed ? `✓ 2. Senior Review` : '● 2. Senior Review'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                          {hasSeniorReviewed ? seniorReviewerName : 'Squad Endorsement'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: hasPlatoonReviewed ? '#047857' : (hasSeniorReviewed ? '#D97706' : '#94A3B8') }}>
                          {hasPlatoonReviewed ? `✓ 3. Platoon Sr.` : (hasSeniorReviewed ? '● 3. Platoon Sr.' : '3. Platoon Sr.')}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                          {hasPlatoonReviewed ? platoonReviewerName : 'Platoon Endorsement'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: hasPlatoonReviewed || hasSeniorReviewed ? '#D97706' : '#94A3B8' }}>
                          4. ANO Final Approval
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
              );
            })
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

              {actionModal.type === 'registration' && actionModal.action === 'APPROVE' && role === 'ADMIN_ANO' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    ASSIGN SENIOR CADET MENTOR (OPTIONAL)
                  </label>
                  <select
                    value={designatedSeniorId}
                    onChange={(e) => setDesignatedSeniorId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      border: '1px solid var(--navy-border)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  >
                    <option value="">Auto-Assign (from Senior Endorsement, or leave pending)</option>
                    {availableSeniors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.regimentalNumber}) — {s.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* Full Cadet Profile Dossier Modal (Phase 2 & Phase 3) */}
      {viewCadetDossier && (
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
            padding: '1.25rem',
            overflowY: 'auto',
          }}
          onClick={() => setViewCadetDossier(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: 'var(--navy-primary)',
                color: 'var(--white-pure)',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: '#93C5FD', fontWeight: 800 }}>
                  AIT NCC ENROLLMENT DOSSIER
                </span>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--white-pure)', margin: '0.15rem 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} />
                  Cadet Registration Profile
                </h3>
              </div>
              <button
                onClick={() => setViewCadetDossier(null)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.4rem' }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Cadet Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '1rem',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--navy-primary)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {viewCadetDossier.profilePhotoUrl ? (
                    <img
                      src={viewCadetDossier.profilePhotoUrl}
                      alt={viewCadetDossier.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (viewCadetDossier.fullName || 'CDT').slice(0, 2).toUpperCase()
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', margin: 0, fontWeight: 800 }}>
                      {viewCadetDossier.fullName || viewCadetDossier.name}
                    </h2>
                    <span className="badge-institutional" style={{ background: '#FEF3C7', color: '#92400E' }}>
                      {viewCadetDossier.status}
                    </span>
                    <span className="badge-institutional">
                      {viewCadetDossier.platoonName || viewCadetDossier.platoon || 'Platoon'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                    Regimental No: <strong>{viewCadetDossier.regimentalNumber}</strong> &bull; Roll: <strong>{viewCadetDossier.collegeRollNumber}</strong>
                  </div>
                </div>
              </div>

              {/* Personal & Academic Information Grid */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--navy-primary)', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
                  CADET IDENTITY &amp; ACADEMIC RECORD
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>OFFICIAL EMAIL:</span>
                    <strong>{viewCadetDossier.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>PHONE NUMBER:</span>
                    <strong>{viewCadetDossier.phone || 'Not Provided'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>ACADEMIC YEAR:</span>
                    <strong>{viewCadetDossier.year}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>ENGINEERING BRANCH:</span>
                    <strong>{viewCadetDossier.branch}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>DATE OF ENROLLMENT:</span>
                    <strong>{new Date(viewCadetDossier.dateOfJoining || viewCadetDossier.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>SUBMISSION DATE &amp; TIME:</span>
                    <strong>{new Date(viewCadetDossier.createdAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>BATTALION &amp; COMPANY:</span>
                    <strong>{viewCadetDossier.battalion || '2 Maharashtra Bn NCC, Pune'} ({viewCadetDossier.company || 'Bravo Company'})</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--navy-text-muted)', display: 'block', fontSize: '0.75rem' }}>GROUP HQ:</span>
                    <strong>{viewCadetDossier.group || 'Pune Group HQ'}</strong>
                  </div>
                </div>
              </div>

              {/* Biometric Status Section (Phase 8 Validation) */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--navy-primary)', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
                  BIOMETRIC &amp; FACIAL RECOGNITION STATUS
                </h4>
                {viewCadetDossier.biometricTemplate ? (
                  <div
                    style={{
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: '6px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <CheckCircle2 size={22} style={{ color: '#047857', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#065F46' }}>
                        BIOMETRIC TEMPLATE READY
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.15rem' }}>
                        128-dimensional facial embedding enrolled. Quality Score: {(viewCadetDossier.biometricTemplate.qualityScore * 100).toFixed(0)}%. Registered: {new Date(viewCadetDossier.biometricTemplate.registeredAt).toLocaleDateString()}.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '6px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <X size={22} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991B1B' }}>
                        FACE NOT REGISTERED
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: '0.15rem' }}>
                        Cadet has not yet completed hardware facial scan. Must capture face before participating in live biometric parade muster.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* NCC Enrollment Details / Prior Experience */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--navy-primary)', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
                  PRIOR NCC EXPERIENCE &amp; CERTIFICATIONS
                </h4>
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.85rem 1rem',
                    fontSize: '0.85rem',
                    color: 'var(--navy-primary)',
                  }}
                >
                  {viewCadetDossier.enrollmentDetails || 'No prior NCC certifications or previous wing experience declared during enrollment.'}
                </div>
              </div>

              {/* Review History / Audit Trail (Phase 5) */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--navy-primary)', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
                  MULTI-TIER REVIEW AUDIT TRAIL
                </h4>
                {viewCadetDossier.applicationReviews && viewCadetDossier.applicationReviews.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {viewCadetDossier.applicationReviews.map((rev: any, idx: number) => (
                      <div
                        key={rev.id || idx}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '4px',
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.82rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <strong>{rev.action}</strong> by <strong>{rev.reviewer?.fullName || 'Officer'}</strong> ({rev.reviewer?.role || 'COMMAND'})
                          {rev.remarks && <div style={{ color: 'var(--navy-text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>Remarks: "{rev.remarks}"</div>}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {new Date(rev.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', fontStyle: 'italic' }}>
                    No officer reviews recorded yet. Application is currently pending initial scrutiny.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => setViewCadetDossier(null)}
                className="btn-secondary btn-sm"
              >
                Close Dossier
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {role === 'ADMIN_ANO' ? (
                  <>
                    <button
                      onClick={() =>
                        setActionModal({
                          type: 'registration',
                          item: viewCadetDossier,
                          action: 'APPROVE',
                        })
                      }
                      className="btn-primary btn-sm"
                    >
                      Sanction &amp; Commission (ACTIVE)
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'registration', item: viewCadetDossier, action: 'RETURN' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#D97706', borderColor: '#FCD34D' }}
                    >
                      Return Dossier
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'registration', item: viewCadetDossier, action: 'REJECT' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setActionModal({
                          type: 'registration',
                          item: viewCadetDossier,
                          action: 'FORWARD',
                        })
                      }
                      className="btn-primary btn-sm"
                    >
                      Forward to ANO
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'registration', item: viewCadetDossier, action: 'RETURN' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#D97706', borderColor: '#FCD34D' }}
                    >
                      Return Dossier
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'registration', item: viewCadetDossier, action: 'REJECT' })}
                      className="btn-secondary btn-sm"
                      style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalCenterView;
