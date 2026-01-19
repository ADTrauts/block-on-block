'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Camera, User, Building, AlertCircle } from 'lucide-react';
import { Button } from 'shared/components';
import { toast } from 'react-hot-toast';
import PhotoCropModal from './PhotoCropModal';

interface PhotoUploadProps {
  currentPhoto?: string | null;
  photoType: 'personal' | 'business';
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export default function PhotoUpload({
  currentPhoto,
  photoType,
  onUpload,
  onRemove,
  disabled = false,
  className = ''
}: PhotoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const isPersonal = photoType === 'personal';
  const icon = isPersonal ? User : Building;
  const title = isPersonal ? 'Personal Photo' : 'Business Photo';
  const description = isPersonal 
    ? 'Your personal profile photo for casual contexts'
    : 'Your professional photo for business contexts';

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError(null);
    // Open crop editor before uploading
    setPendingFile(file);
    setCropOpen(true);
  }, [onUpload, title]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, isUploading, handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemove = async () => {
    if (disabled || isUploading) return;

    try {
      await onRemove();
      toast.success(`${title} removed successfully!`);
    } catch (err) {
      console.error('Remove error:', err);
      setError('Failed to remove photo. Please try again.');
      toast.error('Failed to remove photo');
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleCroppedUpload = async (result: { originalFile?: File; crop: { x: number; y: number; width: number; height: number; rotation: number; zoom: number } }) => {
    if (!result.originalFile) {
      toast.error('No file provided');
      return;
    }
    setIsUploading(true);
    try {
      // Backward compat: upload expects a single file; until profile settings migrates
      // to library mode, we upload the original and let the server generate avatar via crop params.
      // The uploadProfilePhoto API now accepts crop params.
      // We pass the original file here; the caller's onUpload should attach crop params.
      await onUpload(result.originalFile);
      toast.success(`${title} uploaded successfully!`);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
      toast.error('Failed to upload photo');
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      setCropOpen(false);
    }
  };

  const IconComponent = icon;

  return (
    <div className={`space-y-4 ${className}`}>
      <PhotoCropModal
        open={cropOpen}
        imageFile={pendingFile}
        title={`Crop ${title}`}
        onClose={() => {
          if (isUploading) return;
          setCropOpen(false);
          setPendingFile(null);
        }}
        onConfirm={handleCroppedUpload}
      />

      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isPersonal ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
        }`}>
          <IconComponent className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>

      {/* Current Photo Display */}
      {currentPhoto && (
        <div className="relative">
          <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200">
            <img
              src={currentPhoto}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={handleRemove}
            disabled={disabled || isUploading}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      {!currentPhoto && (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || isUploading}
          />
          
          <div className="space-y-3">
            {isUploading ? (
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
            ) : (
              <div className="flex justify-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isPersonal ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <Camera className={`w-6 h-6 ${
                    isPersonal ? 'text-blue-600' : 'text-green-600'
                  }`} />
                </div>
              </div>
            )}
            
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF up to 5MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Button for when photo exists */}
      {currentPhoto && (
        <Button
          onClick={handleClick}
          disabled={disabled || isUploading}
          variant="secondary"
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Change Photo'}
        </Button>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Guidelines */}
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Personal Photo:</strong> Use for casual contexts, personal dashboards, and social features.</p>
        <p><strong>Business Photo:</strong> Use for professional contexts, business workspaces, and work-related features.</p>
        <p>Photos should be clear, well-lit, and appropriate for the context.</p>
      </div>
    </div>
  );
}
