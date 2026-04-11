// tkrun.js - Token/Time/Cost Running Meter
// Loaded dynamically. Attaches to every Claude + ElevenLabs API call in inbox.
// Displays floating HUD bottom-right with live elapsed time, tokens, cost.

(function() {
'use strict';

// ── Pricing (USD per 1K tokens, approximate) ─────────────────────
var PRICE_IN  = 0.003;   // claude-sonnet input  $/1K
var PRICE_OUT = 0.015;   // claude-sonnet output $/1K
var USD_ILS   = 3.7;     // approx exchange rate

// ── State ─────────────────────────────────────────────────────────
var _tkSessions = [];   // [{label, startMs, endMs, inputTokens, outputTokens, status}]
var _tkActive   = null; // current running session index
var _tkTimer    = null; // setInterval handle

// ── Inject HUD ────────────────────────────────────────────────────
function injectHUD() {
  if (document.getElementById('tkrun-hud')) return;
  var hud = document.createElement('div');
  hud.id = 'tkrun-hud';
  hud.style.cssText = [
    'position:fixed;bottom:16px;left:16px;z-index:99999',
    'background:#0f1520;border:1px solid rgba(201,168,76,0.4)',
    'border-radius:12px;padding:10px 14px;min-width:220px',
    'font-family:Heebo,monospace;direction:rtl',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
    'transition:opacity .3s;opacity:0.95',
    'cursor:pointer'
  ].join(';');

  hud.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">',
      '<span style="font-size:10px;color:#c9a84c;font-weight:800;letter-spacing:1px">⚡ TKRUN</span>',
      '<span id="tkrun-status" style="font-size:9px;padding:2px 6px;border-radius:8px;background:#1a3d5c;color:#7db8e8">מוכן</span>',
    '</div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px">',
      '<div style="background:#1a1f2e;border-radius:6px;padding:5px 8px;text-align:center">',
        '<div id="tkrun-time" style="font-size:16px;font-weight:900;color:#e8c96a;font-family:monospace">0:00</div>',
        '<div style="font-size:9px;color:#555">זמן</div>',
      '</div>',
      '<div style="background:#1a1f2e;border-radius:6px;padding:5px 8px;text-align:center">',
        '<div id="tkrun-tokens" style="font-size:16px;font-weight:900;color:#7db8e8;font-family:monospace">0</div>',
        '<div style="font-size:9px;color:#555">טוקנים</div>',
      '</div>',
    '</div>',
    '<div style="display:flex;justify-content:space-between;align-items:center">',
      '<div id="tkrun-cost" style="font-size:11px;color:#4ade80;font-weight:700">₪0.000</div>',
      '<div style="display:flex;gap:4px">',
        '<button onclick="tkrunShowHistory()" style="background:#1a3d5c;border:none;color:#a8c4e8;border-radius:5px;padding:2px 7px;font-size:10px;cursor:pointer;font-family:Heebo,sans-serif">היסטוריה</button>',
        '<button onclick="tkrunReset()" style="background:#2a1020;border:none;color:#f87171;border-radius:5px;padding:2px 7px;font-size:10px;cursor:pointer;font-family:Heebo,sans-serif">אפס</button>',
      '</div>',
    '</div>',
    '<div id="tkrun-label" style="font-size:9px;color:#666;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px"></div>',
  ].join('');

  document.body.appendChild(hud);

  // History panel
  var hist = document.createElement('div');
  hist.id = 'tkrun-history';
  hist.style.cssText = [
    'display:none;position:fixed;bottom:120px;left:16px;z-index:99998',
    'background:#0f1520;border:1px solid rgba(201,168,76,0.3)',
    'border-radius:12px;padding:12px;width:300px;max-height:300px',
    'overflow-y:auto;font-family:Heebo,sans-serif;direction:rtl',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5)'
  ].join(';');
  hist.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#c9a84c;font-size:11px;font-weight:800">היסטוריית קריאות API</span><button onclick="document.getElementById(\'tkrun-history\').style.display=\'none\'" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px">×</button></div><div id="tkrun-hist-list"></div>';
  document.body.appendChild(hist);
}

// ── Start a session ───────────────────────────────────────────────
function tkrunStart(label) {
  var session = { label: label || 'API קריאה', startMs: Date.now(), endMs: null, inputTokens: 0, outputTokens: 0, status: 'running' };
  _tkSessions.push(session);
  _tkActive = _tkSessions.length - 1;

  // Update status
  var statusEl = document.getElementById('tkrun-status');
  if (statusEl) { statusEl.textContent = 'פועל'; statusEl.style.background = '#1a4a1a'; statusEl.style.color = '#4ade80'; }
  var labelEl = document.getElementById('tkrun-label');
  if (labelEl) labelEl.textContent = label || '';

  // Start timer
  clearInterval(_tkTimer);
  _tkTimer = setInterval(function() { tkrunTick(); }, 100);

  return _tkActive;
}

// ── Update tokens after response ──────────────────────────────────
function tkrunEnd(inputTokens, outputTokens) {
  if (_tkActive === null) return;
  var s = _tkSessions[_tkActive];
  if (!s) return;
  s.endMs = Date.now();
  s.inputTokens  = (s.inputTokens  || 0) + (inputTokens  || 0);
  s.outputTokens = (s.outputTokens || 0) + (outputTokens || 0);
  s.status = 'done';
  clearInterval(_tkTimer);
  _tkActive = null;
  tkrunTick();

  var statusEl = document.getElementById('tkrun-status');
  if (statusEl) { statusEl.textContent = 'הסתיים'; statusEl.style.background = '#1a3d5c'; statusEl.style.color = '#7db8e8'; }
}

// ── Tick — update display ──────────────────────────────────────────
function tkrunTick() {
  // Sum all sessions
  var totalIn = 0, totalOut = 0, totalMs = 0;
  _tkSessions.forEach(function(s) {
    totalIn  += s.inputTokens  || 0;
    totalOut += s.outputTokens || 0;
    totalMs  += (s.endMs || Date.now()) - s.startMs;
  });

  var totalTokens = totalIn + totalOut;
  var costUSD = (totalIn / 1000 * PRICE_IN) + (totalOut / 1000 * PRICE_OUT);
  var costILS = costUSD * USD_ILS;

  // Active session time
  var dispMs = 0;
  if (_tkActive !== null && _tkSessions[_tkActive]) {
    dispMs = Date.now() - _tkSessions[_tkActive].startMs;
  } else if (_tkSessions.length) {
    var last = _tkSessions[_tkSessions.length - 1];
    dispMs = (last.endMs || last.startMs) - last.startMs;
  }

  var secs  = Math.floor(dispMs / 1000);
  var mins  = Math.floor(secs / 60);
  var timeStr = mins + ':' + String(secs % 60).padStart(2, '0');

  var timeEl   = document.getElementById('tkrun-time');
  var tokensEl = document.getElementById('tkrun-tokens');
  var costEl   = document.getElementById('tkrun-cost');

  if (timeEl)   timeEl.textContent   = timeStr;
  if (tokensEl) tokensEl.textContent = totalTokens.toLocaleString();
  if (costEl)   costEl.textContent   = '₪' + costILS.toFixed(3) + ' ($' + costUSD.toFixed(4) + ')';
}

// ── Show history ──────────────────────────────────────────────────
window.tkrunShowHistory = function() {
  var hist = document.getElementById('tkrun-history');
  var list = document.getElementById('tkrun-hist-list');
  if (!hist || !list) return;

  if (!_tkSessions.length) {
    list.innerHTML = '<div style="color:#666;font-size:11px;text-align:center;padding:10px">אין היסטוריה עדיין</div>';
  } else {
    list.innerHTML = _tkSessions.slice().reverse().map(function(s, i) {
      var dur = ((s.endMs || Date.now()) - s.startMs) / 1000;
      var toks = (s.inputTokens || 0) + (s.outputTokens || 0);
      var cost = ((s.inputTokens||0)/1000*PRICE_IN + (s.outputTokens||0)/1000*PRICE_OUT) * USD_ILS;
      var color = s.status === 'running' ? '#4ade80' : s.status === 'error' ? '#f87171' : '#7db8e8';
      return '<div style="border-bottom:1px solid rgba(255,255,255,0.05);padding:6px 0;font-size:11px">' +
        '<div style="color:#fff;font-weight:700;margin-bottom:2px">' + s.label + '</div>' +
        '<div style="display:flex;gap:10px;color:#666">' +
          '<span style="color:' + color + '">' + dur.toFixed(1) + 'ש\'</span>' +
          '<span>' + toks.toLocaleString() + ' טוקנים</span>' +
          '<span style="color:#4ade80">₪' + cost.toFixed(3) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  hist.style.display = hist.style.display === 'none' ? 'block' : 'none';
};

// ── Reset ─────────────────────────────────────────────────────────
window.tkrunReset = function() {
  _tkSessions = [];
  _tkActive = null;
  clearInterval(_tkTimer);
  var statusEl = document.getElementById('tkrun-status');
  if (statusEl) { statusEl.textContent = 'מוכן'; statusEl.style.background = '#1a3d5c'; statusEl.style.color = '#7db8e8'; }
  var labelEl = document.getElementById('tkrun-label');
  if (labelEl) labelEl.textContent = '';
  tkrunTick();
};

// ── Expose API ────────────────────────────────────────────────────
window.tkrunStart = tkrunStart;
window.tkrunEnd   = tkrunEnd;

// ── Auto-init ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectHUD);
} else {
  injectHUD();
}

console.log('tkrun.js loaded - token/time/cost meter ready');

})();
