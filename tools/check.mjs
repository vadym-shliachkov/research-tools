#!/usr/bin/env node
// Repository consistency checks: both marketplaces list the same plugins, Claude and Codex manifests agree,
// every skill has valid frontmatter, and every human-facing EN doc has a UA twin with the same structure.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_DESCRIPTION = 1024; // Codex silently drops skills with longer descriptions.

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value === '|' || value === '>' || value === '>-' || value === '|-') {
      const block = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(value.startsWith('>') ? ' ' : '\n');
    } else if (/^(['"]).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    out[kv[1]] = value;
  }
  return out;
}

export function countHeadings(markdown) {
  let inFence = false;
  let count = 0;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    else if (!inFence && /^#{1,6}\s/.test(line)) count++;
  }
  return count;
}

function englishDocs(root) {
  const docs = ['README.md', 'CHANGELOG.md'].filter((f) => fs.existsSync(path.join(root, f)));
  const guides = path.join(root, 'guides');
  if (fs.existsSync(guides)) {
    for (const f of fs.readdirSync(guides)) if (f.endsWith('.md') && !f.endsWith('.ua.md')) docs.push(`guides/${f}`);
  }
  return docs;
}

export function checkRepo(root) {
  const errors = [];
  const claudeMp = path.join(root, '.claude-plugin', 'marketplace.json');
  const codexMp = path.join(root, '.agents', 'plugins', 'marketplace.json');
  if (!fs.existsSync(claudeMp)) errors.push('Missing .claude-plugin/marketplace.json');
  if (!fs.existsSync(codexMp)) errors.push('Missing .agents/plugins/marketplace.json');
  if (errors.length) return { errors };

  const claude = readJson(claudeMp);
  const codex = readJson(codexMp);
  if (claude.name !== codex.name) errors.push(`Marketplace names differ: "${claude.name}" vs "${codex.name}"`);
  const codexByName = new Map((codex.plugins ?? []).map((p) => [p.name, p]));

  for (const entry of claude.plugins ?? []) {
    const src = typeof entry.source === 'string' ? entry.source : null;
    if (!src) { errors.push(`${entry.name}: only relative-path sources are supported here`); continue; }
    const codexEntry = codexByName.get(entry.name);
    if (!codexEntry) errors.push(`${entry.name}: missing from the Codex marketplace`);
    else {
      const codexPath = typeof codexEntry.source === 'string' ? codexEntry.source : codexEntry.source?.path;
      if (path.normalize(codexPath ?? '') !== path.normalize(src)) errors.push(`${entry.name}: Codex marketplace path "${codexPath}" differs from "${src}"`);
    }
    const dir = path.join(root, src);
    const claudeManifest = path.join(dir, '.claude-plugin', 'plugin.json');
    const codexManifest = path.join(dir, '.codex-plugin', 'plugin.json');
    if (!fs.existsSync(claudeManifest)) { errors.push(`${entry.name}: missing .claude-plugin/plugin.json`); continue; }
    if (!fs.existsSync(codexManifest)) { errors.push(`${entry.name}: missing .codex-plugin/plugin.json`); continue; }
    const cm = readJson(claudeManifest);
    const xm = readJson(codexManifest);
    if (cm.name !== entry.name) errors.push(`${entry.name}: plugin.json name "${cm.name}" must equal the marketplace entry name`);
    if (xm.name !== cm.name) errors.push(`${entry.name}: Codex manifest name "${xm.name}" differs`);
    if (xm.version !== cm.version) errors.push(`${entry.name}: version differs between Claude (${cm.version}) and Codex (${xm.version}) manifests`);
    if (xm.description !== cm.description) errors.push(`${entry.name}: description differs between Claude and Codex manifests`);

    const skillsDir = path.join(dir, 'skills');
    if (!fs.existsSync(skillsDir)) continue;
    for (const skill of fs.readdirSync(skillsDir)) {
      const file = path.join(skillsDir, skill, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      const where = `${entry.name}/skills/${skill}`;
      if (!fm) { errors.push(`${where}: SKILL.md has no frontmatter`); continue; }
      if (fm.name !== skill) errors.push(`${where}: name "${fm.name}" must match its folder`);
      if (!fm.description) errors.push(`${where}: missing description`);
      else if (fm.description.length > MAX_DESCRIPTION) errors.push(`${where}: description is ${fm.description.length} characters (max ${MAX_DESCRIPTION})`);
    }
  }

  for (const doc of englishDocs(root)) {
    const twin = doc.replace(/\.md$/, '.ua.md');
    const twinPath = path.join(root, twin);
    if (!fs.existsSync(twinPath)) { errors.push(`${doc}: missing UA twin ${twin}`); continue; }
    const en = countHeadings(fs.readFileSync(path.join(root, doc), 'utf8'));
    const ua = countHeadings(fs.readFileSync(twinPath, 'utf8'));
    if (en !== ua) errors.push(`${twin}: ${ua} headings, but ${doc} has ${en}; the translation is out of date`);
  }
  return { errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { errors } = checkRepo(path.resolve(import.meta.dirname, '..'));
  if (errors.length) {
    console.error(errors.map((e) => `✖ ${e}`).join('\n'));
    process.exit(1);
  }
  console.log('✔ Repository checks passed');
}
