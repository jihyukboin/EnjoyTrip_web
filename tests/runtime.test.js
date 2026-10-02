import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('실제 서버를 재시작해 회원·세션 영속성을 검증한다', { timeout: 30_000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'enjoytrip-runtime-'));
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let child;
  let output = '';
  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const finished = once(child, 'close');
    child.kill();
    await finished;
  }
  t.after(async () => {
    await stop();
    assert.equal(resolve(dirname(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('enjoytrip-runtime-'));
    rmSync(directory, { recursive: true, force: true });
  });
  async function start() {
    output = '';
    child = spawn(process.execPath, ['backend/index.js'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: {
        ...process.env, HOST: '127.0.0.1', PORT: String(port), APP_ORIGIN: origin,
        DB_PATH: join(directory, 'enjoytrip.sqlite'), COOKIE_SECURE: 'false', NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', data => { output += data; });
    // Drain stderr without exposing stack traces or tokens in test output.
    child.stderr.resume();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out.')), 5000);
      const onData = () => {
        if (output.includes(`EnjoyTrip: ${origin}`)) {
          clearTimeout(timer);
          child.stdout.off('data', onData);
          child.off('exit', onExit);
          resolve();
        }
      };
      const onExit = () => { clearTimeout(timer); reject(new Error('Server exited before becoming ready.')); };
      child.stdout.on('data', onData);
      child.once('exit', onExit);
      child.once('error', reject);
    });
  }
  async function call(path, method = 'GET', body, cookie) {
    const response = await fetch(origin + path, {
      method, headers: { Origin: origin, 'X-EnjoyTrip-Request': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] };
  }
  const password = 'runtime-test-passphrase-2026';
  await start();
  assert.equal((await call('/api/members', 'POST', { id: 'runtime', name: '실행 검증', password })).status, 201);
  const logged = await call('/api/auth/login', 'POST', { id: 'runtime', password });
  assert.equal(logged.status, 200);
  await stop();
  await start();
  const restored = await call('/api/members/me', 'GET', undefined, logged.cookie);
  assert.equal(restored.status, 200);
  assert.equal(restored.json.data.member.id, 'runtime');
});
