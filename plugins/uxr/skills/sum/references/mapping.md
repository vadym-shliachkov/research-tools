# mapping.json: from the user's columns to the canonical table

The mapping states, for each canonical field, where it comes from and how to convert it. It is drafted from `profile.json`, **confirmed by the user**, and saved so the next wave of the same study can reuse it.

## Canonical fields (long format: one row per participant × task)

| Field | Type | Notes |
|---|---|---|
| `participant_id` | text | Required |
| `task_id` | text | Required in long layout; comes from the column pattern in wide layout |
| `group` | text | Optional: design, version or condition. Each group is scored separately. |
| `success` | 0/1 | Map text codes, and number codes other than 0/1 (`1/2/3`), explicitly; anything else stops normalization |
| `time_s` | seconds | Convert with `unit` |
| `errors` | count | |
| `error_opportunities` | count | Often a constant: `{ "value": 5 }` |
| `satisfaction`, `seq`, `ease`, `perceived_time` | number | Give `scale` always; `reverse` when 1 is the best answer |
| `sat_1` … `sat_k` | number | Items of a satisfaction questionnaire |

`source_row` is added automatically, so every canonical row can be traced back to the raw table (row 2 is the first data row).

## Field options

| Option | Example | Meaning |
|---|---|---|
| `from` | `"Duration"` | Source column header, exactly as in `raw.csv` |
| `value` | `5` | A constant instead of a column |
| `map` | `{ "Completed": 1, "Failed": 0, "Partial": 0 }` | Text codes, case-insensitive. Every value must be listed; `null` maps to blank. |
| `unit` | `"s"`, `"ms"`, `"min"`, `"h"`, `"mm:ss"`, `"hh:mm"` | Time unit. `mm:ss` reads `1:03` as 63 s, and also `1:03:00`, which is how Excel stores "1:03" typed into an h:mm cell. Other three-part values are h:mm:ss. Times over an hour get a warning. |
| `scale` | `[1, 7]` | Full scale range; values outside it stop normalization |
| `reverse` | `true` | Flip the scale (min + max − value) so higher is always better |
| `missingAs` | `0` | What a blank means, **only** if the user said so (for example "blank errors = 0") |

## Table options

```json
{
  "version": 1,
  "layout": "long",
  "columns": { "participant_id": { "from": "Respondent" }, "...": {} },
  "number": { "decimal": "," },
  "missing": { "tokens": ["", "NA", "-"], "dropEmptyTasks": true },
  "exclude": [
    { "column": "Respondent", "equals": ["pilot", "P0"], "reason": "pilot session" },
    { "column": "Notes", "matches": "test", "reason": "test run" }
  ],
  "duplicates": "error"
}
```

- `number.decimal`: `","` when numbers use decimal commas (`63,5`).
- `missing.tokens`: cell values that mean blank. `dropEmptyTasks` drops a wide-layout task when all its cells are blank.
- `exclude`: rows left out, each with a reason the log will show.
- `duplicates`: `"error"` (ask the user, the default), `"first"` or `"last"`.

## Wide layout: one row per participant, columns per task

```json
{
  "version": 1,
  "layout": "wide",
  "columns": { "participant_id": { "from": "ID" }, "group": { "from": "Variant" } },
  "wide": {
    "pattern": "^T(?<task>\\d+) (?<field>.+)$",
    "flags": "iu",
    "fields": {
      "Time": { "to": "time_s", "unit": "s" },
      "Success": { "to": "success", "map": { "yes": 1, "no": 0 } },
      "SEQ": { "to": "seq", "scale": [1, 7] }
    },
    "taskNames": { "1": "Sign up", "2": "Checkout" }
  }
}
```

The profile proposes a pattern when it sees task-numbered columns. The pattern needs the named groups `task` and `field`. Field names in `fields` must match the `field` group exactly; any other per-task field is listed as ignored. `taskNames` gives each task number the name the reports show; ask the user for them, or the charts say "1" and "2".

## Must ask, never guess

| Topic | Why it matters |
|---|---|
| Success codes ("partial", "with help", "gave up") | Partial success changes completion directly |
| Time unit and format | A ×60 mistake is silent |
| Scale range | The highest possible answer may never appear in the data |
| Scale direction | A reversed scale flips the component's sign |
| What blanks mean (not asked, skipped, failed, zero) | Changes n and completion |
| Rows to exclude (pilots, test users) | Changes everything |
| Duplicates | Which attempt counts |
| Which ratings form satisfaction | Defines the construct |
| Wide-layout pairing | A wrong pairing means wrong data |
