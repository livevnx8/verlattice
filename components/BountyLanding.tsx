'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, ExternalLink, Radio, RefreshCw, Shield, Layers,
  Cpu, Coins, GitBranch, CheckCircle, Hexagon, Zap, Database,
} from 'lucide-react';
import {
  fetchTopicFeed, formatTps, hashscanTopicUrl,
  type DecodedVnxMessage,
} from '@/lib/hcs-client';

const TESTNET_TOPIC = '0.0.9227346';
const HASHSCAN_TOPIC = `https://hashscan.io/testnet/topic/${TESTNET_TOPIC}`;

const DOMAINS = [
  { id: 'wv-carbon',          name: 'WV Carbon Credit',        color: 'emerald', type: 'vnx.wv.energy.verified.carbon.retired', desc: 'EIA energy data → verified tCO₂e retirement on-chain' },
  { id: 'supply-chain',       name: 'Supply Chain Provenance', color: 'amber',   type: 'vnx.sc.provenance.attested',           desc: 'Tamper-evident provenance claims for physical goods' },
  { id: 'ai-inference',       name: 'AI Inference Attestation',color: 'violet',  type: 'vnx.ai.inference.attested',            desc: 'Model + prompt + output hashes anchored on HCS' },
  { id: 'rwa-claim',          name: 'RWA Asset Claim',         color: 'sky',     type: 'vnx.rwa.claim.verified',              desc: 'Tokenised real-world asset custody verification' },
  { id: 'water-biodiversity', name: 'Water / Biodiversity',    color: 'cyan',    type: 'vnx.water.credit.retired',            desc: 'USGS flow + species delta → credit retirement' },
];

const REPOS = [
  { name: 'hedera-vnx-paid-swarm',               label: 'Core swarm + pipeline primitives',         url: 'https://github.com/livevnx8/hedera-vnx-paid-swarm' },
  { name: 'hedera-vnx-ai-inference-attestation', label: 'AI Inference Attestation domain swarm',    url: 'https://github.com/livevnx8/hedera-vnx-ai-inference-attestation' },
  { name: 'hedera-vnx-rwa-claim',                label: 'RWA Claim Verification domain swarm',      url: 'https://github.com/livevnx8/hedera-vnx-rwa-claim' },
  { name: 'hedera-vnx-water-biodiversity',       label: 'Water / Biodiversity Credits domain swarm',url: 'https://github.com/livevnx8/hedera-vnx-water-biodiversity' },
  { name: 'verlattice',                          label: 'Live dashboard (this app)',                 url: 'https://github.com/livevnx8/verlattice' },
];

const AGENT_KIT_ITEMS = [
  {
    icon: <Database className="h-4 w-4 text-yellow-300" />,
    title: 'Hedera Consensus Service (HCS)',
    body: 'Every swarm decision is anchored on HCS. Each domain has a dedicated topic branch under root topic 0.0.9227346. Messages carry energyDataHash + decisionHash + previousStageHash for full cryptographic traceability across 3 pipeline stages.',
  },
  {
    icon: <Coins className="h-4 w-4 text-yellow-300" />,
    title: 'HBAR Micropayments (Hedera Payments MCP)',
    body: 'Each BitLattice worker agent is paid in HBAR per task via CryptoTransfer. The winning agent collects 0.004–0.012 HBAR per verification. Payments are logged in the receipt and are verifiable on HashScan.',
  },
  {
    icon: <Cpu className="h-4 w-4 text-yellow-300" />,
    title: 'VNX Topic Oracle + Creator Agents',
    body: 'The Topic Oracle agent resolves HCS topic IDs by scanning the main branch for VnxTopicCreatedRecord messages. The Topic Creator agent votes and executes TopicCreateTransaction on-demand, growing the topic tree as new domains launch.',
  },
  {
    icon: <Shield className="h-4 w-4 text-yellow-300" />,
    title: 'Hiero Double-Verification',
    body: 'After every task receipt, HieroVerifyVnxAgent runs a second cryptographic check against the Hedera mirror node, confirming the receipt hash chain is consistent with what was anchored on-chain.',
  },
];

const DOMAIN_COLOR: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  amber:   'border-amber-500/30   bg-amber-500/10   text-amber-300',
  violet:  'border-violet-500/30  bg-violet-500/10  text-violet-300',
  sky:     'border-sky-500/30     bg-sky-500/10     text-sky-300',
  cyan:    'border-cyan-500/30    bg-cyan-500/10    text-cyan-300',
};
const DOMAIN_CARD: Record<string, string> = {
  emerald: 'border-emerald-500/20 from-emerald-500/10',
  amber:   'border-amber-500/20   from-amber-500/10',
  violet:  'border-violet-500/20  from-violet-500/10',
  sky:     'border-sky-500/20     from-sky-500/10',
  cyan:    'border-cyan-500/20    from-cyan-500/10',
};

export default function BountyLanding() {
  const [msgs, setMsgs] = useState<DecodedVnxMessage[]>([]);
  const [maxSeq, setMaxSeq] = useState<number>(0);
  const [tps, setTps] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState('');

  const fetchFeed = useCallback(async () => {
    try {
      const feed = await fetchTopicFeed(TESTNET_TOPIC, 'testnet', 100);
      setMsgs(feed.messages);
      setMaxSeq(feed.maxSequence);
      setTps(feed.estimatedTps);
      setLastFetched(new Date().toLocaleTimeString());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, 8000);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const domainCounts = DOMAINS.reduce<Record<string, number>>((acc, d) => { acc[d.id] = 0; return acc; }, {});
  for (const m of msgs) if (m.domain && domainCounts[m.domain] !== undefined) domainCounts[m.domain]++;

  return (
    <div className="space-y-6 pb-12">

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-veda-accent/20 bg-gradient-to-br from-veda-accent/10 via-black/40 to-black/60 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(252,238,10,0.06),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Hexagon className="h-5 w-5 text-veda-accent" />
              <span className="text-xs font-semibold uppercase tracking-widest text-veda-accent">VNX BitLattice</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Hedera-Native Multi-Agent Verification Swarm
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Domain-agnostic BitLattice workers vote on verification tasks, pay each other in HBAR, and anchor tamper-evident receipts on Hedera Consensus Service — across 5 real-world domains.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={HASHSCAN_TOPIC} target="_blank" rel="noopener"
                className="flex items-center gap-1.5 rounded-full border border-veda-accent/30 bg-veda-accent/10 px-3 py-1.5 text-xs font-medium text-veda-accent hover:bg-veda-accent/20 transition-colors">
                <Radio className="h-3 w-3 animate-pulse" /> Live Testnet Topic {TESTNET_TOPIC} <ExternalLink className="h-3 w-3" />
              </a>
              <Link href="/dashboard"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors">
                <Activity className="h-3 w-3" /> Live Dashboard
              </Link>
              <Link href="/domains"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors">
                <Layers className="h-3 w-3" /> All Domains
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <div className="rounded-lg border border-veda-accent/20 bg-black/40 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-veda-accent">{maxSeq > 0 ? maxSeq.toLocaleString() : '—'}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">On-chain messages</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-center">
              <div className="text-lg font-semibold text-white/90">{formatTps(tps)}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">Live TPS</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Live HCS Feed ────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-black/30">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/60">
            <Radio className="h-3.5 w-3.5 text-green-400 animate-pulse" />
            Live HCS Feed — Topic {TESTNET_TOPIC}
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && <span className="text-[10px] text-white/30">Updated {lastFetched}</span>}
            <button onClick={fetchFeed} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] hover:bg-white/5">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <a href={HASHSCAN_TOPIC} target="_blank" rel="noopener"
              className="flex items-center gap-1 rounded border border-veda-accent/20 bg-veda-accent/10 px-2 py-1 text-[10px] text-veda-accent hover:bg-veda-accent/20">
              HashScan <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
        {loading && msgs.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/30">Connecting to Hedera mirror node...</div>
        ) : msgs.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/30">No messages yet — swarm may be starting up</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {msgs.map((msg) => {
              const d = DOMAINS.find((x) => x.id === msg.domain);
              const colorClass = d ? DOMAIN_COLOR[d.color] : 'border-white/10 bg-white/5 text-white/40';
              const seqUrl = hashscanTopicUrl(TESTNET_TOPIC, msg.sequenceNumber);
              const ts = parseFloat(msg.consensusTimestamp);
              const timeStr = ts ? new Date(ts * 1000).toLocaleTimeString() : '';
              return (
                <div key={msg.sequenceNumber} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                  <span className="mt-0.5 w-14 shrink-0 font-mono text-[10px] text-white/25">#{msg.sequenceNumber}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {d?.name ?? msg.domain}
                      </span>
                      {msg.stage && <span className="text-[10px] text-white/30">{msg.stage}</span>}
                      <span className="font-mono text-[10px] text-white/40 truncate">{msg.type}</span>
                      {msg.verified != null && (
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${msg.verified ? 'text-green-400' : 'text-red-400'}`}>
                          <CheckCircle className="h-2.5 w-2.5" />
                          {msg.verified ? 'verified' : 'unverified'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/25">
                      {timeStr && <span>{timeStr}</span>}
                      {msg.batchId && <span className="font-mono truncate max-w-[160px]">{msg.batchId}</span>}
                      {msg.energyDataHash && (
                        <Link href={`/receipts/${msg.energyDataHash}`} prefetch={false} className="font-mono text-veda-accent/60 hover:text-veda-accent hover:underline truncate max-w-[140px]">
                          {msg.energyDataHash.slice(0, 16)}…
                        </Link>
                      )}
                    </div>
                  </div>
                  <a href={seqUrl} target="_blank" rel="noopener"
                    className="shrink-0 flex items-center gap-1 rounded border border-veda-accent/20 bg-veda-accent/5 px-2 py-1 text-[9px] text-veda-accent hover:bg-veda-accent/15 transition-colors">
                    HashScan <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── How it uses Hedera Agent Kit ─────────────────────── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
          <Zap className="h-4 w-4 text-veda-accent" /> How VNX Uses the Hedera Stack
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {AGENT_KIT_ITEMS.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                {item.icon}
                <span className="text-sm font-semibold text-white/90">{item.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-white/50">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Why VNX is Useful ────────────────────────────────── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
          <Shield className="h-4 w-4 text-veda-accent" /> Why VNX is Useful
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: 'Trust-minimized verification', body: 'No single point of authority. 3–5 specialist BitLattice agents vote and the winner is selected deterministically. The receipt is verifiable by anyone on HashScan.' },
            { title: 'Domain-agnostic', body: 'Same core pipeline works across carbon credits, AI inference, RWA tokenisation, water credits, and supply chain provenance — any claim that can be hashed can be verified.' },
            { title: 'Fully on-chain audit trail', body: 'Every task carries energyDataHash → decisionHash → previousStageHash, forming a cryptographic chain across 3 pipeline stages anchored on Hedera HCS.' },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm font-semibold text-white/90">{c.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-white/50">{c.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Domain Cards with live counts ───────────────────── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
          <Layers className="h-4 w-4 text-veda-accent" /> Active Domains (live from testnet)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map((d) => (
            <div key={d.id} className={`rounded-xl border bg-gradient-to-br to-transparent p-4 ${DOMAIN_CARD[d.color]}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${DOMAIN_COLOR[d.color]}`}>{d.name}</span>
                  <p className="mt-2 text-xs text-white/50">{d.desc}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between text-white/40">
                  <span>Messages (last 20)</span>
                  <span className="font-semibold text-white/80">{domainCounts[d.id] ?? 0}</span>
                </div>
                <div className="font-mono text-[9px] text-white/25 truncate">{d.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Pipeline Architecture ────────────────────────────── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
          <GitBranch className="h-4 w-4 text-veda-accent" /> 3-Stage Pipeline Architecture
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {[
              { stage: '1', label: 'Verification', color: 'border-blue-500/30 bg-blue-500/10 text-blue-300', desc: 'BitLattice workers score the data batch. Winner selected by deterministic consensus. Payment issued.' },
              { stage: '2', label: 'Orchestration', color: 'border-purple-500/30 bg-purple-500/10 text-purple-300', desc: 'Domain orchestrator aggregates verified batches. Checks Topic Oracle for correct HCS topic branch.' },
              { stage: '3', label: 'Retirement',   color: 'border-green-500/30  bg-green-500/10  text-green-300',  desc: 'Final typed HCS message published. Receipt carries full hash chain. Verifiable forever on HashScan.' },
            ].map((s, i) => (
              <div key={s.stage} className="flex items-start gap-3 sm:flex-1">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${s.color}`}>
                  {s.stage}
                </div>
                <div>
                  <div className={`rounded border px-2 py-0.5 text-[10px] font-semibold w-fit ${s.color}`}>{s.label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">{s.desc}</p>
                </div>
                {i < 2 && <span className="hidden shrink-0 text-white/20 sm:block self-center text-lg">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-black/40 px-4 py-2.5 text-[11px] font-mono text-white/40">
            energyDataHash → decisionHash → previousStageHash &nbsp;|&nbsp; root topic: <a href={HASHSCAN_TOPIC} target="_blank" rel="noopener" className="text-veda-accent hover:underline">{TESTNET_TOPIC} ↗</a>
          </div>
        </div>
      </div>

      {/* ─── Public GitHub Repos ─────────────────────────────── */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
          <GitBranch className="h-4 w-4 text-veda-accent" /> Public GitHub Repositories
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-black/30 divide-y divide-white/[0.04]">
          {REPOS.map((r) => (
            <a key={r.name} href={r.url} target="_blank" rel="noopener"
              className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group">
              <div>
                <div className="font-mono text-xs text-white/80 group-hover:text-white">{r.name}</div>
                <div className="text-[11px] text-white/35">{r.label}</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/20 group-hover:text-veda-accent" />
            </a>
          ))}
        </div>
      </div>

      {/* ─── Bounty Checklist ─────────────────────────────────── */}
      <div className="rounded-xl border border-veda-accent/20 bg-veda-accent/5 p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-veda-accent">
          <CheckCircle className="h-4 w-4" /> Hedera AI Agent Bounty — Submission Checklist
        </div>
        <div className="space-y-2">
          {[
            { label: 'Uses Hedera Consensus Service (HCS)',       note: `Topic ${TESTNET_TOPIC} — ${maxSeq > 0 ? maxSeq.toLocaleString() + ' messages' : 'live'}` },
            { label: 'Uses HBAR micropayments (Payments MCP)',    note: '0.004–0.012 HBAR per verified task, paid to worker accounts' },
            { label: 'Public GitHub repositories',                note: 'github.com/livevnx8 — 5 repos with full git history' },
            { label: 'Public demo (live, 90-day uptime)',         note: 'verlattice-vnx.netlify.app — this app' },
            { label: 'Hedera Agent Kit feedback issue filed',     note: 'HCS topic oracle, multi-stage pipeline types, domain scaffold' },
            { label: 'Running on Hedera testnet',                 note: `${maxSeq > 0 ? maxSeq.toLocaleString() + ' live on-chain messages' : 'active'}` },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
              <div>
                <span className="text-xs font-medium text-white/80">{item.label}</span>
                <span className="ml-2 text-[11px] text-white/35">{item.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
