import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, SiteHeader } from "@/components/ui";

type Challenge = {
  href: string;
  category: string;
  title: string;
  blurb: string;
  probes: string[];
  art: ReactNode;
  icon: ReactNode;
};

const CHALLENGES: Challenge[] = [
  {
    href: "/drop-zone",
    category: "Kinematics · Projectiles",
    title: "Drop Zone",
    blurb:
      "A plane flies over a target. Sketch where the package will fall, then choose your moment to release it. Four layers, each one harder to fake.",
    probes: ["Inertia", "Frames", "Acceleration"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 6h9l3-2" />
        <path d="M8 6 Q 13 8 16 19" strokeDasharray="1.5 2.5" />
        <path d="M13 20h7" />
      </svg>
    ),
    art: (
      <svg viewBox="0 0 240 140" className="h-auto w-full max-w-[240px]" fill="none">
        <line x1="10" y1="122" x2="230" y2="122" stroke="#e5e5e5" />
        <path d="M30 26 h40 l8 -5" stroke="#525252" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M52 30 Q 120 34 168 120" stroke="#d4d4d4" strokeDasharray="3 3" />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const t = i / 5;
          return <circle key={i} cx={52 + 116 * t} cy={30 + 90 * t * t} r="2.4" fill="#a3a3a3" />;
        })}
        <path d="M150 122 h36" stroke="#171717" strokeWidth="1.5" />
        <path d="M168 122 v-18 l9 3 -9 3" stroke="#171717" strokeWidth="1.2" fill="#171717" />
        <path d="M52 30 Q 64 70 58 120" stroke="#2563eb" strokeOpacity="0.5" strokeDasharray="4 3" />
      </svg>
    ),
  },
  {
    href: "/which-universe",
    category: "Kinematics · Perception",
    title: "Which Universe Is Real?",
    blurb:
      "Three worlds play the same scene. Only one follows the laws of motion. Pick the real one and say what gave the others away.",
    probes: ["Apex", "Mass", "Braking"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2.5" y="5" width="5.5" height="14" rx="1.5" />
        <rect x="9.25" y="5" width="5.5" height="14" rx="1.5" fill="currentColor" fillOpacity="0.15" />
        <rect x="16" y="5" width="5.5" height="14" rx="1.5" />
      </svg>
    ),
    art: (
      <svg viewBox="0 0 240 140" className="h-auto w-full max-w-[240px]" fill="none">
        {[0, 1, 2].map((k) => (
          <g key={k} transform={`translate(${12 + k * 76} 14)`}>
            <rect width="64" height="108" rx="8" fill="white" stroke={k === 1 ? "#525252" : "#e5e5e5"} />
            <line x1="6" y1="96" x2="58" y2="96" stroke="#e5e5e5" />
            {Array.from({ length: 7 }, (_, i) => {
              const t = i / 6;
              const x = 8 + 48 * (k === 2 ? 1 - (1 - t) ** 2 : t);
              const y = 94 - 76 * 4 * t * (1 - t) * (k === 0 && i === 3 ? 1 : 1);
              return <circle key={i} cx={x} cy={y} r="2.2" fill={k === 0 && i === 3 ? "#525252" : "#a3a3a3"} />;
            })}
            {k === 0 && <circle cx="32" cy="18" r="5" stroke="#d4d4d4" strokeDasharray="2 2" />}
          </g>
        ))}
      </svg>
    ),
  },
  {
    href: "/strobe",
    category: "Kinematics · Representation",
    title: "Strobe Prediction",
    blurb:
      "A camera flashes once per second. Place where the object will be at each flash — then run the world and compare against your own marks.",
    probes: ["Spacing", "Speeding up", "Braking"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        {[3, 9, 14, 18, 20.5].map((x) => (
          <circle key={x} cx={x} cy="12" r="1.6" fill="currentColor" fillOpacity="0.2" />
        ))}
        <path d="M2 17h20" />
      </svg>
    ),
    art: (
      <svg viewBox="0 0 240 140" className="h-auto w-full max-w-[240px]" fill="none">
        <line x1="14" y1="60" x2="226" y2="60" stroke="#e5e5e5" />
        <line x1="14" y1="104" x2="226" y2="104" stroke="#e5e5e5" />
        {[20, 70, 112, 146, 172, 190, 200].map((x, i) => (
          <circle key={i} cx={x} cy="60" r="3" fill="#a3a3a3" />
        ))}
        {[20, 55, 90, 125, 160, 195, 230 - 10].map((x, i) => (
          <circle key={i} cx={x} cy="104" r="3" fill="white" stroke="#2563eb" strokeOpacity="0.7" strokeWidth="1.5" />
        ))}
        <text x="14" y="46" fontFamily="monospace" fontSize="8" fill="#a3a3a3">WORLD</text>
        <text x="14" y="90" fontFamily="monospace" fontSize="8" fill="#93b4f5">YOU</text>
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="animate-fade-up mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">Intuition Lab</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-500">
            Challenges that show how you think about motion. You predict, the world runs, and nobody tells you the answer
            — the simulation is the only judge.
          </p>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">Kinematics</span>
          <span className="h-px flex-1 bg-neutral-200" />
          <span className="font-mono text-xs text-neutral-400">{CHALLENGES.length}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGES.map((c, i) => (
            <Link key={c.href} href={c.href} className="animate-fade-up" style={{ animationDelay: `${80 * i}ms` }}>
              <div className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-300 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-200/50">
                <div className="flex w-full items-center justify-center border-b border-neutral-100 bg-neutral-50 px-6 pb-4 pt-6">
                  {c.art}
                </div>
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium tracking-wide text-neutral-500">
                      {c.category}
                    </span>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-50 text-neutral-700 transition-colors duration-300 group-hover:bg-neutral-900 group-hover:text-white">
                        {c.icon}
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{c.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-500">{c.blurb}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {c.probes.map((p) => (
                        <span key={p} className="rounded-md border border-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 transition-colors duration-300 group-hover:text-neutral-900">
                      <span>Open</span>
                      {Icon.arrow}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <footer className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-neutral-400">
          <span>Intuition Lab — predict, run, explain</span>
          <span className="font-mono">v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
