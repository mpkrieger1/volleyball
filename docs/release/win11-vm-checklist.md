# Windows 11 VM install checklist

Sprint 24 PRD §5 exit tests 1, 3, 4 require VM-level verification that
`tests/integration/installer/sizeCheck.test.ts` cannot perform from inside
the dev environment. Use this checklist on every release-candidate build
before promotion.

## Setup

1. Provision a fresh Windows 11 VM (Hyper-V, Parallels, VirtualBox,
   VMware — any).
2. Install the latest Windows updates.
3. Make sure VM has clean state — no prior `%APPDATA%/VCD/` directory.
4. Copy the artifact `release/VCD-Setup-<version>.exe` from the build
   host to the VM.

## Exit test 1 — Fresh install succeeds without prompts or errors

- [ ] Double-click `VCD-Setup-<version>.exe` on the desktop.
- [ ] If the installer is unsigned, Windows SmartScreen will display a
      blue dialog. Click **More info** → **Run anyway**. (For a signed
      build, the dialog should not appear after the cert builds
      reputation; first install of a fresh cert may still prompt.)
- [ ] Step through the installer: license, install location, shortcut.
- [ ] Confirm the installer completes without errors.
- [ ] Confirm `C:\Users\<user>\AppData\Local\Programs\VCD\` (or the
      chosen install location) contains `VCD.exe` and `resources/`.
- [ ] Confirm a Start Menu shortcut under "Krieger Analytics" → "VCD".

## Exit test 4 — First-run < 60 seconds from double-click to "Create New Save"

Use a stopwatch.

- [ ] Start the timer when the user double-clicks the desktop shortcut.
- [ ] Note: VCD launches → the welcome modal appears.
- [ ] Click **Skip** (or step through 3 slides + Get started).
- [ ] Note: the Save Slots screen renders with "No save slots yet —
      create one to get started."
- [ ] The "New save" button is visible and clickable.
- [ ] **Stop the timer.** Record the elapsed time.
- [ ] Pass criterion: ≤ 60 s.

## Exit test 3 — Uninstaller leaves no residual data

- [ ] Settings → Apps → Installed apps → search "VCD" → ⋯ →
      **Uninstall**.
- [ ] Confirm the uninstall prompt; allow elevation if requested.
- [ ] Confirm the program is removed from "Apps" list.
- [ ] Open File Explorer:
  - [ ] `%APPDATA%\VCD\` — should not exist.
  - [ ] `%LOCALAPPDATA%\VCD\` — should not exist.
  - [ ] `%LOCALAPPDATA%\Programs\VCD\` — should not exist.
- [ ] Open `regedit`:
  - [ ] `HKEY_CURRENT_USER\Software\com.kriegeranalytics.vcd` — should not exist.
  - [ ] `HKEY_LOCAL_MACHINE\SOFTWARE\com.kriegeranalytics.vcd` — should not exist.
  - [ ] Note: NSIS-managed uninstall keys under
        `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\` should
        also be gone.
- [ ] Pass criterion: zero residual data in any of the above paths.

## Failure mode — what to file

If any check fails, file a bug labeled `release-blocker` with:
- Build version + GitHub Actions run URL.
- Screenshot of the failure (SmartScreen dialog, residual file, etc.).
- Reproduction steps relative to this checklist.

## Sprint 25 closed-beta extension

This checklist will be repeated by 3-5 closed-beta testers as part of
the Sprint 25 onboarding. Their results feed the bug triage board.
