import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import '../../styles/hero.css';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

interface HeroVideoProps {
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export const HeroVideo: React.FC<HeroVideoProps> = () => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(videoModalOpen, () => setVideoModalOpen(false));

  return (
    <>
      <section className="ref-hero-section" aria-label="National Cadet Corps Hero">
        {/* Background Image with Deep Navy Institutional Overlay (Matching Reference) */}
        <div className="ref-hero-bg-wrapper">
          <img
            src="/assets/hero_cadets.jpg"
            alt="National Cadet Corps parade formation"
            className="ref-hero-bg-img"
            fetchPriority="high"
            decoding="async"
          />
          <div className="ref-hero-gradient-overlay" />
        </div>

        {/* Hero Content (Exact Composition from Reference) */}
        <div className="ref-hero-container">
          <div className="ref-hero-content">
            <div className="ref-hero-eyebrow">
              NATIONAL CADET CORPS
            </div>

            <h1 className="ref-hero-title">
              ONCE A CADET, <br />
              ALWAYS A CADET!!
            </h1>

            <p className="ref-hero-subtitle">
              &ldquo;Discipline, Leadership, Adventure <br />
              &mdash; The NCC Way of Life.&rdquo;
            </p>

            <div className="ref-hero-cta-group">
              <button
                className="ref-hero-btn-secondary"
                onClick={() => setVideoModalOpen(true)}
              >
                <span>Watch Video</span>
                <Play size={15} fill="var(--color-background)" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Official NCC Video Lightbox Modal */}
      {videoModalOpen && (
        <div ref={dialogRef} className="ref-video-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hero-video-title" tabIndex={-1} onClick={() => setVideoModalOpen(false)}>
          <div className="ref-video-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="ref-video-modal-header">
              <span id="hero-video-title" className="ref-video-modal-title">National Cadet Corps &bull; Official Documentary</span>
              <button
                className="ref-video-modal-close"
                onClick={() => setVideoModalOpen(false)}
                aria-label="Close video modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="ref-video-player-wrapper">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube-nocookie.com/embed/Z0oYJd5h-p8?autoplay=1"
                title="National Cadet Corps Official Documentary"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
