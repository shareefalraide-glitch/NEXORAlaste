import assert from 'node:assert/strict';
import { ApiError, createApiClient } from '../../src/services/api-client.js';

const json = (status, body) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const tokens = (access, refresh) => ({
  access_token: access,
  refresh_token: refresh,
  token_type: 'Bearer',
  expires_in: 900,
});

{
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/auth/login')) return json(200, tokens('access-one', 'refresh-one'));
      if (url.endsWith('/auth/me')) return json(200, { id: 'u1', role: 'analyst' });
      return json(404, { error: { code: 'not_found', message: 'missing' } });
    },
  });
  const user = await client.login({
    organization: 'test-org',
    email: 'analyst@example.test',
    password: 'long-secret',
  });
  assert.equal(user.role, 'analyst');
  assert.equal(client.hasSession(), true);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    organization: 'test-org',
    email: 'analyst@example.test',
    password: 'long-secret',
  });
  assert.equal(calls[1].options.headers.get('Authorization'), 'Bearer access-one');
  assert.equal(calls[1].options.cache, 'no-store');
  assert.equal(calls[1].options.credentials, 'same-origin');
}

{
  let protectedCalls = 0;
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/auth/login')) return json(200, tokens('access-old', 'refresh-old'));
      if (url.endsWith('/auth/me')) return json(200, { role: 'viewer' });
      if (url.endsWith('/auth/refresh')) return json(200, tokens('access-new', 'refresh-new'));
      if (url.endsWith('/assets')) {
        protectedCalls += 1;
        return protectedCalls === 1
          ? json(401, { error: { code: 'unauthorized', message: 'expired' } })
          : json(200, { items: [] });
      }
      return new Response(null, { status: 204 });
    },
  });
  await client.login({ organization: 'test-org', email: 'x@y.test', password: 'secret' });
  assert.deepEqual(await client.request('/assets'), { items: [] });
  assert.equal(calls.filter(call => call.url.endsWith('/auth/refresh')).length, 1);
  const retries = calls.filter(call => call.url.endsWith('/assets'));
  assert.equal(retries[0].options.headers.get('Authorization'), 'Bearer access-old');
  assert.equal(retries[1].options.headers.get('Authorization'), 'Bearer access-new');
  await client.logout();
  assert.equal(client.hasSession(), false);
}

{
  const client = createApiClient({
    fetchImpl: async url => {
      if (url.endsWith('/auth/login')) return json(200, tokens('access', 'refresh'));
      if (url.endsWith('/auth/me')) return json(200, { role: 'viewer' });
      if (url.endsWith('/auth/refresh'))
        return json(401, { error: { code: 'invalid_refresh_token' } });
      return json(401, { error: { code: 'unauthorized' } });
    },
  });
  await client.login({ organization: 'test-org', email: 'x@y.test', password: 'secret' });
  await assert.rejects(
    client.request('/assets'),
    error => error instanceof ApiError && error.status === 401,
  );
  assert.equal(client.hasSession(), false);
}

{
  let completeRefresh;
  let refreshStarted;
  const started = new Promise(resolve => {
    refreshStarted = resolve;
  });
  const delayedRefresh = new Promise(resolve => {
    completeRefresh = resolve;
  });
  const client = createApiClient({
    fetchImpl: async url => {
      if (url.endsWith('/auth/login')) return json(200, tokens('access-old', 'refresh-old'));
      if (url.endsWith('/auth/me')) return json(200, { role: 'viewer' });
      if (url.endsWith('/auth/refresh')) {
        refreshStarted();
        return delayedRefresh;
      }
      if (url.endsWith('/assets')) return json(401, { error: { code: 'expired' } });
      return json(404, {});
    },
  });
  await client.login({ organization: 'test-org', email: 'x@y.test', password: 'secret' });
  const pending = client.request('/assets');
  await started;
  client.clear();
  completeRefresh(json(200, tokens('stale-access', 'stale-refresh')));
  await assert.rejects(
    pending,
    error => error instanceof ApiError && error.code === 'session_changed',
  );
  assert.equal(client.hasSession(), false);
}

console.log(
  'PASS API client: login, bearer auth, one-time refresh, logout, revoked and stale-session handling',
);
