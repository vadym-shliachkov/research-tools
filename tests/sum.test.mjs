import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as SUM from '../plugins/uxr/skills/sum/scripts/sum-lib.mjs';
import { cdf } from '../plugins/uxr/scripts/lib/stats.mjs';

const near = (a, b, tol = 5e-4) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);
const T = (header, rows) => ({ header, rows: rows.map((r) => r.map((v) => (v === null ? '' : String(v)))) });

// The worked checkout example from the source report: 10 users, one task.
const CHECKOUT = T(['participant_id', 'task_id', 'success', 'time_s', 'errors', 'error_opportunities', 'satisfaction'], [
  ['U1', 'checkout', 1, 42, 0, 5, 5], ['U2', 'checkout', 1, 50, 0, 5, 4], ['U3', 'checkout', 1, 55, 1, 5, 4],
  ['U4', 'checkout', 1, 60, 0, 5, 4], ['U5', 'checkout', 1, 64, 0, 5, 3], ['U6', 'checkout', 1, 72, 1, 5, 4],
  ['U7', 'checkout', 1, 78, 0, 5, 5], ['U8', 'checkout', 1, 85, 1, 5, 3], ['U9', 'checkout', 0, null, 1, 5, 2],
  ['U10', 'checkout', 0, null, 0, 5, 3],
]);
const CHECKOUT_CONTRACT = {
  version: 1,
  defaults: {
    scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4,
    expert_time_s: 20, expert_multiplier: 3, error_opportunities_predefined: true,
  },
};
const task0 = (r) => r.groups[0].tasks[0];

// The Autodesk-style example from the source report: 8 users, 7 succeed, 7-point satisfaction.
const AUTODESK = T(['participant_id', 'task_id', 'success', 'time_s', 'satisfaction'], [
  ['A1', 'plan', 1, 80, 6], ['A2', 'plan', 1, 85, 5], ['A3', 'plan', 1, 90, 5], ['A4', 'plan', 1, 95, 6],
  ['A5', 'plan', 1, 100, 4], ['A6', 'plan', 1, 110, 5], ['A7', 'plan', 1, 120, 6], ['A8', 'plan', 0, null, 4],
]);
const AUTODESK_CONTRACT = { version: 1, defaults: { scales: { satisfaction: [1, 7] }, satisfaction_from: 'satisfaction', sat_target: 5 } };

describe('golden numbers from the literature', () => {
  test('original 4-component SUM, z-mean: 67.4%', () => {
    const r = SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum4', bootstrap: 0 });
    assert.equal(r.status, 'ok');
    const c = task0(r).components;
    near(c.completion.z, 0.8416);
    near(c.time.z, -0.1228);
    near(c.satisfaction.z, -0.3162);
    near(c.errors.z, 1.4051);
    near(task0(r).sum.pct, 0.6743);
    assert.equal(r.method.string, 'SUM4|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1');
    assert.equal(task0(r).components.time.targetSource, 'expert time 20 s × 3');
  });

  test('3-component SUM: 55.3%', () => {
    near(task0(SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 0 })).sum.pct, 0.5534);
  });

  test('percentage averaging (MeasuringU style) on the same data: 63.7% and 54.2%', () => {
    near(task0(SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum4', modifiers: { agg: 'pct-mean' }, bootstrap: 0 })).sum.pct, 0.6368);
    near(task0(SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', modifiers: { agg: 'pct-mean' }, bootstrap: 0 })).sum.pct, 0.5424);
  });

  test('1.5 sigma shift turns 67.4% into 97.45%', () => {
    near(task0(SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum4', modifiers: { shift: 1.5 }, bootstrap: 0 })).sum.pct, 0.97452);
  });

  test('Autodesk-style example with a fixed 100 s target and raw time: 69.2%', () => {
    const contract = structuredClone(AUTODESK_CONTRACT);
    contract.defaults.time_target_s = 100;
    const r = SUM.runSum(AUTODESK, contract, { method: 'sum3', modifiers: { timeLog: false }, bootstrap: 0 });
    near(task0(r).components.satisfaction.z, 0.1497);
    near(task0(r).components.completion.z, 1.1503);
    near(task0(r).components.time.z, 0.2026);
    near(task0(r).sum.pct, 0.692);
  });

  test('MeasuringU "10 things" example: (80 + 60 + 61.7 + 77.3) / 4 ≈ 69.8%', () => {
    const agg = SUM.aggregate([
      { z: Infinity, pct: 0.8 }, { z: Infinity, pct: 0.6 }, { z: 0.3, pct: cdf(0.3) }, { z: 0.75, pct: cdf(0.75) },
    ], { agg: 'pct-mean', shift: 0 });
    near(agg.pct, 0.6977);
  });

  test('Microsoft Usability Score example: 60%', () => {
    const data = T(['participant_id', 'task_id', 'success', 'perceived_time', 'ease', 'satisfaction'], [
      ['U1', 't', 1, 4, 4, 4], ['U2', 't', 1, 3, 4, 5], ['U3', 't', 1, 3, 5, 4], ['U4', 't', 1, 4, 4, 3], ['U5', 't', 1, 2, 4, 4],
      ['U6', 't', 1, 3, 3, 4], ['U7', 't', 1, 5, 5, 5], ['U8', 't', 0, 3, 4, 4], ['U9', 't', 1, 3, 4, 4], ['U10', 't', 1, 4, 5, 4],
    ]);
    const contract = { version: 1, defaults: { scales: { perceived_time: [1, 5], ease: [1, 5], satisfaction: [1, 5] } } };
    const r = SUM.runSum(data, contract, { method: 'microsoft', bootstrap: 0 });
    assert.equal(r.status, 'ok');
    near(task0(r).sum.pct, 0.6, 1e-12);
    near(task0(r).components.completion.pct, 0.9, 1e-12);
    near(task0(r).components.perceived_time.pct, 0.9, 1e-12);
  });

  test('Usability Score target: the agreed pass mark, or none', () => {
    const data = T(['participant_id', 'task_id', 'success', 'perceived_time', 'ease', 'satisfaction'], [
      ['U1', 't', 1, 4, 4, 4], ['U2', 't', 1, 3, 4, 5], ['U3', 't', 1, 3, 5, 4], ['U4', 't', 0, 4, 4, 3],
    ]);
    const scales = { perceived_time: [1, 5], ease: [1, 5], satisfaction: [1, 5] };
    const none = SUM.runSum(data, { version: 1, defaults: { scales } }, { method: 'microsoft', bootstrap: 0 });
    assert.equal(task0(none).sum.targetPct, null);
    assert.equal(none.groups[0].product.targetPct, null);
    assert.equal(task0(none).components.ease.targetPct, null);
    const gate = SUM.runSum(data, { version: 1, defaults: { scales, gate_threshold: 0.8 } }, { method: 'microsoft', bootstrap: 0 });
    assert.equal(gate.groups[0].product.targetPct, 0.8);
  });

  test('overall Usability Score counts people who passed every task, not the mean of task pass rates', () => {
    const rows = [];
    for (let i = 1; i <= 10; i++) {
      const p = `P${i}`;
      rows.push([p, 'sign-up', i <= 7 ? 1 : 0, 4, 4, 4], [p, 'profile', i <= 8 ? 1 : 0, 4, 4, 4]);
    }
    const data = T(['participant_id', 'task_id', 'success', 'perceived_time', 'ease', 'satisfaction'], rows);
    const scales = { perceived_time: [1, 5], ease: [1, 5], satisfaction: [1, 5] };
    const r = SUM.runSum(data, { version: 1, defaults: { scales, gate_threshold: 0.7, time_target_s: 60 } }, { method: 'microsoft', bootstrap: 0 });
    assert.deepEqual(r.groups[0].tasks.map((t) => t.sum.pct), [0.7, 0.8]);
    const p = r.groups[0].product;
    assert.deepEqual([p.pct, p.x, p.n, p.unit], [0.7, 7, 10, 'person']);
    assert.ok(p.ci[0] < 0.7 && p.ci[1] > 0.7);
    assert.ok(!('passes' in r.groups[0].tasks[0]));
    // Time on task and the time target do not enter the score; the result says so.
    assert.match(r.qa.warnings.find((w) => w.code === 'gate-ignores-time').message, /time targets/);
  });

  test('proportions in the contract must be written as 0.78, not 78', () => {
    const bad = { ...CHECKOUT_CONTRACT, defaults: { ...CHECKOUT_CONTRACT.defaults, completion_benchmark: 78 } };
    const r = SUM.runSum(CHECKOUT, bad, { method: 'pearson', bootstrap: 0 });
    assert.equal(r.status, 'error');
    assert.match(r.message, /0\.78/);
    assert.equal(SUM.choose(CHECKOUT, bad).status, 'error');
    assert.match(SUM.contractErrors({ defaults: { gate_threshold: 80 } }).join(), /gate_threshold/);
  });

  test('Pearson task: original 43.4%, piecewise 36.3%, Bernoulli 30.8%', () => {
    const zS = (3.5 - 4) / 1.1;
    const zT = -(75 - 60) / 50;
    const sumWith = (mode) => {
      const c = SUM.completionComponent({ x: 3, n: 5 }, { mode, benchmark: 0.78, smoothing: 'none' });
      return SUM.aggregate([{ z: zS, pct: cdf(zS) }, { z: zT, pct: cdf(zT) }, c], { agg: 'z-mean', shift: 0 }).pct;
    };
    near(sumWith('original'), 0.434);
    near(sumWith('piecewise'), 0.363);
    near(sumWith('bernoulli'), 0.308);
    near(SUM.completionComponent({ x: 3, n: 5 }, { mode: 'bernoulli', benchmark: 0.78 }).z, -0.75, 1e-9);
  });

  test('piecewise completion table, benchmark 78%', () => {
    for (const [p, want] of [[0, 0], [0.5, 0.3205], [0.6, 0.3846], [0.7, 0.4487], [0.78, 0.5], [0.9, 0.7727], [0.97, 0.9318], [1, 1]]) {
      near(SUM.piecewise(p, 0.78), want, 1e-4);
    }
  });
});

describe('edge cases and quality checks', () => {
  const perfect = T(['participant_id', 'task_id', 'success', 'time_s', 'satisfaction'], [
    ['P1', 't', 1, 30, 4], ['P2', 't', 1, 40, 5], ['P3', 't', 1, 35, 3], ['P4', 't', 1, 50, 4], ['P5', 't', 1, 45, 5],
  ]);
  const contract = { version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, time_target_s: 45 } };

  test('100% completion stops a z-mean run unless smoothing is chosen', () => {
    const r = SUM.runSum(perfect, contract, { method: 'sum3', bootstrap: 0 });
    assert.equal(r.status, 'error');
    assert.ok(r.qa.errors.some((e) => e.code === 'completion-extreme'));
    const s = SUM.runSum(perfect, contract, { method: 'sum3', modifiers: { smoothing: 'laplace' }, bootstrap: 0 });
    assert.equal(s.status, 'ok');
    near(task0(s).components.completion.z, 1.383, 1e-3);
  });

  test('100% completion is fine for percentage averaging, with a small-sample warning', () => {
    const r = SUM.runSum(perfect, contract, { method: 'sum3', modifiers: { agg: 'pct-mean' }, bootstrap: 0 });
    assert.equal(r.status, 'ok');
    assert.ok(r.qa.warnings.some((w) => w.code === 'small-n'));
  });

  test('zero spread at the target gives z = 0; zero spread off target stops', () => {
    const flat = (v) => T(['participant_id', 'task_id', 'success', 'time_s', 'satisfaction'], [
      ['P1', 't', 1, 30, v], ['P2', 't', 1, 40, v], ['P3', 't', 0, null, v], ['P4', 't', 1, 50, v],
    ]);
    const ok = SUM.runSum(flat(4), contract, { method: 'sum3', bootstrap: 0 });
    assert.equal(task0(ok).components.satisfaction.z, 0);
    const bad = SUM.runSum(flat(5), contract, { method: 'sum3', bootstrap: 0 });
    assert.equal(bad.status, 'error');
    assert.ok(bad.qa.errors.some((e) => e.code === 'zero-variance'));
  });

  test('no errors at all needs smoothing under z-mean', () => {
    const data = T(['participant_id', 'task_id', 'success', 'time_s', 'errors', 'error_opportunities', 'satisfaction'], [
      ['P1', 't', 1, 30, 0, 4, 4], ['P2', 't', 0, null, 0, 4, 3], ['P3', 't', 1, 50, 0, 4, 5],
    ]);
    const r = SUM.runSum(data, { ...contract, defaults: { ...contract.defaults, error_opportunities_predefined: true } }, { method: 'sum4', bootstrap: 0 });
    assert.ok(r.qa.errors.some((e) => e.code === 'errors-extreme'));
  });

  test('a missing time target stops instead of inventing one', () => {
    const c = structuredClone(contract);
    delete c.defaults.time_target_s;
    const r = SUM.runSum(CHECKOUT, c, { method: 'sum3', bootstrap: 0 });
    assert.equal(r.status, 'needs-input');
    assert.match(r.message, /time target/i);
  });

  test('time of failed attempts can count as the cutoff', () => {
    const c = structuredClone(CHECKOUT_CONTRACT);
    c.defaults.cutoff_s = 120;
    const r = SUM.runSum(CHECKOUT, c, { method: 'sum3', modifiers: { failedTime: 'cutoff' }, bootstrap: 0 });
    assert.equal(task0(r).components.time.n, 10);
    assert.ok(task0(r).components.time.z < -0.1228);
  });

  test('empirical (Autodesk) time target: 80th percentile of satisfied successful users', () => {
    const r = SUM.runSum(AUTODESK, AUTODESK_CONTRACT, { method: 'autodesk', bootstrap: 0 });
    assert.equal(r.status, 'ok');
    assert.equal(task0(r).components.time.target, 110);
    assert.equal(task0(r).components.time.targetSource, 'empirical: 80th percentile of 6 satisfied successful users');
  });

  test('empirical target falls back to 75% of the cutoff with 3 or fewer satisfied successes', () => {
    const few = T(AUTODESK.header, AUTODESK.rows.map((r, i) => (i < 5 ? [...r.slice(0, 4), '4'] : r)));
    const c = structuredClone(AUTODESK_CONTRACT);
    c.defaults.cutoff_s = 200;
    const r = SUM.runSum(few, c, { method: 'autodesk', bootstrap: 0 });
    assert.equal(task0(r).components.time.target, 150);
    delete c.defaults.cutoff_s;
    assert.equal(SUM.runSum(few, c, { method: 'autodesk', bootstrap: 0 }).status, 'needs-input');
  });

  test('a satisfaction composite averages its items and reports Cronbach alpha', () => {
    const data = T(['participant_id', 'task_id', 'success', 'time_s', 'ease', 'satisfaction', 'perceived_time'], [
      ['P1', 't', 1, 30, 4, 4, 5], ['P2', 't', 1, 40, 5, 4, 4], ['P3', 't', 0, null, 2, 3, 2], ['P4', 't', 1, 50, 4, 5, 4],
    ]);
    const c = { version: 1, defaults: { scales: { ease: [1, 5], satisfaction: [1, 5], perceived_time: [1, 5] }, satisfaction_from: ['ease', 'satisfaction', 'perceived_time'], sat_target: 4, time_target_s: 45 } };
    const s = task0(SUM.runSum(data, c, { method: 'sum3', bootstrap: 0 })).components.satisfaction;
    near(s.mean, (13 / 3 + 13 / 3 + 7 / 3 + 13 / 3) / 4, 1e-9);
    assert.ok(s.alpha > 0.8);
  });

  test('items on different scales cannot form a composite', () => {
    const data = T(['participant_id', 'task_id', 'success', 'time_s', 'seq', 'satisfaction'], [['P1', 't', 1, 30, 6, 4], ['P2', 't', 1, 40, 5, 3]]);
    const c = { version: 1, defaults: { scales: { seq: [1, 7], satisfaction: [1, 5] }, satisfaction_from: ['seq', 'satisfaction'], sat_target: 4, time_target_s: 45 } };
    assert.equal(SUM.runSum(data, c, { method: 'sum3', bootstrap: 0 }).status, 'error');
  });
});

describe('product level, groups and uncertainty', () => {
  test('product SUM combines tasks in the same space as the method', () => {
    const two = T(CHECKOUT.header, [...CHECKOUT.rows, ...CHECKOUT.rows.map((r) => [r[0], 'search', ...r.slice(2)])]);
    const r = SUM.runSum(two, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 0 });
    near(r.groups[0].product.pct, 0.5534);
    assert.equal(r.groups[0].tasks.length, 2);
  });

  test('groups are scored separately', () => {
    const g = T([...CHECKOUT.header, 'group'], [...CHECKOUT.rows.map((r) => [...r, 'A']), ...CHECKOUT.rows.map((r) => [r[0] + 'b', ...r.slice(1), 'B'])]);
    const r = SUM.runSum(g, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 0 });
    assert.deepEqual(r.groups.map((x) => x.group), ['A', 'B']);
  });

  test('bootstrap interval is reproducible and contains the estimate', () => {
    const a = SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 500, seed: 7 });
    const b = SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 500, seed: 7 });
    const ci = task0(a).sum.ci;
    assert.deepEqual(ci, task0(b).sum.ci);
    assert.ok(ci[0] < task0(a).sum.pct && task0(a).sum.pct < ci[1]);
    assert.ok(task0(a).components.completion.ci[0] < 0.8);
    assert.ok(a.groups[0].product.ci);
  });

  test('bootstrap samples that hit 100% completion are smoothed, not dropped', () => {
    const r = SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 1000, seed: 3 });
    assert.equal(r.groups[0].bootstrap.skipped, 0);
    assert.ok(r.groups[0].bootstrap.smoothedSamples > 0);
    assert.ok(!r.qa.warnings.some((w) => w.code === 'bootstrap-skips'));
  });

  test('two groups: each is scored, and the difference gets a range', () => {
    const bad = CHECKOUT.rows.map((r) => [r[0], r[1], r[2], r[3] === null ? null : r[3] * 2, ...r.slice(4), 'A']);
    const good = CHECKOUT.rows.map((r) => [`${r[0]}b`, ...r.slice(1), 'B']);
    const g = T([...CHECKOUT.header, 'group'], [...bad, ...good]);
    const r = SUM.runSum(g, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 400, seed: 5 });
    const [c] = r.comparison;
    assert.deepEqual([c.group, c.vs], ['B', 'A']);
    near(c.diff, r.groups[1].product.pct - r.groups[0].product.pct, 1e-12);
    assert.ok(c.ci[0] < c.diff && c.diff < c.ci[1]);
    assert.equal(SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 0 }).comparison, undefined);
  });

  test('the same people in both groups get a paired range, which is narrower; a partial overlap warns', () => {
    // Everyone is a bit slower on A than on B, but people differ a lot from each other.
    const rows = CHECKOUT.rows.flatMap((r) => [
      [r[0], r[1], r[2], r[3] === null ? null : r[3] * 1.3, r[4], r[5], r[6], 'A'],
      [r[0], r[1], r[2], r[3], r[4], r[5], r[6], 'B'],
    ]);
    const header = [...CHECKOUT.header, 'group'];
    const paired = SUM.runSum(T(header, rows), CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 400, seed: 2 }).comparison[0];
    assert.equal(paired.design, 'paired');
    assert.ok(paired.ci[0] < paired.diff && paired.diff < paired.ci[1]);
    const apart = rows.map((r) => (r[7] === 'B' ? [`${r[0]}b`, ...r.slice(1)] : r));
    const independent = SUM.runSum(T(header, apart), CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 400, seed: 2 }).comparison[0];
    assert.equal(independent.design, 'independent');
    near(independent.diff, paired.diff, 1e-12);
    assert.ok(paired.ci[1] - paired.ci[0] < independent.ci[1] - independent.ci[0]);
    const some = rows.map((r, i) => (r[7] === 'B' && i > 10 ? [`${r[0]}b`, ...r.slice(1)] : r));
    const mixed = SUM.runSum(T(header, some), CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 100, seed: 2 });
    assert.equal(mixed.comparison[0].design, 'mixed');
    assert.ok(mixed.qa.warnings.some((w) => w.code === 'mixed-design'));
  });

  test('targets: SUM parts at 50%, completion without a benchmark and the error-free rate have none', () => {
    const t = task0(SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum4', bootstrap: 0 }));
    assert.equal(t.components.completion.targetPct, null);
    assert.equal(t.components.errors.targetPct, null);
    assert.equal(t.components.time.targetPct, 0.5);
    assert.equal(t.sum.targetPct, 0.5);
    const p = task0(SUM.runSum(CHECKOUT, { ...CHECKOUT_CONTRACT, defaults: { ...CHECKOUT_CONTRACT.defaults, completion_benchmark: 0.78 } }, { method: 'pearson', bootstrap: 0 }));
    assert.equal(p.components.completion.targetPct, 0.5);
  });

  test('every run records the resolved method and a QA block', () => {
    const r = SUM.runSum(CHECKOUT, CHECKOUT_CONTRACT, { method: 'sum3', bootstrap: 0 });
    assert.ok(r.method.config && r.method.string && r.qa);
    assert.ok(r.qa.warnings.some((w) => w.code === 'failed-time-excluded'));
  });
});

describe('autopilot', () => {
  const base = { version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, time_target_s: 60 } };
  const choose = (data, contract, modifiers) => SUM.choose(data, contract, modifiers);
  const runSum = (data, contract, opts) => SUM.runSum(data, contract, opts);

  test('nothing special → sum3, z-mean', () => {
    const c = choose(CHECKOUT, base);
    assert.equal(c.status, 'ok');
    assert.equal(c.preset, 'sum3');
    assert.ok(c.reasons.some((r) => r.rule === 'errors'));
  });

  test('a previous wave fixes the method', () => {
    const prev = { method: { preset: 'sum4', config: SUM.resolveMethod('sum4').config } };
    const c = choose(CHECKOUT, { ...base, previous: prev });
    assert.equal(c.preset, 'sum4');
    assert.equal(c.reasons[0].rule, 'previous-run');
  });

  test('pass/fail goal with the four ratings → microsoft', () => {
    const data = T(['participant_id', 'task_id', 'success', 'perceived_time', 'ease', 'satisfaction'], [['U1', 't', 1, 4, 4, 4], ['U2', 't', 0, 2, 3, 3]]);
    const scales = { perceived_time: [1, 5], ease: [1, 5], satisfaction: [1, 5] };
    assert.equal(choose(data, { version: 1, goal: 'gate', defaults: { scales } }).preset, 'microsoft');
    const ask = choose(data, { version: 1, defaults: { scales } });
    assert.equal(ask.status, 'needs-input');
    assert.match(ask.question, /goal/i);
  });

  test('predefined error opportunities → sum4', () => {
    assert.equal(choose(CHECKOUT, { ...base, defaults: { ...base.defaults, error_opportunities_predefined: true } }).preset, 'sum4');
  });

  test('a completion benchmark → piecewise (pearson)', () => {
    const c = choose(CHECKOUT, { ...base, defaults: { ...base.defaults, completion_benchmark: 0.78 } });
    assert.equal(c.preset, 'pearson');
    assert.equal(c.config.completion, 'piecewise');
  });

  test('no time target but enough satisfied successes → empirical (autodesk)', () => {
    const c = choose(AUTODESK, AUTODESK_CONTRACT);
    assert.equal(c.preset, 'autodesk');
    const few = T(AUTODESK.header, AUTODESK.rows.map((r, i) => (i < 5 ? [...r.slice(0, 4), '4'] : r)));
    assert.equal(choose(few, AUTODESK_CONTRACT).status, 'needs-input');
  });

  test('a task at 100% → asks which fix; the chosen one is applied and labelled', () => {
    const perfect = T(CHECKOUT.header, CHECKOUT.rows.slice(0, 8));
    const ask = choose(perfect, base);
    assert.equal(ask.status, 'needs-input');
    assert.ok(ask.options.includes('--smoothing laplace'));
    const chosen = choose(perfect, base, { smoothing: 'laplace' });
    assert.equal(chosen.status, 'ok');
    assert.ok(chosen.reasons.some((r) => r.rule === 'extremes' && r.decision === 'smoothing=laplace'));
    const r = runSum(perfect, base, { modifiers: { smoothing: 'laplace' }, bootstrap: 0 });
    assert.equal(r.status, 'ok');
    assert.equal(r.method.config.smoothing, 'laplace');
  });

  test('MeasuringU comparability → percentage averaging', () => {
    const c = choose(CHECKOUT, { ...base, compare_with_measuringu: true });
    assert.equal(c.config.agg, 'pct-mean');
    assert.equal(c.preset, 'measuringu');
  });

  test('many tasks and a diagnose goal → pca-entropy is suggested, not run', () => {
    const rows = [];
    for (let t = 1; t <= 10; t++) for (const r of CHECKOUT.rows) rows.push([r[0], `task${t}`, ...r.slice(2)]);
    const c = choose(T(CHECKOUT.header, rows), { ...base, goal: 'diagnose' });
    assert.notEqual(c.preset, 'pca-entropy');
    assert.ok(c.suggestions.some((s) => /pca-entropy/.test(s)));
  });

  test('accessibility data → reported as a separate gate', () => {
    const c = choose(CHECKOUT, { ...base, accessibility_data: true });
    assert.ok(c.suggestions.some((s) => /accessibility/i.test(s)));
  });

  test('a gate without a pass mark says it will be reported without a target', () => {
    const data = T(['participant_id', 'task_id', 'success', 'perceived_time', 'ease', 'satisfaction'], [['U1', 't', 1, 4, 4, 4], ['U2', 't', 0, 2, 3, 3]]);
    const scales = { perceived_time: [1, 5], ease: [1, 5], satisfaction: [1, 5] };
    assert.match(choose(data, { version: 1, goal: 'gate', defaults: { scales } }).suggestions.join(), /gate_threshold/);
    assert.ok(!choose(data, { version: 1, goal: 'gate', defaults: { scales, gate_threshold: 0.8 } }).suggestions.join().includes('gate_threshold'));
  });

  test('compare with a bootstrap gives each method a range; the spread rule is shared', () => {
    const methods = SUM.compareMethods(CHECKOUT, CHECKOUT_CONTRACT, { bootstrap: 200, seed: 1 });
    const sum3 = methods.find((m) => m.preset === 'sum3');
    assert.ok(sum3.products[0].ci[0] < sum3.products[0].pct);
    assert.ok(Array.isArray(sum3.warnings));
    assert.equal(SUM.dependsOnMethod([[0.5, 0.7], [0.55, 0.72]]), false);
    assert.equal(SUM.dependsOnMethod([[0.5], [0.62]]), true);
  });

  test('a method that cannot run says what it lacks, with a code reports can translate', () => {
    const methods = SUM.compareMethods(CHECKOUT, { version: 1, defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 5, time_target_s: 60 } });
    const autodesk = methods.find((m) => m.preset === 'autodesk');
    assert.equal(autodesk.code, 'needs');
    assert.match(autodesk.reason, /^needs an empirical time target/);
    assert.equal(autodesk.missing[0].code, 'empirical-time-impossible');
    assert.equal(methods.find((m) => m.preset === 'pearson').code, 'no-benchmark');
  });

  test('auto run shows sensitivity across applicable presets and flags method dependence', () => {
    const r = SUM.runSum(CHECKOUT, { ...CHECKOUT_CONTRACT }, { method: 'auto', bootstrap: 0 });
    assert.equal(r.method.preset, 'sum4');
    const presets = r.sensitivity.map((s) => s.preset);
    assert.ok(presets.includes('sum3') && presets.includes('measuringu'));
    assert.equal(r.methodDependent, true);
  });
});

describe('method strings', () => {
  test('presets and modifiers resolve to a readable, stable string', () => {
    assert.equal(SUM.resolveMethod('pearson').string, 'SUM3|zmean|completion=piecewise|time=target,log|failed-time=exclude|shift=0|v1');
    assert.equal(SUM.resolveMethod('measuringu').string, 'SUM3|pctmean|completion=original|time=target,raw|failed-time=exclude|shift=0|v1');
    assert.equal(SUM.resolveMethod('sum3', { weights: { completion: 0.5, time: 0.25, satisfaction: 0.25 } }).string,
      'SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|weights=c.5,t.25,s.25|v1');
  });

  test('pca-entropy and suma are refused with an explanation', () => {
    assert.throws(() => SUM.resolveMethod('pca-entropy'), /v2/);
    assert.throws(() => SUM.resolveMethod('suma'), /no validated formula/);
  });
});
