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

async function searchPlaces(keyword, location, limit) {
  const url = BASE + "/search?q=" + encodeURIComponent(keyword + " " + location) + "&format=json&limit=" + (limit * 2) + "&addressdetails=1&extratags=1&namedetails=1";
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  return res.json();
}

function extractLead(r) {
  const name = (r.namedetails && r.namedetails.name) || r.name || r.display_name.split(",")[0];
  const ext = r.extratags || {};
  const addr = r.address || {};
  const phone = ext.phone || ext["contact:phone"] || null;
  const website = ext.website || ext["contact:website"] || null;
  const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
  const city = addr.city || addr.town || addr.village || addr.county || "";
  const address = [street, city].filter(Boolean).join(", ") || null;
  const sourceUrl = "https://www.openstreetmap.org/" + r.osm_type + "/" + r.osm_id;
  return { name, phone, website, address, sourceUrl };
}

export async function POST(request) {
  try {
    const user = await getUserFromSession();
      return NextResponse.json({ success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: "Authentication required" }, { status: 401 });
    }
    const body = await request.json();
    const req = Schema.parse(body);
    const results = await searchPlaces(req.keyword, req.location, req.limit);
    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });

    let inserted = 0, duplicatesSkipped = 0;
    const savedLeads = [];

    for (const result of results.slice(0, req.limit)) {
      const lead = extractLead(result);
      try {
        const existing = await prisma.lead.findFirst({
          where: { userId: dbUser.id, OR: [...(lead.phone ? [{ businessName: lead.name, phone: lead.phone }] : []), ...(lead.website ? [{ website: lead.website }] : []), { businessName: lead.name }] },
        });
        if (existing) { duplicatesSkipped++; continue; }
        const saved = await prisma.lead.create({
          data: { userId: dbUser.id, businessName: lead.name, phone: lead.phone, address: lead.address, website: lead.website, sourceUrl: lead.sourceUrl, keyword: req.keyword, location: req.location },
        });
        savedLeads.push(saved);
        inserted++;
      } catch(e) { console.error("[INSERT ERROR]", e); }
    }
    return NextResponse.json({ success: true, inserted, duplicatesSkipped, leads: savedLeads });
  } catch (error) {
    console.error("[SCRAPE ERROR]", error);
    return NextResponse.json({ success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: error instanceof Error ? error.message : "Scrape failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
