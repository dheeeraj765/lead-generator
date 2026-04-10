import { stringify } from 'csv-stringify/sync';
import { LeadWithoutUser } from '@/types';

export function generateCSV(leads: LeadWithoutUser[]): string {
  const records = leads.map(lead => ({
    'Business Name': lead.businessName,
    'Website': lead.website || '',
    'Phone': lead.phone || '',
    'Address': lead.address || '',
    'Status': lead.status,
    'Keyword': lead.keyword || '',
    'Location': lead.location || '',
    'Source URL': lead.sourceUrl,
    'Created': lead.createdAt.toISOString(),
  }));
  
  return stringify(records, { header: true });
}