# NCAA Volleyball Coach Dynasty (VCD)

Single-player career-coach dynasty simulation for NCAA Division I Women's
indoor volleyball. Build a program, recruit a class, navigate NIL and the
transfer portal, and chase the AVCA national championship across multi-season
dynasties.

Windows-first Electron desktop app. v1.0 — first public release.

---

## Install

1. Download the signed installer from the
   [latest release](https://github.com/mpkrieger1/volleyball/releases/latest):
   `VCD-Setup-1.0.0.exe`.
2. Run the installer. Default install path is fine.
3. On first launch, accept the welcome screens and (optionally) opt in to
   anonymous diagnostics.

**System requirements:** Windows 10 or 11 (64-bit). 8 GB RAM recommended.
~250 MB disk for the app + ~50 MB per save slot at 10 in-game seasons.

If SmartScreen warns on first run, click **More info** → **Run anyway**. The
build is signed; the warning fades as the cert builds reputation.

## What's in v1.0

- Full 360-team D-I league with conference + non-conference play
- 13-week regular season + conference tournaments + 64-team NCAA bracket
- Recruiting board, transfer portal, NIL deals, coaching staff
- AVCA All-American awards
- Per-match analytics with PBP replay, rotation/lineup tracking
- Season Hub dashboard, conference standings, RPI top-25, stat leaders
- 5–10 season dynasty save files

## How to play

After install, see the in-app **Season Rhythm** playbook (shown automatically
on first launch; re-show from Settings → Help). Short version:

1. Create a save → pick your team → land on the **Hub** dashboard.
2. **Advance Week** simulates the league's matches. Click your team's
   matches in the **Match Hub** to play them with paced PBP replay,
   timeouts, and substitution affordances.
3. Manage **Recruiting**, **Transfer Portal**, **NIL**, and your **Staff**
   between weeks.
4. Conference tournaments → NCAA bracket → AVCA awards. Repeat.

## Save file location

`%APPDATA%\@vcd\main\saves\<slot-id>\game.db`

Save files are SQLite databases; copying the folder backs up your dynasty.

## Reporting bugs

[Open an issue](https://github.com/mpkrieger1/volleyball/issues/new/choose)
using the bug template. Attach the log file at:

`%APPDATA%\@vcd\main\vcd-main.log`

See `docs/release/triage.md` for severity tiers (P0 = data loss / crash,
P1 = major feature broken, P2 = significant glitch, P3 = cosmetic).

## Roadmap

`docs/release/v1.0-post-mortem.md` lists what shipped, what slipped, and the
v2 backlog (per-day advance, men's volleyball, beach, D-II, multiplayer,
Hall of Fame, conference realignment).

## Building from source

```powershell
npm install
npm run dev               # Electron + Vite dev mode
npm run build             # Compile all workspaces
npm run test              # Vitest unit + integration
npm run build:installer:signed  # Signed installer (requires CSC_LINK + CSC_KEY_PASSWORD)
```

See `CLAUDE.md` for the project's working conventions, test commands, and
architectural rules.

## License

UNLICENSED — © Krieger Analytics. Personal-use single-player game; not for
redistribution or modification without permission.

---

VCD is a clean-room original. Thanks to the Football Coach: College Dynasty
team for showing what a polished dynasty sim on Electron + Prisma + SQLite
can look like; structural patterns referenced, no code or assets borrowed.
