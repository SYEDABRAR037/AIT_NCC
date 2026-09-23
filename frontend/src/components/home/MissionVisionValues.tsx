import React from 'react';
import { Compass, Eye, ShieldCheck, HeartHandshake, Zap, Award } from 'lucide-react';

export const MissionVisionValues: React.FC = () => {
  return (
    <section className="section-py section-alt" aria-label="Mission, Vision and Values">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Compass size={16} />
            Institutional Principles
          </span>
          <h2 className="cinzel-title">Mission, Vision & Core Values</h2>
          <p className="description">
            Guiding the regimented journey of every engineering cadet at Army Institute of Technology, Pune.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
          {/* Mission */}
          <div className="institutional-card">
            <div className="badge-institutional" style={{ marginBottom: '1rem' }}>
              <Compass size={14} />
              <span>MISSION</span>
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--navy-primary)' }}>
              Empowering Cadet Leadership
            </h3>
            <p>
              To foster regimented leadership, physical agility, weapon handling proficiency,
              and civic responsibility among future engineers, instilling an unwavering ethos of service
              before self in harmony with defence technology paradigms.
            </p>
          </div>

          {/* Vision */}
          <div className="institutional-card">
            <div className="badge-institutional" style={{ marginBottom: '1rem' }}>
              <Eye size={14} />
              <span>VISION</span>
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--navy-primary)' }}>
              Excellence & Nation Building
            </h3>
            <p>
              To stand as the premier collegiate NCC unit in the Maharashtra Directorate, renowned for producing
              impeccably disciplined commissioned officers, exceptional defence innovators, and dedicated nation builders.
            </p>
          </div>

          {/* Values */}
          <div className="institutional-card">
            <div className="badge-institutional" style={{ marginBottom: '1rem' }}>
              <ShieldCheck size={14} />
              <span>ETHOS</span>
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--navy-primary)' }}>
              Military Honour & Integrity
            </h3>
            <p>
              Living by the highest standards of military rectitude, moral courage, punctuality,
              unflinching teamwork, and absolute loyalty to the constitutional values of the Republic of India.
            </p>
          </div>
        </div>

        {/* 4 Core Value Pillars */}
        <div className="grid-4">
          <div style={{ background: 'var(--white-pure)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}>
            <Zap size={22} style={{ color: 'var(--navy-primary)', marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '1rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>Discipline</h4>
            <p style={{ fontSize: '0.88rem' }}>Uncompromising adherence to institutional drill, orders, and ethical conduct.</p>
          </div>
          <div style={{ background: 'var(--white-pure)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}>
            <HeartHandshake size={22} style={{ color: 'var(--navy-primary)', marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '1rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>Camaraderie</h4>
            <p style={{ fontSize: '0.88rem' }}>Forging unbreakable fraternal bonds of mutual trust across all platoons and ranks.</p>
          </div>
          <div style={{ background: 'var(--white-pure)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}>
            <Award size={22} style={{ color: 'var(--navy-primary)', marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '1rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>Courage</h4>
            <p style={{ fontSize: '0.88rem' }}>Physical endurance, mental resilience, and moral strength in challenging conditions.</p>
          </div>
          <div style={{ background: 'var(--white-pure)', padding: '1.25rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}>
            <ShieldCheck size={22} style={{ color: 'var(--navy-primary)', marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '1rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>Duty</h4>
            <p style={{ fontSize: '0.88rem' }}>Selfless dedication to the unit, college, community, and the Armed Forces.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
