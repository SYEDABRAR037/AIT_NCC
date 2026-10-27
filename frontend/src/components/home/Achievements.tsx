import React, { useState, useEffect } from 'react';
import { Award, Trophy, Medal, Calendar, User } from 'lucide-react';
import { getApiBaseUrl } from '../../utils/api';

interface AchievementItem {
  id: string;
  title: string;
  category: string;
  description: string;
  dateAwarded: string;
  cadetName?: string;
  eventName?: string;
}

export const Achievements: React.FC = () => {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${getApiBaseUrl()}/api/public/achievements`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.achievements)) {
          setAchievements(data.achievements);
        } else {
          setAchievements([]);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Achievements query error:', err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const formatDate = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <section className="section-py" style={{ backgroundColor: 'var(--color-surface)' }} aria-label="Unit Achievements">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            <Trophy size={16} /> INSTITUTIONAL LAURELS
          </span>
          <h2 className="cinzel-title" style={{ color: 'var(--color-primary)', margin: '0.5rem 0' }}>
            Unit Honours & Cadet Achievements
          </h2>
          <p className="description" style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--color-text-secondary)' }}>
            Recognizing discipline, marksmanship, drill excellence, and leadership demonstrated by cadets of AIT NCC Detachment.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            <p>Loading unit honours and achievements...</p>
          </div>
        ) : achievements.length === 0 ? (
          /* Dignified Institutional Empty State matching Requirement 4 */
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
              <Award size={30} />
            </div>
            <h4
              style={{
                color: 'var(--color-primary)',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
              }}
            >
              Unit Honours & Cadet Commendations
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
              Verified competition laurels, state/national camp selections, and institutional merit commendations for the active training cycle are gazetted following official Battalion and Group review.
            </p>
          </div>
        ) : (
          /* Responsive 2-column Grid for Verified Achievements */
          <div className="grid-2" style={{ gap: '1.5rem' }}>
            {achievements.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                  boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)',
                }}
              >
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    background: 'var(--color-info-soft)',
                    border: '1px solid var(--color-accent)',
                    color: 'var(--color-primary)',
                    flexShrink: 0,
                  }}
                >
                  <Medal size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'var(--color-primary)',
                        color: 'var(--color-gold)',
                      }}
                    >
                      {item.category || 'Institutional'}
                    </span>
                    {item.dateAwarded && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Calendar size={12} />
                        {formatDate(item.dateAwarded)}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '0.35rem' }}>
                    {item.title}
                  </h3>
                  {item.cadetName && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-accent)', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={13} />
                      {item.cadetName}
                    </p>
                  )}
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
