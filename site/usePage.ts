// Per-page chores every page calls once:
//
//   usePage({ title: 'DW_NS_CUSTOMER_D', ready: !!core });
//
// - sets document.title to "<title> · NetSuite Data Intelligence Schema Explorer" (the bare site name when title is empty);
// - sets document.body.dataset.ready = '1' once `ready` is true (the page's data has rendered), and removes
//   it while false. Screenshot scripts wait for body[data-ready="1"].
// Focusing the h1 on route change is done by App, not here.
import { useEffect } from 'react';

export const SITE_NAME = 'NetSuite Data Intelligence Schema Explorer';

export function usePage({ title, ready = true }: { title: string; ready?: boolean }): void {
  useEffect(() => { document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME; }, [title]);
  useEffect(() => {
    if (ready) document.body.dataset.ready = '1'; else delete document.body.dataset.ready;
  }, [ready]);
}
