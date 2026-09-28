import React, { useState, useEffect, useRef } from 'react';
import { Shield, Menu, X, ExternalLink, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GooeyNavPill, NavPillItem } from './GooeyNavPill';
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

  // Close Role Shells dropdown on outside click
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

  // The 6 public navigation links
  const navLinks: NavPillItem[] = [
    { name: 'Home', href: '#' },
    { name: 'Notices', href: '#notices' },
    { name: 'About', href: '#about' },
    { name: 'Activities', href: '#activities' },
    { name: 'Gallery', href: '#gallery' },
    { name: 'Contact', href: '#contact' },
  ];

  // The 4 institutional roles
  const roles = [
    { id: 'ADMIN_ANO', name: 'ANO / Admin Command' },
    { id: 'PLATOON_SENIOR', name: 'Platoon Senior' },
    { id: 'SENIOR', name: 'Senior Cadet' },
    { id: 'CADET', name: 'Cadet Portal' },
  ];

  // Smooth scroll handler for links
  const handleNavSelect = (name: string, href: string) => {
    setActiveNav(name);
    if (!href || href === '#') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.history.pushState(null, '', window.location.pathname);
      return;
    }

    const targetId = href.replace('#', '');
    const el = document.getElementById(targetId);
    if (el) {
      const navOffset = 74;
      const elementPos = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPos - navOffset,
        behavior: 'smooth',
      });
      window.history.pushState(null, '', href);
    } else {
      window.location.hash = href;
    }
  };

  // Scrollspy to keep active nav item updated during scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 120) {
        setActiveNav('Home');
        return;
      }

      const sections = ['notices', 'about', 'activities', 'gallery', 'contact']
        .map((id) => ({ id, element: document.getElementById(id) }))
        .filter((entry): entry is { id: string; element: HTMLElement } => Boolean(entry.element))
        .filter(({ element }) => element.getBoundingClientRect().top <= 140);
      const activeSection = sections[sections.length - 1];
      if (activeSection) {
        const matched = navLinks.find((link) => link.href === `#${activeSection.id}`);
        if (matched) setActiveNav(matched.name);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="ref-site-header" role="banner">
      <div className="ref-header-inner">
        {/* ZONE 1 — LEFT: NCC BRANDING (Unchanged) */}
        <div className="ref-brand">
          <a
            href="#"
            className="ref-brand-link"
            aria-label="National Cadet Corps Home"
            onClick={(e) => {
              e.preventDefault();
              handleNavSelect('Home', '#');
            }}
          >
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

        {/* ZONE 2 — CENTER: ONE UNIFIED NAVIGATION PILL */}
        <div className="ref-nav-center">
          <GooeyNavPill
            items={navLinks}
            activeNav={activeNav}
            onSelect={handleNavSelect}
          />
        </div>

        {/* ZONE 3 — RIGHT: ROLE SHELLS, LOGIN, REGISTER */}
        <div className="ref-header-actions">
          {/* Role Dashboards Outline Dropdown Button */}
          <div className="ref-shells-dropdown" ref={dropdownRef}>
            <button
              className="ref-btn-shells"
              onClick={() => setShellsDropdownOpen(!shellsDropdownOpen)}
              aria-expanded={shellsDropdownOpen}
              aria-haspopup="true"
              aria-label="Institutional Role Panels"
            >
              <span>Role Shells</span>
              <span className="ref-caret" aria-hidden="true">▾</span>
            </button>
            {shellsDropdownOpen && (
              <div className="ref-dropdown-menu" role="menu">
                <div className="ref-dropdown-header">Institutional Role Panels</div>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    className="ref-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      onSelectShell(r.id);
                      setShellsDropdownOpen(false);
                    }}
                  >
                    <span>{r.name}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Auth Buttons */}
          {user ? (
            <div className="ref-auth-logged">
              <button
                className="ref-btn-command"
                onClick={() => onSelectShell(user.role)}
                aria-label={`Open command panel for ${user.fullName}`}
              >
                <LayoutDashboard size={14} aria-hidden="true" />
                <span>COMMAND PANEL</span>
              </button>
              <button
                className="ref-btn-logout"
                onClick={() => logout()}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="ref-auth-buttons">
              <button
                className="ref-btn-login"
                onClick={onOpenLogin}
                aria-label="Cadet or Officer Login"
              >
                Login
              </button>
              <button
                className="ref-btn-register"
                onClick={onOpenRegister}
                aria-label="New Cadet Registration"
              >
                Register
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="ref-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="ref-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile Navigation Drawer">
          <div className="ref-mobile-inner">
            <nav className="ref-mobile-nav" aria-label="Mobile Links">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className={`ref-mobile-link ${activeNav === link.name ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavSelect(link.name, link.href);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={activeNav === link.name ? 'page' : undefined}
                >
                  {link.name}
                </a>
              ))}
            </nav>

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
                  <Shield size={14} aria-hidden="true" />
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

export default Header;
