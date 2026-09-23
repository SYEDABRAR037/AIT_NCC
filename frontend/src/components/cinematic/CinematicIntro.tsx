import React, { useState, useEffect } from 'react';
import '../../styles/cinematic.css';

interface CinematicIntroProps {
  onIntroComplete?: () => void;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onIntroComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'loading' | 'paused' | 'revealing' | 'done'>('loading');

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setProgress(100);
      setStage('revealing');
      const timer = setTimeout(() => {
        setStage('done');
        if (onIntroComplete) onIntroComplete();
      }, 400);
      return () => clearTimeout(timer);
    }

    // Step 1: Animate progress from 0% to 100%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Smooth non-linear progress
        const increment = prev < 60 ? 5 : prev < 90 ? 3 : 2;
        return Math.min(100, prev + increment);
      });
    }, 45);

    return () => clearInterval(interval);
  }, [onIntroComplete]);

  useEffect(() => {
    if (progress === 100 && stage === 'loading') {
      // Step 2: 100% reached -> Short pause
      const pauseTimer = setTimeout(() => {
        setStage('paused');
        // Step 3: Trigger theatre curtain split
        const revealTimer = setTimeout(() => {
          setStage('revealing');
          // Step 4: After curtains clear, complete intro
          const completionTimer = setTimeout(() => {
            setStage('done');
            if (onIntroComplete) onIntroComplete();
          }, 1800);
          return () => clearTimeout(completionTimer);
        }, 300);
        return () => clearTimeout(revealTimer);
      }, 500);

      return () => clearTimeout(pauseTimer);
    }
  }, [progress, stage, onIntroComplete]);

  if (stage === 'done') {
    return null;
  }

  const isCurtainOpen = stage === 'revealing';
  const isIntroFading = stage === 'paused' || stage === 'revealing';

  return (
    <div className={`cinematic-container ${isCurtainOpen ? 'completed' : ''}`} aria-hidden={isCurtainOpen}>
      {/* Intro Stage with Logos and Loading Progress */}
      <div className={`intro-stage ${isIntroFading ? 'fade-out' : ''}`}>
        <div className="intro-logos-wrapper">
          <img
            src="/assets/logos/ncc_logo.png"
            alt="National Cadet Corps Official Crest"
            className="intro-logo-item"
          />
          <img
            src="/assets/logos/ait_logo.gif"
            alt="Army Institute of Technology Pune Crest"
            className="intro-logo-item"
          />
        </div>

        <div className="intro-title-group">
          <h1>NCC DIGITAL COMMAND</h1>
          <h2>Army Institute of Technology, Pune</h2>
        </div>

        <div className="intro-progress-container">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-indicator">
            <span>INITIALIZING COMMAND UNIT</span>
            <span className="progress-percentage">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Deep Navy Virtual Theatre Curtains */}
      <div className={`curtains-wrapper ${isCurtainOpen ? 'curtains-open' : ''}`}>
        <div className="curtain-panel curtain-left" />
        <div className="curtain-panel curtain-right" />
      </div>
    </div>
  );
};
