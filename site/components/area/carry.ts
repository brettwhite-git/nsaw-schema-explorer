// Carry the reader's subject area (?area= of the current location) onto a link that stays on a table or field
// page, so the breadcrumb keeps the same area. Read at render time; pages re-render on every navigation.
import { areaOf, withArea } from '../../routes';

export const carryArea = (to: string): string => {
  const a = typeof location === 'undefined' ? null : areaOf(location.search);
  return a ? withArea(to, a) : to;
};
