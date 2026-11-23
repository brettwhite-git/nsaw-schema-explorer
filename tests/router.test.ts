import { describe, it, expect } from 'vitest';
import {
  areaPath, comparePath, fieldPath, isFilePath, matchPattern, matchRoute, matrixPath, parseQuery, searchPath, tablePath, withQuery,
} from '../site/routes';

describe('router matching', () => {
  it('matches the six routes', () => {
    expect(matchRoute('/')).toEqual({ name: 'matrix' });
    expect(matchRoute('/compare/sales-order/customer-invoice')).toEqual({ name: 'compare', a: 'sales-order', b: 'customer-invoice' });
    expect(matchRoute('/area/sales-order')).toEqual({ name: 'area', slug: 'sales-order' });
    expect(matchRoute('/table/DW_NS_SALES_ORDER_LINES_F')).toEqual({ name: 'table', table: 'DW_NS_SALES_ORDER_LINES_F' });
    expect(matchRoute('/field/customer/companyname')).toEqual({ name: 'field', record: 'customer', field: 'companyname' });
    expect(matchRoute('/search')).toEqual({ name: 'search' });
  });
  it('ignores a trailing slash, the query and the hash', () => {
    expect(matchRoute('/table/X/')).toEqual({ name: 'table', table: 'X' });
    expect(matchRoute('/?dim=DW_NS_EMPLOYEE_D')).toEqual({ name: 'matrix' });
    expect(matchRoute('/search?q=grain:line#top')).toEqual({ name: 'search' });
  });
  it('decodes segments', () => {
    expect(matchRoute(fieldPath('transactions', 'a b/c'))).toEqual({ name: 'field', record: 'transactions', field: 'a b/c' });
  });
  it('unknown paths are not found (decoded for display)', () => {
    expect(matchRoute('/nope')).toEqual({ name: 'notFound', path: '/nope' });
    expect(matchRoute('/table')).toEqual({ name: 'notFound', path: '/table' });
    expect(matchRoute('/no%20such')).toEqual({ name: 'notFound', path: '/no such' });
    expect(matchRoute('/table/%E0%A4%A')).toEqual({ name: 'notFound', path: '/table/%E0%A4%A' });
  });
  it('matchPattern captures named segments only', () => {
    expect(matchPattern('/a/:x/b', '/a/1/b')).toEqual({ x: '1' });
    expect(matchPattern('/a/:x/b', '/a/1/c')).toBeNull();
  });
  it('builds paths that round-trip', () => {
    expect(matrixPath()).toBe('/');
    expect(matrixPath({ dim: 'DW_NS_EMPLOYEE_D' })).toBe('/?dim=DW_NS_EMPLOYEE_D');
    expect(comparePath('sales-order', 'customer-invoice')).toBe('/compare/sales-order/customer-invoice');
    expect(areaPath('sales-order')).toBe('/area/sales-order');
    expect(tablePath('DW_NS_SALES_ORDER_LINES_F', { col: 'TRANSACTION' })).toBe('/table/DW_NS_SALES_ORDER_LINES_F?col=TRANSACTION');
    expect(fieldPath('customer', 'companyname', { at: null })).toBe('/field/customer/companyname');
    expect(searchPath('grain:line type:fact')).toBe('/search?q=grain:line+type:fact');
    expect(searchPath('')).toBe('/search');
  });
  it('parses and patches the query', () => {
    expect(parseQuery('/search?q=grain:line+type:fact&x=1#h')).toEqual({ q: 'grain:line type:fact', x: '1' });
    expect(parseQuery('/table/X')).toEqual({});
    expect(withQuery('/table/X?col=A&sa=1', { col: 'B' })).toBe('/table/X?col=B&sa=1');
    expect(withQuery('/table/X?col=A&sa=1', { col: null, sa: '' })).toBe('/table/X');
    expect(withQuery('/t?x=1#frag', { y: '2' })).toBe('/t?x=1&y=2#frag');
    expect(parseQuery(withQuery('/s', { q: 'a&b=c ?' }))).toEqual({ q: 'a&b=c ?' });
  });
  it('files are served by the host, not routed', () => {
    expect(isFilePath('/ontology/core.json')).toBe(true);
    expect(isFilePath('/assets/index.js')).toBe(true);
    expect(isFilePath('/favicon.svg')).toBe(true);
    expect(isFilePath('/table/DW_NS_CUSTOMER_D')).toBe(false);
    expect(isFilePath('/field/customer/companyname?sa=x.y')).toBe(false);
  });
});
