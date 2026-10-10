"use client";

import { useEffect, useRef } from "react";

export type FrameInfo = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size */
  w: number;
  h: number;
  /** seconds since previous frame, clamped */
  dt: number;
};

type Props = {
  onFrame: (f: FrameInfo) => void;
  onPointerDown?: (p: { x: number; y: number }, e: React.PointerEvent) => void;
  onPointerMove?: (p: { x: number; y: number }, e: React.PointerEvent) => void;
  onPointerUp?: (p: { x: number; y: number }, e: React.PointerEvent) => void;
  className?: string;
  cursor?: string;
  ariaLabel: string;
};

/**
 * HiDPI canvas with a requestAnimationFrame loop. Handlers are read through
 * refs so callers can pass fresh closures every render without restarting
 * the loop. The loop stops when the component is hidden (Activity) or
 * unmounted because the effect cleans up.
 */
export function SimCanvas({
  onFrame,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  className,
  cursor,
  ariaLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(onFrame);
  useEffect(() => {
    frameRef.current = onFrame;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      if (w > 0 && h > 0) frameRef.current({ ctx, w, h, dt });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      className={className ?? "absolute inset-0 h-full w-full touch-none"}
      style={cursor ? { cursor } : undefined}
      onPointerDown={(e) => {
        if (!onPointerDown) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        onPointerDown(local(e), e);
      }}
      onPointerMove={onPointerMove ? (e) => onPointerMove(local(e), e) : undefined}
      onPointerUp={onPointerUp ? (e) => onPointerUp(local(e), e) : undefined}
    />
  );
}
