'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useBusinessConfiguration } from '@/contexts/BusinessConfigurationContext';
import { getBusiness, updateBusiness, uploadLogo, removeLogo } from '../../../../../api/business';
import { Card, Button, Badge, Spinner, Alert, Modal, Toast, Avatar } from 'shared/components';
import BillingModal from '../../../../../components/BillingModal';
import { 
  Settings, 
  Building2, 
  Palette, 
  Shield, 
  Users, 
  CreditCard,
  Bell,
  Globe,
  Save,
  Edit,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Calendar
} from 'lucide-react';
import { useBusinessBranding } from '../../../../../components/BusinessBranding';
import SchedulingConfiguration from '../../../../../components/business/SchedulingConfiguration';

interface Business {
  id: string;
  name: string;
  ein: string;
  einVerified: boolean;
  industry?: string;
  size?: string;
  website?: string;
  address?: any;
  phone?: string;
  email?: string;
  description?: string;
  logo?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    customCSS?: string;
  };
  schedulingMode?: string;
  schedulingStrategy?: string;
  schedulingConfig?: any;
  ssoConfig?: any;
  members?: Array<{
    userId: string;
    role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
    canManage?: boolean;
  }>;
}

interface FormErrors {
  name?: string;
  email?: string;
  website?: string;
  phone?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

const FONT_OPTIONS = [
  { value: '', label: 'System Default', preview: 'The quick brown fox' },
  { value: 'Inter', label: 'Inter', preview: 'The quick brown fox' },
  { value: 'Roboto', label: 'Roboto', preview: 'The quick brown fox' },
  { value: 'Open Sans', label: 'Open Sans', preview: 'The quick brown fox' },
  { value: 'Lato', label: 'Lato', preview: 'The quick brown fox' },
  { value: 'Poppins', label: 'Poppins', preview: 'The quick brown fox' },
  { value: 'Montserrat', label: 'Montserrat', preview: 'The quick brown fox' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro', preview: 'The quick brown fox' },
];

export default function BusinessSettingsPage() {
  const params = useParams();
  const { data: session } = useSession();
  const { hasPermission } = useBusinessConfiguration();
  const businessId = params?.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'security' | 'billing' | 'notifications' | 'scheduling'>('profile');
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const canManageSettings = hasPermission('settings', 'manage');
  const [showBillingModal, setShowBillingModal] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({
    name: '',
    industry: '',
    size: '',
    website: '',
    phone: '',
    email: '',
    description: ''
  });

  const [brandingForm, setBrandingForm] = useState({
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    accentColor: '#f59e0b',
    fontFamily: '',
    customCSS: ''
  });

  const { applyBranding } = useBusinessBranding();

  useEffect(() => {
    if (businessId && session?.accessToken) {
      loadBusinessData(session.accessToken);
    }
  }, [businessId, session?.accessToken]);

  // Live preview: update branding context on form change
  useEffect(() => {
    applyBranding({
      id: businessId,
      name: business?.name || '',
      logo: business?.logo,
      ...brandingForm,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandingForm]);

  // Check if user can manage business settings
  useEffect(() => {
    if (business && session?.user?.id) {
      const userMember = business.members?.find(m => m.userId === session.user.id);
      setCanManage(userMember?.canManage || userMember?.role === 'ADMIN' || userMember?.role === 'MANAGER' || false);
    }
  }, [business, session?.user?.id]);

  const validateProfileForm = (): boolean => {
    const errors: FormErrors = {};

    if (!profileForm.name.trim()) {
      errors.name = 'Business name is required';
    }

    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (profileForm.website && !/^https?:\/\/.+/.test(profileForm.website)) {
      errors.website = 'Please enter a valid URL (include http:// or https://)';
    }

    if (profileForm.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(profileForm.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBrandingForm = (): boolean => {
    const errors: FormErrors = {};

    if (!/^#[0-9A-F]{6}$/i.test(brandingForm.primaryColor)) {
      errors.primaryColor = 'Please enter a valid hex color';
    }

    if (!/^#[0-9A-F]{6}$/i.test(brandingForm.secondaryColor)) {
      errors.secondaryColor = 'Please enter a valid hex color';
    }

    if (!/^#[0-9A-F]{6}$/i.test(brandingForm.accentColor)) {
      errors.accentColor = 'Please enter a valid hex color';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const loadBusinessData = async (token: string) => {
    if (!token || !businessId) {
      setError('No authentication token or business ID available');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await getBusiness(businessId, token);
      
      if (response.success) {
        const businessData = response.data;
        setBusiness(businessData as unknown as Business);
        
        // Initialize form data
        setProfileForm({
          name: businessData.name || '',
          industry: businessData.industry || '',
          size: businessData.size || '',
          website: businessData.website || '',
          phone: businessData.phone || '',
          email: businessData.email || '',
          description: businessData.description || ''
        });

        setBrandingForm({
          primaryColor: businessData.branding?.primaryColor || '#3b82f6',
          secondaryColor: businessData.branding?.secondaryColor || '#1e40af',
          accentColor: (businessData.branding as any)?.accentColor || '#f59e0b',
          fontFamily: businessData.branding?.fontFamily || '',
          customCSS: businessData.branding?.customCSS || ''
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    if (!validateProfileForm()) {
      return;
    }

    if (!session?.accessToken || !businessId) {
      setError('No authentication token or business ID available');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const response = await updateBusiness(businessId, profileForm, session.accessToken);
      
      if (response.success) {
        setBusiness(prev => prev ? { ...prev, ...profileForm } : null);
        showSuccessMessage('Business profile updated successfully!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleBrandingSave = async () => {
    if (!validateBrandingForm()) {
      return;
    }

    if (!session?.accessToken || !businessId) {
      setError('No authentication token or business ID available');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const response = await updateBusiness(businessId, {
        branding: brandingForm
      }, session.accessToken);
      
      if (response.success) {
        setBusiness(prev => prev ? { 
          ...prev, 
          branding: { ...prev.branding, ...brandingForm } 
        } : null);
        showSuccessMessage('Branding settings updated successfully!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!session?.accessToken || !businessId) {
      setError('No authentication token or business ID available');
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);
      
      // Create a temporary URL for the file
      const tempUrl = URL.createObjectURL(file);
      
      // Upload the logo
      const response = await uploadLogo(businessId, tempUrl, session.accessToken);
      
      if (response.success) {
        setBusiness(prev => prev ? { ...prev, logo: response.data.logoUrl } : null);
        showSuccessMessage('Logo uploaded successfully!');
        setShowLogoUpload(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!session?.accessToken || !businessId) {
      setError('No authentication token or business ID available');
      return;
    }

    try {
      setRemovingLogo(true);
      setError(null);
      
      const response = await removeLogo(businessId, session.accessToken);
      
      if (response.success) {
        setBusiness(prev => prev ? { ...prev, logo: undefined } : null);
        showSuccessMessage('Logo removed successfully!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      handleLogoUpload(file);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: Building2 },
    { id: 'branding', name: 'Branding', icon: Palette },
    { id: 'scheduling', name: 'Scheduling', icon: Calendar },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'notifications', name: 'Notifications', icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert type="error" title="Error Loading Settings">
          {error}
        </Alert>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6">
        <Alert type="error" title="Business Not Found">
          The business you're looking for doesn't exist or you don't have access to it.
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-6 space-y-6 bg-white border-b">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure your business profile, branding, and preferences
            </p>
            {!canManage && (
              <div className="mt-2 flex items-center text-amber-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">You have read-only access to these settings</span>
              </div>
            )}
          </div>
          {saving && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Spinner size={16} />
              <span>Saving...</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
        {/* Profile Settings */}
        {activeTab === 'profile' && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Business Profile</h2>
              <div className="flex items-center space-x-3">
                <Avatar 
                  src={business.logo} 
                  alt={`${business.name} logo`}
                  size={48}
                  nameOrEmail={business.name}
                />
                {canManage && (
                  <Button variant="secondary" onClick={() => setShowLogoUpload(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  value={profileForm.industry}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, industry: e.target.value }))}
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !canManage ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Size
                </label>
                <select
                  value={profileForm.size}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, size: e.target.value }))}
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !canManage ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={profileForm.website}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.website ? 'border-red-300' : 'border-gray-300'
                  } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
                {formErrors.website && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.website}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.phone ? 'border-red-300' : 'border-gray-300'
                  } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
                {formErrors.phone && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@business.com"
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.email ? 'border-red-300' : 'border-gray-300'
                  } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.email}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Tell us about your business..."
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !canManage ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            {canManageSettings && (
              <div className="flex justify-end pt-6">
                <Button onClick={handleProfileSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Branding Settings */}
        {activeTab === 'branding' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Branding & Appearance</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={brandingForm.primaryColor}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                    disabled={!canManage}
                    className={`w-12 h-10 border border-gray-300 rounded-lg cursor-pointer ${
                      !canManage ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  />
                  <input
                    type="text"
                    value={brandingForm.primaryColor}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                    disabled={!canManage}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.primaryColor ? 'border-red-300' : 'border-gray-300'
                    } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                {formErrors.primaryColor && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.primaryColor}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={brandingForm.secondaryColor}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    disabled={!canManage}
                    className={`w-12 h-10 border border-gray-300 rounded-lg cursor-pointer ${
                      !canManage ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  />
                  <input
                    type="text"
                    value={brandingForm.secondaryColor}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    disabled={!canManage}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.secondaryColor ? 'border-red-300' : 'border-gray-300'
                    } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                {formErrors.secondaryColor && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.secondaryColor}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accent Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={brandingForm.accentColor}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, accentColor: e.target.value }))}
                    disabled={!canManage}
                    className={`w-12 h-10 border border-gray-300 rounded-lg cursor-pointer ${
                      !canManage ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  />
                  <input
                    type="text"
                    value={brandingForm.accentColor}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, accentColor: e.target.value }))}
                    disabled={!canManage}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.accentColor ? 'border-red-300' : 'border-gray-300'
                    } ${!canManage ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                {formErrors.accentColor && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.accentColor}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font Family
                </label>
                <select
                  value={brandingForm.fontFamily}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, fontFamily: e.target.value }))}
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !canManage ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
                {brandingForm.fontFamily && (
                  <p 
                    className="mt-2 text-sm text-gray-600"
                    style={{ fontFamily: brandingForm.fontFamily }}
                  >
                    {FONT_OPTIONS.find(f => f.value === brandingForm.fontFamily)?.preview}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom CSS
                </label>
                <textarea
                  value={brandingForm.customCSS}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, customCSS: e.target.value }))}
                  rows={6}
                  placeholder="/* Add custom CSS here */"
                  disabled={!canManage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                    !canManage ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            {canManageSettings && (
              <div className="flex justify-end pt-6">
                <Button onClick={handleBrandingSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Branding'}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Security Settings */}
        {activeTab === 'security' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Security & Access</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Single Sign-On (SSO)</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-4">
                    Configure SSO to allow your team to sign in with your organization's identity provider.
                  </p>
                  <Button variant="secondary" disabled={!canManage}>
                    <Globe className="w-4 h-4 mr-2" />
                    Configure SSO
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Two-Factor Authentication</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-4">
                    Require two-factor authentication for all team members.
                  </p>
                  <Button variant="secondary" disabled={!canManage}>
                    <Shield className="w-4 h-4 mr-2" />
                    Enable 2FA
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Session Management</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Session Timeout</p>
                      <p className="text-sm text-gray-500">Automatically sign out inactive users</p>
                    </div>
                    <select 
                      className={`px-3 py-2 border border-gray-300 rounded-lg ${
                        !canManage ? 'bg-gray-50 cursor-not-allowed' : ''
                      }`}
                      disabled={!canManage}
                    >
                      <option value="8h">8 hours</option>
                      <option value="24h">24 hours</option>
                      <option value="7d">7 days</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Billing Settings */}
        {activeTab === 'billing' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Billing & Subscription</h2>
            
            <div className="space-y-6">
              {/* Enterprise Plan Overview */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Enterprise Plan</h3>
                    <p className="text-gray-600">Per-user pricing for your business team</p>
                  </div>
                  <Badge color="blue">Business</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Team Members</p>
                    <p className="text-2xl font-bold text-gray-900">{business?.members?.length || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Cost per User</p>
                    <p className="text-2xl font-bold text-gray-900">$25-50</p>
                    <p className="text-xs text-gray-500">per month</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Estimated Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${((business?.members?.length || 0) * 35).toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500">per month</p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => setShowBillingModal(true)}
                  disabled={!canManage}
                  className="w-full"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Billing & Subscriptions
                </Button>
              </div>

              {/* Enterprise Features */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Enterprise Features Included</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Enterprise Modules</p>
                        <p className="text-sm text-gray-600">Access to all business-grade modules</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Org Chart & Permissions</p>
                        <p className="text-sm text-gray-600">Advanced team management</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Advanced Analytics</p>
                        <p className="text-sm text-gray-600">Business intelligence & insights</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Priority Support</p>
                        <p className="text-sm text-gray-600">24/7 business support</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Notifications Settings */}
        {activeTab === 'notifications' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">New member invitations</p>
                      <p className="text-sm text-gray-500">Get notified when someone invites a new member</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      defaultChecked 
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">File sharing</p>
                      <p className="text-sm text-gray-500">Get notified when files are shared with you</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      defaultChecked 
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Security alerts</p>
                      <p className="text-sm text-gray-500">Get notified about security-related events</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      defaultChecked 
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">In-App Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Real-time updates</p>
                      <p className="text-sm text-gray-500">Show notifications for real-time activity</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      defaultChecked 
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Sound notifications</p>
                      <p className="text-sm text-gray-500">Play sound for new notifications</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </div>
            </div>

            {canManageSettings && (
              <div className="flex justify-end pt-6">
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Scheduling Settings */}
        {activeTab === 'scheduling' && session?.accessToken && (
          <SchedulingConfiguration
            businessId={businessId}
            businessIndustry={business?.industry}
            currentMode={business?.schedulingMode as string | undefined}
            currentStrategy={business?.schedulingStrategy as string | undefined}
            token={session.accessToken}
            canManage={canManage}
            onSave={() => {
              showSuccessMessage('Scheduling configuration updated successfully!');
              if (businessId && session?.accessToken) {
                loadBusinessData(session.accessToken);
              }
            }}
          />
        )}
        </div>
      </div>

      {/* Logo Upload Modal */}
      {showLogoUpload && (
        <Modal
          open={showLogoUpload}
          onClose={() => setShowLogoUpload(false)}
          title="Upload Business Logo"
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="mb-4">
                <Avatar 
                  src={business.logo} 
                  alt={`${business.name} logo`}
                  size={80}
                  nameOrEmail={business.name}
                />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Upload a new logo for {business.name}
              </p>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Drop your logo here or click to browse</p>
              <p className="text-sm text-gray-500 mb-4">PNG, JPG up to 5MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                variant="secondary"
              >
                {uploadingLogo ? <Spinner size={16} /> : 'Choose File'}
              </Button>
            </div>

            {business.logo && (
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-800">Current Logo</p>
                    <p className="text-sm text-red-600">Remove the current logo if you want to replace it</p>
                  </div>
                  <Button 
                    variant="secondary" 
                    onClick={handleLogoRemove}
                    disabled={removingLogo}
                    className="text-red-600 hover:text-red-700"
                  >
                    {removingLogo ? <Spinner size={16} /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setShowLogoUpload(false)}>
                Cancel
              </Button>
              <Button disabled={uploadingLogo}>
                {uploadingLogo ? <Spinner size={16} /> : 'Upload Logo'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          type="success"
          message={successMessage}
          open={showSuccessToast}
          onClose={() => setShowSuccessToast(false)}
        />
      )}
      
      {/* Billing Modal */}
      <BillingModal 
        isOpen={showBillingModal}
        onClose={() => setShowBillingModal(false)}
      />
    </div>
  );
} 