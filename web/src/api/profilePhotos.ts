import { authenticatedApiCall } from '../lib/apiUtils';

export interface ProfilePhotos {
  personal: string | null;
  business: string | null;
  default: string | null;
}

export interface ProfilePhotoLibraryItem {
  id: string;
  originalUrl: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  rotation: number | null;
  crop: unknown | null;
}

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  personalPhoto: string | null;
  businessPhoto: string | null;
  personalPhotoId?: string | null;
  businessPhotoId?: string | null;
  image: string | null;
}

export interface ProfilePhotosResponse {
  success: boolean;
  photos: ProfilePhotos;
  user: UserProfile;
  library?: ProfilePhotoLibraryItem[];
}

export interface UploadPhotoResponse {
  success: boolean;
  message: string;
  photo?: ProfilePhotoLibraryItem;
  user: UserProfile;
  photos?: ProfilePhotos;
  library?: ProfilePhotoLibraryItem[];
}

export interface RemovePhotoResponse {
  success: boolean;
  message: string;
  user: UserProfile;
}

export interface AssignPhotoResponse {
  success: boolean;
  user: UserProfile;
  photos: ProfilePhotos;
}

export interface UpdateAvatarResponse {
  success: boolean;
  photo: ProfilePhotoLibraryItem;
}

/**
 * Get user's profile photos
 */
export const getProfilePhotos = async (): Promise<ProfilePhotosResponse> => {
  return authenticatedApiCall<ProfilePhotosResponse>('/api/profile-photos', {
    method: 'GET',
  });
};

export type CropParams = { x: number; y: number; width: number; height: number; rotation: number; zoom: number };

/**
 * Upload a profile photo
 */
export const uploadProfilePhoto = async (
  file: File, 
  photoType: 'personal' | 'business',
  crop?: CropParams
): Promise<UploadPhotoResponse> => {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('photoType', photoType);
  if (crop) {
    formData.append('crop', JSON.stringify(crop));
  }

  return authenticatedApiCall<UploadPhotoResponse>('/api/profile-photos/upload', {
    method: 'POST',
    body: formData,
  });
};

/**
 * Assign a library photo to personal or business
 */
export const assignProfilePhoto = async (
  photoId: string,
  target: 'personal' | 'business'
): Promise<AssignPhotoResponse> => {
  return authenticatedApiCall<AssignPhotoResponse>('/api/profile-photos/assign', {
    method: 'POST',
    body: JSON.stringify({ photoId, target }),
  });
};

/**
 * Update avatar rendition for an existing library photo (server-side sharp crop)
 */
export const updateProfilePhotoAvatar = async (
  photoId: string,
  crop: CropParams
): Promise<UpdateAvatarResponse> => {
  return authenticatedApiCall<UpdateAvatarResponse>(`/api/profile-photos/${photoId}/avatar`, {
    method: 'POST',
    body: JSON.stringify({ crop }),
  });
};

/**
 * Remove a profile photo
 */
export const removeProfilePhoto = async (
  photoType: 'personal' | 'business'
): Promise<RemovePhotoResponse> => {
  return authenticatedApiCall<RemovePhotoResponse>('/api/profile-photos/remove', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ photoType }),
  });
};
