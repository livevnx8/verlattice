import { NextResponse } from 'next/server';
import { MOCK_BITLATTICE_FLOW } from '@/lib/mock-data';

const VNX_RPC = process.env.VNX_RPC_URL || 'http://127.0.0.1:30911';

export async function GET() {
  try {
    const res = await fetch(`${VNX_RPC}/bitlattice/flow`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const payload = await res.json();
      return NextResponse.json(payload);
    }
  } catch {
    // fall through to mock
  }

  return NextResponse.json({
    ok: true,
    mode: 'demo',
    flow: MOCK_BITLATTICE_FLOW,
  });
}
