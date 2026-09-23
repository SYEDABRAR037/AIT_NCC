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
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { RoleShellView } from './components/shells/RoleShellView';
import { AiCadetAssistant } from './components/assistant/AiCadetAssistant';

const AppContent: React.FC = () => {
  const { user, login } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [activeShellRole, setActiveShellRole] = useState<string | null>(null);

  const roleTestCredentials: Record<string, { email: string; pass: string }> = {
    ADMIN_ANO: { email: 'ano.admin@aitpune.edu.in', pass: 'AdminCommand@2026' },
    PLATOON_SENIOR: { email: 'platoon.senior@aitpune.edu.in', pass: 'PlatoonLead@2026' },
    SENIOR: { email: 'senior.cadet@aitpune.edu.in', pass: 'SeniorCadet@2026' },
  };

  const handleSelectShell = async (role: string) => {
    setActiveShellRole(role);
    if (!user || user.role !== role) {
      const creds = roleTestCredentials[role];
      if (creds) {
        await login(creds.email, creds.pass);
      } else if (role === 'CADET') {
        setLoginModalOpen(true);
      }
    }
  };

  const handleBackToHome = () => {
    setActiveShellRole(null);
  };

  const currentRole = activeShellRole || (user ? user.role : null);

  return (
    <div className="app-root">
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

          <main id="main-content">
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
        onLoginSuccess={(role) => handleSelectShell(role)}
      />

      <RegisterModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
      />

      {/* 24/7 Verified AI Cadet Assistant (Command Saathi) */}
      <AiCadetAssistant />
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
