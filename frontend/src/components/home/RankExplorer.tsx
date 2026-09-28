import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import './RankExplorer.css';

const ranks = [
  { name: 'Cadet', abbreviation: 'CDT', tier: 'Foundation', description: 'Builds a foundation in NCC training, discipline, and teamwork.' },
  { name: 'Lance Corporal', abbreviation: 'LCPL', tier: 'Junior appointment', description: 'A junior appointment that introduces responsibility within the cadet group.' },
  { name: 'Corporal', abbreviation: 'CPL', tier: 'Junior appointment', description: 'Supports coordination and good order among fellow cadets.' },
  { name: 'Sergeant', abbreviation: 'SGT', tier: 'Senior appointment', description: 'Helps lead cadets and support the unit’s training activities.' },
  { name: 'Company Quarter Master Sergeant', abbreviation: 'CQMS', tier: 'Senior appointment', description: 'A senior cadet appointment associated with supporting company-level organization.' },
  { name: 'Junior Under Officer', abbreviation: 'JUO', tier: 'Under officer', description: 'A senior leadership appointment supporting officers and cadet teams.' },
  { name: 'Senior Under Officer', abbreviation: 'SUO', tier: 'Under officer', description: 'A senior cadet leadership appointment with responsibilities set by the unit.' },
];

export const RankExplorer: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedRank = ranks[selectedIndex];

  const selectRank = (index: number) => setSelectedIndex((index + ranks.length) % ranks.length);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (selectedIndex + 1) % ranks.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (selectedIndex + ranks.length - 1) % ranks.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = ranks.length - 1;
    }
    if (nextIndex !== null) {
      setSelectedIndex(nextIndex);
      requestAnimationFrame(() => optionRefs.current[nextIndex!]?.focus());
    }
  };

  return (
    <section className="rank-explorer" aria-labelledby="rank-explorer-title">
      <div className="rank-explorer-heading">
        <span className="rank-explorer-kicker">CADET LEADERSHIP</span>
        <h3 id="rank-explorer-title">Rank &amp; Insignia Explorer</h3>
        <p>Explore a general Army Wing cadet rank progression. Appointments and titles may vary by division and unit.</p>
      </div>

      <div className="rank-explorer-layout">
        <div className="rank-explorer-list-wrap">
          <div className="rank-explorer-list" role="tablist" aria-label="Cadet rank hierarchy" aria-orientation="vertical" onKeyDown={handleKeyDown}>
            {ranks.map((rank, index) => (
              <button
                key={rank.abbreviation}
                ref={(element) => { optionRefs.current[index] = element; }}
                id={`rank-tab-${rank.abbreviation.toLowerCase()}`}
                className={`rank-explorer-option${index === selectedIndex ? ' is-selected' : ''}`}
                type="button"
                role="tab"
                aria-selected={index === selectedIndex}
                aria-controls="rank-detail-panel"
                tabIndex={index === selectedIndex ? 0 : -1}
                onClick={() => setSelectedIndex(index)}
              >
                <span className="rank-order" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span>{rank.name}</span>
              </button>
            ))}
          </div>
          <div className="rank-explorer-mobile-controls" aria-label="Browse ranks">
            <button type="button" onClick={() => selectRank(selectedIndex - 1)} aria-label="Previous rank"><ChevronLeft size={18} /></button>
            <span>{selectedIndex + 1} of {ranks.length}</span>
            <button type="button" onClick={() => selectRank(selectedIndex + 1)} aria-label="Next rank"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="rank-detail-panel" id="rank-detail-panel" role="tabpanel" aria-labelledby={`rank-tab-${selectedRank.abbreviation.toLowerCase()}`} tabIndex={0}>
          <div className="rank-marker" aria-hidden="true">
            <span className="rank-marker-ring"><Shield size={26} strokeWidth={1.7} /></span>
            <span className="rank-marker-code">{selectedRank.abbreviation}</span>
            <span className="rank-marker-line" />
            <span className="rank-marker-line short" />
          </div>
          <div className="rank-detail-copy" aria-live="polite">
            <span className="rank-detail-tier">{selectedRank.tier}</span>
            <h4>{selectedRank.name}</h4>
            <p>{selectedRank.description}</p>
          </div>
        </div>
      </div>
      <p className="rank-explorer-disclaimer">The marker artwork is an educational visual aid, not a reproduction of official uniform insignia or a uniform-wear guide. Confirm current rank and insignia guidance with authorized NCC material.</p>
    </section>
  );
};
