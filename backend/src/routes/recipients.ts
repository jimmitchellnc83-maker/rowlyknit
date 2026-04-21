import { Router } from 'express';
import { body } from 'express-validator';
import * as recipientsController from '../controllers/recipientsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(recipientsController.getRecipients)
);

router.get('/stats', asyncHandler(recipientsController.getRecipientStats));

router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(recipientsController.getRecipient)
);

router.post(
  '/',
  [
    body('firstName').trim().notEmpty().isLength({ max: 100 }),
    body('lastName').optional().trim(),
    body('relationship').optional().trim(),
  ],
  validate,
  asyncHandler(recipientsController.createRecipient)
);

router.put(
  '/:id',
  [
    validateUUID('id'),
    body('firstName').optional().trim().isLength({ max: 100 }),
    body('lastName').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('relationship').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('birthday').optional({ values: 'falsy' }).isISO8601(),
    body('measurements').optional({ values: 'null' }).isObject(),
    body('preferences').optional({ values: 'null' }).isObject(),
    body('clothingSize').optional({ values: 'null' }).trim().isLength({ max: 50 }),
    body('shoeSize').optional({ values: 'null' }).trim().isLength({ max: 50 }),
    body('notes').optional({ values: 'null' }).isString(),
  ],
  validate,
  asyncHandler(recipientsController.updateRecipient)
);

router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(recipientsController.deleteRecipient)
);

export default router;
