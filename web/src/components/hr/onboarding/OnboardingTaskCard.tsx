'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Modal, Spinner } from 'shared/components';
import { format } from 'date-fns';
import { CheckCircle2, Upload, Package, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import OnboardingTaskStatusBadge from './OnboardingTaskStatusBadge';
import OnboardingTaskTypeIcon from './OnboardingTaskTypeIcon';
import OnboardingDocumentUpload from './integrations/OnboardingDriveIntegration';
import OnboardingCalendarIntegration from './integrations/OnboardingCalendarIntegration';
import OnboardingChatIntegration from './integrations/OnboardingChatIntegration';
import OnboardingEquipmentRequest from './OnboardingEquipmentRequest';
import OnboardingTaskCompletionModal from './OnboardingTaskCompletionModal';
import OnboardingFormTask from './OnboardingFormTask';
import type { EmployeeOnboardingTask, OnboardingTaskStatus } from '@/api/hrOnboarding';

interface OnboardingTaskCardProps {
  task: EmployeeOnboardingTask;
  businessId: string;
  onComplete: (taskId: string, payload: { status?: OnboardingTaskStatus; notes?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  isCompleting?: boolean;
}

export default function OnboardingTaskCard({
  task,
  businessId,
  onComplete,
  isCompleting = false,
}: OnboardingTaskCardProps) {
  const { data: session } = useSession();
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  const isActionable =
    task.ownerType === 'EMPLOYEE' &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';

  const handleComplete = async (payload: { status?: OnboardingTaskStatus; notes?: string; metadata?: Record<string, unknown> }) => {
    await onComplete(task.id, payload);
    setShowCompletionModal(false);
  };

  // If this is a FORM task, render the form component instead
  if (task.taskType === 'FORM' && task.ownerType === 'EMPLOYEE') {
    return (
      <OnboardingFormTask
        task={task}
        businessId={businessId}
        onComplete={onComplete}
        isCompleting={isCompleting}
      />
    );
  }

  return (
    <>
      <Card className={`p-4 ${isOverdue ? 'border-red-300 bg-red-50' : ''}`}>
        <div className="flex items-start gap-4">
          {/* Task Icon */}
          <div className="flex-shrink-0">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                task.status === 'COMPLETED'
                  ? 'bg-green-100'
                  : task.status === 'IN_PROGRESS'
                  ? 'bg-blue-100'
                  : task.status === 'BLOCKED'
                  ? 'bg-red-100'
                  : 'bg-gray-100'
              }`}
            >
              <OnboardingTaskTypeIcon
                type={task.taskType}
                size={20}
                className={
                  task.status === 'COMPLETED'
                    ? 'text-green-600'
                    : task.status === 'IN_PROGRESS'
                    ? 'text-blue-600'
                    : task.status === 'BLOCKED'
                    ? 'text-red-600'
                    : 'text-gray-500'
                }
              />
            </div>
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                  <OnboardingTaskStatusBadge status={task.status} />
                  {isOverdue && (
                    <span className="text-xs text-red-600 font-medium">Overdue</span>
                  )}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="capitalize">{task.taskType.toLowerCase()}</span>
                  {task.ownerType && (
                    <span className="capitalize">Owner: {task.ownerType.toLowerCase()}</span>
                  )}
                  {task.dueDate && (
                    <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                      Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
                    </span>
                  )}
                  {task.requiresApproval && (
                    <span className="text-orange-600">Requires approval</span>
                  )}
                </div>
              </div>
            </div>

            {/* Task Actions */}
            {isActionable && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {(task.metadata as { requiresDocument?: boolean })?.requiresDocument && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDocumentUpload(!showDocumentUpload)}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {showDocumentUpload ? 'Hide Upload' : 'Upload Document'}
                  </Button>
                )}

                {task.taskType === 'EQUIPMENT' && (
                  <OnboardingEquipmentRequest
                    task={task}
                    businessId={businessId}
                    onRequestSubmitted={(equipmentData) => {
                      // Store equipment request in task metadata
                      handleComplete({
                        metadata: {
                          ...task.metadata,
                          equipmentRequest: equipmentData,
                        },
                      });
                    }}
                  />
                )}

                {task.taskType === 'MEETING' || task.taskType === 'TRAINING' ? (
                  <OnboardingCalendarIntegration
                    businessId={businessId}
                    task={task}
                    employeeName={session?.user?.name || undefined}
                  />
                ) : null}

                <OnboardingChatIntegration
                  businessId={businessId}
                  className="inline-block"
                />

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCompletionModal(true)}
                  disabled={isCompleting}
                >
                  {isCompleting ? (
                    <>
                      <span className="mr-1"><Spinner size={16} /></span>
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Complete Task
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Document Upload Section */}
            {showDocumentUpload && (task.metadata as { requiresDocument?: boolean })?.requiresDocument && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <OnboardingDocumentUpload
                  businessId={businessId}
                  taskId={task.id}
                  onDocumentUploaded={(fileId, fileName) => {
                    // Store file ID in task metadata
                    handleComplete({
                      metadata: {
                        ...task.metadata,
                        documentFileId: fileId,
                        documentFileName: fileName,
                      },
                    });
                  }}
                  existingFileId={
                    (task.metadata as { documentFileId?: string })?.documentFileId
                  }
                  existingFileName={
                    (task.metadata as { documentFileName?: string })?.documentFileName
                  }
                />
              </div>
            )}

            {/* Completed Info */}
            {task.status === 'COMPLETED' && task.completedAt && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>
                    Completed {format(new Date(task.completedAt), 'MMM d, yyyy')}
                  </span>
                </div>
                {task.notes && (
                  <p className="text-sm text-gray-600 mt-1 ml-6">{task.notes}</p>
                )}
              </div>
            )}

            {/* Blocked Info */}
            {task.status === 'BLOCKED' && (
              <div className="mt-3 pt-3 border-t border-red-200 bg-red-50 rounded p-2">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>This task is blocked. Please contact your manager or HR.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Completion Modal */}
      {showCompletionModal && (
        <OnboardingTaskCompletionModal
          task={task}
          businessId={businessId}
          onComplete={handleComplete}
          onClose={() => setShowCompletionModal(false)}
        />
      )}
    </>
  );
}

