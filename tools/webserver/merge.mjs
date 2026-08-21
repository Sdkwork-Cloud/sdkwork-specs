// Layout v2 inheritance merge per SDKWORK_WEBSERVER_SPEC.md section 2.3.
// merge(common, profile) produces the effective configuration for a profile.
// Object arrays merge by identity key (upsert); leaf arrays and scalars are
// overridden; plain tables merge recursively; [[http.upstream.target]] is
// replaced wholesale (it is not an identity-merged array).

const IDENTITY_PATHS = {
  'http.server': 'serverName', // first element of the array
  'http.upstream': 'name',
  'http.server.location': 'match',
  'stream.server': 'listen', // first element of the array
};

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityOf(element, path) {
  const key = IDENTITY_PATHS[path];
  if (key === undefined) return null;
  const value = element[key];
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  if (typeof value === 'string') return value;
  return null;
}

function merge(base, overlay, path) {
  if (overlay === undefined) return base;
  if (base === undefined) return overlay;
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const out = {};
    for (const key of Object.keys(base)) out[key] = base[key];
    for (const key of Object.keys(overlay)) {
      const childPath = path ? `${path}.${key}` : key;
      out[key] = merge(out[key], overlay[key], childPath);
    }
    return out;
  }
  if (Array.isArray(base) && Array.isArray(overlay)) {
    return mergeArray(base, overlay, path);
  }
  // Scalars and type mismatches: the overlay wins.
  return overlay;
}

function mergeArray(base, overlay, path) {
  const identityKey = IDENTITY_PATHS[path];
  if (identityKey === undefined) return overlay; // leaf array: replace
  const out = [];
  const ids = new Set();
  const idToIndex = new Map();
  for (const item of base) {
    if (isPlainObject(item)) {
      const id = identityOf(item, path);
      if (id !== null) {
        if (ids.has(id)) continue; // duplicate identity in base: keep first
        ids.add(id);
        idToIndex.set(id, out.length);
        out.push({ ...item });
      } else {
        out.push({ ...item });
      }
    } else {
      out.push(item);
    }
  }
  for (const item of overlay) {
    if (isPlainObject(item)) {
      const id = identityOf(item, path);
      if (id !== null) {
        if (ids.has(id)) {
          const index = idToIndex.get(id);
          out[index] = merge(out[index], item, path);
        } else {
          ids.add(id);
          idToIndex.set(id, out.length);
          out.push({ ...item });
        }
      } else {
        out.push({ ...item });
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * Compute the effective configuration for a deployment profile.
 * @param {object} common parsed server.common.toml
 * @param {object} profile parsed server.<profile>.toml
 * @returns {object}
 */
export function mergeConfigs(common, profile) {
  return merge(common, profile, '');
}
