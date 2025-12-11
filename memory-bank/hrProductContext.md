# HR Module Product Context

**Last Updated**: November 7, 2025  
**Status**: ✅ PRODUCTION DEPLOYED - Phase 2 Time-Off Experience Live  
**Module ID**: `hr`  
**Category**: Business Only  
**Minimum Tier**: Business Advanced
**Production URL**: `/business/[id]/admin/hr` (Admin), `/business/[id]/workspace?module=hr` (Workspace), `/business/[id]/workspace/hr/me` (Employee)

---

## 🎯 Overview

The HR Management module provides comprehensive human resources functionality for businesses, extending the existing org chart system with employee lifecycle management, attendance tracking, payroll processing, and more.

### Key Design Principles

1. **Framework First**: Build structure before features
2. **Extends Org Chart**: Leverages existing organizational structure
3. **Tiered Features**: Business Advanced (limited) vs Enterprise (full)
4. **Three Access Levels**: Admin, Manager, Employee
5. **Multi-Tenant Isolation**: All data scoped by businessId

---

## 🏗️ Architecture

### Three-Tier Access Structure

```
HR Module Access
├── Admin (Business Owners/Admins)
│   └── /business/[id]/admin/hr
│       ├── Full employee directory
│       ├── Company-wide reports
│       ├── HR settings
│       └── All HR features
│
├── Manager (Employees with Direct Reports)
│   └── /business/[id]/workspace/hr/team
│       ├── Team member view
│       ├── Team time-off approvals
│       ├── Team attendance
│       └── Team reports
│
└── Employee (All Business Members)
    └── /business/[id]/workspace/hr/me
        ├── Own profile view
        ├── Time-off requests
        ├── Pay stubs view
        └── Benefits view
```

### Manager Approval Hierarchy

**Key Requirement**: Managers cannot approve their own requests. Time-off and other approvals automatically route to the next level up in the org chart.

**Example**:
```
Employee requests time off → Manager approves
Manager requests time off → Director approves (skip level)
Director requests time off → VP approves
```

---

## 💰 Pricing Model

### Business Advanced Tier ($69.99/mo)
**Limited HR Features**:
- ✅ Employee directory (max 50 employees)
- ✅ Basic employee profiles
- ✅ Org chart integration
- ✅ Time-off management (request/approve)
- ✅ Basic attendance tracking
- ✅ Employee self-service
- ✅ Manager team view
- ✅ Basic reports
- ❌ No clock in/out
- ❌ No payroll
- ❌ No recruitment
- ❌ No performance reviews
- ❌ No benefits admin

**Target Users**: Small businesses (< 50 employees) needing basic HR

### Enterprise Tier ($129.99/mo)
**Full HR Suite**:
- ✅ Everything in Business Advanced PLUS:
- ✅ Unlimited employees
- ✅ Custom employee fields
- ✅ Clock in/out tracking
- ✅ Geolocation attendance
- ✅ Full payroll processing
- ✅ Recruitment & ATS
- ✅ Performance management
- ✅ Benefits administration
- ✅ Advanced reports & analytics
- ✅ Compliance tracking

**Target Users**: Growing businesses and enterprises needing full HR suite

---

## 🗄️ Database Schema

### Core Models

#### EmployeeHRProfile
Extends org chart EmployeePosition with HR-specific data:
```typescript
{
  id: string;
  employeePositionId: string;  // Links to org chart
  businessId: string;          // Multi-tenant isolation
  hireDate?: Date;
  terminationDate?: Date;
  employeeType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  workLocation?: string;
  emergencyContact?: JSON;
  personalInfo?: JSON;
  deletedAt?: Date;  // Soft delete for compliance
}
```

#### ManagerApprovalHierarchy
Defines who approves what for each employee:
```typescript
{
  id: string;
  employeePositionId: string;  // Employee needing approval
  managerPositionId: string;   // Manager providing approval
  businessId: string;
  approvalTypes: string[];     // ['time-off', 'expenses', etc.]
  approvalLevel: number;       // 1 = direct, 2 = skip-level
  isPrimary: boolean;
  active: boolean;
}
```

#### HRModuleSettings
Business-level HR configuration:
```typescript
{
  id: string;
  businessId: string;
  timeOffSettings?: JSON;      // PTO policies, accrual rules
  scheduleCalendarId?: string; // Business-wide schedule calendar (created automatically)
  workWeekSettings?: JSON;     // Days/hours, start day
  payrollSettings?: JSON;      // Pay period, direct deposit
  enabledFeatures?: JSON;      // Feature toggles
}
```

#### TimeOffRequest
Primary record for time-off lifecycle:
```typescript
{
  id: string;
  businessId: string;          // Multi-tenant isolation
  employeePositionId: string;  // Links to org chart position
  type: TimeOffType;           // PTO, Sick, etc.
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: TimeOffStatus;       // PENDING → APPROVED/DENIED/CANCELLED
  requestedById: string;
  requestedAt: Date;
  approvedById?: string;
  approvedAt?: Date;
  managerNote?: string;
  scheduleEventId?: string;    // Event in business schedule calendar
  personalEventId?: string;    // Event in employee personal calendar
  createdAt: Date;
  updatedAt: Date;
}
```

### Future Feature Schemas
Planned (not yet implemented):
- `attendance.prisma` - Time tracking, schedules, time-off
- `payroll.prisma` - Pay runs, tax calculations
- `recruitment.prisma` - Job postings, applications
- `performance.prisma` - Reviews, goals, feedback
- `benefits.prisma` - Plans, enrollments, COBRA

---

## 🔌 API Structure

### Admin Routes (`/api/hr/admin/*`)
**Access**: Business owners and admins

```typescript
GET    /admin/employees          // List all employees
GET    /admin/employees/filter-options // Departments, positions for filters
GET    /admin/employees/:id      // Get employee details
POST   /admin/employees          // Create employee
PUT    /admin/employees/:id      // Update employee
DELETE /admin/employees/:id      // Soft delete employee
GET    /admin/employees/:id/audit-logs // View change history
GET    /admin/settings           // Get HR settings
PUT    /admin/settings           // Update HR settings

// Enterprise only
GET    /admin/payroll            // Payroll dashboard
GET    /admin/recruitment        // Recruitment dashboard
GET    /admin/performance        // Performance dashboard
GET    /admin/benefits           // Benefits dashboard
```

### Manager Routes (`/api/hr/team/*`)
**Access**: Managers with direct reports

```typescript
GET  /team/employees             // Get team members
GET  /team/time-off/pending      // Pending approvals
POST /team/time-off/:id/approve  // Approve time-off
// (Notes required for audit trail when denying)
```

### Employee Routes (`/api/hr/me/*`)
**Access**: All business employees

```typescript
GET  /me                         // Get own HR data
PUT  /me                         // Update own HR data
POST /me/time-off/request        // Request time off
POST /me/time-off/:id/cancel     // Cancel pending request
GET  /me/time-off/balance        // View time-off balance
GET  /me/pay-stubs               // View pay stubs
```

### AI Context Routes (`/api/hr/ai/*`)
**Access**: Authenticated users with HR access

```typescript
GET  /ai/context/overview        // HR overview for AI
GET  /ai/context/headcount       // Employee counts
GET  /ai/context/time-off        // Who's off today/week
```

---

## 🛡️ Permission System

### Permission Hierarchy

```
hr:admin                    // Full HR access
  ├── hr:employees:read     // View all employees
  ├── hr:employees:write    // Manage employees
  ├── hr:settings:manage    // Configure HR
  └── hr:*:*                // All HR permissions

hr:team:view                // Manager access
  ├── hr:team:approve       // Approve team requests
  └── hr:team:reports       // Team reports

hr:self:view                // Employee access (everyone)
  ├── hr:self:update        // Update own data
  └── hr:self:request       // Request time off
```

### Permission Checks

All HR endpoints check:
1. **Authentication**: User must be logged in
2. **Business Membership**: User must be member of business
3. **Tier Access**: Business Advanced or Enterprise tier
4. **Module Installation**: HR module must be installed
5. **Role Permission**: Admin/Manager/Employee access level
6. **Feature Gate**: Specific feature available on tier

---

## 🎨 Frontend Structure

### Pages Created

```
web/src/app/business/[id]/
├── admin/hr/
│   └── page.tsx                  # HR Admin Dashboard
│       ├── Employee Directory
│       ├── Attendance Overview
│       ├── Payroll (Enterprise)
│       ├── Recruitment (Enterprise)
│       ├── Performance (Enterprise)
│       └── Benefits (Enterprise)
│
└── workspace/hr/
    ├── me/page.tsx               # Employee Self-Service
    │   ├── My Profile
    │   ├── Time Off
    │   ├── Pay Stubs
    │   └── My Benefits
    │
    └── team/page.tsx             # Manager Team View
        ├── Team Members
        ├── Time-Off Approvals
        ├── Team Attendance
        └── Team Reports
```

### Hooks Created

```typescript
// web/src/hooks/useHRFeatures.ts
const {
  tier,                    // 'business_advanced' | 'enterprise' | null
  hasHRAccess,            // boolean
  employees,              // { enabled, limit, customFields }
  attendance,             // { enabled, clockInOut, geolocation }
  payroll,                // boolean (enterprise only)
  recruitment,            // boolean (enterprise only)
  performance,            // boolean (enterprise only)
  benefits,               // boolean (enterprise only)
  loading,
  canAccessHR,
  getFeatureUpgradeMessage
} = useHRFeatures(businessTier);
```

---

## 🔄 Integration Points

### Org Chart Integration

**Data Flow**:
```
User Account
    ↓
Business Membership
    ↓
Org Chart Position (EmployeePosition) ← Org chart system
    ↓
HR Profile (EmployeeHRProfile) ← HR module extends this
    ↓
Feature Data (Attendance, Payroll, etc.) ← Future features
```

**Key Relationships**:
- `EmployeeHRProfile.employeePositionId → EmployeePosition.id`
- `ManagerApprovalHierarchy` references `EmployeePosition` (not User)
- Permissions inherited from org chart positions

### Business Workspace Integration

**Admin Access**:
- HR admin features in Business Admin Dashboard
- Located at `/business/[id]/admin/hr`
- Accessible from admin sidebar navigation

**Employee/Manager Access**:
- Self-service and team features render inside the unified workspace
- Primary entry: `/business/[id]/workspace?module=hr` (unified renderer)
- Deep links remain at `/business/[id]/workspace/hr/*` for specific views
- Accessible from Work tab and sidebar; module list provided by BusinessConfigurationContext

### Time-Off Calendar Synchronization

**Service**: `server/src/services/hrScheduleService.ts`

- `initializeHrScheduleForBusiness()` ensures each business has a dedicated "Schedule" calendar and seeds members.
- `addUsersToScheduleCalendar()` keeps membership in sync when invitations are accepted.
- `syncTimeOffRequestCalendar()` mirrors request status to:
  - Business schedule calendar (for team awareness)
  - Employee personal calendar (for individual planning)
- Events stay linked via `scheduleEventId` and `personalEventId` stored on `time_off_requests`.
- Pending → Approved/Denied transitions update titles/descriptions and adjust event colors.
- Cancellation removes both events to avoid stale calendar entries.

---

## 🤖 AI Integration

### Status: ✅ FULLY IMPLEMENTED (November 13, 2025)

The HR module has comprehensive AI context providers that enable natural language queries about HR data.

### AI Context Registration

**Keywords**: `employee`, `staff`, `team`, `workforce`, `headcount`, `time off`, `attendance`, `hr`  
**Patterns**: 
- "how many employees"
- "who is off today"
- "show me the team"
- "attendance summary"

**Entities**: `employee`, `department`, `position`, `time-off request`  
**Actions**: `count employees`, `check availability`, `view attendance`

### Context Providers (Implemented)

#### 1. HR Overview (`hr_overview`)
**Endpoint**: `GET /api/hr/ai/context/overview`  
**Purpose**: General HR statistics and employee counts  
**Implementation**: `server/src/controllers/hrAIContextController.ts`

**Returns**:
```typescript
{
  employees: {
    total: number,
    active: number,
    terminated: number,
    byType: { fullTime, partTime, contract, other },
    recentHires: { count, period }
  },
  timeOff: {
    employeesOffToday: number,
    pendingRequests: number,
    status: 'full-staff' | 'low-staff' | 'normal'
  },
  summary: {
    headcount: number,
    staffingLevel: string,
    hasPendingActions: boolean
  }
}
```

**Example Questions**:
- "How many employees do we have?"
- "What's our staffing level today?"
- "Do we have any pending time-off requests?"

#### 2. Employee Headcount (`employee_count`)
**Endpoint**: `GET /api/hr/ai/context/headcount`  
**Purpose**: Detailed employee headcount by department and position  
**Implementation**: `server/src/controllers/hrAIContextController.ts`

**Returns**:
```typescript
{
  headcount: {
    total: number,
    byDepartment: [{ department, count }],
    byPosition: [{ position, count }],
    largestDepartment: { name, count }
  },
  summary: {
    totalEmployees: number,
    departmentCount: number,
    positionCount: number,
    averagePerDepartment: number
  }
}
```

**Example Questions**:
- "How many people are in Engineering?"
- "What's our department breakdown?"
- "Which department has the most employees?"

#### 3. Time-Off Summary (`time_off_summary`)
**Endpoint**: `GET /api/hr/ai/context/time-off`  
**Purpose**: Who is off today/this week and pending time-off requests  
**Implementation**: `server/src/controllers/hrAIContextController.ts`

**Returns**:
```typescript
{
  today: {
    date: string,
    employeesOff: [{ employeeName, position, type, startDate, endDate }],
    count: number
  },
  thisWeek: {
    weekStart: string,
    weekEnd: string,
    totalRequests: number,
    uniqueEmployees: number,
    byDay: [{ date, dayOfWeek, employeesOff }]
  },
  pending: {
    count: number,
    requests: [{ employeeName, type, startDate, endDate }]
  },
  summary: {
    offToday: number,
    offThisWeek: number,
    pendingApprovals: number,
    status: 'full-staff' | 'low-staff' | 'normal',
    requiresAction: boolean
  }
}
```

**Example Questions**:
- "Who's off today?"
- "Show me who's out this week"
- "Do I have any time-off requests to approve?"

### Technical Implementation

**Controller**: `server/src/controllers/hrAIContextController.ts` (524 lines)
- 3 comprehensive context provider functions
- Type-safe query parameter validation
- Multi-tenant scoping (businessId required)
- Proper authentication and authorization checks
- Structured error handling with logging
- Standardized response format

**Integration**: Updated `server/src/controllers/hrController.ts` to re-export functions from `hrAIContextController.ts`

**Routes**: Already registered in `server/src/routes/hr.ts` under `/api/hr/ai/context/*`

**Registration**: Module registered in `server/src/startup/registerBuiltInModules.ts` with full AI context definition

**Cache Duration**: 5-10 minutes (configurable per provider)  
**Response Time**: < 500ms average

---

## 🚀 Implementation Status

### ✅ Completed (Framework + Production Deployment)

**Database Layer**:
- [x] Prisma HR module created (`prisma/modules/hr/`)
- [x] Core models defined (EmployeeHRProfile, ManagerApprovalHierarchy, HRModuleSettings)
- [x] Multi-tenant isolation implemented
- [x] Relationships to org chart established
- [x] Schema built and generated
- [x] **PRODUCTION**: All HR tables created in production database
- [x] **PRODUCTION**: Migration issues resolved with emergency admin endpoints

**Backend Layer**:
- [x] API routes created (`server/src/routes/hr.ts`)
- [x] Controllers implemented (`server/src/controllers/hrController.ts`)
- [x] Permission middleware (`server/src/middleware/hrPermissions.ts`)
- [x] Feature gating middleware (`server/src/middleware/hrFeatureGating.ts`)
- [x] Tier checks implemented
- [x] AI context registered in `registerBuiltInModules.ts`
- [x] **AI context implemented** (`server/src/controllers/hrAIContextController.ts` - 524 lines, 3 providers)
- [x] Routes registered in main server
- [x] **PRODUCTION**: Emergency admin endpoints for database fixes
- [x] **PRODUCTION**: Module seeding on startup

**Frontend Layer**:
- [x] useHRFeatures hook created
- [x] HR admin dashboard (`/business/[id]/admin/hr/page.tsx`)
- [x] Employee self-service (`/workspace/hr/me/page.tsx`)
- [x] Manager team view (`/workspace/hr/team/page.tsx`)
- [x] Tier-based feature display
- [x] Upgrade prompts for locked features

**Production Deployment**:
- [x] **Module Installed**: HR module available in production marketplace
- [x] **Database Schema**: All tables and columns exist
- [x] **Emergency Endpoints**: 6 admin diagnostic/fix endpoints created
- [x] **Deployment Guide**: Comprehensive checklist in `docs/deployment/`
- [x] **Build Configuration**: Fixed `.dockerignore` and Dockerfile issues

### ✅ Phase 2 Enhancements (November 2025)

- [x] Employee CRUD with validation errors surfaced in UI and audit logging for create/update/terminate
- [x] CSV import/export pipeline with server-side validation feedback
- [x] Admin directory filters (department, position) and configurable sorting
- [x] Time-off request lifecycle (overlap checks, balance validation, cancellation, manager notes)
- [x] Calendar synchronization between business schedule and personal calendars
- [x] Audit log retrieval for employees and manager approvals
- [x] Admin “Impersonation Lab” view integrates business context impersonation and seeds HR personas (manager + specialist) for smoke testing; pending fix for occasional 500 errors when provisioning personas.

### ✅ Phase 3 Enhancements (November 2025 – Onboarding Asset Delivery)

- [x] Document requirements library with automatic cloning into each hire’s `Employee Documents` drive folder during journey creation.
- [x] Equipment catalog supporting SKU, instructions, and reusable checklist references synced to onboarding templates.
- [x] Uniform catalog with color and size metadata, selectable inside onboarding checklists, and stored for future reuse.
- [x] Module settings UI refinements: modal pickers, upload flows, and direct catalog management inside the HR onboarding tab.

### ⏳ Pending (Features)

**Attendance Features** (Business Advanced+):
- [ ] Basic attendance reports

**Advanced Attendance** (Enterprise):
- [ ] Clock in/out functionality
- [ ] Geolocation tracking
- [ ] Shift scheduling
- [ ] Advanced attendance analytics

**Payroll Features** (Enterprise):
- [ ] Payroll processing
- [ ] Pay stub generation
- [ ] Tax calculations
- [ ] Direct deposit management

**Recruitment Features** (Enterprise):
- [ ] Job posting management
- [ ] Applicant tracking system
- [ ] Interview scheduling
- [ ] Offer letter generation

**Performance Features** (Enterprise):
- [ ] Performance review cycles
- [ ] Goal setting (OKRs)
- [ ] 360-degree feedback
- [ ] Performance analytics

**Benefits Features** (Enterprise):
- [ ] Benefits enrollment
- [ ] Plan management
- [ ] COBRA administration
- [ ] Open enrollment workflows

---

## 📊 Technical Implementation Details

### Multi-Tenant Data Isolation

**CRITICAL**: All HR queries MUST include businessId

```typescript
// ✅ Correct - Data isolation
const employees = await prisma.employeeHRProfile.findMany({
  where: {
    businessId: businessId,
    deletedAt: null
  }
});

// ❌ Wrong - Data leakage vulnerability!
const employees = await prisma.employeeHRProfile.findMany({
  where: { deletedAt: null }
});
```

### Permission Check Pattern

```typescript
// Every HR endpoint follows this pattern:
1. Authenticate user (authenticateJWT)
2. Check tier access (checkBusinessAdvancedOrHigher)
3. Check module installed (checkHRModuleInstalled)
4. Check role permission (checkHRAdmin/checkManagerAccess/checkEmployeeAccess)
5. Check feature gate (checkHRFeature for enterprise features)
6. Execute business logic
```

### Feature Gating Pattern

```typescript
// Backend feature gate
router.get('/admin/payroll',
  checkHRFeature('payroll'),  // Enterprise only
  checkHRAdmin,
  payrollController
);

// Frontend feature display
const hrFeatures = useHRFeatures(businessTier);
if (hrFeatures.payroll) {
  // Show payroll feature
} else {
  // Show upgrade prompt
}
```

---

## 🎯 Success Metrics

### Framework Metrics (Current)
- [ ] Schema builds without errors
- [ ] API routes respond correctly
- [ ] Permission checks work
- [ ] Tier gating functions properly
- [ ] Frontend displays correctly

### Feature Metrics (Future)
- [ ] Employee creation < 2 minutes
- [ ] Time-off approval < 30 seconds
- [ ] Payroll processing < 10 minutes
- [ ] Report generation < 5 seconds
- [ ] 99.9% data accuracy

### Business Metrics (Future)
- [ ] 80%+ adoption among Business Advanced users
- [ ] 50%+ upgrade to Enterprise for payroll
- [ ] < 1% permission-related errors
- [ ] 90%+ user satisfaction

---

## 🔗 Related Documentation

### Memory Bank Files
- **Org Chart System**: `org-chart-permission-system.md` - Foundation for HR
- **Business Workspace**: `businessWorkspaceArchitecture.md` - Integration points
- **Module Brainstorming**: `moduleBrainstorming.md` - Full feature list
- **Database Context**: `databaseContext.md` - Overall schema

### Code Files
- **Database**: `prisma/modules/hr/` - HR schema modules
- **Backend**: `server/src/routes/hr.ts` - API routes
- **Controllers**: `server/src/controllers/hrController.ts` - Business logic
- **Middleware**: `server/src/middleware/hrPermissions.ts` - Access control
- **Frontend**: `web/src/app/business/[id]/admin/hr/` - Admin UI
- **Hooks**: `web/src/hooks/useHRFeatures.ts` - Feature detection

---

## 📋 Development Roadmap

### Phase 1: Foundation ✅ **COMPLETED**
- [x] Database schema framework
- [x] API route structure
- [x] Permission system
- [x] Feature gating
- [x] Frontend pages (framework)
- [x] AI context registration

### Phase 2: Core Employee Management ✅ *(Complete)*
- [x] Employee CRUD operations
- [x] Employee profiles with validation
- [x] Employee directory with search/filter
- [x] Employee import wizard
- [x] Employee export functionality

### Phase 3: Attendance & Time-Off 🚧 *(In Progress)*
- [x] Time-off request workflow (employee self-service + manager approvals)
- [x] Manager approval system (exception handling & team queue)
- [x] Time-off balance calculation (accrual, pending/used tracking)
- [x] Time-off calendar integration
- [x] Attendance exception workflow (list + resolve actions for direct reports)
- [x] Attendance policy management (admin overview, create/edit modal)
- [x] Employee clock in/out experience (web, duplicate guardrails)
- [ ] Shift scheduling (templates, assignments, default coverage)
- [ ] Geolocation & variance enforcement (enterprise clock-in/out)
- [ ] Attendance reports & dashboards

### Phase 4: Enterprise Features (Week 5-8)
- [ ] Payroll processing
- [ ] Recruitment/ATS
- [ ] Performance reviews
- [ ] Benefits administration

### Phase 5: Advanced Features (Week 9-12)
- [ ] Advanced analytics
- [ ] Compliance tracking
- [ ] Integration APIs
- [ ] Mobile support

### Phase 3 Implementation Snapshot *(November 11, 2025)*
- **Schema**: Attendance policies, shift templates/assignments, records, and exceptions defined with Prisma defaults and user back-relations; `User` model includes attendance exception relations.
- **Services**: `hrAttendanceService` delivers policy upsert/list, punch lifecycle (`recordPunchIn` / `recordPunchOut`), employee attendance history, and manager exception resolution with variance adjustments.
- **Controllers**: `hrController` exposes admin/employee/manager attendance endpoints with Zod validation, tenant scoping, tier gating, and improved audit helpers.
- **Routes & Middleware**: `server/src/routes/hr.ts` enforces `checkHRFeature('attendance')`, manager context helpers, and subscription checks for Enterprise-only functionality.
- **Frontend**:  
  - Admin attendance page renders overview stats, policy tables, and create/edit modal with optimistic toast feedback.  
  - Employee workspace HR page enables clock-in/out, displays latest records, and blocks duplicate punches.  
  - Manager workspace HR page lists attendance exceptions with filters, quick stats, and resolve/dismiss flows.
- **Time-Off Hardening**: Legacy controllers now rely on `TimeOffStatus/TimeOffType` enums, overlap checks, and Prisma lookups without `any`; CSV import/export reads from buffers only and removes dynamic `require` usage.
- **Tooling**: Prisma build/generate/deploy executed to baseline schema; ESLint runs clean after removing residual `any` usage across controllers.

### Phase 3 Next Up
- Build UI + APIs for shift templates/assignments (admin + manager scheduling workflows).
- Add geolocation radius checks, variance calculations, and auto clock-out policies (Enterprise feature).
- Design attendance analytics (trend charts, exportable reports) for Business Advanced and Enterprise.
- Expand observability (metrics, logs, alerts) and automate smoke tests for policies, punches, exceptions, and CSV flows.

---

## ⚙️ Configuration

### Module Manifest

```typescript
{
  id: 'hr',
  name: 'HR Management',
  category: 'BUSINESS',
  businessOnly: true,
  requiresOrgChart: true,
  minimumTier: 'business_advanced',
  
  tierFeatures: {
    business_advanced: {
      employees: { limit: 50, customFields: false },
      attendance: { clockInOut: false },
      payroll: false,
      recruitment: false,
      performance: false,
      benefits: false
    },
    enterprise: {
      employees: { limit: null, customFields: true },
      attendance: { clockInOut: true },
      payroll: true,
      recruitment: true,
      performance: true,
      benefits: true
    }
  },
  
  routes: {
    admin: '/business/[id]/admin/hr',
    employee: '/business/[id]/workspace/hr/me',
    manager: '/business/[id]/workspace/hr/team'
  }
}
```

---

## 🎨 User Experience Design

### Admin Dashboard

**Layout**:
- Header with tier badge
- 6 feature cards (3x2 grid)
- Each card shows:
  - Icon
  - Feature name
  - Description
  - Availability status
  - Limitation info (if Business Advanced)
  - Upgrade prompt (if locked)

**Interaction**:
- Available features: Click to open
- Locked features: Show upgrade message
- Clear visual distinction (color vs grayscale)

### Employee Self-Service

**Layout**:
- Profile summary card
- 4 self-service action cards
- Clear feature availability

**Interaction**:
- Simple, consumer-friendly UI
- One-click actions
- Clear status messages

### Manager Team View

**Layout**:
- Team statistics cards
- Team action grid
- Note about manager approval hierarchy

**Interaction**:
- Quick team overview
- Easy approval workflows
- Team performance at-a-glance

---

## 🚨 Important Notes

### Security Considerations

1. **Multi-Tenant Isolation**: Every query MUST include `businessId`
2. **Soft Deletes**: HR data retained for compliance (use `deletedAt`)
3. **Sensitive Data**: Personal info and payroll encrypted in production
4. **Access Control**: Three-tier permission system strictly enforced

### Phase 3 Security, Auditing & Testing Plan *(Attendance & Advanced Time-Off)*

**Security & Compliance**
- Enforce tier + feature gates on every attendance route (`checkHRFeature('attendance')`, `checkBusinessAdvancedOrHigher`) and verify impersonated sessions still honor the original business scope.
- Require explicit multi-tenant filters on attendance models (`attendanceRecords`, `attendancePolicies`, `attendanceExceptions`, `attendanceShiftAssignments`) with compound indexes on `businessId` + key identifiers.
- Treat geolocation payloads and variance metadata as sensitive: redact from client logs, encrypt at rest in production via existing Prisma JSON encryption middleware, and restrict exposure to admin/manager views only.
- Harden `recordPunch` by validating device/browser fingerprint, optional geofence radius, and throttling duplicate punch attempts within the grace period.
- Extend audit logging (`hrAuditService`) to capture punch start/stop, policy changes, exception resolutions, and shift assignment edits with `before`/`after` payloads and impersonation context (`originalUserId`).
- Emit structured logs (`logger.info/error`) for every mutation with correlation IDs so Security & Compliance dashboards can surface anomalies (late arrivals, repeated geo violations).

**Testing Strategy**
- **Unit tests**: Cover `hrAttendanceService` helpers (policy resolution, variance calculation, exception generation) with edge cases for overnight shifts, daylight savings, and grace period overrides.
- **Integration tests**: Exercise REST routes via Supertest with seeded business/manager/employee personas; assert authorization failures for cross-business access, unauthorized tier requests, and impersonation misuse.
- **Contract tests**: Snapshot API responses consumed by frontend hooks (`useAttendanceOverview`, `useAttendancePolicies`) to keep DTOs stable.
- **Manual smoke tests** (per release): clock in/out, approve exceptions, modify policies, rotate shift assignments, and confirm real-time UI refresh plus audit log visibility; repeat while impersonating manager/employee roles.
- **Mobile/geolocation validation**: Test clock-in from allowed vs disallowed coordinates using Cypress geolocation stubs; ensure geo violations create exceptions and notify managers.
- **Load safeguards**: Run punch burst tests (10 punches/sec via script) against staging to confirm rate limits and queue back-pressure behave without dropping events.

**Observability & Operations**
- Publish key metrics to existing telemetry pipeline: `attendance.punch.count`, `attendance.exception.open`, `attendance.policy.changes`, tagged by `businessId` and tier.
- Schedule automated daily health checks that confirm each active business has at least one attendance policy, default shift template, and zero dangling `IN_PROGRESS` records past `autoClockOutAfterMinutes`.
- Document rollback procedure: disabling attendance feature via `BusinessConfigurationContext` toggles while preserving audit history; provide SQL playbook for reverting policy changes if migrations fail.

### Manager Approval Rules

1. **Cannot Self-Approve**: Managers' requests go to their manager
2. **Hierarchy-Based**: Uses org chart reporting structure
3. **Escalation Support**: Can escalate if primary manager unavailable
4. **Approval Types**: Different approvers for different request types

### Tier Limitations

**Business Advanced**:
- Employee limit: 50 employees
- No payroll features
- No recruitment features
- No performance reviews
- No benefits admin
- Basic attendance only

**Upgrade Path**:
- Clear upgrade prompts in UI
- Feature-specific upgrade messages
- Direct link to billing/upgrade page

---

## 🔮 Future Enhancements

### Phase 6: Advanced Features
- Onboarding workflows
- Offboarding checklists
- Learning & development
- Succession planning
- Compensation management

### Phase 7: Compliance & Reporting
- GDPR compliance tools
- EEOC reporting
- Labor law compliance
- Audit trail improvements
- Advanced analytics

### Phase 8: Integrations
- External payroll providers (ADP, Gusto)
- Benefits providers
- Background check services
- Job board integrations (LinkedIn, Indeed)
- Tax filing services

---

## ✅ Quick Start Guide

### For Developers

1. **Read Framework Code**:
   - Database: `prisma/modules/hr/core.prisma`
   - Backend: `server/src/routes/hr.ts`
   - Frontend: `web/src/app/business/[id]/admin/hr/page.tsx`

2. **Understand Patterns**:
   - Multi-tenant isolation (businessId everywhere)
   - Three-tier access (Admin/Manager/Employee)
   - Feature gating (Business Advanced vs Enterprise)

3. **Add Features**:
   - Create new Prisma model if needed
   - Add API endpoints to hr.ts
   - Add controller logic
   - Update frontend components

### For Product Managers

1. **Current Status**: Framework complete, features pending
2. **Available Tiers**: Business Advanced (limited), Enterprise (full)
3. **Access Levels**: Admin (full), Manager (team), Employee (self)
4. **Next Priority**: Employee management CRUD

---

**This module is ready for feature development!** 🚀

The framework provides:
✅ Database structure  
✅ API routing  
✅ Permission system  
✅ Feature gating  
✅ Frontend pages  
✅ AI integration  

**Next step**: Implement core employee management features

