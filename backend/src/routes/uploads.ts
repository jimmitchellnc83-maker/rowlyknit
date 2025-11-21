import express from 'express';
import * as uploadsController from '../controllers/uploadsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Project photo routes
router.post(
  '/projects/:projectId/photos',
  validateUUID('projectId'),
  validate,
  uploadsController.uploadImageMiddleware,
  asyncHandler(uploadsController.uploadProjectPhoto)
);

router.get(
  '/projects/:projectId/photos',
  validateUUID('projectId'),
  validate,
  asyncHandler(uploadsController.getProjectPhotos)
);

router.delete(
  '/projects/:projectId/photos/:photoId',
  [validateUUID('projectId'), validateUUID('photoId')],
  validate,
  asyncHandler(uploadsController.deleteProjectPhoto)
);

// Pattern file routes
router.post(
  '/patterns/:patternId/files',
  validateUUID('patternId'),
  validate,
  uploadsController.uploadPatternFileMiddleware,
  asyncHandler(uploadsController.uploadPatternFile)
);

router.get(
  '/patterns/:patternId/files',
  validateUUID('patternId'),
  validate,
  asyncHandler(uploadsController.getPatternFiles)
);

router.get(
  '/patterns/:patternId/files/:fileId/download',
  [validateUUID('patternId'), validateUUID('fileId')],
  validate,
  asyncHandler(uploadsController.downloadPatternFile)
);

router.delete(
  '/patterns/:patternId/files/:fileId',
  [validateUUID('patternId'), validateUUID('fileId')],
  validate,
  asyncHandler(uploadsController.deletePatternFile)
);

// Yarn photo routes
router.post(
  '/yarn/:yarnId/photos',
  validateUUID('yarnId'),
  validate,
  uploadsController.uploadImageMiddleware,
  asyncHandler(uploadsController.uploadYarnPhoto)
);

router.get(
  '/yarn/:yarnId/photos',
  validateUUID('yarnId'),
  validate,
  asyncHandler(uploadsController.getYarnPhotos)
);

router.delete(
  '/yarn/:yarnId/photos/:photoId',
  [validateUUID('yarnId'), validateUUID('photoId')],
  validate,
  asyncHandler(uploadsController.deleteYarnPhoto)
);

export default router;
