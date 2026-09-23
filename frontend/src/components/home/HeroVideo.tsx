import React, { useState } from 'react';
import { ArrowRight, Play, X } from 'lucide-react';
import '../../styles/hero.css';

interface HeroVideoProps {
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export const HeroVideo: React.FC<HeroVideoProps> = () => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const handleExploreClick = () => {
    const target = document.getElementById('features') || document.getElementById('about');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <section className="ref-hero-section" aria-label="National Cadet Corps Hero">
        {/* Background Image with Deep Navy Institutional Overlay (Matching Reference) */}
        <div className="ref-hero-bg-wrapper">
          <img
            src="/assets/hero_cadets.jpg"
            alt="National Cadet Corps parade formation"
            className="ref-hero-bg-img"
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
              <button className="ref-hero-btn-primary" onClick={handleExploreClick}>
                <span>Explore NCC</span>
                <ArrowRight size={18} />
              </button>

              <button
                className="ref-hero-btn-secondary"
                onClick={() => setVideoModalOpen(true)}
              >
                <span>Watch Video</span>
                <Play size={15} fill="#FFFFFF" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Official NCC Video Lightbox Modal */}
      {videoModalOpen && (
        <div className="ref-video-modal-backdrop" onClick={() => setVideoModalOpen(false)}>
          <div className="ref-video-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="ref-video-modal-header">
              <span className="ref-video-modal-title">National Cadet Corps &bull; Official Documentary</span>
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
