#!/usr/bin/env node
/**
 * Build-time snapshot of latest HCS messages for instant dashboard paint on GitHub Pages.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TOPIC = '0.0.9227346';
const LIMIT = 30;
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

function computeTps(messages, windowSec = 60) {
  if (messages.length < 2) return 0;
  const now = Date.now() / 1000;
  const recent = messages.filter((m) => now - parseFloat(m.consensusTimestamp) < windowSec);
  return recent.length / windowSec;
}

const url = `${MIRROR}/api/v1/topics/${TOPIC}/messages?limit=${LIMIT}&order=desc`;
const res = await fetch(url);
if (!res.ok) throw new Error(`Mirror fetch failed: ${res.status}`);
const data = await res.json();
const messages = (data.messages || []).map(decodeMessage).filter(Boolean);
const maxSequence = messages[0]?.sequenceNumber ?? 0;

const snapshot = {
  topicId: TOPIC,
  network: 'testnet',
  maxSequence,
  messageCount: messages.length,
  estimatedTps: computeTps(messages),
  messages,
  fetchedAt: new Date().toISOString(),
};

const outPath = join(outDir, 'hcs-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${outPath} — seq ${maxSequence}, ${messages.length} messages`);