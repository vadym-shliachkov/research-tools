# SUM report: Booking

Generated 2026-10-22 · Method: **pearson** `SUM3|zmean|completion=piecewise|time=target,log|failed-time=exclude|shift=0|v1` · Data: 4 tasks

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| search-hotel | 16 | 81.3% (13/16) · z +0.19 | 69 s vs 90 s · z +0.39 | 5.19 vs 5.5 · z −0.26 | **54.2%** (37.6%–75.3%) |
| choose-room | 16 | 68.8% (11/16) · z −0.15 | 35 s vs 60 s · z +1.01 | 5.31 vs 5.5 · z −0.16 | **59.2%** (45.4%–79.5%) |
| pay | 16 | 81.3% (13/16) · z +0.19 | 73 s vs 120 s · z +0.96 | 5.19 vs 5.5 · z −0.24 | **61.9%** (47.7%–82.2%) |
| cancel-booking | 16 | 68.8% (11/16) · z −0.15 | 60 s vs 90 s · z +0.78 | 5.06 vs 5.5 · z −0.47 | **52.2%** (35.3%–69.7%) |

**Overall SUM: 56.9%** (95% range 46.9%–71.4%)

## Why this method

- **reuse pearson**: A previous wave of this study exists. Reusing its method and targets keeps the waves comparable.

## How much the method matters

| Method | SUM |
|---|---:|
| **pearson** (chosen) | **56.9%** |
| sum4 | not applicable: no error data |
| sum3 | 65.4% |
| measuringu | 62.8% |
| autodesk | 64.3% |
| microsoft | not applicable: The Usability Score needs perceived_time, ease, satisfaction. |

> Applicable methods agree within 10 points; the verdict does not hinge on the method.

## Quality checks

- task search-hotel: 3 failed attempt(s) are left out of time; time describes successful users only.
- task choose-room: 5 failed attempt(s) are left out of time; time describes successful users only.
- task pay: 3 failed attempt(s) are left out of time; time describes successful users only.
- task cancel-booking: 5 failed attempt(s) are left out of time; time describes successful users only.

## Method details

- Method: `SUM3|zmean|completion=piecewise|time=target,log|failed-time=exclude|shift=0|v1`
- search-hotel: Time target 90 s (previous wave)
- search-hotel: Satisfaction target 5.5 on 1–7 (from seq)
- search-hotel: Completion benchmark 78.0%
- choose-room: Time target 60 s (previous wave)
- choose-room: Satisfaction target 5.5 on 1–7 (from seq)
- choose-room: Completion benchmark 78.0%
- pay: Time target 120 s (previous wave)
- pay: Satisfaction target 5.5 on 1–7 (from seq)
- pay: Completion benchmark 78.0%
- cancel-booking: Time target 90 s (previous wave)
- cancel-booking: Satisfaction target 5.5 on 1–7 (from seq)
- cancel-booking: Completion benchmark 78.0%
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
