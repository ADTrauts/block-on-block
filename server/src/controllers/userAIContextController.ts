/**
 * User AI Context Controller
 * 
 * Manages user-defined context entries that help the AI understand
 * user preferences, workflows, and specific instructions.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

export interface UserAIContextInput {
  scope: 'personal' | 'business' | 'module' | 'folder' | 'project';
  scopeId?: string;
  moduleId?: string;
  contextType: 'instruction' | 'fact' | 'preference' | 'workflow';
  title: string;
  content: string;
  tags?: string[];
  priority?: number;
  active?: boolean;
}

/**
 * GET /api/ai/context
 * Get all user-defined context entries, optionally filtered by scope/module
 */
export async function getUserAIContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { scope, moduleId, active } = req.query;

    const where: Record<string, unknown> = { userId };
    
    if (scope && typeof scope === 'string') {
      where.scope = scope;
    }
    
    if (moduleId && typeof moduleId === 'string') {
      where.moduleId = moduleId;
    }
    
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const contexts = await prisma.userAIContext.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: contexts
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error fetching user AI context', {
      operation: 'getUserAIContext',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message 
    });
  }
}

/**
 * GET /api/ai/context/:id
 * Get a specific context entry
 */
export async function getContextById(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const context = await prisma.userAIContext.findFirst({
      where: {
        id,
        userId // Ensure user owns this context
      }
    });

    if (!context) {
      res.status(404).json({ 
        success: false, 
        message: 'Context not found' 
      });
      return;
    }

    res.json({
      success: true,
      data: context
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error fetching context by ID', {
      operation: 'getContextById',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: err.message 
    });
  }
}

/**
 * POST /api/ai/context
 * Create a new context entry
 */
export async function createUserAIContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const data: UserAIContextInput = req.body;

    // Validate required fields
    if (!data.scope || !data.contextType || !data.title || !data.content) {
      res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: scope, contextType, title, content' 
      });
      return;
    }

    // Validate scope-specific requirements
    if (data.scope === 'business' && !data.scopeId) {
      res.status(400).json({ 
        success: false, 
        message: 'scopeId is required for business scope' 
      });
      return;
    }

    if (data.scope === 'module' && !data.moduleId) {
      res.status(400).json({ 
        success: false, 
        message: 'moduleId is required for module scope' 
      });
      return;
    }

    // Note: For module scope, scopeId can be a businessId (for business module context)
    // or null (for personal module context). moduleId is the actual module identifier.
    // They don't need to match - scopeId scopes the context to a business, moduleId identifies the module.

    const context = await prisma.userAIContext.create({
      data: {
        userId,
        scope: data.scope,
        scopeId: data.scopeId || null,
        moduleId: data.moduleId || null,
        contextType: data.contextType,
        title: data.title,
        content: data.content,
        tags: data.tags || [],
        priority: data.priority ?? 50,
        active: data.active ?? true
      }
    });

    logger.info('User AI context created', {
      operation: 'createUserAIContext',
      userId,
      contextId: context.id,
      scope: context.scope,
      moduleId: context.moduleId
    });

    res.status(201).json({
      success: true,
      data: context
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error creating user AI context', {
      operation: 'createUserAIContext',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create context',
      error: err.message 
    });
  }
}

/**
 * PUT /api/ai/context/:id
 * Update an existing context entry
 */
export async function updateUserAIContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params;
    const data: Partial<UserAIContextInput> = req.body;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    // Verify ownership
    const existing = await prisma.userAIContext.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      res.status(404).json({ 
        success: false, 
        message: 'Context not found' 
      });
      return;
    }

    const updateData: Record<string, unknown> = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.contextType !== undefined) updateData.contextType = data.contextType;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.scope !== undefined) updateData.scope = data.scope;
    if (data.scopeId !== undefined) updateData.scopeId = data.scopeId;
    if (data.moduleId !== undefined) updateData.moduleId = data.moduleId;

    const updated = await prisma.userAIContext.update({
      where: { id },
      data: updateData
    });

    logger.info('User AI context updated', {
      operation: 'updateUserAIContext',
      userId,
      contextId: id
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error updating user AI context', {
      operation: 'updateUserAIContext',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update context',
      error: err.message 
    });
  }
}

/**
 * DELETE /api/ai/context/:id
 * Delete a context entry
 */
export async function deleteUserAIContext(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    // Verify ownership
    const existing = await prisma.userAIContext.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      res.status(404).json({ 
        success: false, 
        message: 'Context not found' 
      });
      return;
    }

    await prisma.userAIContext.delete({
      where: { id }
    });

    logger.info('User AI context deleted', {
      operation: 'deleteUserAIContext',
      userId,
      contextId: id
    });

    res.json({
      success: true,
      message: 'Context deleted successfully'
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Error deleting user AI context', {
      operation: 'deleteUserAIContext',
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete context',
      error: err.message 
    });
  }
}

