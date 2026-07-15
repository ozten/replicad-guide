/**
 * "Open in studio" deep-links. Mirrors the canonical encoding used by
 * replicad-docs' WorkbenchButton and studio's loadCode (vendor/replicad/
 * packages/replicad-docs/.../WorkbenchButton/index.js and
 * packages/studio/src/utils/{dumpCode,loadCode}.js):
 * JSZip file "code.js" → DEFLATE level 6 → base64 → encodeURIComponent →
 * set as the `?code=` query param (searchParams.set adds a second encoding
 * layer; studio decodes both — searchParams.get, then decodeURIComponent).
 */
import JSZip from "jszip";

export const STUDIO_WORKBENCH_URL = "https://studio.replicad.xyz/workbench";

export async function toStudioUrl(code: string): Promise<string> {
  const zip = new JSZip();
  zip.file("code.js", code);
  const content = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });

  const url = new URL(STUDIO_WORKBENCH_URL);
  url.searchParams.set("code", encodeURIComponent(content));
  return url.toString();
}

/**
 * Decodes a workbench URL back to its source — the exact inverse studio
 * applies (codeInit's getUrlParam + loadCode). Used to prove round-trips.
 */
export async function decodeStudioUrl(
  urlString: string,
): Promise<string | undefined> {
  const param = new URL(urlString).searchParams.get("code");
  if (!param) return undefined;

  const content = decodeURIComponent(param);
  const zip = await new JSZip().loadAsync(content, { base64: true });
  return zip.file("code.js")?.async("string");
}
