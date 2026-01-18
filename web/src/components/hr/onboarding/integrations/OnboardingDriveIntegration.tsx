'use client';

import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Spinner, Alert } from 'shared/components';
import { Upload, FileText, X } from 'lucide-react';
import { uploadFile } from '@/api/drive';
import { getOnboardingDocumentLibrary } from '@/api/hrOnboarding';
import { useModuleIntegration } from '@/hooks/useModuleIntegration';
import { toast } from 'react-hot-toast';

interface OnboardingDriveIntegrationProps {
  businessId: string;
  taskId: string;
  onDocumentUploaded?: (fileId: string, fileName: string) => void;
  existingFileId?: string;
  existingFileName?: string;
}

export default function OnboardingDriveIntegration({
  businessId,
  taskId,
  onDocumentUploaded,
  existingFileId,
  existingFileName,
}: OnboardingDriveIntegrationProps) {
  const { data: session } = useSession();
  const { hasDrive, loading: moduleLoading } = useModuleIntegration(businessId);
  const [uploading, setUploading] = useState(false);
  const [documentLibrary, setDocumentLibrary] = useState<{ folderId: string; dashboardId: string } | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Load document library folder
  const loadDocumentLibrary = useCallback(async () => {
    if (!businessId) return;

    try {
      setLoadingLibrary(true);
      const data = await getOnboardingDocumentLibrary(businessId);
      setDocumentLibrary({
        folderId: data.folderId,
        dashboardId: data.dashboardId,
      });
    } catch (err) {
      console.error('Failed to load document library:', err);
      toast.error('Failed to load document library');
    } finally {
      setLoadingLibrary(false);
    }
  }, [businessId]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !session?.accessToken || !documentLibrary) {
        return;
      }

      try {
        setUploading(true);
        const uploaded = await uploadFile(
          session.accessToken,
          file,
          documentLibrary.folderId,
          false,
          documentLibrary.dashboardId
        );

        toast.success('Document uploaded successfully');
        onDocumentUploaded?.(uploaded.id, uploaded.name);
      } catch (err) {
        console.error('Failed to upload document:', err);
        toast.error('Failed to upload document');
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [session?.accessToken, documentLibrary, onDocumentUploaded]
  );

  // Load library on mount if Drive is available
  React.useEffect(() => {
    if (hasDrive && !documentLibrary && !loadingLibrary) {
      void loadDocumentLibrary();
    }
  }, [hasDrive, documentLibrary, loadingLibrary, loadDocumentLibrary]);

  if (moduleLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={16} />
      </div>
    );
  }

  if (!hasDrive) {
    return (
      <Alert type="info" title="Drive module not installed">
        <p className="text-sm text-gray-600">
          Install the Drive module to upload documents for onboarding tasks.
        </p>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {existingFileId && existingFileName && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">{existingFileName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDocumentUploaded?.('', '');
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div>
        <input
          type="file"
          id={`onboarding-upload-${taskId}`}
          className="hidden"
          onChange={handleFileUpload}
          disabled={uploading || !documentLibrary}
        />
        <label htmlFor={`onboarding-upload-${taskId}`}>
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading || !documentLibrary}
            className="w-full"
            as="span"
          >
            {uploading ? (
              <>
                <Spinner size={16} className="mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {existingFileId ? 'Replace Document' : 'Upload Document'}
              </>
            )}
          </Button>
        </label>
      </div>

      {!documentLibrary && !loadingLibrary && (
        <p className="text-xs text-gray-500">
          Document library not available. Please contact your administrator.
        </p>
      )}
    </div>
  );
}

