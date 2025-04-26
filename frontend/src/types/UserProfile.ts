// src/types/UserProfile.ts
export interface UserProfile {
  id?: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  medicalConditions: string[];
  allergies: string[];
  medications: string[];
  maxTravelDistance: number; 
  contactEmail: string;
  contactPhone?: string;
  preferredCompensation?: number; // minimum preferred compensation
}

export const defaultUserProfile: UserProfile = {
  firstName: '',
  lastName: '',
  age: 0,
  gender: 'Other',
  location: '',
  medicalConditions: [],
  allergies: [],
  medications: [],
  maxTravelDistance: 50,
  contactEmail: '',
};