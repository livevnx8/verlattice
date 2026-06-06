import { NextResponse } from 'next/server';

const BOT_RPC = process.env.BOT_RPC_URL || 'http://127.0.0.1:30910';

export async function GET() {
  try {
    const response = await fetch(`${BOT_RPC}/bot/pairs`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `bot_pairs_${response.status}` }, { status: 503 });
    }

    const payload = await response.json();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
