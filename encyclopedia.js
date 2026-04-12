
function encViewMedia(item) {
  if (!item || !item.media_url) { showToast('אין מדיה לפריט זה','error'); return; }
  var url = item.media_url;
  var mt  = item.media_type||'';
  var ov  = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});

  var inner = '';
  if (mt==='photo'||/\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
    inner = '<img src="'+url+'" style="max-width:90vw;max-height:78vh;border-radius:10px;object-fit:contain;">';
  } else if (mt==='video'||/\.(mp4|mov|avi|webm)$/i.test(url)) {
    inner = '<video src="'+url+'" controls autoplay style="max-width:90vw;max-height:78vh;border-radius:10px;background:#000;"></video>';
  } else if (mt==='audio'||/\.(mp3|m4a|wav|aac)$/i.test(url)) {
    inner = '<audio src="'+url+'" controls autoplay style="width:320px;margin:20px 0;"></audio>';
  } else {
    inner = '<div style="color:#fff;font-size:14px;margin:20px;">'+
      '<a href="'+url+'" target="_blank" style="color:#c9a84c;font-weight:700;">פתח קובץ ←</a></div>';
  }

  ov.innerHTML =
    '<div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:14px;direction:rtl;">'+
      (item.title||'מדיה')+'</div>'+
    inner+
    '<div style="margin-top:16px;display:flex;gap:10px;">'+
      '<button onclick="this.closest(\"div[style*=fixed]\").remove()" style="background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:8px;padding:9px 20px;cursor:pointer;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;">✕ סגור</button>'+
      '<a href="'+url+'" target="_blank" style="background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;border-radius:8px;padding:9px 20px;text-decoration:none;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;">⬇️ הורד</a>'+
    '</div>';
  document.body.appendChild(ov);
}

// ══════════════════════════════════════════════════════════════════════
// encyclopedia.js — אנציקלופדיית שטח — ארכיון בלבד
// Files arrive processed from מרכז נתונים שטח AI
// No upload here. No AI generation here. Browse + filter + share only.
// Table: field_encyclopedia
// ══════════════════════════════════════════════════════════════════════

var _encItems     = [];
var _encCatFilter = '';
var _encViewMode  = 'grid';
var _encActionMap = {}; // id -> item mapping for event handlers

function _encAction(id, action) {
  if (action === 'delete') encDelete(id);
  else if (action === 'print') encPrint(id);
  else if (action === 'mail')  encMail(id);
  else if (action === 'wa')    encWA(id);
  else if (action === 'report') encViewReport(id);
  else if (action === 'printR') encPrint(id, true);
  else if (action === 'mailR')  encMail(id, true);
  else if (action === 'waR')    encWA(id, true);
}

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
  // Show ALL projects so user can filter to unlinked items and link them
  var projOpts = '<option value="">כל הפרויקטים</option>';
  (window.allProjects||[]).forEach(function(p){
    projOpts += '<option value="'+p.id+'">'+encEsc(p.project_name)+'</option>';
  });
  projOpts += '<option value="unlinked">⚠️ ללא קישור לפרויקט</option>';
  var cs = 'background:#fff;border:1.5px solid #c9a84c;color:#7a5500;padding:7px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;font-weight:700;';
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
  allBtn.style.cssText = 'padding:5px 14px;border-radius:16px;border:1.5px solid #c9a84c;background:#fff8e0;color:#7a5500;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;';
  allBtn.onclick = function(){ _encCatFilter=''; encApplyFilters(); };
  el.appendChild(allBtn);
  Object.keys(cats).sort().forEach(function(cat){
    var btn = document.createElement('button');
    btn.textContent = cat+' ('+cats[cat]+')';
    btn.style.cssText = 'padding:5px 14px;border-radius:16px;border:1px solid #c9a84c;background:#fff;color:#9a6f00;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    btn.onclick = (function(c){ return function(){ _encCatFilter=c; encApplyFilters(); }; })(cat);
    el.appendChild(btn);
  });
}

function encSetView(mode) {
  _encViewMode = mode;
  var gb=document.getElementById('enc-btn-grid'), lb=document.getElementById('enc-btn-list');
  if(gb){gb.style.background=mode==='grid'?'#c9a84c':'#fff';gb.style.color=mode==='grid'?'#fff':'#7a5500';gb.style.borderColor='#c9a84c';}
  if(lb){lb.style.background=mode==='list'?'#c9a84c':'#fff';lb.style.color=mode==='list'?'#fff':'#7a5500';lb.style.borderColor='#c9a84c';}
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
  if(_encViewMode==='list'){grid.style.display='block';grid.style.gridTemplateColumns='';grid.innerHTML='';grid.appendChild(encBuildList(filtered));}
  else{grid.style.display='grid';grid.style.gridTemplateColumns='repeat(auto-fill,minmax(280px,1fr))';grid.innerHTML='';filtered.forEach(function(item){grid.appendChild(encBuildCard(item));});}
}

var _sevBorder={critical:'#fca5a5',important:'#fcd34d',guideline:'#86efac'};
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
  var card=document.createElement('div');
  card.style.cssText='background:#fff;border:1.5px solid '+(_sevBorder[sev]||'rgba(201,168,76,0.3)')+';border-radius:12px;padding:16px;direction:rtl;display:flex;flex-direction:column;gap:8px;';

  // Title row
  var topRow=document.createElement('div');
  topRow.style.cssText='display:flex;align-items:flex-start;gap:8px;';
  var dot=document.createElement('div');
  dot.style.cssText='width:8px;height:8px;border-radius:50%;background:'+(_sevDot[sev]||'#888')+';margin-top:5px;flex-shrink:0;';
  var titleEl=document.createElement('div');
  titleEl.style.cssText='flex:1;font-size:13px;font-weight:900;color:#1a3d5c;line-height:1.4;';
  titleEl.textContent=item.title||'';
  var delBtn=document.createElement('button');
  delBtn.textContent='🗑';
  delBtn.title='מחק';
  delBtn.style.cssText='background:none;border:none;color:#3a3a55;font-size:13px;cursor:pointer;padding:0 2px;';
  delBtn.onmouseover=function(){this.style.color='#f87171';};
  delBtn.onmouseout=function(){this.style.color='#3a3a55';};
  delBtn.onclick=function(){ encDelete(item.id); };
  topRow.appendChild(dot); topRow.appendChild(titleEl); topRow.appendChild(delBtn);
  card.appendChild(topRow);

  // Meta row
  var metaRow=document.createElement('div');
  metaRow.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
  var catSpan=document.createElement('span');
  catSpan.textContent=item.category||'כללי';
  catSpan.style.cssText='font-size:11px;color:#7a5500;background:#fff8e0;border:1px solid #c9a84c;border-radius:8px;padding:2px 8px;font-weight:700;';
  metaRow.appendChild(catSpan);
  if (proj) {
    var projSpan=document.createElement('span');
    projSpan.textContent='🏗️ '+(proj.project_name||'');
    projSpan.style.cssText='font-size:10px;color:#1a3d5c;background:#e8f0fd;border:1px solid #93c5fd;border-radius:8px;padding:2px 8px;font-weight:700;';
    metaRow.appendChild(projSpan);
  }
  var dtSpan=document.createElement('span');
  dtSpan.textContent=dt;
  dtSpan.style.cssText='font-size:10px;color:#999;margin-right:auto;font-weight:700;';
  metaRow.appendChild(dtSpan);
  card.appendChild(metaRow);

  // Description
  if (desc) {
    var descEl=document.createElement('div');
    descEl.textContent=desc;
    descEl.style.cssText='font-size:12px;color:#555;line-height:1.7;font-weight:700;';
    card.appendChild(descEl);
  }

  // AI report snippet
  if (item.ai_report) {
    var rdt=item.ai_report_date?new Date(item.ai_report_date).toLocaleDateString('he-IL'):'';
    var snip=item.ai_report.substring(0,80)+(item.ai_report.length>80?'\u2026':'');
    var rWrap=document.createElement('div');
    rWrap.style.cssText='background:#fffbf0;border-right:3px solid #c9a84c;padding:8px 12px;border-radius:0 8px 8px 0;cursor:pointer;border:1px solid #e8ddb5;';
    rWrap.onclick=function(){ encViewReport(item.id); };
    var rTitle=document.createElement('div');
    rTitle.textContent='🧠 '+rdt;
    rTitle.style.cssText='font-size:10px;color:#7a5500;font-weight:800;margin-bottom:2px;';
    var rText=document.createElement('div');
    rText.textContent=snip;
    rText.style.cssText='font-size:11px;color:#666;font-weight:700;';
    rWrap.appendChild(rTitle); rWrap.appendChild(rText);
    card.appendChild(rWrap);
  }

  // Action bar
  var actions=document.createElement('div');
  actions.style.cssText='display:flex;gap:5px;padding-top:8px;border-top:1px solid #e8ddb5;flex-wrap:wrap;';
  // Action buttons — labeled, light theme
  var btns=[
    {lbl:'🖨️ הדפס',  tip:'הדפס / שמור PDF', fn:function(){encPrint(item.id);},  s:'#e8f0fd','bc':'#1a3d5c','c':'#1a3d5c'},
    {lbl:'✉️ מייל',   tip:'שלח במייל',        fn:function(){encMail(item.id);},   s:'#fff0f0','bc':'#c62828','c':'#c62828'},
    {lbl:'💬 WA',     tip:'שלח בוואטסאפ',     fn:function(){encWA(item.id);},     s:'#e8faf0','bc':'#1b6b35','c':'#1b6b35'},
  ];
  if (item.ai_report) btns.push({lbl:'🧠 דוח AI', tip:'צפה בדוח AI',fn:function(){encViewReport(item.id);},s:'#fff8e0','bc':'#c9a84c','c':'#7a5500'});
  if (item.media_url) btns.push({lbl:'👁️ צפה',    tip:'פתח מדיה',   fn:function(){encViewMedia(item);},   s:'#f0f0f0','bc':'#888','c':'#333'});
  btns.forEach(function(b){
    var btn=document.createElement('button');
    btn.textContent=b.lbl;
    btn.title=b.tip;
    btn.style.cssText='flex:1;min-width:60px;padding:6px 4px;background:'+b.s+';border:1.5px solid '+b.bc+';color:'+b.c+';border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;';
    btn.onclick=b.fn;
    actions.appendChild(btn);
  });
  // Delete button — separate, with ticker
  var delBtn2=document.createElement('button');
  delBtn2.title='מחק מהארכיון';
  delBtn2.textContent='🗑️ מחק';
  delBtn2.style.cssText='padding:6px 8px;background:#fff0f0;border:1.5px solid #fca5a5;color:#c62828;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;';
  delBtn2.onclick=function(){ encDeleteConfirm(item.id, delBtn2); };
  actions.appendChild(delBtn2);
  card.appendChild(actions);
  return card;
}
function encBuildList(items) {
  var wrap = document.createElement('div');
  var table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;direction:rtl;font-size:12px;';
  var thead = '<thead><tr style="border-bottom:1px solid rgba(201,168,76,0.3);">'+
    '<th style="padding:8px;width:16px;"></th>'+
    '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">כותרת</th>'+
    '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">קטגוריה</th>'+
    '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">פרויקט</th>'+
    '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">תאריך</th>'+
    '<th style="padding:8px;text-align:right;color:#c9a84c;font-weight:700;">פעולות</th>'+
  '</tr></thead>';
  table.innerHTML = thead + '<tbody id="enc-list-tbody"></tbody>';
  wrap.appendChild(table);

  var tbody = table.querySelector('#enc-list-tbody');
  items.forEach(function(item){
    var sev  = item.severity||'important';
    var proj = (window.allProjects||[]).find(function(p){ return p.id===item.source_project_id; });
    var dt   = item.created_at ? new Date(item.created_at).toLocaleDateString('he-IL') : '';

    var tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    tr.onmouseover = function(){ this.style.background='rgba(255,255,255,0.02)'; };
    tr.onmouseout  = function(){ this.style.background=''; };

    tr.innerHTML =
      '<td style="padding:9px 8px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+(_sevDot[sev]||'#888')+'"></span></td>'+
      '<td style="padding:9px 8px;font-weight:700;color:#fff;font-size:12px;">'+encEsc(item.title)+'</td>'+
      '<td style="padding:9px 8px;font-size:11px;color:#c9a84c;">'+encEsc(item.category||'כללי')+'</td>'+
      '<td style="padding:9px 8px;font-size:11px;color:#93c5fd;">'+(proj?encEsc(proj.project_name):'—')+'</td>'+
      '<td style="padding:9px 8px;font-size:11px;color:#444;">'+dt+'</td>'+
      '<td style="padding:9px 8px;"></td>';

    // Build action buttons with addEventListener
    var actionTd = tr.querySelectorAll('td')[5];
    actionTd.style.cssText = 'padding:9px 8px;white-space:nowrap;';
    var btnDefs = [
      {t:'🖨',  fn:function(){encPrint(item.id);},  s:'rgba(26,61,92,0.2)', bc:'rgba(147,197,253,0.2)', c:'#93c5fd'},
      {t:'✉️',   fn:function(){encMail(item.id);},   s:'rgba(198,40,40,0.08)',bc:'rgba(252,165,165,0.2)',c:'#fca5a5'},
      {t:'💬',  fn:function(){encWA(item.id);},     s:'rgba(37,211,102,0.08)',bc:'rgba(74,222,128,0.2)', c:'#4ade80'},
    ];
    if (item.ai_report) btnDefs.push({t:'🧠',fn:function(){encViewReport(item.id);},s:'rgba(201,168,76,0.08)',bc:'rgba(201,168,76,0.2)',c:'#c9a84c'});
    btnDefs.push({t:'🗑',fn:function(){encDelete(item.id);},s:'rgba(239,68,68,0.06)',bc:'rgba(239,68,68,0.2)',c:'#f87171'});
    btnDefs.forEach(function(b){
      var btn=document.createElement('button');
      btn.textContent=b.t;
      btn.style.cssText='background:'+b.s+';border:1px solid '+b.bc+';color:'+b.c+';border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;margin-left:4px;';
      btn.onclick=b.fn;
      actionTd.appendChild(btn);
    });

    tbody.appendChild(tr);
  });

  return wrap;
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
        '<button onclick="this.closest(\"div[style*=fixed]\").remove()" style="background:rgba(201,168,76,0.3);border:none;color:#aaa;border-radius:8px;padding:6px 12px;cursor:pointer;">✕</button>'+
      '</div>'+
      '<div style="padding:20px;font-size:13px;color:#ccc;line-height:2;white-space:pre-wrap;max-height:55vh;overflow-y:auto;">'+encEsc(item.ai_report)+'</div>'+
      '<div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.07);display:flex;gap:8px;">'+
        '<button onclick="_encAction(this.getAttribute(&quot;data-id&quot;),&quot;print&quot;)" style="flex:1;padding:9px;background:rgba(26,61,92,0.3);border:1px solid rgba(147,197,253,0.3);color:#93c5fd;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">🖨️ הדפס</button>'+
        '<button onclick="_encAction(this.getAttribute(&quot;data-id&quot;),&quot;mail&quot;)" style="flex:1;padding:9px;background:rgba(198,40,40,0.12);border:1px solid rgba(252,165,165,0.3);color:#fca5a5;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">✉️ מייל</button>'+
        '<button onclick="_encAction(this.getAttribute(&quot;data-id&quot;),&quot;wa&quot;)" style="flex:1;padding:9px;background:rgba(37,211,102,0.1);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">💬 WA</button>'+
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

function encDeleteConfirm(id, btn) {
  // First click: start 3-second countdown
  if (btn._deleteConfirmed) {
    encDelete(id);
    return;
  }
  btn._deleteConfirmed = true;
  var orig = btn.textContent;
  btn.style.background = '#c62828';
  btn.style.color = '#fff';
  btn.style.borderColor = '#c62828';
  var count = 3;
  btn.textContent = '❗ בטל (' + count + ')';
  var timer = setInterval(function(){
    count--;
    if (count > 0) {
      btn.textContent = '❗ בטל (' + count + ')';
    } else {
      clearInterval(timer);
      encDelete(id);
    }
  }, 1000);
  // Allow cancel on second click within window
  btn.onclick = function(){
    clearInterval(timer);
    btn._deleteConfirmed = false;
    btn.textContent = orig;
    btn.style.background = '#fff0f0';
    btn.style.color = '#c62828';
    btn.style.borderColor = '#fca5a5';
    btn.onclick = function(){ encDeleteConfirm(id, btn); };
  };
}

async function encDelete(id) {
  try {
    await fetch(window.SB_URL+'/rest/v1/field_encyclopedia?id=eq.'+id,{method:'DELETE',headers:{apikey:window.SB_KEY,Authorization:'Bearer '+window.SB_KEY}});
    showToast('🗑️ נמחק מהארכיון','success');
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

// ── OPEN ENCYCLOPEDIA FILTERED BY PROJECT (called from projects table) ─
function encFilterByProject(projectId) {
  // Switch to encyclopedia tab first
  if (typeof switchTab === 'function') switchTab('encyclopedia');

  // Wait for encInit to finish then apply project filter
  var attempts = 0;
  var tryFilter = function() {
    var sel = document.getElementById('enc-proj-filter');
    if (sel) {
      sel.value = projectId;
      encApplyFilters();
    } else if (attempts++ < 20) {
      setTimeout(tryFilter, 200);
    }
  };
  setTimeout(tryFilter, 300);
}
