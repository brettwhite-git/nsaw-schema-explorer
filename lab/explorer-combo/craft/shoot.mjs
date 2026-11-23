#!/usr/bin/env node
// usage: node lab/explorer-combo/craft/shoot.mjs out.png [WxH] [scale] [clip-selector]
// Headless Chrome over CDP against the Vite dev server on :3001. Prints console errors and exceptions.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [out = 'shot.png', size = '1440x900', scaleArg = '1', clipSel = ''] = process.argv.slice(2); const DPR = Number(scaleArg);
const [W, H] = size.split('x').map(Number);
const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'cdpb-'));
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', `--window-size=${W},${H}`, `--force-device-scale-factor=${DPR}`, 'about:blank'], { stdio: 'ignore' });
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
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: `http://localhost:3001/lab/explorer-combo/craft/preview.html` });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) { await sleep(300); const r = await send('Runtime.evaluate', { expression: 'document.body?.dataset.ready === "1"' }); if (r.result.value) break; }
  await sleep(900);
  const ms = await send('Runtime.evaluate', { expression: 'document.body.dataset.ms', returnByValue: true }); console.log('plate ms', ms.result.value);
  let clip;
  if (clipSel) { const r = await send('Runtime.evaluate', { expression: `(() => { const b = document.querySelector(${JSON.stringify(clipSel)}).getBoundingClientRect(); return { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16, scale: 1 }; })()`, returnByValue: true }); clip = r.result.value; }
  const shot = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's', errs.length ? '\n' + errs.join('\n') : 'no console errors');
} catch (e) { console.error('cdp error', e); process.exitCode = 1; }
finally { try { ws?.close(); } catch { /* ignore */ } chrome.kill('SIGKILL'); }
