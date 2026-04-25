import { useEffect } from 'react';

type JsonLd = Record<string, unknown>;

interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  // Optional schema.org JSON-LD blocks. Each object becomes a separate
  // <script type="application/ld+json"> tag in <head>. Pass one for a
  // single schema, an array when a page needs multiple (e.g. a
  // WebApplication + a BreadcrumbList).
  structuredData?: JsonLd | JsonLd[];
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

function appendJsonLd(payload: JsonLd): () => void {
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.text = JSON.stringify(payload);
  document.head.appendChild(el);
  return () => {
    el.remove();
  };
}

// Sets <title>, meta description, canonical link, og/twitter equivalents,
// and (optionally) schema.org JSON-LD blocks. Restores prior state on
// unmount so page transitions stay clean.
export function useSeo({ title, description, canonicalPath, structuredData }: SeoOptions): void {
  // Stable key so identical schemas don't trigger re-runs on every render.
  const structuredDataKey = structuredData ? JSON.stringify(structuredData) : '';
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

    if (structuredData) {
      const blocks = Array.isArray(structuredData) ? structuredData : [structuredData];
      for (const block of blocks) cleanups.push(appendJsonLd(block));
    }

    return () => {
      document.title = previousTitle;
      for (const cleanup of cleanups) cleanup();
    };
  }, [title, description, canonicalPath, structuredDataKey]);
}
