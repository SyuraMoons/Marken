import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(relative, dependencies = {}) {
  const filename = path.join(import.meta.dirname, '..', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, Buffer, console,
    require(name) {
      if (name === 'server-only') return {};
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });
  return exports;
}

test('captions support real job objects and legacy string rows', () => {
  const { asCaptions } = load('src/lib/posts/captions.ts');
  assert.equal(JSON.stringify(asCaptions([{ label: 'A', text: 'First' }, { label: 'B', text: 'Second' }])), '["First","Second"]');
  assert.equal(JSON.stringify(asCaptions(['Legacy', null, {}, { text: 42 }, ''])), '["Legacy"]');
  assert.equal(JSON.stringify(asCaptions(null)), '[]');
});

function ports(render) {
  return load('src/lib/jobs/ports.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => { throw new Error('Storage unavailable'); } },
    '@/lib/agents/trends': {}, '@/lib/agents/planner': {}, '@/lib/agents/caption': {},
    '@/lib/studio': { renderAndVerifySlide: render },
  });
}
const input = { order: 1, text: 'Example', sceneBrief: 'Empty scene' };

test('missing product pixels fail before rendering', async () => {
  let called = false;
  const adapter = ports(async () => { called = true; });
  await assert.rejects(adapter.renderAndVerifySlide(input), /cutout is unavailable/);
  await assert.rejects(adapter.renderAndVerifySlide({ ...input, cutoutPath: 'missing.png' }), /cutout is unavailable/);
  assert.equal(called, false);
});

test('studio failure cannot turn into a blank verified slide', async () => {
  const adapter = ports(async () => { throw new Error('Render failed'); });
  await assert.rejects(adapter.renderAndVerifySlide({ ...input, cutout: Buffer.from('product') }), /Render failed/);
});

test('verification result and original product bytes survive the adapter', async () => {
  const cutout = Buffer.from('product');
  const image = Buffer.from('composite');
  const adapter = ports(async (request) => {
    assert.equal(request.cutout, cutout);
    return { sceneBuffer: image, slideBuffer: image, fidelityScore: 0.3, fidelityPassed: false };
  });
  const result = await adapter.renderAndVerifySlide({ ...input, cutout });
  assert.equal(result.fidelityPassed, false);
  assert.equal(result.fidelityScore, 0.3);
  assert.equal(result.slidePng, image);
});
