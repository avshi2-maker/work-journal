// ══════════════════════════════════════════════════════════════════════
// encyclopedia.js — אנציקלופדיית שטח — ארכיון בלבד
// Files arrive processed from מרכז נתונים שטח AI
// No upload here. No AI generation here. Browse + filter + share only.
// Table: field_encyclopedia
// ══════════════════════════════════════════════════════════════════════

var _encItems     = [];
var _encCatFilter = '';
var _encViewMode  = 'grid';

async function encInit() {
  var grid = document.getElementById('enc-grid');
  if (grid) grid.innerHTML = '<div style="color:#555;padding:40px;text-align:center;font-size:13px;">טוען ארכיון...</div>';
  try {
    var { data } = await sbQ('field_encyclopedia', 'order=created_at.desc&limit=500');
    _encItems = data || [];
    console.log('[ENC] loaded', _encItems.length, 'items');
  } catch(e) {
    console.error('[ENC] load error:', e);
    if (grid) grid.innerHTML =
      '<div style="padding:30px;text-align:center;direction:rtl;">' +
        '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>' +
        '<div style="color:#f87171;font-size:13px;margin-bottom:8px;">שגיאה בטעינת הארכיון</div>' +
        '<div style="color:#555;font-size:11px;">'+e.message+'</div>' +
        '<button onclick="encInit()" style="margin-top:14px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;border-radius:8px;padding:8px 18px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;">נסה שוב</button>' +
      '</div>';
    // Still render header so page is usable
    encRenderHeader();
    encRenderCats();
    return;
  }
  encRenderHeader();
  encRenderCats();
  encApplyFilters();
}

function encRenderHeader() {
  var el = document.getElementById('enc-header-controls');
  if (!el) return;
  var projMap = {};
  _encItems.forEach(function(i){ if(i.source_project_id) projMap[i.source_project_id]=true; });
  var projOpts = '<option value="">כל הפרויקטים</option><option value="unlinked">ללא פרויקט</option>';
  (window.allProjects||[]).forEach(function(p){
    if (projMap[p.id]) projOpts += '<option value="'+p.id+'">'+encEsc(p.project_name)+'</option>';
  });
  var cs = 'background:#242438;border:1px solid rgba(255,255,255,0.12);color:#ccc;padding:7px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;';
  el.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
      '<select id="enc-proj-filter" onchange="encApplyFilters()" style="'+cs+'">'+projOpts+'</select>' +
      '<select id="enc-sev-filter" onchange="encApplyFilters()" style="'+cs+'">' +
        '<option value="">כל החומרות</option>' +
        '<option value="critical">🔴 קריטי</option>' +
        '<option value="important">🟡 חשוב</option>' +
        '<option value="guideline">🟢 הנחיה</option>' +
      '</select>' +
      '<button onclick="encSetView(&quot;grid&quot;)" id="enc-btn-grid" style="'+cs+'background:rgba(201,168,76,0.2);color:#c9a84c;border-color:rgba(201,168,76,0.4);">⊞ כרטיסים</button>' +
      '<button onclick="encSetView(&quot;list&quot;)" id="enc-btn-list" style="'+cs+'">☰ רשימה</button>' +
      '<span id="enc-count" style="font-size:11px;color:#555;white-space:nowrap;">'+_encItems.length+' רשומות</span>' +
    '</div>';
}

function encRenderCats() {
  var el = document.getElementById('enc-cat-filters');
  if (!el) return;
  var cats = {};
  _encItems.forEach(function(i){ var c=i.category||'כללי'; cats[c]=(cats[c]||0)+1; });
  el.innerHTML = '';
  var allBtn = document.createElement('button');
  allBtn.textContent = 'הכל ('+_encItems.length+')';
  allBtn.style.cssText = 'padding:4px 12px;border-radius:16px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#aaa;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
  allBtn.onclick = function(){ _encCatFilter=''; encApplyFilters(); };
  el.appendChild(allBtn);
  Object.keys(cats).sort().forEach(function(cat){
    var btn = document.createElement('button');
    btn.textContent = cat+' ('+cats[cat]+')';
    btn.style.cssText = 'padding:4px 12px;border-radius:16px;border:1px solid rgba(201,168,76,0.25);background:rgba(201,168,76,0.06);color:#c9a84c;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;';
    btn.onclick = (function(c){ return function(){ _encCatFilter=c; encApplyFilters(); }; })(cat);
    el.appendChild(btn);
  });
}

function encSetView(mode) {
  _encViewMode = mode;
  var gb=document.getElementById('enc-btn-grid'), lb=document.getElementById('enc-btn-list');
  if(gb){gb.style.background=mode==='grid'?'rgba(201,168,76,0.2)':'#242438';gb.style.color=mode==='grid'?'#c9a84c':'#ccc';gb.style.borderColor=mode==='grid'?'rgba(201,168,76,0.4)':'rgba(255,255,255,0.12)';}
  if(lb){lb.style.background=mode==='list'?'rgba(201,168,76,0.2)':'#242438';lb.style.color=mode==='list'?'#c9a84c':'#ccc';lb.style.borderColor=mode==='list'?'rgba(201,168,76,0.4)':'rgba(255,255,255,0.12)';}
  encApplyFilters();
}

function encFilter() { encApplyFilters(); }

function encApplyFilters() {
  var q    = ((document.getElementById('enc-search')||{}).value||'').toLowerCase();
  var pF   = ((document.getElementById('enc-proj-filter')||{}).value||'');
  var sF   = ((document.getElementById('enc-sev-filter')||{}).value||'');
  var filtered = _encItems.filter(function(i){
    if (_encCatFilter && (i.category||'כללי')!==_encCatFilter) return false;
    if (sF && i.severity!==sF) return false;
    if (pF==='unlinked' && i.source_project_id) return false;
    if (pF && pF!=='unlinked' && i.source_project_id!==pF) return false;
    if (q && !(i.title+' '+(i.description||'')+' '+(i.category||'')).toLowerCase().includes(q)) return false;
    return true;
  });
  var cnt=document.getElementById('enc-count');
  if(cnt) cnt.textContent=filtered.length+(filtered.length!==_encItems.length?' / '+_encItems.length:'')+' רשומות';
  var grid=document.getElementById('enc-grid');
  if(!grid) return;
  if(!filtered.length){grid.style.display='block';grid.style.gridTemplateColumns='';grid.innerHTML='<div style="color:#555;padding:60px;text-align:center;font-size:13px;">אין רשומות תואמות</div>';return;}
  if(_encViewMode==='list'){grid.style.display='block';grid.style.gridTemplateColumns='';grid.innerHTML=encBuildList(filtered);}
  else{grid.style.display='grid';grid.style.gridTemplateColumns='repeat(auto-fill,minmax(280px,1fr))';grid.innerHTML='';filtered.forEach(function(item){grid.appendChild(encBuildCard(item));});}
}

var _sevBorder={critical:'rgba(239,68,68,0.4)',important:'rgba(245,158,11,0.35)',guideline:'rgba(34,197,94,0.35)'};
var _sevDot={critical:'#ef4444',important:'#f59e0b',guideline:'#22c55e'};
var _sevLabel={critical:'🔴 קריטי',important:'🟡 חשוב',guideline:'🟢 הנחיה'};
var _sevName={critical:'קריטי',important:'חשוב',guideline:'הנחיה'};

function encActBtn(bg,border,color){
  return 'flex:1;padding:5px;background:'+bg+';border:1px solid '+border+';color:'+color+';border-radius:7px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
}

function encBuildCard(item) {
  var sev=item.severity||'important';
  var proj=(window.allProjects||[]).find(function(p){return p.id===item.source_project_id;});
  var dt=item.created_at?new Date(item.created_at).toLocaleDateString('he-IL'):'';
  var desc=item.description?(item.description.substring(0,120)+(item.description.length>120?'\u2026':'')):'';;
  var reportSnip='';
  if(item.ai_report){
    var rs=item.ai_report.substring(0,80)+(item.ai_report.length>80?'\u2026':'');
    var rdt=item.ai_report_date?new Date(item.ai_report_date).toLocaleDateString('he-IL'):'';
    reportSnip='<div style="background:rgba(201,168,76,0.06);border-right:3px solid #c9a84c;padding:6px 10px;border-radius:0 6px 6px 0;cursor:pointer;margin-bottom:8px;" onclick="encViewReport(&quot;'+item.id+'&quot;)">'+
      '<div style="font-size:10px;color:#c9a84c;font-weight:700;margin-bottom:2px;">\uD83E\uDDE0 '+rdt+'</div>'+
      '<div style="font-size:11px;color:#888;">'+encEsc(rs)+'</div>'+
    '</div>';
  }
  var card=document.createElement('div');
  card.style.cssText='background:#1e1e35;border:1px solid '+(_sevBorder[sev]||'rgba(255,255,255,0.08)')+';border-radius:12px;padding:16px;direction:rtl;display:flex;flex-direction:column;gap:8px;';
  card.innerHTML=
    '<div style="display:flex;align-items:flex-start;gap:8px;">'+
      '<div style="width:8px;height:8px;border-radius:50%;background:'+(_sevDot[sev]||'#888')+';margin-top:5px;flex-shrink:0;"></div>'+
      '<div style="flex:1;font-size:13px;font-weight:800;color:#fff;line-height:1.4;">'+encEsc(item.title)+'</div>'+
      '<button onclick="encDelete('"+item.id+"')" style="background:none;border:none;color:#3a3a55;font-size:13px;cursor:pointer;padding:0 2px;" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#3a3a55'">\u{1F5D1}</button>'+
    '</div>'+
    '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'+
      '<span style="font-size:11px;color:#c9a84c;background:rgba(201,168,76,0.08);border-radius:8px;padding:2px 8px;">'+encEsc(item.category||'כללי')+'</span>'+
      (proj?'<span style="font-size:10px;color:#93c5fd;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.12);border-radius:8px;padding:2px 8px;">\u{1F3D7} '+encEsc(proj.project_name)+'</span>':'')+
      '<span style="font-size:10px;color:#444;margin-right:auto;">'+dt+'</span>'+
    '</div>'+
    (desc?'<div style="font-size:12px;color:#666;line-height:1.6;">'+encEsc(desc)+'</div>':'')+
    reportSnip+
    '<div style="display:flex;gap:5px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);">'+
      '<button onclick="encPrint(''+item.id+'')" style="'+encActBtn('rgba(26,61,92,0.25)','rgba(147,197,253,0.3)','#93c5fd')+'">\uD83D\uDDB6 הדפס</button>'+
      '<button onclick="encMail(''+item.id+'')" style="'+encActBtn('rgba(198,40,40,0.1)','rgba(252,165,165,0.3)','#fca5a5')+'">\u2709\uFE0F מייל</button>'+
      '<button onclick="encWA(''+item.id+'')" style="'+encActBtn('rgba(37,211,102,0.1)','rgba(74,222,128,0.3)','#4ade80')+'">\uD83D\uDCAC WA</button>'+
      (item.ai_report?'<button onclick="encViewReport(&quot;'+item.id+'&quot;)" style="'+encActBtn('rgba(201,168,76,0.1)','rgba(201,168,76,0.3)','#c9a84c')+'">\uD83E\uDDE0 דוח</button>':'')+
    '</div>';
  return card;
}

function encBuildList(items){
  var rows=items.map(function(item){
    var sev=item.severity||'important';
    var proj=(window.allProjects||[]).find(function(p){return p.id===item.source_project_id;});
    var dt=item.created_at?new Date(item.created_at).toLocaleDateString('he-IL'):'';
    return '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">'+
      '<td style="padding:9px 8px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+(_sevDot[sev]||'#888')+'"></span></td>'+
      '<td style="padding:9px 8px;font-weight:700;color:#fff;font-size:12px;">'+encEsc(item.title)+'</td>'+
      '<td style="padding:9px 8px;font-size:11px;color:#c9a84c;">'+encEsc(item.category||'כללי')+'</td>'+
      '<td style="padding:9px 8px;font-size:11px;color:#93c5fd;">'+(proj?encEsc(proj.project_name):'—')+'</td>'+
      '<td style="padding:9px 8px;font-size:11px;color:#444;">'+dt+'</td>'+
      '<td style="padding:9px 8px;white-space:nowrap;display:flex;gap:4px;">'+
        '<button onclick="encPrint(''+item.id+'')" style="background:rgba(26,61,92,0.2);border:1px solid rgba(147,197,253,0.2);color:#93c5fd;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">🖨</button>'+
        '<button onclick="encMail(''+item.id+'')" style="background:rgba(198,40,40,0.08);border:1px solid rgba(252,165,165,0.2);color:#fca5a5;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">✉</button>'+
        '<button onclick="encWA(''+item.id+'')" style="background:rgba(37,211,102,0.08);border:1px solid rgba(74,222,128,0.2);color:#4ade80;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">💬</button>'+
        (item.ai_report?'<button onclick="encViewReport(&quot;'+item.id+'&quot;)" style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);color:#c9a84c;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">🧠</button>':'')+
        '<button onclick="encDelete('"+item.id+"')" style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">🗑</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  return '<table style="width:100%;border-collapse:collapse;direction:rtl;font-size:12px;">'+
    '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">'+
      '<th style="padding:8px;width:16px;"></th>'+
      '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">כותרת</th>'+
      '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">קטגוריה</th>'+
      '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">פרויקט</th>'+
      '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">תאריך</th>'+
      '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">פעולות</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table>';
}

function encViewReport(id) {
  var item=_encItems.find(function(i){return i.id===id;});
  if(!item||!item.ai_report) return;
  var dt=item.ai_report_date?new Date(item.ai_report_date).toLocaleDateString('he-IL'):'';
  var proj=(window.allProjects||[]).find(function(p){return p.id===item.source_project_id;});
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;';
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
  ov.innerHTML=
    '<div style="background:#1a1a2e;border-radius:16px;width:100%;max-width:600px;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;">'+
      '<div style="background:linear-gradient(135deg,#1a3d5c,#0f172a);padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;">'+
        '<div>'+
          '<div style="font-size:9px;letter-spacing:2px;color:#c9a84c;text-transform:uppercase;margin-bottom:3px;">דוח AI · '+encEsc(item.category||'')+'</div>'+
          '<div style="font-size:16px;font-weight:800;color:#fff;">'+encEsc(item.title)+'</div>'+
          '<div style="font-size:11px;color:#555;margin-top:3px;">'+(proj?'🏗️ '+encEsc(proj.project_name)+' · ':'')+dt+'</div>'+
        '</div>'+
        '<button onclick="this.closest('div[style*=fixed]').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#aaa;border-radius:8px;padding:6px 12px;cursor:pointer;">✕</button>'+
      '</div>'+
      '<div style="padding:20px;font-size:13px;color:#ccc;line-height:2;white-space:pre-wrap;max-height:55vh;overflow-y:auto;">'+encEsc(item.ai_report)+'</div>'+
      '<div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.07);display:flex;gap:8px;">'+
        '<button onclick="encPrint(''+id+'',true)" style="flex:1;padding:9px;background:rgba(26,61,92,0.3);border:1px solid rgba(147,197,253,0.3);color:#93c5fd;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">🖨️ הדפס</button>'+
        '<button onclick="encMail(''+id+'',true)" style="flex:1;padding:9px;background:rgba(198,40,40,0.12);border:1px solid rgba(252,165,165,0.3);color:#fca5a5;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">✉️ מייל</button>'+
        '<button onclick="encWA(''+id+'',true)" style="flex:1;padding:9px;background:rgba(37,211,102,0.1);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">💬 WA</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);
}

function encPrint(id, withReport) {
  var item=_encItems.find(function(i){return i.id===id;});
  if(!item) return;
  var proj=(window.allProjects||[]).find(function(p){return p.id===item.source_project_id;});
  var dt=new Date(item.created_at||Date.now()).toLocaleDateString('he-IL');
  var sev=item.severity||'important';
  var sevC={critical:'#c62828',important:'#d97706',guideline:'#15803d'}[sev]||'#1a3d5c';
  var reportBlock=(withReport&&item.ai_report)?
    '<div style="margin-top:18px;padding:14px;background:#f0f6ff;border-right:4px solid #1a3d5c;border-radius:0 8px 8px 0;">'+
      '<div style="font-size:12px;font-weight:700;color:#1a3d5c;margin-bottom:8px;">🧠 דוח AI — '+(item.ai_report_date?new Date(item.ai_report_date).toLocaleDateString('he-IL'):'')+
      '</div><div style="font-size:12px;line-height:1.9;white-space:pre-wrap;color:#333;">'+encEsc(item.ai_report)+'</div></div>':'';
  var w=window.open('','_blank','width=820,height=700');
  if(!w) return;
  w.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>'+encEsc(item.title)+'</title>'+
    '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:36px;color:#1a1a1a;max-width:760px;margin:0 auto}'+
    'h1{color:'+sevC+';font-size:20px;border-bottom:3px solid '+sevC+';padding-bottom:8px}'+
    '.meta{display:flex;gap:24px;font-size:12px;color:#666;margin-bottom:18px;flex-wrap:wrap}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<div class="noprint" style="margin-bottom:16px;display:flex;gap:8px;">'+
      '<button onclick="window.print()" style="background:#1a3d5c;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer;">🖨️ הדפס</button>'+
      '<button onclick="window.close()" style="background:#888;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;">סגור</button>'+
    '</div>'+
    '<div style="font-size:11px;color:'+sevC+';letter-spacing:1px;margin-bottom:4px;">'+(_sevLabel[sev]||sev)+'</div>'+
    '<h1>'+encEsc(item.title)+'</h1>'+
    '<div class="meta">'+
      '<div><strong>קטגוריה</strong> '+encEsc(item.category||'כללי')+'</div>'+
      (proj?'<div><strong>פרויקט</strong> '+encEsc(proj.project_name)+'</div>':'')+
      '<div><strong>תאריך</strong> '+dt+'</div>'+
    '</div>'+
    '<div style="font-size:14px;line-height:1.9;white-space:pre-wrap;color:#333;">'+encEsc(item.description||'')+'</div>'+
    reportBlock+
    '<div style="margin-top:28px;font-size:10px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:10px;">אנציקלופדיית שטח | בני פרסקי | '+dt+'</div>'+
    '</body></html>');
  w.document.close();
}

function encGetShareText(id, withReport) {
  var item=_encItems.find(function(i){return i.id===id;});
  if(!item) return '';
  var nl='\n';
  var proj=(window.allProjects||[]).find(function(p){return p.id===item.source_project_id;});
  var txt='📚 אנציקלופדיית שטח'+nl+'========================'+nl+
    String(item.title||'')+nl+
    'קטגוריה: '+String(item.category||'כללי')+nl+
    (item.severity?'חומרה: '+(_sevName[item.severity]||item.severity)+nl:'')+
    (proj?'פרויקט: '+String(proj.project_name||'')+nl:'')+
    'תאריך: '+new Date(item.created_at||Date.now()).toLocaleDateString('he-IL')+nl;
  if(item.description) txt+=nl+String(item.description)+nl;
  if(withReport&&item.ai_report) txt+=nl+'--- דוח AI ---'+nl+String(item.ai_report);
  return txt;
}

function encMail(id, withReport) {
  var item=_encItems.find(function(i){return i.id===id;});
  var subj=item?item.title:'ידע שטח';
  window.location.href='mailto:?subject='+encodeURIComponent('📚 '+subj)+'&body='+encodeURIComponent(encGetShareText(id,withReport));
}

function encWA(id, withReport) {
  window.open('https://wa.me/?text='+encodeURIComponent(encGetShareText(id,withReport).substr(0,3800)),'_blank');
}

async function encDelete(id) {
  if(!confirm('מחק רשומה זו מהארכיון?')) return;
  try {
    await fetch(window.SB_URL+'/rest/v1/field_encyclopedia?id=eq.'+id,{method:'DELETE',headers:{apikey:window.SB_KEY,Authorization:'Bearer '+window.SB_KEY}});
    showToast('🗑️ נמחק','success');
    _encItems=_encItems.filter(function(i){return i.id!==id;});
    encRenderCats();
    encApplyFilters();
  } catch(e){showToast('שגיאה: '+e.message,'error');}
}

// Stub — adding happens in מרכז נתונים שטח
function encOpenAdd() {
  showToast('הוספת ידע נעשית דרך מרכז נתונים שטח AI → אשר + שמור','info');
}

function encEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
