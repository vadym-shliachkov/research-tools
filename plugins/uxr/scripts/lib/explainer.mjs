// The "How to understand your results" document: its required structure, the guard that an edit kept every number
// and section, and the HTML that is printed to PDF.
import { esc, page, bars } from './html.mjs';

export const REQUIRED_SECTIONS = ['measured', 'result', 'components', 'range', 'fix-first', 'limits'];

const UI = {
  en: { glossary: 'Glossary', key: 'Each bar is a score from 0 to 100%. The line in the middle is the target: bars that reach past it are on or above target. The thin black line shows the range the true value most likely falls in.', of: '/100' },
  ua: { glossary: 'Словник', key: 'Кожна смуга показує оцінку від 0 до 100%. Лінія посередині означає ціль: смуга, що заходить за неї, досягла цілі або перевищила її. Тонка чорна лінія показує діапазон, у якому найімовірніше лежить справжнє значення.', of: '/100' },
};

export function validateExplainer(doc) {
  const errors = [];
  if (!['en', 'ua'].includes(doc?.lang)) errors.push('lang must be "en" or "ua"');
  if (!doc?.title) errors.push('title is missing');
  if (!doc?.headline?.value || !doc.headline.label || !doc.headline.sentence) errors.push('headline needs value, label and sentence');
  const ids = (doc?.sections ?? []).map((s) => s.id);
  for (const id of REQUIRED_SECTIONS) if (!ids.includes(id)) errors.push(`section "${id}" is missing`);
  for (const s of doc?.sections ?? []) {
    if (!s.heading) errors.push(`section "${s.id}" has no heading`);
    if (!(s.paragraphs?.length || s.items?.length)) errors.push(`section "${s.id}" has no text`);
  }
  if (!doc?.glossary?.length) errors.push('glossary is empty; every technical term left in the text needs an entry');
  return { errors };
}

const allText = (doc) => [
  doc.headline?.value, doc.headline?.label, doc.headline?.sentence,
  ...(doc.sections ?? []).flatMap((s) => [...(s.paragraphs ?? []), ...(s.items ?? []).flatMap((i) => [i.label, i.value, i.text])]),
].filter(Boolean).join('\n');
const numbers = (text) => new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')));

// The editor may rewrite every sentence, but must keep the structure, every number and add its review.
export function checkEdit(draft, edited) {
  const errors = [...validateExplainer(edited).errors];
  const a = (draft.sections ?? []).map((s) => s.id).join(',');
  const b = (edited.sections ?? []).map((s) => s.id).join(',');
  if (a !== b) errors.push(`sections changed: [${a}] became [${b}]`);
  if (draft.lang !== edited.lang) errors.push(`lang changed from ${draft.lang} to ${edited.lang}`);
  const kept = numbers(allText(edited));
  const lost = [...numbers(allText(draft))].filter((n) => !kept.has(n));
  if (lost.length) errors.push(`numbers dropped by the edit: ${lost.join(', ')}`);
  if (typeof edited.review?.readable !== 'boolean' || !Array.isArray(edited.review?.notes)) errors.push('review { readable: boolean, notes: [] } is missing');
  return { errors };
}

export function renderExplainerHtml(doc, { chart = null, date = new Date().toISOString().slice(0, 10) } = {}) {
  const ui = UI[doc.lang] ?? UI.en;
  const section = (s) => `<section id="${esc(s.id)}"><h2>${esc(s.heading)}</h2>`
    + (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('')
    + (s.items?.length ? `<ul>${s.items.map((i) => `<li>${i.label ? `<strong>${esc(i.label)}${i.value ? ` (${esc(i.value)})` : ''}:</strong> ` : ''}${esc(i.text)}</li>`).join('')}</ul>` : '')
    + '</section>';
  const sections = doc.sections ?? [];
  const first = sections.filter((s) => ['measured', 'result'].includes(s.id));
  const rest = sections.filter((s) => !['measured', 'result'].includes(s.id));
  const body = `<div class="glance"><div class="glance-head">`
    + `<div class="score"><span class="score-num">${esc(doc.headline.value)}</span><span class="score-of"></span><span class="score-label">${esc(doc.headline.label)}</span></div>`
    + `<p class="verdict">${esc(doc.headline.sentence)}</p></div></div>`
    + `<div class="content">${first.map(section).join('')}`
    + (chart?.length ? `${bars(chart)}<p class="bars-key">${esc(ui.key)}</p>` : '')
    + rest.map(section).join('')
    + `<section id="glossary"><h2>${esc(ui.glossary)}</h2><dl class="glossary">${(doc.glossary ?? []).map((g) => `<dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd>`).join('')}</dl></section>`
    + '</div>';
  return page({ lang: doc.lang, title: doc.title, bandTitle: doc.title, bandMeta: [doc.study ?? '', date], body });
}
