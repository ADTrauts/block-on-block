import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboardService';
import * as fileMigrationService from '../services/fileMigrationService';
import { CreateDashboardRequest, UpdateDashboardRequest } from 'shared/types';

function hasUserId(user: any): user is { id: string } {
  return user && typeof user.id === 'string';
}

export async function getDashboards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.sendStatus(401);
      return;
    }
    const userId = req.user.id;
    
    // Get all dashboards including business and educational contexts
    const allDashboards = await dashboardService.getAllUserDashboards(userId);
    
    // If no personal dashboards exist, create a default one
    // Note: dashboardService.createDashboard will auto-provision a personal primary calendar
    if (!allDashboards.personal || allDashboards.personal.length === 0) {
      await dashboardService.createDashboard(userId, { name: 'My Dashboard' });
      const updatedDashboards = await dashboardService.getAllUserDashboards(userId);
      res.json({ dashboards: updatedDashboards });
    } else {
      res.json({ dashboards: allDashboards });
    }
    return;
  } catch (err) {
    next(err);
  }
}

export async function createDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.sendStatus(401);
      return;
    }
    const userId = req.user.id;
    const data: CreateDashboardRequest = req.body;
    const dashboard = await dashboardService.createDashboard(userId, data);
    res.status(201).json({ dashboard });
    return;
  } catch (err) {
    next(err);
  }
}

export async function getDashboardById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.sendStatus(401);
      return;
    }
    const userId = req.user.id;
    const dashboardId = req.params.id;
    const dashboard = await dashboardService.getDashboardById(userId, dashboardId);
    if (!dashboard) {
      res.sendStatus(404);
      return;
    }
    res.json({ dashboard });
    return;
  } catch (err) {
    next(err);
  }
}

export async function updateDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.sendStatus(401);
      return;
    }
    const userId = req.user.id;
    const dashboardId = req.params.id;
    const data: UpdateDashboardRequest = req.body;
    const dashboard = await dashboardService.updateDashboard(userId, dashboardId, data);
    if (!dashboard) {
      res.sendStatus(404);
      return;
    }
    res.json({ dashboard });
    return;
  } catch (err) {
    next(err);
  }
}

export async function getDashboardFileSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.sendStatus(401);
      return;
    }
    const userId = req.user.id;
    const dashboardId = req.params.id;
    
    // Verify dashboard exists and belongs to user
    const dashboard = await dashboardService.getDashboardById(userId, dashboardId);
    if (!dashboard) {
      res.sendStatus(404);
      return;
    }
    
    const summary = await fileMigrationService.getDashboardFileSummary(userId, dashboardId);
    res.json({ summary });
    return;
  } catch (err) {
    next(err);
  }
}

export async function deleteDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!hasUserId(req.user)) {
      res.sendStatus(401);
      return;
    }
    const userId = req.user.id;
    const dashboardId = req.params.id;
    
    // Get file handling action from request body
    const { fileAction }: { fileAction?: fileMigrationService.FileHandlingAction } = req.body;
    
    // Verify dashboard exists and belongs to user
    const dashboard = await dashboardService.getDashboardById(userId, dashboardId);
    if (!dashboard) {
      res.sendStatus(404);
      return;
    }
    
    let migrationResult = null;
    
    // Handle files based on user's choice
    if (fileAction) {
      switch (fileAction.type) {
        case 'move-to-main':
          const folderName = fileAction.folderName || 
            fileMigrationService.generateLabeledFolderName(dashboard.name);
          migrationResult = await fileMigrationService.moveFilesToMainDrive(
            userId, 
            dashboardId, 
            { 
              createFolder: fileAction.createFolder,
              folderName: fileAction.createFolder ? folderName : undefined
            }
          );
          break;
          
        case 'move-to-trash':
          migrationResult = await fileMigrationService.moveFilesToTrash(
            userId, 
            dashboardId, 
            { retentionDays: fileAction.retentionDays }
          );
          break;
          
        case 'export':
          const exportResult = await fileMigrationService.createDashboardExport(
            userId, 
            dashboardId, 
            fileAction.format
          );
          migrationResult = { exportResult };
          break;
      }
    }
    
    // Delete the dashboard
    const result = await dashboardService.deleteDashboard(userId, dashboardId);
    if (result.count === 0) {
      res.sendStatus(404);
      return;
    }
    
    res.json({ 
      deleted: result.count, 
      migration: migrationResult,
      message: migrationResult ? 
        `Dashboard deleted and files handled successfully` : 
        `Dashboard deleted successfully`
    });
    return;
  } catch (err) {
    next(err);
  }
}
