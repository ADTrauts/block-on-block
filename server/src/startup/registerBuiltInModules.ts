/**
 * STARTUP MODULE REGISTRATION
 * 
 * This module runs automatically when the server starts.
 * It checks if the Module AI Context Registry is empty and registers
 * built-in modules if needed.
 * 
 * This is the PROPER way to handle registration because:
 * - Server has full database access
 * - Runs in production environment
 * - Non-blocking (doesn't prevent server startup)
 * - Can retry on server restart
 */

import { PrismaClient } from '@prisma/client';
import type { ModuleAIContext } from '../../../shared/src/types/module-ai-context';
import { prisma } from '../lib/prisma';

// ============================================================================
// BUILT-IN MODULE AI CONTEXTS
// ============================================================================

const BUILT_IN_MODULES: Array<{ moduleId: string; moduleName: string; aiContext: ModuleAIContext }> = [
  {
    moduleId: 'drive',
    moduleName: 'File Hub',
    aiContext: {
      purpose: 'File and folder storage with organization, sharing, and versioning capabilities',
      category: 'PRODUCTIVITY',
      keywords: ['file', 'folder', 'document', 'storage', 'drive', 'file hub', 'upload', 'download', 'share', 'organize'],
      patterns: [
        'files? (in|from|on) (my )?(drive|file hub)',
        'folders? (in|from|on) (my )?(drive|file hub)',
        'upload (a |the )?file',
        'create (a )?folder',
        'share (this |the )?file',
        'storage space',
        'recent (files?|documents?)',
      ],
      concepts: ['file management', 'cloud storage', 'document organization', 'sharing', 'collaboration'],
      entities: [
        { name: 'File', pluralName: 'Files', description: 'A file stored in File Hub' },
        { name: 'Folder', pluralName: 'Folders', description: 'A folder for organizing files' },
        { name: 'File Hub', pluralName: 'File Hubs', description: 'Cloud storage space' },
      ],
      actions: [
        { name: 'create_folder', description: 'Create a new folder', permissions: ['drive:write'] },
        { name: 'upload_file', description: 'Upload a file to File Hub', permissions: ['drive:write'] },
        { name: 'download_file', description: 'Download a file from File Hub', permissions: ['drive:read'] },
        { name: 'share_file', description: 'Share a file with others', permissions: ['drive:write', 'drive:share'] },
        { name: 'delete_file', description: 'Delete a file or folder', permissions: ['drive:delete'] },
      ],
      contextProviders: [
        {
          name: 'recent_files',
          description: 'Get user\'s recently accessed or modified files',
          endpoint: '/api/drive/ai/context/recent',
          cacheDuration: 300000, // 5 minutes
        },
        {
          name: 'storage_overview',
          description: 'Get storage usage and quota information',
          endpoint: '/api/drive/ai/context/storage',
          cacheDuration: 900000, // 15 minutes
        },
        {
          name: 'file_count',
          description: 'Query file and folder counts',
          endpoint: '/api/drive/ai/query/count',
          cacheDuration: 600000, // 10 minutes
        },
      ],
    },
  },
  {
    moduleId: 'chat',
    moduleName: 'Chat',
    aiContext: {
      purpose: 'Real-time messaging and communication between users',
      category: 'COMMUNICATION',
      keywords: ['message', 'chat', 'conversation', 'talk', 'send', 'reply', 'unread'],
      patterns: [
        'messages?',
        'chats?',
        'conversations?',
        'unread messages?',
        'send (a )?message',
        'talk to',
        'contact',
      ],
      concepts: ['messaging', 'communication', 'conversations', 'real-time chat'],
      entities: [
        { name: 'Message', pluralName: 'Messages', description: 'A chat message' },
        { name: 'Conversation', pluralName: 'Conversations', description: 'A chat conversation thread' },
        { name: 'Chat', pluralName: 'Chats', description: 'Real-time messaging system' },
      ],
      actions: [
        { name: 'send_message', description: 'Send a message to a user', permissions: ['chat:write'] },
        { name: 'read_messages', description: 'Read chat messages', permissions: ['chat:read'] },
        { name: 'start_conversation', description: 'Start a new conversation', permissions: ['chat:write'] },
      ],
      contextProviders: [
        {
          name: 'recent_conversations',
          description: 'Get user\'s recent chat conversations',
          endpoint: '/api/chat/ai/context/recent',
          cacheDuration: 120000, // 2 minutes
        },
        {
          name: 'unread_messages',
          description: 'Get count and preview of unread messages',
          endpoint: '/api/chat/ai/context/unread',
          cacheDuration: 60000, // 1 minute
        },
        {
          name: 'conversation_history',
          description: 'Query conversation history with a specific user',
          endpoint: '/api/chat/ai/query/history',
          cacheDuration: 300000, // 5 minutes
        },
      ],
    },
  },
  {
    moduleId: 'calendar',
    moduleName: 'Calendar',
    aiContext: {
      purpose: 'Event scheduling and calendar management',
      category: 'PRODUCTIVITY',
      keywords: ['event', 'calendar', 'meeting', 'appointment', 'schedule', 'availability', 'busy', 'free'],
      patterns: [
        'events?',
        'meetings?',
        'appointments?',
        'calendar',
        'schedule',
        'availability',
        'free time',
        'busy',
        'today',
        'tomorrow',
        'this week',
      ],
      concepts: ['time management', 'scheduling', 'event planning', 'availability'],
      entities: [
        { name: 'Event', pluralName: 'Events', description: 'A calendar event' },
        { name: 'Meeting', pluralName: 'Meetings', description: 'A scheduled meeting' },
        { name: 'Appointment', pluralName: 'Appointments', description: 'A scheduled appointment' },
      ],
      actions: [
        { name: 'create_event', description: 'Create a calendar event', permissions: ['calendar:write'] },
        { name: 'schedule_meeting', description: 'Schedule a meeting', permissions: ['calendar:write'] },
        { name: 'check_availability', description: 'Check user availability', permissions: ['calendar:read'] },
        { name: 'cancel_event', description: 'Cancel an event', permissions: ['calendar:write'] },
      ],
      contextProviders: [
        {
          name: 'upcoming_events',
          description: 'Get user\'s upcoming calendar events',
          endpoint: '/api/calendar/ai/context/upcoming',
          cacheDuration: 300000, // 5 minutes
        },
        {
          name: 'today_events',
          description: 'Get events scheduled for today',
          endpoint: '/api/calendar/ai/context/today',
          cacheDuration: 900000, // 15 minutes
        },
        {
          name: 'availability',
          description: 'Check user availability for a given time period',
          endpoint: '/api/calendar/ai/query/availability',
          cacheDuration: 600000, // 10 minutes
        },
      ],
    },
  },
  {
    moduleId: 'hr',
    moduleName: 'HR Management',
    aiContext: {
      purpose: 'Human resources management system for employee lifecycle, attendance, payroll, and performance management',
      category: 'BUSINESS',
      keywords: [
        'hr', 'human resources', 'employee', 'staff', 'team member', 'personnel',
        'hire', 'firing', 'onboard', 'offboard', 'terminate', 'resignation',
        'attendance', 'time off', 'pto', 'vacation', 'sick leave', 'holiday',
        'payroll', 'salary', 'compensation', 'pay', 'wage', 'bonus',
        'performance', 'review', 'evaluation', 'feedback', 'goal',
        'recruitment', 'hiring', 'applicant', 'candidate', 'interview', 'job posting',
        'benefits', 'insurance', 'enrollment', '401k', 'retirement'
      ],
      patterns: [
        'hr (system|module|dashboard)',
        'employee (list|directory|database)',
        'how many employees',
        'who (is off|works) (today|tomorrow|this week)',
        'time off (request|balance|approval)',
        'pending (time off|approvals)',
        'payroll (run|report|processing)',
        'performance reviews? due',
        'upcoming reviews?',
        'open positions',
        'recruitment pipeline'
      ],
      concepts: [
        'employee lifecycle management',
        'human capital management',
        'workforce administration',
        'performance management',
        'compensation and benefits'
      ],
      entities: [
        { 
          name: 'Employee', 
          pluralName: 'Employees', 
          description: 'A business employee with HR profile data' 
        },
        { 
          name: 'TimeOffRequest', 
          pluralName: 'TimeOffRequests', 
          description: 'Employee time-off request' 
        },
        { 
          name: 'PerformanceReview', 
          pluralName: 'PerformanceReviews', 
          description: 'Employee performance evaluation' 
        },
      ],
      actions: [
        { 
          name: 'view_hr_dashboard', 
          description: 'View HR management dashboard', 
          permissions: ['hr:admin'] 
        },
        { 
          name: 'manage_employees', 
          description: 'Add, edit, or remove employees', 
          permissions: ['hr:employees:write'] 
        },
        { 
          name: 'view_team', 
          description: 'View team member HR data', 
          permissions: ['hr:team:view'] 
        },
        { 
          name: 'approve_time_off', 
          description: 'Approve or deny time off requests', 
          permissions: ['hr:team:approve'] 
        },
        { 
          name: 'view_own_data', 
          description: 'View own employee HR data', 
          permissions: ['hr:self:view'] 
        },
      ],
      contextProviders: [
        {
          name: 'hr_overview',
          description: 'Get HR system overview and statistics',
          endpoint: '/api/hr/ai/context/overview',
          cacheDuration: 300000, // 5 minutes
        },
        {
          name: 'employee_count',
          description: 'Get employee headcount by department/position',
          endpoint: '/api/hr/ai/context/headcount',
          cacheDuration: 600000, // 10 minutes
        },
        {
          name: 'time_off_summary',
          description: 'Get time-off summary (who\'s off today/this week)',
          endpoint: '/api/hr/ai/context/time-off',
          cacheDuration: 300000, // 5 minutes
        },
      ],
    },
  },
  {
    moduleId: 'scheduling',
    moduleName: 'Employee Scheduling',
    aiContext: {
      purpose: 'Employee shift scheduling and workforce planning for businesses',
      category: 'BUSINESS',
      keywords: [
        'schedule', 'shift', 'roster', 'staffing', 'coverage', 'rotation',
        'work schedule', 'shift schedule', 'employee schedule', 'team schedule',
        'swap shift', 'trade shift', 'open shift', 'availability',
        'on shift', 'off shift', 'scheduled', 'rostered'
      ],
      patterns: [
        'scheduling? (system|module|dashboard)',
        'who (is|works) (scheduled|on shift) (today|tomorrow|this week)',
        'my schedule',
        'create (a )?schedule',
        'publish schedule',
        'shift (swap|trade|coverage)',
        'open shifts?',
        'set (my )?availability',
        'schedule conflict',
        'coverage report'
      ],
      concepts: [
        'shift planning',
        'workforce scheduling',
        'labor management',
        'shift optimization',
        'coverage planning'
      ],
      entities: [
        { 
          name: 'Schedule', 
          pluralName: 'Schedules', 
          description: 'A work schedule containing employee shifts' 
        },
        { 
          name: 'Shift', 
          pluralName: 'Shifts', 
          description: 'A scheduled work shift for an employee' 
        },
        { 
          name: 'ShiftSwap', 
          pluralName: 'ShiftSwaps', 
          description: 'A request to swap shifts between employees' 
        },
      ],
      actions: [
        { 
          name: 'view_schedules', 
          description: 'View work schedules', 
          permissions: ['scheduling:admin'] 
        },
        { 
          name: 'create_schedule', 
          description: 'Create a new work schedule', 
          permissions: ['scheduling:schedules:write'] 
        },
        { 
          name: 'publish_schedule', 
          description: 'Publish a schedule to employees', 
          permissions: ['scheduling:schedules:publish'] 
        },
        { 
          name: 'assign_shift', 
          description: 'Assign an employee to a shift', 
          permissions: ['scheduling:schedules:write'] 
        },
        { 
          name: 'swap_shift', 
          description: 'Request or approve shift swaps', 
          permissions: ['scheduling:swaps:request'] 
        },
        { 
          name: 'set_availability', 
          description: 'Set employee availability preferences', 
          permissions: ['scheduling:availability:manage'] 
        },
        { 
          name: 'claim_open_shift', 
          description: 'Claim an available open shift', 
          permissions: ['scheduling:shifts:claim'] 
        },
        { 
          name: 'generate_schedule', 
          description: 'AI-powered automatic schedule generation using philosophy engine', 
          permissions: ['scheduling:schedules:write']
        },
        { 
          name: 'suggest_assignments', 
          description: 'Get AI suggestions for shift assignments based on availability and strategy', 
          permissions: ['scheduling:schedules:write']
        },
      ],
      contextProviders: [
        {
          name: 'scheduling_overview',
          description: 'Get scheduling system overview and statistics',
          endpoint: '/api/scheduling/ai/context/overview',
          cacheDuration: 300000, // 5 minutes
        },
        {
          name: 'coverage_status',
          description: 'Get current and upcoming coverage status',
          endpoint: '/api/scheduling/ai/context/coverage',
          cacheDuration: 600000, // 10 minutes
        },
        {
          name: 'scheduling_conflicts',
          description: 'Get scheduling conflicts and gaps',
          endpoint: '/api/scheduling/ai/context/conflicts',
          cacheDuration: 300000, // 5 minutes
        },
      ],
    },
  },
  {
    moduleId: 'todo',
    moduleName: 'To-Do',
    aiContext: {
      purpose: 'Task and to-do management with AI-powered prioritization and scheduling',
      category: 'PRODUCTIVITY',
      keywords: [
        'task', 'todo', 'to-do', 'item', 'action', 'reminder',
        'deadline', 'due date', 'priority', 'urgent', 'important',
        'complete', 'done', 'finished', 'pending', 'in progress',
        'assign', 'assigned', 'my tasks', 'tasks due'
      ],
      patterns: [
        'show (my )?tasks',
        'what (tasks|todos) (do I have|are due) (today|tomorrow|this week)',
        'create (a )?task',
        'complete (the )?task',
        'tasks? (assigned to|for) (me|user)',
        'overdue tasks?',
        'high priority tasks?',
        'what (should I|can I) work on',
        'tasks? due (today|tomorrow|this week)'
      ],
      concepts: [
        'task management',
        'to-do lists',
        'task prioritization',
        'deadline management',
        'task assignment',
        'productivity tracking'
      ],
      entities: [
        { name: 'Task', pluralName: 'Tasks', description: 'A to-do item or task' },
        { name: 'Todo', pluralName: 'Todos', description: 'A task or to-do item' },
        { name: 'Subtask', pluralName: 'Subtasks', description: 'A sub-task within a parent task' },
        { name: 'Project', pluralName: 'Projects', description: 'A group of related tasks' }
      ],
      actions: [
        { name: 'create_task', description: 'Create a new task', permissions: ['todo:write'] },
        { name: 'complete_task', description: 'Mark a task as complete', permissions: ['todo:write'] },
        { name: 'list_tasks', description: 'List user tasks', permissions: ['todo:read'] },
        { name: 'assign_task', description: 'Assign a task to a user', permissions: ['todo:assign'] },
        { name: 'prioritize_tasks', description: 'Get AI-powered task prioritization', permissions: ['todo:read'] }
      ],
      contextProviders: [
        {
          name: 'task_overview',
          description: 'Get overview of user tasks (counts, status breakdown)',
          endpoint: '/api/todo/ai/context/overview',
          cacheDuration: 300000, // 5 minutes
        },
        {
          name: 'upcoming_tasks',
          description: 'Get upcoming tasks due soon',
          endpoint: '/api/todo/ai/context/upcoming',
          cacheDuration: 300000, // 5 minutes
        },
        {
          name: 'overdue_tasks',
          description: 'Get overdue tasks',
          endpoint: '/api/todo/ai/context/overdue',
          cacheDuration: 120000, // 2 minutes
        },
        {
          name: 'priority_tasks',
          description: 'Get high priority tasks',
          endpoint: '/api/todo/ai/context/priority',
          cacheDuration: 300000, // 5 minutes
        },
      ],
    },
  },
];

// ============================================================================
// REGISTRATION LOGIC
// ============================================================================

/**
 * Register a single module's AI context
 */
async function registerModule(moduleId: string, moduleName: string, aiContext: ModuleAIContext): Promise<boolean> {
  try {
    console.log(`   📝 Registering: ${moduleName}...`);

    // Check if module exists in the modules table
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      console.log(`   ⚠️  Module '${moduleId}' not found in database, skipping...`);
      return false;
    }

    // Check if already registered
    const existing = await prisma.moduleAIContextRegistry.findUnique({
      where: { moduleId },
    });

    if (existing) {
      console.log(`   ✅ ${moduleName} already registered`);
      return true;
    }

    // Register the module
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
        relationships: (aiContext.relationships || []) as any,
        fullAIContext: aiContext as any,
        version: '1.0.0',
      },
    });

    console.log(`   ✅ ${moduleName} registered successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error registering ${moduleName}:`, error);
    return false;
  }
}

/**
 * Main function - checks and registers built-in modules
 * This is called during server startup
 */
export async function registerBuiltInModulesOnStartup(): Promise<void> {
  try {
    console.log('\n🤖 ============================================');
    console.log('🤖 Module AI Context Registry - Startup Check');
    console.log('🤖 ============================================\n');

    // Check if registry is empty
    let registryCount: number;
    try {
      registryCount = await prisma.moduleAIContextRegistry.count();
    } catch (dbError) {
      // Database might not be available during startup
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
      if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
        console.log('⚠️  Database not available during startup');
        console.log('   Module registration will be skipped');
        console.log('   You can manually trigger registration via: POST /api/admin/modules/ai/register-built-ins\n');
        return;
      }
      // Re-throw if it's a different database error
      throw dbError;
    }

    if (registryCount > 0) {
      console.log(`✅ Registry already populated (${registryCount} modules registered)`);
      console.log('   Skipping built-in module registration\n');
      return;
    }

    console.log('📦 Registry is empty, registering built-in modules...\n');

    // Register each built-in module
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const { moduleId, moduleName, aiContext } of BUILT_IN_MODULES) {
      try {
        const success = await registerModule(moduleId, moduleName, aiContext);
        if (success) {
          successCount++;
        } else {
          // Check if it was skipped (module doesn't exist) or error
          try {
            const moduleExists = await prisma.module.findUnique({ where: { id: moduleId } });
            if (!moduleExists) {
              skipCount++;
            } else {
              errorCount++;
            }
          } catch (dbError) {
            // Database connection lost during registration
            const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
            if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
              console.log('\n⚠️  Database connection lost during registration');
              console.log('   Partial registration completed');
              console.log(`   ✅ Registered: ${successCount}`);
              console.log(`   ⚠️  Skipped: ${skipCount}`);
              console.log('   You can manually trigger registration via: POST /api/admin/modules/ai/register-built-ins\n');
              return;
            }
            throw dbError;
          }
        }
      } catch (dbError) {
        // Database connection lost during registration
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        if (errorMessage.includes("Can't reach database") || errorMessage.includes('localhost:5432')) {
          console.log('\n⚠️  Database connection lost during registration');
          console.log('   Partial registration completed');
          console.log(`   ✅ Registered: ${successCount}`);
          console.log(`   ⚠️  Skipped: ${skipCount}`);
          console.log('   You can manually trigger registration via: POST /api/admin/modules/ai/register-built-ins\n');
          return;
        }
        throw dbError;
      }
    }

    console.log('\n📊 Registration Summary:');
    console.log(`   ✅ Registered: ${successCount}`);
    if (skipCount > 0) console.log(`   ⚠️  Skipped: ${skipCount} (modules not found in database)`);
    if (errorCount > 0) console.log(`   ❌ Errors: ${errorCount}`);
    console.log('');

    if (successCount > 0) {
      console.log('✅ Built-in modules registered successfully!');
      console.log('   AI can now access File Hub, Chat, and Calendar context.\n');
    } else {
      console.warn('⚠️  No modules were registered. Check database for module entries.\n');
    }
  } catch (error) {
    console.error('❌ Error during module registration startup:');
    console.error(error);
    console.error('\nServer will continue running, but AI may have limited context.');
    console.error('You can manually trigger registration via: POST /api/admin/modules/ai/register-built-ins\n');
  }
}

/**
 * Cleanup function (called when server shuts down)
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

