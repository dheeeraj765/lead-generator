/**
 * 📚 EXAMPLE USAGE FILE
 * 
 * This file demonstrates practical patterns for using the lead scraping system.
 * These are executable examples you can run in your application.
 *
 * Run from Next.js API routes, server components, or CLI scripts.
 */

// ============================================================================
// Example 1: Basic API Call from Frontend
// ============================================================================

async function scrapeLeadsFromUI() {
  try {
    const response = await fetch('/api/leads/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'dentist',
        location: 'Kolhapur',
        limit: 50,
        minQualityScore: 60,
        requirePhone: true,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Scraped ${result.inserted} leads`);
      console.log(`📊 Stats:`, result.stats);
      return result.leads;
    } else {
      console.error('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// ============================================================================
// Example 2: Programmatic Usage in Server Action
// ============================================================================

import LeadScrapeOrchestrator from '@/lib/scrapers/orchestrator';
import { prisma } from '@/lib/db';

export async function serverSideScrapeLead(
  userId: string,
  keyword: string,
  location: string
) {
  const orchestrator = new LeadScrapeOrchestrator({
    headless: true,
    timeout: 60000,
    delayBetweenRequests: 2000,
    maxRetries: 2,
  });

  try {
    const leads = await orchestrator.scrapeLeads({
      keyword,
      location,
      limit: 100,
      mindQualityScore: 50,
      requirePhone: false,
      requireAddress: true,
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Save to database
    const saved = await prisma.lead.createMany({
      data: leads.map(lead => ({
        userId,
        businessName: lead.businessName,
        phone: lead.phone || null,
        address: lead.address || null,
        website: lead.website || null,
        sourceUrl: lead.sourceUrl,
        keyword: lead.keyword,
        location: lead.location,
      })),
      skipDuplicates: true,
    });

    return {
      success: true,
      leadsScraped: leads.length,
      leadsSaved: saved.count,
      stats: orchestrator.getStats(),
    };
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 3: Manual Step-by-Step Pipeline
// ============================================================================

import WebScraper from '@/lib/scrapers/puppeteer-scraper';
import { LeadParser } from '@/lib/scrapers/parser';
import { normalizeLeads } from '@/lib/scrapers/normalizer';
import { deduplicateLeads } from '@/lib/scrapers/deduplicator';
import { filterLeadsByQuality } from '@/lib/scrapers/validator';

export async function customPipelineExample() {
  // Step 1: Initialize scraper
  const scraper = new WebScraper({
    headless: true,
    timeout: 30000,
    delayBetweenRequests: 1000,
  });

  await scraper.initialize();

  try {
    // Step 2: Scrape raw HTML
    console.log('🌐 Scraping...');
    const pages = await scraper.scrapePages([
      'https://example.com/search?q=dentist&location=kolhapur',
      'https://example.com/search?q=dentist&location=kolhapur&page=2',
    ]);

    // Step 3: Parse HTML to extract leads
    console.log('🔍 Parsing...');
    const rawLeads = [];
    for (const page of pages) {
      const parsed = LeadParser.parseJustdial(page.html, page.url);
      rawLeads.push(...parsed);
    }

    console.log(`Extracted ${rawLeads.length} raw leads`);

    // Step 4: Normalize data
    console.log('✨ Normalizing...');
    const normalized = normalizeLeads(rawLeads);
    console.log(
      `Normalized to ${normalized.length} leads (lost: ${rawLeads.length - normalized.length})`
    );

    // Step 5: Deduplicate
    console.log('🔄 Deduplicating...');
    const unique = deduplicateLeads(normalized);
    console.log(`Deduplicated to ${unique.length} unique leads`);

    // Step 6: Filter by quality
    console.log('✅ Validating...');
    const qualified = filterLeadsByQuality(unique, {
      minQualityScore: 70,
      requirePhone: true,
      requireAddress: true,
    });

    // Step 7: Use qualified leads
    console.log('📤 Final leads:');
    qualified.forEach(({ lead, score }) => {
      console.log(`  [${score.toFixed(0)}/100] ${lead.businessName}`);
      console.log(`    📱 ${lead.phone}`);
      console.log(`    📍 ${lead.address}`);
      console.log(`    🌐 ${lead.website || 'N/A'}`);
      console.log('');
    });

    return qualified.map(q => q.lead);
  } finally {
    await scraper.close();
  }
}

// ============================================================================
// Example 4: Batch Processing Multiple Searches
// ============================================================================

export async function batchScrapeMultipleCategories(userId: string) {
  const searches = [
    { keyword: 'plumber', location: 'Delhi', limit: 30 },
    { keyword: 'electrician', location: 'Delhi', limit: 30 },
    { keyword: 'carpenter', location: 'Delhi', limit: 30 },
  ];

  const allLeads = [];

  for (const search of searches) {
    console.log(`\n🔍 Searching for ${search.keyword} in ${search.location}...`);

    const orchestrator = new LeadScrapeOrchestrator();
    const leads = await orchestrator.scrapeLeads({
      keyword: search.keyword,
      location: search.location,
      limit: search.limit,
      mindQualityScore: 50,
    });

    console.log(`✅ Found ${leads.length} ${search.keyword}s`);
    allLeads.push(...leads);

    // Save to database
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.lead.createMany({
        data: leads.map(lead => ({
          userId,
          ...lead,
          phone: lead.phone || null,
          website: lead.website || null,
        })),
        skipDuplicates: true,
      });
    }

    // Rate limiting between searches
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second pause
  }

  return allLeads;
}

// ============================================================================
// Example 5: Advanced - Custom parsing for specific website
// ============================================================================

import { LeadParser, type RawLead } from '@/lib/scrapers/parser';

export class JustdialCustomParser extends LeadParser {
  /**
   * Parse Justdial with custom selectors for their specific layout
   */
  static parseJustdialAdvanced(html: string, sourceUrl: string): RawLead[] {
    const $ = require('cheerio').load(html);
    const leads: RawLead[] = [];

    // Justdial specific selectors (may need updating if layout changes)
    const selectors = {
      container: '.jcn',
      name: '.listing-title',
      phone: '.mobilesv',
      address: '.jaddress',
      website: 'a.basicinfo',
    };

    // Use parent class method
    const results = this.parseLeadsList(html, selectors);

    // Enrich with additional Justdial data
    return results.map(lead => ({
      ...lead,
      sourceUrl,
    }));
  }
}

// ============================================================================
// Example 6: Quality Analysis & Metrics
// ============================================================================

import {
  calculateQualityMetrics,
  getValidationStats,
} from '@/lib/scrapers/validator';
import type { NormalizedLead } from '@/lib/scrapers/normalizer';

export function analyzeScrapeQuality(leads: NormalizedLead[]) {
  const metrics = calculateQualityMetrics(leads);

  console.log('📊 QUALITY ANALYSIS');
  console.log('='.repeat(50));
  console.log(`Total Leads:          ${metrics.total}`);
  console.log(`Valid Leads:          ${metrics.valid}`);
  console.log(`Invalid Leads:        ${metrics.invalid}`);
  console.log(`Validation Rate:      ${metrics.validationRate.toFixed(1)}%`);
  console.log(`Average Score:        ${metrics.averageScore.toFixed(1)}/100`);
  console.log('');
  console.log('📋 Data Completeness:');
  console.log(`Phone Available:      ${metrics.phoneCompleteness.toFixed(1)}%`);
  console.log(`Address Available:    ${metrics.addressCompleteness.toFixed(1)}%`);
  console.log(`Website Available:    ${metrics.websiteCompleteness.toFixed(1)}%`);
  console.log('');
  console.log('⚠️  Common Issues:');
  metrics.commonErrors.forEach((error, idx) => {
    console.log(`${idx + 1}. ${error.error} (${error.count}x)`);
  });

  return metrics;
}

// ============================================================================
// Example 7: Deduplication Analysis
// ============================================================================

import {
  findDuplicateMatches,
  getDuplicateStats,
} from '@/lib/scrapers/deduplicator';

export function analyzeDuplicates(
  newLeads: any[],
  existingLeads: any[]
) {
  const matches = findDuplicateMatches(newLeads, existingLeads, {
    nameSimilarityThreshold: 0.85,
  });

  console.log('🔍 DUPLICATE ANALYSIS');
  console.log('='.repeat(50));
  console.log(`Total New Leads:      ${newLeads.length}`);
  console.log(`Existing Leads:       ${existingLeads.length}`);
  console.log(`Potential Duplicates: ${matches.length}`);
  console.log('');
  console.log('Match Breakdown:');

  const byType = matches.reduce(
    (acc, m) => {
      acc[m.matchType] = (acc[m.matchType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Show top duplicates
  console.log('');
  console.log('🥇 Top Duplicates (by confidence):');
  matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .forEach((match, idx) => {
      console.log(
        `${idx + 1}. ${match.lead1.businessName} ≈ ${match.lead2.businessName}`
      );
      console.log(`   Confidence: ${(match.similarity * 100).toFixed(1)}%`);
      console.log(`   Match Type: ${match.matchType}`);
    });
}

// ============================================================================
// Example 8: Error Handling & Retry Logic
// ============================================================================

export async function robustScrapeWithErrorHandling(
  keyword: string,
  location: string,
  maxAttempts: number = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `\n🔄 Attempt ${attempt}/${maxAttempts}: Scraping ${keyword} in ${location}...`
      );

      const orchestrator = new LeadScrapeOrchestrator({
        headless: true,
        maxRetries: 2,
        delayBetweenRequests: 2000 * attempt, // Increase delay on retry
      });

      const leads = await orchestrator.scrapeLeads({
        keyword,
        location,
        limit: 50,
      });

      console.log(`✅ Success! Scraped ${leads.length} leads`);
      return leads;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxAttempts) {
        const backoffTime = 5000 * attempt;
        console.log(`⏳ Waiting ${backoffTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  throw new Error(
    `Failed to scrape after ${maxAttempts} attempts: ${lastError?.message}`
  );
}

// ============================================================================
// Example 9: Integration with React Component
// ============================================================================

/**
 * React Hook for using the scraping API
 */
export function useScrapeLeads() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [leads, setLeads] = React.useState([]);
  const [stats, setStats] = React.useState(null);

  const scrape = async (
    keyword: string,
    location: string,
    options = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/leads/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          location,
          limit: 50,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scraping failed');
      }

      setLeads(data.leads);
      setStats(data.stats);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { scrape, loading, error, leads, stats };
}

// ============================================================================
// Example 10: CLI Script for Batch Scraping
// ============================================================================

/**
 * Run from CLI: npx ts-node scripts/scrape-leads.ts
 */
async function cliScrapeLeads() {
  const keyword = process.argv[2] || 'dentist';
  const location = process.argv[3] || 'Kolhapur';
  const limit = parseInt(process.argv[4] || '50');

  console.log(`
╔════════════════════════════════════════╗
║   Lead Scraping CLI Tool               ║
╚════════════════════════════════════════╝
  `);

  console.log(`Keyword:  ${keyword}`);
  console.log(`Location: ${location}`);
  console.log(`Limit:    ${limit}`);
  console.log('');

  const orchestrator = new LeadScrapeOrchestrator();

  try {
    const leads = await orchestrator.scrapeLeads({
      keyword,
      location,
      limit,
      mindQualityScore: 50,
    });

    const stats = orchestrator.getStats();

    console.log('\n✅ SCRAPING COMPLETE');
    console.log(`\n📊 Results:`);
    console.log(`  Total Leads: ${leads.length}`);
    console.log(`  Duration: ${stats.duration}ms`);
    console.log(`  Efficiency: ${stats.pipelineEfficiency.toFixed(1)}%`);

    // Save to CSV
    if (leads.length > 0) {
      const csv = [
        'Business Name,Phone,Address,Website,Source',
        ...leads.map(
          l =>
            `"${l.businessName}","${l.phone || ''}","${l.address || ''}","${l.website || ''}","${l.sourceUrl}"`
        ),
      ].join('\n');

      const fs = require('fs');
      const filename = `leads_${keyword}_${location}_${Date.now()}.csv`;
      fs.writeFileSync(filename, csv);
      console.log(`\n📥 Exported to: ${filename}`);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  cliScrapeLeads().catch(console.error);
}

export default {
  scrapeLeadsFromUI,
  serverSideScrapeLead,
  customPipelineExample,
  batchScrapeMultipleCategories,
  analyzeScrapeQuality,
  analyzeDuplicates,
  robustScrapeWithErrorHandling,
  useScrapeLeads,
};
