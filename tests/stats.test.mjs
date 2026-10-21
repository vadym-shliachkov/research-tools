import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../plugins/uxr/scripts/lib/stats.mjs';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test('normal cdf matches Excel NORM.S.DIST', () => {
  near(S.cdf(0), 0.5, 1e-12);
  near(S.cdf(1), 0.841344746, 1e-9);
  near(S.cdf(-0.75), 0.226627352, 1e-9);
  near(S.cdf(1.96), 0.9750021048517795, 1e-12);
  near(S.cdf(-8), 6.22096e-16, 1e-18);
});

test('inverse normal matches Excel NORM.S.INV and round-trips', () => {
  near(S.inv(0.8), 0.841621234, 1e-9);
  near(S.inv(0.92), 1.405071560, 1e-9);
  near(S.inv(0.875), 1.150349380, 1e-9);
  near(S.inv(0.975), 1.959963985, 1e-9);
  for (const p of [1e-10, 0.001, 0.3, 0.5, 0.77, 0.999999]) near(S.cdf(S.inv(p)), p, p * 1e-9 + 1e-15);
  assert.equal(S.inv(0), -Infinity);
  assert.equal(S.inv(1), Infinity);
});

test('mean, sample SD, Excel-style percentile', () => {
  near(S.mean([5, 4, 4, 4, 3, 4, 5, 3, 2, 3]), 3.7);
  near(S.sd([5, 4, 4, 4, 3, 4, 5, 3, 2, 3]), 0.948683, 1e-6);
  near(S.quantile([80, 85, 90, 95, 100, 110, 120], 0.8), 108);
  near(S.quantile([1, 2, 3, 4], 0.5), 2.5);
});

test('Student t critical values', () => {
  near(S.tInv(0.975, 9), 2.262157163, 1e-6);
  near(S.tInv(0.975, 1), 12.70620474, 1e-5);
  near(S.tInv(0.975, 1000), 1.962339, 1e-5);
});

test('adjusted Wald interval for 8/10', () => {
  const [lo, hi] = S.adjustedWald(8, 10);
  near(lo, 0.4794, 5e-4);
  near(hi, 0.9541, 5e-4);
  const [lo1, hi1] = S.adjustedWald(5, 5);
  assert.ok(lo1 > 0.5 && hi1 === 1);
});

test('t interval for a mean', () => {
  const [lo, hi] = S.tInterval([5, 4, 4, 4, 3, 4, 5, 3, 2, 3]);
  near(lo, 3.7 - 2.262157 * 0.948683 / Math.sqrt(10), 1e-5);
  near(hi, 3.7 + 2.262157 * 0.948683 / Math.sqrt(10), 1e-5);
});

test('Cronbach alpha', () => {
  near(S.cronbachAlpha([[1, 2], [2, 3], [3, 3], [4, 5]]), 0.96, 1e-9);
});

test('seeded random numbers are reproducible', () => {
  const a = S.rng(42);
  const b = S.rng(42);
  const xs = Array.from({ length: 5 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});
