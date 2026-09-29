import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CinematicIntro } from './components/cinematic/CinematicIntro';
import { Header } from './components/home/Header';
import { HeroVideo } from './components/home/HeroVideo';
import { StrengthAndNotices } from './components/home/StrengthAndNotices';
import { QuoteBanner } from './components/home/QuoteBanner';
import { AboutSection } from './components/home/AboutSection';
import { UnitIntroduction } from './components/home/UnitIntroduction';
import { MissionVisionValues } from './components/home/MissionVisionValues';
import { TrainingActivities } from './components/home/TrainingActivities';
import { UpcomingEvents } from './components/home/UpcomingEvents';
import { Achievements } from './components/home/Achievements';
import { GallerySection } from './components/home/GallerySection';
import { JoinNCC } from './components/home/JoinNCC';
import { ContactSection } from './components/home/ContactSection';
import { Footer } from './components/home/Footer';
import { KnowledgeHub } from './components/home/KnowledgeHub';
import { MeetOurSeniors } from './components/home/MeetOurSeniors';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { RoleShellView } from './components/shells/RoleShellView';
import { HelpButton } from './components/common/HelpButton';
import { DigitalIdVerification } from './components/digitalId/DigitalIdView';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [activeShellRole, setActiveShellRole] = useState<string | null>(null);

  const handleSelectShell = (role: string) => {
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
  if (window.location.pathname.startsWith('/verify-id/')) return <DigitalIdVerification />;

  return (
    <div className="app-root">
      <a className="skip-link" href={currentRole ? '#role-main-content' : '#main-content'}>
        Skip to main content
      </a>
      {/* 1. Cinematic Entrance with Deep Navy Theatre Curtains */}
      <CinematicIntro />

      {/* If a Role Shell Preview or authenticated session is active, display it */}
      {currentRole ? (
        <RoleShellView role={currentRole} onBackToHome={handleBackToHome} />
      ) : (
        /* Otherwise, display the Institutional Homepage */
        <>
          <Header
            onOpenLogin={() => setLoginModalOpen(true)}
            onOpenRegister={() => setRegisterModalOpen(true)}
            onSelectShell={handleSelectShell}
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

            <KnowledgeHub />

            {/* AIT Pune NCC Unit Detachment & Affiliation */}
            <UnitIntroduction />

            {/* Institutional Principles, Mission & Ethos */}
            <MissionVisionValues />

            {/* Training Curriculum & Regimental Drills */}
            <TrainingActivities />

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
            />

            {/* Unit Liaison & Contact */}
            <ContactSection onOpenLogin={() => setLoginModalOpen(true)} />
          </main>

          {/* Deep Navy Institutional Footer matching reference */}
          <Footer />
        </>
      )}

      {/* Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={(role) => { setActiveShellRole(role); setLoginModalOpen(false); }}
      />

      <RegisterModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
      />

      <HelpButton />
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
