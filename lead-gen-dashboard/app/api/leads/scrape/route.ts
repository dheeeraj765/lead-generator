import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { scrapeLeads } from '@/lib/scraper';
import { scrapeSchema } from '@/lib/validators';
import { ScrapeResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { keyword, location, limit } = scrapeSchema.parse(body);
    
    // Scrape leads
    const scrapedLeads = await scrapeLeads(keyword, location, limit);
    
    let inserted = 0;
    let duplicatesSkipped = 0;
    const savedLeads = [];
    
    // Process each lead
    for (const lead of scrapedLeads) {
      // Check for duplicates
      const existingLead = await prisma.lead.findFirst({
        where: {
          userId: user.id,
          OR: [
            lead.website ? { website: lead.website } : {},
            lead.phone ? { phone: lead.phone } : {},
            {
              AND: [
                { businessName: lead.businessName },
                { location: lead.location },
              ],
            },
          ].filter(condition => Object.keys(condition).length > 0),
        },
      });
      
      if (existingLead) {
        duplicatesSkipped++;
        continue;
      }
      
      // Save new lead
      const savedLead = await prisma.lead.create({
        data: {
          userId: user.id,
          businessName: lead.businessName,
          website: lead.website,
          phone: lead.phone,
          address: lead.address,
          sourceUrl: lead.sourceUrl,
          keyword: lead.keyword,
          location: lead.location,
        },
      });
      
      inserted++;
      savedLeads.push(savedLead);
    }
    
    const result: ScrapeResult = {
      success: true,
      inserted,
      duplicatesSkipped,
      leads: savedLeads,
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Scrape error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to scrape leads' },
      { status: 500 }
    );
  }
}