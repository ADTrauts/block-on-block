import { Request, Response, NextFunction } from 'express';
import * as sidebarService from '../services/sidebarCustomizationService';
import type { SidebarCustomization } from '../services/sidebarCustomizationService';

interface SaveSidebarConfigRequest {
  config: SidebarCustomization;
}

function hasUserId(user: unknown): user is { id: string } {
  return typeof user === 'object' && user !== null && 'id' in user && typeof (user as { id: unknown }).id === 'string';
}

/**
 * GET /api/dashboard/:id/sidebar-config
 * Get sidebar customization configuration for a dashboard
 */
export async function getSidebarConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const dashboardId = req.params.id;

    if (!dashboardId) {
      res.status(400).json({ success: false, message: 'Dashboard ID is required' });
      return;
    }

    const config = await sidebarService.getSidebarConfig(userId, dashboardId);

    res.json({
      success: true,
      config,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dashboard/:id/sidebar-config
 * Save sidebar customization configuration for a dashboard
 */
export async function saveSidebarConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const dashboardId = req.params.id;
    const body = req.body as SaveSidebarConfigRequest;

    if (!dashboardId) {
      res.status(400).json({ success: false, message: 'Dashboard ID is required' });
      return;
    }

    if (!body.config) {
      res.status(400).json({ success: false, message: 'Configuration is required' });
      return;
    }

    await sidebarService.saveSidebarConfig(userId, dashboardId, body.config);

    res.json({
      success: true,
      message: 'Sidebar configuration saved successfully',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/dashboard/:id/sidebar-config
 * Update sidebar customization configuration for a dashboard
 * (Same as POST, but using PUT method)
 */
export async function updateSidebarConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Reuse saveSidebarConfig logic
  await saveSidebarConfig(req, res, next);
}

/**
 * DELETE /api/dashboard/:id/sidebar-config
 * Reset sidebar customization configuration to defaults
 */
export async function resetSidebarConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const dashboardId = req.params.id;
    const scope = req.query.scope as 'tab' | 'sidebar' | 'global' | undefined;
    const dashboardTabId = req.query.dashboardTabId as string | undefined;
    const context = req.query.context as string | undefined;

    if (!dashboardId) {
      res.status(400).json({ success: false, message: 'Dashboard ID is required' });
      return;
    }

    // Validate scope-specific parameters
    if (scope === 'tab' && !dashboardTabId) {
      res.status(400).json({ success: false, message: 'dashboardTabId is required when scope is "tab"' });
      return;
    }

    if (scope === 'sidebar' && !context) {
      res.status(400).json({ success: false, message: 'context is required when scope is "sidebar"' });
      return;
    }

    await sidebarService.resetSidebarConfig(userId, dashboardId, {
      scope,
      dashboardTabId,
      context,
    });

    res.json({
      success: true,
      message: 'Sidebar configuration reset successfully',
    });
  } catch (err) {
    next(err);
  }
}

