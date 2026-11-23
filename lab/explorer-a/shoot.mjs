#!/usr/bin/env node
// usage: node lab/explorer-a/shoot.mjs "<query>" out.png [WxH]
// Headless Chrome via DevTools; loads http://localhost:3001/lab/explorer-a/?<query>, waits for body[data-ready], screenshots,
// and prints console errors / exceptions.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [query = '', out = 'shot.png', size = '1440x900'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'cdpa-'));
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errs = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); target = l.find((t) => t.type === 'page'); } catch { /* not up */ } }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errs.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url ?? ''));
  });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: `http://localhost:3001/lab/explorer-a/${query ? '?' + query : ''}` });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) { await sleep(300); const r = await send('Runtime.evaluate', { expression: 'document.body && document.body.dataset.ready' }); if (r.result.value === '1') break; }
  await sleep(900);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's', errs.length ? '\n' + errs.join('\n') : 'no console errors');
} catch (e) { console.error('cdp error', e); process.exitCode = 1; }
finally { try { ws?.close(); } catch { /* ignore */ } chrome.kill('SIGKILL'); }
