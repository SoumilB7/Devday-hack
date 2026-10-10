import type { Metadata } from "next";
import { AnalyzerView } from "@/components/analyzer-view";
import { SiteHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Analyzer · Intuition Lab" };

export default function Page() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="animate-fade-up mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Analyzer</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
            What the challenges have observed, concept by concept. Each observation either supports, contradicts, or only
            describes a belief. Untested is not the same as not understood.
          </p>
        </div>
        <div className="animate-fade-up">
          <AnalyzerView />
        </div>
      </main>
    </div>
  );
}
