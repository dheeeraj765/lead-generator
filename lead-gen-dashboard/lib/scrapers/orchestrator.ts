/**
 * lib/scrapers/orchestrator.ts
 * OpenStreetMap lead scraping orchestrator
 */

import type { ScrapedLead } from "@/types";
import type { ScraperConfig } from "./adaptive-scraper";
import type { NormalizedLead } from "./normalizer";
import { normalizeLeads } from "./normalizer";
import { deduplicateLeads } from "./deduplicator";
import { filterLeadsByQuality } from "./validator";

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

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

async function geocodeLocation(location: string): Promise<BBox | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      location
    )}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LeadGeneratorApp/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[GEOCODE ERROR]", res.status);
    return null;
  }

  const data = (await res.json()) as Array<{
    boundingbox?: string[];
    lat?: string;
    lon?: string;
  }>;

  if (!data.length) {
    return null;
  }

  const hit = data[0];

  if (hit.boundingbox?.length === 4) {
    let south = parseFloat(hit.boundingbox[0]);
    let north = parseFloat(hit.boundingbox[1]);
    let west = parseFloat(hit.boundingbox[2]);
    let east = parseFloat(hit.boundingbox[3]);

    const latSpan = north - south;
    const lonSpan = east - west;

    if (latSpan > 1 || lonSpan > 1) {
      const centerLat = (south + north) / 2;
      const centerLon = (west + east) / 2;
      const delta = 1.5;

      south = centerLat - delta;
      north = centerLat + delta;
      west = centerLon - delta;
      east = centerLon + delta;
    }

    return { south, west, north, east };
  }

  if (hit.lat && hit.lon) {
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    const delta = 0.5;

    return {
      south: lat - delta,
      north: lat + delta,
      west: lon - delta,
      east: lon + delta,
    };
  }

  return null;
}

function keywordToOsmFilters(keyword: string): string[] {
  const kw = keyword.toLowerCase().trim();

  const map: Record<string, string[]> = {
    dentist: [
      'node["amenity"="dentist"]',
      'way["amenity"="dentist"]',
      'node["healthcare"="dentist"]',
      'way["healthcare"="dentist"]',
    ],
    restaurant: [
      'node["amenity"="restaurant"]',
      'way["amenity"="restaurant"]',
      'node["amenity"="fast_food"]',
      'way["amenity"="fast_food"]',
    ],
    food: [
      'node["amenity"="restaurant"]',
      'way["amenity"="restaurant"]',
      'node["amenity"="cafe"]',
      'way["amenity"="cafe"]',
      'node["shop"="supermarket"]',
      'way["shop"="supermarket"]',
    ],
    hospital: [
      'node["amenity"="hospital"]',
      'way["amenity"="hospital"]',
    ],
    shop: ['node["shop"]', 'way["shop"]'],
  };

  for (const [key, filters] of Object.entries(map)) {
    if (kw.includes(key)) {
      return filters;
    }
  }

  const safe = kw.replace(/[^a-z0-9 ]/gi, "");
  return [
    `node["name"~"${safe}",i]`,
    `way["name"~"${safe}",i]`,
  ];
}

async function queryOverpass(
  bbox: BBox,
  filters: string[],
  limit: number
): Promise<OsmElement[]> {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const unionLines = filters.map((f) => `${f}(${bboxStr});`).join("\n");

  const query = `
[out:json][timeout:25];
(
${unionLines}
);
out center;
`;

  console.log("[OVERPASS QUERY]", query);

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LeadGeneratorApp/1.0",
    },
    body: `data=${encodeURIComponent(query)}`,
    cache: "no-store",
  });

  const raw = await res.text();

  if (!res.ok) {
    console.error("[OVERPASS ERROR]", raw);
    throw new Error(`Overpass failed: ${res.status}`);
  }

  const json = JSON.parse(raw) as { elements?: OsmElement[] };
  return (json.elements ?? []).slice(0, limit * 10);
}

function osmElementToLead(
  el: OsmElement,
  keyword: string,
  location: string
): RawLeadWithMeta | null {
  const tags = el.tags ?? {};
  const businessName = tags.name || tags.brand || tags.operator;

  if (!businessName) {
    return null;
  }

  const address = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
  ]
    .filter(Boolean)
    .join(", ");

  return {
    businessName,
    phone:
      tags.phone ||
      tags["contact:phone"] ||
      tags["contact:mobile"] ||
      undefined,
    address: address || undefined,
    website:
      tags.website ||
      tags["contact:website"] ||
      tags.url ||
      undefined,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    keyword,
    location,
  };
}

export class LeadScrapeOrchestrator {
  private _scraperConfig?: ScraperConfig;
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
    const limit = options.limit ?? 20;

    const bbox = await geocodeLocation(options.location);
    if (!bbox) {
      return [];
    }

    const filters = keywordToOsmFilters(options.keyword);
    const elements = await queryOverpass(bbox, filters, limit);

    const rawLeads = elements
      .map((el) => osmElementToLead(el, options.keyword, options.location))
      .filter((lead): lead is RawLeadWithMeta => Boolean(lead));

    const normalized = normalizeLeads(rawLeads);
    const deduped = deduplicateLeads(normalized as NormalizedLead[], {
      nameSimilarityThreshold: 0.85,
    });

    const quality = filterLeadsByQuality(deduped, {
      minQualityScore: options.minQualityScore ?? 20,
      requirePhone: options.requirePhone ?? false,
      requireAddress: options.requireAddress ?? false,
    });

    const finalLeads = quality
      .filter((q) => q.isValid)
      .slice(0, limit)
      .map((q) => ({
        businessName: q.lead.businessName,
        phone: q.lead.phone,
        address: q.lead.address,
        website: q.lead.website,
        sourceUrl: q.lead.sourceUrl || "",
        keyword: options.keyword,
        location: options.location,
      }));

    this.stats.totalLeadsDelivered = finalLeads.length;
    return finalLeads;
  }

  getStats(): ScraperStats {
    return this.stats;
  }
}

export default LeadScrapeOrchestrator;