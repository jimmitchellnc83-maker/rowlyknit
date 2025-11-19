import { Router } from 'express';
import { body } from 'express-validator';
import * as yarnController from '../controllers/yarnController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(yarnController.getYarn)
);

router.get('/stats', asyncHandler(yarnController.getYarnStats));

router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(yarnController.getYarnById)
);

router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('brand').optional().trim(),
    body('weight').optional().trim(),
  ],
  validate,
  asyncHandler(yarnController.createYarn)
);

router.put(
  '/:id',
  validateUUID('id'),
  asyncHandler(yarnController.updateYarn)
);

router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(yarnController.deleteYarn)
);

export default router;
