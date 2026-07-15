import { describe, expect, it } from "vitest";
import { decodeStudioUrl, toStudioUrl } from "./studio-link";

describe("toStudioUrl", () => {
  it("points at the studio workbench with a ?code= query param", async () => {
    const url = new URL(await toStudioUrl("const main = () => {};"));

    expect(url.origin).toBe("https://studio.replicad.xyz");
    expect(url.pathname).toBe("/workbench");
    expect(url.searchParams.get("code")).toBeTruthy();
  });

  it("round-trips code through studio's decode algorithm", async () => {
    const code = `const main = () => {
  const { drawCircle } = replicad;
  return drawCircle(20);
};`;

    expect(await decodeStudioUrl(await toStudioUrl(code))).toBe(code);
  });

  it("round-trips unicode and special characters unchanged", async () => {
    const code = `// démo — 直径 20mm ("quoted" & <tags> + 100%)\nconst main = () => replicad.drawCircle(20);`;

    expect(await decodeStudioUrl(await toStudioUrl(code))).toBe(code);
  });
});
