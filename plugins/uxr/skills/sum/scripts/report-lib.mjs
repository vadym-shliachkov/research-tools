// Turns a SUM result.json into report.md, report.html, the facts the explainer draft is written from, and the
// explainer chart. Every number comes from the result; nothing is recomputed here.
import { esc, page, bars } from '../../../scripts/lib/html.mjs';
import { warningText, whereText, reasonText, suggestionText, notApplicableText, timeSourceText } from './report-text.mjs';

// Ukrainian noun forms after a number: 1 помилка, 2–4 помилки, 5+ (and 11–14) помилок.
function uaPlural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const L = {
  en: {
    title: 'SUM report', titleUs: 'Usability Score report', passedAll: (x, n) => `${x} of ${n} people passed every task`,
    paired: 'same people in both groups', mixedDesign: 'some people in both groups', completion: 'Completion', errors: 'Error-free rate', time: 'Time on task', satisfaction: 'Satisfaction',
    perceived_time: 'Perceived time', ease: 'Ease', sum: 'SUM', usability: 'Usability Score', overall: 'Overall SUM',
    overallUs: 'Overall Usability Score', task: 'Task', n: 'n', group: 'Group', range: '95% range', method: 'Method',
    why: 'Why this method', suggestions: 'Suggestions', sens: 'How much the method matters', chosen: 'chosen',
    notApplicable: 'not applicable', dependent: 'The verdict depends on the method: applicable methods differ by more than 10 points. Report the chosen method and say why.',
    stable: 'Applicable methods agree within 10 points; the verdict does not hinge on the method.', qa: 'Quality checks', none: 'No warnings.',
    details: 'Method details', generated: 'Generated', data: 'Data', participants: 'attempts', tasks: (n) => `${n} task${n === 1 ? '' : 's'}`, target: 'target',
    timeTarget: 'Time target', satTarget: 'Satisfaction target', benchmark: 'Completion benchmark', bootstrap: 'Ranges come from a participant bootstrap',
    samples: 'samples', seed: 'seed', of: 'of', finished: 'finished', geo: 'typical', vs: 'vs', passed: 'passed all four',
    threshold: 'threshold', on: 'on', from: 'from', alpha: 'Cronbach alpha', gate: 'Pass mark', noGate: 'no pass mark agreed',
    passBar: 'pass at', diff: 'Difference', vsGroup: 'vs', pts: 'points',
    barsKey: 'Bars show each part as a percentage. The vertical line marks the target where there is one (50% for SUM parts, the agreed pass mark for the Usability Score). Green: clearly at or above it; red: clearly below; grey: the 95% range (whisker) crosses the line, or there is no target. Bars without a whisker are coloured by their value.',
    s: 's', dec: '.', vsTarget: 'vs target', overallPlain: 'Overall score',
    mistakes: (e, n) => `${e} mistake${e === 1 ? '' : 's'} in ${n} chances`,
  },
  ua: {
    title: 'Звіт SUM', titleUs: 'Звіт: оцінка юзабіліті', passedAll: (x, n) => `${x} з ${n} учасників пройшли всі завдання`,
    paired: 'ті самі учасники в обох групах', mixedDesign: 'частина учасників в обох групах', completion: 'Частка успішного виконання', errors: 'Частка дій без помилок', time: 'Час на завдання', satisfaction: 'Задоволеність',
    perceived_time: 'Відчуття часу', ease: 'Легкість', sum: 'SUM', usability: 'Оцінка юзабіліті (Microsoft)', overall: 'Загальний SUM',
    overallUs: 'Загальна оцінка юзабіліті', task: 'Завдання', n: 'n', group: 'Група', range: '95% діапазон', method: 'Метод',
    why: 'Чому цей метод', suggestions: 'Пропозиції', sens: 'Наскільки результат залежить від методу', chosen: 'обраний',
    notApplicable: 'не застосовний', dependent: 'Висновок залежить від методу: застосовні методи розходяться більш ніж на 10 пунктів. Повідомляйте обраний метод і пояснюйте чому.',
    stable: 'Застосовні методи розходяться не більш ніж на 10 пунктів; висновок не залежить від методу.', qa: 'Перевірки якості', none: 'Попереджень немає.',
    details: 'Деталі методу', generated: 'Створено', data: 'Дані', participants: 'спроб', tasks: (n) => `${n} ${uaPlural(n, 'завдання', 'завдання', 'завдань')}`, target: 'ціль',
    timeTarget: 'Ціль за часом', satTarget: 'Ціль задоволеності', benchmark: 'Орієнтир успішності', bootstrap: 'Діапазони отримано бутстрепом за учасниками',
    samples: 'вибірок', seed: 'зерно', of: 'з', finished: 'виконали', geo: 'типово', vs: 'проти', passed: 'пройшли всі чотири умови',
    threshold: 'поріг', on: 'за шкалою', from: 'з', alpha: 'альфа Кронбаха', gate: 'Прохідна частка', noGate: 'прохідну частку не погоджено',
    passBar: 'прохід від', diff: 'Різниця', vsGroup: 'проти', pts: 'в. п.',
    barsKey: 'Смуги показують кожну складову у відсотках. Вертикальна лінія позначає ціль, якщо вона є (50% для складових SUM, погоджена прохідна частка для оцінки юзабіліті). Зелений — явно на рівні цілі або вище; червоний — явно нижче; сірий — 95% діапазон (вуса) перетинає лінію, або цілі немає. Смуги без вусів забарвлено за значенням.',
    s: 'с', dec: ',', vsTarget: 'при цілі', overallPlain: 'Загальна оцінка',
    mistakes: (e, n) => `${e} ${uaPlural(e, 'помилка', 'помилки', 'помилок')} з ${n} можливих`,
  },
};

const ORDER = ['completion', 'errors', 'time', 'satisfaction', 'perceived_time', 'ease'];
const pct1 = (x, l = L.en) => (Number.isFinite(x) ? `${(Math.round(x * 1000) / 10).toFixed(1).replace('.', l.dec)}%` : '—');
const pct0 = (x) => (Number.isFinite(x) ? Math.round(x * 100) : null);
const sec = (x, l = L.en) => `${Math.round(x)} ${l.s}`;
const zTxt = (z, l = L.en) => (Number.isFinite(z) ? `z ${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2).replace('.', l.dec)}` : 'z ∞');
const range = (ci, l = L.en) => (ci ? `${pct1(ci[0], l)}–${pct1(ci[1], l)}` : '—');
const num = (x, l = L.en) => String(Math.round(x * 100) / 100).replace('.', l.dec);
const unique = (xs) => [...new Set(xs)];
const points = (d, l = L.en) => `${d >= 0 ? '+' : '−'}${(Math.round(Math.abs(d) * 1000) / 10).toFixed(1).replace('.', l.dec)} ${l.pts}`;
const isUs = (r) => r.method?.config?.kind === 'usability-score';
// The percentage that means "on target", or null when there is none. Results written before targetPct existed
// used 50% everywhere.
const targetOf = (c) => (c?.targetPct === undefined ? 0.5 : c.targetPct);

function cell(key, c, l, us) {
  if (!c) return '—';
  if (us) return `${pct1(c.pct, l)} (${c.x}/${c.n}${c.threshold !== undefined ? `, ≥${num(c.threshold, l)}` : ''})`;
  if (key === 'completion') return `${pct1(c.p, l)} (${c.x}/${c.n}) · ${zTxt(c.z, l)}`;
  if (key === 'errors') return `${pct1(c.quality, l)} · ${zTxt(c.z, l)}`;
  if (key === 'time') return `${sec(c.log ? c.geoMean : c.mean, l)} ${l.vs} ${sec(c.target, l)} · ${zTxt(c.z, l)}`;
  if (key === 'satisfaction') return `${num(c.mean, l)} ${l.vs} ${num(c.target, l)} · ${zTxt(c.z, l)}`;
  return pct1(c.pct, l);
}

const presentKeys = (group) => ORDER.filter((k) => group.tasks.some((t) => t.components?.[k]));

export function buildReportMd(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const us = isUs(result);
  const study = result.contract?.study ?? '';
  const out = [`# ${us ? l.titleUs : l.title}${study ? `: ${study}` : ''}`, ''];
  const tasksN = result.groups?.[0]?.tasks.length ?? 0;
  out.push(`${l.generated} ${String(result.generated_at ?? '').slice(0, 10)} · ${l.method}: **${result.method.preset}** \`${result.method.string}\` · ${l.data}: ${l.tasks(tasksN)}`, '');

  for (const g of result.groups ?? []) {
    if (g.group !== null) out.push(`## ${l.group} ${g.group}`, '');
    const keys = presentKeys(g);
    out.push(`| ${l.task} | ${l.n} | ${keys.map((k) => l[k]).join(' | ')} | ${us ? l.usability : l.sum} (${l.range}) |`);
    out.push(`|---|---:|${keys.map(() => '---|').join('')}---|`);
    for (const t of g.tasks) {
      const n = t.components?.completion?.n ?? t.sum?.n ?? '';
      out.push(`| ${t.task} | ${n} | ${keys.map((k) => cell(k, t.components?.[k], l, us)).join(' | ')} | ${t.sum ? `**${pct1(t.sum.pct, l)}** (${range(t.sum.ci, l)})` : '—'} |`);
    }
    out.push('');
    if (g.product) out.push(`**${us ? l.overallUs : l.overall}: ${pct1(g.product.pct, l)}** (${l.range} ${range(g.product.ci, l)})${us && g.product.x !== undefined ? ` · ${l.passedAll(g.product.x, g.product.n)}` : ''}${us ? ` · ${g.product.targetPct ? `${l.gate} ${pct1(g.product.targetPct, l)}` : l.noGate}` : ''}`, '');
  }
  for (const c of result.comparison ?? []) {
    out.push(`**${l.diff} ${c.group} ${l.vsGroup} ${c.vs}: ${points(c.diff, l)}** (${l.range} ${c.ci ? c.ci.map((x) => points(x, l)).join(' … ') : '—'})${c.design === 'paired' ? ` · ${l.paired}` : c.design === 'mixed' ? ` · ${l.mixedDesign}` : ''}`, '');
  }

  if (result.choice) {
    out.push(`## ${l.why}`, '', ...result.choice.reasons.map((r) => `- **${r.decision}**: ${reasonText(r, lang)}`), '');
    if (result.choice.suggestions?.length) out.push(`**${l.suggestions}:**`, '', ...result.choice.suggestions.map((s) => `- ${suggestionText(s, lang)}`), '');
  }

  if (result.sensitivity) {
    out.push(`## ${l.sens}`, '', `| ${l.method} | ${l.sum} |`, '|---|---:|');
    const chosen = result.groups.map((g) => pct1(g.product?.pct, l)).join(' / ');
    out.push(`| **${result.method.preset}** (${l.chosen}) | **${chosen}** |`);
    for (const s of result.sensitivity) {
      out.push(`| ${s.preset} | ${s.status === 'ok' ? s.products.map((p) => pct1(p.pct, l)).join(' / ') : `${l.notApplicable}: ${notApplicableText(s, lang)}`} |`);
    }
    out.push('', `> ${result.methodDependent ? l.dependent : l.stable}`, '');
  }

  out.push(`## ${l.qa}`, '');
  const qa = [...(result.qa?.errors ?? []), ...(result.qa?.warnings ?? [])];
  out.push(...(qa.length ? qa.map((w) => `- ${w.where ? `${whereText(w, lang)}: ` : ''}${warningText(w, lang)}`) : [l.none]), '');

  out.push(`## ${l.details}`, '', `- ${l.method}: \`${result.method.string}\``);
  for (const g of result.groups ?? []) {
    for (const t of g.tasks) {
      const c = t.components ?? {};
      const where = `${g.group !== null ? `${g.group} / ` : ''}${t.task}`;
      if (us) {
        // Usability Score parts are pass rates: each has a threshold, not a target, scale or source columns.
        const bars = ['perceived_time', 'ease', 'satisfaction'].filter((k) => c[k]?.threshold !== undefined).map((k) => `${l[k]} ≥ ${num(c[k].threshold, l)}`);
        out.push(`- ${where}: ${l.passBar} ${bars.join(', ')} · ${t.sum?.targetPct ? `${l.gate} ${pct1(t.sum.targetPct, l)}` : l.noGate}`);
        continue;
      }
      if (c.time) out.push(`- ${where}: ${l.timeTarget} ${sec(c.time.target, l)} (${timeSourceText(c.time.targetSource, lang)})`);
      if (c.satisfaction) out.push(`- ${where}: ${l.satTarget} ${num(c.satisfaction.target, l)} ${l.on} ${c.satisfaction.scale.join('–')} (${l.from} ${c.satisfaction.from.join(' + ')})${c.satisfaction.alpha !== undefined ? `, ${l.alpha} ${num(c.satisfaction.alpha, l)}` : ''}`);
      if (c.completion?.benchmark !== undefined) out.push(`- ${where}: ${l.benchmark} ${pct1(c.completion.benchmark, l)}`);
    }
    if (g.bootstrap) out.push(`- ${l.bootstrap}: ${g.bootstrap.B} ${l.samples}, ${l.seed} ${g.bootstrap.seed}`);
  }
  out.push('');
  return out.join('\n');
}

// plain: wording for a broad audience (the explainer); otherwise the team report's technical labels.
function taskChart(t, l, us, plain = false) {
  const rows = [];
  for (const k of ORDER) {
    const c = t.components?.[k];
    if (!c) continue;
    let sub = '';
    if (us) sub = `${c.x} ${l.of} ${c.n}`;
    else if (k === 'completion') sub = `${c.x} ${l.of} ${c.n} ${l.finished}`;
    else if (k === 'time') sub = `${sec(c.log ? c.geoMean : c.mean, l)} ${l.vsTarget} ${sec(c.target, l)}`;
    else if (k === 'satisfaction') sub = `${num(c.mean, l)} ${l.vsTarget} ${num(c.target, l)}`;
    else if (k === 'errors') sub = plain ? l.mistakes(c.errors, c.opportunities) : `${c.errors} / ${c.opportunities}`;
    // Only ranges already in the bar's units: pass rates and raw completion (time and satisfaction ranges are in
    // seconds and rating points, and a benchmark rescales completion).
    const ci = (us || (k === 'completion' && c.benchmark === undefined)) && c.ci ? c.ci : null;
    rows.push({ label: l[k], sub, pct: c.pct, ci, target: targetOf(c) });
  }
  if (t.sum) rows.push({ label: plain ? l.overallPlain : us ? l.usability : l.sum, sub: us ? l.passed : '', pct: t.sum.pct, ci: t.sum.ci ?? null, target: targetOf(t.sum) });
  return rows;
}

export function explainerChart(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const us = isUs(result);
  const g = result.groups?.[0];
  if (!g) return [];
  if (result.groups.length === 1 && g.tasks.length === 1) return taskChart(g.tasks[0], l, us, true);
  const rows = [];
  for (const grp of result.groups) {
    const prefix = grp.group !== null ? `${grp.group} · ` : '';
    for (const t of grp.tasks) if (t.sum) rows.push({ label: `${prefix}${t.task}`, pct: t.sum.pct, ci: t.sum.ci ?? null, target: targetOf(t.sum) });
    if (grp.product) rows.push({ label: `${prefix}${l.overallPlain}`, pct: grp.product.pct, ci: grp.product.ci ?? null, target: targetOf(grp.product) });
  }
  return rows;
}

export function buildReportHtml(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const md = buildReportMd(result, lang);
  const us = isUs(result);
  // Every group gets its own score card: a comparison of designs must not headline only the first one.
  const scored = (result.groups ?? []).filter((g) => g.product);
  const cards = scored.map((g) => `<div class="score"><span class="score-num">${pct0(g.product.pct)}</span><span class="score-of">%</span>`
    + `<span class="score-label">${esc(us ? l.overallUs : l.overall)}${g.group !== null ? ` · ${esc(g.group)}` : ''}</span>`
    + `<span class="score-range">${esc(l.range)}: ${esc(range(g.product.ci, l))}</span></div>`).join('');
  const head = scored.length
    ? `<div class="glance"><div class="glance-head">${cards}`
      + `<p class="verdict"><span class="meta">${esc(l.method)}: ${esc(result.method.preset)} · <code>${esc(result.method.string)}</code></span></p></div></div>`
    : '';
  const charts = (result.groups ?? []).map((g) => g.tasks.map((t) => `<h3>${esc(g.group !== null ? `${g.group} · ` : '')}${esc(t.task)}</h3>${bars(taskChart(t, l, us))}`).join('')).join('')
    + `<p class="bars-key">${esc(l.barsKey)}</p>`;
  const body = `${head}<div class="content"><section><h2>${esc(us ? l.usability : l.sum)}</h2>${charts}</section>${mdToHtml(md.split('\n').slice(4).join('\n'))}</div>`;
  const docTitle = us ? l.titleUs : l.title;
  return page({ lang, title: `${docTitle}${result.contract?.study ? `: ${result.contract.study}` : ''}`, bandTitle: docTitle, bandMeta: [result.contract?.study ?? '', String(result.generated_at ?? '').slice(0, 10)], body });
}

// Just enough Markdown for the report's own output: headings, tables, bullets, quotes, bold and code.
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
}
function mdToHtml(md) {
  const out = [];
  const lines = md.split('\n');
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      out.push(`${open ? '</section>' : ''}<section><h2>${inline(line.slice(3))}</h2>`);
      open = true;
    }
    else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.slice(1, -1).split(' | ').map((c) => c.trim());
      const [h, , ...body] = rows;
      out.push(`<table><thead><tr>${cells(h).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
      i--;
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
    } else if (line.startsWith('> ')) out.push(`<div class="callout">${inline(line.slice(2))}</div>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (open) out.push('</section>');
  return out.join('');
}

const PLAIN_METHOD = {
  sum3: 'Three parts with equal weight: how many finished, how fast, and how satisfied people were.',
  sum4: 'Four parts with equal weight: how many finished, how many mistakes, how fast, and how satisfied people were.',
  measuringu: 'The same three parts, each turned into a percentage and averaged, so it can be compared with MeasuringU numbers.',
  autodesk: 'Three parts, with the time target taken from how long satisfied people needed.',
  pearson: 'Three parts, with completion scored against the required completion rate, so meeting it counts as exactly on target.',
  microsoft: 'The share of people for whom everything was good enough at once: they finished, and found the task fast, easy and satisfying enough.',
};

// Whether a score is clearly above or below its target, judged on its 95% range, not on the point estimate.
// A score without a target (a Usability Score with no agreed pass mark) has no verdict at all.
function scoreFacts(s) {
  const target = targetOf(s);
  const out = { pct: pct0(s.pct), ci: s.ci ? s.ci.map(pct0) : null, target: target === null ? null : pct0(target) };
  if (target === null) {
    return { ...out, verdict: 'no-target', verdictPlain: `No target was agreed for this score, so it is neither above nor below one.${out.ci ? ` The true value is most likely between ${out.ci[0]}% and ${out.ci[1]}%.` : ''}` };
  }
  const line = target === 0.5 ? 'the target' : `the agreed pass mark of ${out.target}%`;
  if (!s.ci) return { ...out, verdict: 'no-range', verdictPlain: 'There is no range for this score, so how sure we are is unknown.' };
  if (s.ci[0] > target) return { ...out, verdict: 'above', verdictPlain: `Even the low end of the range is above ${line}, so the result is clearly above it.` };
  if (s.ci[1] < target) return { ...out, verdict: 'below', verdictPlain: `Even the high end of the range is below ${line}, so the result is clearly below it.` };
  return { ...out, verdict: 'uncertain', verdictPlain: `The range runs from ${out.ci[0]}% to ${out.ci[1]}% and includes ${target === 0.5 ? 'the 50% target' : `the agreed pass mark of ${out.target}%`}, so we cannot yet be sure whether the result is above or below it.` };
}

function componentPlain(k, c, us) {
  if (us) return k === 'completion' ? `${c.x} of ${c.n} people finished` : `${c.x} of ${c.n} people rated it ${c.threshold} or higher`;
  if (k === 'completion') return `${c.x} of ${c.n} people finished${c.benchmark !== undefined ? ` against a required ${pct0(c.benchmark)}%` : ''}`;
  if (k === 'time') return `typical time ${Math.round(c.log ? c.geoMean : c.mean)} s against a target of ${Math.round(c.target)} s`;
  if (k === 'satisfaction') return `average rating ${num(c.mean)} on a ${c.scale.join('–')} scale against a target of ${c.target}`;
  return `${c.errors} mistakes in ${c.opportunities} chances to make one`;
}

function groupFacts(g, result, gi, l, us) {
  return {
    group: g.group,
    // For the Usability Score, the people behind the overall share: x of n passed every task they tried.
    overall: g.product ? { ...scoreFacts(g.product), ...(us && g.product.x !== undefined ? { passed: { x: g.product.x, n: g.product.n } } : {}) } : null,
    tasks: g.tasks.map((t) => {
      // onTarget is null for a part without a target (completion without a benchmark, the error-free rate and the
      // Usability Score's pass rates): report its number, not a verdict.
      const comps = Object.fromEntries(ORDER.filter((k) => t.components?.[k]).map((k) => {
        const c = t.components[k];
        const target = targetOf(c);
        return [k, { label: l[k], pct: pct0(c.pct), target: target === null ? null : pct0(target), onTarget: target === null ? null : c.pct >= target, plain: componentPlain(k, c, us) }];
      }));
      const weakest = Object.entries(comps).sort((a, b) => a[1].pct - b[1].pct)[0];
      return { task: t.task, n: t.components?.completion?.n ?? t.sum?.n, sum: t.sum ? scoreFacts(t.sum) : null, components: comps, weakest: weakest ? { key: weakest[0], ...weakest[1] } : null };
    }),
    sensitivity: (result.sensitivity ?? []).filter((s) => s.status === 'ok').map((s) => ({ preset: s.preset, pct: pct0(s.products[gi]?.pct) })),
  };
}

function reading(result, us) {
  if (!us) return 'Scores are percentages: 50% means exactly on target, above 50% better than the target, below 50% worse. Completion without a required rate, and the share of actions without mistakes, are plain shares with no target.';
  const marks = unique((result.groups ?? []).map((g) => g.product?.targetPct ?? null));
  return marks.length === 1 && marks[0] !== null
    ? `The overall score is the share of people who passed every check in every task they tried. The team agreed that at least ${pct0(marks[0])}% must pass.`
    : 'The overall score is the share of people who passed every check in every task they tried. No pass mark was agreed, so the score is not above or below a target.';
}

export function explainerFacts(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const us = isUs(result);
  const groups = (result.groups ?? []).map((g, gi) => groupFacts(g, result, gi, l, us));
  const single = groups.length === 1;
  const caveats = [...(result.qa?.warnings ?? [])].map((w) => (w.where ? `${w.where}: ${w.message}` : w.message));
  // With several groups (designs), there is no one overall result: each group has its own, and the comparison says
  // how far apart they are and whether the range of the difference excludes zero.
  const comparison = (result.comparison ?? []).map((c) => {
    const ci = c.ci ? c.ci.map(pct0) : null;
    const verdict = !c.ci ? 'no-range' : c.ci[0] > 0 ? 'higher' : c.ci[1] < 0 ? 'lower' : 'uncertain';
    return { group: c.group, vs: c.vs, diffPoints: pct0(c.diff), ci, verdict, design: c.design ?? 'independent' };
  });
  // Per-task verdicts, so a sentence about one task is checked against that task, not the overall score.
  const taskVerdicts = single ? Object.fromEntries(groups[0].tasks.filter((t) => t.sum).map((t) => [t.task, t.sum.verdict])) : {};
  return {
    lang, study: result.contract?.study ?? null,
    method: { preset: result.method.preset, plain: PLAIN_METHOD[result.method.preset] ?? result.method.string, string: result.method.string },
    overall: single ? groups[0].overall : null, taskVerdicts, groups, tasks: single ? groups[0].tasks : [],
    ...(comparison.length ? { comparison } : {}),
    sensitivity: single ? groups[0].sensitivity : [],
    methodDependent: result.methodDependent ?? false,
    caveats, suggestions: result.choice?.suggestions ?? [],
    reading: reading(result, us),
  };
}
