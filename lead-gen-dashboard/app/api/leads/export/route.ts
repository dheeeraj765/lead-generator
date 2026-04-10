import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateCSV } from '@/lib/csv';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') as 'NEW' | 'CONTACTED' | 'IGNORED' | null;
    
    const where: any = {
      userId: user.id,
    };
    
    if (search) {
      where.businessName = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    if (status) {
      where.status = status;
    }
    
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        website: true,
        phone: true,
        address: true,
        sourceUrl: true,
        keyword: true,
        location: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    const csv = generateCSV(leads);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}