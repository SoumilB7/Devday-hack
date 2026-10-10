import type { Metadata } from "next";
import { DropZone } from "@/components/challenges/drop-zone";
import { ExperimentShell } from "@/components/ui";

export const metadata: Metadata = { title: "Drop Zone · Intuition Lab" };

export default function Page() {
  return (
    <ExperimentShell
      title="Drop Zone"
      description="A plane carries a package over a flag. Sketch what you expect, then fly. Nothing here tells you the answer — the package does. Draw directly on the canvas; drop with Space."
    >
      <DropZone />
    </ExperimentShell>
  );
}
