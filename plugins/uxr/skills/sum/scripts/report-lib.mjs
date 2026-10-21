// Turns a SUM result.json into report.md, report.html, the facts the explainer draft is written from, and the
// explainer chart. Every number comes from the result; nothing is recomputed here.
import { esc, page, bars } from '../../../scripts/lib/html.mjs';

const L = {
  en: {
    title: 'SUM report', completion: 'Completion', errors: 'Error-free rate', time: 'Time on task', satisfaction: 'Satisfaction',
    perceived_time: 'Perceived time', ease: 'Ease', sum: 'SUM', usability: 'Usability Score', overall: 'Overall SUM',
    overallUs: 'Overall Usability Score', task: 'Task', n: 'n', group: 'Group', range: '95% range', method: 'Method',
    why: 'Why this method', suggestions: 'Suggestions', sens: 'How much the method matters', chosen: 'chosen',
    notApplicable: 'not applicable', dependent: 'The verdict depends on the method: applicable methods differ by more than 10 points. Report the chosen method and say why.',
    stable: 'Applicable methods agree within 10 points; the verdict does not hinge on the method.', qa: 'Quality checks', none: 'No warnings.',
    details: 'Method details', generated: 'Generated', data: 'Data', participants: 'attempts', tasks: 'tasks', target: 'target',
    timeTarget: 'Time target', satTarget: 'Satisfaction target', benchmark: 'Completion benchmark', bootstrap: 'Ranges come from a participant bootstrap',
    samples: 'samples', seed: 'seed', of: 'of', finished: 'finished', geo: 'typical', vs: 'vs', passed: 'passed all four',
    threshold: 'threshold', on: 'on', from: 'from', alpha: 'Cronbach alpha',
    barsKey: 'Bars show each component as a percentage: 50% (the middle line) is exactly on target; green is at or above it, red below. Whiskers show the 95% range.',
    s: 's', dec: '.', vsTarget: 'vs target',
  },
  ua: {
    title: 'Звіт SUM', completion: 'Частка успішного виконання', errors: 'Частка дій без помилок', time: 'Час на завдання', satisfaction: 'Задоволеність',
    perceived_time: 'Відчуття часу', ease: 'Легкість', sum: 'SUM', usability: 'Оцінка зручності (Microsoft)', overall: 'Загальний SUM',
    overallUs: 'Загальна оцінка зручності', task: 'Завдання', n: 'n', group: 'Група', range: '95% діапазон', method: 'Метод',
    why: 'Чому цей метод', suggestions: 'Пропозиції', sens: 'Наскільки результат залежить від методу', chosen: 'обраний',
    notApplicable: 'не застосовний', dependent: 'Висновок залежить від методу: застосовні методи розходяться більш ніж на 10 пунктів. Повідомляйте обраний метод і пояснюйте чому.',
    stable: 'Застосовні методи розходяться не більш ніж на 10 пунктів; висновок не залежить від методу.', qa: 'Перевірки якості', none: 'Попереджень немає.',
    details: 'Деталі методу', generated: 'Створено', data: 'Дані', participants: 'спроб', tasks: 'завдань', target: 'ціль',
    timeTarget: 'Ціль за часом', satTarget: 'Ціль задоволеності', benchmark: 'Орієнтир успішності', bootstrap: 'Діапазони отримано бутстрепом за учасниками',
    samples: 'вибірок', seed: 'зерно', of: 'з', finished: 'виконали', geo: 'типово', vs: 'проти', passed: 'пройшли всі чотири умови',
    threshold: 'поріг', on: 'за шкалою', from: 'з', alpha: 'альфа Кронбаха',
    barsKey: 'Смуги показують кожну складову у відсотках: 50% (лінія посередині) означає рівно ціль; зелений колір — на рівні цілі або вище, червоний — нижче. Вуса показують 95% діапазон.',
    s: 'с', dec: ',', vsTarget: 'при цілі',
  },
};

const ORDER = ['completion', 'errors', 'time', 'satisfaction', 'perceived_time', 'ease'];
const pct1 = (x) => (Number.isFinite(x) ? `${(Math.round(x * 1000) / 10).toFixed(1)}%` : '—');
const pct0 = (x) => (Number.isFinite(x) ? Math.round(x * 100) : null);
const sec = (x, l = L.en) => `${Math.round(x)} ${l.s}`;
const zTxt = (z) => (Number.isFinite(z) ? `z ${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2)}` : 'z ∞');
const range = (ci) => (ci ? `${pct1(ci[0])}–${pct1(ci[1])}` : '—');
const num = (x, l = L.en) => String(Math.round(x * 100) / 100).replace('.', l.dec);
const isUs = (r) => r.method?.config?.kind === 'usability-score';

function cell(key, c, l, us) {
  if (!c) return '—';
  if (us) return `${pct1(c.pct)} (${c.x}/${c.n}${c.threshold !== undefined ? `, ≥${c.threshold}` : ''})`;
  if (key === 'completion') return `${pct1(c.p)} (${c.x}/${c.n}) · ${zTxt(c.z)}`;
  if (key === 'errors') return `${pct1(c.quality)} · ${zTxt(c.z)}`;
  if (key === 'time') return `${sec(c.log ? c.geoMean : c.mean, l)} ${l.vs} ${sec(c.target, l)} · ${zTxt(c.z)}`;
  if (key === 'satisfaction') return `${num(c.mean, l)} ${l.vs} ${num(c.target, l)} · ${zTxt(c.z)}`;
  return pct1(c.pct);
}

const presentKeys = (group) => ORDER.filter((k) => group.tasks.some((t) => t.components?.[k]));

export function buildReportMd(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const us = isUs(result);
  const study = result.contract?.study ?? '';
  const out = [`# ${l.title}${study ? `: ${study}` : ''}`, ''];
  const tasksN = result.groups?.[0]?.tasks.length ?? 0;
  out.push(`${l.generated} ${String(result.generated_at ?? '').slice(0, 10)} · ${l.method}: **${result.method.preset}** \`${result.method.string}\` · ${l.data}: ${tasksN} ${l.tasks}`, '');

  for (const g of result.groups ?? []) {
    if (g.group !== null) out.push(`## ${l.group} ${g.group}`, '');
    const keys = presentKeys(g);
    out.push(`| ${l.task} | ${l.n} | ${keys.map((k) => l[k]).join(' | ')} | ${us ? l.usability : l.sum} (${l.range}) |`);
    out.push(`|---|---:|${keys.map(() => '---|').join('')}---|`);
    for (const t of g.tasks) {
      const n = t.components?.completion?.n ?? t.sum?.n ?? '';
      out.push(`| ${t.task} | ${n} | ${keys.map((k) => cell(k, t.components?.[k], l, us)).join(' | ')} | ${t.sum ? `**${pct1(t.sum.pct)}** (${range(t.sum.ci)})` : '—'} |`);
    }
    out.push('');
    if (g.product) out.push(`**${us ? l.overallUs : l.overall}: ${pct1(g.product.pct)}** (${l.range} ${range(g.product.ci)})`, '');
  }

  if (result.choice) {
    out.push(`## ${l.why}`, '', ...result.choice.reasons.map((r) => `- **${r.decision}**: ${r.why}`), '');
    if (result.choice.suggestions?.length) out.push(`**${l.suggestions}:**`, '', ...result.choice.suggestions.map((s) => `- ${s}`), '');
  }

  if (result.sensitivity) {
    out.push(`## ${l.sens}`, '', `| ${l.method} | ${l.sum} |`, '|---|---:|');
    const chosen = result.groups.map((g) => pct1(g.product?.pct)).join(' / ');
    out.push(`| **${result.method.preset}** (${l.chosen}) | **${chosen}** |`);
    for (const s of result.sensitivity) {
      out.push(`| ${s.preset} | ${s.status === 'ok' ? s.products.map((p) => pct1(p.pct)).join(' / ') : `${l.notApplicable}: ${s.reason}`} |`);
    }
    out.push('', `> ${result.methodDependent ? l.dependent : l.stable}`, '');
  }

  out.push(`## ${l.qa}`, '');
  const qa = [...(result.qa?.errors ?? []), ...(result.qa?.warnings ?? [])];
  out.push(...(qa.length ? qa.map((w) => `- ${w.where ? `${w.where}: ` : ''}${w.message}`) : [l.none]), '');

  out.push(`## ${l.details}`, '', `- ${l.method}: \`${result.method.string}\``);
  for (const g of result.groups ?? []) {
    for (const t of g.tasks) {
      const c = t.components ?? {};
      const where = `${g.group !== null ? `${g.group} / ` : ''}${t.task}`;
      if (c.time) out.push(`- ${where}: ${l.timeTarget} ${sec(c.time.target, l)} (${c.time.targetSource})`);
      if (c.satisfaction) out.push(`- ${where}: ${l.satTarget} ${num(c.satisfaction.target, l)} ${l.on} ${c.satisfaction.scale.join('–')} (${l.from} ${c.satisfaction.from.join(' + ')})${c.satisfaction.alpha !== undefined ? `, ${l.alpha} ${num(c.satisfaction.alpha, l)}` : ''}`);
      if (c.completion?.benchmark !== undefined) out.push(`- ${where}: ${l.benchmark} ${pct1(c.completion.benchmark)}`);
    }
    if (g.bootstrap) out.push(`- ${l.bootstrap}: ${g.bootstrap.B} ${l.samples}, ${l.seed} ${g.bootstrap.seed}`);
  }
  out.push('');
  return out.join('\n');
}

function taskChart(t, l, us) {
  const rows = [];
  for (const k of ORDER) {
    const c = t.components?.[k];
    if (!c) continue;
    let sub = '';
    if (us) sub = `${c.x} ${l.of} ${c.n}`;
    else if (k === 'completion') sub = `${c.x} ${l.of} ${c.n} ${l.finished}`;
    else if (k === 'time') sub = `${sec(c.log ? c.geoMean : c.mean, l)} ${l.vsTarget} ${sec(c.target, l)}`;
    else if (k === 'satisfaction') sub = `${num(c.mean, l)} ${l.vsTarget} ${num(c.target, l)}`;
    else if (k === 'errors') sub = `${c.errors} / ${c.opportunities}`;
    const ci = (us || (k === 'completion' && c.benchmark === undefined)) && c.ci ? c.ci : null;
    rows.push({ label: l[k], sub, pct: c.pct, ci });
  }
  if (t.sum) rows.push({ label: us ? l.usability : l.sum, sub: us ? l.passed : '', pct: t.sum.pct, ci: t.sum.ci ?? null });
  return rows;
}

export function explainerChart(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const us = isUs(result);
  const g = result.groups?.[0];
  if (!g) return [];
  if (result.groups.length === 1 && g.tasks.length === 1) return taskChart(g.tasks[0], l, us);
  const rows = [];
  for (const grp of result.groups) {
    for (const t of grp.tasks) if (t.sum) rows.push({ label: `${grp.group !== null ? `${grp.group} · ` : ''}${t.task}`, pct: t.sum.pct, ci: t.sum.ci ?? null });
    if (grp.product) rows.push({ label: `${grp.group !== null ? `${grp.group} · ` : ''}${us ? l.overallUs : l.overall}`, pct: grp.product.pct, ci: grp.product.ci ?? null });
  }
  return rows;
}

export function buildReportHtml(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const md = buildReportMd(result, lang);
  const us = isUs(result);
  const g0 = result.groups?.[0];
  const head = g0?.product
    ? `<div class="glance"><div class="glance-head"><div class="score"><span class="score-num">${pct0(g0.product.pct)}</span><span class="score-of">%</span><span class="score-label">${esc(us ? l.overallUs : l.overall)}${g0.group !== null ? ` · ${esc(g0.group)}` : ''}</span></div>`
      + `<p class="verdict">${esc(l.range)}: ${esc(range(g0.product.ci))}<br><span class="meta">${esc(l.method)}: ${esc(result.method.preset)} · <code>${esc(result.method.string)}</code></span></p></div></div>`
    : '';
  const charts = (result.groups ?? []).map((g) => g.tasks.map((t) => `<h3>${esc(g.group !== null ? `${g.group} · ` : '')}${esc(t.task)}</h3>${bars(taskChart(t, l, us))}`).join('')).join('')
    + `<p class="bars-key">${esc(l.barsKey)}</p>`;
  const body = `${head}<div class="content"><section><h2>${esc(l.sum)}</h2>${charts}</section>${mdToHtml(md.split('\n').slice(4).join('\n'))}</div>`;
  return page({ lang, title: `${l.title}${result.contract?.study ? `: ${result.contract.study}` : ''}`, bandTitle: l.title, bandMeta: [result.contract?.study ?? '', String(result.generated_at ?? '').slice(0, 10)], body });
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

export function explainerFacts(result, lang = 'en') {
  const l = L[lang] ?? L.en;
  const us = isUs(result);
  const groups = (result.groups ?? []).map((g) => ({
    group: g.group,
    overall: g.product ? { pct: pct0(g.product.pct), ci: g.product.ci ? g.product.ci.map(pct0) : null } : null,
    tasks: g.tasks.map((t) => {
      const comps = Object.fromEntries(ORDER.filter((k) => t.components?.[k]).map((k) => {
        const c = t.components[k];
        const plain = us ? `${c.x} of ${c.n} people met it`
          : k === 'completion' ? `${c.x} of ${c.n} people finished`
            : k === 'time' ? `typical time ${Math.round(c.log ? c.geoMean : c.mean)} s against a target of ${Math.round(c.target)} s`
              : k === 'satisfaction' ? `average rating ${num(c.mean)} on a ${c.scale.join('–')} scale against a target of ${c.target}`
                : `${c.errors} mistakes in ${c.opportunities} chances to make one`;
        return [k, { label: l[k], pct: pct0(c.pct), onTarget: c.pct >= 0.5, plain }];
      }));
      const weakest = Object.entries(comps).sort((a, b) => a[1].pct - b[1].pct)[0];
      return { task: t.task, n: t.components?.completion?.n ?? t.sum?.n, sum: t.sum ? { pct: pct0(t.sum.pct), ci: t.sum.ci ? t.sum.ci.map(pct0) : null } : null, components: comps, weakest: weakest ? { key: weakest[0], ...weakest[1] } : null };
    }),
  }));
  const caveats = [...(result.qa?.warnings ?? [])].map((w) => w.message);
  return {
    lang, study: result.contract?.study ?? null,
    method: { preset: result.method.preset, plain: PLAIN_METHOD[result.method.preset] ?? result.method.string, string: result.method.string },
    overall: groups[0]?.overall, groups, tasks: groups[0]?.tasks ?? [],
    sensitivity: (result.sensitivity ?? []).filter((s) => s.status === 'ok').map((s) => ({ preset: s.preset, pct: pct0(s.products[0].pct) })),
    methodDependent: result.methodDependent ?? false,
    caveats, suggestions: result.choice?.suggestions ?? [],
    reading: 'Scores are percentages: 50% means exactly on target, above 50% better than the target, below 50% worse.',
  };
}
