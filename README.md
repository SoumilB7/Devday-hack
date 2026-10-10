# Intuition Lab

Kinematics challenges that surface how a learner thinks about motion. They predict, the simulation runs, and nobody tells them the answer. A deterministic analyzer turns what they draw and do into evidence about specific concepts.

## Challenges

- **Drop Zone** (`/drop-zone`): sketch a package's fall from a plane, then time the release. Four layers: cruise, pilot's view, accelerating plane, twice as fast.
- **Which Universe Is Real?** (`/which-universe`): three animations of one scene, two of them built on a common misconception.
- **Strobe Prediction** (`/strobe`): place where an object will be at each camera flash, then compare with the world.
- **Analyzer** (`/analyzer`): per-concept learner model and evidence timeline. Exports JSON.

## Run

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

## Layout

- `src/lib/analysis.ts`: feature extraction (sketch shape and drift, strobe spacing trends)
- `src/lib/evidence.ts`: concepts, evidence store, and status derivation
- `src/lib/draw.ts`: canvas drawing helpers
- `src/components/challenges/`: one file per challenge
