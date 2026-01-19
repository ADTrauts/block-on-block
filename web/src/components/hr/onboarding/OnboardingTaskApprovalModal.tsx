'use client';

import React, { useState } from 'react';
import { Modal, Button, Spinner, Alert } from 'shared/components';
import { CheckCircle2, XCircle, FileText, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import OnboardingTaskStatusBadge from './OnboardingTaskStatusBadge';
import OnboardingTaskTypeIcon from './OnboardingTaskTypeIcon';
import OnboardingChatIntegration from './integrations/OnboardingChatIntegration';
import type { TeamOnboardingTask } from '@/api/hrOnboarding';

interface OnboardingTaskApprovalModalProps {
  task: TeamOnboardingTask;
  businessId: string;
  onApprove: (approved: boolean, notes?: string) => Promise<void>;
  onReject: (notes?: string) => Promise<void>;
  onClose: () => void;
}

export default function OnboardingTaskApprovalModal({
  task,
  businessId,
  onApprove,
  onReject,
  onClose,
}: OnboardingTaskApprovalModalProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const employeeName =
    task.onboardingJourney.employeeHrProfile?.employeePosition?.user?.name ||
    task.onboardingJourney.employeeHrProfile?.employeePosition?.user?.email ||
    'Team member';

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      setAction('approve');
      await onApprove(true, notes.trim() || undefined);
    } catch (error) {
      console.error('Failed to approve task:', error);
      throw error;
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      setAction('reject');
      await onReject(notes.trim() || undefined);
    } catch (error) {
      console.error('Failed to reject task:', error);
      throw error;
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const hasDocument = (task.metadata as { documentFileId?: string })?.documentFileId;
  const hasEquipmentRequest = !!(task.metadata as { equipmentRequest?: unknown })?.equipmentRequest;

  return (
    <Modal open={true} onClose={onClose} title="Review Onboarding Task">
      <div className="space-y-4">
        {/* Task Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                task.status === 'COMPLETED'
                  ? 'bg-green-100'
                  : task.status === 'IN_PROGRESS'
                  ? 'bg-blue-100'
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
                    : 'text-gray-500'
                }
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                <OnboardingTaskStatusBadge status={task.status} />
              </div>
              {task.description && (
                <p className="text-sm text-gray-600 mb-2">{task.description}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <User className="w-4 h-4" />
                <span className="font-medium">Employee</span>
              </div>
              <p className="text-gray-900">{employeeName}</p>
            </div>
            {task.dueDate && (
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">Due Date</span>
                </div>
                <p className="text-gray-900">
                  {format(new Date(task.dueDate), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Employee Submission */}
        {task.notes && typeof task.notes === 'string' ? (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Employee Notes</h4>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">{task.notes}</p>
            </div>
          </div>
        ) : null}

        {hasDocument && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Document</h4>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-700">
                Document uploaded: {(task.metadata as { documentFileName?: string })?.documentFileName || 'Document'}
              </span>
            </div>
          </div>
        )}

        {hasEquipmentRequest && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Equipment Request</h4>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                Equipment request submitted. Review the details in the task metadata.
              </p>
            </div>
          </div>
        )}

        {/* Manager Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Add any notes or feedback for the employee..."
          />
        </div>

        {/* Integration Actions */}
        <div className="flex items-center gap-2 pt-3 border-t">
          <OnboardingChatIntegration
            businessId={businessId}
            employeeUserId={task.onboardingJourney.employeeHrProfile?.employeePosition?.user?.id}
            employeeName={employeeName}
            className="flex-1"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {task.requiresApproval ? (
            <>
              <Button
                variant="secondary"
                onClick={handleReject}
                disabled={submitting}
              >
                {submitting && action === 'reject' ? (
                  <>
                    <span className="mr-2"><Spinner size={16} /></span>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting && action === 'approve' ? (
                  <>
                    <span className="mr-2"><Spinner size={16} /></span>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="mr-2"><Spinner size={16} /></span>
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Mark Complete
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

