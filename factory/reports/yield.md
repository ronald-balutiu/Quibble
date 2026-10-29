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
