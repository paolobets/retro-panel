# Retro Panel Installation Guide

This guide walks you through installing and configuring Retro Panel, a touch-optimized Home Assistant add-on for kiosk displays and wall-mounted tablets.

**Document version**: 1.0
**Last updated**: March 2026

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting a Long-Lived Access Token](#getting-a-long-lived-access-token)
3. [Installation Method A: Local Add-on (Recommended)](#installation-method-a-local-add-on-recommended)
4. [Installation Method B: Custom Repository (Future)](#installation-method-b-custom-repository-future)
5. [First-Time Configuration](#first-time-configuration)
6. [Entity Configuration Examples](#entity-configuration-examples)
7. [Starting the Add-on](#starting-the-add-on)
8. [Accessing the Panel](#accessing-the-panel)
9. [iPad and iOS 15 Kiosk Setup](#ipad-and-ios-15-kiosk-setup)
10. [Troubleshooting](#troubleshooting)
11. [Updating the Add-on](#updating-the-add-on)
12. [Uninstalling](#uninstalling)

---

## Prerequisites

Before you begin, verify that your Home Assistant setup meets these requirements:

- **Home Assistant OS or Supervised**: Retro Panel is a Home Assistant Add-on and requires HA Supervisor to be running. Home Assistant Core (standalone) is not supported.
- **Minimum version**: Home Assistant 2023.x or later
- **Docker**: Supervisor manages Docker containers automatically; no manual Docker installation required
- **Network access**: The tablet must be on the same network as your Home Assistant instance and able to reach its IP address
- **Browser**: iOS 15+ Safari, or any modern browser on Android
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

> **Screenshot description** (if using this guide with images): At this stage, you should see a light gray or white text box containing the full token string, a copy icon next to it, and a note saying "This token is displayed only once."

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

### Configuration fields:

Fill in each field according to your setup:

#### `ha_url` (required)
**Description**: The HTTP URL of your Home Assistant instance.

**Value to use**:
- For local network access: Use the **local IP address** of your HA host, NOT the hostname `homeassistant.local`
- Example: `http://192.168.1.10:8123`
- Example: `http://10.0.0.50:8123`

> **Important**: mDNS resolution (hostname) can fail inside Docker containers. Always use the IP address. You can find your HA IP by going to **Settings → System → Network** and looking for the IPv4 address.

> **Do not use**: `https://`, `homeassistant.local`, or external URLs (they won't work from inside the Docker container)

#### `ha_token` (required)
**Description**: The Long-Lived Access Token created in the [Getting a Long-Lived Access Token](#getting-a-long-lived-access-token) section.

**Value to use**: Paste the entire token string you copied earlier.

> The token starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` and is quite long (200+ characters).

#### `panel_title` (optional)
**Description**: The title displayed at the top of the Retro Panel dashboard.

**Default**: `Home`

**Examples**:
- `Living Room`
- `Master Control`
- `Kitchen Panel`

#### `columns` (optional)
**Description**: The number of columns in the grid layout.

**Default**: `3`

**Available values**: `2`, `3`, or `4`

**Recommendation**:
- Use `3` for iPad in portrait mode
- Use `4` for iPad in landscape mode or large screens
- Use `2` for small phones or very limited space

#### `theme` (optional)
**Description**: The color scheme used for the interface.

**Default**: `dark`

**Available values**:
- `dark`: Dark background with light text (recommended for wall displays and bright environments)
- `light`: Light background with dark text
- `auto`: Automatically switches based on device's system settings (iOS/Android)

#### `kiosk_mode` (optional)
**Description**: When enabled, prevents accidental text selection and interaction with browser controls.

**Default**: `true`

**Recommendation**: Keep this enabled (`true`) if the panel is on a permanently mounted display. Disable it (`false`) if you need to copy text or debug.

#### `refresh_interval` (optional)
**Description**: How often the panel checks for state updates when WebSocket is unavailable (in seconds).

**Default**: `30`

**Valid range**: `5` to `300` seconds

**Recommendation**: Leave at `30`. The panel primarily uses WebSocket for real-time updates; this is only a fallback.

#### `entities` (required)
**Description**: The list of Home Assistant entities to display on the panel.

This is covered in detail in the [Entity Configuration Examples](#entity-configuration-examples) section below. For now, you can leave it empty `[]` or add a few test entities.

### Example configuration:

```yaml
ha_url: "http://192.168.1.10:8123"
ha_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmMjBjMDI5ZDQ1OWE0MWFmOTIzM2YzOTkzN2M0ZmFlYSIsImlhdCI6MTczMzQxNTAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.kVqJHGplaBzHY..."
panel_title: "Home"
columns: 3
theme: "dark"
kiosk_mode: true
refresh_interval: 30
entities: []
```

After filling in these fields, click **Save** at the bottom of the page.

---

## Entity Configuration Examples

Entities are the individual Home Assistant devices and sensors you want to display on the Retro Panel. Each entity appears as a tile or control on the dashboard.

### Supported entity types:

- **`light.*`**: Light bulbs and switches
- **`switch.*`**: Binary switches
- **`alarm_control_panel.*`**: Home alarm systems
- **`sensor.*`**: Temperature, humidity, air quality, etc.
- **`binary_sensor.*`**: Door/window sensors, motion detectors, etc.

### Configuration schema:

Each entity requires:
- **`entity_id`** (required): The full entity identifier in Home Assistant (e.g., `light.living_room`)
- **`label`** (required): A human-readable name displayed on the tile
- **`icon`** (optional): A Material Design Icon (MDI) name for the tile visual

Optional positioning (if not specified, tiles stack automatically):
- **`row`** (optional): Grid row position (1-based)
- **`col`** (optional): Grid column position (1-based)

### Finding your entity IDs:

To find the entity IDs of your devices:

1. Go to **Settings → Devices & Services → Entities** in Home Assistant.
2. Search for the device (e.g., "Living Room Light").
3. Click on the entity.
4. Copy the entity ID from the URL bar or the entity details page.
   - Example: The entity ID appears as `light.living_room_light` or similar.

Alternatively, in **Settings → Developer Tools → States**, you can browse all entity IDs with their current states.

### Example configurations:

#### Light control:
```yaml
- entity_id: light.living_room
  label: Living Room
  icon: bulb
```

#### Switch control:
```yaml
- entity_id: switch.tv_power
  label: TV
  icon: toggle
```

#### Alarm system:
```yaml
- entity_id: alarm_control_panel.home
  label: Alarm
  icon: shield
```

#### Temperature sensor:
```yaml
- entity_id: sensor.living_room_temperature
  label: Temperature
  icon: thermometer
```

#### Door/window sensor:
```yaml
- entity_id: binary_sensor.front_door
  label: Front Door
  icon: door
```

#### Motion detector:
```yaml
- entity_id: binary_sensor.living_room_motion
  label: Motion
  icon: motion-sensor
```

#### Humidity sensor:
```yaml
- entity_id: sensor.living_room_humidity
  label: Humidity
  icon: water-percent
```

### Complete example configuration:

Add this to the `entities` field in the Retro Panel configuration:

```yaml
entities:
  - entity_id: light.living_room
    label: Living Room
    icon: bulb
  - entity_id: light.kitchen
    label: Kitchen
    icon: bulb
  - entity_id: light.bedroom
    label: Bedroom
    icon: lightbulb-night
  - entity_id: switch.tv_power
    label: TV
    icon: television
  - entity_id: switch.coffee_maker
    label: Coffee Maker
    icon: coffee
  - entity_id: alarm_control_panel.home
    label: Alarm
    icon: shield
  - entity_id: sensor.living_room_temperature
    label: Living Room Temp
    icon: thermometer
  - entity_id: sensor.kitchen_temperature
    label: Kitchen Temp
    icon: thermometer
  - entity_id: binary_sensor.front_door
    label: Front Door
    icon: door
  - entity_id: binary_sensor.back_door
    label: Back Door
    icon: door
  - entity_id: binary_sensor.living_room_motion
    label: Motion Detected
    icon: motion-sensor
```

### Common Material Design Icons (MDI):

If you do not specify an icon, Retro Panel uses a sensible default. Here are popular icons:

- `bulb` - Light bulb
- `lightbulb-night` - Night light
- `toggle` - Generic switch
- `television` - TV
- `coffee` - Coffee maker
- `shield` - Alarm/security
- `thermometer` - Temperature sensor
- `water-percent` - Humidity
- `door` - Door
- `motion-sensor` - Motion detector
- `fan` - Fan
- `air-conditioner` - AC unit
- `music` - Speaker/audio
- `power-plug` - Power outlet

For a complete list, visit [materialdesignicons.com](https://materialdesignicons.com).

---

## Starting the Add-on

Once configuration is complete, start the add-on:

1. In Home Assistant, go to **Settings → Add-ons & Automations → Add-ons**.
2. Click on **Retro Panel**.
3. Click the **Start** button.

The button will change to "Stop" and the status should show "Running" within a few seconds.

### Checking the startup logs:

To verify the add-on started successfully:

1. While viewing the Retro Panel add-on page, click the **Logs** tab.
2. You should see output similar to:
   ```
   [INFO] Starting Retro Panel...
   [INFO] Connecting to HA at http://192.168.1.10:8123
   [INFO] Retro Panel listening on http://0.0.0.0:7654
   ```

> The presence of "Retro Panel listening on http://0.0.0.0:7654" confirms the server started successfully.

### Common startup errors and fixes:

#### Error: "Failed to connect to HA at [URL]"
- **Cause**: The `ha_url` is incorrect or unreachable
- **Fix**:
  - Use the IP address instead of hostname: `http://192.168.1.10:8123`
  - Verify the IP address by going to **Settings → System → Network**
  - Ensure the port is `8123` (not `8125` or `443`)

#### Error: "Invalid token"
- **Cause**: The `ha_token` is incorrect or expired
- **Fix**:
  - Verify you copied the entire token without truncation
  - Create a new token in Home Assistant (the old one may have been revoked)
  - Paste the new token and save the configuration

#### Error: "Failed to build Docker image"
- **Cause**: Insufficient disk space or Docker daemon issue
- **Fix**:
  - Check disk space: `df -h /` (aim for >500 MB free)
  - Restart the HA host: **Settings → System → Restart Home Assistant**
  - Check HA logs for Docker errors: **Settings → System → Logs**

---

## Accessing the Panel

Retro Panel integrates with Home Assistant via **Ingress**, which means it appears directly in the HA sidebar and is accessed through the HA authentication system.

### Via Home Assistant Sidebar (Recommended):

1. In Home Assistant, you should see **"Retro Panel"** in the left sidebar (it may take a few seconds to appear after starting the add-on).
2. Click on **"Retro Panel"** to open the panel.
3. The dashboard will load with your configured entities.

> If "Retro Panel" does not appear in the sidebar, reload the page or restart Home Assistant.

### Via Direct URL (Advanced):

For advanced setups or debugging, you can access the add-on directly:

```
http://<HA-IP>:7654
```

**Example**: `http://192.168.1.10:7654`

> **Important**: Direct port access (`:7654`) bypasses Home Assistant authentication. This port is **not exposed** by default and is only accessible from within the local network. For security and reliability, use the Ingress method (sidebar link) instead.

### Kiosk use (tablets / always-on displays):

For a wall-mounted tablet or kiosk display:

1. Open Home Assistant in the tablet's browser (Safari on iPad, Chrome on Android)
2. Log in with your Home Assistant account
3. Click **"Retro Panel"** in the sidebar
4. The Retro Panel dashboard will load

To make it full-screen and easy to access, see the [iPad and iOS 15 Kiosk Setup](#ipad-and-ios-15-kiosk-setup) section below.

---

## iPad and iOS 15 Kiosk Setup

To turn your iPad into a permanent home control panel, follow these steps to create a full-screen web app and optionally lock it to Retro Panel using Guided Access.

### Prerequisites:

- iPad or iPhone running iOS 15 or later
- Home Assistant accessible on the local network
- Retro Panel installed and running (see above sections)

### Creating a full-screen app:

#### Step 1: Open Home Assistant in Safari

1. Open **Safari** on your iPad
2. Navigate to your Home Assistant URL:
   ```
   http://192.168.1.10:8123
   ```
   (Replace `192.168.1.10` with your HA instance IP)

3. Log in with your Home Assistant account

#### Step 2: Navigate to Retro Panel

1. In the Home Assistant sidebar (left panel), click **"Retro Panel"**
2. Wait for the dashboard to load completely (entities should be visible)

#### Step 3: Add to Home Screen

1. Tap the **Share** button (↑ icon in the bottom toolbar of Safari)
2. Select **"Add to Home Screen"**
3. A dialog will appear with options:
   - **Name**: Replace the default with a memorable name (e.g., "Home Panel")
   - **URL**: Should show your Retro Panel URL (leave as-is)
4. Tap **"Add"** in the top-right corner
5. The icon will be added to your iPad home screen

#### Step 4: Launch from Home Screen

- Close Safari
- Go to your iPad home screen and find the new icon named "Home Panel" (or whatever you called it)
- Tap the icon
- The app will open in full-screen mode, hiding the Safari address bar and controls

> The app will reload and authenticate using the session you already logged into. If it asks for credentials, ensure you are still logged into Home Assistant.

### Optional: Lock to Retro Panel with Guided Access

**Guided Access** locks the iPad to a single app and disables gesture shortcuts, perfect for wall-mounted displays.

#### Step 1: Enable Guided Access in Settings

1. Open iPad **Settings**
2. Go to **Screen Time** (or **Accessibility** on older iOS)
3. Tap **Guided Access** (under **Accessibility → General**)
4. Toggle **Guided Access** to **On**
5. Set a passcode (used to exit Guided Access)

#### Step 2: Start Guided Access

1. Open the Retro Panel app on your home screen
2. While the app is active, press and hold the **Side button** (or **Home button** on older models) until you see the **Guided Access** menu
3. Tap **Guided Access** in the menu
4. The screen will dim and show options:
   - Tap **"Options"** to disable gestures (optional, but recommended)
   - Tap **"Start"** to begin Guided Access
5. The app will now run full-screen indefinitely

#### Step 3: Exit Guided Access

To exit Guided Access (requires the passcode you set):
1. Swipe up from the bottom with two fingers
2. Enter your passcode
3. Tap **"End"**

### Tips for wall-mounted tablets:

- **Screen timeout**: Go to iPad **Settings → Display & Brightness → Auto-Lock** and set to **Never** (requires device to be plugged in)
- **Rotation lock**: Disable rotation lock so the panel respects the mounting orientation
- **Face ID / Touch ID**: Disable on the lock screen for a true kiosk experience
- **App auto-refresh**: The panel will automatically reconnect if the network drops

---

## Troubleshooting

This section covers common issues and their solutions.

### Panel shows "Failed to load"

**Symptoms**: The dashboard shows an error message instead of entities.

**Likely causes**:
- Incorrect `ha_url` (using hostname instead of IP, or wrong IP)
- Wrong `ha_token` (typo, expired, or truncated)
- Home Assistant not running or unreachable from the add-on's network

**Solutions**:
1. Double-check the `ha_url` in the Retro Panel configuration:
   - Use the IP address, not `homeassistant.local`
   - Verify the IP by going to **Settings → System → Network** in HA
   - Ensure the URL is `http://` (not `https://`)
   - Ensure the port is `8123` (not `8080` or `443`)
2. Verify the `ha_token`:
   - Go to your HA profile and check that the token still exists (hasn't been deleted)
   - If unsure, create a new token and update the Retro Panel configuration
3. Restart the Retro Panel add-on:
   - Click **Stop**, wait 5 seconds, then click **Start**
4. Check the add-on logs:
   - Go to **Logs** tab and look for error messages about the connection

### Panel shows "Reconnecting..." or continuous loading

**Symptoms**: The dashboard loads but shows "Reconnecting..." or stays blank, then refreshes repeatedly.

**Likely causes**:
- WebSocket connection failure between the add-on and Home Assistant
- Network/firewall blocking the connection
- Home Assistant crashing or not responding

**Solutions**:
1. Check network connectivity:
   - Ping the HA IP from the device running the panel: `ping 192.168.1.10`
   - If no response, the device is not on the network or the network is down
2. Restart Home Assistant:
   - Go to **Settings → System → Restart Home Assistant**
3. Check HA logs:
   - Go to **Settings → System → Logs** and look for errors related to WebSocket or the add-on
4. Restart the Retro Panel add-on:
   - Click **Stop**, wait 5 seconds, then click **Start**
5. Check if there are any firewall rules blocking the connection:
   - If using a host-level firewall, ensure port `7654` is allowed (or use Ingress instead)

### Entities show "Unavailable"

**Symptoms**: Entity tiles appear on the panel but show "Unavailable" or do not respond to clicks.

**Likely causes**:
- Typo in the `entity_id` (wrong name or domain)
- The entity does not exist in Home Assistant
- The entity is actually unavailable in HA (device disconnected, etc.)

**Solutions**:
1. Verify the entity exists:
   - Go to **Settings → Devices & Services → Entities** in HA
   - Search for the entity by name
   - Copy the exact entity ID (case-sensitive, with domain prefix like `light.`, `switch.`, etc.)
2. Update the Retro Panel configuration:
   - Fix any typos in the `entity_id`
   - Ensure the domain is correct (e.g., `light.` not `lights.`)
3. Check the entity status in HA:
   - Click on the entity in **Entities** to see its current state
   - If it shows "Unavailable", the physical device may be offline or the integration is broken
4. Reload the Retro Panel:
   - Add-on → **Restart**

### Build fails with "Insufficient space"

**Symptoms**: Installation fails with a Docker error about disk space.

**Cause**: The HA host has less than 500 MB free disk space.

**Solutions**:
1. Check available disk space:
   - Via SSH: `df -h /`
   - Look for the root partition (`/`) with at least 500 MB free
2. Free up space:
   - Delete unused add-ons: **Settings → Add-ons** → click add-on → **Uninstall**
   - Clear the Docker cache:
     ```bash
     docker system prune -a --volumes
     ```
   - Remove old backups if stored on the HA host
3. Retry the installation

### White/blank screen on iOS Safari

**Symptoms**: The Retro Panel app opens but the screen is white or blank.

**Likely causes**:
- JavaScript error in the browser
- The app was added to home screen before full configuration
- iOS caching an old version

**Solutions**:
1. Check the browser console for errors:
   - Open the Retro Panel in Safari (not the home screen app)
   - Press **Ctrl+Alt+I** to open Developer Console
   - Look for any error messages in red
   - Take a screenshot and check the [Retro Panel GitHub Issues](https://github.com/your-org/retro-panel-ha/issues)
2. Clear Safari cache:
   - Go to iPad **Settings → Safari → Clear History and Website Data**
3. Remove the home screen icon and re-add it:
   - Long-press the icon and select **Remove**
   - Follow the [iPad and iOS 15 Kiosk Setup](#ipad-and-ios-15-kiosk-setup) section again
4. Ensure the Retro Panel add-on is running:
   - Go to **Settings → Add-ons → Retro Panel** and verify the status is **Running**

### Can't find add-on after reload

**Symptoms**: After copying the add-on to `/addons/` and reloading, it doesn't appear in the Add-on Store.

**Likely causes**:
- Reload command didn't work
- Folder structure is incorrect
- HA needs a full restart

**Solutions**:
1. Verify the folder structure:
   - Via SSH: `ls -la /addons/retro_panel/`
   - You should see `Dockerfile`, `config.yaml`, `build.yaml`, etc.
2. Try reloading again:
   - **Settings → Add-ons → ⋮ menu → Reload**
3. Restart Home Assistant:
   - **Settings → System → Restart Home Assistant**
4. Check the HA logs:
   - **Settings → System → Logs**
   - Look for errors containing "retro_panel" or "addon"

### Cannot click entities or controls don't work

**Symptoms**: Entity tiles are visible but tapping them doesn't turn lights on/off or control devices.

**Likely causes**:
- HA token lacks permissions
- Network latency or connection issue
- Device/entity actually doesn't support control (read-only sensor)

**Solutions**:
1. Verify the entity supports control:
   - Read-only entities (sensors, binary sensors showing door state) cannot be controlled
   - Only lights, switches, and alarm panels can be controlled
2. Check HA logs for permission errors:
   - **Settings → System → Logs**
   - Look for "Unauthorized" or "Permission denied"
3. Verify the token has full permissions:
   - Go to your HA profile and check the token was created correctly
   - Tokens with restricted permissions may not allow service calls
4. Test the connection:
   - Try a different entity (e.g., a different light)
   - If other entities work, the issue is with that specific entity

---

## Updating the Add-on

When a new version of Retro Panel is released, you can update it.

### For local installations:

1. Pull the latest code from your source repository:
   ```bash
   cd ~/retro-panel
   git pull origin main
   ```
   (Or download the latest version manually)

2. Copy the updated files to `/addons/retro_panel/`:
   ```bash
   scp -r ~/retro-panel/* root@192.168.1.10:/addons/retro_panel/
   ```

3. In Home Assistant, go to **Settings → Add-ons → Retro Panel**

4. Click **Restart** (not "Reinstall" — this keeps your configuration)

5. Wait for the restart to complete and check the **Logs** to confirm it started successfully

### For custom repository installations (future):

When Retro Panel is published to a GitHub repository, you can update directly:

1. Go to **Settings → Add-ons → Retro Panel**
2. Click the **⟳ (update)** button if an update is available
3. Click **Update** and wait for the process to complete

Your configuration is preserved during updates.

---

## Uninstalling

To remove Retro Panel from your Home Assistant instance:

### Step 1: Stop and uninstall the add-on

1. Go to **Settings → Add-ons & Automations → Add-ons**
2. Click on **Retro Panel**
3. Click the **Uninstall** button
4. Confirm the uninstallation

### Step 2: Remove the local add-on folder (if using local installation)

If you installed using Method A, remove the folder manually:

**Via SSH**:
```bash
rm -rf /addons/retro_panel/
```

**Via Samba**: Delete the `retro_panel/` folder from `\\192.168.1.10\addons\`

### Step 3: Remove the home screen icon (if you added it to iPad)

1. Long-press the Retro Panel icon on your iPad home screen
2. Select **"Remove App"**
3. Confirm removal

Retro Panel is now completely uninstalled. You can remove the Long-Lived Access Token from your HA profile for added security.

---

## Additional Resources

- **Architecture & Design**: See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed information about how Retro Panel works
- **API Reference**: See [API.md](../docs/API.md) for WebSocket protocol and endpoint documentation
- **Development Guide**: See [DEVELOPMENT.md](DEVELOPMENT.md) if you want to extend or customize Retro Panel
- **Home Assistant Documentation**: [home-assistant.io](https://home-assistant.io)
- **Material Design Icons**: [materialdesignicons.com](https://materialdesignicons.com)

---

## Support

If you encounter issues not covered in this guide:

1. Check the **Logs** tab in the add-on page for error messages
2. Search existing [GitHub issues](https://github.com/your-org/retro-panel-ha/issues)
3. Create a new issue with:
   - Your Home Assistant version
   - Retro Panel version
   - The error message from the logs
   - Steps to reproduce the issue

---

**Last updated**: March 2026
**Version**: 1.0
**Retro Panel version**: 1.0.0
