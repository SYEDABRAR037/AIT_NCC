import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/api';

const ranks = ['SUO', 'JUO', 'CSM', 'CQMH', 'SGT', 'CPL', 'LCPL'];
type Photo = { id: string; title: string; category: string; altText: string; isPublished: boolean };

export const MediaManagementView: React.FC<{ role: string }> = ({ role }) => {
  const { token } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [category, setCategory] = useState('NCC');
  const [file, setFile] = useState<File | null>(null);
  const [rank, setRank] = useState(ranks[0]);
  const [holderName, setHolderName] = useState('');
  const [rankPhoto, setRankPhoto] = useState<File | null>(null);
  const [institutionalInfo, setInstitutionalInfo] = useState({ address: '', email: '', phone: '', timings: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const api = getApiBaseUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const loadPhotos = async () => {
    const response = await fetch(`${api}/api/gallery`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load photos.');
    setPhotos(data.photos);
  };
  useEffect(() => {
    loadPhotos().catch((e) => setError(e.message));
    if (role === 'ADMIN_ANO') fetch(`${api}/api/public/institutional-info`).then((r) => r.json()).then((d) => { if (d.success && d.info) setInstitutionalInfo({ address: d.info.address || '', email: d.info.email || '', phone: d.info.phone || '', timings: d.info.timings || '' }); }).catch(() => undefined);
  }, []);

  const submitPhoto = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (!file) throw new Error('Choose a photo to upload.');
      const body = new FormData(); body.append('image', file); body.append('title', title); body.append('altText', altText); body.append('category', category); body.append('isPublished', 'true');
      const response = await fetch(`${api}/api/gallery`, { method: 'POST', headers, body });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Upload failed.');
      await loadPhotos(); setTitle(''); setAltText(''); setFile(null); setMessage('Photo uploaded and published.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); }
  };

  const editPhoto = async (photo: Photo) => {
    const nextTitle = window.prompt('Photo title', photo.title);
    if (nextTitle === null) return;
    const nextAlt = window.prompt('Photo description', photo.altText);
    if (nextAlt === null) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData(); body.append('title', nextTitle); body.append('altText', nextAlt); body.append('category', photo.category); body.append('isPublished', String(photo.isPublished));
      const response = await fetch(`${api}/api/gallery/${photo.id}`, { method: 'PUT', headers, body }); const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Update failed.'); await loadPhotos(); setMessage('Photo details updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed.'); } finally { setBusy(false); }
  };

  const removePhoto = async (id: string) => {
    setBusy(true); setError(''); setMessage('');
    try { const response = await fetch(`${api}/api/gallery/${id}`, { method: 'DELETE', headers }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Delete failed.'); await loadPhotos(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed.'); } finally { setBusy(false); }
  };

  const saveInstitutionalInfo = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${api}/api/institutional-info`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(institutionalInfo) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save information.');
      setMessage('Institutional information saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save information.'); } finally { setBusy(false); }
  };

  const saveRank = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (!rankPhoto) throw new Error('Choose the actual rank holder photo.');
      const body = new FormData(); body.append('rank', rank); body.append('name', holderName); body.append('isActive', 'true'); body.append('image', rankPhoto);
      const response = await fetch(`${api}/api/rank-holders`, { method: 'PUT', headers, body }); const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save rank holder.');
      setMessage(`${rank} holder saved.`); setHolderName(''); setRankPhoto(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save rank holder.'); } finally { setBusy(false); }
  };

  return <section aria-labelledby="media-title" style={{ display: 'grid', gap: '1.5rem' }}>
    <h2 id="media-title">Photo Archives</h2>
    {error && <p role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>}{message && <p role="status">{message}</p>}
    <form className="institutional-card" onSubmit={submitPhoto} style={{ display: 'grid', gap: '.8rem' }}>
      <h3>Upload a photograph</h3>
      <label>Title<input required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Description<input required value={altText} onChange={(e) => setAltText(e.target.value)} /></label>
      <label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
      <label>Photo (JPEG, PNG, or WebP; max 5 MB)<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      <button className="btn-primary" disabled={busy}>Upload</button>
    </form>
    <div className="institutional-card"><h3>Published and unpublished photographs</h3>{photos.length ? photos.map((photo) => <div key={photo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '.6rem 0', borderBottom: '1px solid var(--color-border)' }}><span>{photo.title} · {photo.isPublished ? 'Published' : 'Unpublished'}</span><span style={{ display: 'flex', gap: '.4rem' }}><button className="btn-secondary" disabled={busy} onClick={() => editPhoto(photo)}>Edit details</button><button className="btn-secondary" disabled={busy} onClick={() => removePhoto(photo.id)}>Remove</button></span></div>) : <p>No photographs uploaded.</p>}</div>
    {role === 'ADMIN_ANO' && <form className="institutional-card" onSubmit={saveInstitutionalInfo} style={{ display: 'grid', gap: '.8rem' }}>
      <h3>Approved institutional information</h3>
      {(['address', 'email', 'phone', 'timings'] as const).map((field) => <label key={field}>{field[0].toUpperCase() + field.slice(1)}<input value={institutionalInfo[field]} onChange={(e) => setInstitutionalInfo((current) => ({ ...current, [field]: e.target.value }))} /></label>)}
      <button className="btn-primary" disabled={busy}>Save institutional information</button>
    </form>}
    {role === 'ADMIN_ANO' && <form className="institutional-card" onSubmit={saveRank} style={{ display: 'grid', gap: '.8rem' }}>
      <h3>Update a rank holder</h3><label>Rank<select value={rank} onChange={(e) => setRank(e.target.value)}>{ranks.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Actual holder name<input required value={holderName} onChange={(e) => setHolderName(e.target.value)} /></label>
      <label>Actual holder photograph<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setRankPhoto(e.target.files?.[0] || null)} /></label>
      <button className="btn-primary" disabled={busy}>Save rank holder</button>
    </form>}
  </section>;
};
