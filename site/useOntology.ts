import { useEffect, useState } from 'react';
import { loadOntology, type Ontology } from '../ontology/load';

// One ontology per page load. core.json (71 KB gzipped) loads first; columns.json and usedwith.json are lazy.
let shared: Promise<Ontology> | null = null;
export function getOntology(): Promise<Ontology> {
  if (!shared) {
    shared = loadOntology({ baseUrl: '/ontology/' });
    shared.catch(() => { shared = null; });
  }
  return shared;
}

export function useOntology(): { ontology?: Ontology; error?: string } {
  const [state, set] = useState<{ ontology?: Ontology; error?: string }>({});
  useEffect(() => {
    let live = true;
    getOntology().then((ontology) => live && set({ ontology }), (e) => live && set({ error: String(e?.message ?? e) }));
    return () => { live = false; };
  }, []);
  return state;
}
