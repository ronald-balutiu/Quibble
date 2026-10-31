# Generator yield report (Phase 1 prototype)

Prototype generators run on a small ingredient sample, measured on 2026-10-29.
The raw results are in `prototype-rounds.json`, `prototype-double-agent.json` and
`prototype-double-agent-rewritten.json`. Neurons spent are recorded in
`factory/ledger.json` (3,011 in total for this prototype).

## Decision: Double Agent uses 3 rounds per puzzle

100 puzzles need 500 distinct words at 5 rounds, or 300 at 3. The best projection
below is about 450 usable words, so 5 rounds is not reachable and 3 rounds leaves
a margin of about 1.5×. Recorded as D-64, which settles D-31.
`shared/games/double-agent.ts` now defaults to 3, and screens must still handle both counts.

## Ingredient sample

| Ingredient | Sample | Full factory (plan 3.9) |
| --- | --- | --- |
| Things (`factory/things.json`) | 112 | ~400 |
| Conditions (`factory/conditions.json`) | 27 | ~120 |
| Truth-matrix cells | 3,024 | ~48,000 |

## Truth matrix

| Step | Model | Requests | Neurons |
| --- | --- | --- | --- |
| Every condition for every thing | Clef-flash | 112 | 958 |
| Re-check cells scored 0.2–0.8 | Clef | 111 | 1,120 |

Result: 583 yes, 2,170 no and 271 unknown cells (9%). Clef-flash averaged 8.6
Neurons per thing for 27 questions, so the full ~400 × ~120 matrix projects to
about 15,000 Neurons for step 1, above the plan's ~8,300 estimate.

## Oddly Specific and Category Escape

| Measure | Result |
| --- | --- |
| Condition triples with three different tags | 990 |
| … with 4–40 solutions | 59 |
| … and no redundant condition (kept rounds) | 3 |
| Category Escape categories with ≥ 17 things (60/400 scaled to the sample) | 1 of 5 (kitchen, 22) |
| Category Escape runs with 5 narrowing restrictions | 0 |

The sample is too small to judge these two generators' real yield. Most sample
conditions are true of very few things (bigger than a person, mostly wood and
round have 2 each; holds liquid 3), and broad conditions (not food 106, not
electronic 94, not powered 92) almost never rule anything out, so the redundancy
rule removes 56 of the 59 triples that had enough solutions. The Clef
confirmation of known answers was therefore not run. Phase 3 needs conditions
that each cover roughly 10–40% of things, and Category Escape categories of 60+
things each.

## Double Agent

Candidates are WordNet words of 3–10 letters whose first four senses include two
in different noun or verb domains, each with at least 5 decoys (sister terms of
the other sense). WordNet has no frequency data, so at least 5 senses stands in
for "common": that leaves a pool of 1,281 words. A seeded sample of 40 was checked;
a clue passes if the target scores ≥ 0.8 on Clef-flash and at most 3 of ~20 decoys do.

| Clues | Valid words | Yield | Projected words | Clues failed: target / too vague |
| --- | --- | --- | --- | --- |
| WordNet definitions | 12 / 40 | 30% | 384 | 32 / 0 |
| Rewritten once by Gemma 4 | 14 / 40 | 35% | 448 | 31 / 0 |

Every failure was the target missing its own clue; no clue was too vague. Many
targets scored 0.6–0.79, just under the factory's 0.8 bar.

## Follow-ups for the full factory (Phase 3)

- Pick sense pairs that are genuinely different meanings: some passing words
  ("skin", "transition") have two senses in different domains that mean nearly the same.
- Use a word-frequency source for "common"; the sense-count proxy lets in obscure
  words such as "scruple" and "aspirate".
- Re-check near-miss targets (0.6–0.8) with Clef rather than dropping them, as the
  truth matrix does.
- Re-estimate the Neuron budget: the matrix alone projects to about 15,000.

## Phase 2 prototypes (2026-10-30)

Run on a larger sample to exercise all three generators; the raw output is in
`prototype-puzzles.json`. Only Oddly Specific is playable in Phase 2, so the
Category Escape and Double Agent prototypes are not shipped.

| Game | Prototype output | Notes |
| --- | --- | --- |
| Oddly Specific | 8 puzzles, shipped | 42 conditions × 112 things; the Clef-flash yes bar is 0.6 (D-68). |
| Category Escape | 10 runs | 212 things. Every level's answer is confirmed by Clef-flash and Gemma 4. Only the kitchen reached the scaled category size (32 of 212); the prototype used 10%. |
| Double Agent | 10 puzzles of 3 | 42 of 100 candidates passed both clue checks (yield 42%, projecting about 538 words), and 38 of those were also confirmed by Gemma 4 on both clues. |

The larger Double Agent sample projects just over the 500 words that 5 rounds
need, too thin a margin to change D-64's 3 rounds. Some passing words still have
two clues that mean the same thing ("transition", "supplement"), confirming the
sense-pair follow-up above. These prototypes spent about 3,160 Neurons, recorded
in `factory/ledger.json`.

## Phase 3 run (2026-10-30 to 2026-10-31)

The full factory, run by `factory/run.ts` over two UTC days. The truth matrix is in
`factory/matrix.json` and the Double Agent checks in `factory/double-agent-checks.json`.

| Day (UTC) | Step | Model | Requests | Neurons |
| --- | --- | --- | --- | --- |
| 2026-10-30 | Every condition for every thing | Clef-flash | 232 | 1,736 |
| 2026-10-30 | Re-check uncertain cells | Gemma 4 | 1,510 | 366 |
| 2026-10-31 | Re-check uncertain cells | Gemma 4 | 943 | 428 |
| 2026-10-31 | Confirm known answers | Gemma 4 | 1,479 | 652 |
| 2026-10-31 | Double Agent word checks | Clef-flash + Gemma 4 | 2,685 | 4,906 |
| 2026-10-31 | Last re-checks and Double Agent candidates | Gemma 4 + Clef-flash | | 72 |

The ledger records 2,101 Neurons on day 1 and 6,058 on day 2. Day 1's runs came
after about 3,160 Neurons of Phase 2 prototypes, and Cloudflare stopped day 1 (error
4006) at a ledger total of about 5,300 for that day, well short of the 10,000
allowance, so the ledger undercounts what Cloudflare bills. Day 2's Double Agent
figure combines a run that stopped on a five-minute request timeout (2,833 Neurons,
recorded as `interrupted`) with the run that finished (2,073).

Result: 14,130 cells, 2,887 yes, 10,846 no and 397 unknown (3%).

### Double Agent

| Check | Words checked | Failed |
| --- | --- | --- |
| First check (both clues, common, two distinct meanings) | 1,900 | 1,695 |
| Decoys (at most 2 of 10 fit each clue) | 205 | 23 |
| Gemma 4 confirmation (both clues ≥ 0.85) | 181 | 14 |

169 words were accepted of all 1,926 candidates (9%); the last 27, judged in a short
final run, added 2. That uses up the WordNet candidate pool (4 or more senses), well
short of the 330 words that 100 puzzles of 3 rounds need. Most first-check failures are words that are not common
or whose two senses are not clearly different.

### Library

| Game | Full build | Shipped |
| --- | --- | --- |
| Oddly Specific | 100 | 100 |
| Category Escape | 100 | 0 |
| Double Agent | 56 | 0 |

`npm run check-puzzles` passed on the full build. Only Oddly Specific ships until
Phase 4 makes the other two games playable, so their files were removed and the
library rebuilt with `--games oddly-specific`.

### Work left

None in the factory: the dry run finds no matrix, re-check or confirmation work, and
every Double Agent candidate is judged. The final run also changed 15 cells to yes,
so the Oddly Specific build changed 97 of its 100 puzzles; none had been deployed
(the live site still serves the 8 Phase 2 prototypes). Double
Agent has 56 puzzles. D-02 lets a library ship smaller; growing it would need a
bigger WordNet pool (for example 3 senses) and another paid run.
