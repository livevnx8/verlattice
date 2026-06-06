'use client';

import { useEffect, useState } from 'react';
import type { SwarmReceipt, ReplayResult } from '@/lib/vnx-types';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Fingerprint,
  FileCheck,
  CreditCard,
  Users,
  Trophy,
  Activity,
  Copy,
  Check,
  Clock,
  Network,
} from 'lucide-react';

interface ProofData {
  ok: boolean;
  mode: string;
  receipt: SwarmReceipt;
  replay: ReplayResult;
  packetId: string;
}

function HashValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group flex items-center gap-2 rounded border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/30">{label}</span>
      <span className="truncate font-mono text-[10px] text-white/60">{value}</span>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-yellow-300" /> : <Copy className="h-3 w-3 text-white/30" />}
      </button>
    </div>
  );
}

function StatusPill({ valid }: { valid: boolean }) {
  if (valid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2.5 py-1 text-[10px] font-medium text-yellow-300">
        <ShieldCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-medium text-red-400">
      <ShieldAlert className="h-3 w-3" /> Tampered
    </span>
  );
}

export default function ProofReceiptVisualizer() {
  const [data, setData] = useState<ProofData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/vnx/proof', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Shield className="h-4 w-4 animate-pulse" />
          Loading proof receipt...
        </div>
      </div>
    );
  }

  const receipt = data?.receipt;
  const replay = data?.replay;

  if (!receipt || !replay) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-white/30">
        No proof receipt available.
      </div>
    );
  }

  const date = new Date(receipt.timestamp).toLocaleString();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-veda-accent/20 bg-veda-accent/10">
            <FileCheck className="h-5 w-5 text-veda-accent" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">VNX Proof Receipt</div>
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <Network className="h-3 w-3" /> {receipt.network}
              <span className="text-white/10">|</span>
              <Clock className="h-3 w-3" /> {date}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill valid={!replay.tampered} />
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] text-white/40">
            {data.mode === 'demo' ? 'Demo Data' : 'Live'}
          </span>
        </div>
      </div>

      {/* Verification Result */}
      <div className={`rounded-lg border p-4 ${replay.tampered ? 'border-red-400/20 bg-red-400/5' : 'border-yellow-300/20 bg-yellow-300/5'}`}>
        <div className="mb-2 flex items-center gap-2">
          {replay.tampered ? (
            <ShieldAlert className="h-5 w-5 text-red-400" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-yellow-300" />
          )}
          <span className={`text-sm font-semibold ${replay.tampered ? 'text-red-400' : 'text-yellow-300'}`}>
            {replay.tampered ? 'Tampering Detected' : 'Verification Passed'}
          </span>
        </div>
        <div className="text-xs text-white/60">{replay.details}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <VerifyField label="Task Hash" original={replay.originalTaskHash} recomputed={replay.recomputedTaskHash} match={replay.taskHashMatch} />
          <VerifyField label="Decision Hash" original={replay.originalDecisionHash} recomputed={replay.recomputedDecisionHash} match={replay.decisionHashMatch} />
        </div>
      </div>

      {/* Receipt Core */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Selected Winner */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <Trophy className="h-4 w-4 text-veda-accent" />
            Selected Worker
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">{receipt.selected.name}</span>
              <span className="rounded bg-veda-accent/10 px-2 py-0.5 text-[10px] font-medium text-veda-accent">{receipt.selected.specialty}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-white/50">
              <div className="rounded bg-white/[0.02] px-2 py-1">
                <div className="text-white/30">Score</div>
                <div className="font-mono text-white/80">{receipt.selected.score.toFixed(1)}</div>
              </div>
              <div className="rounded bg-white/[0.02] px-2 py-1">
                <div className="text-white/30">Confidence</div>
                <div className="font-mono text-white/80">{(receipt.selected.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="rounded bg-white/[0.02] px-2 py-1">
                <div className="text-white/30">Price</div>
                <div className="font-mono text-white/80">{receipt.selected.priceHbar} ℏ</div>
              </div>
            </div>
            <div className="rounded bg-white/[0.01] px-2 py-1.5 text-xs text-white/60">{receipt.selected.evidence}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/30">
              Recommendation: <span className="font-mono text-veda-accent">{receipt.selected.recommendation}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            <CreditCard className="h-4 w-4 text-sky-400" />
            Payment
          </div>
          <div className="space-y-2">
            <HashValue value={receipt.payment.status} label="Status" />
            <HashValue value={receipt.payment.network} label="Network" />
            <HashValue value={String(receipt.payment.amountHbar)} label="Amount HBAR" />
            <HashValue value={receipt.payment.recipient} label="Recipient" />
            {receipt.payment.transactionId && <HashValue value={receipt.payment.transactionId} label="Tx ID" />}
            {receipt.payment.error && (
              <div className="rounded border border-red-400/20 bg-red-400/5 px-2.5 py-1.5 text-[10px] text-red-400">{receipt.payment.error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Vote Tally */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          <Users className="h-4 w-4 text-purple-400" />
          Vote Tally ({receipt.votes.length} workers)
        </div>
        <div className="space-y-1.5">
          {receipt.votes.map((v, i) => {
            const isWinner = v.workerId === receipt.selected.workerId;
            const maxScore = Math.max(...receipt.votes.map((vv) => vv.score));
            const pct = maxScore > 0 ? (v.score / maxScore) * 100 : 0;
            return (
              <div
                key={i}
                className={`relative overflow-hidden rounded border px-3 py-2 ${
                  isWinner ? 'border-veda-accent/20 bg-veda-accent/5' : 'border-white/[0.04] bg-white/[0.01]'
                }`}
              >
                <div
                  className={`absolute left-0 top-0 h-full ${isWinner ? 'bg-veda-accent/10' : 'bg-white/[0.03]'}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white/80">{v.name}</span>
                    <span className="text-[10px] text-white/30">{v.specialty}</span>
                    {isWinner && (
                      <span className="rounded bg-veda-accent/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-veda-accent">Winner</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-white/40">
                    <span>conf: {(v.confidence * 100).toFixed(0)}%</span>
                    <span className="font-mono">{v.score.toFixed(1)}</span>
                    <span>{v.priceHbar} ℏ</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hashes */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          <Fingerprint className="h-4 w-4 text-amber-400" />
          Cryptographic Hashes
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <HashValue value={receipt.taskHash} label="Task Hash" />
          <HashValue value={receipt.proof.taskHash} label="Proof Task Hash" />
          <HashValue value={receipt.proof.voteHash} label="Vote Hash" />
          <HashValue value={receipt.proof.receiptHash} label="Receipt Hash" />
          {receipt.decisionHash && <HashValue value={receipt.decisionHash} label="Decision Hash" />}
          {receipt.proofStatus && <HashValue value={receipt.proofStatus} label="Proof Status" />}
        </div>
      </div>

      {/* Live Indicator */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
        <Activity className="h-3 w-3 animate-pulse text-veda-accent" />
        {data.mode === 'demo' ? 'Demo mode — connect VNX_RPC_URL for live data' : 'Live proof data'}
      </div>
    </div>
  );
}

function VerifyField({
  label,
  original,
  recomputed,
  match,
}: {
  label: string;
  original: string;
  recomputed: string;
  match: boolean;
}) {
  return (
    <div className="rounded border border-white/[0.04] bg-white/[0.01] p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/20">orig</span>
          <span className="truncate font-mono text-[10px] text-white/50">{original}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/20">recomp</span>
          <span className="truncate font-mono text-[10px] text-white/50">{recomputed}</span>
        </div>
      </div>
      <div className="mt-1">
        {match ? (
          <span className="text-[10px] text-yellow-300">match</span>
        ) : (
          <span className="text-[10px] text-red-400">mismatch</span>
        )}
      </div>
    </div>
  );
}
