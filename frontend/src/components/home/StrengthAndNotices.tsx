import React, { useState, useEffect } from 'react';
import { Users, Building, Flag, Calendar, Bell, ArrowRight, X, FileText, AlertCircle } from 'lucide-react';

interface StatsData {
  totalApprovedCadets: number;
  platoonsCount: number;
  upcomingEventsCount: number;
  campsCount: number;
  activitiesCount: number;
}

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: string;
}

export const StrengthAndNotices: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [showAllNoticesModal, setShowAllNoticesModal] = useState(false);

  useEffect(() => {
    // 1. Fetch real public stats
    fetch('/api/public/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch((err) => console.error('Error fetching stats:', err))
      .finally(() => setLoadingStats(false));

    // 2. Fetch real public notices
    fetch('/api/public/notices')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.notices) {
          setNotices(data.notices);
        }
      })
      .catch((err) => console.error('Error fetching notices:', err))
      .finally(() => setLoadingNotices(false));
  }, []);

  const formatNoticeDate = (isoDate: string) => {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCategoryBadgeClass = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('event') || lower.includes('camp')) return 'ref-badge-event';
    if (lower.includes('notice') || lower.includes('urgent') || lower.includes('alert')) return 'ref-badge-notice';
    return 'ref-badge-general';
  };

  // Real database numbers with 0 fallback
  const totalCadetsDisplay = loadingStats ? '...' : (stats?.totalApprovedCadets ? `${stats.totalApprovedCadets}+` : '0');
  const companiesDisplay = '0';
  const battalionsDisplay = '0';
  const activitiesDisplay = loadingStats ? '...' : (stats?.activitiesCount || stats?.upcomingEventsCount ? `${(stats?.activitiesCount || 0) + (stats?.upcomingEventsCount || 0)}+` : '0');

  return (
    <section id="notices" className="ref-strength-notices-section" aria-label="Our Strength and Latest Notices">
      <div className="ref-strength-notices-container">
        <div className="ref-strength-notices-grid">
          {/* ================= LEFT CARD: OUR STRENGTH (Matching Reference) ================= */}
          <div className="ref-strength-card">
            <img
              src="/assets/strength_dusk.jpg"
              alt="Cadets parade formation at dusk"
              className="ref-strength-bg"
            />
            <div className="ref-strength-overlay" />

            <div className="ref-strength-content">
              <div className="ref-strength-header">
                <h2 className="ref-strength-title">Our Strength</h2>
                <p className="ref-strength-sub">Together We Build a Better Tomorrow</p>
              </div>

              {/* 4 Bottom Columns with Dividers (Matching Reference) */}
              <div className="ref-strength-metrics-row">
                <div className="ref-metric-col">
                  <div className="ref-metric-icon">
                    <Users size={22} />
                  </div>
                  <div className="ref-metric-num">{totalCadetsDisplay}</div>
                  <div className="ref-metric-lbl">Total Cadets</div>
                </div>

                <div className="ref-metric-divider" />

                <div className="ref-metric-col">
                  <div className="ref-metric-icon">
                    <Building size={22} />
                  </div>
                  <div className="ref-metric-num">{companiesDisplay}</div>
                  <div className="ref-metric-lbl">Companies</div>
                </div>

                <div className="ref-metric-divider" />

                <div className="ref-metric-col">
                  <div className="ref-metric-icon">
                    <Flag size={22} />
                  </div>
                  <div className="ref-metric-num">{battalionsDisplay}</div>
                  <div className="ref-metric-lbl">Battalions</div>
                </div>

                <div className="ref-metric-divider" />

                <div className="ref-metric-col">
                  <div className="ref-metric-icon">
                    <Calendar size={22} />
                  </div>
                  <div className="ref-metric-num">{activitiesDisplay}</div>
                  <div className="ref-metric-lbl">Activities/Year</div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= RIGHT CARD: LATEST NOTICES (Matching Reference) ================= */}
          <div className="ref-notices-card">
            <div className="ref-notices-card-header">
              <div className="ref-notices-header-left">
                <Bell size={20} className="ref-notices-bell-icon" />
                <h3 className="ref-notices-card-title">Latest Notices</h3>
              </div>
              <button
                className="ref-notices-view-all"
                onClick={() => setShowAllNoticesModal(true)}
              >
                <span>View All</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="ref-notices-list">
              {loadingNotices ? (
                <div className="ref-notices-loading">
                  Loading official notices...
                </div>
              ) : notices.length === 0 ? (
                <div className="ref-notices-empty">
                  <FileText size={32} style={{ color: '#94A3B8', marginBottom: '0.5rem' }} />
                  <p>No notices published yet.</p>
                </div>
              ) : (
                notices.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="ref-notice-row"
                    onClick={() => setSelectedNotice(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedNotice(n);
                    }}
                  >
                    <div className="ref-notice-row-left">
                      <span className={`ref-notice-badge ${getCategoryBadgeClass(n.category)}`}>
                        {n.category || 'General'}
                      </span>
                      <span className="ref-notice-title" title={n.title}>
                        {n.title}
                      </span>
                    </div>
                    <span className="ref-notice-date">{formatNoticeDate(n.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Notice Detail Lightbox Modal */}
      {selectedNotice && (
        <div className="ref-modal-backdrop" onClick={() => setSelectedNotice(null)}>
          <div className="ref-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span className={`ref-notice-badge ${getCategoryBadgeClass(selectedNotice.category)}`}>
                    {selectedNotice.category}
                  </span>
                  {selectedNotice.isUrgent && (
                    <span className="ref-notice-badge ref-badge-notice" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={11} />
                      URGENT
                    </span>
                  )}
                </div>
                <h3 className="ref-modal-title">{selectedNotice.title}</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.2rem' }}>
                  Published on {formatNoticeDate(selectedNotice.createdAt)}
                </div>
              </div>
              <button
                className="ref-modal-close-btn"
                onClick={() => setSelectedNotice(null)}
                aria-label="Close notice"
              >
                <X size={18} />
              </button>
            </div>
            <div className="ref-modal-body">
              <p style={{ whiteSpace: 'pre-line', fontSize: '0.92rem', lineHeight: '1.7', color: '#334155' }}>
                {selectedNotice.content}
              </p>
              <div className="ref-modal-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  className="ref-modal-action-btn"
                  onClick={() => setSelectedNotice(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View All Notices Modal */}
      {showAllNoticesModal && (
        <div className="ref-modal-backdrop" onClick={() => setShowAllNoticesModal(false)}>
          <div className="ref-modal-box" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ref-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={20} style={{ color: '#2563EB' }} />
                <h3 className="ref-modal-title">All Institutional Notices</h3>
              </div>
              <button
                className="ref-modal-close-btn"
                onClick={() => setShowAllNoticesModal(false)}
                aria-label="Close notices modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="ref-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {notices.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748B', padding: '2rem' }}>No notices published yet.</p>
              ) : (
                notices.map((n) => (
                  <div
                    key={n.id}
                    className="ref-notice-row"
                    onClick={() => {
                      setShowAllNoticesModal(false);
                      setSelectedNotice(n);
                    }}
                    style={{ padding: '0.9rem 0' }}
                  >
                    <div className="ref-notice-row-left">
                      <span className={`ref-notice-badge ${getCategoryBadgeClass(n.category)}`}>
                        {n.category}
                      </span>
                      <span className="ref-notice-title">{n.title}</span>
                    </div>
                    <span className="ref-notice-date">{formatNoticeDate(n.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
