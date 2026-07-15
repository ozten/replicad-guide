import { getViteConfig } from "astro/config";

// getViteConfig wires Astro's vite plugins into vitest so .astro components
// can be rendered in tests via the container API.
export default getViteConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Rendering tests boot the OpenCascade WASM once per run; allow time for it.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    server: {
      deps: {
        // replicad-evaluator ships raw .ts via its package exports.
        inline: ["replicad-evaluator"],
      },
    },
  },
});
