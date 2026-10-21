# Changelog

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
