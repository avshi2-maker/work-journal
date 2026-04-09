// inbox.js — תיבת נכנסים חכמה — Smart Inbox
// Loaded dynamically by index.html via _fetchInboxModule()
// Two-panel layout: incoming files (right) + AI analysis (left)

// ── STATE ────────────────────────────────────────────────────────────
var _sibItems      = [];   // all pending inbox items
var _sibSelected   = null; // currently selected item id
var _sibAnalysis   = {};   // analysis results keyed by item id
var _sibApiKey     = null; // Claude API key from app_config
var _sibChecked    = {};   // {itemId: {safety:bool, engineering:bool, standards:bool}}

// ── INIT ─────────────────────────────────────────────────────────────
async function sibInit() {
  // Inject full two-panel UI into inbox-panel
  var panel = document.getElementById('inbox-panel');
  if (!panel) return;

  // Get API key
  try {
    var cfg = await sbQ('app_config', 'select=key,value');
    var rows = cfg.data || [];
    var k = rows.find(function(r){ return r.key === 'openai_key' || r.key === 'claude_key'; });
    if (k) _sibApiKey = k.value;
    // Also check anthropic key
    var ak = rows.find(function(r){ return r.key === 'anthropic_key'; });
    if (ak) _sibApiKey = ak.value;
  } catch(e) {}

  panel.innerHTML = sibHTML();
  sibPopulateProjects();
  await sibLoad();
}

function sibHTML() {
  return `<div id="sib-root" style="min-height:100vh;background:#fdf6e3;font-family:Heebo,sans-serif;direction:rtl;padding:0;">

  <!-- TOPBAR -->
  <div style="background:#f5e9c4;border-bottom:2px solid #c9a84c;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    <div>
      <div style="font-size:9px;letter-spacing:3px;color:#9a6f00;font-weight:800;text-transform:uppercase;margin-bottom:3px;">Smart Inbox</div>
      <div style="font-size:18px;font-weight:900;color:#1a3d5c;">📥 תיבת נכנסים חכמה</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span id="sib-badge" style="display:none;background:#ef4444;color:#1a3d5c;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:800;"></span>
      <button onclick="sibLoad()" style="background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#5a6f7c;border-radius:8px;padding:7px 14px;font-size:11px;cursor:pointer;font-family:Heebo,sans-serif;">🔄 רענן</button>
      <select id="sib-proj-filter" onchange="sibFilterByProject(this.value)" style="background:#fff;border:1px solid rgba(180,140,60,0.3);color:#2c4a6e;border-radius:8px;padding:7px 12px;font-size:11px;font-family:Heebo,sans-serif;direction:rtl;">
        <option value="">כל הפרויקטים</option>
      </select>
    </div>
  </div>

  <!-- STATS BAR -->
  <div id="sib-stats" style="display:flex;gap:8px;padding:10px 20px;background:#f5e9c4;border-bottom:1px solid #f5f0e8;flex-wrap:wrap;"></div>

  <!-- MAIN TWO-PANEL -->
  <div style="display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 120px);">

    <!-- RIGHT PANEL: Incoming files -->
    <div style="border-left:2px solid rgba(180,140,60,0.3);background:#fdf6e3;padding:16px;overflow-y:auto;max-height:calc(100vh - 120px);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:10px;font-weight:700;color:#9a6f00;letter-spacing:1px;text-transform:uppercase;">קבצים נכנסים — בני פרסקי</div>
        <button onclick="sibBatchAnalyze()" style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:8px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:10px;font-weight:800;cursor:pointer;">🚀 הפעל ניתוח חכם</button>
      </div>
      <div id="sib-file-list" style="display:flex;flex-direction:column;gap:8px;">
        <div style="text-align:center;padding:40px;color:#9aabb5;font-size:13px;">טוען קבצים...</div>
      </div>
    </div>

    <!-- LEFT PANEL: Analysis -->
    <div style="background:#fdf6e3;padding:16px;overflow-y:auto;max-height:calc(100vh - 120px);">
      <div style="font-size:10px;font-weight:700;color:#7a8a95;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">ניתוח AI — מיידי</div>
      <div id="sib-analysis-panel">
        <div style="text-align:center;padding:60px 20px;color:#b0bec5;font-size:13px;line-height:1.8;">
          <div style="font-size:32px;margin-bottom:12px;">👈</div>
          בחר קובץ מהרשימה<br>ולחץ על כפתור הניתוח
        </div>
      </div>
    </div>

  </div>
</div>`;
}

// ── LOAD ─────────────────────────────────────────────────────────────
async function sibLoad() {
  var listEl = document.getElementById('sib-file-list');
  var statsEl = document.getElementById('sib-stats');
  var badge = document.getElementById('sib-badge');
  if (!listEl) return;

  try {
    var { data, error } = await sbQ('asset_inbox',
      'status=eq.pending&order=created_at.desc&limit=100&select=id,cloudinary_url,file_name,file_type,thumbnail_url,project_id,created_at');
    _sibItems = data || [];
  } catch(e) {
    listEl.innerHTML = '<div style="color:#ef4444;padding:20px;font-size:12px;">שגיאה בטעינה</div>';
    return;
  }

  // Stats
  var photos = _sibItems.filter(function(i){ return i.file_type === 'image'; }).length;
  var videos = _sibItems.filter(function(i){ return i.file_type === 'video'; }).length;
  var audios = _sibItems.filter(function(i){ return i.file_type === 'audio'; }).length;
  var pdfs   = _sibItems.filter(function(i){ return i.file_type === 'pdf' || i.file_type === 'document'; }).length;

  if (statsEl) {
    statsEl.innerHTML = [
      ['📸', photos, 'תמונות'],
      ['🎥', videos, 'וידאו'],
      ['🎙', audios, 'הקלטות'],
      ['📄', pdfs,   'מסמכים'],
    ].map(function(s){
      return '<div style="display:flex;align-items:center;gap:5px;background:#fff;border-radius:6px;padding:5px 10px;">' +
        '<span style="font-size:14px;">' + s[0] + '</span>' +
        '<span style="font-size:15px;font-weight:800;color:#1a3d5c;">' + s[1] + '</span>' +
        '<span style="font-size:10px;color:#8a9aa5;">' + s[2] + '</span></div>';
    }).join('');
  }

  if (badge) {
    if (_sibItems.length > 0) { badge.textContent = _sibItems.length + ' חדשים'; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  }

  if (_sibItems.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#b0bec5;font-size:13px;line-height:2;">✅ תיבת הנכנסים ריקה<br><span style="font-size:11px;color:#b0bec5;">כל הקבצים טופלו</span></div>';
    return;
  }

  listEl.innerHTML = '';
  _sibItems.forEach(function(item) {
    listEl.appendChild(sibFileCard(item));
  });
}

// ── FILE CARD ─────────────────────────────────────────────────────────
function sibFileCard(item) {
  var card = document.createElement('div');
  var isSelected = _sibSelected === item.id;
  card.id = 'sib-card-' + item.id;
  card.style.cssText = 'background:' + (isSelected ? '#fffbf0' : '#fff') + ';' +
    'border:1px solid ' + (isSelected ? 'rgba(180,140,60,0.5)' : 'rgba(180,140,60,0.2)') + ';' +
    'border-radius:10px;padding:12px;cursor:pointer;transition:all 0.15s;';

  var type = item.file_type || 'image';
  var typeIcon = type === 'video' ? '🎥' : type === 'audio' ? '🎙' : type === 'pdf' ? '📄' : '📸';
  var typeBg   = type === 'video' ? '#fff8e8' : type === 'audio' ? '#e8f8f0' : type === 'pdf' ? '#fdf0f0' : '#e8f0fd';
  var typeColor= type === 'video' ? '#f59e0b' : type === 'audio' ? '#10b981' : type === 'pdf' ? '#ef4444' : '#3b82f6';
  var hasThumb = (type === 'image' || type === 'photo' || type === 'video') && (item.thumbnail_url || item.cloudinary_url);
  var thumbUrl = item.thumbnail_url || (item.cloudinary_url ? item.cloudinary_url.replace('/upload/', '/upload/w_80,h_80,c_fill,f_jpg/') : '');

  var fname = item.file_name || 'קובץ ללא שם';
  var proj = (window.allProjects||[]).find(function(p){ return p.id === item.project_id; });
  var projName = proj ? proj.project_name : (item.project_id ? '...' : 'לא שויך');
  var timeStr = new Date(item.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});

  // Action buttons per type
  var actions = sibActionButtons(item);

  // Init checkbox state
  if (!_sibChecked[item.id]) _sibChecked[item.id] = {safety:true, engineering:false, standards:false};
  var chk = _sibChecked[item.id];
  var hasVisual = (type === 'image' || type === 'photo' || type === 'video' || type === 'audio');
  var checkboxRow = hasVisual ?
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:8px 0 6px;padding:7px 10px;background:#fffbf0;border-radius:8px;border:1px solid rgba(180,140,60,0.15);">' +
      '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;font-weight:700;color:#c62828;">' +
        '<input type="checkbox" ' + (chk.safety?'checked':'') + ' onchange="_sibChecked[&quot;' + item.id + '&quot;].safety=this.checked;event.stopPropagation();" style="accent-color:#c62828;"> ⚠️ בטיחות</label>' +
      '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;font-weight:700;color:#1a3d5c;">' +
        '<input type="checkbox" ' + (chk.engineering?'checked':'') + ' onchange="_sibChecked[&quot;' + item.id + '&quot;].engineering=this.checked;event.stopPropagation();" style="accent-color:#1a3d5c;"> 🏗️ הנדסי</label>' +
      '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;font-weight:700;color:#9a6f00;">' +
        '<input type="checkbox" ' + (chk.standards?'checked':'') + ' onchange="_sibChecked[&quot;' + item.id + '&quot;].standards=this.checked;event.stopPropagation();" style="accent-color:#9a6f00;"> 📋 תקנים</label>' +
    '</div>' : '';

  card.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:10px;">' +
      (hasThumb ? '<img src="' + thumbUrl + '" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.outerHTML=\'<div style=\\"width:36px;height:36px;border-radius:8px;background:' + typeBg + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;\\">'+typeIcon+'</div>\'">' : '<div style="width:36px;height:36px;border-radius:8px;background:' + typeBg + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">' + typeIcon + '</div>') +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;color:#1a3d5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sibEsc(fname) + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;">' +
          '<span style="font-size:10px;color:#8a9aa5;">' + timeStr + '</span>' +
          '<span style="font-size:9px;padding:1px 7px;border-radius:10px;background:#f5f0e8;color:' + typeColor + ';border:1px solid ' + typeColor + '22;">' + type + '</span>' +
          '<span style="font-size:9px;color:#9aabb5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">' + sibEsc(projName) + '</span>' +
        '</div>' +
      '</div>' +
      '<button onclick="sibDeleteItem(\'' + item.id + '\')" style="background:none;border:none;color:#b0bec5;cursor:pointer;font-size:14px;padding:2px;flex-shrink:0;" title="מחק">🗑️</button>' +
    '</div>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;">' + checkboxRow + actions + '</div>';

  card.onclick = function(e) {
    if (e.target.closest('button')) return;
    sibSelectItem(item.id);
  };

  return card;
}

function sibActionButtons(item) {
  var id = item.id;
  var type = item.file_type || 'image';
  var btns = '';

  if (type === 'image' || type === 'photo') {
    btns += sibBtn('🔍 נתח עכשיו', 'sibAnalyze(\'' + id + '\',\'general\')', 'primary');
    btns += sibBtn('🏗️ הנדסי',      'sibAnalyze(\'' + id + '\',\'engineering\')', 'sec');
    btns += sibBtn('⚠️ בטיחות',    'sibAnalyze(\'' + id + '\',\'safety\')', 'danger');
    btns += sibBtn('📚 אנציקלופדיה','sibSaveToEnc(\'' + id + '\')', 'enc');
  } else if (type === 'video') {
    btns += sibBtn('🎞️ חלץ פריים', 'sibExtractFrame(\'' + id + '\')', 'primary');
    btns += sibBtn('🔍 נתח',       'sibAnalyze(\'' + id + '\',\'general\')', 'sec');
    btns += sibBtn('📚 אנציקלופדיה','sibSaveToEnc(\'' + id + '\')', 'enc');
  } else if (type === 'audio') {
    btns += sibBtn('🎙️ תמלל + נתח','sibTranscribe(\'' + id + '\')', 'primary');
    btns += sibBtn('📋 יומן',       'sibSaveToJournal(\'' + id + '\')', 'sec');
  } else if (type === 'pdf' || type === 'document') {
    btns += sibBtn('📑 OCR + ניתוח','sibAnalyzePDF(\'' + id + '\')', 'primary');
    btns += sibBtn('📚 אנציקלופדיה','sibSaveToEnc(\'' + id + '\')', 'enc');
  }

  btns += sibBtn('✅ אשר',  'sibApprove(\'' + id + '\')', 'approve');

  return btns;
}

function sibBtn(label, onclick, style) {
  var styles = {
    primary: 'background:#1a3d5c;color:#fff;border:1px solid #1a3d5c;',
    sec:     'background:#f5f0e8;color:#5a6f7c;border:1px solid rgba(180,140,60,0.3);',
    danger:  'background:#fff5f5;color:#c62828;border:1px solid #fca5a5;',
    enc:     'background:#ede7f6;color:#4527a0;border:1px solid #9c6fdd;',
    approve: 'background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;',
  };
  return '<button onclick="' + onclick + ';event.stopPropagation();" style="' +
    (styles[style] || styles.sec) +
    'border-radius:6px;padding:4px 9px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">' +
    label + '</button>';
}

// ── SELECT ITEM ───────────────────────────────────────────────────────
function sibSelectItem(id) {
  _sibSelected = id;
  // Re-render all cards to update selection highlight
  _sibItems.forEach(function(item) {
    var card = document.getElementById('sib-card-' + item.id);
    if (!card) return;
    var sel = item.id === id;
    card.style.background = sel ? '#fffbf0' : '#fff';
    card.style.border = '1px solid ' + (sel ? 'rgba(180,140,60,0.5)' : 'rgba(180,140,60,0.2)');
  });
  // Show existing analysis or prompt
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;

  if (_sibAnalysis[id]) {
    sibShowAnalysis(id, _sibAnalysis[id]);
  } else {
    var typeIcon = item.file_type === 'video' ? '🎥' : item.file_type === 'audio' ? '🎙' : item.file_type === 'pdf' ? '📄' : '📸';
    panel.innerHTML =
      '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;padding:16px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
          '<span style="font-size:24px;">' + typeIcon + '</span>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:700;color:#1a3d5c;">' + sibEsc(item.file_name||'קובץ') + '</div>' +
            '<div style="font-size:10px;color:#8a9aa5;margin-top:2px;">' + new Date(item.created_at).toLocaleString('he-IL') + '</div>' +
          '</div>' +
        '</div>' +
        (item.thumbnail_url ? '<img src="' + item.thumbnail_url + '" style="width:100%;border-radius:8px;margin-bottom:10px;max-height:180px;object-fit:cover;" />' : '') +
        '<div style="font-size:11px;color:#8a9aa5;text-align:center;padding:10px;">לחץ על כפתורי הניתוח בכרטיס הקובץ</div>' +
      '</div>' +
      sibApprovePanel(item);
  }
}

function sibApprovePanel(item) {
  var projOpts = '<option value="">— בחר פרויקט —</option>' +
    (window.allProjects||[]).map(function(p){
      return '<option value="' + p.id + '"' + (p.id === item.project_id ? ' selected' : '') + '>' + sibEsc(p.project_name) + '</option>';
    }).join('');

  return '<div style="background:#f0faf5;border:1px solid #a5d6a7;border-radius:10px;padding:14px;">' +
    '<div style="font-size:11px;font-weight:700;color:#1b7a4a;font-weight:800;margin-bottom:10px;">שייך לפרויקט ואשר</div>' +
    '<select id="sib-proj-sel-' + item.id + '" style="width:100%;background:#fff;border:1px solid rgba(180,140,60,0.3);color:#2c4a6e;border-radius:8px;padding:8px 12px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;margin-bottom:8px;">' + projOpts + '</select>' +
    '<button onclick="sibApproveWithProject(\'' + item.id + '\')" style="width:100%;padding:10px;background:linear-gradient(135deg,#0d9488,#0f766e);border:none;color:#1a3d5c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">✅ אשר ושייך לפרויקט</button>' +
    '</div>';
}

// ── AI ANALYSIS ───────────────────────────────────────────────────────
async function sibAnalyze(id, mode) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;

  sibSelectItem(id);
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) {
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#9a6f00;font-size:13px;">' +
      '<div style="font-size:28px;margin-bottom:12px;animation:spin 1s linear infinite;">⚙️</div>' +
      'Claude מנתח את הקובץ...' +
      '</div>' +
      '<style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>';
  }

  var apiKey = _sibApiKey || (window.APP_CONFIG && window.APP_CONFIG.openai_key);
  if (!apiKey) {
    sibShowError('לא נמצא מפתח API — הגדר openai_key ב-app_config');
    return;
  }

  var prompts = {
    general:     'נתח את התמונה מהשטח הבנייה הזה. זהה: מה מצולם, מה הסטטוס, האם יש בעיות, מה המלצתך. ענה בעברית, קצר וברור.',
    engineering: 'נתח את התמונה מהנדסית: עובי שכבות, איכות ביצוע, חריגות מהמפרט, ממצאים לדוח הנדסי. עברית.',
    safety:      'נתח בטיחות: זהה סיכונים, ציוד מגן חסר, הפרות תקן, ליקויים מסוכנים. דרג חומרה: גבוה/בינוני/נמוך. עברית.',
  };

  try {
    var messages = [{
      role: 'user',
      content: item.cloudinary_url ? [
        { type: 'image', source: { type: 'url', url: item.cloudinary_url } },
        { type: 'text', text: prompts[mode] || prompts.general }
      ] : [{ type: 'text', text: 'קובץ ללא URL זמין. ' + (prompts[mode] || prompts.general) }]
    }];

    var resp = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: 'אתה מהנדס שטח מנוסה. ענה תמיד בעברית. היה ספציפי, קצר, עם המלצות פעולה ברורות.',
      messages: messages
    }, null);

    var result = {
      mode: mode,
      text: resp && resp.content && resp.content[0] ? resp.content[0].text : 'אין תגובה',
      timestamp: new Date().toISOString()
    };

    _sibAnalysis[id] = result;
    sibShowAnalysis(id, result);

  } catch(e) {
    sibShowError('שגיאת ניתוח: ' + e.message);
  }
}

function sibShowAnalysis(id, result) {
  var panel = document.getElementById('sib-analysis-panel');
  if (!panel) return;
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;

  var modeLabel = { general: 'כללי', engineering: 'הנדסי', safety: 'בטיחות' }[result.mode] || result.mode;
  var modeColor = { general: '#3b82f6', engineering: '#f59e0b', safety: '#ef4444' }[result.mode] || '#aaa';

  // Parse severity if safety
  var severity = '';
  if (result.mode === 'safety') {
    if (/גבוה/.test(result.text)) severity = '<span style="background:rgba(239,68,68,0.15);color:#fca5a5;border-radius:4px;padding:2px 8px;font-size:10px;margin-right:6px;">🔴 גבוה</span>';
    else if (/בינוני/.test(result.text)) severity = '<span style="background:rgba(245,158,11,0.15);color:#9a6f00;border-radius:4px;padding:2px 8px;font-size:10px;margin-right:6px;">🟡 בינוני</span>';
    else severity = '<span style="background:rgba(16,185,129,0.15);color:#1b5e20;border-radius:4px;padding:2px 8px;font-size:10px;margin-right:6px;">🟢 נמוך</span>';
  }

  panel.innerHTML =
    '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;padding:14px;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-size:10px;padding:2px 10px;border-radius:20px;background:' + modeColor + '22;color:' + modeColor + ';border:1px solid ' + modeColor + '44;">ניתוח ' + modeLabel + '</span>' +
          severity +
        '</div>' +
        '<span style="font-size:9px;color:#b0bec5;">' + new Date(result.timestamp).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}) + '</span>' +
      '</div>' +
      '<div style="font-size:12px;color:#2c4a6e;line-height:1.8;white-space:pre-wrap;direction:rtl;">' + sibEsc(result.text) + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<div style="background:#fffbf0;border:1px solid rgba(180,140,60,0.3);border-radius:8px;padding:8px;margin-bottom:4px;width:100%;">' +
        '<div style="font-size:10px;color:#9a6f00;font-weight:800;margin-bottom:5px;">💾 שמור כדוח ביומן</div>' +
        '<select id="sib-save-proj-' + id + '" style="width:100%;background:#fff;border:1px solid rgba(180,140,60,0.3);color:#2c4a6e;border-radius:6px;padding:5px 8px;font-family:Heebo,sans-serif;font-size:11px;direction:rtl;margin-bottom:5px;">' +
          '<option value="">— בחר פרויקט (אופציונלי) —</option>' +
          (window.allProjects||[]).map(function(p){ return '<option value="' + p.id + '"' + (p.id === item.project_id ? ' selected' : '') + '>' + sibEsc(p.project_name) + '</option>'; }).join('') +
        '</select>' +
        '<button onclick="sibSaveAnalysisAsNote(\'' + id + '\')" style="width:100%;padding:7px;background:#f5e9c4;border:1px solid rgba(180,140,60,0.4);color:#9a6f00;border-radius:6px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">💾 שמור ביומן מזכרים</button>' +
      '</div>' +
      '<button onclick="sibSaveToEnc(\'' + id + '\')" style="flex:1;padding:8px;background:#ede7f6;border:1px solid #9c6fdd;color:#4527a0;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">📚 לאנציקלופדיה</button>' +
      '<button onclick="sibCopyAnalysis(\'' + id + '\')" style="padding:8px 12px;background:#f5f0e8;border:1px solid rgba(180,140,60,0.25);color:#7a8a95;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">📋 העתק</button>' +
      '<button onclick="switchTab(\'rag\')" style="padding:8px 12px;background:#e8f0fd;border:1px solid rgba(26,61,92,0.2);color:#1a3d5c;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">🏗️ ייעוץ</button>' +
    '</div>' +
    sibApprovePanel(item);
}

function sibShowError(msg) {
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) panel.innerHTML = '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:14px;color:#c62828;font-size:12px;">' + sibEsc(msg) + '</div>';
}

// ── TRANSCRIBE AUDIO ──────────────────────────────────────────────────
async function sibTranscribe(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  sibSelectItem(id);

  var panel = document.getElementById('sib-analysis-panel');
  if (panel) panel.innerHTML = '<div style="text-align:center;padding:40px;color:#1b7a4a;font-size:13px;">🎙️ מתמלל הקלטה...</div>';

  var elevenlabsKey = null;
  try {
    // Try global APP config first (already loaded by CRM)
    if (window.APP && window.APP.config && window.APP.config.elevenlabs_key) {
      elevenlabsKey = window.APP.config.elevenlabs_key;
    } else {
      var cfg = await sbQ('app_config', 'select=key,value');
      var rows = (cfg.data || []);
      var row = rows.find(function(r){ return r.key === 'elevenlabs_key'; });
      if (row) elevenlabsKey = row.value;
    }
  } catch(e) {}

  if (!elevenlabsKey) {
    sibShowError('לא נמצא מפתח ElevenLabs — הגדר elevenlabs_key ב-app_config');
    return;
  }

  if (!item.cloudinary_url) {
    sibShowError('אין URL לקובץ האודיו');
    return;
  }

  try {
    var audioResp = await fetch(item.cloudinary_url);
    var audioBlob = await audioResp.blob();

    // Fix MIME type — Samsung records .m4a/.3gp with empty or wrong MIME
    var fileName = item.file_name || 'audio.m4a';
    var mimeType = audioBlob.type;
    if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'video/3gpp') {
      var ext = fileName.split('.').pop().toLowerCase();
      var mimeMap = { m4a:'audio/mp4', mp3:'audio/mpeg', wav:'audio/wav',
                      ogg:'audio/ogg', webm:'audio/webm', aac:'audio/aac',
                      '3gp':'audio/3gpp', flac:'audio/flac' };
      mimeType = mimeMap[ext] || 'audio/mp4';
    }
    var fixedBlob = new Blob([audioBlob], { type: mimeType });

    var formData = new FormData();
    formData.append('file', fixedBlob, fileName);
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'he');
    formData.append('diarize', 'true');
    formData.append('tag_audio_events', 'false');
    formData.append('timestamps_granularity', 'none');

    var transcResp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elevenlabsKey },
      body: formData
    });

    if (!transcResp.ok) {
      var errBody = '';
      try { var errJson = await transcResp.json(); errBody = JSON.stringify(errJson); } catch(e2) {}
      throw new Error('ElevenLabs HTTP ' + transcResp.status + (errBody ? ' — ' + errBody : ''));
    }
    var transcData = await transcResp.json();
    var transcript = transcData.text || '';

    var result = { mode: 'transcription', text: transcript, timestamp: new Date().toISOString() };
    _sibAnalysis[id] = result;

    var panel2 = document.getElementById('sib-analysis-panel');
    if (panel2) {
      panel2.innerHTML =
        '<div style="background:#f0faf5;border:1px solid #a5d6a7;border-radius:10px;padding:14px;margin-bottom:10px;">' +
          '<div style="font-size:10px;color:#1b7a4a;font-weight:800;margin-bottom:8px;">תמלול שיחה</div>' +
          '<div style="font-size:12px;color:#2c4a6e;line-height:1.8;white-space:pre-wrap;direction:rtl;max-height:250px;overflow-y:auto;">' + sibEsc(transcript) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
          '<button onclick="sibOpenFullAnalysis(\'' + id + '\')" style="flex:1;padding:9px;background:#1a3d5c;color:#fff;border:1px solid #1a3d5c;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">🤖 נתח + עריכת דוברים</button>' +
          '<button onclick="sibSaveToJournal(\'' + id + '\')" style="flex:1;padding:9px;background:#f5f0e8;color:#5a6f7c;border:1px solid rgba(180,140,60,0.3);border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">📋 שמור ביומן</button>' +
        '</div>' +
        sibApprovePanel(item);
    }
  } catch(e) {
    sibShowError('שגיאת תמלול: ' + e.message);
  }
}

// ── EXTRACT FRAME ──────────────────────────────────────────────────────
async function sibExtractFrame(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item || !item.cloudinary_url) { sibShowError('אין URL לוידאו'); return; }
  sibSelectItem(id);

  // Use Cloudinary transformation to extract frame
  var frameUrl = item.cloudinary_url.replace('/upload/', '/upload/so_1,w_800/').replace('.mp4', '.jpg').replace('.mov', '.jpg').replace('.avi', '.jpg');
  var panel = document.getElementById('sib-analysis-panel');
  if (panel) {
    panel.innerHTML =
      '<div style="background:#fff;border:1px solid rgba(180,140,60,0.25);border-radius:10px;padding:14px;margin-bottom:10px;">' +
        '<div style="font-size:10px;color:#9a6f00;font-weight:800;margin-bottom:8px;">🎞️ פריים חולץ</div>' +
        '<img src="' + frameUrl + '" style="width:100%;border-radius:8px;margin-bottom:10px;" onerror="this.style.display=\'none\'">' +
        '<div style="font-size:11px;color:#8a9aa5;text-align:center;">שניה 1 מתוך הוידאו</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<button onclick="sibAnalyzeFrame(\'' + id + '\',\'' + frameUrl + '\')" style="flex:1;padding:9px;background:#1a3d5c;color:#fff;border:1px solid #1a3d5c;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;">🔍 נתח פריים</button>' +
        '<button onclick="sibAnalyzeFrame(\'' + id + '\',\'' + frameUrl + '\',\'safety\')" style="flex:1;padding:9px;background:#fff5f5;color:#c62828;border:1px solid #fca5a5;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;cursor:pointer;">⚠️ בטיחות</button>' +
      '</div>' +
      sibApprovePanel(item);
  }
}

async function sibAnalyzeFrame(id, frameUrl, mode) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  // Create a temporary item copy with the frame URL for analysis
  var tempItem = Object.assign({}, item, { cloudinary_url: frameUrl, file_type: 'image' });
  _sibItems.push(tempItem);
  var realItem = _sibItems.find(function(i){ return i.id === id; });
  if (realItem) realItem._frameUrl = frameUrl;

  await sibAnalyze(id, mode || 'general');
}

// ── ANALYZE PDF ───────────────────────────────────────────────────────
async function sibAnalyzePDF(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  sibSelectItem(id);

  var apiKey = _sibApiKey || (window.APP_CONFIG && window.APP_CONFIG.openai_key);
  if (!apiKey) { sibShowError('לא נמצא מפתח API'); return; }

  var panel = document.getElementById('sib-analysis-panel');
  if (panel) panel.innerHTML = '<div style="text-align:center;padding:40px;color:#c62828;font-weight:800;font-size:13px;">📄 מנתח מסמך PDF...</div>';

  try {
    var resp = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: 'URL של מסמך PDF: ' + (item.cloudinary_url || 'אין URL') + '\n\nנתח את המסמך: מהו, מה כולל, נקודות עיקריות, פעולות נדרשות. עברית.' }]
    }, null);

    var text = resp && resp.content && resp.content[0] ? resp.content[0].text : 'אין תגובה';
    var result = { mode: 'pdf', text: text, timestamp: new Date().toISOString() };
    _sibAnalysis[id] = result;
    sibShowAnalysis(id, result);
  } catch(e) {
    sibShowError('שגיאה: ' + e.message);
  }
}

// ── SAVE ACTIONS ──────────────────────────────────────────────────────
async function sibSaveAnalysisAsNote(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  var analysis = _sibAnalysis[id];
  if (!item || !analysis) return;

  // Read project from selector if present
  var sel = document.getElementById('sib-save-proj-' + id);
  var projectId = (sel && sel.value) ? sel.value : (item.project_id || null);
  var modeLabel = { general: 'כללי', engineering: 'הנדסי', safety: 'בטיחות', pdf: 'PDF', transcription: 'תמלול' }[analysis.mode] || analysis.mode;
  var proj = (window.allProjects||[]).find(function(p){ return p.id === projectId; });
  var projName = proj ? proj.project_name : '';

  try {
    await sb.from('beni_notes').insert({
      note_text: '📊 דוח AI — ' + modeLabel + (projName ? ' | ' + projName : '') + '\n\n' + analysis.text,
      note_type: 'text',
      photo_url: item.cloudinary_url || null,
      project_id: projectId,
      color: 'blue',
      created_at: new Date().toISOString()
    });
    showToast('✅ נשמר ביומן מזכרים' + (projName ? ' — ' + projName : ''), 'success');
    // Also update item project if selected
    if (projectId && projectId !== item.project_id) {
      await fetch(SB_URL + '/rest/v1/asset_inbox?id=eq.' + id, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ project_id: projectId })
      });
      item.project_id = projectId;
    }
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

async function sibSaveToEnc(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  var analysis = _sibAnalysis[id];

  try {
    await sb.from('field_encyclopedia').insert({
      category: 'שטח',
      title: item.file_name || 'קובץ מהשטח',
      description: analysis ? analysis.text : 'קובץ מהתיבה',
      media_url: item.cloudinary_url || null,
      media_type: item.file_type || 'image',
      severity: 'guideline',
      source_project_id: item.project_id || null,
      created_at: new Date().toISOString()
    });
    showToast('✅ נשמר לאנציקלופדיה','success');
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

async function sibSaveToJournal(id) {
  var item = _sibItems.find(function(i){ return i.id === id; });
  if (!item) return;
  var analysis = _sibAnalysis[id];

  try {
    await sb.from('beni_notes').insert({
      note_text: analysis ? analysis.text : ('קובץ: ' + (item.file_name || '')),
      note_type: item.file_type === 'audio' ? 'audio' : 'text',
      photo_url: item.cloudinary_url || null,
      project_id: item.project_id || null,
      created_at: new Date().toISOString()
    });
    showToast('✅ נשמר ביומן','success');
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

async function sibCopyAnalysis(id) {
  var analysis = _sibAnalysis[id];
  if (!analysis) return;
  try {
    await navigator.clipboard.writeText(analysis.text);
    showToast('✅ הועתק','success');
  } catch(e) {
    showToast('שגיאה בהעתקה', 'error');
  }
}

// ── APPROVE ───────────────────────────────────────────────────────────
async function sibApproveWithProject(id) {
  var sel = document.getElementById('sib-proj-sel-' + id);
  var projId = sel ? sel.value : null;
  await sibApprove(id, projId);
}

async function sibApprove(id, projectId) {
  try {
    var patch = { status: 'approved' };
    if (projectId) patch.project_id = projectId;

    await fetch(SB_URL + '/rest/v1/asset_inbox?id=eq.' + id, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    });

    // Also save to beni_notes if has media
    var item = _sibItems.find(function(i){ return i.id === id; });
    if (item && item.cloudinary_url) {
      await sb.from('beni_notes').insert({
        note_text: item.file_name || 'קובץ מאושר',
        note_type: item.file_type || 'photo',
        photo_url: item.cloudinary_url,
        project_id: projectId || item.project_id || null,
        created_at: new Date().toISOString()
      });
    }

    showToast('✅ אושר ושויך','success');
    _sibSelected = null;
    document.getElementById('sib-analysis-panel').innerHTML =
      '<div style="text-align:center;padding:40px;color:#1b7a4a;font-size:13px;">✅ הקובץ אושר בהצלחה</div>';
    await sibLoad();
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

async function sibDeleteItem(id) {
  if (!confirm('למחוק קובץ זה מהתיבה?')) return;
  try {
    await fetch(SB_URL + '/rest/v1/asset_inbox?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    showToast('🗑️ נמחק','success');
    if (_sibSelected === id) {
      _sibSelected = null;
      var panel = document.getElementById('sib-analysis-panel');
      if (panel) panel.innerHTML = '<div style="text-align:center;padding:60px;color:#b0bec5;font-size:13px;">בחר קובץ מהרשימה</div>';
    }
    await sibLoad();
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

// ── FILTER ────────────────────────────────────────────────────────────
function sibFilterByProject(projId) {
  var listEl = document.getElementById('sib-file-list');
  if (!listEl) return;
  var filtered = projId ? _sibItems.filter(function(i){ return i.project_id === projId; }) : _sibItems;
  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#b0bec5;font-size:12px;">אין קבצים לפרויקט זה</div>';
    return;
  }
  filtered.forEach(function(item) { listEl.appendChild(sibFileCard(item)); });
}

function sibPopulateProjects() {
  var sel = document.getElementById('sib-proj-filter');
  if (!sel) return;
  (window.allProjects||[]).forEach(function(p) {
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.project_name;
    sel.appendChild(o);
  });
}

// ── Open full analysis modal with speaker name editor ─────────────────
function sibOpenFullAnalysis(id) {
  var analysis = _sibAnalysis[id];
  if (!analysis || !analysis.text) {
    sibShowError('אין תמלול — תמלל קודם'); return;
  }
  var item = _sibItems.find(function(i){ return i.id === id; });
  var projId = item ? item.project_id : null;
  // openCallAnalysisModal lives in index.html — gives speaker A/B name editor
  if (typeof openCallAnalysisModal === 'function') {
    openCallAnalysisModal(analysis.text, projId, item);
  } else {
    // fallback — direct analysis without editor
    sibAnalyzeTranscript(id);
  }
}

async function sibAnalyzeTranscript(id) {
  var analysis = _sibAnalysis[id];
  if (!analysis || !analysis.text) return;

  var apiKey = _sibApiKey || (window.APP_CONFIG && window.APP_CONFIG.openai_key);
  if (!apiKey) { sibShowError('אין מפתח API'); return; }

  var panel = document.getElementById('sib-analysis-panel');
  if (panel) panel.innerHTML = '<div style="text-align:center;padding:40px;color:#9a6f00;font-size:13px;">🤖 מנתח תמלול...</div>';

  try {
    var resp = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: 'אתה מנהל פרויקטים. נתח שיחה ותמצה: נושאים עיקריים, החלטות, משימות לביצוע, דדליינים. עברית.',
      messages: [{ role: 'user', content: 'תמלול שיחה:\n\n' + analysis.text }]
    }, null);

    var text = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
    var usage = resp && resp.usage;
    var newResult = { mode: 'analysis', text: text, timestamp: new Date().toISOString(), usage: usage };
    _sibAnalysis[id] = newResult;
    sibShowAnalysis(id, newResult);
    // Show token/cost meter
    if (usage) {
      var inputT  = usage.input_tokens  || 0;
      var outputT = usage.output_tokens || 0;
      var costUSD = (inputT * 3 + outputT * 15) / 1000000;
      var panel3  = document.getElementById('sib-analysis-panel');
      if (panel3) {
        var meter = document.createElement('div');
        meter.style.cssText = 'background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:6px 10px;margin-top:8px;font-size:10px;color:#888;display:flex;gap:10px;flex-wrap:wrap;';
        meter.innerHTML = '🔢 <b style="color:#c9a84c">'+(inputT+outputT).toLocaleString()+'</b> טוקנים' +
          ' · 📥 '+inputT.toLocaleString()+' · 📤 '+outputT.toLocaleString() +
          ' · 💰 <b style="color:#c9a84c">$'+costUSD.toFixed(4)+'</b>';
        panel3.appendChild(meter);
      }
    }
  } catch(e) {
    sibShowError('שגיאה: ' + e.message);
  }
}

// ── BATCH ANALYZE ────────────────────────────────────────────────────
async function sibBatchAnalyze() {
  var toAnalyze = _sibItems.filter(function(i){
    var chk = _sibChecked[i.id] || {};
    return chk.safety || chk.engineering || chk.standards;
  });
  if (!toAnalyze.length) {
    showToast('בחר לפחות קובץ אחד עם סוג ניתוח','error'); return;
  }
  showToast('🚀 מנתח ' + toAnalyze.length + ' קבצים...','success');
  for (var i = 0; i < toAnalyze.length; i++) {
    var item = toAnalyze[i];
    var chk = _sibChecked[item.id] || {};
    var mode = chk.safety ? 'safety' : chk.engineering ? 'engineering' : 'general';
    sibSelectItem(item.id);
    await sibAnalyze(item.id, mode);
    await new Promise(function(r){ setTimeout(r, 800); }); // brief pause between calls
  }
  showToast('✅ ניתוח הושלם','success');
}

// ── UTILS ─────────────────────────────────────────────────────────────
function sibEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── assetInboxLoad override — wire to sibInit ─────────────────────────
function assetInboxLoad() {
  sibInit();
}
