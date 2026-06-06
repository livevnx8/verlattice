'use client';

import { useEffect, useRef } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  label?: string;
  value?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export default function SparklineChart({
  data,
  width = 200,
  height = 60,
  color = '#fcee0a',
  fillColor = 'rgba(252,238,10,0.08)',
  label,
  value,
  trend = 'neutral',
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(0, height);
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw endpoint dot
    const lastX = width;
    const lastY = height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [data, width, height, color, fillColor]);

  const trendColor = trend === 'up' ? 'text-yellow-300' : trend === 'down' ? 'text-red-400' : 'text-white/40';
  const TrendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className="flex items-center gap-3">
      {(label || value) && (
        <div className="min-w-0">
          {label && <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>}
          {value && (
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-white/90">{value}</span>
              <span className={`text-xs ${trendColor}`}>{TrendArrow}</span>
            </div>
          )}
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="shrink-0"
      />
    </div>
  );
}
