/**
 * 2D quick-reference examples (U5), ordered most-common → least-common per
 * docs/reference/replicad-api-inventory.md §1. Modern draw()/Drawing API
 * only (R10) — no legacy Sketcher. (drawText is deferred to v1.1: it needs
 * a bundled font for the Node evaluator.)
 */
import type { Example } from "../index";
import { penExamples } from "./pen";
import { cannedExamples } from "./canned";
import { opsExamples } from "./ops";
import { rareExamples } from "./rare";

/** Canonical section order for the 2D page; the page TOC and tests share it. */
export const groups2d = [
  "Start here — the pen",
  "Canned shapes",
  "Operating on a Drawing",
  "Rarely needed",
] as const;

export const examples2d: Example[] = [
  ...penExamples,
  ...cannedExamples,
  ...opsExamples,
  ...rareExamples,
];
