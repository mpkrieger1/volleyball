# Code signing

VCD's `electron-builder` config supports Authenticode code-signing for
Windows installers, but signing is **opt-in**. Without a certificate, builds
proceed unsigned (Windows SmartScreen will warn beta testers; the installer
still runs after the user clicks "More info" → "Run anyway").

## What you need

1. A code-signing certificate from a recognized CA. Recommended issuers:
   - **DigiCert** — premium reputation; ~$500-700/year.
   - **Sectigo** (formerly Comodo) — ~$200-400/year.
   - **SSL.com** — competitive pricing.

2. The certificate exported as `.pfx` (PKCS#12) with a password.

3. (Optional) An Extended Validation (EV) cert eliminates SmartScreen
   warnings immediately. Standard OV certs need ~3,000 installs to build
   reputation. EV is ~2-3× the price.

## Local signed build

Set the environment variables and run:

```powershell
$env:CSC_LINK = "C:\path\to\codesign.pfx"
$env:CSC_KEY_PASSWORD = "your-password"
npm run build:installer:signed
```

`build:installer:signed` errors out if `CSC_LINK` is unset. The
unsigned-OK variant `npm run build:installer` ignores both env vars
and skips signing if either is missing.

`CSC_LINK` accepts:
- A local file path (Windows paths must be backslashed in PowerShell).
- An HTTPS URL to a `.pfx` (electron-builder will download it).
- A Base64-encoded `.pfx` (recommended for CI; use
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("path.pfx"))`).

## CI / GitHub Actions

The workflow at `.github/workflows/ci.yml` reads `CSC_LINK` and
`CSC_KEY_PASSWORD` from GitHub Secrets if both are set. Without them,
CI builds an unsigned installer (no failure).

To enable signed CI builds:

1. Repo Settings → Secrets and variables → Actions → New repository secret.
2. Add `CSC_LINK` (Base64 of the `.pfx`).
3. Add `CSC_KEY_PASSWORD`.

The workflow exposes them only to the `Package Windows installer` step.

## Verify a signed build

```powershell
# Built artifact lives in release/
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" verify /pa /v release\VCD-Setup-*.exe
```

Look for `Successfully verified` and `Signed`.

## Cert rotation

When the cert is renewed, only the GitHub Secret + local env vars need
updating. Nothing in the codebase changes.
