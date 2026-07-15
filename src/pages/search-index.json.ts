/**
 * The site-wide search index, emitted as a static JSON asset at build time.
 * Sources: the generated reference model (all exports + members) and the
 * curated quick-ref registries.
 */
import type { APIRoute } from "astro";
import { buildSearchIndex, type QuickRefSource } from "../lib/search-index";
import type { RefGroup } from "../lib/api-model";
import { examples2d } from "../examples/2d/index";
import { examples3d } from "../examples/3d/index";
import api from "../../generated/api.json";

export const GET: APIRoute = () => {
  const quickRef: QuickRefSource[] = [
    ...examples2d.map((example) => ({
      id: example.id,
      title: example.title,
      entryPoint: example.entryPoint,
      page: "/2d" as const,
    })),
    ...examples3d.map((example) => ({
      id: example.id,
      title: example.title,
      entryPoint: example.entryPoint,
      page: "/3d" as const,
    })),
  ];

  const docs = buildSearchIndex(api.groups as RefGroup[], quickRef);
  return new Response(JSON.stringify(docs), {
    headers: { "Content-Type": "application/json" },
  });
};
