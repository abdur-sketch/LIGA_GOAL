# Full Competition UAT

PROJECT: LIGA GOAL
PHASE: 11
DATE: 2026-10-12
STATUS: **PASS**

One sequential Vitest case completed the full flow using the same organization, competition and season. The passing clean-database run took 2.22 seconds.

Evidence chain:

- Organization: `cmv4djjk70000y2tptrciau5g`
- Competition: `cmv4djjkr0006y2tpiwbdekej`
- Season: `cmv4djjkz000by2tp6fg0zpob`
- Result: 6 generated/published matches, 1 official match, all 25 ordered evidence entries present.

| Step | Assertion | Result |
|---:|---|---|
| 1–4 | Organization, competition, season and four clubs created | PASS |
| 5–8 | 24 players, approved document, eligibility and group membership | PASS |
| 9–10 | Six fixtures generated, validated and published | PASS |
| 11–12 | Both five-player lineups confirmed; match started | PASS |
| 13–14 | Goal/assist, red card and substitution recorded | PASS |
| 15–17 | Match finished, reviewed, and separately approved OFFICIAL | PASS |
| 18–21 | Standings, scorer and automatic suspension verified; suspended player rejected | PASS |
| 22–23 | Ordered transfer completed; historical club attribution retained | PASS |
| 24 | Bracket progression and statistics export resolved to the same result | PASS |
| 25 | Public competition/match/statistics/realtime data was published and private profile text absent | PASS |

The first attempt failed at step 11 because the UAT fixture requested two starters while domain rules only permit 5/7/9/11 players on field. Root cause was the test fixture, not the lineup service. The run was discarded, the fixture was corrected to five starters plus one substitute per club, and the entire chain was rerun from a newly created empty database.

Negative/security evidence includes cross-tenant denial, approval separation of duties, invalid registration, suspended-player rejection, event idempotency, optimistic concurrent writes, official-result correction/version history, closed transfer-window denial, private-document cross-tenant denial, quarantined-file denial, realtime reconnect, pool reuse and tenant-isolated jobs. Database-security cases used the non-owner/NOBYPASSRLS runtime role; storage cases used isolated emulator credentials.
