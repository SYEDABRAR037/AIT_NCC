import React, { Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CinematicIntro } from './components/cinematic/CinematicIntro';
import { Header } from './components/home/Header';
import { HeroVideo } from './components/home/HeroVideo';
import { StrengthAndNotices } from './components/home/StrengthAndNotices';
import { QuoteBanner } from './components/home/QuoteBanner';
import { AboutSection } from './components/home/AboutSection';
import { UnitIntroduction } from './components/home/UnitIntroduction';


import { UpcomingEvents } from './components/home/UpcomingEvents';
import { Achievements } from './components/home/Achievements';
import { GallerySection } from './components/home/GallerySection';
import { JoinNCC } from './components/home/JoinNCC';
import { ContactSection } from './components/home/ContactSection';
import { Footer } from './components/home/Footer';
import { MeetOurSeniors } from './components/home/MeetOurSeniors';
import { HelpButton } from './components/common/HelpButton';
import { isPublicPreviewMode } from './utils/api';

const LoginModal = React.lazy(() => import('./components/auth/LoginModal').then((module) => ({ default: module.LoginModal })));
const RegisterModal = React.lazy(() => import('./components/auth/RegisterModal').then((module) => ({ default: module.RegisterModal })));
const RoleShellView = React.lazy(() => import('./components/shells/RoleShellView').then((module) => ({ default: module.RoleShellView })));
const DigitalIdVerification = React.lazy(() => import('./components/digitalId/DigitalIdView').then((module) => ({ default: module.DigitalIdVerification })));

const RouteLoadingFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="app-route-loading">
    Loading NCC portal…
  </div>
);

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const previewMode = isPublicPreviewMode();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [activeShellRole, setActiveShellRole] = useState<string | null>(null);

  const handleSelectShell = (role: string) => {
    if (previewMode) return;
    if (user && user.role === role) setActiveShellRole(role);
    else {
      setActiveShellRole(null);
      setLoginModalOpen(true);
    }
  };

  const handleBackToHome = () => {
    setActiveShellRole(null);
  };

  const currentRole = activeShellRole || (user ? user.role : null);
  if (window.location.pathname.startsWith('/verify-id/')) {
    if (previewMode) {
      return <main className="public-preview-blocked" role="status">Digital ID verification is unavailable in this public preview.</main>;
    }
    return <Suspense fallback={<RouteLoadingFallback />}><DigitalIdVerification /></Suspense>;
  }

  return (
    <div className="app-root">
      {previewMode && (
        <div role="status" aria-live="polite" style={{ padding: '0.7rem 1rem', textAlign: 'center', color: '#16324f', background: '#fff3cd', borderBottom: '1px solid #e6cc7a', fontWeight: 700 }}>
          Public preview — portal login, registration, inquiries, attendance, and administrative actions are disabled.
        </div>
      )}
      <a className="skip-link" href={currentRole ? '#role-main-content' : '#main-content'}>
        Skip to main content
      </a>
      {/* 1. Cinematic Entrance with Deep Navy Theatre Curtains */}
      <CinematicIntro />

      {/* If a Role Shell Preview or authenticated session is active, display it */}
      {currentRole ? (
        <Suspense fallback={<RouteLoadingFallback />}>
          <RoleShellView role={currentRole} onBackToHome={handleBackToHome} />
        </Suspense>
      ) : (
        /* Otherwise, display the Institutional Homepage */
        <>
          <Header
            onOpenLogin={() => setLoginModalOpen(true)}
            onOpenRegister={() => setRegisterModalOpen(true)}
            onSelectShell={handleSelectShell}
            previewMode={previewMode}
          />

          <main id="main-content" tabIndex={-1}>
            {/* Cinematic Hero matching reference */}
            <HeroVideo
              onOpenLogin={() => setLoginModalOpen(true)}
              onOpenRegister={() => setRegisterModalOpen(true)}
            />

            {/* Two-Column Our Strength (Real DB) + Latest Notices (Real DB) matching reference */}
            <StrengthAndNotices />

            {/* Inspiring Military Quote Banner with Onward to Glory & Tricolor matching reference */}
            <QuoteBanner />

            {/* Institutional Foundation */}
            <AboutSection />

            <MeetOurSeniors />

            {/* AIT Pune NCC Unit Detachment & Affiliation */}
            <UnitIntroduction />

            {/* Institutional Principles, Mission & Ethos */}


            {/* Training Curriculum & Regimental Drills */}


            {/* Upcoming Activities & Camps (Real DB) */}
            <UpcomingEvents />

            {/* Public Verified Cadet Achievements (Real DB) */}
            <Achievements />

            {/* Authorized Regimental Media Gallery */}
            <GallerySection />

            {/* Ready to Join NCC Enrollment CTA */}
            <JoinNCC
              onOpenRegister={() => setRegisterModalOpen(true)}
              onOpenLogin={() => setLoginModalOpen(true)}
              previewMode={previewMode}
            />

            {/* Unit Liaison & Contact */}
            <ContactSection onOpenLogin={() => setLoginModalOpen(true)} previewMode={previewMode} />
          </main>

          {/* Deep Navy Institutional Footer matching reference */}
          <Footer />
        </>
      )}

      {/* Modals */}
      {!previewMode && loginModalOpen && (
        <Suspense fallback={null}>
          <LoginModal
            isOpen
            onClose={() => setLoginModalOpen(false)}
            onLoginSuccess={(role) => { setActiveShellRole(role); setLoginModalOpen(false); }}
          />
        </Suspense>
      )}

      {!previewMode && registerModalOpen && (
        <Suspense fallback={null}>
          <RegisterModal isOpen onClose={() => setRegisterModalOpen(false)} />
        </Suspense>
      )}

      {!previewMode && <HelpButton />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
