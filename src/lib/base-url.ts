/**
 * Prefixes a root-relative path with the site's configured base path.
 *
 * The site deploys to a GitHub Pages project subpath
 * (https://ozten.github.io/replicad-guide/), so every internal href must
 * carry `base` from astro.config.mjs. Vite exposes it as BASE_URL ("/" when
 * no base is set — the helper is then a no-op), and it works identically in
 * Astro frontmatter, bundled client scripts, and vitest.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}
