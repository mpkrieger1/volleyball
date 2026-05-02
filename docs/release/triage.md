# VCD Bug Triage Process

**Status:** Active — Sprint 25 closed beta and beyond.

## Severity tiers

| Tier | Definition | SLA |
|---|---|---|
| **P0** | Data loss, crash on launch, unrecoverable save, app hang. The user cannot continue playing. | Same-day fix → hotfix release within 24 h. |
| **P1** | Major feature broken: cannot sim a week, postseason fails, recruiting cycle won't close, lineup editor broken. Workaround may exist but the broken path is core. | Within-sprint fix → next scheduled hotfix. |
| **P2** | Significant glitch in a non-blocker path: stats display wrong on one screen, UI overlap on a single screen, calibration knob drifted. | Backlogged for next sprint. |
| **P3** | Cosmetic or minor edge case: typo, off-by-one in a tooltip, edge-case sort order, low-frequency layout nit. | Polishing pass; v1.1 acceptable. |

## Labels (GitHub Issues)

Apply at triage time. The bug template defaults to `triage`.

**Severity** (exactly one):
- `severity:P0`
- `severity:P1`
- `severity:P2`
- `severity:P3`

**Area** (one or more):
- `area:sim` — rally FSM, rotation, calibration
- `area:season` — week advance, scheduling, postseason, RPI
- `area:recruiting` — cycle, AI, board, NIL, portal
- `area:roster` — players, coaches, lineup, redshirts
- `area:ui` — any renderer screen, accessibility, keyboard nav
- `area:save-load` — save slots, migrations, save-file size
- `area:install` — installer, updater, first-run, code-signing
- `area:perf` — speed/memory budgets

**Status** (workflow):
- `triage` — fresh, unconfirmed (default on new issues)
- `confirmed` — reproduced by maintainer
- `in-progress` — being worked on; assignee set
- `fixed-pending-build` — fix merged to `main`; awaiting hotfix build
- `wontfix` — out of scope or by-design (with explanation)

## Triage workflow

**Daily during beta:**

1. List untriaged: `gh issue list -l triage`.
2. For each:
   - Reproduce locally if reproduction steps are clear.
   - Assign severity + area labels; remove `triage`.
   - If reproducible, set `confirmed` and decide: fix-now (P0), fix-this-sprint (P1), backlog (P2/P3).
   - If not reproducible, request more info (logs, save file, video) and leave `triage`.
3. P0s: stop other work, fix immediately, cut a hotfix per `hotfix.md`.
4. P1s: schedule for end-of-week hotfix batch.

**Sprint exit:**

- Zero P0 open. (Sprint 25 PRD exit test.)
- ≤ 3 P1 open. (Sprint 25 PRD exit test.)
- All P2/P3 labeled and assigned to a future milestone (`v1.1` or later).

## When in doubt

If a bug spans areas, label all that apply. Severity should reflect the worst affected user path: a P0 crash that only fires from a P3 cosmetic flow is still P0.

For reports that look like by-design / user error, respond with explanation and `wontfix` rather than closing without comment — the report still informs UI affordance gaps.
