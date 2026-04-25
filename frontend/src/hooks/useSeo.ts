import { useEffect } from 'react';

interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
}

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://rowlyknit.com';

function setMeta(attr: 'name' | 'property', key: string, content: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const existed = !!el;
  const previous = el?.content;

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;

  return () => {
    if (!el) return;
    if (existed && previous !== undefined) {
      el.content = previous;
    } else {
      el.remove();
    }
  };
}

function setCanonical(url: string): () => void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const existed = !!el;
  const previous = el?.href;

  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = url;

  return () => {
    if (!el) return;
    if (existed && previous !== undefined) {
      el.href = previous;
    } else {
      el.remove();
    }
  };
}

// Sets <title>, meta description, canonical link, and og/twitter equivalents.
// Restores the previous values on unmount so page transitions stay clean.
export function useSeo({ title, description, canonicalPath }: SeoOptions): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const previousTitle = document.title;
    document.title = title;

    const cleanups = [
      setMeta('name', 'description', description),
      setMeta('property', 'og:title', title),
      setMeta('property', 'og:description', description),
      setMeta('name', 'twitter:title', title),
      setMeta('name', 'twitter:description', description),
    ];

    if (canonicalPath !== undefined) {
      const url = `${APP_URL.replace(/\/$/, '')}${canonicalPath}`;
      cleanups.push(setCanonical(url));
      cleanups.push(setMeta('property', 'og:url', url));
      cleanups.push(setMeta('name', 'twitter:url', url));
    }

    return () => {
      document.title = previousTitle;
      for (const cleanup of cleanups) cleanup();
    };
  }, [title, description, canonicalPath]);
}
