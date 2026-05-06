import { Router } from 'express';
import { body } from 'express-validator';
import * as piecesController from '../controllers/piecesController';
import { authenticate } from '../middleware/auth';
import { requireEntitlement } from '../middleware/requireEntitlement';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/projects/:id/pieces',
  validateUUID('id'),
  asyncHandler(piecesController.getPieces),
);

router.get(
  '/projects/:id/pieces/:pieceId',
  [validateUUID('id'), validateUUID('pieceId')],
  validate,
  asyncHandler(piecesController.getPiece),
);

router.post(
  '/projects/:id/pieces',
  requireEntitlement,
  [
    validateUUID('id'),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('type').optional({ values: 'null' }).isString().isLength({ max: 50 }),
    body('status').optional({ values: 'null' }).isIn(['not_started', 'in_progress', 'completed', 'blocked']),
    body('notes').optional({ values: 'null' }).isString(),
    body('sortOrder').optional({ values: 'falsy' }).isNumeric(),
  ],
  validate,
  asyncHandler(piecesController.createPiece),
);

router.put(
  '/projects/:id/pieces/:pieceId',
  [
    validateUUID('id'),
    validateUUID('pieceId'),
    body('name').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
    body('type').optional({ values: 'null' }).isString().isLength({ max: 50 }),
    body('status').optional({ values: 'null' }).isIn(['not_started', 'in_progress', 'completed', 'blocked']),
    body('notes').optional({ values: 'null' }).isString(),
  ],
  validate,
  asyncHandler(piecesController.updatePiece),
);

router.delete(
  '/projects/:id/pieces/:pieceId',
  [validateUUID('id'), validateUUID('pieceId')],
  validate,
  asyncHandler(piecesController.deletePiece),
);

router.patch(
  '/projects/:id/pieces/reorder',
  [validateUUID('id'), body('order').isArray({ min: 1 })],
  validate,
  asyncHandler(piecesController.reorderPieces),
);

export default router;
