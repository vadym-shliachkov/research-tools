import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI = path.resolve(import.meta.dirname, '../plugins/uxr/skills/sum/scripts/sum.mjs');
const run = (...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, json: JSON.parse(r.stdout) };
};
const DATA = `participant_id,task_id,success,time_s,errors,error_opportunities,satisfaction
U1,checkout,1,42,0,5,5
U2,checkout,1,50,0,5,4
U3,checkout,1,55,1,5,4
U4,checkout,1,60,0,5,4
U5,checkout,1,64,0,5,3
U6,checkout,1,72,1,5,4
U7,checkout,1,78,0,5,5
U8,checkout,1,85,1,5,3
U9,checkout,0,,1,5,2
U10,checkout,0,,0,5,3
`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-sum-'));
  const data = path.join(dir, 'data.csv');
  fs.writeFileSync(data, DATA);
  fs.writeFileSync(path.join(dir, 'mapping.json'), JSON.stringify({ version: 1, layout: 'long', columns: { satisfaction: { from: 'Sat', scale: [1, 5] } } }));
  return { dir, data };
}

test('init-contract drafts a contract with nulls and the questions to ask', () => {
  const { dir, data } = setup();
  const out = path.join(dir, 'contract.json');
  const r = run('init-contract', data, '--mapping', path.join(dir, 'mapping.json'), '--out', out);
  assert.equal(r.code, 0);
  const c = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(c.defaults.scales, { satisfaction: [1, 5] });
  assert.equal(c.defaults.sat_target, null);
  assert.deepEqual(Object.keys(c.tasks), ['checkout']);
  assert.ok(r.json.toFill.some((q) => q.key === 'defaults.error_opportunities_predefined'));
});

test('run with a filled contract: autopilot, result file and readable summary', () => {
  const { dir, data } = setup();
  const contract = path.join(dir, 'contract.json');
  run('init-contract', data, '--mapping', path.join(dir, 'mapping.json'), '--out', contract);
  const c = JSON.parse(fs.readFileSync(contract, 'utf8'));
  Object.assign(c.defaults, { satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20, error_opportunities_predefined: true });
  c.goal = 'benchmark';
  fs.writeFileSync(contract, JSON.stringify(c));
  const out = path.join(dir, 'result.json');
  const r = run('run', data, '--contract', contract, '--bootstrap', '300', '--out', out);
  assert.equal(r.code, 0);
  assert.equal(r.json.preset, 'sum4');
  assert.equal(r.json.groups[0].tasks[0].sum.pct, 67.4);
  assert.ok(r.json.sensitivity.length >= 3);
  const saved = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(saved.method.preset, 'sum4');
  assert.ok(saved.contract && saved.generated_at);

  const explicit = run('run', data, '--contract', contract, '--method', 'sum3', '--agg', 'pct-mean', '--bootstrap', '0');
  assert.equal(explicit.json.method, 'SUM3|pctmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1');
  assert.equal(explicit.json.groups[0].tasks[0].sum.pct, 54.2);

  const again = run('run', data, '--contract', contract, '--previous', out, '--bootstrap', '0');
  assert.equal(again.json.preset, 'sum4');
  assert.match(again.json.reasons[0], /previous wave/);
});

test('an unfilled contract asks instead of computing', () => {
  const { dir, data } = setup();
  const contract = path.join(dir, 'contract.json');
  run('init-contract', data, '--out', contract);
  const r = run('run', data, '--contract', contract, '--method', 'sum3', '--bootstrap', '0');
  assert.notEqual(r.code, 0);
});

test('compare lists every preset with a value or a reason', () => {
  const { dir, data } = setup();
  const contract = path.join(dir, 'c.json');
  fs.writeFileSync(contract, JSON.stringify({ version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20 } }));
  const r = run('compare', data, '--contract', contract);
  assert.equal(r.code, 0);
  const by = Object.fromEntries(r.json.methods.map((m) => [m.preset, m]));
  assert.equal(by.sum3.products[0].pct, 55.3);
  assert.equal(by.sum4.status, 'not-applicable');
  assert.equal(by.pearson.status, 'not-applicable');
});
