---
name: retropanel_architecture
description: Retro Panel add-on architecture decisions, build pipeline, known issues and fixes applied
type: project
---

# Retro Panel - Architecture & Known Issues

## Build pipeline
- Workflow: `.github/workflows/builder.yaml` uses `docker/build-push-action@v6` directly (NOT `home-assistant/builder`)
- This means `build.yaml` labels section is IGNORED by the workflow (it is only read by the official HA builder action)
- `io.hass.*` labels are NOT injected into the built images
- Images published to ghcr.io as `ghcr.io/paolobets/{arch}-retro-panel:{version}`

## Base image
- `ghcr.io/home-assistant/aarch64-base-python:3.12-alpine3.21`
- `ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.21`
- Uses s6-overlay v3 with `/init` as the entrypoint binary

## Critical known issue: apparmor.txt auto-loading
- `apparmor.txt` is present in the add-on directory
- HA Supervisor auto-loads `apparmor.txt` even if `apparmor: true` is NOT in `config.yaml`
- The AppArmor profile `retro_panel` does NOT include permissions for `/init` or s6-overlay binaries
- This causes: `/bin/sh: can't open '/init': Permission denied` at container startup
- **Fix: DELETE apparmor.txt** (simplest) OR add full s6-overlay permissions to it

**Why:** The Supervisor scans the add-on directory and applies any found apparmor.txt unconditionally.
**How to apply:** Always warn about apparmor.txt presence in Retro Panel. The fix is deletion unless AppArmor hardening is explicitly desired.
