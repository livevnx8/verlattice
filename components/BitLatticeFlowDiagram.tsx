'use client';

import { useEffect, useState } from 'react';
import type { BitLatticeFlow } from '@/lib/vnx-types';
import {
  Activity,
  Zap,
  Brain,
  GitMerge,
  Filter,
  Share2,
  Radio,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowDown,
  Layers,
} from 'lucide-react';

interface FlowData {
  ok: boolean;
  mode: string;
  flow: BitLatticeFlow;
}

const NODE_ICONS: Record<string, React.ReactNode> = {
  input: <Zap className="h-4 w-4" />,
  'risk-prefilter': <Filter className="h-4 w-4" />,
  'ultra-router': <Layers className="h-4 w-4" />,
  'onnx-fast': <Zap className="h-4 w-4" />,
  'nemotron-deep': <Brain className="h-4 w-4" />,
  ensemble: <GitMerge className="h-4 w-4" />,
  'quality-gate': <CheckCircle2 className="h-4 w-4" />,
  'hcs-publisher': <Share2 className="h-4 w-4" />,
  'edge-node': <Radio className="h-4 w-4" />,
  output: <Activity className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'border-veda-accent/30 bg-veda-accent/5 text-veda-accent',
  idle: 'border-white/[0.06] bg-white/[0.02] text-white/40',
  warning: 'border-amber-400/30 bg-amber-400/5 text-amber-400',
  error: 'border-red-400/30 bg-red-400/5 text-red-400',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-veda-accent animate-pulse',
  idle: 'bg-white/20',
  warning: 'bg-amber-400 animate-pulse',
  error: 'bg-red-400',
};

export default function BitLatticeFlowDiagram() {
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulseEdge, setPulseEdge] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/vnx/bitlattice', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Animate packet through active edges
  useEffect(() => {
    if (!data?.flow?.edges) return;
    const activeEdges = data.flow.edges.filter((e) => e.active);
    if (activeEdges.length === 0) return;
    let idx = 0;
    const timer = setInterval(() => {
      setPulseEdge(activeEdges[idx % activeEdges.length].from + '-' + activeEdges[idx % activeEdges.length].to);
      idx++;
    }, 800);
    return () => clearInterval(timer);
  }, [data?.flow?.edges]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Layers className="h-4 w-4 animate-pulse" />
          Loading BitLattice flow...
        </div>
      </div>
    );
  }

  const flow = data?.flow;
  if (!flow) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/30">
        No BitLattice flow data available.
      </div>
    );
  }

  // Layout: position nodes in a grid
  const positions: Record<string, { row: number; col: number }> = {
    input: { row: 0, col: 1 },
    'risk-prefilter': { row: 1, col: 1 },
    'ultra-router': { row: 2, col: 1 },
    'onnx-fast': { row: 3, col: 0 },
    'nemotron-deep': { row: 3, col: 2 },
    ensemble: { row: 4, col: 1 },
    'quality-gate': { row: 5, col: 1 },
    'hcs-publisher': { row: 6, col: 1 },
    'edge-node': { row: 7, col: 1 },
    output: { row: 8, col: 1 },
  };

  const rows = 9;
  const cols = 3;

  // Build edge lookup for rendering connectors
  const edgeByFromTo = new Map<string, typeof flow.edges[0]>();
  for (const e of flow.edges) {
    edgeByFromTo.set(`${e.from}-${e.to}`, e);
  }

  // For each cell, determine what to render
  const renderCell = (row: number, col: number) => {
    const node = flow.nodes.find((n) => positions[n.id]?.row === row && positions[n.id]?.col === col);
    if (node) {
      const statusClass = STATUS_COLORS[node.status] ?? STATUS_COLORS.idle;
      const dotClass = STATUS_DOT[node.status] ?? STATUS_DOT.idle;
      const isPulsing = pulseEdge?.startsWith(node.id + '-');
      return (
        <div className="flex flex-col items-center">
          <div
            className={`relative w-full max-w-[180px] rounded-lg border p-3 transition-all ${statusClass} ${isPulsing ? 'ring-1 ring-veda-accent/30' : ''}`}
          >
            <div className="absolute -right-1.5 -top-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-current/20 bg-current/10">
                {NODE_ICONS[node.id] ?? <Activity className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{node.label}</div>
                <div className="truncate text-[9px] opacity-60">{node.description}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] opacity-50">
              <span>{node.latencyMs !== undefined ? `${node.latencyMs}ms` : '-'}</span>
              <span>{node.throughput !== undefined ? `${node.throughput} tps` : '-'}</span>
            </div>
          </div>
        </div>
      );
    }

    // Check if this cell is on a connector path
    // Look for edge from above to below in same column, or from side
    return (
      <div className="flex h-full w-full items-center justify-center">
        {/* Render vertical connectors if there's an edge spanning through this cell */}
        {renderConnector(row, col)}
      </div>
    );
  };

  const renderConnector = (row: number, col: number) => {
    // Find edges that should render through this approximate area
    const edges = flow.edges.filter((e) => {
      const p1 = positions[e.from];
      const p2 = positions[e.to];
      if (!p1 || !p2) return false;
      // Vertical edge in same column
      if (p1.col === col && p2.col === col && ((p1.row < row && p2.row >= row) || (p2.row < row && p1.row >= row))) {
        return true;
      }
      // Horizontal edge at boundary
      if (p1.row === p2.row && p1.row === row && ((p1.col < col && p2.col >= col) || (p2.col < col && p1.col >= col))) {
        return true;
      }
      // Diagonal-ish edges (router to side nodes)
      if (Math.abs(p1.row - p2.row) === 1 && Math.abs(p1.col - p2.col) === 1) {
        // At the from-node row going to different col
        if (p1.row === row - 1 && p2.col === col) return true;
        if (p2.row === row - 1 && p1.col === col) return true;
      }
      return false;
    });

    if (edges.length === 0) return null;

    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
        {edges.map((e) => {
          const p1 = positions[e.from];
          const p2 = positions[e.to];
          const key = `${e.from}-${e.to}`;
          const isPulsing = pulseEdge === key;
          if (!p1 || !p2) return null;

          const isVertical = p1.col === p2.col;
          const isHorizontal = p1.row === p2.row;
          const isDiagonal = Math.abs(p1.row - p2.row) === 1 && Math.abs(p1.col - p2.col) === 1;

          if (isVertical) {
            return (
              <div key={key} className="flex flex-col items-center">
                <div className={`h-4 w-0.5 ${e.active ? (isPulsing ? 'bg-veda-accent' : 'bg-white/10') : 'bg-white/[0.03]'}`} />
                {e.label && (
                  <span className={`rounded px-1 text-[8px] ${e.active ? 'bg-veda-accent/10 text-veda-accent' : 'bg-white/5 text-white/20'}`}>
                    {e.label}
                  </span>
                )}
                {e.active && <ArrowDown className={`h-3 w-3 ${isPulsing ? 'text-veda-accent' : 'text-white/10'}`} />}
              </div>
            );
          }

          if (isHorizontal) {
            return (
              <div key={key} className="flex items-center">
                <div className={`h-0.5 w-6 ${e.active ? (isPulsing ? 'bg-veda-accent' : 'bg-white/10') : 'bg-white/[0.03]'}`} />
                {e.label && (
                  <span className={`mx-1 rounded px-1 text-[8px] ${e.active ? 'bg-veda-accent/10 text-veda-accent' : 'bg-white/5 text-white/20'}`}>
                    {e.label}
                  </span>
                )}
                <ArrowRight className={`h-3 w-3 ${isPulsing ? 'text-veda-accent' : 'text-white/10'}`} />
              </div>
            );
          }

          if (isDiagonal) {
            const fromTop = p1.row < p2.row ? p1 : p2;
            const toBottom = p1.row < p2.row ? p2 : p1;
            const goingRight = toBottom.col > fromTop.col;
            return (
              <div key={key} className="flex items-center justify-center">
                <div
                  className={`h-6 w-0.5 rotate-45 ${e.active ? (isPulsing ? 'bg-veda-accent' : 'bg-white/10') : 'bg-white/[0.03]'}`}
                  style={{ transform: goingRight ? 'rotate(35deg)' : 'rotate(-35deg)' }}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header / Current Packet */}
      {flow.currentPacket && (
        <div className="rounded-lg border border-veda-accent/20 bg-veda-accent/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-veda-accent">
            <Zap className="h-3.5 w-3.5" />
            Current Packet in Flight
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">
            <span className="font-mono text-white/60">{flow.currentPacket.packetId}</span>
            <span className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-0.5">{flow.currentPacket.symbol}</span>
            <span className={`rounded px-2 py-0.5 font-medium ${flow.currentPacket.baselineDecision === 'allow' ? 'bg-yellow-300/10 text-yellow-300' : flow.currentPacket.baselineDecision === 'block' ? 'bg-red-400/10 text-red-400' : 'bg-amber-400/10 text-amber-400'}`}>
              {flow.currentPacket.baselineDecision}
            </span>
            <span className="text-white/40">risk: {(flow.currentPacket.riskScore * 100).toFixed(0)}%</span>
            <span className="text-white/40">conf: {(flow.currentPacket.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Flow Grid */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <Layers className="h-4 w-4 text-veda-accent" />
            BitLattice Decision Flow
          </h3>
          <div className="flex gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-veda-accent animate-pulse" /> Active</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-white/20" /> Idle</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Warning</span>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
            {Array.from({ length: rows }).map((_, row) =>
              Array.from({ length: cols }).map((__, col) => (
                <div key={`${row}-${col}`} className="flex min-h-[60px] items-center justify-center">
                  {renderCell(row, col)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Node Detail Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {flow.nodes
          .filter((n) => n.status === 'active')
          .map((node) => (
            <div key={node.id} className="rounded border border-veda-accent/10 bg-veda-accent/[0.03] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-veda-accent">
                {NODE_ICONS[node.id] ?? <Activity className="h-3 w-3" />}
                {node.label}
              </div>
              <div className="mt-1 text-[10px] text-white/40">{node.description}</div>
              {node.latencyMs !== undefined && (
                <div className="mt-1 text-[10px] text-white/30">Latency: {node.latencyMs}ms</div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
