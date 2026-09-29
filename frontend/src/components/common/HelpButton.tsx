import React from 'react';

const helpMessage = 'Hello NCC AIT Pune, I need assistance.';
const helpUrl = `https://wa.me/917893732737?text=${encodeURIComponent(helpMessage)}`;

export const HelpButton: React.FC = () => (
  <a
    href={helpUrl}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Help on WhatsApp"
    title="Help"
    style={{
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: 9990,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      minHeight: '52px',
      padding: '0 1rem',
      borderRadius: '999px',
      border: '2px solid var(--color-gold)',
      background: 'var(--color-primary)',
      color: 'var(--color-background)',
      boxShadow: '0 6px 20px rgba(7, 26, 51, 0.35)',
      font: 'inherit',
      fontWeight: 700,
      textDecoration: 'none',
    }}
  >
    <img src="/assets/logos/ncc_logo.png" alt="" width="24" height="24" />
    <span>HELP</span>
  </a>
);
