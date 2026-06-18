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
  blockNumber?: number;
  blockHash?: string;
  mirrorSource?: 'vnx-mirror' | 'public-mirror';
  raw: Record<string, unknown>;
}

/** VNX mirror node response shape (pre-decoded HIP + block proofs). */
export interface VnxMirrorMessage {
  sequence_number: number;
  consensus_timestamp: string;
  message: string;
  payer_account_id?: string;
  running_hash?: string;
  topic_id?: string;
  vnx?: {
    type: string;
    domain: string;
    stage?: string;
    schema?: string;
    version?: string;
    stageHash?: string;
    blockNumber?: number;
    blockHash?: string;
  };
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

export function publicMirrorBaseUrl(network: 'testnet' | 'mainnet' = 'testnet'): string {
  return network === 'mainnet'
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';
}

/** @deprecated Use publicMirrorBaseUrl or vnxMirrorBaseUrl */
export function mirrorBaseUrl(network: 'testnet' | 'mainnet' = 'testnet'): string {
  return publicMirrorBaseUrl(network);
}

/** Resolve VNX mirror node URL — local dev auto-detects localhost:3001. */
export function vnxMirrorBaseUrl(): string | null {
  const env = process.env.NEXT_PUBLIC_VNX_MIRROR_URL;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001';
  }
  return null;
}

export function decodeVnxMirrorMessage(msg: VnxMirrorMessage): DecodedVnxMessage | null {
  const decoded = decodeHcsMessage({
    sequence_number: msg.sequence_number,
    consensus_timestamp: msg.consensus_timestamp,
    message: msg.message,
  });
  if (!decoded) return null;
  if (msg.vnx) {
    decoded.type = msg.vnx.type || decoded.type;
    decoded.domain = msg.vnx.domain || decoded.domain;
    decoded.stage = msg.vnx.stage ?? decoded.stage;
    decoded.blockNumber = msg.vnx.blockNumber;
    decoded.blockHash = msg.vnx.blockHash;
  }
  decoded.mirrorSource = 'vnx-mirror';
  return decoded;
}

export function hashscanTopicUrl(topicId: string, seq?: number, network = 'testnet'): string {
  const base = `https://hashscan.io/${network}/topic/${topicId}`;
  return seq != null ? `${base}?sequenceNumber=${seq}` : base;
}

export type MirrorNodeStatus = 'healthy' | 'idle' | 'degraded' | 'stale';
export type SwarmActivityMode = 'live-ingest' | 'idle-swarm' | 'catching-up' | 'mirror-stale';

export interface SwarmSyncProof {
  polling: boolean;
  upstreamReachable: boolean;
  caughtUpWithHead: boolean;
  hipDecode: boolean;
  domainIndex: boolean;
  blockAnchors: boolean;
}

export interface SwarmSync {
  topicId: string;
  network: string;
  mode: SwarmActivityMode;
  upstreamHeadSequence: number;
  localCursorSequence: number;
  localMaxSequence: number;
  sequenceLag: number;
  lastMessageAgeSec: number | null;
  lastUpstreamMessageAgeSec: number | null;
  swarmPublishing: boolean;
  ingestedTotal: number;
  ingestedThisSession: number;
  proofs: SwarmSyncProof;
  proofScore: string;
  summary: string;
  verifiedAt: string;
}

export interface MirrorHealth {
  status: MirrorNodeStatus;
  uptimeSec: number;
  messageCount: number;
  blockCount: number;
  domainCounts: Record<string, number>;
  liveTps: number;
  peakTps: number;
  pollLagSec: number;
  ingestLagSec: number;
  upstreamLatencyMs?: number;
  swarmMode?: SwarmActivityMode;
  version?: string;
}

export interface TpsHistoryPoint {
  tps: number;
  peakTps: number;
  measuredAt: number;
}

export interface TopicFeed {
  messages: DecodedVnxMessage[];
  maxSequence: number;
  estimatedTps: number;
  peakTps?: number;
  domainCounts?: Record<string, number>;
  health?: MirrorHealth;
  sync?: SwarmSync;
  mirrorSource: 'vnx-mirror' | 'public-mirror';
  mirrorUrl: string;
  fetchedAt?: string;
}

export interface FetchTopicFeedOptions {
  domain?: string;
}

async function fetchFromVnxMirror(
  topicId: string,
  vnxBase: string,
  limit: number,
  domain?: string,
): Promise<TopicFeed | null> {
  try {
    const params = new URLSearchParams({ limit: String(limit), topicId });
    if (domain && domain !== 'all') params.set('domain', domain);
    const url = `${vnxBase}/api/v1/vnx/feed?${params}`;
    const data = await fetchMirrorJson<{
      messages?: VnxMirrorMessage[];
      maxSequence?: number;
      estimatedTps?: number;
      peakTps?: number;
      domainCounts?: Record<string, number>;
      health?: MirrorHealth;
      sync?: SwarmSync;
      fetchedAt?: string;
    }>(url, 8000);

    const raw = data.messages ?? [];
    const messages = raw
      .map(decodeVnxMirrorMessage)
      .filter((m): m is DecodedVnxMessage => m !== null);

    return {
      messages,
      maxSequence: data.maxSequence ?? raw[0]?.sequence_number ?? 0,
      estimatedTps: data.estimatedTps ?? data.health?.liveTps ?? 0,
      peakTps: data.peakTps ?? data.health?.peakTps,
      domainCounts: data.domainCounts ?? data.health?.domainCounts,
      health: data.health,
      sync: data.sync,
      mirrorSource: 'vnx-mirror',
      mirrorUrl: vnxBase,
      fetchedAt: data.fetchedAt,
    };
  } catch {
    return null;
  }
}

export async function fetchMirrorSync(vnxBase?: string): Promise<SwarmSync | null> {
  const base = vnxBase ?? vnxMirrorBaseUrl();
  if (!base) return null;
  try {
    return await fetchMirrorJson<SwarmSync>(`${base}/api/v1/vnx/sync`, 8000);
  } catch {
    return null;
  }
}

export async function fetchMirrorHealth(vnxBase?: string): Promise<MirrorHealth | null> {
  const base = vnxBase ?? vnxMirrorBaseUrl();
  if (!base) return null;
  try {
    return await fetchMirrorJson<MirrorHealth>(`${base}/api/v1/health`, 5000);
  } catch {
    return null;
  }
}

export async function fetchTpsHistory(
  limit = 30,
  vnxBase?: string,
): Promise<TpsHistoryPoint[]> {
  const base = vnxBase ?? vnxMirrorBaseUrl();
  if (!base) return [];
  try {
    const data = await fetchMirrorJson<{ samples?: TpsHistoryPoint[] }>(
      `${base}/api/v1/vnx/tps/history?limit=${limit}`,
      5000,
    );
    return data.samples ?? [];
  } catch {
    return [];
  }
}

async function fetchFromPublicMirror(
  topicId: string,
  network: 'testnet' | 'mainnet',
  limit: number,
): Promise<TopicFeed> {
  const base = publicMirrorBaseUrl(network);
  const url = `${base}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;
  const data = await fetchMirrorJson<{ messages?: HcsMirrorMessage[] }>(url);
  const raw = data.messages || [];
  const maxSequence = raw[0]?.sequence_number ?? 0;
  const estimatedTps = computeTpsFromMirror(raw);
  const messages = reassembleChunkedMessages(raw)
    .map((m) => {
      const d = decodeHcsMessage(m);
      if (d) d.mirrorSource = 'public-mirror';
      return d;
    })
    .filter((m): m is DecodedVnxMessage => m !== null);
  return {
    messages,
    maxSequence,
    estimatedTps,
    mirrorSource: 'public-mirror',
    mirrorUrl: base,
  };
}

export async function fetchTopicFeed(
  topicId: string,
  network: 'testnet' | 'mainnet' = 'testnet',
  limit = 25,
  options: FetchTopicFeedOptions = {},
): Promise<TopicFeed> {
  const vnxBase = vnxMirrorBaseUrl();
  if (vnxBase) {
    const vnxFeed = await fetchFromVnxMirror(topicId, vnxBase, limit, options.domain);
    if (vnxFeed) {
      if (options.domain && options.domain !== 'all') {
        vnxFeed.messages = vnxFeed.messages.filter((m) => m.domain === options.domain);
      }
      return vnxFeed;
    }
  }
  const pub = await fetchFromPublicMirror(topicId, network, limit);
  if (options.domain && options.domain !== 'all') {
    pub.messages = pub.messages.filter((m) => m.domain === options.domain);
  }
  return pub;
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
  peakTps?: number;
  domainCounts?: Record<string, number>;
  health?: MirrorHealth;
  mirrorSource?: 'vnx-mirror' | 'public-mirror';
  mirrorUrl?: string;
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

/** Average TPS from mirror sample — uses a minimum 10-second window to avoid burst spikes. */
export function computeTpsFromMirror(messages: HcsMirrorMessage[]): number {
  if (messages.length < 2) return 0;
  const newest = messages[0];
  const oldest = messages[messages.length - 1];
  const seqDelta = newest.sequence_number - oldest.sequence_number;
  const rawSpan = parseFloat(newest.consensus_timestamp) - parseFloat(oldest.consensus_timestamp);
  if (seqDelta <= 0 || rawSpan < 0) return 0;
  const timeSpan = Math.max(rawSpan, 10); // floor at 10s to smooth bursts
  return seqDelta / timeSpan;
}

/** @deprecated Use computeTpsFromMirror or TopicFeed.estimatedTps */
export function computeTps(messages: DecodedVnxMessage[]): number {
  if (messages.length < 2) return 0;
  const newest = messages[0];
  const oldest = messages[messages.length - 1];
  const seqDelta = newest.sequenceNumber - oldest.sequenceNumber;
  const rawSpan = parseFloat(newest.consensusTimestamp) - parseFloat(oldest.consensusTimestamp);
  if (seqDelta <= 0 || rawSpan < 0) return 0;
  const timeSpan = Math.max(rawSpan, 10);
  return seqDelta / timeSpan;
}

export function formatTps(tps: number): string {
  if (tps <= 0) return '—';
  return tps >= 10 ? Math.round(tps).toLocaleString() : tps.toFixed(2);
}

export function formatMirrorStatus(status: MirrorNodeStatus): string {
  const labels: Record<MirrorNodeStatus, string> = {
    healthy: 'Live',
    idle: 'Idle',
    degraded: 'Degraded',
    stale: 'Stale',
  };
  return labels[status] ?? status;
}

export function formatConsensusTime(ts: string): string {
  const sec = parseFloat(ts.split('.')[0] ?? '0');
  if (!sec) return ts;
  return new Date(sec * 1000).toLocaleTimeString();
}

export function formatAgeSec(sec: number | null | undefined): string {
  if (sec == null) return '—';
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export function swarmModeLabel(mode: SwarmActivityMode): string {
  const labels: Record<SwarmActivityMode, string> = {
    'live-ingest': 'Live ingest',
    'idle-swarm': 'Swarm idle',
    'catching-up': 'Catching up',
    'mirror-stale': 'Mirror stale',
  };
  return labels[mode] ?? mode;
}