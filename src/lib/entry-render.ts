/**
 * Pure helpers behind ApiEntry.astro — factored out so the content lints
 * are unit-testable without rendering a component.
 */

/** R4: every entry must state how you obtain or call the thing. */
export function assertEntryPoint(
  id: string,
  entryPoint: unknown,
): asserts entryPoint is string {
  if (typeof entryPoint !== "string" || entryPoint.trim() === "") {
    throw new Error(
      `[${id}] entry is missing its entry point — every entry must show how to obtain the object (R4)`,
    );
  }
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeXml(text: string): string {
  return text.replace(/[&<>]/g, (char) => XML_ESCAPES[char]);
}

/**
 * Gives an inline SVG document an accessible name: `role="img"` on the root
 * element and a `<title>` as its first child. Throws, naming the entry, when
 * the name would be empty or the document is not an inline SVG — the content
 * lint for visuals.
 */
export function accessibleSvg(
  svg: string,
  title: string,
  entryId: string,
): string {
  const name = title?.trim();
  if (!name) {
    throw new Error(`[${entryId}] visual has no accessible name`);
  }

  const openTag = svg.match(/<svg\b[^>]*>/)?.[0];
  if (!openTag) {
    throw new Error(`[${entryId}] visual is not an inline <svg> document`);
  }

  const withRole = openTag.includes("role=")
    ? openTag
    : openTag.replace(/\s*>$/, ' role="img">');

  return svg.replace(openTag, `${withRole}<title>${escapeXml(name)}</title>`);
}
