// inbox.js — מרכז נתונים שטח AI
// Unified file analysis center: Beni's mobile files + desktop uploads
// Two-phase workflow: Extract → Analyze with direction
// Loaded dynamically by index.html via _fetchInboxModule()

// ── STATE ─────────────────────────────────────────────────────────────
var _sibItems      = [];
var _sibSelected   = null;
var _sibSelSet     = {};
var _sibAnalysis   = {};
var _sibApiKey     = null;
var _sibChecked    = {};
var _sibMeterTimer = null;
var _sibPhase1     = {};   // {itemId: extracted text/data from phase 1}
var _sibSafetyCategories = []; // loaded from Supabase

// ── INIT ──────────────────────────────────────────────────────────────
async function sibInit() {
  var panel = document.getElementById('inbox-panel');
  if (!panel) return;
  panel.style.width = '100%';
  panel.style.boxSizing = 'border-box';

  // API key
  var ak = window.APP && window.APP.config && window.APP.config.anthropic_key;
  if (ak) { _sibApiKey = ak; }
  else {
    try {
      var cfg = await sbQ('app_config','select=key,value');
      var row = (cfg.data||[]).find(function(r){ return r.key==='anthropic_key'; });
      if (row) _sibApiKey = row.value;
    } catch(e) {}
  }

  panel.innerHTML = sibHTML();
  sibPopulateProjects();
  await sibLoadCategories();
  sibRenderCategoryFilters();
  await sibLoad();
}

// ── HTML SHELL ────────────────────────────────────────────────────────
function sibHTML() {
  return '<div id="sib-root" style="width:100%;min-height:100vh;background:#fdf6e3;font-family:Heebo,sans-serif;direction:rtl;padding:0;box-sizing:border-box;">' +

  // TOPBAR
  '<div style="background:#f5e9c4;border-bottom:2px solid #c9a84c;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
    '<div>' +
      '<div style="font-size:9px;letter-spacing:3px;color:#9a6f00;font-weight:800;text-transform:uppercase;margin-bottom:3px;">AI Site Intelligence</div>' +
      '<div style="font-size:20px;font-weight:900;color:#1a3d5c;">🧠 מרכז נתונים שטח AI</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<span id="sib-badge" style="display:none;background:#ef4444;color:#fff;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:800;"></span>' +
      '<button onclick="sibSyncBeni()" id="sib-sync-btn" style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:900;cursor:pointer;font-family:Heebo,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(26,61,92,0.3);">' +
        '<span style="font-size:18px;">📲</span> העלה קבצים מנייד של בני' +
      '</button>' +
      '<button onclick="if(window.openLocalUpload)window.openLocalUpload();" style="background:#f5e9c4;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">💻 העלה מהמחשב</button>' +
      '<button onclick="sibLoad()" style="background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#5a6f7c;border-radius:8px;padding:8px 12px;font-size:11px;cursor:pointer;font-family:Heebo,sans-serif;">🔄 רענן</button>' +
      '<select id="sib-proj-filter" onchange="sibFilterByProject(this.value)" style="background:#fff;border:1px solid rgba(180,140,60,0.3);color:#2c4a6e;border-radius:8px;padding:8px 12px;font-size:11px;font-family:Heebo,sans-serif;direction:rtl;">' +
        '<option value="">כל הפרויקטים</option>' +
      '</select>' +
    '</div>' +
  '</div>' +

  // URL / YOUTUBE INPUT BAR
  '<div style="background:#e8f0fd;border-bottom:1px solid #c3d4f0;padding:8px 20px;display:flex;gap:8px;align-items:center;">' +
    '<span style="font-size:11px;font-weight:800;color:#1a3d5c;white-space:nowrap;">🌐 נתח URL / יוטיוב:</span>' +
    '<input id="sib-url-input" type="text" placeholder="https://... או https://youtube.com/watch?v=..." style="flex:1;border:1px solid rgba(26,61,92,0.3);border-radius:8px;padding:7px 12px;font-family:Heebo,sans-serif;font-size:12px;direction:ltr;">' +
    '<button onclick="sibAddUrl()" style="background:#1a3d5c;border:none;color:#fff;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">➕ הוסף לתיבה</button>' +
  '</div>' +

  // STATS + BATCH BAR
  '<div id="sib-stats" style="display:flex;gap:8px;padding:10px 20px;background:#f5e9c4;border-bottom:1px solid #e8ddb5;flex-wrap:wrap;align-items:center;">' +
    '<div id="sib-batch-bar" style="display:none;margin-right:auto;display:flex;gap:8px;align-items:center;">' +
      '<span id="sib-sel-count" style="font-size:12px;font-weight:800;color:#1a3d5c;background:#fff;border-radius:20px;padding:3px 12px;border:1px solid #c9a84c;"></span>' +
      '<button onclick="sibBatchDelete()" style="background:#fff5f5;border:1px solid #fca5a5;color:#c62828;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">🗑️ מחק נבחרים</button>' +
      '<button onclick="sibBatchToEnc()" style="background:#ede7f6;border:1px solid #9c6fdd;color:#4527a0;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">📚 שלח לאנציקלופדיה</button>' +
      '<button onclick="sibClearSel()" style="background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#7a8a95;border-radius:8px;padding:6px 12px;font-size:11px;cursor:pointer;font-family:Heebo,sans-serif;">✕ בטל בחירה</button>' +
    '</div>' +
  '</div>' +

  // TWO-PANEL
  '<div id="sib-two-panel" style="display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 140px);width:100%;">' +
  '<style>#sib-root,#inbox-panel{width:100%!important;box-sizing:border-box!important;}</style>' +

    // RIGHT — file list
    '<div style="border-left:2px solid rgba(180,140,60,0.3);background:#fdf6e3;padding:16px;overflow-y:auto;max-height:calc(100vh - 140px);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
        '<div style="font-size:10px;font-weight:700;color:#9a6f00;letter-spacing:1px;text-transform:uppercase;">קבצי בני + העלאות</div>' +
        '<button onclick="sibBatchAnalyze()" style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:8px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:10px;font-weight:800;cursor:pointer;">🚀 ניתוח קבוצתי</button>' +
      '</div>' +
      '<div id="sib-file-list" style="display:flex;flex-direction:column;gap:8px;">' +
        '<div style="text-align:center;padding:40px;color:#9aabb5;font-size:13px;">טוען קבצים...</div>' +
      '</div>' +
    '</div>' +

    // LEFT — analysis workspace
    '<div style="background:#fdf6e3;padding:16px;overflow-y:auto;max-height:calc(100vh - 140px);">' +
      '<div style="font-size:10px;font-weight:700;color:#7a8a95;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">🧠 סביבת עבודה — ניתוח AI</div>' +
      '<div id="sib-analysis-panel">' +
        '<div style="text-align:center;padding:60px 20px;color:#b0bec5;font-size:13px;line-height:1.8;">' +
          '<div style="font-size:32px;margin-bottom:12px;">👈</div>' +
          'בחר קובץ מהרשימה<br>ולחץ על כפתור הניתוח' +
        '</div>' +
      '</div>' +
    '</div>' +

  '</div>' +
  '</div>';
}

// ── LOAD SAFETY CATEGORIES ────────────────────────────────────────────
async function sibLoadCategories() {
  if (_sibSafetyCategories.length > 0) return;
  // Try full query first, fall back to name-only if columns missing
  try {
    var res = await sbQ('safety_categories', 'select=id,name_he,icon,description&order=sort_order.asc&is_active=eq.true');
    if (res.data && res.data.length > 0) { _sibSafetyCategories = res.data; return; }
  } catch(e) {}
  try {
    var res2 = await sbQ('safety_categories', 'select=id,name_he&order=id.asc');
    if (res2.data && res2.data.length > 0) { _sibSafetyCategories = res2.data; return; }
  } catch(e2) {}
  // Fallback hardcoded
  _sibSafetyCategories = [
    {id:'01',name:'ציוד מגן אישי (PPE)',icon:'🦺'},
    {id:'02',name:'עבודה בגובה',icon:'🪜'},
    {id:'03',name:'חפירות ובורות',icon:'⛏️'},
    {id:'04',name:'בטיחות חשמל',icon:'⚡'},
    {id:'05',name:'חלל מוקף',icon:'🕳️'},
    {id:'06',name:'עבודות חמות',icon:'🔥'},
    {id:'07',name:'עבודה בגובה',icon:'🏗️'},
    {id:'08',name:'מכונות וציוד כבד',icon:'🚜'},
    {id:'09',name:'סדר וניקיון',icon:'🧹'},
  ];
}

function sibRenderCategoryFilters() {
  // Category filters are shown in the Phase 2 panel — not here
}

// ── SYNC BENI ─────────────────────────────────────────────────────────
async function sibSyncBeni() {
  var btn = document.getElementById('sib-sync-btn');
  var origHTML = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="display:inline-block;animation:sibspin 0.8s linear infinite;font-size:16px;">⏳</span> טוען קבצי בני...'; btn.style.opacity='0.8'; }
  var countBefore = _sibItems.length;
  await sibLoad();
  var newCount = Math.max(0, _sibItems.length - countBefore);
  if (btn) { btn.disabled=false; btn.innerHTML=origHTML; btn.style.opacity='1'; }
  if (newCount > 0) showToast('📲 '+newCount+' קבצים חדשים מבני!','success');
  else if (_sibItems.length === 0) showToast('📭 אין קבצים חדשים','success');
  else showToast('✅ '+_sibItems.length+' קבצים בתיבה','success');
}

// ── LOAD ──────────────────────────────────────────────────────────────
async function sibLoad() {
  var listEl = document.getElementById('sib-file-list');
  var statsEl = document.getElementById('sib-stats');
  var badge   = document.getElementById('sib-badge');
  if (!listEl) return;
  try {
    var res = await sbQ('asset_inbox','status=eq.pending&order=created_at.desc&limit=100&select=id,cloudinary_url,file_name,file_type,thumbnail_url,project_id,created_at');
    _sibItems = res.data || [];
  } catch(e) { listEl.innerHTML='<div style="color:#ef4444;padding:20px;font-size:12px;">שגיאה בטעינה</div>'; return; }

  var photos = _sibItems.filter(function(i){return i.file_type==='image';}).length;
  var videos = _sibItems.filter(function(i){return i.file_type==='video';}).length;
  var audios = _sibItems.filter(function(i){return i.file_type==='audio';}).length;
  var pdfs   = _sibItems.filter(function(i){return i.file_type==='pdf'||i.file_type==='document';}).length;
  var sheets = _sibItems.filter(function(i){return i.file_type==='spreadsheet'||i.file_type==='csv';}).length;

  if (statsEl) {
    var batchBar = document.getElementById('sib-batch-bar');
    var batchHTML = batchBar ? batchBar.outerHTML : '';
    statsEl.innerHTML = batchHTML +
      [['📸',photos,'תמונות'],['🎥',videos,'וידאו'],['🎙',audios,'הקלטות'],['📄',pdfs,'מסמכים'],['📊',sheets,'טבלאות']]
      .map(function(s){ return '<div style="display:flex;align-items:center;gap:5px;background:#fff;border-radius:6px;padding:5px 10px;"><span style="font-size:14px;">'+s[0]+'</span><span style="font-size:15px;font-weight:800;color:#1a3d5c;">'+s[1]+'</span><span style="font-size:10px;color:#8a9aa5;">'+s[2]+'</span></div>'; })
      .join('');
  }

  if (badge) { if (_sibItems.length>0){badge.textContent=_sibItems.length+' חדשים';badge.style.display='inline';}else badge.style.display='none'; }
  if (_sibItems.length===0){listEl.innerHTML='<div style="text-align:center;padding:60px 20px;color:#b0bec5;font-size:13px;line-height:2;">✅ תיבת הנכנסים ריקה</div>';return;}
  listEl.innerHTML='';
  _sibItems.forEach(function(item){ listEl.appendChild(sibFileCard(item)); });
}

// ── FILE CARD ─────────────────────────────────────────────────────────
function sibFileCard(item) {
  var card = document.createElement('div');
  var isSelected = _sibSelected === item.id;
  var isSel = !!_sibSelSet[item.id];
  card.id = 'sib-card-'+item.id;
  card.style.cssText = 'background:'+(isSelected?'#fffbf0':'#fff')+';border:1px solid '+(isSelected?'rgba(180,140,60,0.5)':'rgba(180,140,60,0.2)')+';border-radius:10px;padding:12px;cursor:pointer;transition:all 0.15s;';

  var type = item.file_type||'image';
  var typeIcon = type==='video'?'🎥':type==='audio'?'🎙':type==='pdf'?'📄':type==='document'?'📝':type==='spreadsheet'||type==='csv'?'📊':type==='youtube'?'🎬':type==='url'?'🌐':'📸';
  var typeBg   = type==='video'?'#fff8e8':type==='audio'?'#e8f8f0':type==='pdf'||type==='document'?'#fdf0f0':type==='spreadsheet'||type==='csv'?'#e8f8e8':type==='youtube'?'#fce4e4':type==='url'?'#e4f0fc':'#e8f0fd';
  var typeColor= type==='video'?'#f59e0b':type==='audio'?'#10b981':type==='pdf'||type==='document'?'#ef4444':type==='spreadsheet'||type==='csv'?'#059669':type==='youtube'?'#dc2626':type==='url'?'#2563eb':'#3b82f6';
  var rawThumb = item.thumbnail_url||(item.cloudinary_url&&item.cloudinary_url.includes('/upload/')?item.cloudinary_url.replace('/upload/','/upload/w_80,h_80,c_fill,f_jpg/'):'');
  var thumbUrl = (rawThumb&&rawThumb.startsWith('http'))?rawThumb:'';
  var hasThumb = (type==='image'||type==='photo'||type==='video')&&thumbUrl;
  var fname = item.file_name||'קובץ ללא שם';
  var proj = (window.allProjects||[]).find(function(p){return p.id===item.project_id;});
  var projName = proj?proj.project_name:(item.project_id?'...':'לא שויך');
  var timeStr = new Date(item.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
  var hasPhase1 = !!_sibPhase1[item.id];

  if (!_sibChecked[item.id]) _sibChecked[item.id]={safety:true,engineering:false,standards:false};

  card.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:10px;">' +
      '<input type="checkbox" id="sib-sel-'+item.id+'" '+(isSel?'checked':'')+' '+
        'onchange="_sibSelSet[&quot;'+item.id+'&quot;]=this.checked;sibUpdateBatchBar();event.stopPropagation();" '+
        'style="width:16px;height:16px;margin-top:10px;accent-color:#1a3d5c;flex-shrink:0;cursor:pointer;">' +
      (hasThumb?'<img src="'+thumbUrl+'" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">':'<div style="width:36px;height:36px;border-radius:8px;background:'+typeBg+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">'+typeIcon+'</div>') +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;color:#1a3d5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+sibEsc(fname)+'</div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;">' +
          '<span style="font-size:10px;color:#8a9aa5;">'+timeStr+'</span>' +
          '<span style="font-size:9px;padding:1px 7px;border-radius:10px;background:#f5f0e8;color:'+typeColor+';border:1px solid '+typeColor+'22;">'+type+'</span>' +
          '<span style="font-size:9px;color:#9aabb5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">'+sibEsc(projName)+'</span>' +
          (hasPhase1?'<span style="font-size:9px;background:#e8f5e9;color:#1b7a4a;border-radius:4px;padding:1px 6px;border:1px solid #a5d6a7;">✓ שלב 1</span>':'') +
        '</div>' +
      '</div>' +
      '<button onclick="sibDeleteItem(\''+item.id+'\')" style="background:none;border:none;color:#b0bec5;cursor:pointer;font-size:14px;padding:2px;flex-shrink:0;" title="מחק">🗑️</button>' +
    '</div>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">' + sibActionButtons(item) + '</div>';

  card.onclick = function(e){ if(e.target.closest('button')||e.target.type==='checkbox') return; sibSelectItem(item.id); };
  return card;
}

function sibActionButtons(item) {
  var id = item.id;
  var type = item.file_type||'image';
  var btns = '';
  var hasP1 = !!_sibPhase1[id];

  // Phase 1 — Extract
  if (type==='image'||type==='photo') {
    btns += sibBtn('👁 צפה','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('📐 מדידות OCR','sibOpenMeasurements(\''+id+'\')','meas');
    btns += sibBtn('📋 שלב 1: תאר','sibPhase1Image(\''+id+'\')','phase1');
  } else if (type==='video') {
    btns += sibBtn('▶ נגן','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('🎙 תמלל','sibTranscribe(\''+id+'\')','phase1');
    btns += sibBtn('🎞 פריים','sibExtractFrame(\''+id+'\')','sec');
  } else if (type==='audio') {
    btns += sibBtn('▶ נגן','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('🎙 תמלל','sibTranscribe(\''+id+'\')','phase1');
  } else if (type==='pdf') {
    btns += sibBtn('👁 צפה','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('📑 חלץ טקסט','sibPhase1Doc(\''+id+'\')','phase1');
  } else if (type==='document') {
    btns += sibBtn('👁 צפה','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('📝 חלץ טקסט','sibPhase1Doc(\''+id+'\')','phase1');
  } else if (type==='spreadsheet'||type==='csv') {
    btns += sibBtn('👁 צפה','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('📊 חלץ נתונים','sibPhase1Doc(\''+id+'\')','phase1');
  } else {
    btns += sibBtn('👁 צפה','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('📋 חלץ','sibPhase1Doc(\''+id+'\')','phase1');
  }

  // Phase 2 — only if phase 1 done
  if (hasP1) {
    btns += sibBtn('🚀 שלב 2: נתח','sibShowPhase2Panel(\''+id+'\')','phase2');
  }

  btns += sibBtn('✅ אשר → יומן','sibApprove(\''+id+'\')','approve');
  return btns;
}

function sibBtn(label, onclick, style) {
  var styles = {
    phase1:  'background:#1a3d5c;color:#fff;border:1px solid #1a3d5c;',
    phase2:  'background:linear-gradient(135deg,#7c3aed,#2d6a9f);color:#fff;border:none;',
    meas:    'background:#0d9488;color:#fff;border:1px solid #0d9488;',
    sec:     'background:#f5f0e8;color:#5a6f7c;border:1px solid rgba(180,140,60,0.3);',
    danger:  'background:#fff5f5;color:#c62828;border:1px solid #fca5a5;',
    enc:     'background:#ede7f6;color:#4527a0;border:1px solid #9c6fdd;',
    approve: 'background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;',
  };
  return '<button onclick="'+onclick+';event.stopPropagation();" style="'+(styles[style]||styles.sec)+'border-radius:6px;padding:4px 9px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">'+label+'</button>';
}

// ── SELECT ITEM ───────────────────────────────────────────────────────
function sibSelectItem(id) {
  _sibSelected = id;
  _sibItems.forEach(function(item) {
    var card = document.getElementById('sib-card-'+item.id);
    if (!card) return;
    card.style.background = item.id===id?'#fffbf0':'#fff';
    card.style.border = '1px solid '+(item.id===id?'rgba(180,140,60,0.5)':'rgba(180,140,60,0.2)');
  });
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;
  var item = _sibItems.find(function(i){return i.id===id;});
  if (!item) return;
  if (_sibAnalysis[id]) { sibShowAnalysis(id,_sibAnalysis[id]); return; }
  if (_sibPhase1[id])   { sibShowPhase2Panel(id); return; }
  panel.innerHTML =
    '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;padding:16px;margin-bottom:12px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
        '<span style="font-size:24px;">'+(item.file_type==='video'?'🎥':item.file_type==='audio'?'🎙':item.file_type==='pdf'?'📄':'📸')+'</span>' +
        '<div><div style="font-size:13px;font-weight:700;color:#1a3d5c;">'+sibEsc(item.file_name||'קובץ')+'</div>' +
          '<div style="font-size:10px;color:#8a9aa5;margin-top:2px;">'+new Date(item.created_at).toLocaleString('he-IL')+'</div></div>' +
      '</div>' +
      '<div style="font-size:11px;color:#8a9aa5;text-align:center;padding:10px;">לחץ על כפתורי הניתוח בכרטיס הקובץ</div>' +
    '</div>' + sibApprovePanel(item);
}

// ── PHASE 1: IMAGE DESCRIPTION ────────────────────────────────────────
async function sibPhase1Image(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if (!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) { panel.innerHTML='<div style="text-align:center;padding:60px 20px 20px;color:#1a3d5c;font-size:13px;">🔍 Claude מתאר את התמונה...</div>'; sibStartMeter('תיאור תמונה'); }
  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if(!apiKey){try{var cfg2=await sbQ('app_config','select=key,value');var row2=(cfg2.data||[]).find(function(r){return r.key==='anthropic_key';});if(row2){apiKey=row2.value;_sibApiKey=row2.value;}}catch(e2){}}
  if (!apiKey) { sibStopMeter(); sibShowError('אין מפתח API'); return; }
  try {
    var raw = await claudeFetch({ _apiKey:apiKey, model:'claude-sonnet-4-20250514', max_tokens:600,
      system:'אתה מהנדס שטח. תאר בעברית את מה שאתה רואה בתמונה בצורה מפורטת וטכנית. רשום כל פרט נראה לעין.',
      messages:[{role:'user',content:item.cloudinary_url?[{type:'image',source:{type:'url',url:item.cloudinary_url}},{type:'text',text:'תאר את התמונה הזו בפירוט.'}]:[{type:'text',text:'אין תמונה זמינה.'}]}]
    }, null);
    var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
    var txt = resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
    sibStopMeter(resp&&resp.usage);
    _sibPhase1[id] = txt;
    sibRefreshCard(id);
    sibShowPhase2Panel(id);
  } catch(e) { sibStopMeter(); sibShowError('שגיאה: '+e.message); }
}

// ── PHASE 1: DOCUMENT EXTRACTION ─────────────────────────────────────
async function sibPhase1Doc(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if (!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) { panel.innerHTML='<div style="text-align:center;padding:60px 20px 20px;color:#1a3d5c;font-size:13px;">📄 חולץ תוכן מסמך...</div>'; sibStartMeter('חילוץ מסמך'); }
  var url = item.cloudinary_url||'';
  var fname = (item.file_name||'').toLowerCase();
  var ext = fname.split('.').pop();
  var ftype = item.file_type||'document';
  var extracted = '';
  // Always read apiKey fresh — sibInit may have been cleared by refresh
  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if(!apiKey){
    try{var cfg=await sbQ('app_config','select=key,value');var row=(cfg.data||[]).find(function(r){return r.key==='anthropic_key';});if(row){apiKey=row.value;_sibApiKey=row.value;}}catch(e){}
  }
  try {
    if (ext==='pdf'||ext==='doc'||ext==='docx'||ftype==='pdf') {
      var mediaType = ext==='pdf'?'application/pdf':ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/msword';
      var binR = await fetch(url); var buf = await binR.arrayBuffer(); var bytes = new Uint8Array(buf);
      var bin=''; for(var bi=0;bi<bytes.length;bi+=8192) bin+=String.fromCharCode.apply(null,bytes.subarray(bi,bi+8192));
      var b64=btoa(bin);
      var raw = await claudeFetch({_apiKey:apiKey,model:'claude-sonnet-4-20250514',max_tokens:2000,
        system:'חלץ את כל הטקסט מהמסמך. החזר את הטקסט המלא ללא עיבוד או סיכום.',
        messages:[{role:'user',content:[{type:'document',source:{type:'base64',media_type:mediaType,data:b64}},{type:'text',text:'חלץ את כל הטקסט מהמסמך הזה.'}]}]
      },null);
      var resp=raw&&typeof raw.json==='function'?await raw.json():raw;
      extracted=resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
      sibStopMeter(resp&&resp.usage);
    } else if (ext==='md'||ext==='txt'||ext==='log'||ext==='csv') {
      var txtR=await fetch(url); extracted=await txtR.text();
      if(extracted.length>80000) extracted=extracted.substr(0,80000)+'\n[... קובץ קוצר ...]';
      sibStopMeter();
    } else if (ext==='xls'||ext==='xlsx'||ftype==='spreadsheet') {
      if(typeof XLSX==='undefined') await new Promise(function(res,rej){var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
      var xlsR=await fetch(url); var xlsBuf=await xlsR.arrayBuffer();
      var wb=XLSX.read(xlsBuf,{type:'array'});
      wb.SheetNames.forEach(function(sname){
        var csv=XLSX.utils.sheet_to_csv(wb.Sheets[sname]);
        extracted+='=== גיליון: '+sname+' ===\n'+csv.split('\n').slice(0,200).join('\n')+'\n\n';
      });
      if(extracted.length>80000) extracted=extracted.substr(0,80000)+'\n[...]';
      sibStopMeter();
    } else {
      var unkR=await fetch(url); extracted=await unkR.text();
      if(extracted.length>50000) extracted=extracted.substr(0,50000)+'\n[...]';
      sibStopMeter();
    }
    _sibPhase1[id] = extracted;
    sibRefreshCard(id);
    sibShowPhase2Panel(id);
  } catch(e) { sibStopMeter(); sibShowError('שגיאת חילוץ: '+e.message); }
}

// ── PHASE 1: TRANSCRIBE (audio/video) ────────────────────────────────
async function sibTranscribe(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if (!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) {
    panel.innerHTML='<div style="text-align:center;padding:60px 20px 20px;color:#1b7a4a;font-size:13px;">🎙️ '+(item.file_type==='video'?'מחלץ אודיו מהוידאו ומתמלל...':'מתמלל הקלטה...')+'</div>';
    sibStartMeter('תמלול — '+(item.file_name||id).substr(0,25));
  }
  var elevenlabsKey = null;
  try {
    if(window.APP&&window.APP.config&&window.APP.config.elevenlabs_key) { elevenlabsKey=window.APP.config.elevenlabs_key; }
    else { var cfg=await sbQ('app_config','select=key,value'); var row=(cfg.data||[]).find(function(r){return r.key==='elevenlabs_key';}); if(row) elevenlabsKey=row.value; }
  } catch(e){}
  if(!elevenlabsKey){sibStopMeter();sibShowError('לא נמצא מפתח ElevenLabs');return;}
  if(!item.cloudinary_url){sibStopMeter();sibShowError('אין URL לקובץ');return;}
  try {
    var audioResp=await fetch(item.cloudinary_url); var audioBlob=await audioResp.blob();
    var fileName=item.file_name||'audio.m4a'; var mimeType=audioBlob.type;
    if(!mimeType||mimeType==='application/octet-stream'||mimeType==='video/3gpp'||mimeType==='video/mp4'){
      var ext2=fileName.split('.').pop().toLowerCase();
      var mimeMap={m4a:'audio/mp4',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',aac:'audio/aac','3gp':'audio/3gpp',flac:'audio/flac',mp4:'audio/mp4'};
      mimeType=mimeMap[ext2]||'audio/mp4';
    }
    if(fileName.toLowerCase().endsWith('.mp4')) fileName=fileName.replace(/\.mp4$/i,'.m4a');
    var fixedBlob=new Blob([audioBlob],{type:mimeType});
    var formData=new FormData(); formData.append('file',fixedBlob,fileName); formData.append('model_id','scribe_v1');
    formData.append('language_code','he'); formData.append('diarize','true'); formData.append('tag_audio_events','false'); formData.append('timestamps_granularity','none');
    var transcResp=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':elevenlabsKey},body:formData});
    if(!transcResp.ok){var errJ=await transcResp.json().catch(function(){return{};});throw new Error('ElevenLabs '+transcResp.status+' — '+(errJ.detail||JSON.stringify(errJ)).substr(0,100));}
    var transcData=await transcResp.json();
    var transcript=transcData.text||'';
    if(!transcript&&transcData.words&&transcData.words.length){transcript=transcData.words.map(function(w){return w.type==='spacing'?'':(w.speaker_id?'[דובר '+w.speaker_id+'] ':'')+w.text;}).join(' ').replace(/\s+/g,' ').trim();}
    if(!transcript) transcript='(לא זוהה טקסט)';
    sibStopMeter({input_tokens:0,output_tokens:Math.ceil(transcript.length/4)});
    _sibPhase1[id] = transcript;
    sibRefreshCard(id);
    sibShowPhase2Panel(id);
  } catch(e){sibStopMeter();sibShowError('שגיאת תמלול: '+e.message);}
}

// ── PHASE 2: SHOW ANALYSIS PANEL ─────────────────────────────────────
function sibShowPhase2Panel(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if(!item) return;
  _sibSelected = id;
  var p1text = _sibPhase1[id]||'';
  var panel = document.getElementById('sib-analysis-panel');
  if(!panel) return;

  var type = item.file_type||'image';
  var isFinancial = (type==='spreadsheet'||type==='csv'||(item.file_name||'').match(/\.xlsx?$|\.csv$/i));
  var isAudio = (type==='audio'||type==='video');

  // Direction buttons
  var directions = [
    {id:'safety',      label:'⚠️ בטיחות',       color:'#c62828', bg:'#fff5f5', border:'#fca5a5'},
    {id:'engineering', label:'🏗️ הנדסי',        color:'#1a3d5c', bg:'#e8f0fd', border:'#93c5fd'},
    {id:'standards',   label:'📋 תקנים',         color:'#4527a0', bg:'#ede7f6', border:'#9c6fdd'},
    {id:'thirdparty',  label:'⚖️ צד שלישי',      color:'#7c2d12', bg:'#fff7ed', border:'#fb923c'},
  ];
  if(isFinancial) directions.push({id:'financial',label:'💰 רווח/הפסד',color:'#1b5e20',bg:'#e8f5e9',border:'#a5d6a7'});
  if(isAudio) directions.push({id:'protocol',label:'📝 פרוטוקול',color:'#7a5500',bg:'#fffde7',border:'#f59e0b'});
  directions.push({id:'general',label:'📊 כללי',color:'#555',bg:'#f5f5f5',border:'#ccc'});

  var dirBtns = directions.map(function(d){
    return '<button onclick="sibPhase2Run(\''+id+'\',\''+d.id+'\')" style="background:'+d.bg+';border:1px solid '+d.border+';color:'+d.color+';border-radius:8px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">'+d.label+'</button>';
  }).join('');

  // Safety subcategories
  var catHTML = '';
  if(_sibSafetyCategories.length>0){
    catHTML = '<div id="sib-safety-cats" style="display:none;background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:8px;">' +
      '<div style="font-size:10px;font-weight:800;color:#c62828;margin-bottom:8px;">בחר קטגוריות בטיחות לבדיקה:</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
      _sibSafetyCategories.map(function(cat){
        return '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;color:#1a1a1a;">' +
          '<input type="checkbox" class="sib-cat-cb" value="'+sibEsc(cat.name_he||cat.name||'')+'" checked style="accent-color:#c62828;">'+
          (cat.icon||'')+'&nbsp;'+sibEsc(cat.name_he||cat.name||'')+'</label>';
      }).join('') +
      '</div></div>';
  }

  panel.innerHTML =
    // Phase 1 extract + editable
    '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;padding:14px;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<div style="font-size:11px;font-weight:800;color:#1a3d5c;">📋 שלב 1 — חומר גלם (ניתן לעריכה)</div>' +
        '<button onclick="sibClearPhase1(\''+id+'\')" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:11px;font-family:Heebo,sans-serif;">✕ נקה</button>' +
      '</div>' +
      '<textarea id="sib-p1-edit-'+id+'" style="width:100%;min-height:180px;border:1px solid rgba(180,140,60,0.3);border-radius:8px;padding:10px;font-family:Heebo,sans-serif;font-size:12px;color:#1a1a1a;direction:rtl;resize:vertical;box-sizing:border-box;line-height:1.7;">'+sibEsc(p1text)+'</textarea>' +
    '</div>' +
    // Phase 2 direction selector
    '<div style="background:#fff;border:1px solid rgba(26,61,92,0.2);border-radius:10px;padding:14px;margin-bottom:10px;">' +
      '<div style="font-size:11px;font-weight:800;color:#1a3d5c;margin-bottom:10px;">🚀 שלב 2 — כיוון ניתוח</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+dirBtns+'</div>' +
      catHTML +
    '</div>' +
    '<div id="sib-p2-result"></div>' +
    sibApprovePanel(item);

  // Toggle safety cats when בטיחות clicked
  var safetyBtns = panel.querySelectorAll('button');
  safetyBtns.forEach(function(btn){
    if(btn.textContent.indexOf('בטיחות')>-1){
      btn.addEventListener('click',function(){
        var cats=document.getElementById('sib-safety-cats');
        if(cats) cats.style.display=cats.style.display==='none'?'block':'block';
      });
    }
  });
}

// ── PHASE 2: RUN ANALYSIS ─────────────────────────────────────────────
async function sibPhase2Run(id, direction) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if(!item) return;

  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if(!apiKey){try{var cfgP=await sbQ('app_config','select=key,value');var rowP=(cfgP.data||[]).find(function(r){return r.key==='anthropic_key';});if(rowP){apiKey=rowP.value;_sibApiKey=rowP.value;}}catch(e){}}
  if(!apiKey){sibShowError('אין מפתח API — הגדר anthropic_key ב-app_config');return;}

  // Get edited phase 1 text
  var p1el = document.getElementById('sib-p1-edit-'+id);
  var p1text = p1el?p1el.value:(_sibPhase1[id]||'');
  if(!p1text){sibShowError('אין חומר גלם — הפעל שלב 1 תחילה');return;}

  var resultEl = document.getElementById('sib-p2-result');
  if(resultEl){
    resultEl.innerHTML='<div style="text-align:center;padding:30px;color:#1a3d5c;font-size:13px;">🧠 Claude מנתח...</div>';
    sibStartMeter('ניתוח '+direction+' — '+(item.file_name||id).substr(0,20));
  }

  // For video + visual directions (safety/engineering) — use frame image, not transcript
  var isVideo = (item.file_type==='video');
  var isVisualDirection = (direction==='safety'||direction==='engineering'||direction==='general');
  var useImageAnalysis = isVideo && isVisualDirection && item.cloudinary_url;
  var frameUrl = useImageAnalysis
    ? item.cloudinary_url.replace('/upload/','/upload/so_2,w_1200/').replace(/\.(mp4|mov|avi|webm)$/i,'.jpg')
    : null;

  // Build direction-specific prompt
  var systemPrompt = '';
  var userPrompt = '';
  var reportTitle = '';

  if(direction==='safety'){
    // Get selected categories
    var selectedCats = [];
    document.querySelectorAll('.sib-cat-cb:checked').forEach(function(cb){ selectedCats.push(cb.value); });
    var catsStr = selectedCats.length>0?selectedCats.join(', '):'כל קטגוריות הבטיחות';
    reportTitle = '⚠️ דוח בטיחות';
    systemPrompt = 'אתה מפקח בטיחות בנייה מוסמך. עליך לנתח ממצאים בשטח ולהפיק דוחות בטיחות מקצועיים לפי תקנות הבטיחות בעבודה הישראליות.';
    userPrompt = 'נתח את החומר הבא לפי קטגוריות הבטיחות: '+catsStr+'\n\nחומר לניתוח:\n'+p1text+'\n\nהפק דוח בטיחות מקצועי בפורמט הבא:\n\n## סיכום מנהלים\n[2-3 שורות]\n\n## ממצאי בטיחות\n[לכל ממצא: תיאור, חומרה (🔴 קריטי / 🟡 בינוני / 🟢 נמוך), תקנה רלוונטית]\n\n## פעולות נדרשות לתיקון\n[ממוספר, עם עדיפות ודדליין]\n\n## ציון בטיחות כולל: X/10\n\n## המלצות לעתיד';
  }
  else if(direction==='engineering'){
    reportTitle = '🏗️ דוח הנדסי';
    systemPrompt = 'אתה מהנדס בנייה מוסמך עם ניסיון בפיקוח שטח. נתח ממצאים הנדסיים בצורה מקצועית.';
    userPrompt = 'נתח הנדסית את החומר הבא:\n\n'+p1text+'\n\nהפק דוח הנדסי בפורמט:\n\n## סיכום מצב\n\n## ממצאים הנדסיים\n[לכל ממצא: תיאור טכני, חריגה מהמפרט, השלכות]\n\n## רמת ביצוע: X/10\n\n## ליקויים דחופים\n\n## המלצות לתיקון\n[ממוספר עם עדיפות]\n\n## אבני דרך להמשך';
  }
  else if(direction==='standards'){
    reportTitle = '📋 דוח תאימות תקנים';
    // Will use RAG — build context first
    userPrompt = p1text; // temporary, will be overridden
  }
  else if(direction==='financial'){
    reportTitle = '💰 דוח רווח/הפסד';
    systemPrompt = 'אתה רואה חשבון ומנהל פרויקטי בנייה. נתח נתונים פיננסיים בצורה מקצועית, בדוק לוגיקה חשבונאית, מצא אנומליות, הפק תובנות.';
    userPrompt = 'נתח את הנתונים הפיננסיים הבאים:\n\n'+p1text+'\n\nהפק דוח פיננסי בפורמט:\n\n## סיכום פיננסי\n\n## בדיקת תקינות חישובים\n[בדוק כל חישוב — האם הלוגיקה נכונה?]\n\n## אנומליות שזוהו\n\n## סיכום רווח/הפסד\n[סכומים, אחוזים, מגמות]\n\n## נקודות סיכון\n\n## המלצות לאופטימיזציה';
  }
  else if(direction==='protocol'){
    reportTitle = '📝 פרוטוקול שיחה';
    systemPrompt = 'אתה מנהל פרויקטי בניה. הפק פרוטוקול שיחה מקצועי ותמציתי מהתמלול.';
    userPrompt = 'הפק פרוטוקול מהתמלול הבא:\n\n'+p1text+'\n\nפורמט:\n\n## פרטי שיחה\nתאריך: [אם מוזכר]\nמשתתפים: [שמות/תפקידים]\n\n## נושאים שנדונו\n[ממוספר]\n\n## החלטות שהתקבלו\n[ממוספר]\n\n## משימות לביצוע\n[משימה | אחראי | דדליין]\n\n## נושאים פתוחים\n\n## פעולות הבאות';
  }
  else if(direction==='thirdparty'){
    reportTitle = '⚖️ דוח חשיפה לצד שלישי';
    systemPrompt = [
      'אתה יועץ משפטי ומומחה ביטוח המתמחה באחריות קבלנים בישראל.',
      'אתה מכיר לעומק: חוק הנזיקין סעיפים 35-36, חוק הבטיחות בעבודה,',
      'חוק התכנון והבניה, תקנות הבטיחות באתרי בנייה,',
      'ואחריות שילוחית בהשאלת ציוד (Equipment Lending Liability).',
      'הדוח שלך מגן על הקבלן — זהה חשיפות לפני שהן הופכות לתביעות.'
    ].join(' ');

    userPrompt = [
      'נתח את החומר הבא לאיתור חשיפות לאחריות צד שלישי:',
      '',
      p1text,
      '',
      'הפק דוח מקיף בפורמט הבא:',
      '',
      '## 1. סיכום חשיפות — טבלת סיכונים',
      '[לכל חשיפה: סוג | חומרה 🔴/🟡/🟢 | סעיף חוק | חשיפה כספית משוערת]',
      '',
      '## 2. עוברי אורח ותנועה ציבורית',
      '[גדרות, שלטים, מפגעי נפילה לתחום ציבורי, בוץ/פסולת בכביש]',
      '',
      '## 3. נזק לנכסים גובלים',
      '[רטט, הצפה, חפירה, חסימת אור/אוויר — מה נראה בשטח]',
      '',
      '## 4. תשתיות ורשויות',
      '[סיכון לתשתיות תת-קרקעיות, נזק לרכוש עירוני]',
      '',
      '## 5. ⚠️ השאלת ציוד — אחריות שילוחית',
      '[זהה כל ציוד שעשוי להיות מושאל לקבלני משנה: סולמות, כבלים, פיגומים, כלים]',
      '[לכל פריט: מה הסיכון, מה ההגנה הנדרשת]',
      '[חוק הנזיקין סעיף 35 — אחריות רשלנות + סעיף 36 — חובת הזהירות]',
      '[IMPORTANT: גם ציוד בשימוש משותף ולא הושאל פורמלית — חשיפה מלאה]',
      '',
      '## 6. עובדי קבלני משנה ומבקרים',
      '[מי נכנס לאתר שאינו עובד ישיר? ביטוח? טופס כניסה? אישור?]',
      '',
      '## 7. חשיפות סביבתיות',
      '[אבק, רעש, זיהום, ניקוז — תקנות רלוונטיות + דדליינים]',
      '',
      '## 8. תיעוד הגנתי — מה לייצר עכשיו',
      '[רשימת מסמכים שיגנו על הקבלן בתביעה עתידית]',
      '[כולל: פרוטוקולי מסירת ציוד, הסכמי שימוש, ביטוחי קבלני משנה]',
      '',
      '## 9. פעולות דחופות — 48 שעות',
      '[ממוספר, עם אחראי ודדליין — מה לא יכול לחכות]',
      '',
      '## 10. ציון חשיפה כולל: X/10',
      '[10 = חשיפה מקסימלית, 1 = מוגן היטב]'
    ].join('\n');
  }
  else {
    reportTitle = '📊 ניתוח כללי';
    systemPrompt = 'אתה מנהל פרויקטי בנייה מנוסה. נתח את החומר ותן תובנות מקצועיות.';
    userPrompt = 'נתח את החומר הבא:\n\n'+p1text+'\n\nהפק דוח בפורמט:\n\n## סיכום\n\n## נקודות מרכזיות\n[ממוספר]\n\n## ממצאים חשובים\n\n## פעולות נדרשות\n[ממוספר עם עדיפות]\n\n## המלצות';
  }

  try {
    var finalText = '';

    // Standards direction — use ragQuery() directly (it runs Claude internally)
    if(direction==='standards'){
      if(typeof ragQuery!=='function'){ sibStopMeter(); sibShowError('מנוע RAG לא טעון — פתח לשונית ייעוץ הנדסי פעם אחת לטעינה'); return; }
      if(resultEl) resultEl.innerHTML='<div style="text-align:center;padding:20px;color:#4527a0;font-size:12px;">📚 מחפש ב-838 תקנים...</div>';

      // For audio/video transcripts — extract engineering keywords first
      // RAG needs engineering terminology, not conversational speech
      var ragQuery_text = p1text;
      if(isVideo || item.file_type==='audio') {
        // Extract key engineering terms from transcript via Claude before RAG
        if(resultEl) resultEl.innerHTML='<div style="text-align:center;padding:20px;color:#4527a0;font-size:12px;">🧠 מחלץ מונחי תקנים מהתמלול...</div>';
        try {
          var keyRaw = await claudeFetch({_apiKey:apiKey, model:'claude-sonnet-4-20250514', max_tokens:200,
            system:'חלץ מהטקסט הבא רק מונחי בנייה, חומרים, תקנים, פעולות הנדסיות. תשובה קצרה בעברית — רק מילות מפתח.',
            messages:[{role:'user',content:p1text.substr(0,1000)}]
          }, null);
          var keyResp = keyRaw&&typeof keyRaw.json==='function'?await keyRaw.json():keyRaw;
          var keywords = keyResp&&keyResp.content&&keyResp.content[0]?keyResp.content[0].text:'';
          if(keywords && keywords.length > 10) ragQuery_text = keywords;
        } catch(ke){ /* use original p1text */ }
        if(resultEl) resultEl.innerHTML='<div style="text-align:center;padding:20px;color:#4527a0;font-size:12px;">📚 מחפש ב-838 תקנים...</div>';
      }

      var ragResult = await ragQuery(ragQuery_text.substr(0,600));
      if(ragResult.error) throw new Error('RAG: '+ragResult.error);
      var retrieved = ragResult.retrieved||{};
      var allSources = (retrieved.building_standards||[]).concat(retrieved.mamad||[]).concat(retrieved.spec||[]).concat(retrieved.renovation||[]);
      if(allSources.length===0) throw new Error('לא נמצאו תקנים רלוונטיים — הטקסט לא מכיל מונחי בנייה מספיקים');
      var srcCount = allSources.length;
      sibStopMeter({input_tokens:srcCount*50+200, output_tokens:400});
      var ragAnswer = ragResult.answer||'';
      var result = {mode:'standards', text:'## תקנים רלוונטיים שנמצאו: '+srcCount+' רשומות\n\n'+ragAnswer, timestamp:new Date().toISOString(), title:'📋 דוח תאימות תקנים', usage:{input_tokens:srcCount*50+200,output_tokens:400}};
      _sibAnalysis[id] = result;
      sibRenderReport(id, result, p1text);
      return;
    }

    // For video + visual analysis — send frame image to Claude Vision
    var messages;
    if(useImageAnalysis && frameUrl) {
      messages = [{role:'user', content:[
        {type:'image', source:{type:'url', url:frameUrl}},
        {type:'text', text: userPrompt + '\n\n(הערה: זוהי תמונת מסגרת מתוך הסרטון ' + sibEsc(item.file_name||'') + ')'}
      ]}];
    } else {
      messages = [{role:'user', content:userPrompt}];
    }

    var raw = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages
    }, null);
    var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
    finalText = resp&&resp.content&&resp.content[0]?resp.content[0].text:'אין תגובה';
    sibStopMeter(resp&&resp.usage);

    var result = {mode:direction, text:finalText, timestamp:new Date().toISOString(), usage:resp&&resp.usage, title:reportTitle};
    _sibAnalysis[id] = result;
    sibRenderReport(id, result, p1text);
    // Wire third-party action buttons after report renders
    if (direction==='thirdparty') setTimeout(function(){ sibAddTPActions(id); }, 100);

  } catch(e){ sibStopMeter(); if(resultEl) resultEl.innerHTML='<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:14px;color:#c62828;font-size:12px;">שגיאה: '+sibEsc(e.message)+'</div>'; }
}

// ── RENDER REPORT ─────────────────────────────────────────────────────
function sibRenderReport(id, result, p1text) {
  var resultEl = document.getElementById('sib-p2-result');
  if(!resultEl) return;
  var item = _sibItems.find(function(i){return i.id===id;});
  var modeColors = {safety:'#c62828',engineering:'#1a3d5c',standards:'#4527a0',financial:'#1b5e20',protocol:'#7a5500',general:'#555'};
  var color = modeColors[result.mode]||'#555';

  // Convert markdown-ish to HTML
  var html = result.text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^## (.+)$/gm,'<div style="font-size:13px;font-weight:900;color:'+color+';margin:14px 0 6px;border-bottom:2px solid '+color+'33;padding-bottom:4px;">$1</div>')
    .replace(/^### (.+)$/gm,'<div style="font-size:12px;font-weight:800;color:#1a3d5c;margin:10px 0 4px;">$1</div>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/🔴/g,'<span style="color:#c62828;font-weight:900;">🔴</span>')
    .replace(/🟡/g,'<span style="color:#f59e0b;font-weight:900;">🟡</span>')
    .replace(/🟢/g,'<span style="color:#1b7a4a;font-weight:900;">🟢</span>')
    .replace(/\n/g,'<br>');

  var usageBar = '';
  if(result.usage){
    var iT=result.usage.input_tokens||0, oT=result.usage.output_tokens||0, cost=(iT*3+oT*15)/1000000;
    usageBar='<div style="background:#fffbf0;border:2px solid #c9a84c;border-radius:8px;padding:8px 12px;margin-top:8px;font-size:13px;color:#1a1a1a;">🔢 <b style="color:#c9a84c;font-size:15px;">'+(iT+oT).toLocaleString()+'</b> טוקנים &nbsp;·&nbsp; 📥 '+iT.toLocaleString()+' &nbsp;·&nbsp; 📤 '+oT.toLocaleString()+' &nbsp;·&nbsp; 💰 <b style="color:#1a3d5c;font-size:14px;">$'+cost.toFixed(4)+'</b></div>';
  }

  resultEl.innerHTML =
    '<div style="background:#fff;border:2px solid '+color+'33;border-radius:10px;padding:16px;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
        '<div style="font-size:14px;font-weight:900;color:'+color+';">'+sibEsc(result.title||result.mode)+'</div>' +
        '<span style="font-size:9px;color:#b0bec5;">'+new Date(result.timestamp).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})+'</span>' +
      '</div>' +
      '<div style="font-size:12px;color:#1a1a1a;line-height:1.9;direction:rtl;">'+html+'</div>' +
      usageBar +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<button onclick="sibCopyReport(\''+id+'\')" style="flex:1;padding:8px;background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#7a8a95;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">📋 העתק דוח</button>' +
      '<button onclick="sibSaveAnalysisAsNote(\''+id+'\')" style="flex:1;padding:8px;background:#f5e9c4;border:1px solid rgba(180,140,60,0.4);color:#9a6f00;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">💾 שמור ביומן</button>' +
      '<button onclick="sibSaveToEnc(\''+id+'\')" style="flex:1;padding:8px;background:#ede7f6;border:1px solid #9c6fdd;color:#4527a0;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">📚 אנציקלופדיה</button>' +
    '</div>';
}

// ── SHOW ANALYSIS (for previously saved results) ───────────────────────
function sibShowAnalysis(id, result) {
  var p1text = _sibPhase1[id]||'';
  if(p1text){ sibShowPhase2Panel(id); return; }
  // Fallback direct show
  var panel = document.getElementById('sib-analysis-panel');
  if(!panel) return;
  var item = _sibItems.find(function(i){return i.id===id;});
  panel.innerHTML = '<div id="sib-p2-result"></div>';
  sibRenderReport(id, result, p1text);
  if(item) panel.innerHTML += sibApprovePanel(item);
}

// ── MEDIA PREVIEW ─────────────────────────────────────────────────────
function sibPlayMedia(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if(!item) return;
  sibSelectItem(id);
  var url=(item.cloudinary_url&&item.cloudinary_url.startsWith('http'))?item.cloudinary_url:'';
  var rawType=(item.file_type||'').toLowerCase();
  var typeMap={mp4:'video',mov:'video',avi:'video',webm:'video',mp3:'audio',m4a:'audio',wav:'audio',ogg:'audio',aac:'audio','3gp':'audio',flac:'audio',jpg:'image',jpeg:'image',png:'image',gif:'image',webp:'image',pdf:'pdf'};
  var type=typeMap[rawType]||rawType;
  var fname=item.file_name||id;
  setTimeout(function(){
    var panel=document.getElementById('sib-analysis-panel');
    if(!panel) return;
    if(!url){panel.innerHTML='<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:20px;text-align:center;color:#c62828;font-size:12px;">⚠️ אין URL לקובץ זה</div>';return;}
    var playerHtml='';
    if(type==='video') playerHtml='<div style="padding:12px;"><div style="font-size:11px;color:#9a6f00;margin-bottom:8px;font-weight:700;">▶ '+sibEsc(fname)+'</div><video controls autoplay style="width:100%;border-radius:8px;background:#000;max-height:360px;" crossorigin="anonymous"><source src="'+sibEsc(url)+'"></video><div style="margin-top:8px;text-align:center;"><a href="'+sibEsc(url)+'" target="_blank" style="font-size:10px;color:#c9a84c;">⬇ פתח בחלון חדש</a></div></div>';
    else if(type==='audio') playerHtml='<div style="padding:20px;"><div style="font-size:16px;text-align:center;margin-bottom:12px;">🎵</div><div style="font-size:11px;color:#9a6f00;margin-bottom:12px;font-weight:700;text-align:center;">'+sibEsc(fname)+'</div><audio controls autoplay style="width:100%;margin-bottom:10px;" crossorigin="anonymous"><source src="'+sibEsc(url)+'"></audio><div style="text-align:center;"><a href="'+sibEsc(url)+'" target="_blank" style="font-size:10px;color:#c9a84c;">⬇ פתח בחלון חדש</a></div></div>';
    else if(type==='image') playerHtml='<div style="padding:12px;text-align:center;"><div style="font-size:11px;color:#9a6f00;margin-bottom:8px;font-weight:700;text-align:right;">🖼 '+sibEsc(fname)+'</div><img src="'+sibEsc(url)+'" style="max-width:100%;max-height:420px;border-radius:8px;object-fit:contain;border:1px solid rgba(180,140,60,0.2);" onerror="this.style.display=\'none\'"><div style="margin-top:8px;text-align:center;"><a href="'+sibEsc(url)+'" target="_blank" style="font-size:10px;color:#c9a84c;">⬇ פתח בגודל מלא</a></div></div>';
    else if(type==='pdf') playerHtml='<div style="padding:8px;"><div style="font-size:11px;color:#9a6f00;margin-bottom:8px;font-weight:700;">📄 '+sibEsc(fname)+'</div><iframe src="'+sibEsc(url)+'" style="width:100%;height:400px;border:none;border-radius:8px;"></iframe></div>';
    else playerHtml='<div style="padding:20px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">📎</div><div style="font-size:12px;font-weight:700;color:#1a3d5c;margin-bottom:12px;">'+sibEsc(fname)+'</div><a href="'+sibEsc(url)+'" target="_blank" style="background:#1a3d5c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;">⬇ פתח / הורד קובץ</a></div>';
    panel.innerHTML='<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;overflow:hidden;margin-bottom:10px;">'+playerHtml+'</div>'+sibApprovePanel(item);
  },0);
}

// ── FRAME EXTRACTION ──────────────────────────────────────────────────
async function sibExtractFrame(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if(!item||!item.cloudinary_url){sibShowError('אין URL לוידאו');return;}
  sibSelectItem(id);
  var frameUrl=item.cloudinary_url.replace('/upload/','/upload/so_1,w_800/').replace(/\.mp4$/,'.jpg').replace(/\.mov$/,'.jpg').replace(/\.avi$/,'.jpg');
  var panel=document.getElementById('sib-analysis-panel');
  if(panel){
    panel.innerHTML=
      '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;padding:14px;margin-bottom:10px;">' +
        '<div style="font-size:10px;color:#9a6f00;font-weight:800;margin-bottom:8px;">🎞️ פריים חולץ</div>' +
        '<img src="'+frameUrl+'" style="width:100%;border-radius:8px;margin-bottom:10px;" onerror="this.style.display=\'none\'">' +
        '<div style="display:flex;gap:6px;">' +
          '<button onclick="sibPhase1FromFrame(\''+id+'\',\''+frameUrl+'\')" style="flex:1;padding:9px;background:#1a3d5c;color:#fff;border:1px solid #1a3d5c;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📋 שלב 1 — תאר פריים</button>' +
        '</div>' +
      '</div>' + sibApprovePanel(item);
  }
}

async function sibPhase1FromFrame(id, frameUrl) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if(!item) return;
  var savedUrl = item.cloudinary_url;
  item.cloudinary_url = frameUrl;
  await sibPhase1Image(id);
  item.cloudinary_url = savedUrl;
}

// ── LIVE TOKEN METER ──────────────────────────────────────────────────
function sibStartMeter(label) {
  sibStopMeter();
  var panel=document.getElementById('sib-analysis-panel');
  if(!panel) return;
  var startTime=Date.now();
  var old=document.getElementById('sib-live-meter'); if(old) old.remove();
  var meterEl=document.createElement('div');
  meterEl.id='sib-live-meter';
  meterEl.style.cssText='background:#fff8e8;border:2px solid #c9a84c;border-radius:10px;padding:10px 16px;margin-top:12px;font-size:13px;color:#1a1a1a;display:flex;align-items:center;gap:10px;font-family:Heebo,sans-serif;direction:rtl;box-shadow:0 2px 8px rgba(201,168,76,0.2);';
  meterEl.innerHTML='<span style="display:inline-block;animation:sibspin 1s linear infinite;font-size:18px;">⚙️</span><span style="color:#1a3d5c;font-weight:800;font-size:13px;">'+(label||'AI עובד')+'</span><span style="margin-right:auto;"></span><span id="sib-meter-time" style="color:#c9a84c;font-weight:900;font-size:16px;min-width:36px;">0s</span><span style="color:#aaa;margin:0 6px;">|</span><span id="sib-meter-est" style="color:#333;font-size:12px;font-weight:700;">מחשב...</span>';
  if(!document.getElementById('sib-spin-style')){var st=document.createElement('style');st.id='sib-spin-style';st.textContent='@keyframes sibspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';document.head.appendChild(st);}
  panel.appendChild(meterEl);
  _sibMeterTimer=setInterval(function(){
    var elapsed=Math.floor((Date.now()-startTime)/1000);
    var tEl=document.getElementById('sib-meter-time'),eEl=document.getElementById('sib-meter-est');
    if(!tEl){clearInterval(_sibMeterTimer);return;}
    tEl.textContent=elapsed+'s';
    var est=elapsed*40;
    if(eEl) eEl.textContent='~'+est.toLocaleString()+' טוקנים · ~$'+(est*15/1000000).toFixed(4);
  },1000);
}

function sibStopMeter(usageObj) {
  if(_sibMeterTimer){clearInterval(_sibMeterTimer);_sibMeterTimer=null;}
  var meterEl=document.getElementById('sib-live-meter');
  if(!meterEl) return;
  if(usageObj){
    var iT=usageObj.input_tokens||0,oT=usageObj.output_tokens||0,cost=(iT*3+oT*15)/1000000;
    meterEl.style.background='#fffbf0'; meterEl.style.border='2px solid #c9a84c'; meterEl.style.fontSize='13px'; meterEl.style.color='#1a1a1a';
    meterEl.innerHTML='🔢 <b style="color:#c9a84c;font-size:15px;">'+(iT+oT).toLocaleString()+'</b> <span style="color:#333">טוקנים סה״כ</span> &nbsp;·&nbsp; <span style="color:#555">📥 '+iT.toLocaleString()+' קלט</span> &nbsp;·&nbsp; <span style="color:#555">📤 '+oT.toLocaleString()+' פלט</span> &nbsp;·&nbsp; 💰 <b style="color:#1a3d5c;font-size:14px;">$'+cost.toFixed(4)+'</b>';
  } else { meterEl.remove(); }
}

// ── BATCH SELECTION ───────────────────────────────────────────────────
function sibUpdateBatchBar() {
  var count=Object.keys(_sibSelSet).filter(function(k){return _sibSelSet[k];}).length;
  var bar=document.getElementById('sib-batch-bar'),countEl=document.getElementById('sib-sel-count');
  if(!bar) return;
  bar.style.display=count>0?'flex':'none';
  if(countEl) countEl.textContent=count+' נבחרו';
}
function sibClearSel() {
  _sibSelSet={};
  _sibItems.forEach(function(item){var cb=document.getElementById('sib-sel-'+item.id);if(cb) cb.checked=false;});
  sibUpdateBatchBar();
}
async function sibBatchDelete() {
  var ids=Object.keys(_sibSelSet).filter(function(k){return _sibSelSet[k];});
  if(!ids.length) return;
  if(!confirm('למחוק '+ids.length+' קבצים?')) return;
  var ok=0;
  for(var i=0;i<ids.length;i++){try{var r=await fetch(SB_URL+'/rest/v1/asset_inbox?id=eq.'+ids[i],{method:'DELETE',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});if(r.ok) ok++;}catch(e){}}
  showToast('🗑️ נמחקו '+ok+' קבצים','success');
  _sibSelSet={};
  await sibLoad(); sibUpdateBatchBar();
}
async function sibBatchToEnc() {
  var ids=Object.keys(_sibSelSet).filter(function(k){return _sibSelSet[k];});
  if(!ids.length) return;
  var ok=0;
  for(var i=0;i<ids.length;i++){
    var item=_sibItems.find(function(it){return it.id===ids[i];});
    if(!item) continue;
    try{
      await sb.from('field_encyclopedia').insert({category:'שטח',title:item.file_name||'קובץ',description:(_sibAnalysis[item.id]&&_sibAnalysis[item.id].text)||(_sibPhase1[item.id])||'קובץ מתיבת הנכנסים',media_url:item.cloudinary_url||null,media_type:item.file_type||'image',severity:'guideline',source_project_id:item.project_id||null,created_at:new Date().toISOString()});
      await fetch(SB_URL+'/rest/v1/asset_inbox?id=eq.'+item.id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'approved'})});
      ok++;
    } catch(e){}
  }
  showToast('📚 נשלחו '+ok+' קבצים לאנציקלופדיה','success');
  _sibSelSet={};
  await sibLoad(); sibUpdateBatchBar();
}
async function sibBatchAnalyze() {
  var ids=Object.keys(_sibSelSet).filter(function(k){return _sibSelSet[k];});
  if(!ids.length){showToast('בחר קבצים תחילה','error');return;}
  showToast('🚀 מנתח '+ids.length+' קבצים...','success');
  for(var i=0;i<ids.length;i++){
    sibSelectItem(ids[i]);
    var item=_sibItems.find(function(it){return it.id===ids[i];});
    if(!item) continue;
    if(item.file_type==='audio'||item.file_type==='video') await sibTranscribe(ids[i]);
    else if(item.file_type==='image') await sibPhase1Image(ids[i]);
    else await sibPhase1Doc(ids[i]);
    await new Promise(function(r){setTimeout(r,500);});
  }
  showToast('✅ שלב 1 הושלם — בחר כיוון ניתוח לכל קובץ','success');
}

// ── HELPERS ───────────────────────────────────────────────────────────
function sibClearPhase1(id) {
  delete _sibPhase1[id]; delete _sibAnalysis[id];
  sibRefreshCard(id);
  var p1el=document.getElementById('sib-p1-edit-'+id); if(p1el) p1el.value='';
}
function sibRefreshCard(id) {
  var item=_sibItems.find(function(i){return i.id===id;});
  if(!item) return;
  var card=document.getElementById('sib-card-'+id);
  if(!card) return;
  var newCard=sibFileCard(item);
  card.parentNode.replaceChild(newCard,card);
}
async function sibCopyReport(id) {
  var a=_sibAnalysis[id]; if(!a) return;
  try{await navigator.clipboard.writeText(a.text);showToast('✅ הועתק','success');}catch(e){showToast('שגיאה','error');}
}
function sibShowError(msg) {
  var panel=document.getElementById('sib-analysis-panel');
  if(panel) panel.innerHTML='<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:14px;color:#c62828;font-size:12px;">'+sibEsc(msg)+'</div>';
}
function sibEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── APPROVE / DELETE ──────────────────────────────────────────────────
function sibApprovePanel(item) {
  var projOpts='<option value="">— בחר פרויקט —</option>'+(window.allProjects||[]).map(function(p){return '<option value="'+p.id+'"'+(p.id===item.project_id?' selected':'')+'>'+sibEsc(p.project_name)+'</option>';}).join('');
  return '<div style="background:#f0faf5;border:1px solid #a5d6a7;border-radius:10px;padding:14px;">' +
    '<div style="font-size:11px;font-weight:800;color:#1b7a4a;margin-bottom:10px;">שייך לפרויקט ואשר</div>' +
    '<select id="sib-proj-sel-'+item.id+'" style="width:100%;background:#fff;border:1px solid rgba(180,140,60,0.3);color:#2c4a6e;border-radius:8px;padding:8px 12px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;margin-bottom:8px;">'+projOpts+'</select>' +
    '<button onclick="sibApproveWithProject(\''+item.id+'\')" style="width:100%;padding:10px;background:linear-gradient(135deg,#0d9488,#0f766e);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✅ אשר ושייך לפרויקט</button>' +
    '</div>';
}
async function sibApproveWithProject(id) {
  var sel=document.getElementById('sib-proj-sel-'+id);
  await sibApprove(id,sel?sel.value:null);
}
async function sibApprove(id,projectId) {
  try{
    var patch={status:'approved'}; if(projectId) patch.project_id=projectId;
    await fetch(SB_URL+'/rest/v1/asset_inbox?id=eq.'+id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(patch)});
    var item=_sibItems.find(function(i){return i.id===id;});
    if(item&&item.cloudinary_url) await sb.from('beni_notes').insert({note_text:item.file_name||'קובץ מאושר',note_type:item.file_type||'photo',photo_url:item.cloudinary_url,project_id:projectId||item.project_id||null,created_at:new Date().toISOString()});
    showToast('✅ אושר ושויך','success');
    _sibSelected=null;
    var panel=document.getElementById('sib-analysis-panel');
    if(panel) panel.innerHTML='<div style="text-align:center;padding:40px;color:#1b7a4a;font-size:13px;">✅ הקובץ אושר בהצלחה</div>';
    await sibLoad();
  } catch(e){showToast('שגיאה: '+e.message,'error');}
}
async function sibDeleteItem(id) {
  if(!confirm('למחוק קובץ זה מהתיבה?')) return;
  try{
    await fetch(SB_URL+'/rest/v1/asset_inbox?id=eq.'+id,{method:'DELETE',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    showToast('🗑️ נמחק','success');
    if(_sibSelected===id){_sibSelected=null;var panel=document.getElementById('sib-analysis-panel');if(panel) panel.innerHTML='<div style="text-align:center;padding:60px;color:#b0bec5;font-size:13px;">בחר קובץ מהרשימה</div>';}
    await sibLoad();
  } catch(e){showToast('שגיאה: '+e.message,'error');}
}

// ── SAVE ACTIONS ──────────────────────────────────────────────────────
async function sibSaveAnalysisAsNote(id) {
  var item=_sibItems.find(function(i){return i.id===id;}); var analysis=_sibAnalysis[id];
  if(!item||!analysis) return;
  var sel=document.getElementById('sib-proj-sel-'+id); var projectId=(sel&&sel.value)?sel.value:(item.project_id||null);
  try{
    await sb.from('beni_notes').insert({note_text:'📊 דוח AI — '+(analysis.title||analysis.mode)+'\n\n'+analysis.text,note_type:'text',photo_url:item.cloudinary_url||null,project_id:projectId,color:'blue',created_at:new Date().toISOString()});
    showToast('✅ נשמר ביומן','success');
  } catch(e){showToast('שגיאה: '+e.message,'error');}
}
async function sibSaveToEnc(id) {
  var item=_sibItems.find(function(i){return i.id===id;}); if(!item) return;
  var analysis=_sibAnalysis[id];
  try{
    await sb.from('field_encyclopedia').insert({category:'שטח',title:item.file_name||'קובץ',description:analysis?analysis.text:'קובץ מהתיבה',media_url:item.cloudinary_url||null,media_type:item.file_type||'image',severity:'guideline',source_project_id:item.project_id||null,created_at:new Date().toISOString()});
    showToast('✅ נשמר לאנציקלופדיה','success');
  } catch(e){showToast('שגיאה: '+e.message,'error');}
}

// ── FILTER & PROJECTS ─────────────────────────────────────────────────
function sibFilterByProject(projId) {
  var listEl=document.getElementById('sib-file-list'); if(!listEl) return;
  var filtered=projId?_sibItems.filter(function(i){return i.project_id===projId;}):_sibItems;
  listEl.innerHTML='';
  if(!filtered.length){listEl.innerHTML='<div style="text-align:center;padding:40px;color:#b0bec5;font-size:12px;">אין קבצים לפרויקט זה</div>';return;}
  filtered.forEach(function(item){listEl.appendChild(sibFileCard(item));});
}
function sibPopulateProjects() {
  var sel=document.getElementById('sib-proj-filter'); if(!sel) return;
  (window.allProjects||[]).forEach(function(p){var o=document.createElement('option');o.value=p.id;o.textContent=p.project_name;sel.appendChild(o);});
}


// ── URL / YOUTUBE HANDLER ─────────────────────────────────────────────
async function sibAddUrl() {
  var inp = document.getElementById('sib-url-input');
  var url = inp ? inp.value.trim() : '';
  if(!url || !url.startsWith('http')){ showToast('הזן URL תקין','error'); return; }

  var isYT = /youtube\.com\/watch|youtu\.be\//.test(url);
  var fname = isYT ? 'YouTube: '+url.substr(0,60) : 'URL: '+url.substr(0,60);
  var ftype = isYT ? 'youtube' : 'url';

  // Insert into asset_inbox as a URL record
  try {
    var res = await fetch(SB_URL+'/rest/v1/asset_inbox', {
      method:'POST',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({cloudinary_url:url, file_name:fname, file_type:ftype, status:'pending', created_at:new Date().toISOString()})
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    showToast('✅ URL נוסף לתיבה','success');
    if(inp) inp.value='';
    await sibLoad();
  } catch(e){ showToast('שגיאה: '+e.message,'error'); }
}

// Phase 1 for URL — fetch page text or YouTube transcript
async function sibPhase1Url(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if(!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  var url = item.cloudinary_url||'';
  var isYT = /youtube\.com\/watch|youtu\.be\//.test(url);

  if(panel){ panel.innerHTML='<div style="text-align:center;padding:60px 20px 20px;color:#1a3d5c;font-size:13px;">'+(isYT?'🎬 מנתח וידאו יוטיוב...':'🌐 מנתח דף אינטרנט...')+'</div>'; sibStartMeter(isYT?'ניתוח יוטיוב':'ניתוח URL'); }

  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if(!apiKey){try{var cfg=await sbQ('app_config','select=key,value');var row=(cfg.data||[]).find(function(r){return r.key==='anthropic_key';});if(row){apiKey=row.value;_sibApiKey=row.value;}}catch(e){}}
  if(!apiKey){sibStopMeter();sibShowError('אין מפתח API');return;}

  try {
    var prompt = isYT
    var prompt = isYT
      ? ('\u05d6\u05d4\u05d5 URL \u05e9\u05dc \u05e1\u05e8\u05d8\u05d5\u05df \u05d9\u05d5\u05d8\u05d9\u05d5\u05d1: ' + url + '\n\n\u05d0\u05d9\u05e0\u05da \u05d9\u05db\u05d5\u05dc \u05dc\u05e6\u05e4\u05d5\u05ea \u05d1\u05e1\u05e8\u05d8\u05d5\u05df \u05d9\u05e9\u05d9\u05e8\u05d5\u05ea. \u05d1\u05e7\u05e9 \u05de\u05d4\u05de\u05e9\u05ea\u05de\u05e9 \u05dc\u05d4\u05d3\u05d1\u05d9\u05e7 \u05db\u05ea\u05d5\u05d1\u05d9\u05d5\u05ea/\u05ea\u05de\u05dc\u05d5\u05dc \u05e9\u05dc \u05d4\u05e1\u05e8\u05d8\u05d5\u05df.')
      : ('\u05e0\u05ea\u05d7 \u05d0\u05ea \u05d4\u05d3\u05e3 \u05d4\u05d1\u05d0: ' + url + '\n\n\u05ea\u05d0\u05e8 \u05de\u05d4 \u05d9\u05d5\u05d3\u05e2 \u05e2\u05dc URL \u05d6\u05d4. \u05d1\u05e7\u05e9 \u05de\u05d4\u05de\u05e9\u05ea\u05de\u05e9 \u05dc\u05d4\u05d3\u05d1\u05d9\u05e7 \u05d0\u05ea \u05ea\u05d5\u05db\u05df \u05d4\u05d3\u05e3.');
    var raw = await claudeFetch({_apiKey:apiKey,model:'claude-sonnet-4-20250514',max_tokens:800,
      system:'אתה עוזר לניתוח תוכן אינטרנטי ווידאו.',
      messages:[{role:'user',content:prompt}]
    },null);
    var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
    var txt = resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
    sibStopMeter(resp&&resp.usage);

    // For URLs — add instruction to paste content
    var editableContent = txt + (isYT
      ? '\n\n---\n📌 הדבק כאן את הכתוביות/תמלול של הסרטון:'
      : '\n\n---\n📌 הדבק כאן את תוכן הדף לניתוח:');

    _sibPhase1[id] = editableContent;
    sibRefreshCard(id);
    sibShowPhase2Panel(id);
  } catch(e){ sibStopMeter(); sibShowError('שגיאה: '+e.message); }
}

// ── assetInboxLoad — no auto-rebuild ──────────────────────────────────
function assetInboxLoad() {
  if(!document.getElementById('sib-file-list')) sibInit();
  // else do nothing — manual refresh only
}

// ══════════════════════════════════════════════════════════════════════
// מדידות — FIELD MEASUREMENT OCR MODULE
// Photo of handwritten takeoff → Claude Vision OCR → structured table
// → Download CSV + Save to field_measurements Supabase table
// ══════════════════════════════════════════════════════════════════════

var _measItems = []; // parsed measurement rows from OCR

// ── OPEN MEASUREMENT MODAL ────────────────────────────────────────────
function sibOpenMeasurements(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;

  var projOpts = '<option value="">— בחר פרויקט —</option>' +
    (window.allProjects||[]).map(function(p){
      return '<option value="'+p.id+'"'+(p.id===item.project_id?' selected':'')+'>'+sibEsc(p.project_name)+'</option>';
    }).join('');

  panel.innerHTML =
    '<div style="background:#fff;border:2px solid #14b8a6;border-radius:12px;padding:16px;margin-bottom:10px;">' +
      '<div style="font-size:14px;font-weight:900;color:#0f766e;margin-bottom:12px;">📐 מדידות שטח — OCR</div>' +

      // Photo preview
      (item.cloudinary_url && (item.file_type==='image'||item.file_type==='photo') ?
        '<img src="'+sibEsc(item.cloudinary_url)+'" style="width:100%;max-height:220px;object-fit:contain;border-radius:8px;margin-bottom:12px;border:1px solid rgba(20,184,166,0.3);">' : '') +

      // Session label + project
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
        '<div>' +
          '<div style="font-size:10px;font-weight:700;color:#0f766e;margin-bottom:4px;">תווית מדידה</div>' +
          '<input id="meas-label-'+id+'" type="text" placeholder="למשל: קומה 1 — דירה 3" style="width:100%;border:1px solid rgba(20,184,166,0.3);border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;">' +
        '</div>' +
        '<div>' +
          '<div style="font-size:10px;font-weight:700;color:#0f766e;margin-bottom:4px;">פרויקט</div>' +
          '<select id="meas-proj-'+id+'" style="width:100%;border:1px solid rgba(20,184,166,0.3);border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;background:#fff;">'+projOpts+'</select>' +
        '</div>' +
      '</div>' +

      // OCR button
      '<button onclick="sibRunMeasOCR(\''+id+'\')" id="meas-ocr-btn-'+id+'" style="width:100%;padding:12px;background:linear-gradient(135deg,#0d9488,#0f766e);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:12px;">🔍 הפעל OCR — חלץ מדידות</button>' +

      // Results area
      '<div id="meas-result-'+id+'"></div>' +
    '</div>';
}

// ── RUN OCR ───────────────────────────────────────────────────────────
async function sibRunMeasOCR(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;

  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if (!apiKey) { sibShowError('אין מפתח API'); return; }

  var btn = document.getElementById('meas-ocr-btn-'+id);
  var resultEl = document.getElementById('meas-result-'+id);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ מעבד תמונה...'; }
  if (resultEl) resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:#0f766e;font-size:12px;">🧠 Claude קורא את כתב היד...</div>';
  sibStartMeter('OCR מדידות');

  try {
  var _measPrompt = 'OCR \u05de\u05d3\u05d9\u05d3\u05d5\u05ea: \u05d7\u05dc\u05e5 \u05db\u05dc \u05d4\u05de\u05d3\u05d9\u05d3\u05d5\u05ea. JSON \u05d1\u05dc\u05d1\u05d3:\n{"rows":[{"item":"\u05e9\u05dd","length":4.5,"width":3.2,"area":14.4,"unit":"\u05de\"\u05e8","notes":""}],"total_area":14.4,"notes":""}';
  var imageContent = item.cloudinary_url ? [
    { type: 'image', source: { type: 'url', url: item.cloudinary_url } },
    { type: 'text', text: _measPrompt }
  ] : [{ type: 'text', text: '\u05d0\u05d9\u05df \u05ea\u05de\u05d5\u05e0\u05d4 \u05d6\u05de\u05d9\u05e0\u05d4' }];

    var raw = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'אתה מומחה OCR למדידות בנייה. קרא כתב יד מדויק והחזר JSON מובנה בלבד. אל תוסיף הסברים.',
      messages: [{ role: 'user', content: imageContent }]
    }, null);

    var resp = raw && typeof raw.json === 'function' ? await raw.json() : raw;
    sibStopMeter(resp && resp.usage);

    var rawText = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
    // Strip markdown fences if present
    rawText = rawText.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

    var parsed;
    try { parsed = JSON.parse(rawText); }
    catch(e) { throw new Error('Claude לא החזיר JSON תקין — נסה שוב או ערוך ידנית'); }

    _measItems = parsed.rows || [];
    if (_measItems.length === 0) throw new Error('לא נמצאו מדידות בתמונה');

    sibRenderMeasTable(id, parsed);

  } catch(e) {
    sibStopMeter();
    if (btn) { btn.disabled = false; btn.textContent = '🔍 הפעל OCR — חלץ מדידות'; }
    if (resultEl) resultEl.innerHTML = '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:12px;color:#c62828;font-size:12px;">שגיאה: '+sibEsc(e.message)+'</div>';
  }
}

// ── RENDER MEASUREMENT TABLE ──────────────────────────────────────────
function sibRenderMeasTable(id, parsed) {
  var resultEl = document.getElementById('meas-result-'+id);
  var btn = document.getElementById('meas-ocr-btn-'+id);
  if (btn) { btn.disabled = false; btn.textContent = '🔄 הפעל שוב'; }
  if (!resultEl) return;

  var rows = parsed.rows || [];
  var totalArea = parsed.total_area || rows.reduce(function(s,r){ return s+(parseFloat(r.area)||0); }, 0);

  var tableRows = rows.map(function(r, i) {
    return '<tr style="border-bottom:1px solid rgba(20,184,166,0.15);">' +
      '<td style="padding:6px 8px;"><input value="'+sibEsc(r.item||'')+'" onchange="_measItems['+i+'].item=this.value" style="width:100%;border:none;border-bottom:1px solid #ccc;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;background:transparent;"></td>' +
      '<td style="padding:6px 8px;text-align:center;"><input type="number" step="0.01" value="'+(r.length||'')+'" onchange="_measItems['+i+'].length=parseFloat(this.value)||null;sibRecalcRow('+i+')" style="width:60px;border:none;border-bottom:1px solid #ccc;text-align:center;font-size:12px;"></td>' +
      '<td style="padding:6px 8px;text-align:center;"><input type="number" step="0.01" value="'+(r.width||'')+'" onchange="_measItems['+i+'].width=parseFloat(this.value)||null;sibRecalcRow('+i+')" style="width:60px;border:none;border-bottom:1px solid #ccc;text-align:center;font-size:12px;"></td>' +
      '<td style="padding:6px 8px;text-align:center;" id="meas-area-'+i+'"><b style="color:#0f766e;">'+(r.area?parseFloat(r.area).toFixed(2):'')+'</b></td>' +
      '<td style="padding:6px 8px;font-size:10px;color:#888;">'+sibEsc(r.unit||'מ"ר')+'</td>' +
      '<td style="padding:6px 8px;"><input value="'+sibEsc(r.notes||'')+'" onchange="_measItems['+i+'].notes=this.value" style="width:100%;border:none;border-bottom:1px solid #ccc;font-family:Heebo,sans-serif;font-size:11px;direction:rtl;background:transparent;" placeholder="הערה"></td>' +
      '<td style="padding:6px 4px;"><button onclick="_measItems.splice('+i+',1);sibRenderMeasTable(\''+id+'\',{rows:_measItems,total_area:null,notes:\'\'});sibRecalcTotal();" style="background:none;border:none;color:#fca5a5;cursor:pointer;font-size:14px;">×</button></td>' +
    '</tr>';
  }).join('');

  resultEl.innerHTML =
    // Editable table
    '<div style="overflow-x:auto;margin-bottom:10px;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<thead><tr style="background:rgba(20,184,166,0.1);">' +
          '<th style="padding:8px;text-align:right;color:#0f766e;font-weight:800;">פריט / חדר</th>' +
          '<th style="padding:8px;text-align:center;color:#0f766e;">אורך מ\'</th>' +
          '<th style="padding:8px;text-align:center;color:#0f766e;">רוחב מ\'</th>' +
          '<th style="padding:8px;text-align:center;color:#0f766e;">שטח</th>' +
          '<th style="padding:8px;text-align:center;color:#0f766e;">יחידה</th>' +
          '<th style="padding:8px;text-align:right;color:#0f766e;">הערות</th>' +
          '<th style="padding:8px;"></th>' +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
        '<tfoot><tr style="background:rgba(20,184,166,0.1);font-weight:900;">' +
          '<td colspan="3" style="padding:8px;color:#0f766e;">סה"כ שטח</td>' +
          '<td style="padding:8px;text-align:center;color:#0f766e;font-size:15px;" id="meas-total">'+totalArea.toFixed(2)+' מ"ר</td>' +
          '<td colspan="3"></td>' +
        '</tr></tfoot>' +
      '</table>' +
    '</div>' +

    // Add row button
    '<button onclick="sibAddMeasRow(\''+id+'\')" style="background:#f0fdfb;border:1px dashed #14b8a6;color:#0f766e;border-radius:8px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;margin-bottom:12px;">+ הוסף שורה</button>' +

    // Notes + raw OCR
    (parsed.notes ? '<div style="font-size:11px;color:#666;background:#f0fdfb;border-radius:8px;padding:8px;margin-bottom:10px;direction:rtl;">📝 '+sibEsc(parsed.notes)+'</div>' : '') +

    // Action buttons
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button onclick="sibDownloadMeasCSV(\''+id+'\')" style="flex:1;padding:10px;background:#0f766e;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">⬇ הורד CSV</button>' +
      '<button onclick="sibSaveMeasurements(\''+id+'\')" style="flex:1;padding:10px;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">💾 שמור במאגר</button>' +
      '<button onclick="sibSendMeasToTakeoff(\''+id+'\')" style="flex:1;padding:10px;background:#f5e9c4;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📐 שלח לטייקאוף</button>' +
    '</div>';
}

function sibRecalcRow(i) {
  var r = _measItems[i];
  if (r && r.length && r.width) {
    r.area = Math.round(r.length * r.width * 100) / 100;
    var areaEl = document.getElementById('meas-area-'+i);
    if (areaEl) areaEl.innerHTML = '<b style="color:#0f766e;">'+r.area.toFixed(2)+'</b>';
  }
  sibRecalcTotal();
}

function sibRecalcTotal() {
  var total = _measItems.reduce(function(s,r){ return s+(parseFloat(r.area)||0); }, 0);
  var el = document.getElementById('meas-total');
  if (el) el.textContent = total.toFixed(2)+' מ"ר';
}

function sibAddMeasRow(id) {
  _measItems.push({item:'',length:null,width:null,area:null,unit:'מ"ר',notes:''});
  var parsed = {rows:_measItems, total_area:null, notes:''};
  sibRenderMeasTable(id, parsed);
}

// ── DOWNLOAD CSV ──────────────────────────────────────────────────────
function sibDownloadMeasCSV(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  var labelEl = document.getElementById('meas-label-'+id);
  var label = labelEl ? labelEl.value : '';
  var total = _measItems.reduce(function(s,r){ return s+(parseFloat(r.area)||0); }, 0);

  var header = 'פריט / חדר,אורך (מ\'),רוחב (מ\'),שטח (מ"ר),יחידה,הערות\n';
  var dataRows = _measItems.map(function(r){
    return [r.item||'',r.length||'',r.width||'',r.area||'',r.unit||'מ"ר',r.notes||'']
      .map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n');
  var footer = '\n"סה"כ","","",'+total.toFixed(2)+',"מ"ר",""';

  var csv = '\uFEFF' + header + dataRows + footer; // BOM for Excel Hebrew
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (label||'מדידות_'+new Date().toLocaleDateString('he-IL')).replace(/[/\\:*?"<>|]/g,'_') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ CSV הורד','success');
}

// ── SAVE TO field_measurements ────────────────────────────────────────
async function sibSaveMeasurements(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item || !_measItems.length) { showToast('אין מדידות לשמירה','error'); return; }

  var labelEl = document.getElementById('meas-label-'+id);
  var projEl  = document.getElementById('meas-proj-'+id);
  var label   = labelEl ? labelEl.value : '';
  var projId  = projEl  ? projEl.value  : (item.project_id||null);
  var total   = _measItems.reduce(function(s,r){ return s+(parseFloat(r.area)||0); }, 0);

  try {
    var res = await fetch(SB_URL+'/rest/v1/field_measurements', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        project_id:       projId||null,
        photo_url:        item.cloudinary_url||null,
        session_label:    label||null,
        measured_by:      'בני',
        measurement_date: new Date().toISOString().split('T')[0],
        rows:             JSON.stringify(_measItems),
        total_area:       Math.round(total*100)/100,
        status:           'done',
        created_at:       new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    showToast('✅ נשמר בטבלת מדידות שטח','success');

    // Also approve the inbox item
    await fetch(SB_URL+'/rest/v1/asset_inbox?id=eq.'+id, {
      method:'PATCH',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({status:'approved'})
    });
    await sibLoad();
  } catch(e) {
    showToast('שגיאה: '+e.message,'error');
  }
}

// ── SEND TO site_takeoffs ─────────────────────────────────────────────
async function sibSendMeasToTakeoff(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item || !_measItems.length) { showToast('אין מדידות לשליחה','error'); return; }

  var labelEl = document.getElementById('meas-label-'+id);
  var projEl  = document.getElementById('meas-proj-'+id);
  var label   = labelEl ? labelEl.value : '';
  var projId  = projEl  ? projEl.value  : (item.project_id||null);
  var total   = _measItems.reduce(function(s,r){ return s+(parseFloat(r.area)||0); }, 0);

  // Map to site_takeoffs rows format
  var takeoffRows = _measItems.map(function(r){
    return { room: r.item||'', length: r.length||0, width: r.width||0, area: r.area||0 };
  });

  try {
    var res = await fetch(SB_URL+'/rest/v1/site_takeoffs', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        project_id:    projId||null,
        session_label: label || ('מדידת שטח — '+new Date().toLocaleDateString('he-IL')),
        rows:          JSON.stringify(takeoffRows),
        total_area:    Math.round(total*100)/100,
        takeoff_type:  'standard',
        submitted_by:  'בני',
        notes:         'יובא אוטומטית מ-OCR תמונת מדידות',
        created_at:    new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    showToast('✅ נשלח לטייקאוף בהצלחה','success');
  } catch(e) {
    showToast('שגיאה: '+e.message,'error');
  }
}

// ══════════════════════════════════════════════════════════════════════
// THIRD-PARTY LIABILITY RAG + SUPPORT FUNCTIONS
// Table: third_party_risks (loaded from Gemini CSV)
// ══════════════════════════════════════════════════════════════════════

var _tpRiskData = []; // loaded from Supabase third_party_risks table

// ── LOAD THIRD-PARTY RAG DATA ─────────────────────────────────────────
async function sibLoadTPRisks() {
  if (_tpRiskData.length > 0) return _tpRiskData;
  try {
    var res = await sbQ('third_party_risks',
      'select=id,category,scenario_he,legal_basis,severity,liable_party,prevention_measures,insurance_type,fine_range_ils,tags&order=severity.asc&limit=500');
    if (res.data && res.data.length > 0) {
      _tpRiskData = res.data;
      return _tpRiskData;
    }
  } catch(e) { console.warn('third_party_risks not yet loaded:', e.message); }
  return [];
}

// ── COMPONENT 1: EQUIPMENT LENDING LOGGER ────────────────────────────
// Beni lends a ladder/cable → creates a timestamped record immediately
function sibOpenEquipmentLog(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;
  if (id) sibSelectItem(id);

  panel.innerHTML =
    '<div style="background:#fff;border:2px solid #f97316;border-radius:12px;padding:16px;margin-bottom:10px;">' +
      '<div style="font-size:14px;font-weight:900;color:#c2410c;margin-bottom:4px;">⚠️ רישום השאלת ציוד — הגנה משפטית</div>' +
      '<div style="font-size:11px;color:#888;margin-bottom:14px;">כל השאלה חייבת תיעוד! חוק הנזיקין סעיף 35-36 — אחריות שילוחית</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">' +
        '<div><div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:3px;">סוג הציוד</div>' +
          '<input id="eq-item" type="text" placeholder="סולם 6 מ\' / כבל 16A / פיגום..." style="width:100%;border:1px solid #fed7aa;border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;"></div>' +
        '<div><div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:3px;">מושאל ל</div>' +
          '<input id="eq-to" type="text" placeholder="שם הקבלן / נגר / חשמלאי..." style="width:100%;border:1px solid #fed7aa;border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;"></div>' +
        '<div><div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:3px;">תאריך + שעה</div>' +
          '<input id="eq-time" type="text" value="'+new Date().toLocaleString('he-IL')+'" style="width:100%;border:1px solid #fed7aa;border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;"></div>' +
        '<div><div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:3px;">מצב הציוד</div>' +
          '<select id="eq-condition" style="width:100%;border:1px solid #fed7aa;border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;background:#fff;">' +
            '<option value="תקין">תקין</option><option value="עם פגמים קלים">עם פגמים קלים</option><option value="דורש בדיקה">דורש בדיקה</option>' +
          '</select></div>' +
        '<div style="grid-column:span 2;"><div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:3px;">הערות / תנאי השאלה</div>' +
          '<input id="eq-notes" type="text" placeholder="מוחזר עד שישי / לא לעבוד בגובה / כבל רק לשימוש קרקעי..." style="width:100%;border:1px solid #fed7aa;border-radius:8px;padding:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;"></div>' +
      '</div>' +

      // Legal warning box
      '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;margin-bottom:12px;">' +
        '<div style="font-size:11px;font-weight:800;color:#c2410c;margin-bottom:6px;">⚖️ הגנה משפטית — מה הרישום הזה מספק:</div>' +
        '<div style="font-size:11px;color:#7c2d12;line-height:1.8;">' +
          '✅ תיעוד שהציוד היה תקין בעת המסירה<br>' +
          '✅ הוכחה שהמשתמש ידע את תנאי השימוש<br>' +
          '✅ הגדרת אחריות — הציוד עבר לאחריות המקבל<br>' +
          '✅ טיימסטמפ שאי אפשר לערעור עליו<br>' +
          '⚠️ אם אין רישום — אתה אחראי ל-100% בתביעה' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:8px;">' +
        '<button onclick="sibSaveEquipmentLog()" style="flex:1;padding:11px;background:linear-gradient(135deg,#c2410c,#ea580c);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">📋 שמור רישום + הפק מסמך</button>' +
        '<button onclick="sibGenerateEquipmentPDF()" style="padding:11px 16px;background:#f5e9c4;border:1px solid #c9a84c;color:#7a5500;border-radius:10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📄 PDF</button>' +
      '</div>' +
    '</div>';
}

async function sibSaveEquipmentLog() {
  var eqItem  = (document.getElementById('eq-item')||{}).value||'';
  var eqTo    = (document.getElementById('eq-to')||{}).value||'';
  var eqTime  = (document.getElementById('eq-time')||{}).value||new Date().toLocaleString('he-IL');
  var eqCond  = (document.getElementById('eq-condition')||{}).value||'תקין';
  var eqNotes = (document.getElementById('eq-notes')||{}).value||'';

  if (!eqItem || !eqTo) { showToast('מלא סוג ציוד ושם מקבל','error'); return; }

  var record = {
    equipment: eqItem, lent_to: eqTo, lent_at: eqTime,
    condition_at_lending: eqCond, terms: eqNotes,
    lent_by: (window.APP&&window.APP.config&&window.APP.config.manager_name)||'בני פרסקי',
    created_at: new Date().toISOString()
  };

  try {
    var res = await fetch(SB_URL+'/rest/v1/equipment_lending_log', {
      method:'POST',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify(record)
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    showToast('✅ רישום נשמר — אתה מוגן','success');
    sibGenerateEquipmentPDF(record);
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

function sibGenerateEquipmentPDF(record) {
  var r = record || {
    equipment: (document.getElementById('eq-item')||{}).value||'',
    lent_to:   (document.getElementById('eq-to')||{}).value||'',
    lent_at:   (document.getElementById('eq-time')||{}).value||new Date().toLocaleString('he-IL'),
    condition_at_lending: (document.getElementById('eq-condition')||{}).value||'תקין',
    terms:     (document.getElementById('eq-notes')||{}).value||'',
    lent_by:   (window.APP&&window.APP.config&&window.APP.config.manager_name)||'בני פרסקי'
  };

  var html = '<html dir="rtl"><head><meta charset="UTF-8">'+
    '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:40px;color:#1a1a1a;}'+
    'h1{color:#c2410c;font-size:20px;border-bottom:3px solid #f97316;padding-bottom:10px;}'+
    '.field{margin:12px 0;padding:10px 14px;background:#fff7ed;border-right:4px solid #f97316;border-radius:6px;}'+
    '.label{font-size:11px;font-weight:700;color:#9a3412;margin-bottom:3px;}'+
    '.value{font-size:14px;font-weight:600;}'+
    '.warning{background:#fef2f2;border:2px solid #fca5a5;border-radius:8px;padding:14px;margin-top:20px;}'+
    '.sig{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}'+
    '.sig-box{border-top:2px solid #1a1a1a;padding-top:8px;font-size:12px;color:#666;}'+
    '</style></head><body>'+
    '<div style="text-align:center;margin-bottom:20px;">'+
      '<div style="font-size:11px;color:#666;letter-spacing:2px;">טופס מסירת ציוד — הגנה מפני אחריות שילוחית</div>'+
      '<h1>⚠️ אישור השאלת ציוד</h1>'+
      '<div style="font-size:11px;color:#888;">מופק אוטומטית | '+new Date().toLocaleString('he-IL')+'</div>'+
    '</div>'+
    '<div class="field"><div class="label">ציוד מושאל</div><div class="value">'+r.equipment+'</div></div>'+
    '<div class="field"><div class="label">מושאל לידי</div><div class="value">'+r.lent_to+'</div></div>'+
    '<div class="field"><div class="label">תאריך ושעת מסירה</div><div class="value">'+r.lent_at+'</div></div>'+
    '<div class="field"><div class="label">מצב הציוד בעת המסירה</div><div class="value">'+r.condition_at_lending+'</div></div>'+
    '<div class="field"><div class="label">תנאי השימוש</div><div class="value">'+(r.terms||'ללא הגבלות מיוחדות')+'</div></div>'+
    '<div class="warning">'+
      '<div style="font-size:13px;font-weight:800;color:#c62828;margin-bottom:8px;">⚖️ הצהרת המקבל</div>'+
      '<div style="font-size:12px;line-height:1.8;">'+
        'אני החתום מטה מאשר שקיבלתי את הציוד הנ"ל במצב כמתואר לעיל, '+
        'וכי אני נוטל על עצמי את מלוא האחריות לשימוש בטוח בציוד זה, '+
        'לרבות אחריות לבטיחות עובדיי המשתמשים בו. '+
        'הציוד מוחזר לאחריותי המלאה מרגע קבלתו.'+
      '</div>'+
    '</div>'+
    '<div class="sig">'+
      '<div class="sig-box">חתימת המוסר: '+r.lent_by+'<br><br>_________________</div>'+
      '<div class="sig-box">חתימת המקבל: '+r.lent_to+'<br><br>_________________</div>'+
    '</div>'+
    '<div style="margin-top:30px;font-size:10px;color:#aaa;text-align:center;">'+
      'מסמך זה הופק ב-'+new Date().toLocaleString('he-IL')+' | '+
      'מהווה ראיה לפי חוק הנזיקין סעיף 35 | שמור עותק חתום'+
    '</div>'+
    '</body></html>';

  var w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 500); }
}

// ── COMPONENT 2: TIMELINE RISK SCORER ────────────────────────────────
async function sibTimelineRisk(id, p1text) {
  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if (!apiKey) return;

  var raw = await claudeFetch({
    _apiKey: apiKey,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: 'אתה יועץ סיכונים משפטי. ענה ONLY בעברית. קצר ומדויק.',
    messages:[{role:'user',content:
      'על בסיס הממצאים הבאים, מה הסיכון המשפטי שגדל עם הזמן?\n\n'+
      p1text.substr(0,800)+'\n\n'+
      'הפק טבלה:\n## ⏱️ ציר סיכונים בזמן\n'+
      '[ממצא | מתי הופך קריטי | מה קורה אם לא מטופל]\n'+
      '## פעולות דחופות 24 שעות\n## פעולות שבוע הבא'
    }]
  }, null);
  var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
  return resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
}

// ── COMPONENT 3: INSURANCE GAP DETECTOR ──────────────────────────────
async function sibInsuranceGap(id, p1text) {
  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if (!apiKey) return;

  var raw = await claudeFetch({
    _apiKey: apiKey,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: 'אתה מומחה ביטוח קבלנים ישראלי. זהה פערי ביטוח.',
    messages:[{role:'user',content:
      'על בסיס הממצאים:\n'+p1text.substr(0,800)+'\n\n'+
      '## 🔍 פערי ביטוח זוהו\n'+
      '[לכל פריט: מה לא מכוסה בפוליסה בסיסית + סוג ה-rider הנדרש]\n'+
      '## ⚠️ חשיפות ספציפיות לביטוח קבלני משנה\n'+
      '## 💡 המלצות לסוכן הביטוח'
    }]
  }, null);
  var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
  return resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
}

// ── COMPONENT 4: EVIDENCE DOCUMENTATION GENERATOR ────────────────────
async function sibGenerateEvidenceDoc(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  if (!item) return;

  var timestamp = new Date().toLocaleString('he-IL');
  var projName = (window.allProjects||[]).find(function(p){ return p.id===item.project_id; });
  projName = projName ? projName.project_name : 'לא ידוע';

  var html = '<html dir="rtl"><head><meta charset="UTF-8">'+
    '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:40px;}'+
    'h1{color:#1a3d5c;font-size:18px;}'+
    '.stamp{background:#e8f5e9;border:2px solid #4caf50;border-radius:8px;padding:12px;margin-bottom:16px;}'+
    '.findings{background:#fff3e0;border-right:4px solid #ff9800;padding:12px;margin:10px 0;border-radius:6px;}'+
    '.actions{background:#e3f2fd;border-right:4px solid #2196f3;padding:12px;margin:10px 0;border-radius:6px;}'+
    '</style></head><body>'+
    '<div class="stamp">'+
      '<div style="font-size:11px;color:#1b5e20;font-weight:800;">✅ מסמך תיעוד הגנתי — חסוי / לשימוש משפטי</div>'+
      '<div style="font-size:13px;font-weight:700;margin:6px 0;">זיהינו וטיפלנו — '+timestamp+'</div>'+
      '<div style="font-size:11px;color:#555;">פרויקט: '+sibEsc(projName)+' | קובץ: '+sibEsc(item.file_name||'')+' | נוצר ע"י: '+(window.APP&&window.APP.config&&window.APP.config.manager_name||'')+'</div>'+
    '</div>'+
    '<h1>📋 דוח ביקורת פנימית — לצרכי הגנה משפטית</h1>'+
    '<div class="findings">'+
      '<b>ממצאים שזוהו:</b><br>'+
      (analysis ? analysis.text.replace(/\n/g,'<br>').substr(0,1500) : 'ראה קובץ מצורף')+
    '</div>'+
    '<div class="actions">'+
      '<b>פעולות שננקטו / מתוכננות:</b><br>'+
      '<br>1. ___________________________<br>'+
      '<br>2. ___________________________<br>'+
      '<br>3. ___________________________'+
    '</div>'+
    '<div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">'+
      '<div style="border-top:2px solid #1a1a1a;padding-top:8px;font-size:12px;">חתימת מנהל הפרויקט<br><br>_____________</div>'+
      '<div style="border-top:2px solid #1a1a1a;padding-top:8px;font-size:12px;">תאריך: '+timestamp+'<br><br>_____________</div>'+
    '</div>'+
    '<div style="margin-top:20px;font-size:10px;color:#aaa;text-align:center;">מסמך זה מהווה ראיה לביצוע ביקורת פנימית ונקיטת אמצעי זהירות</div>'+
    '</body></html>';

  var w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 500); }
  showToast('📄 מסמך הגנתי נפתח','success');
}

// ── COMPONENT 5: NEIGHBOR NOTIFICATION TEMPLATE ──────────────────────
async function sibNeighborNotice(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;

  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if (!apiKey) { showToast('אין מפתח API','error'); return; }

  var projName = (window.allProjects||[]).find(function(p){ return item&&p.id===item.project_id; });
  projName = projName ? projName.project_name : 'פרויקט';

  var resultEl = document.getElementById('sib-p2-result');
  if (resultEl) resultEl.innerHTML = '<div style="text-align:center;padding:20px;color:#1a3d5c;font-size:12px;">✉️ מנסח מכתב לשכנים...</div>';
  sibStartMeter('מכתב שכנים');

  var context = analysis ? analysis.text.substr(0,600) : (item ? (item.file_name||'') : '');

  var raw = await claudeFetch({
    _apiKey: apiKey,
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: 'אתה עורך דין המתמחה בדיני קבלנות. נסח מכתב רשמי בעברית.',
    messages:[{role:'user',content:
      'על בסיס ממצאי הבנייה הבאים:\n'+context+'\n\n'+
      'נסח מכתב רשמי לשכנים גובלים בפרויקט '+projName+'\n'+
      'כלול: הודעה על העבודות הצפויות, אמצעי ההגנה שננקטים, '+
      'פרטי איש קשר לתלונות, מסגרת זמן, '+
      'ואזכור שהעבודות מבוצעות לפי היתר ובהתאם לתקנות. '+
      'שמור על טון מכבד ומקצועי. כולל שורת נושא.'
    }]
  }, null);
  var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
  var letter = resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
  sibStopMeter(resp&&resp.usage);

  if (resultEl) resultEl.innerHTML =
    '<div style="background:#fff;border:2px solid #1a3d5c;border-radius:10px;padding:16px;margin-bottom:10px;">' +
      '<div style="font-size:13px;font-weight:800;color:#1a3d5c;margin-bottom:10px;">✉️ טיוטת מכתב לשכנים</div>' +
      '<textarea style="width:100%;min-height:280px;border:1px solid rgba(180,140,60,0.3);border-radius:8px;padding:10px;font-family:Arial,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;line-height:1.8;" id="tp-letter">'+sibEsc(letter)+'</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
        '<button onclick="navigator.clipboard.writeText(document.getElementById(\'tp-letter\').value).then(function(){showToast(\'הועתק\',\'success\')})" style="flex:1;padding:9px;background:#1a3d5c;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">📋 העתק</button>' +
        '<button onclick="sibPrintLetter()" style="padding:9px 14px;background:#f5e9c4;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🖨️ הדפס</button>' +
      '</div>' +
    '</div>';
}

function sibPrintLetter() {
  var el = document.getElementById('tp-letter');
  if (!el) return;
  var w = window.open('','_blank');
  if (w) {
    w.document.write('<html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;direction:rtl;padding:40px;font-size:14px;line-height:1.9;}</style></head><body>');
    w.document.write(el.value.replace(/\n/g,'<br>'));
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(function(){ w.print(); }, 300);
  }
}

// ── WIRE COMPONENTS INTO THIRD-PARTY REPORT ──────────────────────────
// Called after third-party report renders — adds action buttons
function sibAddTPActions(id) {
  var resultEl = document.getElementById('sib-p2-result');
  if (!resultEl) return;

  var actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'background:#fff7ed;border:2px solid #f97316;border-radius:10px;padding:14px;margin-top:10px;';
  actionsDiv.innerHTML =
    '<div style="font-size:12px;font-weight:800;color:#c2410c;margin-bottom:10px;">⚖️ כלי הגנה משפטית</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      '<button onclick="sibOpenEquipmentLog(\''+id+'\')" style="padding:9px;background:#c2410c;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">📋 רשום השאלת ציוד</button>' +
      '<button onclick="sibGenerateEvidenceDoc(\''+id+'\')" style="padding:9px;background:#1a3d5c;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">🛡️ מסמך הגנתי</button>' +
      '<button onclick="sibNeighborNotice(\''+id+'\')" style="padding:9px;background:#0f766e;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">✉️ מכתב לשכנים</button>' +
      '<button onclick="sibInsuranceGapModal(\''+id+'\')" style="padding:9px;background:#4527a0;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">🔍 פערי ביטוח</button>' +
    '</div>';

  resultEl.appendChild(actionsDiv);
}

async function sibInsuranceGapModal(id) {
  var analysis = _sibAnalysis[id];
  if (!analysis) { showToast('הפעל ניתוח צד שלישי תחילה','error'); return; }
  var resultEl = document.getElementById('sib-p2-result');
  if (resultEl) resultEl.innerHTML += '<div style="text-align:center;padding:16px;color:#4527a0;font-size:12px;">🔍 מנתח פערי ביטוח...</div>';
  sibStartMeter('ניתוח ביטוח');
  var gapText = await sibInsuranceGap(id, analysis.text);
  sibStopMeter();
  if (resultEl && gapText) {
    var d = document.createElement('div');
    d.style.cssText = 'background:#ede7f6;border:2px solid #9c6fdd;border-radius:10px;padding:14px;margin-top:8px;';
    d.innerHTML = '<div style="font-size:13px;font-weight:800;color:#4527a0;margin-bottom:8px;">🔍 פערי ביטוח שזוהו</div>' +
      '<div style="font-size:12px;color:#1a1a1a;line-height:1.8;white-space:pre-wrap;direction:rtl;">' + sibEsc(gapText) + '</div>';
    resultEl.appendChild(d);
  }
}
