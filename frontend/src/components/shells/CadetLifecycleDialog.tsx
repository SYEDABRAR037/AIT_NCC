import React, { useState } from 'react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

export type CadetLifecycleAction = 'DEACTIVATE' | 'REACTIVATE';

export interface CadetLifecycleSubmission {
  action: CadetLifecycleAction;
  reasonCode?: string;
  otherReason?: string;
  effectiveDate?: string;
  remarks?: string;
}

interface CadetLifecycleDialogProps {
  cadet: { fullName: string; regimentalNumber: string; status: string };
  action: CadetLifecycleAction;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: CadetLifecycleSubmission) => Promise<string | null>;
}

const todayForDateInput = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const reasonOptions = [
  ['WITHDRAWN', 'Withdrawn from NCC'],
  ['PASSED_OUT', 'Passed Out'],
  ['TRANSFERRED', 'Transferred'],
  ['LEFT_INSTITUTION', 'Left institution'],
  ['MEDICAL_OTHER', 'Medical/other approved reason'],
  ['OTHER', 'Other'],
];

export const CadetLifecycleDialog: React.FC<CadetLifecycleDialogProps> = ({
  cadet,
  action,
  submitting,
  onClose,
  onSubmit,
}) => {
  const dialogRef = useAccessibleDialog<HTMLDivElement>(true, onClose);
  const [reasonCode, setReasonCode] = useState('WITHDRAWN');
  const [otherReason, setOtherReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayForDateInput);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const isDeactivation = action === 'DEACTIVATE';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const message = await onSubmit({
      action,
      reasonCode: isDeactivation ? reasonCode : undefined,
      otherReason: reasonCode === 'OTHER' ? otherReason : undefined,
      effectiveDate: isDeactivation ? effectiveDate : todayForDateInput(),
      remarks: remarks.trim() || undefined,
    });
    if (message) setError(message);
    else onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(7, 26, 51, 0.72)' }}
    >
      <div
        ref={dialogRef}
        className="institutional-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadet-lifecycle-title"
        tabIndex={-1}
        style={{ width: 'min(100%, 540px)', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', background: 'var(--color-background)' }}
      >
        <form onSubmit={handleSubmit}>
          <h2 id="cadet-lifecycle-title" style={{ color: 'var(--navy-primary)', fontSize: '1.3rem', marginBottom: '0.55rem' }}>
            {isDeactivation ? 'Deactivate Cadet' : 'Reactivate Cadet'}
          </h2>
          <p style={{ color: 'var(--navy-text-muted)', lineHeight: 1.55, marginBottom: '1rem' }}>
            {isDeactivation
              ? <>Mark <strong>{cadet.fullName}</strong> (Regimental No: {cadet.regimentalNumber}) as no longer active in NCC. Historical records will be preserved.</>
              : <>Restore <strong>{cadet.fullName}</strong> (Regimental No: {cadet.regimentalNumber}) to ACTIVE status. Previous withdrawal history will be preserved.</>}
          </p>

          {isDeactivation && (
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--navy-primary)', fontWeight: 650, fontSize: '0.88rem' }}>
                Reason
                <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} required>
                  {reasonOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {reasonCode === 'OTHER' && (
                <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--navy-primary)', fontWeight: 650, fontSize: '0.88rem' }}>
                  Short reason
                  <input value={otherReason} onChange={(event) => setOtherReason(event.target.value)} maxLength={200} required />
                </label>
              )}
              <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--navy-primary)', fontWeight: 650, fontSize: '0.88rem' }}>
                Effective date
                <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required />
              </label>
            </div>
          )}

          <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.9rem', color: 'var(--navy-primary)', fontWeight: 650, fontSize: '0.88rem' }}>
            Remarks (optional)
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={500} rows={3} />
          </label>

          {error && <p role="alert" style={{ color: 'var(--color-error)', marginTop: '0.75rem' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
            <button
              type="submit"
              className={isDeactivation ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
              disabled={submitting || (isDeactivation && reasonCode === 'OTHER' && !otherReason.trim())}
              style={isDeactivation ? { borderColor: 'var(--color-error)', color: 'var(--color-error)' } : undefined}
            >
              {submitting ? 'Saving…' : isDeactivation ? 'Deactivate Cadet' : 'Reactivate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
