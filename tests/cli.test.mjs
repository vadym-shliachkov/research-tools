import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { xlsx } from './helpers/xlsx.mjs';

const UXR = path.resolve(import.meta.dirname, '../plugins/uxr/scripts/uxr.mjs');
const run = (...args) => {
  const r = spawnSync(process.execPath, [UXR, ...args], { encoding: 'utf8' });
  return { code: r.status, json: JSON.parse(r.stdout) };
};

test('extract → profile → normalize on a messy workbook', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-cli-'));
  const src = path.join(dir, 'study.xlsx');
  fs.writeFileSync(src, xlsx({
    Info: [['Checkout benchmark']],
    Results: [
      ['Respondent', 'Task', 'Outcome', 'Time', 'SEQ'],
      ['P1', 'Checkout', 'Success', { v: 42 / 86400, fmt: 'time' }, 6],
      ['P2', 'Checkout', 'Gave up', { v: 95 / 86400, fmt: 'time' }, 2],
    ],
  }));
  const raw = path.join(dir, 'raw.csv');

  const ask = run('extract', src, '--out', raw);
  assert.equal(ask.code, 2);
  assert.deepEqual(ask.json.options, ['Info', 'Results']);

  const ex = run('extract', src, '--out', raw, '--sheet', 'Results');
  assert.equal(ex.code, 0);
  assert.equal(ex.json.rows, 2);

  const pr = run('profile', raw, '--out', path.join(dir, 'profile.json'));
  assert.equal(pr.code, 0);
  assert.ok(pr.json.mustAsk.some((a) => a.topic === 'success-coding'));
  assert.ok(fs.existsSync(path.join(dir, 'profile.json')));

  const mapping = path.join(dir, 'mapping.json');
  fs.writeFileSync(mapping, JSON.stringify({
    version: 1, layout: 'long',
    columns: {
      participant_id: { from: 'Respondent' }, task_id: { from: 'Task' },
      success: { from: 'Outcome', map: { Success: 1, 'Gave up': 0 } },
      time_s: { from: 'Time', unit: 'mm:ss' }, seq: { from: 'SEQ', scale: [1, 7] },
    },
  }));
  const out = path.join(dir, 'data.csv');
  const no = run('normalize', raw, '--mapping', mapping, '--out', out, '--log', path.join(dir, 'log.json'));
  assert.equal(no.code, 0);
  assert.equal(fs.readFileSync(out, 'utf8'), 'source_row,participant_id,task_id,success,time_s,seq\n2,P1,Checkout,1,42,6\n3,P2,Checkout,0,95,2\n');
});

test('usage errors exit 1 with a message', () => {
  const r = run('bogus', 'x');
  assert.equal(r.code, 1);
  assert.match(r.json.message, /Usage/);
});
