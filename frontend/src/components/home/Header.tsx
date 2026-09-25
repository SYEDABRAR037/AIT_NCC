import React, { useState, useEffect, useRef } from 'react';
import { Shield, Menu, X, ExternalLink, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GooeyNav } from '../GooeyNav';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { label: 'Home', href: '#' },
    { label: 'About', href: '#about' },
    { label: 'Activities', href: '#activities' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Notices', href: '#notices' },
    { label: 'Contact', href: '#contact' },
  ];

  const getIndexFromUrl = (): number => {
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash === '#contact' || path === '/contact') return 5;
    if (hash === '#notices' || path === '/notices') return 4;
    if (hash === '#gallery' || path === '/gallery') return 3;
    if (hash === '#activities' || path === '/activities' || hash === '#training' || path === '/training') return 2;
    if (hash === '#about' || path === '/about') return 1;
    return 0; // Home
  };

  const [activeIndex, setActiveIndex] = useState<number>(getIndexFromUrl);

  // Close dropdown when clicking outside
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

  // Synchronize active navigation item with route and scroll position
  useEffect(() => {
    const handleUrlChange = () => {
      setActiveIndex(getIndexFromUrl());
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    const sectionIds = ['contact', 'notices', 'gallery', 'activities', 'about'];
    let scrollTimeout: any = null;

    const handleScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        if (window.scrollY < 200) {
          setActiveIndex(0);
          return;
        }
        const scrollPosition = window.scrollY + 200;
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
              if (id === 'contact') setActiveIndex(5);
              else if (id === 'notices') setActiveIndex(4);
              else if (id === 'gallery') setActiveIndex(3);
              else if (id === 'activities') setActiveIndex(2);
              else if (id === 'about') setActiveIndex(1);
              return;
            }
          }
        }
      }, 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const roles = [
    { id: 'ADMIN_ANO', name: 'ANO / Admin Command' },
    { id: 'PLATOON_SENIOR', name: 'Platoon Senior' },
    { id: 'SENIOR', name: 'Senior Cadet' },
    { id: 'CADET', name: 'Cadet Portal' },
  ];

  const handleMobileNavClick = (href: string, index: number) => {
    setActiveIndex(index);
    setMobileMenuOpen(false);

    if (href.startsWith('#')) {
      const targetId = href.replace('#', '');
      if (!targetId) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.history.pushState(null, '', window.location.pathname);
      } else {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          const navOffset = 76;
          const elementPos = targetElement.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
            top: elementPos - navOffset,
            behavior: 'smooth',
          });
          window.history.pushState(null, '', href);
        }
      }
    }
  };

  return (
    <header className="ref-site-header" role="banner">
      <div className="ref-header-inner">
        {/* LEFT: NCC BRAND IDENTITY */}
        <div className="ref-brand">
          <a
            href="#"
            className="ref-brand-link"
            aria-label="National Cadet Corps Home"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setActiveIndex(0);
              window.history.pushState(null, '', window.location.pathname);
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

        {/* CENTER: REACT BITS GOOEYNAV */}
        <div className="ref-gooey-nav-wrapper">
          <GooeyNav
            items={navItems}
            particleCount={15}
            particleDistances={[90, 10]}
            particleR={100}
            animationTime={600}
            timeVariance={300}
            colors={[1, 2, 3, 1, 2, 3, 1, 4]}
            activeIndex={activeIndex}
            onItemClick={(_e, _item, index) => {
              setActiveIndex(index);
            }}
          />
        </div>

        {/* RIGHT: ROLE SHELLS + AUTH ACTIONS */}
        <div className="ref-header-actions">
          {/* Role Dashboards Dropdown */}
          <div className="ref-shells-dropdown" ref={dropdownRef}>
            <button
              className="ref-shells-toggle"
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
              {navItems.map((item, index) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`ref-mobile-link ${activeIndex === index ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleMobileNavClick(item.href, index);
                  }}
                  aria-current={activeIndex === index ? 'page' : undefined}
                >
                  {item.label}
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
