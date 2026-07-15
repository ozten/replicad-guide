/**
 * The example registry — the single source of truth for every visual (R9).
 *
 * Each example is authored ONCE as a record; the same `code` string is
 * (a) displayed on the page, (b) executed by the render engine at build time,
 * and (c) encoded into the open-in-studio link. No second copy exists, so a
 * visual can never drift from the code shown beside it.
 */
import { examples2d } from "./2d/index";
import { examples3d } from "./3d/index";

export type Commonness = "ESSENTIAL" | "COMMON" | "OBSCURE";

export type Example = {
  /** Unique kebab-case identifier; names the example in build failures. */
  id: string;
  title: string;
  /**
   * How you obtain or call the thing (R4) — no entry may reference an object
   * without showing how to get one. E.g. "draw() → DrawingPen" or
   * "drawing.sketchOnPlane(plane) → Sketch".
   */
  entryPoint: string;
  /** Page section the example belongs to (e.g. "The pen", "Booleans"). */
  group: string;
  commonness: Commonness;
  /**
   * The one and only copy of the example source. Runs in the evaluator's
   * "function" mode: the `replicad` global is ambient and a `main` function
   * must be defined (see the contract enforced by `validateExample`).
   */
  code: string;
};

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Mirrors the evaluator's module-vs-function detection (builder.ts MODULE_RE):
// a top-level `export` silently flips the execution path to module mode.
const TOP_LEVEL_EXPORT = /^\s*export\s+/m;
const TOP_LEVEL_IMPORT = /^\s*import\s/m;
const DEFINES_MAIN = /(^|\s)(const|let|var|function|async\s+function)\s+main\b/;
const OC_FS_ACCESS = /\boc\s*\.\s*FS\b|\bFS\s*\.\s*(writeFile|createDataFile)\b/;

/**
 * The example contract. Violations silently change how the evaluator runs
 * the code (or leak state across examples), so they fail the build instead:
 * - `main` must be defined by that name — the evaluator invokes it by name.
 * - no top-level `export`/`import` — examples use the ambient `replicad`
 *   global, and a stray `export` would flip evaluation into module mode.
 * - no direct OpenCascade virtual-FS access — the FS is shared across all
 *   examples in the build. (High-level export helpers like `blobSTEP()` are
 *   fine: examples run serially, so their fixed temp filename is benign.)
 */
export function validateExample(example: Example): string[] {
  const errors: string[] = [];

  if (!KEBAB_CASE.test(example.id)) {
    errors.push(`id "${example.id}" must be kebab-case`);
  }
  if (!example.entryPoint?.trim()) {
    errors.push(`[${example.id}] entryPoint is required (R4)`);
  }
  if (!DEFINES_MAIN.test(example.code)) {
    errors.push(`[${example.id}] code must define a function named "main"`);
  }
  if (TOP_LEVEL_IMPORT.test(example.code)) {
    errors.push(
      `[${example.id}] code must not use import — replicad is ambient`,
    );
  }
  if (TOP_LEVEL_EXPORT.test(example.code)) {
    errors.push(
      `[${example.id}] code must not use top-level export — it would switch the evaluator to module mode`,
    );
  }
  if (OC_FS_ACCESS.test(example.code)) {
    errors.push(
      `[${example.id}] code must not touch the shared OpenCascade virtual FS`,
    );
  }

  return errors;
}

/** Lints a whole registry (contract + id uniqueness); throws listing every violation. */
export function lintExamples(list: Example[]): void {
  const errors = list.flatMap(validateExample);

  const seen = new Set<string>();
  for (const example of list) {
    if (seen.has(example.id)) {
      errors.push(`duplicate example id "${example.id}"`);
    }
    seen.add(example.id);
  }

  if (errors.length > 0) {
    throw new Error(
      `example contract violations:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}

/** All registered examples, aggregated from the per-page registries. */
export const examples: Example[] = [...examples2d, ...examples3d];
