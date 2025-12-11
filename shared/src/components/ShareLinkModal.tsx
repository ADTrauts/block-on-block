"use client";

import React, { useState } from 'react';
import { XMarkIcon, LinkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Button } from './Button';

type ShareLinkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemType: 'file' | 'folder';
  shareLink: string;
  email: string;
};

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  itemName,
  itemType,
  shareLink,
  email
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Share Link Generated</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>{email}</strong> is not registered on Vssyl. A shareable link has been generated that you can send to them.
            </p>
          </div>

          {/* Item Info */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">{itemName}</span>
            <span className="text-gray-400"> ({itemType})</span>
          </div>

          {/* Share Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Shareable Link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none cursor-text"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
              <Button
                onClick={handleCopy}
                variant={copied ? 'secondary' : 'primary'}
                size="md"
                className="flex-shrink-0"
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  'Copy'
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-3">
            <p className="font-medium mb-1">What happens next?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Copy the link above</li>
              <li>Send it to {email} via email, message, or any other method</li>
              <li>They can access the {itemType} using this link</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <Button
            onClick={onClose}
            variant="secondary"
            size="md"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

