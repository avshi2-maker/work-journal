// ══════════════════════════════════════════════════════════════════════
// GAVOIM.JS — גבהים: Heights Deviation Module
// 3-Step wizard: Upload sketch → AI extracts elevations (DRAFT) →
//   Beni enters site readings → Deviation report → Save/Print/Mail/WA/Excel
// ══════════════════════════════════════════════════════════════════════

var _gvStep      = 1;          // current wizard step 1-3
var _gvDraft     = [];         // AI-extracted elevation points (draft)
var _gvActual    = [];         // Beni's site readings
var _gvImageUrl  = null;       // uploaded sketch URL
var _gvProjectId = null;
var _gvLabel     = '';
var _gvTolerance = 5;          // mm tolerance default
var _gvInited    = false;

// ── PUBLIC: init called when laser tab clicked ────────────────────────
function gvInit() {
  if (_gvInited) return;
  _gvInited = true;

  // Inject wizard panel into takeoff-content IF laser tab is active
  var content = document.getElementById('takeoff-content');
  if (!content) return;

  // Add "New Heights Session" button to tab header
  var tabEl = document.getElementById('tk-tab-laser');
  if (tabEl && !document.getElementById('gv-new-btn')) {
    var btn = document.createElement('button');
    btn.id = 'gv-new-btn';
    btn.textContent = '+ מדידה חדשה';
    btn.style.cssText = 'background:#ef4444;border:none;color:#fff;border-radius:8px;padding:6px 14px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;margin-right:8px;position:absolute;left:8px;top:8px;';
    btn.onclick = gvOpenWizard;
    tabEl.style.position = 'relative';
    tabEl.parentElement.style.position = 'relative';
    // Insert after the sub-tabs row
    var filterRow = document.querySelector('#takeoff-search');
    if (filterRow && filterRow.parentElement) {
      var newBtn2 = document.createElement('button');
      newBtn2.id = 'gv-new-btn2';
      newBtn2.innerHTML = '+ מדידת גבהים חדשה';
      newBtn2.style.cssText = 'background:#ef4444;border:none;color:#fff;border-radius:8px;padding:8px 16px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;';
      newBtn2.onclick = gvOpenWizard;
      filterRow.parentElement.insertBefore(newBtn2, filterRow.parentElement.firstChild);
    }
  }
}

// ── OPEN WIZARD ───────────────────────────────────────────────────────
function gvOpenWizard() {
  _gvStep = 1; _gvDraft = []; _gvActual = [];
  _gvImageUrl = null; _gvLabel = ''; _gvProjectId = null;

  var overlay = document.createElement('div');
  overlay.id = 'gv-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;';
  overlay.innerHTML = gvWizardHTML();
  document.body.appendChild(overlay);

  // Populate project dropdown
  var sel = document.getElementById('gv-proj-sel');
  if (sel && window.allProjects) {
    window.allProjects.forEach(function(p){
      var o = document.createElement('option');
      o.value = p.id; o.textContent = p.project_name;
      sel.appendChild(o);
    });
  }
}

function gvClose() {
  var o = document.getElementById('gv-overlay');
  if (o) o.remove();
}

// ── WIZARD HTML ───────────────────────────────────────────────────────
function gvWizardHTML() {
  return '<div style="background:#fff;border-radius:16px;width:100%;max-width:780px;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;">' +

    // Header
    '<div style="background:linear-gradient(135deg,#1a3d5c,#c62828);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div>' +
        '<div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.6);text-transform:uppercase;">מדידת גבהים</div>' +
        '<div style="font-size:18px;font-weight:800;color:#fff;">🔴 אשף מדידת גבהים — 3 שלבים</div>' +
      '</div>' +
      '<button onclick="gvClose()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;">✕ סגור</button>' +
    '</div>' +

    // Step indicators
    '<div style="display:flex;background:#f8f9fc;border-bottom:1px solid #e8e8e8;">' +
      '<div id="gv-si-1" style="flex:1;padding:12px;text-align:center;font-size:12px;font-weight:700;border-bottom:3px solid #ef4444;color:#ef4444;">שלב 1<br>העלאת תרשים</div>' +
      '<div id="gv-si-2" style="flex:1;padding:12px;text-align:center;font-size:12px;font-weight:700;border-bottom:3px solid transparent;color:#aaa;">שלב 2<br>טיוטת AI + קריאות שטח</div>' +
      '<div id="gv-si-3" style="flex:1;padding:12px;text-align:center;font-size:12px;font-weight:700;border-bottom:3px solid transparent;color:#aaa;">שלב 3<br>דוח סטיות + שמירה</div>' +
    '</div>' +

    // Step panels
    '<div id="gv-step-1" style="padding:20px;">' + gvStep1HTML() + '</div>' +
    '<div id="gv-step-2" style="padding:20px;display:none;">' + gvStep2HTML() + '</div>' +
    '<div id="gv-step-3" style="padding:20px;display:none;">' + gvStep3HTML() + '</div>' +

  '</div>';
}

function gvStep1HTML() {
  return '<div style="font-size:14px;font-weight:700;color:#1a3d5c;margin-bottom:16px;">העלה תרשים עם סימוני גבהים</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
      '<div><div style="font-size:12px;color:#666;margin-bottom:6px;">פרויקט</div>' +
        '<select id="gv-proj-sel" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;"><option value="">— בחר פרויקט —</option></select></div>' +
      '<div><div style="font-size:12px;color:#666;margin-bottom:6px;">תווית / שם הסשן</div>' +
        '<input id="gv-label" type="text" placeholder="למשל: יציקת רצפת קומה 1" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
      '<div><div style="font-size:12px;color:#666;margin-bottom:6px;">סבילות (מ"מ) — ברירת מחדל ±5</div>' +
        '<input id="gv-tolerance" type="number" value="5" min="1" max="50" step="1" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
      '<div><div style="font-size:12px;color:#666;margin-bottom:6px;">נקודת ייחוס (datum)</div>' +
        '<input id="gv-datum" type="text" value="±0.00" placeholder="±0.00 = רצפת קומה" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;"></div>' +
    '</div>' +

    // Upload area
    '<div id="gv-upload-area" onclick="document.getElementById(\'gv-file-input\').click()" ' +
      'style="border:2px dashed #ef4444;border-radius:12px;padding:32px;text-align:center;cursor:pointer;background:#fff5f5;margin-bottom:16px;transition:all .2s;" ' +
      'ondragover="event.preventDefault();this.style.background=\'#fee2e2\'" ' +
      'ondrop="gvHandleDrop(event)">' +
      '<div style="font-size:36px;margin-bottom:8px;">🖼️</div>' +
      '<div style="font-size:14px;font-weight:700;color:#c62828;margin-bottom:4px;">לחץ להעלאת תרשים</div>' +
      '<div style="font-size:12px;color:#888;">או גרור תמונה לכאן · JPG / PNG / PDF</div>' +
    '</div>' +
    '<input type="file" id="gv-file-input" accept="image/*,.pdf" style="display:none" onchange="gvHandleFileSelect(this)">' +

    '<div id="gv-preview-wrap" style="display:none;margin-bottom:16px;">' +
      '<div style="font-size:12px;font-weight:700;color:#1a3d5c;margin-bottom:8px;">תצוגה מקדימה:</div>' +
      '<img id="gv-preview-img" style="max-width:100%;border-radius:8px;border:1px solid #e8e8e8;max-height:300px;">' +
    '</div>' +

    // OR manual entry
    '<div style="text-align:center;color:#aaa;font-size:12px;margin-bottom:12px;">— או —</div>' +
    '<button onclick="gvSkipToManual()" style="width:100%;padding:10px;background:#f5f7fa;border:1px solid #ddd;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;color:#555;">' +
      'הכנס נקודות ידנית ללא תרשים' +
    '</button>' +

    '<div id="gv-step1-error" style="display:none;background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#c62828;"></div>' +

    '<div style="display:flex;justify-content:flex-left;margin-top:20px;">' +
      '<button id="gv-btn-step1" onclick="gvRunStep1()" style="background:#ef4444;border:none;color:#fff;border-radius:10px;padding:12px 28px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;">🧠 נתח תרשים עם AI ←</button>' +
    '</div>';
}

function gvStep2HTML() {
  return '<div id="gv-step2-content">' +
    '<div style="font-size:14px;font-weight:700;color:#1a3d5c;margin-bottom:4px;">שלב 2 — בדוק טיוטת AI + הכנס קריאות שטח</div>' +
    '<div style="font-size:12px;color:#888;margin-bottom:16px;">Claude חילץ את נקודות הגובה מהתרשים. ערוך לפי הצורך, הוסף קריאות בני מהלייזר.</div>' +
    '<div id="gv-draft-table-wrap"></div>' +
    '<button onclick="gvAddRow()" style="background:#e8f0fd;border:1px solid #93c5fd;color:#1a3d5c;border-radius:8px;padding:7px 14px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:16px;">+ הוסף נקודה</button>' +
    '<div style="display:flex;gap:8px;margin-top:16px;">' +
      '<button onclick="gvGoStep(1)" style="background:#f5f7fa;border:1px solid #ddd;border-radius:10px;padding:11px 20px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">← חזור</button>' +
      '<button onclick="gvRunStep3()" style="flex:1;background:#1a3d5c;border:none;color:#fff;border-radius:10px;padding:11px 20px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;">חשב סטיות ← צור דוח</button>' +
    '</div>' +
  '</div>';
}

function gvStep3HTML() {
  return '<div id="gv-step3-content">' +
    '<div style="font-size:14px;font-weight:700;color:#1a3d5c;margin-bottom:16px;">שלב 3 — דוח סטיות</div>' +
    '<div id="gv-deviation-report"></div>' +

    // Action bar
    '<div style="background:#f8f9fc;border:1px solid #e8e8e8;border-radius:10px;padding:14px;margin-top:16px;">' +
      '<div style="font-size:12px;font-weight:700;color:#1a3d5c;margin-bottom:10px;">שמור ושתף:</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button onclick="gvSaveToSupabase()" style="flex:1;min-width:100px;padding:10px;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💾 שמור לפרויקט</button>' +
        '<button onclick="gvPrintReport()" style="flex:1;min-width:100px;padding:10px;background:#1a3d5c;border:none;color:#FFD700;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🖨️ הדפס</button>' +
        '<button onclick="gvMailReport()" style="flex:1;min-width:100px;padding:10px;background:#c62828;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✉️ מייל</button>' +
        '<button onclick="gvWAReport()" style="flex:1;min-width:100px;padding:10px;background:#25D366;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">💬 WhatsApp</button>' +
        '<button onclick="gvExcelReport()" style="flex:1;min-width:100px;padding:10px;background:#217346;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📊 Excel</button>' +
      '</div>' +
    '</div>' +

    '<div style="display:flex;gap:8px;margin-top:12px;">' +
      '<button onclick="gvGoStep(2)" style="background:#f5f7fa;border:1px solid #ddd;border-radius:10px;padding:10px 20px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">← ערוך שוב</button>' +
      '<button onclick="gvClose()" style="background:#f5f7fa;border:1px solid #ddd;border-radius:10px;padding:10px 20px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">סגור</button>' +
    '</div>' +
  '</div>';
}

// ── STEP NAVIGATION ───────────────────────────────────────────────────
function gvGoStep(n) {
  _gvStep = n;
  [1,2,3].forEach(function(i){
    var panel = document.getElementById('gv-step-'+i);
    var si    = document.getElementById('gv-si-'+i);
    if (panel) panel.style.display = i===n ? 'block' : 'none';
    if (si) {
      si.style.borderBottomColor = i===n ? '#ef4444' : 'transparent';
      si.style.color = i===n ? '#ef4444' : (i<n ? '#1a3d5c' : '#aaa');
    }
  });
}

// ── FILE HANDLING ─────────────────────────────────────────────────────
function gvHandleDrop(e) {
  e.preventDefault();
  var file = e.dataTransfer.files[0];
  if (file) gvLoadFile(file);
}

function gvHandleFileSelect(input) {
  var file = input.files[0];
  if (file) gvLoadFile(file);
}

function gvLoadFile(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    _gvImageUrl = e.target.result; // base64 data URL
    var preview = document.getElementById('gv-preview-img');
    var wrap    = document.getElementById('gv-preview-wrap');
    if (preview && file.type.startsWith('image/')) {
      preview.src = _gvImageUrl;
      if (wrap) wrap.style.display = 'block';
    }
    var uploadArea = document.getElementById('gv-upload-area');
    if (uploadArea) {
      uploadArea.style.background = '#f0fdf4';
      uploadArea.style.borderColor = '#4caf50';
      uploadArea.innerHTML = '<div style="font-size:24px;">✅</div><div style="font-size:13px;font-weight:700;color:#1b5e20;">'+file.name+'</div>';
    }
  };
  reader.readAsDataURL(file);
}

// ── STEP 1: RUN AI ON SKETCH ──────────────────────────────────────────
async function gvRunStep1() {
  var labelEl    = document.getElementById('gv-label');
  var projSel    = document.getElementById('gv-proj-sel');
  var tolEl      = document.getElementById('gv-tolerance');
  var datumEl    = document.getElementById('gv-datum');
  var errorEl    = document.getElementById('gv-step1-error');
  var btn        = document.getElementById('gv-btn-step1');

  _gvLabel     = labelEl  ? labelEl.value  : '';
  _gvProjectId = projSel  ? projSel.value  : null;
  _gvTolerance = tolEl    ? parseFloat(tolEl.value)||5 : 5;
  var datum    = datumEl  ? datumEl.value  : '±0.00';

  if (errorEl) errorEl.style.display = 'none';

  // If no image — skip to manual
  if (!_gvImageUrl) { gvSkipToManual(); return; }

  var apiKey = window.APP && window.APP.config && window.APP.config.anthropic_key;
  if (!apiKey) { if(errorEl){errorEl.style.display='block';errorEl.textContent='אין מפתח API';} return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Claude מנתח...'; }

  try {
    var base64 = _gvImageUrl.split(',')[1];
    var mime   = _gvImageUrl.split(';')[0].split(':')[1] || 'image/jpeg';

    var prompt = [
      'This is an architectural drawing with elevation/height marks scattered across it.',
      'Extract ALL elevation marks visible (numbers with +, -, or ± prefix, in metres).',
      'For each mark identify: what element it refers to (floor, ceiling, slab, wall top, beam bottom, foundation, ridge, etc.),',
      'its approximate location on the drawing (describe position: e.g. "floor level north section"),',
      'and the numeric value in metres.',
      'Also identify the datum reference (±0.00 point) if visible.',
      'Return ONLY valid JSON, no other text:',
      '{"datum":"' + datum + '","points":[{"name":"element name in Hebrew","stated":1.20,"location":"description","element_type":"floor/ceiling/slab/wall/beam/other"}],"notes":"any general observation"}'
    ].join(' ');

    var raw = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'You are an expert at reading Israeli architectural drawings and elevation marks. Extract ALL numerical elevation data. Return only valid JSON.',
      messages: [{role:'user', content:[
        {type:'image', source:{type:'base64', media_type:mime, data:base64}},
        {type:'text',  text: prompt}
      ]}]
    }, null);

    var resp    = raw && typeof raw.json==='function' ? await raw.json() : raw;
    var rawText = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
    rawText = rawText.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    var jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) rawText = jsonMatch[0];

    var parsed = JSON.parse(rawText);
    _gvDraft = parsed.points || [];

    // Pre-populate actual readings with stated values (Beni will overwrite with real readings)
    _gvActual = _gvDraft.map(function(p, i){
      return {
        id: i,
        name: p.name || ('נקודה '+(i+1)),
        location: p.location || '',
        element_type: p.element_type || 'other',
        stated: p.stated,
        actual: null  // Beni fills this
      };
    });

    gvRenderDraftTable();
    gvGoStep(2);

  } catch(e) {
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = 'שגיאה: ' + e.message + ' — אנא נסה שוב או הכנס ידנית';
    }
    // Fall back to manual with empty table
    _gvActual = [];
    gvRenderDraftTable();
    gvGoStep(2);
  }

  if (btn) { btn.disabled = false; btn.textContent = '🧠 נתח תרשים עם AI ←'; }
}

function gvSkipToManual() {
  _gvDraft  = [];
  _gvActual = [{id:0, name:'', location:'', element_type:'floor', stated:null, actual:null}];
  var labelEl = document.getElementById('gv-label');
  var projSel = document.getElementById('gv-proj-sel');
  var tolEl   = document.getElementById('gv-tolerance');
  _gvLabel     = labelEl ? labelEl.value  : '';
  _gvProjectId = projSel ? projSel.value  : null;
  _gvTolerance = tolEl   ? parseFloat(tolEl.value)||5 : 5;
  gvRenderDraftTable();
  gvGoStep(2);
}

// ── DRAFT TABLE ───────────────────────────────────────────────────────
function gvRenderDraftTable() {
  var wrap = document.getElementById('gv-draft-table-wrap');
  if (!wrap) return;

  if (_gvActual.length === 0) {
    _gvActual = [{id:0, name:'', location:'', element_type:'floor', stated:null, actual:null}];
  }

  var html = '<div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#7a5500;">' +
    '<b>טיוטת AI — ערוך לפי הצורך</b><br>' +
    'גובה מתוכנן = מה שרשום בתרשים | קריאת בני = מה שמדד בלייזר בשטח' +
  '</div>' +
  '<div style="overflow-x:auto;">' +
  '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
  '<thead><tr style="background:#1a3d5c;">' +
    '<th style="padding:8px 6px;text-align:right;color:#FFD700;font-weight:700;">שם נקודה</th>' +
    '<th style="padding:8px 6px;text-align:center;color:#FFD700;font-weight:700;">סוג אלמנט</th>' +
    '<th style="padding:8px 6px;text-align:center;color:#FFD700;font-weight:700;">גובה מתוכנן (מ\')</th>' +
    '<th style="padding:8px 6px;text-align:center;color:#c9a84c;font-weight:700;background:#1e4a6e;">קריאת בני (מ\')</th>' +
    '<th style="padding:8px 4px;text-align:center;color:#FFD700;font-weight:700;width:32px;"></th>' +
  '</tr></thead>' +
  '<tbody>';

  _gvActual.forEach(function(row, i){
    var types = ['floor','ceiling','slab','wall','beam','ridge','other'];
    var typeLabels = {floor:'רצפה',ceiling:'תקרה',slab:'יציקה',wall:'קיר',beam:'קורה',ridge:'שליל',other:'אחר'};
    var typeOpts = types.map(function(t){
      return '<option value="'+t+'"'+(row.element_type===t?' selected':'')+'>'+typeLabels[t]+'</option>';
    }).join('');

    html +=
      '<tr style="border-bottom:1px solid #f0f0f0;">' +
        '<td style="padding:6px 4px;">' +
          '<input type="text" value="'+gvEsc(row.name||'')+'" placeholder="שם / תיאור" ' +
            'onchange="_gvActual['+i+'].name=this.value" ' +
            'style="width:100%;border:1px solid #ddd;border-radius:6px;padding:5px 7px;font-family:Heebo,sans-serif;font-size:12px;box-sizing:border-box;">' +
        '</td>' +
        '<td style="padding:6px 4px;">' +
          '<select onchange="_gvActual['+i+'].element_type=this.value" ' +
            'style="width:100%;border:1px solid #ddd;border-radius:6px;padding:5px;font-family:Heebo,sans-serif;font-size:11px;direction:rtl;">' +
            typeOpts + '</select>' +
        '</td>' +
        '<td style="padding:6px 4px;">' +
          '<input type="number" step="0.01" value="'+(row.stated!==null?row.stated:'')+'" placeholder="+0.00" ' +
            'onchange="_gvActual['+i+'].stated=parseFloat(this.value)||null" ' +
            'style="width:80px;border:1px solid #ddd;border-radius:6px;padding:5px;font-family:Heebo,sans-serif;font-size:12px;text-align:center;box-sizing:border-box;">' +
        '</td>' +
        '<td style="padding:6px 4px;background:rgba(201,168,76,0.06);">' +
          '<input type="number" step="0.001" value="'+(row.actual!==null?row.actual:'')+'" placeholder="הכנס כאן" ' +
            'onchange="_gvActual['+i+'].actual=parseFloat(this.value)||null" ' +
            'style="width:90px;border:2px solid #c9a84c;border-radius:6px;padding:5px;font-family:Heebo,sans-serif;font-size:12px;text-align:center;box-sizing:border-box;background:#fffbf0;">' +
        '</td>' +
        '<td style="padding:6px 2px;text-align:center;">' +
          '<button onclick="gvDeleteRow('+i+')" style="background:#fee2e2;border:none;color:#c62828;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">×</button>' +
        '</td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}

function gvAddRow() {
  _gvActual.push({id:_gvActual.length, name:'', location:'', element_type:'floor', stated:null, actual:null});
  gvRenderDraftTable();
}

function gvDeleteRow(i) {
  _gvActual.splice(i,1);
  gvRenderDraftTable();
}

// ── STEP 3: DEVIATION REPORT ──────────────────────────────────────────
function gvRunStep3() {
  gvGoStep(3);
  gvRenderDeviationReport();
}

function gvRenderDeviationReport() {
  var wrap = document.getElementById('gv-deviation-report');
  if (!wrap) return;

  var tol   = _gvTolerance;
  var rows  = _gvActual.filter(function(r){ return r.stated!==null && r.actual!==null; });
  var skipped = _gvActual.filter(function(r){ return r.stated===null || r.actual===null; });

  if (rows.length === 0) {
    wrap.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:13px;">אין נקודות עם גובה מתוכנן וקריאה — חזור ומלא נתונים</div>';
    return;
  }

  // Calculate deviations
  var computed = rows.map(function(r){
    var dev_m  = r.actual - r.stated;           // metres deviation
    var dev_mm = Math.round(dev_m * 1000);       // mm
    var absDev = Math.abs(dev_mm);
    var status = absDev <= tol ? 'pass' : (absDev <= tol*3 ? 'warn' : 'fail');
    return Object.assign({}, r, {dev_mm: dev_mm, absDev: absDev, status: status});
  });

  var fails = computed.filter(function(r){ return r.status==='fail'; }).length;
  var warns = computed.filter(function(r){ return r.status==='warn'; }).length;
  var maxDev = Math.max.apply(null, computed.map(function(r){ return r.absDev; }));
  var avgDev = Math.round(computed.reduce(function(s,r){return s+r.absDev;},0)/computed.length);
  var verdict = fails>0 ? 'fail' : warns>0 ? 'warn' : 'pass';
  var verdictColor = verdict==='fail'?'#c62828':verdict==='warn'?'#f59e0b':'#1b5e20';
  var verdictBg    = verdict==='fail'?'#fff5f5':verdict==='warn'?'#fffbf0':'#e8f5e9';
  var verdictText  = verdict==='fail'
    ? '⚠️ נמצאו '+fails+' חריגות קריטיות — נדרשת בדיקת מהנדס'
    : verdict==='warn'
    ? '🟡 נמצאו '+warns+' נקודות אזהרה — בדוק לפני המשך'
    : '✅ כל הנקודות בתוך הסבילות (±'+tol+' מ"מ) — תקין להמשך';

  // Store for sharing
  window._gvReportData = {computed:computed, skipped:skipped, tol:tol, maxDev:maxDev, avgDev:avgDev, fails:fails, warns:warns, verdict:verdict, label:_gvLabel};

  var html =
    // Summary cards
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px;">' +
      '<div style="background:#f5f7fa;border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:800;color:#1a3d5c;">'+rows.length+'</div>' +
        '<div style="font-size:10px;color:#888;">נקודות מדידה</div>' +
      '</div>' +
      '<div style="background:'+(fails>0?'#fff5f5':'#e8f5e9')+';border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:800;color:'+(fails>0?'#c62828':'#1b5e20')+';">'+maxDev+'</div>' +
        '<div style="font-size:10px;color:#888;">סטייה מקס\' מ"מ</div>' +
      '</div>' +
      '<div style="background:#f5f7fa;border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:800;color:#1a3d5c;">'+avgDev+'</div>' +
        '<div style="font-size:10px;color:#888;">סטייה ממוצעת מ"מ</div>' +
      '</div>' +
      '<div style="background:'+(fails>0?'#fff5f5':warns>0?'#fffbf0':'#e8f5e9')+';border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:20px;font-weight:800;color:'+verdictColor+';">'+(fails+warns||'✓')+'</div>' +
        '<div style="font-size:10px;color:#888;">חריגות</div>' +
      '</div>' +
    '</div>' +

    // Verdict banner
    '<div style="background:'+verdictBg+';border:2px solid '+verdictColor+';border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:700;color:'+verdictColor+';">' +
      verdictText +
    '</div>' +

    // Table
    '<div style="overflow-x:auto;margin-bottom:12px;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr style="background:#1a3d5c;">' +
      '<th style="padding:8px 8px;text-align:right;color:#FFD700;">#</th>' +
      '<th style="padding:8px 8px;text-align:right;color:#FFD700;">נקודה</th>' +
      '<th style="padding:8px 8px;text-align:center;color:#FFD700;">סוג</th>' +
      '<th style="padding:8px 8px;text-align:center;color:#FFD700;">תוכנן (מ\')</th>' +
      '<th style="padding:8px 8px;text-align:center;color:#c9a84c;">נמדד (מ\')</th>' +
      '<th style="padding:8px 8px;text-align:center;color:#FFD700;">סטייה (מ"מ)</th>' +
      '<th style="padding:8px 8px;text-align:center;color:#FFD700;">סטטוס</th>' +
    '</tr></thead><tbody>';

  var typeLabels = {floor:'רצפה',ceiling:'תקרה',slab:'יציקה',wall:'קיר',beam:'קורה',ridge:'שליל',other:'אחר'};

  computed.forEach(function(r, i){
    var rowBg = r.status==='fail'?'rgba(239,68,68,0.06)':r.status==='warn'?'rgba(245,158,11,0.06)':'';
    var devColor = r.status==='fail'?'#c62828':r.status==='warn'?'#f59e0b':'#1b5e20';
    var statusIcon = r.status==='fail'?'🔴 חריגה':r.status==='warn'?'🟡 אזהרה':'🟢 תקין';
    html +=
      '<tr style="border-bottom:1px solid #f0f0f0;background:'+rowBg+';">' +
        '<td style="padding:7px 8px;color:#888;">'+(i+1)+'</td>' +
        '<td style="padding:7px 8px;font-weight:700;">'+gvEsc(r.name)+'</td>' +
        '<td style="padding:7px 8px;text-align:center;color:#888;">'+(typeLabels[r.element_type]||r.element_type)+'</td>' +
        '<td style="padding:7px 8px;text-align:center;">'+r.stated.toFixed(3)+'</td>' +
        '<td style="padding:7px 8px;text-align:center;font-weight:700;color:#c9a84c;">'+r.actual.toFixed(3)+'</td>' +
        '<td style="padding:7px 8px;text-align:center;font-weight:800;color:'+devColor+';">'+(r.dev_mm>=0?'+':'')+r.dev_mm+'</td>' +
        '<td style="padding:7px 8px;text-align:center;font-size:11px;font-weight:700;color:'+devColor+';">'+statusIcon+'</td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';

  if (skipped.length > 0) {
    html += '<div style="font-size:11px;color:#aaa;margin-top:6px;">'+skipped.length+' נקודות ללא נתונים מלאים — לא נכללות בדוח</div>';
  }

  wrap.innerHTML = html;
}

// ── SAVE TO SUPABASE ──────────────────────────────────────────────────
async function gvSaveToSupabase() {
  var d = window._gvReportData;
  if (!d || !d.computed || d.computed.length === 0) { showToast('אין נתונים לשמירה','error'); return; }

  var rows = d.computed.map(function(r){
    return {
      point:     r.name,
      reading:   r.actual,
      stated:    r.stated,
      deviation: r.dev_mm,
      status:    r.status==='fail'?'red':r.status==='warn'?'yellow':'green',
      element_type: r.element_type
    };
  });

  var total = d.computed.reduce(function(s,r){ return s+(r.actual||0); }, 0);
  var proj = _gvProjectId && window.allProjects
    ? (window.allProjects.find(function(p){ return p.id===_gvProjectId; })||null) : null;

  try {
    var payload = {
      session_label: _gvLabel || ('מדידת גבהים — '+new Date().toLocaleDateString('he-IL')),
      rows:          JSON.stringify(rows),
      total_area:    0,
      takeoff_type:  'laser',
      tolerance:     _gvTolerance,
      submitted_by:  'בני',
      takeoff_date:  new Date().toISOString().split('T')[0],
      notes:         'סטייה מקס: '+d.maxDev+' מ"מ | חריגות: '+d.fails,
      created_at:    new Date().toISOString()
    };
    if (_gvProjectId)       payload.project_id   = _gvProjectId;
    if (proj)               payload.project_name = proj.project_name;

    var res = await fetch(window.SB_URL+'/rest/v1/site_takeoffs', {
      method: 'POST',
      headers: {
        apikey: window.SB_KEY, Authorization: 'Bearer '+window.SB_KEY,
        'Content-Type': 'application/json', Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { var et=await res.text(); throw new Error('HTTP '+res.status+' '+et.substr(0,80)); }
    showToast('✅ נשמר לטאב גבהים בפרויקט','success');
    if (typeof loadTakeoffs === 'function') setTimeout(loadTakeoffs, 500);
  } catch(e) {
    showToast('שגיאה: '+e.message,'error');
  }
}

// ── SHARE FUNCTIONS ───────────────────────────────────────────────────
function gvPrintReport() {
  var d = window._gvReportData;
  if (!d) return;
  var html = gvBuildPrintHTML(d);
  var w = window.open('','_blank','width=900,height:700');
  if (w) { w.document.write(html); w.document.close(); }
}

function gvMailReport() {
  var d = window._gvReportData;
  if (!d) return;
  var nl = '\n';
  var body = 'דוח מדידת גבהים — '+(_gvLabel||'')+nl+
    '========================'+nl+
    'סבילות: ±'+d.tol+' מ"מ | סטייה מקסימלית: '+d.maxDev+' מ"מ | חריגות: '+d.fails+nl+nl;
  d.computed.forEach(function(r,i){
    body += (i+1)+'. '+r.name+' | תוכנן: '+r.stated.toFixed(3)+' | נמדד: '+r.actual.toFixed(3)+' | סטייה: '+(r.dev_mm>=0?'+':'')+r.dev_mm+' מ"מ | '+(r.status==='fail'?'חריגה':r.status==='warn'?'אזהרה':'תקין')+nl;
  });
  window.location.href = 'mailto:?subject='+encodeURIComponent('דוח גבהים — '+(_gvLabel||'')+'  — '+d.fails+' חריגות')+'&body='+encodeURIComponent(body);
}

function gvWAReport() {
  var d = window._gvReportData;
  if (!d) return;
  var nl = '\n';
  var msg = '*דוח מדידת גבהים*'+nl+(_gvLabel?_gvLabel+nl:'')+
    'סבילות: ±'+d.tol+' מ"מ'+nl+
    'סטייה מקס: *'+d.maxDev+' מ"מ*'+nl+
    'חריגות: *'+d.fails+'*'+nl+nl;
  d.computed.slice(0,10).forEach(function(r){
    var icon = r.status==='fail'?'🔴':r.status==='warn'?'🟡':'🟢';
    msg += icon+' '+r.name+': '+(r.dev_mm>=0?'+':'')+r.dev_mm+' מ"מ'+nl;
  });
  if (d.computed.length > 10) msg += '... ועוד '+(d.computed.length-10)+' נקודות'+nl;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

async function gvExcelReport() {
  var d = window._gvReportData;
  if (!d || !d.computed.length) { showToast('אין נתונים','error'); return; }
  if (typeof XLSX === 'undefined') {
    await new Promise(function(res,rej){
      var s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }
  var wb = XLSX.utils.book_new();
  var wsData = [];
  wsData.push(['דוח מדידת גבהים — '+(_gvLabel||''), '', '', '', '', '', '']);
  wsData.push(['תאריך: '+new Date().toLocaleDateString('he-IL')+'  |  סבילות: ±'+d.tol+' מ"מ  |  נמדד: בני פרסקי']);
  wsData.push([]);
  wsData.push(['#', 'שם נקודה', 'סוג אלמנט', 'גובה תוכנן (מ\')', 'גובה נמדד (מ\')', 'סטייה (מ"מ)', 'סטטוס']);
  var typeLabels = {floor:'רצפה',ceiling:'תקרה',slab:'יציקה',wall:'קיר',beam:'קורה',ridge:'שליל',other:'אחר'};
  d.computed.forEach(function(r,i){
    wsData.push([
      i+1, r.name, typeLabels[r.element_type]||r.element_type,
      r.stated, r.actual,
      r.dev_mm,
      r.status==='fail'?'חריגה קריטית':r.status==='warn'?'אזהרה':'תקין'
    ]);
  });
  wsData.push([]);
  wsData.push(['סיכום', '', '', '', '', '', '']);
  wsData.push(['נקודות שנמדדו', d.computed.length]);
  wsData.push(['סטייה מקסימלית (מ"מ)', d.maxDev]);
  wsData.push(['סטייה ממוצעת (מ"מ)', d.avgDev]);
  wsData.push(['חריגות קריטיות', d.fails]);
  wsData.push(['אזהרות', d.warns]);
  wsData.push(['תוצאה כללית', d.verdict==='fail'?'נדרש תיקון':d.verdict==='warn'?'דורש בדיקה':'תקין']);
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:4},{wch:22},{wch:12},{wch:16},{wch:16},{wch:14},{wch:16}];
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:6}}];
  XLSX.utils.book_append_sheet(wb, ws, 'מדידת גבהים');
  var fname = ('גבהים_'+(_gvLabel||'דוח')).replace(/[\/\\:*?"<>|]/g,'_')+'_'+new Date().toLocaleDateString('he-IL').replace(/\//g,'-')+'.xlsx';
  XLSX.writeFile(wb, fname);
  showToast('📊 Excel הורד','success');
}

function gvBuildPrintHTML(d) {
  var typeLabels = {floor:'רצפה',ceiling:'תקרה',slab:'יציקה',wall:'קיר',beam:'קורה',ridge:'שליל',other:'אחר'};
  var verdictColor = d.verdict==='fail'?'#c62828':d.verdict==='warn'?'#f59e0b':'#1b5e20';
  var verdictText  = d.verdict==='fail'?'נמצאו '+d.fails+' חריגות קריטיות — נדרשת בדיקת מהנדס':d.verdict==='warn'?'נמצאו '+d.warns+' נקודות אזהרה':'כל הנקודות תקינות';
  var rows = d.computed.map(function(r,i){
    var fail = r.status==='fail', warn=r.status==='warn';
    return '<tr style="background:'+(fail?'#fff5f5':warn?'#fffbf0':'')+';border-bottom:1px solid #eee;">'+
      '<td>'+(i+1)+'</td>'+
      '<td>'+r.name+'</td>'+
      '<td style="text-align:center">'+(typeLabels[r.element_type]||'')+'</td>'+
      '<td style="text-align:center">'+r.stated.toFixed(3)+'</td>'+
      '<td style="text-align:center;font-weight:700;color:#c9a84c">'+r.actual.toFixed(3)+'</td>'+
      '<td style="text-align:center;font-weight:800;color:'+(fail?'#c62828':warn?'#f59e0b':'#1b5e20')+'">'+(r.dev_mm>=0?'+':'')+r.dev_mm+'</td>'+
      '<td style="text-align:center">'+(fail?'🔴 חריגה':warn?'🟡 אזהרה':'🟢 תקין')+'</td>'+
    '</tr>';
  }).join('');
  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח גבהים</title>'+
    '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:30px;color:#222}'+
    'h1{color:#1a3d5c;border-bottom:3px solid #ef4444;padding-bottom:8px}'+
    '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}'+
    '.sum-box{border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}'+
    '.sum-val{font-size:22px;font-weight:900;color:#1a3d5c}'+
    'table{width:100%;border-collapse:collapse;font-size:12px}'+
    'th{background:#1a3d5c;color:#FFD700;padding:9px 8px;text-align:right}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<div class="noprint" style="margin-bottom:16px">'+
      '<button onclick="window.print()" style="background:#1a3d5c;color:#FFD700;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer">🖨️ הדפס</button>'+
      '<button onclick="window.close()" style="background:#888;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;margin-right:8px">סגור</button>'+
    '</div>'+
    '<h1>🔴 דוח מדידת גבהים — '+gvEsc(_gvLabel||'')+'</h1>'+
    '<div style="font-size:12px;color:#666;margin-bottom:16px">תאריך: '+new Date().toLocaleDateString('he-IL')+' | סבילות: ±'+d.tol+' מ"מ | נמדד: בני פרסקי</div>'+
    '<div class="summary">'+
      '<div class="sum-box"><div class="sum-val">'+d.computed.length+'</div><div style="font-size:11px;color:#666">נקודות</div></div>'+
      '<div class="sum-box"><div class="sum-val" style="color:'+(d.fails?'#c62828':'#1b5e20')+'">'+d.maxDev+'</div><div style="font-size:11px;color:#666">סטייה מקס\' מ"מ</div></div>'+
      '<div class="sum-box"><div class="sum-val">'+d.avgDev+'</div><div style="font-size:11px;color:#666">ממוצע מ"מ</div></div>'+
      '<div class="sum-box"><div class="sum-val" style="color:'+verdictColor+'">'+d.fails+'</div><div style="font-size:11px;color:#666">חריגות</div></div>'+
    '</div>'+
    '<div style="background:'+(d.verdict==='fail'?'#fff5f5':d.verdict==='warn'?'#fffbf0':'#e8f5e9')+';border:2px solid '+verdictColor+';border-radius:8px;padding:12px;margin-bottom:16px;font-weight:700;color:'+verdictColor+'">'+verdictText+'</div>'+
    '<table><thead><tr><th>#</th><th>נקודה</th><th>סוג</th><th>תוכנן (מ\')</th><th>נמדד (מ\')</th><th>סטייה (מ"מ)</th><th>סטטוס</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>'+
    '<div style="margin-top:20px;font-size:10px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:10px">בני פרסקי ניהול פרויקטים | '+new Date().toLocaleDateString('he-IL')+'</div>'+
    '</body></html>';
}

// ── UTIL ──────────────────────────────────────────────────────────────
function gvEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
