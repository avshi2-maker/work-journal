// ══════════════════════════════════════════════════════════════════════
// BUILDING STANDARDS RAG — standards_rag.js
// Connect to Supabase building_standards table + Claude AI search
// ══════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────
var _ragStdLoaded   = false;
var _ragStdResults  = [];

// ── Init: called when RAG tab opens ───────────────────────────────────
async function standardsRagInit() {
  var searchEl = document.getElementById('std-search-input');
  if (searchEl) searchEl.addEventListener('input', debounce(standardsRagSearch, 400));
  var catEl = document.getElementById('std-category-filter');
  if (catEl) catEl.addEventListener('change', standardsRagSearch);
  await standardsRagLoadCategories();
}

// ── Load category filter from DB ──────────────────────────────────────
async function standardsRagLoadCategories() {
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/building_standards?select=industry_category&order=industry_category',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    var rows = await res.json();
    var cats = [...new Set((rows || []).map(function(r){ return r.industry_category; }).filter(Boolean))];
    var sel  = document.getElementById('std-category-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="">כל הקטגוריות</option>' +
      cats.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  } catch(e) { console.error('standardsRagLoadCategories:', e); }
}

// ── Search: keyword search in Supabase ────────────────────────────────
async function standardsRagSearch() {
  var query = (document.getElementById('std-search-input') || {}).value || '';
  var cat   = (document.getElementById('std-category-filter') || {}).value || '';
  var list  = document.getElementById('std-results-list');
  if (!list) return;
  if (!query && !cat) {
    list.innerHTML = '<div style="color:#888;font-size:13px;text-align:center;padding:20px;">הזן מונח חיפוש</div>';
    return;
  }

  list.innerHTML = '<div style="color:#888;font-size:13px;text-align:center;padding:20px;">מחפש...</div>';

  try {
    var params = 'select=*&order=mandatory_in_israel.desc,standard_id.asc&limit=20';
    if (cat) params += '&industry_category=eq.' + encodeURIComponent(cat);
    if (query) {
      // Search across multiple text fields using ilike
      var q = encodeURIComponent('%' + query + '%');
      params += '&or=(standard_id.ilike.' + q +
                ',title_he.ilike.' + q +
                ',title_en.ilike.' + q +
                ',scope.ilike.' + q +
                ',notes.ilike.' + q + ')';
    }

    var res  = await fetch(SB_URL + '/rest/v1/building_standards?' + params,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    var rows = await res.json();
    _ragStdResults = rows || [];

    if (!_ragStdResults.length) {
      list.innerHTML = '<div style="color:#888;font-size:13px;text-align:center;padding:20px;">לא נמצאו תוצאות — נסה מונח אחר</div>';
      return;
    }

    renderStandardsResults(_ragStdResults);

  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:12px;">שגיאה: ' + e.message + '</div>';
  }
}

// ── Render results ────────────────────────────────────────────────────
function renderStandardsResults(rows) {
  var list = document.getElementById('std-results-list');
  if (!list) return;

  var MANDATORY_COLOR = { yes: '#22c55e', no: '#ef4444', partial: '#f59e0b' };
  var MANDATORY_LABEL = { yes: '✅ מחייב בישראל', no: '❌ לא מחייב', partial: '⚠️ חלקי' };
  var AUTH_COLOR = { 'SII (מכון התקנים)': '#1a3d5c', 'EU (CEN)': '#1e40af', 'ISO': '#6d28d9' };

  list.innerHTML = rows.map(function(r, idx) {
    var mandColor = MANDATORY_COLOR[r.mandatory_in_israel] || '#888';
    var mandLabel = MANDATORY_LABEL[r.mandatory_in_israel] || r.mandatory_in_israel;
    var authColor = AUTH_COLOR[r.authority] || '#374151';
    var reqs      = Array.isArray(r.key_requirements) ? r.key_requirements : [];

    return '<div id="std-card-'+r.id+'" style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-right:4px solid '+mandColor+';border-radius:12px;padding:14px 16px;margin-bottom:10px;">' +

      // Header
      '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<div style="background:'+authColor+';color:#fff;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:800;white-space:nowrap;">'+r.standard_id+'</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:14px;font-weight:800;color:#fff;">'+( r.title_he || r.title_en || '')+'</div>' +
          (r.title_en && r.title_he ? '<div style="font-size:11px;color:#888;margin-top:2px;">'+r.title_en+'</div>' : '') +
        '</div>' +
        '<div style="font-size:11px;font-weight:700;color:'+mandColor+';">'+mandLabel+'</div>' +
      '</div>' +

      // Tags
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<span style="background:rgba(255,255,255,0.06);color:#aaa;border-radius:20px;padding:3px 10px;font-size:11px;">'+( r.standard_category||'')+'</span>' +
        '<span style="background:rgba(255,255,255,0.06);color:#aaa;border-radius:20px;padding:3px 10px;font-size:11px;">'+( r.authority||'')+'</span>' +
        (r.applies_to ? '<span style="background:rgba(255,255,255,0.06);color:#aaa;border-radius:20px;padding:3px 10px;font-size:11px;">'+r.applies_to+'</span>' : '') +
      '</div>' +

      // Scope
      (r.scope ? '<div style="font-size:12px;color:#ccc;margin-bottom:10px;line-height:1.6;">'+r.scope+'</div>' : '') +

      // Key requirements
      (reqs.length ? '<div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:10px 12px;margin-bottom:10px;">' +
        '<div style="font-size:10px;font-weight:800;color:#c9a84c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📋 דרישות מרכזיות</div>' +
        reqs.map(function(req){ return '<div style="font-size:12px;color:#ccc;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">▸ '+req+'</div>'; }).join('') +
      '</div>' : '') +

      // Notes
      (r.notes ? '<div style="font-size:12px;color:#f59e0b;background:rgba(245,158,11,0.08);border-radius:6px;padding:8px 10px;margin-bottom:10px;">💡 '+r.notes+'</div>' : '') +

      // AI button
      '<button onclick="standardsAskAI('+idx+')" style="background:linear-gradient(135deg,#7c3aed,#1a3d5c);border:none;color:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🧠 שאל AI על תקן זה</button>' +

    '</div>';
  }).join('');
}

// ── Ask AI about a specific standard ─────────────────────────────────
async function standardsAskAI(idx) {
  var std     = _ragStdResults[idx];
  if (!std) return;
  var question= document.getElementById('std-ai-question');
  var answer  = document.getElementById('std-ai-answer');
  if (!answer) return;

  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('נדרש מפתח API', 'error'); return; }

  var userQ = question ? question.value.trim() : '';
  var prompt = 'אתה מומחה לתקני בנייה ישראליים ובינלאומיים.\n\n' +
    'התקן הבא:\n' +
    'מזהה: ' + std.standard_id + '\n' +
    'שם: ' + (std.title_he || std.title_en) + '\n' +
    'קטגוריה: ' + (std.standard_category || '') + '\n' +
    'תחולה: ' + (std.scope || '') + '\n' +
    'דרישות מרכזיות:\n' + (std.key_requirements || []).map(function(r){ return '- ' + r; }).join('\n') + '\n' +
    'הערות: ' + (std.notes || '') + '\n\n' +
    (userQ ? 'שאלה: ' + userQ : 'תן הסבר מעשי קצר על התקן הזה — מה המהנדס בשטח צריך לדעת ולבדוק?') + '\n\n' +
    'ענה בעברית, בתמציתיות, 3-5 נקודות מעשיות.';

  answer.style.display = 'block';
  answer.innerHTML = '<div style="color:#c4b5fd;font-size:13px;">🧠 שולח לניתוח AI...</div>';

  try {
    var res  = await claudeFetch(JSON.stringify({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    }), null);
    var data = await res.json();
    var text = data.content && data.content[0] && data.content[0].text || '';
    answer.innerHTML =
      '<div style="font-size:11px;font-weight:800;color:#c4b5fd;margin-bottom:8px;text-transform:uppercase;">תשובת AI — ' + std.standard_id + '</div>' +
      '<div style="font-size:13px;color:#fff;line-height:1.7;white-space:pre-wrap;">' + text + '</div>';
  } catch(e) {
    answer.innerHTML = '<div style="color:#ef4444;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// ── Utility: debounce ─────────────────────────────────────────────────
function debounce(fn, ms) {
  var t;
  return function() {
    var args = arguments;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(null, args); }, ms);
  };
}
