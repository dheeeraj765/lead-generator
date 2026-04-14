/**
 * Deduplication Module - Removes duplicate leads
 * Uses multiple strategies: exact match, phone/email match, fuzzy name matching
 */

import { calculateSimilarity } from './normalizer';
import type { NormalizedLead } from './normalizer';

export interface DuplicateMatch {
  lead1: NormalizedLead;
  lead2: NormalizedLead;
  similarity: number;
  matchType: 'exact' | 'phone' | 'name' | 'url';
}

/**
 * Remove duplicates from a list of leads
 * Uses multiple deduplication strategies
 */
export function deduplicateLeads(
  leads: NormalizedLead[],
  options: {
    nameSimilarityThreshold?: number;
    removeDuplicates?: boolean;
  } = {}
): NormalizedLead[] {
  const {
    nameSimilarityThreshold = 0.85,
    removeDuplicates = true,
  } = options;

  const seen = new Set<string>();
  const deduplicated: NormalizedLead[] = [];
  const duplicates: Array<{ lead: NormalizedLead; reason: string }> = [];

  for (const lead of leads) {
    const signature = createLeadSignature(lead);

    // Exact signature match
    if (seen.has(signature)) {
      duplicates.push({ lead, reason: 'exact_signature_match' });
      continue;
    }

    // Phone number match (high confidence)
    if (lead.phone) {
      const phoneMatch = deduplicated.find(
        (existing) => existing.phone && existing.phone === lead.phone
      );
      if (phoneMatch) {
        duplicates.push({
          lead,
          reason: `phone_match (${lead.phone})`,
        });
        continue;
      }
    }

    // Website match (high confidence)
    if (lead.website) {
      const websiteMatch = deduplicated.find(
        (existing) => existing.website && existing.website === lead.website
      );
      if (websiteMatch) {
        duplicates.push({
          lead,
          reason: `website_match (${lead.website})`,
        });
        continue;
      }
    }

    // Fuzzy business name match
    if (lead.businessName && deduplicated.length > 0) {
      const nameMatch = deduplicated.find((existing) => {
        const similarity = calculateSimilarity(
          existing.businessName,
          lead.businessName
        );
        return similarity >= nameSimilarityThreshold;
      });

      if (nameMatch) {
        const similarity = calculateSimilarity(nameMatch.businessName, lead.businessName);
        duplicates.push({
          lead,
          reason: `fuzzy_name_match (similarity: ${similarity.toFixed(2)})`,
        });
        continue;
      }
    }

    // Not a duplicate
    seen.add(signature);
    deduplicated.push(lead);
  }

  if (duplicates.length > 0) {
    console.log(`Removed ${duplicates.length} duplicate leads`);
  }

  return deduplicated;
}

/**
 * Create a deduplication signature for a lead
 * Used for quick duplicate detection
 */
function createLeadSignature(lead: NormalizedLead): string {
  const parts = [
    lead.businessName.toLowerCase().trim(),
    lead.phone || '',
    lead.website || '',
    lead.address?.trim().toLowerCase().slice(0, 20) || '', // First 20 chars of address
  ];

  return parts.filter(Boolean).join('|');
}

/**
 * Find potential duplicates between two lead sets
 * Useful for comparing against existing database
 */
export function findDuplicateMatches(
  newLeads: NormalizedLead[],
  existingLeads: NormalizedLead[],
  options: {
    nameSimilarityThreshold?: number;
  } = {}
): DuplicateMatch[] {
  const { nameSimilarityThreshold = 0.85 } = options;
  const matches: DuplicateMatch[] = [];

  for (const newLead of newLeads) {
    for (const existing of existingLeads) {
      // Phone match (highest confidence)
      if (
        newLead.phone &&
        existing.phone &&
        newLead.phone === existing.phone
      ) {
        matches.push({
          lead1: newLead,
          lead2: existing,
          similarity: 1,
          matchType: 'phone',
        });
        continue;
      }

      // Website match (high confidence)
      if (
        newLead.website &&
        existing.website &&
        newLead.website === existing.website
      ) {
        matches.push({
          lead1: newLead,
          lead2: existing,
          similarity: 1,
          matchType: 'url',
        });
        continue;
      }

      // Business name fuzzy match
      const similarity = calculateSimilarity(
        newLead.businessName,
        existing.businessName
      );

      if (similarity >= nameSimilarityThreshold) {
        matches.push({
          lead1: newLead,
          lead2: existing,
          similarity,
          matchType: 'name',
        });
      }
    }
  }

  return matches;
}

/**
 * Get deduplication statistics
 */
export function getDuplicateStats(
  original: NormalizedLead[],
  deduplicated: NormalizedLead[]
): {
  totalOriginal: number;
  totalDeduplicated: number;
  duplicatesRemoved: number;
  deduplicationRate: number;
} {
  const duplicatesRemoved = original.length - deduplicated.length;

  return {
    totalOriginal: original.length,
    totalDeduplicated: deduplicated.length,
    duplicatesRemoved,
    deduplicationRate: duplicatesRemoved > 0
      ? (duplicatesRemoved / original.length) * 100
      : 0,
  };
}

export default {
  deduplicateLeads,
  findDuplicateMatches,
  getDuplicateStats,
};
