'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Spinner } from 'shared/components';
import { Trash2, User, Building2, Upload } from 'lucide-react';
import PhotoCropModal from './PhotoCropModal';
import {
  assignProfilePhoto,
  CropParams,
  getProfilePhotos,
  ProfilePhotoLibraryItem,
  ProfilePhotos,
  updateProfilePhotoAvatar,
  uploadProfilePhoto,
} from '../api/profilePhotos';
import { authenticatedApiCall } from '../lib/apiUtils';
import { toast } from 'react-hot-toast';

type Slot = 'personal' | 'business';

export default function ProfilePhotoManager() {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<ProfilePhotos | null>(null);
  const [library, setLibrary] = useState<ProfilePhotoLibraryItem[]>([]);
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<Slot>('personal');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editPhotoId, setEditPhotoId] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getProfilePhotos();
      setPhotos(res.photos);
      setLibrary(res.library || []);
      setPersonalId(res.user.personalPhotoId || null);
      setBusinessId(res.user.businessPhotoId || null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load profile photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handlePickFile = (slot: Slot) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setPendingSlot(slot);
      setPendingFile(file);
      setCropOpen(true);
    };
    input.click();
  };

  const handleConfirmCrop = async (result: { originalFile: File; crop: CropParams }) => {
    try {
      const resp = await uploadProfilePhoto(result.originalFile, pendingSlot, result.crop);
      toast.success('Photo uploaded');
      // Refresh from server so assignments + library are consistent
      await load();
      // Also refresh avatar cache (menu reads /api/profile-photos)
      try {
        localStorage.removeItem('vssyl_profile_photos_cache_v1');
      } catch {
        // ignore
      }
    } catch (e) {
      console.error(e);
      toast.error('Upload failed');
    }
  };

  const handleConfirmEditCrop = async (result: { crop: CropParams }) => {
    if (!editPhotoId) return;
    try {
      await updateProfilePhotoAvatar(editPhotoId, result.crop);
      toast.success('Avatar updated');
      await load();
      try {
        localStorage.removeItem('vssyl_profile_photos_cache_v1');
      } catch {
        // ignore
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update avatar');
    } finally {
      setEditPhotoId(null);
      setEditImageUrl(null);
      setCropOpen(false);
    }
  };

  const handleAssign = async (photoId: string, slot: Slot) => {
    // enforce: do not allow same photo for both
    if (slot === 'personal' && businessId === photoId) {
      toast.error('This photo is already your business photo. Choose a different one.');
      return;
    }
    if (slot === 'business' && personalId === photoId) {
      toast.error('This photo is already your personal photo. Choose a different one.');
      return;
    }

    try {
      await assignProfilePhoto(photoId, slot);
      toast.success(`Assigned as ${slot}`);
      await load();
      try {
        localStorage.removeItem('vssyl_profile_photos_cache_v1');
      } catch {
        // ignore
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to assign photo');
    }
  };

  const handleTrash = async (photo: ProfilePhotoLibraryItem) => {
    try {
      await authenticatedApiCall('/api/trash/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: photo.id,
          name: 'Profile Photo',
          type: 'profile_photo',
          moduleId: 'profile-photos',
          moduleName: 'Profile Photos',
          metadata: { avatarUrl: photo.avatarUrl, originalUrl: photo.originalUrl },
        }),
      });
      toast.success('Moved to trash');
      await load();
      try {
        localStorage.removeItem('vssyl_profile_photos_cache_v1');
      } catch {
        // ignore
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to trash photo');
    }
  };

  const personalUrl = photos?.personal || photos?.default || null;
  const businessUrl = photos?.business || photos?.default || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PhotoCropModal
        open={cropOpen}
        imageFile={pendingFile}
        imageUrl={editImageUrl}
        title={editPhotoId ? 'Edit Avatar Crop' : `Crop ${pendingSlot === 'personal' ? 'Personal' : 'Business'} Photo`}
        onClose={() => {
          setCropOpen(false);
          setPendingFile(null);
          setEditPhotoId(null);
          setEditImageUrl(null);
        }}
        onConfirm={(payload) => {
          if (editPhotoId) {
            return handleConfirmEditCrop({ crop: payload.crop });
          }
          if (!payload.originalFile) return;
          return handleConfirmCrop({ originalFile: payload.originalFile, crop: payload.crop });
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">Personal</div>
                <div className="text-sm text-gray-600">Your personal avatar</div>
              </div>
            </div>
            <Button variant="secondary" onClick={() => handlePickFile('personal')}>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
          <div className="flex items-center gap-4">
            {personalUrl ? (
              <img src={personalUrl} alt="Personal" className="w-20 h-20 rounded-xl object-cover border" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 border" />
            )}
            <div className="text-sm text-gray-600">
              Choose a photo from the library below or upload a new one.
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">Business</div>
                <div className="text-sm text-gray-600">Your work avatar</div>
              </div>
            </div>
            <Button variant="secondary" onClick={() => handlePickFile('business')}>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
          <div className="flex items-center gap-4">
            {businessUrl ? (
              <img src={businessUrl} alt="Business" className="w-20 h-20 rounded-xl object-cover border" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 border" />
            )}
            <div className="text-sm text-gray-600">
              Choose a different photo than Personal to keep contexts distinct.
            </div>
          </div>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Photo Library</h3>
          <div className="text-sm text-gray-500">{library.length} photos</div>
        </div>

        {library.length === 0 ? (
          <Card className="p-6 text-sm text-gray-600">
            No photos yet. Upload one above.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {library.map((p) => {
              const isPersonal = personalId === p.id;
              const isBusiness = businessId === p.id;
              return (
                <div key={p.id} className="border rounded-lg p-2 bg-white">
                  <img src={p.avatarUrl} alt="Profile" className="w-full aspect-square rounded-md object-cover border" />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {isPersonal && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Personal</span>}
                    {isBusiness && <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Business</span>}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="flex-1 text-xs px-2 py-1 rounded border hover:bg-gray-50"
                      onClick={() => handleAssign(p.id, 'personal')}
                      disabled={isPersonal}
                      title="Assign as Personal"
                    >
                      Personal
                    </button>
                    <button
                      className="flex-1 text-xs px-2 py-1 rounded border hover:bg-gray-50"
                      onClick={() => handleAssign(p.id, 'business')}
                      disabled={isBusiness}
                      title="Assign as Business"
                    >
                      Business
                    </button>
                  </div>
                  <button
                    className="w-full mt-2 text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    onClick={() => {
                      setEditPhotoId(p.id);
                      setEditImageUrl(p.originalUrl);
                      setCropOpen(true);
                    }}
                    title="Edit avatar crop"
                  >
                    Edit crop
                  </button>
                  <button
                    className="w-full mt-2 text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center gap-2"
                    onClick={() => handleTrash(p)}
                    title="Move to trash"
                  >
                    <Trash2 className="w-3 h-3" />
                    Trash
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


