#!/usr/bin/env python3
"""One-off extractor: Oracle FDI lineage workbook -> small committed CSVs in data-src/.

Usage (the workbook is untrusted data; keep this script OUTSIDE its folder):
    python3 -I scripts/extract-workbook.py /path/to/Data_Lineage_NS_NSDI_4.0.xlsx [out_dir]
    # default out_dir: data-src/

No third-party packages: the sheet XML is read straight from the zip.
Sheet layout: row 1 is a banner, row 2 is the real header:
  NetSuite Table | NetSuite Column | NetSuite Table Type | Physical Table |
  Physical Column | Subject Area | Table (Analytics) | Column (Analytics)

Only the NetSuite part is kept (Physical Table starts with DW_NS_). Outputs:
  ns_source_edges.csv  ns_record, ns_field, ns_record_type, physical_table, physical_column   (distinct, explicit NS -> DW)
  nsaw_derived.csv     physical_table, physical_column   (NetSuite Table == literal NSAW_DERIVED)
Literal "NaN" strings (pandas artefacts) are treated as empty. Cells are whitespace-trimmed.
"""
import csv, sys, zipfile, os
from xml.etree.ElementTree import iterparse

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def col_index(ref):
    n = 0
    for ch in ref:
        if not ch.isalpha():
            break
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def read_rows(path):
    z = zipfile.ZipFile(path)
    sst = []
    for _, el in iterparse(z.open('xl/sharedStrings.xml')):
        if el.tag == NS + 'si':
            sst.append(''.join(t.text or '' for t in el.iter(NS + 't')))
            el.clear()
    for _, el in iterparse(z.open('xl/worksheets/sheet1.xml')):
        if el.tag != NS + 'row':
            continue
        r = [''] * 8
        for c in el:
            i = col_index(c.get('r'))
            if i >= 8:
                continue
            t = c.get('t')
            v = c.find(NS + 'v')
            if v is None:
                isn = c.find(NS + 'is')
                val = ''.join(x.text or '' for x in isn.iter(NS + 't')) if isn is not None else ''
            elif t == 's':
                val = sst[int(v.text)]
            else:
                val = v.text or ''
            r[i] = val
        yield int(el.get('r')), r
        el.clear()


def clean(s):
    s = (s or '').strip()
    return '' if s == 'NaN' else s


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-src')
    os.makedirs(out, exist_ok=True)
    edges, derived = set(), set()
    total = ns_rows = 0
    for n, r in read_rows(src):
        if n <= 2:
            continue
        total += 1
        rec, fld, typ, pt, pc = (clean(x) for x in r[:5])
        if not pt.startswith('DW_NS_') or not pc:
            continue
        ns_rows += 1
        if rec == 'NSAW_DERIVED':
            derived.add((pt, pc))
        elif rec and fld:
            edges.add((rec, fld, typ, pt, pc))
    with open(os.path.join(out, 'ns_source_edges.csv'), 'w', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['ns_record', 'ns_field', 'ns_record_type', 'physical_table', 'physical_column'])
        w.writerows(sorted(edges))
    with open(os.path.join(out, 'nsaw_derived.csv'), 'w', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['physical_table', 'physical_column'])
        w.writerows(sorted(derived))
    print(f'data rows {total}, DW_NS rows {ns_rows}, explicit edges {len(edges)} '
          f'on {len({e[3] for e in edges})} tables, derived columns {len(derived)} on {len({d[0] for d in derived})} tables')


if __name__ == '__main__':
    main()
