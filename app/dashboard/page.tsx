'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Activity, Radio, ExternalLink, RefreshCw } from 'lucide-react';
import {
  VNX_TESTNET_TOPIC,
  fetchTopicFeed,
  formatTps,
  loadHcsSnapshot,
  mirrorBaseUrl,
  type DecodedVnxMessage,
} from '@/lib/hcs-client';

interface HcsFeedResponse {
  topicId: string;
  network: string;
  messageCount: number;
  maxSequence: number;
  estimatedTps: number;
  messages: Array<{
    sequenceNumber: number;
    consensusTimestamp: string;
    type: string;
    domain: string;
    stage?: string;
    batchId?: string;
    energyDataHash?: string;
    decisionHash?: string;
    verified?: boolean;
  }>;
  hashscanUrl: string;
  fetchedAt: string;
  error?: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  'wv-carbon': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'supply-chain': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'ai-inference': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'rwa-claim': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'water-biodiversity': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  system: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  core: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  unknown: 'bg-white/10 text-white/50 border-white/10',
};

export default function DashboardPage() {
  const [messages, setMessages] = useState<DecodedVnxMessage[]>([]);
  const [maxSeq, setMaxSeq] = useState(0);
  const [tps, setTps] = useState(0);
  const [feed, setFeed] = useState<HcsFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollInterval, setPollInterval] = useState(10);
  const [stale, setStale] = useState(false);

  const applyFeed = useCallback((
    msgs: DecodedVnxMessage[],
    estimatedTps: number,
    maxSequence: number,
    isStale = false,
  ) => {
    setMessages(msgs);
    setMaxSeq(maxSequence);
    setTps(estimatedTps);
    setStale(isStale);
    setFeed({
      topicId: VNX_TESTNET_TOPIC,
      network: 'testnet',
      messageCount: msgs.length,
      maxSequence,
      estimatedTps,
      messages: msgs as unknown as HcsFeedResponse['messages'],
      hashscanUrl: `https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}`,
      fetchedAt: new Date().toISOString(),
    });
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      const feed = await fetchTopicFeed(VNX_TESTNET_TOPIC, 'testnet', 100);
      applyFeed(feed.messages, feed.estimatedTps, feed.maxSequence);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch';
      setFeed((prev) => ({
        ...(prev ?? {}),
        error: message,
        topicId: VNX_TESTNET_TOPIC,
        hashscanUrl: `https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}`,
      } as HcsFeedResponse));
    } finally {
      setLoading(false);
    }
  }, [applyFeed]);

  useEffect(() => {
    const basePath = process.env.NODE_ENV === 'production' ? '/verlattice' : '';
    loadHcsSnapshot(basePath).then((snapshot) => {
      if (snapshot?.messages?.length) {
        applyFeed(snapshot.messages, snapshot.estimatedTps, snapshot.maxSequence, true);
        setLoading(false);
      }
    });
    fetchFeed();
    const id = setInterval(fetchFeed, pollInterval * 1000);
    return () => clearInterval(id);
  }, [fetchFeed, pollInterval, applyFeed]);

  return (
    <div className="min-h-screen bg-veda-bg text-white">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-veda-accent" />
          <div>
            <h1 className="text-sm font-semibold">VNX Live Dashboard</h1>
            <p className="text-[10px] text-white/40">Topic {VNX_TESTNET_TOPIC} · testnet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/domains" className="text-xs text-white/50 hover:text-white/80">Domains</Link>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">Home</Link>
          <button
            onClick={fetchFeed}
            className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Max Sequence" value={feed?.maxSequence?.toLocaleString() ?? '—'} />
          <StatCard label="Messages Loaded" value={feed?.messageCount?.toString() ?? '—'} />
          <StatCard
            label="Live TPS"
            value={feed?.estimatedTps != null ? formatTps(feed.estimatedTps) : '—'}
            highlight
          />
          <StatCard
            label="Network"
            value="Testnet"
            sub={
              feed?.hashscanUrl ? (
                <a href={feed.hashscanUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-[10px] text-veda-accent hover:underline">
                  HashScan <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : undefined
            }
          />
        </div>

        {/* Poll control */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Radio className="h-3 w-3 text-green-400 animate-pulse" />
          Polling every
          <select
            title="Poll interval"
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-white/70"
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
          {feed?.fetchedAt && <span>· Last: {new Date(feed.fetchedAt).toLocaleTimeString()}</span>}
          {stale && !feed?.error && (
            <span className="text-amber-400/80">· showing cached snapshot, refreshing…</span>
          )}
        </div>

        {/* Message feed */}
        <div className="rounded-lg border border-white/[0.06] bg-black/30">
          <div className="border-b border-white/[0.06] px-4 py-2 text-xs uppercase tracking-widest text-white/40">
            Live HCS Feed
          </div>
          {loading && !feed ? (
            <div className="p-8 text-center text-sm text-white/30">
              <p>Connecting to Hedera mirror node…</p>
              <p className="mt-2 text-xs text-white/20">Topic {VNX_TESTNET_TOPIC}</p>
            </div>
          ) : feed?.error && !feed?.messages?.length ? (
            <div className="p-8 text-center text-sm text-red-400 space-y-2">
              <p>{feed.error}</p>
              <p className="text-xs text-white/40">
                Check network access to{' '}
                <a
                  href={`${mirrorBaseUrl('testnet')}/api/v1/topics/${VNX_TESTNET_TOPIC}/messages?limit=5&order=desc`}
                  target="_blank"
                  rel="noopener"
                  className="text-veda-accent hover:underline"
                >
                  testnet mirror node
                </a>
                {' '}or try Refresh.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {feed?.messages?.map((msg) => (
                <div key={msg.sequenceNumber} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                  <span className="mt-0.5 font-mono text-[10px] text-white/30 w-12 shrink-0">
                    #{msg.sequenceNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${DOMAIN_COLORS[msg.domain] || DOMAIN_COLORS.unknown}`}>
                        {msg.domain}
                      </span>
                      {msg.stage && (
                        <span className="text-[10px] text-white/30">{msg.stage}</span>
                      )}
                      <span className="font-mono text-[10px] text-white/50 truncate">{msg.type}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/30">
                      {msg.batchId && <span>batch: {msg.batchId.slice(0, 24)}</span>}
                      {msg.energyDataHash && (
                        <Link href={`/receipts/${msg.energyDataHash}`} prefetch={false} className="text-veda-accent/70 hover:underline">
                          hash: {msg.energyDataHash.slice(0, 16)}...
                        </Link>
                      )}
                      {msg.verified != null && (
                        <span className={msg.verified ? 'text-green-400' : 'text-red-400'}>
                          {msg.verified ? 'verified' : 'unverified'}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}?sequenceNumber=${msg.sequenceNumber}`}
                    target="_blank"
                    rel="noopener"
                    aria-label={`View message #${msg.sequenceNumber} on HashScan`}
                    className="shrink-0 text-white/20 hover:text-white/60"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
              {feed?.messages?.length === 0 && (
                <div className="p-8 text-center text-sm text-white/30">No messages on topic yet</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-veda-accent/20 bg-veda-accent/5' : 'border-white/[0.06] bg-black/30'}`}>
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${highlight ? 'text-veda-accent' : 'text-white/90'}`}>{value}</div>
      {sub}
    </div>
  );
}