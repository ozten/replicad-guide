/**
 * Boots the OpenCascade WASM + manifold and creates the replicad evaluator.
 * Ported from replicad-cli's `createCliEvaluator` (vendor/replicad/packages/
 * replicad-cli/src/cli.ts) — CLI-internal, not exported, hence the port.
 *
 * INVARIANT: one OC/manifold instance for the whole build. replicad holds OC
 * references in module-level singletons (including an enum cache), so the
 * evaluator must be booted once and reused — never re-`setOC` mid-build.
 *
 * This module must only ever be imported by the standalone render step and
 * tests — never from the Astro build graph.
 */
import { createRequire } from "node:module";
// @ts-expect-error -- manifold-3d ships no types for this subpath
import { getManifoldModule, setWasmUrl } from "manifold-3d/lib/wasm.js";
import * as replicad from "replicad";
import { createEvaluator, type EvaluatorService } from "replicad-evaluator";

const require = createRequire(import.meta.url);

let evaluatorPromise: Promise<EvaluatorService> | null = null;

async function boot(): Promise<EvaluatorService> {
  // Without FinalizationRegistry replicad cannot free OCCT objects at all;
  // the render step would leak the whole WASM heap.
  if (typeof FinalizationRegistry === "undefined") {
    throw new Error(
      "FinalizationRegistry is not available — Node >= 20.6 is required",
    );
  }

  const opencascadeModule: any = await import(
    // @ts-expect-error -- emscripten build, typed only by a generated .d.ts we don't consume
    "replicad-opencascadejs/src/replicad_single.js"
  );
  const openCascadeFactory =
    opencascadeModule?.default?.default ||
    opencascadeModule?.default ||
    opencascadeModule;
  if (typeof openCascadeFactory !== "function") {
    throw new Error(
      "replicad-opencascadejs module shape changed — expected an emscripten factory function",
    );
  }

  setWasmUrl(require.resolve("manifold-3d/manifold.wasm"));
  const oc = await openCascadeFactory({
    locateFile: () =>
      require.resolve("replicad-opencascadejs/src/replicad_single.wasm"),
  });
  const manifold = await getManifoldModule();

  return createEvaluator({ replicad, oc, manifold });
}

export function getEvaluator(): Promise<EvaluatorService> {
  if (!evaluatorPromise) {
    evaluatorPromise = boot();
  }
  return evaluatorPromise;
}
