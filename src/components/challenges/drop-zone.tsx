"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalyzerPanel } from "@/components/analyzer-panel";
import { SimCanvas, type FrameInfo } from "@/components/sim-canvas";
import {
  CanvasCard,
  Icon,
  PillButton,
  PromptCard,
  Segmented,
  Stat,
  StatsBar,
  ToolButton,
  ToolDivider,
  Toolbar,
} from "@/components/ui";
import { fmt, signed, sketchFeatures, type Pt } from "@/lib/analysis";
import {
  C,
  bob,
  clear,
  dot,
  ground,
  label,
  metricGrid,
  plane,
  polyline,
  target,
  toPx,
  toWorld,
  type View,
} from "@/lib/draw";
import { record, type ConceptId } from "@/lib/evidence";

const H = 80; // release altitude, m
const G = 9.8;
const T_FALL = Math.sqrt((2 * H) / G);
const WORLD_W = 450;
const WORLD_LEFT = -30;
const TARGET_HALF = 8;
const STROBE_DT = 0.25;

type LayerId = "cruise" | "pilot" | "accel" | "fast";
type Predict = "sketch" | "choice" | "none";
type Choice = "behind" | "under" | "ahead";

type Layer = {
  label: string;
  step: string;
  title: string;
  body: string;
  x0: number;
  v0: number;
  a: number;
  frame: "ground" | "pilot";
  predict: Predict;
  targetRange: [number, number];
  concepts: ConceptId[];
};

const LAYERS: Record<LayerId, Layer> = {
  cruise: {
    label: "1 · Cruise",
    step: "Layer 1 · Ground view",
    title: "The plane will cross the flag at a steady 30 m/s, 80 m up. Sketch the path the package takes once it's dropped.",
    body: "Start your line at the plane. Then start the flight and drop (Space) when you think it will land on the flag.",
    x0: 0,
    v0: 30,
    a: 0,
    frame: "ground",
    predict: "sketch",
    targetRange: [250, 330],
    concepts: ["inertia", "gravity-accel", "directed-correction"],
  },
  pilot: {
    label: "2 · Pilot's view",
    step: "Layer 2 · Pilot's view",
    title: "Now you're riding in the plane. Sketch the package's path the way the pilot sees it.",
    body: "The camera moves with the plane — same speed, same height as before.",
    x0: 0,
    v0: 30,
    a: 0,
    frame: "pilot",
    predict: "sketch",
    targetRange: [250, 330],
    concepts: ["frames", "inertia"],
  },
  accel: {
    label: "3 · Accelerating",
    step: "Layer 3 · Accelerating plane",
    title: "This plane speeds up the whole way. At the moment the package touches the ground, where is it compared to the plane?",
    body: "Commit to an answer, then fly and try to hit the flag.",
    x0: 0,
    v0: 12,
    a: 3.5,
    frame: "ground",
    predict: "choice",
    targetRange: [240, 320],
    concepts: ["release-velocity", "directed-correction"],
  },
  fast: {
    label: "4 · Twice as fast",
    step: "Layer 4 · 60 m/s",
    title: "Same height, but the plane now cruises at 60 m/s. Land the package on the flag.",
    body: "Your first attempt says the most — take your time choosing the moment.",
    x0: -120,
    v0: 60,
    a: 0,
    frame: "ground",
    predict: "none",
    targetRange: [330, 400],
    concepts: ["drift-scales", "inertia", "directed-correction"],
  },
};

type Phase = "predict" | "ready" | "flying" | "landed" | "gone";

type Attempt = { releaseX: number; landX: number; targetX: number; drift: number };

type Sim = {
  t: number;
  running: boolean;
  release: null | { t: number; x: number; vx: number };
  landed: null | { x: number };
  strobe: Pt[];
  planeTicks: number[];
  targetX: number;
  sketch: Pt[];
  drawing: boolean;
  attempts: Attempt[];
  past: number[]; // earlier landing xs this layer
};

const planeX = (L: Layer, t: number) => L.x0 + L.v0 * t + 0.5 * L.a * t * t;
const planeV = (L: Layer, t: number) => L.v0 + L.a * t;
const randTarget = (L: Layer) => {
  const [a, b] = L.targetRange;
  return Math.round(a + Math.random() * (b - a));
};

function freshSim(L: Layer): Sim {
  return {
    t: 0,
    running: false,
    release: null,
    landed: null,
    strobe: [],
    planeTicks: [],
    targetX: randTarget(L),
    sketch: [],
    drawing: false,
    attempts: [],
    past: [],
  };
}

export function DropZone() {
  const [layerId, setLayerId] = useState<LayerId>("cruise");
  const L = LAYERS[layerId];
  const [phase, setPhase] = useState<Phase>(L.predict === "none" ? "ready" : "predict");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [hasSketch, setHasSketch] = useState(false);
  const [stats, setStats] = useState({ t: 0, v: L.v0, vx: NaN, vy: NaN, alt: H });
  const [result, setResult] = useState<{ miss: number; hit: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [released, setReleased] = useState(false);

  const sim = useRef<Sim>(freshSim(L));
  const view = useRef<View>({ scale: 1, ox: 0, oy: 0 });
  const lastStats = useRef(0);
  const cruiseLead = useRef<number | null>(null);
  const predictionLogged = useRef(false);

  const switchLayer = (id: LayerId) => {
    const next = LAYERS[id];
    sim.current = freshSim(next);
    predictionLogged.current = false;
    setLayerId(id);
    setPhase(next.predict === "none" ? "ready" : "predict");
    setChoice(null);
    setHasSketch(false);
    setResult(null);
    setNote("");
    setNoteSaved(false);
    setAttempts(0);
    setReleased(false);
    setStats({ t: 0, v: next.v0, vx: NaN, vy: NaN, alt: H });
  };

  const resetLayer = () => switchLayer(layerId);

  const start = useCallback(() => {
    const s = sim.current;
    s.t = 0;
    s.running = true;
    s.release = null;
    s.landed = null;
    s.strobe = [];
    s.planeTicks = [];
    setResult(null);
    setReleased(false);
    setPhase("flying");
  }, []);

  const drop = useCallback(() => {
    const s = sim.current;
    if (!s.running || s.release) return;
    s.release = { t: s.t, x: planeX(L, s.t), vx: planeV(L, s.t) };
    setReleased(true);
  }, [L]);

  const nextAttempt = () => {
    const s = sim.current;
    s.running = false;
    s.t = 0;
    s.release = null;
    s.landed = null;
    s.strobe = [];
    s.planeTicks = [];
    s.targetX = randTarget(L);
    setResult(null);
    setPhase("ready");
    setStats({ t: 0, v: L.v0, vx: NaN, vy: NaN, alt: H });
  };

  /* ---------- evidence ---------- */

  const logPrediction = useCallback(
    (drift: number) => {
      if (predictionLogged.current) return;
      predictionLogged.current = true;
      const s = sim.current;
      if (L.predict === "sketch") {
        const f = sketchFeatures(s.sketch, H, drift);
        const data = { shape: f.shape, driftRatio: +f.driftRatio.toFixed(2), q: +f.quarterDropFraction.toFixed(2) };
        if (f.shape === "incomplete") {
          record({ challenge: "drop-zone", concept: L.frame === "pilot" ? "frames" : "inertia", signal: "neutral", weight: 0, summary: "Sketch stopped well above the ground — not enough to read.", data });
          return;
        }
        if (L.frame === "pilot") {
          const r = f.driftRatio;
          if (Math.abs(r) < 0.15)
            record({ challenge: "drop-zone", concept: "frames", signal: "supports", weight: 0.7, summary: "Pilot's view: sketched the package falling straight down below the plane.", data });
          else if (r < -0.3) {
            record({ challenge: "drop-zone", concept: "frames", signal: "contradicts", weight: 0.7, summary: `Pilot's view: sketched the package trailing behind the plane (${fmt(r * drift, 0)} m).`, data });
            record({ challenge: "drop-zone", concept: "inertia", signal: "contradicts", weight: 0.4, summary: "Expects the package to lose its forward speed once released.", data });
          } else if (r > 0.3)
            record({ challenge: "drop-zone", concept: "frames", signal: "contradicts", weight: 0.5, summary: "Pilot's view: drew the forward curve a ground observer sees — didn't switch frames.", data });
          else
            record({ challenge: "drop-zone", concept: "frames", signal: "neutral", weight: 0.2, summary: `Pilot's view: small sideways drift (${fmt(r * drift, 0)} m) — ambiguous.`, data });
          return;
        }
        const r = f.driftRatio;
        if (f.shape === "vertical")
          record({ challenge: "drop-zone", concept: "inertia", signal: "contradicts", weight: 0.8, summary: "Sketched the package falling straight down from a moving plane.", data });
        else if (f.shape === "backward")
          record({ challenge: "drop-zone", concept: "inertia", signal: "contradicts", weight: 0.7, summary: "Sketched the package drifting backward after release.", data });
        else if (r >= 0.5 && r <= 1.6)
          record({ challenge: "drop-zone", concept: "inertia", signal: "supports", weight: 0.6, summary: `Sketch carries the package forward (${Math.round(r * 100)}% of the real drift).`, data });
        else if (r < 0.5)
          record({ challenge: "drop-zone", concept: "inertia", signal: "supports", weight: 0.25, summary: `Sketch drifts forward but falls well short (${Math.round(r * 100)}% of real drift).`, data });
        else
          record({ challenge: "drop-zone", concept: "inertia", signal: "neutral", weight: 0.2, summary: `Sketch overshoots the real drift (${Math.round(r * 100)}%).`, data });

        if (f.shape === "curved")
          record({ challenge: "drop-zone", concept: "gravity-accel", signal: "supports", weight: 0.6, summary: "Path bends progressively steeper — consistent with falling faster over time.", data });
        else if (f.shape === "straight")
          record({ challenge: "drop-zone", concept: "gravity-accel", signal: "contradicts", weight: 0.5, summary: "Drew a straight diagonal — implies the fall speed never changes.", data });
        else if (f.shape === "flat-then-drop")
          record({ challenge: "drop-zone", concept: "gravity-accel", signal: "contradicts", weight: 0.6, summary: "Cartoon path: moves sideways first, then drops — treats the two motions as happening in turn.", data });
      }
    },
    [L],
  );

  const logChoice = (c: Choice) => {
    setChoice(c);
    if (c === "behind")
      record({ challenge: "drop-zone", concept: "release-velocity", signal: "supports", weight: 0.7, summary: "Predicts the accelerating plane pulls ahead of the package.", data: { choice: c } });
    else if (c === "under")
      record({ challenge: "drop-zone", concept: "release-velocity", signal: "contradicts", weight: 0.7, summary: "Predicts the package stays under an accelerating plane — expects it to keep accelerating.", data: { choice: c } });
    else
      record({ challenge: "drop-zone", concept: "release-velocity", signal: "contradicts", weight: 0.5, summary: "Predicts the package ends up ahead of an accelerating plane.", data: { choice: c } });
    setPhase("ready");
  };

  const logAttempt = useCallback(
    (a: Attempt, prev: Attempt | undefined, first: boolean) => {
      const lead = a.targetX - a.releaseX;
      const leadFrac = lead / a.drift;
      const data = { lead: +lead.toFixed(1), leadFrac: +leadFrac.toFixed(2), miss: +(a.landX - a.targetX).toFixed(1) };
      if (first) {
        if (layerId === "cruise") cruiseLead.current = lead;
        if (layerId === "fast") {
          const prior = cruiseLead.current;
          if (prior !== null && Math.abs(lead / prior - 1) < 0.3 && leadFrac < 0.75)
            record({ challenge: "drop-zone", concept: "drift-scales", signal: "contradicts", weight: 0.6, summary: `At double speed, released with the same lead as at 30 m/s (${fmt(lead, 0)} m vs ${fmt(prior, 0)} m).`, data });
          else if (leadFrac >= 0.7 && leadFrac <= 1.3)
            record({ challenge: "drop-zone", concept: "drift-scales", signal: "supports", weight: 0.6, summary: `First release at 60 m/s led the flag by ${fmt(lead, 0)} m — scaled with speed.`, data });
          else
            record({ challenge: "drop-zone", concept: "drift-scales", signal: "neutral", weight: 0.2, summary: `First release at 60 m/s led by ${fmt(lead, 0)} m (needed ≈ ${fmt(a.drift, 0)} m).`, data });
        }
        if (layerId !== "accel") {
          if (Math.abs(leadFrac) < 0.2)
            record({ challenge: "drop-zone", concept: "inertia", signal: "contradicts", weight: 0.7, summary: "First drop released almost directly above the flag.", data });
          else if (leadFrac >= 0.6 && leadFrac <= 1.4)
            record({ challenge: "drop-zone", concept: "inertia", signal: "supports", weight: 0.5, summary: `First drop released ${fmt(lead, 0)} m before the flag — led the target.`, data });
        }
      }
      if (prev) {
        const prevMiss = prev.landX - prev.targetX;
        if (Math.abs(prevMiss) > TARGET_HALF) {
          // Compare leads, not raw positions, because the flag moves between attempts.
          const prevLead = prev.targetX - prev.releaseX;
          const delta = lead - prevLead;
          const wanted = Math.sign(prevMiss); // overshot → need more lead
          if (Math.abs(delta) < 3)
            record({ challenge: "drop-zone", concept: "directed-correction", signal: "neutral", weight: 0.1, summary: "Repeated nearly the same lead after a miss.", data });
          else if (Math.sign(delta) === wanted)
            record({ challenge: "drop-zone", concept: "directed-correction", signal: "supports", weight: 0.35, summary: `After ${prevMiss > 0 ? "overshooting" : "falling short"}, ${delta > 0 ? "increased" : "reduced"} the lead — the right direction.`, data });
          else
            record({ challenge: "drop-zone", concept: "directed-correction", signal: "contradicts", weight: 0.35, summary: `After ${prevMiss > 0 ? "overshooting" : "falling short"}, adjusted the lead the wrong way.`, data });
        }
      }
    },
    [layerId],
  );

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "flying") drop();
      } else if (e.code === "Enter" && phase === "ready") {
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, drop, start]);

  /* ---------- frame ---------- */

  const onFrame = ({ ctx, w, h, dt }: FrameInfo) => {
    const s = sim.current;
    const groundY = h - 72;
    const scale = Math.min(w / WORLD_W, (groundY - 90) / H);

    if (s.running) {
      s.t += dt;
      const r = s.release;
      // strobe samples on a fixed clock relative to release
      if (r) {
        while (s.strobe.length * STROBE_DT <= Math.min(s.t - r.t, T_FALL) + 1e-9) {
          const tau = s.strobe.length * STROBE_DT;
          s.strobe.push({ x: r.x + r.vx * tau, y: H - 0.5 * G * tau * tau });
          s.planeTicks.push(planeX(L, r.t + tau));
        }
        if (!s.landed && s.t - r.t >= T_FALL) {
          const landX = r.x + r.vx * T_FALL;
          s.landed = { x: landX };
          s.strobe.push({ x: landX, y: 0 });
          s.planeTicks.push(planeX(L, r.t + T_FALL));
          const attempt: Attempt = { releaseX: r.x, landX, targetX: s.targetX, drift: r.vx * T_FALL };
          const prev = s.attempts[s.attempts.length - 1];
          s.attempts.push(attempt);
          setAttempts(s.attempts.length);
          logPrediction(r.vx * T_FALL);
          logAttempt(attempt, prev, s.attempts.length === 1);
          const miss = landX - s.targetX;
          setResult({ miss, hit: Math.abs(miss) <= TARGET_HALF });
          setPhase("landed");
        }
      }
      const px = planeX(L, s.t);
      if (px > WORLD_LEFT + WORLD_W + 80 && (!r || s.landed)) {
        s.running = false;
        if (!r) setPhase("gone");
      }
    }

    // view
    const pX = planeX(L, s.t);
    let ox: number;
    if (L.frame === "pilot") ox = w * 0.3 - pX * scale;
    else ox = Math.max(0, (w - WORLD_W * scale) / 2) - WORLD_LEFT * scale;
    const v: View = { scale, ox, oy: groundY };
    view.current = v;

    clear(ctx, w, h);
    metricGrid(ctx, v, w, h, 10, 50);
    ground(ctx, v, w, h);

    // target + previous landings
    const tp = toPx(v, s.targetX, 0);
    target(ctx, tp.x, groundY, TARGET_HALF * scale);
    for (const a of s.attempts.slice(0, s.landed ? -1 : undefined)) {
      if (a.targetX !== s.targetX) continue;
      const p = toPx(v, a.landX, 0);
      dot(ctx, p.x, p.y - 2, 2.5, C.trailSoft);
    }

    // sketch: rides with the plane until release (ground view) or forever (pilot view)
    const anchor: Pt =
      s.release && L.frame === "ground" ? { x: s.release.x, y: H } : { x: pX, y: H };
    if (s.sketch.length > 1) {
      const pts = s.sketch.map((q) => toPx(v, anchor.x + q.x, anchor.y + q.y));
      polyline(ctx, pts, phase === "predict" ? C.ink : C.inkSoft, phase === "predict" ? 2 : 1.75, phase === "predict" ? [] : [6, 5]);
    }
    if (phase === "predict" && L.predict === "sketch" && s.sketch.length === 0) {
      const a = toPx(v, anchor.x, anchor.y);
      const pulse = 4 + 2 * Math.sin(performance.now() / 250);
      ctx.beginPath();
      ctx.arc(a.x, a.y + 6, 6 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = C.inkSoft;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(ctx, "start here", a.x + 16, a.y + 24, C.ink, 10);
    }

    // where the plane was at each strobe flash (reveals relative motion without words)
    if (s.release) {
      for (const x of s.planeTicks) {
        const p = toPx(v, x, H);
        ctx.strokeStyle = C.trailSoft;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4);
        ctx.lineTo(p.x, p.y + 4);
        ctx.stroke();
      }
      for (let i = 0; i < s.strobe.length; i++) {
        const p = toPx(v, s.strobe[i].x, s.strobe[i].y);
        dot(ctx, p.x, p.y, 2.6, C.trail);
      }
    }

    // package
    let pkg: Pt | null = null;
    if (s.release && !s.landed) {
      const tau = s.t - s.release.t;
      pkg = { x: s.release.x + s.release.vx * tau, y: H - 0.5 * G * tau * tau };
    } else if (s.landed) {
      pkg = { x: s.landed.x, y: 0 };
    }
    if (pkg) {
      const p = toPx(v, pkg.x, pkg.y);
      bob(ctx, p.x, p.y - 5, 5);
    }

    // plane
    const pp = toPx(v, pX, H);
    plane(ctx, pp.x, pp.y - 10, Math.max(0.8, Math.min(1.2, scale / 2.2)));
    if (!s.release) bob(ctx, pp.x, pp.y + 2, 4);

    // miss annotation
    if (s.landed) {
      const p = toPx(v, s.landed.x, 0);
      const miss = s.landed.x - s.targetX;
      ctx.strokeStyle = "#a3a3a3";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(p.x, groundY + 6);
      ctx.lineTo(p.x, groundY + 26);
      ctx.moveTo(tp.x, groundY + 6);
      ctx.lineTo(tp.x, groundY + 26);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, `Δ ${signed(miss)} m`, (p.x + tp.x) / 2, groundY + 40, C.labelDark, 11, "center");
    }

    if (L.frame === "pilot") label(ctx, "camera moves with the plane", w - 16, 22 + 48, C.label, 10, "right");

    // stats ~10 Hz
    const now = performance.now();
    if (now - lastStats.current > 100) {
      lastStats.current = now;
      let vx = NaN;
      let vy = NaN;
      let alt = H;
      if (s.release && !s.landed) {
        const tau = s.t - s.release.t;
        vx = s.release.vx;
        vy = -G * tau;
        alt = H - 0.5 * G * tau * tau;
      } else if (s.landed) alt = 0;
      setStats({ t: s.t, v: planeV(L, s.t), vx, vy, alt });
    }
  };

  /* ---------- sketch input ---------- */

  const canSketch = phase === "predict" && L.predict === "sketch";

  const rel = (p: { x: number; y: number }): Pt => {
    const v = view.current;
    const wpt = toWorld(v, p.x, p.y);
    const pX = planeX(L, sim.current.t);
    return { x: wpt.x - pX, y: wpt.y - H };
  };

  const onDown = (p: { x: number; y: number }) => {
    if (!canSketch) return;
    const s = sim.current;
    s.drawing = true;
    s.sketch = [{ x: 0, y: 0 }, rel(p)];
  };
  const onMove = (p: { x: number; y: number }) => {
    const s = sim.current;
    if (!s.drawing) return;
    const q = rel(p);
    const last = s.sketch[s.sketch.length - 1];
    if (Math.hypot(q.x - last.x, q.y - last.y) * view.current.scale > 2) s.sketch.push(q);
  };
  const onUp = () => {
    const s = sim.current;
    if (!s.drawing) return;
    s.drawing = false;
    setHasSketch(s.sketch.length > 4);
  };

  const commitSketch = () => setPhase("ready");
  const clearSketch = () => {
    sim.current.sketch = [];
    setHasSketch(false);
  };

  const saveNote = () => {
    if (!note.trim()) return;
    record({
      challenge: "drop-zone",
      concept: L.concepts[0],
      signal: "neutral",
      weight: 0,
      summary: `Explanation (${L.label}): “${note.trim()}”`,
      data: { layer: layerId, text: note.trim() },
    });
    setNoteSaved(true);
  };

  /* ---------- UI ---------- */

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={layerId}
          onChange={switchLayer}
          options={(Object.keys(LAYERS) as LayerId[]).map((id) => ({ value: id, label: LAYERS[id].label }))}
        />
      </div>

      <CanvasCard>
        <SimCanvas
          ariaLabel="Drop Zone simulation: a plane flies over a flag and drops a package"
          onFrame={onFrame}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          cursor={canSketch ? "crosshair" : phase === "flying" ? "pointer" : "default"}
        />

        {phase === "predict" && L.predict === "sketch" && (
          <PromptCard step={L.step} title={L.title}>
            <p>{L.body}</p>
            <div className="mt-3 flex gap-2">
              <PillButton onClick={commitSketch} disabled={!hasSketch}>
                Lock in sketch
              </PillButton>
              {hasSketch && (
                <PillButton variant="ghost" onClick={clearSketch}>
                  Redraw
                </PillButton>
              )}
            </div>
          </PromptCard>
        )}

        {phase === "predict" && L.predict === "choice" && (
          <PromptCard step={L.step} title={L.title}>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["behind", "under", "ahead"] as Choice[]).map((c) => (
                <PillButton key={c} variant="ghost" onClick={() => logChoice(c)}>
                  {c === "behind" ? "Behind the plane" : c === "under" ? "Directly under it" : "Ahead of the plane"}
                </PillButton>
              ))}
            </div>
          </PromptCard>
        )}

        {phase === "ready" && (
          <PromptCard step={`${L.step} · attempt ${attempts + 1}`} title={L.predict === "none" && attempts === 0 ? L.title : "Ready when you are."}>
            <p>{L.predict === "none" && attempts === 0 ? L.body : "Start the flight, then drop with Space or the Drop button."}</p>
            {choice && <p className="mt-1 font-mono text-[10px] text-neutral-400">your call: {choice}</p>}
            <div className="mt-3 flex gap-2">
              <PillButton onClick={start}>
                {Icon.play} Start flight
              </PillButton>
            </div>
          </PromptCard>
        )}

        {phase === "flying" && (
          <PromptCard step={`${L.step} · attempt ${attempts + 1}`} title={released ? "Falling…" : "Drop when it feels right."}>
            <div className="mt-2">
              <PillButton onClick={drop} disabled={released}>
                {Icon.drop} Drop
              </PillButton>
              <span className="ml-2 font-mono text-[10px] text-neutral-400">or Space</span>
            </div>
          </PromptCard>
        )}

        {phase === "landed" && result && (
          <PromptCard
            step={`${L.step} · attempt ${attempts}`}
            title={result.hit ? "On the flag." : `Landed ${fmt(Math.abs(result.miss))} m ${result.miss > 0 ? "past" : "short of"} the flag.`}
          >
            {!noteSaved ? (
              <form
                className="mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveNote();
                }}
              >
                <label className="mb-1 block text-xs text-neutral-500" htmlFor="dz-note">
                  {L.predict === "sketch" && attempts === 1
                    ? "Where did the real path first part ways with your sketch, and why might that be?"
                    : "What will you change next time, and why?"}
                </label>
                <textarea
                  id="dz-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 outline-none focus:border-neutral-400"
                  placeholder="One sentence is plenty"
                />
                <div className="mt-2 flex gap-2">
                  <PillButton type="submit" disabled={!note.trim()}>
                    Save
                  </PillButton>
                  <PillButton variant="ghost" onClick={nextAttempt}>
                    Skip · next attempt
                  </PillButton>
                </div>
              </form>
            ) : (
              <div className="mt-3 flex gap-2">
                <PillButton
                  onClick={() => {
                    setNote("");
                    setNoteSaved(false);
                    nextAttempt();
                  }}
                >
                  Next attempt
                </PillButton>
              </div>
            )}
          </PromptCard>
        )}

        {phase === "gone" && (
          <PromptCard step={L.step} title="The plane flew past without dropping.">
            <div className="mt-2">
              <PillButton onClick={nextAttempt}>Try again</PillButton>
            </div>
          </PromptCard>
        )}

        <Toolbar>
          <ToolButton title="Start flight (Enter)" onClick={start} disabled={phase !== "ready"}>
            {Icon.play}
          </ToolButton>
          <ToolButton title="Drop (Space)" onClick={drop} disabled={phase !== "flying"}>
            {Icon.drop}
          </ToolButton>
          <ToolDivider />
          <ToolButton title="Clear sketch" onClick={clearSketch} disabled={!canSketch}>
            {Icon.erase}
          </ToolButton>
          <ToolButton title="Restart layer" onClick={resetLayer}>
            {Icon.reset}
          </ToolButton>
        </Toolbar>

        <StatsBar>
          <Stat k="t" v={fmt(stats.t)} unit="s" />
          <Divider />
          <Stat k="plane v" v={fmt(stats.v)} unit="m/s" />
          <Divider />
          <Stat k="pkg vx" v={fmt(stats.vx)} unit="m/s" />
          <Divider />
          <Stat k="pkg vy" v={fmt(stats.vy)} unit="m/s" />
          <Divider />
          <Stat k="alt" v={fmt(stats.alt)} unit="m" />
          <Divider />
          <Stat k="tries" v={`${attempts}`} />
        </StatsBar>
      </CanvasCard>

      <AnalyzerPanel challenge="drop-zone" concepts={["inertia", "gravity-accel", "frames", "release-velocity", "drift-scales", "directed-correction"]} />
    </>
  );
}

function Divider() {
  return <div className="h-3 w-px bg-neutral-200" />;
}
