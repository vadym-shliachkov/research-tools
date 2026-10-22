# Changelog

## Unreleased

### Fixed

- `/uxr:sum`, after an edge-case QA pass:
  - **Usability Score reports:** `report` no longer crashes on a `microsoft` result, in English or Ukrainian.
  - **No invented targets:** a pass/fail gate is judged against the pass mark the team agrees (`gate_threshold`, asked when the goal is a gate). Without one, the score is a share with its range and no target. Completion without a required rate, mistakes and the Usability Score's pass rates are no longer called "on target".
  - **Verdicts are not overstated:** chart bars are coloured by the range, not the point estimate, so a result the study cannot yet confirm is grey. `check-edit` and `SUM explainer` refuse a headline or result section that claims more than the verdict, and numbers the editor added.
  - **Comparing designs:** every group gets its own score card and facts, plus the difference between groups with a range.
  - **Intake:** Excel times typed as "1:03" are no longer read as hours; a confirmed minutes:seconds unit is applied; task times over an hour are flagged. Success codes other than 0/1 stop normalization unless mapped. Success, scale and satisfaction questions are always asked, also in wide layouts, which can now name their tasks.
  - **Contract:** a rate written as 78 instead of 0.78 is refused. Autopilot asks which fix to use for 0% or 100% instead of applying Laplace smoothing itself.
  - **Next wave:** every target and scale carries over, time targets are frozen, and a changed one is flagged as not comparable.
  - **Compare mode** shows each method's range and whether the verdict depends on the method, and can save `compare.json`.
  - **Smaller fixes:** a relative `--out-dir` prints the PDF; `--help` shows the usage; the results folder uses the local date; `report.html` works on a phone; better contrast; clearer instructions for a missing study name, a user who cannot confirm the data, the no-data template and hosts without Node.
- `/uxr:sum`, after a second QA pass:
  - **Gate score in people:** the overall Usability Score is now the share of participants who passed every check in every task they tried (7 of 10 = 70%), not the mean of task pass rates, so it matches the pass mark. Reports say how many people passed and that measured time does not enter the score.
  - **Same people, both designs:** when people tried more than one design, the difference between designs gets a paired range, which is narrower and correct for that design; a partial overlap warns. The intake now asks who saw which design.
  - **Verdict check:** a sentence about one task is judged against that task's verdict, and careful wording such as "too small to say for sure" is no longer refused.
  - **Ukrainian team report:** reasons, suggestions, warnings and why a method does not apply are now in Ukrainian, and a Usability Score report has its own title.
  - **Smaller fixes:** the next wave no longer warns when only the order of keys differs; the Autodesk row says an empirical time target is missing; the chart no longer drags its caption to the next page, and long score labels wrap.

## 0.1.0 (2026-10-21)

### Added

- `research-tools` marketplace for Claude Code and Codex, with the `uxr` plugin.
- `/uxr:sum`: Single Usability Metric.
  - **Data intake from any source:** CSV, TSV, JSON, NDJSON and Excel are read directly; other sources are extracted by the agent and confirmed. A column mapping is confirmed with the user, and anything unclear is asked, never guessed.
  - **Methods:** six presets (`sum4`, `sum3`, `measuringu`, `autodesk`, `pearson`, `microsoft`) plus modifiers for aggregation, completion scoring, smoothing, time targets, failed-attempt time, weights and sigma shift.
  - **Autopilot:** picks the method by documented rules and says why; reuses a previous wave's method; always shows how much the method matters.
  - **Uncertainty:** adjusted-Wald ranges for completion, t-ranges for time and satisfaction, and a reproducible participant bootstrap for SUM.
  - **Outputs:** an audit folder, `report.md` and `report.html`, and a "How to understand your results" PDF in English, plus Ukrainian on request. The PDF text goes through the plain-language editor before rendering.
- Golden tests that reproduce the published numbers: Sauro & Kindlund, MeasuringU, Autodesk, Microsoft and Pearson.
