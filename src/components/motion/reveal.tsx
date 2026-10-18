'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';

import { cn } from '@/lib/cn';

/**
 * Reveal — a restrained scroll-into-view animation.
 *
 * Content rises a few pixels and fades in the first time it enters the
 * viewport, then stays put. Dependency-free (plain IntersectionObserver + a CSS
 * transition), in keeping with the project's "functional motion only" rule.
 *
 * It degrades honestly: readers who prefer reduced motion, browsers without
 * IntersectionObserver, and no-JS requests all see the content immediately
 * (the last via a <noscript> rule in the root layout).
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  style,
  children,
}: {
  /** Element to render. Use `li`/`ul`/`section` to stay valid inside grids and lists. */
  as?: ElementType;
  /** Stagger offset in milliseconds, e.g. `index * 70` for a cascading grid. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as Ref<HTMLElement>}
      data-reveal=""
      data-shown={shown ? '' : undefined}
      className={cn('motion-reveal', className)}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
