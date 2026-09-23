import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="ref-site-footer" aria-label="Official Footer">
      <div className="ref-footer-container">
        <div className="ref-footer-main-grid">
          {/* Col 1: Brand & Detachment Info */}
          <div className="ref-footer-brand-col">
            <div className="ref-footer-brand-header">
              <img
                src="/assets/logos/ncc_logo.png"
                alt="NCC Official Crest"
                className="ref-footer-ncc-logo"
              />
              <div>
                <h3 className="ref-footer-title">NCC</h3>
                <p className="ref-footer-subtitle">National Cadet Corps</p>
                <p className="ref-footer-unit">AIT Pune &bull; 2 MAH BN NCC</p>
              </div>
            </div>
            <p className="ref-footer-desc">
              Official Digital Command & Cadet Management Portal for the Army Institute of Technology (AIT) Pune NCC detachment, affiliated with 2 Maharashtra Battalion NCC, Pune Group.
            </p>
          </div>

          {/* Col 2: Quick Links (Matching Reference) */}
          <div className="ref-footer-col">
            <h4 className="ref-footer-col-heading">Quick Links</h4>
            <ul className="ref-footer-links-list">
              <li><a href="#about">About NCC</a></li>
              <li><a href="#activities">Activities</a></li>
              <li><a href="#gallery">Gallery</a></li>
              <li><a href="#notices">Notices</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>

          {/* Col 3: Useful Links (Matching Reference) */}
          <div className="ref-footer-col">
            <h4 className="ref-footer-col-heading">Useful Links</h4>
            <ul className="ref-footer-links-list">
              <li>
                <a href="https://mod.gov.in" target="_blank" rel="noopener noreferrer">
                  Ministry of Defence
                </a>
              </li>
              <li>
                <a href="https://indiancc.nic.in" target="_blank" rel="noopener noreferrer">
                  NCC India (DGNCC)
                </a>
              </li>
              <li>
                <a href="https://joinindianarmy.nic.in" target="_blank" rel="noopener noreferrer">
                  Career in Armed Forces
                </a>
              </li>
              <li>
                <a href="https://www.aitpune.com" target="_blank" rel="noopener noreferrer">
                  Army Institute of Technology
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Social Icons & Copyright (Matching Reference) */}
          <div className="ref-footer-social-col">
            <div className="ref-footer-social-icons">
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="ref-social-icon-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="ref-social-icon-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="ref-social-icon-btn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="ref-social-icon-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.32a1.64 1.64 0 1 0-.01 3.28 1.64 1.64 0 0 0 .01-3.28z"/>
                </svg>
              </a>
            </div>

            <div className="ref-footer-copy-text">
              &copy; {new Date().getFullYear()} NCC. All Rights Reserved.
            </div>

            <div className="ref-footer-motto-row">
              <span>Discipline</span>
              <span className="ref-motto-dot">&bull;</span>
              <span>Unity</span>
              <span className="ref-motto-dot">&bull;</span>
              <span>Service</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
