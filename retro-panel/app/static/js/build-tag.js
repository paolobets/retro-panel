/**
 * build-tag.js — shows the current cache-buster as "build NNNNN" next
 * to the panel/settings title, to diagnose browser caching on beta.
 *
 * Extracts the cache-buster at runtime by scanning <link> tags; the
 * literal pattern "?v=NNN" is reconstructed via String.fromCharCode(63)
 * so release.sh's sed does not rewrite this file.
 *
 * DEV ONLY: delete this file and its <script> references before a stable
 * release (see feedback_retropanel_dev_build_tag memory).
 *
 * iOS 12+ Safari safe — no const/let/arrow/optional chaining.
 */
(function () {
  'use strict';
  try {
    var links = document.getElementsByTagName('link');
    var buster = '';
    var marker = String.fromCharCode(63) + 'v=';
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var idx = href.indexOf(marker);
      if (idx >= 0) {
        buster = href.substring(idx + 3).split('&')[0];
        break;
      }
    }
    function paint() {
      /* Panels: index.html uses #panel-build-tag, config.html uses #cfg-build-tag */
      var ids = ['panel-build-tag', 'cfg-build-tag'];
      for (var k = 0; k < ids.length; k++) {
        var el = document.getElementById(ids[k]);
        if (el && buster) { el.textContent = 'build ' + buster; }
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', paint);
    } else {
      paint();
    }
  } catch (e) {}
}());
