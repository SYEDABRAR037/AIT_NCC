import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { seniors } from './seniors.data';
import './MeetOurSeniors.css';

const SeniorProfileCard: React.FC<{ senior: (typeof seniors)[number] }> = ({ senior }) => {
  const [photoFailed, setPhotoFailed] = useState(false);

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
          <div className="senior-profile-photo-fallback" role="img" aria-label="Photo not provided">
            <UserRound size={42} strokeWidth={1.4} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="senior-profile-details">
        <h3>{senior.name}</h3>
        <p className="senior-profile-rank">{senior.rank}</p>
        {senior.platoon && <p className="senior-profile-team">{senior.platoon}</p>}
      </div>
    </article>
  );
};

export const MeetOurSeniors: React.FC = () => (
  <section className="meet-our-seniors section-py" aria-labelledby="meet-our-seniors-title">
    <div className="container">
      <header className="meet-our-seniors-heading">
        <span className="meet-our-seniors-kicker">CADET LEADERSHIP</span>
        <h2 className="cinzel-title" id="meet-our-seniors-title">MEET OUR SENIORS</h2>
        <p>Meet the NCC AIT Pune Seniors who help lead, coordinate and guide our cadets.</p>
      </header>

      {seniors.length > 0 ? (
        <div className="senior-profiles-grid">
          {seniors.map((senior) => (
            <SeniorProfileCard key={`${senior.name}-${senior.rank}-${senior.platoon ?? ''}`} senior={senior} />
          ))}
        </div>
      ) : (
        <p className="senior-profiles-empty" role="status">
          Senior profiles will appear here when verified names, ranks and photos are provided.
        </p>
      )}
    </div>
  </section>
);
