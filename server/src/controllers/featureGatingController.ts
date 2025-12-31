import { Request, Response } from 'express';
import { FeatureGatingService } from '../services/featureGatingService';
import { SubscriptionMiddleware } from '../middleware/subscriptionMiddleware';
import { AuthenticatedRequest } from '../middleware/auth';

export const checkFeatureAccess = async (req: Request, res: Response) => {
  try {
    const { featureName } = req.params;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;
    
    // Validate businessId query parameter
    const businessIdParam = req.query.businessId;
    const businessId = (businessIdParam && typeof businessIdParam === 'string') ? businessIdParam : undefined;

    const access = await FeatureGatingService.checkFeatureAccess(userId, featureName, businessId);

    res.json({
      featureName,
      hasAccess: access.hasAccess,
      reason: access.reason,
      usageInfo: access.usageInfo,
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
};

export const getUserFeatures = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;
    
    // Validate businessId query parameter
    const businessIdParam = req.query.businessId;
    const businessId = (businessIdParam && typeof businessIdParam === 'string') ? businessIdParam : undefined;

    const features = await FeatureGatingService.getUserFeatures(userId, businessId);

    res.json({ features });
  } catch (error) {
    console.error('Error getting user features:', error);
    res.status(500).json({ error: 'Failed to get user features' });
  }
};

export const getUserUsage = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;
    
    // Validate businessId query parameter
    const businessIdParam = req.query.businessId;
    const businessId = (businessIdParam && typeof businessIdParam === 'string') ? businessIdParam : undefined;

    const usage = await FeatureGatingService.getUserUsage(userId, businessId);

    res.json({ usage });
  } catch (error) {
    console.error('Error getting user usage:', error);
    res.status(500).json({ error: 'Failed to get user usage' });
  }
};

export const recordUsage = async (req: Request, res: Response) => {
  try {
    const { metric, quantity = 1, cost = 0 } = req.body;
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    if (!metric) {
      return res.status(400).json({ error: 'Metric is required' });
    }

    await FeatureGatingService.recordUsage(userId, metric, quantity, cost);

    res.json({ success: true, message: 'Usage recorded successfully' });
  } catch (error) {
    console.error('Error recording usage:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
};

export const getSubscriptionInfo = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    const subscription = await SubscriptionMiddleware.getUserSubscription(userId);
    const moduleAccess = await SubscriptionMiddleware.getUserModuleAccess(userId);

    res.json({
      subscription,
      moduleAccess,
    });
  } catch (error) {
    console.error('Error getting subscription info:', error);
    res.status(500).json({ error: 'Failed to get subscription info' });
  }
}; 