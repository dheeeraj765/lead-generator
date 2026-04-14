/**
 * Lead Scraper Orchestrator - Main pipeline coordinator
 * Combines all modules: scraper, parser, normalizer, deduplicator, validator
 * 
 * Flow: Scrape → Parse → Normalize → Deduplicate → Validate → Storage Ready
 */

import type { ScrapedLead } from '@/types';
import WebScraper, { type ScraperConfig, type ScrapedPage } from './puppeteer-scraper';
import LeadParser, { type RawLead } from './parser';
import { normalizeLead, normalizeLeads, type NormalizedLead } from './normalizer';
import { deduplicateLeads, type DuplicateMatch } from './deduplicator';
import {
  validateLead,
  filterLeadsByQuality,
  type LeadQualityScore,
} from './validator';

export interface ScrapeOptions {
  keyword: string;
  location: string;
  limit?: number;
  mindQualityScore?: number;
  requirePhone?: boolean;
  requireAddress?: boolean;
}

export interface ScraperStats {
  keyword: string;
  location: string;
  startTime: number;
  endTime?: number;
  duration?: number;

  // Scraping stats
  pagesScraped: number;
  pagesSuccessful: number;

  // Parsing stats
  rawLeadsExtracted: number;

  // Normalization stats
  leadsAfterNormalization: number;
  normalizationLoss: number;

  // Deduplication stats
  leadsAfterDeduplication: number;
  duplicatesRemoved: number;

  // Validation stats
  validLeadsCount: number;
  invalidLeadsCount: number;
  averageQualityScore: number;

  // Final stats
  totalLeadsDelivered: number;
  pipelineEfficiency: number; // percentage of raw → final leads
}

export class LeadScrapeOrchestrator {
  private scraper: WebScraper;
  private stats: ScraperStats;

  constructor(scraperConfig?: ScraperConfig) {
    this.scraper = new WebScraper(scraperConfig);
    this.stats = {
      keyword: '',
      location: '',
      startTime: 0,
      pagesScraped: 0,
      pagesSuccessful: 0,
      rawLeadsExtracted: 0,
      leadsAfterNormalization: 0,
      normalizationLoss: 0,
      leadsAfterDeduplication: 0,
      duplicatesRemoved: 0,
      validLeadsCount: 0,
      invalidLeadsCount: 0,
      averageQualityScore: 0,
      totalLeadsDelivered: 0,
      pipelineEfficiency: 0,
    };
  }

  /**
   * Main scraping pipeline
   * keyword: e.g., "dentist"
   * location: e.g., "Kolhapur" or "Mumbai"
   * limit: maximum leads to return
   */
  async scrapeLeads(options: ScrapeOptions): Promise<ScrapedLead[]> {
    this.stats = {
      keyword: options.keyword,
      location: options.location,
      startTime: Date.now(),
      pagesScraped: 0,
      pagesSuccessful: 0,
      rawLeadsExtracted: 0,
      leadsAfterNormalization: 0,
      normalizationLoss: 0,
      leadsAfterDeduplication: 0,
      duplicatesRemoved: 0,
      validLeadsCount: 0,
      invalidLeadsCount: 0,
      averageQualityScore: 0,
      totalLeadsDelivered: 0,
      pipelineEfficiency: 0,
    };

    try {
      // Initialize browser
      console.log('🚀 Starting lead scraping pipeline...');
      console.log(`   Keyword: ${options.keyword}`);
      console.log(`   Location: ${options.location}`);
      console.log(`   Limit: ${options.limit || 'unlimited'}`);

      await this.scraper.initialize();

      // Step 1: Scrape pages
      console.log('\n📄 Step 1: Scraping pages...');
      const scrapedPages = await this.scrapePages(options);
      this.stats.pagesScraped = scrapedPages.length;
      this.stats.pagesSuccessful = scrapedPages.length;

      // Step 2: Parse HTML → Extract raw leads
      console.log('\n🔍 Step 2: Parsing HTML...');
      const rawLeads = this.parsePages(scrapedPages, options);
      this.stats.rawLeadsExtracted = rawLeads.length;

      // Step 3: Normalize data
      console.log('\n✨ Step 3: Normalizing data...');
      const normalizedLeads = normalizeLeads(rawLeads);
      this.stats.leadsAfterNormalization = normalizedLeads.length;
      this.stats.normalizationLoss =
        this.stats.rawLeadsExtracted - this.stats.leadsAfterNormalization;

      // Step 4: Deduplicate
      console.log('\n🔄 Step 4: Deduplicating leads...');
      const dedupedLeads = deduplicateLeads(normalizedLeads as NormalizedLead[], {
        nameSimilarityThreshold: 0.85,
      });
      this.stats.leadsAfterDeduplication = dedupedLeads.length;
      this.stats.duplicatesRemoved =
        this.stats.leadsAfterNormalization - this.stats.leadsAfterDeduplication;

      // Step 5: Validate and filter by quality
      console.log('\n✅ Step 5: Validating lead quality...');
      const qualityScores = filterLeadsByQuality(dedupedLeads, {
        minQualityScore: options.mindQualityScore ?? 50,
        requirePhone: options.requirePhone ?? false,
        requireAddress: options.requireAddress ?? false,
      });

      const validLeads = qualityScores.filter((q) => q.isValid);
      this.stats.validLeadsCount = validLeads.length;
      this.stats.invalidLeadsCount =
        qualityScores.length - validLeads.length;
      this.stats.averageQualityScore =
        validLeads.length > 0
          ? validLeads.reduce((sum, q) => sum + q.score, 0) / validLeads.length
          : 0;

      // Step 6: Apply limit and return
      const finalLeads = validLeads
        .slice(0, options.limit || validLeads.length)
        .map((qs) => this.convertToScrapedLead(qs.lead, options));

      this.stats.totalLeadsDelivered = finalLeads.length;
      this.stats.endTime = Date.now();
      this.stats.duration = this.stats.endTime - this.stats.startTime;
      this.stats.pipelineEfficiency =
        this.stats.rawLeadsExtracted > 0
          ? (this.stats.totalLeadsDelivered / this.stats.rawLeadsExtracted) * 100
          : 0;

      // Print summary
      this.printSummary();

      return finalLeads;
    } catch (error) {
      console.error('❌ Pipeline error:', error);
      throw error;
    } finally {
      await this.scraper.close();
    }
  }

  /**
   * Scrape multiple pages
   * Customize based on target website's pagination
   */
  private async scrapePages(options: ScrapeOptions): Promise<ScrapedPage[]> {
    try {
      // For demonstration, scrape a single page
      // In production, estimate number of pages needed
      const estimatedPages = Math.ceil((options.limit || 20) / 10);

      // Currently scrapes Justdial format with hardcoded URLs
      // You should customize this based on your target site
      const page = await this.scraper.scrapePage(
        `https://example.com/search?keyword=${encodeURIComponent(
          options.keyword
        )}&location=${encodeURIComponent(options.location)}`
      );

      return [page];
    } catch (error) {
      console.error('Error scraping pages:', error);
      return [];
    }
  }

  /**
   * Parse all scraped pages
   */
  private parsePages(
    pages: ScrapedPage[],
    options: ScrapeOptions
  ): (RawLead & { sourceUrl: string; keyword: string; location: string })[] {
    const allLeads: (RawLead & {
      sourceUrl: string;
      keyword: string;
      location: string;
    })[] = [];

    for (const page of pages) {
      try {
        // Try Justdial-specific parsing first
        const justdialLeads = LeadParser.parseJustdial(page.html, page.url);

        // If no leads found, try generic parsing
        let leads = justdialLeads;
        if (leads.length === 0) {
          leads = LeadParser.parseLeadsList(page.html, {
            container: '.listing, .result, .item',
            name: 'h2, .title, .name',
            phone: '.phone, [data-phone]',
            address: '.address, .location',
            website: 'a[href*="http"]',
          });
        }

        // Enrich leads with metadata
        const enrichedLeads = leads.map((lead) => ({
          ...lead,
          sourceUrl: page.url,
          keyword: options.keyword,
          location: options.location,
        }));

        allLeads.push(...enrichedLeads);
      } catch (error) {
        console.error('Error parsing page:', error);
      }
    }

    return allLeads;
  }

  /**
   * Convert normalized lead to ScrapedLead format
   */
  private convertToScrapedLead(
    lead: NormalizedLead,
    options: ScrapeOptions
  ): ScrapedLead {
    return {
      businessName: lead.businessName,
      phone: lead.phone,
      address: lead.address,
      website: lead.website,
      sourceUrl: lead.sourceUrl || '',
      keyword: options.keyword,
      location: options.location,
    };
  }

  /**
   * Print pipeline summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCRAPING PIPELINE SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${this.stats.duration}ms`);
    console.log(`📄 Pages Scraped: ${this.stats.pagesSuccessful}/${this.stats.pagesScraped}`);
    console.log(
      `🔍 Raw Leads Extracted: ${this.stats.rawLeadsExtracted}`
    );
    console.log(
      `✨ After Normalization: ${this.stats.leadsAfterNormalization} (lost: ${this.stats.normalizationLoss})`
    );
    console.log(
      `🔄 After Deduplication: ${this.stats.leadsAfterDeduplication} (removed: ${this.stats.duplicatesRemoved})`
    );
    console.log(
      `✅ After Validation: ${this.stats.validLeadsCount} valid (avg score: ${this.stats.averageQualityScore.toFixed(1)}/100)`
    );
    console.log(
      `📤 Final Delivery: ${this.stats.totalLeadsDelivered} leads`
    );
    console.log(
      `🎯 Pipeline Efficiency: ${this.stats.pipelineEfficiency.toFixed(1)}%`
    );
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Get current pipeline statistics
   */
  getStats(): ScraperStats {
    return this.stats;
  }
}

export default LeadScrapeOrchestrator;
