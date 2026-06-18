#!/usr/bin/env node
/**
 * Build-time snapshot of latest HCS messages for instant dashboard paint on GitHub Pages.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TOPIC = '0.0.9227346';
const LIMIT = 100;
const MIRROR = 'https://testnet.mirrornode.hedera.com';

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

function decodeMessage(msg) {
  try {
    const decoded = JSON.parse(Buffer.from(msg.message, 'base64').toString('utf8'));
    const type = String(decoded.type || 'unknown');
    return {
      sequenceNumber: msg.sequence_number,
      consensusTimestamp: msg.consensus_timestamp,
      type,
      domain: detectDomain(type),
      stage: decoded.stage,
      batchId: decoded.batchId || decoded.claimId,
      energyDataHash: decoded.energyDataHash || decoded.dataHash,
      dataHash: decoded.dataHash,
      decisionHash: decoded.decisionHash,
      previousStageHash: decoded.previousStageHash,
      winnerWorker: decoded.winnerWorker || decoded.winner,
      verified: decoded.verified,
      raw: decoded,
    };
  } catch {
    return null;
  }
}

const url = `${MIRROR}/api/v1/topics/${TOPIC}/messages?limit=${LIMIT}&order=desc`;
const res = await fetch(url);
if (!res.ok) throw new Error(`Mirror fetch failed: ${res.status}`);
const data = await res.json();
const raw = data.messages || [];
const maxSequence = raw[0]?.sequence_number ?? 0;
const estimatedTps = computeTpsFromMirror(raw);
const messages = reassembleChunkedMessages(raw).map(decodeMessage).filter(Boolean);

const snapshot = {
  topicId: TOPIC,
  network: 'testnet',
  maxSequence,
  messageCount: messages.length,
  estimatedTps,
  messages,
  fetchedAt: new Date().toISOString(),
};

const outPath = join(outDir, 'hcs-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${outPath} — seq ${maxSequence}, ${messages.length} messages, ${Math.round(estimatedTps)} TPS`);