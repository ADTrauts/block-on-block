import { authenticatedApiCall } from '../lib/apiUtils';

export interface Country {
  id: string;
  name: string;
  phoneCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  countryId: string;
  country: Country;
  createdAt: string;
  updatedAt: string;
}

export interface Town {
  id: string;
  name: string;
  code: string;
  regionId: string;
  region: Region;
  createdAt: string;
  updatedAt: string;
}

export interface UserLocation {
  country: Country;
  region: Region;
  town: Town;
  locationDetectedAt: string;
  locationUpdatedAt: string;
}

// Get all countries
export async function getCountries(): Promise<Country[]> {
  return authenticatedApiCall<Country[]>('/api/location/countries');
}

// Get regions by country
export async function getRegionsByCountry(countryId: string): Promise<Region[]> {
  return authenticatedApiCall<Region[]>(`/api/location/regions/${countryId}`);
}

// Get towns by region
export async function getTownsByRegion(regionId: string): Promise<Town[]> {
  return authenticatedApiCall<Town[]>(`/api/location/towns/${regionId}`);
}

// Get user's current location
export async function getUserLocation(): Promise<UserLocation> {
  return authenticatedApiCall<UserLocation>('/api/location/user-location');
}

// Note: updateUserLocation function removed for security reasons
// Block IDs are permanent and cannot be changed by users
// Administrative approval required for location changes 