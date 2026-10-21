// Finds an installed Chrome, Edge or Chromium and prints an HTML file to PDF with it (shared with project-health).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function browserCandidates(env = process.env, platform = process.platform) {
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((r) => [
      path.win32.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.win32.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.win32.join(r, 'Chromium', 'Application', 'chrome.exe'),
    ]);
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge'];
}

export function findBrowser(env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (env.CHROME_PATH && exists(env.CHROME_PATH)) return env.CHROME_PATH;
  return browserCandidates(env, platform).find((p) => exists(p)) ?? null;
}

export function printPdf(browser, htmlFile, pdfFile, { timeoutMs = 120000 } = {}) {
  // Both paths absolute: Chrome resolves a relative --print-to-pdf path against its own folder.
  const htmlPath = path.resolve(htmlFile);
  const pdfPath = path.resolve(pdfFile);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-chrome-'));
  try {
    const r = spawnSync(browser, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profileDir}`, '--no-pdf-header-footer', '--print-to-pdf-no-header',
      `--print-to-pdf=${pdfPath}`, '--virtual-time-budget=10000', pathToFileURL(htmlPath).href,
    ], { timeout: timeoutMs, stdio: 'pipe' });
    if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size === 0) {
      throw new Error(`The browser (${path.basename(browser)}) exited with ${r.status ?? 'a timeout'} but wrote no PDF at ${pdfPath}.`);
    }
  } finally {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* browser may still hold files on Windows */ }
  }
}
