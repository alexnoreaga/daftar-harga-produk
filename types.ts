export interface Product {
  id: string;
  name: string;
  costPrice: number;
  srpPrice: number;
  brand: string;
  lastUpdated: string;
  rawJson?: Record<string, any>; // Store original extracted data
}

export interface BrandNote {
  id: string;
  brandName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawExtractionItem {
  [key: string]: string | number;
}

export type ExtractionResult = RawExtractionItem[];

export interface ColumnMapping {
  nameField: string;
  costField: string;
  srpField?: string;
  brandName: string;
  nameFallbackFields?: string[];
  costFallbackFields?: string[];
  srpFallbackFields?: string[];
  manualRetagByRow?: Record<number, { name?: string; costPrice?: number; srpPrice?: number }>;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  UPLOAD = 'UPLOAD',
  INVENTORY = 'INVENTORY',
}

export interface UploadStatus {
  state: 'idle' | 'uploading' | 'processing' | 'mapping' | 'complete' | 'error';
  message?: string;
  data?: ExtractionResult;
}

export type UserRole = 'admin' | 'staff';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
}