// ══════════════════════════════════════════════════════════════════════
// ROOF TILE CALCULATOR — roof_calc.js
// Standalone module for GitHub Pages + Supabase
// Calculates: pitch, rafter length, slope area, tiles, concrete, battens
//
// FORMULAS (all verified against Berger תוכנית גג drawing):
//
//   Pitch angle α = arctan(pitch% / 100)
//   Rise H        = ridge_elev - eave_elev  [m]
//   Run  R        = H / (pitch% / 100)       [m]
//   Rafter length = √(H² + R²)               [m]  ← Pythagoras
//   Slope factor  = 1 / cos(α)               [dimensionless]
//   Slope area    = plan_area × slope_factor  [m²]
//   Tiles needed  = slope_area / tile_cover × (1 + waste%)
//   Concrete m²   = slope_area × 0.06        [m³] ← 6cm screed
//   Battens       = (rafter_len / batten_spacing) × ridge_len
//
// TEST DATA — Berger נועה וליאור תוכנית גג (03.07.2025):
//   Pitch:      35% (19.3°)
//   Ridge:      +8.25m   Eave: +7.15m   Rise: 1.10m
//   Run:        3.14m    Rafter: 3.33m
//   Scale 1:50  Sections: North 9.5×6.5m, South 9.5×5.0m, Lower 5.0×4.0m
// ══════════════════════════════════════════════════════════════════════

var _rcFetched = false;
var _rcInited  = false;

// ── Supabase save ─────────────────────────────────────────────────────
async function rcSaveCalc(data) {
  try {
    if (!window.sb) return;
    await window.sb.from('roof_calculations').insert({
      project_id:    data.projectId || null,
      label:         data.label || 'גג רעפים',
      pitch_percent: data.pitchPct,
      pitch_degrees: data.pitchDeg,
      ridge_elev:    data.ridgeElev,
      eave_elev:     data.eaveElev,
      rise:          data.rise,
      run:           data.run,
      rafter_length: data.rafterLen,
      slope_factor:  data.slopeFactor,
      sections:      JSON.stringify(data.sections),
      total_plan_area:  data.totalPlanArea,
      total_slope_area: data.totalSlopeArea,
      total_tiles:      data.totalTiles,
      total_concrete:   data.totalConcrete,
      total_battens:    data.totalBattens,
      tile_type:     data.tileType,
      notes:         data.notes || '',
      created_at:    new Date().toISOString()
    });
    if (typeof showToast === 'function') showToast('✅ חישוב נשמר','success');
  } catch(e) {
    if (typeof showToast === 'function') showToast('שגיאה בשמירה: '+e.message,'error');
  }
}

// ── Main init ─────────────────────────────────────────────────────────
function rcInit() {
  if (_rcInited) return;
  _rcInited = true;

  var panel = document.getElementById('rc-panel');
  if (!panel) return;

  // Populate project dropdown
  var projSel = document.getElementById('rc-project');
  if (projSel && window.allProjects && window.allProjects.length) {
    projSel.innerHTML = '<option value="">— בחר פרויקט —</option>' +
      window.allProjects.map(function(p){
        return '<option value="'+p.id+'">'+rcEsc(p.project_name)+'</option>';
      }).join('');
  }

  // Load Berger demo data
  rcLoadBergerDemo();
  rcCalculate();
}

function rcLoadBergerDemo() {
  var set = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  };
  set('rc-label',       'ברגר נועה וליאור — תוכנית גג');
  set('rc-pitch-pct',   '35');
  set('rc-ridge-elev',  '8.25');
  set('rc-eave-elev',   '7.15');
  set('rc-tile-type',   'roman');
  set('rc-tile-cover',  '0.034');
  set('rc-waste',       '10');
  set('rc-batten-sp',   '0.34');
  set('rc-concrete-th', '6');
  // Sections
  document.getElementById('rc-sections').innerHTML = '';
  rcAddSection('גג צפון',  '9.50', '6.50');
  rcAddSection('גג דרום',  '9.50', '5.00');
  rcAddSection('גג נמוך',  '5.00', '4.00');
}

// ── Section management ────────────────────────────────────────────────
var _rcSectionId = 0;
function rcAddSection(name, w, l) {
  var id = ++_rcSectionId;
  var div = document.createElement('div');
  div.id = 'rc-sec-'+id;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;background:rgba(26,61,92,0.06);border-radius:8px;padding:10px;border:1px solid rgba(26,61,92,0.12);';
  div.innerHTML =
    '<input placeholder="שם מדור" value="'+rcEsc(name||'')+'" oninput="rcCalculate()" style="'+rcInputStyle()+'" title="שם המדור / קטע הגג">' +
    '<input type="number" placeholder="רוחב (מ\')" value="'+rcEsc(w||'')+'" min="0" step="0.01" oninput="rcCalculate()" style="'+rcInputStyle()+'" title="רוחב בתוכנית (מטרים)">' +
    '<input type="number" placeholder="אורך (מ\')" value="'+rcEsc(l||'')+'" min="0" step="0.01" oninput="rcCalculate()" style="'+rcInputStyle()+'" title="אורך בתוכנית (מטרים)">' +
    '<button onclick="document.getElementById(\'rc-sec-'+id+'\').remove();rcCalculate();" style="background:#fee2e2;border:1px solid #fca5a5;color:#c62828;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px;" title="מחק מדור">×</button>';
  document.getElementById('rc-sections').appendChild(div);
  rcCalculate();
}

function rcInputStyle() {
  return 'width:100%;border:1px solid rgba(26,61,92,0.2);border-radius:6px;padding:7px 10px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;box-sizing:border-box;background:#fff;';
}

// ── CORE CALCULATION ENGINE ───────────────────────────────────────────
function rcCalculate() {
  var pitchPct   = parseFloat(document.getElementById('rc-pitch-pct')  ?.value) || 0;
  var ridgeElev  = parseFloat(document.getElementById('rc-ridge-elev') ?.value) || 0;
  var eaveElev   = parseFloat(document.getElementById('rc-eave-elev')  ?.value) || 0;
  var tileCover  = parseFloat(document.getElementById('rc-tile-cover') ?.value) || 0.034;
  var waste      = parseFloat(document.getElementById('rc-waste')       ?.value) || 10;
  var battenSp   = parseFloat(document.getElementById('rc-batten-sp')  ?.value) || 0.34;
  var concreteTh = parseFloat(document.getElementById('rc-concrete-th')?.value) || 6;
  var tileType   = document.getElementById('rc-tile-type')?.value || 'roman';

  // ── FORMULA 1: Pitch angle ────────────────────────────────────────
  var alpha = Math.atan(pitchPct / 100);          // radians
  var alphaDeg = alpha * 180 / Math.PI;            // degrees

  // ── FORMULA 2: Rise & Run from elevations ────────────────────────
  var rise = ridgeElev - eaveElev;                 // H = ridge - eave [m]
  var run  = pitchPct > 0 ? rise / (pitchPct/100) : 0;  // R = H / tan(α)

  // ── FORMULA 3: Rafter (slope) length ─────────────────────────────
  var rafterLen = Math.sqrt(rise*rise + run*run);  // Pythagoras: √(H²+R²)

  // ── FORMULA 4: Slope factor ───────────────────────────────────────
  var slopeFactor = alpha > 0 ? 1 / Math.cos(alpha) : 1;  // 1/cos(α)

  // ── FORMULA 5: Per-section calculations ──────────────────────────
  var secEls = document.getElementById('rc-sections').children;
  var sections = [];
  var totalPlan = 0, totalSlope = 0, totalTiles = 0, totalConcrete = 0, totalBattens = 0;

  for (var i = 0; i < secEls.length; i++) {
    var inputs = secEls[i].querySelectorAll('input');
    if (inputs.length < 3) continue;
    var secName = inputs[0].value || ('מדור '+(i+1));
    var secW    = parseFloat(inputs[1].value) || 0;
    var secL    = parseFloat(inputs[2].value) || 0;

    var planArea  = secW * secL;                           // m² plan
    var slopeArea = planArea * slopeFactor;                // m² actual
    var tilesNeeded = tileCover > 0
      ? Math.ceil(slopeArea / tileCover * (1 + waste/100)) : 0;
    var concreteVol = slopeArea * (concreteTh/100);        // m³ (cm→m)
    var battens     = rafterLen > 0 && battenSp > 0
      ? Math.ceil(rafterLen / battenSp) * secW            : 0; // linear m

    totalPlan     += planArea;
    totalSlope    += slopeArea;
    totalTiles    += tilesNeeded;
    totalConcrete += concreteVol;
    totalBattens  += battens;

    sections.push({ name:secName, w:secW, l:secL,
      planArea, slopeArea, tilesNeeded, concreteVol, battens });
  }

  // ── RENDER RESULTS ────────────────────────────────────────────────
  var fmt = function(n, d) { return isNaN(n) ? '—' : n.toFixed(d||2); };
  var fmtI= function(n)    { return isNaN(n) ? '—' : Math.ceil(n).toLocaleString(); };

  // Pitch display
  rcSet('rc-res-alpha',   fmt(alphaDeg,1)+'°');
  rcSet('rc-res-rise',    fmt(rise,2)+' מ\'');
  rcSet('rc-res-run',     fmt(run,2)+' מ\'');
  rcSet('rc-res-rafter',  fmt(rafterLen,2)+' מ\'');
  rcSet('rc-res-sfactor', fmt(slopeFactor,4));

  // Totals
  rcSet('rc-res-plan',      fmt(totalPlan,2)+' מ"ר');
  rcSet('rc-res-slope',     fmt(totalSlope,2)+' מ"ר');
  rcSet('rc-res-tiles',     fmtI(totalTiles)+' רעפים');
  rcSet('rc-res-concrete',  fmt(totalConcrete,3)+' מ"ק');
  rcSet('rc-res-battens',   fmt(totalBattens,1)+' מ\'ר');

  // Section breakdown table
  var tbody = document.getElementById('rc-sec-tbody');
  if (tbody) {
    tbody.innerHTML = sections.map(function(s){
      return '<tr style="border-bottom:1px solid rgba(26,61,92,0.08);">' +
        '<td style="padding:8px 10px;font-weight:700;">'+rcEsc(s.name)+'</td>' +
        '<td style="padding:8px 10px;text-align:center;">'+fmt(s.w,2)+'×'+fmt(s.l,2)+'</td>' +
        '<td style="padding:8px 10px;text-align:center;">'+fmt(s.planArea,2)+'</td>' +
        '<td style="padding:8px 10px;text-align:center;color:#1a3d5c;font-weight:700;">'+fmt(s.slopeArea,2)+'</td>' +
        '<td style="padding:8px 10px;text-align:center;color:#7c3aed;font-weight:700;">'+fmtI(s.tilesNeeded)+'</td>' +
        '<td style="padding:8px 10px;text-align:center;">'+fmt(s.concreteVol,3)+'</td>' +
        '<td style="padding:8px 10px;text-align:center;">'+fmt(s.battens,1)+'</td>' +
      '</tr>';
    }).join('');
  }

  // Formula display
  rcSet('rc-formula-txt',
    'שיפוע: '+fmt(pitchPct,0)+'% → α = arctan('+fmt(pitchPct,0)+'/100) = '+fmt(alphaDeg,1)+'°' +
    ' | עלייה H = '+fmt(ridgeElev,2)+' − '+fmt(eaveElev,2)+' = '+fmt(rise,2)+'מ\'' +
    ' | מרחק אופקי R = H/tan(α) = '+fmt(run,2)+'מ\'' +
    ' | אורך רוחב = √(H²+R²) = √('+fmt(rise,2)+'²+'+fmt(run,2)+'²) = '+fmt(rafterLen,2)+'מ\'' +
    ' | מקדם שיפוע = 1/cos(α) = '+fmt(slopeFactor,4) +
    ' | שטח גג = שטח תוכנית × '+fmt(slopeFactor,4)
  );

  // Store for save
  window._rcLastCalc = {
    pitchPct, pitchDeg: alphaDeg, ridgeElev, eaveElev,
    rise, run, rafterLen, slopeFactor, tileType,
    sections, totalPlanArea: totalPlan, totalSlopeArea: totalSlope,
    totalTiles, totalConcrete, totalBattens,
    label: document.getElementById('rc-label')?.value || 'גג רעפים',
    projectId: document.getElementById('rc-project')?.value || null,
    notes: document.getElementById('rc-notes')?.value || ''
  };
}

function rcSet(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
function rcEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PRINT / EXPORT ────────────────────────────────────────────────────
function rcPrintReport() {
  var d = window._rcLastCalc;
  if (!d) return;
  var tileNames = {roman:'רומי',marseille:'מרסיי',flat:'שטוח',concrete:'בטון',slate:'פצלת'};
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">' +
    '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:30px;color:#1a1a1a;font-size:13px;}' +
    'h1{color:#1a3d5c;border-bottom:3px solid #c9a84c;padding-bottom:8px;}' +
    'h2{color:#1a3d5c;font-size:14px;margin-top:20px;}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:12px 0;}' +
    '.card{background:#f5f0e8;border:1px solid #c9a84c;border-radius:8px;padding:12px;text-align:center;}' +
    '.card-val{font-size:20px;font-weight:900;color:#1a3d5c;}' +
    '.card-lbl{font-size:10px;color:#888;margin-top:4px;}' +
    'table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px;}' +
    'th{background:#1a3d5c;color:#fff;padding:8px 10px;text-align:center;}' +
    'td{padding:7px 10px;border-bottom:1px solid #eee;text-align:center;}' +
    '.formula{background:#e8f0fd;border-right:4px solid #1a3d5c;padding:10px 14px;border-radius:6px;font-size:11px;font-family:monospace;margin:12px 0;line-height:1.8;}' +
    '@media print{button{display:none}}' +
    '</style></head><body>' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div><h1>📐 דוח חישוב גג רעפים</h1><div style="font-size:12px;color:#888;">'+rcEsc(d.label)+' | '+new Date().toLocaleDateString('he-IL')+'</div></div>' +
      '<button onclick="window.print()" style="background:#1a3d5c;color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-size:13px;font-weight:700;">🖨️ הדפס</button>' +
    '</div>' +
    '<h2>פרמטרי שיפוע</h2>' +
    '<div class="formula">' +
      'שיפוע: '+d.pitchPct+'% = '+d.pitchDeg.toFixed(1)+'° | ' +
      'עלייה (H): '+d.rise.toFixed(2)+'מ\' | ' +
      'מרחק אופקי (R): '+d.run.toFixed(2)+'מ\'<br>' +
      'אורך ראפטר: √(H²+R²) = √('+d.rise.toFixed(2)+'²+'+d.run.toFixed(2)+'²) = <b>'+d.rafterLen.toFixed(2)+'מ\'</b><br>' +
      'מקדם שיפוע: 1/cos('+d.pitchDeg.toFixed(1)+'°) = <b>'+d.slopeFactor.toFixed(4)+'</b> | ' +
      'כיסוי רעף: '+((d.totalTiles>0&&d.totalSlopeArea>0)?(d.totalSlopeArea/d.totalTiles*100).toFixed(1)+' דמ"ר':'—') +
    '</div>' +
    '<h2>סיכום כמויות</h2>' +
    '<div class="grid">' +
      '<div class="card"><div class="card-val">'+d.totalPlanArea.toFixed(1)+' מ"ר</div><div class="card-lbl">שטח תוכנית</div></div>' +
      '<div class="card"><div class="card-val">'+d.totalSlopeArea.toFixed(1)+' מ"ר</div><div class="card-lbl">שטח גג בפועל</div></div>' +
      '<div class="card"><div class="card-val">'+Math.ceil(d.totalTiles).toLocaleString()+'</div><div class="card-lbl">רעפים + '+10+'% בזבוז</div></div>' +
      '<div class="card"><div class="card-val">'+d.totalConcrete.toFixed(3)+' מ"ק</div><div class="card-lbl">בטון / שכבת ייצוב</div></div>' +
      '<div class="card"><div class="card-val">'+d.totalBattens.toFixed(1)+' מ\'ר</div><div class="card-lbl">לוחות ריצוף (חלוקים)</div></div>' +
      '<div class="card"><div class="card-val">'+(tileNames[d.tileType]||d.tileType)+'</div><div class="card-lbl">סוג רעף</div></div>' +
    '</div>' +
    '<h2>פירוט מדורים</h2>' +
    '<table><thead><tr><th>מדור</th><th>מידות (מ\')</th><th>שטח תוכנית</th><th>שטח גג</th><th>רעפים</th><th>בטון מ"ק</th><th>חלוקים מ\'ר</th></tr></thead><tbody>' +
    d.sections.map(function(s){
      return '<tr><td style="font-weight:700;text-align:right;">'+rcEsc(s.name)+'</td>' +
        '<td>'+s.w.toFixed(2)+'×'+s.l.toFixed(2)+'</td>' +
        '<td>'+s.planArea.toFixed(2)+'</td>' +
        '<td><b>'+s.slopeArea.toFixed(2)+'</b></td>' +
        '<td><b>'+Math.ceil(s.tilesNeeded).toLocaleString()+'</b></td>' +
        '<td>'+s.concreteVol.toFixed(3)+'</td>' +
        '<td>'+s.battens.toFixed(1)+'</td></tr>';
    }).join('') +
    '</tbody></table>' +
    (d.notes?'<div style="margin-top:16px;background:#fffbf0;border:1px solid #c9a84c;border-radius:8px;padding:12px;font-size:12px;"><b>הערות:</b> '+rcEsc(d.notes)+'</div>':'') +
    '<div style="margin-top:20px;font-size:10px;color:#ccc;text-align:center;">חישוב גג רעפים — מחשבון הנדסי | '+new Date().toLocaleString('he-IL')+'</div>' +
    '</body></html>';
  var w = window.open('','_blank','width=1000,height=750');
  if (w) { w.document.write(html); w.document.close(); }
}

function rcEmailReport() {
  var d = window._rcLastCalc;
  if (!d) return;
  var body = 'דוח חישוב גג רעפים — '+d.label+'\n\n' +
    'שיפוע: '+d.pitchPct+'% ('+d.pitchDeg.toFixed(1)+'°)\n' +
    'עלייה: '+d.rise.toFixed(2)+'מ\' | אורך ראפטר: '+d.rafterLen.toFixed(2)+'מ\'\n\n' +
    'שטח תוכנית: '+d.totalPlanArea.toFixed(2)+' מ"ר\n' +
    'שטח גג: '+d.totalSlopeArea.toFixed(2)+' מ"ר\n' +
    'רעפים: '+Math.ceil(d.totalTiles).toLocaleString()+' יחידות\n' +
    'בטון: '+d.totalConcrete.toFixed(3)+' מ"ק\n' +
    'חלוקים: '+d.totalBattens.toFixed(1)+' מ\'ר\n\n' +
    'פירוט מדורים:\n' +
    d.sections.map(function(s){ return '• '+s.name+': '+s.w+'×'+s.l+'='+s.planArea.toFixed(1)+' מ"ר תוכנית → '+s.slopeArea.toFixed(1)+' מ"ר גג | '+Math.ceil(s.tilesNeeded)+' רעפים'; }).join('\n');
  window.location.href = 'mailto:?subject='+encodeURIComponent('חישוב גג רעפים — '+d.label)+'&body='+encodeURIComponent(body);
}

function rcWhatsApp() {
  var d = window._rcLastCalc;
  if (!d) return;
  var msg = '📐 *חישוב גג רעפים — '+d.label+'*\n\n' +
    '🔢 שיפוע: '+d.pitchPct+'% ('+d.pitchDeg.toFixed(1)+'°)\n' +
    '📏 ראפטר: '+d.rafterLen.toFixed(2)+'מ\'\n\n' +
    '📐 שטח גג: *'+d.totalSlopeArea.toFixed(1)+' מ"ר*\n' +
    '🏗️ רעפים: *'+Math.ceil(d.totalTiles).toLocaleString()+'* יחידות\n' +
    '🪨 בטון: '+d.totalConcrete.toFixed(3)+' מ"ק\n' +
    '🪵 חלוקים: '+d.totalBattens.toFixed(1)+' מ\'ר';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
