'use client';

import { useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import type { AgentStatus } from '@/lib/vnx-types';

interface TopologyNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  label: string;
  specialty: string;
  status: 'online' | 'busy' | 'offline' | 'degraded';
}

interface TopologyEdge {
  from: string;
  to: string;
  strength: number;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#fcee0a',
  busy: '#fbbf24',
  degraded: '#f97316',
  offline: '#ef4444',
};

function initNodes(agents: AgentStatus[]): TopologyNode[] {
  const centerX = 400;
  const centerY = 250;
  const radius = 180;
  return agents.map((agent, i) => {
    const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: agent.id,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: 18 + (agent.accuracy * 10),
      color: STATUS_COLORS[agent.status] || '#64748b',
      label: agent.name,
      specialty: agent.specialty,
      status: agent.status,
    };
  });
}

function initEdges(nodes: TopologyNode[]): TopologyEdge[] {
  const edges: TopologyEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 280) {
        edges.push({
          from: nodes[i].id,
          to: nodes[j].id,
          strength: 1 - dist / 280,
        });
      }
    }
  }
  return edges;
}

export default function NetworkTopology({ agents }: { agents: AgentStatus[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const nodesRef = useRef<TopologyNode[]>([]);
  const edgesRef = useRef<TopologyEdge[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    nodesRef.current = initNodes(agents);
    edgesRef.current = initEdges(nodesRef.current);
  }, [agents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    function animate() {
      if (!ctx || !canvas) return;
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Apply gentle force-directed layout
      nodes.forEach((node) => {
        node.vx *= 0.92;
        node.vy *= 0.92;
        // Pull toward center
        const cx = w / 2;
        const cy = h / 2;
        node.vx += (cx - node.x) * 0.0003;
        node.vy += (cy - node.y) * 0.0003;
        node.x += node.vx;
        node.y += node.vy;
      });

      // Draw edges
      edges.forEach((edge) => {
        const from = nodes.find((n) => n.id === edge.from);
        const to = nodes.find((n) => n.id === edge.to);
        if (!from || !to) return;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = `rgba(252, 238, 10, ${edge.strength * 0.15})`;
        ctx.lineWidth = edge.strength * 1.5;
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((node) => {
        const isHovered = hovered === node.id;

        // Glow
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 2);
        grad.addColorStop(0, node.color + '20');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? node.radius + 3 : node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color + '15';
        ctx.fill();
        ctx.strokeStyle = node.color + (isHovered ? 'ff' : '80');
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
        ctx.font = `${isHovered ? 'bold ' : ''}11px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 14);

        // Specialty
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(node.specialty, node.x, node.y + node.radius + 26);
      });

      // Draw packet animation on random edges
      const time = Date.now() / 1000;
      edges.forEach((edge, i) => {
        if ((time * 2 + i * 0.7) % 3 > 2.5) {
          const from = nodes.find((n) => n.id === edge.from);
          const to = nodes.find((n) => n.id === edge.to);
          if (!from || !to) return;
          const t = ((time * 2 + i * 0.7) % 1);
          const px = from.x + (to.x - from.x) * t;
          const py = from.y + (to.y - from.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fcee0a';
          ctx.fill();
        }
      });

      animRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [hovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    let found: string | null = null;
    nodesRef.current.forEach((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < node.radius + 10) {
        found = node.id;
      }
    });
    setHovered(found);
  };

  const hoveredNode = agents.find((a) => a.id === hovered);

  if (agents.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <Radio className="mb-3 h-8 w-8 text-white/10" />
        <p className="text-sm text-white/30">No agents connected</p>
        <p className="mt-1 text-[10px] text-white/20">Start the VNX swarm to see live topology</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="h-[400px] w-full cursor-crosshair rounded-xl border border-white/[0.06] bg-white/[0.01]"
        style={{ width: '100%', height: '400px' }}
        onMouseMove={handleMouseMove}
      />
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-white/[0.08] bg-[#0a0a0f]/95 p-2.5 shadow-xl backdrop-blur-sm"
          style={{ left: mousePos.x + 12, top: mousePos.y - 40 }}
        >
          <div className="text-xs font-medium text-white/90">{hoveredNode.name}</div>
          <div className="text-[10px] text-white/40">{hoveredNode.specialty}</div>
          <div className="mt-1 flex gap-3 text-[10px] text-white/50">
            <span>Tasks: {hoveredNode.tasksCompleted}</span>
            <span>Acc: {(hoveredNode.accuracy * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
