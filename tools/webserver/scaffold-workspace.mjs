// Layout v2 scaffold per SDKWORK_WEBSERVER_SPEC.md section 2.
// Splits an existing single-file server.toml (or topology facts) into
// server.common.toml + server.standalone.toml + server.cloud.toml and
// removes the retired server.toml. The common file carries the shared
// structure (hosts, certificates, static roots, upstream definitions);
// profile files carry only their deltas (upstream targets).
import fs from 'node:fs';
import path from 'node:path';

import { parseTomlSubset } from './toml.mjs';

const WORKSPACE = 'E:/sdkwork-space';
const SKIP = new Set(['sdkwork-webserver']); // hand-tuned seed, upgraded manually

function certName(host) {
  return host.split('.').slice(-2).join('.');
}

function tomlKey(name) {
  return /^[a-zA-Z0-9_-]+$/u.test(name) ? name : JSON.stringify(name);
}

function escapeString(value) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function formatValue(value) {
  if (typeof value === 'string') return escapeString(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[${value.map((item) => (typeof item === 'string' ? escapeString(item) : String(item))).join(', ')}]`;
  }
  throw new Error(`cannot serialize value of type ${typeof value}`);
}

// Emit one array-of-tables: [[parent.child]] elements with their nested
// child tables ([parent.child.sub]) and child arrays ([[parent.child.sub]]).
function emitArrayOfTables(lines, parentPath, array) {
  for (const element of array) {
    if (!isPlainObject(element)) continue;
    lines.push(`[[${parentPath}]]`);
    const rest = emitTableInto(lines, element, '');
    lines.push('');
    for (const [childKey, childTable] of rest.childTables) {
      lines.push(`[${parentPath}.${tomlKey(childKey)}]`);
      emitTableInto(lines, childTable, '');
      lines.push('');
    }
    for (const [childKey, childArray] of rest.childArrays) {
      emitArrayOfTables(lines, `${parentPath}.${tomlKey(childKey)}`, childArray);
    }
  }
}

function emitTableInto(lines, table, prefix) {
  const childTables = [];
  const childArrays = [];
  for (const [key, value] of Object.entries(table)) {
    if (Array.isArray(value)) {
      const isLeafArray = value.every((item) => !isPlainObject(item));
      if (isLeafArray) {
        lines.push(`${prefix}${key} = ${formatValue(value)}`);
      } else {
        childArrays.push([key, value]);
      }
    } else if (value !== null && typeof value === 'object') {
      childTables.push([key, value]);
    } else {
      lines.push(`${prefix}${key} = ${formatValue(value)}`);
    }
  }
  return { childTables, childArrays };
}

// Serialize the supported document subset back to TOML (layout v2 style).
function serialize(doc) {
  const lines = [];
  const scalars = [];
  const tables = [];
  const arraysOfTables = [];
  for (const [key, value] of Object.entries(doc)) {
    if (value === null || typeof value === 'object') {
      if (Array.isArray(value)) arraysOfTables.push([key, value]);
      else tables.push([key, value]);
    } else {
      scalars.push([key, value]);
    }
  }
  for (const [key, value] of scalars) lines.push(`${key} = ${formatValue(value)}`);
  lines.push('');
  for (const [key, table] of tables) {
    if (!isPlainObject(table)) continue;
    lines.push(`[${key}]`);
    const rest = emitTableInto(lines, table, '');
    lines.push('');
    for (const [childKey, childTable] of rest.childTables) {
      lines.push(`[${key}.${tomlKey(childKey)}]`);
      const inner = emitTableInto(lines, childTable, '');
      lines.push('');
      for (const [ck, ct] of inner.childTables) {
        lines.push(`[${key}.${tomlKey(childKey)}.${tomlKey(ck)}]`);
        emitTableInto(lines, ct, '');
        lines.push('');
      }
      for (const [ck, ca] of inner.childArrays) {
        emitArrayOfTables(lines, `${key}.${tomlKey(childKey)}.${tomlKey(ck)}`, ca);
      }
    }
    for (const [childKey, childArray] of rest.childArrays) {
      emitArrayOfTables(lines, `${key}.${tomlKey(childKey)}`, childArray);
    }
  }
  for (const [key, array] of arraysOfTables) {
    emitArrayOfTables(lines, key, array);
  }
  return `${lines.join('\n').replace(/\n{3,}/gu, '\n\n')}\n`;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildFromTopology(name, t) {
  const code = t.applicationCode || t.appId || name.replace(/^sdkwork-/, '');
  const hosts = [...new Set(Object.values(t.cloudPublicHosts).map((h) => h.httpHost).filter(Boolean))];
  const bind = t.defaults.gatewayBind;
  const doc = {
    specVersion: 1,
    kind: 'sdkwork.webserver.server',
    id: code,
    description: `${name} web server`,
    nginx: {
      enabled: true,
      profile: 'http-core-v1',
      unknownDirectivePolicy: 'error',
      strict: true,
      confFile: 'nginx.conf',
    },
    main: { user: 'sdkwork', workerProcesses: 'auto' },
    main_events: { workerConnections: 1024 },
    http: {
      sendfile: true,
      keepaliveTimeout: 75,
      clientMaxBodySize: '1100m',
      serverTokens: 'off',
      certificates: {},
      upstream: [{ name: 'gateway', loadBalancing: 'least-connections', keepalive: 32 }],
      server: [],
    },
  };
  for (const cn of [...new Set(hosts.map(certName))]) {
    doc.http.certificates[cn] = {
      certFile: `/opt/certs/letsencrypt/live/${cn}/fullchain.pem`,
      certKeyFile: `/opt/certs/letsencrypt/live/${cn}/privkey.pem`,
      chainFile: `/opt/certs/letsencrypt/live/${cn}/chain.pem`,
      ocspStapling: true,
    };
  }
  for (const host of hosts) {
    const server = {
      listen: ['443 ssl', '80'],
      serverName: [host],
      tls: { cert: certName(host), protocols: ['TLSv1.2', 'TLSv1.3'], preferServerCiphers: true, sessionCache: 'shared:SSL:10m' },
      location: [
        {
          match: '= /healthz',
          proxyPass: 'http://gateway',
          proxySetHeader: ['Host $host', 'X-Forwarded-For $proxy_add_x_forwarded_for', 'X-Forwarded-Proto $scheme'],
          proxyHttpVersion: '1.1',
        },
        {
          match: '= /readyz',
          proxyPass: 'http://gateway',
          proxySetHeader: ['Host $host', 'X-Forwarded-For $proxy_add_x_forwarded_for', 'X-Forwarded-Proto $scheme'],
          proxyHttpVersion: '1.1',
        },
        {
          match: '/',
          proxyPass: 'http://gateway',
          proxySetHeader: ['Host $host', 'X-Real-IP $remote_addr', 'X-Forwarded-For $proxy_add_x_forwarded_for', 'X-Forwarded-Proto $scheme'],
          proxyHttpVersion: '1.1',
          proxyBuffering: false,
          proxyReadTimeout: '120s',
          proxySendTimeout: '120s',
        },
      ],
    };
    doc.http.server.push(server);
  }
  // Reorder document: main_events must nest under main.
  doc.main.events = doc.main_events;
  delete doc.main_events;
  return { doc, bind };
}

function profileDoc(profileName, bind) {
  const doc = { profile: profileName };
  if (bind) {
    doc.http = {
      upstream: [{ name: 'gateway', target: [{ address: bind, weight: 1 }] }],
    };
  }
  return doc;
}

function disabledCommon(name, description) {
  return {
    specVersion: 1,
    kind: 'sdkwork.webserver.server',
    id: name.replace(/^sdkwork-/, ''),
    enabled: false,
    description,
  };
}

let upgraded = 0;
let generated = 0;
const report = [];
for (const name of fs.readdirSync(WORKSPACE)) {
  if (!name.startsWith('sdkwork-') || SKIP.has(name) || !fs.existsSync(path.join(WORKSPACE, name, 'deployments'))) continue;
  const dir = path.join(WORKSPACE, name, 'deployments', 'webserver');
  fs.mkdirSync(dir, { recursive: true });
  const legacyPath = path.join(dir, 'server.toml');
  const tp = path.join(WORKSPACE, name, 'specs', 'topology.spec.json');
  let topology = null;
  try {
    topology = JSON.parse(fs.readFileSync(tp, 'utf8'));
  } catch {
    topology = null;
  }
  const hosts = topology?.cloudPublicHosts ? Object.values(topology.cloudPublicHosts).map((h) => h.httpHost).filter(Boolean) : [];
  const bind = topology?.defaults?.gatewayBind;

  let common;
  if (fs.existsSync(legacyPath)) {
    // Split the legacy single file: shared structure to common, targets to profiles.
    const legacy = parseTomlSubset(fs.readFileSync(legacyPath, 'utf8'), 'server.toml');
    if (legacy.enabled === false) {
      common = { ...legacy };
    } else {
      common = { ...legacy };
      const upstreams = common.http?.upstream;
      if (Array.isArray(upstreams)) {
        for (const upstream of upstreams) delete upstream.target;
      }
      if (!bind && Array.isArray(upstreams) && upstreams.length > 0 && Array.isArray(upstreams[0].target) && upstreams[0].target.length > 0) {
        // No topology bind: keep the legacy target in common so profiles inherit it.
        for (const upstream of upstreams) upstream.target = upstream.target;
      }
    }
    upgraded += 1;
  } else if (topology && hosts.length > 0 && bind) {
    common = buildFromTopology(name, topology).doc;
    generated += 1;
  } else {
    const reason = topology ? (hosts.length ? 'missing defaults.gatewayBind' : 'missing cloudPublicHosts') : 'missing specs/topology.spec.json';
    common = disabledCommon(name, `no public web surface declared in topology (${reason})`);
    generated += 1;
  }

  const standalone = profileDoc('standalone', legacyWasEnabled(common) ? bind : null);
  const cloud = profileDoc('cloud', legacyWasEnabled(common) ? bind : null);

  fs.writeFileSync(path.join(dir, 'server.common.toml'), serialize(common));
  fs.writeFileSync(path.join(dir, 'server.standalone.toml'), serialize(standalone));
  fs.writeFileSync(path.join(dir, 'server.cloud.toml'), serialize(cloud));
  if (fs.existsSync(legacyPath)) fs.rmSync(legacyPath);
  report.push(`${common.enabled === false ? 'disabled' : 'upgraded'.padEnd(8)} ${name}`);
}

function legacyWasEnabled(common) {
  return common.enabled !== false;
}

console.log(report.sort().join('\n'));
console.log(`upgraded ${upgraded} legacy files, generated ${generated} from topology; retired server.toml removed`);
