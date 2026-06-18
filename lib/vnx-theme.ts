/** Shared VNX domain colors and status styles for dashboard surfaces. */

export const DOMAIN_BADGE: Record<string, string> = {
  'wv-carbon': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'supply-chain': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'ai-inference': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'rwa-claim': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'water-biodiversity': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  system: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  core: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  unknown: 'bg-white/10 text-white/50 border-white/10',
};

export const DOMAIN_BAR: Record<string, string> = {
  'wv-carbon': 'bg-emerald-500/70',
  'supply-chain': 'bg-amber-500/70',
  'ai-inference': 'bg-violet-500/70',
  'rwa-claim': 'bg-sky-500/70',
  'water-biodiversity': 'bg-cyan-500/70',
  system: 'bg-orange-500/70',
  core: 'bg-yellow-400/80',
  unknown: 'bg-white/30',
};

export const DOMAIN_CARD_GRADIENT: Record<string, string> = {
  emerald: 'from-emerald-500/10 border-emerald-500/20',
  amber: 'from-amber-500/10 border-amber-500/20',
  violet: 'from-violet-500/10 border-violet-500/20',
  sky: 'from-sky-500/10 border-sky-500/20',
  cyan: 'from-cyan-500/10 border-cyan-500/20',
};

export type MirrorNodeStatus = 'healthy' | 'idle' | 'degraded' | 'stale';

export const STATUS_STYLES: Record<MirrorNodeStatus, string> = {
  healthy: 'bg-green-500/15 text-green-300 border-green-500/30',
  idle: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  degraded: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  stale: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export function domainBadgeClass(domain: string): string {
  return DOMAIN_BADGE[domain] ?? DOMAIN_BADGE.unknown;
}

export function domainBarClass(domain: string): string {
  return DOMAIN_BAR[domain] ?? DOMAIN_BAR.unknown;
}