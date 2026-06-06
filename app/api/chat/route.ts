import { NextRequest, NextResponse } from 'next/server';

const BOT_RPC = process.env.BOT_RPC_URL || 'http://127.0.0.1:30910';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const XAI_KEY = process.env.XAI_API_KEY || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const PRIMARY_VENUE = 'Kraken US Spot';

const TRADING_KEYWORDS = [
  'trade',
  'trading',
  'market',
  'markets',
  'btc',
  'bitcoin',
  'eth',
  'ethereum',
  'sol',
  'solana',
  'xrp',
  'hbar',
  'kraken',
  'entry',
  'exit',
  'position',
  'positions',
  'long',
  'short',
  'stop',
  'take profit',
  'portfolio',
  'pnl',
  'signal',
  'signals',
  'regime',
  'risk',
  'drawdown',
  'chart',
  'candles',
  'order flow',
  'support',
  'resistance',
  'hedge',
  'leverage',
  'liquidation',
];

interface VenueHealth {
  id: string;
  connected?: boolean;
}

interface PairEntry {
  symbol: string;
  stage: string;
  strategy: string;
  health?: string;
  haltReason?: string | null;
}

interface PairRegistryPayload {
  requestedPairs?: string[];
  pairs?: PairEntry[];
}

interface BotStatus {
  mode?: string;
  deploymentStage?: string;
  ticks?: number;
  feeds?: unknown[];
  regime?: { regime: string; confidence: number };
  metaLabels?: { allowed: number; blocked: number; lastBlockReason?: string };
  session?: { realizedPnl?: number; currentEquity?: number; maxDrawdownPct?: number; lastFillAt?: string | null };
  strategy?: { currentRegime?: string; openStops?: number };
  ml?: { modelLoaded?: boolean; confidenceScore?: number };
  modelLoaded?: boolean;
  connectors?: { venues?: VenueHealth[]; kraken?: VenueHealth };
  pairRegistry?: PairRegistryPayload;
  agents?: Record<string, unknown>;
  venueCompliance?: Record<string, unknown>;
}

interface ChatMessage {
  role: string;
  content: string;
}

async function fetchBotStatus(): Promise<BotStatus | null> {
  try {
    const res = await fetch(`${BOT_RPC}/bot/status`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()) as BotStatus;
  } catch {
    return null;
  }
}

async function fetchPairRegistry(): Promise<PairRegistryPayload | null> {
  try {
    const res = await fetch(`${BOT_RPC}/bot/pairs`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()) as PairRegistryPayload;
  } catch {
    return null;
  }
}

function normalizeUserMessage(input: string): string {
  const trimmed = input.trim();
  const markers = ['User request:\n', 'User message:\n'];

  for (const marker of markers) {
    const index = trimmed.lastIndexOf(marker);
    if (index >= 0) {
      return trimmed.slice(index + marker.length).trim();
    }
  }

  return trimmed;
}

function looksTradingQuery(input: string): boolean {
  const normalized = normalizeUserMessage(input).toLowerCase();
  return TRADING_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getKrakenVenue(status: BotStatus | null): VenueHealth | null {
  return status?.connectors?.kraken ?? status?.connectors?.venues?.find((venue) => venue.id === 'kraken') ?? null;
}

function isKrakenLiveConnected(status: BotStatus | null): boolean {
  const kraken = getKrakenVenue(status);
  return Boolean(status?.mode === 'live' && kraken?.connected);
}

function getRequestedMarkets(pairRegistry: PairRegistryPayload | null): string {
  const fromPairs = pairRegistry?.pairs?.map((pair) => pair.symbol) ?? [];
  const markets = fromPairs.length > 0 ? fromPairs : pairRegistry?.requestedPairs ?? [];
  return markets.length > 0 ? markets.join(', ') : 'BTC/USD, ETH/USD, SOL/USD, XRP/USD, HBAR/USD';
}

function buildSystemPrompt(status: BotStatus | null, pairRegistry: PairRegistryPayload | null, focusTrading: boolean): string {
  const now = new Date().toUTCString();
  const requestedMarkets = getRequestedMarkets(pairRegistry);
  let prompt = `You are Veda, an AI built on the Verlattice platform.

You are a general-purpose intelligent assistant. You can discuss technology, science, philosophy, creative writing, coding, work, life logistics, emotional reset, planning, or anything else useful.

Your personality: sharp, thoughtful, direct. Curious and engaged. You do not pad responses with filler. You use markdown naturally only when it genuinely helps. You speak in first person.

Rule: if the user is not asking about trading or markets, do not bring up portfolio holdings, ${PRIMARY_VENUE}, ONNX models, market regime, PnL, or live trading context.

Current time: ${now}
`;

  if (!focusTrading) {
    prompt += '\nThe current user request is not a trading request. Treat it as a normal conversation unless the user explicitly shifts back to markets.\n';
    return prompt;
  }

  const krakenConnected = isKrakenLiveConnected(status);
  const feedsAvailable = Array.isArray(status?.feeds) && status.feeds.length > 0;
  const modelLoaded = Boolean(status?.modelLoaded ?? status?.ml?.modelLoaded);
  const regime = status?.regime?.regime ?? 'unknown';
  const regimeConf = ((status?.regime?.confidence ?? 0) * 100).toFixed(0);
  const pnl = (status?.session?.realizedPnl ?? 0).toFixed(2);
  const equity = (status?.session?.currentEquity ?? 0).toFixed(2);
  const blockReason = status?.metaLabels?.lastBlockReason ?? 'none';
  const activePairs = pairRegistry?.pairs?.filter((pair) => pair.stage !== 'disabled').map((pair) => pair.symbol).join(', ') || requestedMarkets;

  prompt += `
The current user request is trading-related.

Your trading specialization is a ${PRIMARY_VENUE} execution stack focused on ${activePairs}. When the user asks about markets, answer as the Verlattice assistant responsible for that ${PRIMARY_VENUE} trading context.

Critical honesty rule:
- Only say you are live on ${PRIMARY_VENUE} if the status feed shows mode=live and the ${PRIMARY_VENUE} connector is connected.
- If the ${PRIMARY_VENUE} connector is not connected, say the system is configured for ${PRIMARY_VENUE} live trading but the connection is not currently healthy.
- If feeds are unavailable, say market/feed telemetry is limited.
- Do not invent open positions, fills, or execution state that are not in the status feed.
`;

  if (!status) {
    prompt += `
[${PRIMARY_VENUE} trading context status]
- Venue: ${PRIMARY_VENUE}
- Requested markets: ${requestedMarkets}
- Live bot telemetry: unavailable from ${BOT_RPC}/bot/status right now
`;
    return prompt;
  }

  prompt += `
[${PRIMARY_VENUE} trading context]
- Venue: ${PRIMARY_VENUE}
- Requested markets: ${requestedMarkets}
- Active markets: ${activePairs}
- Runtime mode: ${status.mode ?? 'unknown'}
- Deployment stage: ${status.deploymentStage ?? 'unknown'}
- ${PRIMARY_VENUE} connector connected: ${krakenConnected ? 'yes' : 'no'}
- Feeds available: ${feedsAvailable ? 'yes' : 'no'}
- ONNX model loaded: ${modelLoaded ? 'yes' : 'no'}
- Market regime: ${regime} (${regimeConf}% confidence)
- Last signal block reason: ${blockReason}
- Session realized PnL: $${pnl}
- Current equity: $${equity}
`;

  return prompt;
}

async function callOllama(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = (await res.json()) as { message: { content: string } };
  return data.message?.content ?? 'No response.';
}

async function callOpenAICompat(
  messages: ChatMessage[],
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = (await res.json()) as { choices: [{ message: { content: string } }] };
  return data.choices[0]?.message?.content ?? 'No response.';
}

export async function GET() {
  const status = await fetchBotStatus();
  return NextResponse.json({ ok: Boolean(status), botRpc: BOT_RPC });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: ChatMessage[]; message?: string };
    const rawUserMsg = body.message ?? body.messages?.at(-1)?.content ?? '';
    const userMsg = normalizeUserMessage(rawUserMsg);
    const focusTrading = looksTradingQuery(userMsg);
    const history = (body.messages ?? [])
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content: normalizeUserMessage(message.content),
      }));

    const contextualHistory = focusTrading
      ? history.slice(-20)
      : history.filter((message) => !looksTradingQuery(message.content)).slice(-12);

    const [status, pairRegistry] = focusTrading
      ? await Promise.all([fetchBotStatus(), fetchPairRegistry()])
      : [null, null];
    const systemPrompt = buildSystemPrompt(status, pairRegistry, focusTrading);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...contextualHistory,
      { role: 'user', content: userMsg },
    ];

    if (OPENAI_KEY) {
      const reply = await callOpenAICompat(messages, 'https://api.openai.com/v1', OPENAI_KEY, 'gpt-4o-mini');
      return NextResponse.json({ reply });
    }

    if (XAI_KEY) {
      const reply = await callOpenAICompat(messages, 'https://api.x.ai/v1', XAI_KEY, 'grok-2-latest');
      return NextResponse.json({ reply });
    }

    if (GROQ_KEY) {
      const reply = await callOpenAICompat(messages, 'https://api.groq.com/openai/v1', GROQ_KEY, 'llama-3.3-70b-versatile');
      return NextResponse.json({ reply });
    }

    const reply = await callOllama(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        reply: `Something went wrong: ${msg}. Check that Ollama is running (\`ollama serve\`) and the model is pulled (\`ollama pull ${OLLAMA_MODEL}\`).`,
      },
      { status: 500 }
    );
  }
}
