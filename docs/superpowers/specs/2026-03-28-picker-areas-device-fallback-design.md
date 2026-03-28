# picker_areas Device-Level Area Fallback — Design Spec

## Overview

Fix `GET /api/picker/areas` so that switch (and other) entities assigned to a room
via their **device** (the normal HA pattern) are included in the import results.
Also replace the broken `test_handlers_areas.py` (tests a deleted module) with a
correct `test_picker_areas.py` that covers the new fallback behaviour.

---

## 1. Root Cause

In Home Assistant, most entities inherit their room assignment from their parent device.
The entity registry entry looks like:

```json
{ "entity_id": "switch.presa_tv", "device_id": "abc123", "area_id": null }
```

The area is on the device:
```json
{ "id": "abc123", "area_id": "soggiorno" }
```

`picker_areas.py` currently checks only `entry.get("area_id")` on the entity.
Because this field is `null`, the entity is silently discarded and never appears
in "Import from Area" results for the room.

---

## 2. Fix

### 2.1 `ha_client.py` — add `get_device_registry()`

New method using the same short-lived WebSocket pattern as `get_entity_registry()`.
HA WebSocket command: `config/device_registry/list`.
Use cmd_id `97` (below area=98, entity=99, WSProxy=1).

```python
async def get_device_registry(self) -> list[dict]:
    """Fetch device registry via HA WebSocket API (config/device_registry/list)."""
    ws = await self.ws_connect()
    cmd_id = 97
    try:
        await ws.send_json({"id": cmd_id, "type": "config/device_registry/list"})
        msg = await asyncio.wait_for(ws.receive_json(), timeout=15)
        if not msg.get("success"):
            raise ValueError(
                f"HA device registry list command failed: {msg.get('error')}"
            )
        return msg.get("result") or []
    except asyncio.TimeoutError as exc:
        raise TimeoutError("Device registry WebSocket request timed out") from exc
    finally:
        if not ws.closed:
            await ws.close()
```

### 2.2 `picker_areas.py` — fetch device registry + fallback

**Changes:**

1. Fetch device registry in parallel with entity registry (both non-fatal):

```python
device_registry: list[dict] = []
try:
    device_registry = await ha_client.get_device_registry()
except Exception as exc:
    logger.warning("Could not fetch device registry: %s — device-level area assignments ignored", exc)
```

2. Build `device_id → area_id` map:

```python
device_area_map: dict[str, str] = {}
for dev in device_registry:
    did = dev.get("id") or ""
    aid = dev.get("area_id") or ""
    if did and aid:
        device_area_map[did] = aid
```

3. Replace the `area_id` lookup with a fallback using an explicit `None` check
   (entity-level area takes strict precedence; avoids `or`-based empty-string ambiguity):

```python
# Before:
area_id = entry.get("area_id") or ""

# After:
entity_area = entry.get("area_id")
area_id = entity_area if entity_area is not None else device_area_map.get(entry.get("device_id") or "", "")
```

**Error handling:** if `get_device_registry()` fails (e.g. old HA version, network
issue), `device_area_map` stays empty and the behaviour is identical to before.
Non-fatal — only a warning is logged.

### 2.3 Dead test cleanup

`tests/test_handlers_areas.py` imports `api.handlers_areas` which no longer exists
(replaced by `picker_areas.py`). It must be **deleted**.

### 2.4 New `tests/test_picker_areas.py`

Tests for `picker_areas.get_picker_areas`. Covers all relevant scenarios.

Helper: build `aiohttp.web.Request` mock with `ha_client` providing:
- `get_area_registry()` → list of `{"area_id", "name"}` dicts
- `get_entity_registry()` → list of entity entries (with `entity_id`, `area_id`,
  `device_id`, `hidden_by`, `disabled_by`)
- `get_device_registry()` → list of device entries (with `id`, `area_id`)

Test cases:

| # | Name | What it verifies |
|---|------|-----------------|
| 1 | `test_entity_with_direct_area_id` | Entity with `area_id` set directly → included |
| 2 | `test_entity_area_via_device_fallback` | Entity `area_id=null`, device has area → included |
| 3 | `test_entity_no_area_anywhere_excluded` | Entity `area_id=null`, device has no area → excluded |
| 4 | `test_hidden_entity_excluded` | Entity `hidden_by` set → excluded even if in area |
| 5 | `test_disabled_entity_excluded` | Entity `disabled_by` set → excluded even if in area |
| 6 | `test_excluded_domain_filtered` | `input_boolean`, `media_player`, etc. → excluded |
| 7 | `test_device_registry_failure_graceful` | `get_device_registry()` raises → falls back gracefully, direct-area entities still shown |
| 8 | `test_entity_registry_failure_graceful` | `get_entity_registry()` raises → areas returned with empty `entity_ids` lists |
| 9 | `test_no_areas_returns_empty_list` | No areas → `[]` with 200 |
| 10 | `test_area_registry_failure_returns_502` | `get_area_registry()` raises → 502 |
| 11 | `test_entity_direct_area_overrides_device_area` | Entity `area_id="cucina"`, device `area_id="soggiorno"` → entity in cucina, not soggiorno |

---

## 3. Files Changed

| File | Change |
|---|---|
| `retro-panel/app/proxy/ha_client.py` | Add `get_device_registry()` method (cmd_id 97) |
| `retro-panel/app/api/picker_areas.py` | Fetch device registry, build map, fallback on entity `area_id` |
| `retro-panel/tests/test_handlers_areas.py` | **DELETE** — tests deleted module |
| `retro-panel/tests/test_picker_areas.py` | **CREATE** — 11 tests for `picker_areas` |

---

## 4. Constraints

- Python 3.11+, aiohttp, no new dependencies
- `get_device_registry()` failure must never cause `get_picker_areas()` to fail
- `device_area_map` must NOT override an entity's own `area_id` if it is set directly
  (entity-level area takes precedence over device-level — consistent with HA's own logic)
- Existing tests (`test_loader_v5.py`, `test_save_validation.py`) must still pass

---

## 5. Testing

Run:
```bash
cd retro-panel
py -m pytest tests/test_picker_areas.py tests/test_loader_v5.py tests/test_save_validation.py -v
```

Expected: all tests pass.
