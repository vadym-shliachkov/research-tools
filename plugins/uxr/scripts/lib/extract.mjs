// Stage 1 of intake: read rows from a source file exactly as they are, without interpreting their meaning.
// Returns { status: 'ok', table, info, warnings } | { status: 'needs-input', question, options } | { status: 'error', message }.
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, sniffDelimiter } from './csv.mjs';
import { readWorkbook } from './xlsx.mjs';

const TEXT_EXT = new Set(['.csv', '.tsv', '.txt', '.tab']);
const JSON_EXT = new Set(['.json', '.ndjson', '.jsonl']);
const AGENT_EXTRACTS = ['.xls', '.ods', '.numbers', '.pdf', '.docx', '.png', '.jpg', '.jpeg'];

export function decodeText(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.subarray(3).toString('utf8'), encoding: 'utf-8 (BOM)' };
  if (buf[0] === 0xff && buf[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(buf.subarray(2)), encoding: 'utf-16le' };
  if (buf[0] === 0xfe && buf[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(buf.subarray(2)), encoding: 'utf-16be' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'utf-8' };
  } catch {
    // Not UTF-8. Cyrillic letters in Windows-1251 sit at 0xC0–0xFF; Western text in Windows-1252 mostly does not.
    const high = buf.filter((b) => b >= 0xc0).length;
    const encoding = high > buf.filter((b) => b >= 0x80 && b < 0xc0).length ? 'windows-1251' : 'windows-1252';
    return { text: new TextDecoder(encoding).decode(buf), encoding };
  }
}

// Removes empty rows, then names empty or repeated header cells so every column is addressable.
export function tidy(records, headerRow = 1, warnings = []) {
  const nonEmpty = (r) => r.some((c) => String(c).trim() !== '');
  const body = records.slice(headerRow - 1);
  const [rawHeader = [], ...rest] = body;
  const rows = rest.filter(nonEmpty);
  const width = Math.max(rawHeader.length, ...rows.map((r) => r.length));
  const seen = new Map();
  const renamed = [];
  const header = Array.from({ length: width }, (_, i) => {
    let name = String(rawHeader[i] ?? '').trim();
    if (!name) { name = `col_${i + 1}`; renamed.push(`column ${i + 1} (empty) → ${name}`); }
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n > 1) { renamed.push(`${name} → ${name}_${n}`); name = `${name}_${n}`; }
    return name;
  });
  if (renamed.length) warnings.push(`Header cells renamed: ${renamed.join('; ')}`);
  const dropped = rest.length - rows.length;
  if (dropped) warnings.push(`${dropped} empty row(s) skipped`);
  return { header, rows: rows.map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? ''))) };
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join('; ') : v;
  }
  return out;
}

function findRowArrays(value, at = '', found = []) {
  if (Array.isArray(value)) {
    if (value.length && value.every((x) => x && typeof x === 'object' && !Array.isArray(x))) found.push(at);
    return found;
  }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) findRowArrays(v, at ? `${at}.${k}` : k, found);
  return found;
}

function objectsToTable(objects) {
  const flat = objects.map((o) => flatten(o));
  const header = [];
  for (const o of flat) for (const k of Object.keys(o)) if (!header.includes(k)) header.push(k);
  return { header, rows: flat.map((o) => header.map((k) => (o[k] === null || o[k] === undefined ? '' : String(o[k])))) };
}

function extractJson(text, opts) {
  const trimmed = text.trim();
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    try {
      data = trimmed.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    } catch (e) {
      return { status: 'error', message: `Not valid JSON or NDJSON: ${e.message}` };
    }
  }
  let jsonPath = opts.jsonPath ?? '';
  if (!opts.jsonPath && !Array.isArray(data)) {
    const candidates = findRowArrays(data);
    if (!candidates.length) return { status: 'error', message: 'No array of row objects found in the JSON' };
    if (candidates.length > 1) {
      return { status: 'needs-input', question: 'The JSON has several lists of rows. Which one holds the study data?', options: candidates, flag: '--json-path' };
    }
    jsonPath = candidates[0];
  }
  const rowsValue = jsonPath ? jsonPath.split('.').reduce((v, k) => v?.[k], data) : data;
  if (!Array.isArray(rowsValue)) return { status: 'error', message: `"${jsonPath}" is not a list` };
  return { status: 'ok', table: objectsToTable(rowsValue), info: { format: 'json', jsonPath: jsonPath || null } };
}

export function extract(source, opts = {}) {
  if (!source || !fs.existsSync(source)) return { status: 'error', message: `File not found: ${source}` };
  const ext = path.extname(source).toLowerCase();
  const warnings = [];
  const headerRow = Number(opts.headerRow ?? 1);
  const buf = fs.readFileSync(source);

  if (ext === '.xlsx' || ext === '.xlsm') {
    let wb;
    try { wb = readWorkbook(buf); } catch (e) { return { status: 'error', message: `Could not read the workbook: ${e.message}` }; }
    let sheet = opts.sheet;
    if (!sheet) {
      if (wb.sheetNames.length > 1) {
        return { status: 'needs-input', question: 'The workbook has several sheets. Which one holds the study data?', options: wb.sheetNames, flag: '--sheet' };
      }
      sheet = wb.sheetNames[0];
    }
    if (!wb.sheetNames.includes(sheet)) return { status: 'error', message: `No sheet named "${sheet}". Sheets: ${wb.sheetNames.join(', ')}` };
    const { rows, formatted } = wb.readSheet(sheet);
    if (formatted.time) warnings.push(`${formatted.time} cell(s) were time-formatted in Excel and are written as Excel shows them (h:mm, m:ss or h:mm:ss); two-part values need the user to confirm minutes:seconds or hours:minutes`);
    if (formatted.date) warnings.push(`${formatted.date} cell(s) were date-formatted in Excel and are written as YYYY-MM-DD`);
    return { status: 'ok', table: tidy(rows, headerRow, warnings), info: { format: 'xlsx', sheet, sheets: wb.sheetNames, headerRow }, warnings };
  }

  if (TEXT_EXT.has(ext) || JSON_EXT.has(ext)) {
    const { text, encoding } = decodeText(buf);
    if (encoding.startsWith('windows')) warnings.push(`The file is not UTF-8; decoded as ${encoding}. Check that names and labels look right.`);
    if (JSON_EXT.has(ext)) {
      const r = extractJson(text, opts);
      if (r.status !== 'ok') return r;
      return { ...r, table: tidy([r.table.header, ...r.table.rows], 1, warnings), info: { ...r.info, encoding }, warnings };
    }
    const delimiter = opts.delimiter ?? (ext === '.tsv' || ext === '.tab' ? '\t' : sniffDelimiter(text));
    const { header, rows } = parseCsv(text, delimiter);
    return { status: 'ok', table: tidy([header, ...rows], headerRow, warnings), info: { format: 'delimited', delimiter, encoding, headerRow }, warnings };
  }

  if (AGENT_EXTRACTS.includes(ext)) {
    return { status: 'error', message: `${ext.slice(1)} files are not read by the script. Extract the table into a CSV with your own tools, show it to the user to confirm, then run extract on that CSV.` };
  }
  return { status: 'error', message: `Unknown file type "${ext || 'none'}". Supported: csv, tsv, txt, json, ndjson, xlsx.` };
}
