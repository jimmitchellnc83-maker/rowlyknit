import { Router } from 'express';
import { body } from 'express-validator';
import * as panelGroupsController from '../controllers/panelGroupsController';
import * as panelsController from '../controllers/panelsController';
import { authenticate } from '../middleware/auth';
import { requireEntitlement } from '../middleware/requireEntitlement';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();
router.use(authenticate);

/**
 * Panel Groups
 */
router.get(
  '/projects/:id/panel-groups',
  validateUUID('id'),
  asyncHandler(panelGroupsController.getPanelGroups),
);

router.get(
  '/projects/:id/panel-groups/live',
  validateUUID('id'),
  asyncHandler(panelGroupsController.getAllPanelGroupsLive),
);

router.get(
  '/projects/:id/panel-groups/:groupId',
  [validateUUID('id'), validateUUID('groupId')],
  validate,
  asyncHandler(panelGroupsController.getPanelGroup),
);

router.get(
  '/projects/:id/panel-groups/:groupId/live',
  [validateUUID('id'), validateUUID('groupId')],
  validate,
  asyncHandler(panelGroupsController.getPanelGroupLive),
);

router.post(
  '/projects/:id/panel-groups/:groupId/copy-panels',
  requireEntitlement,
  [
    validateUUID('id'),
    validateUUID('groupId'),
    body('sourceGroupId').notEmpty().isUUID(),
  ],
  validate,
  asyncHandler(panelGroupsController.copyPanelsFromGroup),
);

router.post(
  '/projects/:id/panel-groups',
  requireEntitlement,
  [
    validateUUID('id'),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('masterCounterId').optional({ values: 'null' }).isUUID(),
    body('createMasterCounter').optional({ values: 'null' }).isBoolean(),
    body('sortOrder').optional({ values: 'null' }).isInt({ min: 0 }),
    body('displaySettings').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(panelGroupsController.createPanelGroup),
);

router.put(
  '/projects/:id/panel-groups/:groupId',
  [
    validateUUID('id'),
    validateUUID('groupId'),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('sortOrder').optional({ values: 'null' }).isInt({ min: 0 }),
    body('displaySettings').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(panelGroupsController.updatePanelGroup),
);

router.delete(
  '/projects/:id/panel-groups/:groupId',
  [validateUUID('id'), validateUUID('groupId')],
  validate,
  asyncHandler(panelGroupsController.deletePanelGroup),
);

/**
 * Panels
 */
router.post(
  '/projects/:id/panel-groups/:groupId/panels',
  requireEntitlement,
  [
    validateUUID('id'),
    validateUUID('groupId'),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('repeatLength').isInt({ min: 1 }),
    body('rowOffset').optional({ values: 'null' }).isInt({ min: 0 }),
    body('sortOrder').optional({ values: 'null' }).isInt({ min: 0 }),
    body('displayColor').optional({ values: 'null' }).isString().isLength({ max: 7 }),
    body('isCollapsed').optional({ values: 'null' }).isBoolean(),
    body('notes').optional({ values: 'null' }).isString(),
    body('rows').optional({ values: 'null' }).isArray(),
  ],
  validate,
  asyncHandler(panelsController.createPanel),
);

router.put(
  '/projects/:id/panels/:panelId',
  [
    validateUUID('id'),
    validateUUID('panelId'),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('repeatLength').optional({ values: 'null' }).isInt({ min: 1 }),
    body('rowOffset').optional({ values: 'null' }).isInt({ min: 0 }),
    body('sortOrder').optional({ values: 'null' }).isInt({ min: 0 }),
    body('displayColor').optional({ values: 'null' }).isString().isLength({ max: 7 }),
    body('isCollapsed').optional({ values: 'null' }).isBoolean(),
    body('notes').optional({ values: 'null' }).isString(),
  ],
  validate,
  asyncHandler(panelsController.updatePanel),
);

router.delete(
  '/projects/:id/panels/:panelId',
  [validateUUID('id'), validateUUID('panelId')],
  validate,
  asyncHandler(panelsController.deletePanel),
);

router.post(
  '/projects/:id/panels/:panelId/rows/bulk',
  [
    validateUUID('id'),
    validateUUID('panelId'),
    body('rows').isArray(),
  ],
  validate,
  asyncHandler(panelsController.bulkReplacePanelRows),
);

/**
 * Parse pasted pattern text into candidate panels. Stateless — no project
 * UUID in the path because the request body is the only input.
 */
router.post(
  '/panels/parse',
  [body('text').isString().isLength({ min: 1, max: 50000 })],
  validate,
  asyncHandler(panelsController.parsePanelText),
);

export default router;
