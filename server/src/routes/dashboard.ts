import express from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validateRequest';
import * as dashboardController from '../controllers/dashboardController';
import * as sidebarController from '../controllers/sidebarController';
import { asyncHandler } from '../index';

const router: express.Router = express.Router();

// GET /dashboards
router.get('/', async (req, res, next) => {
  try {
    await dashboardController.getDashboards(req, res, next);
  } catch (err) {
    next(err);
  }
});

// POST /dashboards
router.post(
  '/',
  validate([
    body('name').isString().notEmpty(),
    body('layout').optional(),
    body('preferences').optional(),
  ]),
  asyncHandler(dashboardController.createDashboard)
);

// GET /dashboards/:id
router.get(
  '/:id',
  validate([
    param('id').isString().notEmpty(),
  ]),
  asyncHandler(dashboardController.getDashboardById)
);

// GET /dashboards/:id/file-summary
router.get(
  '/:id/file-summary',
  validate([
    param('id').isString().notEmpty(),
  ]),
  asyncHandler(dashboardController.getDashboardFileSummary)
);

// PUT /dashboards/:id
router.put(
  '/:id',
  validate([
    param('id').isString().notEmpty(),
    body('name').optional(),
    body('layout').optional(),
    body('preferences').optional(),
  ]),
  asyncHandler(dashboardController.updateDashboard)
);

// DELETE /dashboards/:id
router.delete(
  '/:id',
  validate([
    param('id').isString().notEmpty(),
  ]),
  asyncHandler(dashboardController.deleteDashboard)
);

// Sidebar customization routes
// GET /dashboards/:id/sidebar-config
router.get(
  '/:id/sidebar-config',
  validate([
    param('id').isString().notEmpty(),
  ]),
  asyncHandler(sidebarController.getSidebarConfig)
);

// POST /dashboards/:id/sidebar-config
router.post(
  '/:id/sidebar-config',
  validate([
    param('id').isString().notEmpty(),
    body('config').isObject(),
    body('config.leftSidebar').optional().isObject(),
    body('config.rightSidebar').optional().isObject(),
  ]),
  asyncHandler(sidebarController.saveSidebarConfig)
);

// PUT /dashboards/:id/sidebar-config
router.put(
  '/:id/sidebar-config',
  validate([
    param('id').isString().notEmpty(),
    body('config').isObject(),
    body('config.leftSidebar').optional().isObject(),
    body('config.rightSidebar').optional().isObject(),
  ]),
  asyncHandler(sidebarController.updateSidebarConfig)
);

// DELETE /dashboards/:id/sidebar-config
router.delete(
  '/:id/sidebar-config',
  validate([
    param('id').isString().notEmpty(),
    query('scope').optional().isIn(['tab', 'sidebar', 'global']),
    query('dashboardTabId').optional().isString(),
    query('context').optional().isString(),
  ]),
  asyncHandler(sidebarController.resetSidebarConfig)
);

export default router;
