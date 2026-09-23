import React, { useState } from 'react';
import { Users, CalendarCheck, Award, Tent, ShieldCheck, MessageSquare, ArrowRight, X } from 'lucide-react';

interface FeatureCardsProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

interface FeatureInfoModal {
  title: string;
  badge: string;
  description: string;
  actionText: string;
  actionType: 'login' | 'register' | 'scroll';
  scrollTarget?: string;
}

export const FeatureCards: React.FC<FeatureCardsProps> = ({ onOpenLogin, onOpenRegister }) => {
  const [activeModal, setActiveModal] = useState<FeatureInfoModal | null>(null);

  const features = [
    {
      id: 'cadet-mgmt',
      title: 'Cadet Management',
      description: 'Registration, profile, leave, attendance and more.',
      icon: Users,
      bgColor: '#EBF5FF',
      iconColor: '#2563EB',
      modalInfo: {
        title: 'Cadet Management Portal',
        badge: 'Cadet Services',
        description: 'Complete digital profile management for enrolled cadets. Track your regimental credentials, platoon assignments, promotion stages, and personal service records with verified administrative accountability.',
        actionText: 'Register as Cadet',
        actionType: 'register' as const,
      },
    },
    {
      id: 'attendance',
      title: 'Attendance System',
      description: 'Track daily attendance, view records and reports.',
      icon: CalendarCheck,
      bgColor: '#ECFDF5',
      iconColor: '#059669',
      modalInfo: {
        title: 'Biometric Attendance System',
        badge: 'Parade Discipline',
        description: 'Authorized Seniors and Platoon Seniors record parade muster rolls using the rapid circular face verification scanner. Cadets can log in to view their verified parade ledger and minimum 75% eligibility required for Certificate exams.',
        actionText: 'Login to View Attendance',
        actionType: 'login' as const,
      },
    },
    {
      id: 'certificates',
      title: 'Certificates',
      description: 'Upload & verify certificates (NCC/Camps/Sports/etc).',
      icon: Award,
      bgColor: '#FFF7ED',
      iconColor: '#EA580C',
      modalInfo: {
        title: 'Certificate Vault & Verification',
        badge: 'Credentials',
        description: 'Institutional vault for official NCC "A", "B", and "C" Certificates, camp credentials, and sports honors. Generate authentic QR-verified transcripts for Armed Forces SSB interviews and civilian recruitments.',
        actionText: 'Access Certificate Vault',
        actionType: 'login' as const,
      },
    },
    {
      id: 'camps',
      title: 'Camps & Activities',
      description: 'Get updates on camps, training and events.',
      icon: Tent,
      bgColor: '#FAF5FF',
      iconColor: '#9333EA',
      modalInfo: {
        title: 'Camps & Training Activities',
        badge: 'Field Operations',
        description: 'Official schedule for Combined Annual Training Camps (CATC), Thal Sainik Camp (TSC), Republic Day Camp (RDC), and National Integration Camps (NIC). Explore upcoming scheduled camps below.',
        actionText: 'View Scheduled Camps',
        actionType: 'scroll' as const,
        scrollTarget: 'activities',
      },
    },
    {
      id: 'leave-duties',
      title: 'Leave & Duties',
      description: 'Apply for leave, view duties and manage your schedule.',
      icon: ShieldCheck,
      bgColor: '#FFF1F2',
      iconColor: '#E11D48',
      modalInfo: {
        title: 'Cadet Leave & Duty Sanctioning',
        badge: 'Administrative Protocol',
        description: 'Structured NCC leave workflow: submit academic or medical leave requests through the hierarchical approval chain (Senior → Platoon Senior → ANO Command Desk) with zero paper delays.',
        actionText: 'Apply for Leave / Duties',
        actionType: 'login' as const,
      },
    },
    {
      id: 'communication',
      title: 'Communication',
      description: 'Stay connected with seniors, platoon and administration.',
      icon: MessageSquare,
      bgColor: '#F0FDFA',
      iconColor: '#0D9488',
      modalInfo: {
        title: 'Regimental Communication Network',
        badge: 'Unit Command',
        description: 'Hierarchical bulletin broadcasts, platoon instructions, and 24/7 AI-guided doctrine assistance via Command Saathi. Keep every cadet aligned with zero communication gaps.',
        actionText: 'Explore Announcements',
        actionType: 'scroll' as const,
        scrollTarget: 'notices',
      },
    },
  ];

  const handleAction = (modal: FeatureInfoModal) => {
    setActiveModal(null);
    if (modal.actionType === 'register') {
      onOpenRegister();
    } else if (modal.actionType === 'login') {
      onOpenLogin();
    } else if (modal.actionType === 'scroll' && modal.scrollTarget) {
      const target = document.getElementById(modal.scrollTarget);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section id="services" className="ref-feature-cards-section" aria-label="NCC System Capabilities">
      <div className="ref-feature-cards-container">
        <div className="ref-feature-cards-grid">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="ref-feature-card"
                onClick={() => setActiveModal(item.modalInfo)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveModal(item.modalInfo);
                  }
                }}
              >
                <div
                  className="ref-feature-icon-wrapper"
                  style={{ backgroundColor: item.bgColor }}
                >
                  <Icon size={26} style={{ color: item.iconColor }} />
                </div>
                <h3 className="ref-feature-card-title">{item.title}</h3>
                <p className="ref-feature-card-desc">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Information Modal */}
      {activeModal && (
        <div className="ref-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="ref-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <div>
                <span className="ref-modal-badge">{activeModal.badge}</span>
                <h3 className="ref-modal-title">{activeModal.title}</h3>
              </div>
              <button
                className="ref-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="ref-modal-body">
              <p className="ref-modal-desc">{activeModal.description}</p>
              <div className="ref-modal-actions">
                <button
                  className="ref-modal-action-btn"
                  onClick={() => handleAction(activeModal)}
                >
                  <span>{activeModal.actionText}</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  className="ref-modal-cancel-btn"
                  onClick={() => setActiveModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
