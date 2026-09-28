import React, { useLayoutEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import './ScrollStack.css';

export interface ScrollStackItemProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollStackItem: React.FC<ScrollStackItemProps> = ({ children, className = '' }) => (
  <div className={`scroll-stack-card ${className}`.trim()}>{children}</div>
);

interface ScrollStackProps {
  children: React.ReactNode;
  className?: string;
  itemDistance?: number;
  itemScale?: number;
  itemStackDistance?: number;
  stackPosition?: string;
  scaleEndPosition?: string;
  baseScale?: number;
  scaleDuration?: number;
  rotationAmount?: number;
  blurAmount?: number;
  useWindowScroll?: boolean;
  onStackComplete?: () => void;
}

export const ScrollStack: React.FC<ScrollStackProps> = ({
  children,
  className = '',
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = '20%',
  scaleEndPosition = '10%',
  baseScale = 0.85,
  scaleDuration: _scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = true,
  onStackComplete,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onStackComplete);
  onCompleteRef.current = onStackComplete;

  useLayoutEffect(() => {
    void _scaleDuration;
    const root = rootRef.current;
    if (!root) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>('.scroll-stack-card'));
    const endElement = root.querySelector<HTMLElement>('.scroll-stack-end');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const usePageScroll = useWindowScroll || reducedMotion;
    let frame = 0;
    let rafId = 0;
    let lenis: Lenis | undefined;
    let completed = false;

    const parsePosition = (position: string, height: number) =>
      position.includes('%') ? (parseFloat(position) / 100) * height : parseFloat(position);
    const elementTop = (element: HTMLElement) =>
      usePageScroll ? element.getBoundingClientRect().top + window.scrollY : element.offsetTop;

    cards.forEach((card, index) => {
      if (index < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
      card.style.transformOrigin = 'top center';
      card.style.backfaceVisibility = 'hidden';
      card.style.willChange = reducedMotion ? 'auto' : 'transform';
    });

    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const scrollTop = usePageScroll ? window.scrollY : root.scrollTop;
        const viewportHeight = usePageScroll ? window.innerHeight : root.clientHeight;
        const stackTop = parsePosition(stackPosition, viewportHeight);
        const scaleEnd = parsePosition(scaleEndPosition, viewportHeight);
        const endTop = endElement ? elementTop(endElement) : 0;
        let lastIsPinned = false;

        cards.forEach((card, index) => {
          const cardTop = elementTop(card);
          const start = cardTop - stackTop - itemStackDistance * index;
          const end = cardTop - scaleEnd;
          const progress = reducedMotion || scrollTop <= start
            ? 0
            : Math.min(1, (scrollTop - start) / Math.max(1, end - start));
          const scale = reducedMotion ? 1 : 1 - progress * (1 - (baseScale + index * itemScale));
          const pinEnd = endTop - viewportHeight / 2;
          const pinned = !reducedMotion && scrollTop >= start && scrollTop <= pinEnd;
          const translateY = reducedMotion ? 0 : pinned
            ? scrollTop - cardTop + stackTop + itemStackDistance * index
            : scrollTop > pinEnd
              ? pinEnd - cardTop + stackTop + itemStackDistance * index
              : 0;
          const rotation = reducedMotion ? 0 : index * rotationAmount * progress;
          const blur = reducedMotion ? 0 : Math.max(0, (cards.length - index - 1) * blurAmount * progress);
          const transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotate(${rotation.toFixed(2)}deg)`;

          card.style.transform = transform;
          card.style.filter = blur ? `blur(${blur.toFixed(1)}px)` : '';
          if (index === cards.length - 1) lastIsPinned = pinned;
        });

        if (lastIsPinned !== completed) {
          completed = lastIsPinned;
          if (completed) onCompleteRef.current?.();
        }
      });
    };

    if (!reducedMotion) {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: true,
        lerp: 0.1,
      });
      lenis.on('scroll', update);
      const tick = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    const scrollTarget: HTMLElement | Window = usePageScroll ? window : root;
    scrollTarget.addEventListener('scroll', update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(root);
    cards.forEach((card) => resizeObserver.observe(card));
    update();

    return () => {
      scrollTarget.removeEventListener('scroll', update);
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (rafId) cancelAnimationFrame(rafId);
      lenis?.destroy();
      cards.forEach((card) => {
        card.style.transform = '';
        card.style.filter = '';
        card.style.marginBottom = '';
        card.style.willChange = '';
      });
    };
  }, [itemDistance, itemScale, itemStackDistance, stackPosition, scaleEndPosition, baseScale, rotationAmount, blurAmount, useWindowScroll]);

  return (
    <div ref={rootRef} className={`scroll-stack-scroller ${className}`.trim()}>
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" aria-hidden="true" />
      </div>
    </div>
  );
};
