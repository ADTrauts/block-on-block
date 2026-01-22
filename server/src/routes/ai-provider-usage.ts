import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { OpenAIAdminService } from '../services/aiProviderServices/openAIAdminService';
import { AnthropicAdminService } from '../services/aiProviderServices/anthropicAdminService';
import { CombinedProviderService } from '../services/aiProviderServices/combinedProviderService';
import { HistoricalDataService } from '../services/aiProviderServices/historicalDataService';
import { logger } from '../lib/logger';

const router: express.Router = express.Router();

// Admin-only middleware
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    await logger.error('Failed to check admin status', {
      operation: 'ai_provider_check_admin',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

/**
 * GET /api/admin/ai-providers/usage/combined
 * Get combined usage data from both providers
 */
router.get('/usage/combined', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const combinedService = new CombinedProviderService();
    const usage = await combinedService.getCombinedUsage({ startDate: start, endDate: end });

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    await logger.error('Failed to get combined provider usage', {
      operation: 'ai_provider_get_combined_usage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get combined provider usage',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/usage/openai
 * Get OpenAI official usage data
 */
router.get('/usage/openai', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const openAIAdmin = new OpenAIAdminService();
    const usage = await openAIAdmin.getUsageData({ startDate: start, endDate: end });

    res.json({
      success: true,
      data: usage,
      source: 'openai_official'
    });
  } catch (error) {
    await logger.error('Failed to get OpenAI usage', {
      operation: 'ai_provider_get_openai_usage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenAI usage data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/usage/anthropic
 * Get Anthropic official usage data
 */
router.get('/usage/anthropic', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const anthropicAdmin = new AnthropicAdminService();
    const usage = await anthropicAdmin.getUsageReport({
      startDate: start,
      endDate: end
    });

    res.json({
      success: true,
      data: usage,
      source: 'anthropic_official'
    });
  } catch (error) {
    await logger.error('Failed to get Anthropic usage', {
      operation: 'ai_provider_get_anthropic_usage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get Anthropic usage data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/expenses/openai
 * Get OpenAI billing/expense data
 */
router.get('/expenses/openai', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const openAIAdmin = new OpenAIAdminService();
    const billing = await openAIAdmin.getBillingData(period as string);

    res.json({
      success: true,
      data: billing,
      source: 'openai_official'
    });
  } catch (error) {
    await logger.error('Failed to get OpenAI expenses', {
      operation: 'ai_provider_get_openai_expenses',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenAI expense data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/expenses/anthropic
 * Get Anthropic billing/expense data
 */
router.get('/expenses/anthropic', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const anthropicAdmin = new AnthropicAdminService();
    const costReport = await anthropicAdmin.getCostReport({
      startDate: start,
      endDate: end
    });

    res.json({
      success: true,
      data: costReport,
      source: 'anthropic_official'
    });
  } catch (error) {
    await logger.error('Failed to get Anthropic expenses', {
      operation: 'ai_provider_get_anthropic_expenses',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get Anthropic expense data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/expenses/providers
 * Get combined expense data from both providers
 */
router.get('/expenses/providers', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [openaiBilling, anthropicCost] = await Promise.all([
      new OpenAIAdminService().getBillingData(period as string).catch(() => null),
      new AnthropicAdminService().getCostReport({ startDate: start, endDate: end }).catch(() => null)
    ]);

    const combined = {
      period,
      totalCost: (openaiBilling?.totalCost || 0) + (anthropicCost?.totalCost || 0),
      currency: 'USD',
      breakdown: {
        openai: {
          cost: openaiBilling?.totalCost || 0,
          currency: openaiBilling?.currency || 'USD',
          period: openaiBilling?.period || period
        },
        anthropic: {
          cost: anthropicCost?.totalCost || 0,
          currency: anthropicCost?.currency || 'USD',
          period: anthropicCost?.period || `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`
        }
      },
      byProvider: {
        openai: openaiBilling,
        anthropic: anthropicCost
      }
    };

    res.json({
      success: true,
      data: combined
    });
  } catch (error) {
    await logger.error('Failed to get provider expenses', {
      operation: 'ai_provider_get_expenses',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get provider expenses',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/history/usage
 * Get historical usage data
 */
router.get('/history/usage', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { provider = 'all', startDate, endDate, groupBy = 'day' } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const historicalService = new HistoricalDataService();
    
    if (groupBy && groupBy !== 'day') {
      // Get trends (aggregated)
      const trends = await historicalService.getUsageTrends(
        provider as 'openai' | 'anthropic' | 'all',
        start,
        end,
        groupBy as 'day' | 'week' | 'month'
      );
      
      res.json({
        success: true,
        data: trends,
        groupBy
      });
    } else {
      // Get raw historical data
      const history = await historicalService.getHistoricalUsage(
        provider as 'openai' | 'anthropic' | 'all',
        start,
        end
      );
      
      res.json({
        success: true,
        data: history
      });
    }
  } catch (error) {
    await logger.error('Failed to get historical usage', {
      operation: 'ai_provider_get_historical_usage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get historical usage data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * GET /api/admin/ai-providers/history/expenses
 * Get historical expense data
 */
router.get('/history/expenses', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { provider = 'all', period = 'month', startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default to 1 year

    const historicalService = new HistoricalDataService();
    const expenses = await historicalService.getHistoricalExpenses(
      provider as 'openai' | 'anthropic' | 'all',
      period as 'day' | 'week' | 'month' | 'year',
      start,
      end
    );

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    await logger.error('Failed to get historical expenses', {
      operation: 'ai_provider_get_historical_expenses',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get historical expense data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;
