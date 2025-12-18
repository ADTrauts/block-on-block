import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Type guard for user with id
function hasUserId(user: unknown): user is { id: string } {
  return typeof user === 'object' && user !== null && 'id' in user && typeof (user as { id: unknown }).id === 'string';
}

// Validation schemas
const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  dashboardId: z.string().optional(),
  businessId: z.string().optional(),
});

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

const addMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
});

// Helper function to generate conversation title from first message
function generateTitle(content: string): string {
  // Take first 50 characters and clean up
  const title = content.substring(0, 50).trim();
  return title.length < content.length ? `${title}...` : title;
}

// GET /api/ai-conversations - Get user's AI conversations
export const getConversations = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const { 
      page = 1, 
      limit = 20, 
      archived = false,
      dashboardId,
      businessId 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Build where clause
    const where: Record<string, unknown> = {
      userId: userId,
      isArchived: archived === 'true',
      trashedAt: null, // Exclude trashed conversations
    };

    if (dashboardId) {
      where.dashboardId = dashboardId as string;
    }

    if (businessId) {
      where.businessId = businessId as string;
    }

    const [conversations, total] = await Promise.all([
      prisma.aIConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          title: true,
          dashboardId: true,
          businessId: true,
          createdAt: true,
          updatedAt: true,
          lastMessageAt: true,
          isArchived: true,
          isPinned: true,
          messageCount: true,
          dashboard: {
            select: {
              id: true,
              name: true,
            },
          },
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.aIConversation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching AI conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversations' 
    });
  }
};

// GET /api/ai-conversations/:id - Get specific conversation with messages
export const getConversation = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const { id } = req.params;

    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: userId,
        trashedAt: null, // Exclude trashed conversations
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        dashboard: {
          select: {
            id: true,
            name: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error fetching AI conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversation' 
    });
  }
};

// POST /api/ai-conversations - Create new conversation
export const createConversation = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const validatedData = createConversationSchema.parse(req.body);

    const conversation = await prisma.aIConversation.create({
      data: {
        userId: userId,
        title: validatedData.title,
        dashboardId: validatedData.dashboardId,
        businessId: validatedData.businessId,
      },
      include: {
        dashboard: {
          select: {
            id: true,
            name: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error creating AI conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create conversation' 
    });
  }
};

// PUT /api/ai-conversations/:id - Update conversation
export const updateConversation = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const { id } = req.params;
    const validatedData = updateConversationSchema.parse(req.body);

    // Check if conversation exists and belongs to user
    const existingConversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: userId,
        trashedAt: null, // Exclude trashed conversations
      },
    });

    if (!existingConversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    const conversation = await prisma.aIConversation.update({
      where: { id },
      data: validatedData,
      include: {
        dashboard: {
          select: {
            id: true,
            name: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error updating AI conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update conversation' 
    });
  }
};

// DELETE /api/ai-conversations/:id - Delete conversation
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const { id } = req.params;

    // Check if conversation exists and belongs to user
    const existingConversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: userId,
        trashedAt: null, // Only allow trashing non-trashed conversations
      },
    });

    if (!existingConversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found or already trashed' 
      });
    }

    // Move conversation to trash instead of hard delete
    await prisma.aIConversation.update({
      where: { id },
      data: { trashedAt: new Date() },
    });

    res.json({
      success: true,
      message: 'Conversation moved to trash successfully',
    });
  } catch (error) {
    console.error('Error deleting AI conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete conversation' 
    });
  }
};

// POST /api/ai-conversations/:id/messages - Add message to conversation
export const addMessage = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const { id } = req.params;
    const validatedData = addMessageSchema.parse(req.body);

    // Check if conversation exists and belongs to user
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: userId,
        trashedAt: null, // Exclude trashed conversations
      },
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    // Create message
    const message = await prisma.aIMessage.create({
      data: {
        conversationId: id,
        role: validatedData.role,
        content: validatedData.content,
        confidence: validatedData.confidence,
        metadata: validatedData.metadata,
      },
    });

    // Update conversation metadata
    const updateData: Record<string, unknown> = {
      lastMessageAt: new Date(),
      messageCount: { increment: 1 },
    };

    // If this is the first user message, update the title
    if (validatedData.role === 'user' && conversation.messageCount === 0) {
      updateData.title = generateTitle(validatedData.content);
    }

    await prisma.aIConversation.update({
      where: { id },
      data: updateData,
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error adding message to AI conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add message' 
    });
  }
};

// GET /api/ai-conversations/:id/messages - Get conversation messages
export const getMessages = async (req: Request, res: Response) => {
  try {
    if (!hasUserId(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;

    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Check if conversation exists and belongs to user
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id,
        userId: userId,
        trashedAt: null, // Exclude trashed conversations
      },
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        error: 'Conversation not found' 
      });
    }

    const [messages, total] = await Promise.all([
      prisma.aIMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      prisma.aIMessage.count({
        where: { conversationId: id },
      }),
    ]);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching AI conversation messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch messages' 
    });
  }
};
