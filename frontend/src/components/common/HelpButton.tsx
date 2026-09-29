import React from 'react';
import { HelpCircle } from 'lucide-react';

const helpMessage = 'Hello NCC AIT Pune, I need help.';
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
    <HelpCircle size={20} aria-hidden="true" />
    <span>Help</span>
  </a>
);
