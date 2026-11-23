# The entry piece: story and scene sheets

"How NetSuite Data Intelligence is put together."

Status, 2026-11-21: these sheets are for review. They replace the earlier set. The lab holds an older
version of the opening and front office scenes (`lab/scenes/`) and the approved look (`lab/dollhouse/`).
Nothing new is built until these sheets are signed off.

## The story

A customer comes to the counter of a building with three questions. To answer them we go down to the
ground floor, where one order arrives, and follow it up through the building. On every floor one person
does one job and passes the order on. Each floor answers one of the questions. At the top we are back at
the counter, and the customer is handed one report that answers all three.

## Decisions

| Decision | Answer |
|---|---|
| Setting | You present it live. |
| Level | Finance leadership. Deeper answers sit one click away. |
| What it argues | Why this is hard to do inside NetSuite alone, and how much is already built. |
| The three questions | Time, people, systems. Pinned from the start, ticked when answered. |
| Shape | Bookends at the counter. A relay of workers in between. |
| Effort | A ledger with one line per floor, using only counts the lineage data supports. |
| Control | Click or key for the next finished frame. Scroll within a beat. Number keys and the pinned questions jump to a floor. |
| Tone | NetSuite keeps the business running. It is never shown failing. |
| Other systems | Web store, web analytics, marketing, the old system. Generic labels. |
| Length | No fixed length. Any scene can be skipped to its last frame. |

### The three questions

1. "How do we compare with last year, when last year is in the old system?"
2. "Why do we each have a different number?"
3. "What about the web store and marketing data that isn't in NetSuite?"

Pinned, they shorten to: *Last year? Whose number? Other systems?*

## Voice

Every word on screen is narration: what happens and who does it, in the order it happens. Present tense,
short sentences, concrete nouns, people doing things. Each line is something you could say aloud while the
picture plays.

Say what a thing is and what it does. No "X, not Y". No "if this, then that". No "rather than" or
"instead of".

## The look

A building cut open side-on, like a dollhouse. Five rooms, one worker in each, a dumbwaiter up the left
side, a counter window and a loading dock on the right. Drawn in ink on the dark night-ocean paper.

- **People** are solid light silhouettes with no faces. Posture and one mark tell you who they are: the
  clerk's eyeshade, the courier's cap and satchel, the stock-keeper's apron, the cataloguer's spectacles,
  the counter clerk's waistcoat, the customer's hat and coat.
- **Objects** are things you recognise without a label: a paper form, index cards, a cabinet, parcels, a
  trolley, ledgers on shelves, a wall calendar, a measuring tape, name plates, a printed report.
- **One amber thing**: the order line we follow.
- **One idea per click.** Three to five things at full strength. Everything else steps back.
- **Words**: plain names large ("the order", "the customer"), the system's own name small beneath.
- **Shots**: each scene opens wide on the building to show which floor we are on, then moves in.
- **How we know**: one quiet legend line, and a small mark on anything taken from Oracle's documentation.

## The rooms

| Floor | Room | Worker | Product layer |
|---|---|---|---|
| 5 | Counter and dock | Counter clerk | The two ways out |
| 4 | Catalogue desk | Cataloguer | The semantic model |
| 3 | Stock room | Stock-keeper | The warehouse |
| 2 | Post room | Courier | Getting data in |
| 1 | Front office | Clerk | NetSuite |

---

## Scene 0. At the counter

**Purpose.** Open the three questions and send us downstairs.

**Who.** The customer and the counter clerk.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | The whole building at dusk, quiet. A customer walks up to the counter window. | A customer comes to the counter with three questions. |
| 2 | Close on the counter. The first question is written above the customer. | "How do we compare with last year, when last year is in the old system?" |
| 3 | The second question is written. | "Why do we each have a different number?" |
| 4 | The third question is written. | "What about the web store and marketing data that isn't in NetSuite?" |
| 5 | The counter clerk pins three notes to a board. They stay in the corner for the whole piece. | The clerk pins up all three. |
| 6 | The view travels down the outside of the building to the ground floor. A light comes on. | The answers start downstairs, with one order. |

**Hand-off.** We arrive in the front office as an order form lands on the desk.

**Sources.** Authored. Nothing here is a claim about the product.

---

## Scene 1. The front office

**Product layer.** NetSuite.

**Purpose.** Show how an order is kept, and why the three questions need more than this room.

**Who.** The clerk.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | An order form on the desk: SO1041, Harbor Supply Co., two lines. Line 1 turns amber. | An order arrives. We follow this line. |
| 2 | The clerk tears the form along its perforations. | The clerk tears it into cards: one for the order, one for each line. |
| 3 | The clerk files each card. Drawers open: orders, lines, customers, items. | Each card goes in its own drawer. |
| 4 | Close on the amber card. A slip is clipped to it; a string runs to the order card, and from there to the customer card. | Every card carries a note saying where to find the others. |
| 5 | The clerk rewrites the name on one customer card. The name changes on the order. | When a customer changes their name, the clerk changes one card. |
| 6 | Question 1 comes forward. A wall calendar shows January 2024, the day the cabinet arrived. | The cabinet was installed in January 2024. Older orders live in the old system. |
| 7 | Question 2 comes forward. Three tapes are laid against the same order and stop at ordered, shipped, invoiced. | Three people measure the same order and read three numbers. |
| 8 | Question 3 comes forward. Parcels sit on the floor beside the cabinet. | Parcels arrive from the web store, marketing and the old system. The office has no drawer for them. |
| 9 | Wide on the room, tidy and busy. The ledger's first line is written. | The front office keeps today's business running. |
| 10 | The clerk puts a copy of the amber card in the dumbwaiter. It rises. | A copy of our line goes upstairs. |

**Ledger.** 173 kinds of record, filed as they happen.

**Sources.** Record names (`Transactions`, `TransactionLine`, `customer`, `item`), the links from line to
order and order to customer, and the count of 173 are in the lineage data. The order, the amounts, the
dates and the three tape readings (1,550.50 ordered, 1,240.00 shipped, 620.00 invoiced) are invented.

**Likely questions.** "Are saved searches going away?" They stay the tool for looking things up day to day.

---

## Scene 2. The post room

**Product layer.** Getting data in.

**Purpose.** Answer question 3: other systems.

**Who.** The courier.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | Wide: the building, the post room lit. Then in. The dumbwaiter opens and the courier takes out a stack of copied cards, the amber one on top. | In the post room, a courier collects copies of the day's cards. |
| 2 | The courier stacks them on a trolley. | The originals stay in the office. The copies travel on. |
| 3 | A side hatch opens. Four parcels slide in, each with a sender's tag. | Parcels come in from the web store, web analytics, marketing and the old system. |
| 4 | The courier loads the parcels on the same trolley. Question 3 is ticked. | Everything goes on the same trolley. |
| 5 | The courier wheels the trolley into the lift. The ledger's second line is written. | The courier takes it all upstairs. |

**Ledger.** Collections from NetSuite: run by Oracle. Other senders: set up once.

**Sources.** All of this comes from Oracle's documentation and your deck. The lineage data holds NetSuite
sources only.

**To confirm before building.** Which collections Oracle runs and which the customer sets up. How often
collections run; no schedule is stated on screen until this is confirmed.

**Likely questions.** "How fresh is the data?" "What about our custom fields?"

---

## Scene 3. The stock room

**Product layer.** The warehouse.

**Purpose.** Answer question 1: time.

**Who.** The stock-keeper.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | Wide, then in. The trolley arrives. The stock-keeper starts to unpack. | Upstairs, the stock-keeper unpacks the trolley. |
| 2 | Ledgers on shelves. The stock-keeper opens one labelled "sales order lines". | What happened is written into ledgers: one line for every order line. |
| 3 | Card drawers beside the shelves: customers, items, dates. | Who and what it happened to is kept on cards: customers, items, dates. |
| 4 | The amber line is written into the ledger. Two strings run to a customer card and an item card. | Our line goes into the sales ledger, tied to its customer and its item. |
| 5 | A web store parcel is unpacked onto the next shelf. Its string runs to the same customer card. | Web store sales go on the next shelf and share the same customer cards. |
| 6 | Question 1 comes forward. Boxes from the old system are shelved behind this year's. A row of dated boxes stands beside them. | Last year's boxes from the old system go on the same shelves. Every month keeps its own dated box. |
| 7 | Question 1 is ticked. Wide: the whole stock room, shelf after shelf. The ledger's third line is written. | The stock room is already built and labelled. |

**Ledger.** 447 shelves and drawers, already built. 15 subjects keep dated snapshots.

**Sources.** Table names, the count of 447 and the 15 snapshot subject areas are in the lineage data. The
ties between a ledger and its cards are inferred: the tables appear together, and the data holds no join
keys. The web store shelf and the old system's boxes are invented.

**Likely questions.** "Will the numbers match NetSuite?" "How far back does history go?"

---

## Scene 4. The catalogue desk

**Product layer.** The semantic model.

**Purpose.** Answer question 2: people.

**Who.** The cataloguer.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | Wide, then in. The cataloguer sits at a desk with a catalogue open and a tray of blank name plates. | On the next floor, the cataloguer names everything on the shelves. |
| 2 | A shelf code is copied onto a plate with its plain name beneath. | `BASE_AMOUNT` becomes "Line Amount in Base Currency". |
| 3 | A second plate. | `COMPANYNAME` becomes "Customer Company Name". |
| 4 | Question 2 comes forward. The three tapes from the front office hang on the wall. The cataloguer takes them down and hangs one. | The cataloguer hangs one tape on the wall. Everyone measures sales with it. |
| 5 | Question 2 is ticked. The plates are sorted into trays by subject. One tray reads "Sales Order". | The names are sorted into 110 subjects. |
| 6 | Wide: the catalogue wall. The ledger's fourth line is written. | The catalogue is already written. |

**Ledger.** 110 subjects and 36,289 named fields, already catalogued.

**Sources.** The column-to-name pairs and both counts are in the lineage data. That each name carries one
agreed way of measuring comes from Oracle's documentation; the data holds names, not formulas.

**Likely questions.** "Can we add our own measures?"

---

## Scene 5. Back at the counter

**Product layer.** The two ways out.

**Purpose.** Hand over the answer to all three questions.

**Who.** The counter clerk and the customer, joined by two colleagues.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | Wide, then in. The counter clerk opens the catalogue to "Sales Order". | Back at the counter, the clerk looks up the three questions in the catalogue. |
| 2 | A keyholder at the stock room door checks a list. | A keyholder checks what each person may see. |
| 3 | The clerk prints one report and slides it across: Harbor Supply Co., March 2026 beside March 2025, NetSuite sales and web store sales, one total. | The clerk prints one report: this March beside last March, NetSuite beside the web store. |
| 4 | Two colleagues join the customer. All three read the same sheet. The three pinned notes settle on it, each beside what answers it. | Three people read the same number. |
| 5 | Around the side, the loading dock hands out whole boxes on a trolley. | The loading dock hands out whole boxes to anyone who wants to count for themselves. |
| 6 | The ledger's fifth line is written. | Everyone leaves with an answer. |

**Ledger.** 187 locked shelves. One report for everyone.

**Sources.** The 187 secured tables are in the lineage data. The counter, the dock and the keyholder come
from Oracle's documentation. Every figure on the report is invented.

**Likely questions.** "Can we keep using Excel?" "Who can see what?"

---

## Scene 6. The whole building

**Purpose.** Answer "what would it take to build this ourselves".

**Who.** Everyone.

| Click | What we see | Words on screen |
|---|---|---|
| 1 | The view pulls back to the whole building, every room lit, every worker at work. The amber thread runs from the front office to the counter. | The whole building, staffed and running. |
| 2 | The ledger stands beside the building with all five lines written. | All of this is already built and staffed. |
| 3 | One more line is written beneath the ledger. | What is left for you: tell the post room about your other senders, and choose your custom fields. |
| 4 | At rest. Each room opens its chapter or its real tables. Each pinned question jumps back to its floor. | |

**Sources.** The ledger repeats the counts above. The last line, what remains the customer's work, comes
from Oracle's documentation and needs confirming against the deck.

---

## Open before building

- Scene 2: who runs which collections, and how often. Nothing about timing goes on screen until confirmed.
- Scene 6: the wording of what remains the customer's work.
- Answers to the "likely questions", written from the deck.
- The figures on the final report, invented to agree with 1,240.00 and 310.50.
- Phone layout is deferred; the piece is presented on a large screen.
