import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';

const upstream = createHttpServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ proxyTarget: true, path: request.url }));
});
await new Promise((resolve, reject) => {
  upstream.once('error', reject);
  upstream.listen(0, '127.0.0.1', resolve);
});
const previousTarget = process.env.NEXORA_API_PROXY_TARGET;
process.env.NEXORA_API_PROXY_TARGET = `http://127.0.0.1:${upstream.address().port}`;
let vite;
try {
  vite = await createViteServer({
    configFile: new URL('../../vite.config.js', import.meta.url).pathname,
    server: { host: '127.0.0.1', port: 0, strictPort: true },
    logLevel: 'error',
  });
  await vite.listen();
  const address = vite.httpServer.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/proxy-check`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { proxyTarget: true, path: '/api/v1/proxy-check' });
  console.log('PASS Vite same-origin /api proxy forwards to the configured server-side target');
} finally {
  if (vite) await vite.close();
  await new Promise(resolve => upstream.close(resolve));
  if (previousTarget === undefined) delete process.env.NEXORA_API_PROXY_TARGET;
  else process.env.NEXORA_API_PROXY_TARGET = previousTarget;
}
