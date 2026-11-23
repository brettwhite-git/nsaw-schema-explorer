#!/usr/bin/env node
// Route check: headless Chrome over CDP. Hard-loads each route (a fresh tab per shot, no in-app navigation),
// waits for body[data-ready="1"], screenshots it and fails on any console error, warning or exception, on a
// page that never gets ready, and on horizontal overflow.
//
//   npm run shoot                                   # every route below, 1440x900 and 390x844, against :3002
//   node scripts/shoot.mjs --base http://localhost:3001 --out lab/_shots-x --sizes 1440x900 --full / /search?q=customer
//
// Serve a build first: npm run build && npx vite preview --port 3002 --strictPort
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROUTES = [
  '/',
  '/?dim=DW_NS_EMPLOYEE_D',
  '/compare/sales-order/customer-invoice',
  '/area/sales-order',
  '/table/DW_NS_SALES_ORDER_LINES_F?col=TRANSACTION',
  '/table/DW_NS_SALES_ORDER_LINES_F_SEC',
  '/table/DW_NS_CUSTOMER_D',
  '/table/DW_NS_LOCATION_CF_DH',
  '/field/customer/companyname',
  '/field/transactions/tranid',
  '/search?q=grain:line',
  '/search?q=customer',
  '/nope',
];

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const base = opt('--base', 'http://localhost:3002');
const outDir = opt('--out', 'lab/_shots-final');
const sizes = opt('--sizes', '1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
const full = flag('--full');
/** With --full: also write the page in slices this tall (name-0.png, name-1.png …), for reading by eye. */
const slice = Number(opt('--slice', '0'));
const routes = args.length ? args : ROUTES;
const CH = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileOf = (route, [w]) => `${(route.replace(/^\//, '') || 'home').replace(/[^a-z0-9_=-]+/gi, '_').replace(/_+$/, '')}@${w}.png`;

const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'shoot-'));
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });

/** One CDP session on a fresh page target. */
async function openPage() {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning' || m.params.type === 'assert')) errs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') errs.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    if (m.method === 'Log.entryAdded' && (m.params.entry.level === 'error' || m.params.entry.level === 'warning')) errs.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const close = async () => { try { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch { /* gone */ } };
  return { send, errs, close };
}

const evalv = async (send, expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

let failed = 0;
try {
  for (let i = 0; i < 80; i++) { await sleep(250); try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { /* not up yet */ } }
  mkdirSync(outDir, { recursive: true });
  for (const route of routes) {
    for (const size of sizes) {
      const [W, H] = size;
      const mobile = W < 760;
      const { send, errs, close } = await openPage();
      const t0 = Date.now();
      const issues = [];
      try {
        await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
        if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
        await send('Page.navigate', { url: base + route });
        let ready = false;
        while (Date.now() - t0 < 30000) { await sleep(250); if (await evalv(send, 'document.body?.dataset.ready === "1"')) { ready = true; break; } }
        if (!ready) issues.push('never ready (body[data-ready="1"])');
        await evalv(send, 'document.fonts.ready.then(() => true)');
        await sleep(900);
        const over = await evalv(send, 'document.documentElement.scrollWidth - window.innerWidth');
        if (over > 1) issues.push(`horizontal overflow ${over}px`);
        let shot;
        if (full) {
          const lm = await send('Page.getLayoutMetrics');
          const h = Math.min(16000, Math.ceil(lm.cssContentSize?.height ?? lm.contentSize.height));
          await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 1, mobile });
          await sleep(700);
          shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: h, scale: 1 } });
          for (let y = 0, k = 0; slice && y < h; y += slice, k++) {
            const part = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: W, height: Math.min(slice, h - y), scale: 1 } });
            writeFileSync(join(outDir, fileOf(route, size).replace(/\.png$/, `-${k}.png`)), Buffer.from(part.data, 'base64'));
          }
        } else shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(outDir, fileOf(route, size)), Buffer.from(shot.data, 'base64'));
      } catch (e) { issues.push(`cdp: ${e.message}`); }
      issues.push(...errs);
      if (issues.length) failed++;
      console.log(`${issues.length ? 'FAIL' : 'ok  '} ${String(W).padStart(4)} ${route}  ${((Date.now() - t0) / 1000).toFixed(1)}s${issues.length ? '\n     ' + issues.join('\n     ') : ''}`);
      await close();
    }
  }
} catch (e) { console.error('shoot error', e); failed++; }
finally { chrome.kill('SIGKILL'); }
console.log(failed ? `${failed} shot(s) with issues` : `all clean -> ${outDir}`);
process.exitCode = failed ? 1 : 0;
