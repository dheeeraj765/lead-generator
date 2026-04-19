import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Schema = z.object({
  keyword: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(500).optional().default(20),
});

async function getElements(keyword: string, location: string, limit: number) {
  const kw = keyword.toLowerCase();
  let tag = '["name"~"' + keyword + '",i]';
  if (kw.includes("restaurant") || kw.includes("food") || kw.includes("cafe")) tag = '["amenity"~"restaurant|cafe|fast_food"]';
  else if (kw.includes("bakery")) tag = '["shop"="bakery"]';
  else if (kw.includes("dentist")) tag = '["amenity"="dentist"]';
  else if (kw.includes("hotel")) tag = '["tourism"="hotel"]';
  else if (kw.includes("hospital") || kw.includes("clinic")) tag = '["amenity"~"hospital|clinic|doctors"]';
  else if (kw.includes("school") || kw.includes("college")) tag = '["amenity"~"school|college|university"]';
  else if (kw.includes("gym") || kw.includes("fitness")) tag = '["leisure"~"fitness_centre|gym"]';
  else if (kw.includes("pharmacy")) tag = '["amenity"~"pharmacy|chemist"]';
  else if (kw.includes("bank")) tag = '["amenity"="bank"]';
  else if (kw.includes("shop") || kw.includes("store")) tag = '["shop"]';

  const geo = await fetch(
    "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(location) + "&format=json&limit=1",
    { headers: { "User-Agent": "LeadGeneratorApp/1.0" } }
  );
  const geoJson = await geo.json();
  if (!geoJson.length) throw new Error("Location not found: " + location);

  const b = geoJson[0].boundingbox;
  const bbox = b[0] + "," + b[2] + "," + b[1] + "," + b[3];
  const query = "[out:json][timeout:30];(node" + tag + "(" + bbox + ");way" + tag + "(" + bbox + "););out center " + (limit * 5) + ";";

  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const mirror of mirrors) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      return json.elements ?? [];
    } catch {
      continue;
    }
  }
  throw new Error("Could not reach Overpass API. Try again later.");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user?.email) {
      return NextResponse.json({ success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const req = Schema.parse(body);
    const elements = await getElements(req.keyword, req.location, req.limit);

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    if (!dbUser) {
      return NextResponse.json({ success: false, inserted: 0, duplicatesSkipped: 0, leads: [], error: "User not found" }, { status: 404 });
    }

    let inserted = 0;
    let duplicatesSkipped = 0;
    const savedLeads = [];

    for (const el of elements.slice(0, req.limit)) {
      const tags = el.tags ?? {};
      const name = tags.name || tags.brand;
      if (!name) continue;

      const phone = tags.phone || tags["contact:phone"] || null;
      const website = tags.website || tags["contact:website"] || null;
      const address = [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || null;
      const sourceUrl = "https://www.openstreetmap.org/" + el.type + "/" + el.id;

      try {
        const existing = await prisma.lead.findFirst({
          where: {
            userId: dbUser.id,
            OR: [
              ...(phone ? [{ businessName: name, phone }] : []),
              ...(website ? [{ website }] : []),
              { businessName: name },
            ],
          },
        });
        if (existing) { duplicatesSkipped++; continue; }

        const saved = await prisma.lead.create({
          data: { userId: dbUser.id, businessName: name, phone, address, website, sourceUrl, keyword: req.keyword, location: req.location },
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