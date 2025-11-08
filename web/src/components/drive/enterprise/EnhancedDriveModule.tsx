import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, Button, Avatar, Badge, Spinner, Input } from 'shared/components';
import { useFeatureGating, useModuleFeatures } from '../../../hooks/useFeatureGating';
import { FeatureGate } from '../../FeatureGate';
import { FeatureBadge } from '../../EnterpriseUpgradePrompt';
import { useDashboard } from '../../../contexts/DashboardContext';
import { 
  Folder, 
  File, 
  Upload, 
  Search, 
  MoreVertical, 
  Grid, 
  List,
  Download,
  Share,
  Trash2,
  Star,
  Eye,
  Shield,
  Tag,
  BarChart3,
  Settings,
  Plus,
  Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Import enterprise components
import AdvancedSharingModal from './AdvancedSharingModal';
import AuditLogsPanel from './AuditLogsPanel';
import DataClassificationModal from './DataClassificationModal';

interface DriveItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modifiedAt: string;
  createdBy: string;
  permissions: string[];
  starred?: boolean;
  shared?: boolean;
  mimeType?: string;
  thumbnail?: string;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  shareCount?: number;
  viewCount?: number;
  downloadCount?: number;
}

interface EnhancedDriveModuleProps {
  businessId: string;
  dashboardId?: string;
  className?: string;
  refreshTrigger?: number;
}

export default function EnhancedDriveModule({ businessId, dashboardId, className = '', refreshTrigger }: EnhancedDriveModuleProps) {
  const { data: session } = useSession();
  const { currentDashboard } = useDashboard();
  const { recordUsage } = useFeatureGating(businessId);
  const { moduleAccess, hasBusiness: hasEnterprise } = useModuleFeatures('drive', businessId);
  const effectiveDashboardId = dashboardId || currentDashboard?.id || null;
  
  // Core state
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // Enterprise features state
  const [showAdvancedSharing, setShowAdvancedSharing] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveItem | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<string>('');
  const [showEnterprisePanel, setShowEnterprisePanel] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 10 * 1024 * 1024 * 1024 }); // 10GB default
  const [isDragging, setIsDragging] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');

  // Load files with enterprise data
  const loadEnhancedFiles = useCallback(async () => {
    if (!session?.accessToken) return;
    
    try {
      setLoading(true);
      setError(null);
      
      if (!effectiveDashboardId) {
        console.error('❌ EnhancedDriveModule: missing dashboard context');
        setError('Workspace context not initialized. Please refresh the page.');
        setLoading(false);
        return;
      }
      const parentId = currentFolder;
      
      // Build API URLs with context and folder
      const filesParams = new URLSearchParams();
      filesParams.append('dashboardId', effectiveDashboardId);
      if (parentId) filesParams.append('folderId', parentId);
      
      const foldersParams = new URLSearchParams();
      foldersParams.append('dashboardId', effectiveDashboardId);
      if (parentId) foldersParams.append('parentId', parentId);

      const filesUrl = `/api/drive/files?${filesParams}`;
      const foldersUrl = `/api/drive/folders?${foldersParams}`;

      // Fetch files and folders with context and folder filtering
      const [filesResponse, foldersResponse] = await Promise.all([
        fetch(filesUrl, {
          headers: { 'Authorization': `Bearer ${session.accessToken}` }
        }),
        fetch(foldersUrl, {
          headers: { 'Authorization': `Bearer ${session.accessToken}` }
        })
      ]);

      if (!filesResponse.ok || !foldersResponse.ok) {
        throw new Error('Failed to fetch drive content');
      }

      const filesData = await filesResponse.json();
      const foldersData = await foldersResponse.json();
      
      // API returns arrays directly, not wrapped in objects
      const files = Array.isArray(filesData) ? filesData : (filesData.files || []);
      const folders = Array.isArray(foldersData) ? foldersData : (foldersData.folders || []);
      
      console.log('🏢 Enterprise Drive Debug - Raw API Data:', { filesData, foldersData });
      console.log('🏢 Enterprise Drive Debug - Parsed Data:', { files, folders });
      console.log('🏢 Enterprise Drive Debug - Counts:', { fileCount: files.length, folderCount: folders.length });
      
      // Map files to DriveItem format with enterprise metadata
      const mappedFiles = files.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: 'file' as const,
        size: file.size,
        modifiedAt: file.updatedAt || file.createdAt,
        createdBy: file.createdBy || 'Unknown',
        permissions: ['view', 'edit'], // TODO: Get from API
        mimeType: file.type,
        starred: false,
        shared: false,
        // Enterprise metadata - will be enhanced with real data later
        classification: file.classification || 'internal',
        shareCount: file.shareCount || 0,
        viewCount: file.viewCount || 0,
        downloadCount: file.downloadCount || 0
      }));

      // Map folders to DriveItem format with enterprise metadata
      const mappedFolders = folders.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        modifiedAt: folder.updatedAt || folder.createdAt,
        createdBy: folder.createdBy || 'Unknown',
        permissions: ['view', 'edit'], // TODO: Get from API
        starred: false,
        shared: false,
        // Enterprise metadata
        classification: folder.classification || 'internal',
        shareCount: folder.shareCount || 0,
        viewCount: folder.viewCount || 0
      }));

      // Combine files and folders
      const combinedItems = [...mappedFolders, ...mappedFiles];
      console.log('🏢 Enterprise Drive Debug - Final Items:', { 
        totalItems: combinedItems.length, 
        folders: mappedFolders.length, 
        files: mappedFiles.length,
        items: combinedItems 
      });
      setItems(combinedItems);

      // Calculate storage usage
      const totalSize = mappedFiles.reduce((sum: number, file: any) => sum + (file.size || 0), 0);
      setStorageUsage(prev => ({ ...prev, used: totalSize }));

      // Record feature usage for analytics
      recordUsage('drive_advanced_features');
      
    } catch (err) {
      console.error('Error loading enhanced drive content:', err);
      setError('Failed to load drive content. Please try again.');
      setItems([]);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, effectiveDashboardId, currentFolder, recordUsage]);


  useEffect(() => {
    loadEnhancedFiles();
  }, [loadEnhancedFiles]);

  // Listen to refresh trigger from parent
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadEnhancedFiles();
    }
  }, [refreshTrigger, loadEnhancedFiles]);

  const handleAdvancedShare = (item: DriveItem) => {
    setSelectedFile(item);
    setShowAdvancedSharing(true);
  };

  const handleClassifyFiles = () => {
    const filesToClassify = Array.from(selectedItems).map(id => 
      items.find(item => item.id === id)!
    ).filter(Boolean);
    
    setShowClassification(true);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedItems.size === 0) {
      toast.error('Please select files first');
      return;
    }

    try {
      switch (action) {
        case 'classify':
          handleClassifyFiles();
          break;
        case 'share':
          if (selectedItems.size === 1) {
            const item = items.find(i => i.id === Array.from(selectedItems)[0])!;
            handleAdvancedShare(item);
          } else {
            toast.success('Advanced sharing available for single files');
          }
          break;
        case 'audit':
          setShowAuditLogs(true);
          break;
        default:
          toast.success(`Bulk ${action} not implemented yet`);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      toast.error(`Failed to ${action} files`);
    }
  };

  // File upload handler
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (!files || !session?.accessToken) return;

      try {
        setLoading(true);
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append('file', file);
          if (effectiveDashboardId) formData.append('dashboardId', effectiveDashboardId);
          if (currentFolder) formData.append('folderId', currentFolder);

          const response = await fetch('/api/drive/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.accessToken}` },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }
        }

        // Refresh content
        await loadEnhancedFiles();
        toast.success('Files uploaded successfully');
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error('Failed to upload files. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  // Folder creation handler
  const handleCreateFolder = async () => {
    if (!session?.accessToken) return;

    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
      setLoading(true);
      
      const response = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ 
          name,
          dashboardId: effectiveDashboardId,
          parentId: currentFolder || null
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      // Refresh content
      await loadEnhancedFiles();
      toast.success('Folder created successfully');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFileIcon = (item: DriveItem) => {
    if (item.type === 'folder') {
      return <div className="text-4xl">📁</div>;
    }

    // Enhanced file type icons
    const mimeType = item.mimeType || '';
    if (mimeType.includes('pdf')) return <div className="text-4xl">📄</div>;
    if (mimeType.includes('word') || mimeType.includes('document')) return <div className="text-4xl">📝</div>;
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <div className="text-4xl">📊</div>;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <div className="text-4xl">📈</div>;
    if (mimeType.startsWith('image/')) return <div className="text-4xl">🖼️</div>;
    if (mimeType.startsWith('video/')) return <div className="text-4xl">🎥</div>;
    if (mimeType.startsWith('audio/')) return <div className="text-4xl">🎵</div>;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return <div className="text-4xl">📦</div>;
    if (mimeType.includes('text')) return <div className="text-4xl">📋</div>;

    return <div className="text-4xl">📄</div>;
  };

  const getClassificationBadge = (classification?: string) => {
    if (!classification) return null;
    
    const configs = {
      public: { color: 'bg-green-100 text-green-800 border-green-200', icon: '🌍' },
      internal: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🏢' },
      confidential: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🔒' },
      restricted: { color: 'bg-red-100 text-red-800 border-red-200', icon: '🚫' }
    };
    
    const config = configs[classification as keyof typeof configs];
    if (!config) return null;
    
    return (
      <Badge className={`px-2 py-1 text-xs border rounded-full ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {classification.charAt(0).toUpperCase() + classification.slice(1)}
      </Badge>
    );
  };

  const filteredItems = items
    .filter(item => {
      // Search filter
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
      
      // Classification filter (enterprise)
    if (classificationFilter && item.classification !== classificationFilter) {
      return false;
    }
      
      // File type filter
      if (fileTypeFilter && item.type === 'file') {
        const mimeType = item.mimeType || '';
        if (fileTypeFilter === 'documents' && !mimeType.includes('pdf') && !mimeType.includes('word') && !mimeType.includes('document')) return false;
        if (fileTypeFilter === 'images' && !mimeType.startsWith('image/')) return false;
        if (fileTypeFilter === 'videos' && !mimeType.startsWith('video/')) return false;
        if (fileTypeFilter === 'spreadsheets' && !mimeType.includes('excel') && !mimeType.includes('spreadsheet')) return false;
      }
      
    return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      // Folders always first
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      
      // Then sort by selected criteria
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.mimeType || '').localeCompare(b.mimeType || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Enterprise Drive Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={loadEnhancedFiles} variant="primary">
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="secondary">
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 p-6 overflow-auto ${className}`}>
      {/* Header - Only show when at root level */}
      {!currentFolder && breadcrumbs.length === 0 && (
        <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              {currentDashboard ? `${currentDashboard.name} Drive` : 'Enterprise Drive'}
              <span className="ml-3 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full border border-purple-200">Enterprise</span>
            </h1>
          <p className="text-gray-600">
              Advanced file management with enterprise features
          </p>
        </div>
        <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={handleCreateFolder}>
            <Folder className="w-4 h-4 mr-2" />
            New Folder
          </Button>
            <Button size="sm" onClick={handleFileUpload}>
            <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </div>
        </div>
      )}

      {/* Storage Usage - Only show at root level */}
      {!currentFolder && breadcrumbs.length === 0 && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Enterprise Storage</span>
            </div>
            <span className="text-sm text-gray-600">
              {formatFileSize(storageUsage.used)} / {formatFileSize(storageUsage.total)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((storageUsage.used / storageUsage.total) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{((storageUsage.used / storageUsage.total) * 100).toFixed(1)}% used</span>
            <span>{formatFileSize(storageUsage.total - storageUsage.used)} available</span>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar - Shows when items are selected */}
      {selectedItems.size > 0 && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-4 animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedItems.size === filteredItems.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedItems(new Set(filteredItems.map(item => item.id)));
                } else {
                  setSelectedItems(new Set());
                }
              }}
              className="w-4 h-4"
            />
            <span className="font-medium">{selectedItems.size} selected</span>
          </div>
          
          <div className="h-6 w-px bg-blue-400"></div>
          
          <div className="flex items-center gap-2">
            <FeatureGate feature="drive_advanced_sharing" businessId={businessId}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('share')}
                className="text-white hover:bg-blue-500"
              >
                <Share className="w-4 h-4 mr-1" />
                Share
              </Button>
            </FeatureGate>
            
            <FeatureGate feature="drive_dlp" businessId={businessId}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('classify')}
                className="text-white hover:bg-blue-500"
              >
                <Tag className="w-4 h-4 mr-1" />
                Classify
              </Button>
            </FeatureGate>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction('download')}
              className="text-white hover:bg-blue-500"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction('delete')}
              className="text-white hover:bg-red-500"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
          
          <div className="h-6 w-px bg-blue-400"></div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedItems(new Set())}
            className="text-white hover:bg-blue-500"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Enterprise Panel */}
      {showEnterprisePanel && (
        <Card className="p-4 bg-purple-50 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-purple-900">Enterprise Features</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowEnterprisePanel(false)}
            >
              ×
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureGate feature="drive_advanced_sharing" businessId={businessId}>
              <Button 
                variant="secondary" 
                onClick={() => selectedItems.size > 0 && handleBulkAction('share')}
                disabled={selectedItems.size === 0}
                className="w-full"
              >
                <Share className="w-4 h-4 mr-2" />
                Advanced Sharing
              </Button>
            </FeatureGate>
            
            <FeatureGate feature="drive_audit_logs" businessId={businessId}>
              <Button 
                variant="secondary" 
                onClick={() => setShowAuditLogs(true)}
                className="w-full"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Audit Logs
              </Button>
            </FeatureGate>
            
            <FeatureGate feature="drive_dlp" businessId={businessId}>
              <Button 
                variant="secondary" 
                onClick={() => selectedItems.size > 0 ? handleClassifyFiles() : toast.error('Select files to classify')}
                className="w-full"
              >
                <Tag className="w-4 h-4 mr-2" />
                Classify Data
              </Button>
            </FeatureGate>
          </div>
        </Card>
      )}

      {/* Enhanced Search, Sort, and Filters */}
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* File Type Filter */}
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Types</option>
            <option value="documents">📝 Documents</option>
            <option value="spreadsheets">📊 Spreadsheets</option>
            <option value="images">🖼️ Images</option>
            <option value="videos">🎥 Videos</option>
          </select>
          
          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size' | 'type')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="name">Name</option>
            <option value="date">Date Modified</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
          
          <FeatureGate feature="drive_dlp" businessId={businessId}>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Classifications</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          </FeatureGate>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Selection Info */}
      {selectedItems.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-blue-800">
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <FeatureGate feature="drive_advanced_sharing" businessId={businessId}>
              <Button size="sm" onClick={() => handleBulkAction('share')}>
                <Share className="w-4 h-4 mr-1" />
                Share
              </Button>
            </FeatureGate>
            <FeatureGate feature="drive_dlp" businessId={businessId}>
              <Button size="sm" onClick={() => handleBulkAction('classify')}>
                <Tag className="w-4 h-4 mr-1" />
                Classify
              </Button>
            </FeatureGate>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => setSelectedItems(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced File Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
        {filteredItems.map((item) => (
          <Card 
            key={item.id} 
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedItems.has(item.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            } ${viewMode === 'list' ? 'flex items-center space-x-4' : ''}`}
          >
            <div onClick={() => {
              const newSelection = new Set(selectedItems);
              if (newSelection.has(item.id)) {
                newSelection.delete(item.id);
              } else {
                newSelection.add(item.id);
              }
              setSelectedItems(newSelection);
            }}
          >
            <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row items-center flex-1'}`}>
              <div className={`flex items-center ${viewMode === 'grid' ? 'mb-3' : 'mr-4'}`}>
                {item.type === 'folder' ? (
                  <Folder className="w-8 h-8 text-blue-500" />
                ) : (
                  <File className="w-8 h-8 text-gray-500" />
                )}
                {item.starred && (
                  <Star className="w-4 h-4 text-yellow-500 ml-2" />
                )}
              </div>
              
              <div className={`flex-1 ${viewMode === 'grid' ? '' : 'mr-4'}`}>
                <div className="font-medium text-gray-900 truncate">{item.name}</div>
                <div className="text-sm text-gray-500">
                  {item.type === 'file' && item.size && (
                    <span>{(item.size / 1024 / 1024).toFixed(1)} MB • </span>
                  )}
                  <span>{new Date(item.modifiedAt).toLocaleDateString()}</span>
                </div>
                
                {/* Enterprise Analytics */}
                {hasEnterprise && (
                  <div className="text-xs text-gray-400 mt-1">
                    {item.viewCount && <span>👁 {item.viewCount}</span>}
                    {item.shareCount && <span className="ml-2">🔗 {item.shareCount}</span>}
                    {item.downloadCount && <span className="ml-2">⬇️ {item.downloadCount}</span>}
                  </div>
                )}
              </div>
              
              <div className={`flex ${viewMode === 'grid' ? 'justify-between items-center' : 'items-center space-x-3'}`}>
                {/* Classification Badge */}
                {getClassificationBadge(item.classification)}
                
                {/* Actions */}
                <div className="flex items-center space-x-1">
                  <FeatureGate feature="drive_advanced_sharing" businessId={businessId}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdvancedShare(item);
                      }}
                    >
                      <Share className="w-4 h-4" />
                    </Button>
                  </FeatureGate>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Enterprise Modals */}
      <AdvancedSharingModal
        isOpen={showAdvancedSharing}
        onClose={() => setShowAdvancedSharing(false)}
        file={selectedFile}
        businessId={businessId}
      />
      
      <DataClassificationModal
        isOpen={showClassification}
        onClose={() => setShowClassification(false)}
        files={Array.from(selectedItems).map(id => items.find(item => item.id === id)!).filter(Boolean)}
        businessId={businessId}
      />
      
      {/* Audit Logs Panel */}
      {showAuditLogs && (
        <div className="mt-6">
          <AuditLogsPanel
            businessId={businessId}
            fileId={selectedFile?.id}
          />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setShowAuditLogs(false)}>
              Close Audit Logs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
