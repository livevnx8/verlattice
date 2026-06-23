'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Activity, Radio, ExternalLink, RefreshCw, Shield, Zap, Database, ChevronDown, Clock } from 'lucide-react';
import TpsSparkline from '@/components/TpsSparkline';
import MirrorProofPanel from '@/components/MirrorProofPanel';
import {
  VNX_TESTNET_TOPIC,
  VNX_DOMAINS,
  fetchTopicFeed,
  fetchTpsHistory,
  formatTps,
  formatMirrorStatus,
  formatConsensusTime,
  formatAgeSec,
  loadHcsSnapshot,
  type DecodedVnxMessage,
  type MirrorHealth,
  type MirrorNodeStatus,
  type SwarmSync,
} from '@/lib/hcs-client';
import { STATUS_STYLES, domainBadgeClass, domainBarClass } from '@/lib/vnx-theme';

const FILTER_DOMAINS = [
  { id: 'all', label: 'All' },
  ...VNX_DOMAINS.map((d) => ({ id: d.id, label: d.name })),
  { id: 'core', label: 'Core' },
  { id: 'system', label: 'System' },
];

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export default function DashboardPage() {
  const [feed, setFeed] = useState<DecodedVnxMessage[]>([]);
  const [maxSeq, setMaxSeq] = useState(0);
  const [tps, setTps] = useState(0);
  const [peakTps, setPeakTps] = useState(0);
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollInterval, setPollInterval] = useState(10);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [mirrorSource, setMirrorSource] = useState<'vnx-mirror' | 'public-mirror' | null>(null);
  const [mirrorUrl, setMirrorUrl] = useState<string | null>(null);
  const [health, setHealth] = useState<MirrorHealth | null>(null);
  const [sync, setSync] = useState<SwarmSync | null>(null);
  const [domainFilter, setDomainFilter] = useState('all');
  const [domainCounts, setDomainCounts] = useState<Record<string, number>>({});
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);
  const [newCount, setNewCount] = useState(0);
  const prevMaxSeq = useRef(0);

  const fetchFeed = useCallback(async () => {
    try {
      const result = await fetchTopicFeed(VNX_TESTNET_TOPIC, 'testnet', 100, {
        domain: domainFilter,
      });
      setMirrorSource(result.mirrorSource);
      setMirrorUrl(result.mirrorUrl);
      setFeed(result.messages);
      const seq = result.maxSequence;
      if (prevMaxSeq.current > 0 && seq > prevMaxSeq.current) {
        setNewCount((c) => c + (seq - prevMaxSeq.current));
      }
      prevMaxSeq.current = seq;
      setMaxSeq(seq);
      setTps(result.estimatedTps);
      setPeakTps(result.peakTps ?? result.health?.peakTps ?? 0);
      setHealth(result.health ?? null);
      setSync(result.sync ?? null);
      setDomainCounts(result.domainCounts ?? result.health?.domainCounts ?? {});
      setFetchedAt(result.fetchedAt ?? new Date().toISOString());
      setStale(result.sync?.mode === 'idle-swarm');
      setError(null);

      if (result.mirrorSource === 'vnx-mirror') {
        const history = await fetchTpsHistory(30, result.mirrorUrl);
        if (history.length > 0) {
          setTpsHistory(history.map((h) => h.tps));
        } else {
          setTpsHistory((prev) => [...prev.slice(-29), result.estimatedTps]);
        }
      } else {
        setTpsHistory((prev) => [...prev.slice(-29), result.estimatedTps]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [domainFilter]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('domain');
    if (q) setDomainFilter(q);
  }, []);

  useEffect(() => {
    const basePath = process.env.NODE_ENV === 'production' ? '/verlattice' : '';
    loadHcsSnapshot(basePath).then((snapshot) => {
      if (!snapshot?.messages?.length) return;
      setFeed(snapshot.messages);
      setMaxSeq(snapshot.maxSequence);
      setTps(snapshot.estimatedTps);
      setPeakTps(snapshot.peakTps ?? snapshot.health?.peakTps ?? 0);
      setHealth(snapshot.health ?? null);
      setDomainCounts(snapshot.domainCounts ?? snapshot.health?.domainCounts ?? {});
      if (snapshot.mirrorSource) setMirrorSource(snapshot.mirrorSource);
      if (snapshot.mirrorUrl) setMirrorUrl(snapshot.mirrorUrl);
      prevMaxSeq.current = snapshot.maxSequence;
      setStale(true);
      setLoading(false);
    });
    fetchFeed();
    const id = setInterval(fetchFeed, pollInterval * 1000);
    return () => clearInterval(id);
  }, [fetchFeed, pollInterval]);

  const domainTotal = useMemo(
    () => Object.values(domainCounts).reduce((a, b) => a + b, 0),
    [domainCounts],
  );

  const sortedDomains = useMemo(
    () => Object.entries(domainCounts).sort((a, b) => b[1] - a[1]),
    [domainCounts],
  );

  return (
    <div className="min-h-screen overflow-y-auto bg-veda-bg text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-veda-accent" />
          <div>
            <h1 className="text-sm font-semibold">VNX Live Dashboard</h1>
            <p className="text-[10px] text-white/40">
              Topic {VNX_TESTNET_TOPIC} · testnet
              {mirrorSource === 'vnx-mirror' && (
                <span className="text-veda-accent"> · VNX Mirror v{health?.version ?? '1.1'}</span>
              )}
              {mirrorSource === 'public-mirror' && <span> · Public Mirror</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {health && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[health.status as MirrorNodeStatus]}`}
            >
              {formatMirrorStatus(health.status)}
            </span>
          )}
          {newCount > 0 && mirrorSource === 'vnx-mirror' && (
            <span className="rounded-full border border-veda-accent/30 bg-veda-accent/10 px-2 py-0.5 text-[10px] text-veda-accent">
              +{newCount} new
            </span>
          )}
          <Link href="/domains" className="text-xs text-white/50 hover:text-white/80">Domains</Link>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">Home</Link>
          <button
            onClick={() => { setNewCount(0); fetchFeed(); }}
            className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Max Sequence" value={maxSeq.toLocaleString()} icon={<Database className="h-3.5 w-3.5" />} />
          <StatCard label="Loaded" value={feed.length.toString()} />
          <StatCard label="Live TPS" value={formatTps(tps)} highlight icon={<Zap className="h-3.5 w-3.5" />} />
          <StatCard label="Peak TPS" value={peakTps > 0 ? formatTps(peakTps) : '—'} />
          {health && mirrorSource === 'vnx-mirror' && (
            <StatCard label="Blocks Indexed" value={health.blockCount.toLocaleString()} icon={<Shield className="h-3.5 w-3.5" />} />
          )}
          <StatCard
            label="Source"
            value={mirrorSource === 'vnx-mirror' ? 'VNX' : 'Public'}
            sub={
              <a
                href={mirrorUrl ? `${mirrorUrl}/api/v1/health` : `https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 text-[10px] text-veda-accent hover:underline"
              >
                {mirrorSource === 'vnx-mirror' ? 'Node health' : 'HashScan'}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            }
          />
        </div>

        {sync && mirrorSource === 'vnx-mirror' && (
          <MirrorProofPanel sync={sync} mirrorUrl={mirrorUrl} />
        )}

        {sync?.mode === 'idle-swarm' && (
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs text-sky-200/80">
            <strong className="text-sky-300">Indexed feed, not live stream.</strong>{' '}
            The mirror is synced with chain head #{sync.upstreamHeadSequence.toLocaleString()} but the
            swarm is not publishing new messages
            {sync.lastUpstreamMessageAgeSec != null && (
              <> (last on-chain message {formatAgeSec(sync.lastUpstreamMessageAgeSec)})</>
            )}
            . Start burst traffic to see live ingest:{' '}
            <code className="text-white/60">npm run live:testnet:burst800</code> in hedera-vnx-paid-swarm.
          </div>
        )}

        {mirrorSource === 'vnx-mirror' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-veda-accent/15 bg-veda-accent/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-white/40">TPS trend</div>
                <span className="font-mono text-xs text-veda-accent">{formatTps(tps)}</span>
              </div>
              <div className="mt-2">
                <TpsSparkline samples={tpsHistory} width={280} height={40} />
              </div>
            </div>
            {health && (
              <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-white/40">Mirror node</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <div className="flex items-center gap-1.5 text-white/40">
                    <Clock className="h-3 w-3" /> Uptime
                  </div>
                  <div className="text-white/70">{formatUptime(health.uptimeSec)}</div>
                  <div className="text-white/40">Upstream latency</div>
                  <div className="text-white/70">
                    {health.upstreamLatencyMs != null ? `${health.upstreamLatencyMs}ms` : '—'}
                  </div>
                  <div className="text-white/40">Indexed messages</div>
                  <div className="text-white/70">{health.messageCount.toLocaleString()}</div>
                  <div className="text-white/40">Poll lag</div>
                  <div className="text-white/70">{health.pollLagSec.toFixed(1)}s</div>
                </div>
              </div>
            )}
          </div>
        )}

        {domainTotal > 0 && mirrorSource === 'vnx-mirror' && (
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-white/40">Indexed by domain</div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
              {sortedDomains.map(([domain, count]) => (
                <div
                  key={domain}
                  title={`${domain}: ${count}`}
                  className={`h-full bar-fill first:rounded-l-full last:rounded-r-full ${domainBarClass(domain)}`}
                  style={{ '--bar-pct': `${(count / domainTotal) * 100}%` } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sortedDomains.slice(0, 8).map(([domain, count]) => (
                <button
                  key={domain}
                  onClick={() => setDomainFilter(domain)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    domainFilter === domain
                      ? 'border-veda-accent/40 bg-veda-accent/10 text-veda-accent'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {domain} <span className="text-white/60">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Radio className="h-3 w-3 text-green-400 animate-pulse" />
            Poll {pollInterval}s
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
            {fetchedAt && <span>· {new Date(fetchedAt).toLocaleTimeString()}</span>}
            {stale && !error && sync?.mode === 'idle-swarm' && (
              <span className="text-sky-400/80">· indexed (swarm idle)</span>
            )}
            {sync?.mode === 'live-ingest' && (
              <span className="text-green-400/80">· live ingest</span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap gap-1">
            {FILTER_DOMAINS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDomainFilter(d.id)}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                  domainFilter === d.id
                    ? 'border-veda-accent/40 bg-veda-accent/10 text-veda-accent'
                    : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/30">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
            <span className="text-xs uppercase tracking-widest text-white/40">
              {sync?.mode === 'live-ingest' ? 'Live HCS Feed' : 'Indexed HCS Feed'}
            </span>
            {sync && (
              <span className="text-[10px] text-white/30">
                head #{sync.upstreamHeadSequence.toLocaleString()}
                {sync.lastUpstreamMessageAgeSec != null && (
                  <> · last msg {formatAgeSec(sync.lastUpstreamMessageAgeSec)}</>
                )}
              </span>
            )}
            {domainFilter !== 'all' && (
              <span className="text-[10px] text-white/30">filtered: {domainFilter}</span>
            )}
          </div>

          {loading && feed.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/30">
              <p>Connecting to VNX mirror node…</p>
              <p className="mt-2 text-xs text-white/20">Pre-decoded HIP · block proofs · domain index</p>
            </div>
          ) : error && feed.length === 0 ? (
            <div className="p-8 text-center text-sm text-red-400 space-y-2">
              <p>{error}</p>
              <p className="text-xs text-white/40">
                Ensure both services are running:
              </p>
              <p className="text-xs text-white/50 font-mono">
                cd hedera-vnx-paid-swarm && npm run mirror:start
              </p>
              <p className="text-xs text-white/50 font-mono">
                cd verlattice && npm run dev
              </p>
              <p className="text-xs text-white/30">
                Open <span className="text-veda-accent">http://localhost:3900/dashboard/</span> (note trailing slash)
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {feed.map((msg) => {
                const expanded = expandedSeq === msg.sequenceNumber;
                return (
                  <div key={msg.sequenceNumber} className="hover:bg-white/[0.02]">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 w-14 shrink-0 font-mono text-[10px] text-white/30">
                        #{msg.sequenceNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${domainBadgeClass(msg.domain)}`}>
                            {msg.domain}
                          </span>
                          {msg.stage && <span className="text-[10px] text-white/30">{msg.stage}</span>}
                          <span className="truncate font-mono text-[10px] text-white/50">{msg.type}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/30">
                          <span>{formatConsensusTime(msg.consensusTimestamp)}</span>
                          {msg.blockNumber != null && (
                            <span className="text-veda-accent/70" title={msg.blockHash}>
                              block #{msg.blockNumber}
                            </span>
                          )}
                          {msg.batchId && <span>batch: {msg.batchId.slice(0, 20)}</span>}
                          {msg.energyDataHash && (
                            <Link href={`/receipts/${msg.energyDataHash}`} prefetch={false} className="text-veda-accent/70 hover:underline">
                              {msg.energyDataHash.slice(0, 12)}…
                            </Link>
                          )}
                          {msg.verified != null && (
                            <span className={msg.verified ? 'text-green-400' : 'text-red-400'}>
                              {msg.verified ? 'verified' : 'unverified'}
                            </span>
                          )}
                        </div>
                        {expanded && (
                          <pre className="mt-2 max-h-40 overflow-auto rounded border border-white/[0.06] bg-black/40 p-2 font-mono text-[9px] text-white/50">
                            {JSON.stringify(msg.raw, null, 2)}
                          </pre>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedSeq(expanded ? null : msg.sequenceNumber)}
                        className="shrink-0 rounded p-1 text-white/20 hover:bg-white/5 hover:text-white/60"
                        aria-label={expanded ? 'Collapse' : 'Expand payload'}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <a
                        href={`https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}?sequenceNumber=${msg.sequenceNumber}`}
                        target="_blank"
                        rel="noopener"
                        aria-label={`View #${msg.sequenceNumber} on HashScan`}
                        className="shrink-0 text-white/20 hover:text-white/60"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
              {feed.length === 0 && (
                <div className="p-8 text-center text-sm text-white/30">
                  No messages for filter &ldquo;{domainFilter}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-veda-accent/20 bg-veda-accent/5' : 'border-white/[0.06] bg-black/30'}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/40">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold sm:text-xl ${highlight ? 'text-veda-accent' : 'text-white/90'}`}>
        {value}
      </div>
      {sub}
    </div>
  );
}