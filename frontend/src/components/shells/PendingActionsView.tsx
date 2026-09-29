import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ClipboardList, RefreshCw } from 'lucide-react';
import { safeApiFetch } from '../../utils/api';

interface PendingAction {
  id: string;
  type: string;
  title: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  targetTab: string;
}

interface PendingActionsViewProps {
  onOpen: (tab: string) => void;
}

export const PendingActionsView: React.FC<PendingActionsViewProps> = ({ onOpen }) => {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await safeApiFetch('/api/dashboard/pending-actions');
      if (!ok || !data?.success) throw new Error(data?.message || 'Could not load pending actions');
      setActions(data.actions || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load pending actions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActions();
    window.addEventListener('ncc:data-updated', loadActions);
    return () => window.removeEventListener('ncc:data-updated', loadActions);
  }, [loadActions]);

  return (
    <section className="institutional-card" aria-labelledby="pending-actions-heading" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ClipboardList size={19} aria-hidden="true" style={{ color: 'var(--navy-primary)' }} />
          <h2 id="pending-actions-heading" style={{ fontSize: '1.05rem', color: 'var(--navy-primary)', margin: 0 }}>Pending Actions</h2>
          {!loading && <span className="badge-institutional">{actions.length}</span>}
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={loadActions} disabled={loading} aria-label="Refresh pending actions">
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <p role="status" style={{ color: 'var(--navy-text-muted)', margin: 0 }}>Loading your pending actions…</p>
      ) : error ? (
        <div role="alert" style={{ color: 'var(--color-error)' }}>{error}</div>
      ) : actions.length === 0 ? (
        <p style={{ color: 'var(--navy-text-muted)', margin: 0 }}>You have no pending actions.</p>
      ) : (
        <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
          {actions.map((action) => (
            <li key={`${action.type}-${action.id}`}>
              <button
                type="button"
                onClick={() => onOpen(action.targetTab)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.7rem 0.8rem', textAlign: 'left', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-background)', color: 'var(--color-text)', cursor: 'pointer' }}
              >
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: 'var(--navy-primary)' }}>{action.title}</strong>
                  <span style={{ color: 'var(--navy-text-muted)', fontSize: '0.82rem' }}>{action.type.replace(/_/g, ' ')} · {action.subject} · {action.status}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  {action.priority !== 'NORMAL' && <span className="badge-institutional" style={{ color: action.priority === 'URGENT' ? 'var(--color-error)' : 'var(--navy-primary)' }}>{action.priority}</span>}
                  <time dateTime={action.createdAt} style={{ color: 'var(--navy-text-muted)', fontSize: '0.78rem' }}>{new Date(action.createdAt).toLocaleDateString()}</time>
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
