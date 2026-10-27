/* Anonymous page-load analytics, kept independent of the timetable module. */
(function (win, doc) {
  'use strict';
  var endpoint = 'https://hust-bio-2024-timetable.dragon-air.chatgpt.site/api/analytics';
  var key = 'timetable-anonymous-device-v1';
  var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function uuid() {
    var api = win.crypto || win.msCrypto;
    try { if (api && typeof api.randomUUID === 'function') return api.randomUUID(); } catch (_) {}
    var bytes = new Uint8Array(16);
    try { if (!api || !api.getRandomValues) throw new Error(); api.getRandomValues(bytes); }
    catch (_) { for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256); }
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    var hex = [];
    for (var j = 0; j < bytes.length; j++) hex.push(('0' + bytes[j].toString(16)).slice(-2));
    return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' + hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' + hex.slice(10).join('');
  }
  function read(name) { try { var value = win[name].getItem(key); return uuidPattern.test(value || '') ? value : null; } catch (_) { return null; } }
  function write(name, value) { try { win[name].setItem(key, value); } catch (_) {} }
  var id = read('localStorage') || read('sessionStorage') || uuid();
  write('localStorage', id); write('sessionStorage', id);
  var payload = JSON.stringify({ id: id, event: uuid() });
  var acknowledged = false, sending = false, attempts = 0, timer = null;
  function beacon() {
    if (acknowledged) return;
    try { if (win.navigator.sendBeacon) win.navigator.sendBeacon(endpoint, payload); } catch (_) {}
  }
  function finish(ok, retryable) {
    sending = false;
    if (ok) { acknowledged = true; return; }
    if (retryable && attempts < 3 && !timer) timer = win.setTimeout(function () { timer = null; send(); }, attempts * 2000);
  }
  function xhr() {
    try {
      var request = new win.XMLHttpRequest();
      request.open('POST', endpoint, true); request.timeout = 10000;
      request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      request.onload = function () { finish(request.status >= 200 && request.status < 300, request.status === 0 || request.status >= 500 || request.status === 429); };
      request.onerror = request.ontimeout = function () { finish(false, true); };
      request.send(payload);
    } catch (_) { finish(false, true); beacon(); }
  }
  function send() {
    if (acknowledged || sending || attempts >= 3) return;
    sending = true; attempts++;
    if (typeof win.fetch !== 'function') { xhr(); return; }
    try {
      win.fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: payload, keepalive: true, credentials: 'omit' })
        .then(function (res) { finish(res.ok, res.status >= 500 || res.status === 429); }, function () { xhr(); });
    } catch (_) { xhr(); }
  }
  // A queued beacon is not an acknowledgement; all transports reuse one event ID.
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') beacon(); });
  win.addEventListener('pagehide', beacon);
  win.addEventListener('online', function () { if (timer) { win.clearTimeout(timer); timer = null; } send(); });
  send();
})(window, document);
