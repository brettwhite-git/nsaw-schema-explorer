// Ready-made inspector props for the common selections, so pages stay thin:
//
//   inspectArea(m, sa)                      a subject area: facts listed / drawn, related and shared tables
//   inspectFact(m, cm, t, area?)            a fact: grain, its diagram's tables (shared ones in `area`), mini star
//   inspectDimension(m, t, area?)           a related table: k of n facts in `area`, reach bar, the facts
//   inspectTable(m, cm, t, area?)           either of the two above, picked by whether the table has a diagram
//   inspectPair(m, saA, saB)                two subject areas: only in A, only in B, listed under both
//   inspectColumn(m, cm, c, area?)          one warehouse column: its NetSuite sources, report columns, areas
//   inspectField(m, cm, trace, area?)       one NetSuite field: warehouse columns, report columns, subject areas
//
// The builders return props only; a page adds longer detail lists as children (<InspectorSection>).
//
// `area` is a subject-area index (the page's ?area= or the area page itself); links then carry ?area=<slug>.
// `cm` may be null while column lineage loads: the actions that need it (follow a column, trace a field) wait.
// Every figure is a positive count; a figure that would be zero is left out.
import type { ReactNode } from 'react';
import { areaPath, comparePath, fieldPath, matrixPath, tablePath } from '../../routes';
import {
  areaFlow, columnReadSentence, compare, compareSentence, flowTable, fmt, grainSentence, hasModel, isFact, ledgerRows,
  modelFactsOf, modelRelations, prettyTable, shortTable, type ColumnModel, type CoreModel, type Trace,
} from '../../../explorer/data';
import { Link } from '../../router';
import { similarAreas } from '../area/AreaCompare';
import type { InspectorProps } from '../Inspector';
import { FactDots, InspectorVisual, MiniStar, ReachBar, type InspectorAction, type InspectorFigure } from './pieces';

const positive = (fs: (InspectorFigure | false | null | undefined)[]): InspectorFigure[] =>
  fs.filter((f): f is InspectorFigure => !!f && (typeof f.n !== 'number' || f.n > 0));

export function inspectArea(m: CoreModel, sa: number): InspectorProps {
  const s = m.subjectAreas[sa];
  const flow = areaFlow(m, sa);
  const fa = s.fa >= 0 ? m.functionalAreas[s.fa].name : '';
  const drawn = new Set(flow.facts.map((f) => f.table));
  const listed = m.factsOfSa[sa];
  const near = similarAreas(m, sa, 1)[0];
  const actions: InspectorAction[] = [{ label: `Open ${s.label}`, sub: 'its facts and the tables they relate to', to: areaPath(s.slug) }];
  if (flow.facts[0]) {
    const f = flow.facts.reduce((a, b) => (b.rels.length > a.rels.length ? b : a));
    actions.push({ label: `Open ${prettyTable(m, f.name)}`, sub: 'its data model star and column ledger', to: tablePath(f.name, s.slug) });
  }
  if (s.row >= 0) actions.push({ label: 'Its row in the bus matrix', sub: 'the dimensions it shares with other areas', to: matrixPath({ a: s.slug }) });
  if (near) actions.push({ label: `Compare with ${m.subjectAreas[near.sa].label}`, sub: `${fmt(near.shared)} shared dimensions`, to: comparePath(s.slug, m.subjectAreas[near.sa].slug) });
  return {
    kind: 'area',
    eyebrow: 'subject area',
    title: s.label,
    lead: fa || null,
    figures: positive([
      { n: listed.length, label: 'fact tables listed' },
      { n: flow.facts.length, label: 'drawn in the data model' },
      { n: flow.tables.length, label: 'tables they relate to' },
      { n: flow.shared, label: 'shared by two or more facts' },
      s.row >= 0 && { n: m.bus.cells[s.row].length, label: 'shared dimensions in its matrix row' },
      { n: s.presentationColumns, label: 'report columns' },
    ]),
    visual: listed.length > 0 && flow.facts.length > 0 ? (
      <InspectorVisual caption="One mark per fact table listed; the filled ones are drawn in Oracle’s data model.">
        <FactDots items={listed.map((t) => ({ name: m.tables[t].name, on: drawn.has(t) }))} />
      </InspectorVisual>
    ) : undefined,
    actions,
  };
}

export function inspectFact(m: CoreModel, cm: ColumnModel | null, t: number, area?: number | null): InspectorProps {
  const name = m.tables[t].name;
  const slug = area != null ? m.subjectAreas[area].slug : null;
  const rels = modelRelations(m, t);
  const flow = area != null ? areaFlow(m, area) : null;
  const shared = new Set(flow ? flow.tables.filter((d) => d.facts.length >= 2).map((d) => d.table) : []);
  const sh = rels.filter((r) => shared.has(r.table)).length;
  const actions: InspectorAction[] = [{ label: rels.length ? 'Open the table star' : 'Open the table', sub: 'the data model, the column ledger', to: tablePath(name, slug) }];
  if (cm) {
    const lr = ledgerRows(m, cm, t);
    const row = lr.rows.find((r) => r.isKey && r.sources.length) ?? lr.rows.find((r) => r.sources.length);
    const src = row?.sources[0];
    if (row) actions.push({ label: `Follow ${row.name}`, sub: 'one column from NetSuite to the reports', to: tablePath(name, { col: row.name }, slug) });
    if (src) actions.push({ label: 'Trace a field', sub: src.label, to: fieldPath(src.record, src.key.slice(src.record.length + 1), slug) });
  }
  if (slug) actions.push({ label: `Back to ${m.subjectAreas[area!].label}`, sub: 'the subject area flow', to: areaPath(slug) });
  let visual: ReactNode;
  if (rels.length) {
    visual = (
      <InspectorVisual caption={shared.size ? 'Its star, with the tables it shares in this area drawn darker.' : 'Its star in Oracle’s 26R4 data model.'}>
        <MiniStar rels={rels.map((r) => r.table)} highlight={shared.size ? shared : new Set(rels.map((r) => r.table))} />
      </InspectorVisual>
    );
  }
  return {
    kind: 'fact',
    eyebrow: 'fact table',
    title: prettyTable(m, name),
    mono: name,
    lead: grainSentence(m, t),
    figures: positive([
      { n: rels.length, label: 'tables its diagram relates it to' },
      area != null && { n: sh, label: `shared with other facts in ${m.subjectAreas[area].label}` },
      { n: m.tables[t].columns, label: 'columns' },
      { n: m.tables[t].saCount, label: 'subject areas list it' },
    ]),
    visual,
    actions,
  };
}

export function inspectDimension(m: CoreModel, t: number, area?: number | null): InspectorProps {
  const name = m.tables[t].name;
  const slug = area != null ? m.subjectAreas[area].slug : null;
  const NSA = m.subjectAreas.length;
  const flow = area != null ? areaFlow(m, area) : null;
  const d = flow ? flowTable(flow, t) : undefined;
  const reach = m.tables[t].saCount;
  const facts = modelFactsOf(m, t).length;
  const actions: InspectorAction[] = [];
  if (m.tables[t].col >= 0) actions.push({ label: 'Open in the bus matrix', sub: 'its column across every subject area', to: matrixPath({ dim: name }) });
  actions.push({ label: 'Open the table', sub: facts ? 'facts that relate to it, its columns' : 'its columns', to: tablePath(name, slug) });
  if (slug) actions.push({ label: `Back to ${m.subjectAreas[area!].label}`, sub: 'the subject area flow', to: areaPath(slug) });
  return {
    kind: 'dimension',
    eyebrow: isFact(m, t) ? 'fact table' : m.tables[t].role === 'dimension' ? 'dimension' : 'table',
    title: prettyTable(m, name),
    mono: name,
    figures: positive([
      d && flow && { n: d.facts.length, of: flow.facts.length, label: `facts in ${m.subjectAreas[area!].label} relate to it` },
      { n: reach, label: `of ${fmt(NSA)} subject areas list it` },
      { n: facts, label: 'facts relate to it across Oracle’s data model' },
    ]),
    visual: reach > 0 ? (
      <InspectorVisual stack caption={`Listed in ${fmt(reach)} of ${fmt(NSA)} subject areas.`}>
        <ReachBar n={reach} total={NSA} />
        {d && flow && (
          <ul className="ins-chips" aria-label="Facts in this area that relate to it">
            {d.facts.map((fi) => <li key={fi} className="mono">{shortTable(flow.facts[fi].name)}</li>)}
          </ul>
        )}
      </InspectorVisual>
    ) : undefined,
    actions,
  };
}

/** A fact with a diagram gets the fact view; any other table the dimension view. */
export function inspectTable(m: CoreModel, cm: ColumnModel | null, t: number, area?: number | null): InspectorProps {
  return hasModel(m, t) ? inspectFact(m, cm, t, area) : inspectDimension(m, t, area);
}

export function inspectPair(m: CoreModel, saA: number, saB: number): InspectorProps {
  const A = m.subjectAreas[saA], B = m.subjectAreas[saB];
  const c = compare(m, saA, saB);
  return {
    kind: 'area',
    eyebrow: 'two subject areas',
    title: `${A.label} and ${B.label}`,
    lead: compareSentence(m, saA, saB),
    figures: positive([
      { n: c.onlyA.length, label: `only in ${A.label}` },
      { n: c.onlyB.length, label: `only in ${B.label}` },
      { n: c.both.length, label: 'listed under both' },
    ]),
    actions: [
      { label: 'Compare the two', sub: 'side by side, with both matrix rows', to: comparePath(A.slug, B.slug) },
      { label: `Open ${A.label}`, sub: 'its facts and the tables they relate to', to: areaPath(A.slug) },
      { label: `Open ${B.label}`, sub: 'its facts and the tables they relate to', to: areaPath(B.slug) },
    ],
  };
}

const fieldOf = (key: string, record: string) => key.slice(record.length + 1);

/** One warehouse column (physicalColumn index `c`). `area` carries ?area= on the links. */
export function inspectColumn(m: CoreModel, cm: ColumnModel, c: number, area?: number | null): InspectorProps {
  const t = cm.pcTable[c];
  const table = t >= 0 ? m.tables[t].name : '';
  const slug = area != null ? m.subjectAreas[area].slug : null;
  const srcs = cm.colSrc[c] ?? [];
  const names = new Set(cm.physPres[c].map((p) => cm.prcName[p]));
  const actions: InspectorAction[] = [];
  const f0 = srcs[0];
  if (f0 !== undefined) {
    const rec = cm.core.recordKey[cm.nfRecord[f0]];
    actions.push({ label: 'Trace its NetSuite field', sub: `${rec}.${cm.nfName[f0]} across every subject area`, to: fieldPath(rec, cm.nfName[f0].toLowerCase(), slug) });
  }
  if (table) actions.push({ label: `Open ${shortTable(table)}`, sub: 'the column in its table ledger', to: tablePath(table, { col: cm.pcName[c] }, slug) });
  const sa0 = area != null && cm.colSas[c].includes(area) ? null : cm.colSas[c][0];
  if (sa0 != null) actions.push({ label: `Open ${m.subjectAreas[sa0].label}`, sub: 'a subject area that reads it', to: areaPath(m.subjectAreas[sa0].slug) });
  return {
    kind: 'column',
    eyebrow: 'warehouse column',
    title: cm.pcName[c],
    mono: table ? `${table}.${cm.pcName[c]}` : undefined,
    lead: columnReadSentence(cm, c),
    figures: positive([
      { n: srcs.length, label: srcs.length === 1 ? 'NetSuite field it is loaded from' : 'NetSuite fields it is loaded from' },
      { n: cm.physPres[c].length, label: 'report columns read it' },
      names.size > 1 && { n: names.size, label: 'distinct report names' },
      { n: cm.colSas[c].length, label: 'subject areas read it' },
    ]),
    visual: srcs.length ? (
      <div className="ins-vis stack">
        <ul className="ins-src">
          {srcs.map((f) => {
            const rec = cm.core.recordKey[cm.nfRecord[f]];
            return (
              <li key={f}>
                <span className="faint">from</span>
                <Link to={fieldPath(rec, fieldOf(`${rec}.${cm.nfName[f].toLowerCase()}`, rec), slug)} className="mono link">{rec}.{cm.nfName[f]}</Link>
                <span className="tp-prov"><span className="tp-mark" aria-hidden="true" />stated</span>
              </li>
            );
          })}
        </ul>
      </div>
    ) : undefined,
    actions,
  };
}

/** One NetSuite field's impact trace. */
export function inspectField(m: CoreModel, trace: Trace, area?: number | null): InspectorProps {
  const slug = area != null ? m.subjectAreas[area].slug : null;
  const top = trace.groups.flatMap((g) => g.columns).sort((a, b) => b.reportColumns - a.reportColumns)[0];
  const busiest = trace.functionalAreas.flatMap((g) => g.areas).sort((a, b) => b.reportColumns - a.reportColumns)[0];
  const actions: InspectorAction[] = [];
  if (top) actions.push({ label: `Open ${shortTable(top.tableName)}`, sub: `${top.column}, read by ${fmt(top.reportColumns)} report columns`, to: tablePath(top.tableName, { col: top.column }, slug) });
  const go = area != null ? m.subjectAreas[area] : busiest ? m.subjectAreas[busiest.sa] : null;
  if (go) actions.push({ label: `Open ${go.label}`, sub: area != null ? 'the subject area you came from' : 'the subject area that reads it most', to: areaPath(go.slug) });
  return {
    kind: 'field',
    eyebrow: 'NetSuite field',
    title: trace.label,
    mono: `NetSuite record ${trace.record}`,
    figures: positive([
      { n: trace.totals.warehouseColumns, label: 'warehouse columns it feeds' },
      { n: trace.totals.reportColumns, label: 'report columns' },
      { n: trace.totals.subjectAreas, label: 'subject areas' },
      { n: trace.totals.functionalAreas, of: trace.totals.functionalAreasAll, label: 'functional areas' },
    ]),
    actions,
  };
}
