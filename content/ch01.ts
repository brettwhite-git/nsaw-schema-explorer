import type { ChapterContent } from './types';

/**
 * Chapter 1: Follow one order line.
 *
 * Every real identifier below was checked against public/ontology/*.json and data-src/ns_source_edges.csv
 * (see content/ch01.storyboard.md, "Identifier table"). Numbers quoted in copy are asserted in tests/ch01.test.ts.
 * The order, customer, item, dates, amounts, the NetSuite form and the report are invented (illustrative).
 */
const ch01: ChapterContent = {
  id: 'follow-one-order-line',
  number: 1,
  title: 'Follow one order line',
  dek: 'One line on one sales order, followed from the NetSuite form to a number on a report. Each step names the real tables it passes through and says which parts are drawn for the example.',
  figure: 'order-line-journey',
  illustrativeNote:
    'The order SO1041, the customer Harbor Supply Co., the item, the dates, the amounts and the report are invented for this chapter. The table, column and record names, the subject area and the counts are real and come from the lineage file. A pencil line in the figure marks something invented or something the lineage file does not show.',
  steps: [
    {
      id: 'one-form',
      figureStep: 0,
      heading: 'To the person typing it, an order is one form',
      body: [
        'Harbor Supply Co. wants a pallet jack and a roll of shrink wrap. A sales rep opens a sales order in NetSuite, picks the customer, adds two lines and saves. It looks like one thing: one form, one number, SO1041.',
        'Follow the first line, the pallet jack at 1,240.00. This chapter tracks it from that form to a number on a report, and shows what the warehouse does to it on the way.',
      ],
      note: 'one line, the whole trip',
      callouts: [
        { letter: 'a', text: 'SO1041 is the number people say out loud.' },
        { letter: 'b', text: 'Line 1 is the one we follow.' },
      ],
      threads: [
        { label: 'See every place this kind of order shows up', to: { type: 'subjectArea', key: 'NetSuite - Sales Order' }, provenance: 'explicit' },
      ],
    },
    {
      id: 'several-records',
      figureStep: 1,
      heading: 'The form is really several records',
      body: [
        'NetSuite does not store the form as a page. It stores records that point at each other. The order header, with its number and date, is one record. Each line is another. The accounting a line produces is a third. The customer and the item are records of their own, and the order only points at them.',
        'In the lineage file the header is `Transactions`, the line is `TransactionLine` and the customer is `customer`. The accounting line appears in Oracle\'s entity key list as *Sales Order Transaction Accounting Line*, but no column in the lineage file is sourced from it. We know it exists from Oracle\'s documentation, not from the data.',
      ],
      note: 'one form, five records',
      callouts: [
        { letter: 'a', text: 'The header: number, date, customer.' },
        { letter: 'b', text: 'The line: one per item ordered.' },
        { letter: 'c', text: 'The accounting line: not in the lineage file.' },
        { letter: 'd', text: 'The customer and the item are pointed at, not copied.' },
      ],
      threads: [
        { label: 'The header record: Transactions', to: { type: 'netsuiteRecord', key: 'transactions' }, provenance: 'explicit' },
        { label: 'The line record: TransactionLine', to: { type: 'netsuiteRecord', key: 'transactionline' }, provenance: 'explicit' },
        { label: 'The customer record', to: { type: 'netsuiteRecord', key: 'customer' }, provenance: 'explicit' },
      ],
    },
    {
      id: 'rows-land',
      figureStep: 2,
      heading: 'The warehouse copies rows, not the form',
      body: [
        'When data loads, rows from those records land in warehouse tables. The warehouse never sees the form. It sees rows, and the table name says what kind: a name ending `_F` holds events, a name ending `_D` holds things you describe events by.',
        'The header lands in `DW_NS_SALES_ORDER_F`, the lines in `DW_NS_SALES_ORDER_LINES_F`, the customer in `DW_NS_CUSTOMER_D`. The order number is a good one to watch: `Transactions.tranid` becomes the `TRANID` column of `DW_NS_SALES_ORDER_F`, and SO1041 sits there.',
      ],
      note: 'tranid in NetSuite, TRANID here. Same word, new home.',
      callouts: [
        { letter: 'a', text: '`Transactions.tranid` lands in `DW_NS_SALES_ORDER_F.TRANID`.' },
        { letter: 'b', text: '`TransactionLine.transaction` lands in `DW_NS_SALES_ORDER_LINES_F.TRANSACTION`.' },
      ],
      threads: [
        { label: 'The order header table', to: { type: 'physicalTable', key: 'DW_NS_SALES_ORDER_F' }, provenance: 'explicit' },
        { label: 'The order lines table', to: { type: 'physicalTable', key: 'DW_NS_SALES_ORDER_LINES_F' }, provenance: 'explicit' },
        { label: 'The customer table', to: { type: 'physicalTable', key: 'DW_NS_CUSTOMER_D' }, provenance: 'explicit' },
      ],
    },
    {
      id: 'fact-and-dimensions',
      figureStep: 3,
      heading: 'The line becomes a fact row, and what it points at becomes dimension rows',
      body: [
        'A *fact* is something that happened: this line was ordered. A *dimension* is something you describe facts by: which customer, which item, which day. The line becomes one row in `DW_NS_SALES_ORDER_LINES_F`. Harbor Supply becomes one row in `DW_NS_CUSTOMER_D`, the pallet jack one in `DW_NS_ITEM_D`, March 4 one in `DW_NS_DAY_D`.',
        'The fact row carries a key, not a name. The name lives once, on the dimension row, and every order from Harbor Supply points at it. In the data, NetSuite\'s `entity` field on the order lands in the `CUSTOMER` column of the lines table.',
        'Dimensions here are type 1: when a customer is renamed in NetSuite, the dimension row is overwritten and every past order shows the new name. The old name is not kept. History is kept in snapshot tables, not on dimensions.',
      ],
      note: 'a key, not a name',
      callouts: [
        { letter: 'a', text: 'The fact row: one line, one row.' },
        { letter: 'b', text: 'The customer link is in the data: `Transactions.entity` lands in `CUSTOMER`. The join to `DW_NS_CUSTOMER_D.ID` is Oracle\'s documented example; the lineage file has no join conditions.' },
        { letter: 'c', text: 'The item and day links are inferred: these tables appear in the same subject areas as the fact. That is all the data shows.' },
        { letter: 'd', text: 'The day table is the warehouse\'s own calendar. It has no NetSuite source.' },
      ],
      threads: [
        { label: 'The CUSTOMER column on the line fact', to: { type: 'physicalColumn', key: 'DW_NS_SALES_ORDER_LINES_F.CUSTOMER' }, provenance: 'explicit' },
        { label: 'The item table', to: { type: 'physicalTable', key: 'DW_NS_ITEM_D' }, provenance: 'inferred' },
        { label: 'The calendar day table', to: { type: 'physicalTable', key: 'DW_NS_DAY_D' }, provenance: 'inferred' },
      ],
    },
    {
      id: 'grain',
      figureStep: 4,
      heading: 'The grain is one line, on one order, in one accounting book',
      body: [
        '*Grain* is what one row stands for. In `DW_NS_SALES_ORDER_LINES_F` a row stands for one line on one order in one accounting book. Three keys name it: the order, the line and the book.',
        'The book is the one people miss. A company that keeps two books, one for local rules and one for group reporting, has two rows for line 1, one per book. Add them up without choosing a book and the line counts twice. (The second book here is invented to show the trap.)',
        'So every fact row carries `source_record_id`, the grain keys joined into one value. Pick any row and you can name the NetSuite record behind it. NetSuite is the only place a fact is born; the warehouse copies it and keeps the address of where it came from.',
      ],
      note: 'the book is the one people miss',
      callouts: [
        { letter: 'a', text: 'The three keys are listed in Oracle\'s entity key list for this table: order, line, accounting book.' },
        { letter: 'b', text: 'The lineage file has no `SOURCE_RECORD_ID` column and no accounting book column on this table. That column is from Oracle\'s documentation, and the joined value is drawn in pencil.' },
        { letter: 'c', text: 'A second accounting book is invented to show two rows for one line.' },
      ],
      threads: [
        { label: 'The entity whose keys set the grain', to: { type: 'entity', key: 'Sales Order Transaction Accounting Line' }, provenance: 'explicit' },
        { label: 'The order key on the line fact', to: { type: 'physicalColumn', key: 'DW_NS_SALES_ORDER_LINES_F.TRANSACTION' }, provenance: 'explicit' },
        { label: 'The accounting book table', to: { type: 'physicalTable', key: 'DW_NS_ACCOUNTINGBOOK_D' }, provenance: 'inferred' },
      ],
    },
    {
      id: 'one-record-many-tables',
      figureStep: 5,
      heading: 'NetSuite has one transaction record; the warehouse splits it into many fact tables',
      body: [
        'Here is the surprise. In NetSuite a sales order, an invoice, a cash sale and a journal are not different kinds of record. They are one kind, `Transactions`, with a type field, and their lines are one kind, `TransactionLine`.',
        'The warehouse is what splits them. In the lineage file 87 fact tables load from `Transactions` and 65 from `TransactionLine`. `DW_NS_SALES_ORDER_F`, `DW_NS_CUSTOMER_INVOICE_F`, `DW_NS_CASH_SALE_F` and `DW_NS_JOURNAL_F` are four of the 87. There is no table called `DW_NS_TRANSACTIONS`.',
        'Which type goes to which table follows the table names. The rule that decides is not in the data.',
      ],
      note: 'one record in, many tables out',
      callouts: [
        { letter: 'a', text: 'One NetSuite record, `Transactions`.' },
        { letter: 'b', text: 'Four of the 87 fact tables it feeds.' },
      ],
      threads: [
        { label: 'The one record behind 87 fact tables', to: { type: 'netsuiteRecord', key: 'transactions' }, provenance: 'explicit' },
        { label: 'A sibling fact table: invoices', to: { type: 'physicalTable', key: 'DW_NS_CUSTOMER_INVOICE_F' }, provenance: 'explicit' },
        { label: 'The line record behind 65 tables', to: { type: 'netsuiteRecord', key: 'transactionline' }, provenance: 'explicit' },
      ],
    },
    {
      id: 'business-name',
      figureStep: 6,
      heading: 'The model gives the row a business name and a home',
      body: [
        'Nobody writes `DW_NS_SALES_ORDER_LINES_F.ID` on a report. The semantic model renames it *Sales Order Line Number* and files it under a subject area, here *NetSuite - Sales Order*, part of Order to Cash.',
        'That subject area draws on 67 warehouse tables: 11 fact tables, 50 dimension tables and six of other kinds. It offers 623 columns under business names. The line fact feeds 13 of them directly. The amounts come from its secured twin, `DW_NS_SALES_ORDER_LINES_F_SEC` (the `_SEC` suffix marks a secured variant, which we know from the name).',
        'The dimensions are shared. `DW_NS_CUSTOMER_D` sits under 49 of the 110 subject areas, and the calendar and currency tables under 108. One customer table, described once, used everywhere: that is what *conformed* means.',
      ],
      note: 'same customer table, 49 subject areas',
      callouts: [
        { letter: 'a', text: '`DW_NS_SALES_ORDER_LINES_F.ID` is served as *Sales Order Line Number*.' },
        { letter: 'b', text: '`DW_NS_CUSTOMER_D.COMPANYNAME` is served as *Customer Company Name*, in 48 subject areas.' },
        { letter: 'c', text: 'The subject area is a view over these tables. It is not another copy.' },
      ],
      threads: [
        { label: 'The subject area', to: { type: 'subjectArea', key: 'NetSuite - Sales Order' }, provenance: 'explicit' },
        { label: 'The secured twin that serves the amounts', to: { type: 'physicalTable', key: 'DW_NS_SALES_ORDER_LINES_F_SEC' }, provenance: 'inferred' },
        { label: 'Customer Company Name', to: { type: 'presentationColumn', key: 'NetSuite - Sales Order::Customer::Customer Company Name' }, provenance: 'explicit' },
      ],
    },
    {
      id: 'the-number',
      figureStep: 7,
      heading: 'A number on a report, and the thread back',
      body: [
        'A report writer picks three things: a date, a customer attribute and a measure. Here they are Fiscal Date, Customer Company Name and Line Amount in Base Currency. Filter to Harbor Supply and March 2026 and the model adds the two lines: 1,240.00 plus 310.50 is 1,550.50.',
        'Click the number and the thread runs backwards. The two rows that made it light up, each row names its source, and the source is the form on the first page, SO1041.',
        'The values here are invented. The path is real: every table and column in this chapter is in the lineage file. We call the amount column a measure because of its name and the report we chose. The data does not say which columns are measures.',
      ],
      note: '1,550.50: the form, by a longer road',
      callouts: [
        { letter: 'a', text: 'The report cell is invented. The columns behind it are real.' },
        { letter: 'b', text: '`DW_NS_SALES_ORDER_LINES_F_SEC.BASE_AMOUNT` serves *Line Amount in Base Currency*. Its NetSuite source field is a name-based guess.' },
      ],
      threads: [
        { label: 'Line Amount in Base Currency', to: { type: 'presentationColumn', key: 'NetSuite - Sales Order::Transaction Lines - Base Currency Amounts::Line Amount in Base Currency' }, provenance: 'explicit' },
        { label: 'The warehouse column behind it', to: { type: 'physicalColumn', key: 'DW_NS_SALES_ORDER_LINES_F_SEC.BASE_AMOUNT' }, provenance: 'explicit' },
        { label: 'Back to the order number', to: { type: 'physicalColumn', key: 'DW_NS_SALES_ORDER_F.TRANID' }, provenance: 'explicit' },
      ],
    },
  ],
};

export default ch01;
