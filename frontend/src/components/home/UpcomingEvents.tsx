import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Tent, Clock, Users, AlertCircle } from 'lucide-react';
import { getApiBaseUrl } from '../../utils/api';

interface EventItem {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  location: string;
}

interface CampItem {
  id: string;
  name: string;
  campType: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string | null;
  capacity: number;
}

export const UpcomingEvents: React.FC = () => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [camps, setCamps] = useState<CampItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EVENTS' | 'CAMPS'>('ALL');

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(`${getApiBaseUrl()}/api/public/events`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => ({ events: [] })),
      fetch(`${getApiBaseUrl()}/api/public/camps`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => ({ camps: [] })),
    ])
      .then(([eventsData, campsData]) => {
        if (eventsData?.success && Array.isArray(eventsData.events)) {
          setEvents(eventsData.events);
        } else {
          setEvents([]);
        }
        if (campsData?.success && Array.isArray(campsData.camps)) {
          setCamps(campsData.camps);
        } else {
          setCamps([]);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching events/camps:', err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const formatDateBadge = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return { day: '—', month: 'TBD', year: '' };
      }
      return {
        day: String(d.getDate()).padStart(2, '0'),
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        year: String(d.getFullYear()),
      };
    } catch {
      return { day: '—', month: 'TBD', year: '' };
    }
  };

  const formatDateRange = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
      return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } catch {
      return '';
    }
  };

  const hasItems = events.length > 0 || camps.length > 0;
  const filteredEvents = activeTab === 'ALL' || activeTab === 'EVENTS' ? events : [];
  const filteredCamps = activeTab === 'ALL' || activeTab === 'CAMPS' ? camps : [];
  const tabItemCount = filteredEvents.length + filteredCamps.length;

  return (
    <section
      id="activities"
      className="section-py"
      style={{ backgroundColor: 'var(--color-surface)', scrollMarginTop: '80px' }}
      aria-label="Upcoming Activities and Camps"
    >
      <div className="container">
        {/* Section Header */}
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            <Calendar size={16} /> OPERATIONAL SCHEDULE
          </span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: 'var(--color-primary)', margin: '0.5rem 0' }}>
            Activities & Training Camps
          </h2>
          <p className="description" style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--color-text-secondary)' }}>
            Institutional training sessions, ceremonial parades, range firing, and annual training camp deployments.
          </p>
        </div>

        {/* Filter Tabs */}
        <div
          role="tablist"
          aria-label="Activity schedule filters"
          style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}
        >
          <button
            role="tab"
            aria-selected={activeTab === 'ALL'}
            onClick={() => setActiveTab('ALL')}
            style={{
              background: activeTab === 'ALL' ? 'var(--color-primary)' : 'var(--color-background)',
              color: activeTab === 'ALL' ? 'var(--color-background)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '50px',
              padding: '6px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            All Activities ({events.length + camps.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'EVENTS'}
            onClick={() => setActiveTab('EVENTS')}
            style={{
              background: activeTab === 'EVENTS' ? 'var(--color-primary)' : 'var(--color-background)',
              color: activeTab === 'EVENTS' ? 'var(--color-background)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '50px',
              padding: '6px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Unit Events ({events.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'CAMPS'}
            onClick={() => setActiveTab('CAMPS')}
            style={{
              background: activeTab === 'CAMPS' ? 'var(--color-primary)' : 'var(--color-background)',
              color: activeTab === 'CAMPS' ? 'var(--color-background)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '50px',
              padding: '6px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Training Camps ({camps.length})
          </button>
        </div>

        {/* Content States */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            <p>Loading activities and camp schedules...</p>
          </div>
        ) : !hasItems ? (
          /* Professional Institutional Empty State */
          <div
            style={{
              background: 'var(--color-background)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              padding: '3.5rem 2rem',
              maxWidth: '650px',
              margin: '0 auto',
              boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--color-info-soft)',
                border: '1px solid var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                color: 'var(--color-primary)',
              }}
            >
              <Calendar size={30} />
            </div>
            <h4
              style={{
                color: 'var(--color-primary)',
                fontSize: '1.25rem',
                marginBottom: '0.5rem',
                fontWeight: 700,
              }}
            >
              Training Calendar Under Command Review
            </h4>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.92rem',
                lineHeight: '1.6',
                maxWidth: '520px',
                margin: '0 auto',
              }}
            >
              Official schedules for Combined Annual Training Camps (CATC), special national integration camps, and weekly parade drills are gazetted in coordination with 2 Maharashtra Battalion HQ.
            </p>
          </div>
        ) : tabItemCount === 0 ? (
          /* Tab-specific empty notification */
          <div
            style={{
              background: 'var(--color-background)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              maxWidth: '550px',
              margin: '0 auto',
            }}
          >
            <AlertCircle size={28} style={{ color: 'var(--color-disabled)', margin: '0 auto 0.5rem' }} />
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.05rem', marginBottom: '0.3rem' }}>
              No items in this category
            </h4>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              Select "All Activities" to view the full operational calendar.
            </p>
          </div>
        ) : (
          /* Grid of verified events & camps */
          <div className="grid-2" style={{ gap: '1.5rem' }}>
            {/* Events List */}
            {filteredEvents.map((ev) => {
              const badge = formatDateBadge(ev.eventDate);
              return (
                <div
                  key={`event-${ev.id}`}
                  style={{
                    background: 'var(--color-background)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border)',
                    padding: '1.5rem',
                    display: 'flex',
                    gap: '1.25rem',
                    boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-primary)',
                      color: 'var(--color-background)',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      textAlign: 'center',
                      minWidth: '76px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{badge.day}</span>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-info-border)', marginTop: '2px' }}>
                      {badge.month}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-border)' }}>{badge.year}</span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--color-info-soft)',
                          color: 'var(--color-accent)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Unit Event
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '0.4rem' }}>
                      {ev.title}
                    </h3>
                    {ev.location && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <MapPin size={14} style={{ color: 'var(--color-accent)' }} />
                        {ev.location}
                      </p>
                    )}
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', lineHeight: '1.5' }}>
                      {ev.description}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Camps List */}
            {filteredCamps.map((cmp) => {
              const startBadge = formatDateBadge(cmp.startDate);
              const dateRange = formatDateRange(cmp.startDate, cmp.endDate);
              return (
                <div
                  key={`camp-${cmp.id}`}
                  style={{
                    background: 'var(--color-background)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border)',
                    padding: '1.5rem',
                    display: 'flex',
                    gap: '1.25rem',
                    boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-primary)',
                      color: 'var(--color-background)',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      textAlign: 'center',
                      minWidth: '76px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--color-accent)',
                    }}
                  >
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{startBadge.day}</span>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)', marginTop: '2px' }}>
                      {startBadge.month}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-border)' }}>{startBadge.year}</span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--color-info-soft)',
                          color: 'var(--color-accent)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Tent size={11} />
                        {cmp.campType || 'Training Camp'}
                      </span>
                      {cmp.capacity > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Users size={11} />
                          {cmp.capacity} Cadets
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '0.4rem' }}>
                      {cmp.name}
                    </h3>
                    {cmp.location && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        <MapPin size={14} style={{ color: 'var(--color-accent)' }} />
                        {cmp.location}
                      </p>
                    )}
                    {dateRange && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-accent)', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        <Clock size={13} />
                        {dateRange}
                      </p>
                    )}
                    {cmp.description && (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', lineHeight: '1.5' }}>
                        {cmp.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
