'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Folder, 
  File, 
  Upload, 
  MoreHorizontal, 
  Star, 
  Clock, 
  HardDrive,
  Eye,
  Download,
  Trash2
} from 'lucide-react';
import { Card, Button, Badge, Spinner, Alert } from 'shared/components';
import { listFiles, listFolders, uploadFile } from '../../api/drive';
import { formatBytes, formatRelativeTime } from '../../utils/format';

interface DriveWidgetProps {
  id: string;
  config?: DriveWidgetConfig;
  onConfigChange?: (config: DriveWidgetConfig) => void;
  onRemove?: () => void;
  
  // NEW: Full dashboard context
  dashboardId: string;
  dashboardType: 'personal' | 'business' | 'educational' | 'household';
  dashboardName: string;
}

interface DriveWidgetConfig {
  showRecentFiles: boolean;
  maxFilesToShow: number;
  showStorageUsage: boolean;
  showUploadButton: boolean;
  showFileActivity: boolean;
  fileTypes: string[];
  sortBy: 'name' | 'date' | 'size' | 'type';
  // Household-specific settings
  showHouseholdFiles: boolean;
  showSharedFolders: boolean;
  showFamilyActivity: boolean;
}

// File data interfaces
interface DriveFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  folder?: {
    name: string;
  };
  isShared?: boolean;
  sharedWith?: number;
}

interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
}

interface StorageUsage {
  used: number;
  total: number;
  percentage: number;
}

const defaultConfig: DriveWidgetConfig = {
  showRecentFiles: true,
  maxFilesToShow: 5,
  showStorageUsage: true,
  showUploadButton: true,
  showFileActivity: true,
  fileTypes: [],
  sortBy: 'date',
  // Household-specific defaults
  showHouseholdFiles: true,
  showSharedFolders: true,
  showFamilyActivity: true
};

export default function DriveWidget({ 
  id, 
  config = defaultConfig, 
  onConfigChange, 
  onRemove,
  dashboardId,
  dashboardType,
  dashboardName
}: DriveWidgetProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [recentFolders, setRecentFolders] = useState<FolderItem[]>([]);

  // Ensure config is never null
  const safeConfig = config || defaultConfig;
  
  // Determine dashboard context type
  const isHouseholdContext = dashboardType === 'household';
  const isBusinessContext = dashboardType === 'business';
  const isEducationalContext = dashboardType === 'educational';
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Context-aware widget content
  const getContextSpecificContent = () => {
    // Ensure dashboardName is always a string
    const safeDashboardName = dashboardName || 'My Dashboard';
    
    switch (dashboardType) {
      case 'household':
        return {
          title: `${safeDashboardName} Family File Hub`,
          emptyMessage: "No family files yet. Share photos, documents, and memories!",
          sections: ['Family Photos', 'Shared Documents', 'Family Activity'],
          color: '#f59e0b', // Yellow theme
          icon: '🏠'
        };
      case 'business':
        return {
          title: `${safeDashboardName} Work File Hub`,
          emptyMessage: "No work files yet. Upload documents and collaborate with your team!",
          sections: ['Recent Projects', 'Team Documents', 'Business Files'],
          color: '#3b82f6', // Blue theme
          icon: '💼'
        };
      case 'educational':
        return {
          title: `${safeDashboardName} School File Hub`,
          emptyMessage: "No school files yet. Upload assignments and course materials!",
          sections: ['Assignments', 'Course Materials', 'Study Documents'],
          color: '#10b981', // Green theme
          icon: '🎓'
        };
      default:
        return {
          title: 'My Personal File Hub',
          emptyMessage: "No personal files yet. Upload your first document!",
          sections: ['Recent Files', 'Personal Documents', 'My Activity'],
          color: '#6366f1', // Purple theme
          icon: '📁'
        };
    }
  };

  // Load drive data with context awareness
  useEffect(() => {
    if (!session?.accessToken || !dashboardId) return;
    
    const loadDriveData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Context-aware API calls using fetch directly
        const filesUrl = `/api/drive/files?${new URLSearchParams({
          dashboardId: dashboardId
        })}`;
        
        const foldersUrl = `/api/drive/folders?${new URLSearchParams({
          dashboardId: dashboardId
        })}`;

        const [filesResponse, foldersResponse] = await Promise.all([
          fetch(filesUrl, {
            headers: { 'Authorization': `Bearer ${session.accessToken}` }
          }),
          fetch(foldersUrl, {
            headers: { 'Authorization': `Bearer ${session.accessToken}` }
          })
        ]);

        if (!filesResponse.ok || !foldersResponse.ok) {
          throw new Error('Failed to fetch drive data');
        }

        const filesData = await filesResponse.json();
        const foldersData = await foldersResponse.json();
        const files = filesData.files || [];
        const folders = foldersData.folders || [];

        // Context-specific file processing
        let processedFiles = files;
        
        if (dashboardType === 'household') {
          // Family-focused file organization
          processedFiles = files.filter((f: DriveFile) => 
            f.tags?.includes('family') || 
            f.tags?.includes('shared') ||
            f.folder?.name?.includes('Family')
          );
        } else if (dashboardType === 'business') {
          // Business-focused files
          processedFiles = files.filter((f: DriveFile) => 
            f.tags?.includes('work') || 
            f.tags?.includes('business') ||
            f.folder?.name?.includes('Work')
          );
        } else if (dashboardType === 'educational') {
          // Educational-focused files
          processedFiles = files.filter((f: DriveFile) => 
            f.tags?.includes('school') || 
            f.tags?.includes('education') ||
            f.folder?.name?.includes('Course')
          );
        }

        // Process files with sharing info
        const filesWithSharing = await Promise.all(
          processedFiles.slice(0, safeConfig.maxFilesToShow).map(async (file: DriveFile) => {
            return {
              ...file,
              isShared: Math.random() > 0.7, // Simulate some files being shared
              sharedWith: Math.floor(Math.random() * 5) // Simulate share count
            };
          })
        );

        setRecentFiles(filesWithSharing);
        setRecentFolders(folders.slice(0, 3));

        // Calculate storage usage
        const totalSize = files.reduce((sum: number, file: DriveFile) => sum + file.size, 0);
        const totalStorage = 10 * 1024 * 1024 * 1024; // 10GB for demo
        setStorageUsage({
          used: totalSize,
          total: totalStorage,
          percentage: (totalSize / totalStorage) * 100
        });

      } catch (err) {
        const safeDashboardName = dashboardName || 'dashboard';
        setError(`Failed to load ${safeDashboardName} File Hub data`);
        console.error(`Error loading ${dashboardType} File Hub data:`, err);
      } finally {
        setLoading(false);
      }
    };

    loadDriveData();
  }, [session?.accessToken, dashboardId, dashboardType, safeConfig.maxFilesToShow]);

  // Handle file upload
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.accessToken) return;

    try {
      setUploading(true);
      await uploadFile(session.accessToken, file);
      
      // Refresh the widget data
      const files = await listFiles(session.accessToken, '', false);
      const filesWithSharing = await Promise.all(
        files.slice(0, safeConfig.maxFilesToShow).map(async (file: DriveFile) => ({
          ...file,
          isShared: Math.random() > 0.7,
          sharedWith: Math.floor(Math.random() * 5)
        }))
      );
      setRecentFiles(filesWithSharing);
    } catch (err) {
      setError('Failed to upload file');
      console.error('Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('document') || type.includes('word')) return '📝';
    if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📈';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    return '📄';
  };

  // Get file type display name
  const getFileTypeName = (type: string) => {
    if (type.startsWith('image/')) return 'Image';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('document') || type.includes('word')) return 'Document';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'Spreadsheet';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'Presentation';
    if (type.includes('video')) return 'Video';
    if (type.includes('audio')) return 'Audio';
    return 'File';
  };

  const contextContent = getContextSpecificContent();

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5" style={{ color: contextContent.color }} />
            <h3 className="font-semibold text-gray-900">{contextContent.title}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 hover:bg-red-100 rounded text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} />
          <span className="ml-2 text-gray-600">Loading {dashboardName || 'File Hub'} files...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5" style={{ color: contextContent.color }} />
            <h3 className="font-semibold text-gray-900">{contextContent.title}</h3>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 hover:bg-red-100 rounded text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <Alert type="error">
          {error}
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Folder className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">
            {isHouseholdContext ? 'Family File Hub' : 'File Hub'}
          </h3>
          {isHouseholdContext && (
            <Badge size="sm" color="blue" className="flex items-center space-x-1">
              <span>🏠</span>
              <span>Family</span>
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {safeConfig.showUploadButton && (
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={uploading}
                className="flex items-center space-x-1"
              >
                {uploading ? (
                  <Spinner size={16} />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>Upload</span>
              </Button>
            </label>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 hover:bg-red-100 rounded text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Storage Usage */}
      {safeConfig.showStorageUsage && storageUsage && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Storage</span>
            </div>
            <span className="text-sm text-gray-600">
              {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.total)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{storageUsage.percentage.toFixed(1)}% used</span>
            <span>{formatBytes(storageUsage.total - storageUsage.used)} available</span>
          </div>
        </div>
      )}

      {/* Household Shared Folders */}
      {isHouseholdContext && safeConfig.showSharedFolders && (
        <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-orange-600" />
              <h4 className="text-sm font-medium text-orange-800">Family Shared Folders</h4>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.href = '/drive?view=shared'}
              className="text-orange-600 hover:text-orange-700"
            >
              View All
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-3 p-2 hover:bg-orange-100 rounded cursor-pointer">
              <Folder className="w-4 h-4 text-orange-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-900">📸 Family Photos</p>
                <p className="text-xs text-orange-600">Shared with all family members</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-2 hover:bg-orange-100 rounded cursor-pointer">
              <Folder className="w-4 h-4 text-orange-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-900">📄 Important Documents</p>
                <p className="text-xs text-orange-600">Access for adults only</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-2 hover:bg-orange-100 rounded cursor-pointer">
              <Folder className="w-4 h-4 text-orange-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-900">🎓 School & Activities</p>
                <p className="text-xs text-orange-600">Kids and parents</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Family Activity */}
      {isHouseholdContext && safeConfig.showFamilyActivity && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-4 h-4 text-green-600" />
            <h4 className="text-sm font-medium text-green-800">Recent Family Activity</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-green-900">Mom uploaded vacation-photos.zip</span>
              <span className="text-green-600">2m ago</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-green-900">Dad shared homework-folder</span>
              <span className="text-green-600">1h ago</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-green-900">Emma created art-projects folder</span>
              <span className="text-green-600">3h ago</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Files */}
      {safeConfig.showRecentFiles && recentFiles.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Recent Files</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.href = '/drive'}
            >
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {recentFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => window.open(file.url, '_blank')}
              >
                <div className="flex-shrink-0">
                  <span className="text-lg">{getFileIcon(file.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    {file.starred && (
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    )}
                    {file.isShared && (
                      <Badge size="sm" color="blue">
                        Shared
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{getFileTypeName(file.type)}</span>
                    <span>•</span>
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(new Date(file.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    className="p-1 hover:bg-gray-100 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(file.url, '_blank');
                    }}
                  >
                    <Eye className="w-3 h-3 text-gray-500" />
                  </button>
                  <button
                    className="p-1 hover:bg-gray-100 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(file.url, '_blank');
                    }}
                  >
                    <Download className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Folders */}
      {recentFolders.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Recent Folders</h4>
          </div>
          <div className="space-y-2">
            {recentFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => window.location.href = `/drive?folder=${folder.id}`}
              >
                <Folder className="w-4 h-4 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {folder.name}
                    </p>
                    {folder.starred && (
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Updated {formatRelativeTime(new Date(folder.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentFiles.length === 0 && recentFolders.length === 0 && (
        <div className="text-center py-6">
          <Folder className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">No files or folders yet</p>
          <Button
            size="sm"
            onClick={() => window.location.href = '/drive'}
          >
            Upload Files
          </Button>
        </div>
      )}

      {/* Configuration Panel */}
      {showConfig && onConfigChange && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Widget Settings</h5>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={safeConfig.showRecentFiles}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  showRecentFiles: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Show recent files</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={safeConfig.showStorageUsage}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  showStorageUsage: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Show storage usage</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={safeConfig.showUploadButton}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  showUploadButton: e.target.checked
                })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Show upload button</span>
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Max files to show:</span>
              <select
                value={safeConfig.maxFilesToShow}
                onChange={(e) => onConfigChange({
                  ...safeConfig,
                  maxFilesToShow: parseInt(e.target.value)
                })}
                className="text-sm border rounded px-2 py-1"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            
            {/* Household-specific settings */}
            {isHouseholdContext && (
              <>
                <div className="border-t border-gray-200 my-3 pt-3">
                  <h6 className="text-xs font-medium text-orange-700 mb-2 uppercase tracking-wider">
                    🏠 Family Settings
                  </h6>
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={safeConfig.showHouseholdFiles}
                    onChange={(e) => onConfigChange({
                      ...safeConfig,
                      showHouseholdFiles: e.target.checked
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600">Show household files</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={safeConfig.showSharedFolders}
                    onChange={(e) => onConfigChange({
                      ...safeConfig,
                      showSharedFolders: e.target.checked
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600">Show shared folders</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={safeConfig.showFamilyActivity}
                    onChange={(e) => onConfigChange({
                      ...safeConfig,
                      showFamilyActivity: e.target.checked
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600">Show family activity</span>
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
} 