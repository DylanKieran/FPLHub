import { NextResponse } from 'next/server';
import { getPlayerSummary } from '@/lib/fpl-client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await getPlayerSummary(parseInt(params.id));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
  }
}
