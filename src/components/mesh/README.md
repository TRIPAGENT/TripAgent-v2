# Mesh gradient kit (Stripe-style WebGL gradient)

Drop all 5 files into one folder in a Next.js/React + TS project (e.g. `src/components/mesh/`). Imports are relative, no dependencies.

## Usage
```tsx
import MeshGradientCanvas from "./mesh/MeshGradientCanvas";
import { DARK_HERO_COLORS, DARK_HERO_TUNING } from "./mesh/presets";

<div className="relative overflow-hidden bg-[#0A1F44]">
  <MeshGradientCanvas id="hero-mesh" colors={DARK_HERO_COLORS} tuning={DARK_HERO_TUNING} />
  <div className="relative z-10">{/* content — must be positioned or the canvas paints over it */}</div>
</div>
```

- `id` must be unique per mounted canvas.
- Colors: four CSS vars `--gradient-color-1..4` (hex). Tuning: `amp` (wave height), `freqX/freqY` (wave density), `noiseSpeed`, `noiseFlow`, optional `angle` (radians).
- Client component (`"use client"`); WebGL only, so no SSR use. Presets: dark hero + light splash.
- `gradient.js` is vendored (Stripe/Kevin Hufnagl) — copy as-is.
