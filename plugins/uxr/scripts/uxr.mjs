#!/usr/bin/env node
// Shared intake CLI for every uxr skill. Each command prints one JSON object on stdout:
// { status: "ok" | "needs-input" | "error", ... }. Exit code 0 = ok, 2 = needs the user's answer, 1 = error.
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.log(JSON.stringify({ status: 'error', message: `uxr needs Node.js 20 or newer (found ${process.versions.node}).` }));
  process.exit(1);
}

const fs = await import('node:fs');
const path = await import('node:path');
const { parseArgs } = await import('node:util');
const { extract } = await import('./lib/extract.mjs');
const { parseCsv, toCsv } = await import('./lib/csv.mjs');
const { profile } = await import('./lib/profile.mjs');
const { normalize } = await import('./lib/normalize.mjs');

const USAGE = `Usage:
  uxr.mjs extract <source> --out raw.csv [--sheet NAME] [--json-path a.b] [--delimiter ";"] [--header-row N]
  uxr.mjs profile <raw.csv> --out profile.json
  uxr.mjs normalize <raw.csv> --mapping mapping.json --out data.csv [--log normalize-log.json]`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' }, sheet: { type: 'string' }, 'json-path': { type: 'string' }, delimiter: { type: 'string' },
    'header-row': { type: 'string' }, mapping: { type: 'string' }, log: { type: 'string' },
  },
});
const [command, input] = positionals;

const readTable = (p) => parseCsv(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const write = (p, content) => { fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true }); fs.writeFileSync(p, content); };
function finish(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'ok' ? 0 : result.status === 'needs-input' ? 2 : 1);
}

const COMMANDS = {
  extract() {
    const r = extract(input, { sheet: opt.sheet, jsonPath: opt['json-path'], delimiter: opt.delimiter, headerRow: opt['header-row'] });
    if (r.status !== 'ok') return r;
    if (opt.out) write(opt.out, toCsv(r.table));
    return { status: 'ok', out: opt.out ?? null, info: r.info, rows: r.table.rows.length, header: r.table.header, warnings: r.warnings ?? [] };
  },
  profile() {
    const p = profile(readTable(input));
    if (opt.out) write(opt.out, JSON.stringify(p, null, 2));
    return {
      status: 'ok', out: opt.out ?? null, rows: p.rows, layout: p.layout, wide: p.wide,
      columns: p.columns.map((c) => ({ name: c.name, type: c.type, missing: c.missing, distinct: c.distinct, range: c.min !== undefined ? [c.min, c.max] : undefined, top: c.top.slice(0, 4).map((t) => t.value), roles: c.roles })),
      mustAsk: p.mustAsk,
    };
  },
  normalize() {
    if (!opt.mapping) return { status: 'error', message: '--mapping is required' };
    const r = normalize(readTable(input), JSON.parse(fs.readFileSync(opt.mapping, 'utf8')));
    if (r.status !== 'ok') return r;
    if (opt.out) write(opt.out, toCsv(r.table));
    if (opt.log) write(opt.log, JSON.stringify(r.log, null, 2));
    return { status: 'ok', out: opt.out ?? null, header: r.table.header, ...r.log };
  },
};

if (!COMMANDS[command] || !input) finish({ status: 'error', message: USAGE });
try {
  finish(COMMANDS[command]());
} catch (e) {
  finish({ status: 'error', message: e.message });
}
