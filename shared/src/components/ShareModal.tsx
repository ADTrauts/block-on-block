"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, UserPlusIcon, LinkIcon, TrashIcon, PencilIcon, MagnifyingGlassIcon, BuildingOfficeIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Avatar } from './Avatar';

type Permission = {
  id: string;
  userId: string;
  canRead: boolean;
  canWrite: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type User = {
  id: string;
  name: string | null;
  email: string;
  connectionStatus: 'none' | 'pending' | 'accepted' | 'declined' | 'blocked';
  relationshipId: string | null;
  organization?: {
    id: string;
    name: string;
    type: 'business' | 'institution';
    role: string;
  } | null;
};

type BusinessMember = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  title: string | null;
  department: string | null;
  isActive: boolean;
};

type ShareModalProps = {
  item: {
    id: string;
    name: string;
    type: 'file' | 'folder';
  };
  onClose: () => void;
  onShare: (email: string, permission: 'view' | 'edit') => Promise<{ success: boolean; shareLink?: string; message: string } | void>;
  onShareWithUser: (userId: string, permission: 'view' | 'edit') => Promise<void>;
  onCopyLink: () => Promise<void>;
  onListPermissions: (fileId: string) => Promise<Permission[]>;
  onUpdatePermission: (fileId: string, userId: string, canRead: boolean, canWrite: boolean) => Promise<void>;
  onRevokePermission: (fileId: string, userId: string) => Promise<void>;
  onSearchUsers: (query: string) => Promise<User[]>;
  onGetBusinessMembers: () => Promise<BusinessMember[]>;
  currentDashboard?: {
    id: string;
    type: 'personal' | 'business' | 'educational';
    businessId?: string;
  } | null;
  shareLink?: string; // Optional pre-generated share link to display
};

type ShareTab = 'people' | 'business' | 'link';

export const ShareModal: React.FC<ShareModalProps> = ({ 
  item, 
  onClose, 
  onShare, 
  onShareWithUser,
  onCopyLink,
  onListPermissions,
  onUpdatePermission,
  onRevokePermission,
  onSearchUsers,
  onGetBusinessMembers,
  currentDashboard,
  shareLink
}) => {
  const [activeTab, setActiveTab] = useState<ShareTab>('people');
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  
  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Business members state
  const [businessMembers, setBusinessMembers] = useState<BusinessMember[]>([]);
  const [loadingBusinessMembers, setLoadingBusinessMembers] = useState(false);
  const [selectedBusinessMembers, setSelectedBusinessMembers] = useState<string[]>([]);
  
  // Share link state (can be from prop or generated dynamically)
  // Always generate a link - use window.location for current origin
  const generateShareLink = useCallback(() => {
    if (shareLink) return shareLink;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/drive/shared?${item.type === 'file' ? 'file' : 'folder'}=${item.id}`;
    }
    return shareLink || '';
  }, [shareLink, item.id, item.type]);
  
  const [currentShareLink, setCurrentShareLink] = useState<string>(generateShareLink());
  
  // Update share link when prop or item changes
  useEffect(() => {
    const newLink = generateShareLink();
    if (newLink) {
      setCurrentShareLink(newLink);
    }
  }, [generateShareLink]);

  // Fetch current permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const perms = await onListPermissions(item.id);
        setPermissions(perms);
      } catch (err) {
        setError('Failed to load current permissions');
      } finally {
        setLoadingPermissions(false);
      }
    };
    fetchPermissions();
  }, [item.id, onListPermissions]);

  // Load business members when business tab is active
  useEffect(() => {
    if (activeTab === 'business' && currentDashboard?.type === 'business' && !businessMembers.length) {
      const loadBusinessMembers = async () => {
        setLoadingBusinessMembers(true);
        try {
          const members = await onGetBusinessMembers();
          setBusinessMembers(members);
        } catch (err) {
          setError('Failed to load business members');
        } finally {
          setLoadingBusinessMembers(false);
        }
      };
      loadBusinessMembers();
    }
  }, [activeTab, currentDashboard, businessMembers.length, onGetBusinessMembers]);

  // Search users with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await onSearchUsers(searchQuery);
        setSearchResults(results);
      } catch (err) {
        setError('Failed to search users');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, onSearchUsers]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await onShare(email, permission);
      if (result && typeof result === 'object' && 'shareLink' in result) {
        // User doesn't exist - show the share link
        if (result.shareLink) {
          setCurrentShareLink(result.shareLink);
          setSuccess(result.message);
          // Switch to link tab to show the generated link
          setActiveTab('link');
        } else {
          setSuccess(result.message);
        }
      } else {
        setSuccess('Shared successfully');
      }
      setEmail('');
      // Refresh permissions list
      const perms = await onListPermissions(item.id);
      setPermissions(perms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  const handleUserShare = async (user: User) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await onShareWithUser(user.id, permission);
      setSuccess(`Shared with ${user.name || user.email}`);
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      // Refresh permissions list
      const perms = await onListPermissions(item.id);
      setPermissions(perms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessTeamShare = async () => {
    if (selectedBusinessMembers.length === 0) {
      setError('Please select at least one team member');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Share with all selected business members
      await Promise.all(
        selectedBusinessMembers.map(userId => onShareWithUser(userId, permission))
      );
      setSuccess(`Shared with ${selectedBusinessMembers.length} team member(s)`);
      setSelectedBusinessMembers([]);
      // Refresh permissions list
      const perms = await onListPermissions(item.id);
      setPermissions(perms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share with team');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // If we have a current share link, copy it directly
      if (currentShareLink) {
        await navigator.clipboard.writeText(currentShareLink);
        setSuccess('Link copied to clipboard');
      } else {
        // Otherwise, call the onCopyLink callback
        await onCopyLink();
        setSuccess('Link copied to clipboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy link');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermission = async (userId: string, canRead: boolean, canWrite: boolean) => {
    try {
      await onUpdatePermission(item.id, userId, canRead, canWrite);
      setSuccess('Permission updated');
      // Refresh permissions list
      const perms = await onListPermissions(item.id);
      setPermissions(perms);
    } catch (err) {
      setError('Failed to update permission');
    }
  };

  const handleRevokePermission = async (userId: string) => {
    try {
      await onRevokePermission(item.id, userId);
      setSuccess('Permission revoked');
      // Refresh permissions list
      const perms = await onListPermissions(item.id);
      setPermissions(perms);
    } catch (err) {
      setError('Failed to revoke permission');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'MANAGER': return 'bg-blue-100 text-blue-800';
      case 'EMPLOYEE': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'blocked': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Share {item.type === 'file' ? 'file' : 'folder'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'people' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlusIcon className="w-4 h-4 inline mr-2" />
            People
          </button>
          {currentDashboard?.type === 'business' && (
            <button
              onClick={() => setActiveTab('business')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeTab === 'business' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BuildingOfficeIcon className="w-4 h-4 inline mr-2" />
              Business Team
            </button>
          )}
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'link' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LinkIcon className="w-4 h-4 inline mr-2" />
            Link
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
          {/* People Tab */}
          {activeTab === 'people' && (
            <div className="space-y-6">
              {/* Email sharing (legacy) */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Share by email</h3>
                <form onSubmit={handleEmailSubmit} className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email address"
                      className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <select
                      value={permission}
                      onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                      className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                    </select>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Share
                    </button>
                  </div>
                </form>
              </div>

              {/* User search */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Search and share with users</h3>
                <div className="relative mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search users by name or email..."
                        className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={permission}
                      onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                      className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                    </select>
                  </div>
                  
                  {/* Search results */}
                  {searching && (
                    <div className="mt-2 text-sm text-gray-500">Searching...</div>
                  )}
                  
                  {searchResults.length > 0 && (
                    <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
                        >
                                                     <div className="flex items-center space-x-3">
                             <Avatar nameOrEmail={user.name || user.email} size={32} />
                            <div>
                              <div className="font-medium">{user.name || 'No name'}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                              {user.organization && (
                                <div className="text-xs text-gray-400">
                                  {user.organization.name} • {user.organization.role}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {user.connectionStatus !== 'none' && (
                              <span className={`px-2 py-1 text-xs rounded-full ${getConnectionStatusColor(user.connectionStatus)}`}>
                                {user.connectionStatus}
                              </span>
                            )}
                            <button
                              onClick={() => handleUserShare(user)}
                              disabled={loading}
                              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                              Share
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Business Team Tab */}
          {activeTab === 'business' && currentDashboard?.type === 'business' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Share with business team</h3>
                <div className="flex gap-2 mb-4">
                  <select
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="view">Can view</option>
                    <option value="edit">Can edit</option>
                  </select>
                  <button
                    onClick={handleBusinessTeamShare}
                    disabled={loading || selectedBusinessMembers.length === 0}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Share with Selected ({selectedBusinessMembers.length})
                  </button>
                </div>

                {loadingBusinessMembers ? (
                  <div className="text-sm text-gray-500">Loading team members...</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {businessMembers.map((member) => (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer ${
                          selectedBusinessMembers.includes(member.user.id) 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (selectedBusinessMembers.includes(member.user.id)) {
                            setSelectedBusinessMembers(prev => prev.filter(id => id !== member.user.id));
                          } else {
                            setSelectedBusinessMembers(prev => [...prev, member.user.id]);
                          }
                        }}
                      >
                                                 <div className="flex items-center space-x-3">
                           <input
                             type="checkbox"
                             checked={selectedBusinessMembers.includes(member.user.id)}
                             onChange={() => {}} // Handled by parent div
                             className="rounded"
                           />
                           <Avatar nameOrEmail={member.user.name || member.user.email} size={32} />
                          <div>
                            <div className="font-medium">{member.user.name || 'No name'}</div>
                            <div className="text-sm text-gray-500">{member.user.email}</div>
                            {member.title && (
                              <div className="text-xs text-gray-400">{member.title}</div>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Get shareable link</h3>
                {currentShareLink ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={currentShareLink}
                          readOnly
                          className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none cursor-text"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                      </div>
                      <button
                        onClick={handleCopyLink}
                        disabled={loading}
                        className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 whitespace-nowrap"
                      >
                        Copy link
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Anyone with the link can view this {item.type}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleCopyLink}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <LinkIcon className="w-5 h-5" />
                      Generate and copy link
                    </button>
                    <p className="text-xs text-gray-500">
                      Generate a shareable link for this {item.type}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current sharees */}
          <div className="mt-8 border-t pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">People with access</h3>
            {loadingPermissions ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : !Array.isArray(permissions) ? (
              <div className="text-sm text-gray-500">Failed to load permissions</div>
            ) : permissions.length === 0 ? (
              <div className="text-sm text-gray-500">No one has access yet</div>
            ) : (
              <div className="space-y-2">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between p-3 border rounded-md">
                                         <div className="flex items-center space-x-3">
                       <Avatar nameOrEmail={perm.user.name || perm.user.email} size={32} />
                      <div className="flex-1">
                        <div className="font-medium">{perm.user.name}</div>
                        <div className="text-sm text-gray-500">{perm.user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={perm.canWrite ? 'edit' : 'view'}
                        onChange={(e) => {
                          const canWrite = e.target.value === 'edit';
                          handleUpdatePermission(perm.userId, true, canWrite);
                        }}
                        className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="view">Can view</option>
                        <option value="edit">Can edit</option>
                      </select>
                      <button
                        onClick={() => handleRevokePermission(perm.userId)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Remove access"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 