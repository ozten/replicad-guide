import { describe, expect, it } from "vitest";
import type { RefGroup } from "./api-model";
import {
  buildSearchIndex,
  searchDocs,
  type QuickRefSource,
} from "./search-index";

const groups: RefGroup[] = [
  {
    id: "drawing",
    title: "Drawing (2D)",
    entries: [
      {
        name: "drawCircle",
        kind: "function",
        signature: "drawCircle(radius: number): Drawing",
        file: "draw.ts",
      },
      {
        name: "Drawing",
        kind: "class",
        signature: "class Drawing",
        file: "draw.ts",
        members: [
          {
            name: "fillet",
            kind: "method",
            isStatic: false,
            signature: "fillet(radius: number): Drawing",
          },
          {
            name: "constructor",
            kind: "constructor",
            isStatic: false,
            signature: "new Drawing(): Drawing",
          },
        ],
      },
    ],
  },
  {
    id: "legacy-sketcher",
    title: "Legacy Sketcher",
    legacy: true,
    entries: [
      {
        name: "Sketcher",
        kind: "class",
        signature: "class Sketcher",
        file: "Sketcher.ts",
        legacy: true,
        members: [],
      },
    ],
  },
];

const quickRef: QuickRefSource[] = [
  {
    id: "draw-half-circle",
    title: "Draw a half circle",
    entryPoint: "pen.sagittaArc(dx, dy, sagitta) — sagitta = radius",
    page: "/2d",
  },
  {
    id: "fillet",
    title: "Fillet — round edges",
    entryPoint: "shape.fillet(radius, filter?: (e: EdgeFinder) => EdgeFinder)",
    page: "/3d",
  },
];

const docs = buildSearchIndex(groups, quickRef);

describe("buildSearchIndex", () => {
  it("indexes reference symbols with page+anchor hrefs", () => {
    const drawCircle = docs.find((doc) => doc.label === "drawCircle")!;
    expect(drawCircle.href).toBe("/reference/drawing#drawCircle");
    expect(drawCircle.detail).toBe("Drawing (2D) · function");
  });

  it("indexes class members with member anchors, skipping constructors", () => {
    const fillet = docs.find((doc) => doc.label === "Drawing.fillet()")!;
    expect(fillet.href).toBe("/reference/drawing#Drawing-fillet");
    expect(docs.some((doc) => doc.label.includes("constructor"))).toBe(false);
  });

  it("indexes quick-ref entries with their page anchors and symbol aliases", () => {
    const halfCircle = docs.find((doc) => doc.label === "Draw a half circle")!;
    expect(halfCircle.href).toBe("/2d#draw-half-circle");
    expect(halfCircle.aliases).toContain("sagittaarc");
  });
});

describe("searchDocs", () => {
  it("returns the right page+anchor for an exact symbol name", () => {
    const results = searchDocs(docs, "drawCircle");
    expect(results[0].href).toBe("/reference/drawing#drawCircle");
  });

  it("returns the right page+anchor for an alias (motivating question)", () => {
    const results = searchDocs(docs, "half circle");
    expect(results[0].href).toBe("/2d#draw-half-circle");
  });

  it("ranks the curated quick-ref entry above the raw member for a shared name", () => {
    const results = searchDocs(docs, "fillet");
    expect(results[0].href).toBe("/3d#fillet");
    expect(results.map((doc) => doc.href)).toContain(
      "/reference/drawing#Drawing-fillet",
    );
  });

  it("matches prefixes and is case-insensitive", () => {
    const results = searchDocs(docs, "DRAWC");
    expect(results[0].label).toBe("drawCircle");
  });

  it("deprioritizes legacy symbols", () => {
    const results = searchDocs(docs, "sketcher");
    const legacyIndex = results.findIndex((doc) => doc.label === "Sketcher");
    expect(legacyIndex).toBeGreaterThanOrEqual(0);
  });

  it("returns nothing for empty queries and respects the limit", () => {
    expect(searchDocs(docs, "   ")).toEqual([]);
    expect(searchDocs(docs, "d", 2)).toHaveLength(2);
  });
});
