/**
 * Site-wide search (U8/v1.1): a compact, dependency-free symbol index.
 *
 * The corpus is API symbols and curated quick-ref entries — structured data
 * we already have — so this is a scored lookup over names and aliases, not
 * full-text search. `buildSearchIndex` runs at build time (the
 * /search-index.json endpoint); `searchDocs` is shared by tests and the
 * browser island in ReferenceLayout, so ranking is identical in both.
 */
import type { RefGroup } from "./api-model";

export type SearchDoc = {
  /** Display label, e.g. "drawCircle", "Solid.fillet()", "Fillet — round edges". */
  label: string;
  /** Secondary display line: where the hit lives ("Drawing (2D) · function"). */
  detail: string;
  /** Page + anchor, e.g. "/reference/drawing#drawCircle". */
  href: string;
  /** Lowercase match keys beyond the label. */
  aliases: string[];
  /** Tie-break boost: curated quick-ref entries outrank raw members. */
  weight: number;
};

export type QuickRefSource = {
  id: string;
  title: string;
  entryPoint: string;
  /** The page the entry lives on: "/2d" or "/3d". */
  page: "/2d" | "/3d";
};

const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const STOPWORDS = new Set([
  "a", "an", "and", "as", "config", "const", "in", "new", "of", "on", "or",
  "the", "to", "with",
]);

/** Identifier-ish aliases from an entry-point line ("drawCircle(radius) → Drawing"). */
function identifierAliases(text: string): string[] {
  return (text.match(IDENTIFIER) ?? [])
    .filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()))
    .map((word) => word.toLowerCase());
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildSearchIndex(
  groups: RefGroup[],
  quickRef: QuickRefSource[],
): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const entry of quickRef) {
    docs.push({
      label: entry.title,
      detail: entry.page === "/2d" ? "2D quick ref" : "3D quick ref",
      href: `${entry.page}#${entry.id}`,
      aliases: dedupe([
        entry.id,
        entry.id.replace(/-/g, " "),
        entry.title.toLowerCase(),
        ...identifierAliases(entry.entryPoint),
      ]),
      weight: 3,
    });
  }

  for (const group of groups) {
    for (const entry of group.entries) {
      const href = `/reference/${group.id}#${entry.name}`;
      docs.push({
        label: entry.name,
        detail: `${group.title} · ${entry.kind}`,
        href,
        aliases: dedupe([
          entry.name.toLowerCase(),
          ...(entry.entryPoint ? identifierAliases(entry.entryPoint) : []),
        ]),
        weight: entry.legacy ? 1 : 2,
      });

      for (const member of entry.members ?? []) {
        if (member.kind === "constructor") continue;
        docs.push({
          label: `${entry.name}.${member.name}${member.kind === "method" ? "()" : ""}`,
          detail: `${group.title} · ${entry.name} ${member.kind}`,
          href: `/reference/${group.id}#${entry.name}-${member.name}`,
          aliases: dedupe([
            member.name.toLowerCase(),
            `${entry.name}.${member.name}`.toLowerCase(),
          ]),
          weight: entry.legacy ? 0 : 1,
        });
      }
    }
  }

  return docs;
}

const EXACT = 100;
const PREFIX = 80;
const SUBSTRING = 60;

function scoreDoc(doc: SearchDoc, query: string): number {
  let best = 0;
  for (const key of [doc.label.toLowerCase(), ...doc.aliases]) {
    if (key === query) best = Math.max(best, EXACT);
    else if (key.startsWith(query)) best = Math.max(best, PREFIX);
    else if (key.includes(query)) best = Math.max(best, SUBSTRING);
    if (best === EXACT) break;
  }
  return best === 0 ? 0 : best + doc.weight;
}

/** Top matches for a query, best first. Empty/whitespace queries match nothing. */
export function searchDocs(
  docs: SearchDoc[],
  query: string,
  limit = 10,
): SearchDoc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, q) }))
    .filter((scored) => scored.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.doc.label.length - b.doc.label.length ||
        a.doc.label.localeCompare(b.doc.label),
    )
    .slice(0, limit)
    .map((scored) => scored.doc);
}
