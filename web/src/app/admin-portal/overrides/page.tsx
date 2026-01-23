'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import { Card } from 'shared/components';
import { 
  Shield, 
  Users, 
  Building2,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
  _count: {
    businesses: number;
    subscriptions: number;
  };
}

interface Business {
  id: string;
  name: string;
  ein: string | null;
  tier: string | null;
  effectiveTier: string;
  industry: string | null;
  size: string | null;
  memberCount: number;
  hasActiveSubscription: boolean;
  createdAt: Date;
}

export default function AdminOverridesPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [businessSearch, setBusinessSearch] = useState('');

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadData();
    }
  }, [status, session]);

  const getAuthHeaders = async () => {
    const session = await getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }
    
    return headers;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [usersRes, businessesRes] = await Promise.all([
        fetch('/api/admin-override/users', { headers }),
        fetch('/api/admin-override/businesses', { headers })
      ]);

      if (!usersRes.ok || !businessesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const usersData = await usersRes.json();
      const businessesData = await businessesRes.json();

      setUsers(usersData.users || []);
      setBusinesses(businessesData.businesses || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const makeAdmin = async (userId: string, userEmail: string) => {
    if (!confirm(`Grant admin access to ${userEmail}?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin-override/users/${userId}/make-admin`, { 
        method: 'POST',
        headers 
      });
      if (!res.ok) throw new Error('Failed to grant admin');
      showMessage('success', `${userEmail} is now an admin`);
      loadData();
    } catch (error) {
      console.error('Error granting admin:', error);
      showMessage('error', 'Failed to grant admin access');
    }
  };

  const revokeAdmin = async (userId: string, userEmail: string) => {
    if (!confirm(`Revoke admin access from ${userEmail}?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin-override/users/${userId}/revoke-admin`, { 
        method: 'POST',
        headers 
      });
      if (!res.ok) throw new Error('Failed to revoke admin');
      showMessage('success', `Admin access revoked from ${userEmail}`);
      loadData();
    } catch (error) {
      console.error('Error revoking admin:', error);
      showMessage('error', 'Failed to revoke admin access');
    }
  };

  const setBusinessTier = async (businessId: string, businessName: string, tier: string) => {
    if (!confirm(`Set "${businessName}" to ${tier.toUpperCase()} tier?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin-override/businesses/${businessId}/set-tier`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tier })
      });
      if (!res.ok) throw new Error('Failed to set tier');
      showMessage('success', `${businessName} is now on ${tier.toUpperCase()} tier`);
      loadData();
    } catch (error) {
      console.error('Error setting tier:', error);
      showMessage('error', 'Failed to set business tier');
    }
  };

  const getTierBadgeClass = (tier: string): string => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'business_basic': return 'bg-blue-100 text-blue-800';
      case 'business_advanced': return 'bg-yellow-100 text-yellow-800';
      case 'enterprise': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadgeClass = (role: string): string => {
    return role === 'ADMIN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    const searchLower = userSearch.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.name && user.name.toLowerCase().includes(searchLower))
    );
  });

  // Filter businesses based on search
  const filteredBusinesses = businesses.filter(business => {
    const searchLower = businessSearch.toLowerCase();
    return (
      business.name.toLowerCase().includes(searchLower) ||
      (business.ein && business.ein.toLowerCase().includes(searchLower)) ||
      (business.industry && business.industry.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Overrides</h1>
            <p className="text-sm text-gray-500">Manually manage user roles and business tiers</p>
          </div>
        </div>
        <div className="mt-4 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overrides</h1>
          <p className="text-sm text-gray-500">Manually manage user roles and business tiers for testing and special cases</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* User Management */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">Grant or revoke admin access</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {userSearch && (
            <div className="mt-2 text-sm text-gray-600">
              Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {userSearch ? `No users found matching "${userSearch}"` : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user._count.businesses} businesses · {user._count.subscriptions} subscriptions
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.role === 'ADMIN' ? (
                      <button
                        onClick={() => revokeAdmin(user.id, user.email)}
                        className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
                      >
                        Revoke Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => makeAdmin(user.id, user.email)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                      Make Admin
                    </button>
                  )}
                </td>
              </tr>
            )))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Business Tier Management */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Business Tier Management</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">Set business subscription tiers without payment</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search businesses..."
                value={businessSearch}
                onChange={(e) => setBusinessSearch(e.target.value)}
                className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {businessSearch && (
                <button
                  onClick={() => setBusinessSearch('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {businessSearch && (
            <div className="mt-2 text-sm text-gray-600">
              Found {filteredBusinesses.length} business{filteredBusinesses.length !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Set Tier
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {businessSearch ? `No businesses found matching "${businessSearch}"` : 'No businesses found'}
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {business.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {business.industry || 'No industry'} · {business.size || 'No size'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTierBadgeClass(business.effectiveTier)}`}>
                      {business.effectiveTier.replace('_', ' ').toUpperCase()}
                    </span>
                    {business.hasActiveSubscription && (
                      <span className="ml-2 text-xs text-green-600">✓ Active Sub</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {business.memberCount} members · EIN: {business.ein || 'None'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setBusinessTier(business.id, business.name, 'free')}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Free
                      </button>
                      <button
                        onClick={() => setBusinessTier(business.id, business.name, 'business_basic')}
                        className="px-2 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
                      >
                        Basic
                      </button>
                      <button
                        onClick={() => setBusinessTier(business.id, business.name, 'business_advanced')}
                        className="px-2 py-1 text-xs border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50"
                      >
                        Advanced
                      </button>
                      <button
                        onClick={() => setBusinessTier(business.id, business.name, 'enterprise')}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                      Enterprise
                    </button>
                  </div>
                </td>
              </tr>
            )))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

