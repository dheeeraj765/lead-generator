/**
 * Scraping Orchestrator
 *
 * Data source: OpenStreetMap Overpass API  (https://overpass-api.de)
 * ─────────────────────────────────────────────────────────────────
 * • 100 % free — no API key required
 * • Returns JSON — no HTML parsing, no CSS selectors to maintain
 * • Works from any serverless environment (Vercel, Lambda, etc.)
 * • No bot-detection issues — it's a public data API
 *
 * Strategy
 * ────────
 * 1. Geocode the user's location string → bounding box  (Nominatim)
 * 2. Map the keyword to OSM amenity/shop/office tags
 * 3. Query Overpass for all matching nodes/ways inside that bbox
 * 4. Feed raw results through the existing normalise → dedupe → quality pipeline
 */

import type { ScrapedLead } from "@/types";
import type { ScraperConfig } from "./adaptive-scraper";
import type { NormalizedLead } from "./normalizer";
import { normalizeLeads } from "./normalizer";
import { deduplicateLeads } from "./deduplicator";
import { filterLeadsByQuality } from "./validator";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface RawLeadWithMeta {
  businessName?: string;
  phone?: string;
  address?: string;
  website?: string;
  sourceUrl: string;
  keyword: string;
  location: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nominatim geocoder
// ─────────────────────────────────────────────────────────────────────────────

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

async function geocodeLocation(location: string): Promise<BBox | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(location)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "LeadGeneratorApp/1.0 (contact@example.com)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("[GEOCODE] Nominatim error", res.status);
    return null;
  }

  const data = (await res.json()) as Array<{
    boundingbox?: string[];
    lat?: string;
    lon?: string;
  }>;

  if (!data.length) {
    console.warn("[GEOCODE] No results for:", location);
    return null;
  }

  const hit = data[0];

  // boundingbox order from Nominatim: [south, north, west, east]
  if (hit.boundingbox && hit.boundingbox.length === 4) {
    const bbox: BBox = {
      south: parseFloat(hit.boundingbox[0]),
      north: parseFloat(hit.boundingbox[1]),
      west:  parseFloat(hit.boundingbox[2]),
      east:  parseFloat(hit.boundingbox[3]),
    };

    // If the bbox is too large (e.g. whole country), shrink to ~50 km radius
    const latSpan = bbox.north - bbox.south;
    const lonSpan = bbox.east - bbox.west;
    if (latSpan > 1.0 || lonSpan > 1.0) {
      const lat = (bbox.south + bbox.north) / 2;
      const lon = (bbox.west + bbox.east) / 2;
      const delta = 0.45; // ~50 km
      return {
        south: lat - delta,
        north: lat + delta,
        west:  lon - delta,
        east:  lon + delta,
      };
    }

    return bbox;
  }

  // Fallback: build a ~20 km box around the centre point
  if (hit.lat && hit.lon) {
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    const delta = 0.18;
    return {
      south: lat - delta,
      north: lat + delta,
      west:  lon - delta,
      east:  lon + delta,
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword → OSM tag mapping
// ─────────────────────────────────────────────────────────────────────────────

function keywordToOsmFilters(keyword: string): string[] {
  const kw = keyword.toLowerCase().trim();

  const MAP: Record<string, string[]> = {
    dentist:     ['node["amenity"="dentist"]',        'way["amenity"="dentist"]'],
    doctor:      ['node["amenity"="doctors"]',         'way["amenity"="doctors"]'],
    hospital:    ['node["amenity"="hospital"]',        'way["amenity"="hospital"]'],
    clinic:      ['node["amenity"="clinic"]',          'way["amenity"="clinic"]'],
    pharmacy:    ['node["amenity"="pharmacy"]',        'way["amenity"="pharmacy"]'],
    restaurant:  ['node["amenity"="restaurant"]',      'way["amenity"="restaurant"]'],
    cafe:        ['node["amenity"="cafe"]',            'way["amenity"="cafe"]'],
    hotel:       ['node["tourism"="hotel"]',           'way["tourism"="hotel"]'],
    gym:         ['node["leisure"="fitness_centre"]',  'way["leisure"="fitness_centre"]'],
    bank:        ['node["amenity"="bank"]',            'way["amenity"="bank"]'],
    lawyer:      ['node["office"="lawyer"]',           'way["office"="lawyer"]'],
    school:      ['node["amenity"="school"]',          'way["amenity"="school"]'],
    supermarket: ['node["shop"="supermarket"]',        'way["shop"="supermarket"]'],
    salon:       ['node["shop"="hairdresser"]',        'way["shop"="hairdresser"]'],
    plumber:     ['node["craft"="plumber"]',           'way["craft"="plumber"]'],
    electrician: ['node["craft"="electrician"]',       'way["craft"="electrician"]'],
    accountant:  ['node["office"="accountant"]',       'way["office"="accountant"]'],
    shop:        ['node["shop"]',                      'way["shop"]'],
  };

  for (const [key, filters] of Object.entries(MAP)) {
    if (kw === key || kw.includes(key)) return filters;
  }

  // Generic: search by name tag (case-insensitive regex)
  const safe = keyword.replace(/[^a-zA-Z0-9 ]/g, "");
  return [
    `node["name"~"${safe}",i]`,
    `way["name"~"${safe}",i]`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Overpass query
// ─────────────────────────────────────────────────────────────────────────────

interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

async function queryOverpass(
  bbox: BBox,
  filters: string[],
  limit: number
): Promise<OsmElement[]> {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const unionLines = filters.map((f) => `  ${f}(${bboxStr});`).join("\n");
  const query = `[out:json][timeout:25];\n(\n${unionLines}\n);\nout body ${limit * 5};`;

  console.log("[OVERPASS] bbox:", bboxStr);

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LeadGeneratorApp/1.0",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { elements?: OsmElement[] };
  return json.elements ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// OSM element → RawLeadWithMeta
// ─────────────────────────────────────────────────────────────────────────────

function osmElementToLead(
  el: OsmElement,
  keyword: string,
  location: string
): RawLeadWithMeta | null {
  const tags = el.tags ?? {};

  const businessName =
    tags["name"] ?? tags["brand"] ?? tags["operator"] ?? undefined;
  if (!businessName) return null;

  const phone =
    tags["phone"] ??
    tags["contact:phone"] ??
    tags["contact:mobile"] ??
    tags["mobile"] ??
    undefined;

  const addrParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);
  const address = addrParts.length ? addrParts.join(", ") : undefined;

  const website =
    tags["website"] ??
    tags["contact:website"] ??
    tags["url"] ??
    undefined;

  return {
    businessName,
    phone,
    address,
    website,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    keyword,
    location,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export class LeadScrapeOrchestrator {
  // scraperConfig kept for API compatibility — unused (no browser / HTTP scraping)
  private _scraperConfig: ScraperConfig | undefined;
  private stats: ScraperStats;

  constructor(scraperConfig?: ScraperConfig) {
    this._scraperConfig = scraperConfig;
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

      // 1. Geocode
      const bbox = await geocodeLocation(options.location);
      if (!bbox) {
        console.warn("[SCRAPER] Could not geocode:", options.location);
        return [];
      }
      this.stats.pagesScraped++;

      // 2. Keyword → OSM filters
      const filters = keywordToOsmFilters(options.keyword);
      console.log("[SCRAPER] OSM filters:", filters);

      // 3. Overpass query
      const limit = options.limit ?? 20;
      const elements = await queryOverpass(bbox, filters, limit);
      this.stats.pagesSuccessful++;
      console.log(`[SCRAPER] ${elements.length} OSM elements returned`);

      // 4. Convert
      const rawLeads: RawLeadWithMeta[] = elements
        .map((el) => osmElementToLead(el, options.keyword, options.location))
        .filter((l): l is RawLeadWithMeta => l !== null);

      this.stats.rawLeadsExtracted = rawLeads.length;

      if (!rawLeads.length) {
        console.warn("[SCRAPER] No named businesses in OSM for this query");
        return [];
      }

      // 5. Normalise
      const normalizedLeads = normalizeLeads(rawLeads);
      this.stats.leadsAfterNormalization = normalizedLeads.length;
      this.stats.normalizationLoss = rawLeads.length - normalizedLeads.length;

      // 6. Deduplicate
      const dedupedLeads = deduplicateLeads(
        normalizedLeads as NormalizedLead[],
        { nameSimilarityThreshold: 0.85 }
      );
      this.stats.leadsAfterDeduplication = dedupedLeads.length;
      this.stats.duplicatesRemoved = normalizedLeads.length - dedupedLeads.length;

      // 7. Quality filter — lower threshold (30) because OSM entries often
      //    lack phone/website but are still valid business leads
      const qualityScores = filterLeadsByQuality(dedupedLeads, {
        minQualityScore: options.minQualityScore ?? 30,
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

      // 8. Slice to limit
      const finalLeads = validLeads
        .slice(0, limit)
        .map((q) => this.convertToScrapedLead(q.lead, options));

      this.stats.totalLeadsDelivered = finalLeads.length;
      this.stats.endTime = Date.now();
      this.stats.duration = this.stats.endTime - this.stats.startTime;
      this.stats.pipelineEfficiency =
        rawLeads.length > 0
          ? (finalLeads.length / rawLeads.length) * 100
          : 0;

      this.printSummary();
      return finalLeads;
    } catch (error) {
      console.error("[PIPELINE ERROR]", error);
      return [];
    }
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
    console.log("=".repeat(60));
    console.log("SCRAPING PIPELINE SUMMARY  [OpenStreetMap]");
    console.log("=".repeat(60));
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