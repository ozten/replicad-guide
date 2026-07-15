/**
 * Single source of truth for the pinned replicad checkout (vendor/replicad).
 * Update these when bumping the submodule ref — CI re-runs every example and
 * regenerates signatures against the new ref, so breakage is caught loudly.
 *
 * Note: package versions in the monorepo are independent of the tag —
 * `replicad` is 0.23.1 while the monorepo tag is v0.23.3.
 */
export const REPLICAD_GIT_REF = "4ddc78b777aacb320fae9c0f2c82b0d9a6efcf43";
export const REPLICAD_GIT_TAG = "v0.23.3";
export const REPLICAD_PACKAGE_VERSION = "0.23.1";

/** Human-readable label for the version badge. */
export const REPLICAD_VERSION_LABEL = `replicad ${REPLICAD_PACKAGE_VERSION} (${REPLICAD_GIT_TAG})`;
