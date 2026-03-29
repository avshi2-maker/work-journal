// Global State — use var so they're globally accessible when injected
var supabaseClient = window.sb || null;
// Refresh supabaseClient in case window.sb was set after this module loaded
function _ensureSbClient() { if (!supabaseClient && window.sb) supabaseClient = window.sb; }
// ══ JOURNAL WIZARD NAVIGATION ════════════════════════════════════════
var jwCurrentStep = 1;
var jwTotalSteps  = 8;
var jwStepLabels  = ['','בוקר טוב','שעות + קבלנים','כוח אדם','פעילויות','חומרים וציוד','בטיחות','ביקורות ועיכובים','סיכום וחתימות'];

function jwGoto(step) {
  if (step < 1 || step > jwTotalSteps) return;
  // Hide current, show new
  var cur = document.getElementById('jw-panel-' + jwCurrentStep);
  if (cur) cur.classList.remove('active');
  var nxt = document.getElementById('jw-panel-' + step);
  if (nxt) nxt.classList.add('active');

  // Update sidebar
  for (var i = 1; i <= jwTotalSteps; i++) {
    var s = document.getElementById('jw-sideitem-' + i);
    if (!s) continue;
    s.classList.remove('active', 'done');
    if (i < step) s.classList.add('done');
    else if (i === step) s.classList.add('active');
    // Update checkmark for done steps
    var num = s.querySelector('.jw-step-num');
    if (num) num.textContent = i < step ? '✓' : i;
  }

  jwCurrentStep = step;

  // Footer
  var backBtn = document.getElementById('jw-btn-back');
  var nextBtn = document.getElementById('jw-btn-next');
  if (backBtn) backBtn.style.display = step > 1 ? 'block' : 'none';
  if (nextBtn) nextBtn.textContent = step === jwTotalSteps ? '📤 שלח דוח' : 'הבא ←';

  // Progress
  var pct = Math.round(((step - 1) / (jwTotalSteps - 1)) * 100);
  var fill = document.getElementById('jw-progress-fill');
  if (fill) fill.style.width = pct + '%';
  var lbl = document.getElementById('jw-progress-lbl');
  if (lbl) lbl.textContent = 'שלב ' + step + ' מתוך ' + jwTotalSteps + ' — ' + (jwStepLabels[step] || '');

  // Step indicator in topbar
  var ind = document.getElementById('jw-step-indicator');
  if (ind) ind.textContent = step;

  // Scroll to top of main area
  var main = document.getElementById('jw-main');
  if (main) main.scrollTop = 0;

  // Step 1: show CTA if project selected
  if (step === 1) jwUpdateCTA();
  // Step 3: add initial row if empty
  if (step === 3) { var wc = document.getElementById('workersContainer'); if (wc && !wc.children.length) addWorkerRow(); }
  // Step 4: add initial row if empty
  if (step === 4) { var ac = document.getElementById('activitiesContainer'); if (ac && !ac.children.length) addActivityRow(); }
}

function jwNext() {
  if (jwCurrentStep === jwTotalSteps) {
    // Last step — trigger send
    if (typeof sendReport === 'function') sendReport();
  } else {
    jwGoto(jwCurrentStep + 1);
  }
}

function jwBack() {
  jwGoto(jwCurrentStep - 1);
}

function jwUpdateCTA() {
  var cta = document.getElementById('jw-cta');
  var hero = document.getElementById('mb-hero');
  var sel  = document.getElementById('projectName');
  var hasProj = sel && sel.value && sel.value !== '';
  if (cta)  cta.style.display  = hasProj ? 'flex' : 'none';
  if (hero) hero.style.display = hasProj ? 'block' : 'none';
  var ts = document.getElementById('mb-tasks-section');
  var ds = document.getElementById('mb-drawings-section');
  var cs = document.getElementById('mb-contractors-section');
  if (ts) ts.style.display = hasProj ? 'block' : 'none';
  if (ds) ds.style.display = hasProj ? 'block' : 'none';
  if (cs) cs.style.display = hasProj ? 'block' : 'none';
}


var currentReport = null;
var signaturePad = null;
var ownerSignaturePad = null;
var selectedPhotos = [];
var selectedOwnerPhotos = [];
var voiceRecognition = null;
var currentVoiceTarget = null;
var currentReportNumber = null;

// ============================================
// REPORT NUMBER GENERATION
// ============================================

function generateReportNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Format: STH-YYYYMMDD-HHMMSS
    const reportNum = `STH-${year}${month}${day}-${hours}${minutes}${seconds}`;
    const timestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    
    return { reportNum, timestamp };
}

function displayReportNumber() {
    const { reportNum, timestamp } = generateReportNumber();
    currentReportNumber = reportNum;
    
    const reportNumberDiv = document.querySelector('.report-number');
    if (reportNumberDiv) {
        reportNumberDiv.querySelector('.report-id').textContent = reportNum;
        reportNumberDiv.querySelector('.report-timestamp').textContent = timestamp;
    }
}

// ============================================
// CLEAR DATA & START NEW REPORT
// ============================================

function clearAllData() {
    if (!confirm('⚠️ האם אתה בטוח שברצונך למחוק את כל הנתונים?\n\nפעולה זו אינה ניתנת לביטול!')) {
        return;
    }
    
    // Clear all form fields
    document.getElementById('projectName').value = '';
    document.getElementById('weather').value = '';
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('breakHours').value = '0';
    document.getElementById('generalNotes').value = '';
    document.getElementById('tomorrowPlan').value = '';
    
    // Clear containers
    document.getElementById('workersContainer').innerHTML = '';
    document.getElementById('activitiesContainer').innerHTML = '';
    document.getElementById('materialsContainer').innerHTML = '';
    document.getElementById('equipmentContainer').innerHTML = '';
    document.getElementById('safetyContainer').innerHTML = '';
    document.getElementById('inspectionsContainer').innerHTML = '';
    document.getElementById('delaysContainer').innerHTML = '';
    
    // Clear photos
    selectedPhotos = [];
    document.getElementById('photoPreview').innerHTML = '';
    
    // Clear signature
    if (signaturePad) {
        const ctx = signaturePad.getContext('2d');
        ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    }
    
    // Reset totals
    document.getElementById('totalWorkHours').textContent = '0';
    document.getElementById('totalWorkerHours').textContent = '0';
    
    showToast('✅ כל הנתונים נמחקו!');
}

function startNewReport() {
    clearAllData();
    
    // Set dates to today/tomorrow
    const today = new Date();
    document.getElementById('reportDate').valueAsDate = today;
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tomorrowDate').valueAsDate = tomorrow;
    
    // Generate new report number
    displayReportNumber();
    
    // Add initial rows
    addWorkerRow();
    addActivityRow();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showToast('✅ דוח חדש התחיל!\n\nמספר דוח: ' + currentReportNumber, 'error');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        loadReportForOwner(token);
    } else {
        initializeManagerView();
    }
    
    initializeVoiceRecognition();
});

// ============================================
// MANAGER VIEW
// ============================================


// ══ MORNING BRIEFING ══════════════════════════════════════════════════
var _mbProjectId   = null;
var _mbProjectName = '';
var _mbAllFiles    = [];
var _mbAllTasks    = [];

async function mbInit() {
  // Populate project selector and load briefing data
  var sel = document.getElementById('projectName');
  if (!sel) return;
  // Get selected project
  _mbProjectId   = sel.options[sel.selectedIndex]?.dataset?.id || null;
  _mbProjectName = sel.value !== '__custom__' ? sel.value : (document.getElementById('projectNameCustom')?.value || '');
  if (!_mbProjectId && window.allProjects && window.allProjects.length) {
    // Auto-select first active project
    var first = (window.allProjects||[]).find(function(p){ return p.status === 'active'; }) || window.allProjects[0];
    if (first) { _mbProjectId = first.id; _mbProjectName = first.project_name; }
  }
  if (!_mbProjectId) {
    document.getElementById('mb-proj-name').textContent = 'בחר פרויקט למטה';
    return;
  }
  document.getElementById('mb-proj-name').textContent = '🏗️ ' + _mbProjectName;
  await Promise.all([ mbLoadTasks(), mbLoadFiles(), mbLoadContractors(), mbLoadProjMeta() ]);
}

async function mbLoadProjMeta() {
  if (!_ensureSbClient || !supabaseClient) return;
  _ensureSbClient();
  try {
    var res = await supabaseClient.from('projects').select('*').eq('id', _mbProjectId).single();
    var p = res.data;
    if (!p) return;
    var tags = '';
    if (p.address||p.city)  tags += '<span style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:3px 10px;font-size:11px;color:rgba(255,255,255,0.85);">📍 ' + (p.address||p.city||'') + '</span>';
    if (p.status)            tags += '<span style="background:rgba(201,168,76,0.25);border:1px solid rgba(201,168,76,0.5);border-radius:20px;padding:3px 10px;font-size:11px;color:#fde68a;">📊 ' + (p.status==='active'?'פעיל':p.status) + '</span>';
    if (p.planned_end_date)  tags += '<span style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:3px 10px;font-size:11px;color:rgba(255,255,255,0.85);">🗓️ יעד: ' + p.planned_end_date + '</span>';
    document.getElementById('mb-proj-tags').innerHTML = tags;
  } catch(e) {}
}

async function mbLoadTasks() {
  _ensureSbClient();
  var today = new Date().toISOString().split('T')[0];
  try {
    var { data } = await supabaseClient.from('gantt_tasks')
      .select('task_name,start_date,end_date,status,progress,contractors_master(company_name)')
      .eq('project_id', _mbProjectId)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date');
    // Fallback: tasks starting today or this week
    if (!data || !data.length) {
      var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
      var r = await supabaseClient.from('gantt_tasks')
        .select('task_name,start_date,end_date,status,progress,contractors_master(company_name)')
        .eq('project_id', _mbProjectId)
        .gte('end_date', today)
        .order('start_date').limit(5);
      data = r.data;
    }
    _mbAllTasks = data || [];
    var list = document.getElementById('mb-tasks-list');
    var count = document.getElementById('mb-tasks-count');
    count.textContent = (_mbAllTasks.length || 0) + ' פעילויות';
    if (!_mbAllTasks.length) {
      list.innerHTML = '<div style="padding:14px;text-align:center;color:#aaa;font-size:12px;border:1px dashed #ddd;border-radius:9px;">אין משימות מתוכננות להיום</div>';
      return;
    }
    var sColors = { done:'#888', 'in-progress':'#f59e0b', planned:'#3b82f6', delayed:'#ef4444' };
    var sHe    = { done:'הושלם', 'in-progress':'בביצוע', planned:'מתוכנן', delayed:'עיכוב' };
    list.innerHTML = _mbAllTasks.map(function(t) {
      var col = sColors[t.status] || '#3b82f6';
      var sHe_txt = sHe[t.status] || t.status || '';
      var contr = (t.contractors_master && t.contractors_master.company_name) ? t.contractors_master.company_name : '';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;border:0.5px solid #e8e0cc;background:#fff;margin-bottom:6px;">'
        + '<div style="width:10px;height:10px;border-radius:50%;background:'+col+';flex-shrink:0;"></div>'
        + '<div style="flex:1;">'
          + '<div style="font-size:13px;font-weight:700;color:#1a3d5c;">' + (t.task_name||'') + '</div>'
          + '<div style="font-size:10px;color:#888;margin-top:2px;">'
            + (contr ? '👷 '+contr+' · ' : '')
            + (t.start_date||'') + ' → ' + (t.end_date||'')
            + (t.progress ? ' · ' + t.progress + '% הושלם' : '')
          + '</div>'
        + '</div>'
        + '<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;background:'+col+'22;color:'+col+';">' + sHe_txt + '</span>'
        + '</div>';
    }).join('');
  } catch(e) { document.getElementById('mb-tasks-list').innerHTML = '<div style="color:#c00;font-size:12px;">שגיאה בטעינת משימות</div>'; }
}

var _mbDrawFilter = 'all';
var SB_URL_MB = 'https://vmcipofovheztbjmhwsl.supabase.co';
var SB_KEY_MB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE2MTcsImV4cCI6MjA4NzAzNzYxN30.LPq5N2Xo8iEqjgz2UhmdzUdh5tpGT3EYzSxJcYBEJ1w';

async function mbLoadFiles() {
  var grid = document.getElementById('mb-drawings-grid');
  try {
    var folder = 'drawings/' + (_mbProjectName||'general').replace(/[^a-zA-Z0-9֐-׿]/g,'_') + '/';
    var res = await fetch(SB_URL_MB + '/storage/v1/object/list/app-assets/' + encodeURIComponent(folder),
      { headers: { apikey: SB_KEY_MB, Authorization: 'Bearer ' + SB_KEY_MB } });
    var files = res.ok ? await res.json() : [];
    _mbAllFiles = (files||[]).filter(function(f){ return f.name && !f.name.startsWith('.'); });
    mbRenderFiles();
  } catch(e) {
    grid.innerHTML = '<div style="text-align:center;padding:16px;color:#aaa;font-size:12px;grid-column:1/-1;">העלה תוכניות לפרויקט זה</div>';
  }
}

function mbFilterDrawings(type) {
  _mbDrawFilter = type;
  document.querySelectorAll('.mb-dflt').forEach(function(b){
    var isActive = b.textContent.trim().includes(type==='all'?'הכל':type==='pdf'?'PDF':'תמונות');
    b.style.background = isActive ? '#1a3d5c' : 'none';
    b.style.color = isActive ? '#fff' : '#888';
    b.style.borderColor = isActive ? '#1a3d5c' : '#ddd';
  });
  mbRenderFiles();
}

function mbRenderFiles() {
  var grid = document.getElementById('mb-drawings-grid');
  var files = _mbAllFiles.filter(function(f) {
    if (_mbDrawFilter === 'all') return true;
    var ext = (f.name||'').split('.').pop().toLowerCase();
    if (_mbDrawFilter === 'pdf') return ext === 'pdf' || ext === 'dwg';
    if (_mbDrawFilter === 'img') return ['jpg','jpeg','png','gif','webp'].includes(ext);
    return true;
  });
  var folder = 'drawings/' + (_mbProjectName||'general').replace(/[^a-zA-Z0-9֐-׿]/g,'_') + '/';
  var html = files.map(function(f) {
    var ext  = (f.name||'').split('.').pop().toLowerCase();
    var icon = ext==='pdf'?'📄':ext==='dwg'?'📐':['jpg','jpeg','png','gif','webp'].includes(ext)?'🖼️':'📎';
    var bg   = ext==='pdf'?'#fff1f2':ext==='dwg'?'#eff6ff':'#f0fdf4';
    var url  = SB_URL_MB + '/storage/v1/object/public/app-assets/' + folder + encodeURIComponent(f.name);
    var date = f.updated_at ? new Date(f.updated_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}) : '';
    return '<a href="'+url+'" target="_blank" rel="noopener" style="text-decoration:none;">'
      + '<div style="border:0.5px solid #e2d0a0;border-radius:9px;overflow:hidden;cursor:pointer;">'
      + '<div style="height:58px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:24px;">'+icon+'</div>'
      + '<div style="padding:6px 8px;">'
        + '<div style="font-size:10px;font-weight:700;color:#1a3d5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+f.name+'</div>'
        + '<div style="font-size:9px;color:#aaa;">'+date+'</div>'
      + '</div></div></a>';
  }).join('');
  html += '<label style="border:1.5px dashed #c9a84c;border-radius:9px;height:88px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;color:#9a6f00;font-size:10px;font-weight:700;">'
    + '<span style="font-size:20px;">＋</span><span>העלה</span>'
    + '<input type="file" multiple accept=".pdf,.dwg,.jpg,.jpeg,.png" style="display:none;" onchange="mbUploadFiles(this)"></label>';
  grid.innerHTML = html || '<div style="text-align:center;padding:16px;color:#aaa;font-size:12px;grid-column:1/-1;">אין קבצים עדיין — העלה תוכניות</div>' + html.slice(-300);
}

async function mbUploadFiles(input) {
  var files = Array.from(input.files); if (!files.length) return;
  var folder = 'drawings/' + (_mbProjectName||'general').replace(/[^a-zA-Z0-9֐-׿]/g,'_') + '/';
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    try {
      await fetch(SB_URL_MB + '/storage/v1/object/app-assets/' + folder + encodeURIComponent(f.name), {
        method: 'POST',
        headers: { apikey: SB_KEY_MB, Authorization: 'Bearer ' + SB_KEY_MB, 'Content-Type': f.type || 'application/octet-stream' },
        body: f
      });
    } catch(e) {}
  }
  input.value = '';
  await mbLoadFiles();
  if (typeof showToast === 'function') showToast('✅ ' + files.length + ' קבצים הועלו');
}

async function mbLoadContractors() {
  _ensureSbClient();
  var today = new Date().toISOString().split('T')[0];
  try {
    var { data } = await supabaseClient.from('gantt_tasks')
      .select('contractors_master(id,company_name,contact_name,mobile),task_name')
      .eq('project_id', _mbProjectId)
      .lte('start_date', today).gte('end_date', today).not('contractor_id','is',null);
    var seen = {}; var contractors = [];
    (data||[]).forEach(function(t) {
      var c = t.contractors_master;
      if (c && !seen[c.id]) { seen[c.id] = true; contractors.push({ c: c, task: t.task_name }); }
    });
    var list = document.getElementById('mb-contractors-list');
    if (!contractors.length) { list.innerHTML = '<div style="color:#aaa;font-size:12px;padding:8px;">אין קבלנים משויכים להיום</div>'; return; }
    list.innerHTML = contractors.map(function(item) {
      var c = item.c;
      var initials = (c.company_name||'?').substring(0,2);
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:#f8f4ec;margin-bottom:6px;">'
        + '<div style="width:34px;height:34px;border-radius:50%;background:#1a3d5c;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">'+initials+'</div>'
        + '<div style="flex:1;">'
          + '<div style="font-size:13px;font-weight:700;color:#1a3d5c;">' + (c.company_name||'') + '</div>'
          + '<div style="font-size:10px;color:#888;">' + (item.task||'') + '</div>'
        + '</div>'
        + (c.mobile ? '<a href="tel:'+c.mobile+'" style="font-size:22px;text-decoration:none;">📞</a>' : '')
        + '</div>';
    }).join('');
  } catch(e) {}
}

// "צא לשטח" — generate AI brief and push to project_briefs table
async function mbSendToField() {
  _ensureSbClient();
  var btn = document.querySelector('[onclick="mbSendToField()"]');
  if (btn) { btn.textContent = '🧠 מכין...'; btn.disabled = true; }
  try {
    var ANTHROPIC_KEY = (window.APP && window.APP.config && window.APP.config.anthropic_key) || null;
    var today = new Date().toISOString().split('T')[0];
    var tasksText = _mbAllTasks.map(function(t){
      return '• ' + t.task_name + (t.contractors_master ? ' (' + t.contractors_master.company_name + ')' : '') + ' — ' + (t.status||'');
    }).join('
') || 'אין משימות';

    var briefText = '';
    if (ANTHROPIC_KEY) {
      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:400, messages:[{ role:'user', content:
          'צור ברייפינג יומי קצר בעברית לקבלן בנייה ששוהה באתר. 3-4 משפטים בלבד.

פרויקט: '+_mbProjectName+'
תאריך: '+today+'
משימות היום:
'+tasksText+'

כתוב: מה הדבר הכי חשוב שצריך להתרחש היום, מה לשים לב אליו, ומה בסיכון אם לא מטפלים. ישיר ותכליתי. עברית בלבד.'
        }] })
      });
      var data = await res.json();
      briefText = data.content[0].text;
    } else {
      briefText = 'פרויקט: ' + _mbProjectName + '
תאריך: ' + today + '

משימות היום:
' + tasksText;
    }

    // Push to project_briefs — Beni Pocket reads from this table
    await fetch('https://vmcipofovheztbjmhwsl.supabase.co/rest/v1/project_briefs?project_id=eq.' + _mbProjectId, {
      method: 'DELETE', headers: { apikey: SB_KEY_MB, Authorization: 'Bearer ' + SB_KEY_MB }
    });
    await fetch('https://vmcipofovheztbjmhwsl.supabase.co/rest/v1/project_briefs', {
      method: 'POST',
      headers: { apikey: SB_KEY_MB, Authorization: 'Bearer ' + SB_KEY_MB, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        project_id:   _mbProjectId,
        project_name: _mbProjectName,
        sent_at:      new Date().toISOString(),
        sent_by:      'יומן בוקר',
        data: { brief_text: briefText, tasks: _mbAllTasks, date: today }
      })
    });

    if (typeof showToast === 'function') showToast('✅ בריפינג נשלח לטלפון!', 'success');
    mbSkipToForm(); // proceed to form
  } catch(e) {
    if (typeof showToast === 'function') showToast('שגיאה: ' + e.message, 'error');
  } finally {
    if (btn) { btn.textContent = '🚀 צא לשטח'; btn.disabled = false; }
  }
}

function mbSkipToForm() {
  var brief = document.getElementById('morning-brief-panel');
  if (brief) brief.style.display = 'none';
  var form = document.getElementById('reportForm');
  if (form) form.style.display = 'block';
}


function initializeManagerView() {
    if (window._journalInited) {
        // Already initialized — just show the panel
        var mv = document.getElementById('managerView');
        if (mv) mv.style.display = 'block';
        return;
    }
    window._journalInited = true;
    _ensureSbClient();
    const mv = document.getElementById('managerView');
    // Launch wizard at step 1
    jwGoto(1);
    populateJournalProjectDropdown && populateJournalProjectDropdown();
    displayReportNumber();
    var rd = document.getElementById('reportDate'); if (rd) rd.valueAsDate = new Date();
    var tom = new Date(); tom.setDate(tom.getDate()+1);
    var td = document.getElementById('tomorrowDate'); if (td) td.valueAsDate = tom;
    initSignaturePad('signatureCanvas');
    var sb2 = document.getElementById('saveBtn'); if (sb2) sb2.addEventListener('click', saveDraft);
    var snd = document.getElementById('sendBtn'); if (snd) snd.addEventListener('click', sendReport);
    var vnb = document.getElementById('voiceNotesBtn'); if (vnb) vnb.addEventListener('click', function(){ startVoiceRecording('generalNotes'); });
    var vtb = document.getElementById('voiceTomorrowBtn'); if (vtb) vtb.addEventListener('click', function(){ startVoiceRecording('tomorrowPlan'); });
    var phi = document.getElementById('photoInput'); if (phi) phi.addEventListener('change', handlePhotoSelection);
    var ov = document.getElementById('ownerView');
    if (!mv || !ov) return; // panel not loaded yet
    mv.style.display = 'block';
    ov.style.display = 'none';
    
    // Generate and display report number
    displayReportNumber();
    
    // Set default dates
    const today = new Date();
    document.getElementById('reportDate').valueAsDate = today;
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tomorrowDate').valueAsDate = tomorrow;
    
    initSignaturePad('signatureCanvas');
    
    // Add initial rows
    addWorkerRow();
    addActivityRow();
    
    // Photo handlers
    document.getElementById('photoInput').addEventListener('change', handlePhotoSelection);
    
    // Button handlers
    document.getElementById('saveBtn').addEventListener('click', saveDraft);
    document.getElementById('sendBtn').addEventListener('click', sendReport);
    
    // Voice button handlers
    document.getElementById('voiceNotesBtn').addEventListener('click', () => {
        startVoiceRecording('generalNotes');
    });
    
    document.getElementById('voiceTomorrowBtn').addEventListener('click', () => {
        startVoiceRecording('tomorrowPlan');
    });
    
    // Auto-calculate work hours
    document.getElementById('startTime').addEventListener('change', calculateWorkHours);
    document.getElementById('endTime').addEventListener('change', calculateWorkHours);
    document.getElementById('breakHours').addEventListener('input', calculateWorkHours);
    
}

// ============================================
// AUTO-CALCULATIONS
// ============================================

function calculateWorkHours() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakHours = parseFloat(document.getElementById('breakHours').value) || 0;
    
    if (!startTime || !endTime) {
        document.getElementById('totalWorkHours').textContent = '0';
        return;
    }
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }
    
    const totalHours = (totalMinutes / 60) - breakHours;
    
    document.getElementById('totalWorkHours').textContent = totalHours.toFixed(1);
}

function calculateTotalWorkerHours() {
    let total = 0;
    
    document.querySelectorAll('#workersContainer .form-row').forEach(row => {
        const count = parseInt(row.querySelector('.worker-count').value) || 0;
        const hours = parseFloat(row.querySelector('.worker-hours').value) || 0;
        total += count * hours;
    });
    
    document.getElementById('totalWorkerHours').textContent = total.toFixed(1);
}

// ============================================
// VOICE RECOGNITION
// ============================================

function initializeVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        
        voiceRecognition.lang = 'he-IL';
        voiceRecognition.continuous = true;
        voiceRecognition.interimResults = true;
        voiceRecognition.maxAlternatives = 1;
        
        voiceRecognition.onstart = () => {
        };
        
        voiceRecognition.onresult = (event) => {
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                }
            }
            
            if (currentVoiceTarget && finalTranscript) {
                const textarea = document.getElementById(currentVoiceTarget);
                if (textarea) {
                    textarea.value += finalTranscript;
                }
            }
        };
        
        voiceRecognition.onerror = (event) => {
            console.error('❌ Voice error:', event.error);
            
            if (event.error === 'no-speech') {
                showToast('לא זוהה דיבור. נסה שוב ודבר בבירור.');
            } else if (event.error === 'not-allowed') {
                showToast('נא לאשר גישה למיקרופון בהגדרות הדפדפן.');
            } else if (event.error !== 'aborted') {
                showToast('שגיאה בהקלטה: ' + event.error, 'error');
            }
            
            stopVoiceRecording();
        };
        
        voiceRecognition.onend = () => {
            setTimeout(() => {
                if (document.getElementById('voiceIndicator').style.display === 'flex') {
                    try {
                        voiceRecognition.start();
                    } catch (error) {
                        stopVoiceRecording();
                    }
                }
            }, 100);
        };
        
    } else {
        showToast('הקלטה קולית לא נתמכת בדפדפן זה. השתמש ב-Chrome.');
    }
}

function startVoiceRecording(targetId) {
    if (!voiceRecognition) {
        showToast('הקלטה קולית לא נתמכת בדפדפן זה', 'error'); return;
    }
    
    currentVoiceTarget = targetId;
    
    document.getElementById('voiceIndicator').style.display = 'flex';
    
    try {
        voiceRecognition.start();
    } catch (error) {
        console.error('Start error:', error);
        stopVoiceRecording();
    }
}

function stopVoiceRecording() {
    
    if (voiceRecognition) {
        try {
            voiceRecognition.stop();
        } catch (error) {
            console.error('Stop error:', error);
        }
    }
    
    document.getElementById('voiceIndicator').style.display = 'none';
    
    setTimeout(() => {
        currentVoiceTarget = null;
    }, 1000);
}

// ============================================
// SIGNATURE PAD
// ============================================

function initSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 100;
    
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return {
            x: (touch.clientX - rect.left) * (canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (canvas.height / rect.height)
        };
    }
    
    function startDrawing(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    }
    
    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    }
    
    function stopDrawing() {
        drawing = false;
    }
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    if (canvasId === 'signatureCanvas') {
        signaturePad = canvas;
    } else {
        ownerSignaturePad = canvas;
    }
}

function clearSignature() {
    if (!signaturePad) return;
    const ctx = signaturePad.getContext('2d');
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
}

function clearOwnerSignature() {
    if (!ownerSignaturePad) return;
    const ctx = ownerSignaturePad.getContext('2d');
    ctx.clearRect(0, 0, ownerSignaturePad.width, ownerSignaturePad.height);
}

// ============================================
// DYNAMIC ROWS - BASIC SECTIONS
// ============================================

function addWorkerRow() {
    const container = document.getElementById('workersContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
        <input type="text" placeholder="תפקיד" class="worker-role">
        <input type="number" placeholder="מספר" class="worker-count" value="1">
        <input type="number" placeholder="שעות" step="0.5" class="worker-hours" value="8">
    `;
    container.appendChild(row);
    
    row.querySelector('.worker-count').addEventListener('input', calculateTotalWorkerHours);
    row.querySelector('.worker-hours').addEventListener('input', calculateTotalWorkerHours);
    
    calculateTotalWorkerHours();
}

function addActivityRow() {
    const container = document.getElementById('activitiesContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
        <input type="text" placeholder="תיאור" class="activity-desc">
        <input type="text" placeholder="מיקום" class="activity-location">
        <input type="text" placeholder="כמות" class="activity-quantity">
    `;
    container.appendChild(row);
}

// ============================================
// DYNAMIC ROWS - LEGAL SECTIONS
// ============================================

function addMaterialRow() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row four-col">
            <input type="text" placeholder="סוג חומר" class="material-type" required>
            <input type="text" placeholder="כמות" class="material-quantity" required>
            <input type="text" placeholder="יחידה (ק״ג, מ״ר, יח׳)" class="material-unit">
            <input type="text" placeholder="ספק" class="material-supplier">
        </div>
        <input type="datetime-local" class="material-delivery-time" title="מועד אספקה">
    `;
    container.appendChild(row);
}

function addEquipmentRow() {
    const container = document.getElementById('equipmentContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <input type="text" placeholder="סוג ציוד/מכונה" class="equipment-type" required>
            <input type="number" placeholder="שעות שימוש" step="0.5" class="equipment-hours">
            <select class="equipment-rental">
                <option value="false">בבעלות</option>
                <option value="true">השכרה</option>
            </select>
        </div>
        <textarea placeholder="תקלות/בעיות (אופציונלי)" class="equipment-issues" rows="2"></textarea>
    `;
    container.appendChild(row);
}

function addSafetyRow() {
    const container = document.getElementById('safetyContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row critical-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <select class="safety-type" required>
                <option value="">סוג אירוע</option>
                <option value="near-miss">כמעט תאונה</option>
                <option value="violation">הפרת בטיחות</option>
                <option value="injury">פציעה קלה</option>
                <option value="serious">אירוע חמור</option>
                <option value="safe">אין אירועים - הכל תקין</option>
            </select>
            <select class="safety-severity">
                <option value="low">חומרה נמוכה</option>
                <option value="medium">חומרה בינונית</option>
                <option value="high">חומרה גבוהה</option>
            </select>
        </div>
        <textarea placeholder="תיאור האירוע" class="safety-description" required rows="2"></textarea>
        <textarea placeholder="פעולה מתקנת שבוצעה" class="safety-corrective" rows="2"></textarea>
    `;
    container.appendChild(row);
}

function addInspectionRow() {
    const container = document.getElementById('inspectionsContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row critical-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <input type="text" placeholder="שם המפקח" class="inspector-name" required>
            <select class="inspector-role" required>
                <option value="">תפקיד</option>
                <option value="building">מפקח בניה</option>
                <option value="safety">מפקח בטיחות</option>
                <option value="quality">בקרת איכות</option>
                <option value="client">נציג לקוח</option>
                <option value="engineer">מהנדס</option>
            </select>
            <input type="datetime-local" class="inspection-time" title="מועד ביקורת">
        </div>
        <textarea placeholder="ממצאים" class="inspection-findings" rows="2"></textarea>
        <textarea placeholder="תיקונים נדרשים" class="inspection-corrections" rows="2"></textarea>
    `;
    container.appendChild(row);
}

function addDelayRow() {
    const container = document.getElementById('delaysContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <button type="button" class="remove-row" onclick="this.parentElement.remove()">×</button>
        <div class="form-row three-col">
            <select class="delay-reason" required>
                <option value="">סיבת עיכוב</option>
                <option value="weather">מזג אוויר</option>
                <option value="materials">חוסר חומרים</option>
                <option value="equipment">תקלת ציוד</option>
                <option value="client">לקוח</option>
                <option value="permits">היתרים/אישורים</option>
                <option value="workers">כוח אדם</option>
                <option value="other">אחר</option>
            </select>
            <select class="delay-responsible" required>
                <option value="">גורם אחראי</option>
                <option value="client">לקוח</option>
                <option value="contractor">קבלן</option>
                <option value="supplier">ספק</option>
                <option value="authority">רשות</option>
                <option value="force-majeure">כוח עליון</option>
            </select>
            <input type="number" placeholder="השפעה (שעות)" step="0.5" class="delay-hours">
        </div>
        <textarea placeholder="תיאור מפורט" class="delay-description" required rows="2"></textarea>
    `;
    container.appendChild(row);
}

// ============================================
// PHOTO HANDLING
// ============================================

function handlePhotoSelection(e) {
    const files = Array.from(e.target.files);
    selectedPhotos = [...selectedPhotos, ...files];
    displayPhotoPreview();
}

function displayPhotoPreview() {
    const preview = document.getElementById('photoPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    selectedPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Photo">
                <button class="remove-photo" onclick="removePhoto(${index})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removePhoto(index) {
    selectedPhotos.splice(index, 1);
    displayPhotoPreview();
}

function handleOwnerPhotoSelection(e) {
    const files = Array.from(e.target.files);
    selectedOwnerPhotos = [...selectedOwnerPhotos, ...files];
    displayOwnerPhotoPreview();
}

function displayOwnerPhotoPreview() {
    const preview = document.getElementById('ownerPhotoPreview');
    if (!preview) return;
    
    preview.innerHTML = '';
    
    selectedOwnerPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Owner Photo">
                <button class="remove-photo" onclick="removeOwnerPhoto(${index})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeOwnerPhoto(index) {
    selectedOwnerPhotos.splice(index, 1);
    displayOwnerPhotoPreview();
}

// ============================================
// COLLECT FORM DATA
// ============================================

function collectFormData() {
    // Basic data
    const workers = [];
    document.querySelectorAll('#workersContainer .form-row').forEach(row => {
        const role = row.querySelector('.worker-role').value;
        const count = row.querySelector('.worker-count').value;
        const hours = row.querySelector('.worker-hours').value;
        if (role) {
            workers.push({ 
                role, 
                worker_count: parseInt(count) || 0, 
                hours_worked: parseFloat(hours) || 0 
            });
        }
    });
    
    const activities = [];
    document.querySelectorAll('#activitiesContainer .form-row').forEach(row => {
        const desc = row.querySelector('.activity-desc').value;
        const location = row.querySelector('.activity-location').value;
        const quantity = row.querySelector('.activity-quantity').value;
        if (desc) {
            activities.push({ description: desc, location, quantity });
        }
    });
    
    // LEGAL SECTION 1: Materials
    const materials = [];
    document.querySelectorAll('#materialsContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.material-type').value;
        const quantity = row.querySelector('.material-quantity').value;
        const unit = row.querySelector('.material-unit').value;
        const supplier = row.querySelector('.material-supplier').value;
        const deliveryTime = row.querySelector('.material-delivery-time').value;
        if (type && quantity) {
            materials.push({ 
                material_type: type,
                quantity,
                unit,
                supplier,
                delivery_time: deliveryTime || null
            });
        }
    });
    
    // LEGAL SECTION 2: Equipment
    const equipment = [];
    document.querySelectorAll('#equipmentContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.equipment-type').value;
        const hours = row.querySelector('.equipment-hours').value;
        const rental = row.querySelector('.equipment-rental').value === 'true';
        const issues = row.querySelector('.equipment-issues').value;
        if (type) {
            equipment.push({
                equipment_type: type,
                hours_used: parseFloat(hours) || 0,
                rental,
                issues
            });
        }
    });
    
    // LEGAL SECTION 3: Safety Incidents
    const safety = [];
    document.querySelectorAll('#safetyContainer .dynamic-row').forEach(row => {
        const type = row.querySelector('.safety-type').value;
        const severity = row.querySelector('.safety-severity').value;
        const description = row.querySelector('.safety-description').value;
        const corrective = row.querySelector('.safety-corrective').value;
        if (type && description) {
            safety.push({
                incident_type: type,
                severity,
                description,
                corrective_action: corrective
            });
        }
    });
    
    // LEGAL SECTION 4: Inspections
    const inspections = [];
    document.querySelectorAll('#inspectionsContainer .dynamic-row').forEach(row => {
        const name = row.querySelector('.inspector-name').value;
        const role = row.querySelector('.inspector-role').value;
        const time = row.querySelector('.inspection-time').value;
        const findings = row.querySelector('.inspection-findings').value;
        const corrections = row.querySelector('.inspection-corrections').value;
        if (name && role) {
            inspections.push({
                inspector_name: name,
                inspector_role: role,
                inspection_time: time || null,
                findings,
                required_corrections: corrections
            });
        }
    });
    
    // LEGAL SECTION 5: Delays
    const delays = [];
    document.querySelectorAll('#delaysContainer .dynamic-row').forEach(row => {
        const reason = row.querySelector('.delay-reason').value;
        const responsible = row.querySelector('.delay-responsible').value;
        const hours = row.querySelector('.delay-hours').value;
        const description = row.querySelector('.delay-description').value;
        if (reason && responsible && description) {
            delays.push({
                delay_reason: reason,
                responsible_party: responsible,
                impact_hours: parseFloat(hours) || 0,
                description
            });
        }
    });
    
    // Calculate total work hours
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakHours = parseFloat(document.getElementById('breakHours').value) || 0;
    let totalWorkHours = 0;
    
    if (startTime && endTime) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        totalWorkHours = (totalMinutes / 60) - breakHours;
    }
    
    return {
        report_number: currentReportNumber,
        project_name: document.getElementById('projectName').value || 'ללא שם',
        report_date: document.getElementById('reportDate').value,
        manager_name: 'אבשי ספיר',
        weather: document.getElementById('weather').value,
        start_time: startTime || null,
        end_time: endTime || null,
        break_hours: breakHours,
        total_work_hours: totalWorkHours,
        general_notes: document.getElementById('generalNotes').value,
        tomorrow_date: document.getElementById('tomorrowDate').value,
        tomorrow_plan: document.getElementById('tomorrowPlan').value,
        workers,
        activities,
        materials,
        equipment,
        safety,
        inspections,
        delays
    };
}

// ============================================
// SAVE FUNCTIONS
// ============================================

async function saveDraft() {
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        if (!data.project_name) {
            showToast('❌ נא למלא שם פרוייקט');
            showLoading(false);
            return;
        }
        
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        const { data: report, error} = await supabaseClient
            .from('reports')
            .insert({
                report_number: data.report_number,
                project_name: data.project_name,
                report_date: data.report_date,
                manager_name: data.manager_name,
                weather: data.weather,
                start_time: data.start_time,
                end_time: data.end_time,
                break_hours: data.break_hours,
                total_work_hours: data.total_work_hours,
                general_notes: data.general_notes,
                tomorrow_date: data.tomorrow_date,
                tomorrow_plan: data.tomorrow_plan,
                manager_signature_path: signaturePath,
                status: 'draft'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Save related data
        await saveRelatedData(report.id, data);
        
        await uploadPhotos(report.id, selectedPhotos, 'manager');
        
        showToast('✅ טיוטה נשמרה!');
        
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ שגיאה: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function sendReport() {
    showLoading(true);
    
    try {
        const data = collectFormData();
        
        if (!data.project_name) {
            showToast('❌ נא למלא שם פרוייקט');
            showLoading(false);
            return;
        }
        
        const signaturePath = await uploadSignature(signaturePad, 'manager');
        
        const { data: report, error } = await supabaseClient
            .from('reports')
            .insert({
                report_number: data.report_number,
                project_name: data.project_name,
                report_date: data.report_date,
                manager_name: data.manager_name,
                weather: data.weather,
                start_time: data.start_time,
                end_time: data.end_time,
                break_hours: data.break_hours,
                total_work_hours: data.total_work_hours,
                general_notes: data.general_notes,
                tomorrow_date: data.tomorrow_date,
                tomorrow_plan: data.tomorrow_plan,
                manager_signature_path: signaturePath,
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        await saveRelatedData(report.id, data);
        await uploadPhotos(report.id, selectedPhotos, 'manager');
        
        const shareURL = `${window.location.origin}${window.location.pathname}?token=${report.share_token}`;
        
        const message = `🔒 *דוח עבודה יומי מאובטח*\n\n` +
            `📋 *מספר דוח:* ${data.report_number}\n` +
            `👷 *מנהל:* אבשי ספיר\n` +
            `🏗️ *פרוייקט:* ${data.project_name}\n` +
            `📅 *תאריך:* ${data.report_date}\n` +
            `⚖️ *תיעוד משפטי מלא*\n\n` +
            `✅ *לחץ לאישור:*\n${shareURL}\n\n` +
            `📱 050-5231042`;
        
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
        
        showToast('✅ דוח נשלח!\n\nקישור: ' + shareURL, 'error');
        
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ שגיאה: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function saveRelatedData(reportId, data) {
    // Workers
    if (data.workers.length > 0) {
        await supabaseClient.from('workers').insert(
            data.workers.map(w => ({ ...w, report_id: reportId }))
        );
    }
    
    // Activities
    if (data.activities.length > 0) {
        await supabaseClient.from('activities').insert(
            data.activities.map(a => ({ ...a, report_id: reportId }))
        );
    }
    
    // Materials
    if (data.materials.length > 0) {
        await supabaseClient.from('materials').insert(
            data.materials.map(m => ({ ...m, report_id: reportId }))
        );
    }
    
    // Equipment
    if (data.equipment.length > 0) {
        await supabaseClient.from('equipment').insert(
            data.equipment.map(e => ({ ...e, report_id: reportId }))
        );
    }
    
    // Safety Incidents
    if (data.safety.length > 0) {
        await supabaseClient.from('safety_incidents').insert(
            data.safety.map(s => ({ ...s, report_id: reportId }))
        );
    }
    
    // Inspections
    if (data.inspections.length > 0) {
        await supabaseClient.from('inspections').insert(
            data.inspections.map(i => ({ ...i, report_id: reportId }))
        );
    }
    
    // Delays
    if (data.delays.length > 0) {
        await supabaseClient.from('delays').insert(
            data.delays.map(d => ({ ...d, report_id: reportId }))
        );
    }
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

async function uploadSignature(canvas, type) {
    if (!canvas) return null;
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const fileName = `${type}_${Date.now()}.png`;
    
    const { data, error } = await supabaseClient.storage
        .from('signatures')
        .upload(fileName, blob);
    
    if (error) throw error;
    return data.path;
}

async function uploadPhotos(reportId, photos, uploadedBy) {
    for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const fileName = `${reportId}_${uploadedBy}_${Date.now()}_${i}.jpg`;
        
        const { data, error } = await supabaseClient.storage
            .from('photos')
            .upload(fileName, file);
        
        if (error) throw error;
        
        await supabaseClient.from('photos').insert({
            report_id: reportId,
            storage_path: data.path,
            file_size: file.size
        });
    }
}

// ============================================
// OWNER VIEW
// ============================================

async function loadReportForOwner(token) {
    showLoading(true);
    
    try {
        const { data, error } = await supabaseClient.rpc('get_full_report', {
            report_token: token
        });
        
        if (error) throw error;
        
        if (!data || !data.report) {
            showToast('❌ דוח לא נמצא', 'error'); return;
        }
        
        currentReport = data;
        displayReportForOwner(data);
        const _mv=document.getElementById('managerView');
        const _ov=document.getElementById('ownerView');
        if(_mv) _mv.style.display = 'none';
        if(_ov) _ov.style.display = 'block';
        
        initSignaturePad('ownerSignature');
        
        document.getElementById('ownerPhotoInput').addEventListener('change', handleOwnerPhotoSelection);
        
        document.getElementById('voiceRemarksBtn').addEventListener('click', () => {
            startVoiceRecording('ownerRemarks');
        });
        
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ שגיאה: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayReportForOwner(data) {
    const report = data.report;
    const container = document.getElementById('reportDetails');
    
    // Display report number in print header
    const printReportNumber = document.getElementById('printReportNumber');
    if (printReportNumber && report.report_number) {
        printReportNumber.innerHTML = `
            <div style="text-align: center; font-size: 18px; font-weight: bold; color: #667eea;">
                אישור עבודה מספר: ${report.report_number}
            </div>
            <div style="text-align: center; font-size: 12px; color: #666; margin-top: 5px;">
                ${report.report_date}
            </div>
        `;
    }
    
    let html = '<div class="section">';
    
    // Add report number at the top
    if (report.report_number) {
        html += `<div style="background: #f0f7ff; padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center;">`;
        html += `<strong style="color: #667eea;">מספר דוח:</strong> <span style="font-family: monospace; font-size: 18px; font-weight: bold;">${report.report_number}</span>`;
        html += `</div>`;
    }
    
    html += `<h2>📋 ${report.project_name}</h2>`;
    html += `<p><strong>תאריך:</strong> ${report.report_date}</p>`;
    html += `<p><strong>מנהל:</strong> ${report.manager_name}</p>`;
    if (report.weather) html += `<p><strong>מזג אוויר:</strong> ${report.weather}</p>`;
    
    if (report.start_time && report.end_time) {
        html += `<p><strong>שעות עבודה:</strong> ${report.start_time} - ${report.end_time}`;
        if (report.total_work_hours) {
            html += ` (סה"כ: ${report.total_work_hours} שעות)`;
        }
        html += '</p>';
    }
    
    if (report.general_notes) html += `<p><strong>הערות:</strong> ${report.general_notes}</p>`;
    
    if (report.tomorrow_plan) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📅 תוכנית עבודה למחר</h3>';
        if (report.tomorrow_date) html += `<p><strong>תאריך:</strong> ${report.tomorrow_date}</p>`;
        html += `<p>${report.tomorrow_plan}</p>`;
    }
    
    if (data.workers && data.workers.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>👷 כוח אדם</h3>';
        let totalWorkerHours = 0;
        data.workers.forEach(worker => {
            html += `<p>• ${worker.role}: ${worker.worker_count} עובדים × ${worker.hours_worked} שעות</p>`;
            totalWorkerHours += worker.worker_count * worker.hours_worked;
        });
        html += `<p><strong>סה"כ שעות כוח אדם:</strong> ${totalWorkerHours} שעות</p>`;
    }
    
    if (data.activities && data.activities.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>🔨 פעילויות</h3>';
        data.activities.forEach(activity => {
            html += `<p>• ${activity.description}`;
            if (activity.location) html += ` - ${activity.location}`;
            if (activity.quantity) html += ` (${activity.quantity})`;
            html += '</p>';
        });
    }
    
    // Display legal sections if they exist
    if (data.materials && data.materials.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📦 אספקות חומרים</h3>';
        data.materials.forEach(m => {
            html += `<p>• ${m.material_type}: ${m.quantity}`;
            if (m.unit) html += ` ${m.unit}`;
            if (m.supplier) html += ` (${m.supplier})`;
            html += '</p>';
        });
    }
    
    if (data.equipment && data.equipment.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>🚜 ציוד ומכונות</h3>';
        data.equipment.forEach(e => {
            html += `<p>• ${e.equipment_type}`;
            if (e.hours_used) html += ` (${e.hours_used} שעות)`;
            if (e.rental) html += ` [השכרה]`;
            html += '</p>';
        });
    }
    
    if (data.safety && data.safety.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>⚠️ בטיחות</h3>';
        data.safety.forEach(s => {
            html += `<p>• ${s.description}`;
            if (s.corrective_action) html += ` - ${s.corrective_action}`;
            html += '</p>';
        });
    }
    
    if (data.inspections && data.inspections.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>👮 ביקורות</h3>';
        data.inspections.forEach(i => {
            html += `<p>• ${i.inspector_name} (${i.inspector_role})`;
            if (i.findings) html += ` - ${i.findings}`;
            html += '</p>';
        });
    }
    
    if (data.delays && data.delays.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>⏰ עיכובים</h3>';
        data.delays.forEach(d => {
            html += `<p>• ${d.description}`;
            if (d.impact_hours) html += ` (${d.impact_hours} שעות)`;
            html += '</p>';
        });
    }
    
    if (data.photos && data.photos.length > 0) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>📸 תמונות מהאתר</h3>';
        html += '<div class="photo-preview">';
        data.photos.forEach(photo => {
            const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`;
            html += `<div class="photo-item"><img src="${photoUrl}" alt="Site photo"></div>`;
        });
        html += '</div>';
    }
    
    // Display manager signature
    if (report.manager_signature_path) {
        html += '<hr style="margin: 15px 0; border: 1px solid #e1e8ed;">';
        html += '<h3>✍️ חתימת מנהל העבודה</h3>';
        const signatureUrl = `${SUPABASE_URL}/storage/v1/object/public/signatures/${report.manager_signature_path}`;
        html += `<div style="text-align: center; padding: 10px;">`;
        html += `<img src="${signatureUrl}" alt="Manager signature" style="max-width: 300px; border: 2px solid #667eea; border-radius: 8px; padding: 10px; background: white;">`;
        html += `<p style="margin-top: 10px; color: #666;">חתימה דיגיטלית: ${report.manager_name}</p>`;
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function approveReport() {
    const ownerName = document.getElementById('ownerName').value;
    const remarks = document.getElementById('ownerRemarks').value;
    
    if (!ownerName) {
        showToast('❌ נא למלא שם', 'error'); return;
    }
    
    showLoading(true);
    
    try {
        const signaturePath = await uploadSignature(ownerSignaturePad, 'owner');
        
        if (selectedOwnerPhotos.length > 0) {
            await uploadPhotos(currentReport.report.id, selectedOwnerPhotos, 'owner');
        }
        
        await supabaseClient
            .from('reports')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                owner_signature_path: signaturePath
            })
            .eq('id', currentReport.report.id);
        
        await supabaseClient.from('approvals').insert({
            report_id: currentReport.report.id,
            owner_name: ownerName,
            remarks: remarks,
            signature_path: signaturePath
        });
        
        showToast('✅ דוח אושר!');
        
        const message = `✅ *דוח אושר*\n\n` +
            `🏗️ ${currentReport.report.project_name}\n` +
            `👤 ${ownerName}\n` +
            `📅 ${currentReport.report.report_date}` +
            (selectedOwnerPhotos.length > 0 ? `\n📸 ${selectedOwnerPhotos.length} תמונות נוספו` : '');
        
        window.open(`https://wa.me/972505231042?text=${encodeURIComponent(message)}`);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ שגיאה: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// PRINT FUNCTION
// ============================================

function printReport() {
    window.print();
}

// ============================================
// UTILITY
// ============================================

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}


// ── DASHBOARD WIDGET FUNCTIONS ─────────────────────────────

function _beniAgo(iso){if(!iso)return'';const d=Math.floor((Date.now()-new Date(iso))/1000);if(d<60)return'עכשיו';if(d<3600)return Math.floor(d/60)+' דק׳';if(d<86400)return Math.floor(d/3600)+' שע׳';return Math.floor(d/86400)+' ימים';}

// ── DAILY CALLS WIDGET ────────────────────────────────────
async function loadDailyCalls(dateStr){const list=document.getElementById('dc-calls-list');if(!list)return;const picker=document.getElementById('dc-date-picker');if(!dateStr){dateStr=new Date().toISOString().split('T')[0];if(picker)picker.value=dateStr;}const label=document.getElementById('dc-date-label');if(label){const d=new Date(dateStr+'T00:00:00');const isToday=dateStr===new Date().toISOString().split('T')[0];label.textContent=isToday?'היום — '+d.toLocaleDateString('he-IL',{day:'numeric',month:'long'}):d.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});}const from=dateStr+'T00:00:00.000Z';const to=dateStr+'T23:59:59.999Z';try{const res=await fetch(SB_URL+'/rest/v1/call_log?created_at=gte.'+from+'&created_at=lte.'+to+'&order=created_at.desc',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});if(!res.ok)throw new Error('HTTP '+res.status);const calls=await res.json();document.getElementById('dc-in').textContent=calls.filter(r=>r.direction==='incoming').length;document.getElementById('dc-out').textContent=calls.filter(r=>r.direction==='outgoing').length;document.getElementById('dc-miss').textContent=calls.filter(r=>r.direction==='missed').length;document.getElementById('dc-wa').textContent=calls.filter(r=>r.wa_sent).length;if(!calls||calls.length===0){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">אין שיחות מוקלטות ליום זה</div>';return;}const dirIcon={incoming:'📞',outgoing:'📲',missed:'📵'};list.innerHTML=calls.map(r=>{const t=new Date(r.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});const dir=r.direction||'incoming';const name=(r.caller_name||'לא ידוע').replace(/</g,'&lt;');const ph=(r.phone||'').replace(/</g,'&lt;');const dot=r.wa_sent?'<div class="dc-wa-dot"></div>':dir==='missed'?'<div class="dc-miss-dot"></div>':'';const noteText=r.note||r.notes||'';const note=noteText?'<div style="font-size:11px;color:var(--amber);margin-top:2px;">📝 '+noteText.replace(/</g,'&lt;')+'</div>':'';return`<div class="dc-call-row"><div class="dc-dir-icon">${dirIcon[dir]||'📞'}</div><div style="flex:1"><div class="dc-name">${name}</div><div class="dc-phone">${ph}</div>${note}</div>${dot}<div class="dc-time">${t}</div></div>`;}).join('');}catch(e){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">שגיאה: '+e.message+'</div>';}}

// ── JOURNAL INTEGRATION ───────────────────────────────────
function openJournalForProject(projectId,projectName){
  window.switchTab&&window.switchTab('journal');
  const fill=()=>{const sel=document.getElementById('projectName');if(!sel){setTimeout(fill,100);return;}populateJournalProjectDropdown(projectName);const dateEl=document.getElementById('reportDate');if(dateEl&&!dateEl.value)dateEl.valueAsDate=new Date();sel.style.border='2px solid #667eea';sel.style.boxShadow='0 0 0 3px rgba(102,126,234,0.25)';setTimeout(()=>{sel.style.border='';sel.style.boxShadow='';},1800);showToast('📝 יומן חדש עבור: '+(projectName||'פרוייקט'),'success');};
  setTimeout(fill,80);
}

async function _spSendLink() {
  var cSel  = document.getElementById('sp-contractor-sel');
  var pSel  = document.getElementById('sp-project-sel');
  var cId   = cSel ? cSel.value : '';
  var cName = cSel && cSel.selectedOptions[0] ? cSel.selectedOptions[0].text : '';
  var pId   = pSel ? pSel.value : '';
  var pName = pSel && pSel.selectedOptions[0] ? pSel.selectedOptions[0].text : '';
  if (!cId) { showToast('בחר קבלן תחילה', 'error'); return; }
  var contractor = (allContractors || []).find(function(c){ return c.id === cId; });
  var mobile = contractor ? (contractor.mobile || '') : '';
  var preview = document.getElementById('sp-link-preview');
  if (preview) { preview.textContent = 'יוצר בקשה...'; preview.style.display = 'block'; }
  try {
    var res = await fetch(SB_URL + '/rest/v1/site_pulse_requests', {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        contractor_id:     cId,
        project_id:        pId   || null,
        contractor_name:   cName,
        project_name:      pName || null,
        contractor_mobile: mobile || null,
        requested_by:      'Beni Persky',
        report_date:       new Date().toISOString().slice(0,10),
        status:            'pending'
      })
    });
    if (!res.ok) throw new Error('Supabase error ' + res.status);
    var rows = await res.json();
    if (!rows || !rows[0] || !rows[0].id) throw new Error('No ID returned');
    var reqId = rows[0].id;
    var formUrl = 'https://avshi2-maker.github.io/site-pulse/?req=' + reqId;
    if (preview) { preview.textContent = formUrl; }
    var projLine   = pName ? 'פרויקט: ' + pName + '\n' : '';
    var textBefore = 'שלום ' + cName + ',\n\nבני פרסקי שולח לך בקשה למלא דוח עבודה יומי.\n' +
                     projLine + 'תאריך: ' + new Date().toLocaleDateString('he-IL') + '\nנא למלא את הטופס:\n\n';
    var textAfter  = '\n\nתודה!';
    var phone      = mobile ? '972' + mobile.replace(/[^0-9]/g,'').replace(/^0/,'') : '';
    var waText     = encodeURIComponent(textBefore) + formUrl + encodeURIComponent(textAfter);
    var waUrl      = phone
      ? 'https://wa.me/' + phone + '?text=' + waText
      : 'https://wa.me/?text=' + waText;
    var _a = document.createElement('a');
    _a.href = waUrl; _a.target = '_blank'; _a.rel = 'noopener';
    document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
    showToast('קישור נשלח לוואטסאפ', 'success');
  } catch(e) {
    if (preview) { preview.textContent = 'שגיאה: ' + e.message; }
    showToast('שגיאה: ' + e.message, 'error');
    console.error('_spSendLink:', e);
  }
}

async function loadBeniTasks(){const list=document.getElementById('beni-tasks-list');const badge=document.getElementById('beni-count');if(!list)return;try{const res=await fetch(SB_URL+'/rest/v1/reminders?is_done=eq.false&order=created_at.desc&limit=25',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});if(!res.ok)throw new Error('HTTP '+res.status);const tasks=await res.json();if(!Array.isArray(tasks)||tasks.length===0){list.innerHTML='<div style="text-align:center;padding:18px;color:var(--text3);font-size:13px;">✅ אין משימות פתוחות לבני</div>';if(badge)badge.style.display='none';return;}if(badge){badge.textContent=tasks.length;badge.style.display='inline';}list.innerHTML=tasks.map(t=>{const srcClass=t.source==='voice'?'beni-src-voice':t.source==='call'?'beni-src-call':'beni-src-manual';const srcLabel=t.source==='voice'?'🎙️ קול':t.source==='call'?'📞 שיחה':'✍️ ידני';const txt=(t.text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const ago=_beniAgo(t.created_at);return`<div class="beni-task-row" id="btr-${t.id}"><div class="beni-check" onclick="_beniDone('${t.id}')" title="סמן כבוצע"></div><div style="flex:1"><div class="beni-task-txt">${txt}</div><div class="beni-task-ago">${ago}</div></div><span class="beni-src ${srcClass}">${srcLabel}</span></div>`;}).join('');}catch(e){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">שגיאה: '+e.message+'</div>';}}
async function _beniDone(id){const row=document.getElementById('btr-'+id);const check=row&&row.querySelector('.beni-check');const txt=row&&row.querySelector('.beni-task-txt');if(check){check.classList.add('done');check.textContent='✓';}if(txt)txt.classList.add('done');try{await fetch(SB_URL+'/rest/v1/reminders?id=eq.'+id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({is_done:true,done_at:new Date().toISOString()})});}catch(e){console.error(e);}setTimeout(()=>{if(row)row.style.opacity='0.25';},500);setTimeout(loadBeniTasks,1400);}

// ── DAILY CALLS WIDGET ────────────────────────────────────


async function loadSiteReports() {
  var list  = document.getElementById('sp-reports-list');
  var badge = document.getElementById('sp-badge');
  if (!list) return;
  list.innerHTML = '<div class="sp-empty">Loading reports...</div>';
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/site_reports?status=eq.pending&order=submitted_at.desc&limit=30',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var reports = await res.json();

    if (!reports || !reports.length) {
      list.innerHTML = '<div class="sp-empty">✅ No pending reports</div>';
      if (badge) badge.style.display = 'none';
      return;
    }

    if (badge) { badge.textContent = reports.length; badge.style.display = 'inline'; }

    list.innerHTML = '';
    reports.forEach(function(r) {
      var card = document.createElement('div');
      card.className = 'sp-report-card';
      card.id = 'spr-' + r.id;
      _spReportCache[r.id] = r;

      // Parse workers
      var workers = [];
      try { workers = typeof r.workers === 'string' ? JSON.parse(r.workers) : (r.workers || []); } catch(e){}
      var totalWorkers = workers.reduce(function(s,w){ return s+(w.count||1); }, 0);
      var workerSummary = workers.map(function(w){ return (w.count||1)+'x '+w.role; }).join(', ');

      // Parse photos
      var photos = [];
      try { photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []); } catch(e){}

      // Rating stars
      var stars = r.day_rating > 0 ? '⭐'.repeat(r.day_rating) : '';

      // Date
      var dateStr = r.report_date ? new Date(r.report_date+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

      // Build card HTML using DOM
      card.innerHTML = [
        '<div class="sp-report-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">',
          '<div>',
            '<div style="font-size:14px;font-weight:900;color:var(--text);">' + esc(r.contractor_name||'Unknown Contractor') + '</div>',
            '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' +
              (r.project_name ? '📁 ' + esc(r.project_name) + ' · ' : '') +
              dateStr + (r.weather ? ' · ' + r.weather : '') +
            '</div>',
          '</div>',
          '<div style="text-align:left;">',
            stars ? '<div style="font-size:13px;">' + stars + '</div>' : '',
            '<div style="font-size:10px;color:var(--text3);">by ' + esc(r.submitted_by||'') + '</div>',
          '</div>',
        '</div>',

        // Workers
        '<div style="background:rgba(59,130,246,0.08);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
          '<div style="font-size:11px;font-weight:800;color:#3b82f6;margin-bottom:3px;">👷 WORKERS (' + totalWorkers + ')</div>',
          '<div style="font-size:12px;color:var(--text2);">' + esc(workerSummary || 'Not specified') + '</div>',
        '</div>',

        // Activities
        '<div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
          '<div style="font-size:11px;font-weight:800;color:#16a34a;margin-bottom:3px;">🔨 WORK COMPLETED</div>',
          '<div style="font-size:12px;color:var(--text2);line-height:1.6;white-space:pre-wrap;">' + esc(r.activities||'—') + '</div>',
        '</div>',

        // Tools (if any)
        r.tools_equipment ? [
          '<div style="background:rgba(245,158,11,0.08);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
            '<div style="font-size:11px;font-weight:800;color:#d97706;margin-bottom:3px;">🔧 TOOLS & EQUIPMENT</div>',
            '<div style="font-size:12px;color:var(--text2);">' + esc(r.tools_equipment) + '</div>',
          '</div>'
        ].join('') : '',

        // Issues (highlighted if present)
        r.issues ? [
          '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
            '<div style="font-size:11px;font-weight:800;color:#dc2626;margin-bottom:3px;">⚠️ ISSUES / PROBLEMS</div>',
            '<div style="font-size:12px;color:#dc2626;">' + esc(r.issues) + '</div>',
          '</div>'
        ].join('') : '',

        // Remarks
        r.remarks ? [
          '<div style="font-size:12px;color:var(--text2);padding:6px 0;border-top:1px solid var(--border);margin-bottom:8px;">',
            '<span style="font-weight:700;">📝 Notes: </span>' + esc(r.remarks),
          '</div>'
        ].join('') : '',

        // Photos thumbnails
        photos.length ? [
          '<div style="margin-bottom:10px;">',
            '<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:6px;">📸 PHOTOS (' + photos.length + ')</div>',
            '<div style="display:flex;gap:6px;overflow-x:auto;">',
              photos.slice(0,5).map(function(path) {
                var url = SB_URL + '/storage/v1/object/public/photos/' + path;
                return '<img src="' + url + '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;" onclick="window.open(\'' + url + '\',\'_blank\')">';
              }).join(''),
            '</div>',
          '</div>'
        ].join('') : '',

        // Action buttons
        '<div style="display:flex;gap:8px;margin-top:4px;">',
          '<button data-id="' + r.id + '" onclick="spApprove(this.dataset.id)" ',
            'style="flex:2;padding:9px;background:linear-gradient(135deg,#15803d,#16a34a);color:white;',
            'border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">',
            '✅ Approve & Sync to CRM',
          '</button>',
          '<button data-id="' + r.id + '" onclick="spReject(this.dataset.id)" ',
            'style="flex:1;padding:9px;background:rgba(220,38,38,0.1);color:var(--red);',
            'border:1px solid rgba(220,38,38,0.3);border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">',
            '❌ Reject',
          '</button>',
        '</div>',

      ].join('');

      list.appendChild(card);
    });

  } catch(e) {
    list.innerHTML = '<div class="sp-empty" style="color:var(--red);">Error: ' + e.message + '</div>';
  }
}

async function loadFieldIntel() {
  const list  = document.getElementById('fi-list');
  const badge = document.getElementById('fi-badge');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:18px;color:var(--text3);font-size:13px;">טוען הקלטות...</div>';
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const from = yesterday.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const res = await fetch(
      SB_URL + '/rest/v1/voice_memos?created_at=gte.' + from + '&order=created_at.desc&limit=30',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const memos = await res.json();

    const unprocessed = memos.filter(function(m){ return !m.is_processed; });
    if (badge) { badge.textContent = unprocessed.length; badge.style.display = unprocessed.length ? 'inline' : 'none'; }

    if (!memos.length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">📭 אין הקלטות מהיומיים האחרונים</div>';
      return;
    }

    list.innerHTML = '';
    const PRIORITY_COLOR = { 'גבוה':'#ef4444', 'רגיל':'#f59e0b', 'נמוך':'#22c55e' };
    const CATEGORY_ICON  = { 'משימה':'📋', 'בעיית_אתר':'⚠️', 'חומרים':'📦', 'לקוח':'👤', 'כספים':'💰', 'כללי':'📝' };

    memos.forEach(function(m) {
      var ai = null;
      try { ai = m.ai_result ? (typeof m.ai_result === 'string' ? JSON.parse(m.ai_result) : m.ai_result) : null; } catch(e){}
      var time     = new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
      var dateStr  = new Date(m.created_at).toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit'});
      var summary  = (ai && ai.summary)  || (m.transcript ? m.transcript.substring(0, 80) : 'ללא תיאור');
      var priority = (ai && ai.priority) || 'רגיל';
      var category = (ai && ai.category) || 'כללי';
      var priColor = PRIORITY_COLOR[priority] || '#f59e0b';
      var catIcon  = CATEGORY_ICON[category]  || '📝';
      var actions  = (ai && ai.action_items) || [];
      var projHint = (ai && ai.project_hint) || '';
      var isDone   = m.is_processed;

      // Card container
      var card = document.createElement('div');
      card.id = 'fi-memo-' + m.id;
      card.style.cssText = 'border:1.5px solid ' + (isDone ? '#e5e7eb' : priColor + '40') + ';border-right:4px solid ' + (isDone ? '#d1d5db' : priColor) + ';border-radius:12px;padding:14px;margin-bottom:10px;background:' + (isDone ? '#fafafa' : 'var(--surface2)') + ';opacity:' + (isDone ? '0.55' : '1') + ';';

      // Header
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;';
      header.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex:1;">'
        + '<span style="font-size:18px;">' + catIcon + '</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:var(--text);">' + summary.replace(/</g,'&lt;') + '</div>'
        + '<div style="font-size:10px;color:var(--text3);margin-top:2px;">' + dateStr + ' · ' + time + (projHint ? ' · 📁 ' + projHint : '') + '</div></div>'
        + '</div>'
        + '<span style="background:' + priColor + '20;color:' + priColor + ';border-radius:20px;padding:2px 10px;font-size:11px;font-weight:800;white-space:nowrap;">' + priority + '</span>';
      card.appendChild(header);

      // Transcript snippet
      if (m.transcript) {
        var snip = document.createElement('div');
        snip.style.cssText = 'font-size:12px;color:var(--text2);background:rgba(0,0,0,0.03);border-radius:6px;padding:8px 10px;margin-bottom:8px;line-height:1.6;font-style:italic;';
        snip.textContent = '"' + m.transcript.substring(0, 150) + (m.transcript.length > 150 ? '...' : '') + '"';
        card.appendChild(snip);
      }

      // Action items
      if (actions.length) {
        var actDiv = document.createElement('div');
        actDiv.style.marginBottom = '8px';
        actions.forEach(function(a) {
          var ai_item = document.createElement('div');
          ai_item.style.cssText = 'font-size:12px;color:var(--text2);padding:2px 0;';
          ai_item.textContent = '▸ ' + a;
          actDiv.appendChild(ai_item);
        });
        card.appendChild(actDiv);
      }

      // Buttons row
      if (isDone) {
        var doneLabel = document.createElement('div');
        doneLabel.style.cssText = 'font-size:11px;color:#9ca3af;';
        doneLabel.textContent = '✔ טופל';
        card.appendChild(doneLabel);
      } else {
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px;';

        // Create task button
        var btnTask = document.createElement('button');
        btnTask.textContent = '✅ צור משימה';
        btnTask.style.cssText = 'background:linear-gradient(135deg,#1e6b30,#22c55e);color:white;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;';
        btnTask.dataset.id = m.id;
        btnTask.dataset.summary = summary;
        btnTask.addEventListener('click', function(){ fiCreateTask(this.dataset.id, this.dataset.summary); });
        btnRow.appendChild(btnTask);

        // Save to notes button
        var btnNote = document.createElement('button');
        btnNote.textContent = '📝 יומן חכם';
        btnNote.style.cssText = 'background:linear-gradient(135deg,#9a6f00,#c9a84c);color:#1a1a2e;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;';
        btnNote.dataset.id = m.id;
        btnNote.dataset.summary = summary;
        btnNote.dataset.transcript = m.transcript || '';
        btnNote.dataset.priority = priority;
        btnNote.addEventListener('click', function(){
          fiShowColorPicker(this.dataset.id, this.dataset.summary, this.dataset.transcript, this.dataset.priority, this.parentElement);
        });
        btnRow.appendChild(btnNote);

        // Link to project dropdown
        var sel = document.createElement('select');
        sel.style.cssText = 'padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;font-family:Heebo,sans-serif;background:var(--surface);color:var(--text);cursor:pointer;';
        sel.dataset.id = m.id;
        var defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = '📁 קשר לפרויקט...';
        sel.appendChild(defOpt);
        (window.allProjects || []).filter(function(p){ return p.status === 'active'; }).forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.project_name;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function(){ if(this.value) fiLinkProject(this.dataset.id, this.value); });
        btnRow.appendChild(sel);

        // Mark done button
        var btnDone = document.createElement('button');
        btnDone.textContent = '✔ טופל';
        btnDone.style.cssText = 'background:rgba(156,163,175,0.15);color:#6b7280;border:1px solid #e5e7eb;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;';
        btnDone.dataset.id = m.id;
        btnDone.addEventListener('click', function(){ fiMarkDone(this.dataset.id); });
        btnRow.appendChild(btnDone);

        card.appendChild(btnRow);
      }

      list.appendChild(card);
    });

  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// ══ FIELD INTEL — ACTION FUNCTIONS ════════════════════════════

// Color tag picker — shown inline below button row
function fiShowColorPicker(memoId, summary, transcript, priority, btnRow) {
  // Remove any existing picker
  const existingPicker = document.getElementById('fi-color-picker-' + memoId);
  if (existingPicker) { existingPicker.remove(); return; }

  const NC = NOTE_COLORS || {
    yellow:{ bg:'#f59e0b', label:'🟡 כללי' },
    red:   { bg:'#ef4444', label:'🔴 דחוף' },
    green: { bg:'#22c55e', label:'🟢 בוצע' },
    blue:  { bg:'#3b82f6', label:'🔵 תכנון' },
    purple:{ bg:'#a855f7', label:'🟣 אישי' },
  };

  var picker = document.createElement('div');
  picker.id = 'fi-color-picker-' + memoId;
  picker.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding:10px 12px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;';

  var label = document.createElement('span');
  label.style.cssText = 'font-size:11px;font-weight:700;color:var(--text3);margin-left:4px;';
  label.textContent = 'תייג ושמור:';
  picker.appendChild(label);

  Object.keys(NC).forEach(function(colorKey) {
    var c = NC[colorKey];
    var btn = document.createElement('button');
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1.5px solid ' + c.bg + ';background:' + c.bg + '20;color:' + c.bg + ';font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;';
    btn.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + c.bg + ';display:inline-block;"></span>' + c.label.replace(/[🟡🔴🟢🔵🟣]/g,'').trim();
    btn.addEventListener('click', function() {
      fiSaveNote(memoId, summary, transcript, colorKey);
      picker.remove();
    });
    picker.appendChild(btn);
  });

  // Insert after the button row
  btnRow.parentNode.insertBefore(picker, btnRow.nextSibling);
}

async function fiSaveNote(memoId, summary, transcript, color) {
  color = color || 'yellow';
  var noteText = summary || transcript || 'הקלטה שדה';
  if (transcript && transcript !== summary && transcript.length > 0) {
    noteText = summary + (transcript.length > 100 ? '' : '\n' + transcript);
  }
  try {
    var res = await fetch(SB_URL + '/rest/v1/beni_notes', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ note_text: '🎙️ ' + noteText.trim(), color: color, project_id: null })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('✅ נשמר ביומן חכם', 'success');
    fiMarkDone(memoId);
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

async function fiCreateTask(memoId, summary) {
  try {
    var res = await fetch(SB_URL + '/rest/v1/reminders', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ text: summary, source: 'voice', priority: 'normal', is_done: false, created_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('✅ משימה נוצרה', 'success');
    fiMarkDone(memoId);
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}

async function fiMarkDone(memoId) {
  try {
    await fetch(SB_URL + '/rest/v1/voice_memos?id=eq.' + memoId, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ is_processed: true })
    });
  } catch(e) {}
  // Fade the card
  var card = document.getElementById('fi-memo-' + memoId);
  if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }
  setTimeout(loadFieldIntel, 1200);
}

async function fiLinkProject(memoId, projectId) {
  var proj = (allProjects || []).find(function(p){ return p.id === projectId; });
  if (!proj) return;
  try {
    await fetch(SB_URL + '/rest/v1/voice_memos?id=eq.' + memoId, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ project_hint: proj.project_name })
    });
    showToast('✅ קושר לפרויקט: ' + proj.project_name, 'success');
    setTimeout(loadFieldIntel, 800);
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}





// ══════════════════════════════════════════════════════════════════════


