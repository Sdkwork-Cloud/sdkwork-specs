// TOML 1.0 subset parser for SDKWORK_WEBSERVER_SPEC.md section 3.2.
// Supported: basic/literal strings, integers (dec/hex/oct/bin), floats,
// booleans, arrays (multi-line), inline tables, [table], [[array-of-tables]],
// dotted keys. Rejected: multi-line strings, datetimes, duplicate keys.

export class TomlSubsetError extends SyntaxError {}

const BARE_KEY = /^[A-Za-z0-9_-]+$/u;

function fail(source, line, message) {
  throw new TomlSubsetError(`${source}:${line}: ${message}`);
}

// True when the character at index i is preceded by an even number of
// backslashes (i.e. it is not escaped by a backslash).
function isUnescaped(text, i) {
  let count = 0;
  for (let j = i - 1; j >= 0 && text[j] === '\\'; j -= 1) count += 1;
  return count % 2 === 0;
}

function stripComment(line) {
  let inBasic = false;
  let inLiteral = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && !inLiteral) {
      if (inBasic && !isUnescaped(line, i)) continue;
      inBasic = !inBasic;
    } else if (ch === "'" && !inBasic) {
      inLiteral = !inLiteral;
    } else if (ch === '#' && !inBasic && !inLiteral) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseKeyPart(token, source, line) {
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    return parseBasicString(token.slice(1, -1), source, line);
  }
  if (token.startsWith("'") && token.endsWith("'") && token.length >= 2) {
    return token.slice(1, -1);
  }
  if (!BARE_KEY.test(token)) {
    fail(source, line, `invalid key part "${token}"`);
  }
  return token;
}

function splitKey(keyText, source, line) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < keyText.length; i += 1) {
    const ch = keyText[i];
    if (quote) {
      current += ch;
      if (ch === quote && keyText[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '.') {
      parts.push(parseKeyPart(current.trim(), source, line));
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(parseKeyPart(current.trim(), source, line));
  return parts;
}

function parseEscapes(value, source, line) {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    const simple = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
    if (simple[next] !== undefined) {
      out += simple[next];
      i += 1;
    } else if (next === 'u') {
      const hex = value.slice(i + 2, i + 6);
      if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) fail(source, line, `invalid \\u escape`);
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else if (next === 'U') {
      const hex = value.slice(i + 2, i + 10);
      if (!/^[0-9A-Fa-f]{8}$/u.test(hex)) fail(source, line, `invalid \\U escape`);
      out += String.fromCodePoint(parseInt(hex, 16));
      i += 9;
    } else {
      fail(source, line, `unsupported escape "\\${next}"`);
    }
  }
  return out;
}

function parseBasicString(raw, source, line) {
  return parseEscapes(raw, source, line);
}

function parseNumberToken(token, source, line) {
  const t = token.replaceAll('_', '');
  if (t === 'inf' || t === '+inf' || t === '-inf' || t === 'nan' || t === '+nan' || t === '-nan') {
    return t === 'nan' || t === '+nan' || t === '-nan' ? Number.NaN : (t.startsWith('-') ? -Infinity : Infinity);
  }
  if (/^0x[0-9A-Fa-f]+$/u.test(t)) return parseInt(t.slice(2), 16);
  if (/^0o[0-7]+$/u.test(t)) return parseInt(t.slice(2), 8);
  if (/^0b[01]+$/u.test(t)) return parseInt(t.slice(2), 2);
  if (/^[+-]?\d+$/u.test(t)) return parseInt(t, 10);
  if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/u.test(t)) return parseFloat(t);
  if (/^\d{4}-\d{2}-\d{2}/u.test(t) || /^\d{2}:\d{2}/u.test(t)) {
    fail(source, line, 'datetimes are not part of the server.toml TOML subset');
  }
  fail(source, line, `invalid value token "${token}"`);
  return undefined;
}

function isBoundary(ch) {
  return ch === undefined || ch === ',' || ch === ']' || ch === '}' || ch === '\n' || ch === ' ' || ch === '\t';
}

function parseValueString(src, start, source, line) {
  const ch = src[start];
  if (ch === '"') {
    let i = start + 1;
    let out = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        out += c + (src[i + 1] ?? '');
        i += 2;
      } else if (c === '"') {
        return { value: parseEscapes(out, source, line), next: i + 1 };
      } else {
        out += c;
        i += 1;
      }
    }
    fail(source, line, 'unterminated basic string');
  }
  if (ch === "'") {
    const end = src.indexOf("'", start + 1);
    if (end === -1) fail(source, line, 'unterminated literal string');
    return { value: src.slice(start + 1, end), next: end + 1 };
  }
  if (ch === '[') {
    return parseArrayValue(src, start, source, line);
  }
  if (ch === '{') {
    return parseInlineTableValue(src, start, source, line);
  }
  let end = start;
  while (end < src.length && !isBoundary(src[end])) end += 1;
  const token = src.slice(start, end);
  if (token === 'true') return { value: true, next: end };
  if (token === 'false') return { value: false, next: end };
  return { value: parseNumberToken(token, source, line), next: end };
}

function parseArrayValue(src, start, source, line) {
  const values = [];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === ']') return { value: values, next: i + 1 };
    if (c === ',' || c === ' ' || c === '\t' || c === '\n') {
      i += 1;
      continue;
    }
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    const parsed = parseValueString(src, i, source, line);
    values.push(parsed.value);
    i = parsed.next;
  }
  fail(source, line, 'unterminated array');
  return undefined;
}

function parseInlineTableValue(src, start, source, line) {
  const result = {};
  let i = start + 1;
  let sawNewline = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '}') return { value: result, next: i + 1 };
    if (c === '\n') {
      sawNewline = true;
      i += 1;
      continue;
    }
    if (sawNewline) fail(source, line, 'inline tables must be on a single line');
    if (c === ' ' || c === '\t' || c === ',') {
      i += 1;
      continue;
    }
    let keyEnd = i;
    let quote = null;
    while (keyEnd < src.length) {
      const k = src[keyEnd];
      if (quote) {
        if (k === quote && src[keyEnd - 1] !== '\\') quote = null;
      } else if (k === '"' || k === "'") {
        quote = k;
      } else if (k === '=') {
        break;
      } else if (k === '\n') {
        break;
      }
      keyEnd += 1;
    }
    const keyText = src.slice(i, keyEnd).trim();
    if (!keyText || src[keyEnd] !== '=') fail(source, line, 'invalid inline table entry');
    const keyParts = splitKey(keyText, source, line);
    i = keyEnd + 1;
    while (src[i] === ' ' || src[i] === '\t') i += 1;
    const parsed = parseValueString(src, i, source, line);
    let target = result;
    for (let p = 0; p < keyParts.length - 1; p += 1) {
      const seg = keyParts[p];
      if (typeof target[seg] !== 'object' || target[seg] === null || Array.isArray(target[seg])) {
        target[seg] = {};
      }
      target = target[seg];
    }
    const last = keyParts[keyParts.length - 1];
    if (Object.prototype.hasOwnProperty.call(target, last)) {
      fail(source, line, `duplicate key "${last}"`);
    }
    target[last] = parsed.value;
    i = parsed.next;
  }
  fail(source, line, 'unterminated inline table');
  return undefined;
}

function resolvePath(doc, path, source, line, isArrayOfTables) {
  let current = doc;
  for (let p = 0; p < path.length - 1; p += 1) {
    const seg = path[p];
    const existing = current[seg];
    if (existing === undefined) {
      const created = {};
      current[seg] = created;
      current = created;
    } else if (Array.isArray(existing)) {
      if (existing.length === 0) fail(source, line, `cannot attach to empty array "${seg}"`);
      current = existing[existing.length - 1];
    } else if (typeof existing === 'object' && existing !== null) {
      current = existing;
    } else {
      fail(source, line, `key "${seg}" is not a table`);
    }
  }
  const last = path[path.length - 1];
  const existing = current[last];
  if (isArrayOfTables) {
    if (existing === undefined) {
      current[last] = [];
    } else if (!Array.isArray(existing)) {
      fail(source, line, `table "${last}" is not an array of tables`);
    }
    const element = {};
    current[last].push(element);
    return element;
  }
  if (existing === undefined) {
    const table = {};
    current[last] = table;
    return table;
  }
  if (Array.isArray(existing)) {
    fail(source, line, `cannot redefine array of tables "${last}" as a table`);
  }
  if (typeof existing !== 'object' || existing === null) {
    fail(source, line, `key "${last}" is not a table`);
  }
  // TOML 1.0: a table already defined (by header or dotted keys) cannot be
  // redefined by a later header.
  fail(source, line, `table "${last}" redefined by header`);
  return undefined;
}

/**
 * Parse the server.toml TOML subset into a plain JS object.
 * @param {string} text TOML source
 * @param {string} [sourceName] label used in error messages
 * @returns {object}
 * @throws {TomlSubsetError} on any syntax or subset violation
 */
export function parseTomlSubset(text, sourceName = 'server.toml') {
  const doc = {};
  let currentTable = doc;
  const lines = text.split('\n');
  const pending = []; // multi-line array accumulation {start, text, line}

  const flushPending = () => {
    if (pending.length === 0) return;
    const entry = pending.shift();
    entry.text = entry.text.trim();
    if (!entry.text) fail(sourceName, entry.line, 'unterminated array value');
    const parsed = parseValueString(entry.text, 0, sourceName, entry.line);
    assignValue(entry.keyParts, parsed.value, sourceName, entry.line);
  };

  const assignValue = (keyParts, value, source, line) => {
    let target = currentTable;
    for (let p = 0; p < keyParts.length - 1; p += 1) {
      const seg = keyParts[p];
      if (target[seg] === undefined) {
        const created = {};
        target[seg] = created;
        target = created;
      } else if (typeof target[seg] === 'object' && target[seg] !== null && !Array.isArray(target[seg])) {
        target = target[seg];
      } else {
        fail(source, line, `key path "${seg}" is not a table`);
      }
    }
    const last = keyParts[keyParts.length - 1];
    if (Object.prototype.hasOwnProperty.call(target, last)) {
      fail(source, line, `duplicate key "${last}"`);
    }
    target[last] = value;
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx];
    const lineNo = idx + 1;
    const stripped = stripComment(rawLine).trim();
    if (!stripped) continue;

    if (pending.length > 0) {
      const entry = pending[0];
      entry.text += `\n${stripped}`;
      const balanced = balanceCheck(entry.text);
      if (balanced === 0) {
        flushPending();
        continue;
      }
      if (balanced < 0) fail(sourceName, lineNo, 'unbalanced closing bracket in array');
      continue;
    }

    if (stripped.startsWith('"""') || stripped.startsWith("'''")) {
      fail(sourceName, lineNo, 'multi-line strings are not part of the server.toml TOML subset');
    }

    if (stripped.startsWith('[')) {
      const isArray = stripped.startsWith('[[');
      if (!stripped.endsWith(']')) fail(sourceName, lineNo, 'invalid table header');
      const inner = stripped.slice(isArray ? 2 : 1, isArray ? -2 : -1).trim();
      if (!inner) fail(sourceName, lineNo, 'empty table header');
      const path = splitKey(inner, sourceName, lineNo);
      currentTable = resolvePath(doc, path, sourceName, lineNo, isArray);
      continue;
    }

    const eq = findEquals(stripped, sourceName, lineNo);
    const keyText = stripped.slice(0, eq).trim();
    const valueText = stripped.slice(eq + 1).trim();
    const keyParts = splitKey(keyText, sourceName, lineNo);

    if (valueText.startsWith('"""') || valueText.startsWith("'''")) {
      fail(sourceName, lineNo, 'multi-line strings are not part of the server.toml TOML subset');
    }

    const balance = balanceCheck(valueText);
    if (balance > 0) {
      pending.push({ keyParts, text: valueText, line: lineNo });
      continue;
    }
    if (balance < 0) fail(sourceName, lineNo, 'unbalanced closing bracket');

    const parsed = parseValueString(valueText, 0, sourceName, lineNo);
    assignValue(keyParts, parsed.value, sourceName, lineNo);
  }

  if (pending.length > 0) {
    fail(sourceName, pending[0].line, 'unterminated array value');
  }
  return doc;
}

function balanceCheck(text) {
  let depth = 0;
  let inBasic = false;
  let inLiteral = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && !inLiteral) {
      if (inBasic && !isUnescaped(text, i)) continue;
      inBasic = !inBasic;
    } else if (ch === "'" && !inBasic) {
      inLiteral = !inLiteral;
    } else if (!inBasic && !inLiteral) {
      if (ch === '[' || ch === '{') depth += 1;
      else if (ch === ']' || ch === '}') depth -= 1;
    }
  }
  return depth;
}

function findEquals(stripped, source, line) {
  let quote = null;
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (quote) {
      if (ch === quote && isUnescaped(stripped, i)) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '=') {
      return i;
    }
  }
  fail(source, line, 'expected "=" after key');
  return -1;
}
