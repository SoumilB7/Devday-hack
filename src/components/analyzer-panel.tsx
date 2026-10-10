"use client";

import { useState } from "react";
import {
  CONCEPTS,
  clearEvidence,
  conceptStates,
  useEvidence,
  type ChallengeId,
  type ConceptId,
  type ConceptStatus,
  type Evidence,
} from "@/lib/evidence";

export const STATUS_STYLE: Record<ConceptStatus, { label: string; cls: string; dot: string }> = {
  untested: { label: "Untested", cls: "bg-neutral-50 text-neutral-400 border-neutral-100", dot: "bg-neutral-300" },
  uncertain: { label: "Uncertain", cls: "bg-neutral-50 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" },
  demonstrated: { label: "Demonstrated", cls: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" },
  contradicted: { label: "Contradicted", cls: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" },
  mixed: { label: "Mixed", cls: "bg-violet-50 text-violet-700 border-violet-100", dot: "bg-violet-500" },
};

const SIGNAL_MARK: Record<Evidence["signal"], { sym: string; cls: string }> = {
  supports: { sym: "+", cls: "text-emerald-600 bg-emerald-50" },
  contradicts: { sym: "−", cls: "text-amber-600 bg-amber-50" },
  neutral: { sym: "·", cls: "text-neutral-400 bg-neutral-50" },
};

export function EvidenceRow({ e, showChallenge }: { e: Evidence; showChallenge?: boolean }) {
  const m = SIGNAL_MARK[e.signal];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-xs ${m.cls}`}>
        {m.sym}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs leading-relaxed text-neutral-700">{e.summary}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-neutral-400">
          <span>{CONCEPTS[e.concept].name}</span>
          {showChallenge && <span>{e.challenge}</span>}
          <span>w {e.weight.toFixed(2)}</span>
          <span>{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
      </div>
    </li>
  );
}

/**
 * Researcher view under a challenge. Learners never see verdicts on the
 * canvas itself; this panel is collapsed by default.
 */
export function AnalyzerPanel({ challenge, concepts }: { challenge: ChallengeId; concepts: ConceptId[] }) {
  const all = useEvidence();
  const [open, setOpen] = useState(false);
  const mine = all.filter((e) => e.challenge === challenge);
  const states = conceptStates(mine).filter((s) => concepts.includes(s.id));

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">Analyzer</span>
        <span className="text-xs text-neutral-400">researcher view</span>
        <span className="h-px flex-1 bg-neutral-100" />
        <span className="font-mono text-xs text-neutral-400">{mine.length} obs</span>
        <svg
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-neutral-100 px-5 pb-5 pt-4">
          <div className="flex flex-wrap gap-2">
            {states.map((s) => {
              const st = STATUS_STYLE[s.status];
              return (
                <span
                  key={s.id}
                  title={CONCEPTS[s.id].claim}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${st.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {CONCEPTS[s.id].name}
                  <span className="font-mono opacity-60">{st.label}</span>
                </span>
              );
            })}
          </div>
          {mine.length === 0 ? (
            <p className="mt-4 text-xs text-neutral-400">No observations yet. Everything is untested — not wrong.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {[...mine].reverse().map((e) => (
                <EvidenceRow key={e.id} e={e} />
              ))}
            </ul>
          )}
          {mine.length > 0 && (
            <button
              type="button"
              onClick={() => clearEvidence(challenge)}
              className="mt-3 text-[11px] font-medium text-neutral-400 hover:text-neutral-900"
            >
              Clear this challenge
            </button>
          )}
        </div>
      )}
    </div>
  );
}
