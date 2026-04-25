import { Router, Request, Response } from 'express';
import { getPublicProjectBySlug } from '../services/projectSharingService';
import { fetchIndexHtml, injectMetaTags } from '../utils/ogRenderer';
import { asyncHandler } from '../utils/errorHandler';
import logger from '../config/logger';

const router = Router();

/**
 * Server-side meta-tag rendering for `/p/:slug` (public FO share page).
 *
 * Hits this route via the proxy nginx rule that matches `^/p/[a-z0-9-]+/?$`
 * and forwards to the backend. Everything else (the SPA's JS bundle,
 * /assets/*, etc.) keeps going to the frontend container.
 *
 * The HTML we return is the SPA shell with project-specific og:* tags
 * spliced into <head>. The SPA itself still hydrates client-side and
 * may set its own meta via `useSeo` — that's fine, the FB scraper
 * already saw the server-rendered version on its non-JS pass.
 *
 * On any failure we serve the unmodified shell so the share page still
 * loads (the SPA's PublicProjectPage handles its own 404 / loading
 * states); we don't want a meta-rendering hiccup to take down the
 * actual visitor experience.
 */
router.get(
  '/p/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    res.type('html');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    let html: string;
    try {
      html = await fetchIndexHtml();
    } catch (err) {
      logger.error('og-render: failed to fetch frontend index.html', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Hard fail — without the SPA shell we have nothing to serve.
      res.status(502).send('Bad Gateway');
      return;
    }

    let project;
    try {
      project = await getPublicProjectBySlug(req.params.slug);
    } catch (err) {
      logger.error('og-render: project lookup failed', {
        slug: req.params.slug,
        error: err instanceof Error ? err.message : String(err),
      });
      // Serve the SPA shell unchanged — it'll render its own error
      // boundary or 404 when its own fetch fails.
      res.send(html);
      return;
    }

    if (!project) {
      // Slug doesn't resolve — the SPA's PublicProjectPage shows the
      // proper 404 UX. Status stays 200 so the SPA can hydrate (a
      // 404 status would block the SPA mount in some clients).
      res.send(html);
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const projectType = (project.projectType ?? 'knitting').toString();
    const description =
      project.description?.trim() ||
      `A ${projectType} project shared on Rowly.`;

    const modified = injectMetaTags(html, {
      title: `${project.name} — knitted on Rowly`,
      description,
      image: project.primaryPhoto?.url ?? null,
      url: `${baseUrl}/p/${req.params.slug}`,
    });

    res.send(modified);
  }),
);

export default router;
