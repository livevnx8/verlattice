'use client';

interface TpsSparklineProps {
  samples: number[];
  width?: number;
  height?: number;
  className?: string;
}

/** Minimal SVG sparkline for live TPS history. */
export default function TpsSparkline({
  samples,
  width = 160,
  height = 36,
  className = '',
}: TpsSparklineProps) {
  if (samples.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.08)" />
      </svg>
    );
  }

  const max = Math.max(...samples, 1);
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (samples.length - 1);

  const points = samples.map((v, i) => {
    const x = pad + i * step;
    const y = pad + innerH - (v / max) * innerH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${pad},${pad + innerH}`,
    ...points,
    `${pad + innerW},${pad + innerH}`,
  ].join(' ');

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id="tps-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(252,238,10,0.25)" />
          <stop offset="100%" stopColor="rgba(252,238,10,0)" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#tps-fill)" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="rgba(252,238,10,0.85)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}