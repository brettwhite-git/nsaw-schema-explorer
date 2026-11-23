import { VIEWS } from './views';
const app = document.getElementById('app')!;
const bar = document.getElementById('bar')!;
let cur = (new URLSearchParams(location.search).get('view') ?? '1').toLowerCase();
function btn(k: string, label: string): string { return `<button data-k="${k}" class="${cur === k ? 'on' : ''}"><b>${k === 'all' ? 'A' : k}</b> ${label}</button>`; }
function render(): void {
  bar.innerHTML = VIEWS.map((v) => btn(v.key, v.label)).join('') + btn('all', 'All');
  if (cur === 'all') app.innerHTML = `<div class="grid">${VIEWS.map((v) => `<figure data-k="${v.key}">${v.fn()}<figcaption>${v.key} ${v.label}</figcaption></figure>`).join('')}</div>`;
  else { const v = VIEWS.find((x) => x.key === cur) ?? VIEWS[0]; app.innerHTML = v.fn(); }
  history.replaceState(null, '', `?view=${cur}`);
}
function go(k: string): void { cur = k; render(); }
bar.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) go(b.dataset.k!); });
app.addEventListener('click', (e) => { const f = (e.target as HTMLElement).closest('figure'); if (f) go(f.dataset.k!); });
addEventListener('keydown', (e) => { if (/^[1-6]$/.test(e.key)) go(e.key); else if (e.key === 'a' || e.key === '0') go('all'); });
render();
