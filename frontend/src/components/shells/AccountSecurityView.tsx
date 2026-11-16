import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Trash2, RefreshCw, KeyRound } from 'lucide-react';
import { safeApiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

type AuthSession = { id: string; createdAt: string; expiresAt: string; current: boolean };

export const AccountSecurityView: React.FC = () => {
  const auth = useAuth();
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadSessions = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { ok, data } = await safeApiFetch('/api/auth/sessions');
      if (!ok || !data?.success) throw new Error(data?.message || 'Could not load sessions.');
      setSessions(data.sessions || []);
    } catch (reason: any) { setError(reason?.message || 'Could not load sessions.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const revokeSession = async (session: AuthSession) => {
    setSaving(true); setError(''); setMessage('');
    try {
      const { ok, data } = await safeApiFetch(`/api/auth/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
      if (!ok || !data?.success) throw new Error(data?.message || 'Could not revoke session.');
      if (session.current) { await auth.logout(); return; }
      setMessage('Session revoked.'); await loadSessions();
    } catch (reason: any) { setError(reason?.message || 'Could not revoke session.'); }
    finally { setSaving(false); }
  };

  const revokeAll = async () => {
    setSaving(true); setError('');
    try {
      const { ok, data } = await safeApiFetch('/api/auth/sessions/revoke-all', { method: 'POST' });
      if (!ok || !data?.success) throw new Error(data?.message || 'Could not revoke sessions.');
      await auth.logout();
    } catch (reason: any) { setError(reason?.message || 'Could not revoke sessions.'); setSaving(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return; }
    if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) { setError('Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol.'); return; }
    setSaving(true);
    try {
      const { ok, data } = await safeApiFetch('/api/auth/password/change', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      if (!ok || !data?.success) throw new Error(data?.message || 'Could not change password.');
      await auth.logout();
    } catch (reason: any) { setError(reason?.message || 'Could not change password.'); setSaving(false); }
  };

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <section className="institutional-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0, color: 'var(--navy-primary)' }}><ShieldCheck size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Account Security</h2><p style={{ color: 'var(--navy-text-muted)', marginBottom: 0 }}>Manage your signed-in sessions and password.</p></div>
        <button type="button" className="btn-secondary" onClick={() => void loadSessions()} disabled={loading}><RefreshCw size={15} /> Refresh sessions</button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {message && <p role="status" style={{ color: 'var(--color-success)' }}>{message}</p>}
      {loading ? <p>Loading sessions…</p> : sessions.length ? <div style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
        {sessions.map((session) => <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.8rem', border: '1px solid var(--color-border)', borderRadius: 6 }}>
          <span><strong>{session.current ? 'This device' : 'Signed-in session'}</strong><small style={{ display: 'block', color: 'var(--navy-text-muted)' }}>Started {new Date(session.createdAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleString()}</small></span>
          <button type="button" className="btn-secondary" disabled={saving} onClick={() => void revokeSession(session)}><Trash2 size={14} /> Revoke</button>
        </div>)}
        <button type="button" className="btn-secondary" disabled={saving} onClick={() => void revokeAll()} style={{ justifySelf: 'start' }}>Sign out all devices</button>
      </div> : <p style={{ color: 'var(--navy-text-muted)' }}>No active sessions were returned.</p>}
    </section>
    <section className="institutional-card">
      <h3 style={{ marginTop: 0, color: 'var(--navy-primary)' }}><KeyRound size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Change password</h3>
      <form onSubmit={changePassword} style={{ display: 'grid', gap: '0.8rem', maxWidth: 520 }}>
        <label>Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>At least 12 characters, including upper and lower case, a number, and a symbol.</small></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        <button type="submit" className="btn-primary" disabled={saving}>Change password and sign out everywhere</button>
      </form>
    </section>
  </div>;
};
