import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import { REPLICAD_VERSION_LABEL } from "../lib/replicad-version";
import { accessibleSvg, assertEntryPoint } from "../lib/entry-render";
// @ts-expect-error -- .astro import is resolved by Astro's vite plugin
import ApiEntry from "./ApiEntry.astro";
// @ts-expect-error -- .astro import is resolved by Astro's vite plugin
import VersionBadge from "./VersionBadge.astro";

const SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" fill="none" stroke="black" stroke-width="0.6%" vector-effect="non-scaling-stroke">
    <path d="M 0 0 L 1 1" />
</svg>`;

const entry = {
  id: "draw-circle",
  title: "Draw a circle",
  entryPoint: "drawCircle(radius) → Drawing",
  group: "Canned shapes",
  commonness: "ESSENTIAL" as const,
  code: `const main = () => {
  const { drawCircle } = replicad;
  // special chars: <tags> & "quotes"
  return drawCircle(20);
};`,
  studioUrl: "https://studio.replicad.xyz/workbench?code=abc",
  visuals: [{ kind: "2d" as const, name: "Shape", svg: SVG }],
};

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

describe("ApiEntry", () => {
  it("renders all parts: entry point, signature, code, visual, copy button, studio link", async () => {
    const html = await container.renderToString(ApiEntry, {
      props: { entry, signature: "drawCircle(radius: number): Drawing" },
    });

    expect(html).toContain('id="draw-circle"');
    expect(html).toContain("data-entry-point");
    expect(html).toContain("drawCircle(radius) → Drawing");
    expect(html).toContain("data-signature");
    expect(html).toContain("drawCircle(radius: number): Drawing");
    expect(html).toContain("data-code-block");
    expect(html).toContain("data-copy");
    expect(html).toContain("data-visual");
    expect(html).toContain(`href="${entry.studioUrl}"`);
  });

  it("omits the signature block cleanly when no signature is given (v1)", async () => {
    const html = await container.renderToString(ApiEntry, { props: { entry } });
    expect(html).not.toContain("data-signature");
  });

  it("renders one code+visual pair per visual", async () => {
    const twoVisuals = {
      ...entry,
      visuals: [
        { kind: "3d" as const, name: "Shape 0", svg: SVG },
        { kind: "2d" as const, name: "Shape 1", svg: SVG },
      ],
    };
    const html = await container.renderToString(ApiEntry, {
      props: { entry: twoVisuals },
    });

    expect(html.match(/data-pair/g)).toHaveLength(2);
    expect(html.match(/data-visual/g)).toHaveLength(2);
  });

  it("omits the visual slot cleanly for a no-visual entry", async () => {
    const noVisual = { ...entry, visuals: [], studioUrl: undefined };
    const html = await container.renderToString(ApiEntry, {
      props: { entry: noVisual },
    });

    expect(html.match(/data-pair/g)).toHaveLength(1);
    expect(html).not.toContain("data-visual");
    expect(html).not.toContain("data-studio-link");
    expect(html).toContain("data-code-block");
  });

  it("throws, naming the entry, when the entry point is missing (R4)", async () => {
    await expect(
      container.renderToString(ApiEntry, {
        props: { entry: { ...entry, entryPoint: "  " } },
      }),
    ).rejects.toThrow(/draw-circle.*entry point/);
  });

  it("gives every visual an accessible name: role and a non-empty title", async () => {
    const html = await container.renderToString(ApiEntry, { props: { entry } });

    const svgTags = html.match(/<svg\b[^>]*>/g) ?? [];
    expect(svgTags.length).toBeGreaterThan(0);
    for (const tag of svgTags) {
      expect(tag).toContain('role="img"');
    }
    expect(html).toMatch(/<svg\b[^>]*><title>[^<]+<\/title>/);
    expect(html).toContain("<title>Draw a circle — Shape</title>");
  });

  it("keeps OBSCURE entries deemphasized but present in the DOM (R3)", async () => {
    const obscure = { ...entry, id: "punch-hole", commonness: "OBSCURE" as const };
    const html = await container.renderToString(ApiEntry, {
      props: { entry: obscure },
    });

    expect(html).toMatch(/class="[^"]*obscure/);
    expect(html).toContain('id="punch-hole"');
    expect(html).toContain("data-code-block");
    expect(html).toContain('href="/reference"');
  });

  it("round-trips the displayed code exactly (R9 display integrity)", async () => {
    const html = await container.renderToString(ApiEntry, { props: { entry } });

    const codeBlock = html.match(
      /data-code-block[^>]*>\s*<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
    );
    expect(codeBlock).not.toBeNull();
    expect(decodeEntities(codeBlock![1])).toBe(entry.code);
  });

  it("round-trips hostile code exactly: backticks, entities, backslashes (R9)", async () => {
    const hostile = {
      ...entry,
      code: [
        "const main = () => {",
        '  const label = `size: ${20}mm — "quoted" & <b>bold</b>`;',
        "  const path = 'C:\\\\temp\\\\model';",
        "  // '</code></pre> attempted breakout & &amp; double-escape",
        "  return replicad.drawCircle(20);",
        "};",
      ].join("\n"),
    };
    const html = await container.renderToString(ApiEntry, {
      props: { entry: hostile },
    });

    const codeBlock = html.match(
      /data-code-block[^>]*>\s*<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
    );
    expect(codeBlock).not.toBeNull();
    expect(decodeEntities(codeBlock![1])).toBe(hostile.code);
  });
});

describe("VersionBadge", () => {
  it("shows the pinned replicad version label (R15)", async () => {
    const html = await container.renderToString(VersionBadge, {});
    expect(html).toContain(REPLICAD_VERSION_LABEL);
  });
});

describe("entry-render lints", () => {
  it("accessibleSvg rejects an empty accessible name", () => {
    expect(() => accessibleSvg(SVG, "  ", "some-entry")).toThrow(
      /\[some-entry\].*accessible name/,
    );
  });

  it("accessibleSvg rejects a non-SVG document", () => {
    expect(() => accessibleSvg("<div>nope</div>", "Name", "some-entry")).toThrow(
      /\[some-entry\]/,
    );
  });

  it("assertEntryPoint rejects non-string values", () => {
    expect(() => assertEntryPoint("x", undefined)).toThrow(/\[x\]/);
  });

  it("accessibleSvg keeps an existing role attribute instead of doubling it", () => {
    const withRole = SVG.replace("<svg ", '<svg role="presentation" ');
    const result = accessibleSvg(withRole, "Name", "some-entry");

    expect(result.match(/\brole\s*=/g)).toHaveLength(1);
    expect(result).toContain('role="presentation"');
    expect(result).toContain("<title>Name</title>");
  });

  it("accessibleSvg is not fooled by 'role=' inside another attribute value", () => {
    const tricky = SVG.replace("<svg ", '<svg data-note="role=decoy" ');
    const result = accessibleSvg(tricky, "Name", "some-entry");

    expect(result).toContain('role="img"');
  });
});
