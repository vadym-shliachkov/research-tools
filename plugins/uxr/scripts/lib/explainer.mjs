// The "How to understand your results" document: its required structure, the guard that an edit kept every number
// and section, and the HTML that is printed to PDF.
import { esc, page, bars } from './html.mjs';

export const REQUIRED_SECTIONS = ['measured', 'result', 'components', 'range', 'fix-first', 'limits'];

const UI = {
  en: { glossary: 'Glossary', key: 'Each bar is a score from 0 to 100%. The vertical line marks the target, where there is one. Green means clearly on or above it, red clearly below it, and grey that we cannot tell yet or that there is no target. The thin black line shows the range the true value most likely falls in.', of: '/100' },
  ua: { glossary: 'Словник', key: 'Кожна смуга показує оцінку від 0 до 100%. Вертикальна лінія позначає ціль, якщо вона є. Зелений означає, що результат явно на рівні цілі або вище, червоний — явно нижче, сірий — що ми ще не можемо сказати напевно або що цілі немає. Тонка чорна лінія показує діапазон, у якому найімовірніше лежить справжнє значення.', of: '/100' },
};

export const VERDICTS = ['above', 'below', 'uncertain', 'no-range', 'no-target'];

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
  if (doc?.verdict !== undefined && !VERDICTS.includes(doc.verdict)) errors.push(`verdict must be one of ${VERDICTS.join(', ')} (copy facts.overall.verdict)`);
  return { errors };
}

const allText = (doc) => [
  doc.headline?.value, doc.headline?.label, doc.headline?.sentence,
  ...(doc.sections ?? []).flatMap((s) => [...(s.paragraphs ?? []), ...(s.items ?? []).flatMap((i) => [i.label, i.value, i.text])]),
].filter(Boolean).join('\n');
const apostrophes = (text) => text.replace(/[’ʼ`]/g, "'");
const digits = (text) => new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')));

// Numbers written as words count as kept ("eight of ten people finished" keeps 8 and 10), in English and Ukrainian.
const NUMBER_WORDS = (() => {
  const m = new Map();
  const enUnits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  enUnits.forEach((w, i) => m.set(w, i));
  for (const [w, v] of Object.entries({ twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 })) {
    m.set(w, v);
    enUnits.slice(1, 10).forEach((u, i) => { m.set(`${w}-${u}`, v + i + 1); m.set(`${w} ${u}`, v + i + 1); });
  }
  m.set('hundred', 100);
  const uaUnits = [
    [1, 'один одна одне одного одної однієї одному одній'], [2, 'два дві двох двом'], [3, 'три трьох трьом'],
    [4, 'чотири чотирьох'], [5, "п'ять п'яти п'ятьох"], [6, 'шість шести шістьох'], [7, 'сім семи сімох'],
    [8, 'вісім восьми вісьмох'], [9, "дев'ять дев'яти дев'ятьох"],
  ];
  const uaTeens = ['одинадцят', 'дванадцят', 'тринадцят', 'чотирнадцят', "п'ятнадцят", 'шістнадцят', 'сімнадцят', 'вісімнадцят', "дев'ятнадцят"];
  for (const [v, forms] of uaUnits) for (const f of forms.split(' ')) m.set(f, v);
  for (const f of ['десять', 'десяти', 'десятьох']) m.set(f, 10);
  uaTeens.forEach((stem, i) => { for (const end of ['ь', 'и', 'ьох']) m.set(stem + end, 11 + i); });
  const uaTens = [[20, 'двадцять двадцяти'], [30, 'тридцять тридцяти'], [40, 'сорок сорока'], [50, "п'ятдесят п'ятдесяти"],
    [60, 'шістдесят шістдесяти'], [70, 'сімдесят сімдесяти'], [80, 'вісімдесят вісімдесяти'], [90, "дев'яносто"]];
  for (const [v, forms] of uaTens) {
    for (const f of forms.split(' ')) {
      m.set(f, v);
      for (const [u, uForms] of uaUnits) for (const uf of uForms.split(' ')) m.set(`${f} ${uf}`, v + u);
    }
  }
  m.set('сто', 100);
  return m;
})();
const NUMBER_WORD_RE = new RegExp(`(?<![\\p{L}'])(?:${[...NUMBER_WORDS.keys()].sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}'])`, 'giu');
const numberWords = (text) => new Set([...apostrophes(text).toLowerCase().matchAll(NUMBER_WORD_RE)].map((x) => String(NUMBER_WORDS.get(x[0]))));

// Claims that a score is above or below its target. For each verdict, the claims it does not support.
const CLAIMS = {
  en: {
    up: /(?:\b(?:is|are|was|were|lands?|sits?|scores?|scored)\s+|^\s*)(?:clearly\s+|well\s+|already\s+|now\s+|comfortably\s+|just\s+|slightly\s+)?(?:above|over|beyond)\s+(?:the\s+|our\s+|its\s+|your\s+|this\s+)?(?:target|goal|pass mark)\b|\b(?:beats?|beat|exceeds?|exceeded|surpass(?:es|ed)?|meets|met|reache[sd]|hits?)\s+(?:the\s+|our\s+|its\s+|your\s+)?(?:target|goal|pass mark)\b/gi,
    down: /(?:\b(?:is|are|was|were|lands?|sits?|scores?|scored|falls?|fell)\s+|^\s*)(?:clearly\s+|well\s+|already\s+|now\s+|just\s+|slightly\s+)?(?:below|under|short of)\s+(?:the\s+|our\s+|its\s+|your\s+|this\s+)?(?:target|goal|pass mark)\b|\b(?:misses|missed)\s+(?:the\s+|our\s+|its\s+|your\s+)?(?:target|goal|pass mark)\b/gi,
    hedge: /\b(?:whether|if|not|n't|cannot|looks?|seems?|appears?|may|might|could|probably|likely)\b/i,
  },
  ua: {
    up: /(?<!\p{L})(?:вищ(?:ий|а|е|і)\s+за\s+(?:ціль|прохідн\p{L}*)|вище\s+(?:цілі|прохідн\p{L}*)|перевищ\p{L}*\s+(?:ціль|прохідн\p{L}*)|досяг\p{L}*\s+(?:цілі|прохідн\p{L}*))/giu,
    down: /(?<!\p{L})(?:нижч(?:ий|а|е|і)\s+за\s+(?:ціль|прохідн\p{L}*)|нижче\s+(?:цілі|прохідн\p{L}*)|не\s+досяг\p{L}*\s+(?:цілі|прохідн\p{L}*))/giu,
    hedge: /(?<!\p{L})(?:чи|не можемо|ще не|невідомо|схоже|здається|можливо|ймовірно|мабуть)(?!\p{L})/iu,
  },
};
const UNSUPPORTED = { above: ['down'], below: ['up'], uncertain: ['up', 'down'], 'no-range': ['up', 'down'], 'no-target': ['up', 'down'] };

// The headline and the result section must state the overall verdict no more firmly than facts.overall.verdict.
// A claim is allowed when the same sentence hedges it before the claim ("we cannot tell whether it is above target").
export function verdictErrors(doc, verdict) {
  const kinds = UNSUPPORTED[verdict];
  if (!kinds) return [];
  const rules = CLAIMS[doc.lang] ?? CLAIMS.en;
  const result = (doc.sections ?? []).find((s) => s.id === 'result');
  const texts = [doc.headline?.sentence, ...(result?.paragraphs ?? []), ...(result?.items ?? []).map((i) => i.text)].filter(Boolean);
  const errors = [];
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      for (const kind of kinds) {
        for (const m of sentence.matchAll(rules[kind])) {
          if (rules.hedge.test(sentence.slice(0, m.index))) continue;
          errors.push(`"${sentence.trim()}" says the result ${kind === 'up' ? 'reaches or exceeds' : 'falls short of'} its target, but the verdict is "${verdict}". Say only what the verdict supports.`);
        }
      }
    }
  }
  return [...new Set(errors)];
}

// The editor may rewrite every sentence, but must keep the structure, every number and the verdict, add no number,
// and add its review.
export function checkEdit(draft, edited) {
  const errors = [...validateExplainer(edited).errors];
  const a = (draft.sections ?? []).map((s) => s.id).join(',');
  const b = (edited.sections ?? []).map((s) => s.id).join(',');
  if (a !== b) errors.push(`sections changed: [${a}] became [${b}]`);
  if (draft.lang !== edited.lang) errors.push(`lang changed from ${draft.lang} to ${edited.lang}`);
  if (draft.verdict !== edited.verdict) errors.push(`verdict changed from ${draft.verdict} to ${edited.verdict}; keep it as in the draft`);
  const before = allText(draft);
  const after = allText(edited);
  const kept = new Set([...digits(after), ...numberWords(after)]);
  const lost = [...digits(before)].filter((n) => !kept.has(n));
  if (lost.length) errors.push(`numbers dropped by the edit: ${lost.join(', ')}`);
  const known = new Set([...digits(before), ...numberWords(before)]);
  const added = [...digits(after)].filter((n) => !known.has(n));
  if (added.length) errors.push(`numbers added by the edit: ${added.join(', ')}; use only numbers from the draft`);
  errors.push(...verdictErrors(edited, draft.verdict));
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
