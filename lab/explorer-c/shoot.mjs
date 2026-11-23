#!/usr/bin/env node
// usage: node lab/explorer-c/shoot.mjs "<query>" out.png [WxH]   (Vite dev server on :3001)
// Loads /lab/explorer-c/?query in headless Chrome, waits for window.__ready, prints captured errors, saves a PNG.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [query = '', out = 'shot.png', size = '1440x900', port0 = process.env.PORT || '3001'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'cdp-'));
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); target = l.find((t) => t.type === 'page'); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://localhost:${port0}/lab/explorer-c/${query ? '?' + query : ''}` });
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < 60000) { await sleep(300); const r = await send('Runtime.evaluate', { expression: '!!window.__ready', returnByValue: true }); if (r.result.value) { ok = true; break; } }
  await sleep(700);
  const st = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__errs||[])', returnByValue: true });
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(ok ? 'ready' : 'TIMEOUT', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'errs', st.result.value, logs.join(' | '));
} catch (e) { console.error('cdp error', e); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} chrome.kill('SIGKILL'); }
