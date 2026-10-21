import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../tools/check.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function tmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxr-check-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

function minimalRepo(overrides = {}) {
  return {
    '.claude-plugin/marketplace.json': { name: 'm', owner: { name: 'o' }, plugins: [{ name: 'p', source: './plugins/p', description: 'd' }] },
    '.agents/plugins/marketplace.json': { name: 'm', plugins: [{ name: 'p', source: { source: 'local', path: './plugins/p' } }] },
    'plugins/p/.claude-plugin/plugin.json': { name: 'p', version: '1.0.0', description: 'd' },
    'plugins/p/.codex-plugin/plugin.json': { name: 'p', version: '1.0.0', description: 'd', skills: './skills/' },
    'plugins/p/skills/s/SKILL.md': '---\nname: s\ndescription: Does a thing.\n---\n\n# S\n',
    'README.md': '# R\n\n## A\n',
    'README.ua.md': '# Р\n\n## А\n',
    ...overrides,
  };
}

test('the real repository passes', () => {
  const { errors } = checkRepo(ROOT);
  assert.deepEqual(errors, []);
});

test('a minimal consistent repo passes', () => {
  assert.deepEqual(checkRepo(tmpRepo(minimalRepo())).errors, []);
});

test('codex and claude versions must match', () => {
  const dir = tmpRepo(minimalRepo({ 'plugins/p/.codex-plugin/plugin.json': { name: 'p', version: '1.0.1', description: 'd', skills: './skills/' } }));
  assert.match(checkRepo(dir).errors.join('\n'), /version/);
});

test('a plugin missing from the codex marketplace is reported', () => {
  const dir = tmpRepo(minimalRepo({ '.agents/plugins/marketplace.json': { name: 'm', plugins: [] } }));
  assert.match(checkRepo(dir).errors.join('\n'), /codex marketplace/i);
});

test('skill description over 1024 characters is reported', () => {
  const long = 'x'.repeat(1025);
  const dir = tmpRepo(minimalRepo({ 'plugins/p/skills/s/SKILL.md': `---\nname: s\ndescription: ${long}\n---\n` }));
  assert.match(checkRepo(dir).errors.join('\n'), /1024/);
});

test('skill name must match its folder', () => {
  const dir = tmpRepo(minimalRepo({ 'plugins/p/skills/s/SKILL.md': '---\nname: other\ndescription: d\n---\n' }));
  assert.match(checkRepo(dir).errors.join('\n'), /folder/);
});

test('an EN doc without a UA twin is reported', () => {
  const files = minimalRepo();
  delete files['README.ua.md'];
  assert.match(checkRepo(tmpRepo(files)).errors.join('\n'), /README\.ua\.md/);
});

test('a UA twin with a different heading count is reported', () => {
  const dir = tmpRepo(minimalRepo({ 'README.ua.md': '# Р\n' }));
  assert.match(checkRepo(dir).errors.join('\n'), /headings/);
});

test('headings inside code fences are not counted', () => {
  const dir = tmpRepo(minimalRepo({ 'README.ua.md': '# Р\n\n```bash\n# comment\n```\n\n## А\n' }));
  assert.deepEqual(checkRepo(dir).errors, []);
});
