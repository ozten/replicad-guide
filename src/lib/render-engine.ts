/**
 * Turns one example's code into an array of SVG visuals (2D inline and/or a
 * 3D projection), with loud failure handling.
 *
 * FAILURE MODEL: `buildShapesFromCode` never throws — it signals failure by
 * return value ({error} object), and per-shape mesh failures are swallowed
 * onto entries (`entry.error === true`) while staying in the array. Every
 * check here inspects returns and fails naming the example id; a broken
 * example must never produce a blank visual.
 *
 * Node-only (raw-TS evaluator import) — must run inside the standalone
 * `node --expose-gc` render step, never inside the Astro build graph.
 */
import { annotateSvg, type Annotations } from "./annotate-svg";
import { getEvaluator } from "./evaluator-setup";
import { prettyProjectionSvg } from "./project-svg";

export type Visual = {
  kind: "2d" | "3d";
  /** Entry name from the evaluator ("Shape", or the example's defaultName). */
  name: string;
  svg: string;
};

/** A rendered output entry, as returned by replicad-evaluator's renderOutput. */
type BuildEntry = {
  name: string;
  error?: boolean;
  message?: string | null;
  format?: string;
  paths?: string[] | string[][];
  viewbox?: string;
  solidType?: string;
};

export function assertValidBuildResult(
  id: string,
  result: unknown,
): asserts result is BuildEntry[] {
  if (!Array.isArray(result)) {
    const message =
      (result as { message?: string })?.message || "failed to build shapes";
    throw new Error(`[${id}] ${message}`);
  }
  if (result.length === 0) {
    throw new Error(
      `[${id}] example produced no renderable output (did main() return a shape?)`,
    );
  }
  for (const entry of result as BuildEntry[]) {
    if (entry?.error) {
      throw new Error(
        `[${id}] entry "${entry.name}" failed: ${entry.message || "unknown error"}`,
      );
    }
  }
}

/** Composes an SVG document from a 2D entry, mirroring Drawing.toSVG's format. */
export function svgFromDrawingEntry(id: string, entry: BuildEntry): string {
  const paths = (entry.paths ?? []).flat(Infinity) as string[];
  if (paths.length === 0) {
    throw new Error(`[${id}] 2D entry "${entry.name}" produced no SVG paths`);
  }

  const body = paths.map((path) => `    <path d="${path}" />`).join("\n");
  return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="${entry.viewbox}" fill="none" stroke="black" stroke-width="0.6%" vector-effect="non-scaling-stroke">
${body}
</svg>`;
}

// The WASM heap only shrinks when FinalizationRegistry callbacks run, so nudge
// the GC periodically. A no-op unless the process runs under --expose-gc.
let rendersSinceGc = 0;
const GC_EVERY = 10;

function maybeGc() {
  rendersSinceGc += 1;
  if (rendersSinceGc >= GC_EVERY) {
    rendersSinceGc = 0;
    globalThis.gc?.();
  }
}

/**
 * Renders one example to its visuals. One example can yield several (e.g. a
 * solid plus drawProjection drawings): every 2D entry becomes an inline SVG,
 * and the FIRST projectable 3D entry becomes a projection SVG (mirrors the
 * CLI's entry selection; further 3D entries are ignored).
 *
 * `annotations` overlays apply to every 2D visual; 3D projections are left
 * unannotated for now (that needs points projected through the same camera).
 */
export async function renderExample(
  id: string,
  code: string,
  annotations?: Annotations,
): Promise<Visual[]> {
  const evaluator = await getEvaluator();
  const params = (await evaluator.extractDefaultParamsFromCode(code)) || {};
  const result = await evaluator.buildShapesFromCode(code, params);

  assertValidBuildResult(id, result);

  const visuals: Visual[] = [];
  let projected = false;

  for (const [index, entry] of result.entries()) {
    if (entry.format === "svg") {
      visuals.push({
        kind: "2d",
        name: entry.name,
        svg: annotateSvg(id, svgFromDrawingEntry(id, entry), annotations),
      });
    } else if (entry.solidType !== "mesh" && !projected) {
      projected = true;
      // The result array carries only mesh data; the real shape objects live
      // in the evaluator's shapesMemory, written by THIS build and
      // index-aligned with the result (debug shapes are appended after).
      // Only safe to read right after a validated buildShapesFromCode — on a
      // failed build the memory still holds the PREVIOUS example's shapes,
      // but assertValidBuildResult has already thrown in that case.
      const shapes = evaluator.getShapeEntries();
      const shape = index < shapes.length ? shapes[index]?.shape : undefined;
      if (!shape) {
        throw new Error(
          `[${id}] no shape available to project for entry "${entry.name}"`,
        );
      }
      visuals.push({
        kind: "3d",
        name: entry.name,
        svg: prettyProjectionSvg(shape, "hidden"),
      });
    }
  }

  if (visuals.length === 0) {
    throw new Error(`[${id}] no renderable entries (2D drawing or 3D shape)`);
  }

  maybeGc();
  return visuals;
}
