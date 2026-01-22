import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getUserPreference, setUserPreference } from '../services/userPreferenceService';

const router: express.Router = express.Router();

/**
 * GET /api/ai/preferences
 * Get user's AI preferences (including provider preference)
 */
router.get('/preferences', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get provider preference (defaults to 'auto' if not set)
    const preferredProvider = await getUserPreference(userId, 'ai_preferred_provider') || 'auto';

    res.json({
      success: true,
      data: {
        preferredProvider: preferredProvider as 'auto' | 'openai' | 'anthropic'
      }
    });
  } catch (error) {
    console.error('Get AI preferences error:', error);
    res.status(500).json({
      error: 'Failed to get AI preferences',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * PUT /api/ai/preferences
 * Update user's AI preferences
 */
router.put('/preferences', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { preferredProvider } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate provider
    if (preferredProvider && !['auto', 'openai', 'anthropic'].includes(preferredProvider)) {
      return res.status(400).json({ 
        error: 'Invalid provider. Must be auto, openai, or anthropic' 
      });
    }

    // Update provider preference
    if (preferredProvider) {
      await setUserPreference(userId, 'ai_preferred_provider', preferredProvider);
    }

    res.json({
      success: true,
      data: {
        preferredProvider: preferredProvider || 'auto'
      },
      message: 'AI preferences updated successfully'
    });
  } catch (error) {
    console.error('Update AI preferences error:', error);
    res.status(500).json({
      error: 'Failed to update AI preferences',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;
