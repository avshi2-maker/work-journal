// encyclopedia.js — אנציקלופדיית שטח
// Beni CRM · work-journal · 14042026-v5
// Functions: encInit, encFilter, encFilterByProject, encQueryTabFallback

var _encData = [];
var _encCategories = [];
var _encActiveProject = null;
var _encActiveCategory = null;
var _encSearchTerm = '';

// ── INIT ─────────────────────────────────────────────────────────────────────
async function encInit() {
  if (window._encInitDone) return;
  window._encInitDone = true;
  encRenderSkeleton();
  await encLoadData();
}

function encRenderSkeleton() {
  var controls = document.getElementById('enc-header-controls');
  if (controls) {
    controls.innerHTML =
      '<button onclick="encShowAddModal()" style="background:#1a3d5c;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">➕ ערך חדש</button>' +
      '<button onclick="encLoadData()" style="background:#fff8e8;color:#7a5500;border:1.5px solid #c9a84c;border-radius:8px;padding:9px 14px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-right:6px;">🔄 רענן</button>';
  }
}

// ── LOAD DATA ────────────────────────────────────────────────────────────────
async function encLoadData() {
  var grid = document.getElementById('enc-grid');
  if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-family:Heebo,sans-serif;">⏳ טוען נתונים...</div>';

  try {
    var res = await sbQ('field_encyclopedia', {
      select: '*',
      order: 'created_at.desc',
      filters: [{ col: 'is_deleted', op: 'neq', val: true }]
    });
    _encData = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
    encBuildCategories();
    encRenderFilters();
    encRenderGrid(_encData);
  } catch(e) {
    console.error('[encyclopedia] load failed:', e);
    if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:#c00;font-family:Heebo,sans-serif;">❌ שגיאה בטעינת נתונים<br><small>' + (e.message||e) + '</small></div>';
  }
}

// ── CATEGORIES ───────────────────────────────────────────────────────────────
function encBuildCategories() {
  var cats = {};
  _encData.forEach(function(item) {
    var c = item.category || 'כללי';
    cats[c] = (cats[c] || 0) + 1;
  });
  _encCategories = Object.keys(cats).sort();
  window._encCatCounts = cats;
}

function encRenderFilters() {
  var el = document.getElementById('enc-cat-filters');
  if (!el) return;
  var html = '<span onclick="encSetCategory(null)" style="cursor:pointer;padding:5px 12px;border-radius:20px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;border:1.5px solid ' + (!_encActiveCategory ? '#1a3d5c' : '#ddd') + ';background:' + (!_encActiveCategory ? '#1a3d5c' : '#fff') + ';color:' + (!_encActiveCategory ? '#fff' : '#555') + ';">הכל (' + _encData.length + ')</span>';
  _encCategories.forEach(function(cat) {
    var active = _encActiveCategory === cat;
    html += '<span onclick="encSetCategory(\'' + cat.replace(/'/g,"\\'") + '\')" style="cursor:pointer;padding:5px 12px;border-radius:20px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;border:1.5px solid ' + (active ? '#c9a84c' : '#ddd') + ';background:' + (active ? '#fff8e8' : '#fff') + ';color:' + (active ? '#7a5500' : '#555') + ';">' + cat + ' (' + (window._encCatCounts[cat]||0) + ')</span>';
  });
  el.innerHTML = html;
}

function encSetCategory(cat) {
  _encActiveCategory = cat;
  encRenderFilters();
  encApplyFilters();
}

// ── FILTER ───────────────────────────────────────────────────────────────────
function encFilter() {
  var input = document.getElementById('enc-search');
  _encSearchTerm = input ? input.value.trim().toLowerCase() : '';
  encApplyFilters();
}

function encFilterByProject(projectId) {
  _encActiveProject = projectId || null;
  encApplyFilters();
}

function encApplyFilters() {
  var filtered = _encData.filter(function(item) {
    if (_encActiveProject && item.project_id !== _encActiveProject) return false;
    if (_encActiveCategory && item.category !== _encActiveCategory) return false;
    if (_encSearchTerm) {
      var haystack = ((item.title||'') + ' ' + (item.category||'') + ' ' + (item.tags||'') + ' ' + (item.content||'')).toLowerCase();
      if (haystack.indexOf(_encSearchTerm) === -1) return false;
    }
    return true;
  });
  encRenderGrid(filtered);
}

// ── RENDER GRID ───────────────────────────────────────────────────────────────
function encRenderGrid(items) {
  var grid = document.getElementById('enc-grid');
  if (!grid) return;
  if (!items || items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#aaa;font-family:Heebo,sans-serif;font-size:15px;">אין ערכים תואמים</div>';
    return;
  }
  grid.innerHTML = items.map(function(item) {
    return encCardHTML(item);
  }).join('');
}

function encCardHTML(item) {
  var date = item.created_at ? new Date(item.created_at).toLocaleDateString('he-IL') : '';
  var tags = (item.tags || '').split(',').filter(Boolean).map(function(t) {
    return '<span style="background:#f0e8cc;color:#7a5500;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">' + t.trim() + '</span>';
  }).join(' ');

  var sourceBadge = '';
  if (item.source_type === 'ai_report') sourceBadge = '<span style="background:#e8f4e8;color:#2a7a2a;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">🤖 AI</span>';
  else if (item.source_type === 'manual') sourceBadge = '<span style="background:#e8eef8;color:#1a3d5c;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">✍️ ידני</span>';
  else if (item.source_type === 'photo') sourceBadge = '<span style="background:#fef0e0;color:#a05000;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">📸 תמונה</span>';

  var preview = (item.content || item.ai_report || item.notes || '').substring(0, 180);
  if (preview.length === 180) preview += '...';

  return '<div style="background:#fff;border:1px solid #e8ddb5;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);cursor:pointer;transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow=\'0 4px 16px rgba(0,0,0,0.12)\'" onmouseout="this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.06)\'">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
      '<div style="font-size:9px;letter-spacing:2px;color:#9a6f00;text-transform:uppercase;font-weight:800;">' + (item.category || 'כללי') + '</div>' +
      '<div style="display:flex;gap:4px;align-items:center;">' + sourceBadge + '<span style="font-size:11px;color:#bbb;">' + date + '</span></div>' +
    '</div>' +
    '<div style="font-size:15px;font-weight:900;color:#1a3d5c;margin-bottom:8px;line-height:1.3;">' + (item.title || 'ללא כותרת') + '</div>' +
    (preview ? '<div style="font-size:12px;color:#666;line-height:1.6;margin-bottom:10px;">' + preview + '</div>' : '') +
    (tags ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">' + tags + '</div>' : '') +
    '<div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid #f0e8d0;padding-top:10px;">' +
      '<button onclick="encViewItem(\'' + item.id + '\')" style="background:#1a3d5c;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">👁️ צפה</button>' +
      '<button onclick="encEditItem(\'' + item.id + '\')" style="background:#fff8e8;color:#7a5500;border:1.5px solid #c9a84c;border-radius:6px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✏️ ערוך</button>' +
      '<button onclick="encDeleteItem(\'' + item.id + '\')" style="background:#fff0f0;color:#c00;border:1.5px solid #ffaaaa;border-radius:6px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🗑️</button>' +
    '</div>' +
  '</div>';
}

// ── VIEW ITEM ─────────────────────────────────────────────────────────────────
function encViewItem(id) {
  var item = _encData.find(function(x) { return x.id === id; });
  if (!item) return;
  var content = item.content || item.ai_report || item.notes || '';
  var formatted = content.replace(/\n/g,'<br>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  encOpenModal(
    '📖 ' + (item.title || 'ערך'),
    '<div style="font-size:10px;color:#9a6f00;font-weight:800;letter-spacing:2px;margin-bottom:8px;">' + (item.category||'') + (item.tags ? ' · ' + item.tags : '') + '</div>' +
    '<div style="font-size:14px;line-height:1.8;color:#333;">' + formatted + '</div>' +
    (item.file_url ? '<div style="margin-top:16px;"><a href="' + item.file_url + '" target="_blank" style="color:#1a3d5c;font-weight:700;">📎 קובץ מצורף</a></div>' : ''),
    '<button onclick="encEditItem(\'' + id + '\');encCloseModal()" style="background:#1a3d5c;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">✏️ ערוך</button>'
  );
}

// ── EDIT ITEM ─────────────────────────────────────────────────────────────────
function encEditItem(id) {
  var item = _encData.find(function(x) { return x.id === id; });
  if (!item) return;
  encOpenModal(
    '✏️ עריכת ערך',
    encFormHTML(item),
    '<button onclick="encSaveItem(\'' + id + '\')" style="background:#1a3d5c;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💾 שמור</button>'
  );
}

// ── ADD ITEM ──────────────────────────────────────────────────────────────────
function encShowAddModal() {
  encOpenModal(
    '➕ ערך חדש',
    encFormHTML(null),
    '<button onclick="encSaveItem(null)" style="background:#2a7a2a;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">💾 שמור ערך חדש</button>'
  );
}

function encFormHTML(item) {
  var cats = ['כללי','ביסוס','שלד','גמר','אינסטלציה','חשמל','ריצוף','טיח','צנרת','בטיחות','קבלני משנה','ציוד','חומרים','הנחיות'];
  return '<div style="display:flex;flex-direction:column;gap:12px;">' +
    '<div><label style="font-size:12px;font-weight:700;color:#555;">כותרת</label>' +
    '<input id="enc-form-title" value="' + ((item&&item.title)||'').replace(/"/g,'&quot;') + '" style="width:100%;background:#fffbf0;border:1.5px solid #c9a84c;color:#1a1a1a;padding:9px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;margin-top:4px;"></div>' +
    '<div><label style="font-size:12px;font-weight:700;color:#555;">קטגוריה</label>' +
    '<select id="enc-form-cat" style="width:100%;background:#fffbf0;border:1.5px solid #c9a84c;color:#1a1a1a;padding:9px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;margin-top:4px;">' +
    cats.map(function(c) { return '<option value="' + c + '"' + ((item&&item.category===c)?' selected':'') + '>' + c + '</option>'; }).join('') +
    '</select></div>' +
    '<div><label style="font-size:12px;font-weight:700;color:#555;">תוכן</label>' +
    '<textarea id="enc-form-content" rows="6" style="width:100%;background:#fffbf0;border:1.5px solid #c9a84c;color:#1a1a1a;padding:9px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;margin-top:4px;resize:vertical;">' + ((item&&(item.content||item.notes))||'') + '</textarea></div>' +
    '<div><label style="font-size:12px;font-weight:700;color:#555;">תגיות (מופרדות בפסיק)</label>' +
    '<input id="enc-form-tags" value="' + ((item&&item.tags)||'').replace(/"/g,'&quot;') + '" style="width:100%;background:#fffbf0;border:1.5px solid #c9a84c;color:#1a1a1a;padding:9px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;box-sizing:border-box;margin-top:4px;"></div>' +
  '</div>';
}

// ── SAVE ITEM ─────────────────────────────────────────────────────────────────
async function encSaveItem(id) {
  var title = (document.getElementById('enc-form-title')||{}).value||'';
  var category = (document.getElementById('enc-form-cat')||{}).value||'כללי';
  var content = (document.getElementById('enc-form-content')||{}).value||'';
  var tags = (document.getElementById('enc-form-tags')||{}).value||'';

  if (!title.trim()) { showToast('נא להזין כותרת'); return; }

  var payload = { title: title, category: category, content: content, tags: tags, source_type: 'manual', is_deleted: false };

  try {
    if (id) {
      await sbQ('field_encyclopedia', { method: 'PATCH', id: id, data: payload });
      showToast('✅ הערך עודכן');
    } else {
      await sbQ('field_encyclopedia', { method: 'POST', data: payload });
      showToast('✅ ערך חדש נשמר');
    }
    encCloseModal();
    window._encInitDone = false;
    await encLoadData();
  } catch(e) {
    console.error('[encyclopedia] save failed:', e);
    showToast('❌ שגיאה בשמירה: ' + (e.message||e));
  }
}

// ── DELETE ITEM ───────────────────────────────────────────────────────────────
async function encDeleteItem(id) {
  if (!confirm('למחוק ערך זה?')) return;
  try {
    await sbQ('field_encyclopedia', { method: 'PATCH', id: id, data: { is_deleted: true } });
    showToast('🗑️ הערך נמחק');
    window._encInitDone = false;
    await encLoadData();
  } catch(e) {
    showToast('❌ שגיאה במחיקה');
  }
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function encOpenModal(title, body, footer) {
  var existing = document.getElementById('enc-modal-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'enc-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = function(e) { if (e.target === overlay) encCloseModal(); };

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:Heebo,sans-serif;direction:rtl;">' +
      '<div style="background:#1a3d5c;color:#fff;padding:16px 20px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-size:16px;font-weight:900;">' + title + '</span>' +
        '<button onclick="encCloseModal()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;">✕</button>' +
      '</div>' +
      '<div style="padding:20px;">' + body + '</div>' +
      (footer ? '<div style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px;">' +
        footer +
        '<button onclick="encCloseModal()" style="background:#eee;color:#555;border:none;border-radius:8px;padding:9px 16px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">סגור</button>' +
      '</div>' : '') +
    '</div>';

  document.body.appendChild(overlay);
}

function encCloseModal() {
  var overlay = document.getElementById('enc-modal-overlay');
  if (overlay) overlay.remove();
}

// ── FALLBACK (tab query) ───────────────────────────────────────────────────────
function encQueryTabFallback(query) {
  if (!query) return;
  _encSearchTerm = query.toLowerCase();
  var input = document.getElementById('enc-search');
  if (input) input.value = query;
  encApplyFilters();
}

// ── sbQ WRAPPER ───────────────────────────────────────────────────────────────
// Uses existing sbQ from index.html; fallback direct fetch if needed
async function _encSbQ(table, opts) {
  if (typeof sbQ === 'function') {
    return sbQ(table, opts);
  }
  // Minimal fallback
  var cfg = window.appConfig || {};
  var url = cfg.supabase_url || '';
  var key = cfg.supabase_key || '';
  if (!url) throw new Error('No Supabase config');
  var endpoint = url + '/rest/v1/' + table + '?select=*&is_deleted=neq.true&order=created_at.desc';
  var res = await fetch(endpoint, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  return res.json();
}

console.log('[encyclopedia.js] loaded — encInit ready');
