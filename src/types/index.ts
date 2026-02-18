export type SubscriptionType = 'vehicle' | 'membership' | 'utility' | 'insurance' | 'other';

export interface Subscription {
  id: string;
  type: SubscriptionType;
  name: string;
  startDate: string;
  endDate: string;
  reminderDays: number;
  reminder?: boolean;
  amount: number;
  currency: string;
  provider: string;
  notes?: string;
  attachments?: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
  uniqId?: string;
  
  // File related fields
  fileUrl?: string;
  fileMetadata?: FileMetadata;
  
  // Multiple file support (for image uploads)
  fileUrls?: string[];
  fileMetadataList?: FileMetadata[];
  
  // Contact information fields
  ownerName?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  
  // Vehicle specific properties
  vehicleNumber?: string;
  vehicleType?: string;
  registrationType?: string;
  owner?: string;
  
  // Membership specific properties
  membershipId?: string;
  level?: string;
  
  // Utility specific properties
  accountNumber?: string;
  utilityType?: string;
  serviceAddress?: string;
  
  // Insurance specific properties
  policyNumber?: string;
  coverageType?: string;
  coverage?: number;
  
  // Allow for dynamic properties
  [key: string]: any;
}

export interface VehicleSubscription extends Subscription {
  vehicleNumber: string;
  vehicleType: string;
  registrationType: string;
  owner: string;
}

export interface MembershipSubscription extends Subscription {
  membershipId: string;
  benefits: string[];
  level: string;
}

export interface UtilitySubscription extends Subscription {
  utilityType: string;
  accountNumber: string;
  serviceAddress: string;
}

export interface InsuranceSubscription extends Subscription {
  policyNumber: string;
  coverageType: string;
  beneficiaries?: string[];
  coverage: number;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  role: 'admin' | 'user';
  language: 'en' | 'hi';
  theme: 'light' | 'dark';
  createdAt: string;
}

export interface SubscriptionFormFields extends Omit<Partial<Subscription>, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  name: string;
  startDate: string;
  endDate: string;
  reminderDays: number;
  reminder?: boolean;
  amount: number;
  currency: string;
  provider: string;
  notes?: string;
  type: SubscriptionType;
  uniqId?: string;
}

export interface QRCodeData {
  type: SubscriptionType;
  data: Record<string, any>;
}

export interface FileMetadata {
  uploadedBy: string;
  userEmail: string;
  userId: string;
  uploadedAt: string;
  originalName: string;
} 