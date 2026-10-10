/**
 * Deterministic feature extraction from what the learner drew or did.
 * No grading happens here — only measurements the evidence rules read.
 */

export type Pt = { x: number; y: number };

export type SketchShape = "vertical" | "straight" | "curved" | "flat-then-drop" | "backward" | "incomplete";

export type SketchFeatures = {
  shape: SketchShape;
  /** sketch drift at ground ÷ true drift. 0 = straight down, 1 = correct */
  driftRatio: number;
  /** horizontal position when 25% of the drop is done, as a fraction of total drift.
   *  Parabola ≈ 0.5, straight line ≈ 0.25, cartoon "out then down" ≳ 0.75 */
  quarterDropFraction: number;
  /** how far down the sketch reaches, as a fraction of the true fall height */
  reach: number;
};

/**
 * @param pts sketch in world metres, relative to the release point (y up, so a fall is negative y)
 * @param fallHeight metres from release to ground
 * @param trueDrift metres the package really drifts forward
 */
export function sketchFeatures(pts: Pt[], fallHeight: number, trueDrift: number): SketchFeatures {
  const reachDrop = Math.max(0, ...pts.map((p) => -p.y));
  const reach = reachDrop / fallHeight;
  if (pts.length < 3 || reach < 0.5) {
    return { shape: "incomplete", driftRatio: NaN, quarterDropFraction: NaN, reach };
  }

  // Monotone in drop: walk the stroke and keep the first point at each new depth.
  const path: Pt[] = [];
  let deepest = 0;
  for (const p of pts) {
    if (-p.y >= deepest) {
      deepest = -p.y;
      path.push(p);
    }
  }

  const D = Math.min(fallHeight, reachDrop);
  const xAt = (drop: number) => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (-b.y >= drop) {
        const t = (drop + a.y) / (a.y - b.y || 1);
        return a.x + (b.x - a.x) * t;
      }
    }
    return path[path.length - 1].x;
  };

  let xEnd = xAt(D);
  // Extrapolate a sketch that stopped short using its final heading.
  if (D < fallHeight && path.length >= 2) {
    const a = path[Math.max(0, path.length - 6)];
    const b = path[path.length - 1];
    const slope = (b.x - a.x) / (a.y - b.y || 1);
    xEnd += slope * (fallHeight - D);
  }

  const driftRatio = xEnd / trueDrift;
  const xq = xAt(D * 0.25);
  const quarterDropFraction = Math.abs(xEnd) > 1e-6 ? xq / xEnd : 0;

  let shape: SketchShape;
  if (driftRatio < -0.12) shape = "backward";
  else if (Math.abs(driftRatio) < 0.12) shape = "vertical";
  else if (quarterDropFraction < 0.36) shape = "straight";
  else if (quarterDropFraction > 0.72) shape = "flat-then-drop";
  else shape = "curved";

  return { shape, driftRatio, quarterDropFraction, reach };
}

export type SpacingTrend = "uniform" | "growing" | "shrinking" | "irregular" | "reversing";

export type SpacingFeatures = {
  gaps: number[];
  trend: SpacingTrend;
  /** (late gaps − early gaps) / mean gap */
  change: number;
  /** coefficient of variation of the gaps */
  cv: number;
  /** last gap ÷ mean gap — near 0 means the learner showed it stopping */
  endRatio: number;
};

export function spacingFeatures(positions: number[]): SpacingFeatures {
  const gaps = positions.slice(1).map((p, i) => p - positions[i]);
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length);
  const cv = mean !== 0 ? sd / Math.abs(mean) : Infinity;
  const k = Math.max(1, Math.floor(gaps.length / 3));
  const early = gaps.slice(0, k).reduce((s, g) => s + g, 0) / k;
  const late = gaps.slice(-k).reduce((s, g) => s + g, 0) / k;
  const change = mean !== 0 ? (late - early) / Math.abs(mean) : 0;
  const endRatio = mean !== 0 ? gaps[gaps.length - 1] / Math.abs(mean) : 0;

  // Is the gap sequence roughly monotone? Count sign flips of successive differences.
  const diffs = gaps.slice(1).map((g, i) => g - gaps[i]);
  const tol = Math.abs(mean) * 0.12;
  let flips = 0;
  let prev = 0;
  for (const d of diffs) {
    const s = Math.abs(d) < tol ? 0 : Math.sign(d);
    if (s !== 0 && prev !== 0 && s !== prev) flips++;
    if (s !== 0) prev = s;
  }

  let trend: SpacingTrend;
  if (gaps.some((g) => g < -Math.abs(mean) * 0.05)) trend = "reversing";
  else if (cv < 0.15) trend = "uniform";
  else if (flips >= 2) trend = "irregular";
  else if (change > 0.25) trend = "growing";
  else if (change < -0.25) trend = "shrinking";
  else trend = "irregular";

  return { gaps, trend, change, cv, endRatio };
}

export const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");
export const signed = (n: number, d = 1) => (Number.isFinite(n) ? `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}` : "—");
