'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'shared/components';
import { Download, Share, Edit, Move, Trash2, X, ChevronRight, ChevronLeft, ZoomIn, ZoomOut, Maximize2, RotateCw } from 'lucide-react';
// DriveItem interface - matches DriveModule.tsx
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
  url?: string;
}
import { PrismAsync as SyntaxHighlighter } from 'react-syntax-highlighter';

interface DriveDetailsPanelProps {
  item: DriveItem | null;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  onRename?: (id: string) => void;
  onMove?: (id: string) => void;
  onDelete?: (id: string) => void;
  getFileIcon?: (item: DriveItem) => React.ReactNode;
  formatFileSize?: (size: number) => string;
  formatDate?: (date: string) => string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function DriveDetailsPanel({
  item,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
  onDownload,
  onShare,
  onRename,
  onMove,
  onDelete,
  getFileIcon,
  formatFileSize: formatFileSizeProp,
  formatDate: formatDateProp
}: DriveDetailsPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [textContent, setTextContent] = useState<string | null>(null);
  const [codeLanguage, setCodeLanguage] = useState<string | null>(null);
  const [syntaxStyle, setSyntaxStyle] = useState<Record<string, React.CSSProperties> | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Load syntax highlighting style on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('react-syntax-highlighter/dist/esm/styles/prism')
        .then(module => {
          setSyntaxStyle(module.vscDarkPlus);
        })
        .catch(() => {
          // Fallback to empty style if import fails
          setSyntaxStyle({});
        });
    }
  }, []);

  const formatSize = formatFileSizeProp || formatFileSize;
  const formatDateStr = formatDateProp || formatDate;

  // Get code language from file extension
  const getCodeLanguage = (fileName: string, mimeType?: string): string | null => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'vue': 'vue',
      'svelte': 'svelte',
    };
    
    if (mimeType?.includes('json')) return 'json';
    if (mimeType?.includes('javascript')) return 'javascript';
    if (mimeType?.includes('xml')) return 'xml';
    
    return extension ? (languageMap[extension] || null) : null;
  };

  useEffect(() => {
    if (!item || item.type !== 'file') {
      setPreviewUrl(null);
      setTextContent(null);
      setCodeLanguage(null);
      setImageZoom(1);
      setImagePosition({ x: 0, y: 0 });
      return;
    }

    const fileUrl = `/api/drive/files/${item.id}/download`;
    const lang = getCodeLanguage(item.name, item.mimeType);
    setCodeLanguage(lang);

    // Reset zoom and position for new file
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });

    // For images, use download endpoint
    if (item.mimeType?.startsWith('image/')) {
      setPreviewUrl(fileUrl);
      setTextContent(null);
    } 
    // For PDFs, fetch as blob
    else if (item.mimeType?.includes('pdf')) {
      fetch(fileUrl)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setTextContent(null);
        })
        .catch(() => {
          setPreviewUrl(null);
          setTextContent(null);
        });
    }
    // For video/audio, use download endpoint
    else if (item.mimeType?.startsWith('video/') || item.mimeType?.startsWith('audio/')) {
      setPreviewUrl(fileUrl);
      setTextContent(null);
    }
    // For text/code files, fetch content
    else if (item.mimeType?.startsWith('text/') || lang || item.mimeType?.includes('json') || item.mimeType?.includes('javascript') || item.mimeType?.includes('xml')) {
      setPreviewUrl(null);
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
        })
        .catch(() => {
          setTextContent(null);
        });
    } else {
      setPreviewUrl(null);
      setTextContent(null);
    }

    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [item?.id, item?.mimeType, item?.name]);

  if (!isOpen || !item) return null;

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center bg-white border-l border-gray-200 transition-all duration-300 w-12 min-w-[48px] max-w-[48px] relative">
        <button
          className="absolute top-1/2 transform -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-gray-600 text-white border border-gray-500 cursor-pointer z-20 flex items-center justify-center hover:bg-gray-700 transition-colors"
          onClick={onToggleCollapse}
          title="Expand details panel"
          aria-label="Expand details panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="bg-white border-l border-gray-200 transition-all duration-300 w-[320px] relative flex flex-col overflow-hidden"
      style={{ width: '320px', minWidth: '320px', maxWidth: '320px' }}
    >
      {/* Toggle Button */}
      <button
        className="absolute top-1/2 transform -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-gray-600 text-white border border-gray-500 cursor-pointer z-20 flex items-center justify-center hover:bg-gray-700 transition-colors"
        onClick={onToggleCollapse}
        title="Collapse details panel"
        aria-label="Collapse details panel"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors z-10"
        aria-label="Close panel"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Preview Section */}
        {item.type === 'file' && (
          <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
            <div className="p-4 max-h-[400px] overflow-auto">
              {/* Image Preview with Zoom Controls */}
              {item.mimeType?.startsWith('image/') && previewUrl ? (
                <div className="relative">
                  <div className="flex justify-end gap-2 mb-2">
                    <button
                      onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.25))}
                      className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      aria-label="Zoom out"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setImageZoom(prev => Math.min(3, prev + 0.25))}
                      className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      aria-label="Zoom in"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setImageZoom(1);
                        setImagePosition({ x: 0, y: 0 });
                      }}
                      className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      aria-label="Reset zoom"
                      title="Reset zoom"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div
                    ref={imageContainerRef}
                    className="relative w-full h-[280px] overflow-hidden bg-gray-900 rounded-lg cursor-move"
                    onMouseDown={(e) => {
                      if (imageZoom > 1) {
                        setIsDragging(true);
                        setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isDragging && imageZoom > 1) {
                        setImagePosition({
                          x: e.clientX - dragStart.x,
                          y: e.clientY - dragStart.y
                        });
                      }
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                  >
                    <img
                      src={previewUrl}
                      alt={item.name}
                      className="object-contain"
                      style={{
                        width: `${imageZoom * 100}%`,
                        height: `${imageZoom * 100}%`,
                        transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                      }}
                      onError={() => setPreviewUrl(null)}
                    />
                  </div>
                </div>
              ) 
              // Video Preview
              : item.mimeType?.startsWith('video/') && previewUrl ? (
                <div className="flex items-center justify-center">
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-[280px] rounded-lg"
                    onError={() => setPreviewUrl(null)}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )
              // Audio Preview
              : item.mimeType?.startsWith('audio/') && previewUrl ? (
                <div className="flex items-center justify-center p-4">
                  <audio
                    src={previewUrl}
                    controls
                    className="w-full"
                    onError={() => setPreviewUrl(null)}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )
              // Code/Text Preview with Syntax Highlighting
              : textContent !== null && codeLanguage ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-gray-900">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <span className="text-xs font-mono text-gray-400">{codeLanguage}</span>
                    <span className="text-xs text-gray-500">{textContent.length} chars</span>
                  </div>
                  <div className="overflow-auto max-h-[280px]">
                    {syntaxStyle ? (
                      <SyntaxHighlighter
                        language={codeLanguage}
                        style={syntaxStyle}
                        customStyle={{
                          margin: 0,
                          padding: '1rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5'
                        }}
                        showLineNumbers
                      >
                        {textContent}
                      </SyntaxHighlighter>
                    ) : (
                      <pre className="text-sm font-mono whitespace-pre-wrap break-words text-gray-100 p-4">
                        {textContent}
                      </pre>
                    )}
                  </div>
                </div>
              )
              // Plain Text Preview
              : textContent !== null ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-gray-50">
                  <div className="px-4 py-2 bg-gray-200 border-b border-gray-300">
                    <span className="text-xs font-medium text-gray-700">Text File</span>
                    <span className="text-xs text-gray-500 ml-2">{textContent.length} chars</span>
                  </div>
                  <div className="p-4 overflow-auto max-h-[280px]">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words text-gray-900">
                      {textContent}
                    </pre>
                  </div>
                </div>
              )
              // PDF Preview
              : item.mimeType?.includes('pdf') && previewUrl ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-[280px] border-0 rounded-lg"
                  aria-label={item.name}
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-sm text-gray-600">PDF preview</p>
                    <p className="text-xs text-gray-500 mt-1">Click download to view PDF</p>
                  </div>
                </object>
              )
              // Fallback for unsupported file types
              : (
                <div className="text-center py-8">
                  {getFileIcon ? (
                    <div className="text-6xl mb-2">{getFileIcon(item)}</div>
                  ) : (
                    <div className="text-6xl mb-2">📄</div>
                  )}
                  <p className="text-sm text-gray-600">{item.mimeType || 'File'}</p>
                  <p className="text-xs text-gray-500 mt-1">Preview not available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details Section */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* File Details */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Details</h3>
            <div className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Name</dt>
                <dd className="text-sm text-gray-900 mt-1 break-words">{item.name}</dd>
              </div>
              {item.type === 'file' && item.size && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Size</dt>
                  <dd className="text-sm text-gray-900 mt-1">{formatSize(item.size)}</dd>
                </div>
              )}
              {item.mimeType && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Type</dt>
                  <dd className="text-sm text-gray-900 mt-1">{item.mimeType}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Modified</dt>
                <dd className="text-sm text-gray-900 mt-1">{formatDateStr(item.modifiedAt)}</dd>
              </div>
              {item.createdBy && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">Created by</dt>
                  <dd className="text-sm text-gray-900 mt-1">{item.createdBy}</dd>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Actions</h3>
            <div className="space-y-2">
              {item.type === 'file' && onDownload && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => onDownload(item.id)}
                  disabled={isLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
              {onShare && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => onShare(item.id)}
                  disabled={isLoading}
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}
              {onRename && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => onRename(item.id)}
                  disabled={isLoading}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Rename
                </Button>
              )}
              {onMove && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => onMove(item.id)}
                  disabled={isLoading}
                >
                  <Move className="w-4 h-4 mr-2" />
                  Move
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-red-700 hover:text-red-800 hover:bg-red-50"
                  onClick={() => onDelete(item.id)}
                  disabled={isLoading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

