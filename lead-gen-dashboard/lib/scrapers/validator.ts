/**
 * Validation Module - Validates and filters lead quality
 * Removes incomplete, invalid, or junk leads
 */

import type { NormalizedLead } from './normalizer';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface LeadQualityScore {
  lead: NormalizedLead;
  score: number;
  isValid: boolean;
  reason?: string;
}

/**
 * Validate a single lead
 */
export function validateLead(lead: NormalizedLead): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Business name validation (required)
  if (!lead.businessName || lead.businessName.trim().length === 0) {
    errors.push('Business name is required');
    score -= 50;
  } else if (lead.businessName.length < 2) {
    errors.push('Business name too short');
    score -= 40;
  } else if (lead.businessName.length > 200) {
    warnings.push('Business name is unusually long');
    score -= 10;
  }

  // Check for obviously junk names
  if (lead.businessName) {
    const junkPatterns = [
      /^test/i,
      /^demo/i,
      /^sample/i,
      /^xxx/i,
      /^\d+$/,
      /^[!@#$%^&*]+$/,
      /no\s*name/i,
      /unnamed/i,
    ];

    for (const pattern of junkPatterns) {
      if (pattern.test(lead.businessName)) {
        errors.push('Business name appears to be junk/test');
        score -= 40;
        break;
      }
    }
  }

  // Phone validation (recommended)
  if (lead.phone) {
    if (!isValidPhoneNumber(lead.phone)) {
      errors.push(`Invalid phone format: ${lead.phone}`);
      score -= 20;
    }
  } else {
    warnings.push('Phone number not available');
    score -= 10;
  }

  // Address validation
  if (lead.address) {
    if (lead.address.length < 5) {
      warnings.push('Address is too short');
      score -= 10;
    } else if (lead.address.length > 500) {
      warnings.push('Address is unusually long');
      score -= 5;
    }
  } else {
    warnings.push('Address not available');
    score -= 15;
  }

  // Website validation
  if (lead.website) {
    if (!isValidWebsite(lead.website)) {
      warnings.push(`Invalid website format: ${lead.website}`);
      score -= 10;
    }
  } else {
    warnings.push('Website not available');
    score -= 5;
  }

  // Source URL validation
  if (!lead.sourceUrl) {
    warnings.push('Source URL missing');
    score -= 5;
  }

  // Ensure score is between 0-100
  score = Math.max(0, Math.min(100, score));

  const isValid = errors.length === 0 && score >= 50;

  return {
    isValid,
    errors,
    warnings,
    score,
  };
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  // Accept international format with +, or at least 10 digits
  const digitCount = phone.replace(/\D/g, '').length;
  return digitCount >= 10 && digitCount <= 15;
}

/**
 * Validate website URL
 */
function isValidWebsite(website: string): boolean {
  try {
    const url = new URL(website);
    // Check for valid domain
    return url.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Filter and score leads by quality
 */
export function filterLeadsByQuality(
  leads: NormalizedLead[],
  options: {
    minQualityScore?: number;
    requirePhone?: boolean;
    requireAddress?: boolean;
    requireWebsite?: boolean;
  } = {}
): LeadQualityScore[] {
  const {
    minQualityScore = 50,
    requirePhone = false,
    requireAddress = false,
    requireWebsite = false,
  } = options;

  return leads
    .map((lead) => {
      const validation = validateLead(lead);
      let isValid = validation.isValid && validation.score >= minQualityScore;

      // Apply additional filters
      if (requirePhone && !lead.phone) {
        isValid = false;
      }
      if (requireAddress && !lead.address) {
        isValid = false;
      }
      if (requireWebsite && !lead.website) {
        isValid = false;
      }

      return {
        lead,
        score: validation.score,
        isValid,
        reason: isValid ? 'Valid lead' : validation.errors[0] || 'Quality too low',
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Get validation statistics
 */
export interface ValidationStats {
  total: number;
  valid: number;
  invalid: number;
  validationRate: number;
  averageScore: number;
  commonErrors: Array<{ error: string; count: number }>;
}

export function getValidationStats(
  validationResults: ValidationResult[]
): ValidationStats {
  const errorCounts = new Map<string, number>();
  let totalScore = 0;
  let validCount = 0;

  for (const result of validationResults) {
    totalScore += result.score;
    if (result.isValid) validCount++;

    for (const error of result.errors) {
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    }
  }

  const commonErrors = Array.from(errorCounts.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: validationResults.length,
    valid: validCount,
    invalid: validationResults.length - validCount,
    validationRate: (validCount / validationResults.length) * 100,
    averageScore:
      validationResults.length > 0
        ? totalScore / validationResults.length
        : 0,
    commonErrors,
  };
}

/**
 * Calculate overall lead quality metrics
 */
export function calculateQualityMetrics(leads: NormalizedLead[]) {
  const hasPhone = leads.filter((l) => l.phone).length;
  const hasAddress = leads.filter((l) => l.address).length;
  const hasWebsite = leads.filter((l) => l.website).length;

  const results = leads.map(validateLead);
  const stats = getValidationStats(results);

  return {
    ...stats,
    phoneCompleteness: (hasPhone / leads.length) * 100,
    addressCompleteness: (hasAddress / leads.length) * 100,
    websiteCompleteness: (hasWebsite / leads.length) * 100,
  };
}

export default {
  validateLead,
  filterLeadsByQuality,
  getValidationStats,
  calculateQualityMetrics,
};
