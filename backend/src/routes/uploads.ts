import express from 'express';
import * as uploadsController from '../controllers/uploadsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Project photo routes
router.post(
  '/projects/:projectId/photos',
  uploadsController.uploadImageMiddleware,
  uploadsController.uploadProjectPhoto
);

router.get(
  '/projects/:projectId/photos',
  uploadsController.getProjectPhotos
);

router.delete(
  '/projects/:projectId/photos/:photoId',
  uploadsController.deleteProjectPhoto
);

// Pattern file routes
router.post(
  '/patterns/:patternId/files',
  uploadsController.uploadPatternFileMiddleware,
  uploadsController.uploadPatternFile
);

router.get(
  '/patterns/:patternId/files',
  uploadsController.getPatternFiles
);

router.get(
  '/patterns/:patternId/files/:fileId/download',
  uploadsController.downloadPatternFile
);

router.delete(
  '/patterns/:patternId/files/:fileId',
  uploadsController.deletePatternFile
);

// Yarn photo routes
router.post(
  '/yarn/:yarnId/photos',
  uploadsController.uploadImageMiddleware,
  uploadsController.uploadYarnPhoto
);

router.post(
  '/yarn/:yarnId/photos/from-url',
  uploadsController.uploadYarnPhotoFromUrl
);

router.get(
  '/yarn/:yarnId/photos',
  uploadsController.getYarnPhotos
);

router.delete(
  '/yarn/:yarnId/photos/:photoId',
  uploadsController.deleteYarnPhoto
);

router.post(
  '/patterns/:patternId/thumbnail/from-url',
  uploadsController.uploadPatternThumbnailFromUrl
);

export default router;
