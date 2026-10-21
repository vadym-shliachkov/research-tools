import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extract } from '../plugins/uxr/scripts/lib/extract.mjs';
import { parseCsv, toCsv } from '../plugins/uxr/scripts/lib/csv.mjs';
import { profile } from '../plugins/uxr/scripts/lib/profile.mjs';
import { normalize } from '../plugins/uxr/scripts/lib/normalize.mjs';
import { xlsx } from './helpers/xlsx.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-intake-'));
function file(name, content) {
  const p = path.join(tmp(), name);
  fs.writeFileSync(p, content);
  return p;
}
const table = (rows) => ({ header: rows[0], rows: rows.slice(1) });

describe('csv', () => {
  test('parses quotes, embedded delimiters and newlines', () => {
    const { header, rows } = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",2\n');
    assert.deepEqual(header, ['a', 'b']);
    assert.deepEqual(rows, [['x, y', 'line1\nline2'], ['say "hi"', '2']]);
  });
  test('round-trips through toCsv', () => {
    const t = { header: ['a', 'b'], rows: [['1,5', 'he said "no"'], ['', 'x']] };
    assert.deepEqual(parseCsv(toCsv(t)), t);
  });
});

describe('extract', () => {
  test('CSV with BOM, semicolons and decimal commas', () => {
    const r = extract(file('d.csv', '﻿Participant;Time;Rating\nP1;63,5;4\nP2;40;5\n'));
    assert.equal(r.status, 'ok');
    assert.equal(r.info.delimiter, ';');
    assert.deepEqual(r.table.header, ['Participant', 'Time', 'Rating']);
    assert.deepEqual(r.table.rows[0], ['P1', '63,5', '4']);
  });

  test('tab-separated text', () => {
    const r = extract(file('d.tsv', 'a\tb\n1\t2\n'));
    assert.equal(r.info.delimiter, '\t');
    assert.deepEqual(r.table.rows, [['1', '2']]);
  });

  test('Windows-1251 CSV (Ukrainian) is decoded and the encoding reported', () => {
    const text = 'Учасник,Успіх\nП1,так\n';
    const bytes = Buffer.from([...text].map((ch) => {
      const c = ch.charCodeAt(0);
      if (c < 128) return c;
      if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0;
      if (c === 0x456) return 0xb3; // і
      if (c === 0x406) return 0xb2; // І
      throw new Error(`unmapped ${ch}`);
    }));
    const r = extract(file('d.csv', bytes));
    assert.equal(r.info.encoding, 'windows-1251');
    assert.deepEqual(r.table.header, ['Учасник', 'Успіх']);
    assert.deepEqual(r.table.rows[0], ['П1', 'так']);
  });

  test('blank lines are dropped and empty or duplicate headers renamed', () => {
    const r = extract(file('d.csv', 'a,,a\n\n1,2,3\n,,\n'));
    assert.deepEqual(r.table.header, ['a', 'col_2', 'a_2']);
    assert.equal(r.table.rows.length, 1);
    assert.ok(r.warnings.some((w) => /renamed/i.test(w)));
  });

  test('--header-row skips title rows above the header', () => {
    const r = extract(file('d.csv', 'Checkout study,,\nexported 2026,,\nid,t,s\n1,2,3\n'), { headerRow: 3 });
    assert.deepEqual(r.table.header, ['id', 't', 's']);
    assert.deepEqual(r.table.rows, [['1', '2', '3']]);
  });

  test('JSON array of objects, nested objects flattened with dots', () => {
    const r = extract(file('d.json', JSON.stringify([{ id: 'P1', task: { name: 'T1', time: 30 } }, { id: 'P2', task: { name: 'T1', time: 40 }, extra: true }])));
    assert.deepEqual(r.table.header, ['id', 'task.name', 'task.time', 'extra']);
    assert.deepEqual(r.table.rows[0], ['P1', 'T1', '30', '']);
  });

  test('JSON with one array of rows inside an object is found automatically', () => {
    const r = extract(file('d.json', JSON.stringify({ study: 'x', sessions: [{ a: 1 }, { a: 2 }] })));
    assert.equal(r.status, 'ok');
    assert.equal(r.info.jsonPath, 'sessions');
  });

  test('JSON with several candidate arrays asks which one', () => {
    const r = extract(file('d.json', JSON.stringify({ a: [{ x: 1 }], b: [{ y: 2 }] })));
    assert.equal(r.status, 'needs-input');
    assert.deepEqual(r.options, ['a', 'b']);
  });

  test('NDJSON', () => {
    const r = extract(file('d.ndjson', '{"a":1}\n{"a":2,"b":"x"}\n'));
    assert.deepEqual(r.table.header, ['a', 'b']);
    assert.equal(r.table.rows.length, 2);
  });

  test('XLSX: strings, numbers, time-formatted cells and sheet choice', () => {
    const buf = xlsx({
      Notes: [['ignore me']],
      Data: [['Participant', 'Time', 'Done', 'Date'], ['P1', { v: 63 / 86400, fmt: 'time' }, 'yes', { v: 46000, fmt: 'date' }], ['P2', 41.5, null, null]],
    });
    const p = file('d.xlsx', buf);
    const ask = extract(p);
    assert.equal(ask.status, 'needs-input');
    assert.deepEqual(ask.options, ['Notes', 'Data']);
    const r = extract(p, { sheet: 'Data' });
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.table.header, ['Participant', 'Time', 'Done', 'Date']);
    assert.deepEqual(r.table.rows[0], ['P1', '0:01:03', 'yes', '2025-12-09']);
    assert.deepEqual(r.table.rows[1], ['P2', '41.5', '', '']);
    assert.ok(r.warnings.some((w) => /time/i.test(w)));
  });

  test('XLSX: "1:03" typed into an h:mm cell stays two-part, so its meaning gets asked', () => {
    const r = extract(file('t.xlsx', xlsx({ S: [['Participant', 'Task', 'Time'], ['P1', 'A', { v: 1 / 24 + 3 / 1440, fmt: 'h:mm' }], ['P2', 'A', { v: 58 / 1440, fmt: 'h:mm' }]] })));
    assert.deepEqual(r.table.rows.map((x) => x[2]), ['1:03', '0:58']);
    assert.ok(profile(r.table).mustAsk.some((a) => a.topic === 'time-format'));
  });

  test('a single-sheet workbook needs no sheet choice', () => {
    const r = extract(file('d.xlsx', xlsx({ Only: [['a'], [1]] })));
    assert.equal(r.status, 'ok');
    assert.equal(r.info.sheet, 'Only');
  });

  test('unsupported formats are reported, not guessed', () => {
    const r = extract(file('d.ods', 'PK'));
    assert.equal(r.status, 'error');
    assert.match(r.message, /ods/);
  });
});

describe('profile', () => {
  const long = table([
    ['Participant', 'Task', 'Result', 'Duration', 'Errors', 'SEQ', 'Notes'],
    ['P1', 'Checkout', 'Completed', '1:03', '0', '6', ''],
    ['P2', 'Checkout', 'Failed', '2:10', '2', '3', ''],
    ['P3', 'Checkout', 'Partial', '0:55', '1', '5', ''],
    ['pilot', 'Checkout', 'Completed', '0:40', '0', '7', 'test run'],
    ['P1', 'Search', 'Completed', '0:30', '0', '7', ''],
    ['P2', 'Search', 'Completed', '', '0', '', ''],
  ]);

  test('detects types and guesses roles with confidence', () => {
    const p = profile(long);
    const col = (n) => p.columns.find((c) => c.name === n);
    assert.equal(p.layout, 'long');
    assert.equal(col('Duration').type, 'duration');
    assert.equal(col('Result').type, 'text');
    assert.equal(col('SEQ').type, 'integer');
    assert.deepEqual([col('SEQ').min, col('SEQ').max], [3, 7]);
    assert.equal(col('Duration').missing, 1);
    assert.equal(col('Participant').roles[0].role, 'participant_id');
    assert.equal(col('Task').roles[0].role, 'task_id');
    assert.equal(col('Result').roles[0].role, 'success');
    assert.equal(col('Duration').roles[0].role, 'time_s');
    assert.equal(col('SEQ').roles[0].role, 'seq');
  });

  test('lists what must be asked instead of guessed', () => {
    const asks = profile(long).mustAsk.map((a) => a.topic);
    for (const topic of ['success-coding', 'time-format', 'scale-range', 'scale-direction', 'blanks', 'exclusions']) {
      assert.ok(asks.includes(topic), `missing ${topic} in ${asks}`);
    }
  });

  test('single-task studies, abbreviated names and scales written in headers', () => {
    const p = profile(table([
      ['Respondent', 'Task', 'Time', 'Sat (1-5)'],
      ['U1', 'Checkout', '0:00:42', '5'], ['U2', 'Checkout', '0:01:10', '3'], ['U3', 'Checkout', '', '4'],
    ]));
    const col = (n) => p.columns.find((c) => c.name === n);
    assert.equal(col('Task').roles[0].role, 'task_id');
    assert.ok(col('Task').roles[0].confidence >= 0.9);
    assert.equal(col('Sat (1-5)').roles[0].role, 'satisfaction');
    assert.deepEqual(col('Sat (1-5)').scaleHint, [1, 5]);
    assert.ok(!p.mustAsk.some((a) => a.topic === 'time-format'), 'h:mm:ss needs no question');
    assert.match(p.mustAsk.find((a) => a.topic === 'scale-range').question, /header says 1–5/);
  });

  test('h:mm:ss values that all end in :00 are asked about (Excel may have turned m:ss into h:mm)', () => {
    const p = profile(table([['Participant', 'Task', 'Time'], ['P1', 'A', '1:03:00'], ['P2', 'A', '0:58:00']]));
    assert.match(p.mustAsk.find((a) => a.topic === 'time-format').question, /ends in :00/);
  });

  test('0/1 success is still confirmed, and a single rating is asked about as satisfaction', () => {
    const p = profile(table([['Participant', 'Task', 'Success', 'SEQ'], ['P1', 'A', '1', '6'], ['P2', 'A', '0', '3'], ['P3', 'A', '1', '5']]));
    const asks = p.mustAsk.map((a) => a.topic);
    assert.ok(asks.includes('success-coding'));
    assert.ok(asks.includes('satisfaction-construct'));
    const coded = profile(table([['Participant', 'Task', 'Success'], ['P1', 'A', '1'], ['P2', 'A', '2'], ['P3', 'A', '3']]));
    assert.match(coded.mustAsk.find((a) => a.topic === 'success-coding').question, /"2"/);
  });

  test('wide headers get roles from their field part, so the must-ask list is complete', () => {
    const p = profile(table([
      ['ID', 'Завдання 1 успіх', 'Завдання 1 час', 'Завдання 1 легкість', 'Завдання 2 успіх', 'Завдання 2 час', 'Завдання 2 легкість'],
      ['P1', '1', '30', '6', '0', '50', '3'], ['P2', '1', '41', '5', '1', '44', '4'],
    ]));
    assert.equal(p.layout, 'wide');
    assert.equal(p.columns.find((c) => c.name === 'Завдання 1 час').roles[0].role, 'time_s');
    const asks = p.mustAsk.map((a) => a.topic);
    for (const topic of ['success-coding', 'time-format', 'scale-range', 'scale-direction', 'satisfaction-construct', 'wide-pairing']) {
      assert.ok(asks.includes(topic), `missing ${topic} in ${asks}`);
    }
    assert.match(p.mustAsk.find((a) => a.topic === 'scale-range').question, /"легкість" \(in every task\) \(seen 3–6\)/);
  });

  test('decimal comma numbers are recognised', () => {
    const p = profile(table([['t'], ['63,5'], ['40'], ['12,25']]));
    assert.equal(p.columns[0].type, 'number');
    assert.equal(p.columns[0].decimalComma, true);
  });

  test('wide layout: one row per participant, task-numbered columns', () => {
    const p = profile(table([
      ['ID', 'T1 Time', 'T1 Success', 'T1 SEQ', 'T2 Time', 'T2 Success', 'T2 SEQ'],
      ['P1', '30', '1', '6', '50', '0', '3'],
    ]));
    assert.equal(p.layout, 'wide');
    assert.deepEqual(p.wide.tasks, ['1', '2']);
    assert.deepEqual(p.wide.fields.sort(), ['SEQ', 'Success', 'Time']);
  });

  test('duplicate participant × task rows are flagged', () => {
    const p = profile(table([['Participant', 'Task', 'Time'], ['P1', 'A', '3'], ['P1', 'A', '4']]));
    assert.ok(p.mustAsk.some((a) => a.topic === 'duplicates'));
  });
});

describe('normalize', () => {
  const raw = table([
    ['Participant', 'Task', 'Result', 'Duration', 'Errors', 'Ease (1=very easy)', 'Notes'],
    ['P1', 'Checkout', 'Completed', '1:03', '0', '2', ''],
    ['P2', 'Checkout', 'Failed', '2:10', '2', '6', ''],
    ['P3', 'Checkout', 'Partial', '0:55', '1', '3', ''],
    ['pilot', 'Checkout', 'Completed', '0:40', '0', '1', 'test run'],
    ['P2', 'Search', 'Completed', 'NA', '0', '', ''],
  ]);
  const mapping = {
    version: 1,
    layout: 'long',
    columns: {
      participant_id: { from: 'Participant' },
      task_id: { from: 'Task' },
      success: { from: 'Result', map: { Completed: 1, Failed: 0, Partial: 0 } },
      time_s: { from: 'Duration', unit: 'mm:ss' },
      errors: { from: 'Errors' },
      error_opportunities: { value: 5 },
      ease: { from: 'Ease (1=very easy)', scale: [1, 7], reverse: true },
    },
    missing: { tokens: ['', 'NA'] },
    exclude: [{ column: 'Participant', equals: ['pilot'], reason: 'pilot session' }],
  };

  test('maps, converts units, reverses scales, excludes and keeps source rows', () => {
    const r = normalize(raw, mapping);
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.table.header, ['source_row', 'participant_id', 'task_id', 'success', 'time_s', 'errors', 'error_opportunities', 'ease']);
    assert.deepEqual(r.table.rows[0], ['2', 'P1', 'Checkout', '1', '63', '0', '5', '6']);
    assert.deepEqual(r.table.rows[1], ['3', 'P2', 'Checkout', '0', '130', '2', '5', '2']);
    assert.equal(r.table.rows.length, 4);
    assert.deepEqual(r.log.dropped, [{ source_row: 5, reason: 'pilot session' }]);
    assert.deepEqual(r.table.rows[3].slice(0, 5), ['6', 'P2', 'Search', '1', '']);
    assert.equal(r.log.blanks.time_s, 1);
  });

  test('an unmapped text code stops with a question instead of a guess', () => {
    const m = structuredClone(mapping);
    m.columns.success.map = { Completed: 1, Failed: 0 };
    const r = normalize(raw, m);
    assert.equal(r.status, 'needs-input');
    assert.match(r.message, /Partial/);
  });

  test('a value outside the declared scale stops', () => {
    const m = structuredClone(mapping);
    m.columns.ease.scale = [1, 5];
    const r = normalize(raw, m);
    assert.equal(r.status, 'needs-input');
    assert.match(r.message, /outside/);
  });

  test('a missing source column is an error', () => {
    const m = structuredClone(mapping);
    m.columns.errors.from = 'Mistakes';
    assert.equal(normalize(raw, m).status, 'error');
  });

  test('duplicates stop unless a policy is set', () => {
    const dup = table([['p', 't', 's'], ['P1', 'A', '1'], ['P1', 'A', '0']]);
    const m = { version: 1, layout: 'long', columns: { participant_id: { from: 'p' }, task_id: { from: 't' }, success: { from: 's' } } };
    assert.equal(normalize(dup, m).status, 'needs-input');
    const kept = normalize(dup, { ...m, duplicates: 'first' });
    assert.equal(kept.status, 'ok');
    assert.equal(kept.table.rows.length, 1);
    assert.equal(kept.log.dropped[0].reason, 'duplicate participant × task');
  });

  test('wide layout is unpivoted to one row per participant × task', () => {
    const wide = table([
      ['ID', 'T1 Time', 'T1 Success', 'T2 Time', 'T2 Success'],
      ['P1', '30,5', 'yes', '50', 'no'],
      ['P2', '41', 'yes', '', ''],
    ]);
    const m = {
      version: 1,
      layout: 'wide',
      wide: {
        pattern: '^T(?<task>\\d+) (?<field>.+)$',
        fields: { Time: { to: 'time_s', unit: 's' }, Success: { to: 'success', map: { yes: 1, no: 0 } } },
      },
      columns: { participant_id: { from: 'ID' } },
      number: { decimal: ',' },
      missing: { tokens: [''], dropEmptyTasks: true },
    };
    const r = normalize(wide, m);
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.table.header, ['source_row', 'participant_id', 'task_id', 'success', 'time_s']);
    assert.deepEqual(r.table.rows, [['2', 'P1', '1', '1', '30.5'], ['2', 'P1', '2', '0', '50'], ['3', 'P2', '1', '1', '41']]);
    assert.equal(r.log.dropped[0].reason, 'no data for task 2');
  });

  test('a confirmed mm:ss reads Excel\'s h:mm:00 as minutes:seconds; times over an hour are flagged', () => {
    const t = table([['p', 't', 'time'], ['P1', 'A', '1:03:00'], ['P2', 'A', '0:58:00']]);
    const cols = { participant_id: { from: 'p' }, task_id: { from: 't' }, time_s: { from: 'time', unit: 'mm:ss' } };
    const r = normalize(t, { version: 1, layout: 'long', columns: cols });
    assert.deepEqual(r.table.rows.map((x) => x[3]), ['63', '58']);
    assert.deepEqual(r.log.warnings, []);
    const hours = normalize(t, { version: 1, layout: 'long', columns: { ...cols, time_s: { from: 'time', unit: 's' } } });
    assert.equal(hours.table.rows[0][3], '3780');
    assert.match(hours.log.warnings.join(), /over an hour/);
  });

  test('success codes other than 0 and 1 stop unless mapped', () => {
    const t = table([['p', 't', 's'], ['P1', 'A', '1'], ['P2', 'A', '2'], ['P3', 'A', '3']]);
    const cols = { participant_id: { from: 'p' }, task_id: { from: 't' }, success: { from: 's' } };
    const r = normalize(t, { version: 1, layout: 'long', columns: cols });
    assert.equal(r.status, 'needs-input');
    assert.match(r.message, /not 0 or 1/);
    const mapped = normalize(t, { version: 1, layout: 'long', columns: { ...cols, success: { from: 's', map: { 1: 1, 2: 1, 3: 0 } } } });
    assert.equal(mapped.status, 'ok');
  });

  test('wide layout: task names from the mapping replace column numbers', () => {
    const wide = table([['ID', 'T1 Success', 'T2 Success'], ['P1', '1', '0']]);
    const m = { version: 1, layout: 'wide', columns: { participant_id: { from: 'ID' } }, wide: { pattern: '^T(?<task>\\d+) (?<field>.+)$', fields: { Success: { to: 'success' } }, taskNames: { 1: 'Sign up', 2: 'Checkout' } } };
    assert.deepEqual(normalize(wide, m).table.rows.map((x) => x[2]), ['Sign up', 'Checkout']);
  });

  test('satisfaction items are kept as sat_1..sat_k', () => {
    const t = table([['p', 't', 'q1', 'q2'], ['P1', 'A', '4', '5']]);
    const m = { version: 1, layout: 'long', columns: { participant_id: { from: 'p' }, task_id: { from: 't' }, sat_1: { from: 'q1', scale: [1, 5] }, sat_2: { from: 'q2', scale: [1, 5] } } };
    const r = normalize(t, m);
    assert.deepEqual(r.table.header, ['source_row', 'participant_id', 'task_id', 'sat_1', 'sat_2']);
  });

  test('unknown canonical field names are rejected', () => {
    const r = normalize(raw, { ...mapping, columns: { ...mapping.columns, speed: { from: 'Duration' } } });
    assert.equal(r.status, 'error');
    assert.match(r.message, /speed/);
  });
});
