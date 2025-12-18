# Troubleshooting Guide - Vssyl Platform

> **📚 Prevent These Errors:** See [../.cursor/rules/coding-standards.mdc](../.cursor/rules/coding-standards.mdc) for comprehensive coding rules that prevent these recurring issues.

## Current Session Issues & Solutions (December 2025)

### **Scheduling Module Database Tables Missing - RESOLVED** ✅

#### **Problem**: Scheduling Module Returning 500 Errors - Missing Database Tables
**Symptoms:**
```
GET http://localhost:3000/api/scheduling/admin/schedules?businessId=... 500 (Internal Server Error)
Invalid `prisma.schedule.findMany()` invocation in ...
The table `public.schedules` does not exist in the current database.
```

**Root Cause**: 
- Scheduling tables (`schedules`, `schedule_shifts`, etc.) were created using `prisma db push` instead of `prisma migrate dev`
- `db push` syncs the schema but doesn't create migration files
- When the database was reset or migrations were reapplied, the tables disappeared because there was no migration to recreate them
- Existing migrations only added columns to tables (assuming they already existed), but never created the base tables

**Solution Applied (December 2025):**
1. **Recreated Database Tables**: Used `prisma db push --accept-data-loss` to sync database schema with Prisma schema
2. **Regenerated Prisma Client**: Ran `pnpm prisma:generate` to regenerate Prisma client with new tables
3. **Verified Tables Created**: Confirmed `schedules`, `schedule_shifts`, `schedule_templates`, `shift_templates`, `shift_swap_requests`, and `employee_availability` tables now exist

**Files Modified:**
- Database schema synced via `prisma db push`
- Prisma client regenerated

**Technical Implementation:**
```bash
# Sync database with schema (creates missing tables)
pnpm prisma db push --accept-data-loss --skip-generate

# Regenerate Prisma client
pnpm prisma:generate
```

**Prevention for Future**:
- **Always use `prisma migrate dev`** for schema changes to create proper migration files
- **Never use `prisma db push`** for production schema changes (only for quick prototyping)
- **Create baseline migration** for scheduling tables to prevent this issue in the future

**Result**: ✅ All scheduling endpoints now work correctly, no more 500 errors

---

### **ScheduleBuilderVisual Undefined scheduleId Prop - RESOLVED** ✅

#### **Problem**: ScheduleBuilderVisual Component Receiving Undefined scheduleId Prop
**Symptoms:**
```
⚠️ ScheduleBuilderVisual: scheduleId prop is undefined - this should not happen
```

**Root Cause**: 
- React Strict Mode double-rendering or brief state transitions
- Component rendering before `selectedSchedule.id` is fully set in parent component
- No defensive checks in component to handle undefined props gracefully

**Solution Applied (December 2025):**
1. **Parent Component Validation**: Added `selectedSchedule && selectedSchedule.id` check in `SchedulingAdminContent` before rendering `ScheduleBuilderVisual`
2. **Component Early Return**: Added early return in `ScheduleBuilderVisual` after all hooks to return `null` if `scheduleId` is undefined (following Rules of Hooks)
3. **Defensive Programming**: Component now handles undefined state gracefully without console warnings

**Files Modified:**
- `web/src/components/scheduling/SchedulingAdminContent.tsx` — Added validation: `if (selectedSchedule && selectedSchedule.id)`
- `web/src/components/scheduling/ScheduleBuilderVisual.tsx` — Added early return after hooks: `if (!scheduleId) return null;`

**Technical Implementation:**
```typescript
// Parent component - validate before rendering
if (selectedSchedule && selectedSchedule.id) {
  return (
    <ScheduleBuilderVisual
      scheduleId={selectedSchedule.id}
      // ... other props
    />
  );
}

// Child component - early return after hooks
export default function ScheduleBuilderVisual({ scheduleId, ... }: Props) {
  // All hooks called first (Rules of Hooks)
  const { data: session } = useSession();
  const { schedules, shifts, ... } = useScheduling(...);
  
  // Early return after hooks
  if (!scheduleId) {
    console.warn('⚠️ ScheduleBuilderVisual: scheduleId prop is undefined - returning null');
    return null;
  }
  
  // Rest of component...
}
```

**Result**: ✅ No more warnings, component handles undefined state gracefully

---

### **Dashboard Page 500 Errors - RESOLVED** ✅

#### **Problem**: Dashboard Page Returning 500 Errors with useContext Errors
**Symptoms:**
```
TypeError: Cannot read properties of null (reading 'useContext')
Server Error
GET http://localhost:3000/dashboard/[id] 500 (Internal Server Error)
No default component was found for a parallel route rendered on this page
```

**Root Cause**: 
- Server component trying to use client-side hooks during SSR
- `usePathname` and other Next.js hooks being called during server-side rendering
- React context not available during SSR phase

**Solution Applied (December 2025):**
1. **Converted Dashboard Page to Client Component**: Changed from server component (`async function`) to client component (`'use client'`)
2. **Moved Authentication to useEffect**: Authentication checks now happen in `useEffect` instead of during render
3. **Replaced getServerSession with useSession**: Using client-side session hook instead of server-side session check
4. **Proper Loading States**: Added loading states while session is being checked

**Files Modified:**
- `web/src/app/dashboard/[id]/page.tsx` — Converted to client component, fixed authentication flow
- `web/src/app/dashboard/[id]/error.tsx` — Enhanced error boundary with better error display

**Technical Implementation:**
```typescript
// Before (Server Component - Caused SSR errors)
export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  return <DashboardClient dashboardId={id} />;
}

// After (Client Component - Works correctly)
'use client';
export default function DashboardPage() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [session, status, router]);
  return <DashboardClient dashboardId={id} />;
}
```

**Result**: ✅ Dashboard pages now load correctly without SSR errors

---

### **File Download 404/ENOENT Errors - RESOLVED** ✅

#### **Problem**: File Downloads Failing with 404 and ENOENT Errors
**Symptoms:**
```
GET http://localhost:3000/api/drive/files/[id]/download 404 (Not Found)
ENOENT: no such file or directory, stat '/Users/.../uploads/http:/localhost:5000...'
```

**Root Cause**: 
- File's `url` field in database contained full URLs (e.g., `http://localhost:5000/uploads/files/...`)
- Download function was trying to use URL as file path
- File's `path` field (actual file path) was being ignored
- No file existence validation before attempting download

**Solution Applied (December 2025):**
1. **Prioritize `file.path` Over `file.url`**: Download function now uses `file.path` from database first
2. **URL Path Extraction**: Added fallback logic to extract path from URL when `file.path` is not available
3. **File Existence Validation**: Added `fs.existsSync()` check before attempting download
4. **Proper Path Construction**: Uses `LOCAL_UPLOAD_DIR` environment variable for correct path construction
5. **Enhanced Error Logging**: Added detailed logging showing file path, URL, and database path for debugging

**Files Modified:**
- `server/src/controllers/fileController.ts` — Fixed download function path handling, added file existence checks, added `fs` import

**Technical Implementation:**
```typescript
// Before (Incorrect path handling)
const filePath = path.join(__dirname, '../../uploads', file.url.replace('/uploads/', ''));

// After (Proper path handling)
let filePath: string;
if (file.path) {
  // Use actual file path from database
  const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads');
  filePath = path.join(uploadDir, file.path);
} else if (file.url) {
  // Extract path from URL if file.path not available
  const urlPath = file.url.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/uploads\//, '');
  const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads');
  filePath = path.join(uploadDir, urlPath);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
  return res.status(404).json({ message: 'File not found on disk' });
}
```

**Result**: ✅ File downloads now work correctly for both new files (with `file.path`) and legacy files (with URLs)

---

## Previous Session Issues & Solutions (October 2025)

### **Login 403 Authentication Errors - RESOLVED** ✅

#### **Problem**: 403 Errors on Initial Dashboard Load After Login
**Symptoms:**
```
Failed to load resource: the server responded with a status of 403 ()
Failed to load conversations: Error: HTTP error! status: 403
api/trash/items:1  Failed to load resource: the server responded with a status of 403 ()
api/dashboard:1  Failed to load resource: the server responded with a status of 403 ()
api/modules/installed?scope=business&businessId=...:1  Failed to load resource: the server responded with a status of 403 ()
```

**User Experience:**
- Login succeeds with "Login successful, redirecting to dashboard" message
- Dashboard page loads but shows "Failed to load dashboards" error
- Multiple API calls fail with 403 errors (chat, modules, org chart, business data)
- After manual page reload, everything works fine
- This happens **every time** on initial login
- NEXT_REDIRECT error appears in console (expected Next.js behavior)

**Root Cause**: Race condition in authentication flow
- User logs in → `signIn()` completes successfully
- **Immediately** redirects to `/dashboard` (no delay)
- NextAuth session cookie hasn't fully propagated to browser yet
- Dashboard components and contexts make API calls before session is available
- **403 errors occur** because API calls have no valid authentication token
- Contexts like `BusinessConfigurationContext` and `ChatContext` fire on mount before session ready
- After page reload, session is established → all API calls work

**Solution Applied (Updated November 2025):**
Implemented comprehensive session readiness checks with three layers of protection:

1. **Login Page**: `waitForSession()` now actually polls for session availability
   - Waits minimum 300ms for cookie propagation
   - Then polls `getSession()` every 100ms until session with `accessToken` is confirmed
   - Maximum 5 second timeout before proceeding
   - Only redirects when session is confirmed ready

2. **SessionReadyGate Component**: Global gate preventing providers from mounting without session
   - New component `web/src/components/auth/SessionReadyGate.tsx` wraps all authenticated providers
   - Checks current route (public vs protected) using `usePathname()`
   - Public routes (login, register, landing) render immediately
   - Protected routes wait for `session?.accessToken` before rendering children
   - Shows loading spinner with timeout message while waiting
   - Prevents all contexts (ChatContext, BusinessConfigurationContext, etc.) from mounting until session ready

3. **BusinessConfigurationContext**: Added session checks before API calls
   - `loadConfiguration()` checks for `session?.accessToken` before making any API calls
   - `useEffect` waits for both `businessId` AND `session?.accessToken` before loading
   - `loadOrgChart()` also checks for session before making calls
   - All API calls use `session!.accessToken` directly after session check

4. **ChatContext**: Already had proper session checks (no changes needed)

**Files Modified:**
- `web/src/app/auth/login/page.tsx` - Updated `waitForSession()` to poll for actual session availability
- `web/src/components/auth/SessionReadyGate.tsx` - NEW: Global gate component that prevents providers from mounting without session
- `web/src/app/layout.tsx` - Wrapped authenticated provider stack with `SessionReadyGate`
- `web/src/contexts/BusinessConfigurationContext.tsx` - Added session checks in `loadConfiguration()` and `loadOrgChart()`, updated `useEffect` dependencies

**Technical Implementation:**
```typescript
// 1. Login page - waitForSession() now actually checks for session
async function waitForSession() {
  const maxWait = 5000; // 5 seconds max
  const checkInterval = 100; // Check every 100ms
  const minDelay = 300; // Minimum 300ms for cookie propagation
  const startTime = Date.now();
  
  // First, wait minimum delay for cookie propagation
  await new Promise(resolve => setTimeout(resolve, minDelay));
  
  // Then poll for actual session availability
  while (Date.now() - startTime < maxWait) {
    try {
      const session = await getSession();
      if (session?.accessToken) {
        console.log('Session confirmed with access token, redirecting...');
        return; // Session is ready
      }
    } catch (error) {
      console.warn('Error checking session:', error);
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.warn('Session wait timeout reached, proceeding anyway');
}

// 2. SessionReadyGate - Global gate preventing provider mounting
export function SessionReadyGate({ children }: SessionReadyGateProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const publicRoutes = ['/auth/login', '/auth/register', '/landing', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

  const isReady = useMemo(() => {
    // Public routes always render immediately
    if (isPublicRoute) return true;
    
    // For protected routes, wait for session token
    if (status === 'loading') return false;
    if (status === 'unauthenticated') return true; // Route protection handles redirect
    
    // Authenticated state requires access token
    return Boolean(session?.accessToken);
  }, [status, session?.accessToken, pathname, isPublicRoute]);

  if (!isReady) {
    return <LoadingSpinner />; // Shows "Establishing secure session..." message
  }

  return <>{children}</>;
}

// 3. BusinessConfigurationContext - session check before API calls
const loadConfiguration = useCallback(async (businessId: string) => {
  // Don't proceed if session is not ready
  if (!session?.accessToken) {
    console.log('[BusinessConfig] Waiting for session before loading configuration...');
    return;
  }
  // ... rest of function
}, [session?.accessToken]);

// useEffect waits for both businessId and session
useEffect(() => {
  const targetBusinessId = workCredentials?.businessId || businessId;
  
  // Only load if we have both businessId and session token
  if (targetBusinessId && session?.accessToken) {
    loadConfiguration(targetBusinessId);
    subscribeToUpdates(targetBusinessId);
  }
}, [workCredentials?.businessId, businessId, session?.accessToken, ...]);
```

**Layout Integration:**
```typescript
// web/src/app/layout.tsx
<SessionProvider>
  <SessionReadyGate>  {/* NEW: Gate prevents providers from mounting without session */}
    <WorkAuthProvider>
      <DashboardProvider>
        <GlobalBrandingProvider>
          <GlobalSearchProvider>
            <ChatProvider>
              <GlobalTrashProvider>
                {/* ... rest of providers */}
              </GlobalTrashProvider>
            </ChatProvider>
          </GlobalSearchProvider>
        </GlobalBrandingProvider>
      </DashboardProvider>
    </WorkAuthProvider>
  </SessionReadyGate>
</SessionProvider>
```

**Verification:**
- ✅ No 403 errors on initial login
- ✅ Dashboard loads correctly on first try
- ✅ No "Failed to load dashboards" message
- ✅ Business configuration loads without errors
- ✅ Chat conversations load without errors
- ✅ Org chart data loads without errors
- ✅ Smooth user experience without page reload required
- ✅ NEXT_REDIRECT error still appears (expected Next.js behavior, harmless)

---

## Previous Session Issues & Solutions (January 2025)

### **API Routing Issues - RESOLVED** ✅

#### **Problem**: 404 Errors for Multiple API Endpoints
**Symptoms:**
```
GET https://vssyl.com/api/features/all 404 (Not Found)
GET https://vssyl.com/api/chat/api/chat/conversations 404 (Not Found)
```

**Root Causes:**
1. **Environment Variable Issues**: Next.js API routes using undefined `process.env.NEXT_PUBLIC_API_URL`
2. **Double Path Issues**: Chat API functions passing `/api/chat/conversations` as endpoint, but `apiCall` already adding `/api/chat` prefix

**Solutions Applied:**
1. **Fixed Environment Variables**: Updated all 9 Next.js API route files to use `process.env.NEXT_PUBLIC_API_BASE_URL` with proper fallback
2. **Fixed Chat API Paths**: Removed `/api/chat` prefix from all endpoint calls in `web/src/api/chat.ts`

**Files Modified:**
- `web/src/app/api/features/all/route.ts`
- `web/src/app/api/features/check/route.ts`
- `web/src/app/api/features/module/route.ts`
- `web/src/app/api/features/usage/route.ts`
- `web/src/app/api/trash/items/route.ts`
- `web/src/app/api/trash/delete/[id]/route.ts`
- `web/src/app/api/trash/restore/[id]/route.ts`
- `web/src/app/api/trash/empty/route.ts`
- `web/src/app/api/[...slug]/route.ts`
- `web/src/api/chat.ts`

**Verification:**
- All endpoints now return authentication errors instead of 404s
- Build deployed successfully (Build ID: 8990f80d-b65b-4adf-948e-4a6ad87fe7fc)

---

### **Browser Cache Issues - IDENTIFIED** ⚠️

#### **Problem**: Users See Old Error Logs After Deployment
**Symptoms:**
```
API Call Debug: {endpoint: '/api/features/all', API_BASE_URL: '', NEXT_PUBLIC_API_BASE_URL: undefined, NEXT_PUBLIC_API_URL: undefined, finalUrl: '/api/features/all', …}
```

**Root Cause**: Browser cache holding old JavaScript files from previous deployment

**Solutions:**
1. **Hard Refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear Browser Cache**: 
   - Open Developer Tools (`F12`)
   - Right-click refresh button
   - Select "Empty Cache and Hard Reload"
3. **Incognito Mode**: Test in private/incognito window to bypass cache

**Verification**: API endpoints work correctly when tested directly with curl commands

---

### **WebSocket Connection Issues - EXPECTED BEHAVIOR** 🔌

#### **Problem**: WebSocket Connection Failures
**Symptoms:**
```
WebSocket connection to 'wss://vssyl-server-235369681725.us-central1.run.app/socket.io/' failed
🔄 Attempting to reconnect (1/5)
🔄 Attempting to reconnect (2/5)
...
❌ Max reconnection attempts reached
```

**Root Cause**: WebSocket requires authentication; fails when user is not logged in or session is invalid

**Status**: **EXPECTED BEHAVIOR** - This is normal when:
- User is not authenticated
- Session token is expired
- User is not logged in

**Configuration**: Socket.IO is properly configured on backend with:
- CORS settings for allowed origins
- Authentication middleware
- Proper error handling

**Resolution**: WebSocket will connect successfully once user is properly authenticated with valid session token

---

## Build System Issues - RESOLVED ✅

### **Problem**: Builds Taking 20+ Minutes
**Root Cause**: Machine type configuration issues in Cloud Build

**Solution**: 
- Switched to E2_HIGHCPU_8 machine type
- Optimized Cloud Build configuration
- Removed problematic environment variable settings

**Result**: Builds now complete in 7-8 minutes consistently

---

## Common Troubleshooting Steps

### **For API Issues:**
1. **Check Build Status**: Verify latest build deployed successfully
2. **Test Endpoints Directly**: Use curl to test API endpoints
3. **Clear Browser Cache**: Hard refresh to get latest frontend code
4. **Check Authentication**: Ensure user is properly logged in

### **For WebSocket Issues:**
1. **Check Authentication**: WebSocket requires valid session token
2. **Verify Backend Status**: Ensure server is running and accessible
3. **Check CORS Settings**: Verify allowed origins in Socket.IO configuration

### **For Build Issues:**
1. **Check Cloud Build Logs**: Review build logs for specific errors
2. **Verify Machine Type**: Ensure E2_HIGHCPU_8 is available in region
3. **Check Environment Variables**: Verify no problematic env var settings

---

## Environment Variable Reference

### **Frontend Environment Variables:**
- `NEXT_PUBLIC_API_BASE_URL` - Primary API base URL (preferred)
- `NEXT_PUBLIC_API_URL` - Fallback API URL
- `NEXT_PUBLIC_WS_URL` - WebSocket URL (optional)

### **Backend Environment Variables:**
- `BACKEND_URL` - Backend server URL
- `DATABASE_URL` - Database connection string
- `FRONTEND_URL` - Frontend URL for CORS

### **Fallback Hierarchy:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
                    process.env.NEXT_PUBLIC_API_URL || 
                    'https://vssyl-server-235369681725.us-central1.run.app';
```

---

## Production URLs

### **Service Endpoints:**
- **Frontend**: https://vssyl.com
- **Backend**: https://vssyl-server-235369681725.us-central1.run.app
- **WebSocket**: wss://vssyl-server-235369681725.us-central1.run.app/socket.io/

### **API Proxy:**
- Next.js API routes at `/api/*` proxy to backend server
- Authentication handled via NextAuth session tokens
- CORS configured for production domains

---

## Known Issues & Workarounds

### **Browser Cache After Deployment:**
- **Issue**: Users see old error logs after successful deployment
- **Workaround**: Always instruct users to hard refresh after deployment
- **Prevention**: Consider implementing cache-busting strategies

### **WebSocket Authentication:**
- **Issue**: WebSocket fails when user not authenticated
- **Workaround**: This is expected behavior, not an error
- **Documentation**: Clearly document that WebSocket requires authentication

### **Environment Variable Consistency:**
- **Issue**: Mixed usage of `NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL`
- **Solution**: Standardized on `NEXT_PUBLIC_API_BASE_URL` as primary
- **Prevention**: Use consistent naming across all files

---

## Testing Checklist

### **After Each Deployment:**
- [ ] Test API endpoints with curl
- [ ] Verify frontend loads without console errors
- [ ] Check authentication flow
- [ ] Test WebSocket connection (when authenticated)
- [ ] Verify environment variables in browser console

### **For New Features:**
- [ ] Test API routing
- [ ] Verify environment variable usage
- [ ] Check WebSocket integration
- [ ] Test authentication requirements
- [ ] Verify CORS settings

---

## Contact & Support

### **Build Issues:**
- Check Cloud Build logs in Google Cloud Console
- Verify machine type availability
- Check environment variable configuration

### **API Issues:**
- Test endpoints directly with curl
- Check browser network tab
- Verify authentication status

### **WebSocket Issues:**
- Check authentication status
- Verify backend server status
- Check CORS configuration

---

*Last Updated: November 2025*
*Session: Session Timing Fix - Comprehensive Session Readiness Checks*
