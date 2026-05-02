import { Request, Response } from 'express';
import { NotFoundError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import {
  setProjectVisibility,
  getPublicProjectBySlug,
  getPublicProjectPhoto,
} from '../services/projectSharingService';
import { streamSafeUpload } from '../utils/uploadStorage';

// PATCH /api/projects/:id/visibility — owner toggles whether a project is
// publicly viewable, and optionally whether project notes ride along
// with the public projection. Generates a stable slug on first publish.
export async function updateProjectVisibility(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { isPublic, publicNotes } = req.body as {
    isPublic?: boolean;
    publicNotes?: boolean;
  };

  if (typeof isPublic !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isPublic must be a boolean',
    });
  }
  if (publicNotes !== undefined && typeof publicNotes !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'publicNotes must be a boolean',
    });
  }

  const result = await setProjectVisibility({
    projectId: id,
    userId,
    isPublic,
    publicNotes,
  });

  if (!result) {
    throw new NotFoundError('Project not found');
  }

  await createAuditLog(req, {
    userId,
    action: isPublic ? 'project_published' : 'project_unpublished',
    entityType: 'project',
    entityId: id,
    newValues: {
      isPublic: result.isPublic,
      shareSlug: result.shareSlug,
      publicNotes: result.publicNotes,
    },
  });

  return res.json({
    success: true,
    data: {
      isPublic: result.isPublic,
      shareSlug: result.shareSlug,
      publishedAt: result.publishedAt,
      publicNotes: result.publicNotes,
    },
  });
}

// GET /shared/project/:slug — public, no auth. Returns a sanitized view
// (no row counts, panel state, recipient names, or anything else not
// fit for a screenshot on Pinterest).
export async function viewSharedProject(req: Request, res: Response) {
  const { slug } = req.params;
  const project = await getPublicProjectBySlug(slug);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found or no longer public',
    });
  }

  return res.json({
    success: true,
    data: { project },
  });
}

// GET /shared/project/:slug/photos/:photoId(/thumbnail) — public photo
// streamer that re-checks `is_public=true` on every fetch. Filenames on
// disk are random hex tokens so guessing the slug doesn't get you a
// neighbor's photo.
export async function viewSharedProjectPhoto(req: Request, res: Response) {
  const { slug, photoId } = req.params;
  const variant = req.path.endsWith('/thumbnail') ? 'thumbnail' : 'full';

  const photo = await getPublicProjectPhoto(slug, photoId);
  if (!photo) {
    return res.status(404).json({
      success: false,
      message: 'Photo not found or no longer public',
    });
  }

  if (variant === 'thumbnail') {
    if (!photo.thumbnail_filename) {
      return res.status(404).json({ success: false, message: 'Thumbnail not found' });
    }
    await streamSafeUpload(res, {
      subdir: 'projects/thumbnails',
      filename: photo.thumbnail_filename,
      mimeType: photo.mime_type ?? 'image/webp',
      cacheControl: 'public, max-age=86400',
    });
  } else {
    await streamSafeUpload(res, {
      subdir: 'projects',
      filename: photo.filename,
      mimeType: photo.mime_type ?? 'image/webp',
      cacheControl: 'public, max-age=86400',
    });
  }
}
