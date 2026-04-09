// ══════════════════════════════════════════════════════════════════════
// CALL RECORDINGS MODULE — call_recordings.js
// Upload + transcribe + AI analyze phone call recordings
// Attached to journal tab — call_log table
// ══════════════════════════════════════════════════════════════════════

var _crInited = false;

// ── Init ──────────────────────────────────────────────────────────────
function callRecordingsInit() {
  if (_crInited) return;
  _crInited = true;
  var fi = document.getElementById('cr-file-input');
  if (fi) fi.addEventListener('change', function(){ crHandleUpload(this); });
  crPopulateProjects();
  crLoadHistory();
}

function crPopulateProjects() {
  var sel = document.getElementById('cr-project-sel');
  if (!sel || !window.allProjects) return;
  sel.innerHTML = '<option value="">📁 קשר לפרויקט (אופציונלי)</option>' +
    (window.allProjects||[]).map(function(p){
      return '<option value="'+p.id+'">'+p.project_name+'</option>';
    }).join('');
}

// ── Upload + Transcribe ───────────────────────────────────────────────
async function crHandleUpload(input) {
  var files = Array.from(input.files||[]);
  if (!files.length) return;
  input.value = '';

  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('נדרש מפתח Anthropic API', 'error'); return; }

  var status = document.getElementById('cr-upload-status');
  var btn    = document.getElementById('cr-upload-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ מעלה...'; }

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (status) status.textContent = '⏳ ('+(i+1)+'/'+files.length+') מעלה ' + file.name + '...';
    await crProcessFile(file, apiKey, status);
  }

  if (btn) { btn.disabled = false; btn.textContent = '📤 העלה הקלטות'; }
  if (status) status.textContent = '✅ הושלם';
  crLoadHistory();
}

async function crProcessFile(file, apiKey, statusEl) {
  try {
    // Step 1: Upload to Cloudinary
    if (statusEl) statusEl.textContent = '☁️ מעלה ל-Cloudinary...';
    var cloudUrl = await crUploadToCloudinary(file);
    if (!cloudUrl) throw new Error('Cloudinary upload failed');

    // Step 2: Read as base64 for Claude
    if (statusEl) statusEl.textContent = '🧠 שולח ל-Claude לתמלול...';
    var b64 = await crReadBase64(file);
    var mime = file.type || 'audio/mpeg';
    if (!['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/m4a'].includes(mime)) mime = 'audio/mpeg';

    // Step 3: Claude transcribe + analyze
    var result = await crAnalyzeWithClaude(b64, mime, apiKey, statusEl);

    // Step 4: Save to call_log
    if (statusEl) statusEl.textContent = '💾 שומר...';
    var projId = (document.getElementById('cr-project-sel')||{}).value || null;
    var callerName = (document.getElementById('cr-caller-name')||{}).value || 'שיחה מוקלטת';

    await fetch(SB_URL + '/rest/v1/call_log', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        caller_name:           callerName,
        direction:             'incoming',
        recording_url:         cloudUrl,
        transcript:            result.transcript || '',
        ai_summary:            result.summary    || '',
        ai_topics:             result.topics     || [],
        ai_action_items:       result.actions    || [],
        ai_decisions:          result.decisions  || [],
        project_id:            projId || null,
        processed_at:          new Date().toISOString(),
        created_at:            new Date().toISOString()
      })
    });

    showToast('✅ ' + file.name + ' — תומלל ונשמר');

  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
    console.error('crProcessFile:', e);
  }
}

// ── Cloudinary Upload ─────────────────────────────────────────────────
async function crUploadToCloudinary(file) {
  try {
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', 'beni_field');
    fd.append('resource_type', 'auto');
    var res  = await fetch('https://api.cloudinary.com/v1_1/dqdku88vv/auto/upload', { method:'POST', body:fd });
    var data = await res.json();
    return data.secure_url || null;
  } catch(e) { console.error('Cloudinary:', e); return null; }
}

// ── Read base64 ───────────────────────────────────────────────────────
function crReadBase64(file) {
  return new Promise(function(resolve, reject) {
    var r = new FileReader();
    r.onload  = function(){ resolve(r.result.split(',')[1]); };
    r.onerror = function(){ reject(new Error('קריאת קובץ נכשלה')); };
    r.readAsDataURL(file);
  });
}

// ── Claude Analysis ───────────────────────────────────────────────────
async function crAnalyzeWithClaude(b64, mime, apiKey, statusEl) {
  var prompt = `אתה עוזר מקצועי לניהול פרויקטי בנייה.

תמלל ונתח את השיחה המוקלטת הזו בעברית.

החזר JSON בלבד:
{
  "transcript": "תמליל מלא של השיחה בעברית",
  "summary": "סיכום קצר של השיחה (2-3 משפטים)",
  "topics": ["נושא 1", "נושא 2", "נושא 3"],
  "actions": [
    { "task": "תיאור המשימה", "responsible": "שם האחראי אם מוזכר", "deadline": "תאריך אם מוזכר", "priority": "גבוהה/בינונית/נמוכה" }
  ],
  "decisions": ["החלטה 1", "החלטה 2"],
  "project_hints": ["רמז לפרויקט מהשיחה"],
  "tone": "רשמי/ידידותי/בעייתי/דחוף",
  "follow_up_required": true
}

JSON בלבד. ללא markdown. הכל בעברית.`;

  var res  = await claudeFetch(JSON.stringify({
    _apiKey: apiKey,
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: prompt }
      ]
    }]
  }), null);

  var data = await res.json();
  var raw  = (data.content&&data.content[0]&&data.content[0].text||'').replace(/```json|```/g,'').trim();
  try { return JSON.parse(raw); } catch(e) { return { transcript: raw, summary: 'לא ניתן לנתח', topics:[], actions:[], decisions:[] }; }
}

// ── Load History ──────────────────────────────────────────────────────
async function crLoadHistory() {
  var list = document.getElementById('cr-history-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:13px;">טוען...</div>';

  try {
    var res   = await fetch(SB_URL + '/rest/v1/call_log?recording_url=not.is.null&order=created_at.desc&limit=30',
      { headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    var calls = await res.json() || [];

    if (!calls.length) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:#555;font-size:13px;">אין הקלטות עדיין<br><span style="font-size:11px;">העלה קובץ שמע מהאנדרואיד</span></div>';
      return;
    }

    list.innerHTML = calls.map(function(call) {
      var date    = new Date(call.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      var topics  = Array.isArray(call.ai_topics) ? call.ai_topics : [];
      var actions = Array.isArray(call.ai_action_items) ? call.ai_action_items : [];
      var decs    = Array.isArray(call.ai_decisions) ? call.ai_decisions : [];
      var proj    = call.project_id ? (window.allProjects||[]).find(function(p){ return p.id===call.project_id; }) : null;
      var toneColor = { 'דחוף':'#ef4444', 'בעייתי':'#f59e0b', 'רשמי':'#3b82f6', 'ידידותי':'#22c55e' };
      var tc = toneColor[call.tone] || '#888';

      return '<div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;margin-bottom:12px;">' +

        // Header
        '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
          '<div style="background:#1a3d5c;color:#fff;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:800;">📞</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:14px;font-weight:800;color:#fff;">'+(call.caller_name||'שיחה מוקלטת')+'</div>' +
            '<div style="font-size:11px;color:#666;">📅 '+date+(proj?' · 📁 '+proj.project_name:'')+'</div>' +
          '</div>' +
          (call.tone ? '<span style="font-size:11px;font-weight:700;color:'+tc+';background:'+tc+'22;border-radius:20px;padding:3px 10px;">'+call.tone+'</span>' : '') +
        '</div>' +

        // Summary
        (call.ai_summary ? '<div style="font-size:13px;color:#ccc;margin-bottom:10px;line-height:1.6;background:rgba(0,0,0,0.2);border-radius:8px;padding:10px;">'+call.ai_summary+'</div>' : '') +

        // Topics
        (topics.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">'+
          topics.map(function(t){ return '<span style="background:rgba(59,130,246,0.15);color:#93c5fd;border-radius:20px;padding:3px 10px;font-size:11px;">'+t+'</span>'; }).join('') +
        '</div>' : '') +

        // Actions
        (actions.length ? '<details style="margin-bottom:8px;"><summary style="font-size:11px;font-weight:800;color:#f59e0b;cursor:pointer;">✅ משימות שנוצרו ('+actions.length+')</summary>' +
          '<div style="margin-top:6px;">' +
          actions.map(function(a){
            var task = typeof a === 'string' ? a : (a.task||'');
            var resp = typeof a === 'object' ? (a.responsible||'') : '';
            var dl   = typeof a === 'object' ? (a.deadline||'') : '';
            return '<div style="background:rgba(245,158,11,0.08);border-right:3px solid #f59e0b;border-radius:6px;padding:7px 10px;margin-bottom:4px;font-size:12px;color:#ccc;">'+
              task+(resp?' — <span style="color:#f59e0b;">'+resp+'</span>':'')+(dl?' <span style="color:#888;font-size:10px;">עד '+dl+'</span>':'')+
            '</div>';
          }).join('') +
          '</div></details>' : '') +

        // Decisions
        (decs.length ? '<details style="margin-bottom:8px;"><summary style="font-size:11px;font-weight:800;color:#c4b5fd;cursor:pointer;">📋 החלטות ('+decs.length+')</summary>' +
          '<div style="margin-top:6px;">'+
          decs.map(function(d){ return '<div style="font-size:12px;color:#ccc;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">▸ '+d+'</div>'; }).join('') +
          '</div></details>' : '') +

        // Transcript
        (call.transcript ? '<details style="margin-bottom:10px;"><summary style="font-size:11px;font-weight:800;color:#666;cursor:pointer;">📄 תמליל מלא</summary>' +
          '<div style="font-size:12px;color:#888;line-height:1.8;margin-top:6px;max-height:200px;overflow-y:auto;background:rgba(0,0,0,0.15);border-radius:8px;padding:10px;">'+call.transcript+'</div></details>' : '') +

        // Action bar
        '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">' +
          (call.recording_url ? '<a href="'+call.recording_url+'" target="_blank" style="background:#1a3d5c;color:#fff;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;text-decoration:none;">▶️ האזן</a>' : '') +
          '<button onclick="crCreateTasksFromCall(\''+call.id+'\')" style="background:#7c3aed;border:none;color:#fff;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">➕ צור משימות</button>' +
          '<button onclick="crSendWA(\''+call.id+'\')" style="background:#15803d;border:none;color:#fff;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">💬 שלח סיכום</button>' +
          '<select onchange="crLinkProject(\''+call.id+'\',this.value)" style="background:#242438;border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:7px;padding:5px 8px;font-size:11px;font-family:Heebo,sans-serif;direction:rtl;">' +
            '<option value="">📁 '+(proj?proj.project_name:'קשר לפרויקט')+'</option>' +
            (window.allProjects||[]).map(function(p){ return '<option value="'+p.id+'">'+p.project_name+'</option>'; }).join('') +
          '</select>' +
          '<button onclick="crDeleteCall(\''+call.id+'\')" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:7px;padding:6px 10px;font-size:11px;cursor:pointer;font-family:Heebo,sans-serif;">🗑️</button>' +
        '</div>' +

      '</div>';
    }).join('');

  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:12px;font-size:12px;">שגיאה: '+e.message+'</div>';
  }
}

// ── Actions ───────────────────────────────────────────────────────────
async function crLinkProject(callId, projectId) {
  if (!projectId) return;
  var proj = (window.allProjects||[]).find(function(p){ return p.id===projectId; });
  await fetch(SB_URL + '/rest/v1/call_log?id=eq.'+callId, {
    method:'PATCH',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify({ project_id: projectId })
  });
  showToast('✅ קושר לפרויקט: ' + (proj?proj.project_name:projectId));
  crLoadHistory();
}

async function crDeleteCall(callId) {
  if (!confirm('מחק הקלטה זו?')) return;
  await fetch(SB_URL + '/rest/v1/call_log?id=eq.'+callId, {
    method:'DELETE',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY }
  });
  showToast('🗑️ הקלטה נמחקה');
  crLoadHistory();
}

function crSendWA(callId) {
  // Find record in current rendered list
  var btn = event.target;
  var card = btn.closest('[style*="background:#1e1e35"]');
  if (!card) return;
  var summary = card.querySelector('[style*="background:rgba(0,0,0,0.2)"]');
  var summaryText = summary ? summary.textContent : '';
  var msg = '📞 *סיכום שיחה*\n\n' + summaryText + '\n\nנשלח ממערכת ניהול הבנייה';
  var a = document.createElement('a');
  a.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function crCreateTasksFromCall(callId) {
  var res   = await fetch(SB_URL + '/rest/v1/call_log?id=eq.'+callId+'&select=ai_action_items,project_id',
    { headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
  var rows  = await res.json();
  var call  = rows && rows[0];
  if (!call || !call.ai_action_items || !call.ai_action_items.length) {
    showToast('אין משימות לייצוא', 'error'); return;
  }
  var tasks = call.ai_action_items;
  var created = 0;
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var desc = typeof t === 'string' ? t : (t.task||'');
    if (!desc) continue;
    await fetch(SB_URL + '/rest/v1/beni_tasks', {
      method:'POST',
      headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        task_text:  desc,
        project_id: call.project_id || null,
        status:     'open',
        source:     'call_recording',
        created_at: new Date().toISOString()
      })
    });
    created++;
  }
  showToast('✅ ' + created + ' משימות נוצרו');
}
