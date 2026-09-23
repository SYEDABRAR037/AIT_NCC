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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;


    const headers = { Authorization: `Bearer ${token}` };

    // Fetch personal records in parallel
    Promise.all([
      // 1. Attendance
      fetch('/api/attendance/my', { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
      // 2. Certificates
      fetch('/api/certificates/my', { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
      // 3. Camps
      fetch('/api/camps', { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
      // 4. Duties
      fetch('/api/duties/my', { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
      // 5. Leaves
      fetch('/api/leave/my', { headers })
        .then((r) => r.json())
        .catch(() => ({ success: false })),
    ])
      .then(([attRes, certRes, campRes, dutyRes, leaveRes]) => {
        if (attRes.success && attRes.stats) setAttendanceStats(attRes.stats);
        if (certRes.success && certRes.certificates) setCertificates(certRes.certificates);
        if (dutyRes.success && dutyRes.duties) setDuties(dutyRes.duties);
        if (leaveRes.success && leaveRes.leaves) setLeaves(leaveRes.leaves);

        // Filter camps for user participation
        if (campRes.success && campRes.camps) {
          const userCamps = campRes.camps.filter((c: any) =>
            c.participants?.some((p: any) => p.cadetId === user?.id)
          );
          setCamps(userCamps);
        }
      })
      .finally(() => setLoading(false));
  }, [token, user?.id]);

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
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
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
              border: '3px solid #CBD5E1',
            }}
          >
            {user?.fullName?.charAt(0) || 'C'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--navy-primary)', margin: 0 }}>
                {user?.fullName}
              </h2>
              <span className="badge-institutional" style={{ background: '#ECFDF5', color: '#047857' }}>
                {user?.status || 'ACTIVE'}
              </span>
              <span className="badge-institutional">CADET</span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', marginTop: '0.35rem' }}>
              Regimental No: <strong>{user?.regimentalNumber}</strong> &bull; Roll: <strong>{user?.collegeRollNumber}</strong> &bull; Platoon: <strong>{user?.platoonName}</strong>
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
              <span style={{ fontWeight: 700 }}>{user?.fullName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>College Roll Number</span>
              <span style={{ fontWeight: 700 }}>{user?.collegeRollNumber}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Academic Year</span>
              <span style={{ fontWeight: 700 }}>{user?.year}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Engineering Branch</span>
              <span style={{ fontWeight: 700 }}>{user?.branch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Email Address</span>
              <span>{user?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Contact Phone</span>
              <span>{user?.phone || 'On Record (Confidential)'}</span>
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
              <span style={{ fontWeight: 700 }}>{user?.battalion || '2 Maharashtra Battalion NCC'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Company</span>
              <span style={{ fontWeight: 700 }}>{user?.company || 'Bravo Company'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Directorate & Group</span>
              <span style={{ fontWeight: 700 }}>{user?.group || 'Pune Group HQ'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Assigned Platoon</span>
              <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>{user?.platoonName || 'Alpha Platoon'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.4rem' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Cadet Squad / Section</span>
              <span style={{ fontWeight: 700 }}>{user?.team || 'Section 1 (Alpha)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--navy-text-muted)', fontWeight: 600 }}>Enrollment Date</span>
              <span>{user?.dateOfJoining ? new Date(user.dateOfJoining).toLocaleDateString() : 'Active Regimental'}</span>
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
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0369A1', marginBottom: '0.35rem' }}>
              <CalendarCheck size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>ATTENDANCE</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isEligible ? '#047857' : '#DC2626' }}>
              {percentage}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
              {attendanceStats?.present || 0} Present / {attendanceStats?.total || 0} Parades
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 700, color: isEligible ? '#059669' : '#D97706' }}>
              {isEligible ? '✓ Certificate Exam Eligible' : '⚠️ Below 75% Threshold'}
            </div>
          </div>

          {/* Certificates Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#EA580C', marginBottom: '0.35rem' }}>
              <Award size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>CERTIFICATES</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A192F' }}>
              {certificates.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
              Verified Vault Records
            </div>
          </div>

          {/* Camps Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7C3AED', marginBottom: '0.35rem' }}>
              <Tent size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>CAMPS</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A192F' }}>
              {camps.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
              CATC / NIC / RDC / Pre-RDC
            </div>
          </div>

          {/* Duties Stat Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857', marginBottom: '0.35rem' }}>
              <Briefcase size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>DUTIES</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A192F' }}>
              {duties.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
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
            <p style={{ fontSize: '0.82rem', color: '#64748B' }}>No leave applications filed on record.</p>
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
                    background: '#F8FAFC',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <strong>{l.leaveType} Leave</strong> &mdash; {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()}
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Reason: {l.reason}</div>
                  </div>
                  <span
                    className="badge-institutional"
                    style={{
                      background: l.status === 'APPROVED' ? '#ECFDF5' : l.status === 'REJECTED' ? '#FEF2F2' : '#FEF3C7',
                      color: l.status === 'APPROVED' ? '#047857' : l.status === 'REJECTED' ? '#DC2626' : '#92400E',
                    }}
                  >
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
