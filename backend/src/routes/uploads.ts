import express from 'express';
import * as uploadsController from '../controllers/uploadsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

// Project photo routes
router.post(
  '/projects/:projectId/photos',
  uploadsController.uploadMiddleware,
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

export default router;
