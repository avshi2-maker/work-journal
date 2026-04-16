// enc_hub.js — Stage 1 v16042026-c
// Collapsed topic boxes, live counts, tap-to-expand, hard cap on heavy sources
// Reuses: _encItems, _encContacts, _encArchive, encGroupForItem, encEsc, encDec,
//         encProjName, encFmtDate, encMapType, sbQ, showToast (all from encyclopedia.js)

var _hubLoaded = false;
var _hubOpenBox = '';  // id of currently open box, '' = all closed
var _hubSearch  = '';

// Hard caps per group — NEVER raise standards/prices above 10
var _HUB_CAPS = {
  standards: 10,
  prices:    10,
  contacts:  50,
  archive:   30,
  default:   50
};

// Box definitions — maps to encGroupForItem() group ids
var _HUB_BOXES = [
  {
    id:    'safety',
    label: 'בטיחות, חומ"ס ותנועה',
    icon:  '⚠️',
    hbg:   '#fff5f5',
    hcol:  '#c62828',
    cbg:   '#fce4e4',
    ccol:  '#b71c1c',
    groups: ['safety','hazmat','traffic']
  },
  {
    id:    'engineering',
    label: 'הנדסה, תקנים ומחירון',
    icon:  '🏗️',
    hbg:   '#e8f0fd',
    hcol:  '#1a3d5c',
    cbg:   '#dbeafe',
    ccol:  '#1a3d5c',
    groups: ['engineering','standards','prices','takeoff']
  },
  {
    id:    'financial',
    label: 'כספי, משפטי ופרוטוקול',
    icon:  '💰',
    hbg:   '#e8f5e9',
    hcol:  '#1b5e20',
    cbg:   '#c8e6c9',
    ccol:  '#1b5e20',
    groups: ['financial','protocol','neighbor']
  },
  {
    id:    'media',
    label: 'מדיה, קול ותיבה נכנסת',
    icon:  '📷',
    hbg:   '#f0fdfb',
    hcol:  '#0f766e',
    cbg:   '#ccfbf1',
    ccol:  '#0f766e',
    groups: ['media','docs']
  },
  {
    id:    'contacts',
    label: 'קשרים, ציוד והערות',
    icon:  '👥',
    hbg:   '#f3e5f5',
    hcol:  '#4a148c',
    cbg:   '#e1bee7',
    ccol:  '#4a148c',
    groups: ['contacts']
  },
  {
    id:    'archive',
    label: 'מדידות, מסמכים וארכיון',
    icon:  '📐',
    hbg:   '#fff8e0',
    hcol:  '#7a5500',
    cbg:   '#fef3c7',
    ccol:  '#92400e',
    groups: ['archive','general']
  }
];

// Source chip colours by _src
var _HUB_SRC_STYLE = {
  enc:       {bg:'#fff5f5', col:'#c62828', border:'#fca5a5'},
  standards: {bg:'#ede7f6', col:'#4527a0', border:'#9c6fdd'},
  prices:    {bg:'#e8f5e9', col:'#1b5e20', border:'#a5d6a7'},
  takeoff:   {bg:'#fff8e0', col:'#c9a84c', border:'#f59e0b'},
  inbox:     {bg:'#f0fdfb', col:'#0f766e', border:'#5eead4'},
  notes:     {bg:'#e3f2fd', col:'#1565c0', border:'#90caf9'},
  contacts:  {bg:'#f3e5f5', col:'#4a148c', border:'#ce93d8'},
  archive:   {bg:'#e8f5e9', col:'#1b5e20', border:'#a5d6a7'}
};

// ─── INIT ────────────────────────────────────────────────────────────────────

function hubInit() {
  var el = document.getElementById('hub-root');
  if (!el) return;
  // Show loading state immediately
  el.innerHTML = '<div style="padding:20px;text-align:center;font-family:Heebo,Arial,sans-serif;direction:rtl;color:#1a3d5c;font-size:13px;">⏳ טוען נתונים...</div>';
  // Ensure encyclopedia.js is loaded (it owns _encItems)
  if (typeof _fetchEncyclopedia === 'function') {
    _fetchEncyclopedia().then(function() {
      // Now wait for encInit to populate _encItems
      var tries = 0;
      var wait = setInterval(function() {
        tries++;
        if (_encItems && _encItems.length > 0) {
          clearInterval(wait);
          hubRender();
        } else if (tries === 1 && typeof encInit === 'function') {
          // Trigger encInit to load data into _encItems
          encInit();
        } else if (tries > 30) {
          clearInterval(wait);
          el.innerHTML = '<div style="padding:20px;text-align:center;font-family:Heebo,Arial,sans-serif;direction:rtl;color:#c62828;">⚠️ שגיאה בטעינת נתונים</div>';
        }
      }, 300);
    });
  } else {
    // Fallback — retry waiting for _fetchEncyclopedia to appear
    var tries = 0;
    var wait = setInterval(function() {
      tries++;
      if (typeof _fetchEncyclopedia === 'function') {
        clearInterval(wait);
        hubInit();
      } else if (tries > 20) {
        clearInterval(wait);
      }
    }, 500);
  }
}

// ─── RENDER SHELL ─────────────────────────────────────────────────────────────

function hubRender() {
  var el = document.getElementById('hub-root');
  if (!el) return;

  var html = '<div style="padding:12px;direction:rtl;font-family:Heebo,Arial,sans-serif;">';

  // Top bar
  html += '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
    '<span style="font-size:16px;">📚</span>' +
    '<span style="font-size:14px;font-weight:500;color:#1a3d5c;flex:1;">מרכז נתונים שטח — האנציקלופדיה של בני</span>' +
    '<input id="hub-search" type="text" placeholder="🔍 חפש..." value="' + encEsc(_hubSearch) + '" ' +
      'oninput="hubOnSearch(this.value)" ' +
      'style="border:0.5px solid #c9a84c;border-radius:8px;padding:6px 10px;font-size:12px;font-family:Heebo,Arial,sans-serif;background:#fffbf0;color:#111;width:160px;direction:rtl;">' +
    '<select id="hub-proj-sel" onchange="hubSetProj(this.value)" style="border:0.5px solid #c9a84c;border-radius:8px;padding:5px 8px;font-size:12px;font-family:Heebo,Arial,sans-serif;background:#fffbf0;color:#111;direction:rtl;">' +
      '<option value="">כל הפרויקטים</option>' +
      (window.allProjects||[]).map(function(p) {
        return '<option value="' + encEsc(p.id) + '">' + encEsc(p.project_name) + '</option>';
      }).join('') +
    '</select>' +
    '<button onclick="hubRefresh()" style="background:#f5f0e8;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,Arial,sans-serif;">🔄 רענן</button>' +
  '</div>';

  // Build buckets
  var buckets = hubBuildBuckets();

  // Boxes grid
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:11px;">';

  _HUB_BOXES.forEach(function(box) {
    var items = buckets[box.id] || [];
    var count = items.length;
    var isOpen = _hubOpenBox === box.id;
    html += hubRenderBox(box, items, count, isOpen);
  });

  // Contacts box — separate source
  html += '</div>';
  html += '</div>';

  el.innerHTML = html;
}

// ─── BUCKETS ──────────────────────────────────────────────────────────────────

function hubBuildBuckets() {
  var buckets = {};
  _HUB_BOXES.forEach(function(b) { buckets[b.id] = []; });

  // Map _encItems → boxes via encGroupForItem → box.groups
  var groupToBox = {};
  _HUB_BOXES.forEach(function(b) {
    b.groups.forEach(function(g) { groupToBox[g] = b.id; });
  });

  var projFilter = (document.getElementById('hub-proj-sel') || {}).value || '';
  var q = _hubSearch.toLowerCase().trim();

  _encItems.forEach(function(item) {
    var gid = encGroupForItem(item);
    var bid = groupToBox[gid] || 'archive';

    // Project filter
    if (projFilter) {
      var pid = item.source_project_id || item.project_id || '';
      if (pid !== projFilter) return;
    }

    // Search filter
    if (q) {
      var hay = ((item.title||'') + ' ' + (item.description||item.notes||item.ai_report||'') + ' ' + (item.category||'')).toLowerCase();
      if (hay.indexOf(q) < 0) return;
    }

    if (buckets[bid]) buckets[bid].push(item);
  });

  // Add contacts into contacts box
  _encContacts.forEach(function(ct) {
    if (projFilter && ct.project_id !== projFilter) return;
    if (q) {
      var hay = ((ct.full_name||'') + ' ' + (ct.phone||'') + ' ' + (ct.profession||'')).toLowerCase();
      if (hay.indexOf(q) < 0) return;
    }
    buckets['contacts'].push(Object.assign({_src:'contacts', _type:'contact', title:ct.full_name||'?'}, ct));
  });

  // Add archive into archive box
  _encArchive.forEach(function(a) {
    if (q) {
      var hay = ((a.project_name||'') + ' ' + (a.client_name||'')).toLowerCase();
      if (hay.indexOf(q) < 0) return;
    }
    buckets['archive'].push(Object.assign({_src:'archive', _type:'archive', title:a.project_name||'פרויקט'}, a));
  });

  return buckets;
}

// ─── RENDER ONE BOX ───────────────────────────────────────────────────────────

function hubRenderBox(box, items, count, isOpen) {
  var html = '<div id="hub-box-' + box.id + '" style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;overflow:hidden;">';

  // Header — always visible, tap to toggle
  html += '<div onclick="hubToggle(\'' + box.id + '\')" style="cursor:pointer;padding:10px 14px;display:flex;align-items:center;gap:8px;background:' + box.hbg + ';border-bottom:' + (isOpen ? '0.5px solid #e8ddb5' : 'none') + ';">' +
    '<div style="width:30px;height:30px;border-radius:8px;background:' + box.cbg + ';display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">' + box.icon + '</div>' +
    '<span style="font-size:13px;font-weight:500;color:' + box.hcol + ';flex:1;">' + box.label + '</span>' +
    '<span style="font-size:10px;font-weight:500;background:' + box.cbg + ';color:' + box.ccol + ';border-radius:20px;padding:2px 8px;border:0.5px solid ' + box.ccol + '33;">' + count + ' פריטים</span>' +
    '<span style="font-size:12px;color:#888;margin-right:2px;">' + (isOpen ? '▲' : '▼') + '</span>' +
  '</div>';

  if (isOpen) {
    html += hubRenderBoxBody(box, items);
  }

  html += '</div>';
  return html;
}

// ─── RENDER BOX BODY (items list) ─────────────────────────────────────────────

function hubRenderBoxBody(box, items) {
  var html = '<div style="padding:8px 13px;">';

  if (!items.length) {
    html += '<div style="padding:16px;text-align:center;color:#888;font-size:12px;">אין פריטים</div>';
    html += '</div>';
    // Footer
    html += hubRenderFooter(box);
    return html;
  }

  // Apply hard cap
  var cap = _HUB_CAPS[box.id] || _HUB_CAPS.default;
  // For groups containing standards or prices, use the tighter cap
  if (box.groups.indexOf('standards') >= 0 || box.groups.indexOf('prices') >= 0) {
    cap = 10;
  }

  var show = items.slice(0, cap);
  var overflow = items.length - cap;

  // Group items by _src for section labels
  var sections = {};
  var srcOrder = [];
  show.forEach(function(item) {
    var s = item._src || 'enc';
    if (!sections[s]) { sections[s] = []; srcOrder.push(s); }
    sections[s].push(item);
  });
  // dedupe srcOrder
  srcOrder = srcOrder.filter(function(v,i,a){return a.indexOf(v)===i;});

  srcOrder.forEach(function(src) {
    var srcItems = sections[src];
    // Section label
    html += '<div style="font-size:10px;color:#888;font-weight:500;padding:5px 0 3px;border-bottom:0.5px dashed #e8ddb5;margin-bottom:3px;">' + hubSrcLabel(src) + ' (' + srcItems.length + ')</div>';

    srcItems.forEach(function(item) {
      html += hubRenderItemRow(item, box);
    });
  });

  if (overflow > 0) {
    var msg = (box.groups.indexOf('standards') >= 0 || box.groups.indexOf('prices') >= 0)
      ? '⚠️ מציג ' + cap + ' מתוך ' + items.length + ' — השתמש בחיפוש לצמצום'
      : '+ עוד ' + overflow + ' פריטים — צמצם עם חיפוש';
    html += '<div style="text-align:center;padding:6px;font-size:11px;color:#888;background:#f5f0e8;border-radius:6px;margin-top:4px;">' + msg + '</div>';
  }

  html += '</div>';
  html += hubRenderFooter(box);
  return html;
}

// ─── RENDER ITEM ROW ──────────────────────────────────────────────────────────

function hubRenderItemRow(item, box) {
  var src = item._src || 'enc';
  var ss = _HUB_SRC_STYLE[src] || {bg:'#f5f5f5', col:'#555', border:'#ccc'};
  var title = encDec(item.title || '?');
  var proj = encProjName(item.source_project_id || item.project_id || '');
  var date = encFmtDate(item.created_at);

  var html = '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:0.5px solid #f0ebe0;">' +
    '<div style="width:7px;height:7px;border-radius:50%;background:' + box.hcol + ';flex-shrink:0;"></div>' +
    '<span style="font-size:11px;color:#111;flex:1;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:160px;" title="' + encEsc(title) + '">' + encEsc(title) + '</span>' +
    '<span style="font-size:9px;border-radius:10px;padding:1px 5px;border:0.5px solid ' + ss.border + ';background:' + ss.bg + ';color:' + ss.col + ';white-space:nowrap;flex-shrink:0;">' + src + '</span>' +
    '<div style="display:flex;gap:3px;flex-shrink:0;">' +
      // View button — Stage 2 will wire up full viewer, for now placeholder
      '<button onclick="hubViewItem(\'' + item.id + '\',\'' + src + '\')" style="' + hubAbS() + '">👁</button>';

  if (proj) {
    html += '<button onclick="hubOpenProject(\'' + encEsc(item.source_project_id||item.project_id||'') + '\')" style="' + hubAbS('ede7f6','4527a0','ce93d8') + '">📁</button>';
  }

  html += '</div></div>';
  return html;
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function hubRenderFooter(box) {
  var btnS = 'flex:1;min-width:55px;text-align:center;border:0.5px solid #e8ddb5;background:#f5f0e8;color:#1a3d5c;border-radius:8px;padding:4px 6px;font-size:10px;font-weight:500;cursor:pointer;font-family:Heebo,Arial,sans-serif;';
  return '<div style="padding:7px 13px;border-top:0.5px solid #e8ddb5;display:flex;gap:5px;flex-wrap:wrap;">' +
    '<button onclick="hubPrintBox(\'' + box.id + '\')" style="' + btnS + '">🖨 הדפס</button>' +
    '<button onclick="hubWABox(\'' + box.id + '\')" style="' + btnS + 'background:#e8f5e9;color:#1b5e20;border-color:#a5d6a7;">📲 WA</button>' +
    '<button onclick="hubEmailBox(\'' + box.id + '\')" style="' + btnS + 'background:#fffde7;color:#7a5500;border-color:#f59e0b;">✉️ מייל</button>' +
    '<button onclick="hubOpenProjectFromBox(\'' + box.id + '\')" style="' + btnS + 'background:#ede7f6;color:#4527a0;border-color:#ce93d8;">📁 פרויקט</button>' +
  '</div>';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function hubAbS(bg, col, border) {
  bg = bg || 'f5f0e8'; col = col || '1a3d5c'; border = border || 'e8ddb5';
  return 'border:0.5px solid #' + border + ';background:#' + bg + ';color:#' + col + ';border-radius:5px;padding:2px 6px;font-size:10px;font-weight:500;cursor:pointer;font-family:Heebo,Arial,sans-serif;';
}

function hubSrcLabel(src) {
  var map = {
    enc:'ממצאי שטח', standards:'תקנים', prices:'מחירון דקל',
    takeoff:'טייקאופים', inbox:'תיבה נכנסת', notes:'נכסי בני',
    contacts:'אנשי קשר', archive:'ארכיון'
  };
  return map[src] || src;
}

// ─── INTERACTIONS ────────────────────────────────────────────────────────────

function hubToggle(boxId) {
  _hubOpenBox = (_hubOpenBox === boxId) ? '' : boxId;
  hubRender();
}

function hubOnSearch(v) {
  _hubSearch = v;
  hubRender();
}

function hubSetProj(v) {
  hubRender();
}

function hubRefresh() {
  _hubLoaded = false;
  _hubOpenBox = '';
  _hubSearch = '';
  hubRender();
}

// ─── ACTIONS (stubs — wired in later stages) ─────────────────────────────────

function hubViewItem(id, src) {
  // Stage 2: full viewer modal
  var item = _encItems.find(function(i){ return i.id == id; }) ||
             _encContacts.find(function(i){ return i.id == id; }) ||
             _encArchive.find(function(i){ return i.id == id; });
  if (!item) { showToast('פריט לא נמצא', 'error'); return; }
  // Temp: open URL in new tab if exists
  var url = item.media_url || item.cloudinary_url || item.file_url || '';
  if (url) {
    window.open(url, '_blank');
  } else {
    // Show text popup
    var w = window.open('', '_blank', 'width=600,height=500');
    if (!w) return;
    w.document.write('<html><head><meta charset="utf-8"><style>body{font-family:Heebo,Arial,sans-serif;direction:rtl;padding:20px;line-height:1.8;}h3{color:#1a3d5c;}pre{white-space:pre-wrap;}</style></head><body>' +
      '<h3>' + encEsc(item.title||'פריט') + '</h3>' +
      '<pre>' + encEsc(item.description||item.notes||item.ai_report||item.scope||'אין תיאור') + '</pre>' +
      '<button onclick="window.print()" style="margin-top:10px;padding:6px 14px;background:#1a3d5c;color:#FFD700;border:none;border-radius:8px;cursor:pointer;font-family:Heebo,Arial,sans-serif;">🖨 הדפס</button>' +
      '</body></html>');
    w.document.close();
  }
}

function hubOpenProject(projId) {
  if (!projId) return;
  if (typeof openProjectContent === 'function') {
    openProjectContent(projId, encProjName(projId), 'notes');
  } else {
    showToast('פתיחת פרויקט: ' + encProjName(projId), 'info');
  }
}

function hubOpenProjectFromBox(boxId) {
  // Open project picker — for now show toast; Stage 3 wires contact picker
  showToast('בחר פרויקט מהרשימה למעלה', 'info');
}

function hubPrintBox(boxId) {
  var box = _HUB_BOXES.find(function(b){ return b.id === boxId; });
  if (!box) return;
  var buckets = hubBuildBuckets();
  var items = buckets[boxId] || [];
  var cap = (_HUB_CAPS[boxId] || _HUB_CAPS.default);
  var show = items.slice(0, cap);
  var rows = show.map(function(i) {
    return '<tr><td style="padding:4px 8px;border-bottom:0.5px solid #eee;">' + encEsc(encDec(i.title||'')) + '</td>' +
           '<td style="padding:4px 8px;border-bottom:0.5px solid #eee;color:#555;">' + encEsc(i._src||'') + '</td>' +
           '<td style="padding:4px 8px;border-bottom:0.5px solid #eee;color:#555;">' + encFmtDate(i.created_at) + '</td></tr>';
  }).join('');
  var w = window.open('', '_blank', 'width=700,height=600');
  if (!w) return;
  w.document.write('<html><head><meta charset="utf-8"><style>body{font-family:Heebo,Arial,sans-serif;direction:rtl;padding:20px;}h3{color:#1a3d5c;}table{width:100%;border-collapse:collapse;}@media print{button{display:none}}</style></head><body>' +
    '<h3>' + box.icon + ' ' + box.label + '</h3>' +
    '<table><thead><tr><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc;">כותרת</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc;">מקור</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc;">תאריך</th></tr></thead><tbody>' +
    rows + '</tbody></table>' +
    '<br><button onclick="window.print()" style="padding:7px 18px;background:#1a3d5c;color:#FFD700;border:none;border-radius:8px;cursor:pointer;font-family:Heebo,Arial,sans-serif;">🖨 הדפס</button>' +
    '</body></html>');
  w.document.close();
}

function hubWABox(boxId) {
  // Stage 3: full contact picker; for now open WA to Beni
  var buckets = hubBuildBuckets();
  var items = (buckets[boxId]||[]).slice(0,10);
  var box = _HUB_BOXES.find(function(b){ return b.id === boxId; });
  var text = (box ? box.label : boxId) + '\n' +
    items.map(function(i,n){ return (n+1)+'. '+(i.title||''); }).join('\n');
  window.open('https://wa.me/972523536239?text=' + encodeURIComponent(text), '_blank');
}

function hubEmailBox(boxId) {
  // Stage 4: Edge Function; for now mailto
  var buckets = hubBuildBuckets();
  var items = (buckets[boxId]||[]).slice(0,10);
  var box = _HUB_BOXES.find(function(b){ return b.id === boxId; });
  var subj = box ? box.label : boxId;
  var body = items.map(function(i,n){
    return (n+1)+'. '+(i.title||'') + (i.media_url ? '\n'+i.media_url : '');
  }).join('\n\n');
  window.location.href = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
}
