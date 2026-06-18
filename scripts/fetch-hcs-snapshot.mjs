#!/usr/bin/env node
/**
 * Build-time snapshot of latest HCS messages for instant dashboard paint on GitHub Pages.
 * Prefers VNX mirror node when available (pre-decoded HIP + block proofs).
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TOPIC = '0.0.9227346';
const LIMIT = 100;
const PUBLIC_MIRROR = 'https://testnet.mirrornode.hedera.com';
const VNX_MIRROR = (process.env.VNX_MIRROR_URL || process.env.NEXT_PUBLIC_VNX_MIRROR_URL || 'http://localhost:3001').replace(/\/$/, '');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

function detectDomain(type) {
  const domains = [
    { id: 'wv-carbon', hcsTypes: ['vnx.wv.energy.verified.carbon.retired', 'vnx.energy.', 'vnx.carbon.retired.profile'] },
    { id: 'supply-chain', hcsTypes: ['vnx.sc.provenance.attested'] },
    { id: 'ai-inference', hcsTypes: ['vnx.ai.inference.', 'vnx.ai-inference.'] },
    { id: 'rwa-claim', hcsTypes: ['vnx.rwa.claim.', 'vnx.rwa-claim.'] },
    { id: 'water-biodiversity', hcsTypes: ['vnx.water.credit.', 'vnx.water-biodiversity.', 'vnx.water.biodiversity.'] },
  ];
  for (const d of domains) {
    if (d.hcsTypes.some((t) => type.startsWith(t) || type === t)) return d.id;
  }
  if (type.includes('topic.created')) return 'system';
  if (type.includes('swarm.proof')) return 'core';
  return 'unknown';
}

function chunkKey(info) {
  const id = info.initial_transaction_id;
  return `${id.account_id}|${id.transaction_valid_start}|${id.nonce}|${id.scheduled}`;
}

function reassembleChunkedMessages(raw) {
  const pending = new Map();
  const ready = [];

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
      group.sort((a, b) => a.chunk_info.number - b.chunk_info.number);
      const body = group.map((m) => Buffer.from(m.message, 'base64').toString('utf8')).join('');
      const last = group[group.length - 1];
      ready.push({
        sequence_number: Math.max(...group.map((m) => m.sequence_number)),
        consensus_timestamp: last.consensus_timestamp,
        message: Buffer.from(body, 'utf8').toString('base64'),
      });
      pending.delete(key);
    }
  }

  return ready.sort((a, b) => b.sequence_number - a.sequence_number);
}

function computeTpsFromMirror(messages) {
  if (messages.length < 2) return 0;
  const newest = messages[0];
  const oldest = messages[messages.length - 1];
  const seqDelta = newest.sequence_number - oldest.sequence_number;
  const timeSpan = parseFloat(newest.consensus_timestamp) - parseFloat(oldest.consensus_timestamp);
  if (seqDelta <= 0 || timeSpan <= 0) return 0;
  return seqDelta / timeSpan;
}

function decodeMessage(msg, vnxMeta) {
  try {
    const decoded = JSON.parse(Buffer.from(msg.message, 'base64').toString('utf8'));
    const type = String(decoded.type || vnxMeta?.type || 'unknown');
    return {
      sequenceNumber: msg.sequence_number,
      consensusTimestamp: msg.consensus_timestamp,
      type,
      domain: vnxMeta?.domain || detectDomain(type),
      stage: decoded.stage || vnxMeta?.stage,
      batchId: decoded.batchId || decoded.claimId,
      energyDataHash: decoded.energyDataHash || decoded.dataHash,
      decisionHash: decoded.decisionHash,
      previousStageHash: decoded.previousStageHash,
      winnerWorker: decoded.winnerWorker || decoded.winner,
      verified: decoded.verified,
      blockNumber: vnxMeta?.blockNumber,
      blockHash: vnxMeta?.blockHash,
      mirrorSource: vnxMeta ? 'vnx-mirror' : 'public-mirror',
      raw: decoded,
    };
  } catch {
    return null;
  }
}

async function fetchFromVnxMirror() {
  try {
    const url = `${VNX_MIRROR}/api/v1/vnx/feed?topicId=${TOPIC}&limit=${LIMIT}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.messages || [];
    if (raw.length === 0) return null;

    const messages = raw.map((m) => decodeMessage(m, m.vnx)).filter(Boolean);
    return {
      topicId: TOPIC,
      network: 'testnet',
      maxSequence: data.maxSequence ?? raw[0]?.sequence_number ?? 0,
      messageCount: messages.length,
      estimatedTps: data.estimatedTps ?? 0,
      peakTps: data.peakTps ?? data.health?.peakTps ?? 0,
      domainCounts: data.domainCounts ?? data.health?.domainCounts ?? {},
      health: data.health,
      messages,
      mirrorSource: 'vnx-mirror',
      mirrorUrl: VNX_MIRROR,
      fetchedAt: data.fetchedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchFromPublicMirror() {
  const url = `${PUBLIC_MIRROR}/api/v1/topics/${TOPIC}/messages?limit=${LIMIT}&order=desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mirror fetch failed: ${res.status}`);
  const data = await res.json();
  const raw = data.messages || [];
  const maxSequence = raw[0]?.sequence_number ?? 0;
  const estimatedTps = computeTpsFromMirror(raw);
  const messages = reassembleChunkedMessages(raw).map((m) => decodeMessage(m)).filter(Boolean);

  return {
    topicId: TOPIC,
    network: 'testnet',
    maxSequence,
    messageCount: messages.length,
    estimatedTps,
    messages,
    mirrorSource: 'public-mirror',
    mirrorUrl: PUBLIC_MIRROR,
    fetchedAt: new Date().toISOString(),
  };
}

const snapshot = (await fetchFromVnxMirror()) ?? (await fetchFromPublicMirror());

const outPath = join(outDir, 'hcs-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(
  `Wrote ${outPath} — seq ${snapshot.maxSequence}, ${snapshot.messageCount} messages, ` +
    `${Math.round(snapshot.estimatedTps)} TPS via ${snapshot.mirrorSource}`,
);