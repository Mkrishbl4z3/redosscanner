// app/components/NFADiagram.js
"use client";

import { useMemo } from "react";
import styles from "./NFADiagram.module.css";

const NODE_RADIUS = 22;
const LAYER_GAP_X = 130;
const NODE_GAP_Y = 90;
const PADDING = 60;

/**
 * Assigns each state to a "layer" (a horizontal column) based on the
 * shortest number of hops from the start state, ignoring direction.
 * This gives a left-to-right flow diagram that roughly matches how
 * you'd draw an NFA by hand: start on the left, accept on the right.
 */
function computeLayers(nfa) {
  const adjacency = new Map();
  for (const id of nfa.states) adjacency.set(id, []);
  for (const t of nfa.transitions) {
    adjacency.get(t.from).push(t.to);
  }

  const layer = new Map();
  layer.set(nfa.start, 0);
  const queue = [nfa.start];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentLayer = layer.get(current);
    for (const next of adjacency.get(current) || []) {
      if (!layer.has(next)) {
        layer.set(next, currentLayer + 1);
        queue.push(next);
      }
    }
  }

  // Any unreachable states (shouldn't normally happen) get dumped at layer 0.
  for (const id of nfa.states) {
    if (!layer.has(id)) layer.set(id, 0);
  }

  return layer;
}

/**
 * Computes {x, y} pixel positions for every state, grouping states into
 * columns by layer and stacking each column vertically.
 */
function computeLayout(nfa) {
  const layer = computeLayers(nfa);
  const byLayer = new Map();

  for (const id of nfa.states) {
    const l = layer.get(id);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(id);
  }

  const positions = new Map();
  const maxLayer = Math.max(...byLayer.keys());
  const maxCountInLayer = Math.max(...[...byLayer.values()].map((arr) => arr.length));

  for (const [l, ids] of byLayer) {
    const columnHeight = ids.length * NODE_GAP_Y;
    const totalHeight = maxCountInLayer * NODE_GAP_Y;
    const yOffset = (totalHeight - columnHeight) / 2;

    ids.forEach((id, i) => {
      positions.set(id, {
        x: PADDING + l * LAYER_GAP_X,
        y: PADDING + yOffset + i * NODE_GAP_Y,
      });
    });
  }

  const width = PADDING * 2 + maxLayer * LAYER_GAP_X;
  const height = PADDING * 2 + (maxCountInLayer - 1) * NODE_GAP_Y;

  return { positions, width: Math.max(width, 300), height: Math.max(height, 200) };
}

/**
 * Given two state positions, computes an SVG path for a curved arrow
 * between them. Self-loops (from === to) get a small loop above the node.
 */
function edgePath(from, to, isSelfLoop) {
  if (isSelfLoop) {
    const { x, y } = from;
    return `M ${x - 12} ${y - NODE_RADIUS} C ${x - 30} ${y - 60}, ${x + 30} ${y - 60}, ${x + 12} ${y - NODE_RADIUS}`;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  const startX = from.x + ux * NODE_RADIUS;
  const startY = from.y + uy * NODE_RADIUS;
  const endX = to.x - ux * NODE_RADIUS;
  const endY = to.y - uy * NODE_RADIUS;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - 18; // slight curve upward

  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
}

export default function NFADiagram({ nfa, dangerousSymbols = [] }) {
  const layout = useMemo(() => computeLayout(nfa), [nfa]);

  if (!nfa || nfa.states.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className={styles.svg}
        width="100%"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-text-dim)" />
          </marker>
          <marker
            id="arrow-danger"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-danger)" />
          </marker>
        </defs>

        {nfa.transitions.map((t, i) => {
          const from = layout.positions.get(t.from);
          const to = layout.positions.get(t.to);
          const isDangerous = dangerousSymbols.includes(t.symbol);
          const isSelfLoop = t.from === t.to;
          const path = edgePath(from, to, isSelfLoop);

          return (
            <g key={i} className={isDangerous ? styles.dangerEdge : styles.edge}>
              <path
                d={path}
                fill="none"
                stroke={isDangerous ? "var(--color-danger)" : "var(--color-text-dim)"}
                strokeWidth={isDangerous ? 2.5 : 1.5}
                markerEnd={isDangerous ? "url(#arrow-danger)" : "url(#arrow)"}
                opacity={t.symbol === "ε" ? 0.4 : 0.9}
                strokeDasharray={t.symbol === "ε" ? "3,3" : "none"}
              />
              {t.symbol !== "ε" && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 22}
                  textAnchor="middle"
                  className={styles.edgeLabel}
                  fill={isDangerous ? "var(--color-danger)" : "var(--color-text)"}
                >
                  {t.symbol}
                </text>
              )}
            </g>
          );
        })}

        {nfa.states.map((id) => {
          const pos = layout.positions.get(id);
          const isStart = id === nfa.start;
          const isAccept = id === nfa.accept;

          return (
            <g key={id} transform={`translate(${pos.x}, ${pos.y})`}>
              {isAccept && (
                <circle
                  r={NODE_RADIUS + 5}
                  fill="none"
                  stroke="var(--color-safe)"
                  strokeWidth={1.5}
                />
              )}
              <circle
                r={NODE_RADIUS}
                fill="var(--color-bg-elevated)"
                stroke={isStart ? "var(--color-safe)" : "var(--color-border)"}
                strokeWidth={isStart ? 2.5 : 1.5}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className={styles.stateLabel}
              >
                {id}
              </text>
              {isStart && (
                <text
                  y={-NODE_RADIUS - 12}
                  textAnchor="middle"
                  className={styles.stateTag}
                  fill="var(--color-safe)"
                >
                  start
                </text>
              )}
              {isAccept && (
                <text
                  y={-NODE_RADIUS - 12}
                  textAnchor="middle"
                  className={styles.stateTag}
                  fill="var(--color-safe)"
                >
                  accept
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}