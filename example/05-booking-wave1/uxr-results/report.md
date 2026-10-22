# SUM report: Booking

Generated 2026-10-22 · Method: **pearson** `SUM3|zmean|completion=piecewise|time=target,log|failed-time=exclude|shift=0|v1` · Data: 4 tasks

| Task | n | Completion | Time on task | Satisfaction | SUM (95% range) |
|---|---:|---|---|---|---|
| search-hotel | 15 | 46.7% (7/15) · z −0.53 | 64 s vs 90 s · z +0.66 | 4.33 vs 5.5 · z −0.73 | **42.1%** (24.5%–64.9%) |
| choose-room | 15 | 60.0% (9/15) · z −0.29 | 52 s vs 60 s · z +0.53 | 4.87 vs 5.5 · z −0.43 | **47.3%** (29.5%–66.2%) |
| pay | 15 | 40.0% (6/15) · z −0.65 | 78 s vs 120 s · z +1.40 | 4.6 vs 5.5 · z −0.64 | **51.4%** (35.6%–83.7%) |
| cancel-booking | 15 | 53.3% (8/15) · z −0.41 | 73 s vs 90 s · z +0.40 | 4.8 vs 5.5 · z −0.46 | **43.8%** (25.7%–64.9%) |

**Overall SUM: 46.1%** (95% range 33.0%–64.4%)

## Why this method

- **sum3**: No error data; the three-component SUM is used.
- **completion=piecewise**: A completion benchmark (78%) is set; Pearson's correction makes that benchmark the neutral 50% point.

## How much the method matters

| Method | SUM |
|---|---:|
| **pearson** (chosen) | **46.1%** |
| sum4 | not applicable: no error data |
| sum3 | 52.4% |
| measuringu | 50.4% |
| autodesk | 44.1% |
| microsoft | not applicable: The Usability Score needs perceived_time, ease, satisfaction. |

> Applicable methods agree within 10 points; the verdict does not hinge on the method.

## Quality checks

- task search-hotel: 8 failed attempt(s) are left out of time; time describes successful users only.
- task choose-room: 6 failed attempt(s) are left out of time; time describes successful users only.
- task pay: 9 failed attempt(s) are left out of time; time describes successful users only.
- task cancel-booking: 7 failed attempt(s) are left out of time; time describes successful users only.

## Method details

- Method: `SUM3|zmean|completion=piecewise|time=target,log|failed-time=exclude|shift=0|v1`
- search-hotel: Time target 90 s (contract target)
- search-hotel: Satisfaction target 5.5 on 1–7 (from seq)
- search-hotel: Completion benchmark 78.0%
- choose-room: Time target 60 s (contract target)
- choose-room: Satisfaction target 5.5 on 1–7 (from seq)
- choose-room: Completion benchmark 78.0%
- pay: Time target 120 s (contract target)
- pay: Satisfaction target 5.5 on 1–7 (from seq)
- pay: Completion benchmark 78.0%
- cancel-booking: Time target 90 s (contract target)
- cancel-booking: Satisfaction target 5.5 on 1–7 (from seq)
- cancel-booking: Completion benchmark 78.0%
- Ranges come from a participant bootstrap: 2000 samples, seed 20261021
