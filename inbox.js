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

// ── AI MODULE SELECTOR HELPERS ────────────────────────────────────────
var _sibModuleDefaults = {
  'mod-safety':false,'mod-engineering':false,'mod-standards':false,
  'mod-thirdparty':false,'mod-financial':false,'mod-protocol':false,'mod-hazmat':false,'mod-packaging':false,'mod-laydown':false,'mod-traffic':false,
  'mod-ocr':false,'mod-equipment':false,'mod-neighbor':false,
  'mod-evidence':false,'mod-general':false
};
var _sibModules = Object.assign({}, _sibModuleDefaults);

function sibModuleChip(id, label, color, bg, border, defaultOn) {
  var on = false; // always start OFF — user must tick explicitly
  return '<label id="chip-'+id+'" onclick="sibToggleModule(\''+id+'\',this)" style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;'+
    'background:'+(on?bg:'#f5f5f5')+';border:2px solid '+(on?border:'#ddd')+';'+
    'border-radius:20px;padding:5px 12px;font-size:11px;font-weight:800;'+
    'color:'+(on?color:'#999')+';transition:all 0.15s;user-select:none;white-space:nowrap;">' +
    '<span id="chip-dot-'+id+'" style="font-size:12px;">'+(on?'✅':'⬜')+'</span>' +
    label +
    '</label>';
}

function sibToggleModule(id, labelEl) {
  _sibModules[id] = !_sibModules[id];
  var on = _sibModules[id];
  // Re-render chip by rebuilding its style
  var defaults = {
    'mod-safety':    {color:'#c62828',bg:'#fff5f5',border:'#fca5a5'},
    'mod-engineering':{color:'#1a3d5c',bg:'#e8f0fd',border:'#93c5fd'},
    'mod-standards': {color:'#4527a0',bg:'#ede7f6',border:'#9c6fdd'},
    'mod-thirdparty':{color:'#7c2d12',bg:'#fff7ed',border:'#fb923c'},
    'mod-financial': {color:'#1b5e20',bg:'#e8f5e9',border:'#a5d6a7'},
    'mod-protocol':  {color:'#7a5500',bg:'#fffde7',border:'#f59e0b'},
    'mod-hazmat':   {color:'#b71c1c',bg:'#fce4e4',border:'#ef9a9a'},
    'mod-packaging':{color:'#1565c0',bg:'#e3f2fd',border:'#90caf9'},
    'mod-laydown':  {color:'#4a148c',bg:'#f3e5f5',border:'#ce93d8'},
    'mod-traffic':  {color:'#e65100',bg:'#fff3e0',border:'#ffb74d'},
    'mod-ocr':       {color:'#0f766e',bg:'#f0fdfb',border:'#5eead4'},
    'mod-equipment': {color:'#92400e',bg:'#fef3c7',border:'#fcd34d'},
    'mod-neighbor':  {color:'#1e40af',bg:'#eff6ff',border:'#93c5fd'},
    'mod-evidence':  {color:'#374151',bg:'#f9fafb',border:'#9ca3af'},
    'mod-general':   {color:'#555',   bg:'#f5f5f5',border:'#ccc'},
  };
  var d = defaults[id] || {color:'#555',bg:'#f5f5f5',border:'#ccc'};
  if (labelEl) {
    labelEl.style.background = on ? d.bg : '#f5f5f5';
    labelEl.style.borderColor = on ? d.border : '#ddd';
    labelEl.style.color = on ? d.color : '#999';
    var dot = document.getElementById('chip-dot-'+id);
    if (dot) dot.textContent = on ? '✅' : '⬜';
  }
}

function sibToggleAllModules(on) {
  Object.keys(_sibModules).forEach(function(id) {
    _sibModules[id] = on;
    var chip = document.getElementById('chip-'+id);
    if (chip) sibToggleModule(id, chip);
  });
}

function sibIsModuleActive(id) {
  return !!_sibModules[id];
}

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

  // AI MODULE SELECTOR BOX
  '<div style="background:#fff;border-bottom:2px solid #c9a84c;padding:12px 20px;">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
      '<div style="font-size:11px;font-weight:900;color:#1a3d5c;letter-spacing:0.5px;">🎛️ מודולי AI פעילים — בחר מה ישתתף בניתוח:</div>' +
      '<button onclick="sibToggleAllModules(true)" style="background:#e8f5e9;border:1px solid #a5d6a7;color:#1b5e20;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">✓ הכל</button>' +
      '<button onclick="sibToggleAllModules(false)" style="background:#f5f5f5;border:1px solid #ccc;color:#888;border-radius:6px;padding:3px 10px;font-size:10px;cursor:pointer;font-family:Heebo,sans-serif;">✗ נקה</button>' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      // Safety
      sibModuleChip('mod-safety',    '⚠️ בטיחות',        '#c62828', '#fff5f5', '#fca5a5', false) +
      sibModuleChip('mod-engineering','🏗️ הנדסי',        '#1a3d5c', '#e8f0fd', '#93c5fd', false) +
      sibModuleChip('mod-standards',  '📋 תקנים 838',     '#4527a0', '#ede7f6', '#9c6fdd', false) +
      sibModuleChip('mod-thirdparty', '⚖️ צד שלישי',      '#7c2d12', '#fff7ed', '#fb923c', false) +
      sibModuleChip('mod-financial',  '💰 רווח/הפסד',     '#1b5e20', '#e8f5e9', '#a5d6a7', false) +
      sibModuleChip('mod-protocol',   '📝 פרוטוקול שיחה', '#7a5500', '#fffde7', '#f59e0b', false) +
      sibModuleChip('mod-hazmat',    '☣️ חומ"ס',          '#b71c1c', '#fce4e4', '#ef9a9a', false) +
      sibModuleChip('mod-packaging', '♻️ אריזות',         '#1565c0', '#e3f2fd', '#90caf9', false) +
      sibModuleChip('mod-laydown',  '🏗️ התארגנות',      '#4a148c', '#f3e5f5', '#ce93d8', false) +
      sibModuleChip('mod-traffic',  '🚛 תנועה וחניה',   '#e65100', '#fff3e0', '#ffb74d', false) +
      sibModuleChip('mod-ocr',        '📐 מדידות OCR',    '#0f766e', '#f0fdfb', '#5eead4', false) +
      sibModuleChip('mod-equipment',  '🔧 השאלת ציוד',    '#92400e', '#fef3c7', '#fcd34d', false) +
      sibModuleChip('mod-neighbor',   '✉️ מכתב שכנים',   '#1e40af', '#eff6ff', '#93c5fd', false) +
      sibModuleChip('mod-evidence',   '🛡️ מסמך הגנתי',   '#374151', '#f9fafb', '#9ca3af', false) +
      sibModuleChip('mod-general',    '📊 כללי',          '#555',    '#f5f5f5', '#ccc',    false) +
    '</div>' +
  '</div>' +

  // URL INPUT — TWO DEDICATED ROWS
  // Row 1: YouTube
  '<div style="background:#fce4e4;border-bottom:1px solid #fca5a5;padding:8px 20px;display:flex;gap:8px;align-items:center;">' +
    '<span style="font-size:11px;font-weight:800;color:#c62828;white-space:nowrap;">🎬 יוטיוב:</span>' +
    '<input id="sib-yt-input" type="text" placeholder="https://youtube.com/watch?v=... או /shorts/..." style="flex:1;border:1px solid rgba(198,40,40,0.3);border-radius:8px;padding:7px 12px;font-family:Heebo,sans-serif;font-size:12px;direction:ltr;background:#fff;">' +
    '<button onclick="sibAddYT()" style="background:#dc2626;border:none;color:#fff;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">➕ נתח</button>' +
  '</div>' +
  // Row 2: Website
  '<div style="background:#e8f0fd;border-bottom:1px solid #c3d4f0;padding:8px 20px;display:flex;gap:8px;align-items:center;">' +
    '<span style="font-size:11px;font-weight:800;color:#1a3d5c;white-space:nowrap;">🌐 אתר אינטרנט:</span>' +
    '<input id="sib-url-input" type="text" placeholder="https://www.topcret.com או כל אתר בנייה/ספק..." style="flex:1;border:1px solid rgba(26,61,92,0.3);border-radius:8px;padding:7px 12px;font-family:Heebo,sans-serif;font-size:12px;direction:ltr;background:#fff;">' +
    '<button onclick="sibAddUrl()" style="background:#1a3d5c;border:none;color:#fff;border-radius:8px;padding:7px 14px;font-size:11px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">➕ סרוק</button>' +
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
  // Clear stale selections on every reload
  _sibSelSet = {};
  sibUpdateBatchBar();
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
    btns += sibBtn('🔴 חלץ גבהים','sibPhase1Gavoim(\''+id+'\')','laser');
  } else if (type==='video') {
    var isCloudVid = !!(item.cloudinary_url && item.cloudinary_url.includes('cloudinary.com'));
    btns += sibBtn('▶ נגן','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('🎙 תמלל','sibTranscribe(\''+id+'\')','phase1');
    if(isCloudVid) btns += sibBtn('🎞 פריים','sibExtractFrame(\''+id+'\')','sec');
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
  } else if (type==='youtube') {
    btns += sibBtn('🎬 נתח סרטון','sibPhase1Url(\''+id+'\')','phase1');
    btns += sibBtn('📺 פתח','sibPlayMedia(\''+id+'\')','sec');
  } else if (type==='url') {
    btns += sibBtn('🌐 חלץ תוכן','sibPhase1Url(\''+id+'\')','phase1');
    btns += sibBtn('🔗 פתח','sibPlayMedia(\''+id+'\')','sec');
  } else {
    btns += sibBtn('👁 צפה','sibPlayMedia(\''+id+'\')','sec');
    btns += sibBtn('📋 חלץ','sibPhase1Doc(\''+id+'\')','phase1');
  }

  // Phase 2 — only if phase 1 done
  if (hasP1) {
    btns += sibBtn('🚀 שלב 2: נתח','sibShowPhase2Panel(\''+id+'\')','phase2');
  }

  // Approve button — smart guard
  var hasAnalysis = !!(_sibAnalysis[id] || _sibPhase1[id]);
  if(hasAnalysis){
    btns += sibBtn('✅ אשר + שמור דוח','sibApproveWithReport(\''+id+'\')','approve');
  } else {
    btns += sibBtn('✅ אשר ללא ניתוח','sibApprove(\''+id+'\')','approve-grey');
  }
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
    'approve-grey': 'background:#f5f5f5;color:#999;border:1px solid #ddd;',
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


// ── PHASE 1: GAVOIM — Laser leveling sheet OCR ───────────────────────
async function sibPhase1Gavoim(id) {
  var item = _sibItems.find(function(i){return i.id===id;});
  if (!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) {
    panel.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#ef4444;font-size:13px;">🔴 Claude מנתח גיליון מדידת גבהים...</div>';
    sibStartMeter('חילוץ מדידות גבהים');
  }

  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if (!apiKey) {
    try {
      var cfg = await sbQ('app_config','select=key,value');
      var row = (cfg.data||[]).find(function(r){ return r.key==='anthropic_key'; });
      if (row) { apiKey = row.value; _sibApiKey = row.value; }
    } catch(e) {}
  }
  if (!apiKey) { sibStopMeter(); sibShowError('אין מפתח API'); return; }

  try {
    var raw = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: [
        'אתה מומחה מדידות בנייה ישראלי.',
        'אתה מנתח גיליונות מדידת גבהים לייזר הכתובים ביד.',
        'חלץ את כל הנקודות: שם נקודה, קואורדינטות X ו-Y, קריאת לייזר.',
        'גם אם הכתב קשה לקריאה — נסה לזהות ערכים מספריים.',
        'החזר JSON בלבד, ללא טקסט נוסף.'
      ].join(' '),
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'url',
              url: item.cloudinary_url
            }
          },
          {
            type: 'text',
            text: [
              'זהו גיליון מדידת גבהים לייזר מאתר בנייה.',
              'חלץ את כל הנקודות הרשומות בגיליון.',
              '',
              'החזר JSON בפורמט הבא בלבד:',
              '{',
              '  "room": "שם החדר / האזור",',
              '  "date": "תאריך המדידה",',
              '  "benchmark": {"value": 0.000, "note": "תיאור נקודת הייחוס"},',
              '  "points": [',
              '    {"name": "P1", "x": 0, "y": 0, "reading": 1.450, "notes": ""}',
              '  ]',
              '}',
              '',
              'אם שדה לא קריא — השתמש ב-null.',
              'אם אין קואורדינטות — שים 0.',
              'החזר JSON בלבד ללא הסברים.'
            ].join('\n')
          }
        ]
      }]
    }, null);

    var resp = raw && typeof raw.json === 'function' ? await raw.json() : raw;
    var txt  = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
    sibStopMeter(resp && resp.usage);

    // Parse JSON
    var parsed = null;
    try {
      parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    } catch(e) {
      sibShowError('לא הצלחנו לחלץ נקודות — נסה שוב עם תמונה ברורה יותר');
      return;
    }

    var pts = parsed.points || [];
    if (!pts.length) {
      sibShowError('לא זוהו נקודות מדידה בגיליון');
      return;
    }

    // Store as phase1
    _sibPhase1[id] = 'מדידת גבהים OCR:\n\n' + JSON.stringify(parsed, null, 2);
    sibRefreshCard(id);

    // Show preview + route to gavoim
    if (panel) {
      var projSel = document.getElementById('sib-proj-sel-'+id);
      var projectId = projSel ? projSel.value : (item.project_id||null);
      var proj = projectId ? (window.allProjects||[]).find(function(p){return p.id===projectId;}) : null;

      panel.innerHTML =
        '<div style="background:#fff5f5;border:1.5px solid #ef4444;border-radius:10px;padding:14px;margin-bottom:10px;direction:rtl;">' +
          '<div style="font-size:13px;font-weight:900;color:#c62828;margin-bottom:10px;">🔴 חולץ '+pts.length+' נקודות מדידה</div>' +
          '<div style="font-size:12px;color:#555;margin-bottom:8px;">' +
            (parsed.room ? '📍 חדר: <b>'+gvEsc(parsed.room)+'</b><br>' : '') +
            (parsed.date ? '📅 תאריך: '+gvEsc(parsed.date)+'<br>' : '') +
            (parsed.benchmark&&parsed.benchmark.value ? '📏 BM: <b>'+parsed.benchmark.value+'</b> מ׳<br>' : '') +
          '</div>' +
          '<div style="max-height:160px;overflow-y:auto;margin-bottom:12px;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
              '<tr style="background:#fff0f0;"><th style="padding:5px;text-align:right;">נקודה</th><th style="padding:5px;">X</th><th style="padding:5px;">Y</th><th style="padding:5px;color:#c9a84c;">קריאה</th></tr>' +
              pts.slice(0,10).map(function(p){
                return '<tr style="border-bottom:1px solid #fee;"><td style="padding:4px 6px;">'+gvEsc(p.name||'')+'</td><td style="padding:4px;text-align:center;">'+(p.x||0)+'</td><td style="padding:4px;text-align:center;">'+(p.y||0)+'</td><td style="padding:4px;text-align:center;font-weight:700;">'+(p.reading||'—')+'</td></tr>';
              }).join('') +
              (pts.length>10?'<tr><td colspan="4" style="padding:4px;text-align:center;color:#888;">...ועוד '+(pts.length-10)+' נקודות</td></tr>':'') +
            '</table>' +
          '</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="sibRouteToGavoim(this)" data-id="'+id+'" data-pts="'+encodeURIComponent(JSON.stringify(parsed))+'" '+
              'style="flex:1;padding:11px;background:#ef4444;border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🔴 פתח במודול גבהים + 3D</button>' +
          '</div>' +
        '</div>' +
        sibApprovePanel(item);
    }

  } catch(e) {
    sibStopMeter();
    sibShowError('שגיאת OCR: ' + e.message);
  }
}

function gvEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── ROUTE OCR RESULT TO GAVOIM MODULE ─────────────────────────────────
function sibRouteToGavoim(btn) {
  var id = btn ? btn.getAttribute("data-id") : null;
  var parsedJson = btn ? decodeURIComponent(btn.getAttribute("data-pts")||"{}") : "{}";
  var parsed;
  try { parsed = JSON.parse(parsedJson); } catch(e) { return; }

  var item = _sibItems.find(function(i){return i.id===id;});
  var projectId = item ? item.project_id : null;

  // Switch to takeoff tab → gavoim
  if (typeof switchTab === 'function') switchTab('takeoff');
  setTimeout(function(){
    if (typeof gvTabClicked === 'function') gvTabClicked();
    setTimeout(function(){
      if (typeof gvRenderModeC === 'function') {
        window._gvPoints = parsed.points || [];
        window._gvMode   = 'c';
        var area = document.getElementById('gv-form-area');
        if (area) {
          gvRenderModeC(area, parsed.points, parsed.benchmark);
          // Pre-fill project
          var projSel = document.getElementById('gv-c-proj');
          if (projSel && projectId) projSel.value = projectId;
          var roomInp = document.getElementById('gv-c-room');
          if (roomInp && parsed.room) roomInp.value = parsed.room;
          var bmInp = document.getElementById('gv-c-bm');
          if (bmInp && parsed.benchmark && parsed.benchmark.value) bmInp.value = parsed.benchmark.value;
          // Auto-calculate
          setTimeout(function(){
            if (typeof gvCalculateAndReport === 'function') gvCalculateAndReport();
          }, 200);
        }
      }
    }, 300);
  }, 400);
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
  var isVid = (item.file_type==='video');

  function showStatus(msg) {
    if (panel) panel.innerHTML='<div style="text-align:center;padding:40px 20px 10px;color:#1b7a4a;font-size:13px;">'+msg+'</div>';
  }
  showStatus(isVid ? '🎙️ מחלץ אודיו מהוידאו ומתמלל...' : '🎙️ מתמלל הקלטה...');
  sibStartMeter('תמלול — '+(item.file_name||id).substr(0,25));

  if(!item.cloudinary_url){sibStopMeter();sibShowError('אין URL לקובץ');return;}

  // ── STEP 1: TRY ELEVENLABS TRANSCRIPTION ────────────────────────
  var transcript = '';
  var transcriptOk = false;
  var elevenlabsKey = null;
  try {
    if(window.APP&&window.APP.config&&window.APP.config.elevenlabs_key) { elevenlabsKey=window.APP.config.elevenlabs_key; }
    else { var cfg=await sbQ('app_config','select=key,value'); var row=(cfg.data||[]).find(function(r){return r.key==='elevenlabs_key';}); if(row) elevenlabsKey=row.value; }
  } catch(e){}

  if(elevenlabsKey) {
    try {
      var audioResp = await fetch(item.cloudinary_url);
      var audioBlob = await audioResp.blob();
      var fileName  = item.file_name||'audio.m4a';
      var mimeType  = audioBlob.type;
      if(!mimeType||mimeType==='application/octet-stream'||mimeType==='video/3gpp'||mimeType==='video/mp4'){
        var ext2 = fileName.split('.').pop().toLowerCase();
        var mimeMap = {m4a:'audio/mp4',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',aac:'audio/aac','3gp':'audio/3gpp',flac:'audio/flac',mp4:'audio/mp4'};
        mimeType = mimeMap[ext2]||'audio/mp4';
      }
      if(fileName.toLowerCase().endsWith('.mp4')) fileName=fileName.replace(/\.mp4$/i,'.m4a');
      var fixedBlob = new Blob([audioBlob],{type:mimeType});
      var formData  = new FormData();
      formData.append('file',fixedBlob,fileName);
      formData.append('model_id','scribe_v1');
      formData.append('language_code','he');
      formData.append('diarize','true');
      formData.append('tag_audio_events','false');
      formData.append('timestamps_granularity','none');
      var transcResp = await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':elevenlabsKey},body:formData});
      if(transcResp.ok) {
        var transcData = await transcResp.json();
        transcript = transcData.text||'';
        if(!transcript&&transcData.words&&transcData.words.length) {
          transcript = transcData.words.map(function(w){
            return w.type==='spacing'?'':(w.speaker_id?'[דובר '+w.speaker_id+'] ':'')+w.text;
          }).join(' ').replace(/\s+/g,' ').trim();
        }
        if(transcript && transcript.length > 5) transcriptOk = true;
      }
    } catch(te){ /* ElevenLabs failed — will try visual fallback */ }
  }

  // ── STEP 2: IF NO AUDIO / EMPTY TRANSCRIPT — TRY VISUAL FRAME ───
  if(!transcriptOk && isVid) {
    showStatus('🔇 אין אודיו — מחלץ פריים ויזואלי...');
    var frameDataUrl = await sibExtractFrameCanvas(item.cloudinary_url);
    if(frameDataUrl) {
      // Send frame to Claude Vision for description
      var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
      if(apiKey) {
        showStatus('🖼️ Claude מנתח פריים ויזואלי...');
        try {
          var base64data = frameDataUrl.split(',')[1];
          var mtype = 'image/jpeg';
          var raw = await claudeFetch({
            _apiKey: apiKey,
            model: 'claude-sonnet-4-20250514',
            max_tokens: 800,
            system: 'אתה מהנדס שטח. תאר בעברית מה שאתה רואה בצילום מסגרת מוידאו באתר בנייה.',
            messages:[{role:'user',content:[
              {type:'image',source:{type:'base64',media_type:mtype,data:base64data}},
              {type:'text',text:'תאר את מה שאתה רואה בפריים זה מהוידאו: '+sibEsc(item.file_name||'')+'. פרט כל אלמנט נראה.'}
            ]}]
          }, null);
          var resp = raw&&typeof raw.json==='function'?await raw.json():raw;
          var desc = resp&&resp.content&&resp.content[0]?resp.content[0].text:'';
          if(desc) {
            transcript = '[וידאו ללא אודיו — תיאור ויזואלי]\n\n' + desc;
            transcriptOk = true;
          }
        } catch(ve){}
      }
    }
  }

  // ── STEP 3: FINAL RESULT ──────────────────────────────────────────
  sibStopMeter({input_tokens:0,output_tokens:Math.ceil((transcript||'').length/4)});

  if(!transcriptOk && !transcript) {
    // Both failed — store minimal context and let user type manually
    transcript = '[לא זוהה תוכן אוטומטי — הכנס תיאור ידני]';
    if(panel) {
      panel.innerHTML +=
        '<div style="background:#fff7ed;border:1px solid #fb923c;border-radius:8px;padding:12px;margin:10px;font-size:12px;color:#7c2d12;">' +
          '⚠️ לא זוהה אודיו ולא הצלחנו לחלץ פריים.<br>' +
          'הכנס תיאור ידני בתיבת הטקסט שתיפתח.' +
        '</div>';
    }
  }

  _sibPhase1[id] = transcript;
  sibRefreshCard(id);
  sibShowPhase2Panel(id);
}

// ── CANVAS FRAME EXTRACTOR (works for any video URL) ─────────────────
async function sibExtractFrameCanvas(videoUrl) {
  return new Promise(function(resolve) {
    try {
      var video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.muted = true;
      var timeout = setTimeout(function(){ resolve(null); }, 12000);

      video.onloadeddata = function() {
        video.currentTime = Math.min(2, video.duration * 0.1 || 2);
      };

      video.onseeked = function() {
        try {
          var canvas = document.createElement('canvas');
          canvas.width  = Math.min(video.videoWidth,  1280);
          canvas.height = Math.min(video.videoHeight, 720);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          clearTimeout(timeout);
          video.src = '';
          resolve(dataUrl.length > 1000 ? dataUrl : null);
        } catch(ce){ clearTimeout(timeout); resolve(null); }
      };

      video.onerror = function(){ clearTimeout(timeout); resolve(null); };
      video.src = videoUrl;
      video.load();
    } catch(e){ resolve(null); }
  });
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
  // Build directions from active modules only
  var allDirections = [
    {id:'safety',      mod:'mod-safety',      label:'⚠️ בטיחות',        color:'#c62828', bg:'#fff5f5', border:'#fca5a5'},
    {id:'engineering', mod:'mod-engineering', label:'🏗️ הנדסי',         color:'#1a3d5c', bg:'#e8f0fd', border:'#93c5fd'},
    {id:'standards',   mod:'mod-standards',   label:'📋 תקנים 838',      color:'#4527a0', bg:'#ede7f6', border:'#9c6fdd'},
    {id:'thirdparty',  mod:'mod-thirdparty',  label:'⚖️ צד שלישי',       color:'#7c2d12', bg:'#fff7ed', border:'#fb923c'},
    {id:'financial',   mod:'mod-financial',   label:'💰 רווח/הפסד',      color:'#1b5e20', bg:'#e8f5e9', border:'#a5d6a7'},
    {id:'protocol',    mod:'mod-protocol',    label:'📝 פרוטוקול',        color:'#7a5500', bg:'#fffde7', border:'#f59e0b'},
    {id:'ocr',         mod:'mod-ocr',         label:'📐 מדידות OCR',      color:'#0f766e', bg:'#f0fdfb', border:'#5eead4'},
    {id:'equipment',   mod:'mod-equipment',   label:'🔧 השאלת ציוד',      color:'#92400e', bg:'#fef3c7', border:'#fcd34d'},
    {id:'general',     mod:'mod-general',     label:'📊 כללי',            color:'#555',    bg:'#f5f5f5', border:'#ccc'},
    {id:'hazmat',      mod:'mod-hazmat',      label:'☣️ חומ"ס',           color:'#b71c1c', bg:'#fce4e4', border:'#ef9a9a'},
    {id:'packaging',   mod:'mod-packaging',   label:'♻️ אריזות',          color:'#1565c0', bg:'#e3f2fd', border:'#90caf9'},
    {id:'laydown',     mod:'mod-laydown',     label:'🏗️ התארגנות',        color:'#4a148c', bg:'#f3e5f5', border:'#ce93d8'},
    {id:'traffic',     mod:'mod-traffic',     label:'🚛 תנועה וחניה',      color:'#e65100', bg:'#fff3e0', border:'#ffb74d'},
  ];
  // Show ONLY ticked modules — no forced defaults
  var directions = allDirections.filter(function(d){
    return sibIsModuleActive(d.mod);
  });
  // If no modules ticked — show hint inside the panel but still show Phase 1 textarea
  var noModulesHint = directions.length === 0
    ? '<div style="background:#fffbf0;border:2px dashed #c9a84c;border-radius:10px;padding:12px;text-align:center;margin-bottom:10px;">' +
        '<div style="font-size:20px;margin-bottom:4px;">🎛️</div>' +
        '<div style="font-size:12px;font-weight:700;color:#9a6f00;">בחר מודול בסרגל למעלה להפעלת ניתוח</div>' +
      '</div>'
    : '';

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
      noModulesHint +
      '<div style="font-size:11px;font-weight:800;color:#1a3d5c;margin-bottom:10px;">🚀 שלב 2 — כיוון ניתוח</div>' +
      (directions.length > 0 ? '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+dirBtns+'</div>' : '') +
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
  if(!apiKey){sibShowError('אין מפתח Claude — פנה למנהל המערכת');return;}

  // Get edited phase 1 text
  var p1el = document.getElementById('sib-p1-edit-'+id);
  var p1text = p1el?p1el.value:(_sibPhase1[id]||'');
  var isCloudinaryVid = (item.file_type==='video') && item.cloudinary_url && item.cloudinary_url.includes('cloudinary.com');
  var isVideoVisual = isCloudinaryVid && (direction==='safety'||direction==='engineering'||direction==='general'||direction==='thirdparty'||direction==='hazmat'||direction==='packaging'||direction==='laydown'||direction==='traffic');
  // For Cloudinary videos — frame analysis works without transcript
  // For direct uploads — must have transcript from Phase 1
  if(!p1text && !isVideoVisual){
    // Ensure panel is showing Phase 2 UI first
    if(!document.getElementById('sib-p2-result')) sibShowPhase2Panel(id);
    sibShowError('הפעל שלב 1 תחילה לחילוץ תוכן');
    return;
  }
  if(!p1text) p1text = '(ניתוח ויזואלי של וידאו — ללא תמלול)';

  // Ensure sib-p2-result exists — create if needed
  var resultEl = document.getElementById('sib-p2-result');
  if(!resultEl) {
    sibShowPhase2Panel(id);
    resultEl = document.getElementById('sib-p2-result');
  }

  if(resultEl){
    resultEl.innerHTML='<div style="text-align:center;padding:30px;color:#1a3d5c;font-size:13px;">🧠 Claude מנתח...</div>';
    sibStartMeter('ניתוח '+direction+' — '+(item.file_name||id).substr(0,20));
  }

  // For video + visual directions (safety/engineering) — use frame image, not transcript
  var isVideo = (item.file_type==='video');
  var isVisualDirection = (direction==='safety'||direction==='engineering'||direction==='general'||direction==='thirdparty'||direction==='hazmat'||direction==='packaging'||direction==='laydown'||direction==='traffic');
  // Frame analysis ONLY for Cloudinary-hosted videos (Beni mobile via Cloudinary)
  // Direct uploads from PC/Android to Supabase storage — use transcript only
  var isCloudinaryVideo = isVideo && item.cloudinary_url && item.cloudinary_url.includes('cloudinary.com');
  var useImageAnalysis = isCloudinaryVideo && isVisualDirection;
  var frameUrl = null;
  if(useImageAnalysis) {
    frameUrl = item.cloudinary_url
      .replace('/upload/','/upload/so_2,w_1200,f_jpg/')
      .replace(/\.(mp4|mov|avi|webm|3gp)$/i,'.jpg');
  }

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
  else if(direction==='hazmat'){
    reportTitle = '☣️ דוח חומרים מסוכנים';
    systemPrompt = [
      'אתה מומחה לחומרים מסוכנים (חומ"ס) ובטיחות סביבתית בישראל.',
      'אתה בודק עמידה ב-15 תקנות חומ"ס ישראליות.',
      'לכל ממצא ציין: נושא, דרישה, תקנה רלוונטית, סיכון לאי-עמידה, ועדיפות (CRITICAL/HIGH/MEDIUM).',
      'החזר דוח מובנה בעברית עם פירוט ברור של מה תקין ומה מצריך תיקון.'
    ].join(' ');
    userPrompt = p1text + '\n\n---\n' +
      'בדוק עמידה בתקנות חומ"ס ישראליות הבאות:\n\n' +
      '1. אחסון רעלים — מאצרות תקניות 110% מהכלי הגדול (תקנות חומרים מסוכנים)\n' +
      '2. הפרדת חומרים — מחמצנים/דליקים/בסיסים (המשרד להגנת הסביבה)\n' +
      '3. שילוט וסימון — מדבקות שם/UN/סיכונים (חוק חומרים מסוכנים)\n' +
      '4. גיליונות MSDS — עברית, בקרבת מקום האחסון (תקנות בטיחות בעבודה)\n' +
      '5. ציוד ספיגה — Spill Kit: חול/סופגים/כפפות/שקיות פינוי (המשרד להגנת הסביבה)\n' +
      '6. פינוי פסולת — מוביל מורשה לרמת חובב בלבד (תקנות חומרים מסוכנים)\n' +
      '7. מיכלי דלק סולר — דופן כפולה או מאצרה מקורה (תקנות המים)\n' +
      '8. ניהול מלאי — פנקס רעלים עם כניסות/יציאות/יתרות (תנאי היתר רעלים)\n' +
      '9. הדרכת עובדים — הדרכה תקופתית עם חתימה (תקנות בטיחות בעבודה)\n' +
      '10. מניעת נגר מזוהם — איסור שטיפה לניקוז עירוני (חוק המים)\n' +
      '11. נעילה ואבטחה — מחסן חומ"ס נעול ומוגן (תנאי היתר רעלים)\n' +
      '12. איוורור — מניעת הצטברות אדים רעילים (תקנות גיהות תעסוקתית)\n' +
      '13. איטום משטחי — עבודה על בטון אטום, לא אדמה חשופה (הנחיות זיהום קרקע)\n' +
      '14. כיבוי אש — מטפי אבקה/CO2 לפי הנחיות כב"א (חוק הרשות לכבאות)\n' +
      '15. דוח אירוע חריג — דיווח מיידי למוקד סביבה על דליפה (חוק חומרים מסוכנים)\n\n' +
      'לכל נושא שנראה בתמונה/מסמך, פרט:\n' +
      '✅ עומד בתקן — מה נראה תקין\n' +
      '🔴 CRITICAL — ליקוי קריטי — סיכון פלילי/כספי מיידי\n' +
      '🟠 HIGH — ליקוי חשוב — טיפול תוך 48 שעות\n' +
      '🟡 MEDIUM — המלצה לשיפור\n' +
      'לא נראה בתמונה — ציין "לא נבדק"\n\n' +
      'סיים עם:\n' +
      '## סיכום סיכונים\n' +
      '## פעולות מיידיות נדרשות\n' +
      '## המלצות לטווח ארוך';
  }
    else if(direction==='packaging'){
    reportTitle = '♻️ דוח ניהול אריזות';
    systemPrompt = [
      'אתה מומחה לניהול פסולת אריזות באתרי בנייה בישראל.',
      'אתה בודק עמידה בחוק האריזות 2011 ותקנות הניקיון הישראליות.',
      'לכל סוג אריזה ציין: האם מאוחסנת נכון, היכן לפנות, בסיס חוקי וסיכון לאי-עמידה.'
    ].join(' ');
    userPrompt = p1text + '\n\n---\n' +
      'בדוק עמידה בתקנות ניהול אריזות ופסולת אריזות בישראל:\n\n' +
      '1. קרטון ואריזות נייר — הפרדה במקור, קיפול ודחיסה, מכל ייעודי סגור\n' +
      '   פינוי: תאגיד "תמיר" או קבלן מחזור מורשה | חוק האריזות 2011\n\n' +
      '2. אריזות פלסטיק (ניילון/שרינק) — הפרדה מוחלטת מפסולת רטובה, Big-Bags\n' +
      '   אחסון: ללא מגע עם קרקע חשופה | פינוי: מפעלי מחזור מאושרים (סיקלה)\n\n' +
      '3. מכלי פלסטיק קשיח (גריקנים) — ריקון מלא שאריות, אם חומ"ס — לרמת חובב\n' +
      '   אחסון: על משטחים, לא למכולה רגילה | תקנות חומרים מסוכנים\n\n' +
      '4. אריזות עץ (משטחים) — שימוש חוזר/החזרה לספק, איסור מוחלט שריפה באתר\n' +
      '   אחסון: ערמה מסודרת | פינוי: מתקני גריסת עץ | חוק מניעת מפגעים\n\n' +
      '5. אריזות מתכת (פחי צבע/דבקים) — ייבוש שאריות צבע לפני פינוי\n' +
      '   פינוי: תחנות איסוף גרוטאות מורשות | חוק האריזות\n\n' +
      '6. תיעוד ורישום — שמירת אישורי פינוי 7 שנים, ניהול יומן פינוי פסולת\n' +
      '   תקנות שמירת הניקיון\n\n' +
      'לכל סוג אריזה הנראה בתמונה/מסמך:\n' +
      '✅ תקין — מה נראה תקין\n' +
      '🔴 CRITICAL — פינוי לא חוקי, סיכון קנסות עד 200,000 ש"ח\n' +
      '🟠 HIGH — ליקוי חשוב לתיקון מיידי\n' +
      '🟡 MEDIUM — המלצה לשיפור\n\n' +
      'סיים עם:\n## סיכום ממצאים\n## פעולות מיידיות\n## קישורים: תמיר: https://www.tmir.org.il/business/centers';
  }
  else if(direction==='laydown'){
    reportTitle = '🏗️ דוח תקני אזור התארגנות';
    systemPrompt = [
      'אתה מומחה בטיחות ומפקח אתרי בנייה ישראלי.',
      'אתה בודק עמידה ב-8 תקנות אזור ההתארגנות (Laydown Area) באתרי בנייה.',
      'בדוק כל תקנה, ציין ממצא, רמת חומרה וצעדי תיקון נדרשים.',
      'החזר דוח מובנה בעברית.'
    ].join(' ');
    userPrompt = p1text + '\n\n---\n' +
      'בדוק עמידה ב-8 תקנות אזור ההתארגנות והאחסון באתר בנייה:\n\n' +
      'L01 — תוכנית התארגנות (CRITICAL)\n' +
      'חובת תוכנית ארגון בטיחותי חתומה ע"י מנהל עבודה ומבצע בנייה\n' +
      'תקנות הבטיחות בעבודה סעיף 166\n\n' +
      'L02 — גידור היקפי (HIGH)\n' +
      'גידור קשיח בגובה 2 מטר לפחות למניעת כניסת בלתי מורשים\n' +
      'פקודת הבטיחות בעבודה\n\n' +
      'L03 — משטחי אחסון (HIGH)\n' +
      'אחסון חומרים על משטחים יציבים ומפולסים למניעת קריסה\n' +
      'תקנות הבטיחות (עבודות בנייה)\n\n' +
      'L04 — תאורת לילה (MEDIUM)\n' +
      'תאורה מספקת באזורי פריקה, טעינה ואחסון\n' +
      'הנחיות מפקח עבודה ראשי\n\n' +
      'L05 — הפרדת חומרים (CRITICAL)\n' +
      'הפרדה פיזית בין חומרי גלם, פסולת בנייה וחומרים מסוכנים\n' +
      'חוק חומרים מסוכנים\n\n' +
      'L06 — שילוט אזהרה (HIGH)\n' +
      'שלטי "אין כניסה לזרים" ושלטי זיהוי חומרים בעברית ובערבית\n' +
      'תקנות הבטיחות בעבודה\n\n' +
      'L07 — גישה לציוד כיבוי (CRITICAL)\n' +
      'מעברים פנויים ברוחב 4 מטר לפחות לרכב חירום\n' +
      'הוראות כבאות והצלה\n\n' +
      'L08 — שמירה ואבטחה (MEDIUM)\n' +
      'נעילת מחסנים וגידור כלי עבודה יקרים בסוף יום עבודה\n' +
      'נהלי אתר / דרישות ביטוח\n\n' +
      'לכל סעיף שנראה בתמונה/מסמך:\n' +
      '✅ עומד בתקן\n' +
      '🔴 CRITICAL — ליקוי קריטי, צו הפסקת עבודה אפשרי\n' +
      '🟠 HIGH — ליקוי חשוב, תיקון תוך 24 שעות\n' +
      '🟡 MEDIUM — המלצה לשיפור\n' +
      'לא נראה — "לא נבדק"\n\n' +
      'סיים עם:\n## סיכום ממצאים\n## פעולות מיידיות נדרשות\n## סיכון משפטי';
  }
  else if(direction==='traffic'){
    reportTitle = '🚛 דוח תנועה וחניה באתר';
    systemPrompt = [
      'אתה מומחה בטיחות ומפקח תנועה באתרי בנייה ישראלי.',
      'אתה בודק עמידה ב-8 תקנות תנועה וחניה לפי תקנות הבטיחות בעבודה (עבודות בנייה) 1988.',
      'בדוק כל רכב/מצב הנראה, ציין ממצא ורמת חומרה.',
      'החזר דוח מובנה בעברית.'
    ].join(' ');
    userPrompt = p1text + '\n\n---\n' +
      'בדוק עמידה ב-8 תקנות תנועה וחניה באתר בנייה:\n\n' +
      'V01 — הגבלת מהירות\n' +
      'מקסימום 15-20 קמ"ש בתוך האתר | עילה להרחקה מהאתר\n\n' +
      'V02 — הפרדת תנועה (CRITICAL)\n' +
      'הפרדה מוחלטת הולכי רגל מרכב כבד/צמ"ה | חובה לפי תוכנית ארגון\n\n' +
      'V03 — חניית רכב פרטי\n' +
      'איסור חניה בשטח העבודה — רק באזור חניה מוגדר | גרירה ע"י הקבלן\n\n' +
      'V04 — נסיעה לאחור (CRITICAL)\n' +
      'חובת אותת + צופר נסיעה לאחור פועל בכל רכב מסחרי/צמ"ה\n\n' +
      'V05 — פריקה וטעינה\n' +
      'פריקה בתיאום מנהל עבודה + אזור פריקה מאושר | ללא חסימת חירום\n\n' +
      'V06 — PPE ליוצאי רכב\n' +
      'כל נהג היוצא מרכב — קסדה ונעלי בטיחות מיידית | חובת מנהל עבודה\n\n' +
      'V07 — חניית לילה\n' +
      'איסור מפתחות ברכב + בלם יד + ציוד נעילה | נהלי אבטחה\n\n' +
      'V08 — מניעת מפגעי אבק\n' +
      'נסיעה בדרכי גישה סלולות או מורטבות בלבד | הנחיות איכות סביבה\n\n' +
      'לכל מצב הנראה בתמונה/מסמך:\n' +
      '✅ תקין\n' +
      '🔴 CRITICAL — סכנת חיים מיידית, עצירת עבודה\n' +
      '🟠 HIGH — ליקוי חשוב, תיקון תוך 24 שעות\n' +
      '🟡 MEDIUM — המלצה\n' +
      'לא נראה — "לא נבדק"\n\n' +
      'סיים עם:\n## סיכום ממצאים\n## פעולות מיידיות\n## המלצות לשיפור';
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

  // Special module actions that don't go to claudeFetch
  if(direction==='ocr'){
    sibStopMeter();
    sibOpenMeasurements(id);
    return;
  }
  if(direction==='equipment'){
    sibStopMeter();
    sibOpenEquipmentLog(id);
    return;
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

    // For video + visual analysis — try frame image, fall back to text-only
    var messages;
    if(useImageAnalysis && frameUrl) {
      var frameOk = false;
      try {
        var testRes = await fetch(frameUrl, {method:'HEAD', signal:AbortSignal.timeout(4000)});
        frameOk = testRes.ok;
      } catch(fe) { frameOk = false; }

      if(frameOk) {
        if(resultEl) resultEl.innerHTML='<div style="text-align:center;padding:20px;color:#1a3d5c;font-size:12px;">🖼️ מנתח פריים מהוידאו...</div>';
        messages = [{role:'user', content:[
          {type:'image', source:{type:'url', url:frameUrl}},
          {type:'text', text: userPrompt + '\n\n(ניתוח ויזואלי: ' + sibEsc(item.file_name||'') + ')'}
        ]}];
      } else {
        if(resultEl) resultEl.innerHTML='<div style="text-align:center;padding:20px;color:#7a5500;font-size:12px;">🎥 מנתח על בסיס שם הקובץ...</div>';
        var videoNote = '\n\n[קובץ וידאו: ' + sibEsc(item.file_name||'') + ']';
        messages = [{role:'user', content: userPrompt + videoNote}];
      }
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
    // Row 1: Save actions
    '<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">' +
      '<button onclick="sibCopyReport(\''+id+'\')" style="flex:1;padding:8px;background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#7a8a95;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">📋 העתק</button>' +
      '<button onclick="sibSaveAnalysisAsNote(\''+id+'\')" style="flex:1;padding:8px;background:#f5e9c4;border:1px solid rgba(180,140,60,0.4);color:#9a6f00;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">💾 יומן</button>' +
      '<button onclick="sibSaveToEnc(\''+id+'\')" style="flex:1;padding:8px;background:#ede7f6;border:1px solid #9c6fdd;color:#4527a0;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">📚 אנציקלופדיה</button>' +
      '<button onclick="sibPrintReport(\''+id+'\')" style="flex:1;padding:8px;background:#e8f0fd;border:1px solid #93c5fd;color:#1a3d5c;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">🖨️ הדפס</button>' +
    '</div>' +
    // Row 2: Share actions
    '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<button onclick="sibEmailReport(\''+id+'\')" style="flex:1;padding:8px;background:#fff;border:1px solid #fca5a5;color:#c62828;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">✉️ מייל + קובץ</button>' +
      '<button onclick="sibWhatsAppReport(\''+id+'\')" style="flex:1;padding:8px;background:#e8f5e9;border:1px solid #a5d6a7;color:#1b5e20;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">💬 WhatsApp</button>' +
      '<button onclick="sibDownloadReportPDF(\''+id+'\')" style="flex:1;padding:8px;background:#fff7ed;border:1px solid #fb923c;color:#7c2d12;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📥 PDF</button>' +
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
async function sibAddYT() {
  var inp = document.getElementById('sib-yt-input');
  var url = inp ? inp.value.trim() : '';
  if (!url) { showToast('הכנס קישור יוטיוב','error'); return; }
  if (!/youtube\.com|youtu\.be/i.test(url)) { showToast('זה לא קישור יוטיוב תקין','error'); return; }
  // Add https if missing
  if (!/^https?:\/\//i.test(url)) url = 'https://'+url;
  if (inp) inp.value = '';
  // Reuse sibAddUrl logic but force youtube type
  try {
    var res = await fetch(SB_URL+'/rest/v1/asset_inbox', {
      method: 'POST',
      headers: {apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=representation'},
      body: JSON.stringify({cloudinary_url:url, file_name:'YouTube: '+url.substr(0,60), file_type:'youtube', status:'pending', created_at:new Date().toISOString()})
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    showToast('🎬 סרטון יוטיוב נוסף','success');
    await sibLoad();
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

async function sibAddUrl() {
  var inp = document.getElementById('sib-url-input');
  var url = inp ? inp.value.trim() : '';
  if(!url){ showToast('הזן URL','error'); return; }
  // Auto-fix missing protocol
  if(!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  if(inp) inp.value = url;

  var isYT = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/.test(url);
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
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  var url   = item.cloudinary_url || '';
  var isYT  = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/.test(url);
  var apiKey = (window.APP&&window.APP.config&&window.APP.config.anthropic_key)||_sibApiKey;
  if (!apiKey) {
    try {
      var cfg = await sbQ('app_config','select=key,value');
      var row = (cfg.data||[]).find(function(r){ return r.key==='anthropic_key'; });
      if (row) { apiKey = row.value; _sibApiKey = row.value; }
    } catch(e) {}
  }
  if (!apiKey) { sibStopMeter(); sibShowError('אין מפתח API'); return; }

  var extracted = '';

  // ── YOUTUBE — VISUAL FRAME ANALYSIS ──────────────────────────────────
  if (isYT) {
    if (panel) panel.innerHTML = '<div style="text-align:center;padding:24px;color:#2563eb;font-size:13px;">🎬 מנתח סרטון יוטיוב עם Claude Vision...</div>';
    sibStartMeter('ניתוח ויזואלי יוטיוב');

    // Extract video ID
    var ytId = '';
    var ytM = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    if (ytM) ytId = ytM[1];

    if (!ytId) {
      sibStopMeter();
      if (panel) panel.innerHTML = '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:14px;color:#c62828;font-size:12px;">לא זוהה מזהה סרטון יוטיוב תקין</div>';
      return;
    }

    // ── Step 1: Get YouTube thumbnails (multiple timestamps) ──────────
    // YouTube provides thumbnails at standard resolutions — use maxresdefault or hqdefault
    var thumbUrls = [
      'https://img.youtube.com/vi/'+ytId+'/maxresdefault.jpg',
      'https://img.youtube.com/vi/'+ytId+'/hqdefault.jpg',
      'https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg',
      'https://img.youtube.com/vi/'+ytId+'/sddefault.jpg',
    ];

    // Convert thumbnail to base64 for Claude Vision
    async function ytThumbToBase64(thumbUrl) {
      try {
        var proxies = ['https://api.allorigins.win/raw?url=','https://corsproxy.io/?'];
        for (var pi=0; pi<proxies.length; pi++) {
          try {
            var r = await fetch(proxies[pi]+encodeURIComponent(thumbUrl), {signal:AbortSignal.timeout(8000)});
            if (!r.ok) continue;
            var blob = await r.blob();
            if (blob.size < 500) continue; // too small = error image
            return await new Promise(function(res){
              var reader = new FileReader();
              reader.onload = function(e){ res(e.target.result); };
              reader.readAsDataURL(blob);
            });
          } catch(e) {}
        }
        // Direct fetch as last resort (may work if CORS allows)
        var r2 = await fetch(thumbUrl, {signal:AbortSignal.timeout(6000)});
        if (r2.ok) {
          var blob2 = await r2.blob();
          return await new Promise(function(res){
            var reader = new FileReader();
            reader.onload = function(e){ res(e.target.result); };
            reader.readAsDataURL(blob2);
          });
        }
      } catch(e) {}
      return null;
    }

    if (panel) panel.innerHTML = '<div style="text-align:center;padding:20px;color:#2563eb;font-size:12px;">🖼️ מוריד פריימים מיוטיוב...</div>';

    // Try thumbnails in order until one works
    var thumbBase64 = null;
    for (var ti=0; ti<thumbUrls.length && !thumbBase64; ti++) {
      thumbBase64 = await ytThumbToBase64(thumbUrls[ti]);
    }

    // ── Step 2: Also try Cloudinary URL transform if video was already uploaded ──
    var cloudinaryFrame = null;
    if (item.cloudinary_url && item.cloudinary_url.includes('cloudinary.com')) {
      cloudinaryFrame = await sibExtractFrameCanvas(item.cloudinary_url);
    }

    var frameBase64 = cloudinaryFrame || thumbBase64;

    if (panel) panel.innerHTML = '<div style="text-align:center;padding:20px;color:#9333ea;font-size:12px;">🧠 Claude מנתח תמונה לבעיות בנייה...</div>';
    sibStartMeter('Claude Vision — ניתוח בנייה');

    try {
      // ── Step 3: Build Claude Vision request ──────────────────────────
      var systemPrompt = [
        'אתה מומחה בטיחות ואיכות בנייה ישראלי עם 20 שנות ניסיון.',
        'אתה מנתח תמונות מאתרי בנייה ומזהה בעיות, סכנות, וממצאים מקצועיים.',
        'תמיד מחזיר דוח מובנה בעברית עם: ממצאים, חומרה, המלצות לתיקון.',
        'התמקד ב: בטיחות עובדים, איכות חומרים, שיטות עבודה, תקני בנייה ישראליים.'
      ].join(' ');

      var userPrompt = [
        'נתח את התמונה מאתר הבנייה.',
        'זהה את כל הבעיות, הסכנות, וממצאי האיכות הנראים.',
        '',
        'ספק דוח מובנה עם הסעיפים הבאים:',
        '1. 📋 תיאור הסצנה — מה רואים בתמונה',
        '2. ⚠️ בעיות בטיחות — כל סכנה לעובדים',
        '3. 🏗️ ממצאי איכות — בעיות בחומרים/שיטות',
        '4. 📏 התאמה לתקנים — חריגות מתקני בנייה ישראליים',
        '5. ✅ המלצות מיידיות — מה לתקן עכשיו',
        '6. 📊 דירוג חומרה — קריטי/חשוב/הנחיה',
        '',
        'URL המקור: '+url
      ].join('\n');

      var msgContent = [];
      if (frameBase64 && frameBase64.length > 1000) {
        var b64data = frameBase64.split(',')[1] || frameBase64;
        var mimeType = frameBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        msgContent.push({type:'image', source:{type:'base64', media_type:mimeType, data:b64data}});
      }
      msgContent.push({type:'text', text: userPrompt});

      var raw = await claudeFetch({
        _apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{role:'user', content: msgContent}]
      }, null);

      var resp = raw && typeof raw.json==='function' ? await raw.json() : raw;
      sibStopMeter(resp && resp.usage);
      var analysis = resp && resp.content && resp.content[0] ? resp.content[0].text : '';

      if (!analysis) throw new Error('לא התקבלה תשובה מ-Claude');

      // Store as phase 1 result
      var thumbHtml = thumbBase64 ? '<img src="'+thumbBase64+'" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:10px;">' : '';
      _sibPhase1[id] = 'ניתוח ויזואלי יוטיוב — '+url+'\n\n\n'+analysis;

      if (panel) {
        panel.innerHTML =
          '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;overflow:hidden;margin-bottom:10px;">' +
            thumbHtml +
            '<div style="padding:14px;">' +
              '<div style="font-size:11px;color:#9a6f00;font-weight:800;margin-bottom:10px;">🎬 ניתוח ויזואלי — '+sibEsc(url.substr(0,50))+'...</div>' +
              '<div style="font-size:12px;color:#333;line-height:1.8;white-space:pre-wrap;direction:rtl;">'+sibEsc(analysis)+'</div>' +
            '</div>' +
          '</div>' +
          sibApprovePanel(item);
      }

      sibRefreshCard(id);
      return;

    } catch(e) {
      sibStopMeter();
    }

    // ── Fallback: no image available — show thumbnail + manual note ───
    var thumbHtmlFallback = thumbBase64
      ? '<img src="'+thumbBase64+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-bottom:12px;">'
      : '<div style="background:#f0f0f0;border-radius:8px;padding:20px;text-align:center;font-size:24px;margin-bottom:12px;">🎬</div>';

    if (panel) {
      panel.innerHTML =
        '<div style="background:#fff7ed;border:1px solid #fb923c;border-radius:10px;padding:14px;margin:10px;direction:rtl;">' +
          thumbHtmlFallback +
          '<div style="font-size:12px;font-weight:800;color:#7c2d12;margin-bottom:8px;">🎬 '+url.substr(0,50)+'...</div>' +
          '<div style="font-size:11px;color:#555;line-height:1.8;margin-bottom:10px;">'+
            'לא הצלחנו לחלץ פריים מהסרטון.<br>'+
            '<a href="'+url+'" target="_blank" style="color:#dc2626;font-weight:700;">📺 פתח ב-YouTube ←</a>  '+
            'צלם צילום מסך → שלח לתיבת הנכנסים'+
          '</div>' +
          '<textarea id="yt-paste-'+id+'" rows="4" placeholder="הדבק תיאור ידני של מה שרואים בסרטון..." '+
            'style="width:100%;border:1.5px solid #c9a84c;border-radius:8px;padding:9px;'+
            'font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;background:#fffbf0;"></textarea>'+
          '<button onclick="sibSubmitYTPaste(\''+id+'\');" '+
            'style="width:100%;margin-top:8px;padding:11px;background:#dc2626;border:none;color:#fff;'+
            'border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">'+
            '🚀 נתח תיאור זה'+
          '</button>'+
        '</div>';
    }
    return;

  // ── WEBSITE SCRAPE ───────────────────────────────────────────────────
  } else {
    if (panel) {
      panel.innerHTML = '<div style="text-align:center;padding:60px 20px 20px;color:#2563eb;font-size:13px;">🌐 סורק אתר...</div>';
      sibStartMeter('סריקת אתר');
    }

    // Method 1: Try Supabase claude-proxy edge function (our own — no CORS)
    var pageText = '';
    var fetchOk  = false;

    try {
      var sbProxyRes = await fetch(window.SB_URL+'/functions/v1/claude-proxy', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer '+window.SB_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'fetch_url',
          url: url
        }),
        signal: AbortSignal.timeout(12000)
      });
      if (sbProxyRes.ok) {
        var sbData = await sbProxyRes.json();
        if (sbData && sbData.text && sbData.text.length > 100) {
          pageText = sbData.text;
          fetchOk = true;
        }
      }
    } catch(e) {}

    // Method 2: Public proxies fallback
    if (!fetchOk) {
      var proxies = [
        'https://api.allorigins.win/get?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
      ];
      for (var pi = 0; pi < proxies.length && !fetchOk; pi++) {
        try {
          var proxyUrl = proxies[pi] + encodeURIComponent(url);
          var res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;
          var data = await res.json().catch(async function() {
            return { contents: await res.text() };
          });
          var rawHtml = data.contents || data || '';
          if (typeof rawHtml !== 'string') rawHtml = JSON.stringify(rawHtml);
          pageText = rawHtml
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/\s{3,}/g, '\n').trim();
          if (pageText.length > 200) fetchOk = true;
        } catch(pe) {}
      }
    }

    // Method 3: Ask Claude to search for the URL content directly
    if (!fetchOk) {
      try {
        var searchRaw = await claudeFetch({
          _apiKey: apiKey,
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: 'אתה עוזר המחפש מידע מקצועי על אתרי בנייה ונדל"ן.',
          messages: [{role:'user', content:
            'חפש ותסכם את המידע המקצועי הזמין על האתר: '+url+'\n'+
            'ספק מידע על: מה החברה עושה, מוצרים/שירותים, מפרטים טכניים, מחירים אם זמינים.'
          }],
          tools: [{type:'web_search_20250305', name:'web_search'}]
        }, null);
        var searchResp = searchRaw && typeof searchRaw.json==='function' ? await searchRaw.json() : searchRaw;
        var searchText = searchResp && searchResp.content
          ? searchResp.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('\n')
          : '';
        if (searchText.length > 100) {
          pageText = searchText;
          fetchOk = true;
        }
      } catch(e) {}
    }

    if (!fetchOk || pageText.length < 100) {
      // Proxy failed — show manual paste fallback
      sibStopMeter();
      if (panel) {
        panel.innerHTML =
          '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:14px;margin:10px;">' +
            '<div style="font-size:12px;font-weight:700;color:#c62828;margin-bottom:8px;">⚠️ לא הצלחנו לסרוק את האתר אוטומטית</div>' +
            '<div style="font-size:11px;color:#555;line-height:2;margin-bottom:8px;">'+
              '1. פתח את האתר: <a href="'+url+'" target="_blank" style="color:#1a3d5c;font-weight:700;">לחץ כאן ←</a><br>'+
              '2. בחר הכל (Ctrl+A) → העתק (Ctrl+C)<br>'+
              '3. הדבק בתיבה למטה'+
            '</div>' +
            '<textarea id="web-paste-'+id+'" rows="8" placeholder="הדבק כאן את תוכן הדף..." '+
              'style="width:100%;border:1px solid rgba(180,140,60,0.3);border-radius:8px;'+
              'padding:10px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;box-sizing:border-box;"></textarea>'+
            '<button onclick="sibSubmitWebPaste(\''+id+'\')" '+
              'style="width:100%;margin-top:8px;padding:10px;background:#1a3d5c;border:none;color:#fff;'+
              'border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">'+
              '🚀 נתח תוכן זה'+
            '</button>'+
          '</div>';
      }
      return;
    }

    // Got content — truncate and send to Claude for structured extraction
    if (pageText.length > 12000) pageText = pageText.substr(0, 12000) + '\n\n[... תוכן קוצר ...]';

    try {
      var raw = await claudeFetch({
        _apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: 'אתה עוזר המנתח תוכן אתרי בנייה ונדל"ן. חלץ את המידע הרלוונטי בצורה מובנית בעברית.',
        messages: [{ role: 'user', content:
          'תוכן הדף מ: ' + url + '\n\n' + pageText + '\n\n---\n' +
          'נתח ותסכם:\n' +
          '1. מהו האתר ומה הוא מציע\n' +
          '2. מידע מקצועי רלוונטי לבנייה/נדל"ן\n' +
          '3. נתונים, מחירים, תקנים, מפרטים שמצאת\n' +
          '4. נקודות עיקריות לפעולה'
        }]
      }, null);

      var resp = raw && typeof raw.json === 'function' ? await raw.json() : raw;
      var summary = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
      sibStopMeter(resp && resp.usage);

      extracted = '=== תוכן שנסרק מ: ' + url + ' ===\n\n' + summary +
        '\n\n---\n[תוכן גולמי לעיון]\n' + pageText.substr(0, 2000) + (pageText.length > 2000 ? '\n...' : '');

      _sibPhase1[id] = extracted;
      sibRefreshCard(id);
      sibShowPhase2Panel(id);

    } catch(e) { sibStopMeter(); sibShowError('שגיאה: ' + e.message); }
  }
}

// ── YOUTUBE TRANSCRIPT PASTE SUBMIT ──────────────────────────────────
function sibSubmitYTPaste(id) {
  var el = document.getElementById('yt-paste-' + id);
  var txt = el ? el.value.trim() : '';
  if (!txt) { showToast('הדבק תמלול תחילה', 'error'); return; }
  _sibPhase1[id] = 'תמלול יוטיוב:\n\n' + txt;
  sibRefreshCard(id);
  sibShowPhase2Panel(id);
}

// ── WEB CONTENT PASTE SUBMIT ──────────────────────────────────────────
function sibSubmitWebPaste(id) {
  var el = document.getElementById('web-paste-' + id);
  var txt = el ? el.value.trim() : '';
  if (!txt) { showToast('הדבק תוכן תחילה', 'error'); return; }
  _sibPhase1[id] = 'תוכן אתר:\n\n' + txt;
  sibRefreshCard(id);
  sibShowPhase2Panel(id);
}



// ── APPROVE + SAVE REPORT ─────────────────────────────────────────────
async function sibApproveWithReport(id) {
  var item     = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  var p1text   = _sibPhase1[id] || '';
  if (!item) return;

  var sel = document.getElementById('sib-proj-sel-'+id);
  var projectId = (sel && sel.value) ? sel.value : (item.project_id || null);

  try {
    // 1. Save analysis report to journal if exists
    if (analysis && analysis.text) {
      await sb.from('beni_notes').insert({
        note_text: '📊 ' + (analysis.title||'דוח AI') + '\n\n' + analysis.text,
        note_type: 'text',
        photo_url: item.cloudinary_url || null,
        project_id: projectId,
        color: 'blue',
        created_at: new Date().toISOString()
      });
    } else if (p1text) {
      // Save phase 1 content if no analysis
      await sb.from('beni_notes').insert({
        note_text: '📋 ' + (item.file_name||'קובץ') + '\n\n' + p1text.substr(0,2000),
        note_type: 'text',
        photo_url: item.cloudinary_url || null,
        project_id: projectId,
        created_at: new Date().toISOString()
      });
    }

    // 2. Save to field_encyclopedia with project link
    var encTitle = analysis ? (analysis.title || item.file_name || 'ממצא שטח') : (item.file_name || 'קובץ מאושר');
    var encDesc  = analysis ? analysis.text : (p1text ? p1text.substr(0,1000) : '');
    var encCat   = analysis ? (analysis.mode === 'safety' ? 'בטיחות' : analysis.mode === 'engineering' ? 'הנדסי' : 'שטח') : 'שטח';
    var encSev   = analysis ? (analysis.mode === 'safety' ? 'critical' : 'important') : 'guideline';
    if (encDesc) {
      await sb.from('field_encyclopedia').insert({
        title:             encTitle,
        category:          encCat,
        description:       encDesc.substr(0, 2000),
        media_url:         item.cloudinary_url || null,
        media_type:        item.file_type || 'image',
        severity:          encSev,
        source_project_id: projectId || null,
        ai_report:         analysis ? analysis.text : null,
        ai_report_date:    analysis ? new Date().toISOString() : null,
        file_name:         item.file_name || null,
        created_at:        new Date().toISOString()
      });
    }

    // 3. Approve in asset_inbox
    await sibApprove(id, projectId);
    showToast('✅ אושר + נשמר לאנציקלופדיה ולפרויקט', 'success');
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
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
    var systemPrompt = [
      'You are an expert OCR system for Israeli construction site field measurements.',
      'You read handwritten Hebrew measurement notes from construction workers.',
      'The notes are typically written in two columns: right side = room/area name (Hebrew), left side = dimensions.',
      'Dimensions can be written in many formats: 3x2, 3X2, 3*2, 3.5x4, 300x200 (cm), 3/2, or just a single number.',
      'If only one number given with no context, treat as length only.',
      'Convert all cm to meters (divide by 100). Calculate area = length × width.',
      'If area cannot be calculated (only one dimension), leave area as null.',
      'ALWAYS return valid JSON only, no other text, no markdown, no explanation.',
      'If you cannot read a word clearly, write your best guess in Hebrew.',
      'Extract EVERY row you can see, even if partially readable.'
    ].join(' ');

    var userPrompt = [
      'Read ALL handwritten measurements from this image.',
      'This is a field measurement sheet from an Israeli construction site.',
      'Return ONLY this JSON structure with no extra text:',
      '{"rows":[{"item":"room name in Hebrew","length":4.5,"width":3.2,"area":14.4,"unit":"sq_m","notes":""}],"total_area":14.4,"notes":"any general note"}',
      'Rules:',
      '- item: Hebrew room/area name as written',
      '- length and width: decimal numbers in METERS',
      '- area: length × width (null if cannot calculate)',
      '- unit: always "sq_m"',
      '- Extract every row you see, minimum 1 row',
      '- If you see a number like 322, check context: is it 3.22m or 322cm (=3.22m)?',
      '- Do NOT return empty rows array'
    ].join('\n');

    var imageContent = item.cloudinary_url ? [
      { type: 'image', source: { type: 'url', url: item.cloudinary_url } },
      { type: 'text', text: userPrompt }
    ] : [{ type: 'text', text: 'No image available' }];

    var raw = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: imageContent }]
    }, null);

    var resp = raw && typeof raw.json === 'function' ? await raw.json() : raw;
    sibStopMeter(resp && resp.usage);

    var rawText = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
    rawText = rawText.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

    // If Claude returned explanation + JSON, extract just the JSON part
    var jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) rawText = jsonMatch[0];

    var parsed;
    try { parsed = JSON.parse(rawText); }
    catch(e) {
      // Last resort: show raw text in editable box so user can fix
      _measItems = [{item:'לא זוהה אוטומטית',length:null,width:null,area:null,unit:'sq_m',notes:rawText.substr(0,200)}];
      parsed = {rows:_measItems, total_area:0, notes:'OCR חלקי — ערוך ידנית'};
    }

    _measItems = parsed.rows || [];

    // Auto-fix cm values and recalculate areas
    _measItems.forEach(function(r){
      // Convert cm to metres if clearly in cm (>50 likely means cm not metres for a room)
      if(r.length > 50) r.length = Math.round(r.length/100*100)/100;
      if(r.width  > 50) r.width  = Math.round(r.width /100*100)/100;
      // Recalculate area
      if(r.length && r.width) r.area = Math.round(r.length * r.width * 100)/100;
      if(!r.unit) r.unit = 'sq_m';
    });

    if (_measItems.length === 0) {
      _measItems = [{item:'— ערוך ידנית —',length:null,width:null,area:null,unit:'sq_m',notes:''}];
      parsed.rows = _measItems;
    }

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
      '<button onclick="sibDownloadMeasCSV(\''+id+'\')" style="flex:1;padding:10px;background:#0f766e;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">⬇ CSV</button>' +
      '<button onclick="sibExportMeasXLSX(\''+id+'\')" style="flex:1;padding:10px;background:#217346;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">📊 Excel</button>' +
      '<button onclick="sibSaveMeasurements(\''+id+'\')" style="flex:1;padding:10px;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">💾 שמור</button>' +
      '<button onclick="sibSendMeasToTakeoff(\''+id+'\')" style="flex:1;padding:10px;background:#f5e9c4;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">📐 טייקאוף</button>' +
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
  var proj    = projId && window.allProjects
    ? (window.allProjects.find(function(p){return p.id===projId;})||null) : null;
  var projName = proj ? proj.project_name : '';

  // Validate and auto-fix measurements before sending
  var fixedRows = _measItems.map(function(r){
    var length = parseFloat(r.length)||0;
    var width  = parseFloat(r.width)||0;
    var area   = parseFloat(r.area)||0;
    // Auto-detect cm values (>100) and convert to metres
    if (length > 100) length = Math.round(length/100*100)/100;
    if (width  > 100) width  = Math.round(width /100*100)/100;
    // Recalculate area
    if (length && width) area = Math.round(length*width*100)/100;
    return { room: r.item||'', length: length, width: width, area: area };
  });

  var total = fixedRows.reduce(function(s,r){ return s+(r.area||0); }, 0);

  try {
    var payload = {
      session_label: label || ('OCR — '+new Date().toLocaleDateString('he-IL')),
      rows:          JSON.stringify(fixedRows),
      total_area:    Math.round(total*100)/100,
      takeoff_type:  'standard',
      submitted_by:  'בני',
      takeoff_date:  new Date().toISOString().split('T')[0],
      notes:         'יובא אוטומטית מ-OCR תמונת מדידות — '+sibEsc(item.file_name||''),
      created_at:    new Date().toISOString()
    };
    if (projId)   payload.project_id   = projId;
    if (projName) payload.project_name = projName;

    var res = await fetch(SB_URL+'/rest/v1/site_takeoffs', {
      method: 'POST',
      headers: {
        apikey:         SB_KEY,
        Authorization:  'Bearer '+SB_KEY,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      var errText = await res.text().catch(function(){return res.status;});
      throw new Error('HTTP '+res.status+' — '+String(errText).substr(0,120));
    }

    showToast('✅ נשלח לטייקאוף בהצלחה | '+fixedRows.length+' שורות, '+total.toFixed(2)+' מ"ר','success');

    // Refresh takeoff tab if visible
    if (typeof loadTakeoffs === 'function') {
      try { loadTakeoffs(); } catch(e2){}
    }

  } catch(e) {
    showToast('שגיאה בשליחה לטייקאוף: '+e.message,'error');
    console.error('sibSendMeasToTakeoff error:', e);
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

// ══════════════════════════════════════════════════════════════════════
// UTILITY ACTIONS — Email / WhatsApp / Print / PDF
// All support attaching the original scanned file
// ══════════════════════════════════════════════════════════════════════

// ── BUILD REPORT HTML (shared by print + PDF) ─────────────────────────
function sibBuildReportHTML(id) {
  var item     = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  var p1text   = _sibPhase1[id] || '';
  if (!analysis) return null;

  var projName = (window.allProjects||[]).find(function(p){ return item && p.id === item.project_id; });
  projName = projName ? projName.project_name : '';
  var ts = new Date(analysis.timestamp).toLocaleString('he-IL');
  var modeColors = {safety:'#c62828',engineering:'#1a3d5c',standards:'#4527a0',thirdparty:'#7c2d12',financial:'#1b5e20',protocol:'#7a5500',general:'#555'};
  var color = modeColors[analysis.mode] || '#1a3d5c';

  var bodyHTML = (analysis.text || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^## (.+)$/gm,'<h3 style="color:'+color+';border-bottom:2px solid '+color+'33;padding-bottom:4px;margin:16px 0 6px;">$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/🔴/g,'<span style="color:#c62828;">🔴</span>')
    .replace(/🟡/g,'<span style="color:#f59e0b;">🟡</span>')
    .replace(/🟢/g,'<span style="color:#1b7a4a;">🟢</span>')
    .replace(/\n/g,'<br>');

  var usageStr = '';
  if (analysis.usage) {
    var iT = analysis.usage.input_tokens||0, oT = analysis.usage.output_tokens||0;
    usageStr = '<div style="font-size:11px;color:#888;margin-top:12px;padding:8px;background:#fffbf0;border:1px solid #c9a84c;border-radius:6px;">'+
      '🔢 '+(iT+oT).toLocaleString()+' טוקנים · 💰 $'+((iT*3+oT*15)/1000000).toFixed(4)+'</div>';
  }

  var fileLink = item && item.cloudinary_url
    ? '<div style="margin-top:12px;padding:10px;background:#e8f0fd;border-radius:8px;font-size:12px;">'+
      '📎 <b>קובץ מקור:</b> <a href="'+item.cloudinary_url+'" target="_blank" style="color:#1a3d5c;">'+sibEsc(item.file_name||'קובץ')+'</a></div>'
    : '';

  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">'+
    '<style>'+
      'body{font-family:Arial,sans-serif;direction:rtl;padding:32px;color:#1a1a1a;font-size:13px;line-height:1.8;}'+
      'h1{color:'+color+';font-size:18px;border-bottom:3px solid '+color+';padding-bottom:8px;margin-bottom:4px;}'+
      'h3{margin:14px 0 6px;}'+
      '.meta{font-size:11px;color:#888;margin-bottom:20px;}'+
      '.phase1{background:#f0fdfb;border-right:4px solid #14b8a6;padding:12px;border-radius:6px;margin-bottom:16px;font-size:12px;white-space:pre-wrap;max-height:200px;overflow:auto;}'+
      '@media print{.noprint{display:none!important}}'+
    '</style></head><body>'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">'+
      '<div>'+
        '<div style="font-size:9px;letter-spacing:2px;color:#888;text-transform:uppercase;">AI Site Intelligence</div>'+
        '<h1>'+sibEsc(analysis.title||analysis.mode)+'</h1>'+
      '</div>'+
      '<div style="text-align:left;font-size:11px;color:#888;">'+
        (projName?'<div><b>פרויקט:</b> '+sibEsc(projName)+'</div>':'')+
        '<div><b>קובץ:</b> '+sibEsc((item&&item.file_name)||'')+'</div>'+
        '<div><b>תאריך:</b> '+ts+'</div>'+
      '</div>'+
    '</div>'+
    (p1text ? '<div class="phase1"><b>חומר גלם (שלב 1):</b><br>'+sibEsc(p1text.substr(0,600))+(p1text.length>600?'...':'')+'</div>' : '')+
    '<div>'+bodyHTML+'</div>'+
    usageStr + fileLink +
    '<div style="margin-top:24px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">'+
      'הופק ע"י מרכז נתונים שטח AI · '+ts+
    '</div>'+
    '</body></html>';
}

// ── PRINT ─────────────────────────────────────────────────────────────
function sibPrintReport(id) {
  var html = sibBuildReportHTML(id);
  if (!html) { showToast('אין דוח להדפסה','error'); return; }
  var w = window.open('','_blank','width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 400); }
}

// ── DOWNLOAD PDF ──────────────────────────────────────────────────────
function sibDownloadReportPDF(id) {
  // Open print dialog in new window — user saves as PDF from browser
  var html = sibBuildReportHTML(id);
  if (!html) { showToast('אין דוח להורדה','error'); return; }
  // Add print-to-PDF instruction
  html = html.replace('</body>',
    '<div class="noprint" style="position:fixed;top:0;left:0;right:0;background:#1a3d5c;color:#fff;padding:12px 20px;font-family:Arial;font-size:13px;text-align:center;">'+
    '📥 לשמירה כ-PDF: Ctrl+P (או Cmd+P) → שנה יעד ל"Save as PDF" → שמור &nbsp;&nbsp; <button onclick="window.print()" style="background:#c9a84c;border:none;color:#1a1a2e;border-radius:6px;padding:6px 16px;cursor:pointer;font-weight:800;">🖨️ פתח דיאלוג הדפסה</button></div>'+
    '</body>');
  var w = window.open('','_blank','width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── EMAIL WITH ATTACHMENT ─────────────────────────────────────────────
function sibEmailReport(id) {
  var item     = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  if (!analysis) { showToast('אין דוח לשליחה','error'); return; }

  var projName = (window.allProjects||[]).find(function(p){ return item && p.id === item.project_id; });
  projName = projName ? projName.project_name : '';

  var subject = encodeURIComponent(
    (analysis.title||'דוח AI') +
    (projName ? ' — ' + projName : '') +
    ' | ' + new Date().toLocaleDateString('he-IL')
  );

  // Build email body — plain text version of report
  var body = (analysis.title||'דוח AI') + '\n';
  body += (projName ? 'פרויקט: ' + projName + '\n' : '');
  body += 'קובץ: ' + ((item&&item.file_name)||'') + '\n';
  body += 'תאריך: ' + new Date(analysis.timestamp).toLocaleString('he-IL') + '\n';
  body += '\n' + '─'.repeat(40) + '\n\n';
  body += analysis.text;
  if (item && item.cloudinary_url) {
    body += '\n\n' + '─'.repeat(40) + '\n';
    body += 'קובץ מקור: ' + item.cloudinary_url;
  }

  var encodedBody = encodeURIComponent(body);
  var mailto = 'mailto:?subject=' + subject + '&body=' + encodedBody;

  // Show modal with options
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;

  var existing = document.getElementById('sib-email-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'sib-email-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:24px;max-width:440px;width:90%;direction:rtl;font-family:Heebo,sans-serif;">' +
      '<div style="font-size:16px;font-weight:900;color:#1a3d5c;margin-bottom:16px;">✉️ שלח דוח במייל</div>' +
      '<div style="font-size:12px;color:#555;margin-bottom:12px;">הדוח ישלח כטקסט בגוף המייל. הקובץ המקורי ישלח כקישור (Cloudinary).</div>' +
      '<div style="background:#f0fdfb;border:1px solid #5eead4;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:#0f766e;">' +
        '📎 קישור לקובץ מקור יצורף אוטומטית לגוף המייל' +
      '</div>' +
      '<input id="sib-email-to" type="email" placeholder="כתובת מייל..." style="width:100%;border:1px solid rgba(180,140,60,0.3);border-radius:8px;padding:10px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;margin-bottom:10px;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="sibSendEmail(\'' + mailto + '\')" style="flex:1;padding:10px;background:#1a3d5c;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📨 פתח אפליקציית מייל</button>' +
        '<button onclick="document.getElementById(\'sib-email-modal\').remove()" style="padding:10px 16px;background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#7a8a95;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">ביטול</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
}

function sibSendEmail(baseMailto) {
  var toEl = document.getElementById('sib-email-to');
  var to = toEl ? toEl.value.trim() : '';
  var finalMailto = to ? baseMailto.replace('mailto:?', 'mailto:' + encodeURIComponent(to) + '?') : baseMailto;
  window.location.href = finalMailto;
  var modal = document.getElementById('sib-email-modal');
  if (modal) setTimeout(function(){ modal.remove(); }, 500);
}

// ── WHATSAPP ──────────────────────────────────────────────────────────
function sibWhatsAppReport(id) {
  var item     = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  if (!analysis) { showToast('אין דוח לשליחה','error'); return; }

  var projName = (window.allProjects||[]).find(function(p){ return item && p.id === item.project_id; });
  projName = projName ? projName.project_name : '';

  // WhatsApp has 4096 char limit — smart truncation
  var header = '🏗️ *' + (analysis.title||'דוח AI') + '*' +
    (projName ? '\n📁 פרויקט: ' + projName : '') +
    '\n📎 קובץ: ' + ((item&&item.file_name)||'') +
    '\n\n';

  var maxBody = 3500 - header.length;
  var body = analysis.text.substr(0, maxBody);
  if (analysis.text.length > maxBody) body += '\n\n[... הדוח קוצר לווצאפ]';

  var fileLink = (item && item.cloudinary_url)
    ? '\n\n🔗 *קובץ מקור:*\n' + item.cloudinary_url
    : '';

  var msg = header + body + fileLink;

  // Show phone input modal
  var existing = document.getElementById('sib-wa-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'sib-wa-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:12px;padding:24px;max-width:440px;width:90%;direction:rtl;font-family:Heebo,sans-serif;">' +
      '<div style="font-size:16px;font-weight:900;color:#1b5e20;margin-bottom:16px;">💬 שלח דוח ב-WhatsApp</div>' +
      '<div style="font-size:12px;color:#555;margin-bottom:12px;">הדוח ישלח כהודעת טקסט. קישור לקובץ המקורי יצורף.</div>' +
      '<div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:#1b5e20;">' +
        '📱 ניתן לשלוח לכל מספר — מספר ישראלי (050/052/054...) בלי 0' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<span style="background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);border-radius:8px 0 0 8px;padding:10px 12px;font-size:13px;color:#888;">+972</span>' +
        '<input id="sib-wa-phone" type="tel" placeholder="501234567" style="flex:1;border:1px solid rgba(180,140,60,0.3);border-radius:0 8px 8px 0;padding:10px;font-family:Heebo,sans-serif;font-size:13px;">' +
      '</div>' +
      '<div style="font-size:10px;color:#aaa;margin-bottom:12px;">השאר ריק לפתיחת WhatsApp בלי מספר ספציפי</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="sibSendWhatsApp(\'' + encodeURIComponent(msg).replace(/'/g,"\\'") + '\')" style="flex:1;padding:10px;background:#25D366;border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📲 שלח WhatsApp</button>' +
        '<button onclick="document.getElementById(\'sib-wa-modal\').remove()" style="padding:10px 16px;background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#7a8a95;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">ביטול</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
}

function sibSendWhatsApp(encodedMsg) {
  var phoneEl = document.getElementById('sib-wa-phone');
  var phone = phoneEl ? phoneEl.value.replace(/\D/g,'') : '';
  var url = phone
    ? 'https://wa.me/972' + phone.replace(/^0/,'') + '?text=' + encodedMsg
    : 'https://wa.me/?text=' + encodedMsg;
  window.open(url, '_blank');
  var modal = document.getElementById('sib-wa-modal');
  if (modal) setTimeout(function(){ modal.remove(); }, 300);
}


// ══ YOUTUBE API KEY SETUP ══════════════════════════════════════════════
async function ytSetupApiKey() {
  var ov = document.createElement('div');
  ov.id = 'yt-setup-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});

  // Check if key already exists
  var currentKey = window.APP && window.APP.config && window.APP.config.youtube_api_key;

  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:520px;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;">' +
      '<div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
          '<div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.6);text-transform:uppercase;">אינטגרציית יוטיוב</div>' +
          '<div style="font-size:17px;font-weight:800;color:#fff;">🎬 הגדרת חיבור יוטיוב</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\"yt-setup-overlay\").remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;">✕</button>' +
      '</div>' +
      '<div style="padding:20px;">' +

        (currentKey ?
          '<div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#1b5e20;font-weight:700;">✅ מחובר: ...'+currentKey.slice(-6)+'</div>'
          : ''
        ) +

        '<div style="font-size:12px;color:#555;margin-bottom:16px;line-height:1.9;">'+
          'חיבור יוטיוב מאפשר חילוץ תמלול אוטומטי מכל סרטון יוטיוב.<br>'+
          'הגדרה חד-פעמית — חינם עד 10,000 סרטונים ביום.'+
        '</div>' +

        '<div style="background:#f8f9fc;border-radius:10px;padding:14px;margin-bottom:16px;">' +
          '<div style="font-size:12px;font-weight:800;color:#1a3d5c;margin-bottom:10px;">5 שלבים — פעם אחת בלבד:</div>' +
          '<div style="font-size:12px;color:#444;line-height:2.2;">' +
            '<div>1. <a href="https://console.cloud.google.com/projectcreate?hl=iw" target="_blank" style="color:#1a3d5c;font-weight:700;">צור פרויקט חדש ←</a></div>' +
            '<div>2. <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com?hl=iw" target="_blank" style="color:#1a3d5c;font-weight:700;">הפעל שירות יוטיוב ←</a></div>' +
            '<div>3. <a href="https://console.cloud.google.com/apis/credentials?hl=iw" target="_blank" style="color:#1a3d5c;font-weight:700;">צור מפתח גישה (לחץ + Create Credentials) ←</a></div>' +
            '<div>4. הגבל את המפתח לשירות יוטיוב בלבד (מומלץ)</div>' +
            '<div>5. הדבק את המפתח למטה ולחץ שמור</div>' +
          '</div>' +
        '</div>' +

        '<div style="margin-bottom:14px;">' +
          '<div style="font-size:11px;color:#888;margin-bottom:6px;font-weight:700;">מפתח הגישה</div>' +
          '<input id="yt-api-key-input" type="password" placeholder="הדבק כאן את המפתח..." '+
            'style="width:100%;padding:10px 14px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;" '+
            'value="'+(currentKey||'')+'">'+
          '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">'+
            '<input type="checkbox" id="yt-key-show" onchange="var i=document.getElementById(&quot;yt-api-key-input&quot;);i.type=this.checked?&quot;text&quot;:&quot;password&quot;">'+
            '<label for="yt-key-show" style="font-size:11px;color:#888;cursor:pointer;">הצג / הסתר</label>'+
          '</div>'+
        '</div>' +

        '<div id="yt-setup-status" style="display:none;margin-bottom:12px;"></div>' +

        '<div style="display:flex;gap:8px;">' +
          '<button onclick="ytSaveApiKey()" style="flex:1;padding:12px;background:#dc2626;border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;">💾 שמור</button>' +
          '<button onclick="ytTestApiKey()" style="padding:12px 18px;background:#f5f7fa;border:1px solid #ddd;color:#444;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">🧪 בדיקה</button>' +
        '</div>' +

      '</div>' +
    '</div>';

  document.body.appendChild(ov);
}

async function ytSaveApiKey() {
  var key = (document.getElementById('yt-api-key-input')||{}).value||'';
  var statusEl = document.getElementById('yt-setup-status');
  if (!key.trim()) { showToast('הכנס מפתח גישה','error'); return; }

  try {
    // Upsert into app_config
    var res = await fetch(window.SB_URL+'/rest/v1/app_config', {
      method: 'POST',
      headers: {
        apikey: window.SB_KEY,
        Authorization: 'Bearer '+window.SB_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({key:'youtube_api_key', value:key.trim()})
    });

    if (!res.ok) {
      // Try PATCH if POST fails (row might exist)
      var res2 = await fetch(window.SB_URL+'/rest/v1/app_config?key=eq.youtube_api_key', {
        method: 'PATCH',
        headers: {
          apikey: window.SB_KEY, Authorization: 'Bearer '+window.SB_KEY,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({value: key.trim()})
      });
      if (!res2.ok) throw new Error('HTTP '+res2.status);
    }

    // Update local APP.config immediately
    if (!window.APP) window.APP = {};
    if (!window.APP.config) window.APP.config = {};
    window.APP.config.youtube_api_key = key.trim();

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:8px;padding:10px;font-size:12px;color:#1b5e20;font-weight:700;">✅ נשמר — תמלול יוטיוב אוטומטי פעיל</div>';
    }
    showToast('✅ המפתח נשמר — חיבור יוטיוב פעיל','success');

    setTimeout(function(){ document.getElementById('yt-setup-overlay') && document.getElementById('yt-setup-overlay').remove(); }, 1500);

  } catch(e) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:10px;font-size:12px;color:#c62828;">שגיאה: '+e.message+'</div>';
    }
  }
}

async function ytTestApiKey() {
  var key = (document.getElementById('yt-api-key-input')||{}).value||'';
  var statusEl = document.getElementById('yt-setup-status');
  if (!key.trim()) { showToast('הכנס מפתח קודם','error'); return; }
  if (statusEl) { statusEl.style.display='block'; statusEl.innerHTML='<div style="font-size:12px;color:#2563eb;">🧪 בודק...</div>'; }
  try {
    // Test with a simple search query
    var r = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key='+key.trim(),
      {signal:AbortSignal.timeout(6000)});
    var d = await r.json();
    if (d.error) throw new Error(d.error.message);
    if (statusEl) statusEl.innerHTML = '<div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:8px;padding:10px;font-size:12px;color:#1b5e20;font-weight:700;">✅ המפתח תקין — יוטיוב מחובר</div>';
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:10px;font-size:12px;color:#c62828;">❌ '+e.message+'</div>';
  }
}

// ── EXPORT MEASUREMENTS TO XLSX ───────────────────────────────────────
async function sibExportMeasXLSX(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  var labelEl = document.getElementById('meas-label-'+id);
  var projEl  = document.getElementById('meas-proj-'+id);
  var label   = labelEl ? labelEl.value : 'מדידות שטח';
  var projName = '';
  if (projEl && projEl.value) {
    var proj = (window.allProjects||[]).find(function(p){ return p.id===projEl.value; });
    projName = proj ? proj.project_name : '';
  }
  var total = _measItems.reduce(function(s,r){ return s+(parseFloat(r.area)||0); }, 0);
  var date  = new Date().toLocaleDateString('he-IL');

  // Load SheetJS if not available
  if (typeof XLSX === 'undefined') {
    showToast('טוען SheetJS...','info');
    await new Promise(function(res,rej){
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  var wb = XLSX.utils.book_new();

  // ── Sheet 1: Measurements ────────────────────────────────────────
  var wsData = [];

  // Title rows
  wsData.push(['מדידות שטח — ' + (label||'') + (projName?' | פרויקט: '+projName:'')]);
  wsData.push(['תאריך: ' + date + '  |  נמדד ע"י: בני פרסקי']);
  wsData.push([]); // blank row

  // Headers
  wsData.push(['פריט / חדר', 'אורך (מ\')', 'רוחב (מ\')', 'שטח (מ"ר)', 'יחידה', 'הערות']);

  // Data rows
  _measItems.forEach(function(r){
    wsData.push([
      r.item || '',
      r.length !== null ? r.length : '',
      r.width  !== null ? r.width  : '',
      r.area   !== null ? r.area   : '',
      r.unit   || 'מ"ר',
      r.notes  || ''
    ]);
  });

  // Totals row
  var dataStart = 5; // header at row 4 (1-indexed), data from row 5
  var dataEnd   = 4 + _measItems.length;
  wsData.push([]);
  wsData.push(['סה"כ שטח', '', '', { f: 'SUM(D'+dataStart+':D'+dataEnd+')' }, 'מ"ר', '']);

  var ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    {wch:22}, // פריט
    {wch:12}, // אורך
    {wch:12}, // רוחב
    {wch:12}, // שטח
    {wch:8},  // יחידה
    {wch:24}  // הערות
  ];

  // Merge title cell across A:F
  ws['!merges'] = [
    {s:{r:0,c:0}, e:{r:0,c:5}},
    {s:{r:1,c:0}, e:{r:1,c:5}}
  ];

  // Styling via sheet properties (basic — full styling needs xlsx-style)
  // Mark header row
  var headerRow = 4; // 0-indexed row 3
  ['A','B','C','D','E','F'].forEach(function(col){
    var cell = ws[col + headerRow];
    if (cell) {
      cell.s = {
        font: {bold:true, color:{rgb:'FFFFFF'}},
        fill: {fgColor:{rgb:'1A3D5C'}},
        alignment: {horizontal:'center', readingOrder:2}
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, 'מדידות שטח');

  // ── Sheet 2: Summary ─────────────────────────────────────────────
  var wsSummary = XLSX.utils.aoa_to_sheet([
    ['סיכום מדידות'],
    [],
    ['פרויקט',    projName || '—'],
    ['תווית',     label    || '—'],
    ['תאריך',     date],
    ['נמדד ע"י', 'בני פרסקי'],
    [],
    ['מספר פריטים', _measItems.length],
    ['שטח כולל (מ"ר)', total.toFixed(2)],
    [],
    ['הנחות חומר (10% בזבוז)'],
    ['שטח עם בזבוז (מ"ר)', +(total*1.1).toFixed(2)],
    [],
    ['הערות', labelEl&&labelEl.value ? '' : '—']
  ]);

  wsSummary['!cols'] = [{wch:22},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום');

  // ── Download ──────────────────────────────────────────────────────
  var fname = (label||'מדידות')
    .replace(/[\/\\:*?"<>|]/g,'_') + '_' +
    new Date().toLocaleDateString('he-IL').replace(/\//g,'-') + '.xlsx';

  XLSX.writeFile(wb, fname);
  showToast('📊 קובץ Excel הורד: ' + fname, 'success');
}
