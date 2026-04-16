import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import LeadScrapeOrchestrator from "@/lib/scrapers/orchestrator";
import { prisma } from "@/lib/db";
import { z } from "zod";

const ScrapeRequestSchema = z.object({
  keyword: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(500).optional().default(20),
  minQualityScore: z.number().min(0).max(100).optional().default(30),
  requirePhone: z.boolean().optional().default(false),
  requireAddress: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user?.email) {
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          duplicatesSkipped: 0,
          leads: [],
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          duplicatesSkipped: 0,
          leads: [],
          error: "Invalid request JSON",
        },
        { status: 400 }
      );
    }

    let scrapeRequest: z.infer<typeof ScrapeRequestSchema>;

    try {
      scrapeRequest = ScrapeRequestSchema.parse(body);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          duplicatesSkipped: 0,
          leads: [],
          error:
            err instanceof Error
              ? err.message
              : "Invalid request parameters",
        },
        { status: 422 }
      );
    }

    const isVercel = !!process.env.VERCEL;

    const orchestrator = new LeadScrapeOrchestrator({
      headless: true,
      timeout: 20000,
      delayBetweenRequests: 1000,
      maxRetries: 2,
      fallbackToCheerio:
        isVercel || process.env.NODE_ENV === "production",
    });

    const leads = await orchestrator.scrapeLeads({
      keyword: scrapeRequest.keyword,
      location: scrapeRequest.location,
      limit: scrapeRequest.limit,
      minQualityScore: scrapeRequest.minQualityScore,
      requirePhone: scrapeRequest.requirePhone,
      requireAddress: scrapeRequest.requireAddress,
    });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          duplicatesSkipped: 0,
          leads: [],
          error: "User not found",
        },
        { status: 404 }
      );
    }

    let inserted = 0;
    let duplicatesSkipped = 0;
    const savedLeads = [];

    for (const lead of leads) {
      try {
        const orConditions: object[] = [
          {
            businessName: lead.businessName,
            phone: lead.phone ?? null,
          },
        ];

        if (lead.website) {
          orConditions.push({ website: lead.website });
        }

        const existing = await prisma.lead.findFirst({
          where: {
            userId: dbUser.id,
            OR: orConditions,
          },
        });

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        const saved = await prisma.lead.create({
          data: {
            userId: dbUser.id,
            businessName: lead.businessName,
            phone: lead.phone ?? null,
            address: lead.address ?? null,
            website: lead.website ?? null,
            sourceUrl: lead.sourceUrl,
            keyword: lead.keyword,
            location: lead.location,
          },
        });

        savedLeads.push(saved);
        inserted++;
      } catch (insertError) {
        console.error("[LEAD INSERT ERROR]", insertError);
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      duplicatesSkipped,
      leads: savedLeads,
      stats: orchestrator.getStats(),
    });
  } catch (error) {
    console.error("[SCRAPE ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        inserted: 0,
        duplicatesSkipped: 0,
        leads: [],
        error: error instanceof Error ? error.message : "Unknown scrape error",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;