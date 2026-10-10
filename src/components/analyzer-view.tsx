"use client";

import { EvidenceRow, STATUS_STYLE } from "@/components/analyzer-panel";
import { PillButton } from "@/components/ui";
import { CONCEPTS, clearEvidence, conceptStates, useEvidence } from "@/lib/evidence";

export function AnalyzerView() {
  const evidence = useEvidence();
  const states = conceptStates(evidence);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), evidence }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "intuition-lab-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">Learner model</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {states.map((s) => {
            const st = STATUS_STYLE[s.status];
            const total = s.support + s.against;
            return (
              <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-neutral-900">{CONCEPTS[s.id].name}</h3>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{CONCEPTS[s.id].claim}</p>
                <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  {total > 0 && (
                    <>
                      <div className="bg-emerald-400" style={{ width: `${(s.support / total) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(s.against / total) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-neutral-400">
                  <span>+{s.support.toFixed(2)}</span>
                  <span>{s.count} obs</span>
                  <span>−{s.against.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">Evidence timeline</span>
          <span className="h-px flex-1 bg-neutral-200" />
          <span className="font-mono text-xs text-neutral-400">{evidence.length}</span>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-2">
          {evidence.length === 0 ? (
            <p className="py-6 text-xs text-neutral-400">
              Nothing observed yet. Play a challenge — every concept stays <em>untested</em> until there is evidence.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {[...evidence].reverse().map((e) => (
                <EvidenceRow key={e.id} e={e} showChallenge />
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <PillButton variant="ghost" onClick={exportJson} disabled={evidence.length === 0}>
            Export JSON
          </PillButton>
          <PillButton variant="ghost" onClick={() => clearEvidence()} disabled={evidence.length === 0}>
            Clear all
          </PillButton>
        </div>
      </section>
    </div>
  );
}
