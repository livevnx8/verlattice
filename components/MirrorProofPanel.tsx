'use client';

import { CheckCircle, XCircle, ExternalLink, Shield } from 'lucide-react';
import type { SwarmSync } from '@/lib/hcs-client';

const PROOF_LABELS: Record<keyof SwarmSync['proofs'], string> = {
  polling: 'Polling upstream every 5s',
  upstreamReachable: 'Public Hedera mirror reachable',
  caughtUpWithHead: 'Caught up with chain head',
  hipDecode: 'HIP messages decoded',
  domainIndex: 'Domain index populated',
  blockAnchors: 'Block anchors attached',
};

const MODE_STYLES: Record<SwarmSync['mode'], string> = {
  'live-ingest': 'border-green-500/30 bg-green-500/10 text-green-300',
  'idle-swarm': 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  'catching-up': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'mirror-stale': 'border-red-500/30 bg-red-500/10 text-red-300',
};

const MODE_LABELS: Record<SwarmSync['mode'], string> = {
  'live-ingest': 'Live ingest',
  'idle-swarm': 'Synced · swarm idle',
  'catching-up': 'Catching up',
  'mirror-stale': 'Mirror stale',
};

interface MirrorProofPanelProps {
  sync: SwarmSync;
  mirrorUrl?: string | null;
}

export default function MirrorProofPanel({ sync, mirrorUrl }: MirrorProofPanelProps) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
          <Shield className="h-3.5 w-3.5 text-veda-accent" />
          VNX Mirror · Swarm sync proof
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${MODE_STYLES[sync.mode]}`}>
          {MODE_LABELS[sync.mode]}
        </span>
      </div>

      <p className="mt-2 text-xs text-white/60">{sync.summary}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(Object.keys(PROOF_LABELS) as Array<keyof SwarmSync['proofs']>).map((key) => {
          const ok = sync.proofs[key];
          return (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              {ok ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400/80" />
              )}
              <span className={ok ? 'text-white/60' : 'text-white/40'}>{PROOF_LABELS[key]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] sm:grid-cols-4">
        <div className="text-white/40">Chain head</div>
        <div className="font-mono text-white/70">#{sync.upstreamHeadSequence.toLocaleString()}</div>
        <div className="text-white/40">Mirror cursor</div>
        <div className="font-mono text-white/70">#{sync.localCursorSequence.toLocaleString()}</div>
        <div className="text-white/40">Sequence lag</div>
        <div className={sync.sequenceLag > 0 ? 'text-amber-300' : 'text-green-300'}>
          {sync.sequenceLag}
        </div>
        <div className="text-white/40">Indexed total</div>
        <div className="text-white/70">{sync.ingestedTotal.toLocaleString()}</div>
      </div>

      {mirrorUrl && (
        <a
          href={`${mirrorUrl}/api/v1/vnx/sync`}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-flex items-center gap-1 text-[10px] text-veda-accent/80 hover:text-veda-accent hover:underline"
        >
          Raw sync proof JSON <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
}