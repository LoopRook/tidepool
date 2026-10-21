# Seed 5: hunters run out of reproductive surplus

*Research by a Codex agent (GPT-6.1-Sol), delegated by Claude through Paseo, 2026-10-20.
All numbers use the engine-dependent `Math` functions in use before `src/dmath.js`;
the follow-up runs overlapped that change, so treat its exact figures as indicative.
Since dmath, seed trajectories differ (seed 5 now keeps hunters to day 106), but the
mechanism described here is unchanged.*

Research date: 2026-10-20. Node v24.17.0, repository HEAD `ca520bf`.
Baseline `src/world.js` SHA-256:
`E25886C4DBC7A4A78615D75D9F0EB1408B2CBE2CDE053C4A88081052FA63E793`.

**Outcome: no tested change meets every acceptance criterion.** The strongest principled candidate below keeps hunters continuously alive on all six seeds for 150 days, including seed 5, but lets grazers reach zero on seed 3. Do not integrate it as a completed fix. Its diff and complete results are provided for review; the source and tests have been restored.

## Diagnosis

Seed 5 loses its last hunter at **day 34.625**, but the final deaths are **old age**, not starvation. Small prey provide enough energy to keep some adults alive, but too little surplus to replace them. Capture difficulty may contribute, but the measurements do not support an inability to catch small prey as the primary explanation: kills per hunter tick increase as prey shrink.

The energy model also gives hatchlings an avoidable recruitment handicap: they start at 45% of adult radius, with small inherited energy reserves and a smaller capture envelope, while paying **100% of adult resting metabolism**. A body-area-scaled metabolism starts at 20.25% of the adult rate. This is consistent with the simulation's existing radius-squared body energy and energy capacity rules.

The mechanism supported by the experiments is **low caloric return plus insufficient recruitment**, amplified by this mismatch between juvenile size and upkeep. This is not evidence that prey turning speed has no effect; I did not isolate turning rate. The short-lived surviving seed-5 hunter lineage has little time to accumulate the missing reproductive surplus.

### Baseline evidence

`node bench/hunters.js 60 5 3` reproduces the failure. Additional instrumentation measures individual hunters (`c.pheno.diet > 0.5`), not their species representative's diet. A hunter-tick is one living hunter taking its turn.

| Interval, days | Mean radius of consumed prey | Energy per kill | Kills / 1,000 hunter-ticks | Energy cost / hunter-tick | Ticks in cooldown | Hunter offspring born |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0–5 | 4.36 | 31.57 | 3.23 | 0.155 | 14.8% | 35 |
| 20–25 | 2.63 | 13.23 | 11.55 | 0.177 | 22.1% | 22 |
| 25–30 | 2.59 | 12.50 | 12.63 | 0.172 | 22.9% | 8 |
| 30–35 | 2.66 | 11.93 | 12.44 | 0.170 | 20.5% | 0 |

Energy cost includes resting metabolism, swimming, and bite output. Meal gains are reconstructed from the victim's energy and current radius at death using the actual `hunt()` formula. Consumed prey include juveniles; their current radii are smaller than the reported adult grazer radius (~3.4 late in the run).

During days 30–35, hunting supplies only `787.052 / 5304 = 0.1484` energy per hunter-tick, below the `0.1704` upkeep cost. Grazing supplements this, but there is little lifetime surplus for breeding. The two remaining hunters show the consequence directly:

| Hunter | Death day | Cause | Age, ticks | Lifetime kills | Offspring | Birth energy | Energy at death | Energy required to breed |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 4774 | 34.215 | old age | 3,508 | 42 | 0 | 55.50 | 45.57 | 230.53 |
| 4775 | 34.625 | old age | 3,754 | 52 | 0 | 55.50 | 161.05 | 235.89 |

Seed 5's first hunter founder has lifespan 3,440 ticks, diet 0.636, and radius 10.23; its late surviving descendants retain roughly five-to-six-day lifespans. Their breeding energy hurdle is much larger than their ~55.5 inherited reserve.

## Best principled candidate: juvenile metabolism (not safe to integrate yet)

Scale **resting metabolism** with current body area during growth. This changes one expression, adds no parameter, and leaves the adult rate exactly unchanged:

```diff
diff --git a/src/world.js b/src/world.js
--- a/src/world.js
+++ b/src/world.js
@@
-    c.energy -= p.metabolism + ECOLOGY.moveCost * c.speed * c.speed * r + ECOLOGY.biteCost * bite;
+    c.energy -= p.metabolism * (bodyRadius(c) / r) ** 2 + ECOLOGY.moveCost * c.speed * c.speed * r + ECOLOGY.biteCost * bite;
```

Over the 900-tick linear radius growth period, mean squared size is approximately 0.5508 of adult area. A fish therefore saves about 404 adult-metabolism-ticks during growth. For a resting metabolism of 0.13179, that is **53.3 energy**, comparable to the last seed-5 hunters' entire inherited energy reserve. This grants juveniles time to feed and accumulate energy, rather than creating extra calories per prey item. It applies to grazers too; their population minima must therefore be checked as well.

With this change, seed 5 has 19 hunters and 275 grazers at day 40, versus zero hunters in the baseline. During days 35–40 it produces 29 hunter offspring. At day 40, hunter median adult radius is 9.13: the altered recruitment trajectory also permits subsequent evolution. The long-run outcome is an ecological/evolutionary trajectory, not a controlled claim that every extra birth is caused directly by one saved juvenile.

## 150-day validation

All worlds use default `createWorld({ seed })` options. Counts are checked **after every step**, through tick 90,000. Hunters are individuals with diet > 0.5; grazers are diet <= 0.5. Minimum hunters covers the entire run; minimum grazers covers ticks 3,001–90,000 (strictly after day 5). A hunter-free tick is a failure even if hunters evolve again later.

| Seed | Baseline min hunters | Baseline min grazers after day 5 | Baseline hunters / grazers at day 150 | Candidate min hunters | Candidate min grazers after day 5 | Candidate hunters / grazers at day 150 | Candidate result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 14 | 21 | 34 / 90 | 20 | 31 | 55 / 61 | passes |
| 2 | 2 | 36 | 33 / 93 | 2 | 45 | 53 / 125 | passes |
| 3 | 6 | 34 | 23 / 130 | 1 | **0** | 19 / 160 | **fails grazer floor** |
| 4 | 1 | 212 | 3 / 258 | 7 | 186 | 17 / 378 | passes |
| 5 | **0** | 153 | 0 / 224 | **2** | 137 | **31 / 266** | passes |
| 6 | 15 | 14 | 20 / 121 | 20 | 26 | 63 / 93 | passes |

Candidate hunters never reach zero on any seed. All baseline seeds except 5 also retain hunters throughout. Seed 3's recovered final grazer count does not erase its earlier zero: this is a failed acceptance check, just as a late hunter recovery does not erase extinction.

The baseline already dips to 14 grazers on seed 6, which is near the requested approximate floor of 15. Exact minima are reported rather than rounded or inferred from five-day samples.

## Controls and rejected alternatives

These were separate runs from the same baseline. Parameter trials mutated only the indicated exported `ECOLOGY` value in memory; the linear-metabolism trial temporarily changed the same expression as the area candidate. Trials were not combined.

| Seed-5 experiment | Horizon | First hunter-free day | Hunters at horizon | Minimum grazers after day 5 |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 150 | 34.625 | 0 | 153 |
| `preyBodyValue = 2.0` (was 1.6) | 150 | 88.617 | 0 | 59 |
| `preyBodyValue = 2.4` | 150 | 114.078 | 2 | 46 |
| `digestTicks = 100` (was 200) | 150 | 102.175 | 0 | 83 |
| `digestTicks = 0` (diagnostic ablation) | 60 | none through day 60 | 13 | 90 |
| Linear juvenile metabolism: multiply by `bodyRadius(c) / r` | 150 | 91.693 | 0 | 76 |

The 2.4 body-value run is an example of why the final-day count alone is insufficient. It reaches zero hunters before later producing diet > 0.5 fish again. More calories and shorter cooldowns delay extinction, supporting the energetic explanation, but do not meet the continuous-persistence target in these full runs. Removing digestion was only a diagnostic control, not a recommendation or a 150-day success claim. Linear juvenile metabolism was a milder control for the body-area candidate, motivated by sensing and other costs that need not shrink with body area; it also fails seed 5.

A separate baseline sensor check finds that nearest-prey and nearest-kin inputs identify the same unattackable, non-starving kin target on roughly 1–2.2% of hunter-ticks before day 25, 0.25% during days 25–30, and zero during days 30–35. This is a lower-bound check (a different, nearer kin can mask the match), not a full target trace. It does not implicate chasing unattackable offspring as the immediate cause of the final decline.

My recommendation is to retain the current ecology for now, and treat juvenile energy accounting as the next focused investigation. The area-scaling experiment demonstrates a way to rescue seed 5 without increasing prey calories or adult hunting power, but its seed-3 regression rules it out as the requested safe change. I have not established a replacement that satisfies all criteria, nor a causal explanation for that regression.

## Verification and reproduction

- Baseline: `node --test` passes 51/51.
- Body-area candidate temporarily applied: `node --test` passes 51/51. The linear candidate also passes 51/51; those unit tests do not establish long-run ecological safety.
- A focused one-tick check, with food and movement disabled, fails on baseline hatchling metabolism (`0.131792` instead of body-area-scaled `0.026688`) and passes with the proposed change. It also checks unchanged adult upkeep.
- After restoration: `node --test` passes 51/51 again; `git diff --exit-code -- src test` exits 0, no untracked files remain under `src/` or `test/`, and the source SHA-256 matches the baseline above. The sole remaining workspace change is this uncommitted report. No commits, pushes, or installations were made.

The following minimal runner reproduces the population table. Run it from `notes/` after applying the diff temporarily, then restore the original source. To reproduce baseline, run it without the diff. It checks every tick and records extinction rather than stopping at day 150's population count:

```js
import { createWorld, step, DAY } from '../src/world.js';

for (let seed = 1; seed <= 6; seed++) {
  const w = createWorld({ seed });
  let minH = Infinity, minG = Infinity, firstZero = null;
  let h = 0, g = 0;
  for (let tick = 1; tick <= 150 * DAY; tick++) {
    step(w);
    h = 0; g = 0;
    for (const c of w.creatures) {
      if (c.pheno.diet > 0.5) h++;
      else g++;
    }
    minH = Math.min(minH, h);
    if (tick > 5 * DAY) minG = Math.min(minG, g);
    if (!h && firstZero === null) firstZero = tick / DAY;
  }
  console.log({ seed, minH, minG, firstZero, finalH: h, finalG: g });
}
```

The six seeds and 150 days are the tested scope. Continuous persistence here is not a guarantee for other seeds or indefinite runs.

## Follow-up: gentler scaling

Screened seeds 3 and 5 for 150 days each, counting every tick as above. Here `q = (bodyRadius(c) / r) ** 2`; each cell is **minimum hunters / minimum grazers after day 5**.

| Metabolism multiplier | Seed 3 | Seed 5 | First hunter-free day, seed 5 |
| --- | ---: | ---: | ---: |
| `max(0.4, q)` | 0 / 1 | 0 / 60 | 49.983 |
| `max(0.6, q)` | 5 / 4 | 0 / 66 | 50.150 |
| `0.3 + 0.7*q` | 0 / 1 | 0 / 62 | 119.743 |
| `diet > 0.5 ? q : 1` | 10 / 31 | 5 / 44 | none |

Hunter-only scaling therefore received the remaining four validation runs:

| Seed | Minimum hunters | Minimum grazers after day 5 |
| --- | ---: | ---: |
| 1 | 20 | 24 |
| 2 | **0** | 74 |
| 3 | 10 | 31 |
| 4 | 2 | 144 |
| 5 | 5 | 44 |
| 6 | 14 | **4** |

It rescues seeds 3 and 5 together, but seed 2 loses its hunters at day **28.817**, and seed 6 dips to four grazers. None of the tested variants meets all six seeds' requirements.

The full-area seed-3 trace stops at the first grazer-free tick, day **25.202**: between days 22 and 25, grazers fall from 73 to 1, with **157 eaten versus 102 born**, while algae rise from 239 to 697 pellets. This is predation outpacing replacement, rather than pool-wide algae exhaustion; the last isolated grazer subsequently dies of starvation.

Hunter-only scaling is a **balance hack**, not a general physiological rule: almost identical fish on opposite sides of diet 0.5 get different resting costs. Adult-sized grazer mouths versus juvenile-sized hunting bodies give it a pragmatic motivation, but do not justify that sharp dietary cutoff.

**Recommendation:** retain the current ecology; neither the tested universal discounts nor the hunter-only balance exception is a safe replacement.

Budget: **12 full 150-day runs**, plus the 25.2-day crash trace; the 0.5 blend was not tested. All substitutions were in memory, with no source/test edits made by this follow-up. Runs loaded the original baseline (world SHA-256 listed above); 51/51 tests passed before concurrent deterministic-math edits appeared during final verification. Those simulation, test, and UI/build edits were left intact; these results do not validate the new math implementation. Only this appended report remains from the follow-up; no commits, pushes, or installations.
