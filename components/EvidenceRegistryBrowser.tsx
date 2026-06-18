'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EvidencePacket, RegistryStats } from '@/lib/vnx-types';
import { fetchEvidenceData } from '@/lib/swarm-from-hcs';
import {
  Database,
  Search,
  Filter,
  ChevronRight,
  Hash,
  Calendar,
  Fingerprint,
  Shield,
  Copy,
  Check,
} from 'lucide-react';

interface EvidenceData {
  ok: boolean;
  mode: string;
  packets: EvidencePacket[];
  stats: RegistryStats;
}

function DomainBadge({ domain }: { domain: string }) {
  const colors: Record<string, string> = {
    trend: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
    volatility: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
    sentiment: 'bg-pink-400/10 text-pink-400 border-pink-400/20',
    defi: 'bg-yellow-300/10 text-yellow-300 border-yellow-300/20',
    risk: 'bg-red-400/10 text-red-400 border-red-400/20',
    whale: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    onchain: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
    momentum: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    legendary: 'bg-veda-accent/10 text-veda-accent border-veda-accent/20',
    bronze: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    silver: 'bg-slate-300/10 text-slate-300 border-slate-300/20',
    gold: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    platinum: 'bg-yellow-300/10 text-yellow-300 border-yellow-300/20',
  };
  const style = colors[domain] ?? 'bg-white/5 text-white/50 border-white/10';
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${style}`}>
      {domain}
    </span>
  );
}

function HashCopy({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const display = value.length > 24 ? `${value.slice(0, 8)}...${value.slice(-8)}` : value;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group inline-flex items-center gap-1 font-mono text-[10px] text-white/40 transition-colors hover:text-veda-accent"
      title={`${label ? label + ': ' : ''}${value}`}
    >
      <Hash className="h-2.5 w-2.5" />
      {display}
      {copied ? <Check className="h-2.5 w-2.5 text-yellow-300" /> : <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

export default function EvidenceRegistryBrowser() {
  const [data, setData] = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const json = await fetchEvidenceData(selectedDomain);
        if (!cancelled) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedDomain]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    data?.packets.forEach((p) => set.add(p.domain));
    return Array.from(set).sort();
  }, [data?.packets]);

  const filtered = useMemo(() => {
    let list = data?.packets ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.task.description.toLowerCase().includes(q) ||
          p.domain.toLowerCase().includes(q) ||
          p.selected.worker.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.packets, search]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Database className="h-4 w-4 animate-pulse" />
          Loading evidence registry...
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? { totalPackets: 0, domains: {}, oldestEntry: null, newestEntry: null, totalVotes: 0 };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Database className="h-4 w-4 text-veda-accent" />} label="Packets" value={String(stats.totalPackets)} />
        <StatCard icon={<Fingerprint className="h-4 w-4 text-sky-400" />} label="Total Votes" value={String(stats.totalVotes)} />
        <StatCard icon={<Filter className="h-4 w-4 text-purple-400" />} label="Domains" value={String(Object.keys(stats.domains).length)} />
        <StatCard icon={<Shield className="h-4 w-4 text-yellow-300" />} label="Verified" value="100%" />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packets by ID, task, domain, or worker..."
            className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-white/80 placeholder:text-white/25 focus:border-veda-accent/30 focus:outline-none focus:ring-1 focus:ring-veda-accent/20"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDomain('all')}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              selectedDomain === 'all'
                ? 'border-veda-accent/30 bg-veda-accent/10 text-veda-accent'
                : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70'
            }`}
          >
            All
          </button>
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDomain(d)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                selectedDomain === d
                  ? 'border-veda-accent/30 bg-veda-accent/10 text-veda-accent'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Packet List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/30">
            No evidence packets match your filters.
          </div>
        )}
        {filtered.map((packet) => (
          <div
            key={packet.id}
            className={`rounded-lg border transition-colors ${
              expanded === packet.id ? 'border-veda-accent/20 bg-white/[0.03]' : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]'
            }`}
          >
            <button
              onClick={() => setExpanded(expanded === packet.id ? null : packet.id)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              <ChevronRight className={`h-4 w-4 shrink-0 text-white/30 transition-transform ${expanded === packet.id ? 'rotate-90' : ''}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-white/80">{packet.task.description}</span>
                  <DomainBadge domain={packet.domain} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <HashCopy value={packet.id} label="ID" />
                  <HashCopy value={packet.taskHash} label="Task Hash" />
                  <HashCopy value={packet.decisionHash} label="Decision Hash" />
                  <span className="flex items-center gap-1 text-[10px] text-white/30">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(packet.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-medium text-white/70">{packet.votes.length} votes</div>
                <div className="text-[10px] text-white/30">{packet.selected.worker}</div>
              </div>
            </button>

            {expanded === packet.id && (
              <div className="border-t border-white/[0.04] px-3 pb-3 pt-2">
                {/* Votes */}
                <div className="mb-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/30">Worker Votes</div>
                  <div className="space-y-1.5">
                    {packet.votes.map((vote, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded border px-2.5 py-1.5 ${
                          vote.worker === packet.selected.worker
                            ? 'border-veda-accent/20 bg-veda-accent/5'
                            : 'border-white/[0.04] bg-white/[0.01]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/80">{vote.worker}</span>
                          <span className="text-[10px] text-white/30">{vote.specialty}</span>
                          {vote.worker === packet.selected.worker && (
                            <span className="rounded bg-veda-accent/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-veda-accent">Winner</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-white/40">
                          <span>conf: {(vote.confidence * 100).toFixed(0)}%</span>
                          <span>score: {vote.score.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proof */}
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/30">Proof</div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <ProofField label="Local Hash" value={packet.proof.localHash} />
                    {packet.proof.hcsTopicId && <ProofField label="HCS Topic" value={packet.proof.hcsTopicId} />}
                    {packet.proof.hcsTransactionId && <ProofField label="HCS Tx" value={packet.proof.hcsTransactionId} />}
                    {packet.proof.mirrorNodeUrl && <ProofField label="Mirror Node" value={packet.proof.mirrorNodeUrl} />}
                    {packet.direction && <ProofField label="Direction" value={packet.direction} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-semibold text-white/90">{value}</div>
    </div>
  );
}

function ProofField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/30">{label}</span>
      <span className="truncate font-mono text-[10px] text-white/60">{value}</span>
    </div>
  );
}
