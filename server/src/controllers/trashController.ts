import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

function hasUserId(user: unknown): user is { id: string } | { sub: string } {
  return typeof user === 'object' && user !== null && 
    ('id' in user && typeof (user as Record<string, unknown>).id === 'string' ||
     'sub' in user && typeof (user as Record<string, unknown>).sub === 'string');
}

interface TrashItemRequest {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'conversation' | 'dashboard_tab' | 'module' | 'message' | 'ai_conversation' | 'event' | 'profile_photo' | 'task';
  moduleId: string;
  moduleName: string;
  metadata?: Record<string, unknown>;
}

export async function listTrashedItems(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const userId = (req.user as any).id || (req.user as any).sub;

    // Get trashed files
    const trashedFiles = await prisma.file.findMany({
      where: { 
        userId, 
        trashedAt: { not: null } 
      },
      select: {
        id: true,
        name: true,
        size: true,
        type: true,
        trashedAt: true,
        userId: true,
      },
      orderBy: { trashedAt: 'desc' },
    });

    // Get trashed folders
    const trashedFolders = await prisma.folder.findMany({
      where: { 
        userId, 
        trashedAt: { not: null } 
      },
      select: {
        id: true,
        name: true,
        trashedAt: true,
        userId: true,
      },
      orderBy: { trashedAt: 'desc' },
    });

    // Get trashed conversations
    const trashedConversations = await prisma.conversation.findMany({
      where: { 
        participants: {
          some: {
            userId: userId,
            isActive: true
          }
        },
        trashedAt: { not: null } 
      },
      select: {
        id: true,
        name: true,
        trashedAt: true,
      },
      orderBy: { trashedAt: 'desc' },
    });

    // Get trashed dashboards
    const trashedDashboards = await prisma.dashboard.findMany({
      where: { 
        userId, 
        trashedAt: { not: null } 
      },
      select: {
        id: true,
        name: true,
        trashedAt: true,
        userId: true,
      },
      orderBy: { trashedAt: 'desc' },
    });

    // Get trashed profile photos
    const trashedProfilePhotos = await prisma.userProfilePhoto.findMany({
      where: {
        userId,
        trashedAt: { not: null },
      },
      select: {
        id: true,
        trashedAt: true,
        originalUrl: true,
        avatarUrl: true,
      },
      orderBy: { trashedAt: 'desc' },
    });

    // Get trashed messages
    const trashedMessages = await prisma.message.findMany({
      where: { 
        OR: [
          { senderId: userId },
          {
            conversation: {
              participants: {
                some: {
                  userId: userId,
                  isActive: true
                }
              }
            }
          }
        ],
        deletedAt: { not: null } 
      },
      select: {
        id: true,
        content: true,
        deletedAt: true,
        senderId: true,
        conversationId: true,
        conversation: {
          select: {
            name: true
          }
        }
      },
      orderBy: { deletedAt: 'desc' },
    });

    // Get trashed AI conversations (with error handling for missing column)
    let trashedAIConversations: Array<{ id: string; title: string | null; trashedAt: Date | null; userId: string }> = [];
    try {
      trashedAIConversations = await prisma.aIConversation.findMany({
        where: { 
          userId, 
          trashedAt: { not: null } 
        },
        select: {
          id: true,
          title: true,
          trashedAt: true,
          userId: true,
        },
        orderBy: { trashedAt: 'desc' },
      });
    } catch (error) {
      // Column may not exist yet - migration not run
      console.warn('AI conversations trash query failed (column may not exist):', error);
    }

    // Get trashed events (with error handling for missing column)
    let trashedEvents: Array<{ id: string; title: string; trashedAt: Date | null; calendar: { name: string; members: Array<{ role: string }> } }> = [];
    try {
      trashedEvents = await prisma.event.findMany({
        where: { 
          trashedAt: { not: null },
          calendar: {
            members: {
              some: {
                userId: userId
              }
            }
          }
        },
        select: {
          id: true,
          title: true,
          trashedAt: true,
          calendar: {
            select: {
              name: true,
              members: {
                where: { userId },
                select: { role: true }
              }
            }
          }
        },
        orderBy: { trashedAt: 'desc' },
      });
    } catch (error) {
      // Column may not exist yet - migration not run
      console.warn('Events trash query failed (column may not exist):', error);
    }

    // Get trashed tasks
    const trashedTasks = await prisma.task.findMany({
      where: { 
        trashedAt: { not: null },
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
      select: {
        id: true,
        title: true,
        trashedAt: true,
        dashboardId: true,
      },
      orderBy: { trashedAt: 'desc' },
    });

    // Transform all items to a consistent format
    const items = [
      ...trashedFiles.map(file => ({
        id: file.id,
        name: file.name,
        type: 'file' as const,
        moduleId: 'drive',
        moduleName: 'File Hub',
        trashedAt: file.trashedAt,
        metadata: {
          size: file.size,
          fileType: file.type,
        },
      })),
      ...trashedFolders.map(folder => ({
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        moduleId: 'drive',
        moduleName: 'File Hub',
        trashedAt: folder.trashedAt,
        metadata: {},
      })),
      ...trashedConversations.map(conversation => ({
        id: conversation.id,
        name: conversation.name || 'Untitled Conversation',
        type: 'conversation' as const,
        moduleId: 'chat',
        moduleName: 'Chat',
        trashedAt: conversation.trashedAt,
        metadata: {},
      })),
      ...trashedDashboards.map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        type: 'dashboard_tab' as const,
        moduleId: 'dashboard',
        moduleName: 'Dashboard',
        trashedAt: dashboard.trashedAt,
        metadata: {},
      })),
      ...trashedMessages.map(message => ({
        id: message.id,
        name: message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content,
        type: 'message' as const,
        moduleId: 'chat',
        moduleName: 'Chat',
        trashedAt: message.deletedAt,
        metadata: {
          conversationId: message.conversationId,
          senderId: message.senderId,
          conversationName: message.conversation.name || 'Untitled Conversation',
        },
      })),
      ...trashedAIConversations.map(conversation => ({
        id: conversation.id,
        name: conversation.title || 'Untitled AI Conversation',
        type: 'ai_conversation' as const,
        moduleId: 'ai-chat',
        moduleName: 'AI Chat',
        trashedAt: conversation.trashedAt,
        metadata: {},
      })),
      ...trashedEvents.map(event => ({
        id: event.id,
        name: event.title,
        type: 'event' as const,
        moduleId: 'calendar',
        moduleName: 'Calendar',
        trashedAt: event.trashedAt,
        metadata: {
          calendarName: event.calendar.name,
        },
      })),
      ...trashedProfilePhotos.map(photo => ({
        id: photo.id,
        name: 'Profile Photo',
        type: 'profile_photo' as const,
        moduleId: 'profile-photos',
        moduleName: 'Profile Photos',
        trashedAt: photo.trashedAt,
        metadata: {
          originalUrl: photo.originalUrl,
          avatarUrl: photo.avatarUrl,
        },
      })),
      ...trashedTasks.map(task => ({
        id: task.id,
        name: task.title,
        type: 'task' as const,
        moduleId: 'todo',
        moduleName: 'To-Do',
        trashedAt: task.trashedAt,
        metadata: {
          taskId: task.id,
          dashboardId: task.dashboardId,
        },
      })),
    ];

    // Sort by trashed date (most recent first)
    items.sort((a, b) => new Date(b.trashedAt!).getTime() - new Date(a.trashedAt!).getTime());

    res.json({ items });
  } catch (error) {
    console.error('Error listing trashed items:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: (req.user as any)?.id || (req.user as any)?.sub
    });
    res.status(500).json({ 
      message: 'Failed to list trashed items',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}

export async function trashItem(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const { id, name, type, moduleId, moduleName, metadata }: TrashItemRequest = req.body;

    let result;

    switch (type) {
      case 'file':
        result = await prisma.file.updateMany({
          where: { id, userId, trashedAt: null },
          data: { trashedAt: new Date() },
        });
        break;

      case 'folder':
        result = await prisma.folder.updateMany({
          where: { id, userId, trashedAt: null },
          data: { trashedAt: new Date() },
        });
        break;

      case 'conversation':
        // For conversations, we need to check if user is a participant
        const conversation = await prisma.conversation.findFirst({
          where: {
            id,
            participants: {
              some: {
                userId: userId,
                isActive: true
              }
            },
            trashedAt: null
          }
        });
        
        if (!conversation) {
          return res.status(404).json({ message: 'Conversation not found or access denied' });
        }
        
        result = await prisma.conversation.updateMany({
          where: { 
            id, 
            participants: {
              some: {
                userId: userId,
                isActive: true
              }
            },
            trashedAt: null 
          },
          data: { trashedAt: new Date() },
        });
        break;

      case 'message':
        // For messages, we need to check if user is the sender or has access to the conversation
        const message = await prisma.message.findFirst({
          where: {
            id,
            deletedAt: null
          },
          include: {
            conversation: {
              include: {
                participants: {
                  where: {
                    userId: userId,
                    isActive: true
                  }
                }
              }
            }
          }
        });
        
        if (!message) {
          return res.status(404).json({ message: 'Message not found' });
        }
        
        if (message.conversation.participants.length === 0 && message.senderId !== userId) {
          return res.status(403).json({ message: 'Access denied' });
        }
        
        result = await prisma.message.updateMany({
          where: { 
            id,
            deletedAt: null,
            OR: [
              { senderId: userId },
              {
                conversation: {
                  participants: {
                    some: {
                      userId: userId,
                      isActive: true
                    }
                  }
                }
              }
            ]
          },
          data: { deletedAt: new Date() },
        });
        break;

      case 'dashboard_tab':
        result = await prisma.dashboard.updateMany({
          where: { id, userId, trashedAt: null },
          data: { trashedAt: new Date() },
        });
        break;

      case 'ai_conversation':
        result = await prisma.aIConversation.updateMany({
          where: { id, userId, trashedAt: null },
          data: { trashedAt: new Date() },
        });
        break;

      case 'event':
        // For events, we need to check if user has permission to delete
        const event = await prisma.event.findFirst({
          where: { id, trashedAt: null },
          include: {
            calendar: {
              include: {
                members: {
                  where: {
                    userId: userId,
                    role: { in: ['OWNER', 'ADMIN', 'EDITOR'] }
                  }
                }
              }
            }
          }
        });

        if (!event) {
          return res.status(404).json({ message: 'Event not found' });
        }

        if (event.calendar.members.length === 0) {
          return res.status(403).json({ message: 'Access denied' });
        }

        result = await prisma.event.updateMany({
          where: { 
            id, 
            trashedAt: null,
            calendar: {
              members: {
                some: {
                  userId: userId,
                  role: { in: ['OWNER', 'ADMIN', 'EDITOR'] }
                }
              }
            }
          },
          data: { trashedAt: new Date() },
        });
        break;

      case 'profile_photo': {
        // Only allow trashing photos owned by the user
        const now = new Date();
        result = await prisma.userProfilePhoto.updateMany({
          where: { id, userId, trashedAt: null },
          data: { trashedAt: now },
        });

        if (result.count > 0) {
          // Unassign if this photo was assigned as personal or business
          await prisma.user.updateMany({
            where: { id: userId, OR: [{ personalPhotoId: id }, { businessPhotoId: id }] },
            data: {
              personalPhotoId: null,
              businessPhotoId: null,
              // Backward compat URLs cleared only if they match the trashed photo urls is handled elsewhere
            },
          });
        }
        break;
      }

      case 'task': {
        // For tasks, check if user has access (created or assigned)
        const task = await prisma.task.findFirst({
          where: {
            id,
            trashedAt: null,
            OR: [
              { createdById: userId },
              { assignedToId: userId },
            ],
          },
        });

        if (!task) {
          return res.status(404).json({ message: 'Task not found or access denied' });
        }

        result = await prisma.task.updateMany({
          where: {
            id,
            trashedAt: null,
            OR: [
              { createdById: userId },
              { assignedToId: userId },
            ],
          },
          data: { trashedAt: new Date() },
        });
        break;
      }

      default:
        return res.status(400).json({ message: 'Invalid item type' });
    }

    if (result.count === 0) {
      return res.status(404).json({ message: 'Item not found or already trashed' });
    }

    res.json({ success: true, message: 'Item moved to trash' });
  } catch (error) {
    console.error('Error trashing item:', error);
    res.status(500).json({ message: 'Failed to trash item' });
  }
}

export async function restoreItem(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;

    // Try to restore from each table
    let result = await prisma.file.updateMany({
      where: { id, userId, trashedAt: { not: null } },
      data: { trashedAt: null },
    });

    if (result.count === 0) {
      result = await prisma.folder.updateMany({
        where: { id, userId, trashedAt: { not: null } },
        data: { trashedAt: null },
      });
    }

    if (result.count === 0) {
      result = await prisma.conversation.updateMany({
        where: { 
          id, 
          participants: {
            some: {
              userId: userId,
              isActive: true
            }
          },
          trashedAt: { not: null } 
        },
        data: { trashedAt: null },
      });
    }

    if (result.count === 0) {
      result = await prisma.dashboard.updateMany({
        where: { id, userId, trashedAt: { not: null } },
        data: { trashedAt: null },
      });
    }

    if (result.count === 0) {
      result = await prisma.message.updateMany({
        where: { 
          id,
          deletedAt: { not: null },
          OR: [
            { senderId: userId },
            {
              conversation: {
                participants: {
                  some: {
                    userId: userId,
                    isActive: true
                  }
                }
              }
            }
          ]
        },
        data: { deletedAt: null },
      });
    }

    if (result.count === 0) {
      result = await prisma.aIConversation.updateMany({
        where: { id, userId, trashedAt: { not: null } },
        data: { trashedAt: null },
      });
    }

    if (result.count === 0) {
      result = await prisma.event.updateMany({
        where: { 
          id,
          trashedAt: { not: null },
          calendar: {
            members: {
              some: {
                userId: userId,
                role: { in: ['OWNER', 'ADMIN', 'EDITOR'] }
              }
            }
          }
        },
        data: { trashedAt: null },
      });
    }

    if (result.count === 0) {
      result = await prisma.userProfilePhoto.updateMany({
        where: { id, userId, trashedAt: { not: null } },
        data: { trashedAt: null },
      });
    }

    if (result.count === 0) {
      return res.status(404).json({ message: 'Item not found in trash' });
    }

    res.json({ success: true, message: 'Item restored' });
  } catch (error) {
    console.error('Error restoring item:', error);
    res.status(500).json({ message: 'Failed to restore item' });
  }
}

export async function deleteItem(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const userId = (req.user as any).id || (req.user as any).sub;
    const { id } = req.params;

    // Try to delete from each table
    let result = await prisma.file.deleteMany({
      where: { id, userId, trashedAt: { not: null } },
    });

    if (result.count === 0) {
      result = await prisma.folder.deleteMany({
        where: { id, userId, trashedAt: { not: null } },
      });
    }

    if (result.count === 0) {
      result = await prisma.conversation.deleteMany({
        where: { 
          id, 
          participants: {
            some: {
              userId: userId,
              isActive: true
            }
          },
          trashedAt: { not: null } 
        },
      });
    }

    if (result.count === 0) {
      result = await prisma.dashboard.deleteMany({
        where: { id, userId, trashedAt: { not: null } },
      });
    }

    if (result.count === 0) {
      result = await prisma.message.deleteMany({
        where: { 
          id,
          deletedAt: { not: null },
          OR: [
            { senderId: userId },
            {
              conversation: {
                participants: {
                  some: {
                    userId: userId,
                    isActive: true
                  }
                }
              }
            }
          ]
        },
      });
    }

    if (result.count === 0) {
      result = await prisma.aIConversation.deleteMany({
        where: { id, userId, trashedAt: { not: null } },
      });
    }

    if (result.count === 0) {
      result = await prisma.event.deleteMany({
        where: { 
          id,
          trashedAt: { not: null },
          calendar: {
            members: {
              some: {
                userId: userId,
                role: { in: ['OWNER', 'ADMIN', 'EDITOR'] }
              }
            }
          }
        },
      });
    }

    if (result.count === 0) {
      result = await prisma.userProfilePhoto.deleteMany({
        where: { id, userId, trashedAt: { not: null } },
      });
    }

    if (result.count === 0) {
      return res.status(404).json({ message: 'Item not found in trash' });
    }

    res.json({ success: true, message: 'Item deleted permanently' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item' });
  }
}

export async function emptyTrash(req: Request, res: Response) {
  if (!hasUserId(req.user)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const userId = (req.user as any).id || (req.user as any).sub;

    // Delete all trashed items from all tables
    await Promise.all([
      prisma.file.deleteMany({
        where: { userId, trashedAt: { not: null } },
      }),
      prisma.folder.deleteMany({
        where: { userId, trashedAt: { not: null } },
      }),
      prisma.conversation.deleteMany({
        where: { 
          participants: {
            some: {
              userId: userId,
              isActive: true
            }
          },
          trashedAt: { not: null } 
        },
      }),
      prisma.dashboard.deleteMany({
        where: { userId, trashedAt: { not: null } },
      }),
      prisma.message.deleteMany({
        where: { 
          OR: [
            { senderId: userId },
            {
              conversation: {
                participants: {
                  some: {
                    userId: userId,
                    isActive: true
                  }
                }
              }
            }
          ],
          deletedAt: { not: null } 
        },
      }),
      prisma.aIConversation.deleteMany({
        where: { userId, trashedAt: { not: null } },
      }),
      prisma.event.deleteMany({
        where: { 
          trashedAt: { not: null },
          calendar: {
            members: {
              some: {
                userId: userId,
                role: { in: ['OWNER', 'ADMIN', 'EDITOR'] }
              }
            }
          }
        },
      }),
      prisma.userProfilePhoto.deleteMany({
        where: { userId, trashedAt: { not: null } },
      }),
    ]);

    res.json({ success: true, message: 'Trash emptied' });
  } catch (error) {
    console.error('Error emptying trash:', error);
    res.status(500).json({ message: 'Failed to empty trash' });
  }
} 