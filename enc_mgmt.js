// enc_mgmt.js — אנציקלופדיה מקצועית — Encyclopedia Management
// Full CRUD by trade category, auto-send with PO, cream/gold theme
// Loaded dynamically by index.html via _fetchEncMgmt()

// ── STATE ─────────────────────────────────────────────────────────────
var _emItems    = [];
var _emFilter   = { cat: '', search: '', severity: '' };
var _emApiKey   = null;

var EM_TRADES = [
  'איטום וציפוי', 'ריצוף וחיפוי', 'בטיחות שטח', 'חשמל ואינסטלציה',
  'אינסטלציה', 'גבס ותקרות', 'טיח וצבע', 'מסגרות ואלומיניום',
  'עבודות בטון', 'פיתוח שטח', 'שלד ויסודות', 'אחר'
];

var EM_SEVERITIES = [
  { val: 'critical',  label: 'קריטי',  color: '#c62828', bg: '#fff5f5' },
  { val: 'important', label: 'חשוב',   color: '#e65100', bg: '#fff8f0' },
  { val: 'guideline', label: 'הנחיה',  color: '#1b5e20', bg: '#f0faf5' },
];

// ── INIT ──────────────────────────────────────────────────────────────
async function emInit() {
  var panel = document.getElementById('encyclopedia-panel');
  if (!panel) return;

  try {
    var cfg = await sbQ('app_config', 'select=key,value');
    var rows = cfg.data || [];
    var k = rows.find(function(r){ return r.key === 'openai_key' || r.key === 'anthropic_key'; });
    if (k) _emApiKey = k.value;
  } catch(e) {}

  panel.innerHTML = emHTML();
  await emLoad();
}

function emHTML() {
  return `<div id="em-root" style="min-height:100vh;background:#fdf6e3;font-family:Heebo,sans-serif;direction:rtl;">

  <!-- TOPBAR -->
  <div style="background:#f5e9c4;border-bottom:2px solid #c9a84c;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
    <div>
      <div style="font-size:9px;letter-spacing:3px;color:#9a6f00;font-weight:800;text-transform:uppercase;margin-bottom:3px;">Field Encyclopedia</div>
      <div style="font-size:18px;font-weight:900;color:#1a3d5c;">📚 אנציקלופדיה מקצועית</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="emOpenAdd()" style="background:linear-gradient(135deg,#c9a84c,#9a6f00);border:none;color:#fff;padding:9px 18px;border-radius:9px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">➕ הוסף ידע חדש</button>
      <button onclick="emLoad()" style="background:#f5e9c4;border:1px solid rgba(180,140,60,0.4);color:#9a6f00;padding:9px 14px;border-radius:9px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🔄 רענן</button>
    </div>
  </div>

  <!-- STATS BAR -->
  <div id="em-stats" style="display:flex;gap:8px;padding:10px 20px;background:#fdf6e3;border-bottom:1px solid rgba(180,140,60,0.15);flex-wrap:wrap;"></div>

  <!-- SEARCH + FILTERS -->
  <div style="padding:14px 20px;background:#fffbf0;border-bottom:1px solid rgba(180,140,60,0.15);display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
    <input id="em-search" type="text" placeholder="🔍 חפש כותרת, תיאור, קטגוריה..."
      oninput="_emFilter.search=this.value;emRenderGrid()"
      style="flex:2;min-width:200px;background:#fff;border:1.5px solid rgba(180,140,60,0.3);color:#1a3d5c;padding:9px 14px;border-radius:9px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;font-weight:700;">
    <select id="em-sev-filter" onchange="_emFilter.severity=this.value;emRenderGrid()"
      style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);color:#1a3d5c;padding:9px 12px;border-radius:9px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">
      <option value="">כל החומרות</option>
      <option value="critical">🔴 קריטי</option>
      <option value="important">🟡 חשוב</option>
      <option value="guideline">🟢 הנחיה</option>
    </select>
  </div>

  <!-- TRADE TABS -->
  <div id="em-trade-tabs" style="display:flex;gap:0;overflow-x:auto;background:#f5e9c4;border-bottom:2px solid rgba(180,140,60,0.3);padding:0 8px;"></div>

  <!-- GRID -->
  <div style="padding:20px;">
    <div id="em-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      <div style="text-align:center;padding:40px;color:#c9a84c;font-size:13px;font-weight:700;">טוען...</div>
    </div>
  </div>

  <!-- ADD/EDIT MODAL -->
  <div id="em-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9000;align-items:center;justify-content:center;padding:20px;">
    <div style="background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);direction:rtl;">
      <div style="background:#f5e9c4;border-bottom:2px solid #c9a84c;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-radius:16px 16px 0 0;">
        <div style="font-size:16px;font-weight:900;color:#1a3d5c;" id="em-modal-title">➕ הוסף ידע חדש</div>
        <button onclick="emCloseModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#9a6f00;">×</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:12px;">
        <input type="hidden" id="em-edit-id">

        <div>
          <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">כותרת *</label>
          <input id="em-f-title" placeholder="שם הידע / הנחיה..."
            style="width:100%;border:1.5px solid rgba(180,140,60,0.3);border-radius:8px;padding:9px 12px;font-family:Heebo,sans-serif;font-size:13px;color:#1a3d5c;font-weight:700;direction:rtl;box-sizing:border-box;">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">מקצוע / קטגוריה *</label>
            <select id="em-f-cat" style="width:100%;border:1.5px solid rgba(180,140,60,0.3);border-radius:8px;padding:9px;font-family:Heebo,sans-serif;font-size:12px;color:#1a3d5c;font-weight:700;direction:rtl;">
              ${EM_TRADES.map(function(t){ return '<option>'+t+'</option>'; }).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">חומרה</label>
            <select id="em-f-sev" style="width:100%;border:1.5px solid rgba(180,140,60,0.3);border-radius:8px;padding:9px;font-family:Heebo,sans-serif;font-size:12px;color:#1a3d5c;font-weight:700;">
              <option value="guideline">🟢 הנחיה</option>
              <option value="important">🟡 חשוב</option>
              <option value="critical">🔴 קריטי</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">תיאור / הסבר</label>
          <textarea id="em-f-desc" rows="4" placeholder="פרט את ההנחיה, מה לעשות, מה להימנע..."
            style="width:100%;border:1.5px solid rgba(180,140,60,0.3);border-radius:8px;padding:9px 12px;font-family:Heebo,sans-serif;font-size:12px;color:#1a3d5c;font-weight:700;direction:rtl;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <div>
          <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">תגיות (מופרדות בפסיק)</label>
          <input id="em-f-tags" placeholder="PPE, ביקורת, בטיחות..."
            style="width:100%;border:1.5px solid rgba(180,140,60,0.3);border-radius:8px;padding:9px 12px;font-family:Heebo,sans-serif;font-size:12px;color:#1a3d5c;font-weight:700;direction:rtl;box-sizing:border-box;">
        </div>

        <div>
          <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">תמונה / וידאו (אופציונלי)</label>
          <label style="display:flex;align-items:center;gap:8px;background:#fffbf0;border:2px dashed rgba(180,140,60,0.3);border-radius:8px;padding:12px;cursor:pointer;">
            <span style="font-size:20px;">📷</span>
            <div>
              <div style="font-size:12px;font-weight:800;color:#9a6f00;">בחר קובץ</div>
              <div style="font-size:10px;color:#b8860b;">תמונה, וידאו או PDF</div>
            </div>
            <input type="file" id="em-f-file" accept="image/*,video/*,.pdf" style="display:none;" onchange="emPreviewFile(this)">
          </label>
          <div id="em-f-preview" style="margin-top:8px;"></div>
          <input type="hidden" id="em-f-media-url">
          <input type="hidden" id="em-f-media-type">
        </div>

        <div>
          <label style="font-size:11px;font-weight:800;color:#5a4010;display:block;margin-bottom:4px;">קשר לפרויקט (אופציונלי)</label>
          <select id="em-f-proj" style="width:100%;border:1.5px solid rgba(180,140,60,0.3);border-radius:8px;padding:9px;font-family:Heebo,sans-serif;font-size:12px;color:#1a3d5c;font-weight:700;direction:rtl;">
            <option value="">ללא</option>
          </select>
        </div>

        <div style="display:flex;gap:8px;margin-top:4px;">
          <button onclick="emSave()" style="flex:2;padding:12px;background:linear-gradient(135deg,#c9a84c,#9a6f00);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">💾 שמור</button>
          <button onclick="emCloseModal()" style="flex:1;padding:12px;background:#f5f0e8;border:1px solid rgba(180,140,60,0.3);color:#9a6f00;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">ביטול</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ── LOAD ──────────────────────────────────────────────────────────────
async function emLoad() {
  try {
    var { data } = await sbQ('field_encyclopedia',
      'order=created_at.desc&limit=200&select=id,category,title,description,media_url,media_type,severity,tags,created_at,source_project_id');
    _emItems = data || [];
  } catch(e) {
    _emItems = [];
  }
  emRenderStats();
  emRenderTradeTabs();
  emRenderGrid();
  emPopulateProjects();
}

// ── STATS ─────────────────────────────────────────────────────────────
function emRenderStats() {
  var el = document.getElementById('em-stats');
  if (!el) return;
  var total = _emItems.length;
  var critical = _emItems.filter(function(i){ return i.severity === 'critical'; }).length;
  var cats = {};
  _emItems.forEach(function(i){ cats[i.category] = (cats[i.category]||0)+1; });
  var topCat = Object.keys(cats).sort(function(a,b){ return cats[b]-cats[a]; })[0] || '—';

  el.innerHTML = [
    ['📚', total, 'פריטים'],
    ['🔴', critical, 'קריטיים'],
    ['📁', Object.keys(cats).length, 'קטגוריות'],
    ['🏆', topCat, ''],
  ].map(function(s){
    return '<div style="display:flex;align-items:center;gap:5px;background:#fff;border:1px solid rgba(180,140,60,0.2);border-radius:6px;padding:5px 12px;">' +
      '<span style="font-size:14px;">' + s[0] + '</span>' +
      '<span style="font-size:15px;font-weight:900;color:#1a3d5c;">' + s[1] + '</span>' +
      (s[2] ? '<span style="font-size:10px;color:#9a6f00;font-weight:700;">' + s[2] + '</span>' : '') +
    '</div>';
  }).join('');
}

// ── TRADE TABS ────────────────────────────────────────────────────────
function emRenderTradeTabs() {
  var el = document.getElementById('em-trade-tabs');
  if (!el) return;
  var cats = {};
  _emItems.forEach(function(i){ cats[i.category] = (cats[i.category]||0)+1; });
  var allTrades = [''].concat(Object.keys(cats).sort());

  el.innerHTML = allTrades.map(function(cat) {
    var label = cat === '' ? ('הכל (' + _emItems.length + ')') : (cat + ' (' + (cats[cat]||0) + ')');
    var active = _emFilter.cat === cat;
    return '<button onclick="_emFilter.cat=\''+emEsc(cat)+'\';emRenderTradeTabs();emRenderGrid();" style="padding:9px 14px;border:none;border-bottom:3px solid '+(active?'#c9a84c':'transparent')+';background:'+(active?'rgba(255,255,255,0.7)':'transparent')+';font-family:Heebo,sans-serif;font-size:11px;font-weight:'+(active?'900':'700')+';color:'+(active?'#1a3d5c':'#9a6f00')+';cursor:pointer;white-space:nowrap;transition:all .15s;">'+label+'</button>';
  }).join('');
}

// ── GRID ──────────────────────────────────────────────────────────────
function emRenderGrid() {
  var el = document.getElementById('em-grid');
  if (!el) return;

  var search = (_emFilter.search||'').toLowerCase();
  var filtered = _emItems.filter(function(i) {
    if (_emFilter.cat && i.category !== _emFilter.cat) return false;
    if (_emFilter.severity && i.severity !== _emFilter.severity) return false;
    if (search && !(i.title+' '+(i.description||'')+' '+(i.category||'')).toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#c9a84c;font-size:13px;font-weight:700;">' +
      (search || _emFilter.cat || _emFilter.severity ? '🔍 אין תוצאות לחיפוש זה' : '📚 האנציקלופדיה ריקה — הוסף ידע ראשון!') + '</div>';
    return;
  }

  el.innerHTML = '';
  filtered.forEach(function(item) {
    el.appendChild(emCard(item));
  });
}

function emCard(item) {
  var sev = EM_SEVERITIES.find(function(s){ return s.val === item.severity; }) || EM_SEVERITIES[2];
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border:1.5px solid rgba(180,140,60,0.2);border-top:3px solid '+sev.color+';border-radius:12px;overflow:hidden;direction:rtl;transition:box-shadow .15s;';
  card.onmouseover = function(){ this.style.boxShadow='0 4px 16px rgba(180,140,60,0.15)'; };
  card.onmouseout  = function(){ this.style.boxShadow='none'; };

  var mediaHtml = '';
  if (item.media_url) {
    if (item.media_type === 'photo' || item.media_type === 'image') {
      mediaHtml = '<img src="'+item.media_url+'" style="width:100%;height:140px;object-fit:cover;cursor:pointer;" onclick="window.open(\''+item.media_url+'\',\'_blank\')">';
    } else if (item.media_type === 'video') {
      mediaHtml = '<div style="height:80px;background:#f5e9c4;display:flex;align-items:center;justify-content:center;font-size:32px;cursor:pointer;" onclick="window.open(\''+item.media_url+'\',\'_blank\')">🎥</div>';
    } else if (item.media_type === 'pdf') {
      mediaHtml = '<div style="height:60px;background:#fff5f5;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;" onclick="window.open(\''+item.media_url+'\',\'_blank\')">📄</div>';
    }
  }

  var tags = (item.tags||'').split(',').filter(Boolean).map(function(t){
    return '<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:#f5e9c4;color:#9a6f00;border:1px solid rgba(180,140,60,0.2);font-weight:700;">'+emEsc(t.trim())+'</span>';
  }).join('');

  var timeStr = new Date(item.created_at).toLocaleDateString('he-IL');

  card.innerHTML = mediaHtml +
    '<div style="padding:12px;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:6px;">' +
        '<div style="font-size:13px;font-weight:900;color:#1a3d5c;line-height:1.3;">' + emEsc(item.title) + '</div>' +
        '<span style="font-size:9px;padding:2px 8px;border-radius:10px;background:'+sev.bg+';color:'+sev.color+';border:1px solid '+sev.color+'44;font-weight:800;white-space:nowrap;flex-shrink:0;">' + sev.label + '</span>' +
      '</div>' +
      '<div style="font-size:10px;color:#c9a84c;font-weight:800;margin-bottom:6px;">📁 ' + emEsc(item.category) + '</div>' +
      (item.description ? '<div style="font-size:11px;color:#5a4010;font-weight:600;line-height:1.6;margin-bottom:8px;">' + emEsc(item.description).substring(0,160) + (item.description.length>160?'...':'') + '</div>' : '') +
      (tags ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">' + tags + '</div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(180,140,60,0.15);">' +
        '<span style="font-size:9px;color:#b8860b;font-weight:700;">' + timeStr + '</span>' +
        '<div style="display:flex;gap:5px;">' +
          '<button onclick="emSendWithPO(\''+item.id+'\')" style="font-size:10px;padding:3px 8px;border-radius:6px;background:#f5e9c4;border:1px solid rgba(180,140,60,0.3);color:#9a6f00;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;" title="שלח עם הזמנת עבודה">📤 שלח עם PO</button>' +
          '<button onclick="emOpenEdit(\''+item.id+'\')" style="font-size:10px;padding:3px 8px;border-radius:6px;background:#e8f0fd;border:1px solid rgba(59,130,246,0.2);color:#1a3d5c;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">✏️ ערוך</button>' +
          '<button onclick="emDelete(\''+item.id+'\')" style="font-size:10px;padding:3px 8px;border-radius:6px;background:#fff5f5;border:1px solid rgba(198,40,40,0.2);color:#c62828;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">🗑️</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  return card;
}

// ── ADD / EDIT ────────────────────────────────────────────────────────
function emOpenAdd() {
  document.getElementById('em-modal-title').textContent = '➕ הוסף ידע חדש';
  document.getElementById('em-edit-id').value = '';
  document.getElementById('em-f-title').value = '';
  document.getElementById('em-f-desc').value = '';
  document.getElementById('em-f-tags').value = '';
  document.getElementById('em-f-media-url').value = '';
  document.getElementById('em-f-media-type').value = '';
  document.getElementById('em-f-preview').innerHTML = '';
  document.getElementById('em-f-sev').value = 'guideline';
  document.getElementById('em-f-cat').value = EM_TRADES[0];
  document.getElementById('em-modal').style.display = 'flex';
}

function emOpenEdit(id) {
  var item = _emItems.find(function(i){ return i.id === id; });
  if (!item) return;
  document.getElementById('em-modal-title').textContent = '✏️ ערוך פריט';
  document.getElementById('em-edit-id').value = id;
  document.getElementById('em-f-title').value = item.title || '';
  document.getElementById('em-f-desc').value = item.description || '';
  document.getElementById('em-f-tags').value = item.tags || '';
  document.getElementById('em-f-media-url').value = item.media_url || '';
  document.getElementById('em-f-media-type').value = item.media_type || '';
  document.getElementById('em-f-sev').value = item.severity || 'guideline';
  document.getElementById('em-f-cat').value = item.category || EM_TRADES[0];
  document.getElementById('em-f-proj').value = item.source_project_id || '';
  var prev = document.getElementById('em-f-preview');
  if (item.media_url && (item.media_type === 'photo' || item.media_type === 'image')) {
    prev.innerHTML = '<img src="'+item.media_url+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;">';
  } else {
    prev.innerHTML = '';
  }
  document.getElementById('em-modal').style.display = 'flex';
}

function emCloseModal() {
  document.getElementById('em-modal').style.display = 'none';
}

async function emPreviewFile(input) {
  var file = input.files[0];
  if (!file) return;
  var prev = document.getElementById('em-f-preview');
  prev.innerHTML = '<div style="color:#9a6f00;font-size:11px;font-weight:700;">⏳ מעלה...</div>';

  try {
    var cloudName = 'dqdku88vv';
    var preset = 'beni_field';
    var isVideo = file.type.startsWith('video');
    var isPDF = file.type === 'application/pdf';
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    fd.append('resource_type', isVideo ? 'video' : 'auto');
    var res = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/upload', {method:'POST', body:fd});
    var d = await res.json();
    if (!d.secure_url) throw new Error('Upload failed');
    document.getElementById('em-f-media-url').value = d.secure_url;
    document.getElementById('em-f-media-type').value = isVideo ? 'video' : isPDF ? 'pdf' : 'photo';
    if (!isVideo && !isPDF) {
      prev.innerHTML = '<img src="'+d.secure_url+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;">';
    } else {
      prev.innerHTML = '<div style="font-size:12px;color:#1b7a4a;font-weight:800;">✅ הועלה: ' + file.name + '</div>';
    }
  } catch(e) {
    prev.innerHTML = '<div style="color:#c62828;font-size:11px;">שגיאה: '+e.message+'</div>';
  }
  input.value = '';
}

async function emSave() {
  var id    = document.getElementById('em-edit-id').value;
  var title = document.getElementById('em-f-title').value.trim();
  var cat   = document.getElementById('em-f-cat').value;
  var sev   = document.getElementById('em-f-sev').value;
  var desc  = document.getElementById('em-f-desc').value.trim();
  var tags  = document.getElementById('em-f-tags').value.trim();
  var mUrl  = document.getElementById('em-f-media-url').value;
  var mType = document.getElementById('em-f-media-type').value;
  var proj  = document.getElementById('em-f-proj').value;

  if (!title) { showToast('חובה למלא כותרת','error'); return; }
  if (!cat)   { showToast('חובה לבחור קטגוריה','error'); return; }

  var payload = {
    title: title, category: cat, severity: sev,
    description: desc || null,
    tags: tags || null,
    media_url: mUrl || null,
    media_type: mType || null,
    source_project_id: proj || null,
  };

  try {
    if (id) {
      var { error } = await sb.from('field_encyclopedia').update(payload).eq('id', id);
      if (error) throw error;
      showToast('✅ עודכן','success');
    } else {
      payload.created_at = new Date().toISOString();
      var { error: err2 } = await sb.from('field_encyclopedia').insert(payload);
      if (err2) throw err2;
      showToast('✅ נשמר','success');
    }
    emCloseModal();
    await emLoad();
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

async function emDelete(id) {
  if (!confirm('למחוק פריט זה?')) return;
  try {
    await fetch(SB_URL+'/rest/v1/field_encyclopedia?id=eq.'+id,{
      method:'DELETE', headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}
    });
    showToast('🗑️ נמחק','success');
    await emLoad();
  } catch(e){ showToast('שגיאה: '+e.message,'error'); }
}

// ── SEND WITH PO ──────────────────────────────────────────────────────
function emSendWithPO(id) {
  var item = _emItems.find(function(i){ return i.id === id; });
  if (!item) return;
  var msg = '📚 הנחיות מהאנציקלופדיה המקצועית:\n\n' +
    '📌 ' + item.title + '\n' +
    '📁 ' + item.category + '\n' +
    (item.description ? '\n' + item.description + '\n' : '') +
    (item.severity === 'critical' ? '\n⚠️ חומרה: קריטי — חובה לפעול לפי הנחיות אלו' :
     item.severity === 'important' ? '\n⚡ חומרה: חשוב' : '') +
    (item.media_url ? '\n\n🔗 ' + item.media_url : '');
  try {
    navigator.clipboard.writeText(msg).then(function(){
      showToast('✅ הועתק — הוסף ל-PO','success');
    });
  } catch(e){ showToast('שגיאת העתקה','error'); }
}

// ── POPULATE PROJECTS ─────────────────────────────────────────────────
function emPopulateProjects() {
  var sel = document.getElementById('em-f-proj');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  (window.allProjects||[]).forEach(function(p){
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.project_name;
    sel.appendChild(o);
  });
}

// ── UTILS ─────────────────────────────────────────────────────────────
function emEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Override encInit to use new module ───────────────────────────────
function encInit() { emInit(); }
function encOpenAdd() { emOpenAdd(); }
function encFilter() { _emFilter.search = (document.getElementById('enc-search')||{value:''}).value; emRenderGrid(); }
