import { Router, Request, Response } from 'express';
import { fetchIndexHtml, injectJsonLd } from '../utils/ogRenderer';
import { asyncHandler } from '../utils/errorHandler';
import logger from '../config/logger';
import {
  CALCULATORS_INDEX_JSONLD,
  GAUGE_CALCULATOR_JSONLD,
  GIFT_SIZE_CALCULATOR_JSONLD,
} from '../seo/calculatorJsonLd';

const router = Router();

/**
 * Server-side JSON-LD rendering for the public calculator pages.
 *
 * The same payloads are emitted client-side by `useSeo`, but Bing,
 * Pinterest, and Facebook's scraper read static HTML and miss anything
 * React adds after hydration. This route pulls the SPA shell from the
 * frontend container, splices `<script type="application/ld+json">`
 * blocks into <head>, and serves the result. The SPA still hydrates
 * normally and may also set its own JSON-LD via `useSeo` — that's
 * fine, the duplicates parse independently.
 *
 * Routed via nginx `location` blocks for `/calculators`,
 * `/calculators/gauge`, and `/calculators/gift-size` (same pattern as
 * `/p/:slug`).
 */

const ROUTE_PAYLOADS: Record<string, Array<Record<string, unknown>>> = {
  '/calculators': CALCULATORS_INDEX_JSONLD,
  '/calculators/gauge': GAUGE_CALCULATOR_JSONLD,
  '/calculators/gift-size': GIFT_SIZE_CALCULATOR_JSONLD,
};

function makeHandler(payloads: Array<Record<string, unknown>>) {
  return asyncHandler(async (_req: Request, res: Response) => {
    res.type('html');
    // The SPA shell is essentially identical between deploys but we
    // refresh on each request via the in-memory TTL cache; bypass the
    // browser/edge cache so a deploy isn't masked by stale HTML.
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    let html: string;
    try {
      html = await fetchIndexHtml();
    } catch (err) {
      logger.error('calculators-ssr: failed to fetch frontend index.html', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(502).send('Bad Gateway');
      return;
    }

    res.send(injectJsonLd(html, payloads));
  });
}

for (const [path, payloads] of Object.entries(ROUTE_PAYLOADS)) {
  router.get(path, makeHandler(payloads));
}

export default router;
