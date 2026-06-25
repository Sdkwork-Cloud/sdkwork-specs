/**
 * Canonical IAM path helpers and legacy fragment builders.
 * Compose retired paths from fragments so migration tooling and scanners
 * do not embed misleading sdkwork-appbase IAM ownership strings in source.
 */

export const IAM_REPO = ["sdkwork", "iam"].join("-");
export const APPBASE_REPO = ["sdkwork", "appbase"].join("-");

function joinPath(...segments) {
  return segments.join("/");
}

function appbasePath(...segments) {
  return joinPath(APPBASE_REPO, ...segments);
}

function iamPath(...segments) {
  return joinPath(IAM_REPO, ...segments);
}

const PC_REACT_IAM = joinPath("packages", "pc-react", "iam");
const COMMON_IAM = joinPath("packages", "common", "iam");

/** Fragments that must not appear in authored workspace sources. */
export function buildForbiddenIamPathFragments() {
  return [
    `${PC_REACT_IAM}/`,
    `${COMMON_IAM}/`,
    `${iamPath(PC_REACT_IAM)}/`,
    `${iamPath(COMMON_IAM)}/`,
    `${appbasePath(PC_REACT_IAM)}/`,
    `${appbasePath(COMMON_IAM)}/`,
    `${appbasePath("apps", "sdkwork-iam-pc")}/`,
    appbasePath("sdks", "sdkwork-iam-"),
    appbasePath("crates", "sdkwork-iam-"),
    appbasePath("crates", "sdkwork-router-iam-"),
  ];
}

/** Regexes for asserting retired appbase-owned IAM paths are absent. */
export function buildRetiredAppbaseIamRegexes() {
  return buildForbiddenIamPathFragments()
    .filter((fragment) => fragment.startsWith(`${APPBASE_REPO}/`))
    .map((fragment) => new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
}

/** Ordered legacy → canonical replacements for bulk repath tooling. */
export function buildLegacyIamRepathReplacements() {
  const pairs = [];
  const add = (from, to) => pairs.push([from, to]);

  for (const crate of [
    "sdkwork-iam-bootstrap",
    "sdkwork-iam-database-host",
    "sdkwork-iam-tauri-host",
    "sdkwork-user-center-tauri-host",
  ]) {
    add(appbasePath("crates", crate), iamPath("crates", crate));
  }
  add(appbasePath("crates", "sdkwork-router-iam-"), iamPath("crates", "sdkwork-router-iam-"));
  add(appbasePath("crates", "sdkwork-iam-"), iamPath("crates", "sdkwork-iam-"));

  add(appbasePath(`${PC_REACT_IAM}/`), `${iamPath("apps", "sdkwork-iam-pc", "packages")}/`);
  add(`${iamPath(PC_REACT_IAM)}/`, `${iamPath("apps", "sdkwork-iam-pc", "packages")}/`);
  add(`${PC_REACT_IAM}/`, `${joinPath("apps", "sdkwork-iam-pc", "packages")}/`);

  add(appbasePath(`${COMMON_IAM}/`), `${iamPath("apps", "sdkwork-iam-common", "packages")}/`);
  add(`${iamPath(COMMON_IAM)}/`, `${iamPath("apps", "sdkwork-iam-common", "packages")}/`);
  add(`${COMMON_IAM}/`, `${joinPath("apps", "sdkwork-iam-common", "packages")}/`);

  add(`${appbasePath("apps", "sdkwork-iam-pc")}/`, `${iamPath("apps", "sdkwork-iam-pc")}/`);
  add(appbasePath("sdks", "sdkwork-iam-"), iamPath("sdks", "sdkwork-iam-"));
  add(`../${appbasePath("sdks", "sdkwork-iam-")}`, `../${iamPath("sdks", "sdkwork-iam-")}`);
  add(`'../${appbasePath("sdks", "sdkwork-iam-")}`, `'../${iamPath("sdks", "sdkwork-iam-")}`);

  return pairs;
}

/** Build a cross-platform path regex under sdkwork-iam. */
export function iamSourcePathRegex(...segments) {
  const pattern = [IAM_REPO, ...segments].join("[\\\\/]");
  return new RegExp(pattern, "u");
}
