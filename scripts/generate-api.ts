/**
 * Full-reference generation (U8) — step alongside the render step in the
 * two-step build. Runs the pinned typedoc against the pinned checkout's
 * source (R6/R13: signatures are extracted, never hand-authored), normalizes
 * the JSON through api-model, applies the curated overlay, and writes
 * `generated/api.json` for the Astro pages to consume.
 *
 * Unlike the render step this never boots the evaluator — it is safe to run
 * anywhere, but stays a build-time artifact (generated/ is gitignored) so CI
 * regenerates signatures against every ref bump (R15).
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildReferenceModel,
  extractSymbols,
  type ReferenceModel,
  type TypedocJson,
} from "../src/lib/api-model";
import { referenceCuration } from "../src/reference/curation";
import { examples } from "../src/examples/index";
import { REPLICAD_GIT_REF, REPLICAD_GIT_TAG } from "../src/lib/replicad-version";

export type ApiManifest = ReferenceModel & {
  replicadRef: string;
  replicadTag: string;
};

const repoRoot = new URL("../", import.meta.url);

/**
 * The vendor tsconfig carries a stale typedocOptions block, so
 * tsconfig.typedoc.json replicates its compilerOptions instead of extending
 * it (TypeDoc follows extends chains when reading typedocOptions). This
 * check makes a ref bump that changes the vendor compilerOptions fail loudly
 * instead of silently documenting against different compiler settings.
 */
export async function assertTsconfigShimInSync(): Promise<void> {
  const vendor = JSON.parse(
    await readFile(
      new URL("vendor/replicad/packages/replicad/tsconfig.json", repoRoot),
      "utf8",
    ),
  );
  const shim = JSON.parse(
    await readFile(new URL("tsconfig.typedoc.json", repoRoot), "utf8"),
  );
  const vendorOptions = JSON.stringify(vendor.compilerOptions, Object.keys(vendor.compilerOptions).sort());
  const shimOptions = JSON.stringify(shim.compilerOptions, Object.keys(shim.compilerOptions).sort());
  if (vendorOptions !== shimOptions) {
    throw new Error(
      `tsconfig.typedoc.json compilerOptions no longer match the vendor tsconfig — update the shim to match vendor/replicad/packages/replicad/tsconfig.json\n  vendor: ${vendorOptions}\n  shim:   ${shimOptions}`,
    );
  }
}

/** Runs the pinned typedoc (config in typedoc.json) and returns its JSON output. */
export async function runTypedoc(outFile: URL): Promise<TypedocJson> {
  execFileSync("pnpm", ["exec", "typedoc", "--json", fileURLToPath(outFile)], {
    cwd: fileURLToPath(repoRoot),
    stdio: ["ignore", "inherit", "inherit"],
  });
  return JSON.parse(await readFile(outFile, "utf8"));
}

export async function generateApi(outDir: URL): Promise<ApiManifest> {
  await assertTsconfigShimInSync();
  await mkdir(outDir, { recursive: true });

  const typedocJson = await runTypedoc(new URL("typedoc.json", outDir));
  const symbols = extractSymbols(typedocJson);
  const knownExampleIds = new Set(examples.map((example) => example.id));
  const model = buildReferenceModel(symbols, referenceCuration, knownExampleIds);

  const manifest: ApiManifest = {
    replicadRef: REPLICAD_GIT_REF,
    replicadTag: REPLICAD_GIT_TAG,
    groups: model.groups,
  };

  await writeFile(
    new URL("api.json", outDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const outDir = new URL("../generated/", import.meta.url);
  const manifest = await generateApi(outDir);
  const total = manifest.groups.reduce((sum, group) => sum + group.entries.length, 0);
  console.log(
    `api: ${total} export(s) in ${manifest.groups.length} group(s) → generated/api.json (replicad ${manifest.replicadTag})`,
  );
}
