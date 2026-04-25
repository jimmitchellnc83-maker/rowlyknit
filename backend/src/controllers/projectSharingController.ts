import { Request, Response } from 'express';
import { NotFoundError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import {
  setProjectVisibility,
  getPublicProjectBySlug,
} from '../services/projectSharingService';

// PATCH /api/projects/:id/visibility — owner toggles whether a project is
// publicly viewable. Generates a stable slug on first publish.
export async function updateProjectVisibility(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { isPublic } = req.body as { isPublic?: boolean };

  if (typeof isPublic !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isPublic must be a boolean',
    });
  }

  const result = await setProjectVisibility({
    projectId: id,
    userId,
    isPublic,
  });

  if (!result) {
    throw new NotFoundError('Project not found');
  }

  await createAuditLog(req, {
    userId,
    action: isPublic ? 'project_published' : 'project_unpublished',
    entityType: 'project',
    entityId: id,
    newValues: { isPublic: result.isPublic, shareSlug: result.shareSlug },
  });

  return res.json({
    success: true,
    data: {
      isPublic: result.isPublic,
      shareSlug: result.shareSlug,
      publishedAt: result.publishedAt,
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
