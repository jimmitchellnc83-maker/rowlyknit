import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeo } from './useSeo';

function jsonLdScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
}

describe('useSeo structuredData', () => {
  beforeEach(() => {
    document.title = 'baseline';
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
  });
  afterEach(() => {
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
  });

  it('appends one JSON-LD script when given a single object', () => {
    const { unmount } = renderHook(() =>
      useSeo({
        title: 't',
        description: 'd',
        structuredData: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'X' },
      }),
    );
    const scripts = jsonLdScripts();
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].text)).toMatchObject({ '@type': 'WebApplication', name: 'X' });
    unmount();
  });

  it('appends multiple JSON-LD scripts when given an array', () => {
    renderHook(() =>
      useSeo({
        title: 't',
        description: 'd',
        structuredData: [
          { '@type': 'WebApplication', name: 'A' },
          { '@type': 'BreadcrumbList', name: 'B' },
        ],
      }),
    );
    const types = jsonLdScripts().map((s) => JSON.parse(s.text)['@type']);
    expect(types).toEqual(['WebApplication', 'BreadcrumbList']);
  });

  it('removes the JSON-LD scripts on unmount', () => {
    const { unmount } = renderHook(() =>
      useSeo({
        title: 't',
        description: 'd',
        structuredData: { '@type': 'WebApplication' },
      }),
    );
    expect(jsonLdScripts()).toHaveLength(1);
    unmount();
    expect(jsonLdScripts()).toHaveLength(0);
  });

  it('does not append a script when structuredData is omitted', () => {
    renderHook(() => useSeo({ title: 't', description: 'd' }));
    expect(jsonLdScripts()).toHaveLength(0);
  });
});
