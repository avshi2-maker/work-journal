// ══════════════════════════════════════════════════════════════════════
// gavoim.js — מדידת גבהים לייזר
// 3 modes: A=blank CSV printout, B=42-point simulation, C=manual entry
// Table: gavoim_sessions
// ══════════════════════════════════════════════════════════════════════

var _gvSessions   = [];
var _gvActive     = null;  // active session being edited
var _gvMode       = null;  // 'a' | 'b' | 'c'
var _gvPoints     = [];    // current session points

// ── INIT ──────────────────────────────────────────────────────────────
async function gvInit() {
  gvRenderShell();
  await gvLoadSessions();
}

function gvRenderShell() {
  var panel = document.getElementById('gavoim-wrap');
  if (!panel) return;
  panel.innerHTML =
    '<div style="padding:20px 24px;padding-top:20px;direction:rtl;font-family:Heebo,Arial,sans-serif;background:#f5f0e8;min-height:100vh;">' +

    // Header
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
      '<div>' +
        '<div style="font-size:9px;letter-spacing:2px;color:#9a6f00;font-weight:800;text-transform:uppercase;margin-bottom:2px;">Laser Leveling</div>' +
        '<div style="font-size:22px;font-weight:900;color:#1a3d5c;">🔴 מדידת גבהים לייזר</div>' +
      '</div>' +
      '<button onclick="gvNewSession()" style="background:#1a3d5c;border:none;color:#FFD700;padding:10px 18px;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">+ מדידה חדשה</button>' +
    '</div>' +

    // 3 template buttons
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">' +

      // A - Blank field sheet
      '<div style="background:#fff;border:1.5px solid #c9a84c;border-radius:12px;padding:16px;cursor:pointer;" onclick="gvStartMode(\'a\')">' +
        '<div style="font-size:24px;margin-bottom:8px;">📋</div>' +
        '<div style="font-size:13px;font-weight:900;color:#1a3d5c;margin-bottom:6px;">A — גיליון שטח ריק</div>' +
        '<div style="font-size:11px;color:#888;line-height:1.7;">הדפס גיליון עם 20 שורות ריקות<br>מלא בעפרון בשטח<br>צלם ← OCR ← שמור</div>' +
      '</div>' +

      // B - 42-point simulation
      '<div style="background:#fff;border:1.5px solid #ef4444;border-radius:12px;padding:16px;cursor:pointer;" onclick="gvStartMode(\'b\')">' +
        '<div style="font-size:24px;margin-bottom:8px;">🗺️</div>' +
        '<div style="font-size:13px;font-weight:900;color:#1a3d5c;margin-bottom:6px;">B — סימולציה 42 נקודות</div>' +
        '<div style="font-size:11px;color:#888;line-height:1.7;">גריד 3×3 מ׳ לחדר 20×15 מ׳<br>נתוני דוגמה אמיתיים<br>צור דוח + מפה + PDF</div>' +
      '</div>' +

      // C - Manual entry
      '<div style="background:#fff;border:1.5px solid #22c55e;border-radius:12px;padding:16px;cursor:pointer;" onclick="gvStartMode(\'c\')">' +
        '<div style="font-size:24px;margin-bottom:8px;">⌨️</div>' +
        '<div style="font-size:13px;font-weight:900;color:#1a3d5c;margin-bottom:6px;">C — הזנה ידנית</div>' +
        '<div style="font-size:11px;color:#888;line-height:1.7;">הזן קריאות לייזר ישירות<br>ללא צילום ו-OCR<br>שמור → דוח מיידי</div>' +
      '</div>' +

    '</div>' +

    // Active form area
    '<div id="gv-form-area"></div>' +

    // Sessions list
    '<div id="gv-sessions-list"></div>' +

    '</div>';
}

// ── MODE STARTER ──────────────────────────────────────────────────────
function gvStartMode(mode) {
  _gvMode   = mode;
  _gvActive = null;
  _gvPoints = [];
  var area = document.getElementById('gv-form-area');
  if (!area) return;

  if (mode === 'a') gvRenderModeA(area);
  if (mode === 'b') gvRenderModeB(area);
  if (mode === 'c') gvRenderModeC(area);
  area.scrollIntoView({behavior:'smooth'});
}

// ══ MODE A — Blank Field Sheet ═════════════════════════════════════════
function gvRenderModeA(area) {
  var projOpts = '<option value="">— בחר פרויקט —</option>';
  (window.allProjects||[]).forEach(function(p){ projOpts += '<option value="'+p.id+'">'+gvEsc(p.project_name)+'</option>'; });

  area.innerHTML =
    '<div style="background:#fff;border:1.5px solid #c9a84c;border-radius:14px;padding:20px;margin-bottom:20px;">' +
      '<div style="font-size:14px;font-weight:900;color:#1a3d5c;margin-bottom:14px;">📋 A — גיליון שטח ריק להדפסה</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">פרויקט</div>'+
          '<select id="gv-a-proj" style="'+gvInp()+'">'+projOpts+'</select></div>' +
        '<div style="grid-column:span 2"><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">חדר / אזור (שם מלא)</div>'+
          '<input id="gv-a-room" type="text" placeholder="לדוגמה: סלון + פינת אוכל + מטבח קומה 1 — Villa 2026" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">תאריך</div>'+
          '<input id="gv-a-date" type="date" value="'+new Date().toISOString().split('T')[0]+'" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">שטח כולל (מ"ר)</div>'+
          '<input id="gv-a-area" type="number" placeholder="300" style="'+gvInp()+'"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button onclick="gvPrintBlankSheet()" style="flex:1;padding:11px;background:#1a3d5c;border:none;color:#FFD700;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🖨️ הדפס גיליון ריק</button>' +
        '<button onclick="gvOpenOCR(\'a\')" style="flex:1;padding:11px;background:#c9a84c;border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📷 צלם גיליון מלא → OCR</button>' +
      '</div>' +
    '</div>';
}

function gvPrintBlankSheet() {
  var room = (document.getElementById('gv-a-room')||{}).value||'___________';
  var date = (document.getElementById('gv-a-date')||{}).value||'___________';
  var area = (document.getElementById('gv-a-area')||{}).value||'___';
  var projId = (document.getElementById('gv-a-proj')||{}).value||'';
  var proj = projId ? ((window.allProjects||[]).find(function(p){return p.id===projId;})||{}).project_name||'': '';

  var rows = '';
  for (var i=1; i<=25; i++) {
    rows += '<tr style="height:32px;">' +
      '<td style="border:1px solid #ccc;padding:4px 8px;text-align:center;color:#999;font-size:12px;">'+i+'</td>' +
      '<td style="border:1px solid #ccc;padding:4px 8px;"></td>' +
      '<td style="border:1px solid #ccc;padding:4px 8px;"></td>' +
      '<td style="border:1px solid #ccc;padding:4px 8px;"></td>' +
      '<td style="border:1px solid #ccc;padding:4px 8px;"></td>' +
      '<td style="border:1px solid #ccc;padding:4px 8px;"></td>' +
      '</tr>';
  }

  var html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Heebo,Arial,sans-serif;direction:rtl;padding:16px;font-size:13px;}' +
    'table{width:100%;border-collapse:collapse;margin-top:12px;}' +
    'th{background:#1a3d5c;color:#FFD700;padding:8px;text-align:center;font-size:12px;}' +
    'td{border:1px solid #ccc;padding:6px;}' +
    'h2{color:#1a3d5c;margin:0 0 4px 0;font-size:18px;}' +
    '.meta{font-size:12px;color:#555;margin-bottom:12px;}' +
    '.footer{margin-top:16px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:8px;}' +
    '@media print{button{display:none!important;}}' +
    '</style></head><body>' +
    '<h2>🔴 גיליון מדידת גבהים לייזר</h2>' +
    '<div class="meta">' +
      (proj ? '<b>פרויקט:</b> '+gvEsc(proj)+' &nbsp;|&nbsp; ' : '') +
      '<b>חדר / אזור:</b> '+gvEsc(room)+' &nbsp;|&nbsp; ' +
      '<b>תאריך:</b> '+date+' &nbsp;|&nbsp; ' +
      '<b>שטח:</b> '+area+' מ"ר' +
    '</div>' +
    '<div style="background:#fff8e0;border:1px solid #c9a84c;border-radius:6px;padding:8px 12px;font-size:11px;margin-bottom:10px;">' +
      '📐 הוראות: אין צורך לכתוב P — מספר השורה הוא שם הנקודה | BM = קריאה ראשונה (נקודת ייחוס) | גריד 3×3 מ׳ | הזן X/Y + קריאת לייזר לכל נקודה' +
    '</div>' +
    '<table>' +
      '<tr>' +
        '<th style="width:32px;">מס׳</th>' +
        '<th style="width:35%;">שם נקודה / מיקום בחדר</th>' +
        '<th style="width:10%;">X (מ׳)</th>' +
        '<th style="width:10%;">Y (מ׳)</th>' +
        '<th style="width:18%;">קריאת לייזר (מ׳)</th>' +
        '<th>הערות / סטייה</th>' +
      '</tr>' +
      rows +
    '</table>' +
    '<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">' +
      '<div style="border:1.5px solid #1a3d5c;border-radius:8px;padding:12px;">' +
        '<b style="font-size:12px;color:#1a3d5c;">📏 Benchmark (BM):</b><br>' +
        '<div style="height:32px;border-bottom:1.5px solid #1a3d5c;margin-top:8px;"></div>' +
        '<div style="font-size:10px;color:#888;margin-top:4px;">קריאת ייחוס קבועה (מ׳) — לא להזיז מוט!</div>' +
      '</div>' +
      '<div style="border:1px solid #ccc;border-radius:8px;padding:12px;">' +
        '<b style="font-size:12px;">🔧 מיקום לייזר:</b><br>' +
        '<div style="height:32px;border-bottom:1px solid #ddd;margin-top:8px;"></div>' +
        '<div style="font-size:10px;color:#888;margin-top:4px;">מיקום החצובה (X, Y)</div>' +
      '</div>' +
      '<div style="border:1px solid #ccc;border-radius:8px;padding:12px;">' +
        '<b style="font-size:12px;">✍️ מפעיל:</b><br>' +
        '<div style="height:32px;border-bottom:1px solid #ddd;margin-top:8px;"></div>' +
        '<div style="font-size:10px;color:#888;margin-top:4px;">שם וחתימה</div>' +
      '</div>' +
    '</div>' +
    '<div class="footer">Stonhard Israel | מדידת גבהים לייזר | הופק: '+new Date().toLocaleDateString('he-IL')+'</div>' +
    '</body></html>';

  var w = window.open('','_blank','width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 400); }
}

function gvOpenOCR(mode) {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = function(){
    var file = inp.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){ gvRunOCR(e.target.result, mode); };
    reader.readAsDataURL(file);
  };
  inp.click();
}

async function gvRunOCR(imageB64, mode) {
  var area = document.getElementById('gv-form-area');
  if (area) area.innerHTML = '<div style="text-align:center;padding:40px;color:#2563eb;font-size:13px;">🔍 מנתח גיליון מדידות...</div>';

  var apiKey = window.APP && window.APP.config && window.APP.config.anthropic_key;
  if (!apiKey) { showToast('אין מפתח Claude','error'); return; }

  try {
    var resp = await fetch(window.SB_URL+'/functions/v1/claude-proxy', {
      method:'POST',
      headers:{Authorization:'Bearer '+window.SB_KEY,'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1500,
        system:'אתה מנתח גיליונות מדידת גבהים לייזר מישראל. חלץ את כל הנקודות, הקריאות, והערכים.',
        messages:[{role:'user', content:[
          {type:'image', source:{type:'base64', media_type:'image/jpeg', data:imageB64.split(',')[1]||imageB64}},
          {type:'text', text:'חלץ מהגיליון הזה את כל נקודות המדידה.\n\nהחזר JSON בפורמט:\n{"points":[{"name":"שם הנקודה","x":0,"y":0,"reading":0.00,"notes":""}],"benchmark":{"value":0.00,"note":""}}\n\nאם אין נקודות מזוהות, החזר {"points":[],"benchmark":null}\nהחזר JSON בלבד ללא טקסט נוסף.'}
        ]}]
      })
    });
    var data = await resp.json();
    var text = data.content && data.content[0] ? data.content[0].text : '';
    var parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    _gvPoints = parsed.points || [];
    gvRenderModeC(area, _gvPoints, parsed.benchmark);
    showToast('✅ חולץ '+_gvPoints.length+' נקודות מהגיליון','success');
  } catch(e) {
    showToast('שגיאת OCR: '+e.message,'error');
    gvRenderModeC(area);
  }
}

// ══ MODE B — 42-point simulation ══════════════════════════════════════
function gvRenderModeB(area) {
  // Generate realistic 42-point grid: 8 cols × 6 rows (some missing = 42)
  var points = [];
  var benchmark = 1.450;
  var xs = [0,3,6,9,12,15,18,20];
  var ys = [0,3,6,9,12,15];
  var n = 1;
  // Simulate a floor with a slight slope + a high spot near center
  ys.forEach(function(y){
    xs.forEach(function(x){
      if (n > 42) return;
      var base = 1.450;
      // Gentle slope from corner + bump in center
      var slope  = 0.002 * x + 0.003 * y;
      var bump   = (x > 8 && x < 14 && y > 4 && y < 11) ? 0.008 : 0;
      var noise  = (Math.random() - 0.5) * 0.004;
      var reading = parseFloat((base + slope + bump + noise).toFixed(4));
      points.push({name:'P'+n, x:x, y:y, reading:reading, notes:''});
      n++;
    });
  });

  _gvPoints = points;
  _gvMode = 'b';

  var projOpts = '<option value="">— בחר פרויקט —</option>';
  (window.allProjects||[]).forEach(function(p){ projOpts += '<option value="'+p.id+'">'+gvEsc(p.project_name)+'</option>'; });

  area.innerHTML =
    '<div style="background:#fff;border:1.5px solid #ef4444;border-radius:14px;padding:20px;margin-bottom:20px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<div style="font-size:14px;font-weight:900;color:#1a3d5c;">🗺️ B — סימולציה 42 נקודות (גריד 3×3 מ׳, חדר 20×15 מ׳)</div>' +
        '<span style="background:#ef4444;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:800;">דוגמה בלבד</span>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">פרויקט</div>'+
          '<select id="gv-b-proj" style="'+gvInp()+'">'+projOpts+'</select></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">חדר</div>'+
          '<input id="gv-b-room" type="text" value="סלון ראשי" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">Benchmark (מ׳)</div>'+
          '<input id="gv-b-bm" type="number" step="0.001" value="'+benchmark+'" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">סבילות (מ"מ)</div>'+
          '<input id="gv-b-tol" type="number" value="5" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">שטח (מ"ר)</div>'+
          '<input id="gv-b-area" type="number" value="300" style="'+gvInp()+'"></div>' +
      '</div>' +

      '<div style="margin-bottom:14px;">' +
        '<div style="font-size:12px;font-weight:800;color:#1a3d5c;margin-bottom:8px;">🗺️ מפת גבהים — ' + points.length + ' נקודות (גריד 3×3 מ׳)</div>' +
        gvRenderHeatmap(points, benchmark) +
      '</div>' +
      gvRenderPointsTable(points, benchmark, 5, false) +

      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">' +
        '<button onclick="gvSaveSession(\'b\')" style="flex:1;padding:11px;background:#1a3d5c;border:none;color:#FFD700;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">💾 שמור סשן</button>' +
        '<button onclick="gvPrintReport(\'b\')" style="flex:1;padding:11px;background:#ef4444;border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📄 הפק דוח PDF</button>' +
        '<button onclick="gvWAReport(\'b\')" style="padding:11px 16px;background:#e8faf0;border:1.5px solid #1b6b35;color:#1b6b35;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">💬 WA</button>' +
        '<button onclick="gvMailReport(\'b\')" style="padding:11px 16px;background:#fff0f0;border:1.5px solid #c62828;color:#c62828;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✉️ מייל</button>' +
      '</div>' +
    '</div>';
}

// ══ MODE C — Manual Entry ═════════════════════════════════════════════
function gvRenderModeC(area, prefillPoints, prefillBM) {
  if (!area) area = document.getElementById('gv-form-area');
  if (!area) return;

  var pts = prefillPoints || _gvPoints || [];
  var bm  = prefillBM || null;
  var tol = 5;

  var projOpts = '<option value="">— בחר פרויקט —</option>';
  (window.allProjects||[]).forEach(function(p){ projOpts += '<option value="'+p.id+'">'+gvEsc(p.project_name)+'</option>'; });

  // Build editable rows
  var rowsHtml = pts.map(function(pt, i){
    return '<tr id="gv-row-'+i+'">' +
      '<td style="padding:5px 6px;"><input type="text" value="'+gvEsc(pt.name||'P'+(i+1))+'" onchange="gvUpdatePoint('+i+',\'name\',this.value)" style="width:70px;border:1px solid #ddd;border-radius:4px;padding:4px;font-family:Heebo,sans-serif;font-size:12px;"></td>' +
      '<td style="padding:5px 6px;"><input type="number" step="0.1" value="'+(pt.x||0)+'" onchange="gvUpdatePoint('+i+',\'x\',this.value)" style="width:55px;border:1px solid #ddd;border-radius:4px;padding:4px;font-size:12px;"></td>' +
      '<td style="padding:5px 6px;"><input type="number" step="0.1" value="'+(pt.y||0)+'" onchange="gvUpdatePoint('+i+',\'y\',this.value)" style="width:55px;border:1px solid #ddd;border-radius:4px;padding:4px;font-size:12px;"></td>' +
      '<td style="padding:5px 6px;"><input type="number" step="0.001" value="'+(pt.reading||'')+'" onchange="gvUpdatePoint('+i+',\'reading\',this.value)" style="width:75px;border:1px solid #c9a84c;border-radius:4px;padding:4px;font-size:12px;font-weight:700;"></td>' +
      '<td style="padding:5px 6px;"><input type="text" value="'+gvEsc(pt.notes||'')+'" onchange="gvUpdatePoint('+i+',\'notes\',this.value)" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:4px;font-size:11px;"></td>' +
      '<td style="padding:5px 6px;text-align:center;"><button onclick="gvRemoveRow('+i+')" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:13px;" onmouseover="this.style.color=\'#c62828\'" onmouseout="this.style.color=\'#ccc\'">✕</button></td>' +
    '</tr>';
  }).join('');

  area.innerHTML =
    '<div style="background:#fff;border:1.5px solid #22c55e;border-radius:14px;padding:20px;margin-bottom:20px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<div style="font-size:14px;font-weight:900;color:#1a3d5c;">⌨️ C — הזנת קריאות ידנית</div>' +
        '<button onclick="gvToggleInstructions()" title="הצג הוראות שימוש" style="background:#fff8e0;border:1.5px solid #c9a84c;color:#7a5500;border-radius:8px;padding:5px 12px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">📖 הוראות A–Z</button>' +
      '</div>' +
      '<div id="gv-instructions-box" style="display:none;background:#fffbf0;border:1.5px solid #c9a84c;border-radius:12px;padding:16px;margin-bottom:16px;direction:rtl;">' +
        '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">📖 הוראות — הזנת גבהים SOLO באתר</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;color:#444;line-height:1.9;">' +
          '<div>' +
            '<b style="color:#1a3d5c;">A. הכנה לפני יציאה לשטח</b><br>' +
            '• הדפס גיליון ריק (לחץ A למעלה)<br>' +
            '• קח עיפרון, מטר, מוט מדידה<br>' +
            '• שמור גיליון ממולא לאחר מדידה<br><br>' +

            '<b style="color:#1a3d5c;">B. מיקום הלייזר</b><br>' +
            '• מרכז החדר — לא יותר מ-10מ לכל נקודה<br>' +
            '• חצובה על משטח יציב — "דרוך" הרגליים<br>' +
            '• ודא שאין עמודים חוסמים את קרן הלייזר<br><br>' +

            '<b style="color:#1a3d5c;">C. קביעת Benchmark (BM)</b><br>' +
            '• הנח המוט בנקודה יציבה ומרכזית<br>' +
            '• קרא את המספר מהמוט — לדוגמה: 1.450<br>' +
            '• זה ה-BM שלך — הכנס לשדה BM למעלה<br>' +
            '• <b>לא להזיז את המוט עד שהקלטת BM!</b><br><br>' +

            '<b style="color:#1a3d5c;">D. גריד מדידה מומלץ</b><br>' +
            '• כל 3 מטר — גריד 3×3<br>' +
            '• חדר 20×15 מ׳ ≈ 42 נקודות<br>' +
            '• תמיד מדוד את 4 הפינות + מרכז<br>' +
            '• סמן כל נקודה בגיר לפני הקריאה<br><br>' +
          '</div>' +
          '<div>' +
            '<b style="color:#1a3d5c;">E. הזנת נתונים כאן</b><br>' +
            '• שם נקודה: מספר שורה מהגיליון (1, 2, 3...)<br>' +
            '• X = מרחק ממנ הצד השמאלי (מ׳)<br>' +
            '• Y = מרחק מהקיר הקדמי (מ׳)<br>' +
            '• קריאה = המספר שראית על המוט (מ׳)<br>' +
            '• לחץ + הוסף נקודה לכל שורה<br><br>' +

            '<b style="color:#1a3d5c;">F. העברת לייזר (Turning Point)</b><br>' +
            '• אם הזהות — בחר BM חדש (נקודה קבועה)<br>' +
            '• קרא BM מהמיקום הישן → הזז לייזר<br>' +
            '• קרא BM מהמיקום החדש<br>' +
            '• הפרש = האופסט — הכנס בהערות<br><br>' +

            '<b style="color:#1a3d5c;">G. חישוב סטיות</b><br>' +
            '• לחץ 📊 חשב + דוח<br>' +
            '• ירוק = תקין (±5מ"מ)<br>' +
            '• אדום = חריגה — מצריך טיפול<br>' +
            '• ±3מ"מ = מצוין לריצוף יוקרתי<br>' +
            '• ±5מ"מ = תקני לריצוף רגיל<br><br>' +

            '<b style="color:#1a3d5c;">H. שמירה ודיווח</b><br>' +
            '• לחץ 💾 שמור לפני סגירה<br>' +
            '• לחץ 📄 PDF לדוח מלא<br>' +
            '• שלח 💬 WA לקבלן / לקוח<br>' +
            '• נשמר גם לאנציקלופדיה<br>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:10px;background:#fff;border:1px solid #e8ddb5;border-radius:8px;padding:10px;font-size:11px;color:#7a5500;">' +
          '💡 <b>טיפ SOLO:</b> צלם את הגיליון הממולא ← העלה למרכז נתונים ← לחץ 🔴 חלץ גבהים ← הכל נטען אוטומטית' +
        '</div>' +

        '<div style="margin-top:12px;background:#fff;border:1.5px solid #1a3d5c;border-radius:10px;padding:14px;">' +
          '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">🗺️ I. מערכת קואורדינטות — איפה לשים את המוט?</div>' +
          '<div style="font-size:11px;color:#444;line-height:1.9;margin-bottom:10px;">' +
            '• עמוד בפתח החדר ופנה פנימה<br>' +
            '• <b>פינה שמאל-תחתון = (0,0)</b> — נקודת האפס שלך<br>' +
            '• <b>X</b> = כמה מטרים ימינה לאורך הקיר התחתון<br>' +
            '• <b>Y</b> = כמה מטרים פנימה מהקיר התחתון<br>' +
            '• לפני שמתחילים: <b>סמן קוים בגיר כל 3 מטר</b> לאורך ולרוחב<br>' +
            '• כל צומת של קוי גיר = נקודת מדידה<br>' +
          '</div>' +
          '<pre style="font-family:monospace;font-size:10px;color:#1a3d5c;background:#f0f4fa;border-radius:8px;padding:10px;overflow-x:auto;line-height:1.7;direction:ltr;">Y=15  O--O--O--O--O--O--O--O  (קיר צפון)\n      |  |  |  |  |  |  |  |\nY=12  O--O--O--O--O--O--O--O\n      |  |  |  |  |  |  |  |\nY=9   O--O--O--O--O--O--O--O\n      |  |  |  |  |  |  |  |\nY=6   O--O--O--O--O--O--O--O\n      |  |  |  |  |  |  |  |\nY=3   O--O--O--O--O--O--O--O\n      |  |  |  |  |  |  |  |\nY=0   O--O--O--O--O--O--O--O  (קיר דרום)\n     X=0  3  6  9 12 15 18 20\n     (0,0) = נקודת האפס / פינה שמאל-תחתון</pre>' +
          '<div style="font-size:11px;color:#444;line-height:1.9;margin-top:8px;">' +
            '• <b>אין צורך לכתוב מיקום</b> — X ו-Y מספיקים<br>' +
            '• סרוק שורה-שורה: Y=0 כל הדרך ← Y=3 כל הדרך ← וכן הלאה<br>\n' +
            '• <b>רק כותבים את הקריאה</b> — X ו-Y ידועים מהגריד<br>' +
          '</div>' +
          '<div style="margin-top:8px;background:#f0f4fa;border-radius:6px;padding:8px;font-size:10px;color:#555;">' +
            '<b>דוגמה — 3 נקודות ראשונות:</b><br>' +
            'שורה 1: X=0, Y=0, קריאה=1.452 &nbsp;|&nbsp; שורה 2: X=3, Y=0, קריאה=1.461 &nbsp;|&nbsp; שורה 3: X=6, Y=0, קריאה=1.448\n' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">פרויקט</div>'+
          '<select id="gv-c-proj" style="'+gvInp()+'">'+projOpts+'</select></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">חדר / אזור</div>'+
          '<input id="gv-c-room" type="text" placeholder="לדוגמה: סלון" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">Benchmark (מ׳)</div>'+
          '<input id="gv-c-bm" type="number" step="0.001" placeholder="לדוגמה: 1.450" value="'+(bm&&bm.value||'')+'" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">סבילות מותרת (מ"מ)</div>'+
          '<input id="gv-c-tol" type="number" value="5" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">שטח (מ"ר)</div>'+
          '<input id="gv-c-area" type="number" placeholder="300" style="'+gvInp()+'"></div>' +
        '<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;">הערות כלליות</div>'+
          '<input id="gv-c-notes" type="text" placeholder="הערות..." style="'+gvInp()+'"></div>' +
      '</div>' +

      // Points table
      '<div style="overflow-x:auto;margin-bottom:10px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
          '<thead><tr style="background:#f5f0e8;">' +
            '<th style="padding:7px;text-align:right;font-weight:800;">נקודה</th>' +
            '<th style="padding:7px;text-align:center;font-weight:800;">X (מ׳)</th>' +
            '<th style="padding:7px;text-align:center;font-weight:800;">Y (מ׳)</th>' +
            '<th style="padding:7px;text-align:center;font-weight:800;color:#c9a84c;">קריאה (מ׳)</th>' +
            '<th style="padding:7px;text-align:right;font-weight:800;">הערות</th>' +
            '<th style="padding:7px;width:30px;"></th>' +
          '</tr></thead>' +
          '<tbody id="gv-c-rows">'+rowsHtml+'</tbody>' +
        '</table>' +
      '</div>' +

      '<button onclick="gvAddRow()" style="width:100%;padding:9px;background:#f5f0e8;border:1.5px dashed #c9a84c;color:#7a5500;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:14px;">+ הוסף נקודה</button>' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button onclick="gvSaveSession(\'c\')" style="flex:1;padding:11px;background:#1a3d5c;border:none;color:#FFD700;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">💾 שמור</button>' +
        '<button onclick="gvCalculateAndReport()" style="flex:1;padding:11px;background:#22c55e;border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📊 חשב + דוח</button>' +
        '<button onclick="gvPrintReport(\'c\')" style="padding:11px 16px;background:#ef4444;border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📄 PDF</button>' +
        '<button onclick="gvWAReport(\'c\')" style="padding:11px 14px;background:#e8faf0;border:1.5px solid #1b6b35;color:#1b6b35;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">💬 WA</button>' +
        '<button onclick="gvMailReport(\'c\')" style="padding:11px 14px;background:#fff0f0;border:1.5px solid #c62828;color:#c62828;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✉️ מייל</button>' +
        '<button onclick="gvOpenOCR(\'c\')" style="padding:11px 14px;background:#fff8e0;border:1.5px solid #c9a84c;color:#7a5500;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📷 OCR</button>' +
      '</div>' +
    '</div>';
}

function gvUpdatePoint(i, field, val) {
  if (!_gvPoints[i]) _gvPoints[i] = {};
  _gvPoints[i][field] = field === 'reading' || field === 'x' || field === 'y' ? parseFloat(val)||0 : val;
}

function gvAddRow() {
  var i = _gvPoints.length;
  _gvPoints.push({name:'P'+(i+1), x:0, y:0, reading:'', notes:''});
  var tbody = document.getElementById('gv-c-rows');
  if (!tbody) return;
  var tr = document.createElement('tr');
  tr.id = 'gv-row-'+i;
  tr.innerHTML =
    '<td style="padding:5px 6px;"><input type="text" value="P'+(i+1)+'" onchange="gvUpdatePoint('+i+',\'name\',this.value)" style="width:70px;border:1px solid #ddd;border-radius:4px;padding:4px;font-family:Heebo,sans-serif;font-size:12px;"></td>' +
    '<td style="padding:5px 6px;"><input type="number" step="0.1" value="0" onchange="gvUpdatePoint('+i+',\'x\',this.value)" style="width:55px;border:1px solid #ddd;border-radius:4px;padding:4px;font-size:12px;"></td>' +
    '<td style="padding:5px 6px;"><input type="number" step="0.1" value="0" onchange="gvUpdatePoint('+i+',\'y\',this.value)" style="width:55px;border:1px solid #ddd;border-radius:4px;padding:4px;font-size:12px;"></td>' +
    '<td style="padding:5px 6px;"><input type="number" step="0.001" placeholder="1.450" onchange="gvUpdatePoint('+i+',\'reading\',this.value)" style="width:75px;border:1px solid #c9a84c;border-radius:4px;padding:4px;font-size:12px;font-weight:700;"></td>' +
    '<td style="padding:5px 6px;"><input type="text" onchange="gvUpdatePoint('+i+',\'notes\',this.value)" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:4px;font-size:11px;"></td>' +
    '<td style="padding:5px 6px;text-align:center;"><button onclick="gvRemoveRow('+i+')" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:13px;">✕</button></td>';
  tbody.appendChild(tr);
}

function gvRemoveRow(i) {
  _gvPoints.splice(i, 1);
  var area = document.getElementById('gv-form-area');
  gvRenderModeC(area, _gvPoints);
}


// ── 3D FLOOR MAP ──────────────────────────────────────────────────────
function gvRenderHeatmap(points, bm) {
  if (!points || !points.length) return '';
  var canvasId = 'gv-3d-canvas-' + Date.now();
  var containerId = 'gv-3d-container-' + Date.now();

  // Serialize points for inline script
  var ptsJson = JSON.stringify(points.map(function(p){
    return {x:parseFloat(p.x)||0, y:parseFloat(p.y)||0, r:parseFloat(p.reading)||0, n:p.name||''};
  }));
  var bmVal = parseFloat(bm)||0;

  var html =
    '<div id="'+containerId+'" style="position:relative;width:100%;height:340px;border:1px solid #e8ddb5;border-radius:10px;overflow:hidden;background:#1a1a2e;margin-bottom:10px;">' +
      '<canvas id="'+canvasId+'" style="width:100%;height:100%;display:block;"></canvas>' +
      '<div style="position:absolute;top:8px;right:10px;font-size:10px;color:rgba(255,255,255,0.5);font-family:Heebo,sans-serif;">גרור לסיבוב · גלגל לזום</div>' +
      '<div id="gv-3d-legend-'+containerId+'" style="position:absolute;bottom:8px;left:8px;display:flex;gap:4px;align-items:center;">' +
        '<div style="width:60px;height:10px;background:linear-gradient(to right,#0000ff,#00ff88,#ffff00,#ff0000);border-radius:3px;"></div>' +
        '<span style="font-size:9px;color:#aaa;font-family:Heebo,sans-serif;">נמוך → גבוה</span>' +
      '</div>' +
    '</div>' +
    '<script>(function(){' +
      'var pts='+ptsJson+';' +
      'var bm='+bmVal+';' +
      'function tryInit(){' +
        'var canvas=document.getElementById("'+canvasId+'");' +
        'if(!canvas)return;' +
        'var W=canvas.getBoundingClientRect().width||canvas.parentElement&&canvas.parentElement.getBoundingClientRect().width||520;' +
        'var H=340;' +
        'canvas.width=Math.round(W*(window.devicePixelRatio||1));' +
        'canvas.height=Math.round(H*(window.devicePixelRatio||1));' +
        'canvas.style.width=W+"px";canvas.style.height=H+"px";' +
        'gv3dWebGL(null,canvas,pts,bm,Math.round(W),H);' +
      '}' +
      'if(document.readyState==="complete"){setTimeout(tryInit,80);}' +
      'else{window.addEventListener("load",function(){setTimeout(tryInit,80);});}' +
    '})();<\/script>';

  return html;
}

// Called after DOM render to init 3D — also used by Mode C view
function gv3dFallback(ctx, canvas, pts, bm) {
  // Isometric projection fallback (Canvas 2D)
  var W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  if (!pts.length) return;

  var xs = pts.map(function(p){return p.x;}), ys = pts.map(function(p){return p.y;});
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs);
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
  var devs = pts.map(function(p){return (p.r - bm)*1000;});
  var minD=Math.min.apply(null,devs), maxD=Math.max.apply(null,devs);
  var rangeD = Math.max(Math.abs(minD),Math.abs(maxD)) || 1;

  function devToRGB(d) {
    var t = (d - minD)/(maxD-minD+0.001);
    var r,g,b;
    if(t<0.25){r=0;g=Math.round(t*4*255);b=255;}
    else if(t<0.5){r=0;g=255;b=Math.round((0.5-t)*4*255);}
    else if(t<0.75){r=Math.round((t-0.5)*4*255);g=255;b=0;}
    else{r=255;g=Math.round((1-t)*4*255);b=0;}
    return [r,g,b];
  }

  // Isometric transform
  var isoScale = Math.min(W,H) * 0.028;
  var cx = W*0.35, cy = H*0.65;
  function iso(x,y,z){
    var ix = (x-y)*isoScale;
    var iy = (x+y)*0.5*isoScale - z*isoScale*1.5;
    return [cx+ix, cy-iy];
  }

  // Sort points for painter's algorithm
  var sorted = pts.slice().sort(function(a,b){ return (a.x+a.y)-(b.x+b.y); });

  sorted.forEach(function(pt){
    var d = (pt.r - bm)*1000;
    var h = (d - minD)/rangeD * 0.8 + 0.1;
    var rgb = devToRGB(d);
    var col = "rgb("+rgb[0]+","+rgb[1]+","+rgb[2]+")";
    var darkCol = "rgb("+Math.round(rgb[0]*0.5)+","+Math.round(rgb[1]*0.5)+","+Math.round(rgb[2]*0.5)+")";
    var s = 1.4; // grid size
    var zH = h * 2;

    // Top face
    var tl=iso(pt.x,     pt.y,     zH);
    var tr=iso(pt.x+s,   pt.y,     zH);
    var br=iso(pt.x+s,   pt.y+s,   zH);
    var bl=iso(pt.x,     pt.y+s,   zH);
    ctx.beginPath();
    ctx.moveTo(tl[0],tl[1]); ctx.lineTo(tr[0],tr[1]);
    ctx.lineTo(br[0],br[1]); ctx.lineTo(bl[0],bl[1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Right face
    var br0=iso(pt.x+s, pt.y+s, 0);
    var tr0=iso(pt.x+s, pt.y,   0);
    ctx.beginPath();
    ctx.moveTo(tr[0],tr[1]); ctx.lineTo(tr0[0],tr0[1]);
    ctx.lineTo(br0[0],br0[1]); ctx.lineTo(br[0],br[1]);
    ctx.closePath();
    ctx.fillStyle = darkCol;
    ctx.fill();

    // Front face
    var bl0=iso(pt.x, pt.y+s, 0);
    ctx.beginPath();
    ctx.moveTo(br[0],br[1]); ctx.lineTo(br0[0],br0[1]);
    ctx.lineTo(bl0[0],bl0[1]); ctx.lineTo(bl[0],bl[1]);
    ctx.closePath();
    ctx.fillStyle = "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+",0.7)";
    ctx.fill();

    // Point label for fails
    if(Math.abs(d) > 5) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 7px Heebo,Arial";
      ctx.textAlign = "center";
      ctx.fillText((d>=0?"+":"")+d.toFixed(1), br[0]-4, br[1]-2);
    }
  });

  // Axis labels
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "10px Heebo,Arial";
  ctx.textAlign = "center";
  var p0=iso(minX, minY, 0), px=iso(maxX+1, minY, 0), py=iso(minX, maxY+1, 0);
  ctx.fillText("X →", px[0]+8, px[1]);
  ctx.fillText("Y →", py[0]-12, py[1]+4);
}

function gv3dWebGL(gl,canvas,pts,bm,W,H) {
  W = W || canvas.getBoundingClientRect().width || 520;
  H = H || 340;
  if (!window.THREE) {
    var existing = document.querySelector('script[src*="three.min.js"]');
    if (existing) {
      var wait = setInterval(function(){
        if(window.THREE){ clearInterval(wait); gv3dThree(canvas,pts,bm,W,H); }
      }, 100);
    } else {
      var s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload=function(){ gv3dThree(canvas,pts,bm,W,H); };
      document.head.appendChild(s);
    }
  } else {
    gv3dThree(canvas,pts,bm,W,H);
  }
}

function gv3dThree(canvas, pts, bm, W, H) {
  if (!window.THREE) { return; }
  var THREE = window.THREE;

  // Clean up old renderer if any
  if (canvas._threeRenderer) {
    canvas._threeRenderer.dispose();
  }

  var renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, alpha:true});
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x1a1a2e, 1);
  canvas._threeRenderer = renderer;

  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);

  var xs=pts.map(function(p){return p.x;}), ys=pts.map(function(p){return p.y;});
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs);
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
  var devs=pts.map(function(p){return (p.r-bm)*1000;});
  var minD=Math.min.apply(null,devs), maxD=Math.max.apply(null,devs);
  var rangeD=Math.max(Math.abs(minD),Math.abs(maxD))||1;
  var cx=(minX+maxX)/2, cy=(minY+maxY)/2;

  function devToColor(d) {
    var t=(d-minD)/(maxD-minD+0.001);
    var r,g,b;
    if(t<0.25){r=0;g=Math.round(t*4*255);b=255;}
    else if(t<0.5){r=0;g=255;b=Math.round((0.5-t)*4*255);}
    else if(t<0.75){r=Math.round((t-0.5)*4*255);g=255;b=0;}
    else{r=255;g=Math.round((1-t)*4*255);b=0;}
    return new THREE.Color(r/255,g/255,b/255);
  }

  // Ambient + directional light
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  var dLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dLight.position.set(5,10,5);
  scene.add(dLight);

  // Build pillars for each point
  pts.forEach(function(pt){
    var d=(pt.r-bm)*1000;
    var normH=Math.max(0.05,(d-minD)/rangeD*3+0.1);
    var geo=new THREE.BoxGeometry(2.2,normH,2.2);
    var mat=new THREE.MeshPhongMaterial({color:devToColor(d), transparent:true, opacity:0.9});
    var mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(pt.x-cx, normH/2-1, pt.y-cy);
    scene.add(mesh);

    // Wireframe outline
    var edges=new THREE.EdgesGeometry(geo);
    var line=new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color:0xffffff,opacity:0.15,transparent:true}));
    line.position.copy(mesh.position);
    scene.add(line);
  });

  // Ground plane
  var gGeo=new THREE.PlaneGeometry(maxX-minX+4, maxY-minY+4);
  var gMat=new THREE.MeshPhongMaterial({color:0x2a2a4a,side:THREE.DoubleSide});
  var ground=new THREE.Mesh(gGeo,gMat);
  ground.rotation.x=-Math.PI/2; ground.position.y=-1;
  scene.add(ground);

  var span=Math.max(maxX-minX, maxY-minY);
  camera.position.set(span*0.8, span*0.7, span*1.1);
  camera.lookAt(0,0,0);

  // Orbit controls (manual)
  var isDragging=false, lastX=0, lastY=0;
  var theta=0.5, phi=0.8, radius=camera.position.length();

  function updateCamera(){
    camera.position.x=radius*Math.sin(phi)*Math.sin(theta);
    camera.position.y=radius*Math.cos(phi);
    camera.position.z=radius*Math.sin(phi)*Math.cos(theta);
    camera.lookAt(0,0,0);
  }

  canvas.addEventListener("mousedown",function(e){isDragging=true;lastX=e.clientX;lastY=e.clientY;});
  canvas.addEventListener("mouseup",function(){isDragging=false;});
  canvas.addEventListener("mousemove",function(e){
    if(!isDragging)return;
    theta+=(e.clientX-lastX)*0.01;
    phi=Math.max(0.1,Math.min(Math.PI-0.1,phi-(e.clientY-lastY)*0.01));
    lastX=e.clientX;lastY=e.clientY;
    updateCamera();
  });
  canvas.addEventListener("wheel",function(e){
    radius=Math.max(5,Math.min(80,radius+e.deltaY*0.05));
    updateCamera();
    e.preventDefault();
  },{passive:false});

  // Touch support
  var lastTouchX=0, lastTouchY=0;
  canvas.addEventListener("touchstart",function(e){lastTouchX=e.touches[0].clientX;lastTouchY=e.touches[0].clientY;e.preventDefault();},{passive:false});
  canvas.addEventListener("touchmove",function(e){
    theta+=(e.touches[0].clientX-lastTouchX)*0.012;
    phi=Math.max(0.1,Math.min(Math.PI-0.1,phi-(e.touches[0].clientY-lastTouchY)*0.012));
    lastTouchX=e.touches[0].clientX;lastTouchY=e.touches[0].clientY;
    updateCamera();
    e.preventDefault();
  },{passive:false});

  function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene,camera);
  }
  animate();
}


// ── POINTS TABLE RENDER (for display/report) ──────────────────────────
function gvRenderPointsTable(points, bm, tol, editable) {
  if (!points || !points.length) return '<div style="text-align:center;padding:20px;color:#888;">אין נקודות</div>';
  var bmVal = parseFloat(bm) || 0;
  var tolMm = parseFloat(tol) || 5;

  var rows = points.map(function(pt){
    var reading = parseFloat(pt.reading)||0;
    var devM   = reading - bmVal;
    var devMm  = devM * 1000;
    var fail   = Math.abs(devMm) > tolMm;
    var color  = fail ? '#c62828' : (Math.abs(devMm) > tolMm*0.6 ? '#d97706' : '#1b6b35');
    var icon   = fail ? '🔴' : '🟢';
    return '<tr style="border-bottom:1px solid #f0e8d0;background:'+(fail?'rgba(239,68,68,0.04)':'')+';">' +
      '<td style="padding:6px 8px;font-weight:700;">'+gvEsc(pt.name||'')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;color:#666;">'+(pt.x||0)+'</td>' +
      '<td style="padding:6px 8px;text-align:center;color:#666;">'+(pt.y||0)+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-weight:800;font-size:13px;">'+(reading?reading.toFixed(4):'—')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-weight:800;color:'+color+';">'+(reading?(devMm>=0?'+':'')+devMm.toFixed(1):' — ')+' מ"מ</td>' +
      '<td style="padding:6px 8px;text-align:center;font-size:16px;">'+icon+'</td>' +
    '</tr>';
  }).join('');

  var fails = points.filter(function(pt){
    return Math.abs((parseFloat(pt.reading)||0 - bmVal)*1000) > tolMm;
  }).length;

  return '<div style="overflow-x:auto;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      '<thead><tr style="background:#f5f0e8;">' +
        '<th style="padding:7px 8px;text-align:right;font-weight:800;">נקודה</th>' +
        '<th style="padding:7px 8px;text-align:center;font-weight:800;">X (מ׳)</th>' +
        '<th style="padding:7px 8px;text-align:center;font-weight:800;">Y (מ׳)</th>' +
        '<th style="padding:7px 8px;text-align:center;font-weight:800;color:#c9a84c;">קריאה (מ׳)</th>' +
        '<th style="padding:7px 8px;text-align:center;font-weight:800;">סטייה</th>' +
        '<th style="padding:7px 8px;text-align:center;font-weight:800;">סטטוס</th>' +
      '</tr></thead>' +
      '<tbody>'+rows+'</tbody>' +
    '</table>' +
    '<div style="margin-top:8px;display:flex;gap:16px;font-size:12px;font-weight:700;">' +
      '<span style="color:#1b6b35;">✅ תקין: '+(points.length-fails)+'</span>' +
      '<span style="color:#c62828;">🔴 חריגות: '+fails+'</span>' +
      '<span style="color:#888;">סה"כ: '+points.length+' נקודות</span>' +
    '</div>' +
  '</div>';
}


function gvToggleInstructions() {
  var box = document.getElementById('gv-instructions-box');
  if (!box) return;
  var btn = box.previousElementSibling && box.previousElementSibling.querySelector('button');
  if (box.style.display === 'none') {
    box.style.display = 'block';
    if (btn) btn.textContent = '✕ סגור הוראות';
  } else {
    box.style.display = 'none';
    if (btn) btn.textContent = '📖 הוראות A–Z';
  }
}

// ── CALCULATE + SHOW REPORT ────────────────────────────────────────────
function gvCalculateAndReport() {
  var bm  = parseFloat((document.getElementById('gv-c-bm')||{}).value)||0;
  var tol = parseFloat((document.getElementById('gv-c-tol')||{}).value)||5;
  var pts = _gvPoints.filter(function(p){ return p.reading; });
  if (!pts.length) { showToast('הזן קריאות תחילה','error'); return; }

  // Insert table into form area below inputs
  var area = document.getElementById('gv-form-area');
  var existing = area.querySelector('#gv-report-preview');
  if (existing) existing.remove();

  var preview = document.createElement('div');
  preview.id = 'gv-report-preview';
  preview.style.cssText = 'background:#fff;border:1.5px solid #22c55e;border-radius:12px;padding:16px;margin-top:12px;';
  preview.innerHTML =
    '<div style="font-size:13px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">📊 תצוגה מקדימה — '+pts.length+' נקודות</div>' +
    gvRenderPointsTable(pts, bm, tol, false);
  area.appendChild(preview);
  preview.scrollIntoView({behavior:'smooth'});
}

// ── SAVE SESSION ───────────────────────────────────────────────────────
async function gvSaveSession(mode) {
  var projId, projName, room, bm, tol, area_sqm, notes;

  if (mode === 'b') {
    projId   = (document.getElementById('gv-b-proj')||{}).value||null;
    room     = (document.getElementById('gv-b-room')||{}).value||'';
    bm       = parseFloat((document.getElementById('gv-b-bm')||{}).value)||0;
    tol      = parseFloat((document.getElementById('gv-b-tol')||{}).value)||5;
    area_sqm = parseFloat((document.getElementById('gv-b-area')||{}).value)||300;
    notes    = 'סימולציה — 42 נקודות';
  } else {
    projId   = (document.getElementById('gv-c-proj')||{}).value||null;
    room     = (document.getElementById('gv-c-room')||{}).value||'';
    bm       = parseFloat((document.getElementById('gv-c-bm')||{}).value)||0;
    tol      = parseFloat((document.getElementById('gv-c-tol')||{}).value)||5;
    area_sqm = parseFloat((document.getElementById('gv-c-area')||{}).value)||null;
    notes    = (document.getElementById('gv-c-notes')||{}).value||'';
  }

  var proj = projId ? (window.allProjects||[]).find(function(p){return p.id===projId;}) : null;
  projName = proj ? proj.project_name : '';

  if (!room) { showToast('הזן שם חדר / אזור','error'); return; }
  var pts = _gvPoints.filter(function(p){ return p.reading; });
  if (!pts.length) { showToast('אין נקודות מדידה לשמור','error'); return; }

  try {
    var res = await window.sb.from('gavoim_sessions').insert({
      project_id:    projId || null,
      project_name:  projName,
      room_name:     room,
      benchmark:     bm,
      tolerance_mm:  tol,
      area_sqm:      area_sqm,
      notes:         notes,
      points:        JSON.stringify(pts),
      submitted_by:  'בני',
      created_at:    new Date().toISOString()
    }).select().single();

    if (res.error) throw res.error;
    _gvSessions.unshift(res.data);
    showToast('✅ מדידה נשמרה','success');
    document.getElementById('gv-form-area').innerHTML = '';
    gvRenderSessions();
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

// ── LOAD + RENDER SESSIONS ────────────────────────────────────────────
async function gvLoadSessions() {
  try {
    var res = await window.sbQ('gavoim_sessions','is_deleted=not.is.true&order=created_at.desc&limit=50');
    _gvSessions = res.data || [];
  } catch(e) { _gvSessions = []; }
  gvRenderSessions();
}

function gvRenderSessions() {
  var el = document.getElementById('gv-sessions-list');
  if (!el) return;
  if (!_gvSessions.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa;font-size:13px;">אין מדידות שמורות</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:13px;font-weight:800;color:#1a3d5c;margin-bottom:12px;">📋 מדידות שמורות ('+_gvSessions.length+')</div>' +
    _gvSessions.map(function(s){ return gvBuildSessionCard(s); }).join('');
}

function gvBuildSessionCard(s) {
  var pts = [];
  try { pts = JSON.parse(s.points||'[]'); } catch(e){}
  var bm  = parseFloat(s.benchmark)||0;
  var tol = parseFloat(s.tolerance_mm)||5;
  var fails = pts.filter(function(p){ return Math.abs((parseFloat(p.reading)||0 - bm)*1000) > tol; }).length;
  var date  = s.created_at ? new Date(s.created_at).toLocaleDateString('he-IL') : '';
  var borderColor = fails > 0 ? '#ef4444' : '#22c55e';

  return '<div style="background:#fff;border:1px solid #e8ddb5;border-right:4px solid '+borderColor+';border-radius:12px;padding:16px;margin-bottom:14px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:900;color:#1a3d5c;">🔴 '+gvEsc(s.room_name||'מדידה')+'</div>' +
        '<div style="font-size:11px;color:#888;margin-top:2px;">' +
          (s.project_name?'🏗️ '+gvEsc(s.project_name)+' · ':'') +
          '📅 ' + date + ' · ' + pts.length + ' נקודות' +
        '</div>' +
      '</div>' +
      '<div style="text-align:left;">' +
        '<div style="font-size:18px;font-weight:900;color:'+(fails>0?'#ef4444':'#22c55e')+';">'+(fails>0?fails+' חריגות':'✅ תקין')+'</div>' +
        (s.area_sqm ? '<div style="font-size:10px;color:#888;">'+s.area_sqm+' מ"ר</div>' : '') +
      '</div>' +
    '</div>' +

    // Action buttons
    '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
      '<button onclick="gvViewSession(\''+s.id+'\')" title="צפה בטבלת הסטיות המלאה" style="padding:7px 12px;background:#e8f0fd;border:1px solid #1a3d5c;color:#1a3d5c;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">👁️ צפה</button>' +
      '<button onclick="gvPrintSession(\''+s.id+'\')" title="הפק דוח PDF מלא להדפסה" style="padding:7px 12px;background:#fff8e0;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">🖨️ PDF</button>' +
      '<button onclick="gvMailSession(\''+s.id+'\')" style="padding:7px 10px;background:#fff0f0;border:1px solid rgba(198,40,40,0.3);color:#c62828;border-radius:8px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;" title="שלח דוח במייל">✉️</button>' +
      '<button onclick="gvWASession(\''+s.id+'\')" style="padding:7px 10px;background:#e8faf0;border:1px solid rgba(27,107,53,0.3);color:#1b6b35;border-radius:8px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;" title="שלח סיכום בוואטסאפ">💬</button>' +
      (s.file_url ? '<button onclick="tkViewFile(\''+s.file_url+'\',\''+((s.file_type)||'image')+'\')" style="padding:7px 10px;background:#e8f0fd;border:1px solid rgba(26,61,92,0.3);color:#1a3d5c;border-radius:8px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">👁️ קובץ</button>' : '<button onclick="gvAttachFile(\''+s.id+'\')" title="צרף תמונה או PDF לסשן" style="padding:7px 10px;background:#f5f0e8;border:1px solid rgba(201,168,76,0.4);color:#7a5500;border-radius:8px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">📎</button>') +
      '<button id="gv-del-'+s.id+'" onclick="gvDeleteConfirm(\''+s.id+'\',this)" title="מחק סשן (3 שניות לביטול)" style="padding:7px 10px;background:#fff0f0;border:1px solid rgba(239,68,68,0.3);color:#c62828;border-radius:8px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">🗑️</button>' +
    '</div>' +
  '</div>';
}

// ── SESSION ACTIONS ────────────────────────────────────────────────────
function gvViewSession(id) {
  var s = _gvSessions.find(function(x){ return x.id===id; });
  if (!s) return;
  var pts = []; try { pts = JSON.parse(s.points||'[]'); } catch(e){}
  var bm  = parseFloat(s.benchmark)||0;
  var tol = parseFloat(s.tolerance_mm)||5;

  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;';
  ov.onclick = function(e){ if(e.target===ov) ov.remove(); };
  ov.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:700px;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="color:#fff;">' +
          '<div style="font-size:16px;font-weight:900;">🔴 '+gvEsc(s.room_name||'מדידה')+'</div>' +
          '<div style="font-size:11px;opacity:0.7;">'+(s.project_name||'')+'</div>' +
        '</div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="padding:20px;">' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:12px;color:#555;">' +
          '<span>📅 '+new Date(s.created_at).toLocaleDateString('he-IL')+'</span>' +
          '<span>BM: '+bm+'</span>' +
          '<span>סבילות: ±'+tol+' מ"מ</span>' +
          (s.area_sqm?'<span>שטח: '+s.area_sqm+' מ"ר</span>':'') +
        '</div>' +
        gvRenderPointsTable(pts, bm, tol, false) +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
}

function gvDeleteConfirm(id, btn) {
  if (btn._confirmed) { gvDeleteSession(id); return; }
  btn._confirmed = true;
  var count = 3;
  btn.style.background = '#c62828'; btn.style.color = '#fff';
  btn.innerHTML = '❗ '+count;
  var timer = setInterval(function(){
    count--;
    if (count > 0) { btn.innerHTML = '❗ '+count; }
    else { clearInterval(timer); gvDeleteSession(id); }
  }, 1000);
  btn.onclick = function(){
    clearInterval(timer);
    btn._confirmed = false;
    btn.innerHTML = '🗑️';
    btn.style.background = '#fff0f0'; btn.style.color = '#c62828';
    btn.onclick = function(){ gvDeleteConfirm(id, btn); };
  };
}

async function gvDeleteSession(id) {
  try {
    await window.sb.from('gavoim_sessions').update({is_deleted:true}).eq('id',id);
    showToast('🗑️ נמחק','success');
    _gvSessions = _gvSessions.filter(function(s){ return s.id!==id; });
    gvRenderSessions();
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

// ── ATTACH FILE ────────────────────────────────────────────────────────
function gvAttachFile(id) {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,.pdf';
  inp.onchange = async function(){
    var file = inp.files[0]; if (!file) return;
    showToast('⬆️ מעלה...','success');
    try {
      var cloudName   = window.APP&&window.APP.config&&window.APP.config.cloudinary_cloud||'';
      var uploadPreset= window.APP&&window.APP.config&&window.APP.config.cloudinary_preset||'';
      var fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', uploadPreset);
      var r = await fetch('https://api.cloudinary.com/v1_1/'+cloudName+'/auto/upload',{method:'POST',body:fd});
      if (!r.ok) throw new Error('HTTP '+r.status);
      var d = await r.json();
      var ftype = file.type.startsWith('image') ? 'image' : 'pdf';
      await window.sb.from('gavoim_sessions').update({file_url:d.secure_url, file_type:ftype}).eq('id',id);
      var s = _gvSessions.find(function(x){ return x.id===id; });
      if (s) { s.file_url = d.secure_url; s.file_type = ftype; }
      showToast('✅ קובץ הועלה','success');
      gvRenderSessions();
    } catch(e) { showToast('שגיאה: '+e.message,'error'); }
  };
  inp.click();
}

// ── PRINT / MAIL / WA ─────────────────────────────────────────────────
function gvPrintSession(id) {
  var s = _gvSessions.find(function(x){ return x.id===id; });
  if (!s) return;
  var pts = []; try { pts = JSON.parse(s.points||'[]'); } catch(e){}
  gvGeneratePDFHtml(s, pts);
}

function gvPrintReport(mode) {
  var bm   = parseFloat((document.getElementById('gv-'+mode+'-bm')||{}).value)||0;
  var room = (document.getElementById('gv-'+mode+'-room')||{}).value||'מדידה';
  gvGeneratePDFHtml({room_name:room, benchmark:bm, tolerance_mm:5}, _gvPoints);
}

function gvGeneratePDFHtml(s, pts) {
  var bm  = parseFloat(s.benchmark)||0;
  var tol = parseFloat(s.tolerance_mm)||5;
  var fails = pts.filter(function(p){ return Math.abs((parseFloat(p.reading)||0 - bm)*1000) > tol; });

  var rowsHtml = pts.map(function(pt){
    var r   = parseFloat(pt.reading)||0;
    var dev = (r - bm) * 1000;
    var fail= Math.abs(dev) > tol;
    return '<tr style="background:'+(fail?'#fff5f5':'')+';border-bottom:1px solid #eee;">' +
      '<td style="padding:6px 8px;">'+gvEsc(pt.name||'')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;">'+(pt.x||0)+'</td>' +
      '<td style="padding:6px 8px;text-align:center;">'+(pt.y||0)+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-weight:700;">'+(r?r.toFixed(4):'—')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-weight:700;color:'+(fail?'#c62828':'#1b6b35')+';">'+(r?(dev>=0?'+':'')+dev.toFixed(1)+' מ"מ':'—')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;">'+(fail?'🔴':'🟢')+'</td>' +
    '</tr>';
  }).join('');

  var html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Heebo,Arial,sans-serif;direction:rtl;padding:20px;font-size:13px;}' +
    'h2{color:#1a3d5c;font-size:20px;margin:0 0 4px 0;}' +
    'table{width:100%;border-collapse:collapse;margin:14px 0;}' +
    'th{background:#1a3d5c;color:#FFD700;padding:8px;text-align:center;font-size:12px;}' +
    '.summary{background:#f5f0e8;border-radius:8px;padding:12px;margin:12px 0;display:flex;gap:20px;}' +
    '.fail-list{background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:12px;margin-top:10px;}' +
    '@media print{.no-print{display:none!important;}}' +
    '</style></head><body>' +
    '<h2>🔴 דוח מדידת גבהים לייזר</h2>' +
    '<div style="font-size:12px;color:#555;margin-bottom:12px;">' +
      '<b>חדר:</b> '+gvEsc(s.room_name||'')+'&nbsp;|&nbsp;' +
      '<b>פרויקט:</b> '+gvEsc(s.project_name||'—')+'&nbsp;|&nbsp;' +
      '<b>תאריך:</b> '+new Date(s.created_at||Date.now()).toLocaleDateString('he-IL')+'&nbsp;|&nbsp;' +
      '<b>BM:</b> '+bm+' מ׳&nbsp;|&nbsp;<b>סבילות:</b> ±'+tol+' מ"מ' +
    '</div>' +
    '<div class="summary">' +
      '<div><div style="font-size:22px;font-weight:900;color:'+(fails.length>0?'#c62828':'#1b6b35')+';">'+(fails.length>0?fails.length+' ❌':pts.length+' ✅')+'</div><div style="font-size:11px;color:#888;">'+(fails.length>0?'חריגות':'כל הנקודות תקינות')+'</div></div>' +
      '<div><div style="font-size:22px;font-weight:900;color:#1a3d5c;">'+pts.length+'</div><div style="font-size:11px;color:#888;">סה"כ נקודות</div></div>' +
      '<div><div style="font-size:22px;font-weight:900;color:#1b6b35;">'+(pts.length-fails.length)+'</div><div style="font-size:11px;color:#888;">נקודות תקינות</div></div>' +
    '</div>' +
    '<table>' +
      '<tr><th>נקודה</th><th>X (מ׳)</th><th>Y (מ׳)</th><th>קריאה (מ׳)</th><th>סטייה (מ"מ)</th><th>סטטוס</th></tr>' +
      rowsHtml +
    '</table>' +
    (fails.length ? '<div class="fail-list"><b style="color:#c62828;">⚠️ נקודות חורגות מהסבילות:</b><br>' +
      fails.map(function(p){ return gvEsc(p.name)+' ('+((parseFloat(p.reading)||0 - bm)*1000).toFixed(1)+' מ"מ)'; }).join(' · ') +
    '</div>' : '') +
    '<div style="margin-top:16px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:8px;">Stonhard Israel | מדידת גבהים לייזר | '+new Date().toLocaleDateString('he-IL')+'</div>' +
    '</body></html>';

  var w = window.open('','_blank','width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 400); }
}

function gvMailSession(id) {
  var s = _gvSessions.find(function(x){ return x.id===id; });
  if (!s) return;
  var pts = []; try { pts = JSON.parse(s.points||'[]'); } catch(e){}
  var bm  = parseFloat(s.benchmark)||0;
  var tol = parseFloat(s.tolerance_mm)||5;
  var fails = pts.filter(function(p){ return Math.abs((parseFloat(p.reading)||0 - bm)*1000) > tol; });
  var body = 'דוח מדידת גבהים — '+s.room_name+'\n'+(s.project_name?'פרויקט: '+s.project_name+'\n':'')+
    'תאריך: '+new Date(s.created_at||Date.now()).toLocaleDateString('he-IL')+'\n'+
    'נקודות: '+pts.length+' | חריגות: '+fails.length+'\n\n'+
    pts.slice(0,15).map(function(p){ var d=((parseFloat(p.reading)||0)-bm)*1000; return p.name+': '+(parseFloat(p.reading)||0).toFixed(4)+' ('+d.toFixed(1)+' מ"מ)'; }).join('\n');
  window.location.href = 'mailto:?subject='+encodeURIComponent('דוח גבהים — '+s.room_name)+'&body='+encodeURIComponent(body);
}

function gvWASession(id) {
  var s = _gvSessions.find(function(x){ return x.id===id; });
  if (!s) return;
  var pts = []; try { pts = JSON.parse(s.points||'[]'); } catch(e){}
  var bm  = parseFloat(s.benchmark)||0;
  var tol = parseFloat(s.tolerance_mm)||5;
  var fails = pts.filter(function(p){ return Math.abs((parseFloat(p.reading)||0 - bm)*1000) > tol; });
  var msg = '🔴 *דוח מדידת גבהים — '+s.room_name+'*\n'+(s.project_name?'🏗️ '+s.project_name+'\n':'')+
    '📅 '+new Date(s.created_at||Date.now()).toLocaleDateString('he-IL')+'\n'+
    '📍 '+pts.length+' נקודות | ⚠️ '+fails.length+' חריגות\n\n'+
    (fails.length ? '🔴 חורגות:\n'+fails.map(function(p){ return '• '+p.name+': '+((parseFloat(p.reading)||0 - bm)*1000).toFixed(1)+' מ"מ'; }).join('\n') : '✅ כל הנקודות תקינות');
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

function gvMailReport(mode) { showToast('מכין מייל...','success'); setTimeout(function(){ gvMailSession({room_name:'מדידה', project_name:'', created_at:new Date().toISOString(), benchmark:0, tolerance_mm:5, points:JSON.stringify(_gvPoints)}).id; },100); }
function gvWAReport(mode) {
  var bm = parseFloat((document.getElementById('gv-'+mode+'-bm')||{}).value)||0;
  var tol = 5;
  var fails = _gvPoints.filter(function(p){ return Math.abs((parseFloat(p.reading)||0 - bm)*1000) > tol; });
  var msg = '🔴 *דוח מדידת גבהים*\n'+_gvPoints.length+' נקודות | '+fails.length+' חריגות';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

// ── HELPERS ───────────────────────────────────────────────────────────
function gvInp() {
  return 'width:100%;padding:9px 12px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;background:#fffbf0;box-sizing:border-box;';
}

function gvEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function gvNewSession() {
  var area = document.getElementById('gv-form-area');
  if (area) area.innerHTML = '';
  _gvPoints = [];
  _gvMode   = null;
  document.querySelector('[onclick="gvStartMode(\'a\')"]') && window.scrollTo({top:0,behavior:'smooth'});
}
