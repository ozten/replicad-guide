/**
 * v1.1 scale check (U8): proves the render pipeline survives full-reference
 * scale — ≥300 examples — within the CI memory budget, using the
 * process-recycling backstop.
 *
 * The real corpus is smaller (the full reference reuses quick-ref visuals),
 * so this renders a SYNTHETIC 300-example corpus (parameterized 2D/3D
 * variations; every code string unique so the cache can't shortcut) through
 * generateVisualsInBatches and asserts each child process's peak RSS stays
 * under budget. Run via `pnpm run check:scale` (CI: workflow_dispatch — it
 * costs a few minutes, and the per-commit gates already cover correctness).
 *
 * Baselines (2026-07-15, Linux, Node 20.12.1): 44 examples ≈ 8.3s / 373MB
 * peak RSS in one process.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Example } from "../src/examples/index";
import { generateVisualsInBatches } from "./generate-visuals";

export const SCALE_CORPUS_SIZE = 300;
/** Per-child peak RSS budget. GitHub Linux runners have ~7GB total. */
export const RSS_BUDGET_MB = 3000;
const BATCH_SIZE = 50;

/**
 * Synthetic corpus: geometry varies with the index so every render does real
 * work. Projection-safe shapes only (boxes/cylinders — see
 * docs/solutions/2026-07-15-build-time-rendering-gotchas.md).
 */
export function syntheticCorpus(size: number): Example[] {
  const templates = [
    (i: number) => `const main = () => {
  const { drawRoundedRectangle } = replicad;
  return drawRoundedRectangle(${20 + (i % 40)}, ${10 + (i % 25)}, ${1 + (i % 5)});
};`,
    (i: number) => `const main = () => {
  const { drawCircle, drawRectangle } = replicad;
  return drawCircle(${5 + (i % 30)}).fuse(drawRectangle(${8 + (i % 20)}, ${4 + (i % 12)}));
};`,
    (i: number) => `const main = () => {
  const { makeBaseBox } = replicad;
  return makeBaseBox(${10 + (i % 30)}, ${8 + (i % 22)}, ${5 + (i % 15)}).fillet(${1 + (i % 3)});
};`,
    (i: number) => `const main = () => {
  const { makeCylinder, makeBaseBox } = replicad;
  return makeBaseBox(${20 + (i % 20)}, ${20 + (i % 20)}, ${4 + (i % 6)})
    .cut(makeCylinder(${2 + (i % 8)}, ${30 + (i % 10)}));
};`,
  ];

  return Array.from({ length: size }, (_, i) => ({
    id: `scale-${String(i).padStart(3, "0")}`,
    title: `Scale probe ${i}`,
    entryPoint: "synthetic",
    group: "scale",
    commonness: "OBSCURE" as const,
    // the probe marker keeps every code string unique even where the
    // parameter cycles repeat, so the cache can never shortcut a probe
    code: `// probe ${i}\n${templates[i % templates.length](i)}`,
  }));
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const corpus = syntheticCorpus(SCALE_CORPUS_SIZE);
  const outDir = await mkdtemp(join(tmpdir(), "check-scale-"));
  const startedAt = Date.now();

  try {
    const { manifest, stats } = await generateVisualsInBatches(
      corpus,
      pathToFileURL(`${outDir}/`),
      BATCH_SIZE,
      { force: true },
    );

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const peakMb = Math.round(Math.max(...stats.maxRssKb) / 1024);
    console.log(
      `check-scale: ${manifest.entries.length} example(s) in ${stats.batches.length} ` +
        `batch(es) of ≤${BATCH_SIZE}, ${elapsed}s, peak child RSS ${peakMb}MB ` +
        `(budget ${RSS_BUDGET_MB}MB)`,
    );

    if (manifest.entries.length !== SCALE_CORPUS_SIZE) {
      console.error(
        `✗ expected ${SCALE_CORPUS_SIZE} rendered entries, got ${manifest.entries.length}`,
      );
      process.exit(1);
    }
    if (peakMb >= RSS_BUDGET_MB) {
      console.error(
        `✗ peak child RSS ${peakMb}MB exceeds the ${RSS_BUDGET_MB}MB budget — lower the batch size`,
      );
      process.exit(1);
    }
    console.log("✓ full-reference scale renders within the memory budget");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}
