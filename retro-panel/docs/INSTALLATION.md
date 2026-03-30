# Retro Panel v2.0 Installation Guide

This guide walks you through installing and configuring Retro Panel, a touch-optimized Home Assistant add-on for kiosk displays and wall-mounted tablets.

**Document version**: 2.0
**Last updated**: 2026-03-27

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting a Long-Lived Access Token](#getting-a-long-lived-access-token)
3. [Installation Method A: Local Add-on (Recommended)](#installation-method-a-local-add-on-recommended)
4. [Installation Method B: Custom Repository (Future)](#installation-method-b-custom-repository-future)
5. [First-Time Configuration](#first-time-configuration)
6. [Starting the Add-on](#starting-the-add-on)
7. [Accessing the Panel](#accessing-the-panel)
8. [iPad and iOS 12+ Kiosk Setup](#ipad-and-ios-12-kiosk-setup)
9. [Troubleshooting](#troubleshooting)
10. [Updating the Add-on](#updating-the-add-on)

---

## Prerequisites

Before you begin, verify that your Home Assistant setup meets these requirements:

- **Home Assistant OS or Supervised**: Retro Panel is a Home Assistant Add-on and requires HA Supervisor to be running. Home Assistant Core (standalone) is not supported.
- **Minimum version**: Home Assistant 2023.x or later
- **Docker**: Supervisor manages Docker containers automatically; no manual Docker installation required
- **Network access**: The tablet must be on the same network as your Home Assistant instance and able to reach its IP address
- **Browser**: iOS 12+ Safari (legacy devices), or any modern browser on Android
- **Storage**: At least 200 MB available disk space on the HA host

> If you are unsure whether you have Home Assistant OS or Supervised, go to **Settings → About** in the Home Assistant web interface. You should see "Home Assistant OS" or "Home Assistant Supervised" in the banner at the top.

---

## Getting a Long-Lived Access Token

Retro Panel requires a Long-Lived Access Token to securely communicate with Home Assistant. This token allows the add-on to authenticate without exposing your password.

> **Security note**: Your Long-Lived Access Token acts like a password. Never share it or commit it to version control. It is displayed only once during creation.

### Step-by-step instructions:

1. Open Home Assistant in your web browser and log in with your account.

2. In the bottom left corner, click on your **profile icon** (usually a circle with your initials or avatar).

3. Scroll down to the **Long-Lived Access Tokens** section.

4. Click the **Create Token** button.

5. A popup will appear asking for a token name. Enter a descriptive name such as:
   - `Retro Panel`
   - `Retro Panel - Living Room`
   - `Wall Tablet Token`

   The name is only for your reference and helps you identify which token is used where.

6. Click **OK** to create the token.

7. A new page will display your token as a long string of characters (example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).

8. **Copy the entire token immediately** and paste it into a secure location (password manager, encrypted note, or temporary text file). Once you leave this page, you cannot retrieve the token again. You must create a new one if you lose it.

You now have a token ready to use in the Retro Panel configuration.

---

## Installation Method A: Local Add-on (Recommended)

Local installation is recommended for development, testing, and single-instance setups. It allows you to modify the add-on code directly and is the fastest way to get started.

### Prerequisites for local installation:

- SSH access to the HA host, or Samba network access to browse `/addons/`
- The Retro Panel source code (available in `retro-panel/` folder)

### Installation steps:

#### Step 1: Connect to the HA host

**Via SSH** (Linux/Mac command line or Windows PowerShell):
```bash
ssh root@192.168.1.10
# Replace 192.168.1.10 with your HA instance IP
# Default password is "root" unless changed
```

**Via Samba** (Windows File Explorer or Mac Finder):
- Open a file browser
- Navigate to `\\192.168.1.10\addons` (Windows) or `smb://192.168.1.10/addons` (Mac)
- Log in if prompted (default username: root, no password for local network)

#### Step 2: Navigate to the add-ons directory

If connected via SSH:
```bash
cd /addons/
```

If using Samba, you are already in the `/addons/` directory.

> If the `/addons/` directory does not exist, create it:
> ```bash
> mkdir -p /addons/
> ```

#### Step 3: Copy the Retro Panel folder

Copy the entire `retro-panel/` folder into `/addons/`.

**Via SSH** (from your local machine):
```bash
scp -r retro-panel/ root@192.168.1.10:/addons/
```

**Via Samba**: Drag and drop the `retro-panel/` folder into the `\\192.168.1.10\addons` location.

After copying, the directory structure should look like:
```
/addons/
├── retro-panel/
│   ├── Dockerfile
│   ├── config.yaml
│   ├── build.yaml
│   ├── rootfs/
│   ├── app/
│   └── translations/
```

#### Step 4: Reload the Add-on Store in Home Assistant

1. Open Home Assistant in your web browser.
2. Go to **Settings** (gear icon in the bottom left).
3. Navigate to **Add-ons & Automations → Add-ons**.
4. In the top right corner, click the **⋮ (three dots)** menu.
5. Select **Reload** or **Check for updates**.

Home Assistant will scan the `/addons/` directory and register the new add-on.

#### Step 5: Install the add-on

1. In the Add-ons store, look for a **"Local add-ons"** section at the top (or search for "Retro Panel").
2. Click on **Retro Panel**.
3. Click the **Install** button.

> The first installation will take 2–5 minutes as Home Assistant builds the Docker image. Subsequent installations are faster (cached layers).

4. Wait for the installation to complete. You should see:
   ```
   Installation completed
   Retro Panel is installed
   ```

---

## Installation Method B: Custom Repository (Future)

When Retro Panel is published to GitHub as an official repository, you will be able to install it from a custom repository URL without copying files manually.

### Future steps (when available):

1. Go to **Settings → Add-ons & Automations → Add-ons**.
2. Click the **⋮ (three dots)** menu and select **Repositories**.
3. Add the Retro Panel repository URL:
   ```
   https://github.com/your-org/retro-panel-ha
   ```
4. Click **Add**.
5. The repository will appear in the Add-on Store.
6. Click **Retro Panel** and then **Install**.

This method provides automatic updates and is recommended for production deployments.

---

## First-Time Configuration

After installation, you must configure the add-on before it can connect to Home Assistant.

### Accessing the configuration panel:

1. In Home Assistant, go to **Settings → Add-ons & Automations → Add-ons**.
2. Click on **Retro Panel**.
3. Click the **Configuration** tab.

### Configuration fields (v2.0):

Fill in each field according to your setup:

#### `ha_url` (optional)
**Description**: The HTTP URL of your Home Assistant instance.

**Value to use**:
- Default: `http://homeassistant:8123`
- For local network access: Use the **local IP address** of your HA host
- Example: `http://192.168.1.10:8123`

> **Important**: Always use the HA Docker hostname (`homeassistant:8123`) or IP address. mDNS resolution can fail inside Docker containers.

#### `ha_token` (optional)
**Description**: The Long-Lived Access Token created in the [Getting a Long-Lived Access Token](#getting-a-long-lived-access-token) section.

**Value to use**: Paste the entire token string you copied earlier, OR leave empty to auto-detect from SUPERVISOR_TOKEN.

> The token starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` and is quite long (200+ characters).
> The add-on will automatically use the Supervisor token if this field is empty.

#### `panel_title` (optional)
**Description**: The title displayed at the top of the Retro Panel dashboard.

**Default**: `Home`

**Examples**:
- `Living Room`
- `Master Control`
- `Kitchen Panel`

#### `theme` (optional)
**Description**: The color scheme used for the interface.

**Default**: `dark`

**Available values**:
- `dark`: Dark background with light text (recommended for wall displays and bright environments)
- `light`: Light background with dark text
- `auto`: Follows the OS dark/light preference (`prefers-color-scheme`). On iOS, this reflects the system appearance set in Settings → Display & Brightness.

#### `refresh_interval` (optional)
**Description**: REST polling interval (seconds) as fallback when WebSocket is unavailable.

**Default**: `30`

**Range**: `5` to `300` seconds

**Recommendation**: `30` seconds is a good default. Reduce to `10` for faster updates, or increase to `60` for slower networks.

---

## Starting the Add-on

After configuration, you can start the add-on:

1. In the Retro Panel add-on page, click the **Start** button.
2. Wait for the add-on to start. You should see:
   ```
   Started
   Retro Panel is running
   ```
3. Check the **Logs** tab to verify startup:
   ```
   [INFO] Server running on http://0.0.0.0:7654
   [INFO] Connected to Home Assistant
   ```

> If you see any errors, check the Logs tab and the Troubleshooting section below.

---

## Accessing the Panel

After starting the add-on, you can access Retro Panel via two URLs:

### Dashboard (`/`)

**Read-only kiosk view** — displays your home automation entities in a clean grid.

- No settings visible in the sidebar
- Perfect for wall-mounted tablets and IoT devices
- Full-screen optimized

Access via:
1. In Home Assistant, go to **Settings → Add-ons & Automations → Add-ons**
2. Click on **Retro Panel**
3. Click **Open Web UI** (the link icon)
4. You should see the dashboard at `http://[HA-IP]:7654`

### Config UI (`/config`)

**Admin configuration interface** — manage entities, rooms, scenarios, and cameras.

- Full settings UI with 4 tabs: Overview, Rooms, Scenarios, Cameras
- Can edit and save configuration
- Password/token protected by HA Ingress

Access via:
- Direct link in browser: `http://[HA-IP]:7654/config`
- Or from the dashboard, click the ⚙ icon in the sidebar to navigate to config

---

## Kiosk Mode — Nascondere la UI di HA (opzionale)

Se usi Retro Panel su un tablet a muro e vuoi nascondere la barra laterale e l'header
di Home Assistant, usa [kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (installabile via HACS).

Una volta installato, aggiungi in `configuration.yaml`:

```yaml
kiosk_mode:
  template_settings:
    - template: "[[[ return location.href.includes('hassio/ingress'); ]]]"
      hide_sidebar: true
      hide_header: true
```

Questo attiva il kiosk solo sulla pagina ingress di Retro Panel (e di qualsiasi altro
add-on con ingress), lasciando la UI di HA normale sulle altre pagine.

> **Nota**: Per limitarlo al solo Retro Panel, sostituisci `hassio/ingress` con lo slug
> specifico dell'add-on (visibile nell'URL quando apri il pannello da HA).

---

## iPad and iOS 12+ Kiosk Setup

To launch Retro Panel full-screen on iPad (without Safari UI):

1. **Open Safari** and navigate to `http://[HA-IP]:7654`
2. **Tap the Share button** (bottom toolbar on iPad)
3. **Select "Add to Home Screen"**
4. **Name the shortcut** (e.g., "Retro Panel") and tap **Add**
5. **Close Safari** and open the new icon from your home screen

The panel will now launch full-screen with no browser UI, perfect for wall mounts.

---

## Troubleshooting

### Panel shows "Failed to load"

**Problem**: The add-on cannot load the dashboard.

**Solution**:
1. Check the **Logs** tab in the add-on page
2. Verify `ha_url` is correct (use `http://homeassistant:8123`, not HTTPS)
3. Verify `ha_token` is valid (check Home Assistant → Settings → Profile → Tokens)
4. Try restarting the add-on

### "Connection error" banner keeps appearing

**Problem**: WebSocket connection to HA keeps dropping.

**Solution**:
1. Check your network connection (WiFi signal strength)
2. Verify HA instance is reachable from the tablet
3. REST polling fallback should keep the panel working (checks every `refresh_interval` seconds)
4. Restart the add-on

### Entity states not updating

**Problem**: Tiles don't update when entities change in HA.

**Solution**:
1. Check browser console (F12 → Console) for errors
2. Verify WebSocket connection is established (Network tab → filter "ws://")
3. If WebSocket is disconnected, REST polling should update every `refresh_interval` seconds
4. Try refreshing the page

### Cannot access `/config` page

**Problem**: Settings/config page is inaccessible.

**Solution**:
1. Direct URL: `http://[HA-IP]:7654/config`
2. Make sure you're logged into Home Assistant (Ingress requires session token)
3. Try opening in an incognito/private window
4. Restart the add-on

### "Tiles not rendering" or blank page

**Problem**: Page loads but no entities are shown.

**Solution**:
1. Check if `panel_config.json` exists on the HA host
2. Go to **Config → Overview** and add entities manually
3. Check browser console (F12 → Console) for JavaScript errors
4. Clear browser cache and refresh

---

## Updating the Add-on

### To update from v1.x to v2.0:

1. **Backup configuration**: Download `data/panel_config.json` from HA before updating
2. **Stop the add-on**: Click Stop in the add-on page
3. **Replace the add-on folder**: Copy new v2.0 code to `/addons/retro-panel/`
4. **Reload Add-ons**: In HA, Settings → Add-ons → ⋮ menu → Reload
5. **Click Update** (if available) or **Reinstall**
6. **Configure** any new v2.0 options (if present)
7. **Start** the add-on

> Configuration files are automatically migrated from v1.x to v2.0 format on first load.

---

**Document Version**: 2.0
**Last Updated**: 2026-03-27
