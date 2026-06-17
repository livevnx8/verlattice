'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, ExternalLink, ArrowLeft, Link2 } from 'lucide-react';
import { VNX_TESTNET_TOPIC } from '@/lib/hcs-client';

interface ChainMessage {
  sequenceNumber: number;
  type: string;
  domain: string;
  stage?: string;
  batchId?: string;
  energyDataHash?: string;
  decisionHash?: string;
  previousStageHash?: string;
  winnerWorker?: string;
  verified?: boolean;
  consensusTimestamp: string;
  raw: Record<string, unknown>;
}

export default function ReceiptPage() {
  const params = useParams();
  const hash = params.hash as string;
  const [matches, setMatches] = useState<ChainMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chain, setChain] = useState<ChainMessage[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/hcs/${VNX_TESTNET_TOPIC}?network=testnet&limit=100`);
        const data = await res.json();
        const all: ChainMessage[] = data.messages || [];
        const found = all.filter(
          (m) =>
            m.energyDataHash === hash ||
            m.decisionHash === hash ||
            m.previousStageHash === hash ||
            (m.raw && JSON.stringify(m.raw).includes(hash)),
        );
        setMatches(found);

        // Build cryptographic chain if we have previousStageHash links
        if (found.length > 0) {
          const primary = found[0];
          const chainMsgs: ChainMessage[] = [primary];
          let prev = primary.previousStageHash;
          while (prev) {
            const link = all.find((m) => m.energyDataHash === prev || m.decisionHash === prev);
            if (!link || chainMsgs.includes(link)) break;
            chainMsgs.unshift(link);
            prev = link.previousStageHash;
          }
          setChain(chainMsgs);
        }
      } catch {
        setMatches([]);
      }
      setLoading(false);
    }
    if (hash) load();
  }, [hash]);

  return (
    <div className="min-h-screen bg-veda-bg text-white">
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Shield className="h-5 w-5 text-veda-accent" />
        <div>
          <h1 className="text-sm font-semibold">Receipt Viewer</h1>
          <p className="font-mono text-[10px] text-white/40 break-all">{hash}</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-4">
        {loading ? (
          <div className="text-center text-sm text-white/30 py-12">Searching topic for hash...</div>
        ) : matches.length === 0 ? (
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-8 text-center">
            <p className="text-sm text-white/50">No on-chain messages found matching this hash.</p>
            <p className="mt-2 text-xs text-white/30">
              The hash may be from a receipt not yet published, or from mainnet topic 0.0.10416185.
            </p>
            <a
              href={`https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}`}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-1 text-xs text-veda-accent hover:underline"
            >
              View topic on HashScan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <>
            {/* Hash chain visualization */}
            {chain.length > 1 && (
              <div className="rounded-lg border border-veda-accent/20 bg-veda-accent/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-veda-accent/70 mb-3">
                  <Link2 className="h-3.5 w-3.5" /> Cryptographic Chain ({chain.length} stages)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {chain.map((m, i) => (
                    <div key={m.sequenceNumber} className="flex items-center gap-2">
                      <span className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px]">
                        {m.stage || m.type.split('.').pop()}
                        <span className="ml-1 text-white/30">#{m.sequenceNumber}</span>
                      </span>
                      {i < chain.length - 1 && <span className="text-white/20">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matches.map((msg) => (
              <div key={msg.sequenceNumber} className="rounded-lg border border-white/[0.06] bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white/40">Seq #{msg.sequenceNumber}</span>
                    <h2 className="font-mono text-sm text-white/80">{msg.type}</h2>
                  </div>
                  <a
                    href={`https://hashscan.io/testnet/topic/${VNX_TESTNET_TOPIC}/${msg.sequenceNumber}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 text-xs text-veda-accent hover:underline"
                  >
                    HashScan <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <Field label="Domain" value={msg.domain} />
                  <Field label="Stage" value={msg.stage || '—'} />
                  <Field label="Batch ID" value={msg.batchId || '—'} mono />
                  <Field label="Winner Worker" value={msg.winnerWorker || '—'} />
                  <Field label="Energy/Data Hash" value={msg.energyDataHash || '—'} mono />
                  <Field label="Decision Hash" value={msg.decisionHash || '—'} mono />
                  <Field label="Previous Stage Hash" value={msg.previousStageHash || '—'} mono />
                  <Field label="Verified" value={msg.verified != null ? String(msg.verified) : '—'} />
                  <Field label="Consensus Time" value={msg.consensusTimestamp} />
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-white/40 hover:text-white/60">Raw message JSON</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-black/50 p-3 font-mono text-[10px] text-white/60">
                    {JSON.stringify(msg.raw, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/30">{label}</div>
      <div className={`mt-0.5 break-all ${mono ? 'font-mono text-white/60' : 'text-white/80'}`}>{value}</div>
    </div>
  );
}