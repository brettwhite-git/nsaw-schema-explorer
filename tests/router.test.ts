import { describe, it, expect } from 'vitest';
import { atlasPath, coursePath, isFilePath, matchPattern, matchRoute } from '../site/routes';

describe('router matching', () => {
  it('matches the five routes', () => {
    expect(matchRoute('/')).toEqual({ name: 'home' });
    expect(matchRoute('/course/follow-one-order-line')).toEqual({ name: 'course', chapterId: 'follow-one-order-line' });
    expect(matchRoute('/atlas')).toEqual({ name: 'atlas' });
    expect(matchRoute('/atlas/physicalTable/DW_NS_CUSTOMER_D')).toEqual({ name: 'entity', type: 'physicalTable', key: 'DW_NS_CUSTOMER_D' });
    expect(matchRoute('/index')).toEqual({ name: 'index' });
  });
  it('decodes keys with spaces, colons and slashes', () => {
    const key = 'NetSuite - Sales Order::Customer::Customer Company Name';
    expect(matchRoute(atlasPath('presentationColumn', key))).toEqual({ name: 'entity', type: 'presentationColumn', key });
    expect(matchRoute(atlasPath('x', 'a/b'))).toEqual({ name: 'entity', type: 'x', key: 'a/b' });
  });
  it('ignores a trailing slash, the query and the hash', () => {
    expect(matchRoute('/atlas/')).toEqual({ name: 'atlas' });
    expect(matchRoute('/course/a?reduced=1')).toEqual({ name: 'course', chapterId: 'a' });
    expect(matchRoute('/index#x')).toEqual({ name: 'index' });
  });
  it('unknown paths are not found', () => {
    expect(matchRoute('/nope')).toEqual({ name: 'notFound', path: '/nope' });
    expect(matchRoute('/atlas/subjectArea')).toEqual({ name: 'notFound', path: '/atlas/subjectArea' });
    expect(matchRoute('/atlas/a/%E0%A4%A')).toEqual({ name: 'notFound', path: '/atlas/a/%E0%A4%A' });
  });
  it('matchPattern captures named segments only', () => {
    expect(matchPattern('/a/:x/b', '/a/1/b')).toEqual({ x: '1' });
    expect(matchPattern('/a/:x/b', '/a/1/c')).toBeNull();
  });
  it('builds paths that round-trip', () => {
    expect(coursePath('c')).toBe('/course/c');
    expect(atlasPath('subjectArea', 'NetSuite - Sales Order')).toBe('/atlas/subjectArea/NetSuite%20-%20Sales%20Order');
  });
  it('files are served by the host, not routed', () => {
    expect(isFilePath('/legacy.html')).toBe(true);
    expect(isFilePath('/ontology/core.json')).toBe(true);
    expect(isFilePath('/paper/paper-c-dark.webp')).toBe(true);
    expect(isFilePath('/atlas/physicalTable/DW_NS_CUSTOMER_D')).toBe(false);
    expect(isFilePath('/atlas/netsuiteRecord/Sales%20Order')).toBe(false);
  });
});
