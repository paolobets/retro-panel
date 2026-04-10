# Beta Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beta add-on channel so new features can be tested on a personal HA instance before releasing to all users.

**Architecture:** A new `retro-panel-beta/` directory with only `config.yaml` (different slug, port, image, `stage: experimental`). The CI workflow is extended with a `build-beta` job triggered by `beta-*` tags that builds from `retro-panel/` source and pushes to a separate Docker image. A `bump-beta-version` job auto-commits the version update to `retro-panel-beta/config.yaml` so HA Supervisor detects the new version.

**Tech Stack:** GitHub Actions, Docker, HA Supervisor add-on discovery

**CRITICAL:** Zero modifications to existing stable add-on files or CI jobs. All changes are additive.

---

### Task 1: Create `retro-panel-beta/config.yaml`

**Files:**
- Create: `retro-panel-beta/config.yaml`
- Copy: `retro-panel/icon.png` → `retro-panel-beta/icon.png`
- Copy: `retro-panel/logo.png` → `retro-panel-beta/logo.png`

- [ ] **Step 1: Create beta config.yaml**

Create `retro-panel-beta/config.yaml` with the following content. Key differences from stable: `name` has "Beta" suffix, `slug` is `retro_panel_beta`, `stage: experimental`, `image` points to `retro-panel-beta`, ports use `7655` instead of `7654`.

```yaml
name: "Retro Panel Beta"
version: "2.12.0"
slug: "retro_panel_beta"
description: >-
  Beta channel for Retro Panel. Touch-optimized kiosk dashboard for Home Assistant.
  Designed for wall-mounted tablets and always-on displays.
  Works on legacy devices (iOS 12+), old Android browsers, and modern browsers.
  WARNING: This is the experimental version — may contain bugs.
url: "https://github.com/paolobets/retro-panel"
homeassistant: "2023.1.0"
stage: experimental
image: "ghcr.io/paolobets/{arch}-retro-panel-beta"
arch:
  - aarch64
  - amd64
ingress: true
ingress_port: 7655
ports:
  7655/tcp: 7655
ports_description:
  7655/tcp: "Retro Panel Beta direct access (bypass HA login for legacy browsers)"
panel_icon: mdi:tablet-dashboard
panel_title: Retro Panel Beta
startup: services
init: false
hassio_api: true
homeassistant_api: true
options:
  ha_url: "http://homeassistant:8123"
  ha_token: ""
  panel_title: "Home"
  theme: "dark"
  refresh_interval: 30
  notification_ttl_days: 7
  allowed_direct_ips:
    - "0.0.0.0/0"
schema:
  ha_url: url?
  ha_token: password?
  panel_title: str
  theme: "list(dark|light|auto)"
  refresh_interval: "int(5,300)"
  notification_ttl_days: "int(1,365)"
  allowed_direct_ips:
    - str
```

- [ ] **Step 2: Copy icon and logo**

```bash
cp retro-panel/icon.png retro-panel-beta/icon.png
cp retro-panel/logo.png retro-panel-beta/logo.png
```

- [ ] **Step 3: Verify HA linter accepts the new add-on**

The GitHub Action uses `frenck/action-addon-linter@v2`. We can't run that locally, but verify the config.yaml structure is valid by checking it has all required fields: `name`, `version`, `slug`, `description`, `arch`, `image`.

- [ ] **Step 4: Commit**

```bash
git add retro-panel-beta/
git commit -m "feat(beta): add retro-panel-beta add-on directory

New add-on entry with slug retro_panel_beta, stage experimental,
port 7655. Contains only config.yaml + icons — no source code.
CI will build Docker images from retro-panel/ source."
```

---

### Task 2: Extend CI workflow with beta build job

**Files:**
- Modify: `.github/workflows/builder.yaml`

The existing file has three jobs: `lint`, `build`, `release`. We add two new jobs: `build-beta` and `bump-beta-version`. The existing jobs are NOT modified — we only add new ones.

- [ ] **Step 1: Add beta-* tag to the `on.push.tags` trigger**

Currently line 8 has `- "v*"`. Add `- "beta-*"` below it:

```yaml
on:
  push:
    branches:
      - master
    tags:
      - "v*"
      - "beta-*"
  pull_request:
    branches:
      - master
```

- [ ] **Step 2: Add `if` condition to existing `build` job to skip beta tags**

Add this line to the `build` job (after `needs: lint`):

```yaml
  build:
    name: Build ${{ matrix.arch }}
    runs-on: ubuntu-latest
    needs: lint
    if: "!startsWith(github.ref, 'refs/tags/beta-')"
    permissions:
```

This ensures the stable build job does NOT run on `beta-*` tags — it only runs on `v*` tags and branch pushes.

- [ ] **Step 3: Add `if` condition to existing `release` job**

The release job already has `if: startsWith(github.ref, 'refs/tags/v')` so it naturally skips `beta-*` tags. No change needed — verify this is the case.

- [ ] **Step 4: Add `build-beta` job**

Append this job after the `release` job:

```yaml
  # ── Build beta images on beta-* tags ───────────────────────────────────────
  build-beta:
    name: Build beta ${{ matrix.arch }}
    runs-on: ubuntu-latest
    needs: lint
    if: startsWith(github.ref, 'refs/tags/beta-')
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        include:
          - arch: aarch64
            platform: linux/arm64
            build_from: ghcr.io/home-assistant/aarch64-base-python:3.12-alpine3.21
          - arch: amd64
            platform: linux/amd64
            build_from: ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.21
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Extract beta version from tag
        id: version
        run: |
          # Tag format: beta-X.Y.Z or beta-X.Y.Z-rcN
          TAG="${GITHUB_REF_NAME}"
          VERSION="${TAG#beta-}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push beta
        uses: docker/build-push-action@v6
        with:
          context: ./retro-panel
          platforms: ${{ matrix.platform }}
          push: true
          provenance: false
          tags: |
            ghcr.io/${{ github.repository_owner }}/${{ matrix.arch }}-retro-panel-beta:${{ steps.version.outputs.version }}
            ghcr.io/${{ github.repository_owner }}/${{ matrix.arch }}-retro-panel-beta:beta
          build-args: |
            BUILD_FROM=${{ matrix.build_from }}
          labels: |
            io.hass.type=addon
            io.hass.arch=${{ matrix.arch }}
            io.hass.version=${{ steps.version.outputs.version }}
```

- [ ] **Step 5: Add `bump-beta-version` job**

This job runs after `build-beta` completes and updates `retro-panel-beta/config.yaml` version on master so HA Supervisor detects the new version. Append after `build-beta`:

```yaml
  # ── Update beta config.yaml version so HA detects the update ───────────────
  bump-beta-version:
    name: Bump beta version
    runs-on: ubuntu-latest
    needs: build-beta
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: master
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract beta version from tag
        id: version
        run: |
          TAG="${GITHUB_REF_NAME}"
          VERSION="${TAG#beta-}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

      - name: Update beta config.yaml version
        run: |
          sed -i 's/^version: .*/version: "${{ steps.version.outputs.version }}"/' retro-panel-beta/config.yaml

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add retro-panel-beta/config.yaml
          git diff --cached --quiet && echo "No version change" && exit 0
          git commit -m "chore(beta): bump version to ${{ steps.version.outputs.version }}"
          git push origin master
```

- [ ] **Step 6: Add lint job for beta config**

Extend the existing `lint` job to also lint the beta add-on. Add a second step after the existing lint step:

```yaml
      - name: Validate beta add-on config
        uses: frenck/action-addon-linter@v2
        with:
          path: "./retro-panel-beta"
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/builder.yaml
git commit -m "ci(beta): add beta build pipeline for beta-* tags

- build-beta: builds from retro-panel/ source, pushes to retro-panel-beta image
- bump-beta-version: auto-updates retro-panel-beta/config.yaml on master
- Existing stable build/release jobs unchanged (skipped on beta-* tags)"
```

---

### Task 3: Commit spec + plan docs and push

**Files:**
- Stage: `docs/superpowers/specs/2026-04-10-beta-channel-design.md`
- Stage: `docs/superpowers/plans/2026-04-10-beta-channel.md`

- [ ] **Step 1: Commit docs**

```bash
git add docs/superpowers/specs/2026-04-10-beta-channel-design.md docs/superpowers/plans/2026-04-10-beta-channel.md
git commit -m "docs: add beta channel design spec and implementation plan"
```

- [ ] **Step 2: Push to master**

```bash
git push origin master
```

This push does NOT trigger a build (no tag), only lint. The beta pipeline activates only when a `beta-*` tag is pushed.

---

### Task 4: First beta test — tag and verify

- [ ] **Step 1: Create first beta tag**

```bash
git tag beta-2.12.0
git push origin beta-2.12.0
```

- [ ] **Step 2: Verify CI pipeline**

Go to `https://github.com/paolobets/retro-panel/actions` and verify:
- `lint` job passes (both retro-panel/ and retro-panel-beta/)
- `build-beta` job runs (NOT `build`)
- `build-beta` pushes images to `ghcr.io/paolobets/{arch}-retro-panel-beta:2.12.0` and `:beta`
- `bump-beta-version` updates `retro-panel-beta/config.yaml` version to `2.12.0`

- [ ] **Step 3: Verify on HA**

On your Home Assistant:
1. Go to Settings → Add-ons → Add-on Store
2. Look for "Retro Panel Beta" with experimental badge
3. Install it
4. Configure it (same options as stable)
5. Access via `http://[IP_HA]:7655`
6. Verify it works identically to stable on `:7654`
