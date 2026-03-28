// ══ SMART JOURNAL — 5 TABS ═════════════════════════════════════════
var _sjActiveTab    = 'notes';
var _sjProjectId    = '';
var _sjProjectName  = '';

function switchSmartTab(tab) {
  _sjActiveTab = tab;
  ['notes','photos','videos','takeoffs','recordings'].forEach(function(t) {
    var panel = document.getElementById('sj-panel-' + t);
    var btn   = document.getElementById('sj-tab-' + t);
    if (!panel || !btn) return;
    var isActive = t === tab;
    panel.style.display = isActive ? 'block' : 'none';
    btn.style.background = isActive ? '#9a6f00' : 'transparent';
    btn.style.color      = isActive ? '#fff'    : '#888';
  });
  smartJournalFilter();
}

function smartJournalFilter() {
  var sel = document.getElementById('smart-project-filter');
  _sjProjectId   = sel ? sel.value : '';
  _sjProjectName = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.replace('📁 ','').trim() : '';

  // Also sync the notes tab project selector
  var noteSel = document.getElementById('note-project-select');
  if (noteSel && _sjProjectId) noteSel.value = _sjProjectId;

  if      (_sjActiveTab === 'notes')      { if (_sjProjectId) filterNotesByProject(_sjProjectId); else loadNotesWall(); }
  else if (_sjActiveTab === 'photos')     sjLoadPhotos();
  else if (_sjActiveTab === 'videos')     sjLoadVideos();
  else if (_sjActiveTab === 'takeoffs')   sjLoadTakeoffs();
  else if (_sjActiveTab === 'recordings') sjLoadRecordings();
}

// ── PHOTOS TAB ──────────────────────────────────────────────────────
async function sjLoadPhotos() {
  var grid     = document.getElementById('sj-photos-grid');
  var countEl  = document.getElementById('sj-photos-count');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#555;font-size:13px;">טוען תמונות...</div>';

  try {
    var query = 'select=id,note_text,photo_url,color,created_at,project_id&photo_url=not.is.null&order=created_at.desc&limit=60';
    if (_sjProjectId) query += '&project_id=eq.' + _sjProjectId;

    var res  = await sbQ('beni_notes', query);
    var notes = (res.data || []).filter(function(n) {
      var url = n.photo_url || '';
      var isVideo = url.includes('drive.google.com') || /\.(mp4|mov|webm|avi)/i.test(url);
      return !isVideo; // photos only
    });

    if (countEl) countEl.textContent = notes.length + ' תמונות';

    if (!notes.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#444;"><div style="font-size:40px;margin-bottom:10px;">📷</div><div style="font-size:13px;">אין תמונות' + (_sjProjectId ? ' לפרויקט זה' : '') + '</div></div>';
      return;
    }

    grid.innerHTML = '';
    notes.forEach(function(n) {
      var url = n.photo_url.startsWith('http') ? n.photo_url : SB_URL + '/storage/v1/object/public/photos/' + n.photo_url;
      var date = new Date(n.created_at).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit'});
      var proj = (window.allProjects||[]).find(function(p){ return p.id===n.project_id; });

      var div = document.createElement('div');
      div.style.cssText = 'position:relative;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);cursor:pointer;aspect-ratio:1;background:#0a0a1a;';

      var img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      img.onerror = function(){ this.style.display='none'; };
      img.addEventListener('click', function(){ openLightbox(url, n.note_text||''); });

      var cap = document.createElement('div');
      cap.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));padding:16px 8px 6px;';
      cap.innerHTML = '<div style="font-size:10px;color:#fff;">' + date + (proj ? ' · ' + proj.project_name.substring(0,12) : '') + '</div>';

      div.appendChild(img); div.appendChild(cap);
      grid.appendChild(div);
    });
  } catch(e) {
    grid.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// ── VIDEOS TAB ───────────────────────────────────────────────────────
async function sjLoadVideos() {
  var grid    = document.getElementById('sj-videos-grid');
  var countEl = document.getElementById('sj-videos-count');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:13px;">טוען סרטונים...</div>';

  try {
    var query = 'select=id,note_text,photo_url,color,created_at,project_id&photo_url=ilike.*drive.google*&order=created_at.desc&limit=40';
    if (_sjProjectId) query += '&project_id=eq.' + _sjProjectId;

    var res   = await sbQ('beni_notes', query);
    var notes = res.data || [];

    if (countEl) countEl.textContent = notes.length + ' סרטונים';

    if (!notes.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#444;"><div style="font-size:40px;margin-bottom:10px;">🎬</div><div style="font-size:13px;">אין סרטונים' + (_sjProjectId ? ' לפרויקט זה' : '') + '</div></div>';
      return;
    }

    grid.innerHTML = '';
    notes.forEach(function(n) {
      var url  = n.photo_url;
      var date = new Date(n.created_at).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'2-digit'});
      var desc = (n.note_text||'').replace(/\n.*$/,'').replace('🎬','').replace('📁 Google Drive: '+url,'').trim() || 'סרטון שטח';
      var proj = (window.allProjects||[]).find(function(p){ return p.id===n.project_id; });

      var card = document.createElement('div');
      card.style.cssText = 'background:#1e1e35;border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:14px;';

      card.innerHTML =
        '<div style="font-size:32px;text-align:center;margin-bottom:8px;">🎬</div>'
        + '<div style="font-size:12px;font-weight:700;color:#c4b5fd;margin-bottom:4px;line-height:1.4;">' + desc.substring(0,60).replace(/</g,'&lt;') + '</div>'
        + '<div style="font-size:10px;color:#555;margin-bottom:10px;">' + date + (proj ? ' · 📁 ' + proj.project_name.substring(0,15) : '') + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
        + '<a href="' + url + '" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;background:rgba(66,133,244,0.2);border:1px solid rgba(66,133,244,0.4);color:#4285f4;padding:7px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;font-family:Heebo,sans-serif;">▶️ צפה</a>'
        + '<button onclick="sjSafetyAnalysis(\'' + n.id + '\',\'' + url + '\')" style="flex:1;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:7px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🦺 בטיחות AI</button>'
        + '</div>'
        + '<div id="safety-result-' + n.id + '" style="display:none;margin-top:8px;font-size:11px;line-height:1.6;"></div>';

      grid.appendChild(card);
    });
  } catch(e) {
    grid.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// ── AI SAFETY ANALYSIS ───────────────────────────────────────────────
async function sjSafetyAnalysis(noteId, driveUrl) {
  var resultEl = document.getElementById('safety-result-' + noteId);
  var btn      = resultEl && resultEl.previousElementSibling && resultEl.previousElementSibling.querySelector('button[onclick*="sjSafetyAnalysis"]');

  if (!resultEl) return;

  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('הגדר מפתח Anthropic API תחילה', 'error'); return; }

  resultEl.style.display = 'block';
  resultEl.style.color   = '#888';
  resultEl.textContent   = '🧠 מנתח בטיחות...';

  // Get the note's photo_url — we need to work with thumbnail from beni_notes
  // The video is on Drive — we can't extract frames from Drive URLs server-side
  // Instead: fetch the note record and use the AI description already stored
  try {
    var noteRes = await sbQ('beni_notes', 'select=note_text,photo_url&id=eq.' + noteId);
    var note    = noteRes.data && noteRes.data[0];
    var existingDesc = note ? note.note_text : '';

    // Ask Claude to perform safety analysis based on the existing description
    // and flag it as a Drive video (no frame extraction possible from Journal)
    var prompt = 'אתה מהנדס בטיחות בנייה מנוסה. בהתבסס על התיאור הבא של סרטון שצולם באתר בנייה, נתח סיכוני בטיחות:\n\n'
      + 'תיאור: "' + existingDesc.substring(0,300) + '"\n\n'
      + 'זהה:\n1. סיכוני בטיחות נראים לעין\n2. ציוד מגן חסר\n3. בעיות מבניות\n4. חסמים וסכנות נפילה\n\n'
      + 'דרג חומרה: 🔴 קריטי / 🟡 בינוני / 🟢 תקין\n'
      + 'השב ב-3-4 משפטים קצרים בעברית בלבד.';

    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:300, messages:[{role:'user',content:prompt}] }), 'safety-progress-text');
    var data = await res.json();
    var text = data.content && data.content[0] && data.content[0].text;

    if (text) {
      resultEl.style.color = '#fca5a5';
      resultEl.textContent = text;
    } else {
      resultEl.textContent = 'לא ניתן לנתח';
    }
  } catch(e) {
    resultEl.style.color = '#ef4444';
    resultEl.textContent = 'שגיאה: ' + e.message;
  }
}

// ── TAKEOFFS TAB ─────────────────────────────────────────────────────
async function sjLoadTakeoffs() {
  var list    = document.getElementById('sj-takeoffs-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:13px;">טוען מדידות...</div>';

  try {
    var query = 'select=id,project_name,total_area,takeoff_type,created_at&order=created_at.desc&limit=30';
    if (_sjProjectId) {
      var proj = (window.allProjects||[]).find(function(p){ return p.id===_sjProjectId; });
      if (proj) query = 'select=id,project_name,total_area,takeoff_type,created_at&project_id=eq.' + _sjProjectId + '&order=created_at.desc&limit=30';
    }

    var res       = await sbQ('site_takeoffs', query);
    var takeoffs  = res.data || [];

    if (!takeoffs.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#444;"><div style="font-size:40px;margin-bottom:10px;">📐</div><div style="font-size:13px;">אין מדידות' + (_sjProjectId ? ' לפרויקט זה' : '') + '</div></div>';
      return;
    }

    var typeIcon = { standard:'📐', detailed:'📋', laser:'🔴' };
    list.innerHTML = takeoffs.map(function(t) {
      var date = new Date(t.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit'});
      var icon = typeIcon[t.takeoff_type||'standard'] || '📐';
      var area = t.total_area ? Number(t.total_area).toFixed(1) + ' מ"ר' : '—';
      return '<div style="background:#242438;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">'
        + '<span style="font-size:22px;">' + icon + '</span>'
        + '<div style="flex:1;">'
        + '<div style="font-size:13px;font-weight:700;color:#fff;">' + (t.project_name||'ללא פרויקט').replace(/</g,'&lt;') + '</div>'
        + '<div style="font-size:11px;color:#555;">' + date + '</div>'
        + '</div>'
        + '<div style="font-size:14px;font-weight:800;color:#c9a84c;">' + area + '</div>'
        + '</div>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// ── RECORDINGS TAB ───────────────────────────────────────────────────
async function sjLoadRecordings() {
  var list    = document.getElementById('sj-recordings-list');
  var countEl = document.getElementById('sj-recordings-count');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:13px;">טוען הקלטות...</div>';

  try {
    var from = new Date();
    from.setDate(from.getDate() - 30);
    var fromISO = from.toISOString();

    var url = SB_URL + '/rest/v1/voice_memos?created_at=gte.' + fromISO + '&order=created_at.desc&limit=50';
    if (_sjProjectId) {
      var proj = (window.allProjects||[]).find(function(p){ return p.id===_sjProjectId; });
      if (proj) url += '&project_hint=ilike.*' + encodeURIComponent(proj.project_name.substring(0,10)) + '*';
    }

    var res   = await fetch(url, { headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    var memos = res.ok ? await res.json() : [];

    if (countEl) countEl.textContent = memos.length + ' הקלטות (30 ימים אחרונים)';

    if (!memos.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#444;"><div style="font-size:40px;margin-bottom:10px;">🎙️</div><div style="font-size:13px;">אין הקלטות' + (_sjProjectId ? ' לפרויקט זה' : ' מ-30 הימים האחרונים') + '</div></div>';
      return;
    }

    var PCOLOR = { 'גבוה':'#ef4444','רגיל':'#f59e0b','נמוך':'#22c55e' };
    var CICON  = { 'משימה':'📋','בעיית_אתר':'⚠️','חומרים':'📦','לקוח':'👤','כספים':'💰','כללי':'📝' };

    list.innerHTML = memos.map(function(m) {
      var ai  = null;
      try { ai = m.ai_result ? (typeof m.ai_result==='string' ? JSON.parse(m.ai_result) : m.ai_result) : null; } catch(e){}
      var time    = new Date(m.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      var summary = (ai&&ai.summary) || (m.transcript||'').substring(0,80) || 'ללא תיאור';
      var pri     = (ai&&ai.priority)||'רגיל';
      var cat     = (ai&&ai.category)||'כללי';
      var pColor  = PCOLOR[pri]||'#f59e0b';
      var cIcon   = CICON[cat]||'📝';
      var actions = (ai&&ai.action_items)||[];
      return '<div style="background:#242438;border:1px solid rgba(255,255,255,0.06);border-right:4px solid '+ pColor +';border-radius:12px;padding:12px 14px;margin-bottom:8px;">'
        + '<div style="display:flex;align-items:flex-start;gap:8px;">'
        + '<span style="font-size:18px;">' + cIcon + '</span>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">' + summary.replace(/</g,'&lt;') + '</div>'
        + '<div style="font-size:10px;color:#555;margin-top:3px;">' + time + (m.project_hint?' · 📁 '+m.project_hint:'') + '</div>'
        + (actions.length ? '<div style="margin-top:6px;">' + actions.slice(0,2).map(function(a){return'<div style="font-size:11px;color:#888;">▸ '+a.replace(/</g,'&lt;')+'</div>';}).join('') + '</div>' : '')
        + '</div>'
        + '<span style="background:'+pColor+'20;color:'+pColor+';border-radius:20px;padding:2px 8px;font-size:10px;font-weight:800;">'+pri+'</span>'
        + '</div></div>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// Populate smart journal project filter when notes tab opens
function sjPopulateProjectFilter() {
  var sel = document.getElementById('smart-project-filter');
  if (!sel || !window.allProjects) return;
  var current = sel.value;
  sel.innerHTML = '<option value="">📁 כל הפרויקטים</option>';
  (window.allProjects||[]).forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.project_name;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}


// ══ EOD INTELLIGENCE REPORT ════════════════════════════════════

var _eodData = [];        // current loaded memos
var _eodDate = '';        // current date string YYYY-MM-DD

async function loadEODReport(dateStr) {
  const list    = document.getElementById('eod-list');
  const picker  = document.getElementById('eod-date-picker');
  const label   = document.getElementById('eod-date-label');
  const stats   = document.getElementById('eod-stats-bar');
  const actions = document.getElementById('eod-action-bar');
  if (!list) return;

  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }
  _eodDate = dateStr;
  if (picker) picker.value = dateStr;

  // Format label
  const d = new Date(dateStr + 'T12:00:00');
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  if (label) {
    label.textContent = isToday
      ? 'היום — ' + d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'})
      : d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  }

  list.innerHTML = '<div style="text-align:center;padding:30px;color:#555;font-size:13px;">טוען הקלטות...</div>';
  if (stats)   stats.style.display = 'none';
  if (actions) actions.style.display = 'none';

  try {
    const from = dateStr + 'T00:00:00.000Z';
    const to   = dateStr + 'T23:59:59.999Z';

    // Load both eod_sessions AND voice_memos for the day
    const [eodRes, voiceRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/eod_sessions?session_date=eq.' + dateStr + '&order=created_at.asc',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }),
      fetch(SB_URL + '/rest/v1/voice_memos?created_at=gte.' + from + '&created_at=lte.' + to + '&order=created_at.asc',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    ]);

    const eodSessions = eodRes.ok  ? await eodRes.json()   : [];
    const voiceMemos  = voiceRes.ok ? await voiceRes.json() : [];

    // Merge and deduplicate — mark source
    const all = [
      ...(eodSessions||[]).map(m => ({...m, _src:'eod'})),
      ...(voiceMemos||[]).map(m  => ({...m, _src:'voice'}))
    ].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    _eodData = all;

    if (!all.length) {
      list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#444;">'
        + '<div style="font-size:48px;margin-bottom:12px;">📭</div>'
        + '<div style="font-size:15px;color:#666;">אין הקלטות ליום זה</div>'
        + '</div>';
      return;
    }

    // Compute stats
    let totalTasks = 0, highCount = 0, totalSecs = 0;
    all.forEach(m => {
      const ai = _parseAI(m.ai_result);
      if (ai?.action_items?.length) totalTasks += ai.action_items.length;
      if (ai?.priority === 'גבוה') highCount++;
      totalSecs += (m.duration_sec || 0);
    });

    // Stats bar
    if (stats) {
      stats.style.display = 'grid';
      document.getElementById('eod-stat-count').textContent = all.length;
      document.getElementById('eod-stat-high').textContent  = highCount;
      document.getElementById('eod-stat-tasks').textContent = totalTasks;
      document.getElementById('eod-stat-mins').textContent  = Math.round(totalSecs / 60);
    }
    if (actions) actions.style.display = 'flex';

    // Render cards
    _renderEODList(all);

  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

function _parseAI(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

function _renderEODList(memos) {
  const list = document.getElementById('eod-list');
  if (!list) return;

  const PRI_COLOR  = { 'גבוה':'#ef4444', 'רגיל':'#f59e0b', 'נמוך':'#22c55e' };
  const CAT_ICON   = { 'משימה':'📋', 'בעיית_אתר':'⚠️', 'חומרים':'📦', 'לקוח':'👤', 'כספים':'💰', 'כללי':'📝', 'ביטחון':'🦺' };
  const SRC_LABEL  = { 'eod':'🧠 EOD', 'voice':'🎙️ Voice' };

  list.innerHTML = memos.map(function(m, idx) {
    const ai       = _parseAI(m.ai_result);
    const time     = new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
    const summary  = (ai?.summary) || (m.transcript||'').substring(0, 100) || 'ללא תיאור';
    const priority = ai?.priority  || 'רגיל';
    const category = ai?.category  || 'כללי';
    const actions  = ai?.action_items || [];
    const projHint = ai?.project_hint || '';
    const priColor = PRI_COLOR[priority] || '#f59e0b';
    const catIcon  = CAT_ICON[category]  || '📝';
    const srcLabel = SRC_LABEL[m._src]   || '📝';
    const mins     = m.duration_sec ? Math.round(m.duration_sec / 60) + 'ד׳' : '';

    const actionsHtml = actions.length
      ? '<div style="margin:8px 0;padding:8px 10px;background:rgba(0,0,0,0.15);border-radius:8px;">'
        + actions.map(a => '<div style="font-size:12px;color:#ccc;padding:2px 0;">▸ ' + a.replace(/</g,'&lt;') + '</div>').join('')
        + '</div>'
      : '';

    const transcriptHtml = m.transcript
      ? '<div style="font-size:11px;color:#555;font-style:italic;line-height:1.6;margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:6px;">'
        + '"' + m.transcript.substring(0,200).replace(/</g,'&lt;') + (m.transcript.length>200?'...':'') + '"'
        + '</div>'
      : '';

    const projHtml = projHint
      ? '<span style="background:rgba(59,130,246,0.2);color:#93c5fd;border-radius:12px;padding:1px 8px;font-size:10px;font-weight:700;">📁 ' + projHint.replace(/</g,'&lt;') + '</span> '
      : '';

    return '<div style="background:#242438;border:1px solid rgba(255,255,255,0.06);border-right:4px solid ' + priColor + ';border-radius:14px;padding:14px 16px;margin-bottom:12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">'
      +   '<div style="display:flex;gap:10px;align-items:flex-start;flex:1;">'
      +     '<span style="font-size:22px;">' + catIcon + '</span>'
      +     '<div style="flex:1;">'
      +       '<div style="font-size:14px;font-weight:800;color:#fff;line-height:1.3;">' + summary.replace(/</g,'&lt;') + '</div>'
      +       '<div style="font-size:10px;color:#555;margin-top:4px;">'
      +         time + (mins ? ' · ' + mins : '') + ' · ' + srcLabel + ' '
      +         projHtml
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">'
      +     '<span style="background:' + priColor + '25;color:' + priColor + ';border-radius:20px;padding:2px 10px;font-size:11px;font-weight:800;">' + priority + '</span>'
      +   '</div>'
      + '</div>'
      + actionsHtml
      + transcriptHtml
      + '</div>';
  }).join('');
}

function eodExportWhatsApp() {
  if (!_eodData.length) return;
  const d = new Date(_eodDate + 'T12:00:00');
  const dateLabel = d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'});
  let msg = '🧠 *יומן שטח — ' + dateLabel + '*\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  let taskCount = 0, highCount = 0;
  _eodData.forEach(function(m, i) {
    const ai   = _parseAI(m.ai_result);
    const time = new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
    const sum  = ai?.summary || (m.transcript||'').substring(0,80);
    const pri  = ai?.priority || 'רגיל';
    const priEmoji = pri === 'גבוה' ? '🔴' : pri === 'נמוך' ? '🟢' : '🟡';
    if (pri === 'גבוה') highCount++;
    msg += (i+1) + '. ' + priEmoji + ' *[' + time + ']* ' + sum + '\n';
    if (ai?.action_items?.length) {
      ai.action_items.forEach(a => { msg += '   ▸ ' + a + '\n'; taskCount++; });
    }
    msg += '\n';
  });
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += '📊 סה״כ: ' + _eodData.length + ' הקלטות · ' + taskCount + ' משימות · ' + highCount + ' דחוף';

  const waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(waUrl, '_blank');
}

async function eodSaveReport() {
  if (!_eodData.length) { showToast('אין נתונים לשמירה', 'error'); return; }

  // Ask which project to attach to
  const projName = prompt('שם פרויקט (אופציונלי — לקישור לדוח):', '');

  const d = new Date(_eodDate + 'T12:00:00');
  const dateLabel = d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'});
  const reportNum = 'EOD-' + _eodDate.replace(/-/g,'');

  let totalTasks = 0, highCount = 0, totalSecs = 0;
  const summaries = [];
  _eodData.forEach(m => {
    const ai = _parseAI(m.ai_result);
    if (ai?.summary) summaries.push(ai.summary);
    if (ai?.action_items?.length) totalTasks += ai.action_items.length;
    if (ai?.priority === 'גבוה') highCount++;
    totalSecs += (m.duration_sec || 0);
  });

  const generalNotes = _eodData.length + ' הקלטות קוליות · '
    + totalTasks + ' משימות · '
    + highCount + ' דחוף · '
    + Math.round(totalSecs/60) + ' דקות הקלטה\n\n'
    + summaries.slice(0,5).join(' | ');

  const projMatch = projName ? (allProjects||[]).find(p =>
    p.project_name.includes(projName) || projName.includes(p.project_name)) : null;

  showLoading(true);
  try {
    const { error } = await sb.from('reports').insert({
      report_number:  reportNum,
      report_date:    _eodDate,
      project_name:   projMatch?.project_name || projName || 'יומן שטח',
      project_id:     projMatch?.id || null,
      manager_name: (APP.config&&APP.config.manager_name)||'בני פרסקי',
      general_notes:  generalNotes,
      status:         'draft'
    });
    if (error) throw error;
    showToast('✅ דוח נשמר: ' + reportNum, 'success');
    await loadReports();
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ══ WEEKLY INTELLIGENCE REPORT ════════════════════════════════
var _weeklyOffset = 0;   // 0 = current week, -1 = last week
var _weeklyRawData = {};
var _weeklyAIReport = '';
var _weeklyAnthropicKey = null;

function weeklyGetRange(offset) {
  const now   = new Date();
  const day   = now.getDay(); // 0=Sun
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day + (offset * 7));
  sunday.setHours(0,0,0,0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23,59,59,999);
  return { from: sunday, to: saturday };
}

function weeklyShift(dir) {
  _weeklyOffset += dir;
  const nextBtn = document.getElementById('weekly-next-btn');
  if (nextBtn) nextBtn.style.opacity = _weeklyOffset >= 0 ? '0.3' : '1';
  loadWeeklyData();
}

async function loadWeeklyData() {
  const { from, to } = weeklyGetRange(_weeklyOffset);
  const fromISO = from.toISOString();
  const toISO   = to.toISOString();
  const fromDate = from.toISOString().split('T')[0];
  const toDate   = to.toISOString().split('T')[0];

  const label = document.getElementById('weekly-range-label');
  if (label) {
    const fStr = from.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
    const tStr = to.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
    label.textContent = fStr + ' – ' + tStr;
  }

  const nextBtn = document.getElementById('weekly-next-btn');
  if (nextBtn) nextBtn.style.opacity = _weeklyOffset >= 0 ? '0.3' : '1';

  // Hide old report
  const out = document.getElementById('weekly-report-out');
  const waBar = document.getElementById('weekly-wa-bar');
  if (out)   out.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">טוען נתונים...</div>';
  if (waBar) waBar.style.display = 'none';
  _weeklyRawData = {};
  _weeklyAIReport = '';

  try {
    const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

    const [callRes, taskRes, takeoffRes, txnRes, memoRes, insRes] = await Promise.all([
      fetch(SB_URL+'/rest/v1/call_log?created_at=gte.'+fromISO+'&created_at=lte.'+toISO+'&order=created_at.desc&select=caller_name,direction,wa_sent,created_at', {headers:H}),
      fetch(SB_URL+'/rest/v1/reminders?is_done=eq.true&done_at=gte.'+fromISO+'&done_at=lte.'+toISO+'&select=text,source,done_at', {headers:H}),
      fetch(SB_URL+'/rest/v1/site_takeoffs?created_at=gte.'+fromISO+'&created_at=lte.'+toISO+'&select=project_name,total_area,takeoff_type,created_at', {headers:H}),
      fetch(SB_URL+'/rest/v1/contractor_transactions?transaction_date=gte.'+fromDate+'&transaction_date=lte.'+toDate+'&select=amount,type,contractors_master(company_name),projects(project_name)', {headers:H}),
      fetch(SB_URL+'/rest/v1/eod_sessions?session_date=gte.'+fromDate+'&session_date=lte.'+toDate+'&select=transcript,ai_result,duration_sec,session_date', {headers:H}),
      fetch(SB_URL+'/rest/v1/site_inspections?inspection_date=gte.'+fromDate+'&inspection_date=lte.'+toDate+'&select=inspection_date,status,project_name', {headers:H})
    ]);

    const calls      = callRes.ok     ? await callRes.json()     : [];
    const tasks      = taskRes.ok     ? await taskRes.json()     : [];
    const takeoffs   = takeoffRes.ok  ? await takeoffRes.json()  : [];
    const txns       = txnRes.ok      ? await txnRes.json()      : [];
    const memos      = memoRes.ok     ? await memoRes.json()     : [];
    const inspections= insRes.ok      ? await insRes.json()      : [];

    _weeklyRawData = { calls, tasks, takeoffs, txns, memos, inspections };

    // Stats
    const totalPaid  = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);
    const statIds    = ['ws-calls','ws-tasks','ws-takeoffs','ws-payments','ws-memos','ws-inspections'];
    const statVals   = [
      calls.length,
      tasks.length,
      takeoffs.length,
      totalPaid ? '₪'+totalPaid.toLocaleString('he-IL',{maximumFractionDigits:0}) : '0',
      memos.length,
      inspections.length
    ];
    statIds.forEach((id,i) => { const el=document.getElementById(id); if(el) el.textContent=statVals[i]; });

    // Raw data accordion
    _renderWeeklyRaw(calls, tasks, takeoffs, txns, memos, inspections);

    // Check for API key
    await weeklyCheckKey();

    if (out) out.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">לחץ <strong>צור דוח AI</strong> לקבלת ניתוח מלא</div>';

  } catch(e) {
    if (out) out.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red);font-size:13px;">שגיאה: '+e.message+'</div>';
  }
}

async function weeklyCheckKey() {
  const keyRow = document.getElementById('weekly-key-row');
  if (!keyRow) return;

  // Try APP.config first
  if (APP.config && APP.config.anthropic_key) {
    _weeklyAnthropicKey = APP.config.anthropic_key;
    keyRow.style.display = 'none';
    return;
  }
  // Try fetching from app_config table
  try {
    const res = await sbQ('app_config', 'select=key,value&key=eq.anthropic_key');
    if (res.data && res.data.length && res.data[0].value) {
      _weeklyAnthropicKey = res.data[0].value;
      keyRow.style.display = 'none';
      return;
    }
  } catch(e) {}
  keyRow.style.display = 'block';
}

async function weeklySaveKey() {
  const inp = document.getElementById('weekly-api-key');
  const key = inp ? inp.value.trim() : '';
  if (!key.startsWith('sk-')) { showToast('מפתח לא תקין — צריך להתחיל ב-sk-', 'error'); return; }
  try {
    await sb.from('app_config').upsert({ key: 'anthropic_key', value: key }, { onConflict: 'key' });
    _weeklyAnthropicKey = key;
    if (APP.config) APP.config.anthropic_key = key;
    document.getElementById('weekly-key-row').style.display = 'none';
    showToast('✅ מפתח נשמר', 'success');
  } catch(e) { showToast('שגיאה: '+e.message, 'error'); }
}

async function generateWeeklyReport() {
  if (!_weeklyAnthropicKey) { await weeklyCheckKey(); }
  if (!_weeklyAnthropicKey) {
    document.getElementById('weekly-key-row').style.display = 'block';
    showToast('נדרש מפתח Anthropic API', 'error');
    return;
  }

  const out    = document.getElementById('weekly-report-out');
  const btn    = document.getElementById('weekly-gen-btn');
  const waBar  = document.getElementById('weekly-wa-bar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ מייצר...'; }
  if (out) out.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;"><div style="font-size:32px;margin-bottom:8px;">🧠</div>Claude מנתח את השבוע...</div>';

  const { calls=[], tasks=[], takeoffs=[], txns=[], memos=[], inspections=[] } = _weeklyRawData;
  const { from, to } = weeklyGetRange(_weeklyOffset);
  const fStr = from.toLocaleDateString('he-IL',{day:'numeric',month:'long'});
  const tStr = to.toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'});
  const totalPaid = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);
  const totalIncome = txns.filter(t=>t.type==='client_income').reduce((s,t)=>s+Number(t.amount||0),0);

  const memoSummaries = memos.slice(0,10).map(m => {
    const ai = m.ai_result ? (typeof m.ai_result==='string' ? (() => { try { return JSON.parse(m.ai_result); } catch(e){ return null; } })() : m.ai_result) : null;
    return ai?.summary || (m.transcript||'').substring(0,80);
  }).filter(Boolean).join(' | ');

  const contractorsPaid = [...new Set(txns.filter(t=>t.type==='sent').map(t=>t.contractors_master?.company_name).filter(Boolean))].join(', ');
  const projectsActive  = [...new Set([
    ...takeoffs.map(t=>t.project_name),
    ...txns.map(t=>t.projects?.project_name)
  ].filter(Boolean))].join(', ');

  const prompt = `אתה מנהל בנייה בכיר. סכם את השבוע בשטח של בני פרסקי (מנהל שטח) עבור הנהלת סטונהרד.

תקופה: ${fStr} – ${tStr}

נתונים:
- שיחות טלפון: ${calls.length} (נכנסות: ${calls.filter(c=>c.direction==='incoming').length}, יוצאות: ${calls.filter(c=>c.direction==='outgoing').length}, לא נענו: ${calls.filter(c=>c.direction==='missed').length})
- משימות שהושלמו: ${tasks.length}
- מדידות שהוגשו: ${takeoffs.length}
- תשלומים לקבלנים: ₪${totalPaid.toLocaleString()}
- הכנסות מלקוחות: ₪${totalIncome.toLocaleString()}
- הקלטות קוליות: ${memos.length}
- ביקורות בטיחות: ${inspections.length}
- קבלנים ששולמו להם: ${contractorsPaid || 'אין'}
- פרויקטים פעילים: ${projectsActive || 'אין'}
- תמצית הקלטות: ${memoSummaries || 'אין'}

כתוב דוח ניהולי קצר בעברית — 3 פסקאות בלבד:
1. **סיכום השבוע** — מה הושג
2. **נושאים פתוחים** — מה דורש תשומת לב
3. **המלצה לשבוע הבא**

פורמט: טקסט נקי, עברית, מקצועי. אין נקודות, אין כותרות מיוחדות.`;

  try {
    const res = await claudeFetch(JSON.stringify({ _apiKey: _weeklyAnthropicKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      }), null);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);

    const text = data.content?.[0]?.text || '';
    _weeklyAIReport = text;

    if (out) {
      out.innerHTML = '<div style="background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(59,130,246,0.08));border:1.5px solid rgba(139,92,246,0.3);border-radius:14px;padding:20px 22px;">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">'
        + '<span style="font-size:20px;">🧠</span>'
        + '<div style="font-size:13px;font-weight:800;color:var(--text);">ניתוח AI — ' + fStr + ' – ' + tStr + '</div>'
        + '<span style="background:rgba(139,92,246,0.2);color:#8b5cf6;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:800;margin-right:auto;">Claude Sonnet</span>'
        + '</div>'
        + '<div style="font-size:14px;color:var(--text);line-height:1.9;white-space:pre-wrap;">' + text.replace(/</g,'&lt;') + '</div>'
        + '</div>';
    }
    if (waBar) waBar.style.display = 'flex';
    showToast('✅ דוח AI נוצר', 'success');

  } catch(e) {
    if (out) out.innerHTML = '<div style="padding:16px;color:var(--red);font-size:13px;border:1.5px solid var(--red);border-radius:10px;">שגיאה ב-API: '+e.message+'</div>';
    showToast('שגיאה: '+e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🧠 צור דוח AI'; }
  }
}

function weeklyWhatsApp() {
  if (!_weeklyAIReport) return;
  const { from, to } = weeklyGetRange(_weeklyOffset);
  const fStr = from.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
  const tStr = to.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
  const { calls=[], tasks=[], takeoffs=[], txns=[], memos=[], inspections=[] } = _weeklyRawData;
  const totalPaid = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);

  let msg = '📊 *דוח שבועי סטונהרד — ' + fStr + ' – ' + tStr + '*\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += _weeklyAIReport + '\n\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += '📞 שיחות: ' + calls.length + '  ✅ משימות: ' + tasks.length + '  📐 מדידות: ' + takeoffs.length + '\n';
  msg += '💸 שולם: ₪' + totalPaid.toLocaleString('he-IL',{maximumFractionDigits:0}) + '  🎙️ הקלטות: ' + memos.length + '  🔍 ביקורות: ' + inspections.length;

  var a=document.createElement('a');a.href='https://wa.me/?text='+encodeURIComponent(msg);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}

async function weeklySaveAsReport() {
  if (!_weeklyAIReport) return;
  const { from, to } = weeklyGetRange(_weeklyOffset);
  const reportNum = 'WKL-' + from.toISOString().split('T')[0].replace(/-/g,'');
  const { calls=[], tasks=[], takeoffs=[], txns=[] } = _weeklyRawData;
  const totalPaid = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);
  showLoading(true);
  try {
    const { error } = await sb.from('reports').insert({
      report_number: reportNum,
      report_date:   from.toISOString().split('T')[0],
      project_name:  'סיכום שבועי',
      manager_name: (APP.config&&APP.config.manager_name)||'בני פרסקי',
      general_notes: _weeklyAIReport.substring(0,500) + '\n\nשיחות: '+calls.length+' | משימות: '+tasks.length+' | מדידות: '+takeoffs.length+' | שולם: ₪'+totalPaid.toLocaleString(),
      status:        'draft'
    });
    if (error) throw error;
    showToast('✅ נשמר: ' + reportNum, 'success');
    await loadReports();
  } catch(e) { showToast('שגיאה: '+e.message, 'error'); }
  finally { showLoading(false); }
}

function _renderWeeklyRaw(calls, tasks, takeoffs, txns, memos, inspections) {
  const el = document.getElementById('weekly-raw');
  if (!el) return;

  const section = (icon, title, count, rows) => {
    if (!count) return '';
    return '<details style="margin-bottom:10px;">'
      + '<summary style="cursor:pointer;padding:10px 14px;background:var(--surface2);border-radius:10px;font-size:13px;font-weight:700;color:var(--text);list-style:none;display:flex;justify-content:space-between;align-items:center;">'
      + '<span>' + icon + ' ' + title + '</span>'
      + '<span style="background:var(--accent);color:white;border-radius:20px;padding:1px 8px;font-size:11px;">' + count + '</span>'
      + '</summary>'
      + '<div style="padding:10px 14px;background:var(--surface);border-radius:0 0 10px 10px;border:1px solid var(--border);border-top:none;">'
      + rows + '</div></details>';
  };

  const callRows = calls.slice(0,10).map(c => {
    const t = new Date(c.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const icon = c.direction==='missed' ? '📵' : c.direction==='outgoing' ? '📲' : '📞';
    return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">' + icon + ' ' + (c.caller_name||'לא ידוע').replace(/</g,'&lt;') + ' · ' + t + (c.wa_sent?' 💬':'') + '</div>';
  }).join('');

  const taskRows = tasks.slice(0,10).map(t =>
    '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">✅ ' + (t.text||'').substring(0,80).replace(/</g,'&lt;') + '</div>'
  ).join('');

  const takeoffRows = takeoffs.map(t =>
    '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">📐 ' + (t.project_name||'ללא פרויקט').replace(/</g,'&lt;') + (t.total_area ? ' · ' + Number(t.total_area).toFixed(1) + ' מ"ר' : '') + '</div>'
  ).join('');

  const txnRows = txns.slice(0,8).map(t => {
    const amt = Number(t.amount||0).toLocaleString('he-IL',{maximumFractionDigits:0});
    const type = t.type==='sent' ? '💸' : '✅';
    return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">' + type + ' ₪' + amt + ' · ' + (t.contractors_master?.company_name||'').replace(/</g,'&lt;') + '</div>';
  }).join('');

  el.innerHTML = '<div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">פירוט נתונים</div>'
    + section('📞', 'שיחות', calls.length, callRows)
    + section('✅', 'משימות שהושלמו', tasks.length, taskRows)
    + section('📐', 'מדידות', takeoffs.length, takeoffRows)
    + section('💰', 'תנועות כספיות', txns.length, txnRows);
}


async function loadRecentInspections() {
  var list  = document.getElementById('inspections-list');
  var badge = document.getElementById('inspect-safety-badge');
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:18px;color:var(--text3);font-size:13px;">Loading...</div>';

  try {
    // Last 7 days
    var from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    var res  = await fetch(
      SB_URL + '/rest/v1/site_inspections?inspection_date=gte.' + from +
      '&order=created_at.desc&limit=20',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var inspections = await res.json();

    // Flag safety issues
    var safetyCount = (inspections || []).filter(function(i) { return i.overall_status === 'safety'; }).length;
    if (badge) { badge.textContent = '🚨 ' + safetyCount; badge.style.display = safetyCount ? 'inline' : 'none'; }

    if (!inspections || !inspections.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">No inspections in last 7 days</div>';
      return;
    }

    var STATUS_CONFIG = {
      green:  { label:'✅ Approved',  color:'#22c55e', bg:'rgba(34,197,94,0.08)'  },
      yellow: { label:'⚠️ Warning',   color:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
      red:    { label:'❌ Rejected',  color:'#ef4444', bg:'rgba(239,68,68,0.08)'  },
      safety: { label:'🚨 SAFETY',    color:'#dc2626', bg:'rgba(220,38,38,0.12)'  },
    };

    list.innerHTML = '';
    inspections.forEach(function(insp) {
      var cfg  = STATUS_CONFIG[insp.overall_status] || STATUS_CONFIG.green;
      var date = insp.inspection_date
        ? new Date(insp.inspection_date + 'T12:00:00').toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit'})
        : '';
      var time = insp.inspection_time || '';

      // Parse photos
      var photos = [];
      try { photos = insp.photos ? (typeof insp.photos === 'string' ? JSON.parse(insp.photos) : insp.photos) : []; } catch(e){}

      var card = document.createElement('div');
      card.style.cssText = 'border:1.5px solid ' + cfg.color + '40;border-right:4px solid ' + cfg.color +
        ';border-radius:10px;padding:12px;margin-bottom:8px;background:' + cfg.bg + ';';

      // Safety — extra prominent styling
      if (insp.overall_status === 'safety') {
        card.style.cssText += 'animation:pulse-border 2s infinite;';
      }

      card.innerHTML = [
        // Header
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">',
          '<div>',
            '<div style="font-size:13px;font-weight:900;color:var(--text);">' + esc(insp.contractor_name || 'Unknown') + '</div>',
            '<div style="font-size:10px;color:var(--text3);margin-top:2px;">',
              (insp.project_name ? '📁 ' + esc(insp.project_name) + ' · ' : '') + date + (time ? ' ' + time : ''),
            '</div>',
          '</div>',
          '<span style="background:' + cfg.color + '20;color:' + cfg.color + ';border-radius:20px;padding:3px 10px;font-size:11px;font-weight:800;">',
            cfg.label,
          '</span>',
        '</div>',

        // Findings
        insp.findings ? '<div style="font-size:12px;color:var(--text2);margin-bottom:6px;line-height:1.5;">' +
          '<span style="font-weight:700;">Findings: </span>' + esc(insp.findings.substring(0, 120)) +
          (insp.findings.length > 120 ? '...' : '') + '</div>' : '',

        // Instructions
        insp.instructions ? '<div style="font-size:12px;color:var(--text2);margin-bottom:6px;line-height:1.5;">' +
          '<span style="font-weight:700;color:#1a3d5c;">Instructions: </span>' + esc(insp.instructions.substring(0, 100)) +
          (insp.instructions.length > 100 ? '...' : '') + '</div>' : '',

        // Safety hazard box
        insp.safety_hazard ? '<div style="background:rgba(220,38,38,0.15);border-radius:6px;padding:8px;margin-bottom:6px;">' +
          '<div style="font-size:11px;font-weight:900;color:#dc2626;margin-bottom:3px;">🚨 SAFETY HAZARD</div>' +
          '<div style="font-size:12px;color:#dc2626;">' + esc(insp.safety_hazard.substring(0, 120)) + '</div>' +
          (insp.safety_deadline ? '<div style="font-size:10px;font-weight:800;color:#dc2626;margin-top:4px;">Deadline: ' +
            (insp.safety_deadline === 'immediate' ? '🔴 IMMEDIATE — STOP WORK' :
             insp.safety_deadline === 'today' ? '🟡 Fix by end of today' : '📅 Fix this week') + '</div>' : '') +
          '</div>' : '',

        // Photos
        photos.length ? '<div style="display:flex;gap:4px;margin-top:4px;">' +
          photos.slice(0, 4).map(function(path) {
            var url = SB_URL + '/storage/v1/object/public/photos/' + path;
            return '<img src="' + url + '" data-url="' + url + '" onclick="window.open(this.dataset.url,\'_blank\')" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;">';
          }).join('') +
          (photos.length > 4 ? '<div style="width:44px;height:44px;background:var(--surface2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text3);">+' + (photos.length - 4) + '</div>' : '') +
          '</div>' : '',

        // WA sent badge
        insp.wa_sent ? '<div style="font-size:10px;color:var(--text3);margin-top:6px;">💬 WhatsApp sent</div>' : '',

      ].join('');

      list.appendChild(card);
    });

  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">Error: ' + e.message + '</div>';
  }
}

async function renderAnnexWidget() {
  await loadAnnexList(); // ensure loaded from Supabase
  var container = document.getElementById('annexes-widget-inner');
  if (!container) return;

  var html = [
    // Send section
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">',
      '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:12px;">📤 שלח נספחים לקבלן</div>',
      // Contractor + Project selects
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">',
        '<div style="flex:1;min-width:140px;">',
          '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">קבלן *</div>',
          '<select id="annex-contractor-sel" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;background:var(--surface);color:var(--text);">',
            '<option value="">בחר קבלן...</option>',
          '</select>',
        '</div>',
        '<div style="flex:1;min-width:120px;">',
          '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">פרויקט</div>',
          '<select id="annex-project-sel" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;background:var(--surface);color:var(--text);">',
            '<option value="">בחר פרויקט...</option>',
          '</select>',
        '</div>',
      '</div>',
      // Annex checkboxes
      '<div style="font-size:11px;font-weight:800;color:var(--text2);margin-bottom:8px;">בחר נספחים לשליחה:</div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px;" id="annex-checkboxes">',
  ].join('');

  ANNEX_LIST.forEach(function(a) {
    var pdfUrl = _annexStorageBase + 'annex_' + a.num + '.pdf';
    html +=
      '<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:6px;background:var(--surface);border:1px solid var(--border);">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;min-width:0;">' +
          '<input type="checkbox" class="annex-cb" value="' + a.num + '" style="width:14px;height:14px;cursor:pointer;flex-shrink:0;">' +
          '<span style="font-size:11px;font-weight:600;color:var(--text2);">' + a.num + '. ' + a.title + '</span>' +
        '</label>' +
        '<a href="' + pdfUrl + '" target="_blank" rel="noopener" ' +
           'style="flex-shrink:0;padding:3px 7px;background:#1a3d5c;color:white;border-radius:5px;font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap;" ' +
           'title="צפה ב-PDF">👁️ צפה</a>' +
      '</div>';
  });

  html += [
      '</div>',
      // Select all + Send button
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">',
        '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);cursor:pointer;">',
          '<input type="checkbox" id="annex-select-all" onchange="toggleAllAnnexes(this.checked)" style="width:13px;height:13px;">',
          'בחר הכל',
        '</label>',
        '<div style="flex:1;"></div>',
        '<button onclick="sendAnnexes()" style="padding:9px 16px;background:linear-gradient(135deg,#15803d,#16a34a);color:white;border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">',
          '💬 שלח נספחים בוואטסאפ',
        '</button>',
      '</div>',
    '</div>',
    // Sent history
    '<div id="annexes-history"><div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">טוען היסטוריה...</div></div>',
  ].join('');

  container.innerHTML = html;

  // Fill selects
  var cSel = document.getElementById('annex-contractor-sel');
  var pSel = document.getElementById('annex-project-sel');
  (allContractors || []).filter(function(c){ return c.is_active; }).forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.id; opt.dataset.name = c.company_name;
    opt.dataset.mobile = c.mobile || '';
    opt.textContent = c.company_name;
    cSel.appendChild(opt);
  });
  (allProjects || []).forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = p.id; opt.dataset.name = p.project_name;
    opt.textContent = p.project_name;
    pSel.appendChild(opt);
  });

  loadAnnexHistory();
}

function _spFillSelects(){const cSel=document.getElementById('sp-contractor-sel');if(cSel&&allContractors.length){cSel.innerHTML='<option value="">בחר קבלן...</option>'+(allContractors||[]).filter(c=>c.is_active).map(c=>`<option value="${c.id}">${esc(c.company_name)}</option>`).join('');}const pSel=document.getElementById('sp-project-sel');if(pSel&&allProjects.length){pSel.innerHTML='<option value="">כל הפרויקטים</option>'+(allProjects||[]).map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');}}

// ── BENI WIDGET HELPERS ────────────────────────────────────
async function _spPlug(id,a,b){const card=document.getElementById('spr-'+id);if(card)card.style.opacity='0.4';try{await fetch(SB_URL+'/rest/v1/site_reports?id=eq.'+id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'approved',plugged_in:true,plugged_in_at:new Date().toISOString()})});setTimeout(loadSiteReports,800);}catch(e){console.error(e);if(card)card.style.opacity='1';}}
async function _spDelete(id){if(!confirm('מחוק דוח זה?'))return;try{await fetch(SB_URL+'/rest/v1/site_reports?id=eq.'+id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'deleted'})});setTimeout(loadSiteReports,500);}catch(e){console.error(e);}}


// ── ADDITIONAL HELPERS ─────────────────────────────────────

function addContractorRow(data={}){const tbody=document.getElementById('contractorsBody');const emptyRow=tbody.querySelector('.contractors-empty');if(emptyRow)emptyRow.closest('tr').remove();const tr=document.createElement('tr');tr.innerHTML='<td><input type="text" placeholder="שם חברה / קבלן" class="contr-company" value="'+(data.company_name||'')+'"></td><td><input type="text" placeholder="שם איש קשר" class="contr-contact" value="'+(data.contact_name||'')+'"></td><td><input type="tel" placeholder="05X-XXXXXXX" class="contr-mobile" value="'+(data.mobile||'')+'" style="min-width:120px"></td><td><input type="tel" placeholder="0X-XXXXXXX" class="contr-office" value="'+(data.office_tel||'')+'" style="min-width:110px"></td><td><select class="contr-occupation">'+OCCUPATION_OPTIONS.map(o=>'<option value="'+o+'" '+(o===data.main_occupation?'selected':'')+'>'+( o||'— בחר עיסוק —')+'</option>').join('')+'</select></td><td><input type="text" placeholder="מה הוא עושה בפרוייקט זה?" class="contr-activity" value="'+(data.project_activity||'')+'" style="min-width:160px"></td><td class="td-actions"><button type="button" class="btn-remove-contractor" onclick="removeContractorRow(this)" title="הסר">×</button></td>';tbody.appendChild(tr);}
function removeContractorRow(btn){const tbody=document.getElementById('contractorsBody');btn.closest('tr').remove();if(tbody.rows.length===0){const tr=document.createElement('tr');tr.innerHTML='<td colspan="7" class="contractors-empty">לחץ ״➕ הוסף קבלן״</td>';tbody.appendChild(tr);}}

function addEquipmentFromList(){const sel=document.getElementById('equipmentQuickSelect');if(!sel)return;const val=sel.value;if(!val){showToast('בחר ציוד מהרשימה תחילה', 'error'); return;}if(val==='__other__'){addEquipmentRow('');sel.value='';return;}addEquipmentRow(val);sel.value='';}

function addMaterialFromList(){const sel=document.getElementById('materialQuickSelect');if(!sel)return;const val=sel.value;if(!val){showToast('בחר חומר מהרשימה תחילה', 'error'); return;}if(val==='__other__'){addMaterialRow('');sel.value='';return;}addMaterialRow(val);sel.value='';}

function addTomorrowRow(){
  const container=document.getElementById('tomorrowExtraRows');
  if(!container)return;
  const row=document.createElement('div');
  row.className='tomorrow-row';
  const delBtn=document.createElement('button');
  delBtn.type='button';delBtn.textContent='×';
  delBtn.style.cssText='background:#e74c3c;color:#fff;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px;flex-shrink:0;';
  delBtn.onclick=function(){this.closest('.tomorrow-row').remove();};
  row.innerHTML='<input type="text" placeholder="כותרת פריט" class="tomorrow-label" style="min-width:140px;border:2px solid #667eea;border-radius:8px;padding:8px;font-size:13px;font-weight:700;color:#1a3d5c;background:#fff"><input type="text" class="tomorrow-detail" placeholder="פרטים...">';
  row.appendChild(delBtn);
  container.appendChild(row);
  row.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function closeLightbox() {
  var lb = document.getElementById('photo-lightbox');
  if (lb) lb.style.display = 'none';
}

async function galleryUpload(input) {
  var files = Array.from(input.files || []);
  if (!files.length || !_galleryProjectId) return;
  var statusEl = document.getElementById('gallery-upload-status');
  if (statusEl) statusEl.textContent = 'Uploading...';

  var uploaded = 0;
  for (var i = 0; i < files.length; i++) {
    try {
      var f    = files[i];
      var ext  = f.name.split('.').pop() || 'jpg';
      var path = 'projects/' + _galleryProjectId + '/' + Date.now() + '_' + i + '.' + ext;
      var { error } = await sb.storage.from('photos').upload(path, f, { upsert: false });
      if (!error) uploaded++;
    } catch(e) { console.error('upload:', e); }
  }

  input.value = '';
  if (statusEl) statusEl.textContent = uploaded + ' uploaded ✅';
  setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
  await galleryLoad(); // Refresh
}

async function openPhotoGallery(projectId, projectName) {
  _galleryProjectId   = projectId;
  _galleryProjectName = projectName;
  _galleryPhotos      = [];

  document.getElementById('gallery-modal-title').textContent = '📸 ' + projectName;
  document.getElementById('gallery-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text3);">Loading photos...</div>';
  document.getElementById('modal-gallery').style.display = 'flex';

  await galleryLoad();
}

async function galleryLoad() {
  if (!_galleryProjectId) return;
  _galleryPhotos = [];

  try {
    // ── 1. Photos from Supabase Storage (manually uploaded via gallery modal) ──
    const { data: storageFiles } = await sb.storage.from('photos')
      .list('projects/' + _galleryProjectId, { limit: 100 });
    (storageFiles || []).forEach(function(f) {
      if (!f.name || f.name === '.emptyFolderPlaceholder') return;
      _galleryPhotos.push({
        url:     SB_URL + '/storage/v1/object/public/photos/projects/' + _galleryProjectId + '/' + f.name,
        source:  'manual',
        caption: f.name,
        date:    f.created_at ? f.created_at.split('T')[0] : '',
        type:    'image'
      });
    });

    // ── 2. Videos + photos from beni_notes (Beni Pocket field media) ──────────
    const { data: notes } = await sbQ('beni_notes',
      'select=id,note_text,photo_url,color,created_at&project_id=eq.' + _galleryProjectId
      + '&photo_url=not.is.null&order=created_at.desc&limit=50');
    (notes || []).forEach(function(n) {
      if (!n.photo_url) return;
      var url      = n.photo_url.startsWith('http') ? n.photo_url
                   : SB_URL + '/storage/v1/object/public/photos/' + n.photo_url;
      var isVideo  = url.includes('drive.google.com') || /\.(mp4|mov|webm|avi|m4v)/i.test(url);
      var caption  = (n.note_text || '').replace(/\n.*$/,'').substring(0, 80);
      _galleryPhotos.push({
        url:     url,
        source:  isVideo ? 'video' : 'manual',
        caption: caption,
        date:    n.created_at ? n.created_at.split('T')[0] : '',
        type:    isVideo ? 'video' : 'image',
        noteId:  n.id
      });
    });

    // ── 3. Photos from approved site_pulse reports ───────────────────────────
    const { data: reports } = await sbQ('site_reports',
      'select=id,photos,submitted_at&project_id=eq.' + _galleryProjectId + '&status=eq.approved');
    (reports || []).forEach(function(r) {
      var photos = [];
      try { photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []); } catch(e){}
      photos.forEach(function(path) {
        if (!path) return;
        _galleryPhotos.push({
          url:    SB_URL + '/storage/v1/object/public/photos/' + path,
          source: 'site_pulse',
          caption:'Site Pulse',
          date:   r.submitted_at ? r.submitted_at.split('T')[0] : '',
          type:   'image'
        });
      });
    });

  } catch(e) { console.error('galleryLoad:', e); }

  renderGallery();
}

function renderGallery() {
  var grid    = document.getElementById('gallery-grid');
  var filter  = document.getElementById('gallery-filter-source')?.value || 'all';
  var countEl = document.getElementById('gallery-count');

  var filtered = filter === 'all' ? _galleryPhotos :
    _galleryPhotos.filter(function(p){ return p.source === filter; });

  if (countEl) {
    var vids = filtered.filter(function(p){ return p.type==='video'; }).length;
    var imgs = filtered.length - vids;
    countEl.textContent = imgs + ' photo' + (imgs!==1?'s':'') + (vids?' · '+vids+' video'+(vids!==1?'s':''):'');
  }

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);">' +
      '<div style="font-size:40px;margin-bottom:10px;">📷</div>' +
      '<div>No photos yet for this project</div>' +
      '<div style="font-size:12px;margin-top:6px;">Upload photos above or approve Site Pulse reports with photos</div>' +
      '</div>';
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(function(ph, i) {
    var div = document.createElement('div');
    div.style.cssText = 'position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--border);cursor:pointer;background:#000;';

    if (ph.type === 'video') {
      // ── Video tile ──────────────────────────────────────────────
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#242438);';
      overlay.innerHTML = '<div style="font-size:36px;">🎬</div>'
        + '<div style="font-size:10px;color:#c4b5fd;font-weight:700;margin-top:4px;">סרטון</div>';
      div.appendChild(overlay);
      div.addEventListener('click', function(){ window.open(ph.url, '_blank'); });
    } else {
      // ── Image tile ──────────────────────────────────────────────
      var img = document.createElement('img');
      img.src = ph.url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;transition:transform 0.2s;';
      img.onerror = function() { this.style.display='none'; this.parentElement.style.background='#f0f0f0'; this.parentElement.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;">📷</div>'; };
      img.addEventListener('mouseenter', function(){ this.style.transform='scale(1.05)'; });
      img.addEventListener('mouseleave', function(){ this.style.transform='scale(1)'; });
      div.appendChild(img);
      div.addEventListener('click', function(){ openLightbox(ph.url, ph.caption); });
    }

    // Source badge
    var badge = document.createElement('div');
    badge.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.65);color:white;font-size:9px;padding:2px 5px;border-radius:4px;';
    badge.textContent = ph.type==='video' ? '🎬' : ph.source==='site_pulse' ? '🏗️' : '📤';
    div.appendChild(badge);

    // Date caption
    if (ph.date) {
      var cap = document.createElement('div');
      cap.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;font-size:10px;padding:12px 4px 4px;text-align:center;';
      cap.textContent = new Date(ph.date+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
      div.appendChild(cap);
    }

    grid.appendChild(div);
  });
}

async function sendAnnexes() {
  var cSel = document.getElementById('annex-contractor-sel');
  var pSel = document.getElementById('annex-project-sel');
  var cId   = cSel ? cSel.value : '';
  var cName = cSel && cSel.selectedOptions[0] ? cSel.selectedOptions[0].dataset.name : '';
  var cMob  = cSel && cSel.selectedOptions[0] ? cSel.selectedOptions[0].dataset.mobile : '';
  var pId   = pSel ? pSel.value : '';
  var pName = pSel && pSel.selectedOptions[0] ? pSel.selectedOptions[0].dataset.name : '';

  if (!cId) { showToast('בחר קבלן תחילה', 'error'); return; }

  var selected = Array.from(document.querySelectorAll('.annex-cb:checked')).map(function(cb){ return cb.value; });
  if (!selected.length) { showToast('בחר לפחות נספח אחד', 'error'); return; }

  try {
    // INSERT into contractor_annexes_sent → get confirm_token
    var res = await fetch(SB_URL + '/rest/v1/contractor_annexes_sent', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        contractor_id:   cId || null,
        contractor_name: cName,
        project_id:      pId  || null,
        project_name:    pName || null,
        annexes_sent:    selected,
        sent_by:         'Beni Persky',
        status:          'pending'
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var rows = await res.json();
    var token = rows[0] && rows[0].confirm_token;
    if (!token) throw new Error('No token returned');

    var confirmUrl = ANNEX_CONFIRM_URL + '?token=' + token;
    var NL = '\n';
    var phone = cMob ? '972' + cMob.replace(/[^0-9]/g,'').replace(/^0/,'') : '';

    // Build WA message with links to each PDF + confirmation link
    var annexLines = selected.map(function(num, i) {
      var meta = ANNEX_LIST.find(function(a){ return a.num === num; });
      var title = meta ? meta.title : 'נספח ' + num;
      return (i+1) + '. נספח ' + num + ' — ' + title + NL +
             '   📄 ' + _annexStorageBase + 'annex_' + num + '.pdf';
    }).join(NL);

    var msg = 'שלום ' + cName + ',' + NL + NL +
              ((APP.config&&APP.config.orderer_short)||'בני פרסקי') + ' שולח לך את נספחי הבטיחות הבאים לחוזה:' + NL +
              (pName ? 'פרויקט: ' + pName : '') + NL + NL +
              annexLines + NL + NL +
              '✅ לאישור קבלת הנספחים — לחץ כאן:' + NL +
              confirmUrl + NL + NL +
              'תודה — '+((APP.config&&APP.config.orderer_short)||'בני פרסקי')+' 🏗️';

    var waUrl = (phone ? 'https://wa.me/' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(msg);
    var _a = document.createElement('a');
    _a.href = waUrl; _a.target = '_blank'; _a.rel = 'noopener';
    document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);

    showToast('נספחים נשלחו בוואטסאפ', 'success');
    loadAnnexHistory();

  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
    console.error('sendAnnexes:', e);
  }
}

async function spApprove(reportId) {
  var r = _spReportCache[reportId] || {};
  var contractorName = r.contractor_name || '';
  var projectName    = r.project_name   || '';
  var reportDate     = r.report_date    || new Date().toISOString().slice(0,10);
  var activities     = r.activities     || '';
  var workers = [];
  try { workers = typeof r.workers==='string' ? JSON.parse(r.workers) : (r.workers||[]); } catch(e2){}
  var totalWorkers = workers.reduce(function(s,w){ return s+(parseInt(w.count)||1); }, 0);
  var photos = [];
  try { photos = typeof r.photos==='string' ? JSON.parse(r.photos) : (r.photos||[]); } catch(e3){}
  var projectId    = r.project_id   || null;
  var contractorId = r.contractor_id|| null;
  var contractor   = (allContractors||[]).find(function(c){ return c.id===contractorId; });
  var mobile       = contractor ? (contractor.mobile||'') : '';
  try {
    // 1. Mark approved in Supabase (only use columns that exist in site_reports)
    await fetch(SB_URL + '/rest/v1/site_reports?id=eq.' + reportId, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'approved' })
    });
    // 2. Auto-create daily journal entry (use only base columns)
    try {
      await fetch(SB_URL + '/rest/v1/reports', {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
                   'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          project_name: projectName || 'Site Pulse Report',
          report_date:  reportDate,
          manager_name: contractorName,
          general_notes: activities,
          status:       'approved'
        })
      });
    } catch(e4) { console.error('Journal entry non-critical:', e4.message); }
    // 3. Photos appear in gallery automatically (galleryLoad reads approved site_reports)
    // 4. Send WhatsApp confirmation to contractor
    if (mobile) {
      var NL    = '\n';
      var phone = '972' + mobile.replace(/[^0-9]/g,'').replace(/^0/,'');
      var dHe   = new Date(reportDate+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
      var waMsg = 'Beni Persky approved your report' + NL +
                  (projectName ? 'Project: '+projectName+NL : '') +
                  'Date: '+dHe+NL +
                  (totalWorkers>0 ? 'Workers: '+totalWorkers+NL : '') +
                  NL + 'Report received and approved. Thank you!';
      var waUrl = 'https://wa.me/'+phone+'?text='+encodeURIComponent(waMsg);
      var _a=document.createElement('a'); _a.href=waUrl; _a.target='_blank'; _a.rel='noopener';
      document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
    }
    var card = document.getElementById('spr-'+reportId);
    if (card) { card.style.transition='all 0.4s'; card.style.opacity='0'; card.style.maxHeight='0'; }
    setTimeout(function(){ loadSiteReports(); }, 500);
    showToast('Report approved — WA sent to contractor', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); console.error('spApprove:',e); }
}

function spReject(reportId) {
  var r = _spReportCache[reportId] || {};
  document.getElementById('sp-reject-id').value = reportId;
  document.getElementById('sp-reject-contractor-label').textContent =
    (r.contractor_name || 'Unknown') + (r.project_name ? ' | ' + r.project_name : '');
  document.getElementById('sp-reject-report-label').textContent =
    'Date: ' + (r.report_date || '') + (r.submitted_by ? ' | by: '+r.submitted_by : '');
  document.getElementById('sp-reject-reason').value = '';
  document.getElementById('modal-sp-reject').style.display = 'flex';
}

function switchGcalView(view){['agenda','week','month'].forEach(v=>{const div=document.getElementById('gcal-'+v);if(div)div.style.display=v===view?'block':'none';const btn=document.querySelector('.gcal-view-btn[data-view="'+v+'"]');if(btn){btn.style.background=v===view?'rgba(154,111,0,0.3)':'rgba(255,255,255,0.07)';btn.style.borderColor=v===view?'#9a6f00':'rgba(255,255,255,0.15)';btn.style.color=v===view?'#f59e0b':'#ccc';}});const iframe=document.getElementById('iframe-'+view);if(iframe&&iframe.dataset.src&&iframe.src==='about:blank'){iframe.src=iframe.dataset.src;}}

function syncProjectNameToSelect(){}
function getJournalProjectName(){const sel=document.getElementById('projectName');if(!sel)return'';if(sel.value==='__custom__'){return(document.getElementById('projectNameCustom')?.value||'').trim();}return sel.value||'';}

function toggleAllAnnexes(checked) {
  document.querySelectorAll('.annex-cb').forEach(function(cb){ cb.checked = checked; });
}

function onJournalProjectChange(sel){const customRow=document.getElementById('project-custom-name-row');if(!customRow)return;if(sel.value==='__custom__'){customRow.style.display='block';document.getElementById('projectNameCustom').focus();}else{customRow.style.display='none';}}


async function _spConfirmReject() {
  var reportId = document.getElementById('sp-reject-id').value;
  var reason   = document.getElementById('sp-reject-reason').value.trim();
  if (!reason) { showToast('נא להזין סיבת דחייה', 'error'); return; }
  var r            = _spReportCache[reportId] || {};
  var contractorId = r.contractor_id || null;
  var contractor   = (allContractors||[]).find(function(c){ return c.id===contractorId; });
  var mobile       = contractor ? (contractor.mobile||'') : '';
  try {
    await fetch(SB_URL + '/rest/v1/site_reports?id=eq.' + reportId, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'rejected' })
    });
    if (mobile) {
      var NL = '\n';
      var phone = '972' + mobile.replace(/[^0-9]/g,'').replace(/^0/,'');
      var dHe = r.report_date ? new Date(r.report_date+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
      var waMsg = 'דוח האתר שלך נדחה על ידי בני פרסקי.' + NL +
                  (r.project_name ? 'פרויקט: '+r.project_name+NL : '') +
                  (dHe ? 'תאריך: '+dHe+NL : '') +
                  NL + 'סיבה: '+reason+NL+NL + 'נא לתקן ולשלוח מחדש. תודה.';
      var waUrl = 'https://wa.me/'+phone+'?text='+encodeURIComponent(waMsg);
      var _a = document.createElement('a'); _a.href=waUrl; _a.target='_blank'; _a.rel='noopener';
      document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
    }
    closeModal('modal-sp-reject');
    var card = document.getElementById('spr-'+reportId);
    if (card) { card.style.opacity='0'; card.style.transition='opacity 0.3s'; }
    setTimeout(function(){ loadSiteReports(); }, 400);
    showToast('דוח נדחה — WhatsApp נשלח לקבלן', 'success');
  } catch(e) { showToast('שגיאה: '+e.message,'error'); console.error('_spConfirmReject:',e); }
}


function filterNotesByProject(projectId) {
  if (!projectId) {
    renderNotes(allNotes);
  } else {
    const filtered = allNotes.filter(n => n.project_id === projectId);
    renderNotes(filtered);
  }
}



