import React, { useState } from 'react';
import { Users, CalendarCheck, Award, Tent, ShieldCheck, MessageSquare, ArrowRight, X } from 'lucide-react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

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
  const dialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(activeModal), () => setActiveModal(null));

  const features = [
    {
      id: 'cadet-mgmt',
      title: 'Cadet Management',
      description: 'Registration, profiles, leave, and attendance.',
      icon: Users,
      bgColor: 'var(--color-info-soft)',
      iconColor: 'var(--color-accent)',
      modalInfo: {
        title: 'Cadet Services',
        badge: 'Cadet Services',
        description: 'Manage your profile, service record, and leave.',
        actionText: 'Register as Cadet',
        actionType: 'register' as const,
      },
    },
    {
      id: 'attendance',
      title: 'Attendance System',
      description: 'Record parade attendance and view your record.',
      icon: CalendarCheck,
      bgColor: 'var(--color-success-soft)',
      iconColor: 'var(--color-success)',
      modalInfo: {
        title: 'Attendance',
        badge: 'Parades',
        description: 'View parade attendance and certificate eligibility.',
        actionText: 'Login to View Attendance',
        actionType: 'login' as const,
      },
    },
    {
      id: 'certificates',
      title: 'Certificates',
      description: 'View and verify NCC, camp, and sports certificates.',
      icon: Award,
      bgColor: 'var(--color-warning-soft)',
      iconColor: 'var(--color-gold)',
      modalInfo: {
        title: 'Certificates',
        badge: 'Records',
        description: 'View NCC certificates and other awarded records.',
        actionText: 'Access Certificate Vault',
        actionType: 'login' as const,
      },
    },
    {
      id: 'camps',
      title: 'Camps & Activities',
      description: 'Camps, training, and events.',
      icon: Tent,
      bgColor: 'var(--color-info-soft)',
      iconColor: 'var(--color-accent)',
      modalInfo: {
        title: 'Camps & Activities',
        badge: 'Unit',
        description: 'See upcoming camps and training events.',
        actionText: 'View Scheduled Camps',
        actionType: 'scroll' as const,
        scrollTarget: 'activities',
      },
    },
    {
      id: 'leave-duties',
      title: 'Leave & Duties',
      description: 'Request leave and check your duties.',
      icon: ShieldCheck,
      bgColor: 'var(--color-error-soft)',
      iconColor: 'var(--color-error)',
      modalInfo: {
        title: 'Leave & Duties',
        badge: 'Cadet Services',
        description: 'Submit a leave request and check duty assignments.',
        actionText: 'Apply for Leave / Duties',
        actionType: 'login' as const,
      },
    },
    {
      id: 'communication',
      title: 'Communication',
      description: 'Notices, requests, and enquiries.',
      icon: MessageSquare,
      bgColor: 'var(--color-info-soft)',
      iconColor: 'var(--color-accent)',
      modalInfo: {
        title: 'Unit Updates',
        badge: 'Communication',
        description: 'Read notices and contact the unit.',
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
                aria-label={`${item.title}: ${item.description}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
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
        <div ref={dialogRef} className="ref-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feature-modal-title" tabIndex={-1} onClick={() => setActiveModal(null)}>
          <div className="ref-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <div>
                <span className="ref-modal-badge">{activeModal.badge}</span>
                <h3 id="feature-modal-title" className="ref-modal-title">{activeModal.title}</h3>
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
