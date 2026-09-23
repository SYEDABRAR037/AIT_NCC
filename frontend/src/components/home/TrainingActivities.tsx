import React from 'react';
import { Target, Compass, Shield, Crosshair, Dumbbell, Flag } from 'lucide-react';

export const TrainingActivities: React.FC = () => {
  const activities = [
    {
      title: 'Ceremonial & Squad Drill',
      desc: 'Precision foot drill, ceremonial rifle movements, word of command delivery, and guard of honour discipline.',
      icon: Flag,
    },
    {
      title: 'Physical Endurance & PT',
      desc: 'Systematic obstacle clearance, battle obstacle course, cross-country marathons, and physical fitness standards.',
      icon: Dumbbell,
    },
    {
      title: 'Weapon Handling & Firing',
      desc: 'Rigorous safety drills, weapon stripping & assembling, 0.22 Deluxe Rifle range firing, and grouping classification.',
      icon: Crosshair,
    },
    {
      title: 'Map Reading & Navigation',
      desc: 'Prismatic compass navigation, grid coordinates, night march charts, ground-to-map orientation, and resection.',
      icon: Compass,
    },
    {
      title: 'Field Craft & Battle Craft (FC & BC)',
      desc: 'Camouflage & concealment, judging distance, field signals, section formations, and fire control orders.',
      icon: Shield,
    },
    {
      title: 'Military History & Leadership',
      desc: 'Institutional lectures on Indian Armed Forces doctrine, wars of 1965/1971/Kargil, and leadership ethics.',
      icon: Target,
    },
  ];

  return (
    <section id="training" className="section-py section-alt" aria-label="NCC Training Curriculum">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Target size={16} />
            Military Syllabus
          </span>
          <h2 className="cinzel-title">Institutional Training Curriculum</h2>
          <p className="description">
            Comprehensive military curriculum delivered by deputed Indian Army Drill Instructors
            and institutional officers to instil soldierly attributes.
          </p>
        </div>

        <div className="grid-3">
          {activities.map((act) => {
            const Icon = act.icon;
            return (
              <div key={act.title} className="institutional-card">
                <div style={{
                  display: 'inline-flex',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  background: 'var(--navy-badge-bg)',
                  border: '1px solid var(--navy-badge-border)',
                  color: 'var(--navy-primary)',
                  marginBottom: '1rem',
                }}>
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>
                  {act.title}
                </h3>
                <p style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>{act.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
