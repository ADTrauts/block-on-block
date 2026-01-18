'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Spinner, Card } from 'shared/components';
import { Folder, File, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as driveAPI from '@/api/drive';
import type { File as DriveFile, Folder as DriveFolder } from '@/api/drive';

interface DriveFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (fileId: string) => void;
  excludeFileIds?: string[]; // Files already linked to exclude
}

export function DriveFilePicker({
  isOpen,
  onClose,
  onSelectFile,
  excludeFileIds = [],
}: DriveFilePickerProps) {
  const { data: session } = useSession();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderStack, setFolderStack] = useState<Array<{ id: string | undefined; name: string }>>([
    { id: undefined, name: 'Drive' },
  ]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && session?.accessToken) {
      loadFiles();
      loadFolders();
    }
  }, [isOpen, session?.accessToken, currentFolderId]);

  const loadFiles = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const fetchedFiles = await driveAPI.listFiles(session.accessToken, currentFolderId);
      // Filter out already linked files
      const filteredFiles = fetchedFiles.filter(
        (file: DriveFile) => !excludeFileIds.includes(file.id)
      );
      setFiles(filteredFiles);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    if (!session?.accessToken) return;
    try {
      const fetchedFolders = await driveAPI.listFolders(session.accessToken, currentFolderId);
      setFolders(fetchedFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      // Don't show error toast for folders - they're optional
    }
  };

  const handleFolderClick = (folder: DriveFolder) => {
    setFolderStack(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (folderStack.length > 1) {
      const newStack = folderStack.slice(0, -1);
      setFolderStack(newStack);
      setCurrentFolderId(newStack[newStack.length - 1].id);
      setSearchQuery('');
    }
  };

  const handleFileSelect = (file: DriveFile) => {
    onSelectFile(file.id);
    onClose();
  };

  const filteredFiles = searchQuery
    ? files.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : files;

  const filteredFolders = searchQuery
    ? folders.filter(folder =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : folders;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-lg">Select File from Drive</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2 text-sm">
            {folderStack.length > 1 && (
              <button
                onClick={handleBack}
                className="text-blue-600 hover:text-blue-700 flex items-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center space-x-1 overflow-x-auto">
              {folderStack.map((folder, idx) => (
                <React.Fragment key={folder.id || 'root'}>
                  {idx > 0 && <span className="text-gray-400">/</span>}
                  <span
                    className={idx === folderStack.length - 1 ? 'font-medium' : 'text-gray-600'}
                  >
                    {folder.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size={24} />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Folders */}
              {filteredFolders.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2">Folders</h4>
                  <div className="space-y-1">
                    {filteredFolders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => handleFolderClick(folder)}
                        className="cursor-pointer"
                      >
                        <Card className="p-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <Folder className="w-5 h-5 text-blue-500" />
                            <span className="text-sm font-medium text-gray-900">{folder.name}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {filteredFiles.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2 mt-4">Files</h4>
                  <div className="space-y-1">
                    {filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleFileSelect(file)}
                        className="cursor-pointer"
                      >
                        <Card className="p-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <File className="w-5 h-5 text-gray-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {file.type} • {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredFolders.length === 0 && filteredFiles.length === 0 && (
                <div className="text-center py-8">
                  <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">
                    {searchQuery ? 'No files found' : 'No files in this folder'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose} variant="ghost" size="sm" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

