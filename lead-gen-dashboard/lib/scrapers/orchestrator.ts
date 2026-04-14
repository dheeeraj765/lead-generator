import type { ScrapedLead } from '@/types';
import AdaptiveScraper, { type ScraperConfig } from './adaptive-scraper';
import type { ScrapedPage } from './puppeteer-scraper';
import LeadParser, { type RawLead } from './parser';
import {
  normalizeLeads,
  type NormalizedLead,
} from './normalizer';
import { deduplicateLeads } from './deduplicator';
import { filterLeadsByQuality } from './validator';

export interface ScrapeOptions {
  keyword: string;
  location: string;
  limit?: number;
  minQualityScore?: number;
  requirePhone?: boolean;
  requireAddress?: boolean;
}

export interface ScraperStats {
  keyword: string;
  location: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pagesScraped: number;
  pagesSuccessful: number;
  rawLeadsExtracted: number;
  leadsAfterNormalization: number;
  normalizationLoss: number;
  leadsAfterDeduplication: number;
  duplicatesRemoved: number;
  validLeadsCount: number;
  invalidLeadsCount: number;
  averageQualityScore: number;
  totalLeadsDelivered: number;
  pipelineEfficiency: number;
}

export class LeadScrapeOrchestrator {
  private scraper: AdaptiveScraper;
  private stats: ScraperStats;

  constructor(scraperConfig?: ScraperConfig) {
    this.scraper = new AdaptiveScraper(scraperConfig);
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
      console.log('🚀 Starting lead scraping pipeline...');
      console.log(`Keyword: ${options.keyword}`);
      console.log(`Location: ${options.location}`);
      console.log(`Limit: ${options.limit || 20}`);

      await this.scraper.initialize();

      const scrapedPages = await this.scrapePages(options);
      this.stats.pagesScraped = scrapedPages.length;
      this.stats.pagesSuccessful = scrapedPages.length;

      const rawLeads = this.parsePages(scrapedPages, options);
      this.stats.rawLeadsExtracted = rawLeads.length;

      const normalizedLeads = normalizeLeads(rawLeads);
      this.stats.leadsAfterNormalization = normalizedLeads.length;
      this.stats.normalizationLoss =
        this.stats.rawLeadsExtracted - normalizedLeads.length;

      const dedupedLeads = deduplicateLeads(
        normalizedLeads as NormalizedLead[],
        {
          nameSimilarityThreshold: 0.85,
        }
      );

      this.stats.leadsAfterDeduplication = dedupedLeads.length;
      this.stats.duplicatesRemoved =
        normalizedLeads.length - dedupedLeads.length;

      const qualityScores = filterLeadsByQuality(dedupedLeads, {
        minQualityScore: options.minQualityScore ?? 50,
        requirePhone: options.requirePhone ?? false,
        requireAddress: options.requireAddress ?? false,
      });

      const validLeads = qualityScores.filter((q) => q.isValid);

      this.stats.validLeadsCount = validLeads.length;
      this.stats.invalidLeadsCount =
        qualityScores.length - validLeads.length;

      this.stats.averageQualityScore =
        validLeads.length > 0
          ? validLeads.reduce((sum, q) => sum + q.score, 0) /
            validLeads.length
          : 0;

      const finalLeads = validLeads
        .slice(0, options.limit || validLeads.length)
        .map((qs) => this.convertToScrapedLead(qs.lead, options));

      this.stats.totalLeadsDelivered = finalLeads.length;
      this.stats.endTime = Date.now();
      this.stats.duration =
        this.stats.endTime - this.stats.startTime;

      this.stats.pipelineEfficiency =
        this.stats.rawLeadsExtracted > 0
          ? (finalLeads.length / this.stats.rawLeadsExtracted) * 100
          : 0;

      this.printSummary();

      return finalLeads;
    } catch (error) {
      console.error('❌ Pipeline error:', error);
      throw error;
    } finally {
      await this.scraper.close();
    }
  }

  private async scrapePages(
    options: ScrapeOptions
  ): Promise<ScrapedPage[]> {
    try {
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

  private parsePages(
    pages: ScrapedPage[],
    options: ScrapeOptions
  ): (RawLead & {
    sourceUrl: string;
    keyword: string;
    location: string;
  })[] {
    const allLeads = [];

    for (const page of pages) {
      try {
        let leads = LeadParser.parseJustdial(page.html, page.url);

        if (leads.length === 0) {
          leads = LeadParser.parseLeadsList(page.html, {
            container: '.listing, .result, .item',
            name: 'h2, .title, .name',
            phone: '.phone, [data-phone]',
            address: '.address, .location',
            website: 'a[href*="http"]',
          });
        }

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

  private printSummary(): void {
    const scraperMethod = this.scraper.getMethod();
    const scraperInfo = this.scraper.getInfo();

    console.log('='.repeat(60));
    console.log('SCRAPING PIPELINE SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `Scraper: ${scraperMethod.toUpperCase()} (${scraperInfo.capabilities.cost})`
    );
    console.log(`Duration: ${this.stats.duration}ms`);
    console.log(`Final leads: ${this.stats.totalLeadsDelivered}`);
    console.log(
      `Efficiency: ${this.stats.pipelineEfficiency.toFixed(1)}%`
    );
    console.log('='.repeat(60));
  }

  getStats(): ScraperStats {
    return this.stats;
  }
}

export default LeadScrapeOrchestrator;