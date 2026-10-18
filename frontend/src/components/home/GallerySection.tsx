import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, Camera, AlertCircle } from 'lucide-react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { getApiBaseUrl } from '../../utils/api';

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  altText: string;
  imageUrl: string;
}

const DEFAULT_CATEGORIES = ['ALL', 'Parade & Drill', 'Camps', 'Ceremony', 'Community Service'];

export const GallerySection: React.FC = () => {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFetchError(null);

    fetch(`${getApiBaseUrl()}/api/public/gallery`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data?.success && Array.isArray(data.photos)) {
          setImages(data.photos);
        } else {
          setImages([]);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setFetchError('Unable to load photo archives at this time.');
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // Compute available categories from loaded photos, or fallback to default categories
  const categories = useMemo(() => {
    if (!images.length) return DEFAULT_CATEGORIES;
    const dynamicCats = Array.from(new Set(images.map((img) => img.category).filter(Boolean)));
    return ['ALL', ...dynamicCats];
  }, [images]);

  // Filtered images based on selected category
  const filteredImages = useMemo(() => {
    if (activeCategory === 'ALL') return images;
    return images.filter(
      (img) => img.category?.toLowerCase() === activeCategory.toLowerCase()
    );
  }, [images, activeCategory]);

  const selectedImage = selectedIndex !== null ? filteredImages[selectedIndex] ?? null : null;
  const dialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(selectedImage), () => setSelectedIndex(null));

  const handlePrev = useCallback(() => {
    if (selectedIndex === null || filteredImages.length === 0) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : filteredImages.length - 1));
  }, [selectedIndex, filteredImages.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex === null || filteredImages.length === 0) return;
    setSelectedIndex((prev) => (prev! < filteredImages.length - 1 ? prev! + 1 : 0));
  }, [selectedIndex, filteredImages.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, handlePrev, handleNext]);

  const handleImageError = (id: string) => {
    setFailedImageIds((prev) => new Set(prev).add(id));
  };

  return (
    <section
      id="gallery"
      className="section-py"
      style={{ backgroundColor: 'var(--color-background)', scrollMarginTop: '80px' }}
      aria-label="NCC Photo Gallery"
    >
      <div className="container">
        {/* Section Header */}
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="sub-title" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            <ImageIcon size={16} /> REGIMENTAL MEDIA ARCHIVES
          </span>
          <h2 className="cinzel-title" style={{ fontSize: '2.25rem', color: 'var(--color-primary)', margin: '0.5rem 0' }}>
            Photographic Archives
          </h2>
          <p className="description" style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--color-text-secondary)' }}>
            Glimpses of cadet life, annual training camps, rifle marksmanship, and ceremonial parades at Army Institute of Technology, Pune.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div
          role="tablist"
          aria-label="Gallery category filters"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '2.5rem',
          }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveCategory(cat);
                  setSelectedIndex(null);
                }}
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-background)',
                  color: isActive ? 'var(--color-background)' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '50px',
                  padding: '6px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(7, 26, 51, 0.15)' : 'none',
                }}
              >
                {cat === 'ALL' ? `All Photos (${images.length})` : cat}
              </button>
            );
          })}
        </div>

        {/* Content States */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--color-text-secondary)' }}>
            <div style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
              <ImageIcon size={36} style={{ color: 'var(--color-accent)', animation: 'pulse 1.5s infinite' }} />
            </div>
            <p style={{ fontWeight: 600 }}>Loading photographic archives...</p>
          </div>
        ) : fetchError ? (
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              padding: '3rem 2rem',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            <AlertCircle size={36} style={{ color: 'var(--color-error)', margin: '0 auto 0.75rem' }} />
            <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.35rem' }}>Unable to Load Gallery</h4>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{fetchError}</p>
          </div>
        ) : filteredImages.length === 0 ? (
          /* Professional Institutional Empty State */
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              padding: '3.5rem 2rem',
              maxWidth: '650px',
              margin: '0 auto',
              boxShadow: '0 4px 15px rgba(7, 26, 51, 0.04)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--color-info-soft)',
                border: '1px solid var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                color: 'var(--color-primary)',
              }}
            >
              <Camera size={30} />
            </div>
            <h4 style={{ color: 'var(--color-primary)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Photographic Archives In Curation
            </h4>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem', lineHeight: '1.6', maxWidth: '520px', margin: '0 auto' }}>
              Official high-resolution training, ceremonial parade, and camp photographs are curated and published here following regimental media cell verification.
            </p>
          </div>
        ) : (
          /* Responsive Image Grid */
          <div
            className="grid-4"
            style={{
              gap: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {filteredImages.map((img, idx) => {
              const isFailed = failedImageIds.has(img.id);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  aria-label={`View photo: ${img.title}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    padding: 0,
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-background)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 4px 12px rgba(7, 26, 51, 0.04)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(7, 26, 51, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(7, 26, 51, 0.04)';
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '210px',
                      overflow: 'hidden',
                      position: 'relative',
                      background: 'var(--color-surface)',
                    }}
                  >
                    {!isFailed ? (
                      <img
                        src={img.imageUrl}
                        alt={img.altText || img.title}
                        loading="lazy"
                        onError={() => handleImageError(img.id)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-disabled)',
                          padding: '1rem',
                        }}
                      >
                        <Camera size={32} />
                        <span style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>Image Unavailable</span>
                      </div>
                    )}
                    {img.category && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          background: 'rgba(7, 26, 51, 0.85)',
                          color: 'var(--color-gold)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {img.category}
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', padding: '1rem 1.15rem' }}>
                    <strong style={{ display: 'block', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                      {img.title}
                    </strong>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Accessible Full-Screen Lightbox Modal */}
      {selectedImage && selectedIndex !== null && (
        <div
          ref={dialogRef}
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title}
          tabIndex={-1}
          onClick={() => setSelectedIndex(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 26, 51, 0.92)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '920px',
              width: '100%',
              background: 'var(--color-primary)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--color-accent)',
            }}
          >
            {/* Lightbox Header Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
              }}
            >
              <div>
                <strong style={{ fontSize: '1.05rem', display: 'block' }}>{selectedImage.title}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)' }}>
                  {selectedImage.category} · {selectedIndex + 1} of {filteredImages.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                aria-label="Close image preview"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Image Presentation */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#030c18',
                minHeight: '320px',
              }}
            >
              {!failedImageIds.has(selectedImage.id) ? (
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.altText || selectedImage.title}
                  style={{
                    width: '100%',
                    maxHeight: '72vh',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                  onError={() => handleImageError(selectedImage.id)}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-disabled)' }}>
                  <Camera size={44} style={{ margin: '0 auto 0.5rem' }} />
                  <p>Image file currently unavailable.</p>
                </div>
              )}

              {/* Prev / Next Carousel Controls */}
              {filteredImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous image"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      background: 'rgba(7, 26, 51, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '42px',
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next image"
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'rgba(7, 26, 51, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '42px',
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
