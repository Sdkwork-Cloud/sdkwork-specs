const PACKAGE_NAMES = new Set([
  'flutter-mobile',
  'harmony-mobile',
  'android-mobile',
  'ios-mobile',
  'mini-program-weixin',
  'mini-program-alipay',
  'desktop-windows',
  'desktop-macos',
  'desktop-linux',
]);

const WEB_VALUES = new Set(['adaptive', 'auto', 'pc', 'h5']);
const EXPOSE_MODES = new Set(['web', 'api', 'web+api']);
const LAYOUTS = new Set(['source-tree', 'binary-package']);

function push(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateExposeItem(item, path, errors) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    push(errors, path, 'must be an object');
    return;
  }
  for (const key of Object.keys(item)) {
    if (
      !['domain', 'tls', 'mode', 'web', 'aliases', 'apiPathStyle'].includes(key)
    ) {
      push(errors, path, `unknown property "${key}"`);
    }
  }
  if (typeof item.domain !== 'string' || !item.domain.trim()) {
    push(errors, `${path}.domain`, 'is required');
  }
  if (item.mode !== undefined && !EXPOSE_MODES.has(item.mode)) {
    push(errors, `${path}.mode`, 'must be web, api, or web+api');
  }
  if (item.apiPathStyle !== undefined && !['full-prefix', 'strip-prefix'].includes(item.apiPathStyle)) {
    push(errors, `${path}.apiPathStyle`, 'must be full-prefix or strip-prefix');
  }
  if (item.web !== undefined) {
    if (typeof item.web === 'string') {
      if (!WEB_VALUES.has(item.web)) {
        push(errors, `${path}.web`, 'invalid web surface selector');
      }
    } else if (Array.isArray(item.web)) {
      if (item.web.length < 1 || item.web.length > 2) {
        push(errors, `${path}.web`, 'array must contain 1 or 2 surfaces');
      }
      for (const [index, surface] of item.web.entries()) {
        if (surface !== 'pc' && surface !== 'h5') {
          push(errors, `${path}.web[${index}]`, 'must be pc or h5');
        }
      }
    } else {
      push(errors, `${path}.web`, 'must be a string or array');
    }
  }
  if (item.aliases !== undefined) {
    if (!Array.isArray(item.aliases)) {
      push(errors, `${path}.aliases`, 'must be an array');
    } else {
      for (const [index, alias] of item.aliases.entries()) {
        if (typeof alias !== 'string' || !alias.trim()) {
          push(errors, `${path}.aliases[${index}]`, 'must be a non-empty string');
        }
      }
    }
  }
}

function validatePackages(packages, path, errors) {
  if (packages === undefined) {
    return;
  }
  if (Array.isArray(packages)) {
    for (const [index, item] of packages.entries()) {
      if (typeof item !== 'string' || !PACKAGE_NAMES.has(item)) {
        push(errors, `${path}[${index}]`, 'unknown package name');
      }
    }
    return;
  }
  if (typeof packages === 'object') {
    for (const [group, items] of Object.entries(packages)) {
      if (!Array.isArray(items)) {
        push(errors, `${path}.${group}`, 'must be an array');
        continue;
      }
      for (const [index, item] of items.entries()) {
        if (typeof item !== 'string') {
          push(errors, `${path}.${group}[${index}]`, 'must be a string');
        }
      }
    }
    return;
  }
  push(errors, path, 'must be an array or grouped object');
}

function validateInstall(install, path, errors) {
  if (install === undefined) {
    return;
  }
  if (!install || typeof install !== 'object' || Array.isArray(install)) {
    push(errors, path, 'must be an object');
    return;
  }
  for (const key of Object.keys(install)) {
    if (key !== 'layout') {
      push(errors, path, `unknown property "${key}"`);
    }
  }
  if (install.layout !== undefined && !LAYOUTS.has(install.layout)) {
    push(errors, `${path}.layout`, 'must be source-tree or binary-package');
  }
}

function validateProfileBlock(block, path, errors) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    push(errors, path, 'must be an object');
    return;
  }
  for (const key of Object.keys(block)) {
    if (!['install', 'expose', 'packages', 'overrides'].includes(key)) {
      push(errors, path, `unknown property "${key}"`);
    }
  }
  validateInstall(block.install, `${path}.install`, errors);
  if (block.expose !== undefined) {
    if (!Array.isArray(block.expose)) {
      push(errors, `${path}.expose`, 'must be an array');
    } else {
      for (const [index, item] of block.expose.entries()) {
        validateExposeItem(item, `${path}.expose[${index}]`, errors);
      }
    }
  }
  validatePackages(block.packages, `${path}.packages`, errors);
}

export function validateDeploySchema(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['deploy manifest must be a YAML object'];
  }

  for (const key of Object.keys(doc)) {
    if (
      ![
        'version',
        'profile',
        'defaultProfile',
        'profiles',
        'install',
        'expose',
        'packages',
        'overrides',
      ].includes(key)
    ) {
      push(errors, key, 'unknown root property');
    }
  }

  if (doc.version !== 1) {
    push(errors, 'version', 'must be 1');
  }

  const hasProfiles = doc.profiles !== undefined;
  if (hasProfiles) {
    if (typeof doc.profiles !== 'object' || Array.isArray(doc.profiles)) {
      push(errors, 'profiles', 'must be an object');
    } else if (Object.keys(doc.profiles).length === 0) {
      push(errors, 'profiles', 'must contain at least one profile');
    } else {
      for (const [profileId, block] of Object.entries(doc.profiles)) {
        validateProfileBlock(block, `profiles.${profileId}`, errors);
      }
    }
    if (typeof doc.defaultProfile !== 'string' || !doc.defaultProfile.trim()) {
      push(errors, 'defaultProfile', 'is required in profiles mode');
    } else if (doc.profiles && !doc.profiles[doc.defaultProfile]) {
      push(errors, 'defaultProfile', `unknown profile "${doc.defaultProfile}"`);
    }
    for (const forbidden of ['profile', 'install', 'expose', 'packages', 'overrides']) {
      if (doc[forbidden] !== undefined) {
        push(errors, forbidden, 'forbidden in profiles mode');
      }
    }
  } else {
    if (typeof doc.profile !== 'string' || !doc.profile.trim()) {
      push(errors, 'profile', 'is required in simple mode');
    }
    if (!Array.isArray(doc.expose)) {
      push(errors, 'expose', 'is required in simple mode');
    } else {
      for (const [index, item] of doc.expose.entries()) {
        validateExposeItem(item, `expose[${index}]`, errors);
      }
    }
    validateInstall(doc.install, 'install', errors);
    validatePackages(doc.packages, 'packages', errors);
  }

  return errors;
}
