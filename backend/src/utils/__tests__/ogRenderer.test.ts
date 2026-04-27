/**
 * Unit tests for the OG-meta injection helper. The fetch path is
 * mocked at the call site (route handler test), so this file only
 * needs to verify the string-rewriting logic.
 */

import { injectJsonLd, injectMetaTags } from '../ogRenderer';

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="description" content="Default description" />
    <meta property="og:title" content="Rowly default title" />
    <meta property="og:description" content="Rowly default desc" />
    <meta property="og:image" content="https://rowlyknit.com/icon-512x512.png" />
    <meta name="twitter:title" content="Rowly default title" />
    <meta name="twitter:description" content="Rowly default desc" />
    <meta name="twitter:image" content="https://rowlyknit.com/icon-512x512.png" />
    <title>Rowly</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

describe('injectMetaTags', () => {
  it('replaces existing og:title with the project value', () => {
    const out = injectMetaTags(SHELL, {
      title: 'Cozy Cabled Sweater',
      description: 'A worsted-weight pullover.',
      image: 'https://rowlyknit.com/uploads/sweater.jpg',
      url: 'https://rowlyknit.com/p/cozy-cabled-sweater-ab12',
    });
    expect(out).toContain('<meta property="og:title" content="Cozy Cabled Sweater"');
    expect(out).not.toContain('Rowly default title');
  });

  it('rewrites the <title> tag', () => {
    const out = injectMetaTags(SHELL, {
      title: 'Cozy Cabled Sweater',
      description: 'd',
      url: 'u',
      image: null,
    });
    expect(out).toContain('<title>Cozy Cabled Sweater</title>');
    expect(out).not.toContain('<title>Rowly</title>');
  });

  it('html-escapes attribute-breaking characters', () => {
    const out = injectMetaTags(SHELL, {
      title: 'Bad "quote" & <evil>',
      description: 'safe',
      url: 'u',
      image: null,
    });
    expect(out).toContain('content="Bad &quot;quote&quot; &amp; &lt;evil&gt;"');
    // Make sure the raw quote didn't slip through and bust the attribute
    expect(out).not.toContain('"Bad "quote"');
  });

  it('skips og:image and twitter:image when no image is given', () => {
    const out = injectMetaTags(SHELL, {
      title: 't',
      description: 'd',
      url: 'u',
      image: null,
    });
    // The default Rowly icon should still be there (we didn't overwrite)
    expect(out).toContain('icon-512x512.png');
    expect(out).not.toContain('content="undefined"');
    expect(out).not.toContain('content="null"');
  });

  it('overwrites og:image when an image is given', () => {
    const out = injectMetaTags(SHELL, {
      title: 't',
      description: 'd',
      url: 'u',
      image: 'https://rowlyknit.com/uploads/wip.jpg',
    });
    expect(out).toContain('<meta property="og:image" content="https://rowlyknit.com/uploads/wip.jpg"');
    expect(out).toContain('<meta name="twitter:image" content="https://rowlyknit.com/uploads/wip.jpg"');
    expect(out).not.toContain('content="https://rowlyknit.com/icon-512x512.png"');
  });

  it('inserts a missing tag before </head> when not present', () => {
    const minimal = '<html><head></head><body></body></html>';
    const out = injectMetaTags(minimal, {
      title: 't',
      description: 'd',
      url: 'https://rowlyknit.com/p/x-ab12',
      image: null,
    });
    expect(out).toContain('<meta property="og:url" content="https://rowlyknit.com/p/x-ab12"');
    expect(out.indexOf('<meta property="og:url"')).toBeLessThan(out.indexOf('</head>'));
  });

  it('sets og:type to article (not website) for share pages', () => {
    const out = injectMetaTags(SHELL, {
      title: 't',
      description: 'd',
      url: 'u',
      image: null,
    });
    expect(out).toContain('<meta property="og:type" content="article"');
  });
});

describe('injectJsonLd', () => {
  const MINIMAL = '<html><head><title>Rowly</title></head><body></body></html>';

  it('inserts one script per payload before </head>', () => {
    const out = injectJsonLd(MINIMAL, [
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'A' },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList' },
    ]);
    const matches = out.match(/<script type="application\/ld\+json">/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(out.indexOf('<script')).toBeLessThan(out.indexOf('</head>'));
  });

  it('serializes the payload as compact JSON', () => {
    const out = injectJsonLd(MINIMAL, [{ '@type': 'WebApplication', name: 'Gauge' }]);
    expect(out).toContain('{"@type":"WebApplication","name":"Gauge"}');
  });

  it('escapes </ inside string values to prevent script-tag breakout', () => {
    const out = injectJsonLd(MINIMAL, [
      { '@type': 'Note', text: 'see </script><script>alert(1)</script>' },
    ]);
    // The payload's literal "</" never reaches the rendered HTML
    expect(out).not.toMatch(/<\/script><script>/i);
    expect(out).toContain('<\\/script>');
  });

  it('returns the html unchanged when no payloads are given', () => {
    const out = injectJsonLd(MINIMAL, []);
    expect(out).toBe(MINIMAL);
  });
});
