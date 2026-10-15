import React, { useRef, useState } from 'react';
import { Image, Play } from 'lucide-react';
import '../../styles/hero.css';

const HERO_VIDEO_SRC = '/media/ncc-hero-video.mp4';

interface HeroVideoProps {
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export const HeroVideo: React.FC<HeroVideoProps> = () => {
  const [videoActive, setVideoActive] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const restorePhoto = (notice?: string) => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    setVideoActive(false);
    if (notice) {
      setFallbackNotice(notice);
      setTimeout(() => setFallbackNotice(null), 5000);
    }
  };

  const playHeroVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.src = HERO_VIDEO_SRC;
    video.load();
    try {
      await video.play();
      setVideoActive(true);
    } catch (error) {
      console.warn('Hero video asset unavailable, retaining official photograph:', error);
      restorePhoto('Official parade documentary video (/media/ncc-hero-video.mp4) is being updated by NCC command. Displaying high-resolution unit photograph.');
    }
  };

  return (
    <section className="ref-hero-section" aria-label="National Cadet Corps Hero">
      <div className={`ref-hero-bg-wrapper${videoActive ? ' ref-hero-bg-wrapper--video' : ''}`}>
        <img
          src="/assets/hero_cadets.jpg"
          alt="National Cadet Corps parade formation"
          className="ref-hero-bg-img"
          fetchPriority="high"
          decoding="async"
        />
        <video
          ref={videoRef}
          className="ref-hero-bg-video"
          aria-hidden={!videoActive}
          tabIndex={-1}
          muted
          playsInline
          preload="none"
          onEnded={() => restorePhoto()}
          onError={() => restorePhoto('Official parade documentary video (/media/ncc-hero-video.mp4) is being updated by NCC command. Displaying high-resolution unit photograph.')}
        />
        <div className="ref-hero-gradient-overlay" />
      </div>

      <div className="ref-hero-container">
        <div className="ref-hero-content">
          <div className="ref-hero-eyebrow">NATIONAL CADET CORPS</div>
          <h1 className="ref-hero-title">
            ONCE A CADET, <br />
            ALWAYS A CADET!!
          </h1>
          <p className="ref-hero-subtitle">
            &ldquo;Discipline, Leadership, Adventure <br />
            &mdash; The NCC Way of Life.&rdquo;
          </p>
          <div className="ref-hero-cta-group">
            {videoActive ? (
              <button className="ref-hero-btn-secondary" onClick={() => restorePhoto()} aria-label="Stop video and return to the hero photo">
                <span>Back to Photo</span>
                <Image size={16} aria-hidden="true" />
              </button>
            ) : (
              <button className="ref-hero-btn-secondary" onClick={() => void playHeroVideo()} aria-label="Play the NCC hero video">
                <span>Watch Video</span>
                <Play size={15} fill="var(--color-background)" aria-hidden="true" />
              </button>
            )}
            <span className="ref-hero-status" aria-live="polite">
              {fallbackNotice || (videoActive ? 'Hero video is playing.' : 'Hero photo is showing.')}
            </span>
          </div>
          {fallbackNotice && (
            <div
              style={{
                marginTop: '0.85rem',
                fontSize: '0.82rem',
                color: 'rgba(255, 255, 255, 0.9)',
                background: 'rgba(7, 26, 51, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '4px',
                padding: '0.45rem 0.85rem',
                maxWidth: '490px',
                lineHeight: 1.4,
              }}
              role="status"
            >
              {fallbackNotice}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
