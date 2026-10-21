// A mechanical first pass over reader-facing text (EN or UA). The editor agent decides what to change; this only
// points at likely problems: long sentences and paragraphs, unexplained statistics jargon, code-like fragments, and
// English words left in Ukrainian text.

const MAX_SENTENCE_WORDS = 25;
const MAX_PARAGRAPH_WORDS = 90;

// EN terms match as whole words; UA terms are stems, because Ukrainian inflects them.
const JARGON = {
  en: [
    ['z-score', /\bz[- ]scores?\b/i], ['standard deviation', /\bstandard deviations?\b/i], ['SD', /\bSD\b/],
    ['percentile', /\bpercentiles?\b/i], ['sigma', /\bsigma\b/i], ['bootstrap', /\bbootstrap\w*/i],
    ['confidence interval', /\bconfidence intervals?\b/i], ['CI', /\bCI\b/], ['Laplace', /\bLaplace\b/i],
    ['logarithm', /\blogarithm\w*|\blog\b/i], ['geometric mean', /\bgeometric mean\b/i], ['Cronbach', /\bCronbach\b/i],
    ['alpha', /\balpha\b/i], ['normal distribution', /\bnormal distribution\b/i], ['variance', /\bvariances?\b/i],
    ['standardized', /\bstandardi[sz]\w*/i], ['specification limit', /\bspec(?:ification)? limits?\b/i],
    ['Φ', /Φ/], ['p-value', /\bp-values?\b/i], ['statistically significant', /\bstatistically significant\b/i],
    ['SUM', /\bSUM\b/],
  ],
  ua: [
    ['z-оцінка', /z-оцін/i], ['стандартне відхилення', /стандартн\S* відхилен/i], ['перцентиль', /перцентил|процентил/i],
    ['сигма', /сигм/i], ['бутстреп', /бутстр[еа]п/i], ['довірчий інтервал', /довірч/i], ['логарифм', /логарифм/i],
    ['геометричне середнє', /геометричн/i], ['Кронбах', /кронбах/i], ['альфа', /альф/i], ['нормальний розподіл', /нормальн\S* розподіл/i],
    ['дисперсія', /дисперсі/i], ['стандартизація', /стандартизов|стандартизац/i], ['Φ', /Φ/], ['SUM', /\bSUM\b/],
  ],
};

const CODE_LIKE = [
  /`[^`]+`/, /\b[\w-]+\.(?:json|csv|tsv|mjs|js|md|html?|pdf|xlsx)\b/i, /\|/, /(?:^|\s)--[a-z][\w-]*/i,
  /\b[a-z]+_[a-z_]+\b/, /\bSUM\d\b|\bSUM\[/, /\b(?:zmean|pctmean|pct-mean|z-mean)\b/i,
];
const LATIN_OK = new Set(['SUM', 'PDF', 'HTML', 'ID', 'UX', 'QA']);

const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const sentences = (s) => s.split(/(?<=[.!?…])\s+/).filter((x) => x.trim());

function texts(doc) {
  const out = [];
  if (doc.headline?.sentence) out.push({ where: 'headline', text: doc.headline.sentence, prose: true });
  if (doc.headline?.label) out.push({ where: 'headline.label', text: doc.headline.label, prose: false });
  for (const s of doc.sections ?? []) {
    out.push({ where: `${s.id}.heading`, text: s.heading ?? '', prose: false });
    (s.paragraphs ?? []).forEach((p, i) => out.push({ where: `${s.id}[${i}]`, text: p, prose: true }));
    (s.items ?? []).forEach((it, i) => out.push({ where: `${s.id}.items[${i}]`, text: [it.label, it.text].filter(Boolean).join(': '), prose: true }));
  }
  for (const g of doc.glossary ?? []) out.push({ where: `glossary:${g.term}`, text: g.definition ?? '', prose: true, glossary: true });
  return out;
}

export function checkReadability(doc) {
  const lang = doc.lang === 'ua' ? 'ua' : 'en';
  const glossary = (doc.glossary ?? []).map((g) => String(g.term).toLowerCase());
  const explained = (label, re) => glossary.some((t) => re.test(t) || t.includes(label.toLowerCase()));
  const issues = [];
  const add = (code, where, text) => issues.push({ code, where, text: text.length > 140 ? `${text.slice(0, 137)}…` : text });

  for (const { where, text, prose, glossary: inGlossary } of texts(doc)) {
    if (prose) {
      for (const s of sentences(text)) if (words(s).length > MAX_SENTENCE_WORDS) add('long-sentence', where, s);
      if (words(text).length > MAX_PARAGRAPH_WORDS) add('long-paragraph', where, text);
    }
    if (CODE_LIKE.some((re) => re.test(text))) add('code-like', where, text);
    if (!inGlossary) {
      for (const [label, re] of JARGON[lang]) if (re.test(text) && !explained(label, re)) add('jargon', where, `${label}: ${text}`);
    }
    if (lang === 'ua') {
      const latin = (text.match(/\b[A-Za-z][A-Za-z-]{2,}\b/g) ?? []).filter((w) => !LATIN_OK.has(w) && !glossary.some((t) => t.includes(w.toLowerCase())));
      if (latin.length) add('untranslated', where, latin.join(', '));
    }
  }
  const counts = issues.reduce((c, i) => ({ ...c, [i.code]: (c[i.code] ?? 0) + 1 }), {});
  return { issues, counts };
}
