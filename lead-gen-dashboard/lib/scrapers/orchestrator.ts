/**
 * Scraping Orchestrator
 *
 * FIX: Replaced JustDial as the scraping target.
 * JustDial is a React SPA protected by Cloudflare — a plain Cheerio/Axios
 * request always receives a bot-challenge page with zero leads.
 *
 * New sources (tried in order, first successful result wins):
 *   1. Yellow Pages India  – server-rendered, Cheerio-friendly
 *   2. Sulekha             – server-rendered fallback
 *
 * The parser selectors have been updated to match each site's actual HTML.
 */

import type { ScrapedLead } from "@/types";
import AdaptiveScraper, { type ScraperConfig } from "./adaptive-scraper";
import type { ScrapedPage } from "./puppeteer-scraper";
import type { RawLead } from "./parser";
import { normalizeLeads, type NormalizedLead } from "./normalizer";
import { deduplicateLeads } from "./deduplicator";
import { filterLeadsByQuality } from "./validator";
import * as cheerio from "cheerio";

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

// ---------------------------------------------------------------------------
// Source definitions
// ---------------------------------------------------------------------------

interface Source {
  name: string;
  buildUrl: (keyword: string, location: string) => string;
  parse: (html: string, sourceUrl: string, keyword: string, location: string) => RawLeadWithMeta[];
}

type RawLeadWithMeta = RawLead & {
  sourceUrl: string;
  keyword: string;
  location: string;
};

/**
 * Parse Yellow Pages India (yellowpages.co.in)
 * Containers: .listing-info-div  |  .comp-info-main-div
 */
function parseYellowPagesIndia(
  html: string,
  sourceUrl: string,
  keyword: string,
  location: string
): RawLeadWithMeta[] {
  const $ = cheerio.load(html);
  const leads: RawLeadWithMeta[] = [];

  const containers = $(
    ".listing-info-div, .comp-info-main-div, .result-box, .business-listing"
  );

  containers.each((_i, el) => {
    try {
      const $el = $(el);

      const businessName =
        $el.find("h2, h3, .listing-name, .comp-name, .business-name").first().text().trim() ||
        $el.find("a").first().text().trim();

      const phone = $el
        .find(".contact-info, .phone, [class*='phone'], [class*='mobile']")
        .first()
        .text()
        .replace(/[^0-9+\-\s()]/g, "")
        .trim();

      const address = $el
        .find(".address, [class*='address'], [class*='location'], .area")
        .first()
        .text()
        .trim();

      const websiteEl = $el.find("a[href^='http']:not([href*='yellowpages'])");
      const website = websiteEl.attr("href") || "";

      if (businessName && businessName.length > 2) {
        leads.push({
          businessName,
          phone: phone || undefined,
          address: address || undefined,
          website: website || undefined,
          sourceUrl,
          keyword,
          location,
        });
      }
    } catch {
      // skip malformed element
    }
  });

  return leads;
}

/**
 * Parse Sulekha (sulekha.com)
 * Containers: .cp-listing-card  |  .search-result-item
 */
function parseSulekha(
  html: string,
  sourceUrl: string,
  keyword: string,
  location: string
): RawLeadWithMeta[] {
  const $ = cheerio.load(html);
  const leads: RawLeadWithMeta[] = [];

  const containers = $(
    ".cp-listing-card, .search-result-item, .biz-listing, .result-card"
  );

  containers.each((_i, el) => {
    try {
      const $el = $(el);

      const businessName = $el
        .find("h2, h3, .biz-name, .company-name, [class*='name']")
        .first()
        .text()
        .trim();

      const phone = $el
        .find("[class*='phone'], [class*='mobile'], [class*='contact']")
        .first()
        .text()
        .replace(/[^0-9+\-\s()]/g, "")
        .trim();

      const address = $el
        .find("[class*='address'], [class*='location'], [class*='area']")
        .first()
        .text()
        .trim();

      const website =
        $el.find("a[href^='http']:not([href*='sulekha'])").attr("href") || "";

      if (businessName && businessName.length > 2) {
        leads.push({
          businessName,
          phone: phone || undefined,
          address: address || undefined,
          website: website || undefined,
          sourceUrl,
          keyword,
          location,
        });
      }
    } catch {
      // skip malformed element
    }
  });

  return leads;
}

/**
 * Generic fallback: look for any pattern that resembles a business card.
 * Tries common class names used across many Indian business directories.
 */
function parseGenericDirectory(
  html: string,
  sourceUrl: string,
  keyword: string,
  location: string
): RawLeadWithMeta[] {
  const $ = cheerio.load(html);
  const leads: RawLeadWithMeta[] = [];

  // Broad container sweep
  $("[class*='listing'], [class*='result'], [class*='business'], [class*='company']").each(
    (_i, el) => {
      try {
        const $el = $(el);

        // Must have a reasonably long text block to be a real card
        if ($el.text().trim().length < 20) return;

        const businessName =
          $el.find("h2, h3, h4").first().text().trim() ||
          $el.find("a").first().text().trim();

        const phoneMatch = $el.text().match(/(\+?[0-9][0-9\-\s()]{8,}[0-9])/);
        const phone = phoneMatch ? phoneMatch[1].trim() : undefined;

        const address = $el
          .find("[class*='address'], [class*='location']")
          .first()
          .text()
          .trim();

        if (businessName && businessName.length > 2) {
          leads.push({
            businessName,
            phone,
            address: address || undefined,
            website: undefined,
            sourceUrl,
            keyword,
            location,
          });
        }
      } catch {
        // skip
      }
    }
  );

  // De-dupe by name within this page
  const seen = new Set<string>();
  return leads.filter((l) => {
    const key = l.businessName?.toLowerCase() ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Sources registry
// ---------------------------------------------------------------------------

const SOURCES: Source[] = [
  {
    name: "YellowPagesIndia",
    buildUrl: (keyword, location) =>
      `https://www.yellowpages.co.in/search?kwd=${encodeURIComponent(
        keyword
      )}&city=${encodeURIComponent(location)}`,
    parse: (html, url, keyword, location) =>
      parseYellowPagesIndia(html, url, keyword, location),
  },
  {
    name: "Sulekha",
    buildUrl: (keyword, location) =>
      `https://www.sulekha.com/${encodeURIComponent(
        location
      )}/${encodeURIComponent(keyword)}/default-default`,
    parse: (html, url, keyword, location) =>
      parseSulekha(html, url, keyword, location),
  },
];

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class LeadScrapeOrchestrator {
  private scraper: AdaptiveScraper;
  private stats: ScraperStats;

  constructor(scraperConfig?: ScraperConfig) {
    this.scraper = new AdaptiveScraper(scraperConfig);
    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): ScraperStats {
    return {
      keyword: "",
      location: "",
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
      ...this.createEmptyStats(),
      keyword: options.keyword,
      location: options.location,
      startTime: Date.now(),
    };

    try {
      console.log("[SCRAPE START]", options);

      await this.scraper.initialize();

      const rawLeads = await this.scrapeAllSources(options);
      this.stats.rawLeadsExtracted = rawLeads.length;

      if (!rawLeads.length) {
        console.warn("[SCRAPER] No raw leads found across all sources");
        return [];
      }

      const normalizedLeads = normalizeLeads(rawLeads);
      this.stats.leadsAfterNormalization = normalizedLeads.length;
      this.stats.normalizationLoss = rawLeads.length - normalizedLeads.length;

      const dedupedLeads = deduplicateLeads(normalizedLeads as NormalizedLead[], {
        nameSimilarityThreshold: 0.85,
      });

      this.stats.leadsAfterDeduplication = dedupedLeads.length;
      this.stats.duplicatesRemoved = normalizedLeads.length - dedupedLeads.length;

      const qualityScores = filterLeadsByQuality(dedupedLeads, {
        minQualityScore: options.minQualityScore ?? 50,
        requirePhone: options.requirePhone ?? false,
        requireAddress: options.requireAddress ?? false,
      });

      const validLeads = qualityScores.filter((q) => q.isValid);

      this.stats.validLeadsCount = validLeads.length;
      this.stats.invalidLeadsCount = qualityScores.length - validLeads.length;
      this.stats.averageQualityScore =
        validLeads.length > 0
          ? validLeads.reduce((sum, q) => sum + q.score, 0) / validLeads.length
          : 0;

      const finalLeads = validLeads
        .slice(0, options.limit || validLeads.length)
        .map((q) => this.convertToScrapedLead(q.lead, options));

      this.stats.totalLeadsDelivered = finalLeads.length;
      this.stats.endTime = Date.now();
      this.stats.duration = this.stats.endTime - this.stats.startTime;
      this.stats.pipelineEfficiency =
        rawLeads.length > 0 ? (finalLeads.length / rawLeads.length) * 100 : 0;

      this.printSummary();
      return finalLeads;
    } catch (error) {
      console.error("[PIPELINE ERROR]", error);
      return [];
    } finally {
      await this.scraper.close();
    }
  }

  /**
   * Try each source in order; collect leads from whichever ones succeed.
   * If a source returns 0 leads, we try the next one.
   */
  private async scrapeAllSources(options: ScrapeOptions): Promise<RawLeadWithMeta[]> {
    const allLeads: RawLeadWithMeta[] = [];

    for (const source of SOURCES) {
      try {
        const url = source.buildUrl(options.keyword, options.location);
        console.log(`[SCRAPER] Trying ${source.name}: ${url}`);

        const page: ScrapedPage = await this.scraper.scrapePage(url);
        this.stats.pagesScraped++;

        // Use generic parser first (works across many sites), then the
        // site-specific one as a supplement.
        let leads = source.parse(page.html, page.url, options.keyword, options.location);

        if (!leads.length) {
          // Generic fallback
          leads = parseGenericDirectory(page.html, page.url, options.keyword, options.location);
        }

        console.log(`[SCRAPER] ${source.name} returned ${leads.length} raw leads`);

        if (leads.length > 0) {
          this.stats.pagesSuccessful++;
          allLeads.push(...leads);

          // Stop trying more sources once we have enough raw leads
          const limit = options.limit ?? 20;
          if (allLeads.length >= limit * 3) break;
        }
      } catch (err) {
        console.error(`[SCRAPER] ${source.name} failed:`, err);
        // Continue to next source
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
      sourceUrl: lead.sourceUrl || "",
      keyword: options.keyword,
      location: options.location,
    };
  }

  private printSummary(): void {
    const info = this.scraper.getInfo();
    console.log("=".repeat(60));
    console.log("SCRAPING PIPELINE SUMMARY");
    console.log("=".repeat(60));
    console.log(`Method:     ${info.method}`);
    console.log(`Duration:   ${this.stats.duration}ms`);
    console.log(`Raw leads:  ${this.stats.rawLeadsExtracted}`);
    console.log(`Delivered:  ${this.stats.totalLeadsDelivered}`);
    console.log(`Efficiency: ${this.stats.pipelineEfficiency.toFixed(1)}%`);
    console.log("=".repeat(60));
  }

  getStats(): ScraperStats {
    return this.stats;
  }
}

export default LeadScrapeOrchestrator;