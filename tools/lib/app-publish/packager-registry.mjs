/**
 * Packager registry. Adds a new architecture by dropping a file in
 * `./packagers/` exporting `architecture`, `defaultPlatforms`, `detect`,
 * `build`, and `collectArtifacts`.
 *
 * Mirrors lib/sdk-publish/publisher-registry.mjs. Upload transport is shared
 * via uploaders.mjs (registry-driven), so packagers own build + artifact
 * collection only.
 */
import * as pc from './packagers/pc.mjs';
import * as h5 from './packagers/h5.mjs';
import * as flutterMobile from './packagers/flutter-mobile.mjs';
import * as miniProgram from './packagers/mini-program.mjs';

export const packagers = {
  pc,
  h5,
  'flutter-mobile': flutterMobile,
  'mini-program': miniProgram,
};

/**
 * @param {string} architecture
 * @returns {object|null}
 */
export function getPackager(architecture) {
  return packagers[architecture] ?? null;
}
