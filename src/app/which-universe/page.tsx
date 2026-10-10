import type { Metadata } from "next";
import { WhichUniverse } from "@/components/challenges/which-universe";
import { ExperimentShell } from "@/components/ui";

export const metadata: Metadata = { title: "Which Universe Is Real? · Intuition Lab" };

export default function Page() {
  return (
    <ExperimentShell
      title="Which Universe Is Real?"
      description="Three universes, one scene. Two of them break a law of motion in a way that feels natural to many people. Spotting which is a test of your model, not your eyesight."
    >
      <WhichUniverse />
    </ExperimentShell>
  );
}
