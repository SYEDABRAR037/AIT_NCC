import React from 'react';
import { UserCheck, ArrowRight, LogIn } from 'lucide-react';

interface JoinNCCProps {
  onOpenRegister: () => void;
  onOpenLogin: () => void;
}

export const JoinNCC: React.FC<JoinNCCProps> = ({ onOpenRegister, onOpenLogin }) => {
  const steps = [
    {
      step: '01',
      title: 'Digital Application',
      desc: 'Fill out institutional enrollment details, college roll number, regimental bio, and engineering branch.',
    },
    {
      step: '02',
      title: 'Physical & Medical Test',
      desc: 'Physical fitness screening (1.6 km run, push-ups, chin-ups) and institutional medical certificate validation.',
    },
    {
      step: '03',
      title: 'Biometric Face Enrollment',
      desc: 'Secure high-resolution biometric enrollment conducted by authorized Senior Cadets on the unit scanner.',
    },
    {
      step: '04',
      title: 'Command Sanction',
      desc: 'Hierarchical review through Senior Cadet, Platoon Senior, and final sanction by Associate NCC Officer (ANO).',
    },
  ];

  return (
    <section id="join" className="section-py" style={{ backgroundColor: '#F8FAFC' }} aria-label="Join NCC Enrollment Steps">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="sub-title" style={{ color: '#2563EB', fontWeight: 700 }}>
            <UserCheck size={16} />
            CADET ENROLLMENT ROADMAP
          </span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: '#0A192F', margin: '0.5rem 0' }}>
            How to Join the AIT NCC Detachment
          </h2>
          <p className="description" style={{ maxWidth: '680px', margin: '0 auto', color: '#64748B' }}>
            Enrollment is open to first and second year undergraduate engineering students
            at Army Institute of Technology, Pune (2 Maharashtra Battalion NCC).
          </p>
        </div>

        <div className="grid-4" style={{ marginBottom: '3rem', gap: '1.25rem' }}>
          {steps.map((item) => (
            <div
              key={item.step}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '1.75rem 1.25rem',
                boxShadow: '0 4px 15px rgba(6, 21, 43, 0.04)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 900,
                  color: '#2563EB',
                  opacity: 0.25,
                  lineHeight: 1,
                  marginBottom: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                {item.step}
              </div>
              <h3 style={{ fontSize: '1.1rem', color: '#0A192F', fontWeight: 700, marginBottom: '0.5rem' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.86rem', lineHeight: '1.6', color: '#64748B', margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Primary CTA Card (Matching Reference Section 26) */}
        <div
          style={{
            backgroundColor: '#06152B',
            color: '#FFFFFF',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '2rem',
            boxShadow: '0 15px 35px rgba(6, 21, 43, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ maxWidth: '680px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#93C5FD', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              JOIN THE CADET CORPS
            </span>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.85rem', fontWeight: 800, margin: '0.4rem 0 0.75rem' }}>
              Ready to Join NCC?
            </h3>
            <p style={{ color: '#CBD5E1', fontSize: '0.98rem', lineHeight: '1.6', margin: 0 }}>
              Begin your cadet registration and become part of the NCC journey. Join the ranks of disciplined leaders and serve the nation with honor.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={onOpenRegister}
              style={{
                background: '#FFFFFF',
                color: '#06152B',
                border: 'none',
                borderRadius: '50px',
                padding: '12px 28px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.2s ease',
              }}
            >
              <span>Register as Cadet</span>
              <ArrowRight size={17} />
            </button>

            <button
              onClick={onOpenLogin}
              style={{
                background: 'transparent',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.45)',
                borderRadius: '50px',
                padding: '12px 26px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              <LogIn size={16} />
              <span>Login</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
