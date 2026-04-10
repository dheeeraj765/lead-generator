export type ScrapedLead = {
  businessName: string;
  website?: string;
  phone?: string;
  address?: string;
  sourceUrl: string;
  keyword: string;
  location: string;
};

export type LeadWithoutUser = {
  id: string;
  businessName: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  sourceUrl: string;
  keyword: string | null;
  location: string | null;
  status: 'NEW' | 'CONTACTED' | 'IGNORED';
  createdAt: Date;
  updatedAt: Date;
};

export type ScrapeResult = {
  success: boolean;
  inserted: number;
  duplicatesSkipped: number;
  leads: LeadWithoutUser[];
  error?: string;
};