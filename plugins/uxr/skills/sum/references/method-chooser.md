# Choosing the method, and the measurement contract

## The measurement contract

Fix these before the first result is seen, so the method cannot be tuned to the answer. `SUM init-contract` writes `contract.json` with every open decision set to `null` (the full shape is `assets/contract-template.json`). `null` means "not decided", and the calculator ignores it. Rates are proportions: 78% is `0.78`, and the scripts refuse `78`.

| Key | Meaning | Default, or where the answer comes from |
|---|---|---|
| `study` | Name used in reports and folder names | The user |
| `goal` | `gate` (pass/fail for decision makers), `benchmark` (track over time), `compare` (designs or versions), `diagnose` (find the weakest tasks) | The user. Autopilot asks when it matters. |
| `defaults.scales.<field>` | Full range of each rating, e.g. `[1, 5]` | Copied from `mapping.json` |
| `defaults.satisfaction_from` | The satisfaction column (`"seq"`), or a list to average (`["ease", "satisfaction", "perceived_time"]`, as in the original) | The user. Items must share one scale. |
| `defaults.sat_target` | Mean rating that counts as good | 4 on a 5-point scale; 5.6 on a 7-point scale (original) or 5 (Autodesk) |
| `defaults.time_target_s` / `tasks.<t>.time_target_s` | Acceptable time per task, in seconds | The user, or `expert_time_s × expert_multiplier` (default 3). Leave empty only if autopilot may derive it. |
| `defaults.expert_time_s`, `expert_multiplier` | Expert time and multiplier | Multiplier 3. Poor for very short tasks (1 s → 3 s) and very long ones (15 min → 45 min). |
| `defaults.cutoff_s` | Time limit per task | Needed for `--failed-time cutoff` and the Autodesk fallback |
| `defaults.completion_benchmark` | Required completion rate, e.g. `0.78` | Optional. Triggers Pearson's correction. |
| `defaults.error_opportunities_predefined` | Were possible errors listed per task before the study? | `true` only if the user confirms |
| `defaults.thresholds` | Usability Score thresholds when scales are not 5-point | `{ "perceived_time": 3, "ease": 4, "satisfaction": 4 }` on 5-point scales |
| `defaults.gate_threshold` | Pass mark for the Usability Score: the share of people who must pass everything, e.g. `0.8` | The user, when the goal is `gate`. Without it the score has **no target**: it is reported as a share with its range, never against 50%. |
| `tasks.<t>.*` | Per-task overrides of any default | — |
| `compare_with_measuringu` | Must the numbers be comparable with MeasuringU? | `false` |
| `accessibility_data` | Does the study include accessibility measures? | `false` |
| `decided_at`, `changes` | When the contract was fixed; any later change and why | Set by you |

## What autopilot does

`SUM choose` (and `SUM run` without `--method`) applies these rules in order and returns a reason for each one that fired.

| # | Signal | Decision |
|---|---|---|
| 1 | `--previous <result.json>` from an earlier wave | Reuse its method; carry over every target, scale and threshold the new contract leaves empty; freeze each task's time target (an empirical one too). A value the new contract changes is listed in a `previous-differs` warning: the waves are then not directly comparable. Rules 2–9 are not applied. |
| 2 | Success, perceived time, ease and satisfaction are all present | Needs `goal`. If unknown, autopilot asks. With `gate` → `microsoft` (sum3 shown alongside), judged against `gate_threshold` when one is set. |
| 3 | Errors and opportunities present, **and** `error_opportunities_predefined: true` | `sum4`; otherwise `sum3`, and the reason says why errors were dropped |
| 4 | `completion_benchmark` set | `--completion piecewise` (`pearson`) |
| 5 | No time target or expert time for any task | Empirical targets (`autodesk`) if every task has ≥ 4 satisfied successful users or a cutoff; otherwise it asks. If only some tasks lack targets, it asks. |
| 6 | `compare_with_measuringu` | `--agg pct-mean` (`measuringu`) |
| 7 | A task at 0% or 100% (completion, or error-free rate in sum4) under `z-mean` | Asks (`needs-input`): the user picks `--smoothing laplace` (labelled), `--agg pct-mean` or another method, and the run is repeated with that modifier. Autopilot never picks the fix itself. |
| 8 | ≥ 10 tasks, ≥ 100 rows and `goal: diagnose` | Suggests pca-entropy (v2); does not run it |
| 9 | `accessibility_data` | Suggests reporting accessibility as a separate gate |
| — | Nothing above | `sum3`, `z-mean`, contract targets, log time, no shift |

After the run, every other applicable preset is computed for the **sensitivity table**. `methodDependent: true` means the applicable methods differ by more than 10 points. Then the conclusion must say that the verdict depends on the method, and why the chosen one fits the goal.

## Which question, which method

| The user wants to know… | Method |
|---|---|
| "How usable is it overall, in one number?" | `sum3` |
| "Did enough people have a good-enough experience?" | `microsoft`, with the agreed pass mark in `gate_threshold` |
| "Did we hit the completion requirement?" | `pearson` |
| "Is it better than last year?" | The previous wave's method (`--previous`); otherwise `autodesk` or `sum3` with frozen targets |
| "Are errors part of the story?" | `sum4`, only with predefined error opportunities |
| "Comparable with MeasuringU benchmarks?" | `measuringu` |
| "Which tasks are worst, across a big program?" | Per-task SUM now; pca-entropy in v2 |
