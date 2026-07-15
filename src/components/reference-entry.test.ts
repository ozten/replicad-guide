import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import { formatDocText } from "../lib/entry-render";
import type { RefEntry } from "../lib/api-model";
// @ts-expect-error -- .astro import is resolved by Astro's vite plugin
import ReferenceEntry from "./ReferenceEntry.astro";

const SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" fill="none" stroke="black" stroke-width="0.6%" vector-effect="non-scaling-stroke">
    <path d="M 0 0 L 1 1" />
</svg>`;

const functionEntry: RefEntry = {
  name: "drawCircle",
  kind: "function",
  signature: "drawCircle(radius: number): Drawing",
  description: "Creates the `Drawing` of a circle.\n\nSecond paragraph.",
  params: [
    { name: "radius", type: "number", optional: false, description: "the circle radius" },
  ],
  file: "draw.ts",
  sourceUrl: "https://example.test/draw.ts#L100",
};

const classEntry: RefEntry = {
  name: "Solid",
  kind: "class",
  signature: "class Solid extends _3DShape",
  extends: ["_3DShape"],
  entryPoint: "sketch.extrude() → Solid",
  members: [
    {
      name: "constructor",
      kind: "constructor",
      isStatic: false,
      signature: "new Solid(ocShape: TopoDS_Solid): Solid",
    },
    {
      name: "asKind",
      kind: "method",
      isStatic: true,
      signature: "asKind(): string",
    },
    {
      name: "oldWay",
      kind: "method",
      isStatic: false,
      signature: "oldWay(): void",
      deprecated: true,
    },
  ],
  file: "shapes.ts",
};

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

describe("ReferenceEntry", () => {
  it("renders name, kind, signature, and description (R13)", async () => {
    const html = await container.renderToString(ReferenceEntry, {
      props: { entry: functionEntry },
    });

    expect(html).toContain('id="drawCircle"');
    expect(html).toContain("data-signature");
    expect(html).toContain("drawCircle(radius: number): Drawing");
    expect(html).toContain("Creates the <code>Drawing</code> of a circle.");
    expect(html).toContain("the circle radius");
    expect(html).toContain('href="https://example.test/draw.ts#L100"');
  });

  it("renders signature-only when there is no description", async () => {
    const bare: RefEntry = {
      name: "mystery",
      kind: "function",
      signature: "mystery(): void",
      file: "x.ts",
    };
    const html = await container.renderToString(ReferenceEntry, {
      props: { entry: bare },
    });
    expect(html).toContain("mystery(): void");
    expect(html).not.toContain('class="doc"');
  });

  it("shows overloads inside the signature block", async () => {
    const overloaded: RefEntry = {
      ...functionEntry,
      name: "makePlane",
      signature: "makePlane(plane: Plane): Plane",
      overloads: ["makePlane(plane: PlaneName): Plane"],
    };
    const html = await container.renderToString(ReferenceEntry, {
      props: { entry: overloaded },
    });
    expect(html).toContain("makePlane(plane: Plane): Plane");
    expect(html).toContain("makePlane(plane: PlaneName): Plane");
  });

  it("renders class members with per-member anchors, static prefix, and deprecation", async () => {
    const html = await container.renderToString(ReferenceEntry, {
      props: { entry: classEntry },
    });

    expect(html).toContain('id="Solid-asKind"');
    expect(html).toContain("static asKind(): string");
    expect(html).toContain('id="Solid-oldWay"');
    expect(html).toMatch(/member-deprecated/);
    expect(html).toContain("sketch.extrude() → Solid");
  });

  it("links extends targets through hrefFor", async () => {
    const html = await container.renderToString(ReferenceEntry, {
      props: {
        entry: classEntry,
        hrefFor: { _3DShape: "#_3DShape" },
      },
    });
    expect(html).toContain('href="#_3DShape"');
    expect(html).toContain("inherited members are documented there");
  });

  it("marks legacy entries and embeds no examples for them (R10/R14)", async () => {
    const legacy: RefEntry = {
      name: "Sketcher",
      kind: "class",
      signature: "class Sketcher",
      legacy: true,
      members: [],
      file: "Sketcher.ts",
    };
    const html = await container.renderToString(ReferenceEntry, {
      props: { entry: legacy },
    });
    expect(html).toMatch(/class="[^"]*legacy/);
    expect(html).toContain(">legacy</span>");
    expect(html).not.toContain("data-embedded-example");
  });

  it("embeds a resolved example: code, accessible visual, studio link, quick-ref link (R14)", async () => {
    const html = await container.renderToString(ReferenceEntry, {
      props: {
        entry: functionEntry,
        examples: [
          {
            id: "draw-circle",
            title: "Circle",
            entryPoint: "drawCircle(radius) → Drawing",
            group: "Canned shapes",
            commonness: "ESSENTIAL",
            code: "const main = () => replicad.drawCircle(20);",
            studioUrl: "https://studio.replicad.xyz/workbench?code=abc",
            visuals: [{ kind: "2d", name: "Shape", svg: SVG }],
            quickRefHref: "/2d#draw-circle",
          },
        ],
      },
    });

    expect(html).toContain("data-embedded-example");
    expect(html).toContain("data-code-block");
    expect(html).toContain("const main = () =&gt; replicad.drawCircle(20);");
    expect(html).toContain('href="/2d#draw-circle"');
    expect(html).toContain('href="https://studio.replicad.xyz/workbench?code=abc"');
    expect(html).toMatch(/<svg\b[^>]*role="img"[^>]*><title>Circle — Shape<\/title>/);
  });
});

describe("formatDocText", () => {
  it("escapes HTML, renders code spans, and splits paragraphs", () => {
    expect(formatDocText("Uses `<svg>` & more.\n\nSecond.")).toBe(
      "<p>Uses <code>&lt;svg&gt;</code> &amp; more.</p><p>Second.</p>",
    );
  });

  it("returns no markup for empty text", () => {
    expect(formatDocText("  ")).toBe("");
  });
});
