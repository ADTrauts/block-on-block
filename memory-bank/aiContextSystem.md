# AI Context System - Vssyl Platform

## Overview

The AI Context System is a **mandatory component** of every module in the Vssyl platform. It enables the AI assistant to understand and answer natural language questions about module-specific data, creating an intelligent, conversational interface for users.

**Critical Rule**: Every module MUST implement AI context providers. This is not optional - it's a core platform requirement that enables the AI to be truly useful.

> 📖 **For a complete visual architecture guide**, see: [`docs/guides/AI_CONTEXT_SYSTEM_ARCHITECTURE.md`](../../docs/guides/AI_CONTEXT_SYSTEM_ARCHITECTURE.md)

## Quick Reference: Common Questions

### Q: How do context files work for the AI system?
**A**: Each module registers its AI context in the `ModuleAIContextRegistry` database table (not separate files). This includes:
- **Keywords**: Terms the AI uses to match queries ("file", "upload", "document")
- **Patterns**: Query patterns ("show my files", "upload * to drive")
- **Context Providers**: API endpoints that return live data (`/api/drive/ai/context/recent`)

### Q: How do we create a knowledge base for the AI system?
**A**: The knowledge base is the **central PostgreSQL database**:
- All module data (files, employees, schedules) stored in database tables
- `ModuleAIContextRegistry` stores module AI definitions
- `UserAIContextCache` caches context for performance (15-minute TTL)
- `AILearningEvent` tracks user-specific learning
- `GlobalLearningEvent` tracks cross-user patterns

### Q: Does each user have a central database?
**A**: Yes! All users share the **same PostgreSQL database**, but data is isolated by:
- `userId` in all queries (multi-tenant scoping)
- `businessId` for business-scoped data
- `dashboardId` for dashboard-scoped data
- Each user has their own `UserAIContextCache` entry

### Q: Does each module have memory?
**A**: No - there's a **centralized learning system**:
- All learning stored in `AILearningEvent` table
- Each event tagged with `sourceModule` (which module it came from)
- Cross-user patterns in `GlobalLearningEvent`
- No separate per-module memory stores

### Q: How does AI know about new files in Drive?
**A**: AI queries the database **directly in real-time**:
1. File uploaded → stored in `File` table
2. User asks "show my files"
3. AI calls `/api/drive/ai/context/recent`
4. Controller queries: `prisma.file.findMany({ where: { userId } })`
5. Database returns ALL files (including new ones)
6. AI responds with current data

**No notification system needed** - AI always queries fresh data!

### Q: Can @mentions help the AI work less hard?
**A**: Yes! Users can add `@mentions` to directly target modules:
- `@drive show my files` → Skips keyword matching, directly queries Drive
- `@hr how many employees?` → Directly targets HR module
- `@calendar what's today?` → Directly targets Calendar module

**Performance Benefits**:
- ⚡ **45ms faster** (skips keyword matching)
- 🎯 **100% confidence** (explicit module targeting)
- ✅ **More accurate** (no ambiguity)

**Supported @mentions**: `@drive`, `@files`, `@chat`, `@messages`, `@calendar`, `@events`, `@hr`, `@employees`, `@scheduling`, `@shifts`

---

## Why AI Context is Mandatory

### The Problem Without AI Context
Without AI context, the AI assistant:
- ❌ Cannot answer questions about module data ("How many employees do we have?")
- ❌ Cannot provide insights or summaries
- ❌ Cannot help users discover features or understand their data
- ❌ Becomes just a generic chatbot instead of an intelligent business assistant

### The Solution With AI Context
With AI context, the AI assistant:
- ✅ Answers natural language questions about real business data
- ✅ Provides actionable insights and summaries
- ✅ Helps users understand patterns and trends
- ✅ Creates a cohesive, intelligent experience across all modules

### Business Value
- **Accessibility**: Non-technical users can ask questions in plain English
- **Discovery**: Users learn what's possible by asking questions
- **Efficiency**: Instant answers without navigating complex UIs
- **Intelligence**: The platform feels smart and integrated
- **Competitive Advantage**: Most SaaS platforms don't have this level of AI integration

---

## Architecture

### How It Works

```mermaid
graph TD
    User[User asks question] --> AI[AI Assistant]
    AI --> Router[AI Router]
    Router --> Context[Context Engine]
    Context --> Provider1[Drive Context]
    Context --> Provider2[HR Context]
    Context --> Provider3[Calendar Context]
    Context --> ProviderN[Other Modules...]
    
    Provider1 --> API1[/api/drive/ai/context/*]
    Provider2 --> API2[/api/hr/ai/context/*]
    Provider3 --> API3[/api/calendar/ai/context/*]
    
    API1 --> DB[(Database)]
    API2 --> DB
    API3 --> DB
    
    DB --> API1
    API2 --> Context
    API3 --> Context
    Context --> AI
    AI --> Response[Intelligent Answer]
```

### Three-Layer System

1. **Registration Layer** (`registerBuiltInModules.ts`)
   - Declares what context a module provides
   - Defines keywords, patterns, and entities
   - Maps context providers to endpoints

2. **Controller Layer** (`*AIContextController.ts`)
   - Implements context provider endpoints
   - Queries database for relevant data
   - Returns structured, AI-consumable responses

3. **Consumption Layer** (AI Engine)
   - Analyzes user questions
   - Determines which context providers to call
   - Synthesizes responses from multiple modules

---

## Implementation Pattern

### 1. Module Registration

Every module must register its AI context in `server/src/startup/registerBuiltInModules.ts`:

```typescript
{
  moduleId: 'hr',
  moduleName: 'HR Management',
  aiContext: {
    keywords: ['employee', 'staff', 'team', 'workforce', 'headcount', 'time off', 'attendance'],
    patterns: [
      'how many employees',
      'who is off today',
      'show me the team',
      'attendance summary'
    ],
    entities: ['employee', 'department', 'position', 'time-off request'],
    actions: ['count employees', 'check availability', 'view attendance'],
    contextProviders: [
      {
        name: 'hr_overview',
        description: 'General HR statistics and employee counts',
        endpoint: '/api/hr/ai/context/overview'
      },
      {
        name: 'employee_count',
        description: 'Detailed employee headcount by department and position',
        endpoint: '/api/hr/ai/context/headcount'
      },
      {
        name: 'time_off_summary',
        description: 'Who is off today/this week and pending time-off requests',
        endpoint: '/api/hr/ai/context/time-off'
      }
    ]
  }
}
```

### 2. Context Provider Controller

Create a dedicated `*AIContextController.ts` file:

```typescript
/**
 * [Module] AI Context Provider Controller
 * 
 * Provides context data about [Module] to the AI system.
 * These endpoints are called by the CrossModuleContextEngine when processing AI queries.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * GET /api/[module]/ai/context/[provider-name]
 * 
 * Returns [specific context] for AI understanding
 * Used by AI to answer "[example questions]"
 */
export async function getSpecificContext(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    const { businessId } = req.query;
    
    // 1. Validate authentication
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // 2. Validate required parameters
    if (!businessId || typeof businessId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'businessId is required' 
      });
    }

    // 3. Verify access to business
    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: { businessId, userId },
      },
    });

    if (!member || !member.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // 4. Query relevant data
    const data = await prisma.model.findMany({
      where: { businessId },
      // ... include relevant relations
    });

    // 5. Format for AI consumption
    const context = {
      // Structured data that AI can understand
      summary: {
        // High-level metrics
      },
      details: {
        // Specific data points
      }
    };
    
    // 6. Return standardized response
    res.json({
      success: true,
      context,
      metadata: {
        provider: '[module]',
        endpoint: '[provider-name]',
        businessId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in getSpecificContext:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch context',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

### 3. Route Registration

Add AI context routes in the module's route file:

```typescript
// AI CONTEXT PROVIDERS (Required for AI integration)
// Route: /api/[module]/ai/*
router.get('/ai/context/overview', moduleController.getOverviewContext);
router.get('/ai/context/specific', moduleController.getSpecificContext);
// ... more context providers
```

### 4. Controller Re-export (if needed)

If context providers are in a separate controller file:

```typescript
// In main module controller
export {
  getOverviewContext,
  getSpecificContext
} from './[module]AIContextController.js';
```

---

## Implementation Checklist

When building a new module, AI context implementation is **MANDATORY**:

### ✅ Planning Phase
- [ ] Identify 3-5 key questions users will ask about this module
- [ ] Determine what data the AI needs to answer those questions
- [ ] Design context provider endpoints (minimum 2-3 per module)

### ✅ Backend Implementation
- [ ] Create `*AIContextController.ts` with context provider functions
- [ ] Implement each context provider with proper error handling
- [ ] Add routes in module route file under `/api/[module]/ai/context/*`
- [ ] Register module in `registerBuiltInModules.ts` with full AI context
- [ ] Test each endpoint with sample businessId

### ✅ Code Quality
- [ ] All implementations follow TypeScript standards (no `any` types)
- [ ] Proper authentication and authorization checks
- [ ] Multi-tenant scoping (businessId required)
- [ ] Consistent error format with structured logging
- [ ] Type-safe query parameter validation
- [ ] Standardized response format (success, context, metadata)

### ✅ Documentation
- [ ] Update module's product context file with AI capabilities
- [ ] Document what questions the AI can answer
- [ ] Add example queries users can try

---

## Context Provider Design Principles

### 1. **Answer Specific Questions**
Each context provider should answer a specific type of question:
- ❌ Bad: Generic "getData" endpoint
- ✅ Good: "getEmployeeHeadcount" answers "How many employees do we have?"

### 2. **Return Structured Data**
AI needs structured, predictable data:
```typescript
// ✅ GOOD: Structured with summary + details
{
  summary: {
    totalCount: 45,
    status: 'good'
  },
  details: [
    { name: 'Engineering', count: 15 },
    { name: 'Sales', count: 12 }
  ]
}

// ❌ BAD: Unstructured array
[
  { dept: 'Engineering', emp: 15 },
  { department: 'Sales', employees: 12 }  // Inconsistent keys!
]
```

### 3. **Include Context & Metadata**
Always include metadata so AI understands the response:
```typescript
{
  success: true,
  context: { /* actual data */ },
  metadata: {
    provider: 'hr',
    endpoint: 'headcount',
    businessId: 'xxx',
    timestamp: '2025-11-13T...',
    dateRange: { from: '...', to: '...' }  // If time-based
  }
}
```

### 4. **Provide Summaries**
Include both raw data AND interpreted summaries:
```typescript
{
  details: {
    employeesOffToday: 5,
    employeesOffThisWeek: 12
  },
  summary: {
    status: 'low-staff',  // AI can use this
    message: '5 employees off today - reduced staffing',
    requiresAction: true
  }
}
```

### 5. **Keep Responses Focused**
Don't return everything - return what's relevant:
- ❌ Bad: Return all 10,000 employee records
- ✅ Good: Return summary stats + top 10 relevant items

### 6. **Handle Time Ranges Intelligently**
Many questions are time-based ("today", "this week"):
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

// Query for today's data
where: {
  startDate: { lte: today },
  endDate: { gte: today }
}
```

---

## Real-World Examples

### Example 1: HR Module

**User Question**: "How many employees do we have?"

**Context Provider**: `employee_count`
```typescript
export async function getEmployeeHeadcountContext(req: Request, res: Response) {
  // ... auth checks ...
  
  const employees = await prisma.employeePosition.findMany({
    where: { businessId, active: true },
    include: {
      position: {
        select: {
          title: true,
          department: { select: { name: true } }
        }
      }
    }
  });

  // Group by department
  const byDepartment = new Map<string, number>();
  employees.forEach(emp => {
    const dept = emp.position?.department?.name || 'Unassigned';
    byDepartment.set(dept, (byDepartment.get(dept) || 0) + 1);
  });

  const context = {
    headcount: {
      total: employees.length,
      byDepartment: Array.from(byDepartment.entries())
        .map(([name, count]) => ({ department: name, count }))
        .sort((a, b) => b.count - a.count)
    },
    summary: {
      totalEmployees: employees.length,
      departmentCount: byDepartment.size,
      largestDepartment: {
        name: Array.from(byDepartment.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
        count: Array.from(byDepartment.entries()).sort((a, b) => b[1] - a[1])[0]?.[1]
      }
    }
  };

  res.json({ success: true, context, metadata: { ... } });
}
```

**AI Response**: "You currently have 45 employees across 5 departments. Your largest department is Engineering with 15 employees, followed by Sales with 12."

### Example 2: Scheduling Module

**User Question**: "Who's working tomorrow?"

**Context Provider**: `coverage_status`
```typescript
export async function getCoverageStatusForAI(req: Request, res: Response) {
  // ... auth checks ...
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const shifts = await prisma.scheduleShift.findMany({
    where: {
      businessId,
      startTime: { gte: tomorrow, lt: dayAfter }
    },
    include: {
      employeePosition: {
        include: {
          user: { select: { name: true } },
          position: { select: { title: true } }
        }
      }
    }
  });

  const context = {
    tomorrow: {
      date: tomorrow.toISOString().split('T')[0],
      totalShifts: shifts.length,
      openShifts: shifts.filter(s => s.status === 'OPEN').length,
      workingEmployees: shifts
        .filter(s => s.employeePosition)
        .map(s => ({
          name: s.employeePosition.user.name,
          position: s.employeePosition.position.title,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString()
        })),
      coverageRate: Math.round(
        (shifts.filter(s => s.status !== 'OPEN').length / shifts.length) * 100
      )
    }
  };

  res.json({ success: true, context, metadata: { ... } });
}
```

**AI Response**: "Tomorrow you have 8 employees scheduled to work: John (Manager, 9am-5pm), Sarah (Cashier, 10am-6pm), Mike (Cook, 8am-4pm)... The schedule is fully covered with all 8 shifts assigned."

---

## Current Implementation Status

### ✅ Implemented Modules

| Module | Context Providers | Example Questions |
|--------|------------------|-------------------|
| **Drive** | `recent_files`, `storage_stats`, `file_search` | "Show recent files", "How much storage am I using?" |
| **Chat** | `recent_conversations`, `unread_messages`, `conversation_history` | "Show unread messages", "Who am I chatting with?" |
| **Calendar** | `upcoming_events`, `today_schedule`, `availability` | "What's on my schedule today?", "Am I free at 3pm?" |
| **HR** | `hr_overview`, `employee_count`, `time_off_summary` | "How many employees?", "Who's off today?" |
| **Scheduling** | `scheduling_overview`, `coverage_status`, `scheduling_conflicts` | "Who's working tomorrow?", "Any open shifts?" |

### 🚧 Needs Implementation

All future modules must include AI context from day one. Examples of modules that will need AI context:

- **Inventory** → "What's low in stock?", "Show top selling items"
- **Analytics** → "What are this month's trends?", "Show revenue summary"
- **Projects** → "What's overdue?", "Show my tasks"
- **CRM** → "Who are my top customers?", "Show recent leads"

---

## Common Patterns

### Pattern 1: Today/This Week Queries
```typescript
// Today
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

// This week (Sunday to Saturday)
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - today.getDay());
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekStart.getDate() + 7);
```

### Pattern 2: Grouping by Category
```typescript
const grouped = new Map<string, ItemType[]>();
items.forEach(item => {
  const key = item.category;
  if (!grouped.has(key)) {
    grouped.set(key, []);
  }
  grouped.get(key)!.push(item);
});

// Convert to array
const result = Array.from(grouped.entries()).map(([category, items]) => ({
  category,
  count: items.length,
  items: items.slice(0, 5)  // Limit to top 5
}));
```

### Pattern 3: Status Classification
```typescript
const status = 
  criticalCount > 0 ? 'critical' :
  warningCount > 5 ? 'needs-attention' :
  warningCount > 0 ? 'normal' :
  'all-good';

const summary = {
  status,
  requiresAction: criticalCount > 0 || warningCount > 5,
  message: status === 'critical' ? 'Immediate attention needed' : 'Everything normal'
};
```

---

## Testing AI Context

### Manual Testing
1. Start the backend server
2. Get a valid authentication token
3. Test each context provider endpoint:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/hr/ai/context/overview?businessId=YOUR_BUSINESS_ID"
```

### Expected Response Format
```json
{
  "success": true,
  "context": {
    "summary": { ... },
    "details": { ... }
  },
  "metadata": {
    "provider": "hr",
    "endpoint": "overview",
    "businessId": "xxx",
    "timestamp": "2025-11-13T..."
  }
}
```

### Integration Testing
Once endpoints work, test with the AI assistant:
- Ask natural language questions
- Verify AI calls the correct context providers
- Check that responses are accurate and helpful

---

## Best Practices

### ✅ DO
- Implement AI context **from day one** of module development
- Create 2-3+ context providers per module
- Return structured, consistent data formats
- Include summaries and status indicators
- Use proper TypeScript types throughout
- Validate authentication and businessId on every request
- Handle edge cases (no data, empty results)
- Document what questions each provider answers

### ❌ DON'T
- Skip AI context implementation ("we'll add it later")
- Return raw database records without formatting
- Use inconsistent response formats between providers
- Forget multi-tenant scoping (always require businessId)
- Return sensitive data without proper authorization
- Use `any` types or skip error handling
- Create generic "getAll" endpoints that return everything

---

## Future Enhancements

### Planned Features
- **Cross-Module Queries**: "Show employees who are working tomorrow" (combines HR + Scheduling)
- **Temporal Queries**: "What changed since yesterday?" (requires change tracking)
- **Predictive Context**: "Will we be understaffed next week?" (requires forecasting)
- **Action Suggestions**: AI suggests actions based on context ("You should hire more for Q4")

### Extensibility
The AI context system is designed to grow:
- New modules automatically integrate when they register context providers
- Context providers can be versioned (v1, v2) for breaking changes
- Modules can subscribe to other modules' context (event-driven)

---

## Conclusion

**AI Context is Non-Negotiable**: Every module must implement AI context providers. This is what makes Vssyl intelligent and differentiated from competitors.

When you build a new module, plan AI context **first**, not last. Ask yourself:
1. What questions will users ask about this module?
2. What data does the AI need to answer those questions?
3. How can I structure that data for easy AI consumption?

The AI context system is the bridge between raw data and intelligent assistance. Build it well, and users will feel like they have a smart assistant. Skip it, and your module is just another CRUD interface.

---

**Last Updated**: November 13, 2025  
**Status**: ✅ Production Pattern (5 modules implemented)  
**Owner**: Platform Architecture Team

