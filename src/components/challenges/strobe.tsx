"use client";

import { useRef, useState } from "react";
import { AnalyzerPanel } from "@/components/analyzer-panel";
import { SimCanvas, type FrameInfo } from "@/components/sim-canvas";
import { CanvasCard, Icon, PillButton, PromptCard, Segmented, Stat, StatsBar, ToolButton, Toolbar } from "@/components/ui";
import { fmt, spacingFeatures } from "@/lib/analysis";
import { C, bob, car, clear, dot, dotGrid, label, target } from "@/lib/draw";
import { record } from "@/lib/evidence";

const FLASHES = 6;
const TRACK = 42; // metres shown

type ScenarioId = "walk" | "launch" | "brake" | "stop";

type Scenario = {
  label: string;
  title: string;
  body: string;
  kind: "walker" | "car";
  x: (t: number) => number;
  /** if set, the learner is told where it is at t = 6 and that dot is fixed */
  fixedEnd?: number;
  flag: number;
};

const SCENARIOS: Record<ScenarioId, Scenario> = {
  walk: {
    label: "Walker",
    title: "A walker keeps a perfectly steady pace and reaches the flag at the 6th flash.",
    body: "The camera flashes once per second. Mark where she is at each flash.",
    kind: "walker",
    x: (t) => 5 * t,
    fixedEnd: 30,
    flag: 30,
  },
  launch: {
    label: "Speeding up",
    title: "A car starts from rest and speeds up steadily. It passes the flag at the 6th flash.",
    body: "Mark where the car is at each flash.",
    kind: "car",
    x: (t) => t * t,
    fixedEnd: 36,
    flag: 36,
  },
  brake: {
    label: "Braking",
    title: "A car brakes steadily from the start line and comes to rest exactly at the flag at the 6th flash.",
    body: "Mark where the car is at each flash.",
    kind: "car",
    x: (t) => 12 * Math.min(t, 6) - Math.min(t, 6) ** 2,
    fixedEnd: 36,
    flag: 36,
  },
  stop: {
    label: "Hard stop",
    title: "A faster car brakes harder from the start line and comes to rest at the flag.",
    body: "This time you aren't told when it stops. Mark all six flashes.",
    kind: "car",
    x: (t) => {
      const s = Math.min(t, 4);
      return 16 * s - 2 * s * s;
    },
    flag: 32,
  },
};

type Phase = "place" | "running" | "done";

export function Strobe() {
  const [id, setId] = useState<ScenarioId>("walk");
  const S = SCENARIOS[id];
  const [marks, setMarks] = useState<(number | null)[]>(() => initialMarks(SCENARIOS.walk));
  const [phase, setPhase] = useState<Phase>("place");
  const [now, setNow] = useState(0);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const run = useRef({ t0: 0, t: 0, done: false });
  const geo = useRef({ ox: 0, scale: 1, worldY: 0, youY: 0 });
  const drag = useRef<number | null>(null);
  const lastTick = useRef(0);

  const editable = (i: number) => phase === "place" && i >= 1 && !(S.fixedEnd !== undefined && i === FLASHES);
  const placed = marks.filter((m) => m !== null).length;
  const complete = placed === FLASHES + 1;

  const switchScenario = (next: ScenarioId) => {
    setId(next);
    setMarks(initialMarks(SCENARIOS[next]));
    setPhase("place");
    setNow(0);
    setNote("");
    setNoteSaved(false);
  };

  const startRun = () => {
    if (!complete) return;
    run.current = { t0: performance.now(), t: 0, done: false };
    setPhase("running");
  };

  const finish = (ms: number[]) => {
    const f = spacingFeatures(ms);
    const data = { scenario: id, trend: f.trend, change: +f.change.toFixed(2), cv: +f.cv.toFixed(2), gaps: f.gaps.map((g) => g.toFixed(1)).join(",") };
    const ch = "strobe" as const;
    if (f.trend === "reversing") {
      record({ challenge: ch, concept: "spacing-speed", signal: "neutral", weight: 0.1, summary: `${S.label}: a mark sits behind the one before it — position went backwards.`, data });
    }
    if (id === "walk") {
      if (f.trend === "uniform") record({ challenge: ch, concept: "spacing-speed", signal: "supports", weight: 0.4, summary: "Steady walker drawn with equal gaps.", data });
      else if (f.trend === "growing" || f.trend === "shrinking")
        record({ challenge: ch, concept: "spacing-speed", signal: "contradicts", weight: 0.4, summary: `Steady walker drawn with ${f.trend} gaps.`, data });
      else record({ challenge: ch, concept: "spacing-speed", signal: "neutral", weight: 0.15, summary: "Steady walker drawn with uneven gaps — could be imprecise placement.", data });
    } else if (id === "launch") {
      if (f.trend === "growing") record({ challenge: ch, concept: "spacing-speed", signal: "supports", weight: 0.55, summary: "Speeding up drawn as growing gaps.", data });
      else if (f.trend === "shrinking")
        record({ challenge: ch, concept: "spacing-speed", signal: "contradicts", weight: 0.7, summary: "Speeding up drawn as shrinking gaps — reads crowded marks as fast.", data });
      else if (f.trend === "uniform") record({ challenge: ch, concept: "spacing-speed", signal: "contradicts", weight: 0.5, summary: "Speeding up drawn with equal gaps — speed change not represented.", data });
      else record({ challenge: ch, concept: "spacing-speed", signal: "neutral", weight: 0.15, summary: "Speeding up drawn with irregular gaps.", data });
    } else {
      if (f.trend === "shrinking")
        record({ challenge: ch, concept: "decel-spacing", signal: "supports", weight: id === "stop" ? 0.4 : 0.6, summary: `${S.label}: drawn as shrinking gaps.`, data });
      else if (f.trend === "growing")
        record({ challenge: ch, concept: "decel-spacing", signal: "contradicts", weight: 0.7, summary: `${S.label}: gaps grow while the car slows — spacing read backwards.`, data });
      else if (f.trend === "uniform")
        record({ challenge: ch, concept: "decel-spacing", signal: "contradicts", weight: 0.5, summary: `${S.label}: equal gaps — slowing down not represented.`, data });
      else record({ challenge: ch, concept: "decel-spacing", signal: "neutral", weight: 0.15, summary: `${S.label}: irregular gaps.`, data });
      if (id === "stop") {
        const lastGap = f.gaps[f.gaps.length - 1];
        record({
          challenge: ch,
          concept: "decel-spacing",
          signal: "neutral",
          weight: 0.1,
          summary: lastGap < 0.6 ? "Showed the car already at rest before the last flash." : `Still moving at the last flash (last gap ${fmt(lastGap)} m).`,
          data: { ...data, lastGap: +lastGap.toFixed(1) },
        });
      }
    }
  };

  const onFrame = ({ ctx, w, h }: FrameInfo) => {
    const pad = 36;
    const scale = (w - pad * 2) / TRACK;
    const ox = pad;
    const worldY = Math.round(h * 0.42);
    const youY = Math.round(h * 0.74);
    geo.current = { ox, scale, worldY, youY };
    const X = (m: number) => ox + m * scale;

    let t = 0;
    if (phase === "running") {
      t = Math.min(((performance.now() - run.current.t0) / 1000) * 1.2, FLASHES);
      run.current.t = t;
      if (t >= FLASHES && !run.current.done) {
        run.current.done = true;
        setPhase("done");
        finish(marks as number[]);
      }
    } else if (phase === "done") t = FLASHES;

    clear(ctx, w, h);
    dotGrid(ctx, w, h, 24);

    // ruler
    for (let m = 0; m <= TRACK; m += 2) {
      const x = Math.round(X(m)) + 0.5;
      const major = m % 10 === 0;
      ctx.strokeStyle = major ? "#d4d4d4" : "#ececec";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h - 40);
      ctx.lineTo(x, h - (major ? 30 : 35));
      ctx.stroke();
      if (major) label(ctx, `${m} m`, x, h - 16, C.label, 10, "center");
    }

    // lanes
    for (const [y, name, color] of [
      [worldY, "WORLD", C.label],
      [youY, "YOUR MARKS", C.ink],
    ] as const) {
      ctx.strokeStyle = "#e5e5e5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(0) - 12, y + 0.5);
      ctx.lineTo(X(TRACK) + 12, y + 0.5);
      ctx.stroke();
      label(ctx, name, X(0) - 12, y - 52, color, 10);
    }
    target(ctx, X(S.flag), worldY, 0);

    // world strobe so far
    const shown = phase === "place" ? -1 : Math.floor(t + 1e-9);
    for (let i = 0; i <= shown; i++) {
      const wx = X(S.x(i));
      dot(ctx, wx, worldY + 14, 3.2, C.trail);
      label(ctx, `${i}`, wx, worldY + 32, C.label, 9, "center");
      const m = marks[i];
      if (m !== null && m !== undefined) {
        ctx.strokeStyle = "rgba(37,99,235,0.18)";
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx, worldY + 18);
        ctx.lineTo(X(m), youY - 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // moving object (sits at start until run)
    const ox0 = X(S.x(phase === "place" ? 0 : t));
    if (S.kind === "car") car(ctx, ox0, worldY, 1);
    else {
      bob(ctx, ox0, worldY - 26, 5);
      ctx.strokeStyle = C.bodySoft;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox0, worldY - 21);
      ctx.lineTo(ox0, worldY - 9);
      const swing = phase === "running" ? Math.sin(t * 9) * 5 : 3;
      ctx.moveTo(ox0, worldY - 9);
      ctx.lineTo(ox0 - swing, worldY);
      ctx.moveTo(ox0, worldY - 9);
      ctx.lineTo(ox0 + swing, worldY);
      ctx.stroke();
    }

    // learner marks
    marks.forEach((m, i) => {
      if (m === null) return;
      const x = X(m);
      const fixed = !editable(i) && phase === "place";
      dot(ctx, x, youY - 6, 5.5, "#ffffff", fixed ? "#93b4f5" : C.ink);
      dot(ctx, x, youY - 6, 2, fixed ? "#93b4f5" : C.ink);
      label(ctx, `${i}`, x, youY - 18, fixed ? "#93b4f5" : C.ink, 10, "center");
    });

    // gap labels under learner marks
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1];
      const b = marks[i];
      if (a === null || b === null) continue;
      label(ctx, fmt(b - a), (X(a) + X(b)) / 2, youY + 16, "rgba(37,99,235,0.55)", 9, "center");
    }

    if (phase === "place") {
      const next = marks.findIndex((m, i) => m === null && i > 0);
      if (next > 0) label(ctx, `click the lane to place flash ${next}`, X(TRACK), youY + 34, C.label, 10, "right");
    }

    const n = performance.now();
    if (n - lastTick.current > 100) {
      lastTick.current = n;
      setNow(t);
    }
  };

  const toMetres = (px: number) => {
    const { ox, scale } = geo.current;
    return Math.max(0, Math.min(TRACK, (px - ox) / scale));
  };

  const onDown = (p: { x: number; y: number }) => {
    if (phase !== "place") return;
    const { youY, ox, scale } = geo.current;
    if (Math.abs(p.y - youY) > 60) return;
    // grab an existing editable mark?
    let best = -1;
    let bestD = 12;
    marks.forEach((m, i) => {
      if (m === null || !editable(i)) return;
      const d = Math.abs(ox + m * scale - p.x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      drag.current = best;
      return;
    }
    const next = marks.findIndex((m, i) => m === null && i > 0);
    if (next < 0) return;
    const copy = [...marks];
    copy[next] = toMetres(p.x);
    setMarks(copy);
    drag.current = next;
  };

  const onMove = (p: { x: number; y: number }) => {
    const i = drag.current;
    if (i === null) return;
    const copy = [...marks];
    copy[i] = toMetres(p.x);
    setMarks(copy);
  };

  const onUp = () => {
    drag.current = null;
  };

  const saveNote = () => {
    if (!note.trim()) return;
    record({
      challenge: "strobe",
      concept: id === "walk" || id === "launch" ? "spacing-speed" : "decel-spacing",
      signal: "neutral",
      weight: 0,
      summary: `Explanation (${S.label}): “${note.trim()}”`,
      data: { scenario: id, text: note.trim() },
    });
    setNoteSaved(true);
  };

  return (
    <>
      <div className="mb-4">
        <Segmented
          value={id}
          onChange={switchScenario}
          options={(Object.keys(SCENARIOS) as ScenarioId[]).map((k) => ({ value: k, label: SCENARIOS[k].label }))}
        />
      </div>
      <CanvasCard height="h-[460px]">
        <SimCanvas
          ariaLabel="Strobe track: place where the object will be at each camera flash"
          onFrame={onFrame}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          cursor={phase === "place" ? "crosshair" : "default"}
        />

        {phase === "place" && (
          <PromptCard step={`${S.label} · predict`} title={S.title}>
            <p>{S.body}</p>
            <div className="mt-3 flex gap-2">
              <PillButton onClick={startRun} disabled={!complete}>
                {Icon.play} Run the world
              </PillButton>
              <PillButton variant="ghost" onClick={() => setMarks(initialMarks(S))}>
                Clear marks
              </PillButton>
            </div>
          </PromptCard>
        )}

        {phase === "done" && (
          <PromptCard step={`${S.label} · compare`} title="Here is what the camera caught.">
            {!noteSaved ? (
              <form
                className="mt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveNote();
                }}
              >
                <label htmlFor="st-note" className="mb-1 block text-xs text-neutral-500">
                  Where do your marks and the world disagree most — and what would explain it?
                </label>
                <textarea
                  id="st-note"
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
                  <PillButton variant="ghost" onClick={() => switchScenario(nextScenario(id))}>
                    Next scenario
                  </PillButton>
                </div>
              </form>
            ) : (
              <div className="mt-2">
                <PillButton onClick={() => switchScenario(nextScenario(id))}>Next scenario</PillButton>
              </div>
            )}
          </PromptCard>
        )}

        <Toolbar>
          <ToolButton title="Run the world" onClick={startRun} disabled={phase !== "place" || !complete}>
            {Icon.play}
          </ToolButton>
          <ToolButton title="Start over" onClick={() => switchScenario(id)}>
            {Icon.reset}
          </ToolButton>
        </Toolbar>

        <StatsBar>
          <Stat k="t" v={fmt(now)} unit="s" />
          <div className="h-3 w-px bg-neutral-200" />
          <Stat k="marks" v={`${placed - 1}/${FLASHES}`} />
          <div className="h-3 w-px bg-neutral-200" />
          <Stat k="flash" v="1.0" unit="s" />
        </StatsBar>
      </CanvasCard>
      <AnalyzerPanel challenge="strobe" concepts={["spacing-speed", "decel-spacing"]} />
    </>
  );
}

function initialMarks(S: Scenario): (number | null)[] {
  const m: (number | null)[] = Array(FLASHES + 1).fill(null);
  m[0] = 0;
  if (S.fixedEnd !== undefined) m[FLASHES] = S.fixedEnd;
  return m;
}

function nextScenario(id: ScenarioId): ScenarioId {
  const ids = Object.keys(SCENARIOS) as ScenarioId[];
  return ids[(ids.indexOf(id) + 1) % ids.length];
}
