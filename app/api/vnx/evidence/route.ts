import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { MOCK_EVIDENCE_PACKETS } from '@/lib/mock-data';
import type { EvidencePacket, RegistryStats } from '@/lib/vnx-types';

const VNX_RPC = process.env.VNX_RPC_URL || 'http://127.0.0.1:30911';
const VNX_ROOT = '/home/vera-live-0-1/vnx-hedera-agent';

function computeStats(packets: EvidencePacket[]): RegistryStats {
  const domains: Record<string, number> = {};
  let totalVotes = 0;
  for (const p of packets) {
    domains[p.domain] = (domains[p.domain] ?? 0) + 1;
    totalVotes += p.votes.length;
  }
  return {
    totalPackets: packets.length,
    domains,
    oldestEntry: packets.length > 0 ? packets[0].createdAt : null,
    newestEntry: packets.length > 0 ? packets[packets.length - 1].createdAt : null,
    totalVotes,
  };
}

function readLatestBenchmark(): Record<string, unknown> | null {
  try {
    const benchDir = join(VNX_ROOT, 'benchmarks');
    if (!existsSync(benchDir)) return null;
    const files = readdirSync(benchDir)
      .filter((f) => f.endsWith('.json') && f.includes('economy'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    const raw = readFileSync(join(benchDir, files[0]), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildEvidenceFromBenchmark(data: Record<string, unknown>): EvidencePacket[] {
  const agents = (data.agentLeaderboard || []) as Array<{
    id: string;
    balance: number;
    reputation: number;
    tier: string;
    wins: number;
    signalsSold: number;
    signalsBought: number;
  }>;

  const topics = (data.architecture as Record<string, unknown>)?.topics as Record<string, string> || {};
  const results = data.results as Record<string, number> || {};

  return agents.slice(0, 20).map((agent, i) => ({
    id: `evidence-bench-${Date.now()}-${i}`,
    version: '1.0' as const,
    createdAt: new Date().toISOString(),
    taskHash: `bench-${agent.id}`,
    decisionHash: `bench-win-${agent.wins}`,
    domain: agent.tier,
    task: {
      description: `${agent.id} — ${agent.signalsSold} signals sold, ${agent.signalsBought} signals bought, balance ${agent.balance.toFixed(4)} HBAR`,
      maxCostHbar: agent.balance,
    },
    votes: [
      { worker: agent.id, specialty: agent.tier, confidence: Math.min(agent.reputation / 1000, 1), score: agent.wins, evidence: `Reputation: ${agent.reputation}, Tier: ${agent.tier}` },
    ],
    selected: { worker: agent.id, specialty: agent.tier, score: agent.wins },
    proof: {
      localHash: `sha256:${agent.id}`,
      hcsTopicId: topics.receipts || '0.0.0',
    },
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  // Try live RPC first
  try {
    const res = await fetch(`${VNX_RPC}/evidence/list`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const payload = await res.json();
      return NextResponse.json(payload);
    }
  } catch {
    // fall through
  }

  // Try real benchmark data
  const benchmark = readLatestBenchmark();
  if (benchmark) {
    const packets = buildEvidenceFromBenchmark(benchmark);
    const filtered = domain ? packets.filter((p) => p.domain === domain) : packets;
    return NextResponse.json({
      ok: true,
      mode: 'testnet-data',
      packets: filtered,
      stats: computeStats(filtered),
      benchmark: {
        totalTransactions: benchmark.results ? (benchmark.results as Record<string, number>).totalTransactions : 0,
        peakTps: benchmark.results ? (benchmark.results as Record<string, number>).peakTps : 0,
        agents: (benchmark.agentLeaderboard as unknown[])?.length || 0,
      },
    });
  }

  // Fallback to mock
  let packets = MOCK_EVIDENCE_PACKETS;
  if (domain) {
    packets = packets.filter((p) => p.domain === domain);
  }

  return NextResponse.json({
    ok: true,
    mode: 'demo',
    packets,
    stats: computeStats(packets),
  });
}
