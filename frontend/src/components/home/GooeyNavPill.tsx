import React, { useEffect, useRef, useState, useCallback } from 'react';
import './GooeyNavPill.css';

export interface NavPillItem {
  name: string;
  href: string;
}

interface GooeyNavPillProps {
  items: NavPillItem[];
  activeNav: string;
  onSelect: (name: string, href: string) => void;
}

export const GooeyNavPill: React.FC<GooeyNavPillProps> = ({
  items,
  activeNav,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const linksContainerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    top: 4,
    width: 0,
    height: 0,
    ready: false,
  });

  // Calculate indicator position relative to container
  const updateIndicator = useCallback(() => {
    const activeIndex = items.findIndex((item) => item.name === activeNav);
    const activeEl = linkRefs.current[activeIndex >= 0 ? activeIndex : 0];
    const container = containerRef.current;

    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      setIndicatorStyle({
        left: activeRect.left - containerRect.left,
        top: activeRect.top - containerRect.top,
        width: activeRect.width,
        height: activeRect.height,
        ready: true,
      });
    }
  }, [activeNav, items]);

  useEffect(() => {
    updateIndicator();
    // Update on resize or font load
    window.addEventListener('resize', updateIndicator);
    const timeout = setTimeout(updateIndicator, 50);
    return () => {
      window.removeEventListener('resize', updateIndicator);
      clearTimeout(timeout);
    };
  }, [updateIndicator]);

  // Clean Gooey Particle Burst Animation without any black box artifact
  const triggerGooeyParticles = (
    fromIndex: number,
    _toIndex: number,
    targetEl: HTMLElement
  ) => {
    const pContainer = particlesRef.current;
    const container = containerRef.current;
    if (!pContainer || !container) return;

    // Clear any previous running particles
    pContainer.innerHTML = '';

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const fromEl = linkRefs.current[fromIndex] || targetEl;
    const fromRect = fromEl.getBoundingClientRect();

    const startX = fromRect.left - containerRect.left + fromRect.width / 2;
    const startY = fromRect.top - containerRect.top + fromRect.height / 2;

    const endX = targetRect.left - containerRect.left + targetRect.width / 2;
    const endY = targetRect.top - containerRect.top + targetRect.height / 2;

    const deltaX = endX - startX;
    const count = 7;

    for (let i = 0; i < count; i++) {
      const bubble = document.createElement('span');
      bubble.className = 'ncc-gooey-bubble';

      // Random sizes and offsets for organic liquid droplet feel
      const size = 10 + Math.random() * 8; // 10px to 18px
      const midOffsetRatio = 0.2 + (i / count) * 0.7;
      const midX = startX + deltaX * midOffsetRatio;
      const midY = startY + (Math.random() - 0.5) * 14;

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${startX - size / 2}px`;
      bubble.style.top = `${startY - size / 2}px`;

      // CSS custom properties for keyframes
      bubble.style.setProperty('--bx-start', '0px');
      bubble.style.setProperty('--by-start', '0px');
      bubble.style.setProperty('--bx-mid', `${midX - startX}px`);
      bubble.style.setProperty('--by-mid', `${midY - startY}px`);
      bubble.style.setProperty('--bx-end', `${deltaX}px`);
      bubble.style.setProperty('--by-end', `${endY - startY}px`);

      const duration = 380 + Math.random() * 140; // 380ms - 520ms
      const delay = Math.random() * 40; // subtle stagger
      bubble.style.animationDuration = `${duration}ms`;
      bubble.style.animationDelay = `${delay}ms`;

      pContainer.appendChild(bubble);

      setTimeout(() => {
        try {
          if (bubble.parentElement === pContainer) {
            pContainer.removeChild(bubble);
          }
        } catch {
          // ignore
        }
      }, duration + delay + 50);
    }
  };

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: NavPillItem,
    targetIndex: number
  ) => {
    e.preventDefault();

    const currentIndex = items.findIndex((it) => it.name === activeNav);
    const targetEl = linkRefs.current[targetIndex];

    if (targetEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      triggerGooeyParticles(currentIndex >= 0 ? currentIndex : 0, targetIndex, targetEl);
    }

    onSelect(item.name, item.href);
  };

  return (
    <div className="ncc-nav-pill-wrapper">
      {/* SVG Defs for Gooey effect without any black box / contrast artifacts */}
      <svg
        className="ncc-gooey-filter-defs"
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter id="ncc-pill-goo" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -8"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Main Single Rounded Navigation Pill Container */}
      <nav
        className="ncc-nav-pill-bar"
        ref={containerRef}
        aria-label="Main Navigation"
      >
        {/* Active Sliding Inner Pill */}
        <div
          className="ncc-nav-pill-active-bg"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            top: `${indicatorStyle.top}px`,
            width: `${indicatorStyle.width}px`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.ready ? 1 : 0,
          }}
          aria-hidden="true"
        />

        {/* Gooey Liquid Particle Container */}
        <div
          className="ncc-nav-pill-particles"
          ref={particlesRef}
          aria-hidden="true"
        />

        {/* The 6 Public Links inside the Single Container */}
        <div className="ncc-nav-pill-links" ref={linksContainerRef}>
          {items.map((item, idx) => {
            const isActive = activeNav === item.name;
            return (
              <a
                key={item.name}
                ref={(el) => {
                  linkRefs.current[idx] = el;
                }}
                href={item.href}
                className={`ncc-nav-pill-link ${isActive ? 'active' : ''}`}
                onClick={(e) => handleClick(e, item, idx)}
                aria-current={isActive ? 'location' : undefined}
              >
                <span className="ncc-nav-pill-text">{item.name}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default GooeyNavPill;
