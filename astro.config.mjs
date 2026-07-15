// @ts-check
import { defineConfig } from "astro/config";

// The render step (`pnpm run render`) runs BEFORE this build and writes
// generated SVG/data into `generated/`. Astro only consumes those static
// artifacts — it must never import the evaluator or boot the WASM.
export default defineConfig({
  output: "static",
  // GitHub Pages project site — every internal link goes through withBase()
  // (src/lib/base-url.ts) so it survives the /replicad-guide subpath
  site: "https://ozten.github.io",
  base: "/replicad-guide",
});
