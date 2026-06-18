'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Activity, ExternalLink } from 'lucide-react';
import { VNX_DOMAINS, VNX_TESTNET_TOPIC, fetchTopicMessages, computeTps } from '@/lib/hcs-client';

interface DomainStats {
  id: string;
  messageCount: number;
  lastType?: string;
  lastSeq?: number;
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'from-emerald-500/10 border-emerald-500/20',
  amber: 'from-amber-500/10 border-amber-500/20',
  violet: 'from-violet-500/10 border-violet-500/20',
  sky: 'from-sky-500/10 border-sky-500/20',
  cyan: 'from-cyan-500/10 border-cyan-500/20',
};

export default function DomainsPage() {
  const [stats, setStats] = useState<DomainStats[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [tps, setTps] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const msgs = await fetchTopicMessages(VNX_TESTNET_TOPIC, 'testnet', 100);
        setTotalMessages(msgs[0]?.sequenceNumber ?? 0);
        setTps(computeTps(msgs));

        const domainCounts: Record<string, { count: number; lastType?: string; lastSeq?: number }> = {};
        for (const d of VNX_DOMAINS) domainCounts[d.id] = { count: 0 };

        for (const msg of msgs) {
          const id = msg.domain || 'unknown';
          if (!domainCounts[id]) domainCounts[id] = { count: 0 };
          domainCounts[id].count++;
          if (!domainCounts[id].lastSeq || msg.sequenceNumber > domainCounts[id].lastSeq!) {
            domainCounts[id].lastType = msg.type;
            domainCounts[id].lastSeq = msg.sequenceNumber;
          }
        }

        setStats(
          VNX_DOMAINS.map((d) => ({
            id: d.id,
            messageCount: domainCounts[d.id]?.count || 0,
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
            <p className="text-[10px] text-white/40">Per-domain stats from live testnet topic</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white/80">Dashboard</Link>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <div className="text-[10px] uppercase text-white/40">Topic</div>
            <div className="font-mono text-sm">{VNX_TESTNET_TOPIC}</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <div className="text-[10px] uppercase text-white/40">Messages (sample)</div>
            <div className="text-xl font-semibold">{totalMessages}</div>
          </div>
          <div className="rounded-lg border border-veda-accent/20 bg-veda-accent/5 p-3">
            <div className="text-[10px] uppercase text-white/40">Est. TPS</div>
            <div className="text-xl font-semibold text-veda-accent">{tps.toFixed(2)}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VNX_DOMAINS.map((domain) => {
            const s = stats.find((x) => x.id === domain.id);
            const gradient = COLOR_MAP[domain.color] || 'from-white/5 border-white/10';
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
                    <span className="text-white/40">Messages (last 100)</span>
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

                <div className="mt-3 flex flex-wrap gap-1">
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