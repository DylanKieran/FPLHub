import { NextResponse } from 'next/server';
import { getFixtures } from '@/lib/fpl-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const event = searchParams.get('event');
    const data = await getFixtures(event ? parseInt(event) : undefined);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 });
  }
}
