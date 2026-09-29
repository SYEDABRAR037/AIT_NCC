import React from 'react';
import { Building2, Shield, MapPin, Award } from 'lucide-react';

export const UnitIntroduction: React.FC = () => {
  return (
    <section className="section-py" aria-label="AIT Pune NCC Unit Introduction">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Building2 size={16} />
            Institutional Unit
          </span>
          <h2 className="cinzel-title">Army Institute of Technology NCC Unit</h2>
          <p className="description">
            NCC at AIT Pune gives cadets the opportunity to take part in training, camps, and community activities.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '1rem' }}>
              NCC at AIT Pune
            </h3>
            <p style={{ marginBottom: '1rem', lineHeight: '1.7' }}>
              Army Institute of Technology in Pune has an NCC unit affiliated with the Maharashtra Directorate. Cadets take part in drill, firing, obstacle training, and camps.
            </p>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.7' }}>
              The unit is led by the Associate NCC Officer (ANO) and supported by Drill Instructors (DI).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shield size={18} style={{ color: 'var(--navy-hover)' }} />
                <span style={{ fontSize: '0.95rem' }}><strong>Affiliation:</strong> 2 Maharashtra Battalion NCC / Maharashtra Directorate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MapPin size={18} style={{ color: 'var(--navy-hover)' }} />
                <span style={{ fontSize: '0.95rem' }}><strong>Location:</strong> AIT Campus, Alandi Road, Dighi, Pune - 411015</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Award size={18} style={{ color: 'var(--navy-hover)' }} />
                <span style={{ fontSize: '0.95rem' }}><strong>Tradition:</strong> Annual selections to Republic Day Parade (RDC) & Thal Sainik Camp (TSC)</span>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{
              background: 'var(--navy-primary)',
              borderRadius: '6px',
              padding: '2.5rem',
              color: 'var(--white-pure)',
              border: '2px solid var(--navy-border)',
              boxShadow: 'var(--shadow-xl)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <img
                  src="/assets/logos/ncc_logo.png"
                  alt="NCC"
                  style={{ width: '48px', height: '54px', objectFit: 'contain' }}
                />
                <img
                  src="/assets/logos/ait_logo.gif"
                  alt="AIT"
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
                <div>
                  <h4 style={{ color: 'var(--white-pure)', fontSize: '1.1rem' }}>UNIT RECOGNITION</h4>
                  <span style={{ color: 'var(--color-info-border)', fontSize: '0.85rem' }}>AIT DIGHI DETACHMENT</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--navy-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-disabled)' }}>BATTALION</span>
                  <span style={{ fontWeight: 700, color: 'var(--white-pure)' }}>2 MAH BN NCC</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-disabled)' }}>GROUP HQ</span>
                  <span style={{ fontWeight: 700, color: 'var(--white-pure)' }}>PUNE GROUP</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-disabled)' }}>WING</span>
                  <span style={{ fontWeight: 700, color: 'var(--white-pure)' }}>ARMY WING</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
