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
            Established at AIT Pune, our NCC detachment serves as an elite centre of training,
            command, and military values for ward engineering students of Indian Army personnel.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '1rem' }}>
              Fostering Technical Leaders with Defence Ethos
            </h3>
            <p style={{ marginBottom: '1rem', lineHeight: '1.7' }}>
              Located in the historic military station of Pune, the Army Institute of Technology (AIT)
              houses a premier NCC unit affiliated with the Maharashtra Directorate. Our cadets represent
              disciplined engineering minds who combine academic excellence with high-standard drill,
              firing, obstacle clearing, and adventure camps.
            </p>
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.7' }}>
              The detachment functions under the direct command of the Associate NCC Officer (ANO) supported
              by experienced military Drill Instructors (DI) deputed from active units, fostering direct
              mentorship for cadet ranks across Junior and Senior divisions.
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
                  <span style={{ color: '#93C5FD', fontSize: '0.85rem' }}>AIT DIGHI DETACHMENT</span>
                </div>
              </div>

              <p style={{ color: '#CBD5E1', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                "In these grounds, engineering precision meets regimented battlefield discipline.
                Our cadets don the uniform with solemn pride and carry the torch of selfless military service."
              </p>

              <div style={{ borderTop: '1px solid var(--navy-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8' }}>BATTALION</span>
                  <span style={{ fontWeight: 700, color: 'var(--white-pure)' }}>2 MAH BN NCC</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8' }}>GROUP HQ</span>
                  <span style={{ fontWeight: 700, color: 'var(--white-pure)' }}>PUNE GROUP</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8' }}>WING</span>
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
