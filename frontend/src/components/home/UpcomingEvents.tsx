import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Tent } from 'lucide-react';

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
    Promise.all([
      fetch('/api/public/events').then((res) => res.json()).catch(() => ({ events: [] })),
      fetch('/api/public/camps').then((res) => res.json()).catch(() => ({ camps: [] })),
    ])
      .then(([eventsData, campsData]) => {
        if (eventsData?.success && eventsData.events) {
          setEvents(eventsData.events);
        }
        if (campsData?.success && campsData.camps) {
          setCamps(campsData.camps);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDateBadge = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      day: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      year: d.getFullYear(),
    };
  };

  const hasItems = events.length > 0 || camps.length > 0;

  return (
    <section id="activities" className="section-py" style={{ backgroundColor: 'var(--color-surface)' }} aria-label="Upcoming Activities and Camps">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            <Calendar size={16} />
            OPERATIONAL SCHEDULE
          </span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: 'var(--color-primary)', margin: '0.5rem 0' }}>
            Activities & Training Camps
          </h2>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2.5rem' }}>
          <button
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
            Camps ({camps.length})
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading activities...
          </div>
        ) : !hasItems ? (
          <div style={{
            background: 'var(--color-background)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            textAlign: 'center',
            padding: '3.5rem 2rem',
            maxWidth: '650px',
            margin: '0 auto',
            boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)'
          }}>
            <Calendar size={40} style={{ color: 'var(--color-border)', margin: '0 auto 1rem' }} />
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>
              No upcoming activities
            </h4>
          </div>
        ) : (
          <div className="grid-2" style={{ gap: '1.5rem' }}>
            {/* Events List */}
            {(activeTab === 'ALL' || activeTab === 'EVENTS') &&
              events.map((ev) => {
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
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-info-border)', marginTop: '2px' }}>{badge.month}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-border)' }}>{badge.year}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-info-soft)', color: 'var(--color-accent)' }}>
                          Unit Event
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '0.4rem' }}>
                        {ev.title}
                      </h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                        {ev.description}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <MapPin size={13} />
                          {ev.location}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Camps List */}
            {(activeTab === 'ALL' || activeTab === 'CAMPS') &&
              camps.map((cmp) => {
                const startBadge = formatDateBadge(cmp.startDate);
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
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gold)', marginTop: '2px' }}>{startBadge.month}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-border)' }}>{startBadge.year}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-info-soft)', color: 'var(--color-accent)' }}>
                          <Tent size={11} style={{ display: 'inline', marginRight: '3px' }} />
                          {cmp.campType}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '0.4rem' }}>
                        {cmp.name}
                      </h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                        {cmp.description || 'Annual Training Camp conducted by 2 Maharashtra Battalion NCC.'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <MapPin size={13} />
                          {cmp.location}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-secondary)' }}>
                          Capacity: {cmp.capacity} Cadets
                        </span>
                      </div>
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
