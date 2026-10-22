# SUM report: Enterprise program

Generated 2026-10-22 · Method: **sum3** `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1` · Data: 10 tasks

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| T01 | 12 | 66.7% (8/12) · z +0.43 | 69 s vs 78 s · z +0.20 | 3.03 vs 4 · z −0.91 | **46.3%** (19.9%–66.8%) |
| T02 | 12 | 58.3% (7/12) · z +0.21 | 95 s vs 111 s · z +0.70 | 3.11 vs 4 · z −0.80 | **51.5%** (28.3%–79.4%) |
| T03 | 12 | 66.7% (8/12) · z +0.43 | 155 s vs 143 s · z −0.15 | 3.19 vs 4 · z −0.76 | **43.7%** (18.5%–64.4%) |
| T04 | 12 | 50.0% (6/12) · z +0.00 | 138 s vs 176 s · z +0.62 | 2.81 vs 4 · z −0.82 | **47.4%** (22.8%–69.7%) |
| T05 | 12 | 58.3% (7/12) · z +0.21 | 181 s vs 208 s · z +0.25 | 3.03 vs 4 · z −0.82 | **45.2%** (18.3%–65.1%) |
| T06 | 12 | 50.0% (6/12) · z +0.00 | 233 s vs 241 s · z +0.17 | 2.97 vs 4 · z −0.84 | **41.1%** (20.6%–75.3%) |
| T07 | 12 | 50.0% (6/12) · z +0.00 | 252 s vs 273 s · z +0.22 | 2.72 vs 4 · z −1.19 | **37.3%** (17.4%–87.3%) |
| T08 | 12 | 41.7% (5/12) · z −0.21 | 220 s vs 306 s · z +0.74 | 2.86 vs 4 · z −0.95 | **44.4%** (21.8%–84.3%) |
| T09 | 12 | 41.7% (5/12) · z −0.21 | 233 s vs 338 s · z +0.71 | 2.75 vs 4 · z −0.91 | **44.5%** (18.8%–79.7%) |
| T10 | 12 | 50.0% (6/12) · z +0.00 | 332 s vs 371 s · z +0.21 | 2.75 vs 4 · z −1.03 | **39.3%** (7.4%–60.2%) |

**Overall SUM: 44.0%** (95% range 23.0%–70.5%)

## Why this method

- **sum3**: Errors are present but their opportunities were not defined before the study, so errors are left out (Microsoft and Autodesk found them unreliable).
- **sum3**: Nothing in the data or goal calls for a variant; the three-component SUM is the most stable default.

**Suggestions:**

- With this many tasks, pca-entropy (data-driven weights) could rank tasks against each other. It is planned for v2 and gives dataset-relative scores.
- Accessibility data is present: report it as a separate pass/fail gate next to SUM, not blended into it (SUMA has no validated formula yet).

## How much the method matters

| Method | SUM |
|---|---:|
| **sum3** (chosen) | **44.0%** |
| sum4 | not applicable: no error data |
| measuringu | 43.4% |
| autodesk | not applicable: needs an empirical time target, which needs 4 satisfied successful users or a cutoff_s (found 2 and no cutoff); an empirical time target, which needs 4 satisfied successful users or a cutoff_s (found 3 and no cutoff) |
| pearson | not applicable: no completion benchmark |
| microsoft | 0.0% |

> The verdict depends on the method: applicable methods differ by more than 10 points. Report the chosen method and say why.

## Quality checks

- task T01: 4 failed attempt(s) are left out of time; time describes successful users only.
- task T02: 5 failed attempt(s) are left out of time; time describes successful users only.
- task T03: 4 failed attempt(s) are left out of time; time describes successful users only.
- task T04: 6 failed attempt(s) are left out of time; time describes successful users only.
- task T05: 5 failed attempt(s) are left out of time; time describes successful users only.
- task T06: 6 failed attempt(s) are left out of time; time describes successful users only.
- task T07: 6 failed attempt(s) are left out of time; time describes successful users only.
- task T08: 7 failed attempt(s) are left out of time; time describes successful users only.
- task T09: 7 failed attempt(s) are left out of time; time describes successful users only.
- task T10: 6 failed attempt(s) are left out of time; time describes successful users only.

## Method details

- Method: `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1`
- T01: Time target 78 s (contract target)
- T01: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.92
- T02: Time target 111 s (contract target)
- T02: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.88
- T03: Time target 143 s (contract target)
- T03: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.94
- T04: Time target 176 s (contract target)
- T04: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.96
- T05: Time target 208 s (contract target)
- T05: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.9
- T06: Time target 241 s (contract target)
- T06: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.88
- T07: Time target 273 s (contract target)
- T07: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.82
- T08: Time target 306 s (contract target)
- T08: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.91
- T09: Time target 338 s (contract target)
- T09: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.96
- T10: Time target 371 s (contract target)
- T10: Satisfaction target 4 on 1–5 (from ease + satisfaction + perceived_time), Cronbach alpha 0.9
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
