/**
 * conditional.js — Conditional Sensor tile component v2.9.26
 * Renders like a sensor row tile, but is visible only when all (AND) or
 * any (OR) configured conditions evaluate to true against live HA states.
 *
 * Visibility is driven by the full AppState.states map, so it reacts to
 * state changes on ANY entity, not just its own entity_id.
 *
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.SensorConditionalComponent = { createTile, updateTile }
 */
window.SensorConditionalComponent = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Condition evaluation                                                 */
  /* ------------------------------------------------------------------ */
  function _evalRule(rule, states) {
    var stateObj = states[rule.entity];
    if (!stateObj) { return false; }
    var rawState = String(stateObj.state || '');
    var ruleVal  = String(rule.value || '');
    var op = rule.op;

    var stateLC = rawState.toLowerCase();
    var valLC   = ruleVal.toLowerCase();
    if (op === 'eq')       { return stateLC === valLC; }
    if (op === 'neq')      { return stateLC !== valLC; }
    if (op === 'contains') { return stateLC.indexOf(valLC) !== -1; }

    /* Numeric comparisons */
    var numState = parseFloat(rawState);
    var numVal   = parseFloat(ruleVal);
    if (isNaN(numState) || isNaN(numVal)) { return false; }
    if (op === 'gt')  { return numState >  numVal; }
    if (op === 'lt')  { return numState <  numVal; }
    if (op === 'gte') { return numState >= numVal; }
    if (op === 'lte') { return numState <= numVal; }
    return false;
  }

  function _evalConditions(cfg, states) {
    var conditions = cfg.conditions;
    if (!conditions || conditions.length === 0) { return true; }
    var logic = cfg.condition_logic === 'or' ? 'or' : 'and';

    if (logic === 'or') {
      for (var i = 0; i < conditions.length; i++) {
        if (_evalRule(conditions[i], states)) { return true; }
      }
      return false;
    }
    /* AND logic (default) */
    for (var j = 0; j < conditions.length; j++) {
      if (!_evalRule(conditions[j], states)) { return false; }
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(cfg) {
    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var entity_id = cfg.entity_id;
    var label     = cfg.label || entity_id.replace('_', ' ').split('.').pop();
    var icon      = cfg.icon || '';

    /* wrapper col — display:none when condition false, no layout gap */
    var tile = DOM.createElement('div', 'tile tile-sensor tile-conditional');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'sensor_conditional';

    /* Store cfg on tile for use in updateTile */
    tile._conditionalCfg = cfg;

    /* custom border color from config */
    if (cfg.border_color) {
      tile.style.borderColor = cfg.border_color;
    }

    /* bubble (value) */
    var bubble = DOM.createElement('div', 'bubble');
    bubble.innerHTML = FMT.getIcon(icon, 20, entity_id);

    /* info: value + label */
    var info    = DOM.createElement('div', 'sensor-info');
    var valueEl = DOM.createElement('span', 'sensor-value', '—');
    var labelEl = DOM.createElement('span', 'sensor-label', label);
    info.appendChild(valueEl);
    info.appendChild(labelEl);

    tile.appendChild(bubble);
    tile.appendChild(info);

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile — receives full states map                               */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, states) {
    /* resolve cfg from DOM — stored at render time by renderer */
    /* The tile's parent col controls layout visibility */
    var col = tile.parentNode;

    /* Evaluate visibility */
    var entity_id = tile.dataset.entityId;
    /* Find cfg from conditionalTiles via a lightweight lookup on the tile itself */
    var cfg = tile._conditionalCfg;
    var visible = cfg ? _evalConditions(cfg, states) : true;

    if (col) {
      col.style.display = visible ? '' : 'none';
    }

    if (!visible) { return; }

    /* Update displayed value from tile's own entity */
    var stateObj = states[entity_id];
    var valueEl  = tile.querySelector('.sensor-value');
    if (!stateObj || !valueEl) { return; }

    var state  = stateObj.state;
    var attrs  = stateObj.attributes || {};
    var unit   = attrs.unit_of_measurement || '';

    if (state === 'unavailable' || state === 'unknown') {
      valueEl.textContent = state;
    } else if (unit) {
      valueEl.textContent = state + '\u00a0' + unit;
    } else {
      valueEl.textContent = state;
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
