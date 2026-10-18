import React, { useState, useEffect } from 'react';
import { UserRound, Shield } from 'lucide-react';
import { seniors } from './seniors.data';
import { getApiBaseUrl } from '../../utils/api';
import './MeetOurSeniors.css';

interface DisplaySenior {
  name: string;
  rank: string;
  platoon?: string;
  photo?: string;
}

// Full rank titles mapping for official NCC appointment standards
const RANK_TITLES: Record<string, string> = {
  SUO: 'Senior Under Officer',
  JUO: 'Junior Under Officer',
  CSM: 'Company Sergeant Major',
  CQMS: 'Company Quartermaster Sergeant',
  CQMH: 'Company Quartermaster Havildar',
  SGT: 'Sergeant',
  CPL: 'Corporal',
  LCPL: 'Lance Corporal',
  CDT: 'Cadet',
};

const SeniorProfileCard: React.FC<{ senior: DisplaySenior }> = ({ senior }) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const rankFull = RANK_TITLES[senior.rank.toUpperCase()] || senior.rank;

  return (
    <article className="senior-profile-card">
      <div className="senior-profile-photo">
        {senior.photo && !photoFailed ? (
          <img
            src={senior.photo}
            alt={`Portrait of ${senior.name}`}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="senior-profile-photo-fallback" role="img" aria-label="Portrait not provided">
            <UserRound size={42} strokeWidth={1.4} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="senior-profile-details">
        <h3>{senior.name}</h3>
        <p className="senior-profile-rank" title={rankFull}>
          <span style={{ fontWeight: 800 }}>{senior.rank}</span> · {rankFull}
        </p>
        {senior.platoon && <p className="senior-profile-team">{senior.platoon}</p>}
      </div>
    </article>
  );
};

export const MeetOurSeniors: React.FC = () => {
  const [activeSeniors, setActiveSeniors] = useState<DisplaySenior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    // 1. Check verified rank holders from institutional media API
    fetch(`${getApiBaseUrl()}/api/public/rank-holders`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.holders) && data.holders.length > 0) {
          const apiSeniors: DisplaySenior[] = data.holders.map((h: any) => ({
            name: h.name,
            rank: h.rank,
            photo: h.imageUrl,
          }));
          setActiveSeniors(apiSeniors);
        } else if (seniors.length > 0) {
          // Fall back to verified static data if present
          setActiveSeniors(seniors);
        } else {
          setActiveSeniors([]);
        }
      })
      .catch(() => {
        if (seniors.length > 0) setActiveSeniors(seniors);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return (
    <section id="seniors" className="meet-our-seniors section-py" aria-labelledby="meet-our-seniors-title">
      <div className="container">
        <header className="meet-our-seniors-heading">
          <span className="meet-our-seniors-kicker">CADET LEADERSHIP</span>
          <h2 className="cinzel-title" id="meet-our-seniors-title">
            MEET OUR SENIORS
          </h2>
          <p
            style={{
              maxWidth: '620px',
              margin: '0.5rem auto 0',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
            }}
          >
            Senior appointments entrusted with drill standards, discipline, and cadet mentorship at AIT NCC Detachment.
          </p>
        </header>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-secondary)' }}>
            <p>Loading cadet leadership roster...</p>
          </div>
        ) : activeSeniors.length > 0 ? (
          <div className="senior-profiles-grid">
            {activeSeniors.map((senior) => (
              <SeniorProfileCard
                key={`${senior.name}-${senior.rank}-${senior.platoon ?? ''}`}
                senior={senior}
              />
            ))}
          </div>
        ) : (
          /* Polished, dignified institutional state matching Requirement 3 */
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              padding: '3rem 2rem',
              maxWidth: '640px',
              margin: '2rem auto 0',
              boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)',
            }}
            role="status"
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--color-info-soft)',
                border: '1px solid var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: 'var(--color-primary)',
              }}
            >
              <Shield size={28} />
            </div>
            <h4
              style={{
                color: 'var(--color-primary)',
                fontSize: '1.2rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
              }}
            >
              Cadet Leadership Appointments In Confirmation
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
              Official senior cadet appointments (Senior Under Officer, Junior Under Officer, and Senior NCOs) for the active training cycle are published following formal gazette notification by the Associate NCC Officer (ANO) and Battalion Command.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
