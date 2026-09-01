import { NextResponse } from 'next/server';
import { getManager, getManagerHistory, getManagerPicks, getManagerTransfers } from '@/lib/fpl-client';
import { getBootstrap } from '@/lib/fpl-client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const managerId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'info';

    switch (type) {
      case 'info':
        return NextResponse.json(await getManager(managerId));
      case 'history':
        return NextResponse.json(await getManagerHistory(managerId));
      case 'picks': {
        const event = searchParams.get('event');
        if (!event) {
          const bootstrap = await getBootstrap();
          const currentEvent = bootstrap.events.find(e => e.is_current || e.is_previous);
          if (!currentEvent) return NextResponse.json({ error: 'No active gameweek' }, { status: 400 });
          return NextResponse.json(await getManagerPicks(managerId, currentEvent.id));
        }
        return NextResponse.json(await getManagerPicks(managerId, parseInt(event)));
      }
      case 'transfers':
        return NextResponse.json(await getManagerTransfers(managerId));
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch manager data' }, { status: 500 });
  }
}
