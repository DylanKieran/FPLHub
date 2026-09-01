import { NextResponse } from 'next/server';
import { getBootstrap } from '@/lib/fpl-client';

export async function GET() {
  try {
    const data = await getBootstrap();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch FPL data' }, { status: 500 });
  }
}
