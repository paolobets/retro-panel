/**
 * calendar.js — CalendarComponent for Retro Panel
 * Full IIFE, ES5 only. iOS 12 Safari safe.
 *
 * Month grid with event indicators, multi-calendar dropdown,
 * bottom sheet (peek/expand/close), Oggi button, swipe navigation.
 * Fetches events from /api/calendar-events/ per calendar entity.
 *
 * NO const/let/arrow functions/?./?? — only var, function declarations.
 * NO template literals — only string concatenation.
 *
 * Exposes globally: window.CalendarComponent = { init: init }
 */
window.CalendarComponent = (function () {
  'use strict';

  // ── State ──
  var _container = null;
  var _calendars = [];    // [{entity_id, label, color}] from config
  var _appState = null;
  var _currentYear = 0;
  var _currentMonth = 0;  // 0-indexed
  var _selectedDay = null;
  var _currentView = 'month';
  var _selectedCals = [];  // entity_ids of selected calendars
  var _eventsCache = {};   // key: 'entity_id:YYYY-MM' → [events]
  var _allEvents = [];     // merged events for current month from all selected calendars

  // ── DOM references (set in buildDOM) ──
  var _elPage = null;
  var _elMonthLabel = null;
  var _elPrevMonth = null;
  var _elNextMonth = null;
  var _elBtnOggi = null;
  var _elCalBtn = null;
  var _elCalBtnDots = null;
  var _elCalBtnLabel = null;
  var _elCalMenu = null;
  var _elViewBtns = [];
  var _elMonthView = null;
  var _elWeekdays = null;
  var _elDaysGrid = null;
  var _elWeekView = null;
  var _elDayView = null;
  var _elSheet = null;
  var _elOverlay = null;
  var _elSheetHandleWrap = null;
  var _elSheetTitle = null;
  var _elSheetCount = null;
  var _elSheetClose = null;
  var _elSheetBody = null;
  var _sheetState = 'closed';
  var _swipeStartX = 0;
  var _sheetStartY = 0;
  var _docClickHandler = null;
  var _docMouseupHandler = null;

  // ── Constants ──
  var MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var DAYS_IT = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
  var DAYS_FULL = ['Luned\u00ec','Marted\u00ec','Mercoled\u00ec','Gioved\u00ec','Venerd\u00ec','Sabato','Domenica'];
  var DEFAULT_COLORS = ['#4a9eff','#4caf50','#ff9800','#e91e63','#9c27b0','#00bcd4','#ff5722','#607d8b'];

  // ── Helpers ──

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateStr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  function getCalColor(entityId) {
    for (var i = 0; i < _calendars.length; i++) {
      if (_calendars[i].entity_id === entityId) {
        return _calendars[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      }
    }
    return '#888';
  }

  function getCalName(entityId) {
    for (var i = 0; i < _calendars.length; i++) {
      if (_calendars[i].entity_id === entityId) {
        return _calendars[i].label || (entityId.split('.')[1]) || entityId;
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
      if (stMatch) { startTime = stMatch[1]; }
      if (etMatch) { endTime = etMatch[1]; }
    }
    return {
      cal: calEntityId,
      title: haEvent.summary || '',
      date: startDate,
      start: startTime,
      end: endTime,
      allDay: allDay,
      description: haEvent.description || '',
      location: haEvent.location || ''
    };
  }

  function getEventsForDate(y, m, d) {
    var ds = dateStr(y, m, d);
    var result = [];
    for (var i = 0; i < _allEvents.length; i++) {
      if (_allEvents[i].date === ds && _selectedCals.indexOf(_allEvents[i].cal) !== -1) {
        result.push(_allEvents[i]);
      }
    }
    return result;
  }

  function countEventsForCalInMonth(calEntityId) {
    var count = 0;
    var prefix = _currentYear + '-' + pad(_currentMonth + 1) + '-';
    for (var i = 0; i < _allEvents.length; i++) {
      if (_allEvents[i].cal === calEntityId && _allEvents[i].date.indexOf(prefix) === 0) {
        count++;
      }
    }
    return count;
  }

  function isNotToday() {
    var today = new Date();
    if (_currentMonth !== today.getMonth() || _currentYear !== today.getFullYear()) { return true; }
    if (_currentView === 'day' && _selectedDay && _selectedDay !== today.getDate()) { return true; }
    return false;
  }

  // ── Event Fetching ──

  function fetchEvents(year, month) {
    var startDate = new Date(year, month, 1);
    startDate.setDate(startDate.getDate() - 7);
    var endDate = new Date(year, month + 1, 0);
    endDate.setDate(endDate.getDate() + 7);
    var startISO = startDate.toISOString();
    var endISO = endDate.toISOString();

    var promises = [];
    var calIds = [];
    for (var i = 0; i < _calendars.length; i++) {
      var cal = _calendars[i];
      var cacheKey = cal.entity_id + ':' + year + '-' + pad(month + 1);
      if (_eventsCache[cacheKey]) { continue; }
      calIds.push(cal.entity_id);
      promises.push(
        fetch('api/calendar-events/' + encodeURIComponent(cal.entity_id) + '?start=' + encodeURIComponent(startISO) + '&end=' + encodeURIComponent(endISO))
          .then(function (r) { return r.ok ? r.json() : []; })
          ['catch'](function () { return []; })
      );
    }

    if (promises.length === 0) {
      rebuildAllEvents();
      renderCurrentView();
      renderDropdown();
      updateOggiBtn();
      return;
    }

    Promise.all(promises).then(function (results) {
      for (var j = 0; j < results.length; j++) {
        var calId = calIds[j];
        var cacheKey = calId + ':' + year + '-' + pad(month + 1);
        var normalized = [];
        var events = results[j] || [];
        for (var k = 0; k < events.length; k++) {
          normalized.push(normalizeEvent(events[k], calId));
        }
        _eventsCache[cacheKey] = normalized;
      }
      rebuildAllEvents();
      renderCurrentView();
      renderDropdown();
      updateOggiBtn();
    })['catch'](function () {
      rebuildAllEvents();
      renderCurrentView();
      renderDropdown();
      updateOggiBtn();
    });
  }

  function rebuildAllEvents() {
    _allEvents = [];
    for (var key in _eventsCache) {
      if (_eventsCache.hasOwnProperty(key)) {
        var events = _eventsCache[key];
        for (var i = 0; i < events.length; i++) {
          _allEvents.push(events[i]);
        }
      }
    }
  }

  // ── Oggi button ──

  function updateOggiBtn() {
    if (!_elBtnOggi) { return; }
    if (isNotToday()) {
      _elBtnOggi.className = 'cal-btn-oggi';
    } else {
      _elBtnOggi.className = 'cal-btn-oggi on-today';
    }
  }

  // ── Dropdown ──

  function renderDropdown() {
    if (!_elCalMenu) { return; }
    var html = '';
    for (var i = 0; i < _calendars.length; i++) {
      var c = _calendars[i];
      var sel = _selectedCals.indexOf(c.entity_id) !== -1;
      var count = countEventsForCalInMonth(c.entity_id);
      var color = c.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      var name = c.label || (c.entity_id.split('.')[1]) || c.entity_id;
      html += '<div class="cal-dropdown-item' + (sel ? ' selected' : '') + '" data-cal="' + c.entity_id + '">';
      html += '<span class="cal-dot" style="background:' + color + '"></span>';
      html += '<span class="cal-item-name">' + name + '</span>';
      html += '<span class="cal-event-count">' + count + '</span>';
      if (sel) { html += '<span class="cal-check">\u2713</span>'; }
      html += '</div>';
    }
    html += '<div class="cal-dropdown-item" data-cal="__all" style="border-top:1px solid #333;margin-top:4px;padding-top:12px;color:#4a9eff;">Seleziona tutti</div>';
    _elCalMenu.innerHTML = html;

    // Update button label and dots
    if (_selectedCals.length === _calendars.length) {
      _elCalBtnLabel.textContent = 'Tutti i calendari';
      var dh = '';
      for (var j = 0; j < _calendars.length; j++) {
        var jColor = _calendars[j].color || DEFAULT_COLORS[j % DEFAULT_COLORS.length];
        dh += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + jColor + ';margin-right:3px;"></span>';
      }
      _elCalBtnDots.innerHTML = dh;
    } else if (_selectedCals.length === 0) {
      _elCalBtnLabel.textContent = 'Nessun calendario';
      _elCalBtnDots.innerHTML = '';
    } else {
      var names = [];
      var dh2 = '';
      for (var k = 0; k < _calendars.length; k++) {
        if (_selectedCals.indexOf(_calendars[k].entity_id) !== -1) {
          var kName = _calendars[k].label || (_calendars[k].entity_id.split('.')[1]) || _calendars[k].entity_id;
          var kColor = _calendars[k].color || DEFAULT_COLORS[k % DEFAULT_COLORS.length];
          names.push(kName);
          dh2 += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + kColor + ';margin-right:3px;"></span>';
        }
      }
      _elCalBtnLabel.textContent = names.join(', ');
      _elCalBtnDots.innerHTML = dh2;
    }
  }

  function closeDropdown() {
    if (_elCalMenu) { _elCalMenu.className = 'cal-dropdown-menu'; }
    if (_elCalBtn) { _elCalBtn.className = 'cal-dropdown-btn'; }
  }

  // ── Render Month ──

  function renderMonth() {
    _elMonthView.style.display = '';
    _elWeekView.style.display = 'none';
    _elDayView.style.display = 'none';
    _elMonthLabel.textContent = MONTHS_IT[_currentMonth] + ' ' + _currentYear;

    var today = new Date();
    var isCurrentMonth = (today.getFullYear() === _currentYear && today.getMonth() === _currentMonth);

    var wdHtml = '';
    for (var w = 0; w < 7; w++) {
      wdHtml += '<div class="cal-weekday' + (w >= 5 ? ' weekend' : '') + '">' + DAYS_IT[w] + '</div>';
    }
    _elWeekdays.innerHTML = wdHtml;

    var firstDay = new Date(_currentYear, _currentMonth, 1).getDay();
    firstDay = (firstDay === 0) ? 6 : firstDay - 1;
    var daysInMonth = new Date(_currentYear, _currentMonth + 1, 0).getDate();
    var prevDays = new Date(_currentYear, _currentMonth, 0).getDate();

    var html = '';
    for (var p = firstDay - 1; p >= 0; p--) {
      html += '<div class="cal-day-wrap"><div class="cal-day outside"><span class="cal-day-num">' + (prevDays - p) + '</span></div></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var events = getEventsForDate(_currentYear, _currentMonth, d);
      var isToday = isCurrentMonth && today.getDate() === d;
      var isSel = _selectedDay === d;
      var date = new Date(_currentYear, _currentMonth, d);
      var dow = (date.getDay() === 0) ? 6 : date.getDay() - 1;
      var isWeekend = dow >= 5;
      var cls = 'cal-day';
      if (isToday) { cls += ' today'; }
      if (isSel) { cls += ' selected'; }
      if (events.length > 0) { cls += ' has-events'; }
      if (isWeekend) { cls += ' weekend-cell'; }

      html += '<div class="cal-day-wrap"><div class="' + cls + '" data-day="' + d + '">';
      html += '<span class="cal-day-num">' + d + '</span>';
      html += '<div class="cal-day-indicators">';
      if (events.length === 1) {
        html += '<span class="cal-day-dot" style="background:' + getCalColor(events[0].cal) + '"></span>';
      } else if (events.length >= 2) {
        html += '<span class="cal-day-count">' + events.length + '</span>';
      }
      html += '</div></div></div>';
    }
    var totalCells = firstDay + daysInMonth;
    var remaining = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (var n = 1; n <= remaining; n++) {
      html += '<div class="cal-day-wrap"><div class="cal-day outside"><span class="cal-day-num">' + n + '</span></div></div>';
    }
    _elDaysGrid.innerHTML = html;

    var dayCells = _elDaysGrid.querySelectorAll('.cal-day:not(.outside)');
    for (var di = 0; di < dayCells.length; di++) {
      (function (cell) {
        cell.addEventListener('click', function () {
          _selectedDay = parseInt(cell.getAttribute('data-day'));
          renderMonth();
          openSheet(_selectedDay);
        });
      }(dayCells[di]));
    }
  }

  // ── Render Week ──

  function renderWeek() {
    _elMonthView.style.display = 'none';
    _elWeekView.style.display = '-webkit-flex';
    _elWeekView.style.display = 'flex';
    _elDayView.style.display = 'none';
    _elMonthLabel.textContent = MONTHS_IT[_currentMonth] + ' ' + _currentYear;

    var TODAY = new Date();
    var refDay = _selectedDay || (TODAY.getMonth() === _currentMonth ? TODAY.getDate() : 15);
    var refDate = new Date(_currentYear, _currentMonth, refDay);
    var dayOfWeek = (refDate.getDay() === 0) ? 6 : refDate.getDay() - 1;
    var monday = new Date(refDate);
    monday.setDate(monday.getDate() - dayOfWeek);
    var sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    var janFirst = new Date(_currentYear, 0, 1);
    var weekNum = Math.ceil(((monday - janFirst) / 86400000 + janFirst.getDay() + 1) / 7);
    var rangeLabel;
    if (monday.getMonth() !== sunday.getMonth()) {
      rangeLabel = 'Sett. ' + weekNum + ' \u00B7 ' + monday.getDate() + ' ' + MONTHS_IT[monday.getMonth()].substring(0, 3) + ' \u2013 ' + sunday.getDate() + ' ' + MONTHS_IT[sunday.getMonth()].substring(0, 3);
    } else {
      rangeLabel = 'Sett. ' + weekNum + ' \u00B7 ' + monday.getDate() + '\u2013' + sunday.getDate() + ' ' + MONTHS_IT[monday.getMonth()];
    }

    var html = '<div style="text-align:center;font-size:13px;color:#888;margin-bottom:8px;font-weight:600;">' + rangeLabel + '</div>';
    html += '<div class="cal-week-header"><div class="cal-week-header-time"></div>';
    var weekDates = [];
    for (var i = 0; i < 7; i++) {
      var dd = new Date(monday);
      dd.setDate(dd.getDate() + i);
      weekDates.push(dd);
      var dayEvs = getEventsForDate(dd.getFullYear(), dd.getMonth(), dd.getDate());
      var evCount = dayEvs.length;
      var isTodayCol = dd.getFullYear() === TODAY.getFullYear() && dd.getMonth() === TODAY.getMonth() && dd.getDate() === TODAY.getDate();
      html += '<div class="cal-week-header-cell' + (isTodayCol ? ' today-col' : '') + '" data-wday="' + dd.getDate() + '" data-wmonth="' + dd.getMonth() + '">';
      html += '<div class="cal-week-header-name">' + DAYS_IT[i] + '</div>';
      html += '<div class="cal-week-header-day">' + dd.getDate() + '</div>';
      if (evCount > 0) { html += '<div class="cal-week-header-count">' + evCount + ' ev.</div>'; }
      html += '</div>';
    }
    html += '</div>';

    // All-day banner
    var hasAnyAllDay = false;
    for (var ai = 0; ai < 7; ai++) {
      var adEvs = getEventsForDate(weekDates[ai].getFullYear(), weekDates[ai].getMonth(), weekDates[ai].getDate());
      for (var ae = 0; ae < adEvs.length; ae++) {
        if (adEvs[ae].allDay) { hasAnyAllDay = true; break; }
      }
      if (hasAnyAllDay) { break; }
    }
    if (hasAnyAllDay) {
      html += '<div style="display:-webkit-flex;display:flex;border-bottom:1px solid #333;margin-bottom:4px;">';
      html += '<div style="width:50px;-webkit-flex-shrink:0;flex-shrink:0;font-size:9px;color:#555;text-align:right;padding:6px 8px 6px 0;">tutto<br>il d\u00ec</div>';
      for (var adi = 0; adi < 7; adi++) {
        var adayEvs = getEventsForDate(weekDates[adi].getFullYear(), weekDates[adi].getMonth(), weekDates[adi].getDate());
        html += '<div style="-webkit-flex:1;flex:1;margin:0 1px;padding:4px 2px;">';
        for (var ade = 0; ade < adayEvs.length; ade++) {
          if (adayEvs[ade].allDay) {
            var adColor = getCalColor(adayEvs[ade].cal);
            html += '<div style="background:' + adColor + '33;border-left:3px solid ' + adColor + ';border-radius:3px;padding:3px 4px;font-size:10px;font-weight:600;margin-bottom:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + adayEvs[ade].title + '</div>';
          }
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // Time grid
    html += '<div class="cal-week-body">';
    var nowH = TODAY.getHours();
    var nowM = TODAY.getMinutes();
    for (var h = 7; h <= 22; h++) {
      html += '<div class="cal-week-row"><div class="cal-week-hour">' + pad(h) + ':00</div>';
      for (var wi = 0; wi < 7; wi++) {
        var wd = weekDates[wi];
        var wdayEvents = getEventsForDate(wd.getFullYear(), wd.getMonth(), wd.getDate());
        var isTodayCell = wd.getFullYear() === TODAY.getFullYear() && wd.getMonth() === TODAY.getMonth() && wd.getDate() === TODAY.getDate();
        html += '<div class="cal-week-cell" style="' + (isTodayCell ? 'background:#4a9eff08;' : '') + '">';
        if (isTodayCell && h === nowH) {
          var topPx = Math.round((nowM / 60) * 48);
          html += '<div class="cal-week-now-line" style="top:' + topPx + 'px;"><div class="cal-week-now-dot"></div></div>';
        }
        for (var we = 0; we < wdayEvents.length; we++) {
          var ev = wdayEvents[we];
          if (ev.allDay) { continue; }
          var startH = parseInt(ev.start.split(':')[0]);
          if (startH === h) {
            var startM = parseInt(ev.start.split(':')[1]) || 0;
            var endH = parseInt(ev.end.split(':')[0]);
            var endM = parseInt(ev.end.split(':')[1]) || 0;
            var durMin = (endH * 60 + endM) - (startH * 60 + startM);
            var pxH = Math.max(20, Math.round((durMin / 60) * 48) - 2);
            var topOffset = Math.round((startM / 60) * 48);
            var color = getCalColor(ev.cal);
            html += '<div class="cal-week-event" style="top:' + topOffset + 'px;background:' + color + '33;border-left:3px solid ' + color + ';height:' + pxH + 'px;z-index:10;" title="' + ev.title + ' ' + ev.start + '-' + ev.end + '">' + ev.title + '</div>';
          }
        }
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    _elWeekView.innerHTML = html;

    var wHeaders = _elWeekView.querySelectorAll('[data-wday]');
    for (var whi = 0; whi < wHeaders.length; whi++) {
      (function (hdr) {
        hdr.addEventListener('click', function () {
          var day = parseInt(hdr.getAttribute('data-wday'));
          var month = parseInt(hdr.getAttribute('data-wmonth'));
          if (month === _currentMonth) {
            _selectedDay = day;
            openSheet(day);
          }
        });
      }(wHeaders[whi]));
    }
  }

  // ── Render Day ──

  function renderDay() {
    _elMonthView.style.display = 'none';
    _elWeekView.style.display = 'none';
    _elDayView.style.display = '-webkit-flex';
    _elDayView.style.display = 'flex';
    var TODAY = new Date();
    var day = _selectedDay || TODAY.getDate();
    var date = new Date(_currentYear, _currentMonth, day);
    var dowIdx = (date.getDay() === 0) ? 6 : date.getDay() - 1;
    var isDayToday = (_currentYear === TODAY.getFullYear() && _currentMonth === TODAY.getMonth() && day === TODAY.getDate());
    _elMonthLabel.textContent = MONTHS_IT[_currentMonth] + ' ' + _currentYear;

    var dayEvents = getEventsForDate(_currentYear, _currentMonth, day);
    dayEvents.sort(function (a, b) {
      if (a.allDay && !b.allDay) { return -1; }
      if (!a.allDay && b.allDay) { return 1; }
      return a.start < b.start ? -1 : 1;
    });

    var html = '<div class="cal-day-header-bar">';
    html += '<div class="cal-month-nav" id="cal-prev-day">\u25C0</div>';
    html += '<div class="cal-day-label">';
    if (isDayToday) { html += '<span style="color:#4a9eff;font-size:12px;font-weight:600;text-transform:uppercase;display:block;">Oggi</span>'; }
    html += DAYS_FULL[dowIdx] + ' ' + day + ' ' + MONTHS_IT[_currentMonth];
    html += '<span class="cal-day-count">' + dayEvents.length + ' event' + (dayEvents.length !== 1 ? 'i' : 'o') + '</span>';
    html += '</div>';
    html += '<div class="cal-month-nav" id="cal-next-day">\u25B6</div>';
    html += '</div>';

    if (dayEvents.length === 0) {
      html += '<div class="cal-day-empty">';
      html += '<div class="cal-day-empty-icon">\uD83D\uDCC5</div>';
      html += '<div class="cal-day-empty-text">Nessun evento</div>';
      html += '</div>';
    } else {
      html += '<div class="cal-day-agenda">';
      for (var i = 0; i < dayEvents.length; i++) {
        var ev = dayEvents[i];
        var color = getCalColor(ev.cal);
        html += '<div class="cal-day-card">';
        html += '<div class="cal-day-card-bar" style="background:' + color + '"></div>';
        html += '<div class="cal-day-card-info">';
        html += '<div class="cal-day-card-title">' + ev.title + '</div>';
        html += '<div class="cal-day-card-time">' + (ev.allDay ? '\u2B50 Tutto il giorno' : ev.start + ' \u2014 ' + ev.end) + ' \u00B7 <span style="color:' + color + '">' + getCalName(ev.cal) + '</span></div>';
        html += '</div></div>';
      }
      html += '</div>';
    }

    _elDayView.innerHTML = html;

    var prevDayEl = document.getElementById('cal-prev-day');
    var nextDayEl = document.getElementById('cal-next-day');
    if (prevDayEl) {
      prevDayEl.addEventListener('click', function () {
        _selectedDay = (_selectedDay || day) - 1;
        if (_selectedDay < 1) {
          _currentMonth--;
          if (_currentMonth < 0) { _currentMonth = 11; _currentYear--; }
          _selectedDay = new Date(_currentYear, _currentMonth + 1, 0).getDate();
        }
        renderDay();
        renderDropdown();
        updateOggiBtn();
      });
    }
    if (nextDayEl) {
      nextDayEl.addEventListener('click', function () {
        var maxD = new Date(_currentYear, _currentMonth + 1, 0).getDate();
        _selectedDay = (_selectedDay || day) + 1;
        if (_selectedDay > maxD) {
          _currentMonth++;
          if (_currentMonth > 11) { _currentMonth = 0; _currentYear++; }
          _selectedDay = 1;
        }
        renderDay();
        renderDropdown();
        updateOggiBtn();
      });
    }
  }

  function renderCurrentView() {
    if (_currentView === 'month') { renderMonth(); }
    else if (_currentView === 'week') { renderWeek(); }
    else if (_currentView === 'day') { renderDay(); }
  }

  // ── Bottom Sheet ──

  function openSheet(day) {
    var sidebar = document.getElementById('sidebar');
    var sbWidth = sidebar ? sidebar.offsetWidth : 0;
    _elSheet.style.left = sbWidth + 'px';
    _elOverlay.style.left = sbWidth + 'px';
    var events = getEventsForDate(_currentYear, _currentMonth, day);
    var date = new Date(_currentYear, _currentMonth, day);
    var dowIdx = (date.getDay() === 0) ? 6 : date.getDay() - 1;
    _elSheetTitle.textContent = DAYS_FULL[dowIdx] + ' ' + day + ' ' + MONTHS_IT[_currentMonth];
    _elSheetCount.textContent = events.length + ' event' + (events.length !== 1 ? 'i' : 'o');

    var html = '';
    if (events.length === 0) {
      html = '<div class="cal-sheet-empty">\uD83D\uDCC5 Nessun evento</div>';
    } else {
      events.sort(function (a, b) {
        if (a.allDay && !b.allDay) { return -1; }
        if (!a.allDay && b.allDay) { return 1; }
        return a.start < b.start ? -1 : 1;
      });
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var color = getCalColor(ev.cal);
        html += '<div class="cal-sheet-event">';
        html += '<div class="cal-sheet-event-bar" style="background:' + color + '"></div>';
        html += '<div class="cal-sheet-event-info">';
        html += '<div class="cal-sheet-event-title">' + ev.title + '</div>';
        html += '<div class="cal-sheet-event-time">' + (ev.allDay ? '\u2B50 Tutto il giorno' : ev.start + ' \u2014 ' + ev.end) + '</div>';
        html += '<div class="cal-sheet-event-cal" style="color:' + color + '">' + getCalName(ev.cal) + '</div>';
        html += '</div></div>';
      }
    }
    _elSheetBody.innerHTML = html;

    _elSheet.className = 'cal-sheet';
    if (events.length > 3) {
      _elSheet.className = 'cal-sheet expanded';
      _sheetState = 'expanded';
    } else {
      _elSheet.className = 'cal-sheet peek';
      _sheetState = 'peek';
    }
    _elOverlay.className = 'cal-sheet-overlay show';
  }

  function closeSheet() {
    _elSheet.className = 'cal-sheet';
    _elOverlay.className = 'cal-sheet-overlay';
    _sheetState = 'closed';
    _selectedDay = null;
    if (_currentView === 'month') { renderMonth(); }
  }

  function onSheetSwipeStart(y) { _sheetStartY = y; }

  function onSheetSwipeEnd(y) {
    var diff = _sheetStartY - y;
    _sheetStartY = 0;
    if (diff > 40 && _sheetState === 'peek') {
      _elSheet.className = 'cal-sheet expanded';
      _sheetState = 'expanded';
    } else if (diff < -40) {
      if (_sheetState === 'expanded') {
        _elSheet.className = 'cal-sheet peek';
        _sheetState = 'peek';
      } else {
        closeSheet();
      }
    }
  }

  // ── DOM Building ──

  function el(tag, cls, innerHTML) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (innerHTML !== undefined) { e.innerHTML = innerHTML; }
    return e;
  }

  function buildDOM() {
    _container.innerHTML = '';

    // ── Page wrapper ──
    _elPage = el('div', 'cal-page');

    // ── Row 1: Month nav ──
    var rowMonth = el('div', 'cal-row-month');
    _elPrevMonth = el('div', 'cal-month-nav', '&#9664;');
    _elMonthLabel = el('div', 'cal-month-label', '');
    _elNextMonth = el('div', 'cal-month-nav', '&#9654;');
    _elBtnOggi = el('div', 'cal-btn-oggi', 'Oggi');
    rowMonth.appendChild(_elPrevMonth);
    rowMonth.appendChild(_elMonthLabel);
    rowMonth.appendChild(_elNextMonth);
    rowMonth.appendChild(_elBtnOggi);

    // ── Row 2: Dropdown + view switcher ──
    var rowControls = el('div', 'cal-row-controls');

    var dropWrap = el('div', 'cal-dropdown-wrap');
    _elCalBtn = el('div', 'cal-dropdown-btn');
    _elCalBtnDots = el('span', 'cal-btn-dots');
    _elCalBtnLabel = el('span', '');
    _elCalBtnLabel.textContent = 'Tutti i calendari';
    var arrow = el('span', 'cal-arrow', '&#9662;');
    _elCalBtn.appendChild(_elCalBtnDots);
    _elCalBtn.appendChild(_elCalBtnLabel);
    _elCalBtn.appendChild(arrow);
    _elCalMenu = el('div', 'cal-dropdown-menu');
    dropWrap.appendChild(_elCalBtn);
    dropWrap.appendChild(_elCalMenu);

    var viewSwitcher = el('div', 'cal-view-switcher');
    var viewDefs = [
      { view: 'month', label: 'Mese' },
      { view: 'week',  label: 'Settimana' },
      { view: 'day',   label: 'Giorno' }
    ];
    _elViewBtns = [];
    for (var vi = 0; vi < viewDefs.length; vi++) {
      var vb = el('div', 'cal-view-btn' + (viewDefs[vi].view === 'month' ? ' active' : ''), viewDefs[vi].label);
      vb.setAttribute('data-view', viewDefs[vi].view);
      viewSwitcher.appendChild(vb);
      _elViewBtns.push(vb);
    }

    rowControls.appendChild(dropWrap);
    rowControls.appendChild(viewSwitcher);

    // ── Month view (grid wrap) ──
    _elMonthView = el('div', 'cal-grid-wrap');
    _elWeekdays = el('div', 'cal-weekdays');
    _elDaysGrid = el('div', 'cal-days');
    _elMonthView.appendChild(_elWeekdays);
    _elMonthView.appendChild(_elDaysGrid);

    // ── Week view ──
    _elWeekView = el('div', 'cal-week-view');
    _elWeekView.style.display = 'none';

    // ── Day view ──
    _elDayView = el('div', 'cal-day-view');
    _elDayView.style.display = 'none';

    _elPage.appendChild(rowMonth);
    _elPage.appendChild(rowControls);
    _elPage.appendChild(_elMonthView);
    _elPage.appendChild(_elWeekView);
    _elPage.appendChild(_elDayView);
    _container.appendChild(_elPage);

    // ── Bottom sheet (appended to container, fixed positioning) ──
    _elOverlay = el('div', 'cal-sheet-overlay');
    _elSheet = el('div', 'cal-sheet');

    _elSheetHandleWrap = el('div', 'cal-sheet-handle-wrap');
    var sheetHandle = el('div', 'cal-sheet-handle');
    _elSheetHandleWrap.appendChild(sheetHandle);

    var sheetHeader = el('div', 'cal-sheet-header');
    _elSheetTitle = el('div', 'cal-sheet-title');
    _elSheetCount = el('div', 'cal-sheet-count');
    _elSheetClose = el('div', 'cal-sheet-close', '&#x2715;');
    sheetHeader.appendChild(_elSheetTitle);
    sheetHeader.appendChild(_elSheetCount);
    sheetHeader.appendChild(_elSheetClose);

    _elSheetBody = el('div', 'cal-sheet-body');
    var sheetHint = el('div', 'cal-sheet-hint', '&#8593; Scorri su per espandere &middot; &#8595; gi&ugrave; per chiudere');

    _elSheet.appendChild(_elSheetHandleWrap);
    _elSheet.appendChild(sheetHeader);
    _elSheet.appendChild(_elSheetBody);
    _elSheet.appendChild(sheetHint);

    _container.appendChild(_elOverlay);
    _container.appendChild(_elSheet);

    // ── Event listeners ──

    _elBtnOggi.addEventListener('click', function () {
      var today = new Date();
      _currentYear = today.getFullYear();
      _currentMonth = today.getMonth();
      _selectedDay = (_currentView === 'day') ? today.getDate() : null;
      renderCurrentView();
      renderDropdown();
      updateOggiBtn();
      fetchEvents(_currentYear, _currentMonth);
    });

    _elPrevMonth.addEventListener('click', function () {
      if (_currentView === 'week') {
        // Navigate to previous week
        var ref = _selectedDay || new Date().getDate();
        var d = new Date(_currentYear, _currentMonth, ref - 7);
        _currentYear = d.getFullYear();
        _currentMonth = d.getMonth();
        _selectedDay = d.getDate();
        fetchEvents(_currentYear, _currentMonth);
      } else {
        _currentMonth--;
        if (_currentMonth < 0) { _currentMonth = 11; _currentYear--; }
        _selectedDay = null;
        fetchEvents(_currentYear, _currentMonth);
      }
      renderCurrentView();
      renderDropdown();
      updateOggiBtn();
    });

    _elNextMonth.addEventListener('click', function () {
      if (_currentView === 'week') {
        var ref = _selectedDay || new Date().getDate();
        var d = new Date(_currentYear, _currentMonth, ref + 7);
        _currentYear = d.getFullYear();
        _currentMonth = d.getMonth();
        _selectedDay = d.getDate();
        fetchEvents(_currentYear, _currentMonth);
      } else {
        _currentMonth++;
        if (_currentMonth > 11) { _currentMonth = 0; _currentYear++; }
        _selectedDay = null;
        fetchEvents(_currentYear, _currentMonth);
      }
      renderCurrentView();
      renderDropdown();
      updateOggiBtn();
    });

    // Calendar dropdown
    _elCalBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (_elCalMenu.className.indexOf('show') !== -1) {
        _elCalMenu.className = 'cal-dropdown-menu';
        _elCalBtn.className = 'cal-dropdown-btn';
      } else {
        _elCalMenu.className = 'cal-dropdown-menu show';
        _elCalBtn.className = 'cal-dropdown-btn open';
      }
    });

    _elCalMenu.addEventListener('click', function (e) {
      e.stopPropagation();
      var target = e.target;
      // Walk up to find the dropdown item
      while (target && target !== _elCalMenu) {
        if (target.className && target.className.indexOf('cal-dropdown-item') !== -1) { break; }
        target = target.parentNode;
      }
      if (!target || target === _elCalMenu) { return; }
      var calId = target.getAttribute('data-cal');
      if (!calId) { return; }
      if (calId === '__all') {
        _selectedCals = [];
        for (var i = 0; i < _calendars.length; i++) {
          _selectedCals.push(_calendars[i].entity_id);
        }
      } else {
        var idx = _selectedCals.indexOf(calId);
        if (idx !== -1) { _selectedCals.splice(idx, 1); }
        else { _selectedCals.push(calId); }
      }
      renderDropdown();
      renderCurrentView();
      updateOggiBtn();
    });

    // View switcher
    for (var vbi = 0; vbi < _elViewBtns.length; vbi++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          for (var j = 0; j < _elViewBtns.length; j++) {
            _elViewBtns[j].className = 'cal-view-btn';
          }
          btn.className = 'cal-view-btn active';
          _currentView = btn.getAttribute('data-view');
          renderCurrentView();
          updateOggiBtn();
        });
      }(_elViewBtns[vbi]));
    }

    // Month swipe
    _elMonthView.addEventListener('touchstart', function (e) {
      _swipeStartX = e.touches[0].clientX;
    }, { passive: true });
    _elMonthView.addEventListener('touchend', function (e) {
      var diff = _swipeStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) {
          _currentMonth++;
          if (_currentMonth > 11) { _currentMonth = 0; _currentYear++; }
        } else {
          _currentMonth--;
          if (_currentMonth < 0) { _currentMonth = 11; _currentYear--; }
        }
        _selectedDay = null;
        fetchEvents(_currentYear, _currentMonth);
        renderCurrentView();
        renderDropdown();
        updateOggiBtn();
      }
    }, { passive: true });

    // Week swipe
    _elWeekView.addEventListener('touchstart', function (e) {
      _swipeStartX = e.touches[0].clientX;
    }, { passive: true });
    _elWeekView.addEventListener('touchend', function (e) {
      var diff = _swipeStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        var ref = _selectedDay || new Date().getDate();
        var d = new Date(_currentYear, _currentMonth, ref + (diff > 0 ? 7 : -7));
        _currentYear = d.getFullYear();
        _currentMonth = d.getMonth();
        _selectedDay = d.getDate();
        fetchEvents(_currentYear, _currentMonth);
        renderCurrentView();
        renderDropdown();
        updateOggiBtn();
      }
    }, { passive: true });

    // Sheet overlay tap to close
    _elOverlay.addEventListener('click', closeSheet);
    _elSheetClose.addEventListener('click', closeSheet);

    // Sheet swipe — listen on entire sheet for better touch area
    var _sheetTouchStartY = 0;
    var _sheetTouchStartX = 0;
    var _sheetSwipeDecided = false;

    _elSheet.addEventListener('touchstart', function (e) {
      _sheetTouchStartY = e.touches[0].clientY;
      _sheetTouchStartX = e.touches[0].clientX;
      _sheetSwipeDecided = false;
    }, { passive: true });

    _elSheet.addEventListener('touchmove', function (e) {
      if (_sheetSwipeDecided) return;
      var dy = Math.abs(e.touches[0].clientY - _sheetTouchStartY);
      var dx = Math.abs(e.touches[0].clientX - _sheetTouchStartX);
      if (dy > 10 || dx > 10) {
        _sheetSwipeDecided = true;
        // If mostly vertical AND sheet body is at scroll top, treat as swipe
        if (dy > dx) {
          var scrollTop = _elSheetBody ? _elSheetBody.scrollTop : 0;
          var goingUp = (e.touches[0].clientY < _sheetTouchStartY);
          // Allow swipe up from peek (expand), or swipe down when scrolled to top
          if (_sheetState === 'peek' || (!goingUp && scrollTop <= 0)) {
            // This is a sheet gesture, not a scroll
          }
        }
      }
    }, { passive: true });

    _elSheet.addEventListener('touchend', function (e) {
      var diff = _sheetTouchStartY - e.changedTouches[0].clientY;
      var absDx = Math.abs(e.changedTouches[0].clientX - _sheetTouchStartX);
      // Only handle vertical swipes (not horizontal)
      if (Math.abs(diff) > 40 && Math.abs(diff) > absDx) {
        var scrollTop = _elSheetBody ? _elSheetBody.scrollTop : 0;
        if (diff > 0 && _sheetState === 'peek') {
          // Swipe up from peek → expand
          _elSheet.className = 'cal-sheet expanded';
          _sheetState = 'expanded';
        } else if (diff < 0) {
          if (_sheetState === 'expanded' && scrollTop <= 0) {
            // Swipe down from expanded (scrolled to top) → peek
            _elSheet.className = 'cal-sheet peek';
            _sheetState = 'peek';
          } else if (_sheetState === 'peek') {
            // Swipe down from peek → close
            closeSheet();
          }
        }
      }
      _sheetTouchStartY = 0;
      _sheetTouchStartX = 0;
    }, { passive: true });

    _elSheet.addEventListener('mousedown', function (e) {
      _sheetStartY = e.clientY;
    });

    // Close dropdown on outside click — attach to document, store ref for cleanup
    _docClickHandler = function () { closeDropdown(); };
    document.addEventListener('click', _docClickHandler);

    // Mouse drag on sheet handle
    _docMouseupHandler = function (e) {
      if (_sheetStartY !== 0) { onSheetSwipeEnd(e.clientY); }
    };
    document.addEventListener('mouseup', _docMouseupHandler);
  }

  // ── Public API ──

  function init(container, calendars, appState) {
    // Cleanup previous listeners if re-inited
    if (_docClickHandler) { document.removeEventListener('click', _docClickHandler); _docClickHandler = null; }
    if (_docMouseupHandler) { document.removeEventListener('mouseup', _docMouseupHandler); _docMouseupHandler = null; }

    _container = container;
    _calendars = calendars || [];
    _appState = appState;
    _selectedCals = [];
    for (var i = 0; i < _calendars.length; i++) {
      _selectedCals.push(_calendars[i].entity_id);
    }

    var today = new Date();
    _currentYear = today.getFullYear();
    _currentMonth = today.getMonth();
    _selectedDay = null;
    _currentView = 'month';
    _eventsCache = {};
    _allEvents = [];
    _sheetState = 'closed';

    buildDOM();
    renderDropdown();
    updateOggiBtn();
    fetchEvents(_currentYear, _currentMonth);
  }

  return { init: init };

}());
