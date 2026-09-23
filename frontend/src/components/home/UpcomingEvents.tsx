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
    <section id="activities" className="section-py" style={{ backgroundColor: '#F8FAFC' }} aria-label="Upcoming Activities and Camps">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: '#2563EB', fontWeight: 700 }}>
            <Calendar size={16} />
            OPERATIONAL SCHEDULE
          </span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: '#0A192F', margin: '0.5rem 0' }}>
            Activities & Training Camps
          </h2>
          <p className="description" style={{ maxWidth: '680px', margin: '0 auto', color: '#64748B' }}>
            Official schedule of battalion drill parades, weapon firing exercises, and national flagship camps.
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2.5rem' }}>
          <button
            onClick={() => setActiveTab('ALL')}
            style={{
              background: activeTab === 'ALL' ? '#0A192F' : '#FFFFFF',
              color: activeTab === 'ALL' ? '#FFFFFF' : '#475569',
              border: '1px solid #E2E8F0',
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
              background: activeTab === 'EVENTS' ? '#0A192F' : '#FFFFFF',
              color: activeTab === 'EVENTS' ? '#FFFFFF' : '#475569',
              border: '1px solid #E2E8F0',
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
              background: activeTab === 'CAMPS' ? '#0A192F' : '#FFFFFF',
              color: activeTab === 'CAMPS' ? '#FFFFFF' : '#475569',
              border: '1px solid #E2E8F0',
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
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
            Synchronizing operational schedule with database...
          </div>
        ) : !hasItems ? (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            textAlign: 'center',
            padding: '3.5rem 2rem',
            maxWidth: '650px',
            margin: '0 auto',
            boxShadow: '0 4px 15px rgba(6, 21, 43, 0.04)'
          }}>
            <Calendar size={40} style={{ color: '#CBD5E1', margin: '0 auto 1rem' }} />
            <h4 style={{ color: '#0A192F', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>
              No upcoming public activities published yet
            </h4>
            <p style={{ color: '#64748B', fontSize: '0.9rem', margin: 0 }}>
              Official parade and camp orders will appear here once sanctioned by the Battalion Command.
            </p>
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
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '1.5rem',
                      display: 'flex',
                      gap: '1.25rem',
                      boxShadow: '0 4px 15px rgba(6, 21, 43, 0.04)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        background: '#06152B',
                        color: '#FFFFFF',
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
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#93C5FD', marginTop: '2px' }}>{badge.month}</span>
                      <span style={{ fontSize: '0.7rem', color: '#CBD5E1' }}>{badge.year}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#EFF6FF', color: '#2563EB' }}>
                          Unit Event
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', color: '#0A192F', fontWeight: 700, marginBottom: '0.4rem' }}>
                        {ev.title}
                      </h3>
                      <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                        {ev.description}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#1E3A8A', fontWeight: 600 }}>
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
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '1.5rem',
                      display: 'flex',
                      gap: '1.25rem',
                      boxShadow: '0 4px 15px rgba(6, 21, 43, 0.04)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        background: '#0A192F',
                        color: '#FFFFFF',
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        textAlign: 'center',
                        minWidth: '76px',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #1E3A8A',
                      }}
                    >
                      <span style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{startBadge.day}</span>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D4AF37', marginTop: '2px' }}>{startBadge.month}</span>
                      <span style={{ fontSize: '0.7rem', color: '#CBD5E1' }}>{startBadge.year}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#FAF5FF', color: '#9333EA' }}>
                          <Tent size={11} style={{ display: 'inline', marginRight: '3px' }} />
                          {cmp.campType}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', color: '#0A192F', fontWeight: 700, marginBottom: '0.4rem' }}>
                        {cmp.name}
                      </h3>
                      <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                        {cmp.description || 'Annual Training Camp conducted by 2 Maharashtra Battalion NCC.'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#1E3A8A', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <MapPin size={13} />
                          {cmp.location}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748B' }}>
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
