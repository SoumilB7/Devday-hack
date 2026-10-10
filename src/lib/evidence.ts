"use client";

import { useSyncExternalStore } from "react";

/**
 * The learner model. Challenges never grade; they emit evidence about
 * specific concepts. A concept's status is derived from the evidence, and
 * "untested" is a first-class state — missing evidence is not a gap.
 */

export type ChallengeId = "drop-zone" | "which-universe" | "strobe";

export type ConceptId =
  | "inertia"
  | "gravity-accel"
  | "apex"
  | "spacing-speed"
  | "decel-spacing"
  | "release-velocity"
  | "frames"
  | "mass-independence"
  | "drift-scales"
  | "directed-correction";

export const CONCEPTS: Record<ConceptId, { name: string; claim: string }> = {
  inertia: {
    name: "Horizontal inertia",
    claim: "A released object keeps moving sideways with the speed it had.",
  },
  "gravity-accel": {
    name: "Gravity accelerates",
    claim: "Falling speed grows over time; paths under gravity curve.",
  },
  apex: {
    name: "Motion at the top",
    claim: "At the highest point vertical velocity is zero but acceleration is not — nothing pauses.",
  },
  "spacing-speed": {
    name: "Spacing is speed",
    claim: "Equal-time snapshots that are farther apart mean faster motion.",
  },
  "decel-spacing": {
    name: "Slowing down",
    claim: "Braking shows up as shrinking gaps between equal-time snapshots.",
  },
  "release-velocity": {
    name: "Release keeps velocity, not acceleration",
    claim: "A package dropped from an accelerating plane does not keep accelerating forward.",
  },
  frames: {
    name: "Frames of reference",
    claim: "The same fall looks straight down to the pilot and curved from the ground.",
  },
  "mass-independence": {
    name: "Mass and falling",
    claim: "Without air resistance, heavy and light objects fall together.",
  },
  "drift-scales": {
    name: "Drift scales with speed",
    claim: "Faster carrier → proportionally longer forward drift for the same fall time.",
  },
  "directed-correction": {
    name: "Corrects from evidence",
    claim: "After a miss, adjusts in the direction the outcome implies.",
  },
};

export type Signal = "supports" | "contradicts" | "neutral";

export type Evidence = {
  id: string;
  at: number;
  challenge: ChallengeId;
  concept: ConceptId;
  signal: Signal;
  /** 0..1 — how diagnostic this single observation is */
  weight: number;
  summary: string;
  data?: Record<string, number | string | boolean>;
};

export type ConceptStatus = "untested" | "uncertain" | "demonstrated" | "contradicted" | "mixed";

export type ConceptState = {
  id: ConceptId;
  status: ConceptStatus;
  support: number;
  against: number;
  count: number;
};

const KEY = "intuition-lab:evidence:v1";
const EMPTY: Evidence[] = [];

let items: Evidence[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) items = JSON.parse(raw) as Evidence[];
  } catch {
    items = EMPTY;
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage may be unavailable (private mode); the session still works in memory
  }
}

function emit() {
  for (const l of listeners) l();
}

export function record(e: Omit<Evidence, "id" | "at">) {
  load();
  const ev: Evidence = { ...e, id: Math.random().toString(36).slice(2, 10), at: Date.now() };
  items = [...items, ev];
  persist();
  emit();
}

export function clearEvidence(challenge?: ChallengeId) {
  load();
  items = challenge ? items.filter((e) => e.challenge !== challenge) : EMPTY;
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  load();
  return items;
}

export function useEvidence(): Evidence[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function conceptStates(evidence: Evidence[]): ConceptState[] {
  return (Object.keys(CONCEPTS) as ConceptId[]).map((id) => {
    let support = 0;
    let against = 0;
    let count = 0;
    for (const e of evidence) {
      if (e.concept !== id || e.signal === "neutral") continue;
      count++;
      if (e.signal === "supports") support += e.weight;
      else against += e.weight;
    }
    let status: ConceptStatus;
    if (count === 0) status = "untested";
    else if (support > 0.3 && against > 0.3) status = "mixed";
    else if (support + against < 0.6) status = "uncertain";
    else status = support > against ? "demonstrated" : "contradicted";
    return { id, status, support, against, count };
  });
}
