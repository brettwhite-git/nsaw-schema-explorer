#!/usr/bin/env node
// Real-time capture (no virtual time, so the timings in window.__stats are honest).
// usage: node cdp.mjs "<query>" out.png [WxH] [statsOut.json]
// Launches headless Chrome with a DevTools port, loads lab/paint with the query, waits for document.title === 'ready',
// saves a screenshot and prints window.__stats. Needs the Vite dev server on :3001.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [query = 'view=looks', out = 'shot.png', size = '1920x1200', statsOut] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'cdp-'));
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); target = l.find((t) => t.type === 'page'); } catch { /* not up yet */ } }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://localhost:3001/lab/paint/index.html?${query}` });
  const t0 = Date.now(); let title = '';
  while (Date.now() - t0 < 240000) { await sleep(400); const r = await send('Runtime.evaluate', { expression: 'document.title' }); title = r.result.value; if (title === 'ready') break; }
  await sleep(600);
  const st = await send('Runtime.evaluate', { expression: 'JSON.stringify({stats: window.__stats, errs: window.__errs})', returnByValue: true });
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, Buffer.from(shot.data, 'base64'));
  if (statsOut) writeFileSync(statsOut, st.result.value);
  console.log(title, ((Date.now() - t0) / 1000).toFixed(1) + 's', st.result.value.slice(0, 1600));
} catch (e) { console.error('cdp error', e); process.exitCode = 1; }
finally { try { ws?.close(); } catch { /* ignore */ } chrome.kill('SIGKILL'); }
