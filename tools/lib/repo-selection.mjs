/**
 * Repository name matching for workspace sweep CLIs.
 *
 * Selectors use exact names or `selector-*` prefixes so `--repo sdkwork-im`
 * matches `sdkwork-im` but not `sdkwork-image`.
 */

/**
 * @param {string} repoName
 * @param {string | null | undefined} selector
 * @returns {boolean}
 */
export function matchesRepoName(repoName, selector) {
  if (!selector) return true;
  return repoName === selector || repoName.startsWith(`${selector}-`);
}

/**
 * @param {string} repoName
 * @param {string | null | undefined} filter
 * @returns {boolean}
 */
export function matchesRepoFilter(repoName, filter) {
  return matchesRepoName(repoName, filter);
}

/**
 * @param {string} repoName
 * @param {string[] | null | undefined} repoSelectors
 * @param {string | null | undefined} filter
 * @returns {boolean}
 */
export function matchesRepoSelection(repoName, repoSelectors, filter) {
  if (repoSelectors && repoSelectors.length > 0) {
    return repoSelectors.some((selector) => matchesRepoName(repoName, selector));
  }
  return matchesRepoFilter(repoName, filter);
}
