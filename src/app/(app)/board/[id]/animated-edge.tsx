"use client";

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useReducedMotion } from "motion/react";

/**
 * Edge custom React Flow avec animation "particule" qui voyage du source
 * au target. Plus expressive que le smoothstep par défaut.
 *
 * - `data.active=true` → particule visible et flux animé
 * - `data.dashed=true` → trait pointillé (utilisé pour les edges de débat
 *   council entre membres du conseil)
 */
export function AnimatedEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    data,
    markerEnd,
  } = props;

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const isActive = Boolean(data?.active);
  const isDashed = Boolean(data?.dashed);
  const reducedMotion = useReducedMotion();

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          stroke: "var(--color-foreground)",
          strokeOpacity: isActive ? 0.6 : isDashed ? 0.18 : 0.35,
          strokeWidth: isActive ? 2 : 1.5,
          strokeDasharray: isDashed ? "4 4" : undefined,
          transition: "stroke-opacity 0.3s, stroke-width 0.3s",
          ...style,
        }}
        markerEnd={markerEnd}
      />
      {isActive && !reducedMotion && (
        <circle
          r="3"
          fill="var(--color-foreground)"
          opacity="0.9"
        >
          <animateMotion
            dur="2.2s"
            repeatCount="indefinite"
            path={path}
            rotate="auto"
          />
          <animate
            attributeName="opacity"
            values="0;0.95;0.95;0"
            keyTimes="0;0.15;0.85;1"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </>
  );
}
