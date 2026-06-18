'use client';

import { useEffect, useState } from 'react';
import { fetchEconomyData } from '@/lib/swarm-from-hcs';
import {
  TrendingDown,
  TrendingUp,
  Flame,
  Coins,
  Zap,
  Activity,
  Trophy,
  Users,
  Share2,
  Wallet,
  ArrowUp,
  ArrowDown,
  Hexagon,
} from 'lucide-react';
import SparklineChart from './SparklineChart';

interface EconomyRow {
  time: string;
  cycles: number;
  hcs: number;
  minted: number;
  burned: number;
  burnMintRatio: number;
  trades: number;
  market: number;
  loans: number;
  bonds: number;
  insurance: number;
  supply: number;
  tps: number;
  hbarCost: number;
  deflationary: boolean;
}

interface AgentEntry {
  id: string;
  balance: number;
  reputation: number;
  tier: string;
  wins: number;
  streak: number;
  signalsSold: number;
  signalsBought: number;
}

interface EconomyData {
  ok: boolean;
  mode: string;
  summary: {
    totalCycles: number;
    totalHcsMessages: number;
    totalMinted: number;
    totalBurned: number;
    burnMintRatio: number;
    currentSupply: number;
    peakTps: number;
    totalTrades: number;
    hbarSpent: number;
    isDeflationary: boolean;
    initialSupply: number;
  };
  rows: EconomyRow[];
  agents: AgentEntry[];
  topics: Record<string, string>;
  wallets: Record<string, string>;
}

const TIER_STYLES: Record<string, string> = {
  legendary: 'bg-veda-accent/10 text-veda-accent border-veda-accent/20',
  platinum: 'bg-yellow-300/10 text-yellow-300 border-yellow-300/20',
  gold: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  silver: 'bg-slate-300/10 text-slate-300 border-slate-300/20',
  bronze: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
};

export default function AgentEconomy() {
  const [data, setData] = useState<EconomyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const json = await fetchEconomyData();
        if (!cancelled) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return <EconomySkeleton />;
  }

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const agents = data?.agents ?? [];
  const topics = data?.topics ?? {};

  const supplyHistory = rows.map((r) => r.supply);
  const burnHistory = rows.map((r) => r.burned);
  const mintHistory = rows.map((r) => r.minted);
  const tpsHistory = rows.map((r) => r.tps);
  const ratioHistory = rows.map((r) => r.burnMintRatio);

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <EcoCard
          icon={<Coins className="h-4 w-4 text-veda-accent" />}
          label="VX Supply"
          value={summary ? `${(summary.currentSupply / 1000000).toFixed(2)}M` : '—'}
          sub={summary ? `Burned ${(summary.totalBurned / 1000000).toFixed(1)}M` : ''}
          sparkline={supplyHistory.length > 1 ? <SparklineChart data={supplyHistory.map((s) => s / 1000000)} width={90} height={32} color="#fcee0a" fillColor="rgba(252,238,10,0.05)" /> : undefined}
        />
        <EcoCard
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          label="Burn/Mint Ratio"
          value={summary ? summary.burnMintRatio.toFixed(2) : '—'}
          sub={summary && summary.isDeflationary ? 'Deflationary' : 'Inflationary'}
          sparkline={ratioHistory.length > 1 ? <SparklineChart data={ratioHistory} width={90} height={32} color="#fb923c" fillColor="rgba(251,146,60,0.05)" /> : undefined}
        />
        <EcoCard
          icon={<Zap className="h-4 w-4 text-sky-400" />}
          label="Peak TPS"
          value={summary ? String(summary.peakTps) : '—'}
          sub="Testnet proven"
        />
        <EcoCard
          icon={<TrendingUp className="h-4 w-4 text-yellow-300" />}
          label="Total Trades"
          value={summary ? String(summary.totalTrades) : '—'}
          sub={summary ? `${summary.totalHcsMessages} HCS msgs` : ''}
        />
      </div>

      {/* Burn vs Mint Chart */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <Flame className="h-4 w-4 text-orange-400" />
            Burn vs Mint Over Time
          </h3>
          <span className="text-[10px] text-white/20">Last {rows.length} cycles</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[10px] text-white/30">Minted VX</div>
            <SparklineChart data={mintHistory} width={380} height={60} color="#38bdf8" fillColor="rgba(56,189,248,0.06)" trend="up" />
          </div>
          <div>
            <div className="mb-2 text-[10px] text-white/30">Burned VX</div>
            <SparklineChart data={burnHistory} width={380} height={60} color="#fb923c" fillColor="rgba(251,146,60,0.06)" trend="up" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Agent Leaderboard */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Trophy className="h-4 w-4 text-veda-accent" />
              Agent Leaderboard
            </h3>
            <span className="text-[10px] text-white/20">{agents.length} agents</span>
          </div>
          <div className="relative">
            <div className="max-h-[360px] overflow-y-auto pr-1">
              <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="pb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">Agent</th>
                  <th className="pb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">Tier</th>
                  <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Rep</th>
                  <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Wins</th>
                  <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {agents.map((a) => (
                  <tr key={a.id} className="group transition-colors hover:bg-white/[0.01]">
                    <td className="py-2">
                      <div className="text-xs font-medium text-white/80">{a.id}</div>
                      <div className="text-[10px] text-white/30">
                        {a.signalsSold} sold · {a.signalsBought} bought
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${TIER_STYLES[a.tier] ?? TIER_STYLES.bronze}`}>
                        {a.tier}
                      </span>
                    </td>
                    <td className="py-2 text-right text-xs text-white/60">{a.reputation}</td>
                    <td className="py-2 text-right text-xs text-white/60">{a.wins.toLocaleString()}</td>
                    <td className="py-2 text-right text-xs text-white/60">{a.balance.toFixed(2)}</td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-white/20">
                      No agent data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {agents.length > 8 && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#0a0a0f] to-transparent" />}
        </div>
      </div>

      {/* Right Column */}
        <div className="space-y-5">
          {/* TPS Trend */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-white/60">HCS Throughput</span>
              <span className="text-[10px] text-white/20">TPS per cycle</span>
            </div>
            <SparklineChart data={tpsHistory} width={340} height={50} color="#fcee0a" fillColor="rgba(252,238,10,0.06)" trend="up" />
          </div>

          {/* HCS Topics */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Share2 className="h-4 w-4 text-sky-400" />
              HCS Topics
            </h3>
            <div className="space-y-1.5">
              {Object.entries(topics).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between rounded border border-white/[0.02] bg-white/[0.01] px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">{key}</span>
                  <span className="font-mono text-[10px] text-white/60">{val}</span>
                </div>
              ))}
              {Object.keys(topics).length === 0 && (
                <div className="py-3 text-center text-xs text-white/20">No topic data</div>
              )}
            </div>
          </div>

          {/* Coordinator Wallets */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Wallet className="h-4 w-4 text-yellow-300" />
              Coordinator Wallets
            </h3>
            <div className="space-y-1.5">
              {Object.entries(data?.wallets ?? {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between rounded border border-white/[0.02] bg-white/[0.01] px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">{key}</span>
                  <span className="font-mono text-[10px] text-white/60">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Economy Cycles Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <Activity className="h-4 w-4 text-veda-accent" />
            Economy Cycles
          </h3>
          <span className="text-[10px] text-white/20">Last {rows.length} records</span>
        </div>
        <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="whitespace-nowrap pb-2 pr-3 text-[10px] font-medium uppercase tracking-wider text-white/30">Time</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Cycles</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">HCS</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Minted</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Burned</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">B/M</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Trades</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Supply</th>
                <th className="whitespace-nowrap pb-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">TPS</th>
                <th className="whitespace-nowrap pb-2 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Defl</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {rows.slice().reverse().map((r, i) => (
                <tr key={i} className="transition-colors hover:bg-white/[0.01]">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-[10px] text-white/40">{r.time}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-white/60">{r.cycles}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-white/60">{r.hcs}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-sky-400">{r.minted.toFixed(0)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-orange-400">{r.burned.toFixed(0)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-white/60">{r.burnMintRatio.toFixed(2)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-white/60">{r.trades}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-white/60">{(r.supply / 1_000_000).toFixed(1)}M</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[10px] text-white/60">{r.tps}</td>
                  <td className="whitespace-nowrap py-1.5 text-right">
                    {r.deflationary ? (
                      <span className="text-[10px] text-yellow-300">YES</span>
                    ) : (
                      <span className="text-[10px] text-red-400">NO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EconomySkeleton() {
  const shimmer = 'animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03]';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-24 rounded-xl ${shimmer}`} />
        ))}
      </div>
      <div className={`h-40 rounded-xl ${shimmer}`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className={`h-[360px] rounded-xl ${shimmer}`} />
        <div className="space-y-5">
          <div className={`h-32 rounded-xl ${shimmer}`} />
          <div className={`h-48 rounded-xl ${shimmer}`} />
          <div className={`h-32 rounded-xl ${shimmer}`} />
        </div>
      </div>
      <div className={`h-64 rounded-xl ${shimmer}`} />
    </div>
  );
}

function EcoCard({ icon, label, value, sub, sparkline }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  sparkline?: React.ReactNode;
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
