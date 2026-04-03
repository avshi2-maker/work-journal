// ══════════════════════════════════════════════════════════════════════
// QUOTE BUILDER — quote_builder.js
// מערכת תומכת החלטות — בניית הצעות מחיר מקצועיות
// ══════════════════════════════════════════════════════════════════════
var _qb = {
  projectId:   null,
  projectName: '',
  clientName:  '',
  items:       [],   // { id, desc, type, qty, unit, unitPrice, priority, days, notes }
  fixed:       [],   // { id, desc, amount }
  riskLevel:   'medium',
  margin:      20,
  paymentTerms:{ advance:20, milestones:[], final:20 },
  aiQuestions: [],
  ganttLinked: false
};

var _qbNextId = 1;

// ── Open builder ──────────────────────────────────────────────────────
function openQuoteBuilder(projectId, projectName, clientName) {
  _qb.projectId   = projectId   || null;
  _qb.projectName = projectName || '';
  _qb.clientName  = clientName  || '';
  _qb.items       = [];
  _qb.fixed       = [];
  _qb.riskLevel   = 'medium';
  _qb.margin      = 20;
  _qb.aiQuestions = [];
  _qbNextId       = 1;

  // Add 3 default item rows
  _qbAddItem(); _qbAddItem(); _qbAddItem();
  // Add 2 default fixed costs
  _qbAddFixed('תחבורה ולוגיסטיקה', 0);
  _qbAddFixed('ביטוח וביטחון', 0);
  _qbAddFixed('פיקוח והנהלה', 0);

  document.getElementById('qb-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _qbPopulateProjects();
  _qbRender();
}

function closeQuoteBuilder() {
  document.getElementById('qb-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Item management ───────────────────────────────────────────────────
function _qbAddItem(desc, type, qty, unitPrice, unit, priority, days, notes) {
  _qb.items.push({
    id:        _qbNextId++,
    desc:      desc      || '',
    type:      type      || 'labor',   // labor / material / equipment / combined / subcontract
    qty:       qty       || 1,
    unit:      unit      || 'יח\'',
    unitPrice: unitPrice || 0,
    priority:  priority  || 3,
    days:      days      || 1,
    notes:     notes     || ''
  });
}

function _qbAddFixed(desc, amount) {
  _qb.fixed.push({ id: _qbNextId++, desc: desc||'', amount: amount||0 });
}

function _qbRemoveItem(id) {
  _qb.items = _qb.items.filter(function(i){ return i.id !== id; });
  _qbRender();
}

function _qbRemoveFixed(id) {
  _qb.fixed = _qb.fixed.filter(function(f){ return f.id !== id; });
  _qbRender();
}

function _qbUpdateItem(id, field, value) {
  var item = _qb.items.find(function(i){ return i.id === id; });
  if (!item) return;
  if (field === 'qty' || field === 'unitPrice' || field === 'days') {
    item[field] = parseFloat(value) || 0;
    _qbUpdateTotals();
  } else if (field === 'priority') {
    item[field] = parseInt(value) || 3;
    // Update priority badge color only
    var PRIO_COLORS = ['','#22c55e','#86efac','#f59e0b','#ef4444','#7f1d1d'];
    var sel = document.querySelector('[data-prio-id="'+id+'"]');
    if (sel) sel.style.background = (PRIO_COLORS[item.priority]||'#888')+'22';
  } else if (field === 'type') {
    item[field] = value;
    // Re-render only the type select — no full re-render needed
  } else {
    item[field] = value;
  }
}

function _qbUpdateFixed(id, field, value) {
  var f = _qb.fixed.find(function(x){ return x.id === id; });
  if (!f) return;
  f[field] = field === 'amount' ? (parseFloat(value)||0) : value;
  _qbUpdateTotals();
}

// ── Calculations ──────────────────────────────────────────────────────
function _qbCalc() {
  var directCost = _qb.items.reduce(function(sum, i) {
    return sum + (parseFloat(i.qty)||0) * (parseFloat(i.unitPrice)||0);
  }, 0);

  var fixedCost = _qb.fixed.reduce(function(sum, f) {
    return sum + (parseFloat(f.amount)||0);
  }, 0);

  var subTotal = directCost + fixedCost;

  var riskPct = { low:4, medium:8, high:15, very_high:22 }[_qb.riskLevel] || 8;
  var riskAmount = subTotal * riskPct / 100;

  var costTotal = subTotal + riskAmount;
  var marginAmount = costTotal * _qb.margin / 100;
  var finalPrice = costTotal + marginAmount;

  var totalDays = _qb.items.reduce(function(max, i){ return Math.max(max, parseFloat(i.days)||0); }, 0);

  return {
    directCost:   directCost,
    fixedCost:    fixedCost,
    subTotal:     subTotal,
    riskPct:      riskPct,
    riskAmount:   riskAmount,
    costTotal:    costTotal,
    marginPct:    _qb.margin,
    marginAmount: marginAmount,
    finalPrice:   finalPrice,
    totalDays:    totalDays,
    roi:          subTotal > 0 ? Math.round(marginAmount / subTotal * 100) : 0
  };
}

function _qbFmt(n) {
  return '₪' + Math.round(n).toLocaleString('he-IL');
}

// ── Render ────────────────────────────────────────────────────────────
function _qbRender() {
  var c = _qbCalc();

  var TYPE_HE = { labor:'עבודה', material:'חומרים', equipment:'ציוד', combined:'עבודה וחומרים', subcontract:'קומפלט' };
  var UNIT_OPTS = ['יח\'','מ"ר','מ\'','מ"ק','ש"ע','יום','חודש','ק"ג','ט'].map(function(u){
    return '<option>'+u+'</option>';
  }).join('');
  var PRIO_COLORS = ['','#22c55e','#86efac','#f59e0b','#ef4444','#7f1d1d'];
  var PRIO_LABELS = ['','1 — נמוכה','2 — רגילה','3 — בינונית','4 — גבוהה','5 — קריטית'];

  var container = document.getElementById('qb-body');
  if (!container) return;

  container.innerHTML =

  // ── Header info ──────────────────────────────────────────────────
  '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px;">' +
    '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">שם לקוח</label>' +
      '<input value="'+(_qb.clientName||'')+'" oninput="_qb.clientName=this.value" placeholder="שם הלקוח / חברה..." style="'+_qbInp()+'"></div>' +
    '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">פרויקט</label>' +
      '<select id="qb-project-sel" onchange="_qbProjectChange(this)" style="'+_qbInp()+'"><option value="">בחר פרויקט...</option></select></div>' +
    '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">כותרת הצעה</label>' +
      '<input value="'+(_qb.projectName||'')+'" oninput="_qb.projectName=this.value" placeholder="תיאור קצר של ההצעה..." style="'+_qbInp()+'"></div>' +
    '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">תאריך הצעה</label>' +
      '<input type="date" id="qb-date" value="'+new Date().toISOString().split('T')[0]+'" style="'+_qbInp()+'"></div>' +
  '</div>' +

  // ── Section 1: Direct costs ───────────────────────────────────────
  '<div style="margin-bottom:24px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
      '<div style="font-size:13px;font-weight:900;color:#1a3d5c;">📋 סעיפי עבודה וחומרים</div>' +
      '<button onclick="_qbAddItem();_qbRender()" style="'+_qbBtn('#1a3d5c')+'">➕ הוסף שורה</button>' +
    '</div>' +
    '<div style="overflow-x:auto;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px;">' +
    '<thead><tr style="background:#f5e9c4;">' +
      '<th style="padding:8px;text-align:right;font-weight:800;color:#5a4010;">תיאור</th>' +
      '<th style="padding:8px;text-align:right;font-weight:800;color:#5a4010;">סוג</th>' +
      '<th style="padding:8px;text-align:center;font-weight:800;color:#5a4010;">כמות</th>' +
      '<th style="padding:8px;text-align:right;font-weight:800;color:#5a4010;">יחידה</th>' +
      '<th style="padding:8px;text-align:center;font-weight:800;color:#5a4010;">מחיר ליח\'</th>' +
      '<th style="padding:8px;text-align:center;font-weight:800;color:#5a4010;">ימים</th>' +
      '<th style="padding:8px;text-align:center;font-weight:800;color:#5a4010;" title="קריטיות 1-5">⚡</th>' +
      '<th style="padding:8px;text-align:center;font-weight:800;color:#5a4010;">סה"כ</th>' +
      '<th style="padding:8px;"></th>' +
    '</tr></thead><tbody>' +
    _qb.items.map(function(item) {
      var total = (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
      var pc = PRIO_COLORS[item.priority] || '#888';
      return '<tr style="border-bottom:1px solid #e2d0a0;">' +
        '<td style="padding:6px 4px;"><input value="'+item.desc+'" oninput="_qbUpdateItem('+item.id+',\'desc\',this.value)" placeholder="תיאור הסעיף..." style="'+_qbInp('width:100%;min-width:180px;')+'"></td>' +
        '<td style="padding:6px 4px;"><select onchange="_qbUpdateItem('+item.id+',\'type\',this.value)" style="'+_qbInp()+'">'+
          Object.keys(TYPE_HE).map(function(k){ return '<option value="'+k+'"'+(item.type===k?' selected':'')+'>'+TYPE_HE[k]+'</option>'; }).join('') +
        '</select></td>' +
        '<td style="padding:6px 4px;"><input type="number" value="'+item.qty+'" min="0" step="0.5" oninput="_qbUpdateItem('+item.id+',\'qty\',this.value)" style="'+_qbInp('width:70px;text-align:center;')+'"></td>' +
        '<td style="padding:6px 4px;"><select onchange="_qbUpdateItem('+item.id+',\'unit\',this.value)" style="'+_qbInp()+'">'+
          UNIT_OPTS.replace('value="'+item.unit+'"','value="'+item.unit+'" selected') +
        '</select></td>' +
        '<td style="padding:6px 4px;"><input type="number" value="'+item.unitPrice+'" min="0" oninput="_qbUpdateItem('+item.id+',\'unitPrice\',this.value)" style="'+_qbInp('width:90px;text-align:center;')+'"></td>' +
        '<td style="padding:6px 4px;"><input type="number" value="'+item.days+'" min="1" oninput="_qbUpdateItem('+item.id+',\'days\',this.value)" style="'+_qbInp('width:60px;text-align:center;')+'"></td>' +
        '<td style="padding:6px 4px;text-align:center;">' +
          '<select data-prio-id="'+item.id+'" onchange="_qbUpdateItem('+item.id+',\'priority\',this.value)" style="background:'+pc+'22;border:2px solid '+pc+';border-radius:6px;padding:4px 6px;font-size:11px;font-weight:800;color:'+pc+';font-family:Heebo,sans-serif;cursor:pointer;">' +
          [1,2,3,4,5].map(function(p){ return '<option value="'+p+'"'+(item.priority===p?' selected':'')+'>'+p+'</option>'; }).join('') +
          '</select>' +
        '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:800;color:#1a3d5c;white-space:nowrap;">₪'+Math.round(total).toLocaleString()+'</td>' +
        '<td style="padding:6px 4px;"><button onclick="_qbRemoveItem('+item.id+');_qbRender()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">🗑️</button></td>' +
      '</tr>';
    }).join('') +
    '<tr style="background:#f5e9c4;font-weight:900;">' +
      '<td colspan="7" style="padding:10px 8px;color:#5a4010;font-size:13px;">סה"כ עלויות ישירות</td>' +
      '<td style="padding:10px 8px;font-size:14px;color:#1a3d5c;font-weight:900;">'+_qbFmt(c.directCost)+'</td><td></td>' +
    '</tr>' +
    '</tbody></table></div></div>' +

  // ── Section 2: Fixed costs ────────────────────────────────────────
  '<div style="margin-bottom:24px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
      '<div style="font-size:13px;font-weight:900;color:#1a3d5c;">🏢 הוצאות קבועות ועקיפות</div>' +
      '<button onclick="_qbAddFixed();_qbRender()" style="'+_qbBtn('#1a3d5c')+'">➕ הוסף</button>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
    _qb.fixed.map(function(f) {
      return '<div style="display:flex;gap:10px;align-items:center;">' +
        '<input value="'+f.desc+'" oninput="_qbUpdateFixed('+f.id+',\'desc\',this.value)" placeholder="תיאור הוצאה..." style="'+_qbInp('flex:1;')+'">' +
        '<input type="number" value="'+f.amount+'" min="0" oninput="_qbUpdateFixed('+f.id+',\'amount\',this.value)" placeholder="₪" style="'+_qbInp('width:120px;text-align:center;')+'">'+
        '<button onclick="_qbRemoveFixed('+f.id+');_qbRender()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">🗑️</button>' +
      '</div>';
    }).join('') +
    '<div style="display:flex;justify-content:flex-end;font-weight:800;color:#1a3d5c;padding:8px 0;border-top:1px solid #e2d0a0;margin-top:4px;">סה"כ הוצאות קבועות: '+_qbFmt(c.fixedCost)+'</div>' +
    '</div></div>' +

  // ── Section 3: Risk ───────────────────────────────────────────────
  '<div style="background:#fff8e6;border:1.5px solid #c9a84c;border-radius:12px;padding:16px;margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:900;color:#7a6030;margin-bottom:12px;">⚠️ רמת סיכון פרויקט</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    [
      { id:'low',       label:'🟢 נמוך',       pct:4,  desc:'פרויקט פשוט, לקוח מוכר' },
      { id:'medium',    label:'🟡 בינוני',      pct:8,  desc:'פרויקט רגיל, לקוח חדש' },
      { id:'high',      label:'🔴 גבוה',        pct:15, desc:'פרויקט מורכב, לוחות זמנים לחוצים' },
      { id:'very_high', label:'🚨 גבוה מאוד',   pct:22, desc:'פרויקט ראשון בסוג, סביבה קשה' }
    ].map(function(r) {
      var sel = _qb.riskLevel === r.id;
      return '<label style="flex:1;min-width:140px;background:'+(sel?'#c9a84c22':'#fff')+';border:2px solid '+(sel?'#c9a84c':'#e2d0a0')+';border-radius:10px;padding:10px;cursor:pointer;display:block;">' +
        '<input type="radio" name="qb-risk" value="'+r.id+'" '+(sel?'checked':'')+' onchange="_qb.riskLevel=this.value;_qbRender()" style="display:none;">' +
        '<div style="font-size:13px;font-weight:800;color:#5a4010;">'+r.label+' (+'+r.pct+'%)</div>' +
        '<div style="font-size:10px;color:#888;margin-top:3px;">'+r.desc+'</div>' +
      '</label>';
    }).join('') +
    '</div>' +
    '<div style="margin-top:10px;font-size:12px;color:#9a6f00;font-weight:700;">תוספת סיכון: '+_qbFmt(c.riskAmount)+' ('+c.riskPct+'%)</div>' +
  '</div>' +

  // ── Section 4: Margin slider ──────────────────────────────────────
  '<div style="background:#f0f4ff;border:1.5px solid #3b82f6;border-radius:12px;padding:16px;margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:900;color:#1e40af;margin-bottom:12px;">💹 מרווח רווח</div>' +
    '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">' +
      '<input type="range" min="5" max="50" value="'+_qb.margin+'" oninput="_qb.margin=parseInt(this.value);document.getElementById(\'qb-margin-val\').textContent=this.value+\'%\';_qbUpdateTotals()" style="flex:1;min-width:200px;accent-color:#3b82f6;">' +
      '<div id="qb-margin-val" style="font-size:24px;font-weight:900;color:#1e40af;min-width:60px;">'+_qb.margin+'%</div>' +
      '<div style="font-size:13px;color:#3b82f6;font-weight:700;">רווח: '+_qbFmt(c.marginAmount)+'</div>' +
    '</div>' +
  '</div>' +

  // ── Section 5: Payment terms ──────────────────────────────────────
  '<div style="background:#f0fff4;border:1.5px solid #22c55e;border-radius:12px;padding:16px;margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:900;color:#166534;margin-bottom:12px;">💳 תנאי תשלום</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
      '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">מקדמה %</label>' +
        '<input type="number" min="0" max="100" value="'+(_qb.paymentTerms.advance||20)+'" oninput="_qb.paymentTerms.advance=parseInt(this.value)||0" style="'+_qbInp('width:80px;text-align:center;')+'"></div>' +
      '<div style="flex:1;min-width:200px;"><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">תשלומים לפי שלבים / תנאים</label>' +
        '<input value="'+(_qb.paymentTerms.milestones||'')+'" oninput="_qb.paymentTerms.milestones=this.value" placeholder="לדוגמה: 40% בסיום שלב א׳, 30% בסיום שלב ב׳" style="'+_qbInp('width:100%;')+'"></div>' +
      '<div><label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">יתרה לסיום %</label>' +
        '<input type="number" min="0" max="100" value="'+(_qb.paymentTerms.final||10)+'" oninput="_qb.paymentTerms.final=parseInt(this.value)||0" style="'+_qbInp('width:80px;text-align:center;')+'"></div>' +
    '</div>' +
  '</div>' +

  // ── Summary card ──────────────────────────────────────────────────
  '<div style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border-radius:16px;padding:20px;margin-bottom:20px;color:#fff;">' +
    '<div style="font-size:14px;font-weight:900;margin-bottom:16px;">📊 סיכום הצעת מחיר</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px;">' +
      _qbSummaryCard('עלויות ישירות', _qbFmt(c.directCost), '#93c5fd') +
      _qbSummaryCard('הוצאות קבועות', _qbFmt(c.fixedCost), '#93c5fd') +
      _qbSummaryCard('סיכון ('+c.riskPct+'%)', _qbFmt(c.riskAmount), '#fde68a') +
      _qbSummaryCard('רווח ('+c.marginPct+'%)', _qbFmt(c.marginAmount), '#86efac') +
      _qbSummaryCard('מחיר ללקוח', _qbFmt(c.finalPrice), '#fff', '20px', '900') +
      _qbSummaryCard('ROI', c.roi+'%', '#c4b5fd') +
      _qbSummaryCard('זמן כולל', c.totalDays+' ימים', '#fca5a5') +
    '</div>' +
    '<div id="qb-totals-row" style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.2);padding-top:14px;flex-wrap:wrap;gap:10px;">' +
      '<div style="font-size:13px;opacity:.8;">+מע"מ 18%: '+_qbFmt(c.finalPrice*1.18)+'</div>' +
      '<div style="font-size:28px;font-weight:900;">'+_qbFmt(c.finalPrice)+'</div>' +
    '</div>' +
  '</div>' +

  // ── AI Button ─────────────────────────────────────────────────────
  '<div style="margin-bottom:20px;">' +
    '<button onclick="qbRunAI()" style="width:100%;padding:16px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;color:#fff;border-radius:12px;font-family:Heebo,sans-serif;font-size:15px;font-weight:900;cursor:pointer;">🧠 ניתוח AI — הערכת סיכונים + שאלות קריטיות</button>' +
    '<div id="qb-ai-result" style="margin-top:14px;"></div>' +
  '</div>' +

  // ── Action bar ────────────────────────────────────────────────────
  '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    '<button onclick="qbSave()" style="'+_qbBtn('#1a3d5c','flex:1;padding:14px;font-size:14px;')+'">💾 שמור הצעה</button>' +
    '<button onclick="qbPrint()" style="'+_qbBtn('#5a4010','flex:1;padding:14px;font-size:14px;')+'">🖨️ הדפס</button>' +
    '<button onclick="qbSendWA()" style="'+_qbBtn('#15803d','flex:1;padding:14px;font-size:14px;')+'">💬 שלח ללקוח</button>' +
    '<button onclick="qbLinkGantt()" style="'+_qbBtn('#4f46e5','flex:1;padding:14px;font-size:14px;')+'">📅 קשר לגאנט</button>' +
  '</div>';

  // Populate project select
  setTimeout(_qbPopulateProjects, 0);
}

function _qbSummaryCard(label, value, color, size, weight) {
  return '<div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:10px 12px;">' +
    '<div style="font-size:10px;color:'+color+';opacity:.8;margin-bottom:4px;">'+label+'</div>' +
    '<div style="font-size:'+(size||'16px')+';font-weight:'+(weight||'700')+';color:'+color+';">'+value+'</div>' +
  '</div>';
}

function _qbInp(extra) {
  return 'padding:8px 10px;border:1.5px solid #e2d0a0;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;background:#fff;color:#2c1f00;'+(extra||'');
}

function _qbBtn(bg, extra) {
  return 'background:'+bg+';border:none;color:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;'+(extra||'');
}

function _qbPopulateProjects() {
  var sel = document.getElementById('qb-project-sel');
  if (!sel || !window.allProjects) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">בחר פרויקט...</option>' +
    (window.allProjects||[]).map(function(p){
      return '<option value="'+p.id+'"'+(p.id===_qb.projectId?' selected':'')+'>'+p.project_name+'</option>';
    }).join('');
  if (cur) sel.value = cur;
}

function _qbProjectChange(sel) {
  _qb.projectId = sel.value;
  var proj = (window.allProjects||[]).find(function(p){ return p.id===sel.value; });
  if (proj) {
    _qb.projectName = proj.project_name;
    _qb.clientName  = proj.client_name || _qb.clientName;
  }
}

function _qbUpdateTotals() {
  var c = _qbCalc();
  var totRow = document.getElementById('qb-totals-row');
  if (totRow) totRow.innerHTML =
    '<div style="font-size:13px;opacity:.8;">+מע"מ 18%: '+_qbFmt(c.finalPrice*1.18)+'</div>' +
    '<div style="font-size:28px;font-weight:900;">'+_qbFmt(c.finalPrice)+'</div>';
  var marginVal = document.getElementById('qb-margin-val');
  if (marginVal) marginVal.textContent = _qb.margin + '%';
}

// ── AI Analysis ───────────────────────────────────────────────────────
async function qbRunAI() {
  var apiKey = (APP && APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('נדרש מפתח API', 'error'); return; }

  var resultEl = document.getElementById('qb-ai-result');
  if (resultEl) resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:#7c3aed;font-size:13px;">🧠 AI מנתח את ההצעה...</div>';

  var c = _qbCalc();
  var criticalItems = _qb.items.filter(function(i){ return i.priority >= 4; });

  var prompt = 'אתה יועץ עסקי ומהנדס בנייה ישראלי מנוסה.\n\n' +
    'נתח הצעת מחיר לפרויקט:\n' +
    'פרויקט: ' + (_qb.projectName||'לא צוין') + '\n' +
    'לקוח: ' + (_qb.clientName||'לא צוין') + '\n' +
    'עלות ישירה: ₪' + Math.round(c.directCost).toLocaleString() + '\n' +
    'הוצאות קבועות: ₪' + Math.round(c.fixedCost).toLocaleString() + '\n' +
    'רמת סיכון שנבחרה: ' + _qb.riskLevel + '\n' +
    'מרווח רווח: ' + _qb.margin + '%\n' +
    'מחיר סופי: ₪' + Math.round(c.finalPrice).toLocaleString() + '\n' +
    'זמן ביצוע: ' + c.totalDays + ' ימים\n\n' +
    'סעיפים קריטיים (עדיפות 4-5):\n' +
    criticalItems.map(function(i){ return '- ' + i.desc + ' ('+Math.round(i.qty*i.unitPrice).toLocaleString()+'₪)'; }).join('\n') + '\n\n' +
    'ספק:\n' +
    '1. ניתוח סיכונים ספציפיים לפרויקט זה (3-4 נקודות)\n' +
    '2. שאלות קריטיות שיש לשאול את הלקוח לפני חתימה (3-4 שאלות)\n' +
    '3. המלצות לשיפור ההצעה (2-3 המלצות)\n' +
    '4. האם מחיר הסיכון שנבחר מתאים?\n\n' +
    'ענה בעברית. פורמט: **כותרת** ואז נקודות.';

  try {
    var res  = await claudeFetch(JSON.stringify({
      _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:1200,
      messages:[{ role:'user', content:prompt }]
    }), null);
    var data = await res.json();
    var text = (data.content&&data.content[0]&&data.content[0].text)||'';

    if (resultEl) resultEl.innerHTML =
      '<div style="background:#1e1e35;border:1.5px solid rgba(124,58,237,0.4);border-radius:14px;padding:18px;direction:rtl;">' +
        '<div style="font-size:12px;font-weight:900;color:#c4b5fd;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px;">🧠 ניתוח AI — הערכה מקצועית</div>' +
        '<div style="font-size:13px;color:#fff;line-height:1.9;white-space:pre-wrap;">'+text.replace(/\*\*(.+?)\*\*/g,'<strong style="color:#c9a84c;">$1</strong>')+'</div>' +
      '</div>';
  } catch(e) {
    if (resultEl) resultEl.innerHTML = '<div style="color:#ef4444;font-size:12px;">שגיאה: '+e.message+'</div>';
  }
}

// ── Save to Supabase ──────────────────────────────────────────────────
async function qbSave() {
  if (!_qb.projectId) { showToast('יש לבחור פרויקט', 'error'); return; }
  var c = _qbCalc();
  try {
    var qRes = await fetch(SB_URL + '/rest/v1/quotes', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=representation' },
      body: JSON.stringify({
        project_id:  _qb.projectId,
        title:       _qb.projectName || 'הצעת מחיר חדשה',
        status:      'draft',
        created_at:  new Date().toISOString()
      })
    });
    var qData = await qRes.json();
    var qid   = Array.isArray(qData) ? qData[0].id : qData.id;

    // Save items
    for (var i=0; i<_qb.items.length; i++) {
      var item = _qb.items[i];
      if (!item.desc && !item.unitPrice) continue;
      await fetch(SB_URL + '/rest/v1/quote_items', {
        method:'POST',
        headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify({
          quote_id:   qid,
          description: item.desc + (item.notes?' — '+item.notes:''),
          unit_cost:  item.unitPrice,
          quantity:   item.qty,
          sort_order: i
        })
      });
    }
    showToast('✅ הצעה נשמרה בהצלחה');
    closeQuoteBuilder();
    if (typeof loadQuotes === 'function') loadQuotes();
  } catch(e) {
    showToast('שגיאה: '+e.message, 'error');
  }
}

// ── Print ─────────────────────────────────────────────────────────────
function qbPrint() {
  var c = _qbCalc();
  var w = window.open('','_blank');
  var rows = _qb.items.filter(function(i){ return i.desc||i.unitPrice; }).map(function(item,idx){
    var tot = (parseFloat(item.qty)||0)*(parseFloat(item.unitPrice)||0);
    var TYPE_HE = { labor:'עבודה', material:'חומרים', equipment:'ציוד', combined:'עבודה וחומרים', subcontract:'קומפלט' };
    return '<tr style="background:'+(idx%2?'#f9f9f9':'white')+'">' +
      '<td>'+(idx+1)+'</td><td>'+item.desc+'</td><td>'+(TYPE_HE[item.type]||item.type)+'</td>' +
      '<td>'+item.qty+' '+item.unit+'</td><td>₪'+Math.round(item.unitPrice).toLocaleString()+'</td>' +
      '<td>'+item.days+' ימים</td><td style="font-weight:700">₪'+Math.round(tot).toLocaleString()+'</td>' +
    '</tr>';
  }).join('');
  var fixedRows = _qb.fixed.filter(function(f){ return f.desc||f.amount; }).map(function(f){
    return '<tr><td colspan="6">'+f.desc+'</td><td style="font-weight:700">₪'+Math.round(f.amount).toLocaleString()+'</td></tr>';
  }).join('');

  w.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>הצעת מחיר</title>'+
    '<style>body{font-family:Arial,sans-serif;padding:40px;direction:rtl;max-width:900px;margin:auto}'+
    'table{width:100%;border-collapse:collapse}th{background:#1a3d5c;color:white;padding:10px}'+
    'td{padding:8px;border-bottom:1px solid #ddd}.total-section{background:#f5e9c4;padding:16px;border-radius:8px;margin-top:20px}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;">'+
      '<div><h1 style="color:#1a3d5c;margin:0">הצעת מחיר</h1><p style="color:#888;margin:4px 0">'+new Date().toLocaleDateString('he-IL')+'</p></div>'+
      '<button class="noprint" onclick="window.print()" style="background:#1a3d5c;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer">🖨️ הדפס</button>'+
    '</div>'+
    '<p><strong>לקוח:</strong> '+(_qb.clientName||'—')+'</p>'+
    '<p><strong>פרויקט:</strong> '+(_qb.projectName||'—')+'</p>'+
    '<h3>סעיפי עבודה</h3>'+
    '<table><thead><tr><th>#</th><th>תיאור</th><th>סוג</th><th>כמות</th><th>מחיר יח\'</th><th>ימים</th><th>סה"כ</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<h3>הוצאות קבועות</h3>'+
    '<table><tbody>'+fixedRows+'</tbody></table>'+
    '<div class="total-section">'+
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>עלויות ישירות:</span><span>'+_qbFmt(c.directCost)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>הוצאות קבועות:</span><span>'+_qbFmt(c.fixedCost)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>גורם סיכון ('+c.riskPct+'%):</span><span>'+_qbFmt(c.riskAmount)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span>רווח ('+c.marginPct+'%):</span><span>'+_qbFmt(c.marginAmount)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #c9a84c;margin-top:8px;font-size:20px;font-weight:900;color:#1a3d5c">'+
        '<span>מחיר כולל (לפני מע"מ)</span><span>'+_qbFmt(c.finalPrice)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:6px 0;color:#888"><span>כולל מע"מ 18%:</span><span>'+_qbFmt(c.finalPrice*1.18)+'</span></div>'+
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2d0a0">'+
        '<p><strong>תנאי תשלום:</strong> מקדמה '+(_qb.paymentTerms.advance||0)+'% | '+(_qb.paymentTerms.milestones||'לפי שלבים')+' | יתרה '+(_qb.paymentTerms.final||0)+'% בסיום</p>'+
        '<p><strong>זמן ביצוע משוער:</strong> '+c.totalDays+' ימי עבודה</p>'+
      '</div>'+
    '</div>'+
    '</body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

// ── WhatsApp ──────────────────────────────────────────────────────────
function qbSendWA() {
  var c = _qbCalc();
  var msg = '📋 *הצעת מחיר*\n\n' +
    'לקוח: ' + (_qb.clientName||'—') + '\n' +
    'פרויקט: ' + (_qb.projectName||'—') + '\n\n' +
    '💰 *מחיר כולל: ' + _qbFmt(c.finalPrice) + '*\n' +
    'כולל מע"מ: ' + _qbFmt(c.finalPrice*1.18) + '\n\n' +
    '⏱️ זמן ביצוע: ' + c.totalDays + ' ימים\n' +
    '💳 תנאי תשלום: מקדמה ' + (_qb.paymentTerms.advance||0) + '%\n\n' +
    'נשמח לענות על שאלות. בברכה, בני פרסקי';
  var a = document.createElement('a');
  a.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Link to Gantt ─────────────────────────────────────────────────────
function qbLinkGantt() {
  if (!_qb.projectId) { showToast('יש לבחור פרויקט תחילה', 'error'); return; }
  closeQuoteBuilder();
  showPage('gantt');
  setTimeout(function(){
    if (typeof loadGantt === 'function') loadGantt(_qb.projectId);
    showToast('📅 מעבר לגאנט — הפרויקט נבחר');
  }, 300);
}
