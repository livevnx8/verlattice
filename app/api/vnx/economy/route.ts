import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const VNX_ROOT = '/home/vera-live-0-1/vnx-hedera-agent';

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
  scheduled: number;
  supply: number;
  tps: number;
  hbarCost: number;
  whale: boolean;
  deflationary: boolean;
}

interface AgentLeaderboardEntry {
  id: string;
  balance: number;
  reputation: number;
  tier: string;
  wins: number;
  streak: number;
  signalsSold: number;
  signalsBought: number;
}

function parseEconomyLog(): EconomyRow[] {
  const path = join(VNX_ROOT, 'logs/vx-economy-v3-live.log');
  if (!existsSync(path)) return [];

  const raw = readFileSync(path, 'utf-8');
  const lines = raw.split('\n');
  const rows: EconomyRow[] = [];

  for (const line of lines) {
    const match = line.match(
      /(\d{3}:\d{2})\s+\|\s+(\d+)\s+\|\s+(\d+)\s+\|\s+([\d,.]+)\s+\|\s+([\d,.]+)\s+\|\s+([\d.]+)\s+\|\s+(\d+)\s+\|\s+(\d+)\s+\|\s+(\d+)\s+\|\s+(\d+)\s+\|\s+(\d+)\s+\|\s+(\d+)\s+\|\s+([\d,.]+)\s+\|\s+(\d+)\s+\|\s+([\d.]+)\s+\|\s+([YN])\s+\|\s+(YES|NO)/
    );
    if (!match) continue;

    const cleanNum = (s: string) => parseFloat(s.replace(/,/g, ''));
    rows.push({
      time: match[1],
      cycles: parseInt(match[2]),
      hcs: parseInt(match[3]),
      minted: cleanNum(match[4]),
      burned: cleanNum(match[5]),
      burnMintRatio: parseFloat(match[6]),
      trades: parseInt(match[7]),
      market: parseInt(match[8]),
      loans: parseInt(match[9]),
      bonds: parseInt(match[10]),
      insurance: parseInt(match[11]),
      scheduled: parseInt(match[12]),
      supply: cleanNum(match[13]),
      tps: parseInt(match[14]),
      hbarCost: parseFloat(match[15]),
      whale: match[16] === 'Y',
      deflationary: match[17] === 'YES',
    });
  }

  return rows;
}

function readLatestBenchmark() {
  try {
    const benchDir = join(VNX_ROOT, 'benchmarks');
    if (!existsSync(benchDir)) return null;
    const files = readdirSync(benchDir)
      .filter((f) => f.endsWith('.json') && f.includes('economy'))
      .map((file) => {
        const path = join(benchDir, file);
        return { path, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (files.length === 0) return null;
    const raw = readFileSync(files[0].path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readTopics() {
  try {
    const path = join(VNX_ROOT, 'logs/vx-economy-topics.json');
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

function readLiveLattice() {
  const path = join(VNX_ROOT, 'logs/vnx-live-lattice.json');
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw);
    if (data.source === 'agent-simulator' && data.leaderboard) {
      return {
        price: data.price,
        agents: data.leaderboard,
        tierCounts: data.tierCounts,
        modelBreakdown: data.modelBreakdown,
        stats: data.stats,
        source: 'agent-simulator',
      };
    }
  } catch { /* ignore */ }
  return null;
}

function readLiveEnduranceEconomy() {
  const path = join(VNX_ROOT, 'logs/vnx-live-economy.json');
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw);
    if (data.source === 'live-endurance' && data.summary) {
      // Fall back to prediction tracker leaderboard if live file has empty leaderboard
      let agents = data.leaderboard || [];
      if (agents.length === 0) {
        const lbPath = join(VNX_ROOT, 'logs/agent-leaderboard.json');
        try {
          const lbRaw = readFileSync(lbPath, 'utf-8');
          const lb = JSON.parse(lbRaw);
          agents = Object.values(lb).map((s: any) => ({
            id: s.agentName,
            balance: Math.round(s.balance * 100) / 100,
            reputation: Math.round(s.reputation),
            tier: s.tier,
            wins: s.wins,
            streak: s.streak,
            signalsSold: s.signalsSold,
            signalsBought: s.signalsBought,
          })).sort((a: any, b: any) => b.reputation - a.reputation).slice(0, 8);
        } catch { /* ignore */ }
      }
      return {
        summary: data.summary,
        rows: data.rows && data.rows.length > 0 ? data.rows : [],
        agents,
        source: 'live-endurance',
      };
    }
  } catch { /* ignore */ }
  return null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // Try live endurance first
  const endurance = readLiveEnduranceEconomy();
  if (endurance) {
    const liveSummary = endurance.summary as Record<string, number | string | boolean>;
    // Map live endurance fields to the EconomyData shape AgentEconomy expects
    const mappedSummary = {
      totalCycles: (liveSummary.totalTransactions as number) || 0,
      totalHcsMessages: (liveSummary.totalTrades as number) || 0,
      totalMinted: (liveSummary.totalVolume as number) || 0,
      totalBurned: ((liveSummary.totalTransactions as number) || 0) * 8,
      burnMintRatio: (liveSummary.totalVolume as number) > 0
        ? (((liveSummary.totalTransactions as number) || 0) * 8) / (liveSummary.totalVolume as number)
        : 0.63,
      currentSupply: 1_000_000_000 - (((liveSummary.totalTransactions as number) || 0) * 8),
      peakTps: (liveSummary.latestTps as number) || 0,
      totalTrades: (liveSummary.totalPayments as number) || 0,
      hbarSpent: 0,
      isDeflationary: (liveSummary.totalTrades as number) * 8 > (liveSummary.totalVolume as number) * 0.5,
      initialSupply: 1_000_000_000,
    };
    const lattice = readLiveLattice();
    const mergedAgents = lattice && lattice.agents.length > 0 ? lattice.agents : endurance.agents;
    return NextResponse.json({
      ok: true,
      mode: 'testnet-data',
      source: endurance.source,
      summary: { ...mappedSummary, price: lattice?.price, onnxCalls: lattice?.stats?.onnxCalls, modelBreakdown: lattice?.modelBreakdown },
      rows: endurance.rows,
      agents: mergedAgents,
      tierCounts: lattice?.tierCounts,
      topics: {},
      wallets: {
        coordinator1: '0.0.9038975',
        coordinator2: '0.0.9038962',
        coordinator3: '0.0.9038961',
        coordinator4: '0.0.9038944',
      },
    });
  }

  const rows = parseEconomyLog();
  const benchmark = readLatestBenchmark();
  const topics = readTopics();

  const last = rows[rows.length - 1];

  const br = benchmark?.results as Record<string, number> | undefined;

  const totalMinted = br?.totalCycles ? br.totalCycles * 100 : (last?.minted ?? 0);
  const totalBurned = br?.totalTransactions ? br.totalTransactions * 8 : (last?.burned ?? 0);
  const currentSupply = last?.supply ?? 1_000_000_000;
  const peakTps = br?.peakTps ?? (rows.length > 0 ? Math.max(...rows.map((r) => r.tps)) : 0);
  const avgBurnMint = br?.totalTransactions && br?.totalCycles
    ? (br.totalTransactions * 8) / (br.totalCycles * 100)
    : rows.length > 0
    ? rows.reduce((a, b) => a + b.burnMintRatio, 0) / rows.length
    : 0.63;

  const agents: AgentLeaderboardEntry[] = benchmark?.agentLeaderboard
    ? benchmark.agentLeaderboard.slice(0, 32)
    : [];

  const hcsTopics = benchmark?.architecture?.topics ?? topics ?? {};

  // Build synthetic rows from benchmark when available so the dashboard reflects
  // the latest produced benchmark instead of an older long-running log.
  const syntheticRows: EconomyRow[] = br ? [{
    time: '00:00',
    cycles: br.totalCycles ?? 0,
    hcs: br.hcsMessages ?? br.totalTransactions ?? 0,
    minted: br.totalCycles ? br.totalCycles * 100 : 0,
    burned: br.totalTransactions ? br.totalTransactions * 8 : 0,
    burnMintRatio: 0.63,
    trades: br.agentToAgentTrades ?? 0,
    market: br.marketplaceOps ?? 0,
    loans: 0,
    bonds: 0,
    insurance: 0,
    scheduled: 0,
    supply: 1_000_000_000,
    tps: br.peakTps ?? br.overallTps ?? 0,
    hbarCost: 0,
    whale: false,
    deflationary: false,
  }] : rows.slice(-30);

  return NextResponse.json({
    ok: true,
    mode: benchmark || rows.length > 0 ? 'testnet-data' : 'demo',
    source: benchmark ? 'benchmark' : rows.length > 0 ? 'economy-log' : 'demo',
    summary: {
      totalCycles: br?.totalCycles ?? last?.cycles ?? 0,
      totalHcsMessages: br?.hcsMessages ?? br?.totalTransactions ?? last?.hcs ?? 0,
      totalMinted,
      totalBurned,
      burnMintRatio: avgBurnMint,
      currentSupply,
      peakTps,
      totalTrades: br?.agentToAgentTrades ?? last?.trades ?? 0,
      hbarSpent: last?.hbarCost ?? 0,
      isDeflationary: last?.deflationary ?? false,
      initialSupply: 1_000_000_000,
    },
    rows: syntheticRows,
    agents,
    topics: hcsTopics,
    wallets: {
      coordinator1: '0.0.9038975',
      coordinator2: '0.0.9038962',
      coordinator3: '0.0.9038961',
      coordinator4: '0.0.9038944',
    },
  });
}
