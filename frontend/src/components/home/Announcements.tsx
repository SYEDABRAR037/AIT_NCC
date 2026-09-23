import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, FileText } from 'lucide-react';

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: string;
}

export const Announcements: React.FC = () => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/notices')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.notices) {
          setNotices(data.notices);
        }
      })
      .catch((err) => console.error('Notices fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="notices" className="section-py" aria-label="Official Unit Notices">
      <div className="container">
        <div className="section-header">
          <span className="sub-title">
            <Bell size={16} />
            Official Bulletins
          </span>
          <h2 className="cinzel-title">Announcements & Public Notices</h2>
          <p className="description">
            Published circulars, orders, and institutional announcements from the Command Desk.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--navy-text-muted)' }}>
            Retrieving official gazette records...
          </div>
        ) : notices.length === 0 ? (
          <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <FileText size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
            <h4 style={{ color: 'var(--navy-primary)' }}>No active public notices published</h4>
            <p>Check back for forthcoming parade notices and institutional announcements.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '900px', margin: '0 auto' }}>
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="institutional-card"
                style={{
                  borderLeft: notice.isUrgent ? '4px solid #0A192F' : '4px solid var(--navy-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {notice.isUrgent && (
                      <span className="badge-dark" style={{ background: '#0A192F' }}>
                        <AlertCircle size={12} />
                        <span>URGENT CIRCULAR</span>
                      </span>
                    )}
                    <span className="badge-institutional">
                      {notice.category}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
                    {new Date(notice.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>
                  {notice.title}
                </h3>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>{notice.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
