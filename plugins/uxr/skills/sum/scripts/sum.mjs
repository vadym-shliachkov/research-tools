#!/usr/bin/env node
// Single Usability Metric CLI. Prints one JSON object: { status: "ok" | "needs-input" | "error", ... }.
// Exit code 0 = ok, 2 = needs the user's answer, 1 = error.
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.log(JSON.stringify({ status: 'error', message: `uxr needs Node.js 20 or newer (found ${process.versions.node}).` }));
  process.exit(1);
}

const fs = await import('node:fs');
const path = await import('node:path');
const { parseArgs } = await import('node:util');
const { parseCsv } = await import('../../../scripts/lib/csv.mjs');
const { validateExplainer, renderExplainerHtml } = await import('../../../scripts/lib/explainer.mjs');
const { writeDocument } = await import('../../../scripts/lib/html.mjs');
const { findBrowser } = await import('../../../scripts/lib/browser.mjs');
const SUM = await import('./sum-lib.mjs');
const REPORT = await import('./report-lib.mjs');

const USAGE = `Usage:
  sum.mjs init-contract <data.csv> [--mapping mapping.json] [--previous result.json] --out contract.json
  sum.mjs choose <data.csv> --contract contract.json [--previous result.json]
  sum.mjs run <data.csv> --contract contract.json [--method auto|sum4|sum3|measuringu|autodesk|pearson|microsoft]
              [--components c,t,s] [--agg z-mean|pct-mean] [--completion original|piecewise|bernoulli]
              [--smoothing none|laplace] [--time-target target|empirical] [--time-log log|raw]
              [--failed-time exclude|cutoff] [--weights c=.5,t=.25,s=.25] [--shift 0|1.5]
              [--bootstrap 2000] [--seed N] [--previous result.json] --out result.json
  sum.mjs compare <data.csv> --contract contract.json
  sum.mjs report <result.json> --out-dir DIR [--lang en|ua]       report.md + report.html
  sum.mjs facts <result.json> [--lang en|ua] [--out facts.json]   plain facts for the explainer draft
  sum.mjs explainer <explainer.json> --result result.json --out-dir DIR   explainer HTML + PDF (after the editor)`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    contract: { type: 'string' }, mapping: { type: 'string' }, previous: { type: 'string' }, out: { type: 'string' },
    method: { type: 'string' }, components: { type: 'string' }, agg: { type: 'string' }, completion: { type: 'string' },
    smoothing: { type: 'string' }, 'time-target': { type: 'string' }, 'time-log': { type: 'string' },
    'failed-time': { type: 'string' }, weights: { type: 'string' }, shift: { type: 'string' },
    bootstrap: { type: 'string' }, seed: { type: 'string' }, study: { type: 'string' },
    'out-dir': { type: 'string' }, lang: { type: 'string' }, result: { type: 'string' },
  },
});
const [command, dataPath] = positionals;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, obj) => { fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); };
function finish(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'ok' ? 0 : result.status === 'needs-input' ? 2 : 1);
}

// null in a contract means "not decided"; the calculator treats only defined values as decisions.
function dropNulls(v) {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  return v;
}

function loadContract() {
  if (!opt.contract) throw new Error('--contract is required');
  const contract = dropNulls(readJson(opt.contract));
  if (opt.previous) {
    const prev = readJson(opt.previous);
    contract.previous = { method: prev.method, from: opt.previous };
    contract.tasks ??= {};
    for (const g of prev.groups ?? []) {
      for (const t of g.tasks ?? []) {
        const target = t.components?.time?.target;
        if (target && !contract.tasks[t.task]?.time_target_s) contract.tasks[t.task] = { ...(contract.tasks[t.task] ?? {}), time_target_s: target };
      }
    }
  }
  return contract;
}

const modifiers = () => Object.fromEntries(Object.entries({
  components: opt.components, agg: opt.agg, completion: opt.completion, smoothing: opt.smoothing,
  timeTarget: opt['time-target'], timeLog: opt['time-log'], failedTime: opt['failed-time'], weights: opt.weights, shift: opt.shift,
}).filter(([, v]) => v !== undefined));

const pct = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : null);

function summary(r) {
  return {
    status: r.status, method: r.method?.string, preset: r.method?.preset,
    ...(r.question ? { question: r.question, options: r.options } : {}),
    ...(r.choice ? { reasons: r.choice.reasons.map((x) => `${x.decision}: ${x.why}`), suggestions: r.choice.suggestions } : {}),
    groups: r.groups?.map((g) => ({
      group: g.group,
      product: g.product && { pct: pct(g.product.pct), ci: g.product.ci?.map(pct) ?? null },
      tasks: g.tasks.map((t) => ({
        task: t.task, sum: t.sum && { pct: pct(t.sum.pct), ci: t.sum.ci?.map(pct) ?? null },
        components: Object.fromEntries(Object.entries(t.components).map(([k, c]) => [k, { pct: pct(c.pct), z: Number.isFinite(c.z) ? Math.round(c.z * 1000) / 1000 : c.z }])),
      })),
    })),
    sensitivity: r.sensitivity?.map((s) => (s.status === 'ok' ? `${s.preset}: ${s.products.map((p) => `${p.group ? `${p.group} ` : ''}${pct(p.pct)}%`).join(', ')}` : `${s.preset}: not applicable (${s.reason})`)),
    methodDependent: r.methodDependent,
    qa: r.qa && { errors: r.qa.errors.map((e) => `${e.where}: ${e.message}`), warnings: r.qa.warnings.map((w) => `${w.where}: ${w.message}`) },
  };
}

const COMMANDS = {
  'init-contract'(table) {
    const mapping = opt.mapping ? readJson(opt.mapping) : null;
    const scales = {};
    for (const [field, spec] of Object.entries(mapping?.columns ?? {})) if (spec.scale) scales[field] = spec.scale;
    for (const spec of Object.values(mapping?.wide?.fields ?? {})) if (spec.scale) scales[spec.to] = spec.scale;
    const ratings = ['satisfaction', 'seq', 'ease', 'perceived_time'].filter((c) => table.header.includes(c));
    const items = table.header.filter((h) => /^sat_\d+$/.test(h));
    const tasks = [...new Set(SUM.toRecords(table).map((r) => r.task_id))];
    const contract = {
      version: 1, study: opt.study ?? null, goal: null, decided_at: null,
      defaults: {
        scales, satisfaction_from: null, sat_target: null, time_target_s: null, expert_time_s: null, expert_multiplier: 3,
        cutoff_s: null, completion_benchmark: null, error_opportunities_predefined: table.header.includes('errors') ? null : false,
      },
      tasks: Object.fromEntries(tasks.map((t) => [t, {}])),
      compare_with_measuringu: false, accessibility_data: false,
    };
    const toFill = [
      { key: 'goal', question: 'What is the score for: a pass/fail gate, a benchmark tracked over time, a comparison of designs, or finding the weakest tasks?' },
      { key: 'defaults.satisfaction_from', question: `Which rating is satisfaction? Candidates: ${[...ratings, ...(items.length ? [`average of ${items.join(', ')}`] : [])].join('; ') || 'none found'}. The original SUM averaged ease, satisfaction and perceived time.` },
      { key: 'defaults.sat_target', question: 'What average rating counts as good? Common choices: 4 on a 5-point scale; 5.6 (Sauro & Kindlund) or 5 (Autodesk) on a 7-point scale.' },
      { key: 'defaults.time_target_s or tasks.<task>.time_target_s', question: `What is an acceptable time for each task (${tasks.join(', ')})? Or an expert time to multiply by 3. Leave empty to let autopilot derive it from satisfied users.` },
      { key: 'defaults.completion_benchmark', question: 'Is there a completion rate the task must reach (for example 78%)? Leave empty if not.' },
      { key: 'defaults.cutoff_s', question: 'Was there a time limit per task? It is needed if failed attempts should count at the limit.' },
    ];
    if (table.header.includes('errors')) toFill.push({ key: 'defaults.error_opportunities_predefined', question: 'Were the possible errors for each task listed before the study started (yes/no)?' });
    for (const missing of Object.keys(scales).length ? [] : ratings) toFill.push({ key: `defaults.scales.${missing}`, question: `What is the scale of ${missing} (for example 1–5)?` });
    if (opt.out) write(opt.out, contract);
    return { status: 'ok', out: opt.out ?? null, contract, toFill };
  },
  choose(table) {
    const c = SUM.choose(table, loadContract());
    return { ...c, reasons: c.reasons?.map((x) => ({ ...x })) };
  },
  run(table) {
    const contract = loadContract();
    const r = SUM.runSum(table, contract, {
      method: opt.method ?? 'auto', modifiers: modifiers(),
      bootstrap: opt.bootstrap !== undefined ? Number(opt.bootstrap) : 2000,
      ...(opt.seed !== undefined ? { seed: Number(opt.seed) } : {}),
    });
    if (opt.out && r.groups) write(opt.out,{ ...r, contract, data: path.resolve(dataPath), generated_at: new Date().toISOString() });
    return { ...summary(r), out: opt.out ?? null };
  },
  compare(table) {
    return { status: 'ok', methods: SUM.compareMethods(table, loadContract()).map((s) => ({ ...s, products: s.products?.map((p) => ({ group: p.group, pct: pct(p.pct) })) })) };
  },
};

const suffix = (lang) => (lang === 'ua' ? '.ua' : '');

// Commands that read a result or explainer JSON instead of the data table.
const DOC_COMMANDS = {
  report(result) {
    if (!opt['out-dir']) return { status: 'error', message: '--out-dir is required' };
    const lang = opt.lang ?? 'en';
    const md = path.join(opt['out-dir'], `report${suffix(lang)}.md`);
    const html = path.join(opt['out-dir'], `report${suffix(lang)}.html`);
    fs.mkdirSync(opt['out-dir'], { recursive: true });
    fs.writeFileSync(md, REPORT.buildReportMd(result, lang));
    fs.writeFileSync(html, REPORT.buildReportHtml(result, lang));
    return { status: 'ok', md, html };
  },
  facts(result) {
    const facts = REPORT.explainerFacts(result, opt.lang ?? 'en');
    if (opt.out) write(opt.out, facts);
    return { status: 'ok', out: opt.out ?? null, facts };
  },
  explainer(doc) {
    if (!opt.result || !opt['out-dir']) return { status: 'error', message: '--result and --out-dir are required' };
    const { errors } = validateExplainer(doc);
    if (errors.length) return { status: 'error', message: errors.join('; ') };
    if (!doc.review) return { status: 'error', message: 'This explainer has no editor review. Run the plain-language editor on it first, then render the edited file.' };
    const result = readJson(opt.result);
    const html = renderExplainerHtml(doc, { chart: REPORT.explainerChart(result, doc.lang) });
    const warnings = [];
    const htmlPath = path.join(opt['out-dir'], `explainer${suffix(doc.lang)}.html`);
    const pdf = writeDocument(html, htmlPath, findBrowser(), warnings);
    return { status: 'ok', html: htmlPath, pdf, warnings, review: doc.review };
  },
};

if ((!COMMANDS[command] && !DOC_COMMANDS[command]) || !dataPath) finish({ status: 'error', message: USAGE });
try {
  if (DOC_COMMANDS[command]) finish(DOC_COMMANDS[command](readJson(dataPath)));
  finish(COMMANDS[command](parseCsv(fs.readFileSync(dataPath, 'utf8').replace(/^﻿/, ''))));
} catch (e) {
  finish({ status: 'error', message: e.message });
}
