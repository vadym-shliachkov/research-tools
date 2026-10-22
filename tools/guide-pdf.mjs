#!/usr/bin/env node
// Prints a long-form guide (Markdown with TeX math, Mermaid and GitHub callouts) to PDF in the uxr design system:
// report.css for the tokens, tools/guide.css for the long-form layout. The PDF is written next to the .md file.
//   node tools/guide-pdf.mjs guides/sum-research.md guides/sum-research.ua.md
// Markdown conventions:
//   # Title: subtitle          the cover; the part after the colon is the subtitle
//   <!-- guide: {...} -->      cover settings: kicker, and curve { z, label } for the cover figure
//   ## Chapter: subtitle       a chapter on a new page, numbered
//   ### Section / #### Step    numbered sections; steps of a worked example
//   > [!TIP|WARNING|IMPORTANT|NOTE] callouts; any other quote is a pull quote
//   \[ … \] and \( … \)        TeX; ```excel recipes; ```mermaid figures
//   <!-- references -->        the numbered list after it is a bibliography: in each item, the citation paragraph,
//                              then a paragraph of links, then the access note, then why to read it
//   [[n](#ref-n)]              a citation in the text, linked to entry n of the bibliography
// Rendering happens in headless Chrome with marked, KaTeX and Mermaid from a CDN, so it needs a network connection.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser, printPdf } from '../plugins/uxr/scripts/lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(ROOT, 'plugins/uxr/templates/report.css'), 'utf8')
  + fs.readFileSync(path.join(ROOT, 'tools/guide.css'), 'utf8');
const LIB = {
  marked: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  katex: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  katexCss: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
};
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Serif:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono&display=swap';

const UI = {
  en: {
    contents: 'Contents', howto: 'How to read this review', step: 'Step', onTarget: 'on target',
    labels: { tip: 'Recommendation', warning: 'Watch out', caution: 'Watch out', important: 'Key point', note: 'Note' },
    legend: [
      ['tip', 'Recommendation', 'What I would do in practice.'],
      ['warning', 'Watch out', 'A trap that changes the result.'],
      ['important', 'Key point', 'The idea to keep from the section.'],
      ['note', 'Note', 'How to read a number or an example.'],
      ['recipe-key', 'Excel', 'A formula for Excel or Google Sheets.'],
      ['calc-key', 'Calculation', 'One worked calculation, read top to bottom.'],
    ],
  },
  ua: {
    contents: 'Зміст', howto: 'Як читати цей огляд', step: 'Крок', onTarget: 'на рівні цілі',
    labels: { tip: 'Рекомендація', warning: 'Обережно', caution: 'Обережно', important: 'Головне', note: 'Примітка' },
    legend: [
      ['tip', 'Рекомендація', 'Що я б робив на практиці.'],
      ['warning', 'Обережно', 'Пастка, що змінює результат.'],
      ['important', 'Головне', 'Думка, яку варто винести з розділу.'],
      ['note', 'Примітка', 'Як читати число чи приклад.'],
      ['recipe-key', 'Excel', 'Формула для Excel або Google Sheets.'],
      ['calc-key', 'Розрахунок', 'Один розрахунок, читається згори донизу.'],
    ],
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const splitTitle = (t) => {
  const i = t.indexOf(':');
  if (i < 0) return [t, ''];
  const sub = t.slice(i + 1).trim();
  return [t.slice(0, i), sub && sub[0].toUpperCase() + sub.slice(1)];
};

// The cover figure: the standard normal curve over a z ruler, shaded up to the example's z, which is the percentile
// SUM reports. White on the accent band.
function coverCurve(curve, ui) {
  const W = 600, H = 142, base = 104, cx = 300, unit = 80;
  const x = (z) => cx + z * unit;
  const y = (z) => base - 82 * Math.exp(-z * z / 2);
  const pts = (a, b) => Array.from({ length: 121 }, (_, i) => a + (b - a) * i / 120).map((z) => `${x(z).toFixed(1)},${y(z).toFixed(1)}`);
  const z = curve?.z;
  const shade = Number.isFinite(z) ? `<polygon points="${x(-3.6)},${base} ${pts(-3.6, z).join(' ')} ${x(z)},${base}" fill="#fff" fill-opacity="0.16"/>`
    + `<line x1="${x(z)}" y1="${y(z) - 14}" x2="${x(z)}" y2="${base}" stroke="#fff" stroke-width="1.5"/>`
    + `<text x="${x(z) + 6}" y="${y(z) - 6}" font-size="11" font-weight="600" fill="#fff">${esc(curve.label ?? '')}</text>` : '';
  const ticks = [];
  for (let t = -3.5; t <= 3.5; t += 0.5) {
    const major = Number.isInteger(t);
    ticks.push(`<line x1="${x(t)}" y1="${base}" x2="${x(t)}" y2="${base + (major ? 7 : 4)}" stroke="#fff" stroke-opacity="${major ? 0.8 : 0.45}"/>`);
    if (major) ticks.push(`<text x="${x(t)}" y="${base + 19}" font-size="10" text-anchor="middle" fill="#fff" fill-opacity="0.8">${t > 0 ? '+' : ''}${String(t).replace('-', '−')}</text>`);
  }
  return `<svg class="cover-curve" viewBox="0 0 ${W} ${H}" font-family="IBM Plex Sans, Segoe UI, sans-serif" aria-hidden="true">`
    + `<line x1="${x(-3.6)}" y1="${base}" x2="${x(3.6)}" y2="${base}" stroke="#fff" stroke-opacity="0.8"/>`
    + `${shade}<polyline points="${pts(-3.6, 3.6).join(' ')}" fill="none" stroke="#fff" stroke-width="1.6"/>${ticks.join('')}`
    + `<text x="${x(0)}" y="${base + 30}" font-size="9" text-anchor="middle" fill="#fff" fill-opacity="0.7">0 = ${esc(ui.onTarget)}</text></svg>`;
}

export function buildHtml(mdText, lang) {
  const ui = UI[lang] ?? UI.en;
  let md = mdText.replace(/\r\n/g, '\n').replace(/\s*\uE200cite[^\uE201]*\uE201/g, '');
  const conf = JSON.parse(/<!-- guide: ([\s\S]*?) -->/.exec(md)?.[1] ?? '{}');
  md = md.replace(/<!-- guide: [\s\S]*? -->\n?/, '');
  const h1 = /^# (.+)$/m.exec(md)?.[1] ?? '';
  md = md.replace(/^# .+\n/m, '');
  const [title, sub] = splitTitle(h1);

  // TeX stays away from the Markdown parser: placeholders outside fenced code.
  const math = [];
  md = md.split(/(```[\s\S]*?```)/).map((part, i) => (i % 2 ? part : part
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, t) => `\n\nMATHB${math.push(t) - 1}Z\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, t) => `MATHI${math.push(t) - 1}Z`))).join('');

  const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
  const date = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="${lang === 'ua' ? 'uk' : 'en'}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${LIB.katexCss}">
<style>${CSS}</style>
<style id="pages"></style>
<script src="${LIB.marked}"></script>
<script src="${LIB.katex}"></script>
<script src="${LIB.mermaid}"></script>
</head>
<body>
<section class="cover">
  <div class="cover-band">
    <p class="cover-top"><span>${esc(conf.kicker ?? '')}</span><span>${date}</span></p>
    <h1>${esc(title)}</h1>
    ${sub ? `<p class="cover-sub">${esc(sub)}</p>` : ''}
    ${conf.curve ? coverCurve(conf.curve, ui) : ''}
  </div>
  <div class="cover-body">
    <h2>${esc(ui.contents)}</h2>
    <ol class="toc" id="toc"></ol>
    <h2>${esc(ui.howto)}</h2>
    <div class="legend">${ui.legend.map(([k, b, t]) => `<div class="${k}"><b>${esc(b)}</b>${esc(t)}</div>`).join('')}</div>
  </div>
</section>
<main id="content"></main>
<script>
const MD = ${json(md)};
const MATH = ${json(math)};
const UI = ${json({ step: ui.step, labels: ui.labels, title })};
const tex = (i, display) => katex.renderToString(MATH[i], { displayMode: display, throwOnError: false, strict: 'ignore' });
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const text = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const splitTitle = ${splitTitle.toString()};

const tmp = el('div', null, marked.parse(MD, { gfm: true })
  .replace(/<p>MATHB(\\d+)Z<\\/p>/g, (_, i) => '<div class="math-block">' + tex(+i, true) + '</div>')
  .replace(/MATH([BI])(\\d+)Z/g, (_, k, i) => tex(+i, k === 'B')));

// Chapters: one section per h2, each on its own named page so the running header can name it.
const chapters = [];
for (const node of [...tmp.childNodes]) {
  if (node.nodeName === 'H2') chapters.push({ h2: node, nodes: [] });
  else if (chapters.length && (node.nodeType === 1 || node.nodeType === 8)) chapters.at(-1).nodes.push(node);
}
const N = chapters.length;
const ruler = (n) => {
  const w = 600, pad = 6, step = (w - 2 * pad) / (N - 1 || 1), xs = (i) => pad + i * step;
  let s = '<svg class="ruler" viewBox="0 0 ' + w + ' 26" font-family="IBM Plex Sans, sans-serif" aria-hidden="true">'
    + '<line x1="' + pad + '" y1="8" x2="' + (w - pad) + '" y2="8" stroke="#d5dbe4"/>';
  for (let i = 0; i < N; i++) {
    for (let m = 1; m < 5 && i < N - 1; m++) s += '<line x1="' + (xs(i) + m * step / 5) + '" y1="8" x2="' + (xs(i) + m * step / 5) + '" y2="11" stroke="#d5dbe4"/>';
    const on = i === n - 1;
    s += on ? '<line x1="' + pad + '" y1="8" x2="' + xs(i) + '" y2="8" stroke="#1f3a5f" stroke-width="2"/><circle cx="' + xs(i) + '" cy="8" r="4" fill="#1f3a5f"/>'
      : '<line x1="' + xs(i) + '" y1="4" x2="' + xs(i) + '" y2="12" stroke="' + (i < n - 1 ? '#1f3a5f' : '#aab3c2') + '"/>';
    s += '<text x="' + xs(i) + '" y="24" font-size="9" text-anchor="' + (i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle') + '" fill="' + (on ? '#1f3a5f' : '#7d8799') + '" font-weight="' + (on ? 600 : 400) + '">' + (i + 1) + '</text>';
  }
  return s + '</svg>';
};

const content = document.getElementById('content');
const toc = document.getElementById('toc');
let pageCss = '';
chapters.forEach(({ h2, nodes }, ci) => {
  const n = ci + 1;
  const [main, sub] = splitTitle(h2.textContent);
  // The running header has room for about 45 characters; a longer title is cut at a word.
  const short = main.length <= 45 ? main : main.slice(0, 45).replace(/\\s+\\S*$/, '') + '…';
  const sec = el('section', 'chapter');
  sec.style.page = 'ch' + n;
  pageCss += '@page ch' + n + ' { @top-left { content: ' + JSON.stringify(UI.title) + '; font: 8pt "IBM Plex Sans", sans-serif; color: #7d8799; } '
    + '@top-right { content: ' + JSON.stringify(n + '   ' + short) + '; font: 600 8pt "IBM Plex Sans", sans-serif; color: #1f3a5f; } }\\n';
  sec.appendChild(el('header', 'chapter-head', '<div class="chapter-num">' + n + '</div><div><h2>' + text(main) + '</h2>'
    + (sub ? '<p class="chapter-sub">' + text(sub) + '</p>' : '') + '</div>' + ruler(n)));
  toc.appendChild(el('li', null, '<span class="n">' + n + '</span><span class="t">' + text(main) + (sub ? '<span class="s">' + text(sub) + '</span>' : '') + '</span>'));

  let h3n = 0, h4n = 0, lead = false, refs = false;
  const out = [];
  for (const node of nodes) {
    const tag = node.nodeName;
    if (node.nodeType === 8) { refs = node.textContent.trim() === 'references'; continue; }
    if (tag === 'OL' && refs) {
      refs = false;
      node.classList.add('refs');
      const roles = ['cite', 'links', 'access'];
      // Each entry is the target of the [n](#ref-n) citations in the text.
      [...node.children].forEach((li, n) => {
        li.id = 'ref-' + (n + 1);
        [...li.children].forEach((p, i) => p.classList.add(roles[i] ?? 'why'));
      });
    } else if (tag === 'H3') { h3n++; h4n = 0; lead = true; node.insertAdjacentHTML('afterbegin', '<span class="num">' + n + '.' + h3n + '</span>'); }
    else if (tag === 'H4') { h4n++; node.insertAdjacentHTML('afterbegin', '<span class="num">' + UI.step + ' ' + h4n + '</span>'); }
    else if (tag === 'P' && !lead) { node.classList.add('lead'); lead = true; }
    else if (tag === 'P' && /[:：]$/.test(node.textContent.trim())) node.classList.add('leadin');
    else if (tag === 'BLOCKQUOTE') {
      const first = node.querySelector('p');
      const m = first && /^\\[!(\\w+)\\]\\s*/.exec(first.innerHTML);
      if (m) {
        const kind = m[1].toLowerCase();
        first.innerHTML = first.innerHTML.slice(m[0].length);
        out.push(Object.assign(el('div', 'callout ' + kind), { innerHTML: '<span class="rail">' + text(UI.labels[kind] ?? kind) + '</span>' + node.innerHTML }));
        continue;
      }
      node.classList.add('quote');
      node.insertAdjacentHTML('afterbegin', '<span class="rail">“</span>');
    } else if (tag === 'PRE') {
      const code = node.querySelector('code');
      const kind = (code.className.match(/language-(\\w+)/) || [])[1];
      if (kind === 'mermaid') {
        // Hexagons instead of diamonds for decisions: same meaning, a third of the height.
        out.push(el('div', 'figure mermaid-src', null));
        out.at(-1).textContent = code.textContent.replace(/\\{"([^"]*)"\\}/g, '{{"$1"}}');
        continue;
      }
      // A lead-in that only says "Excel:" is what the rail label says.
      const prev = out.at(-1);
      if (prev && prev.nodeName === 'P' && prev.textContent.length <= 28 && /:$/.test(prev.textContent.trim()) && /excel|spreadsheet|sheets|таблиц/i.test(prev.textContent)) out.pop();
      const card = el('div', 'recipe');
      if (kind === 'excel') card.appendChild(el('span', 'rail', 'Excel'));
      card.appendChild(node);
      out.push(card);
      continue;
    } else if (tag === 'P' && /^→/.test(node.textContent.trim()) && out.at(-1)?.classList?.contains('recipe')) {
      out.at(-1).appendChild(el('div', 'out', node.innerHTML));
      continue;
    } else if (tag === 'TABLE') {
      if (node.querySelectorAll('thead th').length > 3) node.classList.add('wide');
    }
    out.push(node);
  }

  // A calculation: from the first formula to the last, with the short lead-ins before and between them ("A:", "So:").
  const isMath = (e) => e.classList?.contains('math-block');
  const isLink = (e) => e.nodeName === 'P' && !e.classList.contains('lead') && e.textContent.trim().length <= 48 && /[:：]$/.test(e.textContent.trim());
  for (let i = 0; i < out.length; i++) {
    if (!isMath(out[i])) { sec.appendChild(out[i]); continue; }
    let j = i;
    for (let k = i + 1; k < out.length && (isMath(out[k]) || isLink(out[k])); k++) if (isMath(out[k])) j = k;
    const calc = el('div', 'calc');
    if (sec.lastChild && isLink(sec.lastChild)) calc.appendChild(sec.lastChild);
    for (let k = i; k <= j; k++) calc.appendChild(out[k]);
    sec.appendChild(calc);
    i = j;
  }
  content.appendChild(sec);
});
document.getElementById('pages').textContent = pageCss;
toc.style.gridTemplateRows = 'repeat(' + Math.ceil(N / 2) + ', auto)';

// Typographic quotes and apostrophes in prose; code, formulas and figures keep their straight ones.
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) =>
  t.parentElement.closest('code, pre, .katex, .mermaid-src, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
for (let t; (t = walker.nextNode());) {
  t.nodeValue = t.nodeValue.replace(/(^|[\\s([{—–-])"/g, '$1“').replace(/"/g, '”').replace(/(\\p{L})'(\\p{L})/gu, '$1’$2').replace(/(\\p{L})'(?=[\\s.,;:)]|$)/gu, '$1’');
}

mermaid.initialize({ startOnLoad: false, theme: 'base', flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: false, nodeSpacing: 30, rankSpacing: 34, padding: 10 },
  themeVariables: { fontFamily: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif', fontSize: '13px', primaryColor: '#ffffff',
    primaryBorderColor: '#aab3c2', primaryTextColor: '#1d2433', lineColor: '#7d8799', edgeLabelBackground: '#ffffff' } });
// Mermaid sizes boxes from measured text, so the web fonts load first; one diagram at a time, each with its own id.
document.fonts.ready.then(async () => {
  const boxes = [...document.querySelectorAll('.mermaid-src')];
  for (const [i, box] of boxes.entries()) box.innerHTML = (await mermaid.render('figure' + i, box.textContent)).svg;
});
</script>
</body>
</html>
`;
}

const countPages = (pdf) => (fs.readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node tools/guide-pdf.mjs <guide.md> [...]'); process.exit(1); }
  const browser = findBrowser();
  if (!browser) { console.error('No Chrome, Edge or Chromium found. Set CHROME_PATH.'); process.exit(1); }
  for (const file of files) {
    const lang = file.endsWith('.ua.md') ? 'ua' : 'en';
    const html = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-guide-')), path.basename(file).replace(/\.md$/, '.html'));
    fs.writeFileSync(html, buildHtml(fs.readFileSync(file, 'utf8'), lang));
    const pdf = file.replace(/\.md$/, '.pdf');
    // The libraries come from a CDN; a slow load prints a near-empty document, so check the page count and retry.
    let pages = 0;
    // An old PDF left in place would pass the check, so remove it first (this also fails loudly when a viewer locks it).
    for (let i = 0; i < 4 && pages < 5; i++) { fs.rmSync(pdf, { force: true }); printPdf(browser, html, pdf); pages = countPages(pdf); }
    if (pages < 5) { console.error(`${file}: only ${pages} pages printed; check the network and ${html}`); process.exit(1); }
    console.log(`${pdf}  ${pages} pages  (HTML: ${html})`);
  }
}
