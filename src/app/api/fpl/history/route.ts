import { NextResponse } from 'next/server';
import { getPlayerSummary } from '@/lib/fpl-client';

export async function POST(request: Request) {
  try {
    const { playerIds } = await request.json();
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: 'playerIds required' }, { status: 400 });
    }

    // Limit to 50 players per request
    const limited = playerIds.slice(0, 50);

    const results = await Promise.allSettled(
      limited.map(id => getPlayerSummary(id))
    );

    const historyMap: Record<number, unknown[]> = {};
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        historyMap[limited[idx]] = result.value.history_past;
      }
    });

    return NextResponse.json(historyMap);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
