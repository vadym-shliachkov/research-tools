import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter } from '../tools/check.mjs';

const PLUGIN = path.resolve(import.meta.dirname, '../plugins/uxr');
const SKILL_DIR = path.join(PLUGIN, 'skills/sum');
const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const usage = (script) => JSON.parse(spawnSync(process.execPath, [script], { encoding: 'utf8' }).stdout).message;

test('every reference and asset the skill names exists', () => {
  const named = [...skill.matchAll(/`(?:<SKILL_DIR>\/)?((?:references|assets)\/[\w.-]+)`/g)].map((m) => m[1]);
  assert.ok(named.length >= 5);
  for (const rel of named) assert.ok(fs.existsSync(path.join(SKILL_DIR, rel)), `${rel} is missing`);
});

test('every UXR and SUM command in the skill is a real command', () => {
  const uxr = usage(path.join(PLUGIN, 'scripts/uxr.mjs'));
  const sum = usage(path.join(SKILL_DIR, 'scripts/sum.mjs'));
  const uxrCmds = [...skill.matchAll(/`UXR ([\w-]+)/g)].map((m) => m[1]);
  const sumCmds = [...skill.matchAll(/`SUM ([\w-]+)/g)].map((m) => m[1]);
  assert.ok(uxrCmds.length >= 5 && sumCmds.length >= 6);
  for (const c of uxrCmds) assert.match(uxr, new RegExp(`uxr\\.mjs ${c}\\b`), `UXR ${c}`);
  for (const c of sumCmds) assert.match(sum, new RegExp(`sum\\.mjs ${c}\\b`), `SUM ${c}`);
});

test('every flag the skill passes to a script is accepted by it', () => {
  const sumSrc = fs.readFileSync(path.join(SKILL_DIR, 'scripts/sum.mjs'), 'utf8');
  const uxrSrc = fs.readFileSync(path.join(PLUGIN, 'scripts/uxr.mjs'), 'utf8');
  for (const m of skill.matchAll(/`(UXR|SUM) [^`]*`/g)) {
    for (const f of m[0].matchAll(/--([\w-]+)/g)) {
      const src = m[1] === 'SUM' ? sumSrc : uxrSrc;
      assert.match(src, new RegExp(`'?${f[1]}'?: \\{ type`), `${m[1]} --${f[1]}`);
    }
  }
});

test('the editor agent exists with a matching name, and the presets named exist', async () => {
  const agent = fs.readFileSync(path.join(PLUGIN, 'agents/plain-language-editor.md'), 'utf8');
  assert.equal(parseFrontmatter(agent).name, 'plain-language-editor');
  assert.match(skill, /uxr:plain-language-editor/);
  const { PRESETS } = await import('../plugins/uxr/skills/sum/scripts/sum-lib.mjs');
  const hint = parseFrontmatter(skill)['argument-hint'];
  for (const p of hint.match(/--method ([\w|]+)/)[1].split('|')) assert.ok(PRESETS[p], p);
});

test('the contract template has the same keys init-contract writes', () => {
  const tpl = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'assets/contract-template.json'), 'utf8'));
  const src = fs.readFileSync(path.join(SKILL_DIR, 'scripts/sum.mjs'), 'utf8');
  for (const k of Object.keys(tpl.defaults)) assert.match(src, new RegExp(`\\b${k}\\b[:,]`), k);
});
