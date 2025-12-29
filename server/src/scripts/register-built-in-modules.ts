/**
 * REGISTER BUILT-IN MODULES
 * 
 * This script registers AI contexts for all built-in Vssyl modules.
 * Run this once after deploying the Module AI Context Registry system.
 * 
 * Usage:
 *   ts-node scripts/register-built-in-modules.ts
 * 
 * Or with environment variables:
 *   DATABASE_URL="postgresql://..." ts-node scripts/register-built-in-modules.ts
 */

import { PrismaClient } from '@prisma/client';
import type { ModuleAIContext } from 'shared/types/module-ai-context';

const prisma = new PrismaClient();

// ============================================================================
// AI CONTEXT DEFINITIONS FOR BUILT-IN MODULES
// ============================================================================

const DRIVE_AI_CONTEXT: ModuleAIContext = {
  purpose: "File storage, document management, and file sharing system for personal and collaborative use",
  category: "productivity",
  
  keywords: [
    "file", "files", "upload", "download", "document", "documents",
    "pdf", "image", "images", "photo", "photos", "video", "videos",
    "storage", "drive", "file hub", "folder", "folders", "archive", "attachment",
    "doc", "docx", "sheet", "spreadsheet", "presentation", "picture"
  ],
  
  patterns: [
    "show my files",
    "show my * files",
    "upload * to (drive|file hub)",
    "upload file*",
    "find files *",
    "find * files",
    "recent documents",
    "recent files",
    "shared files",
    "download *",
    "files from *",
    "documents about *",
    "search files *",
    "my storage",
    "how much storage"
  ],
  
  concepts: [
    "storage", "documents", "sharing", "collaboration", "organization",
    "folders", "archives", "attachments", "media", "downloads",
    "file management", "cloud storage", "document storage"
  ],
  
  entities: [
    {
      name: "file",
      pluralName: "files",
      description: "A digital file or document stored in the system"
    },
    {
      name: "folder",
      pluralName: "folders",
      description: "A container used to organize files hierarchically"
    }
  ],
  
  actions: [
    {
      name: "upload",
      description: "Upload a file to File Hub",
      permissions: ["drive:write"]
    },
    {
      name: "download",
      description: "Download a file from File Hub",
      permissions: ["drive:read"]
    },
    {
      name: "share",
      description: "Share a file with others",
      permissions: ["drive:share"]
    },
    {
      name: "delete",
      description: "Delete a file",
      permissions: ["drive:delete"]
    },
    {
      name: "search",
      description: "Search for files",
      permissions: ["drive:read"]
    }
  ],
  
  contextProviders: [
    {
      name: "recentFiles",
      endpoint: "/api/drive/ai/context/recent",
      cacheDuration: 900000, // 15 minutes
      description: "Get user's most recently accessed or modified files"
    },
    {
      name: "storageStats",
      endpoint: "/api/drive/ai/context/storage",
      cacheDuration: 3600000, // 1 hour
      description: "Get user's storage usage statistics"
    }
  ],
  
  queryableData: [
    {
      dataType: "fileCount",
      endpoint: "/api/drive/ai/query/count",
      description: "Get total number of files",
      parameters: { type: "all | folder | recent" }
    }
  ]
};

const CHAT_AI_CONTEXT: ModuleAIContext = {
  purpose: "Real-time messaging and communication system for conversations, group chats, and direct messages",
  category: "communication",
  
  keywords: [
    "message", "messages", "chat", "conversation", "conversations",
    "talk", "tell", "send", "reply", "dm", "direct message",
    "group chat", "channel", "messaging", "communicate", "text"
  ],
  
  patterns: [
    "send message *",
    "message *",
    "chat with *",
    "my messages",
    "my conversations",
    "recent messages",
    "unread messages",
    "what did * say",
    "messages from *",
    "reply to *",
    "start conversation *",
    "group chat *"
  ],
  
  concepts: [
    "messaging", "communication", "conversations", "real-time chat",
    "direct messaging", "group chat", "channels", "notifications",
    "threaded discussions", "chat history"
  ],
  
  entities: [
    {
      name: "message",
      pluralName: "messages",
      description: "A text message or communication sent to another user"
    },
    {
      name: "conversation",
      pluralName: "conversations",
      description: "A thread of messages between one or more users"
    },
    {
      name: "channel",
      pluralName: "channels",
      description: "A dedicated space for group conversations on specific topics"
    }
  ],
  
  actions: [
    {
      name: "send",
      description: "Send a message",
      permissions: ["chat:send"]
    },
    {
      name: "read",
      description: "Read messages",
      permissions: ["chat:read"]
    },
    {
      name: "create-conversation",
      description: "Start a new conversation",
      permissions: ["chat:create"]
    },
    {
      name: "search",
      description: "Search messages",
      permissions: ["chat:read"]
    }
  ],
  
  contextProviders: [
    {
      name: "recentConversations",
      endpoint: "/api/chat/ai/context/recent",
      cacheDuration: 300000, // 5 minutes (more real-time)
      description: "Get user's recent active conversations"
    },
    {
      name: "unreadMessages",
      endpoint: "/api/chat/ai/context/unread",
      cacheDuration: 60000, // 1 minute (very real-time)
      description: "Get count and preview of unread messages"
    }
  ],
  
  queryableData: [
    {
      dataType: "conversationHistory",
      endpoint: "/api/chat/ai/query/history",
      description: "Get message history for a conversation",
      parameters: { conversationId: "string", limit: "number" }
    }
  ],
  
  relationships: [
    {
      module: "drive",
      type: "integrates",
      description: "Files can be shared directly in chat messages"
    }
  ]
};

const CALENDAR_AI_CONTEXT: ModuleAIContext = {
  purpose: "Calendar and scheduling system for managing events, meetings, appointments, and time management",
  category: "productivity",
  
  keywords: [
    "calendar", "event", "events", "meeting", "meetings", "appointment",
    "appointments", "schedule", "scheduled", "reminder", "reminders",
    "availability", "busy", "free", "time", "date", "today", "tomorrow",
    "this week", "next week", "upcoming"
  ],
  
  patterns: [
    "what's on my calendar",
    "my schedule *",
    "schedule *",
    "meetings today",
    "meetings * week",
    "events today",
    "upcoming events",
    "when is *",
    "am I free *",
    "what time is *",
    "add event *",
    "create meeting *",
    "cancel meeting *",
    "reschedule *"
  ],
  
  concepts: [
    "scheduling", "time management", "appointments", "meetings",
    "availability", "calendaring", "reminders", "recurring events",
    "time blocking", "busy times", "free time"
  ],
  
  entities: [
    {
      name: "event",
      pluralName: "events",
      description: "A scheduled occurrence on the calendar with date, time, and details"
    },
    {
      name: "meeting",
      pluralName: "meetings",
      description: "A scheduled gathering or appointment with one or more participants"
    },
    {
      name: "reminder",
      pluralName: "reminders",
      description: "A notification to alert about an upcoming event"
    }
  ],
  
  actions: [
    {
      name: "create",
      description: "Create a new event",
      permissions: ["calendar:write"]
    },
    {
      name: "update",
      description: "Update an existing event",
      permissions: ["calendar:write"]
    },
    {
      name: "delete",
      description: "Delete an event",
      permissions: ["calendar:delete"]
    },
    {
      name: "view",
      description: "View calendar events",
      permissions: ["calendar:read"]
    }
  ],
  
  contextProviders: [
    {
      name: "upcomingEvents",
      endpoint: "/api/calendar/ai/context/upcoming",
      cacheDuration: 300000, // 5 minutes
      description: "Get upcoming events for the next 7 days"
    },
    {
      name: "todaySchedule",
      endpoint: "/api/calendar/ai/context/today",
      cacheDuration: 300000, // 5 minutes
      description: "Get today's complete schedule"
    }
  ],
  
  queryableData: [
    {
      dataType: "availability",
      endpoint: "/api/calendar/ai/query/availability",
      description: "Check user's availability for a time range",
      parameters: { startTime: "ISO8601", endTime: "ISO8601" }
    }
  ]
};

const HOUSEHOLD_AI_CONTEXT: ModuleAIContext = {
  purpose: "Household management system for tasks, chores, shopping lists, and family coordination",
  category: "household",
  
  keywords: [
    "task", "tasks", "todo", "to-do", "chore", "chores",
    "shopping", "shopping list", "groceries", "household",
    "family", "home", "list", "lists", "reminder", "reminders",
    "assign", "complete", "done"
  ],
  
  patterns: [
    "my tasks",
    "my to-do*",
    "household tasks",
    "add task *",
    "create task *",
    "complete task *",
    "mark * done",
    "shopping list",
    "add to shopping list *",
    "family tasks",
    "chores for *",
    "who needs to *",
    "what needs to be done"
  ],
  
  concepts: [
    "task management", "household coordination", "chores",
    "shopping lists", "family organization", "reminders",
    "assignments", "responsibilities", "home management"
  ],
  
  entities: [
    {
      name: "task",
      pluralName: "tasks",
      description: "A household task or chore that needs to be completed"
    },
    {
      name: "shopping-list",
      pluralName: "shopping-lists",
      description: "A list of items to purchase"
    },
    {
      name: "household",
      pluralName: "households",
      description: "A group of family members or roommates sharing responsibilities"
    }
  ],
  
  actions: [
    {
      name: "create-task",
      description: "Create a new household task",
      permissions: ["household:write"]
    },
    {
      name: "complete-task",
      description: "Mark a task as complete",
      permissions: ["household:write"]
    },
    {
      name: "assign-task",
      description: "Assign a task to a household member",
      permissions: ["household:assign"]
    }
  ],
  
  contextProviders: [
    {
      name: "activeTasks",
      endpoint: "/api/household/ai/context/tasks",
      cacheDuration: 600000, // 10 minutes
      description: "Get active tasks for the user and their household"
    }
  ]
};

const BUSINESS_AI_CONTEXT: ModuleAIContext = {
  purpose: "Business workspace management for projects, teams, collaboration, and business operations",
  category: "business",
  
  keywords: [
    "project", "projects", "team", "teams", "business", "work",
    "workspace", "collaboration", "assign", "deadline", "milestone",
    "task", "client", "clients", "report", "reports", "analytics"
  ],
  
  patterns: [
    "my projects",
    "project *",
    "team projects",
    "business tasks",
    "work assignments",
    "project status *",
    "team members *",
    "client *",
    "business analytics",
    "project deadline*"
  ],
  
  concepts: [
    "project management", "team collaboration", "business operations",
    "client management", "deadlines", "milestones", "business analytics",
    "workplace productivity", "team coordination"
  ],
  
  entities: [
    {
      name: "project",
      pluralName: "projects",
      description: "A business project with goals, tasks, and team members"
    },
    {
      name: "team",
      pluralName: "teams",
      description: "A group of people working together on business objectives"
    },
    {
      name: "client",
      pluralName: "clients",
      description: "A business client or customer"
    }
  ],
  
  actions: [
    {
      name: "create-project",
      description: "Create a new business project",
      permissions: ["business:project:create"]
    },
    {
      name: "assign",
      description: "Assign work to team members",
      permissions: ["business:assign"]
    },
    {
      name: "view-analytics",
      description: "View business analytics",
      permissions: ["business:analytics"]
    }
  ],
  
  contextProviders: [
    {
      name: "activeProjects",
      endpoint: "/api/business/ai/context/projects",
      cacheDuration: 900000, // 15 minutes
      description: "Get user's active business projects"
    }
  ]
};

// ============================================================================
// REGISTRATION FUNCTION
// ============================================================================

async function registerModuleContext(
  moduleId: string,
  moduleName: string,
  aiContext: ModuleAIContext
) {
  try {
    console.log(`\n📝 Registering: ${moduleName}...`);
    
    // Check if module exists in modules table
    const module = await prisma.module.findUnique({
      where: { id: moduleId }
    });
    
    if (!module) {
      console.log(`⚠️  Warning: Module '${moduleId}' not found in modules table. Creating entry...`);
      // For built-in modules, we might need to create a basic entry
      // In production, these should already exist
    }
    
    // Check if AI context already exists
    const existing = await prisma.moduleAIContextRegistry.findUnique({
      where: { moduleId }
    });
    
    if (existing) {
      console.log(`   Updating existing entry...`);
      await prisma.moduleAIContextRegistry.update({
        where: { moduleId },
        data: {
          moduleName,
          purpose: aiContext.purpose,
          category: aiContext.category,
          keywords: aiContext.keywords,
          patterns: aiContext.patterns,
          concepts: aiContext.concepts,
          entities: aiContext.entities as any,
          actions: aiContext.actions as any,
          contextProviders: aiContext.contextProviders as any,
          queryableData: aiContext.queryableData as any,
          relationships: aiContext.relationships as any,
          fullAIContext: aiContext as any,
          lastUpdated: new Date()
        }
      });
      console.log(`✅ Updated: ${moduleName}`);
    } else {
      console.log(`   Creating new entry...`);
      await prisma.moduleAIContextRegistry.create({
        data: {
          moduleId,
          moduleName,
          purpose: aiContext.purpose,
          category: aiContext.category,
          keywords: aiContext.keywords,
          patterns: aiContext.patterns,
          concepts: aiContext.concepts,
          entities: aiContext.entities as any,
          actions: aiContext.actions as any,
          contextProviders: aiContext.contextProviders as any,
          queryableData: aiContext.queryableData as any,
          relationships: aiContext.relationships as any,
          fullAIContext: aiContext as any
        }
      });
      console.log(`✅ Created: ${moduleName}`);
    }
    
    // Log summary
    console.log(`   Keywords: ${aiContext.keywords.length}`);
    console.log(`   Patterns: ${aiContext.patterns.length}`);
    console.log(`   Context Providers: ${aiContext.contextProviders.length}`);
    
  } catch (error) {
    console.error(`❌ Error registering ${moduleName}:`, error);
    throw error;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🤖 ============================================');
  console.log('🤖 VSSYL - Built-in Module Registration');
  console.log('🤖 ============================================\n');
  
  console.log('📊 This script will register AI contexts for:');
  console.log('   • File Hub');
  console.log('   • Chat');
  console.log('   • Calendar');
  console.log('   • Household');
  console.log('   • Business\n');
  
  try {
    // Register all built-in modules
    await registerModuleContext('drive', 'File Hub', DRIVE_AI_CONTEXT);
    await registerModuleContext('chat', 'Chat', CHAT_AI_CONTEXT);
    await registerModuleContext('calendar', 'Calendar', CALENDAR_AI_CONTEXT);
    await registerModuleContext('household', 'Household', HOUSEHOLD_AI_CONTEXT);
    await registerModuleContext('business', 'Business', BUSINESS_AI_CONTEXT);
    
    console.log('\n✅ ============================================');
    console.log('✅ All built-in modules registered successfully!');
    console.log('✅ ============================================\n');
    
    // Show summary
    const registryCount = await prisma.moduleAIContextRegistry.count();
    console.log(`📊 Total modules in AI registry: ${registryCount}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Check the admin portal: /admin-portal/ai-learning → Module Analytics');
    console.log('   2. Build context provider endpoints for each module');
    console.log('   3. Test AI queries to verify module detection works\n');
    
  } catch (error) {
    console.error('\n❌ Registration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();

