import React from 'react';
import { Target, Flag, Award, BookOpen } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="section-py" aria-label="About National Cadet Corps">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Flag size={16} />
            Institutional Foundation
          </span>
          <h2 className="cinzel-title">About National Cadet Corps</h2>
          <p className="description">
            The premier youth wing of the Indian Armed Forces, dedicated to character building,
            camaraderie, discipline, and selfless service to the nation.
          </p>
        </div>

        <div className="grid-2">
          <div className="institutional-card">
            <div className="badge-institutional" style={{ marginBottom: '1rem' }}>
              <Award size={14} />
              <span>HISTORY & LEGACY</span>
            </div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--navy-primary)' }}>
              Origin & National Evolution
            </h3>
            <p style={{ marginBottom: '1rem', lineHeight: '1.7' }}>
              The National Cadet Corps came into existence under the National Cadet Corps Act of 1948.
              Rooted in the 'University Corps' created under the Indian Defence Act 1917, the NCC has grown
              into the largest uniformed youth organization in the world, moulding young minds into patriotic,
              disciplined, and responsible citizens of India.
            </p>
            <p style={{ lineHeight: '1.7' }}>
              With its tricolor flag representing the Army (Red), Navy (Dark Blue), and Air Force (Light Blue)
              and 17 lotuses symbolizing the 17 state directorates, the NCC embodies national unity across
              every corner of the motherland.
            </p>
          </div>

          <div className="institutional-card">
            <div className="badge-institutional" style={{ marginBottom: '1rem' }}>
              <Target size={14} />
              <span>CORE MOTTO & AIMS</span>
            </div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--navy-primary)' }}>
              Unity and Discipline (एकता और अनुशासन)
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <BookOpen size={18} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <span>
                  <strong>Character & Leadership:</strong> To develop qualities of character, comradeship,
                  discipline, leadership, a secular outlook, the spirit of adventure, and ideals of selfless service.
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <BookOpen size={18} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <span>
                  <strong>Human Resource for the Nation:</strong> To create a human reservoir of organized,
                  trained, and motivated youth to provide leadership in all walks of life.
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <BookOpen size={18} style={{ color: 'var(--navy-hover)', marginTop: '3px', flexShrink: 0 }} />
                <span>
                  <strong>Armed Forces Aspiration:</strong> To provide a conducive environment that motivates
                  cadets to take up careers in the Indian Armed Forces and Defence Technology sectors.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
