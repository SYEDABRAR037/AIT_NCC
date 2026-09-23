import React, { useState } from 'react';
import { Image as ImageIcon, X, Maximize2 } from 'lucide-react';

interface GalleryItem {
  title: string;
  category: string;
  src: string;
  alt: string;
}

export const GallerySection: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [activeCategory, setActiveCategory] = useState('ALL');

  const images: GalleryItem[] = [
    {
      title: 'Ceremonial Parade & Guard of Honour',
      category: 'Parade',
      src: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=800&auto=format&fit=crop',
      alt: 'Cadets marching in synchronized ceremonial drill formation',
    },
    {
      title: 'Obstacle Course & Physical Training',
      category: 'Training',
      src: 'https://images.unsplash.com/photo-1579975096649-e773152b04cb?q=80&w=800&auto=format&fit=crop',
      alt: 'Cadets engaging in outdoor obstacle and field fitness training',
    },
    {
      title: 'Range Firing & .22 Deluxe Marksmanship',
      category: 'Firing',
      src: 'https://images.unsplash.com/photo-1569420074719-7561858c27cf?q=80&w=800&auto=format&fit=crop',
      alt: 'Cadets receiving briefing on weapon safety and grouping at range',
    },
    {
      title: 'Annual Training Camp (CATC) Bivouac',
      category: 'Camps',
      src: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=800&auto=format&fit=crop',
      alt: 'Cadets assembled at institutional field camp grounds',
    },
  ];

  const categories = ['ALL', 'Parade', 'Training', 'Firing', 'Camps'];

  const filteredImages = activeCategory === 'ALL'
    ? images
    : images.filter((img) => img.category === activeCategory);

  return (
    <section id="gallery" className="section-py" style={{ backgroundColor: '#FFFFFF' }} aria-label="NCC Photo Gallery">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sub-title" style={{ color: '#2563EB', fontWeight: 700 }}>
            <ImageIcon size={16} />
            PHOTOGRAPHIC ARCHIVES
          </span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: '#0A192F', margin: '0.5rem 0' }}>
            Cadet Training & Life in Action
          </h2>
          <p className="description" style={{ maxWidth: '680px', margin: '0 auto', color: '#64748B' }}>
            Authorized photographic record of parades, firing camps, national ceremonies, and obstacle drills.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                background: activeCategory === cat ? '#0A192F' : '#F1F5F9',
                color: activeCategory === cat ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '50px',
                padding: '6px 18px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div className="grid-4" style={{ gap: '1.25rem' }}>
          {filteredImages.map((img) => (
            <div
              key={img.title}
              onClick={() => setSelectedImage(img)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedImage(img);
              }}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 15px rgba(6, 21, 43, 0.05)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(6, 21, 43, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(6, 21, 43, 0.05)';
              }}
            >
              <div style={{ height: '210px', overflow: 'hidden', position: 'relative' }}>
                <img
                  src={img.src}
                  alt={img.alt}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    left: '0.75rem',
                    backgroundColor: 'rgba(6, 21, 43, 0.85)',
                    color: '#FFFFFF',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {img.category}
                </span>
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0.75rem',
                    right: '0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0A192F',
                  }}
                >
                  <Maximize2 size={14} />
                </div>
              </div>
              <div style={{ padding: '1rem 1.15rem' }}>
                <h4 style={{ fontSize: '0.92rem', color: '#0A192F', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                  {img.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Viewer */}
      {selectedImage && (
        <div
          className="ref-modal-backdrop"
          onClick={() => setSelectedImage(null)}
          style={{ padding: '1rem' }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '850px',
              width: '100%',
              background: '#06152B',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#93C5FD', fontWeight: 700, textTransform: 'uppercase' }}>
                  {selectedImage.category}
                </span>
                <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem', margin: '2px 0 0' }}>{selectedImage.title}</h3>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: '4px' }}
                aria-label="Close image"
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ maxHeight: '70vh', overflow: 'hidden' }}>
              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
