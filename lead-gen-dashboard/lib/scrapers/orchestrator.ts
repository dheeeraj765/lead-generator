// lib/scrapers/orchestrator.ts

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

interface RawLeadWithMeta {
  businessName: string;
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
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      location
    )}&format=json&limit=1`,
    { headers: { "User-Agent": "LeadGeneratorApp/1.0" } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.length) return null;

  const b = data[0].boundingbox;

  return {
    south: parseFloat(b[0]),
    north: parseFloat(b[1]),
    west: parseFloat(b[2]),
    east: parseFloat(b[3]),
  };
}

function keywordToOsmFilters(keyword: string): string[] {
  const kw = keyword.toLowerCase();

  if (kw.includes("restaurant") || kw.includes("food")) {
    return [
      'node["amenity"="restaurant"]',
      'way["amenity"="restaurant"]',
      'node["amenity"="cafe"]',
      'way["amenity"="cafe"]',
    ];
  }

  if (kw.includes("dentist")) {
    return [
      'node["amenity"="dentist"]',
      'way["amenity"="dentist"]',
    ];
  }

  return [`node["name"~"${kw}",i]`, `way["name"~"${kw}",i]`];
}

async function queryOverpass(
  bbox: BBox,
  filters: string[],
  limit: number
): Promise<OsmElement[]> {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const query = `
[out:json][timeout:25];
(
${filters.map((f) => `${f}(${bboxStr});`).join("\n")}
);
out center;
`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error("Overpass failed");

  const json = await res.json();
  return (json.elements ?? []).slice(0, limit * 10);
}

function osmElementToLead(
  el: OsmElement,
  keyword: string,
  location: string
): RawLeadWithMeta | null {
  const tags = el.tags ?? {};
  const name = tags.name || tags.brand;

  if (!name) return null;

  return {
    businessName: name,
    phone: tags.phone || tags["contact:phone"],
    address: [tags["addr:street"], tags["addr:city"]]
      .filter(Boolean)
      .join(", "),
    website: tags.website,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    keyword,
    location,
  };
}

export class LeadScrapeOrchestrator {
  private _scraperConfig?: ScraperConfig;

  constructor(scraperConfig?: ScraperConfig) {
    this._scraperConfig = scraperConfig;
  }

  async scrapeLeads(options: ScrapeOptions): Promise<ScrapedLead[]> {
    const bbox = await geocodeLocation(options.location);
    if (!bbox) return [];

    const filters = keywordToOsmFilters(options.keyword);
    const elements = await queryOverpass(bbox, filters, options.limit ?? 20);

    const rawLeads = elements
      .map((el) => osmElementToLead(el, options.keyword, options.location))
      .filter((lead): lead is RawLeadWithMeta => lead !== null); // ✅ FIX 1

    const normalized = normalizeLeads(rawLeads);

    const deduped = deduplicateLeads(normalized as NormalizedLead[], {
      nameSimilarityThreshold: 0.85,
    });

    const quality = filterLeadsByQuality(deduped, {
      minQualityScore: options.minQualityScore ?? 20,
    });

    return quality
      .filter((q) => q.isValid)
      .slice(0, options.limit ?? 20)
      .map((q) => ({
        businessName: q.lead.businessName,
        phone: q.lead.phone,
        address: q.lead.address,
        website: q.lead.website,
        sourceUrl: q.lead.sourceUrl || "", // ✅ FIX 2
        keyword: options.keyword,
        location: options.location,
      }));
  }
}

export default LeadScrapeOrchestrator;