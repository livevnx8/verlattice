/**
 * Shared VNX dashboard types — mirror structures from vnx-hedera-agent
 */

export interface WorkerVote {
  workerId: string;
  name: string;
  specialty: string;
  recommendation: string;
  confidence: number;
  priceHbar: number;
  paymentAccount: string;
  evidence: string;
  score?: number;
}

export interface SwarmReceipt {
  version: string;
  network: string;
  timestamp: number;
  taskHash: string;
  votes: Array<{
    workerId: string;
    name: string;
    specialty: string;
    confidence: number;
    priceHbar: number;
    score: number;
  }>;
  selected: {
    workerId: string;
    name: string;
    specialty: string;
    priceHbar: number;
    score: number;
    confidence: number;
    recommendation: string;
    evidence: string;
  };
  payment: {
    status: string;
    transactionId?: string;
    network: string;
    amountHbar: number;
    recipient: string;
    error?: string;
  };
  proof: {
    voteHash: string;
    receiptHash: string;
    taskHash: string;
  };
  decisionHash?: string;
  proofStatus?: string;
}

export interface EvidencePacket {
  id: string;
  version: '1.0';
  createdAt: string;
  taskHash: string;
  decisionHash: string;
  domain: string;
  task: {
    description: string;
    maxCostHbar?: number;
  };
  votes: Array<{
    worker: string;
    specialty: string;
    confidence: number;
    score: number;
    evidence: string;
  }>;
  selected: {
    worker: string;
    specialty: string;
    score: number;
  };
  direction?: string;
  proof: {
    localHash: string;
    hcsTopicId?: string;
    hcsTransactionId?: string;
    mirrorNodeUrl?: string;
  };
}

export interface RegistryStats {
  totalPackets: number;
  domains: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
  totalVotes: number;
}

export interface ReplayResult {
  packetId: string;
  originalTaskHash: string;
  recomputedTaskHash: string;
  originalDecisionHash: string;
  recomputedDecisionHash: string;
  taskHashMatch: boolean;
  decisionHashMatch: boolean;
  tampered: boolean;
  details: string;
}

export interface SwarmStats {
  total: number;
  resolved: number;
  hits: number;
  accuracy: string;
}

export interface PredictionRecord {
  id: number;
  taskId: string;
  workerId: string;
  specialty: string;
  prediction: string;
  confidence: number;
  score: number;
  timestamp: number;
  receiptHash: string;
  direction?: 'up' | 'down';
  priceAtPrediction?: number;
  priceAtResolution?: number;
  hit?: boolean;
  resolved?: boolean;
}

export interface BitLatticeNode {
  id: string;
  label: string;
  type: 'input' | 'process' | 'decision' | 'output';
  status: 'active' | 'idle' | 'warning' | 'error';
  latencyMs?: number;
  throughput?: number;
  description?: string;
}

export interface BitLatticeEdge {
  from: string;
  to: string;
  label?: string;
  active: boolean;
}

export interface BitLatticeFlow {
  nodes: BitLatticeNode[];
  edges: BitLatticeEdge[];
  currentPacket?: {
    packetId: string;
    symbol: string;
    baselineDecision: string;
    riskScore: number;
    confidence: number;
  };
}

export interface AgentStatus {
  id: string;
  name: string;
  specialty: string;
  status: 'online' | 'busy' | 'offline' | 'degraded';
  lastSeen: string;
  tasksCompleted: number;
  accuracy: number;
  hbarEarned: number;
}
