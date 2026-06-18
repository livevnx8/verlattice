'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Activity, ExternalLink, Zap, Shield } from 'lucide-react';
import {
  VNX_DOMAINS,
  VNX_TESTNET_TOPIC,
  fetchTopicFeed,
  formatTps,
  formatMirrorStatus,
} from '@/lib/hcs-client';
import { DOMAIN_CARD_GRADIENT, STATUS_STYLES } from '@/lib/vnx-theme';
import type { MirrorNodeStatus } from '@/lib/hcs-client';

interface DomainStats {
  id: string;
  messageCount: number;
  lastType?: string;
  lastSeq?: number;
}

export default function DomainsPage() {
  const [stats, setStats] = useState<DomainStats[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [indexedTotal, setIndexedTotal] = useState(0);
  const [tps, setTps] = useState(0);
  const [peakTps, setPeakTps] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [mirrorLabel, setMirrorLabel] = useState<string | null>(null);
  const [mirrorStatus, setMirrorStatus] = useState<MirrorNodeStatus | null>(null);
  const [mirrorSource, setMirrorSource] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const feed = await fetchTopicFeed(VNX_TESTNET_TOPIC, 'testnet', 100);
        const msgs = feed.messages;
        setTotalMessages(feed.maxSequence);
        setTps(feed.estimatedTps);
        setPeakTps(feed.peakTps ?? feed.health?.peakTps ?? 0);
        setMirrorSource(feed.mirrorSource);
        if (feed.health) {
          setMirrorLabel(formatMirrorStatus(feed.health.status));
          setMirrorStatus(feed.health.status);
          setBlockCount(feed.health.blockCount);
          setIndexedTotal(feed.health.messageCount);
        } else {
          setMirrorLabel(feed.mirrorSource === 'vnx-mirror' ? 'VNX Mirror' : 'Public');
        }

        const indexed = feed.domainCounts ?? feed.health?.domainCounts ?? {};
        const domainCounts: Record<string, { count: number; lastType?: string; lastSeq?: number }> = {};
        for (const d of VNX_DOMAINS) {
          domainCounts[d.id] = { count: indexed[d.id] ?? 0 };
        }

        for (const msg of msgs) {
          const id = msg.domain || 'unknown';
          if (!domainCounts[id]) domainCounts[id] = { count: indexed[id] ?? 0 };
          if (!domainCounts[id].lastSeq || msg.sequenceNumber > domainCounts[id].lastSeq!) {
            domainCounts[id].lastType = msg.type;
            domainCounts[id].lastSeq = msg.sequenceNumber;
          }
        }

        setStats(
          VNX_DOMAINS.map((d) => ({
            id: d.id,
            messageCount: domainCounts[d.id]?.count || indexed[d.id] || 0,
            lastType: domainCounts[d.id]?.lastType,
            lastSeq: domainCounts[d.id]?.lastSeq,
          })),
        );
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-veda-bg text-white">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-veda-accent" />
          <div>
            <h1 className="text-sm font-semibold">VNX Domains</h1>
            <p className="text-[10px] text-white/40">
              Per-domain stats · {mirrorLabel ?? 'loading…'}
              {mirrorSource === 'vnx-mirror' && ' · VNX Mirror'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mirrorStatus && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[mirrorStatus]}`}>
              {mirrorLabel}
            </span>
          )}
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white/80">Dashboard</Link>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <div className="text-[10px] uppercase text-white/40">Topic</div>
            <div className="font-mono text-sm">{VNX_TESTNET_TOPIC}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <div className="text-[10px] uppercase text-white/40">Max sequence</div>
            <div className="text-xl font-semibold">{totalMessages.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-veda-accent/20 bg-veda-accent/5 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase text-white/40">
              <Zap className="h-3 w-3" /> Live TPS
            </div>
            <div className="text-xl font-semibold text-veda-accent">{formatTps(tps)}</div>
            {peakTps > 0 && (
              <div className="text-[10px] text-white/30">peak {formatTps(peakTps)}</div>
            )}
          </div>
          {mirrorSource === 'vnx-mirror' && (
            <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase text-white/40">
                <Shield className="h-3 w-3" /> Indexed
              </div>
              <div className="text-xl font-semibold">{indexedTotal.toLocaleString()}</div>
              {blockCount > 0 && (
                <div className="text-[10px] text-white/30">{blockCount} blocks</div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VNX_DOMAINS.map((domain) => {
            const s = stats.find((x) => x.id === domain.id);
            const gradient = DOMAIN_CARD_GRADIENT[domain.color] || 'from-white/5 border-white/10';
            return (
              <div
                key={domain.id}
                className={`rounded-lg border bg-gradient-to-br to-transparent p-4 ${gradient}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-white/90">{domain.name}</h2>
                    <p className="mt-1 text-xs text-white/40">{domain.description}</p>
                  </div>
                  <Activity className="h-4 w-4 text-white/20" />
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">
                      {mirrorSource === 'vnx-mirror' ? 'Indexed' : 'Messages (sample)'}
                    </span>
                    <span className="font-semibold">{s?.messageCount ?? '—'}</span>
                  </div>
                  {s?.lastType && (
                    <div className="font-mono text-[10px] text-white/50 truncate">{s.lastType}</div>
                  )}
                  {s?.lastSeq && (
                    <a
                      href={`https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}/${s.lastSeq}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-[10px] text-veda-accent/70 hover:underline"
                    >
                      Latest seq #{s.lastSeq} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard?domain=${domain.id}`}
                    className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-white/50 hover:border-veda-accent/30 hover:text-veda-accent"
                  >
                    View feed →
                  </Link>
                  {domain.hcsTypes.map((t) => (
                    <span key={t} className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[9px] text-white/30">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}