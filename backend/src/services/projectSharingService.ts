import crypto from 'crypto';
import db from '../config/database';
import logger from '../config/logger';

// Service layer for the per-project public-share toggle. Slug is derived
// from the project name plus a 4-char crypto suffix; once generated it
// stays stable across publish/unpublish cycles so a circulated link keeps
// resolving even if the owner toggles visibility.

const SLUG_MAX_LEN = 60;
const SUFFIX_LEN = 4;

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LEN - SUFFIX_LEN - 1);
}

function randomSuffix(): string {
  // 4 chars from the URL-safe base62 alphabet (no ambiguous lookalikes).
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(SUFFIX_LEN);
  let out = '';
  for (let i = 0; i < SUFFIX_LEN; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugifyName(name) || 'project';
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    const existing = await db('projects').where({ share_slug: slug }).first();
    if (!existing) return slug;
  }
  // Fallback that's effectively guaranteed unique. Hit only on the
  // astronomically-unlikely run of five collisions in a row.
  return `${base}-${crypto.randomBytes(8).toString('hex')}`;
}

interface SetVisibilityInput {
  projectId: string;
  userId: string;
  isPublic: boolean;
}

interface SetVisibilityResult {
  isPublic: boolean;
  shareSlug: string | null;
  publishedAt: Date | null;
}

export async function setProjectVisibility({
  projectId,
  userId,
  isPublic,
}: SetVisibilityInput): Promise<SetVisibilityResult | null> {
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) return null;

  let shareSlug: string | null = project.share_slug ?? null;
  let publishedAt: Date | null = project.published_at ?? null;

  if (isPublic && !shareSlug) {
    shareSlug = await generateUniqueSlug(project.name);
    publishedAt = new Date();
  } else if (isPublic && !publishedAt) {
    publishedAt = new Date();
  }

  await db('projects')
    .where({ id: projectId, user_id: userId })
    .update({
      is_public: isPublic,
      share_slug: shareSlug,
      published_at: publishedAt,
      updated_at: new Date(),
    });

  return { isPublic, shareSlug, publishedAt };
}

interface PublicProjectView {
  id: string;
  name: string;
  description: string | null;
  projectType: string | null;
  status: string;
  startedDate: string | null;
  completedDate: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  viewCount: number;
  publishedAt: string | null;
  primaryPhoto: { url: string; caption: string | null } | null;
  photos: Array<{ url: string; caption: string | null }>;
  yarn: Array<{ name: string; brand: string | null; weight: string | null; color: string | null }>;
}

const UPLOAD_BASE = (process.env.PUBLIC_UPLOAD_URL ?? '/uploads').replace(/\/$/, '');

function photoUrl(filename: string): string {
  return `${UPLOAD_BASE}/${filename}`;
}

export async function getPublicProjectBySlug(slug: string): Promise<PublicProjectView | null> {
  const project = await db('projects')
    .where({ share_slug: slug, is_public: true })
    .whereNull('deleted_at')
    .first();

  if (!project) return null;

  const [photos, yarn] = await Promise.all([
    db('project_photos')
      .where({ project_id: project.id })
      .whereNull('deleted_at')
      .orderBy([
        { column: 'is_primary', order: 'desc' },
        { column: 'sort_order', order: 'asc' },
      ]),
    db('project_yarn as py')
      .join('yarn as y', 'py.yarn_id', 'y.id')
      .where({ 'py.project_id': project.id })
      .select('y.name', 'y.brand', 'y.weight', 'y.color'),
  ]);

  // Increment view_count separately so a failure here doesn't poison the
  // read. Best-effort — analytics-grade counting can come later.
  db('projects')
    .where({ id: project.id })
    .increment('view_count', 1)
    .catch((err) => {
      logger.warn('Failed to increment public-project view_count', {
        projectId: project.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

  const mappedPhotos = photos.map((p) => ({
    url: photoUrl(p.filename),
    caption: p.caption ?? null,
  }));
  const primaryPhoto =
    photos.find((p) => p.is_primary) ?? photos[0] ?? null;

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    projectType: project.project_type ?? null,
    status: project.status,
    startedDate: project.start_date ?? null,
    completedDate: project.actual_completion_date ?? null,
    metadata:
      typeof project.metadata === 'string'
        ? JSON.parse(project.metadata)
        : project.metadata ?? {},
    notes: project.notes ?? null,
    viewCount: project.view_count ?? 0,
    publishedAt: project.published_at ?? null,
    primaryPhoto: primaryPhoto
      ? { url: photoUrl(primaryPhoto.filename), caption: primaryPhoto.caption ?? null }
      : null,
    photos: mappedPhotos,
    yarn: yarn.map((y) => ({
      name: y.name,
      brand: y.brand ?? null,
      weight: y.weight ?? null,
      color: y.color ?? null,
    })),
  };
}
