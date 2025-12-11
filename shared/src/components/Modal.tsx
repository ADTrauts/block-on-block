"use client";

import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  headerActions?: React.ReactNode;
}

const sizeClasses = {
  small: 'max-w-sm',
  medium: 'max-w-md',
  large: 'max-w-lg',
  xlarge: 'max-w-5xl',
} as const;

export const Modal: React.FC<ModalProps> = ({ 
  open, 
  onClose, 
  children, 
  title,
  size = 'medium',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  headerActions,
}) => {
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [onClose, closeOnEscape]);

  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose, closeOnOverlayClick]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        overflowY: 'auto',
        padding: '20px 0',
      }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div 
        className={`bg-white rounded-lg shadow-2xl p-6 relative ${sizeClasses[size]} w-full mx-4 my-8`}
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '24px',
          position: 'relative',
          zIndex: 10000,
          maxWidth: size === 'small' ? '384px' : size === 'medium' ? '448px' : size === 'large' ? '512px' : '1024px',
          width: '100%',
          margin: '32px 16px',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
        }}
        role="document"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {title && (
              <h2 
                id="modal-title"
                className="text-lg font-semibold text-gray-900"
                style={{ color: '#111827' }}
              >
                {title}
              </h2>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {headerActions}
            <button
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              style={{
                color: '#9CA3AF',
                cursor: 'pointer',
              }}
              onClick={onClose}
              aria-label="Close modal"
            >
              <span className="sr-only">Close</span>
              <svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-2">
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return ReactDOM.createPortal(modalContent, document.body);
}; 