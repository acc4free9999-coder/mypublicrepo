const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create, configuration } = require('../lib/supabase-api.js');
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_public' };
const session = (token = 'access') => ({ access_token: token, refresh_token: 'refresh', expires_at: 9999999, user: { id: 'user', email: 'user@example.com' } });
function fixture(handler, initial = session()) {
  let stored = initial;
  const calls = [];
  const api = create({
    config, now: () => 1000,
    vault: { get: async () => stored, set: async (value) => { stored = value; }, clear: async () => { stored = null; } },
    fetch: async (url, options) => { calls.push({ url, options }); return handler(url, options); },
  });
  return { api, calls, stored: () => stored };
}
test('only official HTTPS hosts and public keys are accepted', () => {
  assert.equal(configuration(config).url, config.url);
  for (const url of ['http://example.supabase.co', 'https://example.supabase.co.evil.test', 'https://user@example.supabase.co', 'https://example.supabase.co/path']) {
    assert.throws(() => configuration({ ...config, url }), /HTTPS Supabase/);
  }
  const key = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.b`;
  assert.throws(() => configuration({ ...config, publishableKey: key }), /public publishable/);
  assert.throws(() => configuration({ ...config, publishableKey: 'sb_secret_secret' }), /never a secret/);
});
test('401 refreshes and persists rotated credentials, then retries once', async () => {
  let requests = 0;
  const f = fixture(async (url, options) => {
    if (url.includes('refresh_token')) return new Response(JSON.stringify(session('rotated')));
    requests++;
    assert.equal(options.headers.apikey, config.publishableKey);
    if (requests === 1) return new Response(JSON.stringify({ message: 'Expired' }), { status: 401 });
    assert.equal(options.headers.Authorization, 'Bearer rotated');
    return new Response(JSON.stringify({ groupId: 'group', records: {}, ack: 0 }));
  });
  assert.equal((await f.api.rpc('sync_notebook', {})).ack, 0);
  assert.equal(f.stored().access_token, 'rotated');
  assert.equal(f.calls.length, 3);
});
test('expired tokens refresh once for simultaneous requests', async () => {
  let refreshes = 0;
  const f = fixture(async (url) => {
    if (url.includes('refresh_token')) { refreshes++; await new Promise((resolve) => setTimeout(resolve, 10)); return new Response(JSON.stringify(session('new'))); }
    return new Response('[]');
  }, { ...session(), expires_at: 0 });
  await Promise.all([f.api.rpc('list_notebooks'), f.api.rpc('list_notebooks')]);
  assert.equal(refreshes, 1);
});
test('membership denial and malformed responses surface without success fallbacks', async () => {
  const f = fixture(async () => new Response(JSON.stringify({ message: 'Not a member' }), { status: 403 }));
  await assert.rejects(f.api.rpc('sync_notebook'), /Not a member/);
  assert.equal(f.calls.length, 1);
  const bad = fixture(async () => new Response('not json'));
  await assert.rejects(bad.api.rpc('sync_notebook'), /invalid response/);
});
test('sign in returns credentials without storing until caller validates account binding', async () => {
  const f = fixture(async (url, options) => {
    assert.match(url, /grant_type=password/);
    assert.equal(JSON.parse(options.body).password, 'password123');
    return new Response(JSON.stringify(session()));
  }, null);
  const signed = await f.api.signIn('user@example.com', 'password123');
  assert.equal(f.stored(), null);
  await f.api.save(signed);
  assert.equal((await f.api.user()).email, 'user@example.com');
});
test('sign out clears local tokens even when server logout fails', async () => {
  const f = fixture(async () => { throw new Error('Offline'); });
  await assert.rejects(f.api.signOut(), /Offline/);
  assert.equal(f.stored(), null);
  await assert.rejects(f.api.rpc('list_notebooks'), /Sign in/);
});
test('invalid auth responses cannot create a success-shaped session', async () => {
  const f = fixture(async () => new Response(JSON.stringify({ ...session(), expires_at: null, expires_in: null })), null);
  await assert.rejects(f.api.signIn('user@example.com', 'password123'), /Invalid Supabase authentication/);
  assert.equal(f.stored(), null);
});
