/**
 * Build-time render step — step 1 of the two-step build.
 *
 * Runs standalone under `node --expose-gc` BEFORE `astro build`, boots the
 * OpenCascade WASM once per process, executes the registered examples, and
 * writes the entry data (SVG visuals + studio links) into
 * `generated/manifest.json`. Astro only consumes that static artifact — the
 * evaluator and its raw-TS imports must never enter the Astro build graph.
 *
 * v1.1 scale hardening (U8) lives here:
 * - incremental cache: entries whose cache key (code + pinned ref + render
 *   options) matches the previous manifest are reused without rendering;
 *   `--force` disables it. check-examples never uses the cache, so the CI
 *   freshness gate stays honest.
 * - process recycling: above `--batch-size N` (default 100) the run is split
 *   across sequential child processes, capping WASM-heap growth (OCCT objects
 *   are freed only by FinalizationRegistry; the heap otherwise grows
 *   monotonically). One evaluator per process — never render concurrently.
 * - `--shuffle-seed N` renders in a seeded-shuffled order (manifest order
 *   stays registry order) so scripts/check-order.ts can prove output is
 *   order-independent (no cross-example leakage).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { examples, lintExamples, type Example } from "../src/examples/index";
import { renderExample, type Visual } from "../src/lib/render-engine";
import { toStudioUrl } from "../src/lib/studio-link";
import { REPLICAD_GIT_REF, REPLICAD_GIT_TAG } from "../src/lib/replicad-version";

export type GeneratedEntry = Example & {
  /** Cache key this entry was rendered under (see cacheKey). */
  keyHash: string;
  studioUrl: string;
  visuals: Visual[];
};

export type Manifest = {
  replicadRef: string;
  replicadTag: string;
  entries: GeneratedEntry[];
};

/**
 * Bump when the render pipeline itself changes what it emits (projection
 * style, SVG wrapper, …) so cached visuals regenerate. Include the font id
 * here if a bundled font ever lands (drawText).
 */
const RENDER_OPTIONS_VERSION = "1";

/** Cache key: same code + same pinned ref + same render options = same SVG. */
export function cacheKey(example: Example): string {
  return createHash("sha256")
    .update(example.code)
    .update("\0")
    .update(REPLICAD_GIT_REF)
    .update("\0")
    .update(RENDER_OPTIONS_VERSION)
    .digest("hex");
}

/** Deterministic Fisher–Yates (mulberry32) — the leakage check's shuffle. */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export type GenerateOptions = {
  /** Ignore the previous manifest — render everything. */
  force?: boolean;
  /** Render in seeded-shuffled order (manifest order stays registry order). */
  shuffleSeed?: number;
  onExample?: (id: string, action: "render" | "cache") => void;
};

async function readPreviousManifest(outDir: URL): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(new URL("manifest.json", outDir), "utf8"));
  } catch {
    return null;
  }
}

/** Renders (or reuses) every example in-process and writes the manifest. */
export async function generateVisuals(
  list: Example[],
  outDir: URL,
  options: GenerateOptions = {},
): Promise<Manifest> {
  lintExamples(list);

  const previous = options.force ? null : await readPreviousManifest(outDir);
  const cached = new Map(
    (previous?.entries ?? []).map((entry) => [entry.id, entry]),
  );

  const results = new Map<string, GeneratedEntry>();
  const failures: string[] = [];
  const order = options.shuffleSeed === undefined
    ? list
    : seededShuffle(list, options.shuffleSeed);

  for (const example of order) {
    const keyHash = cacheKey(example);
    const hit = cached.get(example.id);
    if (hit && hit.keyHash === keyHash) {
      options.onExample?.(example.id, "cache");
      results.set(example.id, hit);
      continue;
    }
    try {
      const visuals = await renderExample(example.id, example.code);
      options.onExample?.(example.id, "render");
      results.set(example.id, {
        ...example,
        keyHash,
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
    // registry order, independent of render order
    entries: list.map((example) => results.get(example.id)!),
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(
    new URL("manifest.json", outDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return manifest;
}

/* ----------------------------------------------- process-recycling batches --- */

export type BatchStats = {
  /** Example ids rendered per child process, in dispatch order. */
  batches: string[][];
  /** Peak RSS (kB) per child process, index-aligned with batches. */
  maxRssKb: number[];
  cachedCount: number;
};

const scriptPath = fileURLToPath(import.meta.url);

/**
 * Renders `list` across sequential child processes of at most `batchSize`
 * examples (the recycling backstop: each child's WASM heap dies with it),
 * merging child manifests with cache hits into one manifest in registry
 * order. Children run with this process's node flags (--expose-gc, tsx).
 */
export async function generateVisualsInBatches(
  list: Example[],
  outDir: URL,
  batchSize: number,
  options: GenerateOptions = {},
): Promise<{ manifest: Manifest; stats: BatchStats }> {
  lintExamples(list);

  const previous = options.force ? null : await readPreviousManifest(outDir);
  const cached = new Map(
    (previous?.entries ?? []).map((entry) => [entry.id, entry]),
  );

  const order = options.shuffleSeed === undefined
    ? list
    : seededShuffle(list, options.shuffleSeed);

  const reused = new Map<string, GeneratedEntry>();
  const toRender: Example[] = [];
  for (const example of order) {
    const hit = cached.get(example.id);
    if (hit && hit.keyHash === cacheKey(example)) {
      options.onExample?.(example.id, "cache");
      reused.set(example.id, hit);
    } else {
      toRender.push(example);
    }
  }

  const batches: Example[][] = [];
  for (let i = 0; i < toRender.length; i += batchSize) {
    batches.push(toRender.slice(i, i + batchSize));
  }

  const rendered = new Map<string, GeneratedEntry>();
  const stats: BatchStats = {
    batches: batches.map((batch) => batch.map((example) => example.id)),
    maxRssKb: [],
    cachedCount: reused.size,
  };

  for (const batch of batches) {
    const childDir = await mkdtemp(join(tmpdir(), "render-batch-"));
    try {
      // full records go via file — the batch may be a synthetic corpus that
      // is not in the registry (check-scale), so ids alone cannot name it
      const batchFile = join(childDir, "batch.json");
      await writeFile(batchFile, JSON.stringify(batch));
      // sequential on purpose: one evaluator per process, never concurrent
      execFileSync(
        process.execPath,
        [
          ...process.execArgv,
          scriptPath,
          "--force",
          "--out",
          childDir,
          "--examples",
          batchFile,
        ],
        { stdio: ["ignore", "inherit", "inherit"] },
      );
      const childManifest: Manifest = JSON.parse(
        await readFile(join(childDir, "manifest.json"), "utf8"),
      );
      for (const entry of childManifest.entries) {
        options.onExample?.(entry.id, "render");
        rendered.set(entry.id, entry);
      }
      const childStats = JSON.parse(
        await readFile(join(childDir, "stats.json"), "utf8"),
      );
      stats.maxRssKb.push(childStats.maxRssKb);
    } finally {
      await rm(childDir, { recursive: true, force: true });
    }
  }

  const missing = list.filter(
    (example) => !reused.has(example.id) && !rendered.has(example.id),
  );
  if (missing.length > 0) {
    throw new Error(
      `batched render lost ${missing.length} example(s): ${missing
        .map((example) => example.id)
        .join(", ")}`,
    );
  }

  const manifest: Manifest = {
    replicadRef: REPLICAD_GIT_REF,
    replicadTag: REPLICAD_GIT_TAG,
    entries: list.map(
      (example) => reused.get(example.id) ?? rendered.get(example.id)!,
    ),
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(
    new URL("manifest.json", outDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return { manifest, stats };
}

/* ------------------------------------------------------------------ CLI --- */

function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const shuffleRaw = argValue(argv, "--shuffle-seed");
  const shuffleSeed = shuffleRaw === undefined ? undefined : Number(shuffleRaw);
  const outArg = argValue(argv, "--out");
  const outDir = outArg
    ? pathToFileURL(outArg.endsWith("/") ? outArg : `${outArg}/`)
    : new URL("../generated/", import.meta.url);
  const idsArg = argValue(argv, "--ids");
  const batchSize = Number(
    argValue(argv, "--batch-size") ?? process.env.RENDER_BATCH_SIZE ?? 100,
  );

  const examplesFile = argValue(argv, "--examples");

  let list = examples;
  if (examplesFile) {
    list = JSON.parse(await readFile(examplesFile, "utf8"));
  } else if (idsArg) {
    const wanted = new Set(idsArg.split(","));
    list = examples.filter((example) => wanted.has(example.id));
    const known = new Set(list.map((example) => example.id));
    const unknown = [...wanted].filter((id) => !known.has(id));
    if (unknown.length > 0) {
      console.error(`unknown example id(s): ${unknown.join(", ")}`);
      process.exit(1);
    }
  }

  const isChildInvocation = Boolean(examplesFile || idsArg);
  if (list.length > batchSize && !isChildInvocation) {
    const { manifest, stats } = await generateVisualsInBatches(
      list,
      outDir,
      batchSize,
      { force, shuffleSeed },
    );
    const peak = Math.max(...stats.maxRssKb, 0);
    console.log(
      `render: ${manifest.entries.length} example(s) → manifest.json ` +
        `(${stats.cachedCount} cached, ${stats.batches.length} batch(es), ` +
        `peak child RSS ${Math.round(peak / 1024)}MB, replicad ${manifest.replicadTag})`,
    );
  } else {
    let cachedCount = 0;
    const manifest = await generateVisuals(list, outDir, {
      force,
      shuffleSeed,
      onExample: (_id, action) => {
        if (action === "cache") cachedCount += 1;
      },
    });
    // child mode: report peak RSS for the recycling stats
    await writeFile(
      new URL("stats.json", outDir),
      `${JSON.stringify({ maxRssKb: process.resourceUsage().maxRSS })}\n`,
    );
    console.log(
      `render: ${manifest.entries.length} example(s) → manifest.json ` +
        `(${cachedCount} cached, replicad ${manifest.replicadTag})`,
    );
  }
}
