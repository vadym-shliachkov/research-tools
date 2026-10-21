# `/uxr:sum`: Single Usability Metric

🇺🇦 [Українська версія](sum.ua.md)

## What SUM is, and what it is not

Usability is several things at once: did people finish, how long did it take, how many mistakes did they make, and how did it feel. These are measured in different units (percent, seconds, rating points), so they cannot simply be added up. SUM puts each one on a common scale, *how far from the target you set*, and then combines them into one score.

A SUM of **50% means exactly on target**. Above 50% is better than the target; below is worse. The Usability Score (`microsoft`) works differently: it is the share of people who passed everything, and its target is the pass mark your team agrees, for example "at least 80% must pass". Without a pass mark, it has no target.

SUM is a **headline, not a diagnosis**. Two very different problems can produce the same score. The skill therefore always shows the components first, and it never reports the score without its range and method.

## When to use it

- **Benchmarking** a product release after release, or year over year.
- **Comparing** designs, versions or competitors on the same tasks.
- **A pass/fail gate** for decision makers ("did enough people have a good-enough experience?").
- **Summarising** a summative usability test for people who will not read the component tables.

It is not for finding *why* people struggle. That needs qualitative analysis.

## Before you start

You need task-level data from a usability test. For each participant and task, that means some of the following:

- success (finished or not)
- time on task
- a rating after the task, such as satisfaction, ease (SEQ) or how long it felt
- optionally, errors and the number of chances to make one

Any layout works: one row per participant and task, or one row per participant with columns per task. Names, codes and units can be anything, because the skill asks what they mean. If you have no data yet, start from the [template](../plugins/uxr/skills/sum/assets/data-template.csv).

## Running it

```text
/uxr:sum results.xlsx                          autopilot (default)
/uxr:sum results.xlsx --method sum3            one method, exactly
/uxr:sum results.xlsx --method sum3 --agg pct-mean --shift 1.5
/uxr:sum results.xlsx --compare-methods        every applicable method side by side
/uxr:sum results.xlsx --explain-choice         only why autopilot would choose what it chooses
/uxr:sum results.xlsx --ua                     also produce the Ukrainian explainer PDF
```

The source can be a CSV, TSV, Excel, JSON or NDJSON file, a Google Sheets link, or a table pasted into the chat. In Codex, describe the same thing in words.

## What you will be asked

The skill never guesses what your data means. Expect questions like these:

1. **Which sheet or list** holds the data, if there are several.
2. **The meaning of each column**, shown as a table for one confirmation. The skill always asks about:
   - how success codes count ("partial", "with help")
   - the time unit and format
   - each rating's full scale and which end is best
   - what empty cells mean
   - which rows to leave out (pilots, tests)
   - duplicates
   - which ratings make up satisfaction
3. **The measurement contract**, fixed *before* any result is shown:
   - the goal
   - the satisfaction target
   - the time target per task, or an expert time
   - a required completion rate, if any
   - a time limit per task
   - whether possible errors were listed before the study

Fixing the contract first stops anyone, including the skill, from tuning the method to get a nicer number.

## Methods at a glance

| Preset | The question it answers | Note |
|---|---|---|
| `sum3` | How usable is it overall? | Default: completion, time, satisfaction |
| `sum4` | The same, with errors | Only when error opportunities were defined before the study |
| `measuringu` | Comparable with MeasuringU numbers? | Averages percentages instead of z-scores |
| `autodesk` | Better than last year? | Time target derived from satisfied users, then frozen |
| `pearson` | Did we meet the required completion rate? | The required rate becomes the 50% point |
| `microsoft` | Did enough people have a good-enough experience? | Share of people who passed all four checks |

Modifiers adjust any preset: `--agg`, `--completion`, `--smoothing`, `--time-target`, `--time-log`, `--failed-time`, `--weights`, `--shift`, `--components`. The skill's [methods reference](../plugins/uxr/skills/sum/references/methods.md) gives every formula and source.

## Autopilot

Without `--method`, the skill chooses for you by fixed rules and tells you why:

- An **earlier wave** of the same study → reuse its method and targets.
- A **pass/fail goal**, and all four ratings present → `microsoft`, judged against the pass mark you set. Without one, it is reported as a share with its range, not as above or below a target..
- Errors with **predefined opportunities** → `sum4`; otherwise errors are left out.
- A **required completion rate** → `pearson`.
- **No time targets** → `autodesk`, if there are enough satisfied people; otherwise it asks.
- A task at **0% or 100%** → the skill asks which fix to use: Laplace smoothing, percentage averaging or another method.
- **MeasuringU comparability** → percentage averaging.
- Otherwise → `sum3`.

It then runs every other method that fits your data. When they disagree by more than 10 points, the report says the verdict depends on the method.

## What you get

Everything goes to `uxr-results/<study>-<date>/` next to your data. A second run never overwrites the first.

| File | For |
|---|---|
| `explainer.pdf` (`explainer.ua.pdf`) | **Everyone.** "How to understand your results" in plain language, edited for a broad audience before it is rendered |
| `report.html` | The team: component bars with ranges, tables, method, sensitivity, quality checks |
| `report.md` | The same report as text |
| `result.json` | Every number and the exact method, for reuse and audit |
| `data.csv`, `mapping.json`, `normalize-log.json` | What the data became, and why rows were dropped |
| `contract.json` | The targets and rules, fixed before computing |

## Reading the results

- **The line on a bar is its target.** For time, satisfaction and the SUM itself it sits at 50%: a component at 38% is below its target, one at 80% well above it. Completion without a required rate, and mistakes, have no target and no line.
- **Colour follows the range.** Green and red mean clearly above or below the target. Grey means the range crosses the line, so the study cannot tell yet, or there is no target.
- **Comparing designs:** each design gets its own score, and the report gives the difference with its range.
- **Read the components before the score.** The weakest component is usually where to look first.
- **The range matters as much as the score.** With ten people, a SUM of 67% may truly be anywhere between about 48% and 80%.
- **Check the method line.** A 1.5 sigma shift can turn 67% into 97% on the same data. Compare scores only when their method strings and targets match.

## Running the next wave

Run the skill on the new data from the same study. It finds the earlier `result.json` and `mapping.json` in `uxr-results/`, reuses the mapping (asking only about new columns), and keeps the method, every target and scale, and each task's time target. That way, a change in the score means a change in the product, not in the ruler. If you change a target for the new wave, the report warns that the waves are not directly comparable. Save the new export next to the earlier one, or tell the skill where the earlier results are.

## Troubleshooting

- **"Completion is 100%; its z-score is infinite."** With few people, everyone finishing is common. Choose Laplace smoothing, percentage averaging, or report completion on its own. The skill asks; it does not pick for you.
- **"No time target."** Give an acceptable time or an expert time per task, or agree that autopilot may derive it from satisfied people.
- **"Satisfaction items are on different scales."** Choose one rating, or put the items on the same scale first.
- **No PDF, only HTML.** No Chrome, Edge or Chromium was found. Install one, or set `CHROME_PATH`.
- **Wrong characters in names.** The file was not UTF-8. The skill reports the encoding it used; re-export as UTF-8 if the names look wrong.

## Sources

- Sauro, J. & Kindlund, E. (2005). A method to standardize usability metrics into a single score. *CHI 2005*.
- MeasuringU: *10 Things to Know about the Single Usability Metric (SUM)*, and the SUM calculator.
- Bradner, E. & Dawe, M. *Parts of the SUM: a case study of usability benchmarking using the SUM metric* (Autodesk, UPA).
- Van Waardhuizen, M., McLean-Oliver, J., Perry, N. & Munko, J. (2019). Explorations on Single Usability Metrics. *CHI 2019*.
- Pearson, C. (2023). Two corrections to SUM's completion-rate component, *Proceedings of the Human Factors and Ergonomics Society Annual Meeting*; see also his article "The Single Usability Metric (SUM): A completion rate conundrum" (UX Collective).
- Sauro, J. & Lewis, J. R. (2005). Estimating completion rates from small samples using binomial confidence intervals. *HFES 2005*.
- Hamka, Purwanto & Wibowo (2026), PCA–Entropy SUM; Nasr & Zahabi (2024), SUMA. Both are documented but not computed.
