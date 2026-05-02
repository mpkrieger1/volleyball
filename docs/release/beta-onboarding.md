# VCD Closed Beta — Tester Onboarding

**Sprint 25.** This guide walks a closed-beta tester through install, first session, and bug reporting. Hand it off via Discord / email with the signed installer link.

## Who is this for

3–5 testers selected for Sprint 25 closed beta. Mix of:

- 1–2 NCAA volleyball watchers (validate "feels like a real volleyball match" — the Sprint 25 PRD survey gate).
- 1–2 dynasty-sim veterans (Football Coach: College Dynasty, OOTP, etc. — validate progression / dynasty loop).
- 1 fresh user (validate first-run UX without genre context).

Per Sprint 24 retro, "agent testers" was ambiguous — interpreted here as **human testers**, but the protocol supports MCP/Claude-Code agent runs of the same checklist if the user wants automation later.

## Prerequisites

- Windows 11 (Home or Pro). Earlier Windows is unsupported in Sprint 25.
- Clean machine or VM preferred (catches install/uninstall regressions). The `docs/release/win11-vm-checklist.md` is the canonical clean-VM checklist if you have a Hyper-V or VirtualBox VM available.
- A GitHub account (for filing bugs). No volleyball expertise required for the fresh-user slot.

## Install

1. Download the signed installer link sent to you (e.g. `VCD-Setup-0.25.0-beta.0.exe`).
2. SmartScreen may warn on first run — click "More info" → "Run anyway" if the cert hasn't been built reputation yet. (If the build is unsigned, you'll see a stronger warning; ask the maintainer before proceeding.)
3. Run the installer. Default install location is fine.
4. First-run welcome modal appears: read the 3-slide intro, opt **Diagnostics ON** (helps the maintainer see crashes — it's local-file-only in Sprint 25; nothing leaves your machine without an explicit upload).
5. Click "Get started." You should land on the Save Slots screen.

## First session — required path

Play through this once before anything else. ~30 minutes.

1. **Create a new save** (any team — pick something you like).
2. **Sim the first week** of regular season. Verify: no crashes, week advances, scoreboard populates.
3. **Open one match's analytics** (Match Hub → Analytics). Verify: charts render, stats look plausible.
4. **Run a recruiting cycle**: open the recruiting screen, take a few actions on 2–3 recruits, advance the cycle to signing day.
5. **Sim a postseason**: advance through conference tournament + NCAA bracket. Verify: bracket renders, champion crowned.
6. **Advance to next year**: confirm offseason runs, recruits promote to roster, you land back at week 1 of year N+1.
7. **Save & quit.** Re-launch. Verify your save slot loads with state preserved.

If anything in steps 1–7 fails, stop and file a P0 issue with logs.

## Then — open exploration

Beat on the game for ~5+ matches across at least 2 seasons. Focus areas:

- **Match realism** (the survey question): does the rally pace feel right? Do hitting %, kill totals, ace counts look NCAA-y? Do the tactical choices (system 5-1 vs 6-2, lineup tweaks) actually move the needle?
- **Recruiting depth**: are the recruit ratings plausibly distributed? Does your prestige drive who commits to you?
- **Postseason drama**: does seeding feel right? Do upsets happen at a believable rate?
- **UI**: keyboard navigation, font scaling (Settings → Font Size), accessibility if you use a screen reader.
- **Performance**: any week advances feel slow? Any UI lag?

## Filing bugs

Use the GitHub issue template at `https://github.com/mpkrieger1/volleyball/issues/new/choose`. The template asks for:

- Severity (your best guess; maintainer will retriage)
- Windows version
- VCD version (Settings → About)
- Reproduction steps
- The log file at `%APPDATA%/VCD/vcd-main.log` (paste the path into File Explorer to find it)

Severity guidance is in `docs/release/triage.md` — TL;DR P0 = "I can't keep playing," P1 = "a major path is broken," P2/P3 = "annoying but I can work around it."

## End-of-beta survey

At the end of the sprint, you'll get a survey link (Google Forms). 10 questions, ~5 minutes. The most important question is:

> After 5+ matches played, does VCD feel like a real volleyball match? (1–10)

The Sprint 25 PRD bar is **≥ 8/10 average across testers**. Be honest — a low score with specific feedback is far more useful than a charitable high score.

## Hotfixes during beta

If a P0 or P1 you reported gets fixed mid-beta, you'll see a comment on your issue: "Fixed in v0.25.X — update via Settings → Check for updates." Updating takes ~30 seconds; please confirm the fix on the issue thread.

## Thank-you

Beta testers don't get paid; they get acknowledgement in the v1.0 release notes and the satisfaction of shaping a niche-sport sim before launch. Thanks for playing.
