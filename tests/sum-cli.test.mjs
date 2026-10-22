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

test('report, facts and explainer: the explainer renders only after the editor review', () => {
  const { dir, data } = setup();
  const contract = path.join(dir, 'c.json');
  fs.writeFileSync(contract, JSON.stringify({ version: 1, study: 'Checkout', defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20 } }));
  const result = path.join(dir, 'result.json');
  run('run', data, '--contract', contract, '--bootstrap', '200', '--out', result);

  const rep = run('report', result, '--out-dir', dir, '--lang', 'ua');
  assert.equal(rep.code, 0);
  assert.match(fs.readFileSync(rep.json.md, 'utf8'), /Звіт SUM/);
  assert.match(rep.json.html, /report\.ua\.html$/);

  const facts = run('facts', result);
  assert.equal(facts.json.facts.overall.pct, 55);

  const doc = { lang: 'en', title: 'How to understand your results', study: 'Checkout', headline: { value: '55%', label: 'Overall score', sentence: 'Close to the target.' }, sections: ['measured', 'result', 'components', 'range', 'fix-first', 'limits'].map((id) => ({ id, heading: id, paragraphs: ['Text.'] })), glossary: [{ term: 'Score', definition: 'One number.' }] };
  const draft = path.join(dir, 'explainer.draft.json');
  fs.writeFileSync(draft, JSON.stringify(doc));
  const refused = run('explainer', draft, '--result', result, '--out-dir', dir);
  assert.equal(refused.code, 1);
  assert.match(refused.json.message, /editor/);

  const edited = path.join(dir, 'explainer.json');
  fs.writeFileSync(edited, JSON.stringify({ ...doc, review: { readable: true, notes: [] } }));
  const ok = run('explainer', edited, '--result', result, '--out-dir', dir);
  assert.equal(ok.code, 0);
  assert.ok(fs.existsSync(ok.json.html));
  assert.ok(ok.json.pdf === null ? ok.json.warnings.length > 0 : fs.existsSync(ok.json.pdf));

  // The verdict is uncertain here, so a headline that calls the result above target is refused.
  assert.equal(facts.json.facts.overall.verdict, 'uncertain');
  fs.writeFileSync(edited, JSON.stringify({ ...doc, headline: { ...doc.headline, sentence: 'The score is above target.' }, review: { readable: true, notes: [] } }));
  const overstated = run('explainer', edited, '--result', result, '--out-dir', dir);
  assert.equal(overstated.code, 1);
  assert.match(overstated.json.message, /uncertain/);
});

test('a relative --out-dir still gives a PDF next to the HTML', () => {
  const { dir, data } = setup();
  const contract = path.join(dir, 'c.json');
  fs.writeFileSync(contract, JSON.stringify({ version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20 } }));
  run('run', data, '--contract', contract, '--bootstrap', '0', '--out', path.join(dir, 'result.json'));
  const doc = { lang: 'en', title: 'T', headline: { value: '55%', label: 'Score', sentence: 'Close to the target.' }, sections: ['measured', 'result', 'components', 'range', 'fix-first', 'limits'].map((id) => ({ id, heading: id, paragraphs: ['Text.'] })), glossary: [{ term: 'Score', definition: 'One number.' }], review: { readable: true, notes: [] } };
  fs.writeFileSync(path.join(dir, 'explainer.json'), JSON.stringify(doc));
  const r = spawnSync(process.execPath, [CLI, 'explainer', 'explainer.json', '--result', 'result.json', '--out-dir', 'sub'], { cwd: dir, encoding: 'utf8' });
  const json = JSON.parse(r.stdout);
  assert.equal(json.status, 'ok');
  assert.ok(path.isAbsolute(json.html));
  assert.ok(json.pdf === null ? json.warnings.length > 0 : fs.existsSync(json.pdf));
});

test('the next wave: earlier targets carry over, and a changed one is flagged', () => {
  const { dir, data } = setup();
  const c1 = path.join(dir, 'c1.json');
  fs.writeFileSync(c1, JSON.stringify({ version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20 } }));
  const wave1 = path.join(dir, 'wave1.json');
  run('run', data, '--contract', c1, '--method', 'sum3', '--bootstrap', '0', '--out', wave1);

  const c2 = path.join(dir, 'c2.json');
  fs.writeFileSync(c2, JSON.stringify({ version: 1, defaults: { satisfaction_from: 'satisfaction' } }));
  const same = run('run', data, '--contract', c2, '--previous', wave1, '--bootstrap', '0');
  assert.equal(same.code, 0);
  assert.equal(same.json.groups[0].tasks[0].sum.pct, 55.3);
  assert.ok(!same.json.qa.warnings.some((w) => /previous wave/.test(w)));

  // The same scales in another key order are the same contract.
  fs.writeFileSync(c1, JSON.stringify({ version: 1, defaults: { scales: { satisfaction: [1, 5], seq: [1, 7] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20 } }));
  run('run', data, '--contract', c1, '--method', 'sum3', '--bootstrap', '0', '--out', wave1);
  fs.writeFileSync(c2, JSON.stringify({ version: 1, defaults: { scales: { seq: [1, 7], satisfaction: [1, 5] }, satisfaction_from: 'satisfaction' } }));
  assert.ok(!run('run', data, '--contract', c2, '--previous', wave1, '--bootstrap', '0').json.qa.warnings.some((w) => /previous wave/.test(w)));

  fs.writeFileSync(c2, JSON.stringify({ version: 1, defaults: { satisfaction_from: 'satisfaction', sat_target: 3.5 } }));
  const changed = run('run', data, '--contract', c2, '--previous', wave1, '--bootstrap', '0');
  assert.match(changed.json.qa.warnings.join(), /sat_target was 4, now 3\.5.*not directly comparable/);
  assert.match(changed.json.reasons[0], /not directly comparable/);
});

test('--help prints the usage instead of a stack trace', () => {
  const r = run('--help');
  assert.equal(r.code, 0);
  assert.match(r.json.usage, /sum\.mjs compare/);
  const bad = run('run', '--no-such-flag');
  assert.equal(bad.code, 1);
  assert.match(bad.json.message, /Usage/);
});

test('compare lists every preset with a value or a reason', () => {
  const { dir, data } = setup();
  const contract = path.join(dir, 'c.json');
  fs.writeFileSync(contract, JSON.stringify({ version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20 } }));
  const out = path.join(dir, 'compare.json');
  const r = run('compare', data, '--contract', contract, '--bootstrap', '200', '--out', out);
  assert.equal(r.code, 0);
  const by = Object.fromEntries(r.json.methods.map((m) => [m.preset, m]));
  assert.equal(by.sum3.products[0].pct, 55.3);
  assert.equal(by.sum3.products[0].ci.length, 2);
  assert.equal(by.sum4.status, 'not-applicable');
  assert.equal(by.pearson.status, 'not-applicable');
  assert.equal(typeof r.json.methodDependent, 'boolean');
  assert.ok(JSON.parse(fs.readFileSync(out, 'utf8')).contract);
});
