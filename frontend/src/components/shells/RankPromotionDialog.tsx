import React, { useState } from 'react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

export const NCC_CADET_RANKS = ['CDT', 'LCPL', 'CPL', 'SGT', 'CQMH', 'CSM', 'JUO', 'SUO'];

interface RankPromotionDialogProps {
  cadet: { id: string; fullName: string; regimentalNumber: string; rank?: string };
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { rank: string; appointmentDate: string; remarks: string }) => Promise<string | null>;
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const RankPromotionDialog: React.FC<RankPromotionDialogProps> = ({ cadet, saving, onClose, onSubmit }) => {
  const dialogRef = useAccessibleDialog<HTMLDivElement>(true, onClose);
  const [rank, setRank] = useState(cadet.rank || 'CDT');
  const [appointmentDate, setAppointmentDate] = useState(localToday);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const message = await onSubmit({ rank, appointmentDate, remarks: remarks.trim() });
    if (message) setError(message);
    else onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(7, 26, 51, 0.72)' }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="rank-dialog-title" tabIndex={-1} className="institutional-modal-card" style={{ width: 'min(100%, 520px)', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', background: 'var(--color-background)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <h2 id="rank-dialog-title" style={{ margin: 0, color: 'var(--navy-primary)' }}>Update NCC Rank</h2>
          <p style={{ margin: 0, color: 'var(--navy-text-muted)' }}>{cadet.fullName} · {cadet.regimentalNumber} · Current rank: <strong>{cadet.rank || 'CDT'}</strong></p>
          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 650, color: 'var(--navy-primary)' }}>
            New rank
            <select required value={rank} onChange={(event) => setRank(event.target.value)}>
              {NCC_CADET_RANKS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 650, color: 'var(--navy-primary)' }}>
            Appointment / promotion date
            <input type="date" required value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 650, color: 'var(--navy-primary)' }}>
            Official remarks (optional)
            <textarea rows={3} maxLength={500} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </label>
          {error && <p role="alert" style={{ margin: 0, color: 'var(--color-error)' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={saving || rank === (cadet.rank || 'CDT')}>{saving ? 'Saving…' : 'Save Rank Appointment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
