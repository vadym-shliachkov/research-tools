// Single Usability Metric: every documented variant behind one resolved method config, plus the autopilot that
// chooses the config from the data and the contract. Pure functions; sum.mjs is the CLI around them.
import { cdf, inv, mean, sd, quantile, adjustedWald, tInterval, cronbachAlpha, rng } from '../../../scripts/lib/stats.mjs';

export const VERSION = 'v1';
const NUMERIC = ['success', 'time_s', 'errors', 'error_opportunities', 'satisfaction', 'seq', 'ease', 'perceived_time'];
const LETTER = { completion: 'c', errors: 'e', time: 't', satisfaction: 's' };
const MS_DEFAULT_THRESHOLDS = { perceived_time: 3, ease: 4, satisfaction: 4 };

const BASE = {
  components: ['completion', 'time', 'satisfaction'], agg: 'z-mean', completion: 'original', smoothing: 'none',
  timeTarget: 'target', timeLog: true, failedTime: 'exclude', shift: 0, weights: null,
};
export const PRESETS = {
  sum4: { ...BASE, components: ['completion', 'errors', 'time', 'satisfaction'] },
  sum3: { ...BASE },
  measuringu: { ...BASE, agg: 'pct-mean', timeLog: false },
  autodesk: { ...BASE, timeTarget: 'empirical', timeLog: false },
  pearson: { ...BASE, completion: 'piecewise' },
  microsoft: { kind: 'usability-score' },
};
const ALLOWED = {
  agg: ['z-mean', 'pct-mean'], completion: ['original', 'piecewise', 'bernoulli'], smoothing: ['none', 'laplace'],
  timeTarget: ['target', 'empirical'], failedTime: ['exclude', 'cutoff'],
};

const short = (x) => String(Math.round(x * 1000) / 1000).replace(/^0\./, '.');

function methodString(c) {
  if (c.kind === 'usability-score') return `USABILITY-SCORE|success∧perceived-time∧ease∧satisfaction|${VERSION}`;
  const std = c.components.length === 4 ? 'SUM4' : c.components.join() === 'completion,time,satisfaction' ? 'SUM3' : `SUM[${c.components.map((k) => LETTER[k]).join(',')}]`;
  const parts = [std, c.agg.replace('-', ''), `completion=${c.completion}`];
  if (c.components.includes('time')) parts.push(`time=${c.timeTarget},${c.timeLog ? 'log' : 'raw'}`, `failed-time=${c.failedTime}`);
  parts.push(`shift=${c.shift}`);
  if (c.smoothing !== 'none') parts.push(`smoothing=${c.smoothing}`);
  if (c.weights) parts.push(`weights=${c.components.map((k) => `${LETTER[k]}${short(c.weights[k] ?? 0)}`).join(',')}`);
  parts.push(VERSION);
  return parts.join('|');
}

function parseWeights(w) {
  if (!w || typeof w === 'object') return w ?? null;
  const byLetter = Object.fromEntries(Object.entries(LETTER).map(([k, l]) => [l, k]));
  return Object.fromEntries(String(w).split(',').map((p) => {
    const [k, v] = p.split('=').map((s) => s.trim());
    return [byLetter[k] ?? k, Number(v)];
  }));
}

export function resolveMethod(preset = 'sum3', modifiers = {}) {
  if (preset === 'pca-entropy') throw new Error('pca-entropy is planned for v2. Its weights are learned from each dataset, so scores are relative to that dataset.');
  if (preset === 'suma') throw new Error('suma has no validated formula yet (Nasr & Zahabi, 2024). Report accessibility as a separate gate instead.');
  if (!PRESETS[preset]) throw new Error(`Unknown method "${preset}". Use auto or one of: ${Object.keys(PRESETS).join(', ')}`);
  const config = structuredClone(PRESETS[preset]);
  if (config.kind) return { preset, config, string: methodString(config) };
  const m = { ...modifiers };
  if (typeof m.components === 'string') {
    const byLetter = Object.fromEntries(Object.entries(LETTER).map(([k, l]) => [l, k]));
    m.components = m.components.split(',').map((s) => byLetter[s.trim()] ?? s.trim());
  }
  if (m.weights) m.weights = parseWeights(m.weights);
  if (m.shift !== undefined) m.shift = Number(m.shift);
  if (typeof m.timeLog === 'string') m.timeLog = m.timeLog !== 'false' && m.timeLog !== 'raw';
  for (const [k, v] of Object.entries(m)) {
    if (v === undefined) continue;
    if (ALLOWED[k] && !ALLOWED[k].includes(v)) throw new Error(`${k} must be one of ${ALLOWED[k].join(', ')} (got "${v}")`);
    config[k] = v;
  }
  if (!config.components.every((c) => LETTER[c])) throw new Error(`components must be from ${Object.keys(LETTER).join(', ')}`);
  return { preset, config, string: methodString(config) };
}

// Proportions in the contract are written as 0.78, not 78: a percentage typed as a whole number would silently
// rescale the score.
const PROPORTIONS = ['completion_benchmark', 'gate_threshold'];
export function contractErrors(contract) {
  const errors = [];
  const scopes = [['defaults', contract.defaults ?? {}], ...Object.entries(contract.tasks ?? {}).map(([t, tc]) => [`tasks.${t}`, tc ?? {}])];
  for (const [where, tc] of scopes) {
    for (const key of PROPORTIONS) {
      const v = tc[key];
      if (v !== undefined && !(typeof v === 'number' && v > 0 && v < 1)) errors.push(`${where}.${key} must be a proportion between 0 and 1 (78% is 0.78); got ${JSON.stringify(v)}.`);
    }
  }
  return errors;
}

// The spread rule behind "the verdict depends on the method": applicable methods differ by more than 10 points
// for some group. lists: one array of group percentages per method.
export function dependsOnMethod(lists) {
  const groups = Math.max(0, ...lists.map((l) => l.length));
  return Array.from({ length: groups }, (_, gi) => lists.map((l) => l[gi]).filter(Number.isFinite))
    .some((p) => p.length > 1 && Math.max(...p) - Math.min(...p) > 0.10);
}

// ---------- components ----------

export function piecewise(p, b) {
  return p < b ? p * 0.5 / b : 1 - (1 - p) * 0.5 / (1 - b);
}

export function completionComponent({ x, n }, { mode = 'original', benchmark, smoothing = 'none' } = {}) {
  const p = x / n;
  const pUse = smoothing === 'laplace' ? (x + 0.5) / (n + 1) : p;
  let score;
  let z;
  if (mode === 'original') { score = pUse; z = inv(pUse); }
  else if (mode === 'piecewise') { score = piecewise(pUse, benchmark); z = inv(score); }
  else { z = (pUse - benchmark) / (pUse * (1 - pUse)); score = cdf(z); }
  // Only a benchmark gives completion a target; in the original, 50% is the midpoint of Φ⁻¹, not a goal.
  return { x, n, p, ...(smoothing === 'laplace' ? { smoothed: pUse } : {}), score, z, pct: score, targetPct: mode === 'original' ? null : 0.5, ci: adjustedWald(x, n) };
}

export function aggregate(parts, { agg = 'z-mean', shift = 0 } = {}) {
  const w = parts.map((p) => p.weight ?? 1);
  const W = w.reduce((a, b) => a + b, 0);
  if (agg === 'z-mean') {
    if (parts.some((p) => !Number.isFinite(p.z))) return { z: NaN, pct: NaN };
    const z = parts.reduce((s, p, i) => s + w[i] * p.z, 0) / W;
    return { z, pct: cdf(z + shift) };
  }
  const pct = parts.reduce((s, p, i) => s + w[i] * (shift ? cdf(p.z + shift) : p.pct), 0) / W;
  return { z: inv(pct), pct };
}

// z of an observed mean against a target; zero spread is only defined when the mean sits on the target.
function zAgainst(observed, target, spread, higherIsBetter = true) {
  if (!(spread > 0)) return observed === target ? 0 : NaN;
  return (higherIsBetter ? observed - target : target - observed) / spread;
}

// ---------- data ----------

export function toRecords({ header, rows }) {
  return rows.map((r) => {
    const o = {};
    header.forEach((h, i) => {
      const v = String(r[i] ?? '').trim();
      o[h] = NUMERIC.includes(h) || /^sat_\d+$/.test(h) ? (v === '' ? null : Number(v)) : v === '' ? null : v;
    });
    return o;
  });
}

const taskContract = (contract, task) => ({ ...(contract.defaults ?? {}), ...(contract.tasks?.[task] ?? {}), scales: { ...(contract.defaults?.scales ?? {}), ...(contract.tasks?.[task]?.scales ?? {}) } });
const unique = (xs) => [...new Set(xs)];

function satisfactionSource(tc, header) {
  const from = tc.satisfaction_from;
  if (!from) return { error: 'The contract does not say which rating is satisfaction (satisfaction_from).' };
  const cols = Array.isArray(from) ? from : [from];
  const missing = cols.filter((c) => !header.includes(c));
  if (missing.length) return { error: `satisfaction_from names column(s) that are not in the data: ${missing.join(', ')}` };
  const scales = cols.map((c) => tc.scales?.[c]);
  if (scales.some((s) => !s)) return { error: `Scale range missing in the contract for: ${cols.filter((c, i) => !scales[i]).join(', ')}` };
  if (unique(scales.map((s) => s.join('-'))).length > 1) return { error: `Satisfaction items are on different scales (${cols.map((c, i) => `${c} ${scales[i].join('–')}`).join(', ')}); they cannot be averaged into one composite.` };
  return { cols, scale: scales[0] };
}

const satValue = (row, cols) => (cols.every((c) => row[c] !== null && row[c] !== undefined) ? mean(cols.map((c) => row[c])) : null);

// ---------- one task ----------

function timeTarget(rows, tc, config, src, fixed) {
  if (fixed !== undefined) return fixed;
  // A target carried from an earlier wave is frozen, including an empirical one, so the waves stay comparable.
  if (tc.time_target_from_previous_s) return { value: tc.time_target_from_previous_s, source: 'previous wave' };
  if (config.timeTarget === 'target') {
    if (tc.time_target_s) return { value: tc.time_target_s, source: 'contract target' };
    if (tc.expert_time_s) {
      const k = tc.expert_multiplier ?? 3;
      return { value: tc.expert_time_s * k, source: `expert time ${tc.expert_time_s} s × ${k}` };
    }
    return { needs: { code: 'time-target', text: 'a time target (time_target_s, or expert_time_s with expert_multiplier)' } };
  }
  if (tc.sat_target === undefined || !src.cols) return { needs: { code: 'empirical-needs-sat-target', text: 'a satisfaction target, to find satisfied users for the empirical time target' } };
  const satisfied = rows.filter((r) => r.success === 1 && r.time_s !== null && (satValue(r, src.cols) ?? -Infinity) >= tc.sat_target).map((r) => r.time_s);
  if (satisfied.length >= 4) return { value: quantile(satisfied, 0.8), source: `empirical: 80th percentile of ${satisfied.length} satisfied successful users` };
  if (tc.cutoff_s) return { value: 0.75 * tc.cutoff_s, source: `empirical fallback: 75% of the ${tc.cutoff_s} s cutoff (${satisfied.length} satisfied successful users)` };
  return { needs: { code: 'empirical-time-impossible', params: { n: satisfied.length }, text: `an empirical time target, which needs 4 satisfied successful users or a cutoff_s (found ${satisfied.length} and no cutoff)` } };
}

export function computeTask(rows, tc, config, header, fixed = {}) {
  const qa = { errors: [], warnings: [], needs: [] };
  const components = {};
  const attempts = rows.filter((r) => r.success !== null && r.success !== undefined);
  const n = attempts.length;
  if (n < 8) qa.warnings.push({ code: 'small-n', params: { n }, message: `Only ${n} attempt(s); every component has a wide uncertainty range.` });

  if (config.kind === 'usability-score') return microsoftTask(rows, tc, header, qa);

  const src = config.components.includes('satisfaction') || config.timeTarget === 'empirical' ? satisfactionSource(tc, header) : {};
  if (src.error) { qa.errors.push({ code: 'satisfaction-source', message: src.error }); return { components, sum: null, qa }; }

  for (const comp of config.components) {
    if (comp === 'completion') {
      if (!n) { qa.errors.push({ code: 'no-completion-data', message: 'No success values for this task.' }); continue; }
      if (config.completion !== 'original' && tc.completion_benchmark === undefined) { qa.needs.push({ code: 'completion-benchmark', params: { mode: config.completion }, text: `a completion benchmark (completion_benchmark) for the ${config.completion} correction` }); continue; }
      const x = attempts.filter((r) => r.success === 1).length;
      let c = completionComponent({ x, n }, { mode: config.completion, benchmark: tc.completion_benchmark, smoothing: config.smoothing });
      if (!Number.isFinite(c.z) && fixed.rescueExtremes) {
        c = completionComponent({ x, n }, { mode: config.completion, benchmark: tc.completion_benchmark, smoothing: 'laplace' });
        fixed.smoothed = true;
      }
      if (config.completion !== 'original') c.benchmark = tc.completion_benchmark;
      if (!Number.isFinite(c.z) && config.agg === 'z-mean') {
        qa.errors.push({ code: 'completion-extreme', params: { pct: Math.round(c.p * 100), x, n }, message: `Completion is ${Math.round(c.p * 100)}% (${x}/${n}); its z-score is infinite. Choose smoothing (laplace) or percentage averaging.` });
      }
      components.completion = c;
    }
    if (comp === 'errors') {
      const withErr = attempts.filter((r) => r.errors !== null && r.error_opportunities !== null && r.errors !== undefined);
      const E = withErr.reduce((s, r) => s + r.errors, 0);
      const N = withErr.reduce((s, r) => s + r.error_opportunities, 0);
      if (!N) { qa.errors.push({ code: 'no-error-data', message: 'No error opportunities recorded for this task.' }); continue; }
      if (!tc.error_opportunities_predefined) qa.warnings.push({ code: 'errors-not-predefined', message: 'Error opportunities were not confirmed as defined before the study; the errors component may be unreliable.' });
      const q = 1 - E / N;
      let qUse = config.smoothing === 'laplace' ? (N - E + 0.5) / (N + 1) : q;
      if (!Number.isFinite(inv(qUse)) && fixed.rescueExtremes) { qUse = (N - E + 0.5) / (N + 1); fixed.smoothed = true; }
      const z = inv(qUse);
      if (!Number.isFinite(z) && config.agg === 'z-mean') qa.errors.push({ code: 'errors-extreme', params: { pct: Math.round(q * 100) }, message: `Error-free rate is ${Math.round(q * 100)}%; its z-score is infinite. Choose smoothing (laplace) or percentage averaging.` });
      components.errors = { errors: E, opportunities: N, rate: E / N, quality: q, ...(qUse !== q ? { smoothed: qUse } : {}), z, pct: qUse, targetPct: null };
    }
    if (comp === 'time') {
      const target = timeTarget(rows, tc, config, src, fixed.time);
      if (target.needs) { qa.needs.push(target.needs); continue; }
      let times = attempts.filter((r) => r.success === 1 && r.time_s !== null).map((r) => r.time_s);
      const failed = attempts.filter((r) => r.success === 0).length;
      if (config.failedTime === 'cutoff') {
        if (!tc.cutoff_s) { qa.needs.push({ code: 'cutoff', text: 'a task cutoff (cutoff_s) to count failed attempts at the cutoff time' }); continue; }
        times = [...times, ...Array(failed).fill(tc.cutoff_s)];
      } else if (failed) qa.warnings.push({ code: 'failed-time-excluded', params: { failed }, message: `${failed} failed attempt(s) are left out of time; time describes successful users only.` });
      if (times.length < 2) { qa.errors.push({ code: 'too-few-times', message: 'Fewer than two task times.' }); continue; }
      const tr = config.timeLog ? times.map(Math.log) : times;
      const m = mean(tr);
      const s = sd(tr);
      const tgt = config.timeLog ? Math.log(target.value) : target.value;
      const z = zAgainst(m, tgt, s, false);
      if (Number.isNaN(z)) qa.errors.push({ code: 'zero-variance', message: 'All task times are identical and differ from the target; the time z-score is undefined.' });
      const ci = s > 0 ? tInterval(tr) : [m, m];
      components.time = {
        n: times.length, target: target.value, targetSource: target.source, log: config.timeLog,
        mean: mean(times), median: quantile(times, 0.5), geoMean: Math.exp(mean(times.map(Math.log))),
        ci: config.timeLog ? ci.map(Math.exp) : ci, z, pct: cdf(z), targetPct: 0.5,
      };
    }
    if (comp === 'satisfaction') {
      if (tc.sat_target === undefined) { qa.needs.push({ code: 'sat-target', text: 'a satisfaction target (sat_target)' }); continue; }
      const vals = rows.map((r) => satValue(r, src.cols)).filter((v) => v !== null);
      if (vals.length < 2) { qa.errors.push({ code: 'too-few-ratings', message: 'Fewer than two satisfaction ratings.' }); continue; }
      const m = mean(vals);
      const s = sd(vals);
      const z = zAgainst(m, tc.sat_target, s);
      if (Number.isNaN(z)) qa.errors.push({ code: 'zero-variance', message: `Every satisfaction rating is ${m}, not the target ${tc.sat_target}; the z-score is undefined.` });
      const out = { n: vals.length, from: src.cols, scale: src.scale, target: tc.sat_target, mean: m, sd: s, ci: s > 0 ? tInterval(vals) : [m, m], z, pct: cdf(z), targetPct: 0.5 };
      if (src.cols.length > 1) {
        const items = rows.filter((r) => src.cols.every((c) => r[c] !== null)).map((r) => src.cols.map((c) => r[c]));
        if (items.length >= 3) out.alpha = cronbachAlpha(items);
      }
      components.satisfaction = out;
    }
  }

  if (qa.errors.length || qa.needs.length) return { components, sum: null, qa };
  if (config.shift) qa.warnings.push({ code: 'sigma-shift', params: { shift: config.shift }, message: `A ${config.shift} sigma shift is applied; scores are not comparable with unshifted SUM.` });
  if (config.smoothing === 'laplace') qa.warnings.push({ code: 'smoothing', message: 'Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.' });
  const parts = config.components.map((k) => ({ ...components[k], weight: config.weights ? config.weights[k] ?? 0 : 1 }));
  return { components, sum: { ...aggregate(parts, config), targetPct: 0.5 }, qa };
}

function microsoftTask(rows, tc, header, qa) {
  const need = ['success', 'perceived_time', 'ease', 'satisfaction'];
  const missing = need.filter((c) => !header.includes(c));
  if (missing.length) { qa.errors.push({ code: 'missing-columns', message: `The Usability Score needs ${missing.join(', ')}.` }); return { components: {}, sum: null, qa }; }
  let th = tc.thresholds;
  if (!th) {
    const fivePoint = ['perceived_time', 'ease', 'satisfaction'].every((c) => tc.scales?.[c]?.join('-') === '1-5');
    if (!fivePoint) { qa.needs.push({ code: 'thresholds', text: 'thresholds for perceived_time, ease and satisfaction (the defaults 3/4/4 assume 5-point scales)' }); return { components: {}, sum: null, qa }; }
    th = MS_DEFAULT_THRESHOLDS;
  }
  const complete = rows.filter((r) => need.every((c) => r[c] !== null));
  if (complete.length < rows.length) qa.warnings.push({ code: 'incomplete-rows', params: { n: rows.length - complete.length }, message: `${rows.length - complete.length} row(s) lack one of the four answers and are left out.` });
  const n = complete.length;
  if (!n) { qa.errors.push({ code: 'no-data', message: 'No complete rows.' }); return { components: {}, sum: null, qa }; }
  // Each pass rate has no target of its own. The score's target is the pass rate the team agreed (gate_threshold);
  // without one there is no target, and 50% is not one.
  const share = (pred) => {
    const x = complete.filter(pred).length;
    return { x, n, pct: x / n, z: inv(x / n), ci: adjustedWald(x, n), targetPct: null };
  };
  const components = {
    completion: share((r) => r.success === 1),
    perceived_time: { ...share((r) => r.perceived_time >= th.perceived_time), threshold: th.perceived_time },
    ease: { ...share((r) => r.ease >= th.ease), threshold: th.ease },
    satisfaction: { ...share((r) => r.satisfaction >= th.satisfaction), threshold: th.satisfaction },
  };
  const passed = (r) => r.success === 1 && r.perceived_time >= th.perceived_time && r.ease >= th.ease && r.satisfaction >= th.satisfaction;
  const all = share(passed);
  // Who passed, per person, so the study-level score can count people who passed every task they tried.
  const passes = complete.map((r) => ({ pid: r.participant_id, pass: passed(r) }));
  return { components, sum: { pct: all.pct, z: all.z, x: all.x, n, ci: all.ci, targetPct: tc.gate_threshold ?? null }, passes, qa };
}

// ---------- whole study ----------

function productOf(tasks, config) {
  const ok = tasks.filter((t) => t.sum);
  if (!ok.length) return null;
  // The study-level Usability Score counts people: the share who passed every check in every task they tried. That
  // is what a pass mark ("at least 80% of people must pass") is about; a mean of task pass rates is not a share of
  // anyone.
  if (config.kind === 'usability-score') {
    const targets = unique(ok.map((t) => t.sum.targetPct));
    const byPerson = new Map();
    for (const t of ok) for (const p of t.passes ?? []) byPerson.set(p.pid, (byPerson.get(p.pid) ?? true) && p.pass);
    const n = byPerson.size;
    const x = [...byPerson.values()].filter(Boolean).length;
    return { pct: x / n, z: inv(x / n), x, n, unit: 'person', ci: adjustedWald(x, n), targetPct: targets.length === 1 ? targets[0] : null };
  }
  if (config.agg === 'pct-mean') {
    const pct = mean(ok.map((t) => t.sum.pct));
    return { pct, z: inv(pct), targetPct: 0.5 };
  }
  const z = mean(ok.map((t) => t.sum.z));
  return { z, pct: cdf(z + (config.shift ?? 0)), targetPct: 0.5 };
}

function scoreGroup(records, contract, config, header, fixed = {}) {
  const tasks = unique(records.map((r) => r.task_id)).map((task) => {
    const tc = taskContract(contract, task);
    const t = computeTask(records.filter((r) => r.task_id === task), tc, config, header, fixed[task] ?? {});
    return { task, ...t };
  });
  return { tasks, product: productOf(tasks, config) };
}

// A person drawn twice counts as two people, so per-person scores see the resample's size.
const drawPerson = (byPerson, p, i) => (byPerson.get(p) ?? []).map((r) => ({ ...r, participant_id: `${r.participant_id}#${i}` }));
const rowsByPerson = (records) => {
  const m = new Map();
  for (const r of records) m.set(r.participant_id, [...(m.get(r.participant_id) ?? []), r]);
  return m;
};
const rescue = (fixed) => Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, { ...v, rescueExtremes: true }]));

function bootstrapGroup(records, contract, config, header, fixed, B, seed) {
  const rand = rng(seed);
  const people = unique(records.map((r) => r.participant_id));
  const byPerson = new Map(people.map((p) => [p, records.filter((r) => r.participant_id === p)]));
  const taskDraws = new Map();
  const productDraws = [];
  let skipped = 0;
  let smoothedSamples = 0;
  for (let b = 0; b < B; b++) {
    const sample = [];
    for (let i = 0; i < people.length; i++) sample.push(...drawPerson(byPerson, people[Math.floor(rand() * people.length)], i));
    // A resample that hits 0% or 100% gets Laplace smoothing rather than being dropped: dropping it would cut off
    // exactly the best (or worst) samples and bias the interval.
    const perTask = rescue(fixed);
    const g = scoreGroup(sample, contract, config, header, perTask);
    if (Object.values(perTask).some((v) => v.smoothed)) smoothedSamples++;
    if (!g.product || !Number.isFinite(g.product.pct)) { skipped++; continue; }
    productDraws.push(g.product.pct);
    for (const t of g.tasks) if (t.sum && Number.isFinite(t.sum.pct)) taskDraws.set(t.task, [...(taskDraws.get(t.task) ?? []), t.sum.pct]);
  }
  const ci = (xs) => (xs && xs.length >= 20 ? [quantile(xs, 0.025), quantile(xs, 0.975)] : null);
  return { product: ci(productDraws), productDraws, tasks: Object.fromEntries([...taskDraws].map(([k, v]) => [k, ci(v)])), skipped, smoothedSamples, B };
}

// Range of a difference between two groups. Their bootstrap samples are independent, so pairing draw i with draw i
// gives draws of the difference.
function differenceCi(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 20) return null;
  const d = Array.from({ length: n }, (_, i) => a[i] - b[i]);
  return [quantile(d, 0.025), quantile(d, 0.975)];
}

// Range of a difference when people took part in both groups (within-subject): resample people once and keep each
// person's rows in both groups together, so the difference reflects within-person change.
function pairedDifferenceCi(a, b, contract, config, header, B, seed) {
  const rand = rng(seed);
  const people = unique([...a.records, ...b.records].map((r) => r.participant_id));
  const rowsA = rowsByPerson(a.records);
  const rowsB = rowsByPerson(b.records);
  const d = [];
  for (let k = 0; k < B; k++) {
    const sa = [];
    const sb = [];
    for (let i = 0; i < people.length; i++) {
      const p = people[Math.floor(rand() * people.length)];
      sa.push(...drawPerson(rowsA, p, i));
      sb.push(...drawPerson(rowsB, p, i));
    }
    const ga = scoreGroup(sa, contract, config, header, rescue(a.fixed));
    const gb = scoreGroup(sb, contract, config, header, rescue(b.fixed));
    if (Number.isFinite(ga.product?.pct) && Number.isFinite(gb.product?.pct)) d.push(gb.product.pct - ga.product.pct);
  }
  return d.length >= 20 ? [quantile(d, 0.025), quantile(d, 0.975)] : null;
}

export function runSum(table, contract, opts = {}) {
  const { method = 'auto', modifiers = {}, bootstrap = 2000, seed = 20261021, sensitivity = method === 'auto' } = opts;
  let resolved;
  let choice = null;
  const invalid = contractErrors(contract);
  if (invalid.length) return { status: 'error', message: invalid.join(' ') };
  if (method === 'auto') {
    choice = choose(table, contract, modifiers);
    if (choice.status !== 'ok') return { status: choice.status, question: choice.question, options: choice.options, message: choice.message, choice };
    try { resolved = Object.keys(modifiers).length ? resolveMethod(choice.preset, { ...choice.config, ...modifiers }) : { preset: choice.preset, config: choice.config, string: methodString(choice.config) }; }
    catch (e) { return { status: 'error', message: e.message }; }
  } else {
    try { resolved = resolveMethod(method, modifiers); } catch (e) { return { status: 'error', message: e.message }; }
  }
  const config = resolved.config;
  const records = toRecords(table);
  const groupNames = table.header.includes('group') ? unique(records.map((r) => r.group)) : [null];

  const qa = { errors: [], warnings: [] };
  const needs = new Map();
  const groups = groupNames.map((group) => {
    const recs = group === null ? records : records.filter((r) => r.group === group);
    const g = scoreGroup(recs, contract, config, table.header);
    for (const t of g.tasks) {
      // group and task stay separate from the English "where", so reports can name them in their own language.
      const at = { where: `${group ? `group ${group}, ` : ''}task ${t.task}`, group, task: t.task };
      for (const e of t.qa.errors) qa.errors.push({ ...e, ...at });
      for (const w of t.qa.warnings) qa.warnings.push({ ...w, ...at });
      for (const nd of t.qa.needs) {
        const text = groupNames.length > 1 ? `${nd.text} (group ${group})` : nd.text;
        needs.set(text, { ...nd, text, group });
      }
      delete t.passes;
    }
    return { group, ...g, records: recs };
  });
  for (const g of groups) {
    g.fixed = Object.fromEntries(g.tasks.map((t) => [t.task, t.components.time ? { time: { value: t.components.time.target, source: t.components.time.targetSource } } : {}]));
  }

  const status = needs.size ? 'needs-input' : qa.errors.length ? 'error' : 'ok';
  if (status === 'ok' && config.kind === 'usability-score') {
    const d = contract.defaults ?? {};
    const timeTargets = d.time_target_s !== undefined || d.expert_time_s !== undefined;
    const satTarget = d.sat_target !== undefined;
    const unused = [timeTargets ? 'time targets' : null, satTarget ? 'the satisfaction target' : null].filter(Boolean);
    qa.warnings.push({
      code: 'gate-ignores-time', params: { timeTargets, satTarget }, where: 'all tasks',
      message: `The Usability Score counts who finished and rated perceived time, ease and satisfaction at or above their thresholds. Measured time on task does not enter it${unused.length ? `, and neither do ${unused.join(' and ')} (they are used only in the comparison with other methods)` : ''}.`,
    });
  }
  const draws = [];
  if (status === 'ok' && bootstrap > 0) {
    groups.forEach((g, gi) => {
      const bs = bootstrapGroup(g.records, contract, config, table.header, g.fixed, bootstrap, seed + gi);
      // The Usability Score's study-level share already has its exact binomial range.
      g.product.ci = g.product.ci ?? bs.product;
      draws[gi] = bs.productDraws;
      for (const t of g.tasks) t.sum.ci = t.sum.ci ?? bs.tasks[t.task] ?? null;
      g.bootstrap = { B: bs.B, skipped: bs.skipped, smoothedSamples: bs.smoothedSamples, seed: seed + gi, unit: 'participant' };
      if (bs.skipped / bs.B > 0.05) qa.warnings.push({ code: 'bootstrap-skips', params: { skipped: bs.skipped, B: bs.B }, message: `${bs.skipped} of ${bs.B} bootstrap samples gave an undefined score; the interval is approximate.`, where: g.group ? `group ${g.group}` : 'all tasks', group: g.group });
    });
  }
  // Every group against the first one, so a comparison of designs reports the difference and how sure it is. Who took
  // part decides the range: different people per group (independent), the same people in both (paired), or a mix.
  const comparison = status === 'ok' && groups.length > 1
    ? groups.slice(1).map((g, i) => {
      const a = groups[0];
      const idsA = new Set(a.records.map((r) => r.participant_id));
      const idsB = new Set(g.records.map((r) => r.participant_id));
      const shared = [...idsB].filter((p) => idsA.has(p)).length;
      const design = shared === 0 ? 'independent' : shared === idsA.size && shared === idsB.size ? 'paired' : 'mixed';
      if (design === 'mixed') qa.warnings.push({ code: 'mixed-design', params: { shared, group: g.group, vs: a.group }, where: `group ${g.group}`, group: g.group, message: `${shared} people took part in both ${a.group} and ${g.group}, others in only one. The difference keeps each person's results together; confirm that is how the study was run.` });
      const ci = bootstrap > 0
        ? design === 'independent' ? differenceCi(draws[i + 1], draws[0]) : pairedDifferenceCi(a, g, contract, config, table.header, bootstrap, seed + 100 + i)
        : null;
      return { group: g.group, vs: a.group, diff: g.product.pct - a.product.pct, ci, design, shared };
    })
    : null;
  for (const g of groups) { delete g.records; delete g.fixed; }
  const prevDiff = contract.previous?.differences ?? [];
  if (prevDiff.length) qa.warnings.push({ code: 'previous-differs', params: { list: prevDiff.join('; ') }, message: `The contract differs from the previous wave (${prevDiff.join('; ')}), so the waves are not directly comparable.`, where: 'contract' });

  const missing = [...needs.values()];
  const result = {
    status, version: VERSION,
    method: { preset: resolved.preset, string: resolved.string, config },
    ...(choice ? { choice: { reasons: choice.reasons, suggestions: choice.suggestions } } : {}),
    groups, ...(comparison ? { comparison } : {}), qa,
    ...(missing.length ? { missing, question: `The contract is missing: ${missing.map((m) => m.text).join('; ')}.`, message: `Missing: ${missing.map((m) => m.text).join('; ')}` } : {}),
  };

  if (status === 'ok' && sensitivity) {
    result.sensitivity = compareMethods(table, contract, { exclude: resolved.preset, smoothing: config.smoothing });
    const ok = result.sensitivity.filter((s) => s.status === 'ok');
    result.methodDependent = dependsOnMethod([groups.map((g) => g.product.pct), ...ok.map((s) => s.products.map((p) => p.pct))]);
  }
  return result;
}

// bootstrap > 0 adds each method's range and quality warnings, for the side-by-side comparison the user reads.
export function compareMethods(table, contract, { exclude = null, smoothing = 'none', bootstrap = 0, seed } = {}) {
  const out = [];
  for (const preset of Object.keys(PRESETS)) {
    if (preset === exclude) continue;
    const header = table.header;
    // code (and missing or params) let a report give the reason in its own language; reason is the English text.
    let why = null;
    if (preset === 'sum4' && !(header.includes('errors') && header.includes('error_opportunities'))) why = { code: 'no-error-data', reason: 'no error data' };
    else if (preset === 'sum4' && !contract.defaults?.error_opportunities_predefined) why = { code: 'errors-not-predefined', reason: 'error opportunities were not defined before the study' };
    else if (preset === 'pearson' && contract.defaults?.completion_benchmark === undefined) why = { code: 'no-benchmark', reason: 'no completion benchmark' };
    if (why) { out.push({ preset, status: 'not-applicable', ...why }); continue; }
    const r = runSum(table, contract, { method: preset, modifiers: preset === 'microsoft' || smoothing === 'none' ? {} : { smoothing }, bootstrap, ...(seed !== undefined ? { seed } : {}), sensitivity: false });
    out.push(r.status === 'ok'
      ? {
        preset, string: r.method.string, status: 'ok',
        products: r.groups.map((g) => ({ group: g.group, pct: g.product.pct, ...(bootstrap ? { ci: g.product.ci ?? null } : {}) })),
        ...(bootstrap ? { warnings: r.qa.warnings.map((w) => `${w.where}: ${w.message}`) } : {}),
      }
      : r.missing
        ? { preset, status: 'not-applicable', code: 'needs', missing: r.missing, reason: `needs ${r.missing.map((m) => m.text).join('; ')}` }
        : { preset, status: 'not-applicable', code: r.qa?.errors?.[0]?.code ?? 'error', params: r.qa?.errors?.[0]?.params, reason: r.message ?? r.qa?.errors?.[0]?.message ?? r.status });
  }
  return out;
}

// ---------- autopilot ----------

const sameConfig = (a, b) => ['components', 'agg', 'completion', 'timeTarget', 'timeLog', 'failedTime', 'shift', 'weights']
  .every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

// modifiers: the ones the user already chose (for example --smoothing laplace after the 0%/100% question).
export function choose(table, contract, modifiers = {}) {
  const header = table.header;
  const records = toRecords(table);
  const tasks = unique(records.map((r) => r.task_id));
  const d = contract.defaults ?? {};
  const reasons = [];
  const suggestions = [];
  // params: what a report needs to say the reason in another language.
  const say = (rule, decision, why, params) => reasons.push({ rule, decision, why, ...(params ? { params } : {}) });
  const invalid = contractErrors(contract);
  if (invalid.length) return { status: 'error', message: invalid.join(' '), reasons, suggestions };

  if (contract.previous?.method?.config) {
    const prev = contract.previous.method;
    const diff = contract.previous.differences ?? [];
    say('previous-run', `reuse ${prev.preset}`, `A previous wave of this study exists. Reusing its method and targets keeps the waves comparable.${diff.length ? ` But the contract differs from it (${diff.join('; ')}), so the waves are not directly comparable.` : ''}`, { preset: prev.preset, differences: diff.join('; ') });
    return { status: 'ok', preset: prev.preset, config: prev.config, string: methodString(prev.config), reasons, suggestions };
  }

  const msReady = ['success', 'perceived_time', 'ease', 'satisfaction'].every((c) => header.includes(c));
  if (msReady && !contract.goal) {
    return {
      status: 'needs-input', reasons, suggestions,
      question: 'What is the goal of this score: a pass/fail gate for decision makers, a benchmark to track over time, a comparison of designs, or finding the weakest tasks?',
      options: ['gate', 'benchmark', 'compare', 'diagnose'], flag: 'contract.goal',
    };
  }
  if (msReady && contract.goal === 'gate') {
    say('goal-gate', 'microsoft', 'The goal is a pass/fail gate and all four ratings are present; the share of users who passed everything is the clearest answer.');
    suggestions.push('Show sum3 next to it for gradation (it is in the sensitivity table).');
    if (d.gate_threshold === undefined) suggestions.push('No pass mark (gate_threshold) was agreed, so the score is reported without a target: as the share of people who passed everything, with its range.');
    const config = PRESETS.microsoft;
    return { status: 'ok', preset: 'microsoft', config, string: methodString(config), reasons, suggestions };
  }

  const errorsUsable = header.includes('errors') && header.includes('error_opportunities') && d.error_opportunities_predefined === true;
  let config = structuredClone(errorsUsable ? PRESETS.sum4 : PRESETS.sum3);
  const base = errorsUsable ? 'sum4' : 'sum3';
  const errorCase = errorsUsable ? 'usable' : header.includes('errors') ? 'not-predefined' : 'none';
  say('errors', base, errorsUsable
    ? 'Error opportunities were defined before the study, so errors can be counted reliably.'
    : header.includes('errors') ? 'Errors are present but their opportunities were not defined before the study, so errors are left out (Microsoft and Autodesk found them unreliable).' : 'No error data; the three-component SUM is used.', { case: errorCase });

  if (d.completion_benchmark !== undefined) {
    config.completion = 'piecewise';
    say('completion-benchmark', 'completion=piecewise', `A completion benchmark (${Math.round(d.completion_benchmark * 100)}%) is set; Pearson's correction makes that benchmark the neutral 50% point.`, { pct: Math.round(d.completion_benchmark * 100) });
  }

  const lacking = tasks.filter((t) => { const tc = taskContract(contract, t); return !tc.time_target_s && !tc.expert_time_s; });
  if (lacking.length && lacking.length < tasks.length) {
    return { status: 'needs-input', reasons, suggestions, question: `Tasks ${lacking.join(', ')} have no time target while others do. Give their targets, or use empirical targets for all tasks?` };
  }
  if (lacking.length) {
    const src = satisfactionSource(d, header);
    const infeasible = src.error || d.sat_target === undefined ? tasks : tasks.filter((t) => {
      const rows = records.filter((r) => r.task_id === t);
      const sat = rows.filter((r) => r.success === 1 && r.time_s !== null && (satValue(r, src.cols) ?? -Infinity) >= d.sat_target).length;
      return sat < 4 && !taskContract(contract, t).cutoff_s;
    });
    if (infeasible.length) {
      return { status: 'needs-input', reasons, suggestions, question: `No time target is set, and tasks ${infeasible.join(', ')} have too few satisfied successful users (fewer than 4) and no cutoff for an empirical target. What is an acceptable time for each?` };
    }
    config.timeTarget = 'empirical';
    config.timeLog = false;
    say('time-target', 'time=empirical', 'No time target was given; following Autodesk, the target is the 80th percentile time of satisfied successful users (75% of the cutoff when there are 3 or fewer).');
  }

  if (contract.compare_with_measuringu) {
    config.agg = 'pct-mean';
    config.timeLog = false;
    say('measuringu', 'agg=pct-mean', 'Results will be compared with MeasuringU numbers, which average component percentages.');
  }

  const extreme = tasks.filter((t) => {
    const rows = records.filter((r) => r.task_id === t && r.success !== null);
    const x = rows.filter((r) => r.success === 1).length;
    const errRows = rows.filter((r) => r.errors !== null && r.error_opportunities);
    const E = errRows.reduce((s, r) => s + (r.errors ?? 0), 0);
    return x === 0 || x === rows.length || (config.components.includes('errors') && errRows.length && E === 0);
  });
  // The fix for an infinite z-score changes the method, so the user picks it; autopilot does not.
  if (extreme.length && config.agg === 'z-mean') {
    const fix = modifiers.smoothing === 'laplace' ? 'smoothing=laplace' : modifiers.agg === 'pct-mean' ? 'agg=pct-mean' : null;
    if (!fix) {
      return {
        status: 'needs-input', reasons, suggestions,
        question: `Task(s) ${extreme.join(', ')} have 0% or 100% on a proportion, so its original z-score is infinite. Which fix should be used: Laplace smoothing ((x+0.5)/(n+1), labelled; 5 of 5 counts as about 92%), percentage averaging (MeasuringU style), or a different method?`,
        options: ['--smoothing laplace', '--agg pct-mean', '--method <preset>'], flag: 'rerun with the chosen modifier',
      };
    }
    say('extremes', fix, `Task(s) ${extreme.join(', ')} have 0% or 100% on a proportion, whose z-score is infinite. ${fix === 'smoothing=laplace' ? 'Laplace smoothing was chosen; it keeps the score finite and is labelled.' : 'Percentage averaging was chosen; it needs no z-score for proportions.'}`, { tasks: extreme.join(', ') });
  }

  if (tasks.length >= 10 && records.length >= 100 && contract.goal === 'diagnose') {
    suggestions.push('With this many tasks, pca-entropy (data-driven weights) could rank tasks against each other. It is planned for v2 and gives dataset-relative scores.');
  }
  if (contract.accessibility_data) {
    suggestions.push('Accessibility data is present: report it as a separate pass/fail gate next to SUM, not blended into it (SUMA has no validated formula yet).');
  }
  if (reasons.length === 1 && config.components.length === 3) say('default', 'sum3', 'Nothing in the data or goal calls for a variant; the three-component SUM is the most stable default.');

  const preset = ['pearson', 'autodesk', 'measuringu', base].find((p) => sameConfig(PRESETS[p], config)) ?? base;
  return { status: 'ok', preset, config, string: methodString(config), reasons, suggestions };
}
