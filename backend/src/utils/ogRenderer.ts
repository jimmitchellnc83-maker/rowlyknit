/**
 * Server-side meta-tag injection for the public FO share pages.
 *
 * Facebook's link scraper does not execute JavaScript, so the og:* tags
 * the SPA sets via `useSeo` after hydration never reach it. Twitter and
 * Pinterest do run JS and see the SPA-set tags, but FB cards are a
 * common share path and currently render with the static landing meta.
 *
 * This module reads the SPA shell `index.html` from the frontend
 * container, splices project-specific og:* + twitter:* + title into
 * <head>, and serves the result.
 *
 * The fetched HTML is cached in-memory for INDEX_HTML_TTL_MS to spare
 * the frontend container on every share-page hit; a deploy invalidates
 * the cache through the natural restart of the backend container.
 */

const FRONTEND_URL = process.env.FRONTEND_INTERNAL_URL || 'http://frontend:80';
const INDEX_HTML_TTL_MS = 5 * 60 * 1000;

interface CachedHtml {
  html: string;
  fetchedAt: number;
}

let cache: CachedHtml | null = null;

export async function fetchIndexHtml(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < INDEX_HTML_TTL_MS) {
    return cache.html;
  }

  const res = await fetch(`${FRONTEND_URL}/index.html`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`frontend index.html fetch failed: ${res.status}`);
  }
  const html = await res.text();
  cache = { html, fetchedAt: now };
  return html;
}

export function clearIndexHtmlCache(): void {
  cache = null;
}

export interface OgMeta {
  title: string;
  description: string;
  image?: string | null;
  url: string;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Replace the existing og:* / twitter:* / <title> in the SPA shell with
 * the per-project values, so a non-JS scraper sees them on first parse.
 *
 * Strategy:
 *   - Replace `<title>...</title>` with the new title
 *   - Find each `<meta property="og:KEY"` or `<meta name="twitter:KEY"`
 *     and rewrite its content. Fall back to inserting before </head>
 *     if the tag isn't already present.
 *   - Skip og:image / twitter:image entirely when no image is provided
 *     (so we don't emit `content="undefined"`).
 */
export function injectMetaTags(html: string, meta: OgMeta): string {
  let out = html;

  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttr(meta.title)}</title>`);

  out = setOrInsertMeta(out, 'property', 'og:title', meta.title);
  out = setOrInsertMeta(out, 'property', 'og:description', meta.description);
  out = setOrInsertMeta(out, 'property', 'og:url', meta.url);
  out = setOrInsertMeta(out, 'property', 'og:type', 'article');
  out = setOrInsertMeta(out, 'name', 'twitter:title', meta.title);
  out = setOrInsertMeta(out, 'name', 'twitter:description', meta.description);
  out = setOrInsertMeta(out, 'name', 'twitter:url', meta.url);
  out = setOrInsertMeta(out, 'name', 'description', meta.description);

  if (meta.image) {
    out = setOrInsertMeta(out, 'property', 'og:image', meta.image);
    out = setOrInsertMeta(out, 'name', 'twitter:image', meta.image);
  }

  return out;
}

function setOrInsertMeta(html: string, attr: 'property' | 'name', key: string, value: string): string {
  const safe = escapeHtmlAttr(value);
  // Match the existing tag whether content="" comes before or after the
  // attr key, with single or double quotes.
  const pattern = new RegExp(
    `<meta[^>]*\\b${attr}\\s*=\\s*["']${key}["'][^>]*>`,
    'i',
  );
  const replacement = `<meta ${attr}="${key}" content="${safe}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  // Tag not present — insert just before </head>.
  return html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}

/**
 * Inject one or more JSON-LD structured-data blocks into the SPA shell
 * <head>. Each entry becomes its own `<script type="application/ld+json">`
 * tag so search engines can parse them independently. Escapes `</` to
 * prevent any embedded value from prematurely closing the script.
 *
 * Used by the calculator SSR endpoint so non-JS crawlers (Bing, Pinterest,
 * Facebook scraper) see the structured data on first parse instead of
 * after React hydration.
 */
export function injectJsonLd(html: string, payloads: Array<Record<string, unknown>>): string {
  if (payloads.length === 0) return html;
  const blocks = payloads
    .map((p) => {
      const json = JSON.stringify(p).replace(/<\//g, '<\\/');
      return `    <script type="application/ld+json">${json}</script>`;
    })
    .join('\n');
  return html.replace(/<\/head>/i, `${blocks}\n  </head>`);
}
