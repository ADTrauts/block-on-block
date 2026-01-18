'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, Alert } from 'shared/components';
import { MessageSquare } from 'lucide-react';
import { useModuleIntegration } from '@/hooks/useModuleIntegration';
import { businessAPI } from '@/api/business';

interface OnboardingChatIntegrationProps {
  businessId: string;
  hrUserId?: string;
  employeeUserId?: string;
  employeeName?: string;
  className?: string;
}

export default function OnboardingChatIntegration({
  businessId,
  hrUserId: providedHrUserId,
  employeeUserId,
  employeeName,
  className = '',
}: OnboardingChatIntegrationProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { hasChat, loading: moduleLoading } = useModuleIntegration(businessId);
  const [hrUserId, setHrUserId] = useState<string | undefined>(providedHrUserId);
  const [loadingHrUser, setLoadingHrUser] = useState(false);

  // Load HR admin user ID from business members if not provided
  useEffect(() => {
    if (providedHrUserId || !businessId || !session?.accessToken) {
      return;
    }

    const loadHrUserId = async () => {
      try {
        setLoadingHrUser(true);
        const response = await businessAPI.getBusiness(businessId);
        if (response.success) {
          const business = response.data as { members?: Array<{ role: string; user: { id: string } }> };
          // Find first ADMIN member as HR contact
          const adminMember = business.members?.find(m => m.role === 'ADMIN');
          if (adminMember) {
            setHrUserId(adminMember.user.id);
          }
        }
      } catch (err) {
        console.error('Failed to load HR user ID:', err);
      } finally {
        setLoadingHrUser(false);
      }
    };

    void loadHrUserId();
  }, [businessId, providedHrUserId, session?.accessToken]);

  const handleStartChat = () => {
    // If employeeUserId is provided, chat with that employee
    // Otherwise, chat with HR
    const targetUserId = employeeUserId || hrUserId;
    if (!targetUserId) {
      return;
    }

    // Navigate to chat
    const chatUrl = employeeUserId
      ? `/chat?userId=${employeeUserId}&context=business:${businessId}`
      : `/chat?userId=${hrUserId}&context=business:${businessId}`;
    router.push(chatUrl);
  };

  if (moduleLoading || loadingHrUser) {
    return null;
  }

  if (!hasChat) {
    return (
      <Alert type="info" title="Chat module not installed" className={className}>
        <p className="text-sm text-gray-600">
          Install the Chat module to start conversations with HR about onboarding questions.
        </p>
      </Alert>
    );
  }

  const targetUserId = employeeUserId || hrUserId;
  if (!targetUserId) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleStartChat}
      className={className}
    >
      <MessageSquare className="w-4 h-4 mr-2" />
      {employeeUserId
        ? `Message ${employeeName || 'Employee'}`
        : employeeName
        ? `Ask HR about ${employeeName}'s onboarding`
        : 'Ask HR Questions'}
    </Button>
  );
}

