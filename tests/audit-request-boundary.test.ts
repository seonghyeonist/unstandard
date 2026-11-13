import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createHmac } from 'node:crypto';
import { readBoundedBody, readSmallJson, isSameOriginMutation } from '../lib/http/profile-request';
import { verifyDiditWebhookRawSignature } from '../lib/identity/didit-webhook';

it('cancels oversized streams before buffering their tail', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(9)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readBoundedBody({ body }, 8), /Invalid body/);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});
it('accepts an exact byte limit and preserves signed raw webhook bytes', async () => {
  const raw = new TextEncoder().encode('{ "status": "Approved", "한글": true }');
  const request = new Request('https://example.test', { method: 'POST', body: raw });
  const bytes = await readBoundedBody(request, raw.length);
  assert.deepEqual(bytes, raw);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', 'synthetic-secret').update(bytes).digest('hex');
  assert.equal(verifyDiditWebhookRawSignature({rawBody: bytes, signature, timestamp, secret: 'synthetic-secret'}), true);
});
it('rejects invalid UTF8, malformed JSON and non-JSON media types', async () => {
  for (const [body, type] of [[new Uint8Array([255]), 'application/json'], ['{', 'application/json'], ['{}', 'text/plain'], ['{}', 'application/jsonp'] ] as const) {
    await assert.rejects(readSmallJson(new Request('https://example.test', {method:'POST', body, headers:{'content-type':type}})));
  }
  assert.deepEqual(await readSmallJson(new Request('https://example.test', {method:'POST', body:'{"body":"안녕"}', headers:{'content-type':'application/json; charset=utf-8'}})), {body:'안녕'});
});
it('accepts same-origin browser mutations and rejects absent, sibling and cross-site origins', () => {
  const url = 'https://unstandard.app/api/reports';
  for (const origin of [undefined, 'https://evil.example', 'https://other.unstandard.app']) {
    assert.equal(isSameOriginMutation(new Request(url, {headers: origin ? {origin} : {}})), false);
  }
  assert.equal(isSameOriginMutation(new Request(url, {headers:{origin:'https://unstandard.app'}})), true);
  assert.equal(isSameOriginMutation(new Request(url, {headers:{origin:'https://unstandard.app', 'sec-fetch-site':'cross-site'}})), false);
});

it('compares browser origin with external Host behind a reverse proxy', () => {
  assert.equal(isSameOriginMutation(new Request('http://internal:3000/api/reports', {headers:{host:'unstandard.app', origin:'https://unstandard.app'}})), true);
  assert.equal(isSameOriginMutation(new Request('http://internal:3000/api/reports', {headers:{host:'unstandard.app', origin:'https://evil.example'}})), false);
});
