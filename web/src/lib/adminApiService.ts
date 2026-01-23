import { getSession } from 'next-auth/react';

// Route admin API calls through Next.js API proxy to avoid CORS and centralize auth
const API_BASE = '/api/admin-portal';

// Admin data interfaces
export interface SystemConfig {
  configKey: string;
  configValue: string | number | boolean;
  description: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AnalyticsFilters {
  dateRange?: string;
  userType?: string;
  metric?: string;
  businessId?: string;
  moduleId?: string;
}

export interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalRevenue: number;
  moduleUsage: Record<string, number>;
  userGrowth: number;
  revenueGrowth: number;
}

export interface BusinessIntelligenceData {
  userGrowth: {
    totalUsers: number;
    newUsers: number;
    growthRate: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  revenueMetrics: {
    totalRevenue: number;
    monthlyRevenue: number;
    growthRate: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  engagementMetrics: {
    activeUsers: number;
    averageSessionTime: number;
    featureUsage: Record<string, number>;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  predictiveInsights: Array<{
    type: string;
    title: string;
    description: string;
    confidence: number;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export interface ABTestData {
  name: string;
  description: string;
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  trafficSplit: number;
  metrics: string[];
  status: 'running' | 'paused' | 'completed';
}

export interface UserSegmentData {
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  filters: Record<string, unknown>;
  userCount: number;
}

export interface ReportConfig {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  format: 'csv' | 'json' | 'pdf';
  filters: Record<string, unknown>;
}

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  userId: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  application: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    activeUsers: number;
  };
  database: {
    connections: number;
    queries: number;
    cacheHitRate: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  userEmail?: string;
  adminId: string;
  adminEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface ModuleSubmission {
  id: string;
  moduleId: string;
  moduleName: string;
  developerId: string;
  developerName: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  reviewerId?: string;
}

export interface ModuleManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  entryPoint: string;
  permissions: string[];
  dependencies: string[];
  runtime: {
    apiVersion: string;
    nodeVersion?: string;
  };
  frontend: {
    entryUrl: string;
    styles?: string[];
    scripts?: string[];
  };
  settings: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    default: unknown;
    description: string;
    required?: boolean;
    options?: string[];
  }>;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  totalPages?: number;
}

class AdminApiService {
  private async getAuthHeaders() {
    const session = await getSession();
    console.log('Admin API - Session:', { 
      hasSession: !!session, 
      hasToken: !!session?.accessToken,
      tokenLength: session?.accessToken?.length,
      userRole: session?.user?.role,
      userEmail: session?.user?.email
    });
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    } else {
      console.error('Admin API - No access token found in session');
    }
    
    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();
      console.log(`Admin API - Making request to ${endpoint}:`, {
        hasHeaders: !!headers,
        hasAuthHeader: !!headers.Authorization,
        authHeaderLength: headers.Authorization?.length,
        apiBase: API_BASE,
        fullUrl: `${API_BASE}${endpoint}`
      });
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        // We rely on Bearer tokens; cookies aren't required for admin API calls
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      console.log(`API Request to ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`API Error (${endpoint}):`, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      // Backend returns { success: true, data: { ... } }, extract the data property
      const data = responseData.success && responseData.data ? responseData.data : responseData;
      return { data };
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // DASHBOARD ANALYTICS
  // ============================================================================

  async getDashboardStats() {
    return this.makeRequest('/dashboard/stats');
  }

  async getRecentActivity() {
    return this.makeRequest('/dashboard/activity');
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    role?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/users?${searchParams.toString()}`);
  }

  async getUserDetails(userId: string) {
    return this.makeRequest(`/users/${userId}`);
  }

  async updateUserStatus(userId: string, status: string, reason?: string) {
    return this.makeRequest(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  async resetUserPassword(userId: string) {
    return this.makeRequest(`/users/${userId}/reset-password`, {
      method: 'POST',
    });
  }

  // ============================================================================
  // CONTENT MODERATION
  // ============================================================================

  async getReportedContent(filters: Record<string, unknown>) {
    return this.makeRequest('/moderation/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });
  }

  async updateReportStatus(reportId: string, status: string, action: string, reason?: string) {
    return this.makeRequest(`/moderation/reports/${reportId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, action, reason }),
    });
  }

  // ============================================================================
  // PLATFORM ANALYTICS
  // ============================================================================

  async getSystemMetrics(timeRange: string = '24h') {
    return this.makeRequest(`/analytics/system?timeRange=${timeRange}`);
  }

  async getUserAnalytics(timeRange: string = '30d') {
    return this.makeRequest(`/analytics/users?timeRange=${timeRange}`);
  }

  // ============================================================================
  // FINANCIAL MANAGEMENT
  // ============================================================================

  async getSubscriptions(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/billing/subscriptions?${searchParams.toString()}`);
  }

  async getPriceHistory(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/pricing/history/all', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }

  async getPayments(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/billing/payments?${searchParams.toString()}`);
  }

  async getDeveloperPayouts(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/billing/payouts?${searchParams.toString()}`);
  }

  // Stripe sync methods
  async syncSubscriptionFromStripe(subscriptionId: string) {
    return this.makeRequest(`/billing/subscriptions/${subscriptionId}/sync`, {
      method: 'POST'
    });
  }

  async syncInvoiceFromStripe(invoiceId: string) {
    return this.makeRequest(`/billing/invoices/${invoiceId}/sync`, {
      method: 'POST'
    });
  }

  async syncAllSubscriptions(filters?: { userId?: string; businessId?: string }) {
    return this.makeRequest('/billing/subscriptions/sync-all', {
      method: 'POST',
      body: JSON.stringify(filters || {})
    });
  }

  async getEnhancedSubscription(subscriptionId: string) {
    return this.makeRequest(`/billing/subscriptions/${subscriptionId}/enhanced`);
  }

  async getEnhancedInvoice(invoiceId: string) {
    return this.makeRequest(`/billing/invoices/${invoiceId}/enhanced`);
  }

  // ============================================================================
  // SECURITY & COMPLIANCE
  // ============================================================================

  async getSecurityEvents(params: {
    page?: number;
    limit?: number;
    severity?: string;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/security/events?${searchParams.toString()}`);
  }

  async getSecurityMetrics() {
    return this.makeRequest('/security/metrics');
  }

  async getComplianceStatus() {
    return this.makeRequest('/security/compliance');
  }

  async resolveSecurityEvent(eventId: string) {
    return this.makeRequest(`/security/events/${eventId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
  }) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/security/audit-logs?${searchParams.toString()}`);
  }

  // ============================================================================
  // SYSTEM ADMINISTRATION
  // ============================================================================

  async getSystemHealth() {
    return this.makeRequest('/system/health');
  }

  async getSystemConfig() {
    return this.makeRequest('/system/config');
  }

  async updateSystemConfig(configKey: string, configValue: string | number | boolean, description: string) {
    return this.makeRequest(`/system/config/${configKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ configValue, description }),
    });
  }

  // System administration methods
  async getBackupStatus() {
    return this.makeRequest('/system/backup');
  }

  async createBackup() {
    return this.makeRequest('/system/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getMaintenanceMode() {
    return this.makeRequest('/system/maintenance');
  }

  async setMaintenanceMode(enabled: boolean, message?: string) {
    return this.makeRequest('/system/maintenance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled, message }),
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async exportData(endpoint: string, params: Record<string, unknown> = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}/export?${searchParams.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint.replace('/', '')}_export.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async bulkAction(endpoint: string, action: string, itemIds: string[]) {
    return this.makeRequest(`${endpoint}/bulk`, {
      method: 'POST',
      body: JSON.stringify({ action, itemIds }),
    });
  }

  // Analytics methods
  async getAnalytics(filters: AnalyticsFilters) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'all') {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    return this.makeRequest(`/analytics${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  }

  async exportAnalytics(filters: AnalyticsFilters, format: 'csv' | 'json') {
    return this.makeRequest(`/analytics/export?format=${format}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });
  }

  async getRealTimeMetrics() {
    return this.makeRequest('/analytics/realtime');
  }

  async getCustomReport(reportConfig: ReportConfig) {
    return this.makeRequest('/analytics/custom-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportConfig),
    });
  }

  // Moderation methods
  async getModerationStats() {
    return this.makeRequest('/moderation/stats');
  }

  async getModerationRules() {
    return this.makeRequest('/moderation/rules');
  }

  async bulkModerationAction(reportIds: string[], action: string) {
    return this.makeRequest('/moderation/bulk-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportIds, action }),
    });
  }

  // Module Management methods
  async getModuleSubmissions(filters?: Record<string, unknown>): Promise<ApiResponse<ModuleSubmission[]>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }

    const endpoint = `/modules/submissions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Getting module submissions:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async getModuleStats(): Promise<ApiResponse<any>> {
    console.log('Getting module stats');
    return this.makeRequest(`/modules/stats`, {
      method: 'GET'
    });
  }

  async reviewModuleSubmission(
    submissionId: string, 
    action: 'approve' | 'reject', 
    reviewNotes?: string
  ): Promise<ApiResponse<any>> {
    console.log('Reviewing module submission:', submissionId, action);
    return this.makeRequest(`/modules/submissions/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, reviewNotes })
    });
  }

  async bulkModuleAction(
    submissionIds: string[], 
    action: 'approve' | 'reject'
  ): Promise<ApiResponse<any>> {
    console.log('Bulk module action:', action, submissionIds);
    return this.makeRequest(`/modules/bulk-action`, {
      method: 'POST',
      body: JSON.stringify({ submissionIds, action })
    });
  }

  async getModuleAnalytics(): Promise<ApiResponse<any>> {
    console.log('Getting module analytics');
    return this.makeRequest(`/modules/analytics`, {
      method: 'GET'
    });
  }

  async getDeveloperStats(): Promise<ApiResponse<any>> {
    console.log('Getting developer stats');
    return this.makeRequest(`/modules/developers/stats`, {
      method: 'GET'
    });
  }

  async updateModuleStatus(
    moduleId: string, 
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  ): Promise<ApiResponse<any>> {
    console.log('Updating module status:', moduleId, status);
    return this.makeRequest(`/modules/${moduleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async getModuleRevenue(moduleId: string): Promise<ApiResponse<any>> {
    console.log('Getting module revenue:', moduleId);
    return this.makeRequest(`/modules/${moduleId}/revenue`, {
      method: 'GET'
    });
  }

  async exportModuleData(filters?: Record<string, unknown>): Promise<ApiResponse<Blob>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }

    const endpoint = `/modules/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Exporting module data:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  // Business Intelligence methods
  async getBusinessIntelligence(filters?: Record<string, unknown>): Promise<ApiResponse<BusinessIntelligenceData>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }

    const endpoint = `/business-intelligence${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Getting business intelligence data:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async exportBusinessIntelligence(filters?: Record<string, unknown>, format: 'csv' | 'pdf' = 'csv'): Promise<ApiResponse<Blob>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }
    queryParams.append('format', format);

    const endpoint = `/business-intelligence/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Exporting business intelligence data:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async createABTest(testData: ABTestData): Promise<ApiResponse<ABTestData>> {
    console.log('Creating A/B test:', testData);
    return this.makeRequest(`/business-intelligence/ab-tests`, {
      method: 'POST',
      body: JSON.stringify(testData)
    });
  }

  async getABTestResults(testId: string): Promise<ApiResponse<any>> {
    console.log('Getting A/B test results:', testId);
    return this.makeRequest(`/business-intelligence/ab-tests/${testId}/results`, {
      method: 'GET'
    });
  }

  async updateABTest(testId: string, updates: Partial<ABTestData>): Promise<ApiResponse<ABTestData>> {
    console.log('Updating A/B test:', testId, updates);
    return this.makeRequest(`/business-intelligence/ab-tests/${testId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async getUserSegments(): Promise<ApiResponse<any>> {
    console.log('Getting user segments');
    return this.makeRequest(`/business-intelligence/user-segments`, {
      method: 'GET'
    });
  }

  async createUserSegment(segmentData: UserSegmentData): Promise<ApiResponse<UserSegmentData>> {
    console.log('Creating user segment:', segmentData);
    return this.makeRequest(`/business-intelligence/user-segments`, {
      method: 'POST',
      body: JSON.stringify(segmentData)
    });
  }

  async getPredictiveInsights(): Promise<ApiResponse<any>> {
    console.log('Getting predictive insights');
    return this.makeRequest(`/business-intelligence/predictive-insights`, {
      method: 'GET'
    });
  }

  async getCompetitiveAnalysis(): Promise<ApiResponse<any>> {
    console.log('Getting competitive analysis');
    return this.makeRequest(`/business-intelligence/competitive-analysis`, {
      method: 'GET'
    });
  }

  async generateCustomReport(reportConfig: ReportConfig): Promise<ApiResponse<Record<string, unknown>>> {
    console.log('Generating custom report:', reportConfig);
    return this.makeRequest(`/business-intelligence/custom-report`, {
      method: 'POST',
      body: JSON.stringify(reportConfig)
    });
  }

  // Customer Support methods
  async getSupportTickets(filters?: Record<string, unknown>): Promise<ApiResponse<SupportTicket[]>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }

    const endpoint = `/support/tickets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Getting support tickets:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async getSupportStats(): Promise<ApiResponse<any>> {
    console.log('Getting support stats');
    return this.makeRequest(`/support/stats`, {
      method: 'GET'
    });
  }

  async updateSupportTicket(ticketId: string, action: string, data?: Record<string, unknown>): Promise<ApiResponse<SupportTicket>> {
    console.log('Updating support ticket:', ticketId, action);
    return this.makeRequest(`/support/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, data })
    });
  }

  async getKnowledgeBase(): Promise<ApiResponse<any>> {
    console.log('Getting knowledge base');
    return this.makeRequest(`/support/knowledge-base`, {
      method: 'GET'
    });
  }

  async updateKnowledgeArticle(articleId: string, action: string, data?: Record<string, unknown>): Promise<ApiResponse<KnowledgeArticle>> {
    console.log('Updating knowledge article:', articleId, action);
    return this.makeRequest(`/support/knowledge-base/${articleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, data })
    });
  }

  async getLiveChats(): Promise<ApiResponse<any>> {
    console.log('Getting live chats');
    return this.makeRequest(`/support/live-chats`, {
      method: 'GET'
    });
  }

  async joinLiveChat(chatId: string): Promise<ApiResponse<any>> {
    console.log('Joining live chat:', chatId);
    return this.makeRequest(`/support/live-chats/${chatId}/join`, {
      method: 'POST'
    });
  }

  async getSupportAnalytics(): Promise<ApiResponse<any>> {
    console.log('Getting support analytics');
    return this.makeRequest(`/support/analytics`, {
      method: 'GET'
    });
  }

  async createSupportTicket(ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<SupportTicket>> {
    console.log('Creating support ticket:', ticketData);
    return this.makeRequest(`/support/tickets`, {
      method: 'POST',
      body: JSON.stringify(ticketData)
    });
  }

  async createKnowledgeArticle(articleData: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<KnowledgeArticle>> {
    console.log('Creating knowledge article:', articleData);
    return this.makeRequest(`/support/knowledge-base`, {
      method: 'POST',
      body: JSON.stringify(articleData)
    });
  }

  async exportSupportData(filters?: Record<string, unknown>, format: 'csv' | 'pdf' = 'csv'): Promise<ApiResponse<Blob>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }
    queryParams.append('format', format);

    const endpoint = `/support/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Exporting support data:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  // Performance & Scalability methods
  async getPerformanceMetrics(filters?: Record<string, unknown>): Promise<ApiResponse<PerformanceMetrics>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }

    const endpoint = `/performance/metrics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Getting performance metrics:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async getScalabilityMetrics(): Promise<ApiResponse<any>> {
    console.log('Getting scalability metrics');
    return this.makeRequest(`/performance/scalability`, {
      method: 'GET'
    });
  }

  async getOptimizationRecommendations(): Promise<ApiResponse<any>> {
    console.log('Getting optimization recommendations');
    return this.makeRequest(`/performance/optimization`, {
      method: 'GET'
    });
  }

  async updateOptimizationRecommendation(recommendationId: string, action: string): Promise<ApiResponse<any>> {
    console.log('Updating optimization recommendation:', recommendationId, action);
    return this.makeRequest(`/performance/optimization/${recommendationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action })
    });
  }

  async getPerformanceAlerts(filters?: Record<string, unknown>): Promise<ApiResponse<PerformanceAlert[]>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }

    const endpoint = `/performance/alerts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Getting performance alerts:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async updatePerformanceAlert(alertId: string, action: string): Promise<ApiResponse<any>> {
    console.log('Updating performance alert:', alertId, action);
    return this.makeRequest(`/performance/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action })
    });
  }

  async getPerformanceAnalytics(): Promise<ApiResponse<any>> {
    console.log('Getting performance analytics');
    return this.makeRequest(`/performance/analytics`, {
      method: 'GET'
    });
  }

  async configurePerformanceAlert(alertConfig: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): Promise<ApiResponse<PerformanceAlert>> {
    console.log('Configuring performance alert:', alertConfig);
    return this.makeRequest(`/performance/alerts/configure`, {
      method: 'POST',
      body: JSON.stringify(alertConfig)
    });
  }

  async exportPerformanceData(filters?: Record<string, unknown>, format: 'csv' | 'pdf' = 'csv'): Promise<ApiResponse<Blob>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }
    queryParams.append('format', format);

    const endpoint = `/performance/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Exporting performance data:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  async exportSecurityReport(filters: Record<string, unknown>, format: 'csv' | 'json') {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value as string);
        }
      });
    }
    queryParams.append('format', format);

    const endpoint = `/security/export?${queryParams.toString()}`;
    console.log('Exporting security report:', endpoint);
    
    return this.makeRequest(endpoint, {
      method: 'GET'
    });
  }

  // Add type definitions for module management
  async startImpersonation(
    userId: string,
    options: {
      reason?: string;
      businessId?: string;
      context?: string;
      expiresInMinutes?: number;
    } = {}
  ): Promise<ApiResponse<any>> {
    return this.makeRequest(`/users/${userId}/impersonate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: options.reason,
        businessId: options.businessId,
        context: options.context,
        expiresInMinutes: options.expiresInMinutes,
      }),
    });
  }

  async endImpersonation(): Promise<ApiResponse<any>> {
    return this.makeRequest('/impersonation/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getCurrentImpersonation(): Promise<ApiResponse<any>> {
    return this.makeRequest('/impersonation/current');
  }

  async getImpersonationBusinesses(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);

    const endpoint = `/impersonation/businesses${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }

  async getImpersonationBusinessMembers(businessId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/impersonation/businesses/${businessId}/members`);
  }

  async seedImpersonationPersonas(businessId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/impersonation/businesses/${businessId}/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getImpersonationHistory(params: {
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    return this.makeRequest(`/impersonation/history?${queryParams.toString()}`);
  }

  // ============================================================================
  // TESTING
  // ============================================================================

  async getTestFiles(): Promise<ApiResponse<{ testFiles: Array<{ path: string; relativePath: string; name: string }>; count: number }>> {
    return this.makeRequest('/testing/list');
  }

  async getTestStatus(): Promise<ApiResponse<any>> {
    return this.makeRequest('/testing/status');
  }

  async runTests(testFile?: string): Promise<ApiResponse<any>> {
    return this.makeRequest('/testing/run', {
      method: 'POST',
      body: JSON.stringify({ testFile: testFile || null })
    });
  }

  async getTestCoverage(): Promise<ApiResponse<any>> {
    return this.makeRequest('/testing/coverage');
  }

  // ============================================================================
  // AI PROVIDER USAGE & EXPENSES
  // ============================================================================

  async getAIProviderUsageCombined(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    // Call through Next.js API proxy which routes to /api/admin/ai-providers
    return fetch(`/api/admin/ai-providers/usage/combined${params.toString() ? '?' + params.toString() : ''}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderUsageOpenAI(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetch(`/api/admin/ai-providers/usage/openai${params.toString() ? '?' + params.toString() : ''}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderUsageAnthropic(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetch(`/api/admin/ai-providers/usage/anthropic${params.toString() ? '?' + params.toString() : ''}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderExpensesOpenAI(period: string = 'month') {
    return fetch(`/api/admin/ai-providers/expenses/openai?period=${period}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderExpensesAnthropic(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetch(`/api/admin/ai-providers/expenses/anthropic${params.toString() ? '?' + params.toString() : ''}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderExpensesCombined(period: string = 'month', startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetch(`/api/admin/ai-providers/expenses/providers?${params.toString()}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderHistoricalUsage(provider: 'openai' | 'anthropic' | 'all' = 'all', startDate?: string, endDate?: string, groupBy: 'day' | 'week' | 'month' = 'day') {
    const params = new URLSearchParams();
    params.append('provider', provider);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (groupBy) params.append('groupBy', groupBy);
    return fetch(`/api/admin/ai-providers/history/usage?${params.toString()}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  async getAIProviderHistoricalExpenses(provider: 'openai' | 'anthropic' | 'all' = 'all', period: 'day' | 'week' | 'month' | 'year' = 'month', startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    params.append('provider', provider);
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetch(`/api/admin/ai-providers/history/expenses?${params.toString()}`, {
      headers: await this.getAuthHeaders(),
      credentials: 'include'
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return { error: error.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data: data.success && data.data ? data.data : data };
    }).catch(error => ({ error: error.message }));
  }

  // ============================================================================
  // BUSINESS AI METHODS
  // ============================================================================

  async getBusinessAIGlobal(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/admin/business-ai/global', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }

  async getBusinessAIPatterns(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/admin/business-ai/patterns', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }

  // ============================================================================
  // CENTRALIZED AI METHODS
  // ============================================================================

  async getCentralizedAIHealth(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/centralized-ai/health', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }

  async getCentralizedAIPatterns(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/centralized-ai/patterns', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }

  async getCentralizedAIInsights(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/centralized-ai/insights', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }

  async getCentralizedAIPrivacySettings(): Promise<ApiResponse<any>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch('/api/centralized-ai/privacy/settings', {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json();
    const data = responseData.success && responseData.data ? responseData.data : responseData;
    return { data };
  }
}

// Module stats interface
interface ModuleStats {
  totalSubmissions: number;
  pendingReviews: number;
  approvedToday: number;
  rejectedToday: number;
  totalRevenue: number;
  activeDevelopers: number;
  averageRating: number;
  topCategory: string;
}

// Export types for better TypeScript support
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalBusinesses: number;
  monthlyRevenue: number;
  systemHealth: number;
  userGrowthTrend?: number;
  businessGrowthTrend?: number;
  revenueGrowthTrend?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  userNumber: string;
  role: string;
  status: string;
  createdAt: string;
  lastActive: string;
  emailVerified: boolean;
  _count?: {
    businesses: number;
    conversations: number;
    files: number;
  };
}

export interface ContentReport {
  id: string;
  contentType: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  action?: string;
  reporter: {
    email: string;
    name: string;
  };
}

// Named instance export for use in admin portal pages
export const adminApiService = new AdminApiService();