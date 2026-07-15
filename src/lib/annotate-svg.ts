/**
 * Colored annotation overlay for 2D SVG visuals — an explanatory layer
 * (origin cross, region boxes, coordinate labels) injected into a composed
 * drawing document. The drawing itself stays black; annotations carry their
 * own colors so they read as explanation, not geometry.
 *
 * Coordinates are authored in the drawing's model space (+y up). Replicad's
 * SVG export negates y (vendor .../blueprints/svg.ts), so every annotation
 * point is flipped the same way: model (x, y) → SVG (x, -y).
 *
 * Pure string manipulation on the SVG document. The viewBox is expanded to
 * fit annotations that extend past the drawing (an inBox region usually
 * does), and marker/label sizes are derived from the combined extent so the
 * overlay scales with any drawing.
 */

export type AnnotationPoint = [number, number];

export type AnnotationBox = {
  /** Two opposite corners in model coordinates — mirrors CornerFinder.inBox. */
  from: AnnotationPoint;
  to: AnnotationPoint;
};

export type Annotations = {
  /** Mark [0, 0] with an axes cross labeled "0,0". */
  origin?: boolean;
  /** Axis-aligned regions, each labeled at its two defining corners. */
  boxes?: AnnotationBox[];
};

const BOX_COLOR = "#2563eb"; // blue — regions (e.g. a CornerFinder's inBox)
const ORIGIN_COLOR = "#dc2626"; // red — the origin marker

/** Label font size as a fraction of the combined extent's larger side. */
const FONT_RATIO = 0.07;
/** Estimated monospace advance per character, as a fraction of font size. */
const CHAR_WIDTH = 0.62;

/** Compact fixed-precision number for SVG attributes ("-0" normalized). */
const fmt = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

function assertFinitePoint(
  id: string,
  point: AnnotationPoint,
  what: string,
): void {
  const ok =
    Array.isArray(point) &&
    point.length === 2 &&
    point.every((value) => Number.isFinite(value));
  if (!ok) {
    throw new Error(
      `[${id}] annotation ${what} must be a finite [x, y] pair, got ${JSON.stringify(point)}`,
    );
  }
}

/** Mutable bounding extent in SVG space. */
type Extent = { x0: number; y0: number; x1: number; y1: number };

function extend(extent: Extent, x: number, y: number): void {
  extent.x0 = Math.min(extent.x0, x);
  extent.y0 = Math.min(extent.y0, y);
  extent.x1 = Math.max(extent.x1, x);
  extent.y1 = Math.max(extent.y1, y);
}

/**
 * A coordinate label anchored at an SVG-space point. `side` places the text
 * above or below the point; `anchor` decides which way it runs from x, so
 * callers can point text inward (over the region) instead of outward.
 * Returns the markup and records the estimated text bounds in `extent`.
 */
function textAt(
  extent: Extent,
  label: string,
  x: number,
  y: number,
  font: number,
  color: string,
  anchor: "start" | "end",
  side: "above" | "below",
): string {
  const baseline = side === "below" ? y + 1.5 * font : y - 0.8 * font;
  const width = CHAR_WIDTH * font * label.length;
  extend(extent, anchor === "start" ? x + width : x - width, baseline - 0.8 * font);
  extend(extent, x, baseline + 0.25 * font);
  return `<text x="${fmt(x)}" y="${fmt(baseline)}" text-anchor="${anchor}" fill="${color}">${label}</text>`;
}

/**
 * Injects the annotation overlay into a composed SVG document (one produced
 * by svgFromDrawingEntry or Drawing.toSVG — user units must be model units).
 * Returns the document unchanged when there is nothing to draw. Applied at
 * render time to 2D visuals only; annotations are display-side, so they are
 * deliberately absent from the example `code` and its studio link.
 */
export function annotateSvg(
  id: string,
  svg: string,
  annotations?: Annotations,
): string {
  const boxes = annotations?.boxes ?? [];
  if (!annotations || (!annotations.origin && boxes.length === 0)) return svg;

  const openTag = svg.match(/<svg\b[^>]*>/)?.[0];
  const viewboxAttr = openTag?.match(/\bviewBox="([^"]*)"/);
  const parsed = viewboxAttr?.[1].trim().split(/\s+/).map(Number) ?? [];
  if (!openTag || !viewboxAttr || parsed.length !== 4 || parsed.some((v) => !Number.isFinite(v))) {
    throw new Error(`[${id}] cannot annotate: SVG has no parsable viewBox`);
  }
  if (!/<\/svg>\s*$/.test(svg)) {
    // a silent no-op replace would drop the overlay; fail loudly instead
    throw new Error(`[${id}] cannot annotate: document does not end in </svg>`);
  }
  const [minX, minY, width, height] = parsed;

  // Pass 1 — combined extent of drawing + raw annotation geometry (SVG
  // space), which sets the scale every marker and label derives from.
  const extent: Extent = { x0: minX, y0: minY, x1: minX + width, y1: minY + height };
  for (const [index, box] of boxes.entries()) {
    assertFinitePoint(id, box.from, `boxes[${index}].from`);
    assertFinitePoint(id, box.to, `boxes[${index}].to`);
    extend(extent, box.from[0], -box.from[1]);
    extend(extent, box.to[0], -box.to[1]);
  }
  if (annotations.origin) extend(extent, 0, 0);

  const font = FONT_RATIO * Math.max(extent.x1 - extent.x0, extent.y1 - extent.y0);
  const strokeWidth = 0.09 * font;

  // Pass 2 — build markup, extending the extent with decoration bounds.
  const parts: string[] = [];

  for (const box of boxes) {
    const left = Math.min(box.from[0], box.to[0]);
    const right = Math.max(box.from[0], box.to[0]);
    const top = -Math.max(box.from[1], box.to[1]);
    const bottom = -Math.min(box.from[1], box.to[1]);
    parts.push(
      `<rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(right - left)}" height="${fmt(bottom - top)}" fill="${BOX_COLOR}" fill-opacity="0.06" stroke="${BOX_COLOR}" stroke-width="${fmt(strokeWidth)}" stroke-dasharray="${fmt(0.5 * font)} ${fmt(0.35 * font)}" />`,
    );
    for (const corner of [box.from, box.to]) {
      const [x, y] = corner;
      const dotRadius = 0.3 * font;
      parts.push(`<circle cx="${fmt(x)}" cy="${fmt(-y)}" r="${fmt(dotRadius)}" fill="${BOX_COLOR}" />`);
      extend(extent, x - dotRadius, -y - dotRadius);
      extend(extent, x + dotRadius, -y + dotRadius);
      // stack outside the region vertically, run inward horizontally
      parts.push(
        textAt(
          extent,
          `${x}, ${y}`,
          x,
          -y,
          font,
          BOX_COLOR,
          x === left ? "start" : "end",
          -y === bottom ? "below" : "above",
        ),
      );
    }
  }

  if (annotations.origin) {
    const arm = 1.2 * font;
    parts.push(
      `<path d="M ${fmt(-arm)} 0 H ${fmt(arm)} M 0 ${fmt(-arm)} V ${fmt(arm)}" stroke="${ORIGIN_COLOR}" stroke-width="${fmt(strokeWidth)}" />`,
    );
    extend(extent, -arm, -arm);
    extend(extent, arm, arm);
    parts.push(
      textAt(extent, "0,0", 0.4 * font, arm - 0.6 * font, font, ORIGIN_COLOR, "start", "below"),
    );
  }

  const pad = 0.6 * font;
  const viewbox = [
    fmt(extent.x0 - pad),
    fmt(extent.y0 - pad),
    fmt(extent.x1 - extent.x0 + 2 * pad),
    fmt(extent.y1 - extent.y0 + 2 * pad),
  ].join(" ");

  const group = `  <g class="annotations" stroke="none" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${fmt(font)}">
    ${parts.join("\n    ")}
  </g>`;

  return svg
    .replace(openTag, openTag.replace(viewboxAttr[0], `viewBox="${viewbox}"`))
    .replace(/<\/svg>\s*$/, `${group}\n</svg>`);
}
