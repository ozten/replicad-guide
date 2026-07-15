import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildReferenceModel,
  extractSymbols,
  stringifyType,
  type ApiSymbol,
  type Curation,
  type Reflection,
  type TypedocJson,
} from "../src/lib/api-model";
import { referenceCuration } from "../src/reference/curation";
import { examples } from "../src/examples/index";
import { assertTsconfigShimInSync, generateApi, type ApiManifest } from "./generate-api";

/* ------------------------------------------------- unit: type rendering --- */

describe("stringifyType", () => {
  it("renders tuples", () => {
    expect(
      stringifyType({
        type: "tuple",
        elements: [
          { type: "intrinsic", name: "number" },
          { type: "intrinsic", name: "number" },
        ],
      }),
    ).toBe("[number, number]");
  });

  it("parenthesizes function types inside unions", () => {
    expect(
      stringifyType({
        type: "union",
        types: [
          {
            type: "reflection",
            declaration: {
              name: "__type",
              kind: 65536,
              signatures: [
                {
                  name: "__type",
                  kind: 4096,
                  parameters: [
                    { name: "e", kind: 32768, type: { type: "reference", name: "Edge" } },
                  ],
                  type: { type: "intrinsic", name: "number" },
                },
              ],
            },
          },
          { type: "intrinsic", name: "number" },
        ],
      }),
    ).toBe("((e: Edge) => number) | number");
  });

  it("renders string literals quoted and unions of them", () => {
    expect(
      stringifyType({
        type: "union",
        types: [
          { type: "literal", value: "XY" },
          { type: "literal", value: "XZ" },
        ],
      }),
    ).toBe('"XY" | "XZ"');
  });

  it("parenthesizes unions inside arrays", () => {
    expect(
      stringifyType({
        type: "array",
        elementType: {
          type: "union",
          types: [
            { type: "intrinsic", name: "string" },
            { type: "intrinsic", name: "number" },
          ],
        },
      }),
    ).toBe("(string | number)[]");
  });
});

/* -------------------------------------------- unit: symbol extraction --- */

const fixtureFunction: Reflection = {
  name: "demo",
  kind: 64,
  signatures: [
    {
      name: "demo",
      kind: 4096,
      comment: { summary: [{ kind: "text", text: "Does a demo." }] },
      parameters: [
        {
          name: "size",
          kind: 32768,
          flags: {},
          defaultValue: "10",
          type: { type: "intrinsic", name: "number" },
          comment: { summary: [{ kind: "text", text: "the size" }] },
        },
        {
          name: "opts",
          kind: 32768,
          flags: { isOptional: true },
          // TypeDoc collapses complex initializers to "..." — must not render
          defaultValue: "...",
          type: { type: "reference", name: "Options" },
        },
      ],
      type: { type: "reference", name: "Drawing" },
    },
  ],
  sources: [{ fileName: "draw.ts", url: "https://example.test/draw.ts#L1" }],
};

const fixtureClass: Reflection = {
  name: "Widget",
  kind: 128,
  extendedTypes: [{ type: "reference", name: "Base" }],
  children: [
    {
      name: "constructor",
      kind: 512,
      signatures: [
        {
          name: "Widget",
          kind: 16384,
          parameters: [
            { name: "size", kind: 32768, flags: {}, type: { type: "intrinsic", name: "number" } },
          ],
          type: { type: "reference", name: "Widget" },
        },
      ],
    },
    {
      name: "inheritedThing",
      kind: 2048,
      inheritedFrom: { name: "Base.inheritedThing" },
      signatures: [{ name: "inheritedThing", kind: 4096, type: { type: "intrinsic", name: "void" } }],
    },
    {
      name: "grow",
      kind: 2048,
      signatures: [
        {
          name: "grow",
          kind: 4096,
          parameters: [
            { name: "by", kind: 32768, flags: {}, type: { type: "intrinsic", name: "number" } },
          ],
          type: { type: "intrinsic", name: "this" },
        },
      ],
    },
    {
      name: "area",
      kind: 262144,
      getSignature: {
        name: "area",
        kind: 524288,
        type: { type: "intrinsic", name: "number" },
      },
    },
    {
      name: "kindName",
      kind: 1024,
      flags: { isStatic: true },
      type: { type: "literal", value: "widget" },
    },
  ],
  sources: [{ fileName: "widgets.ts" }],
};

const fixtureJson: TypedocJson = {
  schemaVersion: "2.0",
  children: [fixtureFunction, fixtureClass],
};

describe("extractSymbols", () => {
  const symbols = extractSymbols(fixtureJson);
  const demo = symbols.find((s) => s.name === "demo")!;
  const widget = symbols.find((s) => s.name === "Widget")!;

  it("renders function signatures with defaults, dropping TypeDoc's '...' placeholder", () => {
    expect(demo.signature).toBe("demo(size?: number = 10, opts?: Options): Drawing");
    expect(demo.params).toEqual([
      { name: "size", type: "number", optional: true, defaultValue: "10", description: "the size" },
      { name: "opts", type: "Options", optional: true },
    ]);
    expect(demo.description).toBe("Does a demo.");
    expect(demo.sourceUrl).toBe("https://example.test/draw.ts#L1");
  });

  it("renders class headers, skips inherited members, keeps statics and accessors", () => {
    expect(widget.signature).toBe("class Widget extends Base");
    expect(widget.extends).toEqual(["Base"]);
    const names = widget.members!.map((m) => m.name);
    expect(names).toEqual(["constructor", "grow", "area", "kindName"]);
    expect(widget.members!.find((m) => m.name === "constructor")!.signature).toBe(
      "new Widget(size: number): Widget",
    );
    expect(widget.members!.find((m) => m.name === "grow")!.signature).toBe(
      "grow(by: number): this",
    );
    expect(widget.members!.find((m) => m.name === "area")!.signature).toBe("area: number");
    expect(widget.members!.find((m) => m.name === "kindName")!.isStatic).toBe(true);
  });

  it("throws on an empty export set", () => {
    expect(() => extractSymbols({ children: [] })).toThrow(/no exports/);
  });
});

/* --------------------------------------------- unit: grouping/curation --- */

const miniSymbols: ApiSymbol[] = [
  { name: "draw", kind: "function", signature: "draw(): Pen", file: "draw.ts" },
  { name: "Pen", kind: "class", signature: "class Pen", file: "draw.ts", members: [] },
  { name: "OldSketcher", kind: "class", signature: "class OldSketcher", file: "Sketcher.ts", members: [] },
];

const miniCuration: Curation = {
  groups: [
    { id: "drawing", title: "Drawing", pinned: ["draw"] },
    { id: "legacy", title: "Legacy", legacy: true },
  ],
  groupByFile: { "draw.ts": "drawing", "Sketcher.ts": "legacy" },
  groupOverrides: {},
  symbols: {
    Pen: { entryPoint: "draw() → Pen", exampleIds: ["pen-example"] },
  },
};

describe("buildReferenceModel", () => {
  it("groups by concept, applies curated entry points and examples", () => {
    const model = buildReferenceModel(miniSymbols, miniCuration, new Set(["pen-example"]));
    expect(model.groups.map((g) => g.id)).toEqual(["drawing", "legacy"]);
    const drawing = model.groups[0];
    expect(drawing.entries.map((e) => e.name)).toEqual(["draw", "Pen"]);
    expect(drawing.entries[1].entryPoint).toBe("draw() → Pen");
    expect(drawing.entries[1].exampleIds).toEqual(["pen-example"]);
    expect(model.groups[1].entries[0].legacy).toBe(true);
  });

  it("fails when an export's file has no group mapping", () => {
    const stray: ApiSymbol = { name: "mystery", kind: "function", signature: "mystery(): void", file: "new-stuff.ts" };
    expect(() =>
      buildReferenceModel([...miniSymbols, stray], miniCuration, new Set(["pen-example"])),
    ).toThrow(/mystery.*no group/);
  });

  it("fails when curation names a symbol that no longer exists (upstream rename)", () => {
    const curation: Curation = {
      ...miniCuration,
      symbols: { ...miniCuration.symbols, Ghost: { entryPoint: "boo" } },
    };
    expect(() => buildReferenceModel(miniSymbols, curation, new Set(["pen-example"]))).toThrow(
      /Ghost.*renamed or removed/,
    );
  });

  it("fails when a curated example id is unknown", () => {
    expect(() => buildReferenceModel(miniSymbols, miniCuration, new Set())).toThrow(
      /unknown example id "pen-example"/,
    );
  });

  it("fails when a legacy symbol embeds examples (R10/R14)", () => {
    const curation: Curation = {
      ...miniCuration,
      symbols: {
        ...miniCuration.symbols,
        OldSketcher: { exampleIds: ["pen-example"] },
      },
    };
    expect(() =>
      buildReferenceModel(miniSymbols, curation, new Set(["pen-example"])),
    ).toThrow(/legacy symbol "OldSketcher"/);
  });
});

/* ----------------------------- integration: the real pinned generation --- */

describe("generateApi against the pinned checkout", () => {
  let outDir: string;
  let manifest: ApiManifest;

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), "replicad-guide-api-"));
    manifest = await generateApi(pathToFileURL(`${outDir}/`));
  });

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("keeps the tsconfig shim in sync with the vendor tsconfig", async () => {
    await expect(assertTsconfigShimInSync()).resolves.toBeUndefined();
  });

  it("R13: every export appears with a non-empty signature, grouped by concept", () => {
    const entries = manifest.groups.flatMap((group) => group.entries);
    expect(entries.length).toBeGreaterThanOrEqual(150);
    for (const entry of entries) {
      expect(entry.signature, entry.name).toBeTruthy();
    }
    // grouped by concept, not one alphabetical dump
    expect(manifest.groups.length).toBeGreaterThanOrEqual(10);
    const drawing = manifest.groups.find((group) => group.id === "drawing")!;
    expect(drawing.entries[0].name).toBe("draw");
  });

  it("R13: descriptions survive extraction where the source has them", () => {
    const entries = manifest.groups.flatMap((group) => group.entries);
    const draw = entries.find((entry) => entry.name === "draw")!;
    expect(draw.description).toMatch(/drawing pen/i);
  });

  it("R14: geometry entries embed examples; trivial utilities and legacy Sketcher don't", () => {
    const entries = manifest.groups.flatMap((group) => group.entries);
    const drawCircle = entries.find((entry) => entry.name === "drawCircle")!;
    expect(drawCircle.exampleIds).toEqual(["draw-circle"]);

    const getOC = entries.find((entry) => entry.name === "getOC")!;
    expect(getOC.exampleIds).toBeUndefined();

    const sketcher = entries.find((entry) => entry.name === "Sketcher")!;
    expect(sketcher.legacy).toBe(true);
    expect(sketcher.exampleIds).toBeUndefined();
    expect(sketcher.signature).toContain("class Sketcher");
  });

  it("renders exports with no JSDoc signature-only rather than dropping them", () => {
    const entries = manifest.groups.flatMap((group) => group.entries);
    const undocumented = entries.filter((entry) => !entry.description);
    expect(undocumented.length).toBeGreaterThan(0);
    for (const entry of undocumented) {
      expect(entry.signature, entry.name).toBeTruthy();
    }
  });

  it("every curated example id exists in the example registry", () => {
    const known = new Set(examples.map((example) => example.id));
    for (const meta of Object.values(referenceCuration.symbols)) {
      for (const id of meta.exampleIds ?? []) {
        expect(known.has(id), `example id ${id}`).toBe(true);
      }
    }
  });

  it("member anchors cannot collide: symbol names are unique across the export set", () => {
    const names = manifest.groups.flatMap((group) => group.entries.map((entry) => entry.name));
    expect(new Set(names).size).toBe(names.length);
  });
});
