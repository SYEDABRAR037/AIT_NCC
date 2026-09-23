import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle,
  Award,
  Tent,
  FileText,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Shield,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  category: string;
  title: string;
  description: string;
  createdAt?: string;
  eventDate?: string;
  actorRole?: string;
  user?: {
    id?: string;
    name?: string;
    fullName?: string;
    regimentalNumber?: string;
    rank?: string;
    platoonName?: string;
  };
  cadet?: {
    id?: string;
    name?: string;
    fullName?: string;
    regimentalNumber?: string;
    rank?: string;
    platoonName?: string;
  };
  metadata?: any;
}

interface TimelineViewProps {
  userRole?: string;
  role?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ userRole, role }) => {
  const effectiveRole = role || userRole || 'CADET';
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const isOfficer = ['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO'].includes(effectiveRole);

  const getAuthToken = () => {
    return localStorage.getItem('ncc_auth_token') || localStorage.getItem('token');
  };

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const endpoint = isOfficer ? '/api/timeline/unit' : '/api/timeline/my';
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to retrieve timeline records from defense audit server');
      }

      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message || 'Error loading timeline events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [effectiveRole]);

  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case 'ATTENDANCE':
        return { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' };
      case 'CAMP':
        return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
      case 'DUTY':
        return { background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' };
      case 'CERTIFICATE':
        return { background: '#FAF5FF', color: '#6B21A8', border: '1px solid #E9D5FF' };
      case 'LEAVE':
        return { background: '#FFF7ED', color: '#C2410C', border: '1px solid #FFEDD5' };
      case 'REQUEST':
        return { background: '#EEF2FF', color: '#3730A3', border: '1px solid #E0E7FF' };
      case 'REGISTRATION':
        return { background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1' };
      case 'APPROVAL':
        return { background: '#ECFDF5', color: '#047857', border: '1px solid #6EE7B7' };
      default:
        return { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ATTENDANCE':
        return <UserCheck size={13} />;
      case 'CAMP':
        return <Tent size={13} />;
      case 'DUTY':
        return <Award size={13} />;
      case 'CERTIFICATE':
        return <CheckCircle size={13} />;
      case 'LEAVE':
        return <FileText size={13} />;
      case 'REGISTRATION':
      case 'APPROVAL':
        return <Shield size={13} />;
      default:
        return <Clock size={13} />;
    }
  };

  const filteredEvents = events.filter((ev) => {
    const matchesCategory = categoryFilter === 'ALL' || ev.category === categoryFilter;
    const userName = ev.user?.name || ev.cadet?.fullName || '';
    const userReg = ev.user?.regimentalNumber || ev.cadet?.regimentalNumber || '';
    const matchesSearch =
      searchTerm === '' ||
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userReg.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Banner */}
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
              <span className="badge-institutional">MILITARY SERVICE AUDIT LOG</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)' }}>
                Auto-Generated Institutional Records
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
              <Clock size={24} style={{ color: 'var(--navy-primary)' }} />
              Activity Timeline
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginTop: '0.35rem' }}>
              Chronological immutable ledger tracking parade attendance, camps, sanctioned leaves, guard duties, and verified credentials.
            </p>
          </div>

          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>REFRESH STREAM</span>
          </button>
        </div>

        {/* Filter Toolbar */}
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
          {/* Categories */}
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
              <Filter size={14} /> CATEGORY:
            </span>
            {[
              { key: 'ALL', label: 'All Activities' },
              { key: 'ATTENDANCE', label: 'Attendance' },
              { key: 'CAMP', label: 'Camps' },
              { key: 'DUTY', label: 'Duties' },
              { key: 'LEAVE', label: 'Leaves' },
              { key: 'CERTIFICATE', label: 'Certificates' },
              { key: 'REQUEST', label: 'Requests' },
              { key: 'APPROVAL', label: 'Approvals' },
              { key: 'REGISTRATION', label: 'Enrollment' },
            ].map((cat) => {
              const active = categoryFilter === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
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
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
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
              placeholder="Search timeline..."
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
            <AlertTriangle size={22} style={{ color: '#DC2626' }} />
            <div>
              <h4 style={{ color: '#DC2626', fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>
                Operational Synchronization Alert
              </h4>
              <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
            </div>
          </div>
          <button onClick={fetchTimeline} className="btn-secondary btn-sm">
            RETRY
          </button>
        </div>
      )}

      {/* Main Timeline Stream */}
      {loading ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <RefreshCw
            size={28}
            className="animate-spin"
            style={{ color: 'var(--navy-primary)', margin: '0 auto 1rem', display: 'block' }}
          />
          <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.9rem' }}>
            Synchronizing activity records from defense ledger...
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Clock size={40} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-primary)', fontWeight: 700, marginBottom: '0.4rem' }}>
            No Activity Recorded Yet
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', maxWidth: '520px', margin: '0 auto 0.5rem' }}>
            {searchTerm || categoryFilter !== 'ALL'
              ? 'No activity matched your current filter criteria.'
              : 'There are currently no NCC activities or institutional records to display.'}
          </p>
          {!searchTerm && categoryFilter === 'ALL' && (
            <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', maxWidth: '560px', margin: '0 auto', opacity: 0.85 }}>
              New attendance, enquiries, approvals, leaves, camps, duties, certificates, and other authorized activities will appear here automatically when they occur.
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            paddingLeft: '2.5rem',
            borderLeft: '2px solid #CBD5E1',
            marginLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {filteredEvents.map((ev, index) => {
            const rawDate = ev.createdAt || ev.eventDate;
            const dateObj = rawDate ? new Date(rawDate) : new Date();
            const formattedDate = dateObj.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const formattedTime = dateObj.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const cadetName = ev.user?.name || ev.cadet?.fullName;
            const cadetReg = ev.user?.regimentalNumber || ev.cadet?.regimentalNumber;
            const badgeStyle = getCategoryBadgeStyle(ev.category);

            return (
              <div key={ev.id || index} style={{ position: 'relative' }}>
                {/* Timeline node circle */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-3.15rem',
                    top: '1.25rem',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--white-pure)',
                    border: '3px solid var(--navy-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--navy-primary)',
                    }}
                  />
                </div>

                {/* Event Card */}
                <div
                  className="institutional-card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderLeft: '4px solid var(--navy-primary)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '3px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          ...badgeStyle,
                        }}
                      >
                        {getCategoryIcon(ev.category)}
                        {ev.category}
                      </span>

                      {ev.actorRole && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                          By {ev.actorRole.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.78rem',
                        color: 'var(--navy-text-muted)',
                      }}
                    >
                      <Calendar size={13} />
                      <span>
                        {formattedDate} &bull; {formattedTime}
                      </span>
                    </div>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.05rem',
                      color: 'var(--navy-primary)',
                      fontWeight: 700,
                      marginBottom: '0.35rem',
                    }}
                  >
                    {ev.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--navy-text-muted)',
                      lineHeight: 1.45,
                      margin: 0,
                    }}
                  >
                    {ev.description}
                  </p>

                  {cadetName && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        paddingTop: '0.65rem',
                        borderTop: '1px solid var(--white-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.78rem',
                        color: 'var(--navy-text-muted)',
                      }}
                    >
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'var(--navy-badge-bg)',
                          color: 'var(--navy-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                        }}
                      >
                        {cadetName.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>
                        {cadetName}
                      </span>
                      {cadetReg && (
                        <span>({cadetReg})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimelineView;
