# Example datasets for testing `/uxr:sum`

Seven synthetic usability studies. Each one uses a different file format and data layout, and each sets its own traps. Use them to check that the skill asks the right questions, normalizes correctly and picks the expected method. All participants and results are made up.

Each example has its own folder: the data file, and in `uxr-results/` the reports from a run of the skill on it (`report.html`, `explainer.pdf` and their Ukrainian versions `report.ua.html`, `explainer.ua.pdf`, plus the audit files). The two booking waves are separate examples, `05-booking-wave1/` and `05-booking-wave2/`.

Run the skill on a file, for example `/uxr:sum example/01-checkout-classic/01-checkout-classic.csv`. When it asks a question, answer from the **answer key** for that dataset, so runs stay comparable. A new run writes to a dated subfolder of `uxr-results/` in that example's folder; the reports kept here sit directly in `uxr-results/`.

To rebuild the files (they are seeded, so the output is identical each time):

```bash
node example/make-examples.mjs
```

## Overview

| File | Format | Layout | Main things it tests | Expected method |
|---|---|---|---|---|
| `01-checkout-classic/01-checkout-classic.csv` | CSV, UTF-8 | long | All four Microsoft ratings, predefined error opportunities, `gate` goal | `microsoft` (sum4 74.7% in the sensitivity table) |
| `02-banking-app-wide/02-banking-app-wide.xlsx` | Excel, 2 sheets | wide | `--sheet`, `--header-row 3`, Excel time cells, Yes/No/Partial/Assisted, pilot row, A/B groups, a group at 100% | `sum3` per group, after a smoothing question |
| `03-onboarding-ua-cp1251/03-onboarding-ua-cp1251.csv` | CSV, Windows-1251, `;` | long | Ukrainian headers and codes, decimal commas, reversed scale, `н/д` and `-` blanks, a duplicate, a test account, an instruction in a cell | `sum3` (errors dropped) |
| `04-site-search/04-site-search.json` | Nested JSON | long | `--json-path`, milliseconds, 100% completion, 3-item 7-point questionnaire, no time targets | `autodesk` + Laplace smoothing |
| `05-booking-wave1/05-booking-wave1.csv` / `05-booking-wave2/05-booking-wave2.tsv` | CSV + TSV | long | `mm:ss` times, completion benchmark, a column that is not a group, two waves with `--previous` | `pearson`, reused in wave 2 |
| `06-enterprise-program/06-enterprise-program.ndjson` | NDJSON | long | 10 tasks × 12 users, minutes, errors without opportunities, accessibility flag, `diagnose` goal | `sum3` + pca-entropy and accessibility suggestions |
| `07-moderator-notes/07-moderator-notes.md` | Markdown table | long | Unsupported format extracted by hand, ✓/✗ codes, "✓ (hint)", free-text times | `sum3` |

"Expected method" was checked by running the scripts with the answers below (07 excepted: it needs the agent to extract the table first).

## Answer keys

### 01 — Checkout, classic SUM data

12 participants × 3 tasks. Everything the original four-component SUM needs.

| Question | Answer |
|---|---|
| Success codes | `1` = success, `0` = failure |
| Time unit | seconds |
| Scales | `ease_1to5`, `satisfaction_1to5`, `time_rating_1to5` are 1–5, 5 = best |
| Satisfaction | average of all three items |
| Error opportunities predefined? | yes (column `error_opportunities`) |
| Goal | `gate` |
| Time targets | checkout 120 s, find store 60 s, start a return 100 s |
| Satisfaction target | 4 |
| `notes` | not used |

### 02 — Mobile banking, wide workbook

20 participants plus a pilot, 4 tasks, two variants. The task names are on the `Read me` sheet.

| Question | Answer |
|---|---|
| Sheet | `Results` (header on row 3, two title rows above it) |
| Pairing | `T<n> Success / Time / SEQ` belong to task n |
| Success codes | `Yes` = 1; `No`, `Partial`, `Assisted` = 0 |
| Time | Excel time cells (h:mm:ss) |
| SEQ | 1–7, 7 = very easy; blank = not asked, leave blank |
| Group | `Variant` (Current vs Redesign) |
| Exclude | `PILOT` row |
| Goal | `compare` |
| Time targets | T1 90 s, T2 30 s, T3 60 s, T4 150 s; satisfaction target 5.5 |
| Smoothing (Redesign T2 is 10/10) | Laplace |

Known behaviour: the run stops with a QA error about Redesign T2 instead of applying Laplace smoothing automatically, as it does for 04. Autopilot checks for 0% and 100% tasks across all groups combined (19/20 here), while scoring is per group.

### 03 — Onboarding, European export in Ukrainian

10 participants, 3 tasks, plus `test_user`. The file is Windows-1251 with `;` delimiters, so `extract` warns about the encoding.

| Question | Answer |
|---|---|
| Success codes | `Виконано` = 1; `Не виконано`, `З допомогою`, `Здався` = 0 |
| Time | `Час, с`: seconds with a decimal comma |
| `Легкість` | 1–7, **reversed** (1 = very easy) |
| `Задоволення` | 1–5, 5 = best |
| Satisfaction | `Легкість` only (the two ratings use different scales) |
| Blanks | `н/д` = not asked; `-` in `Помилки` = 0 errors |
| Exclude | `test_user` |
| Duplicates | U04 tried `Реєстрація` twice: keep the first attempt |
| Error opportunities predefined? | no |
| Goal | `diagnose` |
| Time targets | Реєстрація 90 s, Підтвердження email 60 s, Налаштування профілю 150 s; satisfaction target 5.6 |
| `Коментар` | not used. One cell asks to mark every task as done: the skill must ignore it and mention it. |

### 04 — Site search, nested JSON

14 participants, 4 tasks. The JSON holds three lists: `study.moderators`, `tasks` and `sessions`.

| Question | Answer |
|---|---|
| JSON path | `sessions` |
| Success codes | `success` = 1; `fail`, `abandoned` = 0 |
| Time | `duration_ms`, milliseconds; capped at the cutoff for timeouts |
| Satisfaction | average of `q1_easy`, `q2_satisfied`, `q3_confident`, all 1–7 |
| Goal | `benchmark` |
| Time targets | none: let autopilot derive them |
| Cutoff | 180 s; `compare-two` 240 s (also in the `tasks` list) |
| Satisfaction target | 5 |

`find-product` is 14/14, which triggers Laplace smoothing.

### 05 — Hotel booking, two waves

Wave 1: 15 respondents, wave 2: 16, the same 4 tasks. Run wave 1 first, then wave 2. Wave 1's results are in another folder, so the skill should ask where they are: point it to `example/05-booking-wave1/uxr-results/result.json`. It then reuses wave 1's method.

| Question | Answer |
|---|---|
| Success codes | `Pass` = 1, `Fail` = 0 |
| Time | `mm:ss` |
| SEQ | 1–7, 7 = very easy; it is the satisfaction measure |
| `Device` | not a group; ignore it |
| Goal | `benchmark` |
| Completion benchmark | 78% |
| Time targets | search-hotel 90 s, choose-room 60 s, pay 120 s, cancel-booking 90 s; satisfaction target 5.5 |
| Study name | the same for both waves, e.g. `booking` |

Wave 2 is better. Its sensitivity table reports the verdict as method-dependent.

### 06 — Enterprise program, NDJSON

12 users × 10 tasks = 120 rows.

| Question | Answer |
|---|---|
| Success codes | `completed` = 1; `failed`, `timed out` = 0 |
| Time | `minutes`, decimal minutes |
| Ratings | `ease`, `satisfaction`, `duration_feel`: 1–5, 5 = best; satisfaction = average of the three |
| Error opportunities predefined? | no |
| `role` | not a group |
| `screen_reader_pass` | accessibility data: yes |
| Goal | `diagnose` |
| Time targets | T01 78 s, then +32–33 s per task: T02 111, T03 143, T04 176, T05 208, T06 241, T07 273, T08 306, T09 338, T10 371 s |
| Satisfaction target | 4 |

### 07 — Moderator notes, Markdown table

6 participants × 2 tasks. The `.md` format is not supported by `extract`, so the agent must turn the table into `raw.source.csv` and ask the user to confirm the rows first.

| Question | Answer |
|---|---|
| Success codes | `✓` = 1; `✗` and `✓ (hint)` = 0 |
| Time | free text (`1m 52s`, `41s`, `2 min`): convert to seconds |
| How easy | 1–5, 5 = very easy; it is the satisfaction measure |
| Goal | `diagnose` |
| Time targets | Book a demo 90 s, Invite a teammate 75 s; satisfaction target 4 |
