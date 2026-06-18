/**
 * Hedera Mirror Node client for live HCS topic polling.
 */

export const VNX_TESTNET_TOPIC = '0.0.9227346';
export const VNX_MAINNET_TOPIC = '0.0.10416185';

export interface HcsChunkInfo {
  initial_transaction_id: {
    account_id: string;
    transaction_valid_start: string;
    nonce: number;
    scheduled: boolean;
  };
  number: number;
  total: number;
}

export interface HcsMirrorMessage {
  sequence_number: number;
  consensus_timestamp: string;
  message: string;
  running_hash?: string;
  chunk_info?: HcsChunkInfo;
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
  // Node/build-time fallback without pulling Buffer into the browser bundle.
  return typeof Buffer !== 'undefined'
    ? Buffer.from(str, 'base64').toString('utf8')
    : str;
}

function b64encode(str: string): string {
  if (typeof btoa !== 'undefined') return btoa(str);
  return typeof Buffer !== 'undefined' ? Buffer.from(str, 'utf8').toString('base64') : str;
}

function chunkKey(info: HcsChunkInfo): string {
  const id = info.initial_transaction_id;
  return `${id.account_id}|${id.transaction_valid_start}|${id.nonce}|${id.scheduled}`;
}

/** Merge Hedera HCS chunk fragments into whole messages for JSON decode. */
export function reassembleChunkedMessages(raw: HcsMirrorMessage[]): HcsMirrorMessage[] {
  const pending = new Map<string, HcsMirrorMessage[]>();
  const ready: HcsMirrorMessage[] = [];

  for (const msg of raw) {
    const chunk = msg.chunk_info;
    if (!chunk || chunk.total <= 1) {
      ready.push(msg);
      continue;
    }
    const key = chunkKey(chunk);
    const group = pending.get(key) ?? [];
    group.push(msg);
    pending.set(key, group);
    if (group.length === chunk.total) {
      group.sort((a, b) => a.chunk_info!.number - b.chunk_info!.number);
      const body = group.map((m) => b64decode(m.message)).join('');
      const last = group[group.length - 1];
      ready.push({
        sequence_number: Math.max(...group.map((m) => m.sequence_number)),
        consensus_timestamp: last.consensus_timestamp,
        message: b64encode(body),
      });
      pending.delete(key);
    }
  }

  return ready.sort((a, b) => b.sequence_number - a.sequence_number);
}

const MIRROR_TIMEOUT_MS = 15_000;

async function fetchMirrorJson<T>(url: string, timeoutMs = MIRROR_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`Mirror node error: ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Mirror node timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

export function hashscanTopicUrl(topicId: string, seq?: number, network = 'testnet'): string {
  const base = `https://hashscan.io/${network}/topic/${topicId}`;
  return seq != null ? `${base}?sequenceNumber=${seq}` : base;
}

export interface TopicFeed {
  messages: DecodedVnxMessage[];
  maxSequence: number;
  estimatedTps: number;
}

export async function fetchTopicFeed(
  topicId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
  limit = 25,
): Promise<TopicFeed> {
  const base = mirrorBaseUrl(network);
  const url = `${base}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;
  const data = await fetchMirrorJson<{ messages?: HcsMirrorMessage[] }>(url);
  const raw = data.messages || [];
  const maxSequence = raw[0]?.sequence_number ?? 0;
  const estimatedTps = computeTpsFromMirror(raw);
  const messages = reassembleChunkedMessages(raw)
    .map(decodeHcsMessage)
    .filter((m): m is DecodedVnxMessage => m !== null);
  return { messages, maxSequence, estimatedTps };
}

export async function fetchTopicMessages(
  topicId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
  limit = 25,
): Promise<DecodedVnxMessage[]> {
  const feed = await fetchTopicFeed(topicId, network, limit);
  return feed.messages;
}

export interface HcsSnapshot {
  topicId: string;
  network: string;
  maxSequence: number;
  messageCount: number;
  estimatedTps: number;
  messages: DecodedVnxMessage[];
  fetchedAt: string;
}

export async function loadHcsSnapshot(basePath = ''): Promise<HcsSnapshot | null> {
  try {
    const res = await fetch(`${basePath}/hcs-snapshot.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as HcsSnapshot;
  } catch {
    return null;
  }
}

export async function fetchTopicMeta(
  topicId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
): Promise<{ maxSequence: number; estimatedTps: number }> {
  const feed = await fetchTopicFeed(topicId, network, 100);
  return { maxSequence: feed.maxSequence, estimatedTps: feed.estimatedTps };
}

/** Instantaneous TPS from mirror sample (sequence delta / timestamp span). */
export function computeTpsFromMirror(messages: HcsMirrorMessage[]): number {
  if (messages.length < 2) return 0;
  const newest = messages[0];
  const oldest = messages[messages.length - 1];
  const seqDelta = newest.sequence_number - oldest.sequence_number;
  const timeSpan = parseFloat(newest.consensus_timestamp) - parseFloat(oldest.consensus_timestamp);
  if (seqDelta <= 0 || timeSpan <= 0) return 0;
  return seqDelta / timeSpan;
}

/** @deprecated Use computeTpsFromMirror or TopicFeed.estimatedTps */
export function computeTps(messages: DecodedVnxMessage[]): number {
  if (messages.length < 2) return 0;
  const newest = messages[0];
  const oldest = messages[messages.length - 1];
  const seqDelta = newest.sequenceNumber - oldest.sequenceNumber;
  const timeSpan = parseFloat(newest.consensusTimestamp) - parseFloat(oldest.consensusTimestamp);
  if (seqDelta <= 0 || timeSpan <= 0) return 0;
  return seqDelta / timeSpan;
}

export function formatTps(tps: number): string {
  if (tps <= 0) return '—';
  return tps >= 10 ? Math.round(tps).toString() : tps.toFixed(2);
}