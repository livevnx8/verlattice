import { NextRequest, NextResponse } from 'next/server';
import { fetchTopicMessages, computeTps } from '@/lib/hcs-client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { topicId: string } },
) {
  const topicId = params.topicId;
  const network = (request.nextUrl.searchParams.get('network') || 'testnet') as 'testnet' | 'mainnet';
  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') || '25', 10));

  try {
    const messages = await fetchTopicMessages(topicId, network, limit);
    const tps = computeTps(messages);
    const maxSeq = messages.length > 0 ? Math.max(...messages.map((m) => m.sequenceNumber)) : 0;

    return NextResponse.json({
      topicId,
      network,
      messageCount: messages.length,
      maxSequence: maxSeq,
      estimatedTps: parseFloat(tps.toFixed(2)),
      messages,
      mirrorUrl: `https://${network === 'mainnet' ? 'mainnet-public' : 'testnet'}.mirrornode.hedera.com/api/v1/topics/${topicId}/messages`,
      hashscanUrl: `https://hashscan.io/${network}/topic/${topicId}`,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, topicId, network },
      { status: 502 },
    );
  }
}