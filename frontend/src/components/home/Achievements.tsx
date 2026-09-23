import React, { useState, useEffect } from 'react';
import { Award, Trophy, Medal } from 'lucide-react';

interface AchievementItem {
  id: string;
  title: string;
  category: string;
  description: string;
  dateAwarded: string;
  cadetName?: string;
}

export const Achievements: React.FC = () => {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/achievements')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.achievements) {
          setAchievements(data.achievements);
        }
      })
      .catch((err) => console.error('Achievements query error:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section-py" aria-label="Unit Achievements">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Trophy size={16} />
            Institutional Laurels
          </span>
          <h2 className="cinzel-title">Unit Honours & Cadet Achievements</h2>
          <p className="description">
            Celebrating extraordinary dedication, marksmanship, ceremonial drill awards,
            and all-India camp selections earned by AIT NCC cadets.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--navy-text-muted)' }}>
            Retrieving honour records...
          </div>
        ) : achievements.length === 0 ? (
          <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Award size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
            <h4 style={{ color: 'var(--navy-primary)' }}>No public honours recorded yet</h4>
            <p>Institutional achievements will appear upon official administrative verification.</p>
          </div>
        ) : (
          <div className="grid-2">
            {achievements.map((item) => (
              <div key={item.id} className="institutional-card" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                <div style={{
                  padding: '1rem',
                  borderRadius: '4px',
                  background: 'var(--navy-badge-bg)',
                  border: '1px solid var(--navy-badge-border)',
                  color: 'var(--navy-primary)',
                  flexShrink: 0
                }}>
                  <Medal size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <span className="badge-institutional">{item.category}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
                      {new Date(item.dateAwarded).toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '0.4rem' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '0.5rem' }}>
                    {item.description}
                  </p>
                  {item.cadetName && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--navy-hover)', fontWeight: 700 }}>
                      Awarded to: {item.cadetName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
