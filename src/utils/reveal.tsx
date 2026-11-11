import React, { useState, useEffect, useRef, Children, ReactNode, ElementType } from 'react';

export interface UseRevealOptions {
  threshold?: number;
  fallbackMs?: number;
}

/**
 * Hook to trigger entrance animation when element is ~20% visible.
 * Includes a 2-second fallback so content never stays invisible,
 * and immediate display for prefers-reduced-motion.
 */
export function useReveal({
  threshold = 0.2,
  fallbackMs = 2000,
}: UseRevealOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // 1. Check prefers-reduced-motion: show immediately without animation
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (media.matches) {
        setPrefersReducedMotion(true);
        setIsRevealed(true);
        return;
      }
    }

    // 2. 2-second safety fallback: content must never stay invisible if observer fails
    const fallbackTimer = setTimeout(() => {
      setIsRevealed(true);
    }, fallbackMs);

    // 3. Fallback if IntersectionObserver is unavailable
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsRevealed(true);
      clearTimeout(fallbackTimer);
      return;
    }

    // 4. Trigger when ~20% visible, run once
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsRevealed(true);
            clearTimeout(fallbackTimer);
            observer.unobserve(entry.target);
            observer.disconnect();
            break;
          }
        }
      },
      {
        threshold,
      }
    );

    observer.observe(el);

    return () => {
      clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [threshold, fallbackMs]);

  return { ref, isRevealed, prefersReducedMotion };
}

export interface RevealProps {
  children: ReactNode;
  variant?: 'stamp' | 'rise';
  className?: string;
  delay?: number;
  stagger?: number;
  as?: ElementType;
}

/**
 * Shared entrance Reveal component.
 * Variants:
 * - "stamp": heading scales 1.15 to 1 with opacity 0 to 1 (180ms, thud feel),
 *            then a thin red underline draws left to right (250ms).
 * - "rise":  translateY 24px to 0 with opacity 0 to 1 (350ms). Children stagger by 80ms.
 * Uses transform and opacity only.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  variant = 'rise',
  className = '',
  delay = 0,
  stagger = 80,
  as: Component = 'div',
}) => {
  const { ref, isRevealed, prefersReducedMotion } = useReveal();

  if (variant === 'stamp') {
    return (
      <Component ref={ref} className={`relative inline-block ${className}`}>
        <div
          style={{
            opacity: isRevealed ? 1 : 0,
            transform: isRevealed ? 'none' : 'scale(1.15)',
            transformOrigin: 'center center',
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 180ms cubic-bezier(0.1, 0.9, 0.2, 1), opacity 180ms ease-out',
            willChange: 'transform, opacity',
          }}
        >
          {children}
        </div>
        {/* Thin red underline draws left to right after heading thuds */}
        <div
          aria-hidden="true"
          style={{
            height: '2.5px',
            backgroundColor: '#C23B22',
            transformOrigin: 'left center',
            transform: isRevealed ? 'scaleX(1)' : 'scaleX(0)',
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1) 180ms',
            width: '100%',
            marginTop: '5px',
            willChange: 'transform',
          }}
        />
      </Component>
    );
  }

  // Variant: "rise"
  const childrenArray = Children.toArray(children);

  return (
    <Component ref={ref} className={className}>
      {childrenArray.map((child, index) => {
        const itemDelay = delay + index * stagger;
        return (
          <div
            key={index}
            style={{
              opacity: isRevealed ? 1 : 0,
              transform: isRevealed ? 'none' : 'translateY(24px)',
              transition: prefersReducedMotion
                ? 'none'
                : `transform 350ms cubic-bezier(0.16, 1, 0.3, 1) ${itemDelay}ms, opacity 350ms ease-out ${itemDelay}ms`,
              willChange: 'transform, opacity',
            }}
          >
            {child}
          </div>
        );
      })}
    </Component>
  );
};

export default Reveal;
