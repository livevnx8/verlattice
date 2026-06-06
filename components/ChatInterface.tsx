'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
type VedaMode = 'companion' | 'markets' | 'builder';

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
};

type Starter = {
  label: string;
  prompt: string;
  mode: VedaMode;
};

type ModeConfig = {
  id: VedaMode;
  label: string;
  eyebrow: string;
  description: string;
};

type PairEntry = {
  symbol: string;
  stage: string;
  strategy: string;
  health?: string;
  haltReason?: string | null;
  openOrders?: number;
};

type AgentCard = {
  role?: string;
  summary?: string;
};

type VedaStatusPayload = {
  mode?: string;
  deploymentStage?: string;
  venueCompliance?: { venue?: string; region?: string };
  agents?: {
    veda?: AgentCard;
    jade?: AgentCard;
    starlit?: AgentCard;
  };
  pairRegistry?: {
    pairs?: PairEntry[];
  };
};

type NamedAgentCard = [label: string, agent: AgentCard | undefined];

type PairRegistryPayload = {
  requestedPairs?: string[];
  pairs?: PairEntry[];
};

const STORAGE_KEY = 'verlattice-veda-thread-v4';

const MODES: ModeConfig[] = [
  {
    id: 'companion',
    label: 'Open chat',
    eyebrow: 'Everyday Veda',
    description: 'Writing, planning, life admin, work decisions, and straight answers without trading tunnel vision.',
  },
  {
    id: 'markets',
    label: 'Markets',
    eyebrow: 'Trading focus',
    description: 'Pulse checks, setups, risk framing, post-trade review, and sharper market context.',
  },
  {
    id: 'builder',
    label: 'Builder',
    eyebrow: 'Code and systems',
    description: 'Product ideas, UI feedback, code review, prompts, and execution planning.',
  },
];

const STARTERS: Starter[] = [
  {
    label: 'Morning pulse',
    prompt: 'Give me a compact market pulse for today with one thing to avoid overtrading.',
    mode: 'markets',
  },
  {
    label: 'Calm reset',
    prompt: 'I had a rough day. Help me reset my head and plan the rest of tonight.',
    mode: 'companion',
  },
  {
    label: 'Work text',
    prompt: 'Write a short professional message I can send from work to say I will handle this later tonight.',
    mode: 'companion',
  },
  {
    label: 'Build critique',
    prompt: 'Critique this mobile trading chat product idea and tell me where the UX still feels weak.',
    mode: 'builder',
  },
  {
    label: 'Explain fast',
    prompt: 'Explain gamma squeeze risk in plain English with one concrete example.',
    mode: 'markets',
  },
  {
    label: 'Plan for me',
    prompt: 'Make me a simple plan for the rest of today with focus blocks, breaks, and one recovery habit.',
    mode: 'companion',
  },
];

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Veda is live. Ask about markets, code, planning, writing, work, or whatever else matters. Jade tracks state, Starlit shapes trading reasoning, and I stay useful whether the topic is trading or not.',
    createdAt: Date.now(),
  },
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildRequestPrefix(mode: VedaMode): string {
  if (mode === 'markets') {
    return 'You are Veda. Answer as a sharp, concise trading assistant. Give direct market context, risk framing, and practical next steps. If the user shifts away from trading, still answer naturally.\n\nUser request:\n';
  }

  if (mode === 'builder') {
    return 'You are Veda. Answer as a product-minded technical partner. Be concrete, critical, and useful about code, UX, systems, planning, and execution.\n\nUser request:\n';
  }

  return 'You are Veda. You can discuss trading, markets, code, writing, planning, and everyday questions. If the topic is not trading, answer naturally without forcing it back to markets.\n\nUser request:\n';
}

function VedaPortrait({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 320"
      className={compact ? 'h-10 w-10 shrink-0' : 'h-44 w-44 shrink-0 sm:h-52 sm:w-52'}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="veda-shell" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#101826" />
          <stop offset="100%" stopColor="#050816" />
        </linearGradient>
        <linearGradient id="veda-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <linearGradient id="veda-hair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>

      <circle cx="160" cy="160" r="146" fill="url(#veda-shell)" />
      <circle cx="160" cy="160" r="132" fill="none" stroke="rgba(103,232,249,0.28)" strokeWidth="2" />
      <path d="M74 208c18-33 47-48 85-48 42 0 73 18 92 54" fill="none" stroke="rgba(103,232,249,0.18)" strokeWidth="10" strokeLinecap="round" />
      <path d="M126 55c17-11 36-17 57-17 29 0 55 11 76 32" fill="none" stroke="url(#veda-ring)" strokeWidth="7" strokeLinecap="round" />
      <path d="M98 137c0-48 30-87 84-87 46 0 76 27 76 72 0 43-25 86-50 109l-14 13h-55c-21-17-41-43-41-80v-27Z" fill="url(#veda-hair)" />
      <path d="M117 112c15-26 37-39 66-39 19 0 37 7 55 22" fill="none" stroke="#7c2d12" strokeWidth="9" strokeLinecap="round" opacity="0.24" />
      <path d="M119 137c0-36 23-71 61-71 27 0 52 23 52 59 0 23-9 52-29 77l-8 10h-54c-15-15-22-40-22-75Z" fill="#f6d4be" />
      <path d="M170 104c18 3 31 12 38 25" fill="none" stroke="#7c2d12" strokeWidth="6" strokeLinecap="round" />
      <path d="M131 129c7-10 18-15 33-16" fill="none" stroke="#7c2d12" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="156" cy="145" rx="11" ry="8" fill="#ffffff" />
      <ellipse cx="198" cy="149" rx="10" ry="8" fill="#ffffff" />
      <ellipse cx="158" cy="146" rx="5" ry="5" fill="#0f172a" />
      <ellipse cx="197" cy="150" rx="5" ry="5" fill="#0f172a" />
      <path d="M172 182c10 5 22 4 30-2" fill="none" stroke="#be5b41" strokeWidth="6" strokeLinecap="round" />
      <path d="M213 110c14 11 22 27 25 49 7-19 10-37 10-51 0-29-10-52-33-70l-2 72Z" fill="#f59e0b" opacity="0.76" />
      <path d="M105 108c16-19 33-28 52-28l-12 60c-11 1-22 5-34 13-3-15-5-30-6-45Z" fill="#fdba74" opacity="0.96" />
      <path d="M228 91c8 5 15 12 21 20" fill="none" stroke="#67e8f9" strokeWidth="6" strokeLinecap="round" />
      <circle cx="252" cy="86" r="10" fill="#22d3ee" opacity="0.82" />
      <circle cx="84" cy="102" r="7" fill="#fdba74" opacity="0.9" />
    </svg>
  );
}

function MessageBody({ content }: { content: string }) {
  return <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100/92">{content}</div>;
}

function stageBadge(stage: string): string {
  switch (stage) {
    case 'live_scaled':
      return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-100';
    case 'live_capped':
      return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100';
    case 'shadow':
      return 'border-violet-300/30 bg-violet-300/10 text-violet-100';
    case 'halted':
      return 'border-rose-300/30 bg-rose-400/10 text-rose-100';
    default:
      return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
  }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'checking' | 'live' | 'degraded'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<VedaMode>('companion');
  const [showRail, setShowRail] = useState(false);
  const [vedaStatus, setVedaStatus] = useState<VedaStatusPayload | null>(null);
  const [pairRegistry, setPairRegistry] = useState<PairEntry[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      try {
        const [statusResponse, pairResponse] = await Promise.all([
          fetch('/api/veda/status', { cache: 'no-store' }),
          fetch('/api/veda/pairs', { cache: 'no-store' }),
        ]);

        const statusPayload = statusResponse.ok ? ((await statusResponse.json()) as VedaStatusPayload) : null;
        const pairPayload = pairResponse.ok ? ((await pairResponse.json()) as PairRegistryPayload) : null;

        if (!cancelled) {
          setVedaStatus(statusPayload);
          setPairRegistry(pairPayload?.pairs ?? statusPayload?.pairRegistry?.pairs ?? []);
          setStatus(statusResponse.ok ? 'live' : 'degraded');
        }
      } catch {
        if (!cancelled) {
          setStatus('degraded');
        }
      }
    }

    void loadRuntime();
    const timer = window.setInterval(() => {
      void loadRuntime();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const selectedModeConfig = useMemo(
    () => MODES.find((mode) => mode.id === selectedMode) ?? MODES[0],
    [selectedMode]
  );

  const quickSummary = useMemo(() => {
    const count = messages.length;
    const userTurns = messages.filter((message) => message.role === 'user').length;
    const trackedPairs = pairRegistry.length;
    return `${count} messages, ${userTurns} prompts, ${trackedPairs || 0} tracked pairs`;
  }, [messages, pairRegistry]);

  const activeMarkets = useMemo(
    () => pairRegistry.map((pair) => pair.symbol).join(', ') || 'Awaiting trader registry',
    [pairRegistry]
  );

  async function sendMessage(rawInput: string, modeOverride?: VedaMode) {
    const content = rawInput.trim();
    if (!content || sending) {
      return;
    }

    const mode = modeOverride ?? selectedMode;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setSending(true);
    setError(null);
    setSelectedMode(mode);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${buildRequestPrefix(mode)}${content}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with ${response.status}`);
      }

      const payload = (await response.json()) as { reply?: string };
      const reply = payload.reply?.trim() || 'I could not produce a response for that.';

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: 'assistant',
          content: reply,
          createdAt: Date.now(),
        },
      ]);
      setStatus('live');
    } catch {
      setStatus('degraded');
      setError('Veda did not return a response. The UI is live, but the model backend needs attention.');
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  function resetThread() {
    setMessages(DEFAULT_MESSAGES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MESSAGES));
    setError(null);
  }

  return (
    <div
      className="min-h-screen bg-[#040815] text-slate-100"
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 12%, rgba(34,211,238,0.14), transparent 24%), radial-gradient(circle at 85% 10%, rgba(249,115,22,0.15), transparent 22%), linear-gradient(180deg, #040815 0%, #070d18 52%, #040815 100%)',
      }}
    >
      {showRail ? (
        <button
          type="button"
          aria-label="Close Veda rail"
          className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setShowRail(false)}
        />
      ) : null}

      <div className="mx-auto flex min-h-screen w-full max-w-[1700px] gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:gap-6 lg:px-6 lg:py-6">
        <aside
          className={[
            'fixed inset-y-3 left-3 z-30 w-[310px] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,26,0.95),rgba(7,10,18,0.92))] shadow-[0_30px_90px_rgba(2,8,23,0.55)] backdrop-blur-2xl transition-transform lg:static lg:inset-auto lg:z-auto lg:h-[calc(100vh-3rem)] lg:w-[340px] lg:translate-x-0',
            showRail ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0',
          ].join(' ')}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-white/8 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">Verlattice</p>
                  <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-white">Veda</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Grok-like structure, our own taste, and a real trader/operator rail behind the chat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRail(false)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 lg:hidden"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(17,24,39,0.72))] p-5 shadow-[0_28px_80px_rgba(2,8,23,0.42)]">
                <div className="flex flex-col items-center gap-4 text-center">
                  <VedaPortrait />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-200/70">Kunoichi profile</div>
                    <div className="mt-2 text-xl font-semibold text-white">Beautiful, sharp, original</div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      Anime-inspired Veda portrait with warmer highlights, cleaner contrast, and a more personal identity for chat.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/8 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/80">Trader link</div>
                    <div className="mt-2 text-lg font-medium text-white">
                      {status === 'live' ? 'Kraken US Spot online' : status === 'checking' ? 'Checking trader service' : 'Trader backend degraded'}
                    </div>
                  </div>
                  <span
                    className={[
                      'inline-flex h-3.5 w-3.5 rounded-full',
                      status === 'live'
                        ? 'bg-yellow-300 shadow-[0_0_18px_rgba(252,238,10,0.85)]'
                        : status === 'checking'
                          ? 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.8)]'
                          : 'bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.8)]',
                    ].join(' ')}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{quickSummary}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Venue</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {vedaStatus?.venueCompliance?.venue || 'Kraken'} {vedaStatus?.venueCompliance?.region || 'US'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mode / stage</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {(vedaStatus?.mode || 'paper').toUpperCase()} / {(vedaStatus?.deploymentStage || 'paper').replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-400">{activeMarkets}</p>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/18 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Agents</div>
                <div className="mt-3 space-y-3">
                  {([
                    ['Veda', vedaStatus?.agents?.veda],
                    ['Jade', vedaStatus?.agents?.jade],
                    ['Starlit', vedaStatus?.agents?.starlit],
                  ] satisfies NamedAgentCard[]).map(([label, agent]) => (
                    <div key={label} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{agent?.role || 'waiting'}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{agent?.summary || 'No live agent summary yet.'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Modes</div>
                <div className="mt-3 space-y-3">
                  {MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSelectedMode(mode.id)}
                      className={[
                        'w-full rounded-[24px] border px-4 py-4 text-left transition',
                        selectedMode === mode.id
                          ? 'border-cyan-300/30 bg-[linear-gradient(180deg,rgba(8,47,73,0.72),rgba(15,118,110,0.26))]'
                          : 'border-white/8 bg-white/5 hover:border-white/14 hover:bg-white/8',
                      ].join(' ')}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/70">{mode.eyebrow}</div>
                      <div className="mt-2 text-base font-semibold text-white">{mode.label}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{mode.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/18 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Starter deck</div>
                <div className="mt-3 space-y-2">
                  {STARTERS.slice(0, 4).map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => void sendMessage(starter.prompt, starter.mode)}
                      className="w-full rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/8"
                    >
                      <div className="text-sm font-medium text-white">{starter.label}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{starter.mode}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/18 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Pair board</div>
                <div className="mt-3 space-y-3">
                  {pairRegistry.length > 0 ? pairRegistry.map((pair) => (
                    <div key={pair.symbol} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{pair.symbol}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{pair.strategy.replace(/_/g, ' ')}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${stageBadge(pair.stage)}`}>
                          {pair.stage}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/8 px-2 py-1">Health: {pair.health || 'unknown'}</span>
                        <span className="rounded-full border border-white/8 px-2 py-1">Open orders: {pair.openOrders ?? 0}</span>
                      </div>
                      {pair.haltReason ? <p className="mt-3 text-xs leading-5 text-rose-200">{pair.haltReason}</p> : null}
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm text-slate-300">
                      Pair registry is waiting on the trader service.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,24,0.92),rgba(7,10,18,0.84))] shadow-[0_40px_100px_rgba(2,8,23,0.45)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.14),transparent_60%)] pointer-events-none" />

          <header className="relative border-b border-white/8 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRail(true)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 lg:hidden"
                  >
                    Veda
                  </button>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                    {selectedModeConfig.eyebrow}
                  </span>
                  <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-100/80">
                    Kraken US Spot
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-[34px]">
                  Better mobile chat, broader than trading, still sharp when markets matter.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  This version keeps the assistant feel closer to Grok, but with warmer contrast, deeper panels, and a stronger Veda identity.
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <a
                  href="/dashboard"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-veda-accent/40 hover:bg-veda-accent/10 hover:text-veda-accent"
                >
                  Dashboard
                </a>
                <button
                  type="button"
                  onClick={resetThread}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-orange-300/40 hover:bg-orange-300/10"
                >
                  New chat
                </button>
              </div>
            </div>
          </header>

          <div className="border-b border-white/8 px-4 py-3 sm:px-6">
            <div className="mb-3 grid gap-3 lg:grid-cols-[1.4fr,1fr]">
              <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Live markets</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{activeMarkets}</p>
              </div>
              <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Agents</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">Veda front, Jade state, Starlit reasoning.</p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  onClick={() => void sendMessage(starter.prompt, starter.mode)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={transcriptRef} className="relative flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={[
                  'flex w-full',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                ].join(' ')}
              >
                <div
                  className={[
                    'w-full rounded-[30px] border px-4 py-4 shadow-[0_18px_48px_rgba(2,8,23,0.2)] sm:px-5',
                    message.role === 'assistant'
                      ? 'max-w-[920px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.70))]'
                      : 'max-w-[760px] border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.94),rgba(15,118,110,0.58))]',
                  ].join(' ')}
                >
                  <div className="mb-3 flex items-center gap-3">
                    {message.role === 'assistant' ? (
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                        <VedaPortrait compact />
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-white">
                        You
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">{message.role === 'assistant' ? 'Veda' : 'You'}</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{formatTime(message.createdAt)}</div>
                    </div>
                  </div>

                  <MessageBody content={message.content} />
                </div>
              </div>
            ))}

            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.68))] px-5 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:240ms]" />
                    <span className="ml-2">Veda is thinking</span>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/8 bg-black/12 px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={[
                    'rounded-full border px-3 py-2 text-sm transition',
                    selectedMode === mode.id
                      ? 'border-cyan-300/30 bg-cyan-300/10 text-white'
                      : 'border-white/10 bg-white/6 text-slate-300 hover:border-white/20 hover:bg-white/10',
                  ].join(' ')}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="rounded-[30px] border border-white/10 bg-white/6 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Veda about trading, work, code, plans, writing, or anything else useful."
                  className="min-h-[118px] w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-7 text-white outline-none placeholder:text-slate-500"
                />
                <div className="flex items-center justify-between gap-3 border-t border-white/8 px-2 pt-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{selectedModeConfig.eyebrow}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{selectedModeConfig.description}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="rounded-full bg-[linear-gradient(135deg,#67e8f9,#fb923c)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
