// Canvas drawing helpers in the Concepts Lab visual language:
// monochrome neutrals, hairline grids, JetBrains Mono labels.
// Learner marks use a single ink color so "what you predicted" never
// gets confused with "what the world did".

export const C = {
  grid: "#f2f2f2",
  gridMajor: "#e8e8e8",
  ground: "#d4d4d4",
  label: "#a3a3a3",
  labelDark: "#737373",
  body: "#222222",
  bodySoft: "#555555",
  trail: "rgba(80, 80, 80, 0.55)",
  trailSoft: "rgba(120, 120, 120, 0.25)",
  ink: "#2563eb",
  inkSoft: "rgba(37, 99, 235, 0.35)",
  target: "#171717",
} as const;

export const MONO = "'JetBrains Mono', ui-monospace, monospace";

export type Ctx = CanvasRenderingContext2D;

export type View = {
  /** px per metre */
  scale: number;
  /** canvas px of world x = 0 */
  ox: number;
  /** canvas px of world y = 0 (ground). World y points up. */
  oy: number;
};

export const toPx = (v: View, x: number, y: number) => ({
  x: v.ox + x * v.scale,
  y: v.oy - y * v.scale,
});

export const toWorld = (v: View, px: number, py: number) => ({
  x: (px - v.ox) / v.scale,
  y: (v.oy - py) / v.scale,
});

export function clear(ctx: Ctx, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
}

/** Dotted grid like the reference playgrounds. Spacing in px. */
export function dotGrid(ctx: Ctx, w: number, h: number, spacing = 24) {
  ctx.fillStyle = "#e5e5e5";
  for (let x = spacing / 2; x < w; x += spacing) {
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

/** Metric grid anchored to the world view, with labelled major lines. */
export function metricGrid(ctx: Ctx, v: View, w: number, h: number, step = 10, major = 50) {
  ctx.lineWidth = 1;
  const x0 = Math.floor(toWorld(v, 0, 0).x / step) * step;
  const x1 = toWorld(v, w, 0).x;
  for (let x = x0; x <= x1; x += step) {
    const px = Math.round(toPx(v, x, 0).x) + 0.5;
    const isMajor = Math.abs(x % major) < 1e-6;
    ctx.strokeStyle = isMajor ? C.gridMajor : C.grid;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, v.oy);
    ctx.stroke();
    if (isMajor && x >= 0) {
      label(ctx, `${x}`, px + 4, v.oy + 16, C.label, 10);
    }
  }
  const yTop = toWorld(v, 0, 0).y;
  for (let y = step; y <= yTop; y += step) {
    const py = Math.round(toPx(v, 0, y).y) + 0.5;
    const isMajor = Math.abs(y % major) < 1e-6;
    ctx.strokeStyle = isMajor ? C.gridMajor : C.grid;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
    if (isMajor) label(ctx, `${y} m`, 8, py - 5, C.label, 10);
  }
}

export function ground(ctx: Ctx, v: View, w: number, h: number) {
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, v.oy, w, h - v.oy);
  ctx.strokeStyle = C.ground;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, v.oy + 0.5);
  ctx.lineTo(w, v.oy + 0.5);
  ctx.stroke();
}

export function label(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  color: string = C.label,
  size = 11,
  align: CanvasTextAlign = "left",
) {
  ctx.font = `${size}px ${MONO}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

export function dot(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Hollow body with a soft inner core — the reference "bob" look. */
export function bob(ctx: Ctx, x: number, y: number, r: number) {
  dot(ctx, x, y, r, "#ffffff", C.bodySoft);
  dot(ctx, x, y, r * 0.38, "rgba(163,163,163,0.45)");
}

export function arrow(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, width = 1.5) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const head = 7;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
  ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
}

export function polyline(
  ctx: Ctx,
  pts: { x: number; y: number }[],
  color: string,
  width = 1.5,
  dash: number[] = [],
) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Flag-style target marker sitting on the ground. */
export function target(ctx: Ctx, x: number, groundY: number, halfWidth: number) {
  ctx.fillStyle = "rgba(23,23,23,0.06)";
  ctx.fillRect(x - halfWidth, groundY - 4, halfWidth * 2, 4);
  ctx.strokeStyle = C.target;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - halfWidth, groundY - 0.5);
  ctx.lineTo(x + halfWidth, groundY - 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - 26);
  ctx.stroke();
  ctx.fillStyle = C.target;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 26);
  ctx.lineTo(x + 12, groundY - 21.5);
  ctx.lineTo(x, groundY - 17);
  ctx.closePath();
  ctx.fill();
}

/** Minimal side-view plane, nose pointing +x. */
export function plane(ctx: Ctx, x: number, y: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = C.body;
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  // fuselage
  ctx.beginPath();
  ctx.moveTo(-26, -2);
  ctx.quadraticCurveTo(-4, -8, 18, -4);
  ctx.quadraticCurveTo(28, -1, 18, 3);
  ctx.lineTo(-22, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(-22, -1);
  ctx.lineTo(-30, -13);
  ctx.lineTo(-24, -13);
  ctx.lineTo(-14, -3);
  ctx.stroke();
  // wing
  ctx.beginPath();
  ctx.moveTo(-6, 1);
  ctx.lineTo(-12, 10);
  ctx.lineTo(-6, 10);
  ctx.lineTo(4, 1);
  ctx.stroke();
  ctx.restore();
}

/** Side-view car, front pointing +x, wheels on y. */
export function car(ctx: Ctx, x: number, y: number, s = 1, color: string = C.body) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.lineTo(-22, -14);
  ctx.lineTo(-12, -15);
  ctx.lineTo(-6, -23);
  ctx.lineTo(8, -23);
  ctx.lineTo(15, -15);
  ctx.lineTo(22, -13);
  ctx.lineTo(22, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const wx of [-12, 12]) {
    ctx.beginPath();
    ctx.arc(wx, -5, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Flat cart with a little cup — used for the "toss from a moving cart" universe. */
export function cart(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.body;
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(-20, -14, 40, 9);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, -14);
  ctx.lineTo(-5, -22);
  ctx.lineTo(5, -22);
  ctx.lineTo(7, -14);
  ctx.stroke();
  for (const wx of [-11, 11]) {
    ctx.beginPath();
    ctx.arc(wx, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
