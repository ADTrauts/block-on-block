import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Avatar, Badge, Spinner, Input } from 'shared/components';
import { useFeatureGating, useModuleFeatures } from '../../../hooks/useFeatureGating';
import { FeatureGate } from '../../FeatureGate';
import { 
  MessageSquare, 
  Send, 
  Search, 
  MoreVertical, 
  Phone,
  Video,
  File,
  Smile,
  Paperclip,
  Users,
  Hash,
  Lock,
  Shield,
  Eye,
  Archive,
  Settings,
  Flag,
  Key,
  BarChart3,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Import enterprise components
import MessageRetentionPanel from './MessageRetentionPanel';
import ContentModerationPanel from './ContentModerationPanel';
import EncryptionPanel from './EncryptionPanel';

interface ChatMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
  };
  timestamp: string;
  type: 'text' | 'file' | 'image' | 'system';
  reactions?: Array<{
    emoji: string;
    users: string[];
  }>;
  edited?: boolean;
  deleted?: boolean;
  encrypted?: boolean;
  retentionPolicy?: string;
  complianceFlags?: string[];
  moderationStatus?: 'approved' | 'flagged' | 'pending' | 'quarantined';
}

interface ChatChannel {
  id: string;
  name: string;
  type: 'channel' | 'direct' | 'group';
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  members: Array<{
    id: string;
    name: string;
    online: boolean;
    role: string;
  }>;
  isPrivate?: boolean;
  encryptionEnabled?: boolean;
  retentionPolicy?: string;
  moderationEnabled?: boolean;
}

export interface EnhancedChatModuleProps {
  businessId: string;
  dashboardId?: string;
  className?: string;
}

export default function EnhancedChatModule({ businessId, dashboardId: _dashboardId, className = '' }: EnhancedChatModuleProps) {
  const { recordUsage } = useFeatureGating(businessId);
  const { moduleAccess, hasBusiness: hasEnterprise } = useModuleFeatures('chat', businessId);
  
  // Core state
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Enterprise features state
  const [showEnterprisePanel, setShowEnterprisePanel] = useState(false);
  const [activeEnterpriseTab, setActiveEnterpriseTab] = useState<'retention' | 'moderation' | 'encryption'>('retention');
  const [encryptionStatus, setEncryptionStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [moderationAlerts, setModerationAlerts] = useState(0);
  const [retentionWarnings, setRetentionWarnings] = useState(0);

  // Load enhanced chat data
  useEffect(() => {
    loadEnhancedChatData();
  }, [businessId]);

  const loadEnhancedChatData = async () => {
    try {
      setLoading(true);
      
      // Enhanced mock data with enterprise features
      const mockChannels: ChatChannel[] = [
        {
          id: '1',
          name: 'executive-board',
          type: 'channel',
          unreadCount: 2,
          lastMessage: 'Q4 results are looking strong 🔒',
          lastMessageTime: '2024-01-15T10:30:00Z',
          members: [
            { id: '1', name: 'John Doe', online: true, role: 'CEO' },
            { id: '2', name: 'Jane Smith', online: false, role: 'CFO' },
            { id: '3', name: 'Mike Johnson', online: true, role: 'CTO' }
          ],
          isPrivate: true,
          encryptionEnabled: true,
          retentionPolicy: 'Executive Protection',
          moderationEnabled: true
        },
        {
          id: '2',
          name: 'general',
          type: 'channel',
          unreadCount: 5,
          lastMessage: 'Great work everyone on the project delivery!',
          lastMessageTime: '2024-01-15T09:15:00Z',
          members: [
            { id: '2', name: 'Jane Smith', online: false, role: 'Manager' },
            { id: '4', name: 'Sarah Wilson', online: true, role: 'Employee' },
            { id: '5', name: 'David Brown', online: true, role: 'Employee' }
          ],
          isPrivate: false,
          encryptionEnabled: true,
          retentionPolicy: 'Standard Business',
          moderationEnabled: true
        },
        {
          id: '3',
          name: 'Legal Review',
          type: 'group',
          unreadCount: 1,
          lastMessage: 'Contract terms have been finalized 🔒',
          lastMessageTime: '2024-01-15T08:45:00Z',
          members: [
            { id: '6', name: 'Legal Counsel', online: true, role: 'Legal' },
            { id: '1', name: 'John Doe', online: true, role: 'CEO' }
          ],
          isPrivate: true,
          encryptionEnabled: true,
          retentionPolicy: 'Legal Hold',
          moderationEnabled: false
        }
      ];

      setChannels(mockChannels);
      setSelectedChannel(mockChannels[0]);
      
      // Mock enterprise stats
      setModerationAlerts(3);
      setRetentionWarnings(1);
      
    } catch (error) {
      console.error('Failed to load chat data:', error);
      toast.error('Failed to load chat data');
    } finally {
      setLoading(false);
    }
  };

  // Load messages for selected channel with enterprise data
  useEffect(() => {
    if (!selectedChannel) return;
    
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        content: 'Welcome to the executive board channel. All messages are encrypted.',
        sender: {
          id: 'system',
          name: 'System',
          role: 'System'
        },
        timestamp: '2024-01-15T09:00:00Z',
        type: 'system',
        encrypted: true,
        retentionPolicy: 'Executive Protection'
      },
      {
        id: '2',
        content: 'Q4 results are looking strong. Revenue exceeded expectations by 12%.',
        sender: {
          id: '1',
          name: 'John Doe',
          avatar: '/avatars/john.jpg',
          role: 'CEO'
        },
        timestamp: '2024-01-15T10:15:00Z',
        type: 'text',
        encrypted: true,
        retentionPolicy: 'Executive Protection',
        complianceFlags: ['SOX', 'SEC'],
        moderationStatus: 'approved'
      },
      {
        id: '3',
        content: 'That\'s excellent news! Should we schedule the board presentation?',
        sender: {
          id: '2',
          name: 'Jane Smith',
          avatar: '/avatars/jane.jpg',
          role: 'CFO'
        },
        timestamp: '2024-01-15T10:20:00Z',
        type: 'text',
        encrypted: true,
        retentionPolicy: 'Executive Protection',
        moderationStatus: 'approved',
        reactions: [
          { emoji: '👍', users: ['1', '3'] }
        ]
      }
    ];
    
    setMessages(mockMessages);
  }, [selectedChannel]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel) return;
    
    try {
      const message: ChatMessage = {
        id: Date.now().toString(),
        content: newMessage,
        sender: {
          id: 'current-user',
          name: 'Current User',
          role: 'User'
        },
        timestamp: new Date().toISOString(),
        type: 'text',
        encrypted: selectedChannel.encryptionEnabled,
        retentionPolicy: selectedChannel.retentionPolicy,
        moderationStatus: selectedChannel.moderationEnabled ? 'pending' : 'approved'
      };
      
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Record usage for enterprise features
      if (hasEnterprise) {
        await recordUsage('chat_e2e_encryption', 1);
        if (selectedChannel.moderationEnabled) {
          await recordUsage('chat_content_moderation', 1);
        }
      }
      
      // Simulate moderation check
      if (selectedChannel.moderationEnabled && newMessage.includes('inappropriate')) {
        setTimeout(() => {
          setModerationAlerts(prev => prev + 1);
          toast.error('Message flagged for review');
        }, 1000);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleToggleEncryption = async () => {
    try {
      const newStatus = encryptionStatus === 'enabled' ? 'disabled' : 'enabled';
      setEncryptionStatus(newStatus);
      
      if (selectedChannel) {
        setChannels(prev => prev.map(channel => 
          channel.id === selectedChannel.id 
            ? { ...channel, encryptionEnabled: newStatus === 'enabled' }
            : channel
        ));
      }
      
      toast.success(`Encryption ${newStatus}`);
      
    } catch (error) {
      console.error('Failed to toggle encryption:', error);
      toast.error('Failed to toggle encryption');
    }
  };

  const getChannelIcon = (channel: ChatChannel) => {
    if (channel.type === 'direct') return <Users className="w-4 h-4" />;
    if (channel.isPrivate) return <Lock className="w-4 h-4" />;
    return <Hash className="w-4 h-4" />;
  };

  const getMessageStatusIcon = (message: ChatMessage) => {
    if (message.encrypted) return <Lock className="w-3 h-3 text-green-600" />;
    if (message.moderationStatus === 'flagged') return <Flag className="w-3 h-3 text-red-600" />;
    if (message.moderationStatus === 'pending') return <Eye className="w-3 h-3 text-yellow-600" />;
    return null;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className={`h-full flex ${className}`}>
      {/* Left Sidebar - Channels */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Enhanced Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
              {hasEnterprise && (
                <Badge className="px-2 py-1 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-full">
                  Enterprise
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Enterprise Alerts */}
              {hasEnterprise && (moderationAlerts > 0 || retentionWarnings > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEnterprisePanel(true)}
                  className="relative"
                >
                  <Shield className="w-4 h-4" />
                  {(moderationAlerts + retentionWarnings) > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                      {moderationAlerts + retentionWarnings}
                    </Badge>
                  )}
                </Button>
              )}
              
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Enterprise Quick Actions */}
          {hasEnterprise && (
            <div className="flex gap-2 mb-4">
              <FeatureGate feature="chat_e2e_encryption" businessId={businessId}>
                <Button
                  variant={encryptionStatus === 'enabled' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={handleToggleEncryption}
                  className="flex-1"
                >
                  <Key className="w-3 h-3 mr-1" />
                  {encryptionStatus === 'enabled' ? 'Encrypted' : 'Encrypt'}
                </Button>
              </FeatureGate>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEnterprisePanel(true)}
                className="flex-1"
              >
                <Settings className="w-3 h-3 mr-1" />
                Enterprise
              </Button>
            </div>
          )}
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {/* Channels List */}
        <div className="flex-1 overflow-y-auto">
          {channels.map((channel) => (
            <div
              key={channel.id}
              onClick={() => setSelectedChannel(channel)}
              className={`p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                selectedChannel?.id === channel.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getChannelIcon(channel)}
                  <span className="font-medium text-gray-900">{channel.name}</span>
                  {channel.encryptionEnabled && (
                    <Lock className="w-3 h-3 text-green-600" />
                  )}
                  {channel.moderationEnabled && (
                    <Shield className="w-3 h-3 text-blue-600" />
                  )}
                </div>
                {channel.unreadCount > 0 && (
                  <Badge className="w-5 h-5 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                    {channel.unreadCount}
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-gray-600 truncate">{channel.lastMessage}</div>
              
              {/* Enterprise Info */}
              {hasEnterprise && channel.retentionPolicy && (
                <div className="text-xs text-gray-500 mt-1">
                  Policy: {channel.retentionPolicy}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getChannelIcon(selectedChannel)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedChannel.name}</h3>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span>{selectedChannel.members.length} members</span>
                      {selectedChannel.encryptionEnabled && (
                        <Badge className="px-1 py-0.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded">
                          <Lock className="w-3 h-3 mr-1" />
                          Encrypted
                        </Badge>
                      )}
                      {selectedChannel.retentionPolicy && (
                        <Badge className="px-1 py-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded">
                          <Archive className="w-3 h-3 mr-1" />
                          {selectedChannel.retentionPolicy}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <FeatureGate feature="chat_video_calls" businessId={businessId}>
                    <Button variant="ghost" size="sm">
                      <Video className="w-4 h-4" />
                    </Button>
                  </FeatureGate>
                  
                  <FeatureGate feature="chat_voice_calls" businessId={businessId}>
                    <Button variant="ghost" size="sm">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </FeatureGate>
                  
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <Avatar
                    src={message.sender.avatar}
                    alt={message.sender.name}
                    size={32}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{message.sender.name}</span>
                      <span className="text-xs text-gray-500">{message.sender.role}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {getMessageStatusIcon(message)}
                      {message.complianceFlags && message.complianceFlags.length > 0 && (
                        <div className="flex gap-1">
                          {message.complianceFlags.map(flag => (
                            <Badge key={flag} className="px-1 py-0.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className={`text-gray-900 ${
                      message.moderationStatus === 'quarantined' ? 'opacity-50 line-through' : ''
                    }`}>
                      {message.content}
                    </div>
                    
                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {message.reactions.map((reaction, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs bg-gray-100 hover:bg-gray-200"
                          >
                            {reaction.emoji} {reaction.users.length}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="w-4 h-4" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    placeholder={`Message ${selectedChannel.name}...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="pr-10"
                  />
                  {selectedChannel.encryptionEnabled && (
                    <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600" />
                  )}
                </div>
                
                <Button variant="ghost" size="sm" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Smile className="w-4 h-4" />
                </Button>
                
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Enterprise Panel */}
      {showEnterprisePanel && hasEnterprise && (
        <div className="w-96 border-l border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Enterprise Features</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEnterprisePanel(false)}
              >
                ×
              </Button>
            </div>
            
            {/* Enterprise Tabs */}
            <div className="flex space-x-1 mt-4">
              {[
                { id: 'retention', label: 'Retention', icon: Archive, alerts: retentionWarnings },
                { id: 'moderation', label: 'Moderation', icon: Shield, alerts: moderationAlerts },
                { id: 'encryption', label: 'Encryption', icon: Key, alerts: 0 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveEnterpriseTab(tab.id as any)}
                  className={`flex items-center px-3 py-2 rounded text-sm font-medium transition-colors relative ${
                    activeEnterpriseTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-1" />
                  {tab.label}
                  {tab.alerts > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                      {tab.alerts}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-full overflow-y-auto">
            {activeEnterpriseTab === 'retention' && (
              <MessageRetentionPanel
                businessId={businessId}
                conversationId={selectedChannel?.id}
                className="border-0"
              />
            )}
            {activeEnterpriseTab === 'moderation' && (
              <ContentModerationPanel
                businessId={businessId}
                conversationId={selectedChannel?.id}
                className="border-0"
              />
            )}
            {activeEnterpriseTab === 'encryption' && (
              <EncryptionPanel
                businessId={businessId}
                conversationId={selectedChannel?.id}
                className="border-0"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
