'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Copy, 
  MapPin, 
  Globe, 
  Building, 
  Home,
  Lock,
  AlertCircle
} from 'lucide-react';
import { Button, Alert } from 'shared/components';
import { toast } from 'react-hot-toast';
import { getUserLocation } from '@/api/location';
import ProfilePhotoManager from '@/components/ProfilePhotoManager';

interface Location {
  country: {
    id: string;
    name: string;
    phoneCode: string;
  } | null;
  region: {
    id: string;
    name: string;
    code: string;
    countryId: string;
  } | null;
  town: {
    id: string;
    name: string;
    code: string;
    regionId: string;
  } | null;
  locationDetectedAt: string | null;
  locationUpdatedAt: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Profile photos are managed by ProfilePhotoManager now (single library UI).

  useEffect(() => {
    if (session?.user) {
      loadUserLocation();
    }
  }, [session]);

  const loadUserLocation = async () => {
    try {
      setLoading(true);
      setError(null);
      const userLocation = await getUserLocation();
      setLocation(userLocation);
    } catch (err) {
      setError('Failed to load location data');
      console.error('Error loading location:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBlockId = () => {
    if (session?.user?.userNumber) {
      navigator.clipboard.writeText(session.user.userNumber);
      toast.success('Vssyl ID copied to clipboard!');
    }
  };

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You need to be logged in to view settings.</p>
          <Button onClick={() => router.push('/auth/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Vssyl ID Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Globe className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Your Vssyl ID</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Vssyl ID</p>
                    <p className="text-lg font-mono text-gray-900">
                      {session.user.userNumber || 'Not assigned'}
                    </p>
                  </div>
                  <Button
                    onClick={handleCopyBlockId}
                    disabled={!session.user.userNumber}
                    className="flex items-center"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Lock className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 mb-1">Permanent Identifier</h3>
                    <p className="text-sm text-yellow-700">
                      Your Vssyl ID is a permanent, immutable identifier that cannot be changed. 
                      It's used for secure identification across all Vssyl services.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>Your Vssyl ID is your unique identifier in the Vssyl system.</p>
                <p className="mt-1">Format: Country-Region-Town-UserSerial</p>
              </div>
            </div>
          </div>

          {/* Location Information Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <MapPin className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Location Information</h2>
            </div>

            {error && (
              <Alert type="error" className="mb-4">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </Alert>
            )}

            <div className="space-y-4">
              {/* Current Location Display */}
              {location && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Current Location</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{location.country?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center">
                      <Building className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{location.region?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center">
                      <Home className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{location.town?.name || 'Unknown'}</span>
                    </div>
                  </div>
                  {location.locationDetectedAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Detected: {new Date(location.locationDetectedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800 mb-1">Location Locked</h3>
                    <p className="text-sm text-blue-700">
                      Your location was automatically detected during registration and is now locked. 
                      This ensures your Vssyl ID remains consistent and secure.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>Location changes require administrative approval for security reasons.</p>
                <p className="mt-1">Contact support if you need to update your location.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Photos Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Photos</h2>
          <ProfilePhotoManager />
        </div>

        {/* Additional Settings Sections */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Account Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <p className="text-gray-900">{session.user.name || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{session.user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <p className="text-gray-900 capitalize">{session.user.role}</p>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="text-gray-600">
                <p>More settings coming soon:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Theme preferences</li>
                  <li>• Notification settings</li>
                  <li>• Privacy controls</li>
                  <li>• Data export</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 