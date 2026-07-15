// @ts-check
import { defineConfig } from "astro/config";

// The render step (`pnpm run render`) runs BEFORE this build and writes
// generated SVG/data into `generated/`. Astro only consumes those static
// artifacts — it must never import the evaluator or boot the WASM.
export default defineConfig({
  output: "static",
});
