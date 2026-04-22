import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Schema = z.object({
  keyword: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(500).optional().default(20),
});

const BASE = "https://nominatim.openstreetmap.org";
const UA = { "User-Agent": "LeadGeneratorApp/1.0", "Accept-Language": "en" };

interface NomResult {
  osm_type: string;
  osm_id: number;
  display_name: string;
  name?: string;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
}

interface LeadData {
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  sourceUrl: string;
}

async function nominatimSearch(query: string, limit: number): Promise<NomResult[]> {
  await new Promise(r => setTimeout(r, 1100)); // respect 1req/sec rate limit
  const url = BASE + "/search?q=" + encodeURIComponent(query) +
    "&format=json&limit=" + limit +
    "&addressdetails=1&extratags=1&namedetails=1";
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function buildQueries(keyword: string, location: string): string[] {
  const kw = keyword.toLowerCase().trim();
  const queries: string[] = [];

  // Primary: direct search
  queries.push(keyword + " " + location);

  // Secondary: amenity-based searches
  if (kw.includes("dentist") || kw.includes("dental")) {
    queries.push("dental clinic " + location);
    queries.push("dental hospital " + location);
    queries.push("teeth doctor " + location);
  } else if (kw.includes("restaurant") || kw.includes("food")) {
    queries.push("restaurant " + location);
    queries.push("cafe " + location);
    queries.push("dining " + location);
  } else if (kw.includes("hotel")) {
    queries.push("hotel " + location);
    queries.push("lodge " + location);
    queries.push("inn " + location);
  } else if (kw.includes("hospital") || kw.includes("clinic")) {
    queries.push("hospital " + location);
    queries.push("medical clinic " + location);
    queries.push("nursing home " + location);
  } else if (kw.includes("school") || kw.includes("college")) {
    queries.push("school " + location);
    queries.push("college " + location);
    queries.push("institute " + location);
  } else if (kw.includes("gym") || kw.includes("fitness")) {
    queries.push("gym " + location);
    queries.push("fitness center " + location);
    queries.push("sports club " + location);
  } else if (kw.includes("pharmacy") || kw.includes("chemist")) {
    queries.push("pharmacy " + location);
    queries.push("medical store " + location);
    queries.push("chemist " + location);
  } else if (kw.includes("bakery")) {
    queries.push("bakery " + location);
    queries.push("cake shop " + location);
    queries.push("bread shop " + location);
  } else if (kw.includes("bank")) {
    queries.push("bank " + location);
    queries.push("ATM " + location);
  } else if (kw.includes("salon") || kw.includes("beauty")) {
    queries.push("beauty salon " + location);
    queries.push("hair salon " + location);
    queries.push("parlour " + location);
  } else if (kw.includes("lawyer") || kw.includes("advocate")) {
    queries.push("law firm " + location);
    queries.push("advocate office " + location);
  } else if (kw.includes("shop") || kw.includes("store")) {
    queries.push("shop " + location);
    queries.push("store " + location);
    queries.push("market " + location);
  } else {
    // Generic fallback variations
    queries.push(keyword + " shop " + location);
    queries.push(keyword + " centre " + location);
    queries.push(keyword + " services " + location);
  }

  return queries;
}

function extractLead(r: NomResult): LeadData | null {
  const name = r.namedetails?.name || r.name || r.display_name.split(",")[0];
  if (!name || name.trim().length < 2) return null;

  // Skip pure geographic/administrative results
  const skipTypes = ["administrative", "suburb", "city", "town", "village", "county", "state", "country", "postcode", "road", "path", "footway"];
  if (r.extratags?.place && skipTypes.includes(r.extratags.place)) return null;

  const ext = r.extratags ?? {};
  const addr = r.address ?? {};

  const phone = ext["phone"] || ext["contact:phone"] || ext["contact:mobile"] || null;
  const website = ext["website"] || ext["contact:website"] || ext["url"] || null;
  const street = [addr["house_number"], addr["road"]].filter(Boolean).join(" ");
  const city = addr["city"] || addr["town"] || addr["village"] || addr["county"] || "";
  const state = addr["state"] || "";
  const address = [street, city, state].filter(Boolean).join(", ") || null;
  const sourceUrl = "https://www.openstreetmap.org/" + r.osm_type + "/" + r.osm_id;

  return { name: name.trim(), phone, website, address, sourceUrl };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user?.email) {
      return NextResponse.json({ success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const req = Schema.parse(body);

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    if (!dbUser) {
      return NextResponse.json({ success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: "User not found" }, { status: 404 });
    }

    // Build multiple search queries
    const queries = buildQueries(req.keyword, req.location);
    const perQuery = Math.ceil((req.limit * 3) / queries.length);

    // Collect all results across queries
    const seen = new Set<string>();
    const allLeads: LeadData[] = [];

    for (const query of queries) {
      if (allLeads.length >= req.limit * 3) break;
      const results = await nominatimSearch(query, Math.min(perQuery, 50));
      for (const r of results) {
        const lead = extractLead(r);
        if (!lead) continue;
        const key = lead.name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        allLeads.push(lead);
      }
    }

    let inserted = 0;
    let duplicatesSkipped = 0;
    const savedLeads = [];

    for (const lead of allLeads.slice(0, req.limit * 2)) {
      if (inserted >= req.limit) break;

      try {
        const existing = await prisma.lead.findFirst({
          where: {
            userId: dbUser.id,
            OR: [
              ...(lead.phone ? [{ businessName: lead.name, phone: lead.phone }] : []),
              ...(lead.website ? [{ website: lead.website }] : []),
              { businessName: lead.name },
            ],
          },
        });
        if (existing) { duplicatesSkipped++; continue; }

        const saved = await prisma.lead.create({
          data: {
            userId: dbUser.id,
            businessName: lead.name,
            phone: lead.phone,
            address: lead.address,
            website: lead.website,
            sourceUrl: lead.sourceUrl,
            keyword: req.keyword,
            location: req.location,
          },
        });
        savedLeads.push(saved);
        inserted++;
      } catch (e) {
        console.error("[INSERT ERROR]", e);
      }
    }

    return NextResponse.json({ success: true, inserted, duplicatesSkipped, leads: savedLeads });

  } catch (error) {
    console.error("[SCRAPE ERROR]", error);
    return NextResponse.json(
      { success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: error instanceof Error ? error.message : "Scrape failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;