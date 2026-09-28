import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { platoonSeniors } from './platoonSeniors.data';
import './PlatoonSeniors.css';

const PlatoonSeniorCard: React.FC<{ senior: (typeof platoonSeniors)[number] }> = ({ senior }) => {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <article className="platoon-senior-card">
      <div className="platoon-senior-photo">
        {senior.photo && !photoFailed ? (
          <img
            src={senior.photo}
            alt={`Portrait of ${senior.name}`}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="platoon-senior-photo-fallback" role="img" aria-label="Photo not provided">
            <UserRound size={42} strokeWidth={1.4} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="platoon-senior-details">
        <h3>{senior.name}</h3>
        <p className="platoon-senior-rank">{senior.rank}</p>
        {senior.platoon && <p className="platoon-senior-team">{senior.platoon}</p>}
      </div>
    </article>
  );
};

export const PlatoonSeniors: React.FC = () => (
  <section className="platoon-seniors section-py" aria-labelledby="platoon-seniors-title">
    <div className="container">
      <header className="platoon-seniors-heading">
        <span className="platoon-seniors-kicker">CADET LEADERSHIP</span>
        <h2 className="cinzel-title" id="platoon-seniors-title">MEET OUR PLATOON SENIORS</h2>
        <p>The NCC AIT Pune Platoon Seniors who help lead, coordinate and guide our cadets.</p>
      </header>

      {platoonSeniors.length > 0 ? (
        <div className="platoon-seniors-grid">
          {platoonSeniors.map((senior) => (
            <PlatoonSeniorCard key={`${senior.name}-${senior.rank}-${senior.platoon ?? ''}`} senior={senior} />
          ))}
        </div>
      ) : (
        <p className="platoon-seniors-empty" role="status">
          Verified Platoon Senior profiles will be added when the unit’s names, ranks and photos are provided.
        </p>
      )}
    </div>
  </section>
);
