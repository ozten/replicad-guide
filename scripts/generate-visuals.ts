/**
 * Build-time render step — step 1 of the two-step build.
 *
 * Runs standalone under `node --expose-gc` BEFORE `astro build`, boots the
 * OpenCascade WASM once, executes every registered example, and writes the
 * resulting SVG visuals + entry data into `generated/`. Astro only consumes
 * those static artifacts — the evaluator and its raw-TS imports must never
 * enter the Astro build graph.
 *
 * The example registry and render engine land in U2/U3; until then this
 * emits an empty manifest so the two-step build is wired end to end.
 */
import { mkdir, writeFile } from "node:fs/promises";

const OUT_DIR = new URL("../generated/", import.meta.url);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  new URL("manifest.json", OUT_DIR),
  JSON.stringify({ examples: [] }, null, 2),
);
console.log("render: 0 examples registered (registry lands in U3)");
