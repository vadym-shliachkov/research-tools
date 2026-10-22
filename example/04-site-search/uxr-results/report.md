# SUM report: Site search

Generated 2026-10-22 · Method: **autodesk** `SUM3|zmean|completion=original|time=empirical,raw|failed-time=exclude|shift=0|smoothing=laplace|v1` · Data: 4 tasks

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| find-product | 14 | 100.0% (14/14) · z +1.83 | 37 s vs 47 s · z +0.92 | 5.64 vs 5 · z +1.21 | **90.7%** (86.3%–96.1%) |
| filter-by-price | 14 | 85.7% (12/14) · z +0.97 | 82 s vs 82 s · z +0.01 | 5.19 vs 5 · z +0.17 | **65.0%** (48.6%–84.9%) |
| compare-two | 14 | 42.9% (6/14) · z −0.17 | 125 s vs 152 s · z +0.41 | 4.74 vs 5 · z −0.25 | **49.9%** (30.1%–89.5%) |
| return-policy | 14 | 71.4% (10/14) · z +0.52 | 65 s vs 80 s · z +0.46 | 5.19 vs 5 · z +0.26 | **66.1%** (49.5%–83.4%) |

**Overall SUM: 70.2%** (95% range 61.9%–83.7%)

## Why this method

- **sum3**: No error data; the three-component SUM is used.
- **time=empirical**: No time target was given; following Autodesk, the target is the 80th percentile time of satisfied successful users (75% of the cutoff when there are 3 or fewer).
- **smoothing=laplace**: Task(s) find-product have 0% or 100% on a proportion, whose z-score is infinite. Laplace smoothing was chosen; it keeps the score finite and is labelled.

## How much the method matters

| Method | SUM |
|---|---:|
| **autodesk** (chosen) | **70.2%** |
| sum4 | not applicable: no error data |
| sum3 | not applicable: needs a time target (time_target_s, or expert_time_s with expert_multiplier) |
| measuringu | not applicable: needs a time target (time_target_s, or expert_time_s with expert_multiplier) |
| pearson | not applicable: no completion benchmark |
| microsoft | not applicable: The Usability Score needs perceived_time, ease, satisfaction. |

> Applicable methods agree within 10 points; the verdict does not hinge on the method.

## Quality checks

- task find-product: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- task filter-by-price: 2 failed attempt(s) are left out of time; time describes successful users only.
- task filter-by-price: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- task compare-two: 8 failed attempt(s) are left out of time; time describes successful users only.
- task compare-two: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.
- task return-policy: 4 failed attempt(s) are left out of time; time describes successful users only.
- task return-policy: Laplace smoothing ((x+0.5)/(n+1)) is applied to proportions; this is not the original SUM.

## Method details

- Method: `SUM3|zmean|completion=original|time=empirical,raw|failed-time=exclude|shift=0|smoothing=laplace|v1`
- find-product: Time target 47 s (empirical: 80th percentile of 13 satisfied successful users)
- find-product: Satisfaction target 5 on 1–7 (from sat_1 + sat_2 + sat_3), Cronbach alpha 0.16
- filter-by-price: Time target 82 s (empirical: 80th percentile of 10 satisfied successful users)
- filter-by-price: Satisfaction target 5 on 1–7 (from sat_1 + sat_2 + sat_3), Cronbach alpha 0.85
- compare-two: Time target 152 s (empirical: 80th percentile of 6 satisfied successful users)
- compare-two: Satisfaction target 5 on 1–7 (from sat_1 + sat_2 + sat_3), Cronbach alpha 0.85
- return-policy: Time target 80 s (empirical: 80th percentile of 9 satisfied successful users)
- return-policy: Satisfaction target 5 on 1–7 (from sat_1 + sat_2 + sat_3), Cronbach alpha 0.85
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
