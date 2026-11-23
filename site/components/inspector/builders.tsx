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

/**
 * "Go next" labels name the kind of thing: "Subject area: Cash Refund", "Fact table: Sales Order Lines",
 * "Dimension: Employee", "NetSuite field: transactions.tranid". A table's readable name gives way to its physical name
 * when it reads the same as the subject area around it. The Inspector drops any action pointing at the current page
 * and shows at most four, so builders list the natural next level down first.
 */
export function tableLabel(m: CoreModel, t: number, areaLabel?: string | null): string {
  const name = m.tables[t].name;
  const pretty = prettyTable(m, name);
  const shown = !pretty || (areaLabel && pretty.toLowerCase() === areaLabel.toLowerCase()) ? name : pretty;
  const kind = isFact(m, t) ? 'Fact table' : m.tables[t].role === 'dimension' ? 'Dimension' : 'Table';
  return `${kind}: ${shown}`;
}
const fieldAction = (rec: string, field: string, slug: string | null, sub: string, from?: string): InspectorAction =>
  ({ label: `NetSuite field: ${rec}.${field.toLowerCase()}`, sub, to: fieldPath(rec, field.toLowerCase(), from ? { from } : {}, slug) });

const positive = (fs: (InspectorFigure | false | null | undefined)[]): InspectorFigure[] =>
  fs.filter((f): f is InspectorFigure => !!f && (typeof f.n !== 'number' || f.n > 0));

export function inspectArea(m: CoreModel, sa: number): InspectorProps {
  const s = m.subjectAreas[sa];
  const flow = areaFlow(m, sa);
  const fa = s.fa >= 0 ? m.functionalAreas[s.fa].name : '';
  const drawn = new Set(flow.facts.map((f) => f.table));
  const listed = m.factsOfSa[sa];
  const near = similarAreas(m, sa, 1)[0];
  const actions: InspectorAction[] = [{ label: `Subject area: ${s.label}`, sub: 'its facts and the tables they relate to', to: areaPath(s.slug) }];
  const big = flow.facts.length ? flow.facts.reduce((a, b) => (b.rels.length > a.rels.length ? b : a)).table : listed[0];
  if (big !== undefined) actions.push({ label: tableLabel(m, big, s.label), sub: 'its data model star and column ledger', to: tablePath(m.tables[big].name, s.slug) });
  if (near) actions.push({ label: `Compare with ${m.subjectAreas[near.sa].label}`, sub: `${fmt(near.shared)} shared dimensions`, to: comparePath(s.slug, m.subjectAreas[near.sa].slug) });
  if (s.row >= 0) actions.push({ label: `Matrix row: ${s.label}`, sub: 'the dimensions it shares with other areas', to: matrixPath({ a: s.slug }) });
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
  const areaLabel = area != null ? m.subjectAreas[area].label : null;
  const actions: InspectorAction[] = [{ label: tableLabel(m, t, areaLabel), sub: rels.length ? 'its data model star and column ledger' : 'its column ledger', to: tablePath(name, slug) }];
  if (cm) {
    const lr = ledgerRows(m, cm, t);
    const row = lr.rows.find((r) => r.isKey && r.sources.length) ?? lr.rows.find((r) => r.sources.length);
    const src = row?.sources[0];
    if (src) actions.push(fieldAction(src.record, src.key.slice(src.record.length + 1), slug, `loaded into ${row!.name}; its trace across every subject area`, name));
  }
  if (slug) actions.push({ label: `Subject area: ${areaLabel}`, sub: 'the subject area flow', to: areaPath(slug) });
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
  const areaLabel = area != null ? m.subjectAreas[area].label : null;
  const actions: InspectorAction[] = [{ label: tableLabel(m, t, areaLabel), sub: facts ? 'facts that relate to it, its columns' : 'its columns', to: tablePath(name, slug) }];
  if (m.tables[t].col >= 0) actions.push({ label: `Matrix column: ${prettyTable(m, name)}`, sub: 'the subject areas that list it', to: matrixPath({ dim: name }) });
  if (slug) actions.push({ label: `Subject area: ${areaLabel}`, sub: 'the subject area flow', to: areaPath(slug) });
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
      { label: `Compare ${A.label} with ${B.label}`, sub: 'side by side, with both matrix rows', to: comparePath(A.slug, B.slug) },
      { label: `Subject area: ${A.label}`, sub: 'its facts and the tables they relate to', to: areaPath(A.slug) },
      { label: `Subject area: ${B.label}`, sub: 'its facts and the tables they relate to', to: areaPath(B.slug) },
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
    actions.push(fieldAction(rec, cm.nfName[f0], slug, 'its trace across every subject area', table || undefined));
  }
  if (t >= 0) actions.push({ label: tableLabel(m, t, area != null ? m.subjectAreas[area].label : null), sub: `the column ${cm.pcName[c]} in its ledger`, to: tablePath(table, { col: cm.pcName[c] }, slug) });
  const sa0 = area != null && cm.colSas[c].includes(area) ? null : cm.colSas[c][0];
  if (sa0 != null) actions.push({ label: `Subject area: ${m.subjectAreas[sa0].label}`, sub: 'a subject area that reads it', to: areaPath(m.subjectAreas[sa0].slug) });
  else if (area != null) actions.push({ label: `Subject area: ${m.subjectAreas[area].label}`, sub: 'the subject area flow', to: areaPath(m.subjectAreas[area].slug) });
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
  if (top) actions.push({ label: tableLabel(m, top.table), sub: `${top.column}, read by ${fmt(top.reportColumns)} report columns`, to: tablePath(top.tableName, { col: top.column }, slug) });
  const go = area != null ? m.subjectAreas[area] : busiest ? m.subjectAreas[busiest.sa] : null;
  if (go) actions.push({ label: `Subject area: ${go.label}`, sub: area != null ? 'the subject area you came from' : 'the subject area that reads it most', to: areaPath(go.slug) });
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
