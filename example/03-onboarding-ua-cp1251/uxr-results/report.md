# SUM report: Onboarding

Generated 2026-10-22 · Method: **sum3** `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1` · Data: 3 tasks

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| Реєстрація | 10 | 60.0% (6/10) · z +0.25 | 68 s vs 90 s · z +0.62 | 5.4 vs 5.6 · z −0.14 | **59.7%** (38.7%–100.0%) |
| Підтвердження email | 10 | 90.0% (9/10) · z +1.28 | 33 s vs 60 s · z +1.09 | 5.89 vs 5.6 · z +0.21 | **80.5%** (63.1%–96.5%) |
| Налаштування профілю | 10 | 60.0% (6/10) · z +0.25 | 100 s vs 150 s · z +0.86 | 5 vs 5.6 · z −0.38 | **59.6%** (28.4%–88.4%) |

**Overall SUM: 67.4%** (95% range 50.9%–98.7%)

## Why this method

- **sum3**: Errors are present but their opportunities were not defined before the study, so errors are left out (Microsoft and Autodesk found them unreliable).
- **sum3**: Nothing in the data or goal calls for a variant; the three-component SUM is the most stable default.

## How much the method matters

| Method | SUM |
|---|---:|
| **sum3** (chosen) | **67.4%** |
| sum4 | not applicable: no error data |
| measuringu | 64.0% |
| autodesk | not applicable: needs an empirical time target, which needs 4 satisfied successful users or a cutoff_s (found 3 and no cutoff) |
| pearson | not applicable: no completion benchmark |
| microsoft | not applicable: The Usability Score needs perceived_time. |

> Applicable methods agree within 10 points; the verdict does not hinge on the method.

## Quality checks

- task Реєстрація: 4 failed attempt(s) are left out of time; time describes successful users only.
- task Підтвердження email: 1 failed attempt(s) are left out of time; time describes successful users only.
- task Налаштування профілю: 4 failed attempt(s) are left out of time; time describes successful users only.

## Method details

- Method: `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1`
- Реєстрація: Time target 90 s (contract target)
- Реєстрація: Satisfaction target 5.6 on 1–7 (from ease)
- Підтвердження email: Time target 60 s (contract target)
- Підтвердження email: Satisfaction target 5.6 on 1–7 (from ease)
- Налаштування профілю: Time target 150 s (contract target)
- Налаштування профілю: Satisfaction target 5.6 on 1–7 (from ease)
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
