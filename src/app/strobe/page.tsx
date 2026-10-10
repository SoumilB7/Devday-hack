import type { Metadata } from "next";
import { Strobe } from "@/components/challenges/strobe";
import { ExperimentShell } from "@/components/ui";

export const metadata: Metadata = { title: "Strobe Prediction · Intuition Lab" };

export default function Page() {
  return (
    <ExperimentShell
      title="Strobe Prediction"
      description="A camera flashes once per second. Before the world runs, place where the object will be at each flash. Drag marks to adjust. Then run it and see the camera's record next to yours."
    >
      <Strobe />
    </ExperimentShell>
  );
}
