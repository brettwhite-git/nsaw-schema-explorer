// Counts and fields from the ontology. Cached per ontology object (the fields are the heaviest thing to build).
import type { Ontology } from '../../ontology/load';
import { modelField, warehouseField, type Field } from './fields';
import type { EntryCounts } from './model';

export function countsOf(o: Ontology): EntryCounts {
  const m = o.core.meta.counts;
  const wh = warehouseField(o);
  return { records: m.explicitNetsuiteRecords, tables: m.physicalTablesInLineage, twins: wh.twins, subjectAreas: m.subjectAreas, functionalAreas: m.functionalAreas };
}

const cache = new WeakMap<Ontology, { warehouse: Field; model: Field }>();
export function buildFields(o: Ontology): { warehouse: Field; model: Field } {
  let f = cache.get(o);
  if (!f) { f = { warehouse: warehouseField(o), model: modelField(o) }; cache.set(o, f); }
  return f;
}
