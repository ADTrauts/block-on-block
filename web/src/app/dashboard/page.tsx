export const dynamic = "force-dynamic";

import DashboardClient from "./DashboardClient";

/**
 * Dashboard Page - Client-Side Redirect Handler
 * 
 * This page delegates all logic to the DashboardClient component to avoid
 * server-side redirect timing issues with session cookies after login.
 * 
 * The client component will:
 * 1. Check authentication using useSession hook
 * 2. Load dashboards via DashboardContext
 * 3. Redirect to appropriate dashboard or show create dashboard UI
 * 4. Handle all errors gracefully
 */
export default function DashboardPage() {
  // Always return the client component - it handles everything client-side
  // This avoids NEXT_REDIRECT errors and session cookie timing issues
  return <DashboardClient dashboardId={null} />;
}
