import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Award,
  CalendarCheck,
  Tent,
  Edit3,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { safeApiFetch } from '../../utils/api';

interface CadetProfileViewProps {
  user?: any;
  token?: string | null;
  onOpenCorrectionRequest?: () => void;
}

export const CadetProfileView: React.FC<CadetProfileViewProps> = ({
  user: propUser,
  token: propToken,
  onOpenCorrectionRequest,
}) => {
  const auth = useAuth();
  const user = propUser || auth.user;
  const token = propToken || auth.token || localStorage.getItem('token');

  const [attendanceStats, setAttendanceStats] = useState<any | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [duties, setDuties] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [serviceRecord, setServiceRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    const endpoint = propUser?.id ? `/api/service-record/${encodeURIComponent(propUser.id)}` : '/api/service-record/me';
    safeApiFetch(endpoint)
      .then(({ ok, data }) => {
        if (!ok || !data?.success) throw new Error(data?.message || 'Unable to load the service record');
        const record = data.serviceRecord;
        const historical = record.historicalInformation;
        const attendanceCounts = historical.attendanceSummary || {};
        const total = (attendanceCounts.PRESENT || 0) + (attendanceCounts.ABSENT || 0) + (attendanceCounts.EXCUSED || 0);
        setServiceRecord(record);
        setAttendanceStats({ present: attendanceCounts.PRESENT || 0, total, percentage: total ? Math.round(((attendanceCounts.PRESENT || 0) / total) * 100) : 0 });
        setCertificates(historical.certificates || []);
        setCamps(historical.camps || []);
        setDuties(historical.duties || []);
        setLeaves(historical.leaves || []);
      })
      .catch((loadError) => console.error('Service record load error:', loadError))
      .finally(() => setLoading(false));
  }, [token, user?.id, propUser?.id]);

  const history = serviceRecord?.historicalInformation;
  const displayUser = {
    ...user,
    ...(serviceRecord?.currentInformation || {}),
    lifecycleHistory: history?.lifecycleHistory || user?.lifecycleHistory || [],
  };

  const percentage = attendanceStats?.percentage || 0;
  const isEligible = percentage >= 75;

  if (loading) {
    return (
      <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--navy-text-muted)' }}>Loading verified cadet profile records...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Profile Header Card */}
      <div
        className="institutional-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          borderLeft: '5px solid var(--navy-primary)',
          background: 'linear-gradient(135deg, var(--color-background) 0%, var(--color-surface) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'var(--navy-dark)',
              color: 'var(--white-pure)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 800,
              border: '3px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            {displayUser?.profilePhotoUrl ? (
              <img
                src={displayUser.profilePhotoUrl}
                alt={displayUser.fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              displayUser?.fullName?.charAt(0) || 'C'
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--navy-primary)', margin: 0 }}>
                {displayUser?.fullName}
              </h2>
              <span className="badge-institutional" style={{
                background: ['INACTIVE', 'PASSED_OUT'].includes(displayUser?.status) ? 'var(--color-warning-soft)' : 'var(--color-success-soft)',
                color: ['INACTIVE', 'PASSED_OUT'].includes(displayUser?.status) ? 'var(--color-primary)' : 'var(--color-success)',
              }}>
                {displayUser?.status || 'ACTIVE'}
              </span>
              <span className="badge-institutional">CADET</span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', marginTop: '0.35rem' }}>
              Regimental No: <strong>{displayUser?.regimentalNumber}</strong> &bull; Roll: <strong>{displayUser?.collegeRollNumber}</strong> &bull; Platoon: <strong>{displayUser?.platoonName}</strong>
            </div>
          </div>
        </div>

        <button
          onClick={onOpenCorrectionRequest}
          className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Edit3 size={15} />
          <span>REQUEST PROFILE CORRECTION</span>
        </button>
      </div>

      {displayUser?.statusDetails && (
        <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <h3 style={{ color: 'var(--navy-primary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Cadet lifecycle status</h3>
          <p><strong>Status:</strong> {displayUser.status}</p>
          <p><strong>Effective:</strong> {new Date(displayUser.statusDetails.effectiveDate).toLocaleDateString()}</p>
          <p><strong>Reason:</strong> {displayUser.statusDetails.reason}</p>
          {displayUser.statusDetails.remarks && <p><strong>Remarks:</strong> {displayUser.statusDetails.remarks}</p>}
        </div>
      )}

      {Array.isArray(displayUser?.lifecycleHistory) && displayUser.lifecycleHistory.length > 0 && (
        <div className="institutional-card">
          <h3 style={{ color: 'var(--navy-primary)', fontSize: '1rem', marginBottom: '0.75rem' }}>Cadet status history</h3>
          <ol style={{ display: 'grid', gap: '0.7rem', paddingLeft: '1.25rem' }}>
            {displayUser.lifecycleHistory.map((entry: any, index: number) => (
              <li key={`${entry.timestamp}-${index}`} style={{ color: 'var(--navy-text-muted)', lineHeight: 1.5 }}>
                <strong>{new Date(entry.timestamp).toLocaleDateString()}</strong> · {entry.previousStatus} → {entry.newStatus}
                <div>Reason: {entry.reason || 'Status transition'}</div>
                <div>Effective: {new Date(entry.effectiveDate).toLocaleDateString()} · Changed by {entry.actorName} ({entry.officerRole})</div>
                {entry.remarks && <div>Remarks: {entry.remarks}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 2-Column Info Grid */}
      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Col 1: Personal & Academic Details */}
        <div className="institutional-card">
          <h4
            style={{
              fontSize: '1.1rem',
              color: 'var(--navy-primary)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <User size={18} style={{ color: 'var(--navy-primary)' }} />
            Personal & Academic Bio
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Full Name</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.fullName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>College Roll Number</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.collegeRollNumber}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Academic Year</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.year}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Engineering Branch</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.branch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Email Address</span>
              <span>{displayUser?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Contact Phone</span>
              <span>{displayUser?.phone || 'On Record (Confidential)'}</span>
            </div>
          </div>
        </div>

        {/* Col 2: Institutional NCC Hierarchy Details */}
        <div className="institutional-card">
          <h4
            style={{
              fontSize: '1.1rem',
              color: 'var(--navy-primary)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Shield size={18} style={{ color: 'var(--navy-primary)' }} />
            Institutional NCC Placement
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Battalion</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.battalion || '2 Maharashtra Battalion NCC'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Company</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.company || 'Bravo Company'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Directorate & Group</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.group || 'Pune Group HQ'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Assigned Platoon</span>
              <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>{displayUser?.platoonName || 'Alpha Platoon'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Current NCC Rank</span>
              <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>{displayUser?.rank || 'CDT'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Cadet Squad / Section</span>
              <span style={{ fontWeight: 700 }}>{displayUser?.team || 'Section 1 (Alpha)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Enrollment Date</span>
              <span>{displayUser?.dateOfJoining ? new Date(displayUser.dateOfJoining).toLocaleDateString() : 'Active Regimental'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Face Enrollment</span>
              <span>{displayUser?.faceEnrolled ? `Enrolled${displayUser.faceEnrollment?.registeredAt ? ` · ${new Date(displayUser.faceEnrollment.registeredAt).toLocaleDateString()}` : ''}` : 'Not enrolled'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Official NCC Records Summary (Attendance, Camps, Duties, Certificates, Leaves) */}
      <div className="institutional-card">
        <h4 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', marginBottom: '1.25rem' }}>
          Official Regimental Service Record Summary
        </h4>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Attendance Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-accent)', marginBottom: '0.35rem' }}>
              <CalendarCheck size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>ATTENDANCE</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isEligible ? 'var(--color-success)' : 'var(--color-error)' }}>
              {percentage}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              {attendanceStats?.present || 0} Present / {attendanceStats?.total || 0} Parades
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 700, color: isEligible ? 'var(--color-success)' : 'var(--color-primary)' }}>
              {isEligible ? '✓ Certificate Exam Eligible' : '⚠️ Below 75% Threshold'}
            </div>
          </div>

          {/* Certificates Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-gold)', marginBottom: '0.35rem' }}>
              <Award size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>CERTIFICATES</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {certificates.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Verified Vault Records
            </div>
          </div>

          {/* Camps Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-accent)', marginBottom: '0.35rem' }}>
              <Tent size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>CAMPS</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {camps.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              CATC / NIC / RDC / Pre-RDC
            </div>
          </div>

          {/* Duties Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', marginBottom: '0.35rem' }}>
              <Briefcase size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>DUTIES</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {duties.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Cadre & Guard Allocations
            </div>
          </div>
        </div>

        {/* Leave History List */}
        <div style={{ borderTop: '1px solid var(--white-border)', paddingTop: '1rem' }}>
          <h5 style={{ fontSize: '0.92rem', color: 'var(--navy-primary)', marginBottom: '0.75rem' }}>
            Recent Leave Sanctions on Record:
          </h5>
          {leaves.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>No leave applications filed on record.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaves.slice(0, 3).map((l: any) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--color-surface)',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <strong>{l.leaveType} Leave</strong> &mdash; {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()}
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>Reason: {l.reason}</div>
                  </div>
                  <span
                    className="badge-institutional"
                    style={{
                      background: l.status === 'APPROVED' ? 'var(--color-success-soft)' : l.status === 'REJECTED' ? 'var(--color-error-soft)' : 'var(--color-warning-soft)',
                      color: l.status === 'APPROVED' ? 'var(--color-success)' : l.status === 'REJECTED' ? 'var(--color-error)' : 'var(--color-primary)',
                    }}
                  >
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--white-border)', paddingTop: '1rem', marginTop: '1rem' }}>
          <h5 style={{ fontSize: '0.92rem', color: 'var(--navy-primary)', marginBottom: '0.75rem' }}>Historical NCC Record</h5>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            <div className="institutional-card">
              <strong>Recent parade attendance</strong>
              {(history?.attendance || []).slice(0, 5).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.session?.title || 'Training parade'} · {entry.status} · {new Date(entry.session?.date || entry.createdAt).toLocaleDateString()}
                </div>
              ))}
              {!history?.attendance?.length && <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.8rem' }}>No attendance records.</p>}
            </div>
            <div className="institutional-card">
              <strong>Camp participation</strong>
              {(history?.camps || []).slice(0, 5).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.camp?.name || 'Camp'} · {entry.status} · {new Date(entry.camp?.startDate || entry.createdAt).toLocaleDateString()}
                </div>
              ))}
              {!history?.camps?.length && <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.8rem' }}>No camp participation records.</p>}
            </div>
            <div className="institutional-card">
              <strong>Duty history</strong>
              {(history?.duties || []).slice(0, 5).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.title} · {entry.status} · {new Date(entry.dutyDate).toLocaleDateString()}
                </div>
              ))}
              {!history?.duties?.length && <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.8rem' }}>No duty records.</p>}
            </div>
            <div className="institutional-card">
              <strong>Certificates & achievements</strong>
              {(history?.certificates || []).slice(0, 4).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.title} · {entry.status} · {new Date(entry.issueDate).toLocaleDateString()}
                </div>
              ))}
              {(history?.achievements || []).slice(0, 4).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.title} · {new Date(entry.eventDate).toLocaleDateString()}
                </div>
              ))}
              {!history?.certificates?.length && !history?.achievements?.length && <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.8rem' }}>No certificates or achievements recorded.</p>}
            </div>
            <div className="institutional-card">
              <strong>Cadet approval history</strong>
              {(history?.approvals || []).slice(0, 6).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.stage} · {entry.action} · {entry.reviewer?.fullName || 'Officer'} · {new Date(entry.createdAt).toLocaleDateString()}
                </div>
              ))}
              {!history?.approvals?.length && <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.8rem' }}>No approval history recorded.</p>}
            </div>
            <div className="institutional-card">
              <strong>Rank / promotion history</strong>
              {(history?.rankHistory || []).map((entry: any) => (
                <div key={entry.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.8rem' }}>
                  {entry.previousRank} → {entry.newRank} · {new Date(entry.changedAt).toLocaleDateString()}
                </div>
              ))}
              {!history?.rankHistory?.length && <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.8rem' }}>No rank changes recorded.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
