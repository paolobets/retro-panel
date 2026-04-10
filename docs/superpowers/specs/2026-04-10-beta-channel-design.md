# Beta Channel Design — Retro Panel

## Goal

Add a beta channel so the developer can test new features on their own HA instance before releasing to all users, without impacting the stable add-on in any way.

## Constraints

- **Zero changes** to `retro-panel/` directory, its config.yaml, Dockerfile, or any existing stable workflow
- **Zero changes** to existing `v*` tag CI pipeline behavior
- Stable users must not experience any disruption
- Beta add-on runs on a different port (7655) with a different slug so it coexists with stable

## Architecture

### New directory: `retro-panel-beta/`

Contains **only** `config.yaml` — no Dockerfile, no app code, no rootfs. HA Supervisor reads this for metadata and pulls pre-built Docker images from ghcr.io.

```yaml
name: "Retro Panel Beta"
slug: retro_panel_beta
version: "2.12.0"    # updated by CI on beta tag
stage: experimental
image: "ghcr.io/paolobets/{arch}-retro-panel-beta"
ingress_port: 7655
ports:
  7655/tcp: 7655
# rest identical to retro-panel/config.yaml
```

### repository.json update

HA Supervisor discovers add-ons by scanning directories in the repo. No changes needed to `repository.json` itself — HA auto-discovers any directory with a valid `config.yaml`. However, the current `repository.json` is minimal metadata (name, url, maintainer) and doesn't list directories, so no change is required.

### CI workflow extension

The existing `builder.yaml` is extended with a new job triggered by `beta-*` tags:

**Existing (unchanged):**
- Tag `v*` on master → lint → build from `retro-panel/` → push `ghcr.io/paolobets/{arch}-retro-panel:{version}` + `:latest` → create GitHub release

**New (added):**
- Tag `beta-*` on master → build from `retro-panel/` (same source code!) → push `ghcr.io/paolobets/{arch}-retro-panel-beta:{version}` + `:beta` → update `retro-panel-beta/config.yaml` version → commit + push version bump

The beta build job:
1. Extracts version from the tag name (e.g., `beta-2.13.0-rc1` → `2.13.0-rc1`)
2. Builds Docker image from `retro-panel/` directory (same Dockerfile, same app code as stable)
3. Pushes to `ghcr.io/paolobets/{arch}-retro-panel-beta:{version}` and `:beta`
4. Updates `retro-panel-beta/config.yaml` version field to match
5. Commits and pushes the version change to master (so HA Supervisor sees the new version)

### Developer workflow

```
1. Create feature branch from master
2. Develop, commit, merge to master
3. Tag: git tag beta-2.13.0-rc1 && git push origin --tags
4. CI builds beta image, updates beta config.yaml version
5. HA shows "Retro Panel Beta" update → install/update on :7655
6. Test on iPad via :7655
7. Works? → Tag: git tag v2.13.0 && git push origin --tags
   → CI builds stable, all users get update on :7654
8. Doesn't work? → Fix, merge, tag beta-2.13.0-rc2, repeat
```

### HA setup (one-time)

The user installs "Retro Panel Beta" from the same repository store page. It appears with an "Experimental" badge. Runs on port 7655 alongside the stable add-on on port 7654.

### What other users see

"Retro Panel Beta" appears in the add-on store with `stage: experimental` badge. Most users ignore it. If someone installs it, they get the latest beta — it doesn't affect the stable add-on.

## Files to create/modify

| File | Action | Risk to stable |
|------|--------|---------------|
| `retro-panel-beta/config.yaml` | Create | None — new directory |
| `.github/workflows/builder.yaml` | Extend | None — adds new jobs, existing jobs untouched |
| `retro-panel-beta/icon.png` | Copy from stable | None |
| `retro-panel-beta/logo.png` | Copy from stable | None |

## Pre-push hook

The existing pre-push hook validates `retro-panel/config.yaml` version vs cache-buster. The beta add-on doesn't have its own cache-buster (it uses the same HTML files from the Docker build). The hook should either:
- Only run for stable (current behavior, no change needed if it already targets `retro-panel/config.yaml` specifically)
- Or be extended to also validate beta config.yaml version format

Need to verify current hook behavior to determine if any change is needed.
