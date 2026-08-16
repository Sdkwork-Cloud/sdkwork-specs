/**
 * Publisher registry. Adds a new language by dropping a file in `./publishers/`
 * and exporting `language`, `detect`, `build`, `publish`, `hasCredentials`,
 * and `credentialName`.
 */
import * as typescript from './publishers/typescript.mjs';
import * as rust from './publishers/rust.mjs';
import * as java from './publishers/java.mjs';
import * as flutter from './publishers/flutter.mjs';
import * as python from './publishers/python.mjs';
import * as go from './publishers/go.mjs';

export const publishers = {
  typescript,
  rust,
  java,
  flutter,
  python,
  go,
};

/**
 * @param {string} language
 * @returns {object|null}
 */
export function getPublisher(language) {
  return publishers[language] ?? null;
}
