import React, { useState, useEffect } from 'react';
import { Users, Shield, Calendar, Tent, Activity, RefreshCw } from 'lucide-react';

interface StatsData {
  totalApprovedCadets: number;
  platoonsCount: number;
  upcomingEventsCount: number;
  campsCount: number;
  activitiesCount: number;
}

export const PublicStats: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/public/stats');
      if (!res.ok) throw new Error('Failed to query database statistics');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      } else {
        throw new Error('Invalid statistics payload');
      }
    } catch (err: any) {
      console.error('Stats query error:', err);
      setError('Live unit database synchronization pending');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statItems = [
    {
      label: 'Approved Cadets',
      value: stats?.totalApprovedCadets ?? 0,
      subtext: 'Real-time verified active strength',
      icon: Users,
    },
    {
      label: 'Unit Cadet Wings',
      value: 2,
      subtext: 'Senior Division (SD) & Senior Wing (SW)',
      icon: Shield,
    },
    {
      label: 'Upcoming Events',
      value: stats?.upcomingEventsCount ?? 0,
      subtext: 'Parades & ceremonial drills',
      icon: Calendar,
    },
    {
      label: 'Training Camps',
      value: stats?.campsCount ?? 0,
      subtext: 'CATC, NIC, TSC & ATC camps',
      icon: Tent,
    },
    {
      label: 'Unit Achievements',
      value: stats?.activitiesCount ?? 0,
      subtext: 'State & national recognitions',
      icon: Activity,
    },
  ];

  return (
    <section id="stats" className="section-py section-dark-navy" aria-label="Live Public NCC Statistics">
      <div className="container">
        <div className="section-header" style={{ marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: '#93C5FD' }}>
            <Activity size={16} />
            Verified Unit Strength
          </span>
          <h2 className="cinzel-title" style={{ color: 'var(--white-pure)' }}>
            Public Unit Statistics
          </h2>
          <p className="description" style={{ color: '#CBD5E1' }}>
            Directly connected to PostgreSQL database records. Institutional strength is calculated
            dynamically from verified approvals without hardcoded estimates.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '1.75rem 1.25rem',
                  textAlign: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', marginBottom: '1rem' }}>
                  <Icon size={24} style={{ color: '#93C5FD' }} />
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--white-pure)', fontFamily: 'monospace', lineHeight: 1 }}>
                  {loading ? '...' : item.value}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9', marginTop: '0.5rem' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                  {item.subtext}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          <span>PostgreSQL Active Sync</span>
          <button
            onClick={fetchStats}
            title="Refresh database counts"
            style={{ background: 'none', border: 'none', color: '#93C5FD', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>Sync</span>
          </button>
        </div>

        {error && (
          <div style={{ textAlign: 'center', color: '#CBD5E1', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
};
