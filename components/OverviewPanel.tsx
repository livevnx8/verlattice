'use client';

import { useEffect, useState } from 'react';
import type { AgentStatus, PredictionRecord, SwarmStats } from '@/lib/vnx-types';
import { fetchSwarmData } from '@/lib/swarm-from-hcs';
import {
  Activity,
  TrendingUp,
  Users,
  Target,
  Clock,
  Zap,
  Shield,
  Hexagon,
  Radio,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import NetworkTopology from './NetworkTopology';
import SparklineChart from './SparklineChart';

interface LiveData {
  ok: boolean;
  mode: 'live' | 'demo' | 'testnet-data';
  stats: SwarmStats;
  predictions: PredictionRecord[];
  agents: AgentStatus[];
  timestamp: number;
}

function buildSparklineFromPredictions(predictions: PredictionRecord[], key: 'confidence' | 'score'): number[] {
  const vals = predictions
    .slice(-15)
    .map((p) => (key === 'confidence' ? p.confidence : p.score));
  return vals.length > 1 ? vals : key === 'confidence'
    ? [0.6, 0.62, 0.65, 0.63, 0.67, 0.69, 0.68, 0.71, 0.73, 0.72, 0.74, 0.76, 0.75, 0.77, 0.76]
    : [5, 6, 7, 6, 8, 9, 8, 10, 11, 10, 12, 11, 13, 12, 14];
}

export default function OverviewPanel() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const json = await fetchSwarmData(100);
        if (!cancelled) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return <OverviewSkeleton />;
  }

  const stats = data?.stats ?? { total: 0, resolved: 0, hits: 0, accuracy: 'N/A' };
  const agents = data?.agents ?? [];
  const predictions = data?.predictions ?? [];
  const isLive = data?.mode === 'live';
  const isTestnetData = data?.mode === 'testnet-data';
  const dataAgeSec = data ? Math.floor((Date.now() - data.timestamp) / 1000) : 0;
  const isFresh = dataAgeSec < 15;

  const onlineCount = agents.filter((a) => a.status === 'online').length;
  const busyCount = agents.filter((a) => a.status === 'busy').length;
  const accuracyNum = parseFloat(stats.accuracy) || 0;

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-white/[0.01] px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className={`flex h-2.5 w-2.5 rounded-full ${isLive ? 'bg-yellow-300 animate-pulse' : isTestnetData ? 'bg-sky-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium text-white/70">
            {isLive ? 'Live Testnet' : isTestnetData ? 'Testnet Data' : 'Demo Mode'} — Swarm telemetry {isLive ? 'connected' : isTestnetData ? 'from recorded runs' : 'using synthetic data'}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isFresh ? 'bg-yellow-300/15 text-yellow-300' : dataAgeSec < 60 ? 'bg-sky-400/15 text-sky-400' : 'bg-amber-400/15 text-amber-400'}`}>
            {isFresh ? '● just now' : dataAgeSec < 60 ? `${dataAgeSec}s ago` : `${Math.floor(dataAgeSec / 60)}m ago`}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-white/30">
          <span className="flex items-center gap-1"><Hexagon className="h-3 w-3 text-veda-accent" /> Hedera</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-yellow-300" /> NVIDIA</span>
          <span className="flex items-center gap-1"><Radio className="h-3 w-3 text-sky-400" /> {agents.length} agents</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={<Target className="h-4 w-4 text-veda-accent" />}
          label="Total Decisions"
          value={String(stats.total)}
          sparkline={<SparklineChart data={buildSparklineFromPredictions(predictions, 'score')} width={90} height={36} trend="up" />}
        />
        <MetricCard
          icon={<CheckIcon />}
          label="Accuracy"
          value={stats.accuracy}
          sparkline={<SparklineChart data={buildSparklineFromPredictions(predictions, 'confidence').map(c => c * 100)} width={90} height={36} trend={accuracyNum >= 70 ? 'up' : 'neutral'} />}
        />
        <MetricCard
          icon={<Users className="h-4 w-4 text-sky-400" />}
          label="Agents Online"
          value={`${onlineCount}/${agents.length}`}
          sub={`${busyCount} busy`}
        />
        <MetricCard
          icon={<Shield className="h-4 w-4 text-yellow-300" />}
          label="Proofs Anchored"
          value={String(stats.resolved)}
          sub={`${stats.hits} verified hits`}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Network Topology */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <Radio className="h-4 w-4 text-veda-accent" />
            Live Agent Topology
          </h3>
          <NetworkTopology agents={agents} />
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Confidence Trend */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-white/60">Confidence Trend</span>
              <span className="text-[10px] text-white/30">Last 15 decisions</span>
            </div>
            <SparklineChart
              data={buildSparklineFromPredictions(predictions, 'confidence')}
              width={280}
              height={50}
              color="#fcee0a"
              fillColor="rgba(252,238,10,0.06)"
              trend="up"
            />
          </div>

          {/* Recent Predictions */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                <TrendingUp className="h-4 w-4 text-veda-accent" />
                Recent Predictions
                {predictions.filter((p) => !p.resolved).length > 0 && (
                  <span className="flex h-4 items-center rounded-full bg-amber-400/15 px-1.5 text-[9px] font-bold text-amber-400">
                    {predictions.filter((p) => !p.resolved).length} OPEN
                  </span>
                )}
              </div>
              <span className="text-[10px] text-white/20">{predictions.length} total</span>
            </div>
            <div className="relative">
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {predictions.slice(0, 10).map((p) => (
                  <PredictionRow key={p.id} p={p} />
                ))}
                {predictions.length === 0 && (
                  <div className="py-4 text-center text-xs text-white/20">No predictions yet</div>
                )}
              </div>
              {predictions.length > 5 && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#0a0a0f] to-transparent" />}
            </div>
          </div>

          {/* Network Stats */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/40">
              <span>Network Performance</span>
              <span className="text-[10px] normal-case text-white/20">from latest scale test</span>
            </div>
            <div className="space-y-2.5">
              <StatBar label="HCS Throughput" value={isTestnetData ? 483 : 550} max={1000} unit="TPS" color="bg-veda-accent" />
              <StatBar label="Avg Latency" value={isTestnetData ? 108 : 120} max={500} unit="ms" color="bg-sky-400" />
              <StatBar label="Packet Success" value={isTestnetData ? 99.95 : 99.9} max={100} unit="%" color="bg-yellow-300" />
              <StatBar label="Agent Uptime" value={onlineCount / Math.max(agents.length, 1) * 100} max={100} unit="%" color="bg-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Live Activity Stream */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <Clock className="h-4 w-4 text-veda-accent" />
            Activity Stream
          </h3>
          <div className="flex items-center gap-3 text-[10px] text-white/20">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {predictions.filter((p) => !p.resolved).length} open
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
              {predictions.filter((p) => p.resolved).length} resolved
            </span>
          </div>
        </div>
        <div className="relative">
          <div className="space-y-1.5">
            {predictions.slice(0, 8).map((p) => (
              <ActivityRow key={p.id} p={p} />
            ))}
            {predictions.length === 0 && (
              <div className="py-6 text-center text-xs text-white/20">No activity recorded</div>
            )}
          </div>
          {predictions.length > 6 && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#0a0a0f] to-transparent" />}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2.5 text-[10px] text-white/20">
        <span>VNX / BitLattice Dashboard</span>
        <span>Data from Hedera testnet · {data ? new Date(data.timestamp).toLocaleTimeString() : ''}</span>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sparkline, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sparkline?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/[0.10] hover:bg-white/[0.03]">
      <div className="mb-2 flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-semibold text-white/90">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-white/30">{sub}</div>}
      {sparkline && <div className="mt-2">{sparkline}</div>}
    </div>
  );
}

function formatRel(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function PredictionRow({ p }: { p: PredictionRecord }) {
  const time = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rel = formatRel(p.timestamp);
  const isPending = !p.resolved;
  return (
    <div className={`flex items-center justify-between rounded border px-2.5 py-1.5 transition-colors ${isPending ? 'border-amber-400/15 bg-amber-400/[0.03]' : 'border-white/[0.03] bg-white/[0.01]'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-mono text-white/20 shrink-0" title={time}>{rel}</span>
        <span className="text-xs text-white/60 truncate">{p.specialty}</span>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {p.direction === 'up' ? (
          <ArrowUp className="h-3 w-3 text-yellow-300" />
        ) : p.direction === 'down' ? (
          <ArrowDown className="h-3 w-3 text-red-400" />
        ) : null}
        <span className="text-[10px] text-white/40 w-8 text-right">{(p.confidence * 100).toFixed(0)}%</span>
        {p.resolved ? (
          p.hit ? (
            <span className="w-10 text-right text-[10px] font-medium text-yellow-300">hit</span>
          ) : (
            <span className="w-10 text-right text-[10px] font-medium text-red-400">miss</span>
          )
        ) : (
          <span className="flex w-10 items-center justify-end gap-1 text-[10px] font-medium text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            open
          </span>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ p }: { p: PredictionRecord }) {
  const time = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const rel = formatRel(p.timestamp);
  const isPending = !p.resolved;
  return (
    <div className={`flex items-center gap-3 rounded border px-3 py-2 ${isPending ? 'border-amber-400/10 bg-amber-400/[0.02]' : 'border-white/[0.02] bg-white/[0.01]'}`}>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isPending ? 'bg-amber-400/10' : 'bg-white/[0.03]'}`}>
        {p.direction === 'up' ? (
          <ArrowUp className={`h-3 w-3 ${isPending ? 'text-amber-400' : 'text-yellow-300'}`} />
        ) : (
          <ArrowDown className={`h-3 w-3 ${isPending ? 'text-amber-400' : 'text-red-400'}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">{p.specialty}</span>
          <span className="text-[10px] text-white/30">predicted {p.prediction}</span>
        </div>
        <div className="text-[10px] text-white/30">
          Score {p.score.toFixed(1)} · Conf {(p.confidence * 100).toFixed(0)}%
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] text-white/30" title={time}>{rel}</div>
        {p.resolved ? (
          p.hit ? (
            <span className="text-[10px] font-medium text-yellow-300/70">verified hit</span>
          ) : (
            <span className="text-[10px] font-medium text-red-400/70">miss</span>
          )
        ) : (
          <span className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-400">
            <span className="h-1 w-1 animate-pulse rounded-full bg-amber-400" />
            resolving
          </span>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-white/40">
        <span>{label}</span>
        <span>{value.toFixed(unit === '%' || unit === 'TPS' ? 0 : 1)} {unit}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000`}
          style={{ width: `${pct}%`, opacity: 0.7 }}
        />
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  const shimmer = 'animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03]';
  return (
    <div className="space-y-5">
      <div className={`h-10 rounded-lg ${shimmer}`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-24 rounded-xl ${shimmer}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className={`h-[400px] rounded-xl ${shimmer}`} />
        <div className="space-y-5">
          <div className={`h-32 rounded-xl ${shimmer}`} />
          <div className={`h-48 rounded-xl ${shimmer}`} />
          <div className={`h-40 rounded-xl ${shimmer}`} />
        </div>
      </div>
      <div className={`h-64 rounded-xl ${shimmer}`} />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-yellow-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
