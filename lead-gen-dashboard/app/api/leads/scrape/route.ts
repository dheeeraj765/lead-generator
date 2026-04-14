/**
 * API Route: /api/leads/scrape
 * 
 * Starts a web scraping job to collect leads from business directories
 * Part of the modular scraping pipeline (parser → normalizer → deduplicator → validator)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import LeadScrapeOrchestrator from '@/lib/scrapers/orchestrator';
import { prisma } from '@/lib/db';
import type { ScrapeResult } from '@/types';
import { z } from 'zod';

// Request validation schema
const ScrapeRequestSchema = z.object({
  keyword: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(500).optional().default(20),
  minQualityScore: z.number().min(0).max(100).optional().default(50),
  requirePhone: z.boolean().optional().default(false),
  requireAddress: z.boolean().optional().default(false),
});

type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

/**
 * POST handler for initiating scraping job
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify user authentication
    const user = await getUserFromSession();
    if (!user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    let scrapeRequest: ScrapeRequest;
    try {
      scrapeRequest = ScrapeRequestSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationError.issues,
          },
          { status: 400 }
        );
      }
      throw validationError;
    }

    console.log(
      `[SCRAPE] User ${user.email} requested: ${scrapeRequest.keyword} in ${scrapeRequest.location}`
    );

    // Initialize orchestrator with anti-detection measures
    const orchestrator = new LeadScrapeOrchestrator({
      headless: true,
      timeout: 60000,
      delayBetweenRequests: 2000, // 2 second delay between requests to avoid blocking
      maxRetries: 2,
    });

    // Run scraping pipeline
    const leads = await orchestrator.scrapeLeads({
      keyword: scrapeRequest.keyword,
      location: scrapeRequest.location,
      limit: scrapeRequest.limit,
      mindQualityScore: scrapeRequest.minQualityScore,
      requirePhone: scrapeRequest.requirePhone,
      requireAddress: scrapeRequest.requireAddress,
    });
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check for duplicates before insertion
    let insertedCount = 0;
    let duplicatesSkipped = 0;
    const savedLeads = [];

    for (const lead of leads) {
      try {
        // Check if lead already exists (by business name + phone or website)
        const existing = await prisma.lead.findFirst({
          where: {
            userId: dbUser.id,
            OR: [
              {
                businessName: lead.businessName,
                phone: lead.phone || null,
              },
              {
                website: lead.website || null,
              },
            ],
          },
        });

        if (existing) {
          duplicatesSkipped++;
          console.log(
            `[DUPLICATE] Skipping: ${lead.businessName} (already in database)`
          );
          continue;
        }

        // Insert lead into database
        const savedLead = await prisma.lead.create({
          data: {
            userId: dbUser.id,
            businessName: lead.businessName,
            phone: lead.phone || null,
            address: lead.address || null,
            website: lead.website || null,
            sourceUrl: lead.sourceUrl,
            keyword: lead.keyword,
            location: lead.location,
          },
        });

        insertedCount++;
        savedLeads.push(savedLead);
      } catch (error) {
        console.error('Error inserting lead:', error);
        // Continue with next lead on error
      }
    }

    const stats = orchestrator.getStats();

    const response: ScrapeResult = {
      success: true,
      inserted: insertedCount,
      duplicatesSkipped,
      leads: savedLeads,
    };

    console.log(
      `[SCRAPE COMPLETE] Inserted: ${insertedCount}, Duplicates: ${duplicatesSkipped}`
    );

    return NextResponse.json({
      ...response,
      stats,
    });
  } catch (error) {
    console.error('[SCRAPE ERROR]', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during scraping';

    // Check if this is a browser launch error on Vercel
    const isBrowserError =
      errorMessage.includes('Chrome') ||
      errorMessage.includes('Chromium') ||
      errorMessage.includes('browser') ||
      errorMessage.includes('not found');

    if (isBrowserError && process.env.VERCEL) {
      return NextResponse.json(
        {
          success: false,
          inserted: 0,
          duplicatesSkipped: 0,
          leads: [],
          error:
            'Puppeteer (browser automation) is not available on Vercel serverless. ' +
            'Recommended solutions: (1) Run locally for testing, (2) Use a scraping API service (Firecrawl, ScraperAPI), ' +
            '(3) Deploy to an environment with browser support (Docker, dedicated server), or (4) Use API-based data sources instead of scraping.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        inserted: 0,
        duplicatesSkipped: 0,
        leads: [],
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns scraping status and API documentation
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromSession();
  if (!user?.email) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const isVercel = !!process.env.VERCEL;

  return NextResponse.json({
    status: isVercel ? 'limited' : 'ready',
    environment: process.env.VERCEL_ENV || 'local',
    message: isVercel
      ? 'Scraping requires a browser. Vercel serverless does not support Puppeteer. See SCRAPING_VERCEL_SETUP.md for solutions.'
      : 'POST to this endpoint to start a scraping job',
    limitations: isVercel
      ? [
          'Puppeteer/browser automation not available on Vercel serverless',
          'Recommended: Use Firecrawl API or run locally',
          'See SCRAPING_VERCEL_SETUP.md for detailed setup instructions',
        ]
      : [],
    documentation: {
      endpoint: '/api/leads/scrape',
      method: 'POST',
      description: 'Scrape business leads from web directories',
      request: {
        keyword: 'string - Business type (e.g., "dentist", "plumber")',
        location: 'string - Geographic location (e.g., "Kolhapur", "Delhi")',
        limit: 'number - Max leads to return (1-500, default: 20)',
        minQualityScore:
          'number - Minimum quality score 0-100 (default: 50)',
        requirePhone:
          'boolean - Only leads with phone numbers (default: false)',
        requireAddress:
          'boolean - Only leads with addresses (default: false)',
      },
      example: {
        keyword: 'plumber',
        location: 'Delhi',
        limit: 50,
        minQualityScore: 60,
        requirePhone: true,
      },
      setupInstructions: isVercel
        ? 'https://github.com/dheeeraj765/lead-generator/blob/main/SCRAPING_VERCEL_SETUP.md'
        : undefined,
    },
  });
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute timeout for scraping