/**
 * Hedera Mirror Node client for live HCS topic polling.
 */

export const VNX_TESTNET_TOPIC = '0.0.9227346';
export const VNX_MAINNET_TOPIC = '0.0.10416185';

export interface HcsMirrorMessage {
  sequence_number: number;
  consensus_timestamp: string;
  message: string;
  running_hash?: string;
}

export interface DecodedVnxMessage {
  sequenceNumber: number;
  consensusTimestamp: string;
  type: string;
  domain: string;
  stage?: string;
  batchId?: string;
  energyDataHash?: string;
  dataHash?: string;
  decisionHash?: string;
  previousStageHash?: string;
  winnerWorker?: string;
  verified?: boolean;
  raw: Record<string, unknown>;
}

export const VNX_DOMAINS = [
  {
    id: 'wv-carbon',
    name: 'WV Carbon',
    slug: 'energy',
    hcsTypes: ['vnx.wv.energy.verified.carbon.retired', 'vnx.energy.', 'vnx.carbon.retired.profile'],
    color: 'emerald',
    description: 'EIA energy data + carbon retirement',
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain',
    slug: 'sc',
    hcsTypes: ['vnx.sc.provenance.attested'],
    color: 'amber',
    description: 'Provenance attestations',
  },
  {
    id: 'ai-inference',
    name: 'AI Inference',
    slug: 'ai-inference',
    hcsTypes: ['vnx.ai.inference.', 'vnx.ai-inference.'],
    color: 'violet',
    description: 'LLM/ML output attestation',
  },
  {
    id: 'rwa-claim',
    name: 'RWA Claim',
    slug: 'rwa-claim',
    hcsTypes: ['vnx.rwa.claim.', 'vnx.rwa-claim.'],
    color: 'sky',
    description: 'Tokenized asset verification',
  },
  {
    id: 'water-biodiversity',
    name: 'Water / Biodiversity',
    slug: 'water-biodiversity',
    hcsTypes: ['vnx.water.credit.', 'vnx.water-biodiversity.', 'vnx.water.biodiversity.'],
    color: 'cyan',
    description: 'Water + biodiversity credits',
  },
] as const;

export function detectDomain(messageType: string): string {
  for (const d of VNX_DOMAINS) {
    if (d.hcsTypes.some((t) => messageType.startsWith(t) || messageType === t)) {
      return d.id;
    }
  }
  if (messageType.includes('topic.created')) return 'system';
  if (messageType.includes('swarm.proof')) return 'core';
  return 'unknown';
}

function b64decode(str: string): string {
  if (typeof atob !== 'undefined') return atob(str);
  return Buffer.from(str, 'base64').toString('utf8');
}

export function decodeHcsMessage(msg: HcsMirrorMessage): DecodedVnxMessage | null {
  try {
    const decoded = JSON.parse(b64decode(msg.message)) as Record<string, unknown>;
    const type = String(decoded.type || 'unknown');
    return {
      sequenceNumber: msg.sequence_number,
      consensusTimestamp: msg.consensus_timestamp,
      type,
      domain: detectDomain(type),
      stage: decoded.stage as string | undefined,
      batchId: (decoded.batchId || decoded.claimId) as string | undefined,
      energyDataHash: (decoded.energyDataHash || decoded.dataHash) as string | undefined,
      dataHash: decoded.dataHash as string | undefined,
      decisionHash: decoded.decisionHash as string | undefined,
      previousStageHash: decoded.previousStageHash as string | undefined,
      winnerWorker: (decoded.winnerWorker || decoded.winner) as string | undefined,
      verified: decoded.verified as boolean | undefined,
      raw: decoded,
    };
  } catch {
    return null;
  }
}

export function mirrorBaseUrl(network: 'testnet' | 'mainnet' = 'testnet'): string {
  return network === 'mainnet'
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';
}

export function hashscanTopicUrl(topicId: string, seq: number, network = 'testnet'): string {
  return `https://hashscan.io/${network}/topic/${topicId}/${seq}`;
}

export async function fetchTopicMessages(
  topicId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
  limit = 25,
): Promise<DecodedVnxMessage[]> {
  const base = mirrorBaseUrl(network);
  const url = `${base}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Mirror node error: ${res.status}`);
  const data = (await res.json()) as { messages?: HcsMirrorMessage[] };
  return (data.messages || [])
    .map(decodeHcsMessage)
    .filter((m): m is DecodedVnxMessage => m !== null);
}

export async function fetchTopicMeta(
  topicId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
): Promise<{ maxSequence: number; estimatedTps: number }> {
  const messages = await fetchTopicMessages(topicId, network, 60);
  const maxSequence = messages[0]?.sequenceNumber ?? 0;
  return { maxSequence, estimatedTps: computeTps(messages) };
}

export function computeTps(messages: DecodedVnxMessage[], windowSec = 60): number {
  if (messages.length < 2) return 0;
  const now = Date.now() / 1000;
  const recent = messages.filter((m) => {
    const ts = parseFloat(m.consensusTimestamp);
    return now - ts < windowSec;
  });
  return recent.length / windowSec;
}