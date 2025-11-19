import { Router } from 'express';
import { body } from 'express-validator';
import * as toolsController from '../controllers/toolsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(toolsController.getTools)
);

router.get('/stats', asyncHandler(toolsController.getToolStats));

router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(toolsController.getTool)
);

router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('type').trim().notEmpty(),
  ],
  validate,
  asyncHandler(toolsController.createTool)
);

router.put(
  '/:id',
  validateUUID('id'),
  asyncHandler(toolsController.updateTool)
);

router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(toolsController.deleteTool)
);

export default router;
