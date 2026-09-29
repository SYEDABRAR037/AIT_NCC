import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { getApiBaseUrl } from '../../utils/api';

interface GalleryItem { id: string; title: string; category: string; altText: string; imageUrl: string; }

export const GallerySection: React.FC = () => {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(selectedImage), () => setSelectedImage(null));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/api/public/gallery`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.success && Array.isArray(data.photos)) setImages(data.photos); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!images.length) return null;

  return (
    <section id="gallery" className="section-py" style={{ backgroundColor: 'var(--color-background)' }} aria-label="NCC Photo Gallery">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: 'var(--color-accent)', fontWeight: 700 }}><ImageIcon size={16} /> PHOTOGRAPHIC ARCHIVES</span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: 'var(--color-primary)', margin: '0.5rem 0' }}>Photographic Archives</h2>
        </div>
        <div className="grid-4" style={{ gap: '1.25rem' }}>
          {images.map((img) => (
            <button key={img.id} type="button" onClick={() => setSelectedImage(img)} aria-label={`View ${img.title}`} style={{ display: 'block', width: '100%', padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', backgroundColor: 'var(--color-background)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <span style={{ display: 'block', height: '210px', overflow: 'hidden' }}><img src={img.imageUrl} alt={img.altText} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>
              <span style={{ display: 'block', padding: '1rem 1.15rem' }}><strong>{img.title}</strong></span>
            </button>
          ))}
        </div>
      </div>
      {selectedImage && <div ref={dialogRef} className="ref-modal-backdrop" role="dialog" aria-modal="true" aria-label={selectedImage.title} tabIndex={-1} onClick={() => setSelectedImage(null)} style={{ padding: '1rem' }}>
        <div onClick={(event) => event.stopPropagation()} style={{ position: 'relative', maxWidth: '850px', width: '100%', background: 'var(--color-primary)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', color: 'white' }}><strong>{selectedImage.title}</strong><button onClick={() => setSelectedImage(null)} aria-label="Close image"><X size={20} /></button></div>
          <img src={selectedImage.imageUrl} alt={selectedImage.altText} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
        </div>
      </div>}
    </section>
  );
};
