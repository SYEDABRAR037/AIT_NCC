import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Shield,
  Flag,
  Award,
  Users,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Filter,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  List,
  Grid,
} from 'lucide-react';

interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  eventType?: string;
  startDate?: string;
  date?: string;
  startTime?: string;
  endDate?: string;
  location: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED';
  organizer?: string;
  targetRole?: string;
  metadata?: any;
}

interface CalendarViewProps {
  userRole?: string;
  role?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ userRole, role }) => {
  const effectiveRole = role || userRole || 'CADET';
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Publish event modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'PARADE',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '0630 hrs',
    endDate: '',
    location: 'AIT Central Parade Grounds',
    targetRole: 'ALL',
    unit: '2 Maharashtra Battalion NCC',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const canPublish = ['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR'].includes(effectiveRole);

  const getAuthToken = () => {
    return localStorage.getItem('ncc_auth_token') || localStorage.getItem('token');
  };

  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/calendar', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to retrieve Master Calendar from defense operations server');
      }

      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message || 'Error loading calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [effectiveRole]);

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const token = getAuthToken();
      const payload = {
        title: formData.title,
        description: formData.description,
        eventType: formData.eventType,
        type: formData.eventType,
        eventDate: formData.startDate,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate || undefined,
        location: formData.location,
        targetRole: formData.targetRole,
        organizer: userRole,
      };

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to publish event');
      }

      setSubmitSuccess('Official calendar event published successfully');
      setFormData({
        title: '',
        description: '',
        eventType: 'PARADE',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '0630 hrs',
        endDate: '',
        location: 'AIT Central Parade Grounds',
        targetRole: 'ALL',
        unit: '2 Maharashtra Battalion NCC',
      });
      setTimeout(() => {
        setIsPublishModalOpen(false);
        setSubmitSuccess(null);
        fetchCalendar();
      }, 700);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to publish event');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PARADE':
        return {
          label: 'PARADE',
          icon: <Shield size={13} />,
          background: '#ECFDF5',
          color: '#065F46',
          border: '1px solid #A7F3D0',
        };
      case 'TRAINING':
        return {
          label: 'TRAINING',
          icon: <Users size={13} />,
          background: '#EFF6FF',
          color: '#1E40AF',
          border: '1px solid #BFDBFE',
        };
      case 'CAMP':
        return {
          label: 'CAMP',
          icon: <Flag size={13} />,
          background: '#FEF3C7',
          color: '#92400E',
          border: '1px solid #FCD34D',
        };
      case 'DUTY':
        return {
          label: 'GUARD / DUTY',
          icon: <Award size={13} />,
          background: '#F0F9FF',
          color: '#0369A1',
          border: '1px solid #BAE6FD',
        };
      default:
        return {
          label: 'ACTIVITY',
          icon: <CalendarIcon size={13} />,
          background: '#FAF5FF',
          color: '#6B21A8',
          border: '1px solid #E9D5FF',
        };
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
      case 'ONGOING':
        return { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' };
      default:
        return { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' };
    }
  };

  const filteredEvents = events.filter(
    (ev) => typeFilter === 'ALL' || ev.type === typeFilter
  );

  // Month navigation helpers
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
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
              <span className="badge-institutional">MASTER CALENDAR & OPERATIONS</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)' }}>
                Live Training, Camps & Ceremonial Schedule
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
              <CalendarIcon size={24} style={{ color: 'var(--navy-primary)' }} />
              Master Calendar
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginTop: '0.35rem' }}>
              Unified command schedule synchronizing parades, weapons training, nationwide camps, and battalion guard duties.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'var(--white-surface)',
                border: '1px solid var(--white-border)',
                borderRadius: '4px',
                padding: '2px',
              }}
            >
              <button
                onClick={() => setViewMode('month')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  background: viewMode === 'month' ? 'var(--navy-primary)' : 'transparent',
                  color: viewMode === 'month' ? 'var(--white-pure)' : 'var(--navy-text-muted)',
                }}
              >
                <Grid size={13} />
                <span>Month</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  background: viewMode === 'list' ? 'var(--navy-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--white-pure)' : 'var(--navy-text-muted)',
                }}
              >
                <List size={13} />
                <span>List</span>
              </button>
            </div>

            {canPublish && (
              <button
                onClick={() => setIsPublishModalOpen(true)}
                className="btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={15} />
                <span>PUBLISH EVENT</span>
              </button>
            )}

            <button
              onClick={fetchCalendar}
              disabled={loading}
              className="btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        {/* Filter Stream Bar */}
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
              <Filter size={14} /> STREAM:
            </span>
            {[
              { key: 'ALL', label: 'All Operations' },
              { key: 'PARADE', label: 'Parades & Drills' },
              { key: 'TRAINING', label: 'Theory / Weapon' },
              { key: 'CAMP', label: 'Camps' },
              { key: 'DUTY', label: 'Guard & Protocol' },
              { key: 'ACTIVITY', label: 'Institutional Events' },
            ].map((tab) => {
              const active = typeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setTypeFilter(tab.key)}
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

          <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
            Showing {filteredEvents.length} scheduled event(s)
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
          <button onClick={fetchCalendar} className="btn-secondary btn-sm">
            RETRY
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <RefreshCw
            size={28}
            className="animate-spin"
            style={{ color: 'var(--navy-primary)', margin: '0 auto 1rem', display: 'block' }}
          />
          <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.9rem' }}>
            Synchronizing master defense operational calendar...
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <CalendarIcon size={40} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', fontWeight: 700, marginBottom: '0.35rem' }}>
            No calendar events available.
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', maxWidth: '480px', margin: '0 auto' }}>
            There are currently no active operations or scheduled drills matching your selected stream.
          </p>
        </div>
      ) : viewMode === 'month' ? (
        /* Month Grid View */
        <div className="institutional-card" style={{ padding: '1.5rem' }}>
          {/* Month Header Navigation */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: '1.35rem', color: 'var(--navy-primary)', fontWeight: 800, margin: 0 }}>
              {monthName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={prevMonth}
                className="btn-secondary btn-sm"
                style={{ padding: '0.35rem 0.6rem' }}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="btn-secondary btn-sm"
                style={{ padding: '0.35rem 0.6rem' }}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
              textAlign: 'center',
              marginBottom: '4px',
            }}
          >
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
              <div
                key={day}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--navy-text-muted)',
                  padding: '0.4rem',
                  background: 'var(--white-surface)',
                  borderRadius: '3px',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
            }}
          >
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{
                      minHeight: '100px',
                      background: '#F8FAFC',
                      borderRadius: '4px',
                      opacity: 0.5,
                    }}
                  />
                );
              }

              const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = filteredEvents.filter((ev) => {
                const evDateStr = (ev.startDate || ev.date || '').slice(0, 10);
                return evDateStr === cellDateStr;
              });

              const isToday =
                new Date().toDateString() === new Date(year, month, day).toDateString();

              return (
                <div
                  key={`day-${day}`}
                  style={{
                    minHeight: '100px',
                    background: isToday ? '#F0F9FF' : 'var(--white-pure)',
                    border: isToday ? '1.5px solid var(--navy-primary)' : '1px solid var(--white-border)',
                    borderRadius: '4px',
                    padding: '0.45rem',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: isToday ? 800 : 600,
                        color: isToday ? 'var(--navy-primary)' : 'var(--navy-text)',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: isToday ? 'var(--navy-badge-bg)' : 'transparent',
                      }}
                    >
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--navy-text-muted)',
                        }}
                      >
                        {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Day Events Pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const badge = getTypeBadge(ev.type);
                      return (
                        <div
                          key={ev.id}
                          title={`${ev.title} (${badge.label}) - ${ev.location}`}
                          style={{
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            background: badge.background,
                            color: badge.color,
                            border: badge.border,
                            cursor: 'pointer',
                          }}
                        >
                          {ev.startTime ? `${ev.startTime.split(' ')[0]} ` : ''}
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Event Cards Grid View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredEvents.map((ev) => {
            const badge = getTypeBadge(ev.type);
            const rawDate = ev.startDate || ev.date;
            const startDate = rawDate ? new Date(rawDate) : new Date();
            const endDate = ev.endDate ? new Date(ev.endDate) : null;
            const statusStyle = getStatusBadgeStyle(ev.status);

            return (
              <div
                key={ev.id}
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
                  {/* Top tags */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: badge.background,
                        color: badge.color,
                        border: badge.border,
                      }}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>

                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        ...statusStyle,
                      }}
                    >
                      {ev.status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      color: 'var(--navy-primary)',
                      fontWeight: 700,
                      marginBottom: '0.4rem',
                    }}
                  >
                    {ev.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--navy-text-muted)',
                      lineHeight: 1.45,
                      marginBottom: '0.85rem',
                    }}
                  >
                    {ev.description || 'Official institutional event and assembly scheduled on NCC master roster.'}
                  </p>
                </div>

                {/* Footer metadata */}
                <div
                  style={{
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--white-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--navy-text)' }}>
                    <Clock size={14} style={{ color: 'var(--navy-primary)', flexShrink: 0 }} />
                    <span>
                      {startDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {ev.startTime && ` • ${ev.startTime}`}
                      {endDate &&
                        ` - ${endDate.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}`}
                    </span>
                  </div>

                  {ev.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--navy-text-muted)' }}>
                      <MapPin size={14} style={{ color: 'var(--navy-text-muted)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Publish Event Modal */}
      {isPublishModalOpen && (
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
                <CalendarIcon size={20} style={{ color: 'var(--navy-primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', fontWeight: 700, margin: 0 }}>
                    Publish Master Calendar Event
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)', margin: 0 }}>
                    Broadcast operational assembly or ceremonial event to unit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
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

            {submitError && (
              <div
                style={{
                  margin: '1rem 1.5rem 0',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  background: '#FEE2E2',
                  border: '1px solid #F87171',
                  color: '#991B1B',
                  fontSize: '0.85rem',
                }}
              >
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div
                style={{
                  margin: '1rem 1.5rem 0',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  background: '#ECFDF5',
                  border: '1px solid #34D399',
                  color: '#065F46',
                  fontSize: '0.85rem',
                }}
              >
                {submitSuccess}
              </div>
            )}

            <form onSubmit={handlePublishSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Combined Battalion Foot Drill & Turnout"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Event Stream *
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
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
                    <option value="PARADE">Parade & Drill</option>
                    <option value="TRAINING">Theory / Weapon Drill</option>
                    <option value="CAMP">Battalion Camp</option>
                    <option value="DUTY">Guard of Honour / Duty</option>
                    <option value="ACTIVITY">Institutional Event</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Target Role *
                  </label>
                  <select
                    value={formData.targetRole}
                    onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
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
                    <option value="ALL">All Unit Personnel</option>
                    <option value="CADET">Cadets Only</option>
                    <option value="SENIOR">Seniors & Officers</option>
                    <option value="PLATOON_SENIOR">Platoon Commanders</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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
                    Start Timing *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0630 hrs"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Venue / Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
                  Instructions & Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Dress orders, reporting instructions, turnout requirements..."
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
                  onClick={() => setIsPublishModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-sm"
                >
                  {submitting ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
