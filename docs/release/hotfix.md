# VCD Hotfix Workflow

**Use when:** A P0 or P1 bug surfaces post-release and needs a patched build pushed to active beta testers (or v1+ users) without waiting for the next minor version.

## Versioning

VCD uses semver: `MAJOR.MINOR.PATCH`.

- **Major** (1.0.0): public release tagging (Sprint 26).
- **Minor** (0.25.0): sprint cuts (`v0.25.0-beta.0` is the Sprint 25 RC).
- **Patch** (0.25.1): hotfixes — bug-only, no new features.

A hotfix bumps the patch only. Never bump minor for a hotfix; it confuses the channel routing.

## Steps

### 1. Branch from `main`

```powershell
git checkout main
git pull
git checkout -b hotfix/0.25.1
```

Hotfix branches are short-lived; merge back to `main` and delete after release.

### 2. Land the fix

- Reproduce the bug locally first.
- Add a regression test that fails before the fix.
- Land minimal code change (no scope creep — drive-by refactors break the speed of a hotfix).
- `npm run check && npm run test` must pass.

### 3. Bump version

Edit `package.json` `version` from `0.25.0` → `0.25.1`. Commit:

```powershell
git commit -am "v0.25.1: <one-line bug summary>"
```

### 4. Cut signed installer

```powershell
npm run build:installer:signed
```

Requires `CSC_LINK` + `CSC_KEY_PASSWORD` env vars. The script errors out without the cert, so unsigned hotfixes can't ship by accident.

### 5. Tag and push

```powershell
git tag v0.25.1
git push origin hotfix/0.25.1
git push origin v0.25.1
```

### 6. Publish to update channel

The signed installer + `latest.yml` go to the GitHub Release for tag `v0.25.1`. electron-updater (Settings → Diagnostics → "Check for updates") picks them up on the next launch for users who have diagnostics enabled.

For beta-only hotfixes, mark the GitHub Release as a **pre-release** so v1.0+ users (post-Sprint-26) don't auto-update to a beta-channel patch.

### 7. Notify testers

- Open a comment on the originating issue: "Fixed in v0.25.1 — please update via Settings → Check for updates and confirm."
- Post the release URL in the beta tester channel (Discord / email — whatever was set up at Task 25.4d).

### 8. Merge back to `main`

```powershell
git checkout main
git merge --no-ff hotfix/0.25.1
git push origin main
```

Delete the hotfix branch:

```powershell
git branch -d hotfix/0.25.1
git push origin --delete hotfix/0.25.1
```

## When the fix needs an emergency bypass

If the cert is unavailable but a P0 is hemorrhaging users:

1. Cut an unsigned `npm run build:installer` build.
2. Distribute via the issue thread with a clear "this build is unsigned — Windows SmartScreen will warn" disclaimer.
3. Re-cut signed and re-publish within 24h.

This is an exceptional path; document the bypass in the release notes and the next sprint retrospective.

## What does NOT belong in a hotfix

- New features, even small ones.
- Refactors, even cleanup ones.
- Schema migrations (those force a save-file compat audit per CLAUDE.md §Critical rule 6 — never under hotfix pressure).
- Calibration knob changes (regenerate-fixtures cost is too high).

If you find yourself pulled into any of those, stop and decide: revert the hotfix scope to bug-fix-only, or escalate to "this needs a real minor bump."
