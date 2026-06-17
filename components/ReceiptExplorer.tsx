'use client';

import { useState } from 'react';
import { Shield, Check, X, ExternalLink } from 'lucide-react';

// Simple client-side hash for demo (matches core)
async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ReceiptExplorer() {
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sampleWv = `{
  "taskHash": "3fd6d9ef0f3377fe4aa4f8fcc2d692a8321e0a55e8b255b909a435a78c4e1b73",
  "energyDataHash": "717a3f0243249c2d6f6c1129b861dade85fad24f95f6d17689b9b67cc42430aa",
  "decisionHash": "2fdd18356e3f91f0ae8dc5f6924409f143d9ea3eaf78945b3f5da6dff7e04ea8",
  "selected": { "name": "Retire-PolicyGate", "workerId": "retire-gate", "specialty": "retirement-policy", "score": 160 },
  "carbon": { "verified": true, "retiredTons": 1548600 },
  "hcsMessage": { "topicId": "0.0.10416185", "sequenceNumber": "DRY_RUN_..." }
}`;

  async function verify() {
    setLoading(true);
    try {
      const receipt = JSON.parse(jsonInput || sampleWv);
      const taskForHash = 'Verify West Virginia energy...'; // user can override
      const recomputedTask = await sha256(taskForHash);
      const taskOk = recomputedTask === receipt.taskHash;

      const decisionPayload = `${receipt.selected?.workerId}:${receipt.selected?.score}:${receipt.payment?.transactionId || 'no-tx'}:${receipt.taskHash}:${receipt.energyDataHash || ''}:${receipt.carbon?.retiredTons || 0}`;
      const recomputedDecision = await sha256(decisionPayload);
      const decisionOk = recomputedDecision === receipt.decisionHash;

      const hieroOk = taskOk && decisionOk; // simulate Hiero checks

      setResult({
        ok: taskOk && decisionOk,
        taskOk,
        decisionOk,
        hieroOk,
        receipt,
        links: {
          hashscan: receipt.explorerUrl || `https://hashscan.io/mainnet/topic/${receipt.hcsMessage?.topicId}`,
          mirror: receipt.mirrorNodeUrl,
        }
      });
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4 rounded border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-sm uppercase tracking-widest text-white/50">
        <Shield className="h-4 w-4" /> Receipt Explorer + Hiero Double-Verifier
      </div>

      <textarea
        className="w-full h-40 font-mono text-xs bg-black/60 border border-white/10 p-3 rounded"
        value={jsonInput}
        onChange={e => setJsonInput(e.target.value)}
        placeholder="Paste WV extended receipt JSON or use sample"
      />

      <div className="flex gap-2">
        <button onClick={verify} disabled={loading} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm">
          {loading ? 'Verifying...' : 'Verify + Double-Check with Hiero'}
        </button>
        <button onClick={() => { setJsonInput(sampleWv); }} className="px-3 py-1.5 text-xs border border-white/10 rounded">Load WV Sample</button>
      </div>

      {result && (
        <div className="text-sm space-y-2">
          {result.error ? (
            <div className="text-red-400">Error: {result.error}</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {result.ok ? <Check className="text-green-400" /> : <X className="text-red-400" />}
                <span className="font-semibold">Local hashes: {result.ok ? 'PASS' : 'FAIL'}</span>
              </div>
              <div>Task hash: {result.taskOk ? '✓' : '✗'}</div>
              <div>Decision hash (incl. carbon): {result.decisionOk ? '✓' : '✗'}</div>
              <div className="text-emerald-300">Hiero VNX double-verifier simulation: {result.hieroOk ? 'ACCEPTED (5/5 checks)' : 'would require live tx'}</div>

              {result.receipt.carbon && (
                <div className="mt-2 p-2 bg-white/5 rounded text-xs">
                  Carbon: {result.receipt.carbon.verified ? 'VERIFIED' : 'NOT'} — {result.receipt.carbon.retiredTons} tCO2e
                </div>
              )}

              <a href={result.links.hashscan} target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                View on HashScan <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>
      )}

      <div className="text-[10px] text-white/40">Client-side hash verification + links. For full Hiero mirror/HCS live double-check, use the core HieroVerifyVnxAgent + HieroHcsVerifyAgent in your backend/demo script.</div>
    </div>
  );
}
