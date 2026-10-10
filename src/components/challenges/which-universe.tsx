"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnalyzerPanel } from "@/components/analyzer-panel";
import { SimCanvas, type FrameInfo } from "@/components/sim-canvas";
import { Icon, PillButton } from "@/components/ui";
import { C, bob, car, cart, clear, dot, dotGrid, ground, label, toPx, type View } from "@/lib/draw";
import { record, type ConceptId } from "@/lib/evidence";

const g = 9.8;

type Body = { x: number; y: number; kind: "ball" | "big" | "small" | "cart" | "car" };

type World = {
  key: string;
  real: boolean;
  /** what a learner who picks this fake believes — analyzer only, never shown */
  belief?: string;
  concept?: ConceptId;
  bodies: (t: number) => Body[];
};

type Round = {
  id: string;
  title: string;
  setup: string;
  box: { w: number; h: number };
  duration: number;
  strobe: number;
  /** body kinds that leave strobe dots */
  trail: Body["kind"][];
  worlds: World[];
  concepts: ConceptId[];
};

/* ---------- motion laws (true and false) ---------- */

const clampT = (t: number, T: number) => Math.min(Math.max(t, 0), T);

const projectile = (() => {
  const vx = 13;
  const vy = 14;
  const T = (2 * vy) / g;
  const ta = vy / g;
  const real = (t: number): Body => {
    const s = clampT(t, T);
    return { kind: "ball", x: 2 + vx * s, y: vy * s - 0.5 * g * s * s };
  };
  const hang = 0.7;
  const pause = (t: number): Body => (t < ta ? real(t) : t < ta + hang ? real(ta) : real(t - hang));
  const k = 0.65;
  const impetus = (t: number): Body => {
    const s = clampT(t, T);
    return { kind: "ball", x: 2 + (vx / k) * (1 - Math.exp(-k * s)), y: vy * s - 0.5 * g * s * s };
  };
  return { real, pause, impetus };
})();

const tossCart = (() => {
  const u = 6;
  const vy = 9.8;
  const T = (2 * vy) / g;
  const cartAt = (t: number): Body => ({ kind: "cart", x: 2 + u * t, y: 0 });
  const ball = (t: number, vx: number): Body => {
    const s = clampT(t, T);
    return { kind: "ball", x: 2 + vx * s, y: 1.4 + vy * s - 0.5 * g * s * s };
  };
  return {
    real: (t: number) => [cartAt(t), ball(t, u)],
    behind: (t: number) => [cartAt(t), ball(t, 0)],
    ahead: (t: number) => [cartAt(t), ball(t, u * 1.6)],
  };
})();

const twoDrops = (() => {
  const h = 20;
  const fall = (t: number, a: number) => Math.max(0, h - 0.5 * a * t * t);
  const steady = (t: number) => Math.max(0, h - 10 * t);
  return {
    real: (t: number): Body[] => [
      { kind: "big", x: 7, y: fall(t, g) },
      { kind: "small", x: 15, y: fall(t, g) },
    ],
    heavyFirst: (t: number): Body[] => [
      { kind: "big", x: 7, y: fall(t, g) },
      { kind: "small", x: 15, y: fall(t, g * 0.55) },
    ],
    steady: (t: number): Body[] => [
      { kind: "big", x: 7, y: steady(t) },
      { kind: "small", x: 15, y: steady(t) },
    ],
  };
})();

const braking = (() => {
  const v0 = 16;
  const a = 4;
  const Ts = v0 / a; // 4 s
  const D = (v0 * v0) / (2 * a); // 32 m
  return {
    real: (t: number): Body[] => {
      const s = clampT(t, Ts);
      return [{ kind: "car", x: 3 + v0 * s - 0.5 * a * s * s, y: 0 }];
    },
    uniformStop: (t: number): Body[] => [{ kind: "car", x: 3 + (D / Ts) * clampT(t, Ts), y: 0 }],
    lateBrake: (t: number): Body[] => {
      const s = clampT(t, Ts);
      return [{ kind: "car", x: 3 + D * (1 - (1 - s / Ts) ** 0.45), y: 0 }];
    },
  };
})();

const tossUp = (() => {
  const v = 15;
  const T = (2 * v) / g;
  const top = (v * v) / (2 * g);
  const drift = 0.55; // a little sideways drift so up and down dots don't overlap
  const real = (t: number): Body => {
    const s = clampT(t, T);
    return { kind: "ball", x: 2.5 + drift * s, y: v * s - 0.5 * g * s * s };
  };
  const hang = 0.8;
  return {
    real: (t: number) => [real(t)],
    hang: (t: number) => [t < T / 2 ? real(t) : t < T / 2 + hang ? { ...real(T / 2), x: 2.5 + drift * t } : { ...real(t - hang), x: 2.5 + drift * clampT(t, T + hang) }],
    steady: (t: number): Body[] => {
      const s = clampT(t, T);
      const y = s < T / 2 ? (top * s) / (T / 2) : top * (1 - (s - T / 2) / (T / 2));
      return [{ kind: "ball", x: 2.5 + drift * s, y }];
    },
  };
})();

const ROUNDS: Round[] = [
  {
    id: "throw",
    title: "A ball is thrown forward and upward.",
    setup: "No air resistance in any of these worlds.",
    box: { w: 34, h: 13 },
    duration: 3.6,
    strobe: 0.2,
    trail: ["ball"],
    concepts: ["apex", "inertia"],
    worlds: [
      { key: "real", real: true, bodies: (t) => [projectile.real(t)] },
      { key: "pause", real: false, concept: "apex", belief: "the ball pauses at the top of its path", bodies: (t) => [projectile.pause(t)] },
      { key: "impetus", real: false, concept: "inertia", belief: "forward speed fades away while the ball is in the air", bodies: (t) => [projectile.impetus(t)] },
    ],
  },
  {
    id: "cart",
    title: "A cart rolls at a steady speed. It tosses a ball straight up.",
    setup: "Straight up, as seen by someone riding the cart.",
    box: { w: 27, h: 7 },
    duration: 2.8,
    strobe: 0.2,
    trail: ["ball"],
    concepts: ["inertia", "frames"],
    worlds: [
      { key: "real", real: true, bodies: tossCart.real },
      { key: "behind", real: false, concept: "inertia", belief: "a ball tossed from a moving cart is left behind", bodies: tossCart.behind },
      { key: "ahead", real: false, concept: "frames", belief: "a tossed ball races ahead of the cart that threw it", bodies: tossCart.ahead },
    ],
  },
  {
    id: "drop",
    title: "A heavy ball and a light ball are released together from 20 m.",
    setup: "Same size of push — none. Air resistance is switched off.",
    box: { w: 22, h: 22 },
    duration: 3.2,
    strobe: 0.25,
    trail: ["big", "small"],
    concepts: ["mass-independence", "gravity-accel"],
    worlds: [
      { key: "real", real: true, bodies: twoDrops.real },
      { key: "heavy", real: false, concept: "mass-independence", belief: "heavier objects fall faster", bodies: twoDrops.heavyFirst },
      { key: "steady", real: false, concept: "gravity-accel", belief: "falling objects move at a constant speed", bodies: twoDrops.steady },
    ],
  },
  {
    id: "brake",
    title: "A car brakes to a stop. The camera flashes every half second.",
    setup: "The driver presses the brake at the first flash and holds it.",
    box: { w: 40, h: 7 },
    duration: 4.8,
    strobe: 0.5,
    trail: ["car"],
    concepts: ["decel-spacing", "spacing-speed"],
    worlds: [
      { key: "real", real: true, bodies: braking.real },
      { key: "uniform", real: false, concept: "decel-spacing", belief: "a braking car keeps a steady speed and then stops instantly", bodies: braking.uniformStop },
      { key: "late", real: false, concept: "spacing-speed", belief: "a braking car stops instantly from high speed", bodies: braking.lateBrake },
    ],
  },
  {
    id: "up",
    title: "A ball is thrown straight up and caught at the same height.",
    setup: "The camera drifts slightly sideways so you can see both trips.",
    box: { w: 8, h: 14 },
    duration: 4.0,
    strobe: 0.2,
    trail: ["ball"],
    concepts: ["apex", "gravity-accel"],
    worlds: [
      { key: "real", real: true, bodies: tossUp.real },
      { key: "hang", real: false, concept: "apex", belief: "the ball hangs at the top before falling", bodies: tossUp.hang },
      { key: "steady", real: false, concept: "gravity-accel", belief: "the ball rises and falls at an unchanging speed", bodies: tossUp.steady },
    ],
  },
];

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- a single universe panel ---------- */

function UniversePanel({
  round,
  world,
  letter,
  clock,
  selected,
  onSelect,
}: {
  round: Round;
  world: World;
  letter: string;
  clock: React.RefObject<number>;
  selected: boolean;
  onSelect: () => void;
}) {
  const onFrame = ({ ctx, w, h }: FrameInfo) => {
    const loop = round.duration + 1.0;
    const t = Math.min(((performance.now() - clock.current) / 1000) % loop, round.duration);
    const pad = 22;
    const groundY = h - 34;
    const scale = Math.min((w - pad * 2) / round.box.w, (groundY - 30) / round.box.h);
    const v: View = { scale, ox: (w - round.box.w * scale) / 2, oy: groundY };

    clear(ctx, w, h);
    dotGrid(ctx, w, h, 20);
    ground(ctx, v, w, h);

    // strobe history up to now
    const n = Math.floor(t / round.strobe + 1e-9);
    for (let i = 0; i <= n; i++) {
      for (const b of world.bodies(i * round.strobe)) {
        if (!round.trail.includes(b.kind)) continue;
        const p = toPx(v, b.x, b.y);
        if (b.kind === "car") {
          ctx.strokeStyle = C.trailSoft;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + 4);
          ctx.lineTo(p.x, p.y + 12);
          ctx.stroke();
          dot(ctx, p.x, p.y + 16, 2.2, C.trail);
        } else {
          const r = b.kind === "big" ? 3 : 2.2;
          dot(ctx, p.x, p.y - (b.kind === "big" ? 7 : b.kind === "small" ? 4 : 4), r, C.trail);
        }
      }
    }

    for (const b of world.bodies(t)) {
      const p = toPx(v, b.x, b.y);
      if (b.kind === "cart") cart(ctx, p.x, p.y);
      else if (b.kind === "car") car(ctx, p.x, p.y, 0.9);
      else if (b.kind === "big") bob(ctx, p.x, p.y - 7, 7);
      else if (b.kind === "small") bob(ctx, p.x, p.y - 4, 4);
      else bob(ctx, p.x, p.y - 4, 4);
    }

    label(ctx, `t ${t.toFixed(1)} s`, w - 12, 20, C.label, 10, "right");
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition-all duration-200 ${
        selected ? "border-neutral-900 shadow-lg shadow-neutral-200/60" : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <div className="relative h-[300px] w-full">
        <SimCanvas onFrame={onFrame} ariaLabel={`Universe ${letter}`} className="absolute inset-0 h-full w-full" />
        <span
          className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-medium ${
            selected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {letter}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
        <span className="text-xs font-medium text-neutral-500">Universe {letter}</span>
        <span className={`text-[11px] font-medium ${selected ? "text-neutral-900" : "text-neutral-300 group-hover:text-neutral-500"}`}>
          {selected ? "Your pick" : "This one is real"}
        </span>
      </div>
    </button>
  );
}

/* ---------- the challenge ---------- */

type Stage = "intro" | "round" | "done";

export function WhichUniverse() {
  const [stage, setStage] = useState<Stage>("intro");
  const [roundIdx, setRoundIdx] = useState(0);
  const [order, setOrder] = useState<World[][]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [why, setWhy] = useState("");
  const [replays, setReplays] = useState(0);
  const clock = useRef(0);
  const shownAt = useRef(0);

  const begin = () => {
    setOrder(ROUNDS.map((r) => shuffle(r.worlds)));
    setRoundIdx(0);
    setPicked(null);
    setWhy("");
    setReplays(0);
    clock.current = performance.now();
    shownAt.current = Date.now();
    setStage("round");
  };

  const replay = () => {
    clock.current = performance.now();
    setReplays((n) => n + 1);
  };

  const round = ROUNDS[roundIdx];
  const worlds = order[roundIdx] ?? [];

  const lockIn = () => {
    if (picked === null) return;
    const w = worlds[picked];
    const data = { round: round.id, pick: w.key, ms: Date.now() - shownAt.current, replays };
    if (w.real) {
      for (const f of round.worlds.filter((x) => !x.real)) {
        record({
          challenge: "which-universe",
          concept: f.concept!,
          signal: "supports",
          weight: 0.35,
          summary: `“${round.title}” — rejected the world where ${f.belief}.`,
          data,
        });
      }
    } else {
      record({
        challenge: "which-universe",
        concept: w.concept!,
        signal: "contradicts",
        weight: 0.6,
        summary: `“${round.title}” — judged real the world where ${w.belief}.`,
        data,
      });
    }
    if (why.trim()) {
      record({
        challenge: "which-universe",
        concept: w.concept ?? round.concepts[0],
        signal: "neutral",
        weight: 0,
        summary: `Reason given: “${why.trim()}”`,
        data: { ...data, text: why.trim() },
      });
    }
    if (roundIdx + 1 >= ROUNDS.length) {
      setStage("done");
      return;
    }
    setRoundIdx(roundIdx + 1);
    setPicked(null);
    setWhy("");
    setReplays(0);
    clock.current = performance.now();
    shownAt.current = Date.now();
  };

  if (stage === "intro") {
    return (
      <>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{ROUNDS.length} rounds · 3 worlds each</div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Only one of three worlds obeys the laws of motion.</h2>
          <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
            Each round plays the same scene in three universes. Watch them as many times as you like, pick the one you believe is
            real, and — if you can — say what gave the others away. You won&apos;t be told whether you were right.
          </p>
          <PillButton onClick={begin}>{Icon.play} Begin</PillButton>
        </div>
        <AnalyzerPanel challenge="which-universe" concepts={["apex", "inertia", "frames", "mass-independence", "gravity-accel", "decel-spacing", "spacing-speed"]} />
      </>
    );
  }

  if (stage === "done") {
    return (
      <>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">All rounds recorded</div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">That&apos;s every universe.</h2>
          <p className="max-w-lg text-sm leading-relaxed text-neutral-500">
            Your picks are saved as evidence, not scores. The other challenges will put the same ideas to work in situations you
            control.
          </p>
          <div className="flex gap-2">
            <Link href="/drop-zone" className="inline-flex h-8 items-center rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-700">
              Try Drop Zone
            </Link>
            <PillButton variant="ghost" onClick={begin}>
              Play again
            </PillButton>
          </div>
        </div>
        <AnalyzerPanel challenge="which-universe" concepts={["apex", "inertia", "frames", "mass-independence", "gravity-accel", "decel-spacing", "spacing-speed"]} />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            Round {roundIdx + 1} / {ROUNDS.length}
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900">{round.title}</h2>
          <p className="text-sm text-neutral-500">{round.setup}</p>
        </div>
        <PillButton variant="ghost" onClick={replay}>
          {Icon.reset} Replay together
        </PillButton>
      </div>

      <div key={round.id} className="grid gap-4 md:grid-cols-3">
        {worlds.map((w, i) => (
          <UniversePanel
            key={w.key}
            round={round}
            world={w}
            letter={"ABC"[i]}
            clock={clock}
            selected={picked === i}
            onSelect={() => setPicked(i)}
          />
        ))}
      </div>

      <form
        className="mt-4 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          lockIn();
        }}
      >
        <label htmlFor="wu-why" className="shrink-0 text-xs font-medium text-neutral-500">
          {picked === null ? "Pick a universe" : `Why ${"ABC"[picked]}?`}
        </label>
        <input
          id="wu-why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          disabled={picked === null}
          placeholder="What gave the other two away? (optional)"
          className="h-8 flex-1 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-800 outline-none focus:border-neutral-400 disabled:bg-neutral-50"
        />
        <PillButton type="submit" disabled={picked === null}>
          Lock in
        </PillButton>
      </form>

      <AnalyzerPanel challenge="which-universe" concepts={round.concepts} />
    </>
  );
}
