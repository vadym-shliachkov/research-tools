# Research Tools

A skills marketplace for UX researchers. It turns study data into conclusions you can defend: the right metric, checked against the data, explained in plain language with its uncertainty.

It works as a **Claude Code** marketplace and as a **Codex** plugin. 🇺🇦 [Українська версія](README.ua.md)

## What's inside

The marketplace has one plugin, **`uxr`**.

| Skill | What it does |
|---|---|
| [`/uxr:sum`](guides/sum.md) | **Single Usability Metric.** Combines completion, time on task, satisfaction and, optionally, errors into one score. An autopilot picks the right SUM variant for your data and goal. You get an HTML report and a plain-language "How to understand your results" PDF. |

More skills are planned: confidence intervals for task metrics, comparing designs, SUS scoring, sample size planning and findings synthesis.

## Install

### Claude Code

```bash
claude plugin marketplace add vadym-shliachkov/research-tools
```

```bash
claude plugin install uxr@research-tools
```

Inside a session, `/plugin marketplace add vadym-shliachkov/research-tools` does the same. Skills then run as `/uxr:sum`.

### Codex

```bash
codex plugin marketplace add vadym-shliachkov/research-tools
```

Then enable `uxr` from the `research-tools` marketplace in the Codex plugin list. Or add this to `.codex/config.toml`:

```toml
[plugins."uxr@research-tools"]
enabled = true
```

In Codex, ask in plain words: "calculate the SUM for results.xlsx".

## Requirements

- **Node.js 20 or newer.** The scripts have no other dependencies; nothing is installed.
- **Chrome, Edge or Chromium** for PDFs. Without one, you get the same document as HTML. Set `CHROME_PATH` if your browser is in an unusual place.

## Quick start

```text
/uxr:sum results.xlsx
/uxr:sum results.xlsx --method pearson --ua
/uxr:sum results.csv --compare-methods
/uxr:sum results.csv --explain-choice
```

The skill reads your file, asks what each column means instead of guessing, fixes the targets with you before computing, then writes everything to `uxr-results/<study>-<date>/` next to your data. See the [SUM guide](guides/sum.md) for the full walkthrough.

## Languages

- The plugin itself (instructions, references, scripts) is in English.
- Every document for people has a Ukrainian twin: [README.ua.md](README.ua.md), [guides/sum.ua.md](guides/sum.ua.md), [CHANGELOG.ua.md](CHANGELOG.ua.md).
- Results come in the language you use. Add `--ua`, or ask for a Ukrainian version, to get the Ukrainian explainer PDF as well.

## Terminology

| Term | Meaning in these docs |
|---|---|
| SUM | Single Usability Metric: one score combining several usability measures |
| Component | One measure inside SUM: completion, time on task, satisfaction or errors |
| Target | The level the team agreed counts as good, fixed before the results are seen |
| Range | The interval the true value most likely falls in (95%) |
| Contract | The written list of targets and rules, saved before computing |
| Preset | A named SUM variant, such as `sum3` or `pearson` |

## Development

```bash
npm test
```

```bash
npm run check
```

- `plugins/uxr/`: the plugin. `scripts/` holds the shared intake, statistics, readability and PDF code; `skills/<name>/` holds each skill; `agents/` holds the plain-language editor.
- `tests/`: `node --test` suites. Golden numbers come from the literature.
- `tools/check.mjs` keeps the Claude and Codex manifests in step, validates skill frontmatter (descriptions of at most 1024 characters), and requires a `.ua.md` twin with the same headings for every document.
- New skills follow the same contract: intake → measurement contract → deterministic script → quality checks → conclusion with uncertainty. Write tests first, and add the UA twin of every document in the same commit.

## License

[MIT](LICENSE)
