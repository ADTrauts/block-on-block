import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { BusinessConfigurationProvider } from '../../../../contexts/BusinessConfigurationContext';
import { PositionAwareModuleProvider } from '../../../../components/PositionAwareModuleProvider';
import { SidebarCustomizationProvider } from '../../../../contexts/SidebarCustomizationContext';
import DashboardLayoutWrapper from '../../../../components/business/DashboardLayoutWrapper';
import { serverBusinessApiCall } from '../../../../lib/serverApiUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

export default async function Layout({ children, params }: { children: React.ReactNode, params: { id: string } }) {
  let session;
  let token: string | undefined;
  
  try {
    session = await getServerSession(authOptions);
    token = session?.accessToken;
  } catch (error) {
    console.error('Session fetch error (non-critical, will be handled by client):', error);
  }
  
  // Don't redirect immediately - let the client-side handle it if session is missing
  // This prevents redirect loops during client-side navigation
  
  let business = null;
  if (token) {
    try {
      const response = await serverBusinessApiCall<{ success: boolean; data: any }>(`/${params.id}`, { method: 'GET' }, token);
      if (response.success) {
        business = response.data;
      }
    } catch (error: any) {
      console.error('Error fetching business:', error);
      
      // Handle business not found specifically
      if (error.message?.includes('Business not found') || error.status === 404) {
        console.error(`Business with ID ${params.id} not found`);
        return notFound();
      }
      
      // For auth errors, let the client handle them (don't redirect here)
      if (error.status === 401 || error.status === 403) {
        console.warn('Auth error in server layout, allowing client to handle');
      }
    }
  }

  // Use params.id as fallback if business is null (e.g., auth errors)
  const businessId = business?.id || params.id;

  return (
    <BusinessConfigurationProvider businessId={businessId}>
      <PositionAwareModuleProvider>
        <SidebarCustomizationProvider>
        <DashboardLayoutWrapper business={business}>
          {children}
        </DashboardLayoutWrapper>
        </SidebarCustomizationProvider>
      </PositionAwareModuleProvider>
    </BusinessConfigurationProvider>
  );
} 