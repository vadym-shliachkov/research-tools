import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkReadability } from '../plugins/uxr/scripts/lib/readability.mjs';
import { validateExplainer, checkEdit, verdictErrors, renderExplainerHtml } from '../plugins/uxr/scripts/lib/explainer.mjs';
import { findBrowser, browserCandidates } from '../plugins/uxr/scripts/lib/browser.mjs';
import { writeDocument, bars } from '../plugins/uxr/scripts/lib/html.mjs';
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

  test('numbers written as words count as kept; numbers the edit adds are rejected', () => {
    const draft = structuredClone(EXPLAINER);
    draft.sections[2].paragraphs = ['8 of 10 people finished. People rated the task 3.7 out of 5.'];
    const words = structuredClone(draft);
    words.sections[2].paragraphs = ['Eight of ten people finished. People rated the task 3.7 out of 5.'];
    words.review = { readable: true, notes: [] };
    assert.deepEqual(checkEdit(draft, words).errors, []);
    const ua = { ...structuredClone(draft), lang: 'ua' };
    const uaEdit = structuredClone(ua);
    uaEdit.sections[2].paragraphs = ['Вісім із десяти людей виконали завдання. Оцінка — 3,7 з 5.'];
    uaEdit.review = { readable: true, notes: [] };
    assert.deepEqual(checkEdit(ua, uaEdit).errors, []);
    const added = structuredClone(words);
    added.sections[4].paragraphs = ['Fixing it would lift the score to 75%.'];
    assert.match(checkEdit(draft, added).errors.join(), /added by the edit: 75/);
  });

  test('wording may not state the verdict more firmly than the result supports', () => {
    const draft = { ...structuredClone(EXPLAINER), verdict: 'uncertain' };
    const edit = (sentence, lang = 'en') => {
      const e = { ...structuredClone(draft), lang, review: { readable: true, notes: [] } };
      e.sections[1].paragraphs = [...draft.sections[1].paragraphs, sentence];
      return checkEdit({ ...draft, lang }, e).errors;
    };
    assert.match(edit('The score is above target, but the study cannot yet confirm it.').join(), /verdict is "uncertain"/);
    assert.match(edit('Above target.').join(), /verdict/);
    assert.deepEqual(edit('The score looks above target, but the study cannot yet tell.'), []);
    assert.deepEqual(edit('We cannot yet tell whether it is above target.'), []);
    assert.match(edit('Результат вищий за ціль.', 'ua').join(), /verdict/);
    assert.deepEqual(edit('Схоже, результат вищий за ціль, але дослідження ще не може це підтвердити.', 'ua'), []);
    assert.deepEqual(verdictErrors({ lang: 'en', headline: { sentence: 'The score is above target.' } }, 'above'), []);
    assert.equal(verdictErrors({ lang: 'en', headline: { sentence: 'The score is below target.' } }, 'above').length, 1);
    // A sentence about one task is held to that task's verdict; known hedges let a careful claim through.
    const tasks = { 'Find a store': 'above', Checkout: 'uncertain' };
    const doc = (sentence) => ({ lang: 'en', headline: { sentence } });
    assert.deepEqual(verdictErrors(doc('Find a store is clearly above its target.'), 'uncertain', tasks), []);
    assert.deepEqual(verdictErrors(doc('Finding a store scored 75%, and even the low end of its range is above target.'), 'uncertain', tasks), []);
    assert.equal(verdictErrors(doc('Checkout is above its target.'), 'uncertain', tasks).length, 1);
    assert.deepEqual(verdictErrors(doc('The study is too small to say for sure that we beat our target.'), 'uncertain'), []);
    const changed = { ...structuredClone(draft), verdict: 'above', review: { readable: true, notes: [] } };
    assert.match(checkEdit(draft, changed).errors.join(), /verdict changed/);
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

  test('the Ukrainian report says the calculator\'s reasons, warnings and sources in Ukrainian', () => {
    const md = buildReportMd(RESULT, 'ua');
    assert.match(md, /Можливі помилки визначили до дослідження/);
    assert.match(md, /час експерта 20 с × 3/);
    assert.match(md, /завдання checkout: 2 невдалі спроби не враховано в часі/);
    assert.doesNotMatch(md, /Error opportunities were defined|failed attempt|expert time/);
    assert.match(buildReportMd(RESULT, 'en'), /Error opportunities were defined/);
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

  test('the Ukrainian report writes every decimal with a comma and agrees nouns with numbers', () => {
    const md = buildReportMd(RESULT, 'ua');
    assert.match(md, /\*\*\d+,\d%\*\* \(\d+,\d%–\d+,\d%\)/);
    assert.match(md, /80,0% \(8\/10\) · z \+0,\d\d/);
    assert.doesNotMatch(md.replace(/`[^`]*`/g, ''), /\d\.\d/);
    assert.match(md, /Дані: 1 завдання/);
    assert.match(buildReportMd(RESULT, 'en'), /Data: 1 task\b/);
    assert.match(buildReportMd(RESULT, 'en'), /80\.0% \(8\/10\) · z \+0\.\d\d/);
  });

  test('a method that does not apply says why in Ukrainian too', () => {
    const md = buildReportMd(RESULT, 'ua');
    assert.match(md, /microsoft \| не застосовний: для оцінки зручності бракує оцінок: відчуття часу, легкість/);
    assert.doesNotMatch(md, /Usability Score needs/);
    assert.match(buildReportMd(RESULT, 'en'), /The Usability Score needs perceived_time, ease/);
    // A result.json written before the error carried params is still translated.
    const old = structuredClone(RESULT);
    for (const s of old.sensitivity) delete s.params;
    assert.match(buildReportMd(old, 'ua'), /не застосовний: для оцінки зручності бракує оцінок: відчуття часу, легкість/);
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
    // Completion has no target without a benchmark, so the facts give its number and no verdict.
    assert.equal(f.tasks[0].components.completion.onTarget, null);
    assert.equal(f.tasks[0].components.time.onTarget, false);
  });

  test('bars are coloured by the verdict: grey when the range crosses the line, no line without a target', () => {
    const html = bars([
      { label: 'a', pct: 0.67, ci: [0.45, 0.85] }, { label: 'b', pct: 0.7, ci: [0.6, 0.8] },
      { label: 'c', pct: 0.9, ci: [0.82, 0.95], target: 0.8 }, { label: 'd', pct: 0.75, ci: null, target: null },
    ]);
    assert.deepEqual([...html.matchAll(/fill (\w+)/g)].map((m) => m[1]), ['neutral', 'above', 'above', 'neutral']);
    assert.match(html, /class="mid" style="left:80\.0%"/);
    assert.equal([...html.matchAll(/class="mid"/g)].length, 3);
  });
});

describe('Usability Score reports', () => {
  const DATA = T(['participant_id', 'task_id', 'success', 'perceived_time', 'ease', 'satisfaction'], [
    ['U1', 't', 1, 4, 4, 4], ['U2', 't', 1, 3, 4, 5], ['U3', 't', 1, 3, 5, 4], ['U4', 't', 1, 4, 4, 3], ['U5', 't', 1, 2, 4, 4],
    ['U6', 't', 1, 3, 3, 4], ['U7', 't', 1, 5, 5, 5], ['U8', 't', 0, 3, 4, 4], ['U9', 't', 1, 3, 4, 4], ['U10', 't', 1, 4, 5, 4],
  ]);
  const scales = { perceived_time: [1, 5], ease: [1, 5], satisfaction: [1, 5] };
  const result = (defaults) => {
    const contract = { version: 1, study: 'Gate', goal: 'gate', defaults: { scales, ...defaults } };
    return { ...SUM.runSum(DATA, contract, { method: 'microsoft', bootstrap: 300 }), contract, generated_at: '2026-10-21T10:00:00Z' };
  };

  test('report.md and report.html build in both languages', () => {
    for (const lang of ['en', 'ua']) {
      const md = buildReportMd(result({}), lang);
      assert.match(md, lang === 'en' ? /pass at Perceived time ≥ 3, Ease ≥ 4, Satisfaction ≥ 4 · no pass mark agreed/ : /прохід від .*прохідну частку не погоджено/);
      assert.match(buildReportHtml(result({ gate_threshold: 0.5 }), lang), /class="bars"/);
    }
    const gated = buildReportMd(result({ gate_threshold: 0.5 }), 'en');
    assert.match(gated, /Pass mark 50\.0%/);
    assert.match(gated, /^# Usability Score report: Gate/m);
    assert.match(gated, /6 of 10 people passed every task/);
    assert.match(buildReportMd(result({}), 'ua'), /^# Звіт: оцінка зручності/m);
    assert.deepEqual(explainerFacts(result({}), 'en').overall.passed, { x: 6, n: 10 });
  });

  test('without a pass mark there is no target and no verdict; with one, the range is judged against it', () => {
    const none = explainerFacts(result({}), 'en');
    assert.equal(none.overall.verdict, 'no-target');
    assert.equal(none.overall.target, null);
    assert.match(none.reading, /No pass mark was agreed/);
    assert.equal(none.tasks[0].components.ease.onTarget, null);
    assert.equal(explainerChart(result({}), 'en').at(-1).target, null);
    const gate = explainerFacts(result({ gate_threshold: 0.2 }), 'en');
    assert.equal(gate.overall.target, 20);
    assert.equal(gate.overall.verdict, 'above');
    assert.match(gate.overall.verdictPlain, /pass mark of 20%/);
  });
});

describe('comparing groups', () => {
  const rows = CHECKOUT.rows.flatMap((r) => [[...r, 'A'], [`${r[0]}b`, ...r.slice(1), 'B']]);
  const data = T([...CHECKOUT.header, 'group'], rows);
  const r = { ...SUM.runSum(data, CONTRACT, { method: 'sum3', bootstrap: 300 }), contract: CONTRACT, generated_at: '2026-10-21T10:00:00Z' };

  test('facts have no single overall result, but a comparison with a range', () => {
    const f = explainerFacts(r, 'en');
    assert.equal(f.overall, null);
    assert.equal(f.groups.length, 2);
    assert.equal(f.comparison[0].diffPoints, 0);
    assert.equal(f.comparison[0].verdict, 'uncertain');
    assert.equal(f.groups[1].sensitivity.length, f.groups[0].sensitivity.length);
  });

  test('the report shows a score card for every group and the difference', () => {
    const html = buildReportHtml(r, 'en');
    assert.match(html, /Overall SUM · A/);
    assert.match(html, /Overall SUM · B/);
    assert.match(buildReportMd(r, 'en'), /Difference B vs A: \+0\.0 points/);
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
