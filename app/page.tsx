'use client';

import { useState } from 'react';
import {
  Activity,
  Database,
  Shield,
  Layers,
  Hexagon,
  BarChart3,
  Coins,
  Radio,
} from 'lucide-react';
import SwarmStatusView from '@/components/SwarmStatusView';
import EvidenceRegistryBrowser from '@/components/EvidenceRegistryBrowser';
import ProofReceiptVisualizer from '@/components/ProofReceiptVisualizer';
import BitLatticeFlowDiagram from '@/components/BitLatticeFlowDiagram';
import ArchitectureFlow from '@/components/ArchitectureFlow';
import OverviewPanel from '@/components/OverviewPanel';
import AgentEconomy from '@/components/AgentEconomy';
import ReceiptExplorer from '@/components/ReceiptExplorer';
import BountyLanding from '@/components/BountyLanding';

const TABS = [
  { id: 'bounty', label: 'Live Swarm', icon: <Radio className="h-4 w-4" />, component: BountyLanding },
  { id: 'overview', label: 'Overview', icon: <Hexagon className="h-4 w-4" />, component: OverviewPanel },
  { id: 'architecture', label: 'Architecture', icon: <Layers className="h-4 w-4" />, component: ArchitectureFlow },
  { id: 'swarm', label: 'Swarm', icon: <Activity className="h-4 w-4" />, component: SwarmStatusView },
  { id: 'economy', label: 'Economy', icon: <Coins className="h-4 w-4" />, component: AgentEconomy },
  { id: 'evidence', label: 'Evidence', icon: <Database className="h-4 w-4" />, component: EvidenceRegistryBrowser },
  { id: 'proof', label: 'Proof', icon: <Shield className="h-4 w-4" />, component: ProofReceiptVisualizer },
  { id: 'explorer', label: 'Explorer', icon: <Shield className="h-4 w-4" />, component: ReceiptExplorer },
  { id: 'bitlattice', label: 'Flow', icon: <BarChart3 className="h-4 w-4" />, component: BitLatticeFlowDiagram },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('bounty');
  const [tabKey, setTabKey] = useState(0);
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component ?? BountyLanding;

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setTabKey((k) => k + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-veda-bg">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-gradient-to-r from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-veda-accent/30 bg-veda-accent/10 shadow-[0_0_12px_rgba(252,238,10,0.08)]">
            <Hexagon className="h-4 w-4 text-veda-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90">VNX / BitLattice</h1>
            <p className="text-[10px] text-white/30">Hedera-Native Evidence Agent Network</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="text-[10px] text-white/40 hover:text-veda-accent transition-colors">Live Dashboard</a>
          <a href="/domains" className="text-[10px] text-white/40 hover:text-veda-accent transition-colors">Domains</a>
          <span className="flex items-center gap-1.5 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2.5 py-1 text-[10px] font-medium text-yellow-300">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-300 animate-pulse" />
            Testnet
          </span>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.06] bg-white/[0.01] px-4 py-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'border border-veda-accent/20 bg-veda-accent/10 text-veda-accent shadow-[0_0_8px_rgba(252,238,10,0.06)]'
                : 'border border-transparent text-white/40 hover:border-white/[0.06] hover:bg-white/[0.02] hover:text-white/70'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.icon}</span>
          </button>
        ))}
      </nav>

      <main className="relative flex-1 overflow-y-auto p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(252,238,10,0.03),transparent_60%)]" />
        <div key={tabKey} className="relative mx-auto max-w-6xl animate-fade-in">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
