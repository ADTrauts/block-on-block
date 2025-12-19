import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as userAIContextController from '../controllers/userAIContextController';

const router: express.Router = express.Router();

/**
 * GET /api/ai/context
 * Get all user-defined context entries, optionally filtered
 */
router.get('/', authenticateJWT, userAIContextController.getUserAIContext);

/**
 * GET /api/ai/context/:id
 * Get a specific context entry
 */
router.get('/:id', authenticateJWT, userAIContextController.getContextById);

/**
 * POST /api/ai/context
 * Create a new context entry
 */
router.post('/', authenticateJWT, userAIContextController.createUserAIContext);

/**
 * PUT /api/ai/context/:id
 * Update an existing context entry
 */
router.put('/:id', authenticateJWT, userAIContextController.updateUserAIContext);

/**
 * DELETE /api/ai/context/:id
 * Delete a context entry
 */
router.delete('/:id', authenticateJWT, userAIContextController.deleteUserAIContext);

export default router;

