// Stage 4 of intake: apply a confirmed mapping.json to the raw table and write the canonical long table.
// Anything the mapping does not settle (an unmapped code, a value outside its scale) stops the run with a question.

export const CANONICAL = [
  'source_row', 'participant_id', 'task_id', 'group', 'success', 'time_s', 'errors', 'error_opportunities',
  'satisfaction', 'seq', 'ease', 'perceived_time',
];
const SAT_ITEM = /^sat_\d+$/;
const NUMERIC = new Set(['success', 'time_s', 'errors', 'error_opportunities', 'satisfaction', 'seq', 'ease', 'perceived_time']);
const TIME_UNITS = { s: 1, sec: 1, seconds: 1, ms: 0.001, min: 60, minutes: 60, h: 3600 };

const isCanonical = (f) => (CANONICAL.includes(f) && f !== 'source_row') || SAT_ITEM.test(f);
const order = (fields) => [
  ...CANONICAL.filter((f) => fields.includes(f)),
  ...fields.filter((f) => SAT_ITEM.test(f)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))),
];
const clean = (v) => String(Math.round(v * 1e6) / 1e6);

function parseNumber(s, decimal) {
  const t = decimal === ',' ? s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.') : s.replace(/\s/g, '');
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : NaN;
}

function parseTime(s, unit, decimal) {
  const parts = s.split(':');
  // A confirmed mm:ss with h:mm:00 values: Excel stored "1:03" typed into an h:mm cell as one hour and three minutes.
  if (parts.length === 3 && unit === 'mm:ss' && parseNumber(parts[2], decimal) === 0) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + parseNumber(parts[2], decimal);
  if (parts.length === 2) {
    if (unit === 'mm:ss') return Number(parts[0]) * 60 + parseNumber(parts[1], decimal);
    if (unit === 'hh:mm') return Number(parts[0]) * 3600 + Number(parts[1]) * 60;
    return NaN;
  }
  const n = parseNumber(s, decimal);
  const factor = TIME_UNITS[unit];
  return factor === undefined ? NaN : n * factor;
}

export function normalize(raw, mapping) {
  const columns = mapping.columns ?? {};
  const wideFields = mapping.layout === 'wide' ? mapping.wide?.fields ?? {} : {};
  const targets = [...Object.keys(columns), ...Object.values(wideFields).map((f) => f.to)];
  const unknown = targets.filter((f) => !isCanonical(f));
  if (unknown.length) return { status: 'error', message: `Unknown canonical field(s): ${unknown.join(', ')}. Allowed: ${CANONICAL.slice(1).join(', ')}, sat_1..sat_k` };
  const missingCols = Object.entries(columns).filter(([, spec]) => spec.from !== undefined && !raw.header.includes(spec.from)).map(([, s]) => s.from);
  if (missingCols.length) return { status: 'error', message: `Column(s) not found in the data: ${missingCols.join(', ')}` };

  const tokens = new Set((mapping.missing?.tokens ?? ['']).map((t) => String(t).trim().toLowerCase()));
  const decimal = mapping.number?.decimal ?? '.';
  const problems = new Map();
  const problem = (key, row) => problems.set(key, [...(problems.get(key) ?? []), row]);
  const log = { rowsIn: raw.rows.length, rowsOut: 0, dropped: [], blanks: {}, unusedColumns: [], warnings: [] };
  const longTimes = [];

  const convert = (field, spec, value, sourceRow) => {
    const s = String(value ?? '').trim();
    if (tokens.has(s.toLowerCase())) {
      log.blanks[field] = (log.blanks[field] ?? 0) + 1;
      return spec.missingAs !== undefined ? clean(spec.missingAs) : '';
    }
    let v;
    if (spec.map) {
      const key = Object.keys(spec.map).find((k) => k.trim().toLowerCase() === s.toLowerCase());
      if (key === undefined) { problem(`"${s}" in ${spec.from ?? field} has no entry in the mapping for ${field}`, sourceRow); return ''; }
      v = spec.map[key];
      if (v === null) return '';
    } else if (!NUMERIC.has(field)) return s;
    else v = field === 'time_s' && spec.unit ? parseTime(s, spec.unit, decimal) : parseNumber(s, decimal);
    if (typeof v !== 'number' || Number.isNaN(v)) { problem(`"${s}" in ${spec.from ?? field} is not a ${field === 'time_s' ? `time in ${spec.unit ?? 'an unstated unit'}` : 'number'}`, sourceRow); return ''; }
    // success is 0 or 1. Other codes (2 = partial, 3 = failed) need a map, or they would silently count as failure.
    if (field === 'success' && v !== 0 && v !== 1) { problem(`${v} in ${spec.from ?? field} is not 0 or 1; give success a map for its codes`, sourceRow); return ''; }
    if (field === 'time_s' && v > 3600) longTimes.push(sourceRow);
    if (spec.scale) {
      const [lo, hi] = spec.scale;
      if (v < lo || v > hi) { problem(`${v} in ${spec.from ?? field} is outside the declared scale ${lo}–${hi}`, sourceRow); return ''; }
      if (spec.reverse) v = lo + hi - v;
    }
    return clean(v);
  };

  const excluded = (row) => {
    for (const rule of mapping.exclude ?? []) {
      const cell = String(row[raw.header.indexOf(rule.column)] ?? '').trim();
      if (rule.equals?.some((e) => String(e).toLowerCase() === cell.toLowerCase())) return rule.reason ?? `${rule.column} = ${cell}`;
      if (rule.matches && new RegExp(rule.matches, 'iu').test(cell)) return rule.reason ?? `${rule.column} matches ${rule.matches}`;
    }
    return null;
  };

  const used = new Set(Object.values(columns).map((s) => s.from).filter(Boolean));
  const out = [];
  let wideCols = [];
  if (mapping.layout === 'wide') {
    const re = new RegExp(mapping.wide.pattern, mapping.wide.flags ?? 'u');
    wideCols = raw.header.map((h, i) => ({ h, i, m: re.exec(h) })).filter((c) => c.m?.groups?.task && c.m.groups.field)
      .map((c) => ({ index: c.i, header: c.h, task: c.m.groups.task, field: c.m.groups.field.trim() }));
    const unknownFields = [...new Set(wideCols.map((c) => c.field))].filter((f) => !wideFields[f]);
    if (unknownFields.length) log.warnings.push(`Per-task fields not in the mapping, ignored: ${unknownFields.join(', ')}`);
    wideCols = wideCols.filter((c) => wideFields[c.field]);
    for (const c of wideCols) used.add(c.header);
    if (!wideCols.length) return { status: 'error', message: 'The wide pattern matched no columns' };
  }

  raw.rows.forEach((row, i) => {
    const sourceRow = i + 2;
    const why = excluded(row);
    if (why) { log.dropped.push({ source_row: sourceRow, reason: why }); return; }
    const base = { source_row: String(sourceRow) };
    for (const [field, spec] of Object.entries(columns)) {
      base[field] = spec.value !== undefined ? clean(spec.value) : convert(field, spec, row[raw.header.indexOf(spec.from)], sourceRow);
    }
    if (mapping.layout !== 'wide') { out.push(base); return; }
    const tasks = [...new Set(wideCols.map((c) => c.task))];
    for (const task of tasks) {
      const cells = wideCols.filter((c) => c.task === task);
      if (mapping.missing?.dropEmptyTasks && cells.every((c) => tokens.has(String(row[c.index] ?? '').trim().toLowerCase()))) {
        log.dropped.push({ source_row: sourceRow, reason: `no data for task ${task}` });
        continue;
      }
      const rec = { ...base, task_id: mapping.wide.taskNames?.[task] ?? task };
      for (const c of cells) {
        const spec = wideFields[c.field];
        rec[spec.to] = convert(spec.to, { ...spec, from: c.header }, row[c.index], sourceRow);
      }
      out.push(rec);
    }
  });

  if (problems.size) {
    const lines = [...problems.entries()].slice(0, 12).map(([msg, rowsAt]) => `${msg} (row${rowsAt.length > 1 ? 's' : ''} ${[...new Set(rowsAt)].slice(0, 8).join(', ')})`);
    return { status: 'needs-input', question: 'Some values are not covered by the mapping. How should each one be treated?', message: lines.join('\n'), problems: lines };
  }

  const dupPolicy = mapping.duplicates ?? 'error';
  const seen = new Map();
  const kept = [];
  for (const rec of out) {
    if (rec.participant_id === undefined || rec.task_id === undefined) { kept.push(rec); continue; }
    const key = [rec.participant_id, rec.task_id, rec.group ?? ''].join('\u0000');
    if (!seen.has(key)) { seen.set(key, kept.length); kept.push(rec); continue; }
    if (dupPolicy === 'error') {
      return { status: 'needs-input', question: 'Some participant × task pairs appear more than once. Keep the first, the last, or fix the data?', message: `Duplicate: participant ${rec.participant_id}, task ${rec.task_id} (rows ${kept[seen.get(key)].source_row} and ${rec.source_row})`, flag: 'mapping.duplicates = "first" | "last"' };
    }
    if (dupPolicy === 'last') {
      log.dropped.push({ source_row: Number(kept[seen.get(key)].source_row), reason: 'duplicate participant × task' });
      kept[seen.get(key)] = rec;
    } else log.dropped.push({ source_row: Number(rec.source_row), reason: 'duplicate participant × task' });
  }

  const fields = order([...new Set(kept.flatMap((r) => Object.keys(r)))]);
  if (longTimes.length) log.warnings.push(`${longTimes.length} task time(s) are over an hour (rows ${[...new Set(longTimes)].slice(0, 8).join(', ')}). Check the time unit and format with the user: a ×60 mistake is silent.`);
  log.unusedColumns = raw.header.filter((h) => !used.has(h));
  log.rowsOut = kept.length;
  return { status: 'ok', table: { header: fields, rows: kept.map((r) => fields.map((f) => r[f] ?? '')) }, log };
}
