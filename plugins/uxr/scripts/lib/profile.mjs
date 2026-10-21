// Stage 2 of intake: describe every column (type, values, gaps), guess what each one might be with a confidence,
// detect wide layouts, and list the questions that must go to the user because guessing them would change results.

export const MISSING_TOKENS = ['', 'na', 'n/a', 'null', 'none', '-', '—', '–', 'nan', '#n/a'];
const isMissing = (v) => MISSING_TOKENS.includes(String(v).trim().toLowerCase());

const RE = {
  integer: /^-?\d+$/,
  number: /^-?\d+(?:[.,]\d+)?$/,
  duration: /^(?:\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:ms|s|sec|secs|seconds|m|min|mins|minutes|с|сек|хв)\.?)$/i,
  date: /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+Z?)?$/,
  boolean: /^(?:yes|no|y|n|true|false|так|ні|да|нет|pass|fail|passed|failed)$/i,
  suspect: /\b(?:pilot|test|testing|demo|dummy|ignore|exclude)\b|пілот|тест/i,
};

const ROLE_NAMES = [
  ['participant_id', /participant|respondent|subject|user|tester|^p(?:id)?$|^id$|учасник|респондент|користувач/i],
  ['task_id', /task|scenario|завдання|сценар/i],
  ['success', /success|result|complet|outcome|pass|done|status|успіх|результат|викон/i],
  ['error_opportunities', /opportunit|можлив/i],
  ['errors', /error|mistake|slip|помилк/i],
  ['perceived_time', /perceiv|how long|felt|expected time|faster|slower|відчут/i],
  ['seq', /\bseq\b|single ease/i],
  ['ease', /ease|easy|difficult|легк|складн/i],
  ['satisfaction', /satisf|задовол/i],
  ['time_s', /time|duration|seconds|\bsec\b|elapsed|час|тривал/i],
  ['group', /group|variant|version|condition|design|cohort|arm|груп|варіант|верс/i],
];
const RATING_ROLES = new Set(['seq', 'ease', 'satisfaction', 'perceived_time']);

function typeOf(values) {
  if (!values.length) return { type: 'empty' };
  if (values.every((v) => RE.integer.test(v))) return { type: 'integer' };
  if (values.every((v) => RE.number.test(v))) {
    const comma = values.some((v) => /,\d/.test(v));
    const dot = values.some((v) => /\.\d/.test(v));
    return { type: 'number', ...(comma ? { decimalComma: true } : {}), ...(comma && dot ? { mixedDecimals: true } : {}) };
  }
  if (values.every((v) => RE.duration.test(v))) return { type: 'duration' };
  if (values.every((v) => RE.date.test(v))) return { type: 'date' };
  if (values.every((v) => RE.boolean.test(v))) return { type: 'boolean' };
  return { type: 'text' };
}

function roleScores(col, nRows) {
  const numeric = col.type === 'integer' || col.type === 'number';
  const small = col.type === 'integer' && col.min >= 0 && col.max <= 10;
  const binary = col.type === 'integer' && col.distinct <= 2 && col.min >= 0 && col.max <= 1;
  const fits = {
    participant_id: col.distinct > 1,
    task_id: col.distinct > 1 && col.distinct < nRows,
    success: binary || col.type === 'boolean' || (col.type === 'text' && col.distinct <= 8),
    time_s: numeric || col.type === 'duration',
    errors: col.type === 'integer' && col.min >= 0,
    error_opportunities: col.type === 'integer' && col.min >= 0,
    seq: small, ease: small, satisfaction: small, perceived_time: small,
    group: col.distinct > 1 && col.distinct <= 6,
  };
  const roles = [];
  for (const [role, re] of ROLE_NAMES) {
    const named = re.test(col.name);
    if (!named && !(role === 'success' && binary)) continue;
    const confidence = (named ? 0.6 : 0.3) + (fits[role] ? 0.3 : -0.3);
    if (confidence >= 0.3) roles.push({ role, confidence: Math.round(confidence * 100) / 100 });
  }
  if (!roles.length && small) roles.push({ role: 'rating', confidence: 0.4 });
  return roles.sort((a, b) => b.confidence - a.confidence);
}

const WIDE_PATTERNS = [
  { re: /^(?:t|task|завдання|з)\s*[_\-\s]?(\d+)[\s_:\-.]+(.+)$/i, pattern: '^(?:t|task|завдання|з)\\s*[_\\-\\s]?(?<task>\\d+)[\\s_:\\-.]+(?<field>.+)$', order: 'task-first' },
  { re: /^(.+?)[\s_:\-.]+(?:t|task|завдання|з)\s*[_\-\s]?(\d+)$/i, pattern: '^(?<field>.+?)[\\s_:\\-.]+(?:t|task|завдання|з)\\s*[_\\-\\s]?(?<task>\\d+)$', order: 'field-first' },
];

function detectWide(header) {
  for (const w of WIDE_PATTERNS) {
    const hits = header.map((h) => w.re.exec(h)).filter(Boolean);
    const pairs = hits.map((m) => (w.order === 'task-first' ? { task: m[1], field: m[2] } : { task: m[2], field: m[1] }));
    const tasks = [...new Set(pairs.map((p) => p.task))];
    const fields = [...new Set(pairs.map((p) => p.field.trim()))];
    if (tasks.length >= 2 && hits.length >= 4) {
      return { tasks, fields, pattern: w.pattern, flags: 'iu', idColumns: header.filter((h) => !w.re.test(h)) };
    }
  }
  return null;
}

export function profile({ header, rows }) {
  const columns = header.map((name, index) => {
    const all = rows.map((r) => String(r[index] ?? '').trim());
    const present = all.filter((v) => !isMissing(v));
    const counts = new Map();
    for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1);
    const col = { name, index, ...typeOf(present), missing: all.length - present.length, distinct: counts.size };
    col.top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value, count]) => ({ value, count }));
    if (col.type === 'integer' || col.type === 'number') {
      const nums = present.map((v) => Number(v.replace(',', '.')));
      col.min = Math.min(...nums);
      col.max = Math.max(...nums);
    }
    col.roles = roleScores(col, rows.length);
    return col;
  });

  const wide = detectWide(header);
  const top = (role) => columns.find((c) => c.roles[0]?.role === role);
  const mustAsk = [];
  const ask = (topic, cols, question) => mustAsk.push({ topic, columns: cols.map((c) => (typeof c === 'string' ? c : c.name)), question });

  const success = top('success');
  if (success && success.type !== 'integer') {
    ask('success-coding', [success], `How should each value of "${success.name}" count: ${success.top.map((t) => `"${t.value}"`).join(', ')}? In particular, does a partial or assisted success count as success?`);
  }
  const time = top('time_s');
  if (time) {
    const unitInName = /\b(?:ms|s|sec|secs|seconds|min|mins|minutes|с|сек|хв)\b|\((?:s|ms|min)\)/i.test(time.name);
    if (time.type === 'duration') ask('time-format', [time], `Values in "${time.name}" look like ${time.top[0]?.value}. Is that minutes:seconds or hours:minutes?`);
    else if (!unitInName) ask('time-format', [time], `What unit is "${time.name}" in: seconds, milliseconds or minutes?`);
  }
  const ratings = columns.filter((c) => RATING_ROLES.has(c.roles[0]?.role) || c.roles[0]?.role === 'rating');
  if (ratings.length) {
    ask('scale-range', ratings, `What is the full scale of ${ratings.map((c) => `"${c.name}" (seen ${c.min}–${c.max})`).join(', ')}? The highest possible answer may not appear in the data.`);
    ask('scale-direction', ratings, `For ${ratings.map((c) => `"${c.name}"`).join(', ')}: is the highest number the best answer (very easy, very satisfied)?`);
    if (ratings.length > 1) ask('satisfaction-construct', ratings, 'Which rating questions make up satisfaction: one of them, or an average of several?');
  }
  const keyCols = columns.filter((c) => c.roles.length && c.missing > 0);
  if (keyCols.length) {
    ask('blanks', keyCols, `Some cells are empty in ${keyCols.map((c) => `"${c.name}" (${c.missing})`).join(', ')}. What does an empty cell mean in each: not asked, skipped, task failed, or zero?`);
  }
  const suspectRows = rows
    .map((r, i) => ({ source_row: i + 2, cells: r.filter((v) => RE.suspect.test(String(v))) }))
    .filter((r) => r.cells.length);
  if (suspectRows.length) {
    ask('exclusions', [], `Rows ${suspectRows.map((r) => r.source_row).join(', ')} mention ${[...new Set(suspectRows.flatMap((r) => r.cells))].map((v) => `"${v}"`).join(', ')}. Should any pilot, test or other rows be left out?`);
  }
  const pid = top('participant_id');
  const tid = top('task_id');
  if (pid && tid) {
    const seen = new Map();
    for (const [i, r] of rows.entries()) {
      const key = `${r[pid.index]}\u0000${r[tid.index]}`;
      seen.set(key, [...(seen.get(key) ?? []), i + 2]);
    }
    const dups = [...seen.values()].filter((v) => v.length > 1);
    if (dups.length) ask('duplicates', [pid, tid], `Some participant × task pairs appear more than once (rows ${dups.map((d) => d.join('+')).join(', ')}). Keep the first, the last, or check them?`);
  }
  if (wide) ask('wide-pairing', [], `Each row seems to be one participant with columns per task (tasks ${wide.tasks.join(', ')}; fields ${wide.fields.join(', ')}). Is that right, and which field is which?`);

  return { rows: rows.length, layout: wide ? 'wide' : 'long', ...(wide ? { wide } : {}), columns, mustAsk, suspectRows };
}
