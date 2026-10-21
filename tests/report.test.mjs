import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkReadability } from '../plugins/uxr/scripts/lib/readability.mjs';
import { validateExplainer, checkEdit, renderExplainerHtml } from '../plugins/uxr/scripts/lib/explainer.mjs';
import { findBrowser, browserCandidates } from '../plugins/uxr/scripts/lib/browser.mjs';
import { writeDocument } from '../plugins/uxr/scripts/lib/html.mjs';
import * as SUM from '../plugins/uxr/skills/sum/scripts/sum-lib.mjs';
import { buildReportMd, buildReportHtml, explainerFacts, explainerChart } from '../plugins/uxr/skills/sum/scripts/report-lib.mjs';

const T = (header, rows) => ({ header, rows: rows.map((r) => r.map((v) => (v === null ? '' : String(v)))) });
const CHECKOUT = T(['participant_id', 'task_id', 'success', 'time_s', 'errors', 'error_opportunities', 'satisfaction'], [
  ['U1', 'checkout', 1, 42, 0, 5, 5], ['U2', 'checkout', 1, 50, 0, 5, 4], ['U3', 'checkout', 1, 55, 1, 5, 4],
  ['U4', 'checkout', 1, 60, 0, 5, 4], ['U5', 'checkout', 1, 64, 0, 5, 3], ['U6', 'checkout', 1, 72, 1, 5, 4],
  ['U7', 'checkout', 1, 78, 0, 5, 5], ['U8', 'checkout', 1, 85, 1, 5, 3], ['U9', 'checkout', 0, null, 1, 5, 2],
  ['U10', 'checkout', 0, null, 0, 5, 3],
]);
const CONTRACT = { version: 1, study: 'Checkout benchmark', defaults: { scales: { satisfaction: [1, 5] }, satisfaction_from: 'satisfaction', sat_target: 4, expert_time_s: 20, error_opportunities_predefined: true } };
const RESULT = { ...SUM.runSum(CHECKOUT, CONTRACT, { method: 'auto', bootstrap: 300 }), contract: CONTRACT, generated_at: '2026-10-21T10:00:00Z' };

const EXPLAINER = {
  lang: 'en',
  title: 'How to understand your results',
  study: 'Checkout benchmark',
  headline: { value: '67%', label: 'Overall usability score', sentence: 'The checkout works for most people, but it feels slower than it should.' },
  sections: [
    { id: 'measured', heading: 'What we measured', paragraphs: ['Ten people tried to pay for an order in the online shop.'] },
    { id: 'result', heading: 'Your result', paragraphs: ['The overall usability score is 67 out of 100.'] },
    { id: 'components', heading: 'What the score is made of', paragraphs: ['Eight of ten people finished. People rated the task 3.7 out of 5.'] },
    { id: 'range', heading: 'How sure we are', paragraphs: ['With ten people, the true score is probably between 48 and 80.'] },
    { id: 'fix-first', heading: 'What to fix first', paragraphs: ['Make the checkout feel quicker and more pleasant.'] },
    { id: 'limits', heading: 'What this number cannot tell you', paragraphs: ['The score does not say why people struggled.'] },
  ],
  glossary: [{ term: 'Usability score', definition: 'One number from 0 to 100 that sums up how well people managed the task.' }],
};

describe('readability', () => {
  test('clean plain text has no issues', () => {
    assert.deepEqual(checkReadability(EXPLAINER).issues, []);
  });

  test('flags long sentences, unexplained jargon and code-like text', () => {
    const doc = structuredClone(EXPLAINER);
    doc.sections[1].paragraphs = [
      'The aggregate z-score of 0.45 maps through the standard normal distribution to the 67th percentile, which is what we report here as the SUM value for the whole study today.',
      'See result.json and the method SUM4|zmean for details.',
    ];
    const codes = checkReadability(doc).issues.map((i) => i.code);
    assert.ok(codes.includes('long-sentence'));
    assert.ok(codes.includes('jargon'));
    assert.ok(codes.includes('code-like'));
  });

  test('a term defined in the glossary is not jargon', () => {
    const doc = structuredClone(EXPLAINER);
    doc.sections[3].paragraphs = ['The confidence interval runs from 48 to 80.'];
    assert.ok(checkReadability(doc).issues.some((i) => i.code === 'jargon'));
    doc.glossary.push({ term: 'Confidence interval', definition: 'The range where the true score most likely lies.' });
    assert.ok(!checkReadability(doc).issues.some((i) => i.code === 'jargon'));
  });

  test('Ukrainian: jargon and untranslated English words are flagged', () => {
    const doc = { ...structuredClone(EXPLAINER), lang: 'ua', title: 'Як зрозуміти ваші результати' };
    doc.headline = { value: '67%', label: 'Загальна оцінка зручності', sentence: 'Оформлення замовлення працює для більшості людей.' };
    doc.sections = doc.sections.map((s) => ({ ...s, heading: 'Розділ', paragraphs: ['Десять людей спробували оплатити замовлення.'] }));
    doc.glossary = [{ term: 'Оцінка зручності', definition: 'Одне число від 0 до 100.' }];
    assert.deepEqual(checkReadability(doc).issues, []);
    doc.sections[2].paragraphs = ['Стандартне відхилення велике, а completion rate низький.'];
    const codes = checkReadability(doc).issues.map((i) => i.code);
    assert.ok(codes.includes('jargon'));
    assert.ok(codes.includes('untranslated'));
  });
});

describe('explainer structure and the editor guard', () => {
  test('a complete explainer validates; a missing section does not', () => {
    assert.deepEqual(validateExplainer(EXPLAINER).errors, []);
    const broken = structuredClone(EXPLAINER);
    broken.sections = broken.sections.filter((s) => s.id !== 'range');
    assert.match(validateExplainer(broken).errors.join(), /range/);
  });

  test('the edit must keep every number and every section', () => {
    const edited = structuredClone(EXPLAINER);
    edited.sections[2].paragraphs = ['Eight of ten people finished. People gave the task a middling rating.'];
    edited.review = { readable: true, notes: ['Shortened sentences'] };
    const r = checkEdit(EXPLAINER, edited);
    assert.match(r.errors.join(), /3\.7/);
    const ok = structuredClone(EXPLAINER);
    ok.review = { readable: true, notes: [] };
    assert.deepEqual(checkEdit(EXPLAINER, ok).errors, []);
    delete ok.review;
    assert.match(checkEdit(EXPLAINER, ok).errors.join(), /review/);
  });

  test('renders an A4 page with the headline, sections, glossary and component chart', () => {
    const html = renderExplainerHtml(EXPLAINER, { chart: explainerChart(RESULT, 'en') });
    assert.match(html, /<html lang="en">/);
    assert.match(html, /How to understand your results/);
    assert.match(html, /What to fix first/);
    assert.match(html, /class="glossary"/);
    assert.match(html, /class="bars"/);
    assert.match(html, /@page/);
    const ua = renderExplainerHtml({ ...EXPLAINER, lang: 'ua' }, { chart: explainerChart(RESULT, 'ua') });
    assert.match(ua, /<html lang="uk">/);
    assert.match(ua, /Задоволеність/);
  });
});

describe('SUM reports', () => {
  test('report.md shows the component table before the score, the method, sensitivity and QA', () => {
    const md = buildReportMd(RESULT, 'en');
    assert.match(md, /^# SUM report: Checkout benchmark/m);
    assert.ok(md.indexOf('| Completion') < md.indexOf('Overall SUM'));
    assert.match(md, /SUM4\|zmean/);
    assert.match(md, /67\.4%/);
    assert.match(md, /sum3/);
    assert.match(md, /depends on the method/i);
    assert.match(md, /expert time 20 s × 3/);
    assert.match(md, /failed attempt/i);
  });

  test('report in Ukrainian uses Ukrainian labels', () => {
    const md = buildReportMd(RESULT, 'ua');
    assert.match(md, /Частка успішного виконання/);
    assert.match(md, /Час на завдання/);
    assert.match(md, /62 с проти 60 с/);
    assert.match(md, /3,7 проти 4/);
    const chart = explainerChart(RESULT, 'ua');
    assert.equal(chart.find((r) => r.label === 'Задоволеність').sub, '3,7 при цілі 4');
    assert.equal(chart.at(-1).label, 'Загальна оцінка');
  });

  test('the explainer chart avoids jargon; the team report keeps technical labels', () => {
    const chart = explainerChart(RESULT, 'en');
    assert.equal(chart.at(-1).label, 'Overall score');
    assert.equal(chart.find((r) => r.label === 'Error-free rate').sub, '4 mistakes in 50 chances');
    assert.match(buildReportHtml(RESULT, 'en'), /<div class="label">SUM<\/div>/);
  });

  test('report.html is self-contained with bars and intervals', () => {
    const html = buildReportHtml(RESULT, 'en');
    assert.match(html, /<style>/);
    assert.match(html, /class="bars"/);
    assert.match(html, /class="ci"/);
    assert.doesNotMatch(html, /<script/);
  });

  test('facts for the explainer draft: plain numbers, the weakest component, caveats', () => {
    const f = explainerFacts(RESULT, 'en');
    assert.equal(f.overall.pct, 67);
    assert.equal(f.tasks[0].weakest.key, 'satisfaction');
    assert.ok(f.caveats.length >= 1);
    assert.equal(f.methodDependent, true);
    // 67% looks above target, but its range starts below 50%, so "above target" is not yet certain.
    assert.ok(f.overall.ci[0] < 50 && f.overall.ci[1] > 50);
    assert.equal(f.overall.verdict, 'uncertain');
    assert.equal(f.tasks[0].sum.verdict, 'uncertain');
    assert.match(f.overall.verdictPlain, /cannot yet be sure/);
  });
});

describe('PDF printing', () => {
  test('browser candidates cover Windows, macOS and Linux', () => {
    assert.ok(browserCandidates({ PROGRAMFILES: 'C:\\PF' }, 'win32').some((p) => /msedge\.exe$/.test(p)));
    assert.ok(browserCandidates({}, 'darwin').some((p) => /Chrome/.test(p)));
    assert.equal(findBrowser({}, 'linux', () => false), null);
  });

  test('without a browser the HTML is kept and a warning explains why', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-pdf-'));
    const warnings = [];
    const pdf = writeDocument('<html><body>x</body></html>', path.join(dir, 'explainer.html'), null, warnings);
    assert.equal(pdf, null);
    assert.ok(fs.existsSync(path.join(dir, 'explainer.html')));
    assert.match(warnings[0], /browser/i);
  });

  test('with a browser, a real PDF is printed', { skip: !findBrowser() && 'no Chrome/Edge on this machine' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-pdf-'));
    const warnings = [];
    const pdf = writeDocument(renderExplainerHtml(EXPLAINER, { chart: explainerChart(RESULT, 'en') }), path.join(dir, 'explainer.html'), findBrowser(), warnings);
    assert.ok(pdf && fs.statSync(pdf).size > 5000, warnings.join());
    assert.equal(fs.readFileSync(pdf).subarray(0, 4).toString(), '%PDF');
  });
});
