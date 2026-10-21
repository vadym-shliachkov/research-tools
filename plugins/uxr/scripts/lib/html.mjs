// Shared HTML building blocks for uxr documents: escaping, the page shell with the design system, component bars,
// and writing a document to HTML and PDF.
import fs from 'node:fs';
import path from 'node:path';
import { printPdf } from './browser.mjs';

const CSS = fs.readFileSync(new URL('../../templates/report.css', import.meta.url), 'utf8');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Serif:wght@600&display=swap">';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const htmlLang = (lang) => (lang === 'ua' ? 'uk' : 'en');

export function page({ lang = 'en', title, bandTitle, bandMeta = [], body }) {
  const meta = bandMeta.map((m) => `<span>${esc(m)}</span>`).join('');
  return `<!doctype html>
<html lang="${htmlLang(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${FONTS}
<style>${CSS}</style>
</head>
<body>
<header class="band"><h1 class="band-name">${esc(bandTitle ?? title)}</h1><p class="band-meta">${meta}</p></header>
${body}
</body>
</html>
`;
}

const clamp = (x) => Math.max(0, Math.min(1, x));
const pctText = (x) => `${Math.round(x * 100)}%`;

// rows: [{ label, sub, pct, ci: [lo, hi] | null }]. The fill shows the score, the line at 50% is "on target".
export function bars(rows) {
  return `<div class="bars">${rows.map((r) => {
    const cls = r.pct < 0.5 ? 'below' : 'above';
    const ci = r.ci && r.ci.every(Number.isFinite)
      ? `<span class="ci" style="left:${(clamp(r.ci[0]) * 100).toFixed(1)}%;width:${((clamp(r.ci[1]) - clamp(r.ci[0])) * 100).toFixed(1)}%"></span>` : '';
    return `<div class="label">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>`
      + `<div class="track"><span class="fill ${cls}" style="width:${(clamp(r.pct) * 100).toFixed(1)}%"></span><span class="mid"></span>${ci}</div>`
      + `<div class="value">${pctText(r.pct)}</div>`;
  }).join('')}</div>`;
}

// Writes the HTML and prints it to PDF next to it. Returns the PDF path, or null with a warning when it cannot print.
export function writeDocument(html, htmlPath, browser, warnings) {
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html);
  const pdfPath = htmlPath.replace(/\.html$/, '.pdf');
  fs.rmSync(pdfPath, { force: true });
  if (!browser) {
    warnings.push(`No Chrome, Edge or Chromium browser was found, so only ${path.basename(htmlPath)} was written. Set CHROME_PATH to print the PDF.`);
    return null;
  }
  try {
    printPdf(browser, htmlPath, pdfPath);
  } catch (e) {
    warnings.push(`PDF printing failed (${e.message.trim()}); wrote ${path.basename(htmlPath)} only.`);
    return null;
  }
  return pdfPath;
}
