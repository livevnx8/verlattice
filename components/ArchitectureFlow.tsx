'use client';

import { useState } from 'react';
import {
  Zap,
  Shield,
  Brain,
  GitMerge,
  Filter,
  Share2,
  Radio,
  CheckCircle2,
  Layers,
  Cpu,
  Hexagon,
  Activity,
} from 'lucide-react';

interface ArchNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  detail: string;
  color: string;
  glow: string;
  x: number;
  y: number;
}

const NODES: ArchNode[] = [
  {
    id: 'signal',
    label: 'Signal Ingestion',
    icon: <Zap className="h-5 w-5" />,
    description: 'Raw market data, on-chain events, and social feeds enter the pipeline.',
    detail: 'Multi-source ingestion from Hedera mirror nodes, price oracles, and social sentiment APIs. Normalized into DecisionPacket format with canonical JSON hashing.',
    color: 'text-sky-400',
    glow: 'shadow-sky-400/20',
    x: 50,
    y: 5,
  },
  {
    id: 'risk',
    label: 'Risk Prefilter',
    icon: <Filter className="h-5 w-5" />,
    description: 'Sub-millisecond block/allow gate based on risk score thresholds.',
    detail: 'Fast-path decision in <0.05ms. Blocks high-risk signals before they enter expensive inference paths. Uses historical drawdown and volatility regime detection.',
    color: 'text-amber-400',
    glow: 'shadow-amber-400/20',
    x: 50,
    y: 20,
  },
  {
    id: 'router',
    label: 'Ultra Tier Router',
    icon: <Layers className="h-5 w-5" />,
    description: 'Routes decisions to fast (ONNX) or deep (Nemotron) inference paths.',
    detail: 'Adaptive routing based on confidence thresholds and time budget. Low-latency signals → ONNX quantized model. Complex signals → Nemotron LLM with rationale generation.',
    color: 'text-purple-400',
    glow: 'shadow-purple-400/20',
    x: 50,
    y: 35,
  },
  {
    id: 'onnx',
    label: 'ONNX Fast Path',
    icon: <Cpu className="h-5 w-5" />,
    description: 'Quantized ONNX inference: 85μs → 14μs, 6.23x speedup.',
    detail: 'Dynamic quantization pipeline shrinks model from 208KB → 63KB. TensorRT execution provider on CUDA. Handles 700+ decisions/sec per GPU core.',
    color: 'text-yellow-300',
    glow: 'shadow-yellow-300/20',
    x: 25,
    y: 55,
  },
  {
    id: 'nemotron',
    label: 'Nemotron Deep Reasoning',
    icon: <Brain className="h-5 w-5" />,
    description: 'NVIDIA LLM rationale generation with evidence-backed reasoning.',
    detail: 'NVIDIA Nemotron-3-8b via local vLLM or NIM cloud. Generates structured rationale with confidence scores, evidence citations, and risk justification. 450ms end-to-end.',
    color: 'text-pink-400',
    glow: 'shadow-pink-400/20',
    x: 75,
    y: 55,
  },
  {
    id: 'ensemble',
    label: 'Ensemble Voter',
    icon: <GitMerge className="h-5 w-5" />,
    description: 'Weighted multi-model consensus aggregation across all agents.',
    detail: 'Combines ONNX fast-path + Nemotron deep reasoning + swarm worker votes. Weighted by historical accuracy per domain. Produces unified confidence score and direction.',
    color: 'text-cyan-400',
    glow: 'shadow-cyan-400/20',
    x: 50,
    y: 70,
  },
  {
    id: 'quality',
    label: 'Quality Gate',
    icon: <CheckCircle2 className="h-5 w-5" />,
    description: 'Confidence and evidence quality validation before publish.',
    detail: 'Minimum confidence threshold per domain. Evidence length and source validation. Rejects decisions with insufficient justification or contradictory signals.',
    color: 'text-teal-400',
    glow: 'shadow-teal-400/20',
    x: 50,
    y: 82,
  },
  {
    id: 'hcs',
    label: 'HCS Publisher',
    icon: <Share2 className="h-5 w-5" />,
    description: 'Compact HCS message publish to Hedera Consensus Service.',
    detail: 'Deterministic payload construction. ~$0.0001 per message. Optional dry-run mode for testing. Mirror-node replay verification. 550 TPS proven on testnet.',
    color: 'text-veda-accent',
    glow: 'shadow-veda-accent/20',
    x: 50,
    y: 94,
  },
  {
    id: 'edge',
    label: 'Edge Swarm Node',
    icon: <Radio className="h-5 w-5" />,
    description: 'Distributed edge execution and relay to VNX agents.',
    detail: 'Propagates proof receipts to 32+ swarm agents. Each agent validates, stores in semantic memory, and acts on the decision. Byzantine-fault-tolerant consensus layer.',
    color: 'text-orange-400',
    glow: 'shadow-orange-400/20',
    x: 80,
    y: 94,
  },
];

const CONNECTIONS = [
  { from: 'signal', to: 'risk' },
  { from: 'risk', to: 'router' },
  { from: 'router', to: 'onnx' },
  { from: 'router', to: 'nemotron' },
  { from: 'onnx', to: 'ensemble' },
  { from: 'nemotron', to: 'ensemble' },
  { from: 'ensemble', to: 'quality' },
  { from: 'quality', to: 'hcs' },
  { from: 'hcs', to: 'edge' },
];

export default function ArchitectureFlow() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedNode = NODES.find((n) => n.id === selected);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white/90">BitLattice Decision Architecture</h2>
        <p className="mt-1 text-sm text-white/40">
          From signal ingestion to Hedera-anchored proof — every step is deterministic, auditable, and verifiable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Diagram */}
        <div className="relative min-h-[500px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(252,238,10,0.3)" />
                <stop offset="100%" stopColor="rgba(252,238,10,0.05)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Connection lines */}
            {CONNECTIONS.map((conn) => {
              const from = NODES.find((n) => n.id === conn.from)!;
              const to = NODES.find((n) => n.id === conn.to)!;
              return (
                <line
                  key={`${conn.from}-${conn.to}`}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke="rgba(252,238,10,0.12)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              );
            })}
            {/* Animated particle on each connection */}
            {CONNECTIONS.map((conn, i) => {
              const from = NODES.find((n) => n.id === conn.from)!;
              const to = NODES.find((n) => n.id === conn.to)!;
              return (
                <circle
                  key={`pulse-${i}`}
                  r="2.5"
                  fill="#fcee0a"
                  opacity="0.6"
                >
                  <animateMotion
                    dur={`${2 + i * 0.3}s`}
                    repeatCount="indefinite"
                    path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                  />
                </circle>
              );
            })}
          </svg>

          {/* Nodes */}
          {NODES.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelected(selected === node.id ? null : node.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transform transition-all duration-300 ${selected === node.id ? 'scale-110 z-10' : 'hover:scale-105'}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div
                className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-3 backdrop-blur-sm transition-all ${
                  selected === node.id
                    ? `border-veda-accent/30 bg-veda-accent/10 shadow-lg ${node.glow}`
                    : 'border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]'
                }`}
              >
                <div className={`${node.color}`}>{node.icon}</div>
                <span className="whitespace-nowrap text-[10px] font-medium text-white/80">{node.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] ${selectedNode.color}`}>
                  {selectedNode.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90">{selectedNode.label}</h3>
                  <p className="text-xs text-white/40">Click any node in the diagram</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-white/70">{selectedNode.description}</p>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <p className="text-xs leading-relaxed text-white/50">{selectedNode.detail}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Hexagon className="h-8 w-8 text-white/10" />
              <p className="text-sm text-white/30">Click any node in the architecture diagram to explore its role in the BitLattice pipeline.</p>
            </div>
          )}
        </div>
      </div>

      {/* Why sections */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WhyCard
          icon={<Cpu className="h-5 w-5 text-yellow-300" />}
          title="Why NVIDIA"
          points={[
            'Nemotron-3 LLM for deep market reasoning with evidence citations',
            'ONNX Runtime with TensorRT: 6.23x inference speedup (85μs → 14μs)',
            'Dynamic quantization: 208KB → 63KB model size',
            'CUDA 13.2 + local vLLM for sub-second LLM inference',
          ]}
        />
        <WhyCard
          icon={<Hexagon className="h-5 w-5 text-veda-accent" />}
          title="Why Hedera"
          points={[
            '$0.0001 per HCS message — months of runtime for under 4000 HBAR',
            '550 TPS proven on testnet from single application',
            'Deterministic finality in 3-5 seconds — no forks, no reorgs',
            'Carbon-negative consensus — energy efficient hashgraph',
          ]}
        />
        <WhyCard
          icon={<Activity className="h-5 w-5 text-sky-400" />}
          title="Why Build Here"
          points={[
            'Every decision is hashed, signed, and optionally HCS-anchored',
            'Replay verifier: recompute any decision hash and detect tampering',
            '32-agent swarm with Byzantine consensus and reputation scoring',
            'VX token economy with transparent mint/burn accounting on-chain',
          ]}
        />
      </div>
    </div>
  );
}

function WhyCard({ icon, title, points }: { icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      <ul className="space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-white/50">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-veda-accent/60" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
