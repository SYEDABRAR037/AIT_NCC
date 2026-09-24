import React, { useState, useEffect } from 'react';
import {
  Award,
  Shield,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { safeApiFetch } from '../../utils/api';

interface DutyItem {
  id: string;
  title?: string;
  cadetId?: string;
  assignedCadetId?: string;
  dutyType: string;
  date?: string;
  dutyDate?: string;
  location: string;
  reportingTime?: string;
  instructions?: string;
  status: 'ASSIGNED' | 'COMPLETED' | 'EXCUSED';
  assignedByRole?: string;
  cadet?: {
    id: string;
    name?: string;
    fullName?: string;
    regimentalNumber?: string;
    rank?: string;
    company?: string;
    battalion?: string;
    platoonName?: string;
  };
  assignedBy?: {
    fullName?: string;
    role?: string;
  };
}

interface CadetOption {
  id: string;
  name: string;
  regimentalNumber?: string;
  rank?: string;
  platoonName?: string;
}

interface DutyRosterViewProps {
  userRole?: string;
  role?: string;
}

export const DutyRosterView: React.FC<DutyRosterViewProps> = ({ userRole, role }) => {
  const effectiveRole = role || userRole || 'CADET';
  const [duties, setDuties] = useState<DutyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Assign duty modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [cadetOptions, setCadetOptions] = useState<CadetOption[]>([]);
  const [assignForm, setAssignForm] = useState({
    title: '',
    cadetId: '',
    dutyType: 'GUARD_OF_HONOUR',
    date: new Date().toISOString().split('T')[0],
    location: 'AIT Main Gate & Central Plaza',
    reportingTime: '0630 hrs in ceremonial dress',
    instructions: 'Ceremonial drill kit, polished boots, brass items sparkled, beret hackle dressed.',
  });
  const [submittingDuty, setSubmittingDuty] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const isOfficer = ['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO'].includes(effectiveRole);

  const fetchDuties = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = isOfficer ? '/api/duties/unit' : '/api/duties/my';
      const { ok, data } = await safeApiFetch(url);

      if (!ok) {
        throw new Error(data?.message || 'Failed to retrieve duty assignments from defense server');
      }

      setDuties(data?.duties || []);
    } catch (err: any) {
      setError(err.message || 'Error loading duties');
    } finally {
      setLoading(false);
    }
  };

  const fetchCadetsForAssignment = async () => {
    try {
      const { ok, data } = await safeApiFetch('/api/duties/cadets');
      if (ok && data?.cadets) {
        const rawUsers = data.cadets || [];
        setCadetOptions(
          rawUsers.map((u: any) => ({
            id: u.id,
            name: u.fullName || u.name,
            regimentalNumber: u.regimentalNumber,
            rank: u.rank || 'CDT',
            platoonName: u.platoonName,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load cadets for duty assignment:', err);
    }
  };

  useEffect(() => {
    fetchDuties();
    if (isOfficer) {
      fetchCadetsForAssignment();
    }
  }, [effectiveRole]);

  const handleAssignDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDuty(true);
    try {
      const payload = {
        title: assignForm.title.trim() || `${getDutyTypeLabel(assignForm.dutyType)} Detail`,
        dutyType: assignForm.dutyType,
        location: assignForm.location,
        dutyDate: assignForm.date,
        date: assignForm.date,
        reportingTime: assignForm.reportingTime,
        instructions: assignForm.instructions,
        assignedCadetId: assignForm.cadetId,
        cadetId: assignForm.cadetId,
      };

      const { ok, data } = await safeApiFetch('/api/duties/assign', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!ok) {
        throw new Error(data?.message || data?.error || 'Failed to assign duty');
      }

      setIsAssignModalOpen(false);
      setAssignForm({
        title: '',
        cadetId: '',
        dutyType: 'GUARD_OF_HONOUR',
        date: new Date().toISOString().split('T')[0],
        location: 'AIT Main Gate & Central Plaza',
        reportingTime: '0630 hrs in ceremonial dress',
        instructions: 'Ceremonial drill kit, polished boots, brass items sparkled, beret hackle dressed.',
      });
      fetchDuties();
    } catch (err: any) {
      alert(err.message || 'Error assigning duty');
    } finally {
      setSubmittingDuty(false);
    }
  };

  const handleUpdateStatus = async (dutyId: string, newStatus: string) => {
    setStatusUpdating(dutyId);
    try {
      const { ok, data } = await safeApiFetch(`/api/duties/${dutyId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!ok) {
        throw new Error(data?.message || data?.error || 'Failed to update duty status');
      }

      fetchDuties();
    } catch (err: any) {
      alert(err.message || 'Error updating duty status');
    } finally {
      setStatusUpdating(null);
    }
  };

  const getDutyTypeLabel = (type: string) => {
    switch (type) {
      case 'GUARD_OF_HONOUR':
        return 'Guard of Honour';
      case 'PILOT_DUTY':
        return 'VIP Pilot Escort';
      case 'FLAG_HOISTING':
        return 'Flag Hoisting & Protocol';
      case 'QUARTER_GUARD':
        return 'Quarter Guard Sentry';
      case 'CAMP_DUTY':
        return 'Camp Security & Mess';
      case 'CAMPUS_SECURITY':
        return 'Campus Security Detail';
      default:
        return (type || 'DUTY').replace(/_/g, ' ');
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return {
          background: '#FEF3C7',
          color: '#92400E',
          border: '1px solid #FCD34D',
        };
      case 'COMPLETED':
        return {
          background: '#ECFDF5',
          color: '#065F46',
          border: '1px solid #A7F3D0',
        };
      case 'EXCUSED':
        return {
          background: '#F1F5F9',
          color: '#475569',
          border: '1px solid #CBD5E1',
        };
      default:
        return {
          background: '#F1F5F9',
          color: '#475569',
          border: '1px solid #CBD5E1',
        };
    }
  };

  const filteredDuties = duties.filter((d) => {
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const cadetName = d.cadet?.fullName || d.cadet?.name || '';
    const cadetReg = d.cadet?.regimentalNumber || '';
    const dutyTitle = d.title || '';
    const matchesSearch =
      searchTerm === '' ||
      d.dutyType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dutyTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cadetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cadetReg.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Card */}
      <div
        className="institutional-card"
        style={{
          borderLeft: '5px solid var(--navy-primary)',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          padding: '1.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span className="badge-institutional">CEREMONIAL & SECURITY ROSTER</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)' }}>
                Official Battalion Duty Detail
              </span>
            </div>
            <h1
              style={{
                fontSize: '1.75rem',
                color: 'var(--navy-primary)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                margin: 0,
              }}
            >
              <Award size={24} style={{ color: 'var(--navy-primary)' }} />
              Duty & Ceremonial Detail
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginTop: '0.35rem' }}>
              Turnout orders, reporting times, protocol escort details, and performance audits for Guard of Honour and Sentry posts.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {isOfficer && (
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={15} />
                <span>ASSIGN DETAIL</span>
              </button>
            )}
            <button
              onClick={fetchDuties}
              disabled={loading}
              className="btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--white-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--navy-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginRight: '0.4rem',
              }}
            >
              <Filter size={14} /> STATUS:
            </span>
            {[
              { key: 'ALL', label: `All Duties (${duties.length})` },
              { key: 'ASSIGNED', label: `Active Assigned (${duties.filter((d) => d.status === 'ASSIGNED').length})` },
              { key: 'COMPLETED', label: `Completed (${duties.filter((d) => d.status === 'COMPLETED').length})` },
              { key: 'EXCUSED', label: `Excused (${duties.filter((d) => d.status === 'EXCUSED').length})` },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--navy-primary)' : '1px solid var(--white-border)',
                    background: active ? 'var(--navy-primary)' : 'var(--white-pure)',
                    color: active ? 'var(--white-pure)' : 'var(--navy-text-muted)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--navy-text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search duties or cadets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                borderRadius: '4px',
                border: '1px solid var(--white-border)',
                fontSize: '0.85rem',
                color: 'var(--navy-text)',
                background: 'var(--white-pure)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="institutional-card"
          style={{
            borderLeft: '4px solid #DC2626',
            padding: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={22} style={{ color: '#DC2626' }} />
            <div>
              <h4 style={{ color: '#DC2626', fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>
                Operational Synchronization Alert
              </h4>
              <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
            </div>
          </div>
          <button onClick={fetchDuties} className="btn-secondary btn-sm">
            RETRY
          </button>
        </div>
      )}

      {/* Duties List */}
      {loading ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <RefreshCw
            size={28}
            className="animate-spin"
            style={{ color: 'var(--navy-primary)', margin: '0 auto 1rem', display: 'block' }}
          />
          <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.9rem' }}>
            Retrieving verified battalion duty assignments...
          </p>
        </div>
      ) : filteredDuties.length === 0 ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Shield size={40} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase' }}>
            NO DUTIES ASSIGNED
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', maxWidth: '480px', margin: '0 auto' }}>
            No duty or ceremonial assignments are currently available.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredDuties.map((duty) => {
            const rawDate = duty.date || duty.dutyDate;
            const dutyDate = rawDate ? new Date(rawDate) : new Date();
            const isPending = duty.status === 'ASSIGNED';
            const cadetDisplayName = duty.cadet?.fullName || duty.cadet?.name;
            const badgeStyle = getStatusBadgeStyle(duty.status);

            return (
              <div
                key={duty.id}
                className="institutional-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '4px solid var(--navy-primary)',
                  padding: '1.25rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span className="badge-institutional" style={{ fontSize: '0.72rem' }}>
                      {getDutyTypeLabel(duty.dutyType)}
                    </span>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        ...badgeStyle,
                      }}
                    >
                      {duty.status}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.05rem',
                      color: 'var(--navy-primary)',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {duty.title || getDutyTypeLabel(duty.dutyType)}
                  </h3>

                  {cadetDisplayName && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        background: 'var(--white-surface)',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '4px',
                        border: '1px solid var(--white-border)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--navy-primary)',
                          color: 'var(--white-pure)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        {cadetDisplayName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                          {duty.cadet?.rank ? `${duty.cadet.rank} ` : ''}
                          {cadetDisplayName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                          {duty.cadet?.regimentalNumber || 'Cadet'} &bull;{' '}
                          {duty.cadet?.platoonName || duty.cadet?.company || 'Senior Division'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--navy-text)' }}>
                      <Clock size={14} style={{ color: 'var(--navy-primary)', flexShrink: 0 }} />
                      <span>
                        {dutyDate.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        &bull; {duty.reportingTime || '0630 hrs'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--navy-text-muted)' }}>
                      <MapPin size={14} style={{ color: 'var(--navy-text-muted)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {duty.location}
                      </span>
                    </div>
                  </div>

                  {duty.instructions && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.65rem',
                        borderRadius: '4px',
                        background: 'var(--white-surface)',
                        border: '1px solid var(--white-border)',
                        fontSize: '0.78rem',
                        color: 'var(--navy-text-muted)',
                        lineHeight: 1.4,
                      }}
                    >
                      <strong style={{ color: 'var(--navy-primary)' }}>Turnout Orders:</strong> {duty.instructions}
                    </div>
                  )}
                </div>

                {/* Officer Action buttons */}
                {isOfficer && isPending && (
                  <div
                    style={{
                      marginTop: '1rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--white-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      onClick={() => handleUpdateStatus(duty.id, 'COMPLETED')}
                      disabled={statusUpdating === duty.id}
                      className="btn-primary btn-sm"
                      style={{
                        flex: 1,
                        background: '#047857',
                        borderColor: '#047857',
                        fontSize: '0.78rem',
                        padding: '0.45rem',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Mark Completed</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(duty.id, 'EXCUSED')}
                      disabled={statusUpdating === duty.id}
                      className="btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                    >
                      Excuse
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Duty Modal */}
      {isAssignModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(3, 11, 23, 0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--white-pure)',
              borderRadius: '8px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--white-border)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--white-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--white-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Award size={20} style={{ color: 'var(--navy-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', fontWeight: 700, margin: 0 }}>
                    Assign Duty / Ceremonial Detail
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)', margin: 0 }}>
                    Commission guard detail and synchronize with Master Calendar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--navy-text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignDuty} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Duty Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Duty Title / Occasion
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Guard of Honour for GOC Visit"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.88rem',
                    color: 'var(--navy-text)',
                  }}
                />
              </div>

              {/* Cadet Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Assign To Cadet *
                </label>
                <select
                  required
                  value={assignForm.cadetId}
                  onChange={(e) => setAssignForm({ ...assignForm, cadetId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.88rem',
                    color: 'var(--navy-text)',
                    background: 'var(--white-pure)',
                  }}
                >
                  <option value="">-- Select Cadet for Detail --</option>
                  {cadetOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.rank || 'CDT'} {c.name} ({c.regimentalNumber || 'No Reg'}) - {c.platoonName || 'Unit'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duty Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Ceremonial Detail Type *
                </label>
                <select
                  value={assignForm.dutyType}
                  onChange={(e) => setAssignForm({ ...assignForm, dutyType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.88rem',
                    color: 'var(--navy-text)',
                    background: 'var(--white-pure)',
                  }}
                >
                  <option value="GUARD_OF_HONOUR">Guard of Honour (VIP / Dignitary)</option>
                  <option value="PILOT_DUTY">VIP Pilot Escort</option>
                  <option value="FLAG_HOISTING">Flag Hoisting & Ceremonial Protocol</option>
                  <option value="QUARTER_GUARD">Quarter Guard 24h Sentry</option>
                  <option value="CAMP_DUTY">Camp Security & Mess Duty</option>
                  <option value="CAMPUS_SECURITY">Campus Security Detail</option>
                </select>
              </div>

              {/* Date & Reporting Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Duty Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={assignForm.date}
                    onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '4px',
                      border: '1px solid var(--white-border)',
                      fontSize: '0.88rem',
                      color: 'var(--navy-text)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Reporting Time *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0630 hrs"
                    value={assignForm.reportingTime}
                    onChange={(e) => setAssignForm({ ...assignForm, reportingTime: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '4px',
                      border: '1px solid var(--white-border)',
                      fontSize: '0.88rem',
                      color: 'var(--navy-text)',
                    }}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Venue / Location *
                </label>
                <input
                  type="text"
                  required
                  value={assignForm.location}
                  onChange={(e) => setAssignForm({ ...assignForm, location: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.88rem',
                    color: 'var(--navy-text)',
                  }}
                />
              </div>

              {/* Turnout Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Turnout & Tactical Instructions
                </label>
                <textarea
                  rows={3}
                  value={assignForm.instructions}
                  onChange={(e) => setAssignForm({ ...assignForm, instructions: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    fontSize: '0.85rem',
                    color: 'var(--navy-text)',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--white-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDuty}
                  className="btn-primary btn-sm"
                >
                  {submittingDuty ? 'Commissioning...' : 'Commission Duty Detail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyRosterView;
