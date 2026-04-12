(function (window) {
  'use strict';

  // ── Constants ──

  var MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var DAYS_IT = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
  var DAYS_FULL = ['Luned\u00ec','Marted\u00ec','Mercoled\u00ec','Gioved\u00ec',
                   'Venerd\u00ec','Sabato','Domenica'];
  var DEFAULT_COLORS = ['#4a9eff','#4caf50','#ff9800','#e91e63',
                        '#9c27b0','#00bcd4','#ff5722','#607d8b'];

  // ── Helpers ──

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  function getDow(date) {
    var d = date.getDay();
    return d === 0 ? 6 : d - 1;
  }

  function _el(tag, cls, innerHTML) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (innerHTML !== undefined) e.innerHTML = innerHTML;
    return e;
  }

  function getCalColor(calendars, entityId) {
    for (var i = 0; i < calendars.length; i++) {
      if (calendars[i].entity_id === entityId) {
        return calendars[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      }
    }
    return '#888';
  }

  function getCalName(calendars, entityId) {
    for (var i = 0; i < calendars.length; i++) {
      if (calendars[i].entity_id === entityId) {
        return calendars[i].label || (entityId.split('.')[1]) || entityId;
      }
    }
    return entityId;
  }

  function normalizeEvent(haEvent, calEntityId) {
    var start = haEvent.start || {};
    var end = haEvent.end || {};
    var allDay = !!start.date;
    var startDT = start.dateTime || start.date || '';
    var endDT = end.dateTime || end.date || '';
    var dateMatch = startDT.match(/^(\d{4}-\d{2}-\d{2})/);
    var startDate = dateMatch ? dateMatch[1] : '';
    var startTime = '00:00';
    var endTime = '23:59';
    if (!allDay) {
      var stMatch = startDT.match(/T(\d{2}:\d{2})/);
      var etMatch = endDT.match(/T(\d{2}:\d{2})/);
      if (stMatch) startTime = stMatch[1];
      if (etMatch) endTime = etMatch[1];
    }
    return {
      cal: calEntityId,
      title: haEvent.summary || '',
      date: startDate,
      start: startTime,
      end: endTime,
      allDay: allDay
    };
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  // ── State ──

  var State = {
    year: 0,
    month: 0,
    today: null,
    selectedDay: null,
    isPanelOpen: false,
    calendars: [],
    selectedCalIds: [],
    root: null,
    monthEl: null,
    panelEl: null
  };

  State.reset = function (calendars) {
    var now = new Date();
    State.year = now.getFullYear();
    State.month = now.getMonth();
    State.today = now;
    State.selectedDay = null;
    State.isPanelOpen = false;
    State.calendars = calendars || [];
    State.selectedCalIds = [];
    for (var i = 0; i < State.calendars.length; i++) {
      State.selectedCalIds.push(State.calendars[i].entity_id);
    }
    State.root = null;
    State.monthEl = null;
    State.panelEl = null;
  };

  // ── DataLayer ──

  var DataLayer = {
    cache: {}
  };

  DataLayer.clear = function () {
    DataLayer.cache = {};
  };

  DataLayer.fetchMonth = function (entityIds, year, month, callback) {
    var startDate = new Date(year, month, 1);
    startDate.setDate(startDate.getDate() - 7);
    var endDate = new Date(year, month + 1, 0);
    endDate.setDate(endDate.getDate() + 7);
    var startISO = startDate.toISOString();
    var endISO = endDate.toISOString();
    var monthKey = year + '-' + pad(month + 1);

    var promises = [];
    var calIds = [];
    for (var i = 0; i < entityIds.length; i++) {
      var eid = entityIds[i];
      if (DataLayer.cache[eid] && DataLayer.cache[eid][monthKey]) continue;
      calIds.push(eid);
      promises.push(
        fetch('api/calendar-events/' + encodeURIComponent(eid) +
              '?start=' + encodeURIComponent(startISO) +
              '&end=' + encodeURIComponent(endISO))
          .then(function (r) { return r.ok ? r.json() : []; })
          ['catch'](function () { return []; })
      );
    }

    if (promises.length === 0) {
      callback();
      return;
    }

    Promise.all(promises).then(function (results) {
      for (var j = 0; j < results.length; j++) {
        var cid = calIds[j];
        if (!DataLayer.cache[cid]) DataLayer.cache[cid] = {};
        var normalized = [];
        var events = results[j] || [];
        for (var k = 0; k < events.length; k++) {
          normalized.push(normalizeEvent(events[k], cid));
        }
        DataLayer.cache[cid][monthKey] = normalized;
      }
      callback();
    })['catch'](function () {
      callback();
    });
  };

  DataLayer.getEventsForDay = function (year, month, day, selectedCalIds) {
    var dk = dateKey(year, month, day);
    var result = [];
    for (var i = 0; i < selectedCalIds.length; i++) {
      var cid = selectedCalIds[i];
      var monthKey = year + '-' + pad(month + 1);
      var events = (DataLayer.cache[cid] && DataLayer.cache[cid][monthKey]) || [];
      for (var j = 0; j < events.length; j++) {
        if (events[j].date === dk) result.push(events[j]);
      }
    }
    result.sort(function (a, b) {
      if (a.allDay && b.allDay) return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.start < b.start ? -1 : (a.start > b.start ? 1 : 0);
    });
    return result;
  };

  DataLayer.countEventsForCal = function (calEntityId, year, month) {
    var monthKey = year + '-' + pad(month + 1);
    var events = (DataLayer.cache[calEntityId] && DataLayer.cache[calEntityId][monthKey]) || [];
    var prefix = year + '-' + pad(month + 1) + '-';
    var count = 0;
    for (var i = 0; i < events.length; i++) {
      if (events[i].date.indexOf(prefix) === 0) count++;
    }
    return count;
  };

  // ── MonthRenderer ──

  var MonthRenderer = {};
  MonthRenderer._gridEl = null;

  MonthRenderer.build = function (container) {
    container.innerHTML = '';
    var weekdaysEl = _el('div', 'cal-weekdays');
    var html = '';
    for (var w = 0; w < 7; w++) {
      html += '<div class="cal-weekday' + (w >= 5 ? ' weekend' : '') + '">' + DAYS_IT[w] + '</div>';
    }
    weekdaysEl.innerHTML = html;
    container.appendChild(weekdaysEl);

    var gridEl = _el('div', 'cal-days');
    container.appendChild(gridEl);
    MonthRenderer._gridEl = gridEl;
    MonthRenderer.refreshCells();
  };

  MonthRenderer.refreshCells = function () {
    var gridEl = MonthRenderer._gridEl;
    if (!gridEl) return;
    var y = State.year;
    var m = State.month;
    var today = new Date();
    var isCurrentMonth = (today.getFullYear() === y && today.getMonth() === m);

    var firstDay = new Date(y, m, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var prevDays = new Date(y, m, 0).getDate();

    var html = '';
    for (var p = firstDay - 1; p >= 0; p--) {
      html += '<div class="cal-day-wrap"><div class="cal-day outside"><span class="cal-day-num">' + (prevDays - p) + '</span></div></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var events = DataLayer.getEventsForDay(y, m, d, State.selectedCalIds);
      var isToday = isCurrentMonth && today.getDate() === d;
      var isSel = State.selectedDay !== null && State.selectedDay.getDate() === d &&
                  State.selectedDay.getMonth() === m && State.selectedDay.getFullYear() === y;
      var date = new Date(y, m, d);
      var dow = getDow(date);
      var isWeekend = dow >= 5;
      var cls = 'cal-day';
      if (isToday) cls += ' today';
      if (isSel) cls += ' selected';
      if (events.length > 0) cls += ' has-events';
      if (isWeekend) cls += ' weekend-cell';

      html += '<div class="cal-day-wrap"><div class="' + cls + '" data-day="' + d + '">';
      html += '<span class="cal-day-num">' + d + '</span>';
      html += '<div class="cal-day-indicators">';
      if (events.length >= 1 && events.length <= 3) {
        for (var ei = 0; ei < events.length; ei++) {
          html += '<span class="cal-day-dot" style="background:' + getCalColor(State.calendars, events[ei].cal) + '"></span>';
        }
      } else if (events.length >= 4) {
        html += '<span class="cal-day-count">' + events.length + '</span>';
      }
      html += '</div></div></div>';
    }
    var totalCells = firstDay + daysInMonth;
    var remaining = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (var n = 1; n <= remaining; n++) {
      html += '<div class="cal-day-wrap"><div class="cal-day outside"><span class="cal-day-num">' + n + '</span></div></div>';
    }
    gridEl.innerHTML = html;
  };

  MonthRenderer.highlightSelected = function () {
    var gridEl = MonthRenderer._gridEl;
    if (!gridEl) return;
    var cells = gridEl.querySelectorAll('.cal-day:not(.outside)');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var day = parseInt(cell.getAttribute('data-day'));
      var isSel = State.selectedDay !== null && State.selectedDay.getDate() === day &&
                  State.selectedDay.getMonth() === State.month && State.selectedDay.getFullYear() === State.year;
      if (isSel) {
        if (cell.className.indexOf('selected') === -1) cell.className += ' selected';
      } else {
        cell.className = cell.className.replace(/ ?selected/g, '');
      }
    }
  };

  // ── PanelRenderer ──

  var PanelRenderer = {};
  PanelRenderer._dateEl = null;
  PanelRenderer._eventsEl = null;

  PanelRenderer.build = function (container) {
    container.innerHTML = '';
    var header = _el('div', 'cal-panel-header');
    PanelRenderer._dateEl = _el('span', 'cal-panel-date');
    var closeBtn = _el('button', 'cal-panel-close', '\u2715');
    closeBtn.addEventListener('click', function () {
      Controller.closePanel();
    }, false);
    header.appendChild(PanelRenderer._dateEl);
    header.appendChild(closeBtn);
    container.appendChild(header);

    PanelRenderer._eventsEl = _el('div', 'cal-panel-events');
    container.appendChild(PanelRenderer._eventsEl);
  };

  PanelRenderer.open = function (day, events) {
    State.root.className = 'cal-root cal-layout-split';
    PanelRenderer._render(day, events);
  };

  PanelRenderer.update = function (day, events) {
    PanelRenderer._render(day, events);
  };

  PanelRenderer.close = function () {
    State.root.className = 'cal-root';
  };

  PanelRenderer._render = function (day, events) {
    var dow = getDow(day);
    PanelRenderer._dateEl.textContent = DAYS_FULL[dow].substring(0, 3) + ' ' + day.getDate() + ' ' + MONTHS_IT[day.getMonth()];

    var el = PanelRenderer._eventsEl;
    if (events.length === 0) {
      el.innerHTML = '<div class="cal-panel-empty">' +
        '<span class="cal-panel-empty-icon">\uD83D\uDCC5</span>' +
        '<span class="cal-panel-empty-text">Nessun evento</span></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var color = getCalColor(State.calendars, ev.cal);
      html += '<div class="cal-event-card">';
      html += '<div class="cal-event-bar" style="background:' + color + '"></div>';
      html += '<div class="cal-event-body">';
      html += '<div class="cal-event-title">' + escapeHtml(ev.title) + '</div>';
      if (ev.allDay) {
        html += '<div class="cal-event-allday">Tutto il giorno</div>';
      } else {
        html += '<div class="cal-event-time">' + ev.start + ' \u2013 ' + ev.end + '</div>';
      }
      html += '<div class="cal-event-cal">' + escapeHtml(getCalName(State.calendars, ev.cal)) + '</div>';
      html += '</div></div>';
    }
    el.innerHTML = html;
  };

  // ── DropdownRenderer ──

  var DropdownRenderer = {};
  DropdownRenderer._menuEl = null;
  DropdownRenderer._btnEl = null;
  DropdownRenderer._dotsEl = null;
  DropdownRenderer._labelEl = null;
  DropdownRenderer._docHandler = null;

  DropdownRenderer.build = function (container, calendars) {
    var wrap = _el('div', 'cal-dropdown-wrap');
    var btn = _el('button', 'cal-dropdown-btn');
    DropdownRenderer._dotsEl = _el('span', 'cal-btn-dots');
    DropdownRenderer._labelEl = _el('span', '');
    var arrow = _el('span', 'cal-arrow', '\u25BE');
    btn.appendChild(DropdownRenderer._dotsEl);
    btn.appendChild(DropdownRenderer._labelEl);
    btn.appendChild(arrow);

    var menu = _el('div', 'cal-dropdown-menu');
    DropdownRenderer._menuEl = menu;
    DropdownRenderer._btnEl = btn;

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    container.appendChild(wrap);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = menu.className.indexOf('show') !== -1;
      if (isOpen) {
        DropdownRenderer._close();
      } else {
        menu.className = 'cal-dropdown-menu show';
        btn.className = 'cal-dropdown-btn open';
      }
    }, false);

    menu.addEventListener('click', function (e) {
      e.stopPropagation();
      var target = e.target;
      while (target && target !== menu) {
        if (target.className && target.className.indexOf('cal-dropdown-item') !== -1) break;
        target = target.parentNode;
      }
      if (!target || target === menu) return;
      var calId = target.getAttribute('data-cal');
      if (!calId) return;

      if (calId === '__all') {
        var allSelected = State.selectedCalIds.length === State.calendars.length;
        if (allSelected) return;
        State.selectedCalIds = [];
        for (var a = 0; a < State.calendars.length; a++) {
          State.selectedCalIds.push(State.calendars[a].entity_id);
        }
      } else {
        var idx = State.selectedCalIds.indexOf(calId);
        if (idx !== -1) {
          if (State.selectedCalIds.length <= 1) return;
          State.selectedCalIds.splice(idx, 1);
        } else {
          State.selectedCalIds.push(calId);
        }
      }
      Controller.onCalendarFilterChange();
    }, false);

    DropdownRenderer._docHandler = function () { DropdownRenderer._close(); };
    document.addEventListener('click', DropdownRenderer._docHandler, false);

    DropdownRenderer.refresh();
  };

  DropdownRenderer.refresh = function () {
    var menu = DropdownRenderer._menuEl;
    if (!menu) return;
    var cals = State.calendars;
    var html = '';
    for (var i = 0; i < cals.length; i++) {
      var c = cals[i];
      var sel = State.selectedCalIds.indexOf(c.entity_id) !== -1;
      var count = DataLayer.countEventsForCal(c.entity_id, State.year, State.month);
      var color = c.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      var name = c.label || (c.entity_id.split('.')[1]) || c.entity_id;
      html += '<div class="cal-dropdown-item' + (sel ? ' selected' : '') + '" data-cal="' + c.entity_id + '">';
      html += '<span class="cal-dot" style="background:' + color + '"></span>';
      html += '<span class="cal-item-name">' + escapeHtml(name) + '</span>';
      html += '<span class="cal-event-count">' + count + '</span>';
      if (sel) html += '<span class="cal-check">\u2713</span>';
      html += '</div>';
    }
    html += '<div class="cal-dropdown-item" data-cal="__all" style="border-top:1px solid #333;margin-top:4px;padding-top:12px;color:#4a9eff;">Seleziona tutti</div>';
    menu.innerHTML = html;

    var dotsHtml = '';
    var labelText = '';
    if (State.selectedCalIds.length === cals.length) {
      labelText = 'Tutti i calendari';
      for (var j = 0; j < cals.length; j++) {
        var jColor = cals[j].color || DEFAULT_COLORS[j % DEFAULT_COLORS.length];
        dotsHtml += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + jColor + ';margin-right:3px;"></span>';
      }
    } else if (State.selectedCalIds.length === 1) {
      for (var s = 0; s < cals.length; s++) {
        if (cals[s].entity_id === State.selectedCalIds[0]) {
          labelText = cals[s].label || (cals[s].entity_id.split('.')[1]) || cals[s].entity_id;
          var sColor = cals[s].color || DEFAULT_COLORS[s % DEFAULT_COLORS.length];
          dotsHtml = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + sColor + ';margin-right:3px;"></span>';
          break;
        }
      }
    } else {
      labelText = '';
      for (var k = 0; k < cals.length; k++) {
        if (State.selectedCalIds.indexOf(cals[k].entity_id) !== -1) {
          var kColor = cals[k].color || DEFAULT_COLORS[k % DEFAULT_COLORS.length];
          dotsHtml += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + kColor + ';margin-right:3px;"></span>';
        }
      }
    }
    DropdownRenderer._dotsEl.innerHTML = dotsHtml;
    DropdownRenderer._labelEl.textContent = labelText;
  };

  DropdownRenderer._close = function () {
    if (DropdownRenderer._menuEl) DropdownRenderer._menuEl.className = 'cal-dropdown-menu';
    if (DropdownRenderer._btnEl) DropdownRenderer._btnEl.className = 'cal-dropdown-btn';
  };

  DropdownRenderer.destroy = function () {
    if (DropdownRenderer._docHandler) {
      document.removeEventListener('click', DropdownRenderer._docHandler, false);
      DropdownRenderer._docHandler = null;
    }
  };

  // ── Controller ──

  var Controller = {};
  Controller._monthLabel = null;
  Controller._oggiBtn = null;
  Controller._navGen = 0;

  Controller.init = function (container, calendars, appState) {
    if (DropdownRenderer._docHandler) DropdownRenderer.destroy();
    DataLayer.clear();
    State.reset(calendars);

    container.innerHTML = '';
    var root = _el('div', 'cal-root');
    State.root = root;

    var header = _el('div', 'cal-row-month');
    var prevBtn = _el('div', 'cal-month-nav', '\u25C0');
    Controller._monthLabel = _el('div', 'cal-month-label');
    var nextBtn = _el('div', 'cal-month-nav', '\u25B6');
    Controller._oggiBtn = _el('div', 'cal-btn-oggi', 'Oggi');

    header.appendChild(prevBtn);
    header.appendChild(Controller._monthLabel);
    header.appendChild(nextBtn);
    header.appendChild(Controller._oggiBtn);
    root.appendChild(header);

    var controls = _el('div', 'cal-row-controls');
    DropdownRenderer.build(controls, calendars);
    root.appendChild(controls);

    var body = _el('div', 'cal-body');
    State.monthEl = _el('div', 'cal-month');
    State.panelEl = _el('div', 'cal-panel');
    body.appendChild(State.monthEl);
    body.appendChild(State.panelEl);
    root.appendChild(body);

    var dbg = _el('div', '', 'cal-build:rc15');
    dbg.style.cssText = 'position:fixed;bottom:4px;right:4px;font-size:9px;color:#555;z-index:9999;pointer-events:none;';
    root.appendChild(dbg);

    container.appendChild(root);

    PanelRenderer.build(State.panelEl);

    prevBtn.addEventListener('click', function () { Controller.onMonthNav(-1); }, false);
    nextBtn.addEventListener('click', function () { Controller.onMonthNav(1); }, false);
    Controller._oggiBtn.addEventListener('click', function () { Controller.onMonthNav(0); }, false);

    State.monthEl.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== State.monthEl) {
        if (target.className && target.className.indexOf('cal-day') !== -1 &&
            target.className.indexOf('outside') === -1 && target.getAttribute('data-day')) {
          break;
        }
        target = target.parentNode;
      }
      if (!target || target === State.monthEl) return;
      var day = parseInt(target.getAttribute('data-day'));
      Controller.onDayClick(day);
    }, false);

    Controller._updateMonthLabel();
    Controller._updateOggi();
    MonthRenderer.build(State.monthEl);
    var initGen = ++Controller._navGen;
    DataLayer.fetchMonth(State.selectedCalIds, State.year, State.month, function () {
      if (initGen !== Controller._navGen) return;
      MonthRenderer.refreshCells();
      DropdownRenderer.refresh();
    });
  };

  Controller.onDayClick = function (day) {
    var clickedDate = new Date(State.year, State.month, day);

    if (State.isPanelOpen && State.selectedDay !== null &&
        State.selectedDay.getTime() === clickedDate.getTime()) {
      Controller.closePanel();
      return;
    }

    var events = DataLayer.getEventsForDay(State.year, State.month, day, State.selectedCalIds);
    State.selectedDay = clickedDate;

    if (!State.isPanelOpen) {
      State.isPanelOpen = true;
      PanelRenderer.open(clickedDate, events);
    } else {
      PanelRenderer.update(clickedDate, events);
    }
    MonthRenderer.highlightSelected();
  };

  Controller.closePanel = function () {
    State.isPanelOpen = false;
    State.selectedDay = null;
    PanelRenderer.close();
    MonthRenderer.highlightSelected();
  };

  Controller.onMonthNav = function (direction) {
    if (direction === 0) {
      var now = new Date();
      State.year = now.getFullYear();
      State.month = now.getMonth();
    } else {
      State.month += direction;
      if (State.month > 11) { State.month = 0; State.year++; }
      if (State.month < 0) { State.month = 11; State.year--; }
    }

    if (State.isPanelOpen) Controller.closePanel();
    State.selectedDay = null;
    Controller._updateMonthLabel();
    Controller._updateOggi();
    MonthRenderer.build(State.monthEl);
    var gen = ++Controller._navGen;
    DataLayer.fetchMonth(State.selectedCalIds, State.year, State.month, function () {
      if (gen !== Controller._navGen) return;
      MonthRenderer.refreshCells();
      DropdownRenderer.refresh();
    });
  };

  Controller.onCalendarFilterChange = function () {
    MonthRenderer.refreshCells();
    DropdownRenderer.refresh();
    var gen = ++Controller._navGen;
    DataLayer.fetchMonth(State.selectedCalIds, State.year, State.month, function () {
      if (gen !== Controller._navGen) return;
      MonthRenderer.refreshCells();
      DropdownRenderer.refresh();
      if (State.isPanelOpen && State.selectedDay) {
        var events = DataLayer.getEventsForDay(
          State.selectedDay.getFullYear(), State.selectedDay.getMonth(),
          State.selectedDay.getDate(), State.selectedCalIds);
        PanelRenderer.update(State.selectedDay, events);
      }
    });
    if (State.isPanelOpen && State.selectedDay) {
      var events = DataLayer.getEventsForDay(
        State.selectedDay.getFullYear(), State.selectedDay.getMonth(),
        State.selectedDay.getDate(), State.selectedCalIds);
      PanelRenderer.update(State.selectedDay, events);
    }
  };

  Controller._updateMonthLabel = function () {
    if (Controller._monthLabel) {
      Controller._monthLabel.textContent = MONTHS_IT[State.month] + ' ' + State.year;
    }
  };

  Controller._updateOggi = function () {
    if (!Controller._oggiBtn) return;
    var now = new Date();
    var isCurrentMonth = (now.getFullYear() === State.year && now.getMonth() === State.month);
    Controller._oggiBtn.className = isCurrentMonth ? 'cal-btn-oggi on-today' : 'cal-btn-oggi';
  };

  Controller.destroy = function () {
    DropdownRenderer.destroy();
    DataLayer.clear();
    MonthRenderer._gridEl = null;
    PanelRenderer._dateEl = null;
    PanelRenderer._eventsEl = null;
    DropdownRenderer._menuEl = null;
    DropdownRenderer._btnEl = null;
    DropdownRenderer._dotsEl = null;
    DropdownRenderer._labelEl = null;
    Controller._monthLabel = null;
    Controller._oggiBtn = null;
    State.root = null;
    State.monthEl = null;
    State.panelEl = null;
  };

  // ── Public API ──

  window.CalendarComponent = {
    init: function (container, calendars, appState) {
      Controller.init(container, calendars, appState);
    },
    destroy: function () {
      Controller.destroy();
    }
  };

})(window);
