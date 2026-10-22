# SUM report: Mobile banking

Generated 2026-10-22 · Method: **sum3** `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|smoothing=laplace|v1` · Data: 4 tasks

## Group Current

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| Send money to a friend | 10 | 60.0% (6/10) · z +0.23 | 66 s vs 90 s · z +0.55 | 4.56 vs 5.5 · z −0.57 | **52.8%** (23.8%–77.7%) |
| Freeze your card | 10 | 90.0% (9/10) · z +1.10 | 23 s vs 30 s · z +0.66 | 5.88 vs 5.5 · z +0.45 | **76.9%** (60.8%–93.2%) |
| Find last month's statement | 10 | 40.0% (4/10) · z −0.23 | 58 s vs 60 s · z +0.16 | 4.2 vs 5.5 · z −0.93 | **36.9%** (2.6%–59.6%) |
| Set up a savings goal | 10 | 40.0% (4/10) · z −0.23 | 143 s vs 150 s · z +0.10 | 4.67 vs 5.5 · z −0.42 | **42.7%** (5.3%–67.9%) |

**Overall SUM: 52.9%** (95% range 26.5%–74.3%)

## Group Redesign

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| Send money to a friend | 10 | 80.0% (8/10) · z +0.75 | 79 s vs 90 s · z +0.35 | 5.29 vs 5.5 · z −0.13 | **62.6%** (43.1%–89.3%) |
| Freeze your card | 10 | 100.0% (10/10) · z +1.69 | 25 s vs 30 s · z +0.40 | 5.6 vs 5.5 · z +0.12 | **76.9%** (64.1%–87.4%) |
| Find last month's statement | 10 | 90.0% (9/10) · z +1.10 | 64 s vs 60 s · z −0.08 | 5.3 vs 5.5 · z −0.15 | **61.4%** (38.9%–80.2%) |
| Set up a savings goal | 10 | 70.0% (7/10) · z +0.47 | 138 s vs 150 s · z +0.21 | 5.56 vs 5.5 · z +0.08 | **59.9%** (32.2%–77.1%) |

**Overall SUM: 65.5%** (95% range 53.9%–78.7%)

**Difference Redesign vs Current: +12.6 points** (95% range −10.0 points … +42.9 points)

## Why this method

- **sum3**: No error data; the three-component SUM is used.
- **sum3**: Nothing in the data or goal calls for a variant; the three-component SUM is the most stable default.

## How much the method matters

| Method | SUM |
|---|---:|
| **sum3** (chosen) | **52.9% / 65.5%** |
| sum4 | not applicable: no error data |
| measuringu | 50.7% / 60.8% |
| autodesk | not applicable: needs an empirical time target, which needs 4 satisfied successful users or a cutoff_s (found 2 and no cutoff) (group Current) |
| pearson | not applicable: no completion benchmark |
| microsoft | not applicable: The Usability Score needs perceived_time, ease, satisfaction. |

> Applicable methods agree within 10 points; the verdict does not hinge on the method.

## Quality checks

- group Current, task Send money to a friend: 4 failed attempt(s) are left out of time; time describes successful users only.
- group Current, task Send money to a friend: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Current, task Freeze your card: 1 failed attempt(s) are left out of time; time describes successful users only.
- group Current, task Freeze your card: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Current, task Find last month's statement: 6 failed attempt(s) are left out of time; time describes successful users only.
- group Current, task Find last month's statement: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Current, task Set up a savings goal: 6 failed attempt(s) are left out of time; time describes successful users only.
- group Current, task Set up a savings goal: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Redesign, task Send money to a friend: 2 failed attempt(s) are left out of time; time describes successful users only.
- group Redesign, task Send money to a friend: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Redesign, task Freeze your card: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Redesign, task Find last month's statement: 1 failed attempt(s) are left out of time; time describes successful users only.
- group Redesign, task Find last month's statement: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- group Redesign, task Set up a savings goal: 3 failed attempt(s) are left out of time; time describes successful users only.
- group Redesign, task Set up a savings goal: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.

## Method details

- Method: `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|smoothing=laplace|v1`
- Current / Send money to a friend: Time target 90 s (contract target)
- Current / Send money to a friend: Satisfaction target 5.5 on 1–7 (from seq)
- Current / Freeze your card: Time target 30 s (contract target)
- Current / Freeze your card: Satisfaction target 5.5 on 1–7 (from seq)
- Current / Find last month's statement: Time target 60 s (contract target)
- Current / Find last month's statement: Satisfaction target 5.5 on 1–7 (from seq)
- Current / Set up a savings goal: Time target 150 s (contract target)
- Current / Set up a savings goal: Satisfaction target 5.5 on 1–7 (from seq)
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
- Redesign / Send money to a friend: Time target 90 s (contract target)
- Redesign / Send money to a friend: Satisfaction target 5.5 on 1–7 (from seq)
- Redesign / Freeze your card: Time target 30 s (contract target)
- Redesign / Freeze your card: Satisfaction target 5.5 on 1–7 (from seq)
- Redesign / Find last month's statement: Time target 60 s (contract target)
- Redesign / Find last month's statement: Satisfaction target 5.5 on 1–7 (from seq)
- Redesign / Set up a savings goal: Time target 150 s (contract target)
- Redesign / Set up a savings goal: Satisfaction target 5.5 on 1–7 (from seq)
- Ranges come from a participant bootstrap: 2000 samples, seed 20261022
