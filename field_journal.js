// field_journal.js — יומן שטח — Beni's Daily Field Journal
// 4 phases: בוקר / שטח / כמויות / סוף יום
// Loaded dynamically by index.html via _fetchFieldJournal()

// ── STATE ─────────────────────────────────────────────────────────────
var _fjState = {
  phase:      'morning',   // morning | field | quantities | eod
  projectId:  null,
  projectName:'',
  date:       new Date().toISOString().split('T')[0],
  tasks:      [],          // {id, text, tag, done}
  obs:        [],          // field observations
  takeoffs:   [],          // quantity items
  apiKey:     null,
};

// ── INIT ──────────────────────────────────────────────────────────────
async function fjsInit() {
  var panel = document.getElementById('eod-panel');
  if (!panel) return;

  // Get API key
  try {
    var cfg = await sbQ('app_config', 'select=key,value');
    var rows = cfg.data || [];
    var k = rows.find(function(r){ return r.key === 'openai_key' || r.key === 'anthropic_key'; });
    if (k) _fjState.apiKey = k.value;
  } catch(e){}

  panel.innerHTML = fjsHTML();
  fjsPopulateProjects();
  fjsSetPhase('morning');
  fjsLoadTodayTasks();
}

function fjsHTML() {
  return `<div id="fjs-root" style="min-height:100vh;background:#fdf6e3;font-family:Heebo,sans-serif;direction:rtl;">

  <!-- TOPBAR -->
  <div style="background:#f5e9c4;border-bottom:2px solid #c9a84c;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
    <div>
      <div style="font-size:9px;letter-spacing:3px;color:#9a6f00;font-weight:800;text-transform:uppercase;margin-bottom:3px;">Field Journal</div>
      <div style="font-size:18px;font-weight:900;color:#1a3d5c;">🏗️ יומן שטח — בני פרסקי</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <input type="date" id="fjs-date" value="${_fjState.date}"
        onchange="_fjState.date=this.value;fjsLoadTodayTasks();"
        style="background:#fff;border:1px solid rgba(180,140,60,0.4);color:#1a3d5c;border-radius:8px;padding:6px 10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">
      <select id="fjs-proj-sel" onchange="fjsSetProject(this.value,this.options[this.selectedIndex].text)"
        style="background:#fff;border:1px solid rgba(180,140,60,0.4);color:#1a3d5c;border-radius:8px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;direction:rtl;min-width:160px;">
        <option value="">— בחר פרויקט —</option>
      </select>
    </div>
  </div>

  <!-- PHASE TABS -->
  <div style="display:flex;gap:0;background:#f5e9c4;border-bottom:2px solid #c9a84c;">
    ${['morning','field','quantities','eod'].map(function(p,i){
      var labels = ['🌅 בוקר','🏗️ שטח','📐 כמויות','🌙 סוף יום'];
      var colors = ['#1b5e20','#1a3d5c','#7b4f00','#4a0d6e'];
      return '<button id="fjs-tab-'+p+'" onclick="fjsSetPhase(\''+p+'\')" style="flex:1;padding:12px 8px;border:none;border-bottom:3px solid transparent;background:transparent;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:#9a6f00;cursor:pointer;transition:all .15s;">'+labels[i]+'</button>';
    }).join('')}
  </div>

  <!-- PROJECT HERO -->
  <div id="fjs-hero" style="display:none;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);padding:12px 20px;direction:rtl;">
    <div id="fjs-hero-name" style="font-size:15px;font-weight:900;color:#fff;"></div>
    <div id="fjs-hero-date" style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;"></div>
  </div>

  <!-- PHASE CONTENT -->
  <div id="fjs-content" style="padding:20px;max-width:900px;margin:0 auto;">
    <div style="text-align:center;padding:40px;color:#9a6f00;font-size:13px;font-weight:700;">בחר פרויקט ושלב כדי להתחיל</div>
  </div>
</div>`;
}

// ── PROJECT ───────────────────────────────────────────────────────────
function fjsPopulateProjects() {
  var sel = document.getElementById('fjs-proj-sel');
  if (!sel) return;
  (window.allProjects||[]).forEach(function(p){
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.project_name;
    sel.appendChild(o);
  });
}

function fjsSetProject(id, name) {
  _fjState.projectId = id || null;
  _fjState.projectName = name || '';
  var hero = document.getElementById('fjs-hero');
  var heroName = document.getElementById('fjs-hero-name');
  var heroDate = document.getElementById('fjs-hero-date');
  if (hero) hero.style.display = id ? 'block' : 'none';
  if (heroName) heroName.textContent = '🏗️ ' + name;
  if (heroDate) heroDate.textContent = new Date(_fjState.date + 'T12:00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  fjsSetPhase(_fjState.phase);
  fjsLoadTodayTasks();
}

// ── PHASES ────────────────────────────────────────────────────────────
function fjsSetPhase(phase) {
  _fjState.phase = phase;
  var phases = ['morning','field','quantities','eod'];
  var activeColors = {morning:'#1b5e20', field:'#1a3d5c', quantities:'#7b4f00', eod:'#4a0d6e'};
  phases.forEach(function(p){
    var btn = document.getElementById('fjs-tab-'+p);
    if (!btn) return;
    if (p === phase) {
      btn.style.color = activeColors[p];
      btn.style.borderBottom = '3px solid ' + activeColors[p];
      btn.style.background = 'rgba(255,255,255,0.5)';
    } else {
      btn.style.color = '#9a6f00';
      btn.style.borderBottom = '3px solid transparent';
      btn.style.background = 'transparent';
    }
  });
  var content = document.getElementById('fjs-content');
  if (!content) return;
  if (phase === 'morning')    fjsRenderMorning(content);
  if (phase === 'field')      fjsRenderField(content);
  if (phase === 'quantities') fjsRenderQuantities(content);
  if (phase === 'eod')        fjsRenderEOD(content);
}

// ── MORNING PHASE ─────────────────────────────────────────────────────
function fjsRenderMorning(container) {
  container.innerHTML = '';

  // Briefing banner
  var banner = document.createElement('div');
  banner.id = 'fjs-briefing-banner';
  banner.style.cssText = 'display:none;background:linear-gradient(135deg,#1b5e20,#43a047);border-radius:12px;padding:14px 16px;margin-bottom:16px;';
  banner.innerHTML = '<div style="font-size:12px;font-weight:900;color:#fff;margin-bottom:5px;">📨 בריפינג מאבשי</div>' +
    '<div id="fjs-briefing-text" style="font-size:12px;color:rgba(255,255,255,0.9);line-height:1.8;white-space:pre-wrap;"></div>';
  container.appendChild(banner);
  fjsLoadBriefing();

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;';

  // LEFT: OCR + manual tasks
  var left = document.createElement('div');
  left.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  left.innerHTML =
    // OCR card
    '<div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:16px;">' +
      '<div style="font-size:12px;font-weight:900;color:#1b5e20;margin-bottom:10px;">📝 דף בוקר — כתב יד</div>' +
      '<div onclick="document.getElementById(\'fjs-ocr-input\').click()" style="border:2px dashed #a5d6a7;border-radius:10px;padding:20px;text-align:center;cursor:pointer;background:#f1f8e9;">' +
        '<div style="font-size:28px;margin-bottom:6px;">📷</div>' +
        '<div style="font-size:12px;color:#2e7d32;font-weight:800;">צלם דף משימות</div>' +
        '<div style="font-size:10px;color:#558b2f;margin-top:3px;">Claude מחלץ משימות אוטומטית</div>' +
      '</div>' +
      '<input type="file" id="fjs-ocr-input" accept="image/*" style="display:none;" onchange="fjsHandleOCR(this)">' +
      '<div id="fjs-ocr-result" style="display:none;margin-top:10px;"></div>' +
    '</div>' +
    // Manual add card
    '<div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:16px;">' +
      '<div style="font-size:12px;font-weight:900;color:#1b5e20;margin-bottom:10px;">➕ הוסף משימה ידנית</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
        '<input id="fjs-task-input" type="text" placeholder="תיאור המשימה..." onkeydown="if(event.key===\'Enter\')fjsAddTask()" ' +
          'style="flex:1;background:#f1f8e9;border:1.5px solid #a5d6a7;color:#1b5e20;padding:8px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">' +
        '<select id="fjs-task-tag" style="background:#f1f8e9;border:1.5px solid #a5d6a7;color:#1b5e20;padding:7px;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;">' +
          '<option value="urgent">🔴 דחוף</option>' +
          '<option value="site" selected>🏗️ שטח</option>' +
          '<option value="schedule">📅 לוח זמנים</option>' +
          '<option value="safety">⚠️ בטיחות</option>' +
          '<option value="other">✅ רגיל</option>' +
        '</select>' +
      '</div>' +
      '<button onclick="fjsAddTask()" style="width:100%;padding:8px;background:linear-gradient(135deg,#388e3c,#66bb6a);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">✅ הוסף משימה</button>' +
    '</div>';

  // RIGHT: Task list
  var right = document.createElement('div');
  right.innerHTML =
    '<div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:16px;height:100%;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<div style="font-size:12px;font-weight:900;color:#1b5e20;">✅ משימות היום</div>' +
        '<div id="fjs-task-stats" style="font-size:10px;color:#558b2f;font-weight:700;"></div>' +
      '</div>' +
      '<div id="fjs-task-list" style="display:flex;flex-direction:column;gap:6px;max-height:350px;overflow-y:auto;"></div>' +
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #c8e6c9;">' +
        '<button onclick="fjsSendBriefing()" style="width:100%;padding:10px;background:linear-gradient(135deg,#1b5e20,#43a047);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">📲 שלח בריפינג לאבשי</button>' +
      '</div>' +
    '</div>';

  grid.appendChild(left);
  grid.appendChild(right);
  container.appendChild(grid);
  fjsRenderTaskList();
}

// ── TASK MANAGEMENT ───────────────────────────────────────────────────
async function fjsLoadTodayTasks() {
  if (!_fjState.projectId) return;
  try {
    var qs = 'task_date=eq.' + _fjState.date + '&project_id=eq.' + _fjState.projectId + '&order=created_at.asc&select=id,task_text,tag,is_done';
    var { data } = await sbQ('daily_tasks', qs);
    _fjState.tasks = (data||[]).map(function(t){ return {id:t.id, text:t.task_text, tag:t.tag, done:t.is_done}; });
    fjsRenderTaskList();
  } catch(e){}
}

async function fjsAddTask() {
  var inp = document.getElementById('fjs-task-input');
  var tag = document.getElementById('fjs-task-tag');
  if (!inp || !inp.value.trim()) return;
  var text = inp.value.trim();
  var tagVal = tag ? tag.value : 'site';

  try {
    var { data, error } = await sb.from('daily_tasks').insert({
      task_text: text,
      tag: tagVal,
      task_date: _fjState.date,
      project_id: _fjState.projectId || null,
      is_done: false,
      created_at: new Date().toISOString()
    }).select().single();
    if (!error && data) {
      _fjState.tasks.push({id: data.id, text: text, tag: tagVal, done: false});
      inp.value = '';
      fjsRenderTaskList();
    }
  } catch(e){ showToast('שגיאה: ' + e.message,'error'); }
}

function fjsRenderTaskList() {
  var listEl = document.getElementById('fjs-task-list');
  var statsEl = document.getElementById('fjs-task-stats');
  if (!listEl) return;

  var done = _fjState.tasks.filter(function(t){ return t.done; }).length;
  if (statsEl) statsEl.textContent = done + '/' + _fjState.tasks.length + ' הושלמו';

  if (_fjState.tasks.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#a5d6a7;font-size:12px;">אין משימות להיום</div>';
    return;
  }

  listEl.innerHTML = '';
  var tagColors = {urgent:'#e53935', site:'#1a3d5c', schedule:'#f57c00', safety:'#d32f2f', other:'#388e3c'};
  var tagLabels = {urgent:'🔴 דחוף', site:'🏗️ שטח', schedule:'📅 לוח', safety:'⚠️ בטיחות', other:'✅ רגיל'};

  _fjState.tasks.forEach(function(t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff;border:1.5px solid ' +
      (t.done ? '#c8e6c9' : '#e2d0a0') + ';border-radius:8px;' + (t.done ? 'opacity:0.6;' : '');
    var chk = document.createElement('div');
    chk.style.cssText = 'width:20px;height:20px;border-radius:5px;border:2px solid ' + (t.done?'#43a047':'#a5d6a7') + ';' +
      'background:' + (t.done?'#43a047':'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0;';
    if (t.done) chk.textContent = '✓';
    chk.onclick = (function(task){ return function(){ fjsToggleTask(task); }; })(t);
    var txt = document.createElement('div');
    txt.style.cssText = 'flex:1;font-size:12px;font-weight:700;color:#1a3d5c;' + (t.done?'text-decoration:line-through;color:#999;':'');
    txt.textContent = t.text;
    var tag = document.createElement('div');
    tag.style.cssText = 'font-size:9px;padding:2px 7px;border-radius:10px;background:#f5f0e8;color:' + (tagColors[t.tag]||'#888') + ';border:1px solid rgba(180,140,60,0.2);flex-shrink:0;font-weight:700;';
    tag.textContent = tagLabels[t.tag] || t.tag;
    var del = document.createElement('button');
    del.textContent = '×';
    del.style.cssText = 'background:none;border:none;color:#ddd;cursor:pointer;font-size:16px;font-weight:700;padding:0 2px;flex-shrink:0;';
    del.onclick = (function(task){ return function(e){ e.stopPropagation(); fjsDeleteTask(task); }; })(t);
    row.appendChild(chk); row.appendChild(txt); row.appendChild(tag); row.appendChild(del);
    listEl.appendChild(row);
  });
}

async function fjsToggleTask(task) {
  task.done = !task.done;
  fjsRenderTaskList();
  try {
    await fetch(SB_URL+'/rest/v1/daily_tasks?id=eq.'+task.id,{
      method:'PATCH',
      headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({is_done:task.done, done_at:task.done?new Date().toISOString():null})
    });
  } catch(e){}
}

async function fjsDeleteTask(task) {
  _fjState.tasks = _fjState.tasks.filter(function(t){ return t.id !== task.id; });
  fjsRenderTaskList();
  try {
    await fetch(SB_URL+'/rest/v1/daily_tasks?id=eq.'+task.id,{
      method:'DELETE', headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}
    });
  } catch(e){}
}

// ── FIELD PHASE ───────────────────────────────────────────────────────
function fjsRenderField(container) {
  container.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
      // Upload card
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;">' +
          '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">📸 תמונות + וידאו</div>' +
          '<label style="display:block;border:2px dashed rgba(180,140,60,0.4);border-radius:10px;padding:20px;text-align:center;cursor:pointer;background:#fffbf0;">' +
            '<div style="font-size:28px;margin-bottom:6px;">📷</div>' +
            '<div style="font-size:12px;color:#9a6f00;font-weight:800;">צלם / העלה תמונה</div>' +
            '<input type="file" accept="image/*,video/*" style="display:none;" onchange="fjsUploadMedia(this,\'photo\')">' +
          '</label>' +
          '<div id="fjs-field-uploads" style="margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;"></div>' +
        '</div>' +
        '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;">' +
          '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">🎙️ מזכר קולי</div>' +
          '<button onclick="fjsStartVoice()" id="fjs-voice-btn" style="width:100%;padding:12px;background:#f5e9c4;border:1.5px solid rgba(180,140,60,0.4);color:#9a6f00;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">🎤 הקלט מזכר</button>' +
          '<div id="fjs-voice-status" style="font-size:11px;color:#9a6f00;margin-top:6px;text-align:center;display:none;"></div>' +
        '</div>' +
      '</div>' +
      // Observations
      '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
          '<div style="font-size:12px;font-weight:900;color:#1a3d5c;">📋 תצפיות שטח</div>' +
          '<button onclick="fjsAnalyzeAll()" style="font-size:10px;padding:4px 10px;background:#f5e9c4;border:1px solid rgba(180,140,60,0.4);color:#9a6f00;border-radius:6px;font-family:Heebo,sans-serif;font-weight:800;cursor:pointer;">🤖 נתח הכל</button>' +
        '</div>' +
        '<div id="fjs-obs-list" style="display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto;">' +
          '<div style="text-align:center;padding:30px;color:#c9a84c;font-size:12px;font-weight:700;">העלה תמונות כדי להתחיל</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  fjsLoadFieldObs();
}

async function fjsLoadFieldObs() {
  if (!_fjState.projectId) return;
  try {
    var qs = 'project_id=eq.' + _fjState.projectId + '&task_date=eq.' + _fjState.date +
      '&note_type=in.(photo,video,audio)&order=created_at.desc&limit=20&select=id,note_text,photo_url,note_type,created_at';
    var { data } = await sbQ('beni_notes', qs);
    _fjState.obs = data || [];
    fjsRenderObs();
  } catch(e){}
}

function fjsRenderObs() {
  var listEl = document.getElementById('fjs-obs-list');
  if (!listEl) return;
  if (_fjState.obs.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#c9a84c;font-size:12px;font-weight:700;">אין תצפיות להיום</div>';
    return;
  }
  listEl.innerHTML = '';
  _fjState.obs.forEach(function(obs) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#fffbf0;border:1px solid rgba(180,140,60,0.25);border-radius:8px;padding:10px;';
    var icon = obs.note_type === 'video' ? '🎥' : obs.note_type === 'audio' ? '🎙️' : '📸';
    var time = new Date(obs.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
    card.innerHTML =
      '<div style="display:flex;gap:8px;align-items:flex-start;">' +
        (obs.photo_url ? '<img src="'+obs.photo_url+'" style="width:50px;height:50px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer;" onclick="window.open(\''+obs.photo_url+'\',\'_blank\')">' : '<div style="font-size:24px;">'+icon+'</div>') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:11px;color:#5a4010;font-weight:700;word-break:break-word;">' + fjsEsc(obs.note_text||'').substring(0,100) + '</div>' +
          '<div style="font-size:10px;color:#9a6f00;margin-top:3px;">' + time + '</div>' +
        '</div>' +
      '</div>';
    listEl.appendChild(card);
  });
}

async function fjsUploadMedia(input, type) {
  var file = input.files[0];
  if (!file) return;
  showToast('⏳ מעלה...','success');
  try {
    var cloudName = 'dqdku88vv';
    var preset = 'beni_field';
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    fd.append('resource_type', file.type.startsWith('video') ? 'video' : 'image');
    var res = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/upload', {method:'POST', body:fd});
    var d = await res.json();
    if (!d.secure_url) throw new Error('Upload failed');

    await sb.from('beni_notes').insert({
      note_text: file.name,
      note_type: type,
      photo_url: d.secure_url,
      project_id: _fjState.projectId || null,
      task_date: _fjState.date,
      created_at: new Date().toISOString()
    });
    showToast('✅ הועלה','success');
    fjsLoadFieldObs();
  } catch(e){ showToast('שגיאה: '+e.message,'error'); }
  input.value = '';
}

// ── QUANTITIES PHASE ──────────────────────────────────────────────────
function fjsRenderQuantities(container) {
  container.innerHTML =
    '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<div style="font-size:14px;font-weight:900;color:#1a3d5c;">📐 כמויות — טייקאוף יומי</div>' +
        '<button onclick="fjsAddTakeoff()" style="background:#1a3d5c;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">➕ הוסף שורה</button>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;" id="fjs-takeoff-table">' +
        '<thead>' +
          '<tr style="background:#f5e9c4;">' +
            '<th style="padding:8px;text-align:right;font-weight:800;color:#5a4010;border-bottom:2px solid rgba(180,140,60,0.3);">תיאור עבודה</th>' +
            '<th style="padding:8px;text-align:right;font-weight:800;color:#5a4010;border-bottom:2px solid rgba(180,140,60,0.3);">יחידה</th>' +
            '<th style="padding:8px;text-align:right;font-weight:800;color:#5a4010;border-bottom:2px solid rgba(180,140,60,0.3);">כמות</th>' +
            '<th style="padding:8px;border-bottom:2px solid rgba(180,140,60,0.3);"></th>' +
          '</tr>' +
        '</thead>' +
        '<tbody id="fjs-takeoff-body"></tbody>' +
      '</table>' +
      '<div id="fjs-takeoff-total" style="margin-top:10px;padding:10px;background:#f5e9c4;border-radius:8px;font-size:13px;font-weight:800;color:#5a4010;"></div>' +
    '</div>' +
    '<button onclick="fjsSaveTakeoff()" style="width:100%;padding:12px;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;">💾 שמור כמויות ושלח ל-CRM</button>';

  fjsLoadTakeoffs();
}

async function fjsLoadTakeoffs() {
  if (!_fjState.projectId) { fjsRenderTakeoffRows(); return; }
  try {
    var qs = 'project_id=eq.' + _fjState.projectId + '&takeoff_date=eq.' + _fjState.date + '&order=created_at.asc&select=id,description,unit,quantity';
    var { data } = await sbQ('daily_takeoffs', qs);
    _fjState.takeoffs = data || [];
    fjsRenderTakeoffRows();
  } catch(e){ fjsRenderTakeoffRows(); }
}

function fjsRenderTakeoffRows() {
  var tbody = document.getElementById('fjs-takeoff-body');
  var total = document.getElementById('fjs-takeoff-total');
  if (!tbody) return;
  tbody.innerHTML = '';
  _fjState.takeoffs.forEach(function(t, i) {
    var tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(180,140,60,0.1)';
    tr.innerHTML =
      '<td style="padding:6px 8px;"><input value="'+fjsEsc(t.description||'')+'" onchange="_fjState.takeoffs['+i+'].description=this.value" style="width:100%;border:1px solid rgba(180,140,60,0.25);border-radius:6px;padding:5px 8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;"></td>' +
      '<td style="padding:6px 8px;"><select onchange="_fjState.takeoffs['+i+'].unit=this.value" style="border:1px solid rgba(180,140,60,0.25);border-radius:6px;padding:5px;font-family:Heebo,sans-serif;font-size:11px;">' +
        ['מ"ר','מ"א','מ"ק','יח\'','טון','שעה'].map(function(u){ return '<option'+(t.unit===u?' selected':'')+'>'+u+'</option>'; }).join('') +
      '</select></td>' +
      '<td style="padding:6px 8px;"><input type="number" value="'+(t.quantity||0)+'" onchange="_fjState.takeoffs['+i+'].quantity=parseFloat(this.value)||0;fjsUpdateTotal()" style="width:80px;border:1px solid rgba(180,140,60,0.25);border-radius:6px;padding:5px 8px;font-family:Heebo,sans-serif;font-size:12px;"></td>' +
      '<td style="padding:6px 8px;"><button onclick="_fjState.takeoffs.splice('+i+',1);fjsRenderTakeoffRows()" style="background:none;border:none;color:#e53935;cursor:pointer;font-size:16px;">×</button></td>';
    tbody.appendChild(tr);
  });
  fjsUpdateTotal();
}

function fjsAddTakeoff() {
  _fjState.takeoffs.push({id:null, description:'', unit:'מ"ר', quantity:0});
  fjsRenderTakeoffRows();
}

function fjsUpdateTotal() {
  var el = document.getElementById('fjs-takeoff-total');
  if (!el) return;
  var total = _fjState.takeoffs.reduce(function(s,t){ return s + (parseFloat(t.quantity)||0); }, 0);
  el.textContent = 'סה"כ שורות: ' + _fjState.takeoffs.length + ' | סה"כ כמות: ' + total.toFixed(2);
}

async function fjsSaveTakeoff() {
  if (!_fjState.projectId) { showToast('בחר פרויקט תחילה','error'); return; }
  var valid = _fjState.takeoffs.filter(function(t){ return t.description.trim(); });
  if (!valid.length) { showToast('הוסף שורות כמות תחילה','error'); return; }
  try {
    // Delete existing for today+project then insert fresh
    await fetch(SB_URL+'/rest/v1/daily_takeoffs?project_id=eq.'+_fjState.projectId+'&takeoff_date=eq.'+_fjState.date,{
      method:'DELETE', headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}
    });
    for (var i=0; i<valid.length; i++) {
      await sb.from('daily_takeoffs').insert({
        project_id: _fjState.projectId,
        takeoff_date: _fjState.date,
        description: valid[i].description,
        unit: valid[i].unit,
        quantity: valid[i].quantity,
        created_at: new Date().toISOString()
      });
    }
    showToast('✅ כמויות נשמרו ל-CRM','success');
  } catch(e){ showToast('שגיאה: '+e.message,'error'); }
}

// ── EOD PHASE ─────────────────────────────────────────────────────────
function fjsRenderEOD(container) {
  container.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
      // Left: summary input
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;">' +
          '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">📷 סיכום בכתב יד</div>' +
          '<div onclick="document.getElementById(\'fjs-eod-ocr\').click()" style="border:2px dashed rgba(180,140,60,0.4);border-radius:10px;padding:20px;text-align:center;cursor:pointer;background:#fffbf0;">' +
            '<div style="font-size:28px;margin-bottom:6px;">📷</div>' +
            '<div style="font-size:12px;color:#9a6f00;font-weight:800;">צלם סיכום יומי</div>' +
            '<div style="font-size:10px;color:#b8860b;margin-top:3px;">Claude מייצר בריפינג לאבשי</div>' +
          '</div>' +
          '<input type="file" id="fjs-eod-ocr" accept="image/*" style="display:none;" onchange="fjsHandleEOD(this)">' +
          '<div id="fjs-eod-preview" style="display:none;margin-top:10px;"></div>' +
        '</div>' +
        '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;">' +
          '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:8px;">📝 הערות לאבשי</div>' +
          '<textarea id="fjs-eod-notes" placeholder="הוסף הערות, תוכנית למחר, בעיות..." rows="4" style="width:100%;background:#fffbf0;border:1.5px solid rgba(180,140,60,0.3);color:#1a3d5c;padding:10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;direction:rtl;resize:vertical;box-sizing:border-box;"></textarea>' +
        '</div>' +
      '</div>' +
      // Right: briefing preview + send
      '<div style="background:#fff;border:1.5px solid rgba(180,140,60,0.3);border-radius:14px;padding:16px;">' +
        '<div style="font-size:12px;font-weight:900;color:#1a3d5c;margin-bottom:10px;">📋 בריפינג למחר — תצוגה מקדימה</div>' +
        '<div id="fjs-briefing-preview" style="background:#fffbf0;border-radius:8px;padding:12px;min-height:200px;font-size:12px;color:#5a4010;font-weight:600;line-height:1.8;white-space:pre-wrap;direction:rtl;margin-bottom:12px;">לחץ "צור בריפינג" כדי לראות תצוגה מקדימה</div>' +
        '<button onclick="fjsGenerateBriefing()" style="width:100%;padding:10px;background:#f5e9c4;border:1.5px solid rgba(180,140,60,0.4);color:#9a6f00;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:8px;">🤖 צור בריפינג AI</button>' +
        '<button onclick="fjsSendBriefing()" style="width:100%;padding:12px;background:linear-gradient(135deg,#25d366,#1da851);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📲 שלח לאבשי</button>' +
      '</div>' +
    '</div>';
}

async function fjsHandleOCR(input) {
  var file = input.files[0];
  if (!file) return;
  var apiKey = _fjState.apiKey;
  if (!apiKey) { showToast('אין מפתח API','error'); return; }
  var result = document.getElementById('fjs-ocr-result');
  if (result) { result.style.display='block'; result.innerHTML='<div style="color:#9a6f00;font-size:12px;font-weight:700;">⏳ Claude קורא את הדף...</div>'; }
  try {
    var reader = new FileReader();
    reader.onload = async function(e) {
      var b64 = e.target.result.split(',')[1];
      var resp = await claudeFetch({
        _apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{role:'user', content:[
          {type:'image', source:{type:'base64', media_type:file.type, data:b64}},
          {type:'text', text:'חלץ את כל המשימות מהדף הזה. החזר JSON בלבד: {"tasks":[{"text":"...","tag":"urgent|site|schedule|safety|other"}]}'}
        ]}]
      }, null);
      try {
        var text = resp.content[0].text;
        var clean = text.replace(/```json|```/g,'').trim();
        var parsed = JSON.parse(clean);
        for (var i=0; i<parsed.tasks.length; i++) {
          var t = parsed.tasks[i];
          var inp = {value: t.text, trim:function(){return this.value;}};
          var tag = {value: t.tag||'site'};
          // Insert directly
          var { data } = await sb.from('daily_tasks').insert({
            task_text: t.text, tag: t.tag||'site',
            task_date: _fjState.date, project_id: _fjState.projectId||null,
            is_done: false, created_at: new Date().toISOString()
          }).select().single();
          if (data) _fjState.tasks.push({id:data.id, text:t.text, tag:t.tag||'site', done:false});
        }
        fjsRenderTaskList();
        if (result) result.innerHTML = '<div style="color:#1b7a4a;font-size:12px;font-weight:800;">✅ חולצו ' + parsed.tasks.length + ' משימות</div>';
      } catch(e2) {
        if (result) result.innerHTML = '<div style="color:#c62828;font-size:11px;">שגיאת פענוח — נסה שוב</div>';
      }
    };
    reader.readAsDataURL(file);
  } catch(e){ if(result) result.innerHTML='<div style="color:#c62828;font-size:11px;">שגיאה: '+e.message+'</div>'; }
  input.value='';
}

async function fjsHandleEOD(input) {
  var file = input.files[0];
  if (!file) return;
  var prev = document.getElementById('fjs-eod-preview');
  if (prev) { prev.style.display='block'; prev.innerHTML='<img src="'+URL.createObjectURL(file)+'" style="width:100%;border-radius:8px;margin-bottom:8px;">'; }
  input.value='';
}

async function fjsGenerateBriefing() {
  var apiKey = _fjState.apiKey;
  if (!apiKey) { showToast('אין מפתח API','error'); return; }
  var prev = document.getElementById('fjs-briefing-preview');
  if (prev) prev.textContent = '⏳ מייצר בריפינג...';

  var doneTasks = _fjState.tasks.filter(function(t){ return t.done; }).map(function(t){ return '✅ '+t.text; }).join('\n');
  var pendingTasks = _fjState.tasks.filter(function(t){ return !t.done; }).map(function(t){ return '⏳ '+t.text; }).join('\n');
  var notes = document.getElementById('fjs-eod-notes') ? document.getElementById('fjs-eod-notes').value : '';
  var context = 'פרויקט: ' + _fjState.projectName + '\nתאריך: ' + _fjState.date +
    '\n\nמשימות שהושלמו:\n' + (doneTasks||'אין') +
    '\n\nממתין לביצוע:\n' + (pendingTasks||'אין') +
    '\n\nהערות:\n' + (notes||'אין');

  try {
    var resp = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: 'אתה עוזר אישי של מהנדס שטח. כתוב בריפינג בוקר קצר וממוקד לאבשי לגבי מה שבני עשה היום ומה מתוכנן למחר. קצר, ממוקד, עברית.',
      messages: [{role:'user', content: context}]
    }, null);
    var text = resp && resp.content && resp.content[0] ? resp.content[0].text : '';
    if (prev) prev.textContent = text;
  } catch(e){ if(prev) prev.textContent = 'שגיאה: '+e.message; }
}

async function fjsSendBriefing() {
  var doneTasks = _fjState.tasks.filter(function(t){ return t.done; });
  var pending = _fjState.tasks.filter(function(t){ return !t.done; });
  var briefText = '📋 בריפינג מבני — ' + new Date().toLocaleDateString('he-IL') + '\n\n';
  briefText += 'פרויקט: ' + (_fjState.projectName||'לא נבחר') + '\n\n';
  if (doneTasks.length) briefText += '✅ הושלם:\n' + doneTasks.map(function(t){ return '• '+t.text; }).join('\n') + '\n\n';
  if (pending.length)   briefText += '⏳ ממתין:\n' + pending.map(function(t){ return '• '+t.text; }).join('\n');
  var notes = document.getElementById('fjs-eod-notes');
  if (notes && notes.value) briefText += '\n\n📝 הערות: ' + notes.value;
  var preview = document.getElementById('fjs-briefing-preview');
  if (preview && preview.textContent && preview.textContent !== 'לחץ "צור בריפינג" כדי לראות תצוגה מקדימה') {
    briefText = preview.textContent;
  }
  try {
    await sb.from('daily_briefings').insert({
      project_id: _fjState.projectId||null,
      briefing_date: _fjState.date,
      briefing_text: briefText,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    showToast('📲 בריפינג נשלח לאבשי!','success');
  } catch(e){ showToast('שגיאה: '+e.message,'error'); }
}

async function fjsLoadBriefing() {
  try {
    var { data } = await sbQ('daily_briefings','briefing_date=eq.'+_fjState.date+'&order=created_at.desc&limit=1&select=briefing_text,created_at');
    var banner = document.getElementById('fjs-briefing-banner');
    var textEl = document.getElementById('fjs-briefing-text');
    if (data && data.length && banner && textEl) {
      textEl.textContent = data[0].briefing_text;
      banner.style.display = 'block';
    }
  } catch(e){}
}

function fjsStartVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('הדפדפן לא תומך בהקלטה קולית','error'); return;
  }
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = new SpeechRecognition();
  rec.lang = 'he-IL'; rec.continuous = false; rec.interimResults = false;
  var btn = document.getElementById('fjs-voice-btn');
  var status = document.getElementById('fjs-voice-status');
  if (btn) btn.textContent = '🔴 מקליט... לחץ לעצור';
  if (status) { status.style.display='block'; status.textContent='מקליט...'; }
  rec.onresult = function(e) {
    var text = e.results[0][0].transcript;
    if (status) status.textContent = 'נשמר: ' + text;
    sb.from('beni_notes').insert({
      note_text: text, note_type: 'audio',
      project_id: _fjState.projectId||null,
      task_date: _fjState.date,
      created_at: new Date().toISOString()
    }).then(function(){ showToast('✅ מזכר נשמר','success'); fjsLoadFieldObs(); });
  };
  rec.onerror = function(){ if(btn) btn.textContent='🎤 הקלט מזכר'; };
  rec.onend = function(){ if(btn) btn.textContent='🎤 הקלט מזכר'; };
  rec.start();
}

async function fjsAnalyzeAll() {
  showToast('ניתוח כל התצפיות — בקרוב','success');
}

// ── UTILS ─────────────────────────────────────────────────────────────
function fjsEsc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Override loadEODReport to use new module ──────────────────────────
function loadEODReport() {
  fjsInit();
}
