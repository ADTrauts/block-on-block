'use client';

import React, { useState } from 'react';
import { Modal, Button, Spinner } from 'shared/components';
import type { EmployeeOnboardingTask, OnboardingTaskStatus } from '@/api/hrOnboarding';
import OnboardingDriveIntegration from './integrations/OnboardingDriveIntegration';

interface OnboardingTaskCompletionModalProps {
  task: EmployeeOnboardingTask;
  businessId: string;
  onComplete: (payload: { status?: OnboardingTaskStatus; notes?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  onClose: () => void;
}

export default function OnboardingTaskCompletionModal({
  task,
  businessId,
  onComplete,
  onClose,
}: OnboardingTaskCompletionModalProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [documentFileId, setDocumentFileId] = useState<string | undefined>(
    (task.metadata as { documentFileId?: string })?.documentFileId
  );
  const [documentFileName, setDocumentFileName] = useState<string | undefined>(
    (task.metadata as { documentFileName?: string })?.documentFileName
  );

  const handleDocumentUploaded = (fileId: string, fileName: string) => {
    setDocumentFileId(fileId);
    setDocumentFileName(fileName);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const metadata: Record<string, unknown> = {
        ...(task.metadata || {}),
      };
      
      if (documentFileId) {
        metadata.documentFileId = documentFileId;
        metadata.documentFileName = documentFileName;
      }

      await onComplete({
        status: 'COMPLETED',
        notes: notes.trim() || undefined,
        metadata,
      });
    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const requiresDocument = (task.metadata as { requiresDocument?: boolean })?.requiresDocument || false;
  const hasRequiredDocument = requiresDocument && documentFileId;
  const canComplete = !requiresDocument || hasRequiredDocument;

  return (
    <Modal open={true} onClose={onClose} title="Complete Task">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-gray-600">{task.description}</p>
          )}
        </div>

        {requiresDocument && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Required Document {hasRequiredDocument && <span className="text-green-600">✓</span>}
            </label>
            {!hasRequiredDocument && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 mb-2">
                  ⚠️ This task requires a document upload. Please upload the required document before completing.
                </p>
              </div>
            )}
            <OnboardingDriveIntegration
              businessId={businessId}
              taskId={task.id}
              onDocumentUploaded={handleDocumentUploaded}
              existingFileId={documentFileId}
              existingFileName={documentFileName}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Add any notes or comments about completing this task..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !canComplete}
          >
            {submitting ? (
              <>
                <span className="mr-2"><Spinner size={16} /></span>
                Completing...
              </>
            ) : (
              'Mark as Complete'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

