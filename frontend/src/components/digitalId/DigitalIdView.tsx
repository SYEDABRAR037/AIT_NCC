import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const DigitalIdView: React.FC<{ token: string | null }> = ({ token }) => {
  const [data, setData] = useState<any>(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) return;
    fetch('/api/digital-id/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => { const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.message || 'Digital ID unavailable.'); return d; })
      .then(async (d) => { setData(d); setQr(await QRCode.toDataURL(`${window.location.origin}/verify-id/${encodeURIComponent(d.token)}`, { width: 240, margin: 1, errorCorrectionLevel: 'M' })); })
      .catch((e) => setError(e.message));
  }, [token]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Loading Digital NCC ID…</p>;
  const c = data.cadet;
  return <section style={{ maxWidth: 760, margin: '1.5rem auto', padding: '1.5rem', background: '#fff', border: '1px solid #d8e0ed', borderRadius: 12 }}>
    <div id="digital-ncc-id" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}><h2>NCC AIT Pune</h2><h3>Digital NCC ID</h3>{c.profilePhotoUrl && <img src={c.profilePhotoUrl} alt="Cadet" style={{ width: 110, height: 130, objectFit: 'cover', borderRadius: 8 }} />}<p><b>{c.fullName}</b></p><p>{c.rank} · {c.regimentalNumber}</p><p>Roll no. {c.collegeRollNumber}</p><p>Year {c.year} · {c.platoonName}{c.team ? ` · ${c.team}` : ''}</p><p>Status: {c.status}</p></div>
      <img src={qr} alt="Secure ID verification QR code" width={200} height={200} />
    </div>
    <button onClick={() => window.print()} className="btn-primary" style={{ marginTop: 16 }}>Print / Save ID</button>
  </section>;
};

export const DigitalIdVerification: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const token = decodeURIComponent(window.location.pathname.split('/').pop() || '');
  useEffect(() => { fetch(`/api/public/digital-id/${encodeURIComponent(token)}`).then((r) => r.json()).then(setResult).catch(() => setResult({ status: 'UNAVAILABLE' })); }, [token]);
  return <main style={{ maxWidth: 600, margin: '4rem auto', padding: 24, fontFamily: 'sans-serif', color: '#0b1f3a' }}><h1>NCC AIT Pune · ID Verification</h1>{!result ? <p>Verifying…</p> : <><h2>{result.status === 'VALID' ? 'Valid' : result.status === 'INACTIVE' ? 'Inactive' : result.status === 'PASSED_OUT' ? 'Passed Out' : result.status === 'DEACTIVATED' ? 'Deactivated' : 'Invalid NCC ID'}</h2>{result.cadet && <p>{result.cadet.fullName} · {result.cadet.rank} · {result.cadet.regimentalNumber}</p>}</>}</main>;
};
