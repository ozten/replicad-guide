/**
 * Build-time render step — step 1 of the two-step build.
 *
 * Runs standalone under `node --expose-gc` BEFORE `astro build`, boots the
 * OpenCascade WASM once, executes every registered example, and writes the
 * entry data (including the SVG visuals and studio links) into
 * `generated/manifest.json`. Astro only consumes that static artifact — the
 * evaluator and its raw-TS imports must never enter the Astro build graph.
 *
 * v1 renders ALL examples on every run (dozens; fast). The incremental cache
 * is deferred to v1.1 — keep this batch-dispatchable so it can be added
 * without a rewrite.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { examples, lintExamples, type Example } from "../src/examples/index";
import { renderExample, type Visual } from "../src/lib/render-engine";
import { toStudioUrl } from "../src/lib/studio-link";
import { REPLICAD_GIT_REF, REPLICAD_GIT_TAG } from "../src/lib/replicad-version";

export type GeneratedEntry = Example & {
  studioUrl: string;
  visuals: Visual[];
};

export type Manifest = {
  replicadRef: string;
  replicadTag: string;
  entries: GeneratedEntry[];
};

export async function generateVisuals(
  list: Example[],
  outDir: URL,
): Promise<Manifest> {
  lintExamples(list);

  const entries: GeneratedEntry[] = [];
  const failures: string[] = [];

  for (const example of list) {
    try {
      const visuals = await renderExample(example.id, example.code);
      entries.push({
        ...example,
        studioUrl: await toStudioUrl(example.code),
        visuals,
      });
    } catch (error: any) {
      failures.push(error?.message || `[${example.id}] ${String(error)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `render failed for ${failures.length} example(s):\n${failures
        .map((f) => `  - ${f}`)
        .join("\n")}`,
    );
  }

  const manifest: Manifest = {
    replicadRef: REPLICAD_GIT_REF,
    replicadTag: REPLICAD_GIT_TAG,
    entries,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(
    new URL("manifest.json", outDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return manifest;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const outDir = new URL("../generated/", import.meta.url);
  const manifest = await generateVisuals(examples, outDir);
  console.log(
    `render: ${manifest.entries.length} example(s) → generated/manifest.json (replicad ${manifest.replicadTag})`,
  );
}
