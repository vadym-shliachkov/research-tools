# SUM methods: presets, modifiers, formulas and sources

Every run records its resolved method string, for example
`SUM3|zmean|completion=piecewise|time=target,log|failed-time=exclude|shift=0|v1`. Two SUM numbers are comparable only when their method strings match **and** their targets and scales match. The string does not hold the targets; `result.json` records the contract, and `--previous` warns when a later wave's targets differ. Never write "SUM = 67%" without the method.

## Common building blocks

Each component becomes a **z-score against its target** and a **percentage** `Φ(z)`. For time and satisfaction, 50% means exactly on target; above 50% is better than the target. Completion (without a benchmark) and the error-free rate have **no target**: their z is Φ⁻¹ of the share itself, so 50% is only the midpoint of that scale. Reports show them as plain shares, not as on or off target.

| Component | Raw input | z | Percentage |
|---|---|---|---|
| Completion (original) | x successes of n attempts, p = x/n | Φ⁻¹(p) | p |
| Errors | E errors in N predefined opportunities | Φ⁻¹(1 − E/N) | 1 − E/N |
| Time | times of successful users (or all, with failures at the cutoff) | (target − mean) / SD, on ln(time) when `log` | Φ(z) |
| Satisfaction | mean of one rating or of a composite | (mean − target) / SD | Φ(z) |

The time z is inverted so that faster is better. SD is the sample SD (Excel `STDEV.S`). Φ and Φ⁻¹ match Excel `NORM.S.DIST(z, TRUE)` and `NORM.S.INV(p)`.

**Aggregation.**
- `z-mean` (the original, Sauro & Kindlund 2005) averages the z-scores with weights, then reports Φ(mean z + shift).
- `pct-mean` (MeasuringU's current guidance) averages the percentages.

The two give different numbers on the same data: on the source report's checkout example, 67.4% vs 63.7% with four components, and 55.3% vs 54.2% with three.

**Several tasks.** Each task gets its own SUM. The overall score is Φ(mean of the task z-scores) for `z-mean`, and the mean of the task percentages for `pct-mean` and the Usability Score.

**Uncertainty.**
- Completion: adjusted-Wald 95% interval (Sauro & Lewis 2005).
- Time: t-interval on log times, reported as a geometric-mean range.
- Satisfaction: t-interval on the mean.
- SUM: participant-level bootstrap, 2000 samples, seeded and reproducible. Resamples that hit 0% or 100% are Laplace-smoothed rather than dropped, because dropping them would cut off the extreme samples and bias the range. A resample whose score is undefined for another reason (in a tiny study, every time or rating in the resample can be identical) is dropped and counted; above 5% dropped, a warning says the range is approximate. MeasuringU's calculator also reports SUM intervals, but its method is not published; the bootstrap is this skill's own choice.
- Groups: each group is bootstrapped on its own. The difference between a group and the first one gets a range from pairing the two groups' independent samples (`result.comparison`); a range that excludes 0 means one design is clearly better.

## Presets

### `sum4`: original four-component SUM
- **Answers:** overall usability, when errors are coded reliably.
- **Formula:** completion, errors, time (ln, against `time_target_s` or `expert_time_s × 3`) and satisfaction, equal weights, `z-mean`, no shift.
- **Source:** Sauro & Kindlund, CHI 2005. Their PCA found the four metrics load about equally on one component (52–60% of variance), which justifies equal weights. Satisfaction in the original was the **average of three 5-point post-task items**: ease, satisfaction and perceived time (α ≈ .89–.92). The spec limit was 4 on a 5-point scale and **5.6 on a 7-point scale**.
- **Pitfalls:** errors need opportunities defined *before* the study; otherwise the denominator is arbitrary (with "errors + 1" a single error swings z from +1.28 to 0). A low error rate can dominate: on the report's example the errors z of +1.41 lifts SUM from 55.3% to 67.4%.

### `sum3`: three-component SUM (default)
- **Answers:** overall usability for a repeatable benchmark.
- **Formula:** `sum4` without errors.
- **Source:** Sauro & Kindlund (2005) showed that the three-variable model still has roughly equal loadings. Microsoft (Van Waardhuizen et al., CHI 2019) and Autodesk both dropped errors as unreliable.

### `measuringu`: percentage averaging
- **Answers:** "make it comparable with MeasuringU calculator numbers".
- **Formula:** completion as p, satisfaction Φ(z), time Φ(z) on raw time, then average the percentages.
- **Source:** MeasuringU, "10 Things to Know about the Single Usability Metric". Worked example: (80 + 60 + 61.7 + 77.3) / 4 = 69.75%.

### `autodesk`: empirical targets
- **Answers:** a year-over-year benchmark whose targets come from your own users.
- **Formula:** `sum3` on raw time, with time target = the 80th percentile time of successful users whose satisfaction ≥ its target. With 3 or fewer such users, the target is 75% of the task cutoff. Satisfaction was a 3-item composite on a 7-point scale with target 5. No sigma shift. Results are shown as percentages.
- **Source:** Bradner & Dawe, *Parts of the SUM: a case study of usability benchmarking using the SUM metric* (UPA; the PDF's title page says 2008, its footers say 2012). They also shifted targets so that an 80% success benchmark lands at the 50% point, which is the same idea as Pearson's piecewise correction.
- **Pitfall:** a target derived from the data is only as stable as the benchmark design. Freeze it after the first wave; `--previous` does this.

### `pearson`: completion calibrated to a benchmark
- **Answers:** "did we meet a fixed completion requirement (for example 78%)?"
- **Problem it fixes:** in the original, a completion of 60% contributes +0.25 z even when the requirement is 78%. The benchmark is not used at all.
- **Piecewise (default):** score = p · 0.5 / b when p < b, and 1 − (1 − p) · 0.5 / (1 − b) otherwise. So 0 → 0, b → 50% and 1 → 1; z = Φ⁻¹(score). For b = 78%: 50% → 32.1%, 60% → 38.5%, 70% → 44.9%, 90% → 77.3%, 97% → 93.2%.
- **Bernoulli (`--completion bernoulli`, sensitivity only):** z = (p − b) / (p(1 − p)). This divides by the variance, not the SD, and is undefined at p = 0 or 1. For p = .60 and b = .78 it gives z = −0.75 (22.7%). The author's HTML example shows .20 instead of .24 for the variance; do not round it.
- **Worked task** (S = 3.5, SD 1.1, target 4; T = 75 s, SD 50, target 60): original 43.4%, piecewise 36.3%, Bernoulli 30.8%.
- **Source:** Pearson, *Proceedings of the HFES Annual Meeting*, 2023.

### `microsoft`: Usability Score
- **Answers:** "what share of users had a good-enough experience?" It suits a pass/fail gate for decision makers.
- **Formula:** per user, pass = success ∧ perceived time ≥ 3 (as expected) ∧ ease ≥ 4 (somewhat easy) ∧ satisfaction ≥ 4 (somewhat satisfied), on 5-point scales. Score = share of users who pass. Other scales need explicit `thresholds` in the contract.
- **Target:** none by default. The score is a share, and 50% has no special meaning for it. A gate needs a pass mark the team agrees before the study (`gate_threshold`, for example 0.8 = at least 80% must pass); the verdict then compares the score's range with that mark. The four pass rates never have a target of their own.
- **Source:** Van Waardhuizen, McLean-Oliver, Perry & Munko, *Explorations on Single Usability Metrics*, CHI 2019. That is 36 studies, ~500 tasks and ~9000 observations; they dropped objective time and errors from the single metric.
- **Pitfalls:** a cliff at each threshold, and all failures look alike. Always show the four pass rates next to the score; the marginal averages can all look fine while only 60% pass everything.

### Not computed
- **`pca-entropy`** (Hamka, Purwanto & Wibowo, 2026): weights learned from each dataset with PCA and entropy, plus z-scores against the sample mean. Scores are relative to the dataset (three terrible tasks still spread to −1, 0, +1), the weights change between waves, and completion enters twice. It is planned for v2. Autopilot only suggests it for large multi-task programs. The published abstract's weights sum to 0.914, so check any replication.
- **`suma`** (Nasr & Zahabi, 2024): adds accessibility, learnability, flexibility and memorability. It is still a framework in development, with no validated formula or weights. Report accessibility as a separate pass/fail gate instead of inventing weights.

## Modifiers

| Flag | Values | Effect |
|---|---|---|
| `--components` | `c,t,s`, `c,e,t,s`, any subset | Which components enter the score |
| `--agg` | `z-mean`, `pct-mean` | Average z-scores, or percentages |
| `--completion` | `original`, `piecewise`, `bernoulli` | How completion is scored |
| `--smoothing` | `none`, `laplace` | (x + 0.5)/(n + 1) for proportions; needed under `z-mean` when a task is at 0% or 100% |
| `--time-target` | `target`, `empirical` | Contract target (or expert × multiplier), or Autodesk's empirical target |
| `--time-log` | `log`, `raw` | Natural log of time before the z-score (the original recommends log) |
| `--failed-time` | `exclude`, `cutoff` | Leave failed attempts out of time (flagged as survivor bias), or count them at `cutoff_s` |
| `--weights` | `c=.5,t=.25,s=.25` | Unequal weights; equal weights do not mean equal influence when one z is large |
| `--shift` | `0`, `1.5` | Six Sigma shift. It turns 67.4% into 97.45% on the same data. Use it only for continuity with an organisation's history, and always label it. |

## Edge cases the scripts stop on

- **Completion or error-free rate of exactly 0% or 100% under `z-mean`:** Φ⁻¹ is infinite. The user chooses `--smoothing laplace`, `--agg pct-mean`, or reporting completion separately; autopilot asks as well. 5/5 is weak evidence, not infinite usability: with smoothing it is z ≈ 1.38.
- **A rate written as a whole number** (`completion_benchmark: 78`): refused. Write `0.78`.
- **Zero spread (SD = 0):** defined as z = 0 only when the mean equals the target; otherwise the ruler is broken and the component is undefined.
- **No time target:** never invented. Give one, an expert time, or agree to an empirical target.
- **Satisfaction items on different scales:** they cannot be averaged into a composite.
- **Fewer than 8 attempts per task:** a warning; every range is wide.
- **Failed attempts excluded from time:** a warning; time then describes successful users only.
