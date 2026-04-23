import { useCallback, useEffect, useRef, useState } from 'react';

export interface SectionDefinition {
  id: string;
  label: string;
  /** Hide the chip entirely (e.g. pattern section when no patterns linked). */
  visible?: boolean;
}

interface Props {
  sections: SectionDefinition[];
  /** Pixel offset when scrolling so the section header isn't under any sticky chrome. */
  scrollOffset?: number;
}

/**
 * Sticky horizontal pill bar listing every major section on ProjectDetail.
 * Solves the "2000px scroll to find counters" problem with a one-tap jump.
 *
 * Uses IntersectionObserver to bold-highlight whichever section is most in
 * view as the user scrolls.
 */
export default function SectionNav({ sections, scrollOffset = 16 }: Props) {
  const visible = sections.filter((s) => s.visible !== false);
  const [activeId, setActiveId] = useState<string>(visible[0]?.id || '');
  const navRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Disconnect any previous observer when section list changes.
    observerRef.current?.disconnect();

    const root = null; // viewport
    // rootMargin picks the "active" section based on the top third of the viewport
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry most in view (largest intersectionRatio).
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (inView.length > 0) {
          const id = (inView[0].target as HTMLElement).id.replace(/^section-/, '');
          setActiveId(id);
        }
      },
      {
        root,
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    observerRef.current = observer;

    for (const s of visible) {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [visible]);

  const jumpTo = useCallback(
    (id: string) => {
      const el = document.getElementById(`section-${id}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - scrollOffset;
      window.scrollTo({ top, behavior: 'smooth' });
      setActiveId(id);
    },
    [scrollOffset],
  );

  // Keep the active chip scrolled into horizontal view on the chip bar.
  useEffect(() => {
    if (!navRef.current || !activeId) return;
    const btn = navRef.current.querySelector<HTMLButtonElement>(
      `button[data-section-id="${activeId}"]`,
    );
    if (!btn) return;
    const navRect = navRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    if (btnRect.left < navRect.left || btnRect.right > navRect.right) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeId]);

  if (visible.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Project sections"
      className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 mb-4 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 overflow-x-auto"
    >
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {visible.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              data-section-id={s.id}
              onClick={() => jumpTo(s.id)}
              aria-current={isActive ? 'true' : undefined}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                isActive
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
