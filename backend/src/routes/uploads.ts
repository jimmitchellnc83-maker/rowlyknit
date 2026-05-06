import express from 'express';
import * as uploadsController from '../controllers/uploadsController';
import { authenticate } from '../middleware/auth';
import { requireEntitlement } from '../middleware/requireEntitlement';
import { validateUUID } from '../middleware/validator';

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Project photo routes
//
// `requireEntitlement` runs BEFORE the multer middleware on every
// upload route below so an unentitled request never streams bytes to
// disk. Photos / files are durable workspace artifacts; the gate
// keeps the paid tier honest while leaving GETs unrestricted so
// existing photos remain viewable after a trial expires.
router.post(
  '/projects/:projectId/photos',
  requireEntitlement,
  validateUUID('projectId'),
  uploadsController.uploadImageMiddleware,
  uploadsController.uploadProjectPhoto
);

router.get(
  '/projects/:projectId/photos',
  validateUUID('projectId'),
  uploadsController.getProjectPhotos
);

router.get(
  '/projects/:projectId/photos/:photoId',
  validateUUID('projectId'),
  validateUUID('photoId'),
  uploadsController.serveProjectPhoto
);

router.get(
  '/projects/:projectId/photos/:photoId/thumbnail',
  validateUUID('projectId'),
  validateUUID('photoId'),
  uploadsController.serveProjectPhoto
);

router.delete(
  '/projects/:projectId/photos/:photoId',
  validateUUID('projectId'),
  validateUUID('photoId'),
  uploadsController.deleteProjectPhoto
);

// Pattern file routes
router.post(
  '/patterns/:patternId/files',
  requireEntitlement,
  validateUUID('patternId'),
  uploadsController.uploadPatternFileMiddleware,
  uploadsController.uploadPatternFile
);

router.get(
  '/patterns/:patternId/files',
  validateUUID('patternId'),
  uploadsController.getPatternFiles
);

router.get(
  '/patterns/:patternId/files/:fileId/download',
  validateUUID('patternId'),
  validateUUID('fileId'),
  uploadsController.downloadPatternFile
);

router.delete(
  '/patterns/:patternId/files/:fileId',
  validateUUID('patternId'),
  validateUUID('fileId'),
  uploadsController.deletePatternFile
);

// Yarn photo routes
router.post(
  '/yarn/:yarnId/photos',
  requireEntitlement,
  validateUUID('yarnId'),
  uploadsController.uploadImageMiddleware,
  uploadsController.uploadYarnPhoto
);

router.post(
  '/yarn/:yarnId/photos/from-url',
  requireEntitlement,
  validateUUID('yarnId'),
  uploadsController.uploadYarnPhotoFromUrl
);

router.get(
  '/yarn/:yarnId/photos',
  validateUUID('yarnId'),
  uploadsController.getYarnPhotos
);

router.get(
  '/yarn/:yarnId/photos/:photoId',
  validateUUID('yarnId'),
  validateUUID('photoId'),
  uploadsController.serveYarnPhoto
);

router.get(
  '/yarn/:yarnId/photos/:photoId/thumbnail',
  validateUUID('yarnId'),
  validateUUID('photoId'),
  uploadsController.serveYarnPhoto
);

router.delete(
  '/yarn/:yarnId/photos/:photoId',
  validateUUID('yarnId'),
  validateUUID('photoId'),
  uploadsController.deleteYarnPhoto
);

router.post(
  '/patterns/:patternId/thumbnail/from-url',
  requireEntitlement,
  validateUUID('patternId'),
  uploadsController.uploadPatternThumbnailFromUrl
);

router.get(
  '/patterns/:patternId/thumbnail',
  validateUUID('patternId'),
  uploadsController.servePatternThumbnail
);

export default router;
