// One explorer model per page load, shared by every page (module singleton).
//
//   const { core, columns, ready, error } = useExplorer();                  // core only
//   const { core, columns, ready } = useExplorer({ columns: true });        // also needs column-level lineage
//
// - core.json is fetched as soon as this module is first used; `core` is buildCore(core.json).
// - columns.json is fetched on idle once core is in, or at once when a page asks for it;
//   `columns` is buildColumns(core, columns.json). It stays null until then.
// - `ready` is true when everything the caller asked for is built. `error` is set if a fetch fails.
// Outside React: loadCore() / loadColumns() return the same shared promises.
import { useEffect, useState } from 'react';
import { loadOntology, type FetchJson } from '../ontology/load';
import type { DetailJson } from '../ontology/types';
import { buildColumns, buildCore } from '../explorer/data/model';
import type { ColumnModel, CoreModel } from '../explorer/data/types';

const BASE = '/ontology/';

let coreModel: CoreModel | null = null;
let columnModel: ColumnModel | null = null;
let coreP: Promise<CoreModel> | null = null;
let columnsP: Promise<ColumnModel> | null = null;
let fetchColumns: (() => Promise<DetailJson>) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** core.json -> buildCore, once. A failed fetch is retried on the next call. */
export function loadCore(): Promise<CoreModel> {
  if (!coreP) {
    let columnsJson: Promise<unknown> | null = null;
    const fetchJson: FetchJson = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`explorer: ${url} -> HTTP ${res.status}`);
      return res.json();
    };
    coreP = loadOntology({ baseUrl: BASE, fetchJson }).then((o) => {
      const file = o.core.meta.files.columns;
      fetchColumns = () => (columnsJson ??= fetchJson(BASE + file).catch((e) => { columnsJson = null; throw e; })) as Promise<DetailJson>;
      coreModel = buildCore(o.core);
      emit();
      scheduleIdle(() => { loadColumns().catch(() => {}); });
      return coreModel;
    });
    coreP.catch(() => { coreP = null; });
  }
  return coreP;
}

/** columns.json -> buildColumns, once (loads core first). */
export function loadColumns(): Promise<ColumnModel> {
  if (!columnsP) {
    columnsP = loadCore().then(async (core) => {
      const json = await fetchColumns!();
      columnModel = buildColumns(core, json);
      emit();
      return columnModel;
    });
    columnsP.catch(() => { columnsP = null; });
  }
  return columnsP;
}

function scheduleIdle(fn: () => void) {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 2500 }); else setTimeout(fn, 600);
}

export interface Explorer {
  /** buildCore(core.json), or null while loading. */
  core: CoreModel | null;
  /** buildColumns(core, columns.json), or null until loaded. */
  columns: ColumnModel | null;
  /** Everything the caller asked for is built. */
  ready: boolean;
  /** A load failed (message). */
  error: string | null;
}

export function useExplorer(opts: { columns?: boolean } = {}): Explorer {
  const [, tick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wantColumns = !!opts.columns;
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    listeners.add(on);
    const fail = (e: unknown) => setError(String((e as Error)?.message ?? e));
    (wantColumns ? loadColumns() : loadCore()).catch(fail);
    return () => { listeners.delete(on); };
  }, [wantColumns]);
  return { core: coreModel, columns: columnModel, ready: !!coreModel && (!wantColumns || !!columnModel), error };
}
