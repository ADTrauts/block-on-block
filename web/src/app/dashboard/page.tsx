export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDashboards } from "@/api/dashboard";
import { getUserPreference } from "@/api/user";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      redirect("/auth/login");
      return null; // TypeScript guard
    }

    if (!session.accessToken) {
      redirect("/auth/login");
      return null; // TypeScript guard
    }

    try {
      const dashboardsObj = await getDashboards(session.accessToken);
      const dashboards = [
        ...(dashboardsObj?.personal || []),
        ...(dashboardsObj?.business || []),
        ...(dashboardsObj?.educational || [])
      ];
      
      if (dashboards.length > 0) {
        // Try to get the last active dashboard
        try {
          const lastActiveDashboardId = await getUserPreference('lastActiveDashboardId', session.accessToken);
          
          if (lastActiveDashboardId) {
            // Check if the last active dashboard still exists and is accessible
            const lastActiveDashboard = dashboards.find(d => d.id === lastActiveDashboardId);
            if (lastActiveDashboard) {
              redirect(`/dashboard/${lastActiveDashboardId}`);
              return null; // TypeScript guard
            }
          }
        } catch (prefError) {
          // If preference fetch fails, just continue to first dashboard
          console.warn('Failed to fetch last active dashboard preference:', prefError);
        }
        
        // Fallback to the first dashboard
        redirect(`/dashboard/${dashboards[0].id}`);
        return null; // TypeScript guard
      } else {
        // No dashboards exist, show create dashboard page
        return <DashboardClient dashboardId={null} />;
      }
    } catch (error) {
      // If there's an error fetching dashboards, log details and show create dashboard page
      console.error('Error loading dashboards:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        hasSession: !!session,
        hasAccessToken: !!session?.accessToken
      });
      return <DashboardClient dashboardId={null} />;
    }
  } catch (error) {
    // If there's an error with session, log details and redirect to login
    console.error('Error in dashboard page:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name || typeof error
    });
    redirect("/auth/login");
    return null; // TypeScript guard
  }
}
