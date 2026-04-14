/**
 * Normalization Module - Cleans and standardizes lead data
 * Handles phone numbers, business names, addresses, and URLs
 */

/**
 * Normalize phone numbers to international format
 * Supports Indian formats: +91-XXXXX-XXXXX, 91XXXXXXXXXX, 9XXXXXXXXX, etc.
 */
export function normalizePhoneNumber(phone?: string): string | undefined {
  if (!phone) return undefined;

  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading zeros if not international format
  if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Add country code if missing (default to India: +91)
  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    // 10-digit number, assume India
    cleaned = '+91' + cleaned;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // 91 prefix without +
    cleaned = '+' + cleaned;
  } else if (cleaned.length === 9 || cleaned.length === 11) {
    // Non-standard length, keep as is but clean
  }

  // Validate: should be between 10-15 digits after country code
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return undefined;
  }

  return cleaned;
}

/**
 * Normalize business names
 * - Trim whitespace
 * - Remove extra spaces
 * - Capitalize first letter of words
 * - Remove common junk patterns
 */
export function normalizeBusinessName(name?: string): string | undefined {
  if (!name) return undefined;

  let normalized = name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[\n\r\t]/g, '') // Remove newlines and tabs
    .replace(/[<>{}[\]]/g, ''); // Remove angle brackets and braces

  // Remove common junk patterns
  const junkPatterns = [
    /\[ad\]/i,
    /sponsored/i,
    /advertisement/i,
    /\*\*/g,
    /###/g,
  ];

  for (const pattern of junkPatterns) {
    normalized = normalized.replace(pattern, '').trim();
  }

  // Capitalize words (simple approach)
  normalized = normalized
    .split(' ')
    .map((word) => {
      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Normalize address
 * - Remove extra whitespace
 * - Standardize punctuation
 * - Remove unnecessary line breaks
 */
export function normalizeAddress(address?: string): string | undefined {
  if (!address) return undefined;

  let normalized = address
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\n\s*\n/g, ', ') // Newlines to commas
    .replace(/[\n\r\t]/g, ' '); // Remove remaining control chars

  // Remove common junk
  normalized = normalized
    .replace(/^\s*-\s*/, '') // Leading dashes
    .replace(/\s*-\s*$/, ''); // Trailing dashes

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Normalize website URLs
 * - Add protocol if missing
 * - Validate format
 * - Convert to lowercase
 */
export function normalizeWebsite(website?: string): string | undefined {
  if (!website) return undefined;

  let normalized = website.trim().toLowerCase();

  // Skip if it's obviously not a URL
  if (normalized.length < 5) return undefined;

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    // Check if it looks like a domain
    if (normalized.includes('.') && !normalized.includes(' ')) {
      normalized = 'https://' + normalized;
    } else {
      return undefined;
    }
  }

  // Basic URL validation
  try {
    new URL(normalized);
    return normalized;
  } catch {
    return undefined;
  }
}

/**
 * Normalize all fields in a lead object
 */
export interface RawLeadData {
  businessName?: string;
  phone?: string;
  address?: string;
  website?: string;
  sourceUrl?: string;
  keyword?: string;
  location?: string;
}

export interface NormalizedLead extends RawLeadData {
  businessName: string; // Required after normalization
}

export function normalizeLead(lead: RawLeadData): NormalizedLead | null {
  const businessName = normalizeBusinessName(lead.businessName);
  
  if (!businessName) {
    return null; // Skip leads without business names
  }

  const normalized: NormalizedLead = {
    businessName,
    phone: normalizePhoneNumber(lead.phone),
    address: normalizeAddress(lead.address),
    website: normalizeWebsite(lead.website),
    sourceUrl: lead.sourceUrl?.trim(),
    keyword: lead.keyword?.trim(),
    location: lead.location?.trim(),
  };

  return normalized;
}

/**
 * Batch normalize multiple leads
 */
export function normalizeLeads(leads: RawLeadData[]): NormalizedLead[] {
  return leads
    .map((lead) => normalizeLead(lead))
    .filter((lead): lead is NormalizedLead => lead !== null);
}

/**
 * Calculate similarity score between two strings (0-1)
 * Used for deduplication
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85;
  }

  // Levenshtein distance based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function getEditDistance(s1: string, s2: string): number {
  const costs = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }

  return costs[s2.length];
}

export default {
  normalizePhoneNumber,
  normalizeBusinessName,
  normalizeAddress,
  normalizeWebsite,
  normalizeLead,
  normalizeLeads,
  calculateSimilarity,
};
