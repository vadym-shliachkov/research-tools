# SUM report: Moderator notes

Generated 2026-10-22 · Method: **sum3** `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1` · Data: 2 tasks

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| Book a demo | 6 | 50.0% (3/6) · z +0.00 | 79 s vs 90 s · z +0.31 | 3.17 vs 4 · z −0.48 | **47.7%** (29.6%–81.8%) |
| Invite a teammate | 6 | 50.0% (3/6) · z +0.00 | 81 s vs 75 s · z −0.31 | 3.5 vs 4 · z −0.30 | **41.8%** (20.5%–76.0%) |

**Overall SUM: 44.8%** (95% range 21.1%–82.4%)

## Why this method

- **sum3**: No error data; the three-component SUM is used.
- **sum3**: Nothing in the data or goal calls for a variant; the three-component SUM is the most stable default.

## How much the method matters

| Method | SUM |
|---|---:|
| **sum3** (chosen) | **44.8%** |
| sum4 | not applicable: no error data |
| measuringu | 43.6% |
| autodesk | not applicable: needs an empirical time target, which needs 4 satisfied successful users or a cutoff_s (found 3 and no cutoff) |
| pearson | not applicable: no completion benchmark |
| microsoft | not applicable: The Usability Score needs perceived_time, satisfaction. |

> Applicable methods agree within 10 points; the verdict does not hinge on the method.

## Quality checks

- task Book a demo: Only 6 attempt(s); every component has a wide uncertainty range.
- task Book a demo: 3 failed attempt(s) are left out of time; time describes successful users only.
- task Invite a teammate: Only 6 attempt(s); every component has a wide uncertainty range.
- task Invite a teammate: 3 failed attempt(s) are left out of time; time describes successful users only.
- all tasks: 129 of 2000 bootstrap samples gave an undefined score; the interval is approximate.

## Method details

- Method: `SUM3|zmean|completion=original|time=target,log|failed-time=exclude|shift=0|v1`
- Book a demo: Time target 90 s (contract target)
- Book a demo: Satisfaction target 4 on 1–5 (from ease)
- Invite a teammate: Time target 75 s (contract target)
- Invite a teammate: Satisfaction target 4 on 1–5 (from ease)
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
