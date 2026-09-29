import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/api';
import './media-management.css';

const ranks = ['SUO', 'JUO', 'CSM', 'CQMH', 'SGT', 'CPL', 'LCPL'];
const categories = ['Parade', 'Camp', 'Training', 'NCC Event', 'Competition', 'Trekking', 'Ceremony', 'Community Service', 'Other'];
type Photo = { id: string; title: string; category: string; altText: string; isPublished: boolean; createdAt: string; imageUrl: string };

export const MediaManagementView: React.FC<{ role: string }> = ({ role }) => {
  const { token } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Parade');
  const [file, setFile] = useState<File | null>(null);
  const [draggingPhoto, setDraggingPhoto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [rank, setRank] = useState(ranks[0]);
  const [holderName, setHolderName] = useState('');
  const [rankPhoto, setRankPhoto] = useState<File | null>(null);
  const [institutionalInfo, setInstitutionalInfo] = useState({ address: '', email: '', phone: '', timings: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const api = getApiBaseUrl();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const preview = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const loadPhotos = async () => {
    const response = await fetch(`${api}/api/gallery`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error('Photo archive could not be loaded. Please try again later.');
    setPhotos(data.photos || []);
  };
  useEffect(() => {
    loadPhotos().catch((e) => setError(e.message));
    if (role === 'ADMIN_ANO') fetch(`${api}/api/public/institutional-info`).then((r) => r.json()).then((d) => { if (d.success && d.info) setInstitutionalInfo({ address: d.info.address || '', email: d.info.email || '', phone: d.info.phone || '', timings: d.info.timings || '' }); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    Promise.all(photos.map(async (photo) => {
      try { const response = await fetch(`${api}${photo.imageUrl}`, { headers }); if (!response.ok) return [photo.id, ''] as const; const url = URL.createObjectURL(await response.blob()); objectUrls.push(url); return [photo.id, url] as const; }
      catch { return [photo.id, ''] as const; }
    })).then((entries) => { if (cancelled) objectUrls.forEach((url) => URL.revokeObjectURL(url)); else setImagePreviews(Object.fromEntries(entries)); });
    return () => { cancelled = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [photos, token]);

  const selectPhoto = (nextFile: File | null) => {
    setError('');
    if (!nextFile) { setFile(null); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) { setFile(null); setError('Choose a JPG, PNG, or WebP image.'); return; }
    if (nextFile.size > 5 * 1024 * 1024) { setFile(null); setError('The photo must be 5 MB or smaller.'); return; }
    setFile(nextFile);
  };

  const resetForm = () => { setTitle(''); setDescription(''); setCategory('Parade'); setFile(null); setEditId(null); const input = document.getElementById('archive-photo-file') as HTMLInputElement | null; if (input) input.value = ''; };
  const submitPhoto = async (event: React.FormEvent | React.MouseEvent, publish: boolean) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (!title.trim()) throw new Error('Enter a photo title.');
      if (!editId && !file) throw new Error('Choose a photo to upload.');
      const body = new FormData(); if (file) body.append('image', file); body.append('title', title.trim()); body.append('altText', description.trim() || title.trim()); body.append('category', category); body.append('isPublished', String(publish));
      const response = await fetch(`${api}/api/gallery${editId ? `/${editId}` : ''}`, { method: editId ? 'PUT' : 'POST', headers, body });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(response.status === 404 ? 'Photo archive service is unavailable. Please try again later.' : data.message || 'Photo could not be saved.');
      const savedMessage = publish ? 'Photograph published successfully.' : 'Photograph uploaded successfully.';
      resetForm(); setMessage(savedMessage);
      try { await loadPhotos(); } catch { setError('The photograph was saved, but the archive could not refresh. Reload the page to view it.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Photo could not be saved.'); }
    finally { setBusy(false); }
  };

  const editPhoto = (photo: Photo) => { setEditId(photo.id); setTitle(photo.title); setDescription(photo.altText || ''); setCategory(categories.includes(photo.category) ? photo.category : 'Other'); setFile(null); document.getElementById('archive-photo-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const setPublished = async (photo: Photo, publish: boolean) => {
    setBusy(true); setError(''); setMessage('');
    try { const body = new FormData(); body.append('title', photo.title); body.append('altText', photo.altText || photo.title); body.append('category', categories.includes(photo.category) || photo.category === 'NCC' ? photo.category : 'Other'); body.append('isPublished', String(publish)); const response = await fetch(`${api}/api/gallery/${photo.id}`, { method: 'PUT', headers, body }); const data = await response.json(); if (!response.ok || !data.success) throw new Error('Publication status could not be changed.'); await loadPhotos(); setMessage(publish ? 'Photograph published successfully.' : 'Photograph moved to drafts.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Publication status could not be changed.'); } finally { setBusy(false); }
  };
  const removePhoto = async (id: string) => {
    if (!window.confirm('Delete this photograph permanently?')) return;
    setBusy(true); setError(''); setMessage('');
    try { const response = await fetch(`${api}/api/gallery/${id}`, { method: 'DELETE', headers }); const data = await response.json(); if (!response.ok || !data.success) throw new Error('Photograph could not be deleted.'); await loadPhotos(); setMessage('Photograph deleted.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Photograph could not be deleted.'); } finally { setBusy(false); }
  };
  const viewPhoto = async (photo: Photo) => {
    const tab = window.open('about:blank', '_blank'); if (tab) tab.opener = null;
    try { const response = await fetch(`${api}${photo.imageUrl}`, { headers }); if (!response.ok) throw new Error(); const objectUrl = URL.createObjectURL(await response.blob()); if (tab) tab.location.href = objectUrl; else { const link = document.createElement('a'); link.href = objectUrl; link.download = photo.title; link.click(); } window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000); }
    catch { setError('This photograph could not be opened.'); }
  };

  const saveInstitutionalInfo = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const response = await fetch(`${api}/api/institutional-info`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(institutionalInfo) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error('Unable to save institutional information.'); setMessage('Institutional information saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save institutional information.'); } finally { setBusy(false); }
  };
  const saveRank = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { if (!rankPhoto) throw new Error('Choose the actual rank holder photo.'); const body = new FormData(); body.append('rank', rank); body.append('name', holderName); body.append('isActive', 'true'); body.append('image', rankPhoto); const response = await fetch(`${api}/api/rank-holders`, { method: 'PUT', headers, body }); const data = await response.json(); if (!response.ok || !data.success) throw new Error('Unable to save rank holder.'); setMessage(`${rank} holder saved.`); setHolderName(''); setRankPhoto(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save rank holder.'); } finally { setBusy(false); }
  };

  const renderCards = (items: Photo[]) => items.length ? <div className="archive-grid">{items.map((photo) => <article className="archive-card" key={photo.id}>
    <img src={imagePreviews[photo.id] || undefined} alt={photo.altText || photo.title} className="archive-card-image" />
    <div className="archive-card-body"><div className="archive-card-heading"><h4>{photo.title}</h4><span className={photo.isPublished ? 'archive-status is-published' : 'archive-status'}>{photo.isPublished ? 'Published' : 'Draft'}</span></div>
      <p className="archive-card-meta">{photo.category}{photo.createdAt ? ` · ${new Date(photo.createdAt).toLocaleDateString()}` : ''}</p>
      <div className="archive-card-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => void viewPhoto(photo)}>View</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => editPhoto(photo)}>Edit</button>{photo.isPublished ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => setPublished(photo, false)}>Unpublish</button> : <button type="button" className="btn-primary" disabled={busy} onClick={() => setPublished(photo, true)}>Publish</button>}<button type="button" className="archive-delete" disabled={busy} onClick={() => removePhoto(photo.id)}>Delete</button></div>
    </div></article>)}</div> : <div className="archive-empty">No photographs uploaded yet.</div>;

  return <section className="archive-page" aria-labelledby="media-title">
    <header className="archive-page-header"><h2 id="media-title">Photo Archives</h2><p>Official NCC AIT Pune photographs</p></header>
    {error && <p className="archive-feedback is-error" role="alert">{error}</p>}{message && <p className="archive-feedback is-success" role="status">{message}</p>}
    <form id="archive-photo-form" className="archive-form institutional-card" onSubmit={(event) => submitPhoto(event, false)}>
      <div className="archive-section-title"><div><span className="archive-eyebrow">PHOTO ARCHIVE</span><h3>{editId ? 'Edit Photograph' : 'Add Photograph'}</h3></div>{editId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel edit</button>}</div>
      <div className="archive-form-layout"><div>
        <label className={`archive-upload${draggingPhoto ? ' is-dragging' : ''}`} htmlFor="archive-photo-file" onDragOver={(event) => { event.preventDefault(); setDraggingPhoto(true); }} onDragLeave={() => setDraggingPhoto(false)} onDrop={(event) => { event.preventDefault(); setDraggingPhoto(false); selectPhoto(event.dataTransfer.files?.[0] || null); }}><input id="archive-photo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0] || null)} />
          {preview ? <img src={preview} alt="Selected photograph preview" className="archive-upload-preview" /> : <><span className="archive-upload-icon">＋</span><strong>Upload a photograph</strong><span>Drag and drop an image here or choose a file</span><span className="archive-choose-button">Choose Photo</span><small>JPG, PNG, or WebP · Maximum 5 MB</small></>}
        </label>
        {(file || (editId && !file)) && <div className="archive-file-info"><span>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Current photograph retained'}</span>{file && <button type="button" onClick={() => { setFile(null); const input = document.getElementById('archive-photo-file') as HTMLInputElement | null; if (input) input.value = ''; }}>Remove</button>}</div>}
      </div><div className="archive-fields">
        <label>Photo Title *<input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CATC 714 – Parade Training" /></label>
        <label>Category *<select required value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Description <span className="archive-optional">Optional</span><textarea maxLength={400} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a short caption" /></label>
        <div className="archive-form-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={(event) => void submitPhoto(event, false)}>{busy ? 'Saving…' : 'Save Draft'}</button><button type="button" className="btn-primary" disabled={busy} onClick={(event) => void submitPhoto(event, true)}>{busy ? 'Saving…' : 'Publish'}</button></div>
      </div></div>
    </form>
    <section className="archive-list-section"><div className="archive-section-title"><div><span className="archive-eyebrow">VISIBLE TO THE PUBLIC</span><h3>Published</h3></div><span className="archive-count">{photos.filter((p) => p.isPublished).length}</span></div>{renderCards(photos.filter((p) => p.isPublished))}</section>
    <section className="archive-list-section"><div className="archive-section-title"><div><span className="archive-eyebrow">MANAGEMENT ONLY</span><h3>Draft / Unpublished</h3></div><span className="archive-count">{photos.filter((p) => !p.isPublished).length}</span></div>{renderCards(photos.filter((p) => !p.isPublished))}</section>
    {role === 'ADMIN_ANO' && <form className="institutional-card archive-admin-form" onSubmit={saveInstitutionalInfo}><h3>Approved institutional information</h3>{(['address', 'email', 'phone', 'timings'] as const).map((field) => <label key={field}>{field[0].toUpperCase() + field.slice(1)}<input value={institutionalInfo[field]} onChange={(e) => setInstitutionalInfo((current) => ({ ...current, [field]: e.target.value }))} /></label>)}<button className="btn-primary" disabled={busy}>Save institutional information</button></form>}
    {role === 'ADMIN_ANO' && <form className="institutional-card archive-admin-form" onSubmit={saveRank}><h3>Update a rank holder</h3><label>Rank<select value={rank} onChange={(e) => setRank(e.target.value)}>{ranks.map((item) => <option key={item}>{item}</option>)}</select></label><label>Actual holder name<input required value={holderName} onChange={(e) => setHolderName(e.target.value)} /></label><label>Actual holder photograph<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setRankPhoto(e.target.files?.[0] || null)} /></label><button className="btn-primary" disabled={busy}>Save rank holder</button></form>}
  </section>;
};
