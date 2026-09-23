import React, { useState, useEffect, useRef } from 'react';
import { Shield, Menu, X, ExternalLink, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/header.css';

interface HeaderProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onSelectShell: (role: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLogin,
  onOpenRegister,
  onSelectShell,
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shellsDropdownOpen, setShellsDropdownOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShellsDropdownOpen(false);
      }
    };
    if (shellsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [shellsDropdownOpen]);

  const navLinks = [
    { name: 'Home', href: '#' },
    { name: 'About', href: '#about' },
    { name: 'Activities', href: '#activities' },
    { name: 'Gallery', href: '#gallery' },
    { name: 'Notices', href: '#notices' },
    { name: 'Contact', href: '#contact' },
  ];

  const roles = [
    { id: 'ADMIN_ANO', name: 'ANO / Admin Command' },
    { id: 'PLATOON_SENIOR', name: 'Platoon Senior' },
    { id: 'SENIOR', name: 'Senior Cadet' },
    { id: 'CADET', name: 'Cadet Portal' },
  ];

  return (
    <header className="ref-site-header">
      <div className="ref-header-inner">
        {/* BRAND IDENTITY (Matching Reference) */}
        <div className="ref-brand">
          <a href="#" className="ref-brand-link" aria-label="National Cadet Corps Home">
            <img
              src="/assets/logos/ncc_logo.png"
              alt="Official NCC Emblem"
              className="ref-ncc-logo"
            />
            <div className="ref-brand-text">
              <span className="ref-brand-title">NCC</span>
              <span className="ref-brand-sub">National Cadet Corps</span>
              <span className="ref-brand-tagline">Unity &bull; Discipline &bull; Service</span>
            </div>
          </a>
        </div>

        {/* CENTER NAVIGATION (Matching Reference with Active Underline) */}
        <nav className="ref-desktop-nav" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className={`ref-nav-item ${activeNav === link.name ? 'active' : ''}`}
              onClick={() => setActiveNav(link.name)}
            >
              {link.name}
            </a>
          ))}

          {/* Role Dashboards Dropdown */}
          <div className="ref-shells-dropdown" ref={dropdownRef}>
            <button
              className="ref-nav-item ref-shells-toggle"
              onClick={() => setShellsDropdownOpen(!shellsDropdownOpen)}
              aria-expanded={shellsDropdownOpen}
            >
              Role Shells <span className="ref-caret">▾</span>
            </button>
            {shellsDropdownOpen && (
              <div className="ref-dropdown-menu">
                <div className="ref-dropdown-header">Institutional Role Panels</div>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    className="ref-dropdown-item"
                    onClick={() => {
                      onSelectShell(r.id);
                      setShellsDropdownOpen(false);
                    }}
                  >
                    <span>{r.name}</span>
                    <ExternalLink size={13} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* RIGHT ACTIONS (Matching Reference: Login Outline & Register White Pill) */}
        <div className="ref-header-actions">
          {user ? (
            <div className="ref-auth-logged">
              <button
                className="ref-btn-command"
                onClick={() => onSelectShell(user.role)}
              >
                <LayoutDashboard size={14} />
                <span>COMMAND PANEL</span>
              </button>
              <button
                className="ref-btn-logout"
                onClick={() => logout()}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="ref-auth-buttons">
              <button className="ref-btn-login" onClick={onOpenLogin}>
                Login
              </button>
              <button className="ref-btn-register" onClick={onOpenRegister}>
                Register
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="ref-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="ref-mobile-drawer">
          <div className="ref-mobile-inner">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={`ref-mobile-link ${activeNav === link.name ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav(link.name);
                  setMobileMenuOpen(false);
                }}
              >
                {link.name}
              </a>
            ))}

            <div className="ref-mobile-roles">
              <div className="ref-mobile-roles-title">ROLE PANELS</div>
              {roles.map((r) => (
                <button
                  key={r.id}
                  className="ref-mobile-role-btn"
                  onClick={() => {
                    onSelectShell(r.id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Shield size={14} />
                  <span>{r.name}</span>
                </button>
              ))}
            </div>

            <div className="ref-mobile-auth">
              {user ? (
                <>
                  <div className="ref-mobile-user-tag">
                    {user.fullName} ({user.role})
                  </div>
                  <button
                    className="ref-btn-register"
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                    onClick={() => {
                      onSelectShell(user.role);
                      setMobileMenuOpen(false);
                    }}
                  >
                    Open Command Panel
                  </button>
                  <button
                    className="ref-btn-login"
                    style={{ width: '100%' }}
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="ref-btn-login"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onOpenLogin();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Login
                  </button>
                  <button
                    className="ref-btn-register"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onOpenRegister();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
