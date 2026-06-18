'use client';

import { useEffect, useState } from 'react';
import type { AgentStatus, PredictionRecord, SwarmStats } from '@/lib/vnx-types';
import { fetchSwarmData } from '@/lib/swarm-from-hcs';
import {
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Users,
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Circle,
} from 'lucide-react';

interface SwarmData {
  ok: boolean;
  mode: string;
  stats: SwarmStats;
  predictions: PredictionRecord[];
  agents: AgentStatus[];
  timestamp: number;
}

function StatusIcon({ status }: { status: AgentStatus['status'] }) {
  if (status === 'online') return <CheckCircle2 className="h-3.5 w-3.5 text-yellow-300" />;
  if (status === 'busy') return <Activity className="h-3.5 w-3.5 text-amber-400" />;
  if (status === 'degraded') return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
  return <XCircle className="h-3.5 w-3.5 text-red-400" />;
}

function StatusBadge({ status }: { status: AgentStatus['status'] }) {
  const styles = {
    online: 'bg-yellow-300/10 text-yellow-300 border-yellow-300/20',
    busy: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    degraded: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    offline: 'bg-red-400/10 text-red-400 border-red-400/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}>
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

function PredictionRow({ p }: { p: PredictionRecord }) {
  return (
    <tr className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
      <td className="px-3 py-2 text-xs font-mono text-white/60">#{p.id}</td>
      <td className="px-3 py-2 text-xs text-white/80">{p.specialty}</td>
      <td className="px-3 py-2">
        {p.direction === 'up' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-300">
            <ArrowUp className="h-3 w-3" /> up
          </span>
        ) : p.direction === 'down' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
            <ArrowDown className="h-3 w-3" /> down
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-white/50">
            <Minus className="h-3 w-3" /> hold
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-white/60">{(p.confidence * 100).toFixed(0)}%</td>
      <td className="px-3 py-2 text-xs">
        {p.resolved ? (
          p.hit ? (
            <span className="text-yellow-300">hit</span>
          ) : (
            <span className="text-red-400">miss</span>
          )
        ) : (
          <span className="text-white/40">pending</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-white/50">{p.score.toFixed(1)}</td>
    </tr>
  );
}

export default function SwarmStatusView() {
  const [data, setData] = useState<SwarmData | null>(null);
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Activity className="h-4 w-4 animate-pulse" />
          Loading swarm status...
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? { total: 0, resolved: 0, hits: 0, accuracy: 'N/A' };
  const agents = data?.agents ?? [];
  const predictions = data?.predictions ?? [];

  const onlineCount = agents.filter((a) => a.status === 'online').length;
  const busyCount = agents.filter((a) => a.status === 'busy').length;
  const offlineCount = agents.filter((a) => a.status === 'offline').length;

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Target className="h-4 w-4 text-veda-accent" />} label="Total Tasks" value={String(stats.total)} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-yellow-300" />} label="Resolved" value={String(stats.resolved)} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-veda-accent" />} label="Accuracy" value={stats.accuracy} />
        <StatCard icon={<Users className="h-4 w-4 text-sky-400" />} label="Agents Online" value={`${onlineCount}/${agents.length}`} />
      </div>

      {/* Agent Status Grid */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <Users className="h-4 w-4 text-veda-accent" />
            Agent Swarm
          </h3>
          <div className="flex gap-3 text-[10px] text-white/40">
            <span className="flex items-center gap-1"><Circle className="h-2 w-2 fill-yellow-300 text-yellow-300" /> {onlineCount} online</span>
            <span className="flex items-center gap-1"><Circle className="h-2 w-2 fill-amber-400 text-amber-400" /> {busyCount} busy</span>
            <span className="flex items-center gap-1"><Circle className="h-2 w-2 fill-red-400 text-red-400" /> {offlineCount} offline</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-md border border-white/[0.04] bg-white/[0.02] p-2.5 transition-colors hover:border-white/[0.08]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-white/90">{agent.name}</div>
                  <div className="text-[10px] text-white/40">{agent.specialty}</div>
                </div>
                <StatusBadge status={agent.status} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-white/50">
                <div><span className="text-white/30">Tasks:</span> {agent.tasksCompleted}</div>
                <div><span className="text-white/30">Acc:</span> {(agent.accuracy * 100).toFixed(0)}%</div>
                <div><span className="text-white/30">HBAR:</span> {agent.hbarEarned.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Predictions */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
          <TrendingUp className="h-4 w-4 text-veda-accent" />
          Recent Predictions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/30">
                <th className="px-3 py-1.5">ID</th>
                <th className="px-3 py-1.5">Worker</th>
                <th className="px-3 py-1.5">Dir</th>
                <th className="px-3 py-1.5">Conf</th>
                <th className="px-3 py-1.5">Result</th>
                <th className="px-3 py-1.5">Score</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <PredictionRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
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
