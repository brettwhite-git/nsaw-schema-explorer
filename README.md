# NSAW Schema Explorer

A reference explorer for Oracle NetSuite Analytics Warehouse (NSAW) 25R4. See which subject areas share which dimensions, what grain each fact table has, and how a NetSuite field flows through warehouse columns into report columns.

- **Bus matrix**: 110 subject areas by the dimension tables they share.
- **Compare** two subject areas, differences first.
- **Table pages** with grain, header/line links, a column ledger from NetSuite field to report column, and neighbouring tables.
- **Field traces**: everything one NetSuite field feeds.
- **Search** with filters such as `type:fact grain:line area:"Order to Cash"`.

## Data sources

Built from Oracle's published NSAW 25R4 files (semantic model lineage, Entity Key List, BI view objects, analytics tables index) and the NetSuite data lineage 4.0 workbook. The site shows only relationships these files state.

This is an independent project. Oracle and NetSuite are trademarks of Oracle Corporation.

## Run it

```bash
npm install
npm run dev        # http://localhost:3001
npm test
npm run build      # static site in dist/
```

`npm run ontology` rebuilds `public/ontology/*.json` from `data-src/`.

## License

MIT. See [LICENSE](LICENSE).
