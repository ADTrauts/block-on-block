'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ModuleSettingsProvider } from '@/contexts/ModuleSettingsContext';

interface BusinessModulesLayoutProps {
  children: ReactNode;
}

export default function BusinessModulesLayout({ children }: BusinessModulesLayoutProps) {
  const params = useParams();
  const businessId = params?.id as string | undefined;

  return (
    <ModuleSettingsProvider businessId={businessId}>
      {children}
    </ModuleSettingsProvider>
  );
}

