import { Request, Response } from 'express';
import { DeveloperPortalService } from '../services/developerPortalService';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const getDeveloperStats = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // Validate businessId query parameter
    const businessIdParam = req.query.businessId;
    const businessId = (businessIdParam && typeof businessIdParam === 'string') ? businessIdParam : undefined;
    const stats = await DeveloperPortalService.getDeveloperStats(userId, businessId);
    res.json({ stats });
  } catch (error) {
    console.error('Error getting developer stats:', error);
    res.status(500).json({ error: 'Failed to get developer stats' });
  }
};

export const getModuleRevenue = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // Validate businessId query parameter
    const businessIdParam = req.query.businessId;
    const businessId = (businessIdParam && typeof businessIdParam === 'string') ? businessIdParam : undefined;
    const moduleRevenue = await DeveloperPortalService.getModuleRevenue(userId, businessId);
    res.json({ moduleRevenue });
  } catch (error) {
    console.error('Error getting module revenue:', error);
    res.status(500).json({ error: 'Failed to get module revenue' });
  }
};

export const getModuleAnalytics = async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // Verify module belongs to developer
    const module = await prisma.module.findFirst({
      where: {
        id: moduleId,
        developerId: userId,
      },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const analytics = await DeveloperPortalService.getModuleAnalytics(moduleId);
    res.json({ analytics });
  } catch (error) {
    console.error('Error getting module analytics:', error);
    res.status(500).json({ error: 'Failed to get module analytics' });
  }
};

export const requestPayout = async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const payout = await DeveloperPortalService.requestPayout(userId, amount);
    res.json({ 
      message: 'Payout request submitted successfully',
      payout,
    });
  } catch (error) {
    console.error('Error requesting payout:', error);
    res.status(500).json({ error: 'Failed to request payout' });
  }
};

export const getPayoutHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    const payoutHistory = await DeveloperPortalService.getPayoutHistory(userId);
    res.json({ payoutHistory });
  } catch (error) {
    console.error('Error getting payout history:', error);
    res.status(500).json({ error: 'Failed to get payout history' });
  }
};

export const updateModulePricing = async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { basePrice, enterprisePrice } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // Verify module belongs to developer
    const module = await prisma.module.findFirst({
      where: {
        id: moduleId,
        developerId: userId,
      },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const updatedModule = await DeveloperPortalService.updateModulePricing(
      moduleId,
      basePrice,
      enterprisePrice
    );

    res.json({ 
      message: 'Module pricing updated successfully',
      module: updatedModule,
    });
  } catch (error) {
    console.error('Error updating module pricing:', error);
    res.status(500).json({ error: 'Failed to update module pricing' });
  }
};

export const getDeveloperDashboard = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    // Validate businessId query parameter
    const businessIdParam = req.query.businessId;
    const businessId = (businessIdParam && typeof businessIdParam === 'string') ? businessIdParam : undefined;
    const dashboard = await DeveloperPortalService.getDeveloperDashboard(userId, businessId);
    res.json({ dashboard });
  } catch (error) {
    console.error('Error getting developer dashboard:', error);
    res.status(500).json({ error: 'Failed to get developer dashboard' });
  }
}; 