import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(relative, dependencies = {}, globals = {}) {
  const filename = path.join(import.meta.dirname, '..', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, Buffer, console, process, URL, Error, ...globals,
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
  assert.equal(called, false);
});

test('a storage outage reports the real cause, not a bad product photo', async () => {
  let called = false;
  const adapter = ports(async () => { called = true; });
  await assert.rejects(
    adapter.renderAndVerifySlide({ ...input, cutoutPath: 'present.png' }),
    (error) => /Storage unavailable/.test(error.message) && !/upload the product photo again/.test(error.message),
  );
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


test('landing remains public while dashboard, setup and OAuth routing stay protected', async () => {
  async function visit(route, signedIn, completed = true) {
    const cookies = { getAll: () => [], set: () => {} };
    const response = (kind, url) => ({ kind, url: url?.toString(), cookies, headers: new Map() });
    const { updateSession } = load('src/lib/supabase/proxy.ts', {
      '@supabase/ssr': { createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: signedIn ? { sub: 'owner' } : null } }) } }) },
      'next/server': { NextResponse: { next: () => response('next'), redirect: (url) => response('redirect', url) } },
      './active-shop': { findActiveShop: async () => ({ shop: { onboarding_step: 2, onboarding_completed_at: completed ? '2026-11-04' : null }, error: null }) },
    });
    const url = new URL(route, 'http://localhost:3000');
    return updateSession({ url: url.href, nextUrl: url, cookies });
  }
  assert.equal((await visit('/', true)).kind, 'next');
  assert.equal((await visit('/', false)).kind, 'next');
  assert.equal((await visit('/', true, false)).kind, 'next');
  assert.equal((await visit('/today', true)).kind, 'next');
  assert.equal((await visit('/today', false)).url, 'http://localhost:3000/login');
  assert.equal((await visit('/today', true, false)).url, 'http://localhost:3000/onboarding/2');
  assert.equal((await visit('/login', true)).url, 'http://localhost:3000/today');
  assert.equal((await visit('/?code=oauth-return', true)).url, 'http://localhost:3000/auth/callback?code=oauth-return');
});

test('native sharing keeps original image bytes and slide order', async () => {
  const seen = [];
  const { prepareShareFiles } = load('src/lib/sharing/native.ts', {}, {
    File,
    fetch: async (url, options) => {
      seen.push([url, options.credentials]);
      return new Response(new Blob([url], { type: url === 'first' ? 'image/png' : 'image/jpeg' }));
    },
  });
  const files = await prepareShareFiles(['first', 'second']);
  assert.equal(files[0].name, 'marken-slide-01.png');
  assert.equal(files[1].name, 'marken-slide-02.jpg');
  assert.equal(await files[0].text(), 'first');
  assert.equal(await files[1].text(), 'second');
  assert.deepEqual(seen, [['first', 'omit'], ['second', 'omit']]);
});

test('native sharing refuses missing, expired, empty and non-image slides', async () => {
  for (const response of [new Response('expired', { status: 403 }), new Response('', { headers: { 'Content-Type': 'image/png' } }), new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })]) {
    const { prepareShareFiles } = load('src/lib/sharing/native.ts', {}, { File, fetch: async () => response });
    await assert.rejects(() => prepareShareFiles(['slide']));
    await assert.rejects(() => prepareShareFiles(['slide', '']));
  }
});

test('native handoff shares files only and distinguishes cancellation and unavailable devices', async () => {
  const { sharePreparedFiles } = load('src/lib/sharing/native.ts');
  const files = [new File(['pixels'], 'slide.png', { type: 'image/png' })];
  let payload;
  assert.equal(await sharePreparedFiles(files, { canShare: () => true, share: async (data) => { payload = data; } }), 'handed-off');
  assert.equal(payload.files, files);
  assert.deepEqual(Object.keys(payload), ['files']);
  assert.equal(await sharePreparedFiles(files, { canShare: () => false, share: () => assert.fail('unsupported must not open share sheet') }), 'unsupported');
  const cancel = new Error('cancelled'); cancel.name = 'AbortError';
  assert.equal(await sharePreparedFiles(files, { canShare: () => true, share: async () => { throw cancel; } }), 'cancelled');
  await assert.rejects(() => sharePreparedFiles(files, { canShare: () => true, share: async () => { throw new Error('denied'); } }), /denied/);
});

test('analytics demo totals reconcile with post and daily fixtures', () => {
  const { DEMO_ANALYTICS, summarizeAnalytics } = load('src/lib/mock/analytics.ts');
  const summary = summarizeAnalytics(DEMO_ANALYTICS);
  assert.equal(summary.reach, 4080);
  assert.equal(summary.interactions, 335);
  assert.equal(summary.saves, 85);
  assert.equal(summary.orders, 9);
  assert.equal(summary.dailyReach.reduce((sum, n) => sum + n, 0), summary.reach);
  for (const post of DEMO_ANALYTICS) {
    assert.equal(post.dailyReach.reduce((sum, n) => sum + n, 0), post.reach);
    assert.ok(post.impressions >= post.reach);
  }
  assert.equal(summarizeAnalytics(DEMO_ANALYTICS.filter(post => post.platform === 'instagram')).reach, 3100);
});
