// journal_ocr.js — OCR: Photo → Note / Task / Takeoff / Report
// Loaded dynamically by index.html

// ══ JOURNAL OCR — Photo → Note / Task / Takeoff / Report ══════
var _journalOcrImageBase64 = null;
var _journalOcrImageType   = 'image/jpeg';

// Load file → show preview only, no AI yet
// Load a file URL into the OCR system (for routing from מגוון)
async function journalOcrLoadFromUrl(url) {
  var statusEl = document.getElementById('journal-ocr-status');
  var preview  = document.getElementById('journal-ocr-preview');
  var prevImg  = document.getElementById('journal-ocr-preview-img');
  if (statusEl) { statusEl.textContent = '⏳ טוען קובץ...'; statusEl.style.color = '#888'; }
  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error('שגיאה בטעינת הקובץ: ' + res.status);
    var blob = await res.blob();
    var mtype = blob.type || (url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    var b64 = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    _journalOcrImageBase64 = b64;
    _journalOcrImageType   = mtype;
    if (preview) preview.style.display = 'block';
    if (prevImg) {
      if (mtype === 'application/pdf') {
        prevImg.src = ''; prevImg.style.display = 'none';
        // Show PDF icon
        var pdfBadge = document.createElement('div');
        pdfBadge.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:16px;text-align:center;direction:rtl;';
        pdfBadge.innerHTML = '<div style="font-size:36px;">📄</div><div style="font-size:13px;color:#fca5a5;margin-top:6px;">PDF נטען — ' + url.split('/').pop().split('?')[0].replace(/^\d+_/,'') + '</div>';
        if (preview) {
          // Don't clear innerHTML — button is inside preview
          var existBadge = preview.querySelector('.pdf-loaded-badge');
          if (existBadge) existBadge.remove();
          pdfBadge.className = 'pdf-loaded-badge';
          preview.insertBefore(pdfBadge, preview.firstChild);
          preview.style.display = 'block';
        }
      } else {
        prevImg.src = 'data:' + mtype + ';base64,' + b64;
        prevImg.style.display = 'block';
      }
    }
    if (statusEl) { statusEl.textContent = '✅ קובץ נטען — לחץ הפעל OCR'; statusEl.style.color = '#86efac'; }
    // Show run button
    var runBtn = document.getElementById('ocr-run-btn');
    if (runBtn) { runBtn.style.display = 'block'; }
    showToast('✅ קובץ נטען ל-OCR', 'success');
  } catch(e) {
    if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = '#fca5a5'; }
    showToast('❌ ' + e.message, 'error');
  }
}


async function journalOcrLoad(input) {
  const file = input?.files?.[0];
  if (!file) return;
  // 5MB limit check
  if (file.size > 5 * 1024 * 1024) {
    showToast('הקובץ גדול מ-5MB — כווץ לפני העלאה', 'error');
    input.value = '';
    return;
  }
  _journalOcrImageType = file.type || 'image/jpeg';
  _journalOcrImageBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const preview = document.getElementById('journal-ocr-preview');
  const previewImg = document.getElementById('journal-ocr-preview-img');
  const pdfNotice = document.getElementById('journal-ocr-pdf-notice');
  const filename = document.getElementById('journal-ocr-filename');
  if (filename) filename.textContent = file.name + ' (' + (file.size/1024).toFixed(0) + 'KB)';
  const isPDF = file.type === 'application/pdf';
  if (previewImg) {
    if (isPDF) {
      previewImg.style.display = 'none';
      if (pdfNotice) pdfNotice.style.display = 'block';
    } else {
      previewImg.src = 'data:' + _journalOcrImageType + ';base64,' + _journalOcrImageBase64;
      previewImg.style.display = 'block';
      if (pdfNotice) pdfNotice.style.display = 'none';
    }
  }
  if (preview) preview.style.display = 'block';
  const result = document.getElementById('journal-ocr-result');
  if (result) result.style.display = 'none';
}

function journalOcrClear() {
  _journalOcrImageBase64 = null;
  _journalOcrImageType = 'image/jpeg';
  const preview = document.getElementById('journal-ocr-preview');
  if (preview) preview.style.display = 'none';
  const result = document.getElementById('journal-ocr-result');
  if (result) result.style.display = 'none';
  const fileInput = document.getElementById('journal-ocr-file');
  if (fileInput) fileInput.value = '';
}

// Run AI only when button clicked
async function journalOcrRunAI() {
  if (!_journalOcrImageBase64) return;
  const key = (APP.config && APP.config.anthropic_key) || null;
  if (!key) { showToast('הגדר מפתח Anthropic API', 'error'); return; }

  const loading = document.getElementById('journal-ocr-loading');
  const result  = document.getElementById('journal-ocr-result');
  const textEl  = document.getElementById('journal-ocr-text');
  const status  = document.getElementById('journal-ocr-status');

  if (loading) loading.style.display = 'block';
  if (result)  result.style.display  = 'none';
  if (status)  status.textContent    = '';

  // Start timer
  var _ocrAborted = false;
  var _ocrStartTime = Date.now();
  var _ocrTimerInterval = setInterval(function() {
    var el = document.getElementById('ocr-time-display');
    if (el) el.textContent = Math.round((Date.now()-_ocrStartTime)/1000) + 's';
  }, 500);
  var runBtn = document.getElementById('ocr-run-btn');
  if (runBtn) { runBtn.textContent = '⏳ מעבד...'; runBtn.disabled = true; }

  try {

    // If PDF — render first page as JPEG via PDF.js
    var imageBase64 = _journalOcrImageBase64;
    var imageMime   = _journalOcrImageType;
    if (_journalOcrImageType === 'application/pdf') {
      if (status) status.textContent = 'ממיר PDF לתמונה...';
      var pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) throw new Error('PDF.js לא נטען — רענן דף');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var pdfData = atob(imageBase64);
      var pdfArr = new Uint8Array(pdfData.length);
      for (var pi=0;pi<pdfData.length;pi++) pdfArr[pi]=pdfData.charCodeAt(pi);
      var pdf = await pdfjsLib.getDocument({data:pdfArr}).promise;
      var page = await pdf.getPage(1);
      var vp = page.getViewport({scale:2.0});
      var cv = document.createElement('canvas');
      cv.width=vp.width; cv.height=vp.height;
      await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      imageBase64 = cv.toDataURL('image/jpeg',0.92).split(',')[1];
      imageMime = 'image/jpeg';
      if (status) status.textContent = 'שולח לקריאה...';
    }
    const res = await claudeFetch(JSON.stringify({ _apiKey: key,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: imageMime, data: imageBase64 } },
          { type: 'text',  text: 'קרא את כל הטקסט בתמונה הזו בדיוק כפי שהוא כתוב. כלול עברית, אנגלית, ספרות, מידות. אם זו רשימת מדידות — שמור על הפורמט שורה-שורה. החזר רק את הטקסט ללא הסברים.' }
        ]}]
      }), null);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);
    const text = data.content?.[0]?.text || '';

    clearInterval(_ocrTimerInterval);
    if (loading) loading.style.display = 'none';
    if (runBtn) { runBtn.textContent = '🔄 הרץ שוב'; runBtn.disabled = false; }
    journalOcrPopulateProjects();
    var inTok  = data.usage ? data.usage.input_tokens  : 0;
    var outTok = data.usage ? data.usage.output_tokens : 0;
    var total  = inTok + outTok;
    var cost   = (inTok * 0.000003 + outTok * 0.000015).toFixed(4);
    var elapsed = ((Date.now()-_ocrStartTime)/1000).toFixed(1);
    if (status) status.textContent = '✅ ' + total + ' טוקנים · $' + cost + ' · ' + elapsed + 'שנ';
    if (text.trim()) {
      if (textEl)  textEl.value = text.trim();
      if (result)  result.style.display = 'block';
      showToast('✅ טקסט זוהה בהצלחה', 'success');
    } else {
      showToast('⚠️ לא זוהה טקסט בתמונה', 'error');
    }
  } catch(e) {
    if (loading) loading.style.display = 'none';
    showToast('שגיאה: ' + e.message, 'error');
  }
  input.value = '';
}

function journalOcrPrint() {
  const text = document.getElementById('journal-ocr-text')?.value?.trim() || '';
  const w = window.open('','_blank');
  w.document.write('<html dir="rtl"><head><title>OCR</title><style>body{font-family:Arial;padding:30px;direction:rtl;line-height:1.8;font-size:14px;}@media print{button{display:none}}</style></head><body>'
    + '<button onclick="window.close()" style="position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;">✕ סגור</button>'
    + '<button onclick="window.print()" style="position:fixed;top:12px;left:12px;background:#c9a84c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ הדפס</button>'
    + '<h2>📷 OCR — ' + new Date().toLocaleDateString('he-IL') + '</h2>'
    + '<pre style="white-space:pre-wrap;font-family:Arial;">' + text.replace(/</g,'&lt;') + '</pre>'
    + '</body></html>');
  w.document.close();
}

function journalOcrShare() {
  const text = document.getElementById('journal-ocr-text')?.value?.trim() || '';
  const wa = 'https://wa.me/?text=' + encodeURIComponent('📷 OCR תוצאה:\n\n' + text);
  window.open(wa, '_blank');
}

async function journalOcrPopulateProjects() {
  const sel = document.getElementById('ocr-project-select');
  if (!sel) return;
  // Always refresh
  sel.innerHTML = '<option value="">📁 קשר לפרויקט (אופציונלי)...</option>';
  var projects = window.allProjects || [];
  if (!projects.length) {
    try {
      var r = await sbQ('projects','select=id,project_name&order=project_name.asc');
      projects = r.data || [];
    } catch(e) {}
  }
  projects.forEach(function(p) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.project_name || '';
    sel.appendChild(opt);
  });
}

async function journalOcrSend(dest) {
  const text   = document.getElementById('journal-ocr-text')?.value?.trim();
  const status = document.getElementById('journal-ocr-status');
  if (!text) { showToast('אין טקסט לשליחה', 'error'); return; }
  const projId   = document.getElementById('ocr-project-select')?.value || null;
  const projName = projId ? (document.getElementById('ocr-project-select')?.selectedOptions[0]?.textContent || '') : null;

  try {
    if (dest === 'note') {
      const { error } = await sb.from('beni_notes').insert({
        note_text:    '📷 ' + text,
        color:        'yellow',
        project_id:   projId || null,
        project_name: projName || null
      });
      if (error) throw error;
      if (status) status.textContent = '✅ נשמר בהערות' + (projName ? ' · ' + projName : '');
      await loadNotesWall();
      showToast('✅ מזכר OCR נשמר', 'success');

    } else if (dest === 'task') {
      var today = new Date().toISOString().split('T')[0];
      var nextWeek = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
      const { error } = await sb.from('gantt_tasks').insert({
        task_name:  '📷 ' + text.substring(0,80),
        project_id: projId || null,
        start_date: today,
        end_date:   nextWeek,
        status:     'todo',
        progress:   0,
        notes:      'נוצר מ-OCR: ' + text.substring(0,200)
      });
      if (error) throw error;
      if (status) status.textContent = '✅ נשמר במשימות' + (projName ? ' · ' + projName : '');
      showToast('✅ משימה OCR נשמרה במשימות בני פרסקי', 'success');

    } else if (dest === 'takeoff') {
      // Parse measurement lines: "room_name length width"
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const rows = lines.map((line, idx) => {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const room = parts.slice(0, parts.length - 2).join(' ');
          const length = parseFloat(parts[parts.length - 2]) || 0;
          const width  = parseFloat(parts[parts.length - 1]) || 0;
          const area   = Math.round(length * width * 100) / 100;
          return { id: Date.now() + idx, room, length, width, area };
        }
        return { id: Date.now() + idx, room: line, length: 0, width: 0, area: 0 };
      });
      const total = rows.reduce((s, r) => s + r.area, 0);
      const { error } = await sb.from('site_takeoffs').insert({
        project_name: 'OCR — ' + new Date().toLocaleDateString('he-IL'),
        takeoff_date: new Date().toISOString().split('T')[0],
        rows:         JSON.stringify(rows),
        total_area:   Math.round(total * 100) / 100,
        takeoff_type: 'standard',
        session_label: 'ממוחשב מכתב יד',
        created_at:   new Date().toISOString()
      });
      if (error) throw error;
      if (status) status.textContent = '✅ נשמר כטייקאוף (' + rows.length + ' שורות)';
      showToast('✅ טייקאוף OCR נשמר — ' + rows.length + ' מדידות', 'success');

    } else if (dest === 'report') {
      const reportNum = 'OCR-' + Date.now().toString().slice(-6);
      const { error } = await sb.from('reports').insert({
        report_number: reportNum,
        report_date:   new Date().toISOString().split('T')[0],
        project_name:  'דוח שטח — OCR',
        manager_name: (APP.config&&APP.config.manager_name)||'בני פרסקי',
        general_notes: text,
        status:        'draft'
      });
      if (error) throw error;
      if (status) status.textContent = '✅ נשמר כדוח ' + reportNum;
      await loadReports();
      showToast('✅ דוח OCR נשמר: ' + reportNum, 'success');
    }

    // Clear after success
    setTimeout(() => {
      document.getElementById('journal-ocr-result').style.display = 'none';
      document.getElementById('journal-ocr-text').value = '';
      if (status) status.textContent = '';
      _journalOcrImageBase64 = null;
    }, 2500);

  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
    if (status) status.textContent = '❌ ' + e.message;
  }
}

async function loadNotesWall(){
  const wall=document.getElementById('notes-wall');
  if(!wall){ console.error('loadNotesWall: notes-wall not found'); return; }
  wall.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px;color:#666;">טוען הערות...</div>';
  try{
    let notesData = [];
    try {
      const r = await sbQ('beni_notes','select=*&order=created_at.desc');
      notesData = r.data || [];
    } catch(innerE) {
      // DataCloneError or network — notes unavailable, show empty wall
    }
    // Text notes only — photos/audio/video go in their own tabs
    allNotes = notesData.filter(function(n) {
      return !n.photo_url || n.photo_url === null || n.photo_url === '';
    });
    renderNotes(allNotes);
    // Populate project dropdown from allProjects (already loaded)
    const sel=document.getElementById('note-project-select');
    if(sel){
      const projects=window.allProjects||[];
      // Also build from notes that have project_id — covers projects not in allProjects
      const noteProjects={};
      allNotes.forEach(n=>{
        if(n.project_id && n.project_name) noteProjects[n.project_id]=n.project_name;
        else if(n.project_id){
          const p=(projects).find(x=>x.id===n.project_id);
          if(p) noteProjects[n.project_id]=p.project_name;
        }
      });
      // Merge with allProjects
      projects.forEach(p=>{ noteProjects[p.id]=p.project_name; });
      sel.innerHTML='<option value="">📁 כל הפרויקטים</option>'+
        Object.entries(noteProjects).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('');
    }
  }catch(e){console.error('loadNotes:',e.message||e);}
}

function renderNotes(notes){
  const wall=document.getElementById('notes-wall');
  if(!wall)return;
  if(!notes.length){
    wall.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#444"><div style="font-size:48px;margin-bottom:12px">📝</div><div style="font-size:14px">אין הערות עדיין</div></div>';
    return;
  }
  wall.innerHTML=notes.map(function(n){
    var c=NOTE_COLORS[n.color]||NOTE_COLORS.yellow;
    var date=new Date(n.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    var projName='';
    if(n.project_name){projName=n.project_name;}
    else if(n.project_id){var pp=(window.allProjects||[]).find(function(x){return x.id===n.project_id;});if(pp)projName=pp.project_name;}
    var proj=projName?'<span style="font-size:10px;color:#888;margin-top:4px;display:block">📁 '+projName+'</span>':'';
    var photoHtml='';
    if(n.photo_url){
      var isFullUrl = n.photo_url.startsWith('http');
      var isAudio   = n.photo_url.includes('/beni_voice/') || /\.(mp3|m4a|ogg|wav|webm)(\?|$)/i.test(n.photo_url);
      var isVideo   = !isAudio && (n.photo_url.includes('/videos/') || /\.(mp4|mov|avi|m4v)(\?|$)/i.test(n.photo_url));
      // Images: jpg, jpeg, png, heic, gif, webp, or cloudinary image/upload path
      var isImage   = !isAudio && !isVideo && (n.photo_url.includes('/image/upload/') || /\.(jpg|jpeg|png|heic|heif|gif|webp)(\?|$)/i.test(n.photo_url) || n.photo_url.includes('res.cloudinary.com'));
      var mediaSrc  = isFullUrl ? n.photo_url : SB_URL+'/storage/v1/object/public/photos/'+n.photo_url;
      // Convert Cloudinary HEIC to JPG for browser display
      if (mediaSrc.includes('res.cloudinary.com') && /\.heic$/i.test(mediaSrc)) {
        mediaSrc = mediaSrc.replace(/\/upload\//, '/upload/f_jpg,q_auto/').replace(/\.heic$/i, '.jpg');
      }
      if (isAudio) {
        photoHtml = '<div style="margin-top:10px;">'
          + '<audio controls style="width:100%;border-radius:8px;margin-bottom:6px;" src="' + mediaSrc + '"></audio>'
          + '<button onclick="sjTranscribeAudio(&quot;' + n.id + '&quot;,&quot;' + mediaSrc + '&quot;)" id="trans-btn-' + n.id + '" style="width:100%;background:rgba(201,168,76,0.2);border:1px solid rgba(201,168,76,0.4);color:#fde68a;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🧠 תמלל עם AI</button>'
          + '<div id="trans-result-' + n.id + '" style="display:none;margin-top:6px;background:rgba(0,0,0,0.2);border-radius:6px;padding:8px;font-size:11px;color:#e8e6f0;line-height:1.6;white-space:pre-wrap;"></div>'
          + '</div>';
      } else if (isImage) {
        // Force JPG delivery from Cloudinary for HEIC files
        var imgSrc = mediaSrc;
        if (imgSrc.includes('res.cloudinary.com') && /\.heic/i.test(imgSrc)) {
          imgSrc = imgSrc.replace('/upload/', '/upload/f_jpg,q_auto/');
        }
        photoHtml = '<div style="margin-top:10px;"><img src="' + imgSrc + '" style="max-width:100%;border-radius:8px;cursor:pointer;" onclick="openLightbox(this.src,\'\')"></div>';
      } else if (isVideo) {
        var isDrive = mediaSrc.includes('drive.google.com');
        if (isDrive) {
          // Google Drive video — show link button only (can't embed)
          photoHtml = '<div style="margin-top:10px;">'
            + '<a href="'+mediaSrc+'" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:rgba(66,133,244,0.15);border:1.5px solid rgba(66,133,244,0.4);color:#4285f4;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;font-family:Heebo,sans-serif;">'
            + '▶️ פתח סרטון ב-Google Drive</a>'
            + '</div>';
        } else {
          photoHtml = '<div style="margin-top:10px;">'
            + '<video src="'+mediaSrc+'" controls playsinline style="max-width:100%;border-radius:8px;border:1px solid '+c.border+';background:#000;"></video>'
            + '<div style="margin-top:6px;"><a href="'+mediaSrc+'" target="_blank" style="font-size:11px;color:#c4b5fd;text-decoration:none;">🔗 פתח בחלון חדש</a></div>'
            + '</div>';
        }
      } else {
        photoHtml='<div style="margin-top:10px;"><img src="'+mediaSrc+'" style="max-width:100%;border-radius:8px;border:1px solid '+c.border+';cursor:pointer;" onclick="openLightbox(this.src,\'\')"></div>';
      }
    }

    var id=n.id;
    return [
      '<div style="background:'+c.light+';border:1px solid '+c.border+';border-right:4px solid '+c.bg+';border-radius:10px;padding:10px 12px;position:relative">',
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">',
          '<span style="background:'+c.bg+';color:#fff;border-radius:8px;padding:3px 10px;font-size:10px;font-weight:900;">'+c.label+'</span>',
          '<div style="display:flex;gap:6px">',
            '<button onclick="editNote(this.dataset.id)" data-id="'+id+'" style="background:rgba(255,255,255,0.08);border:none;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px">✏️</button>',
            '<button onclick="deleteNote(this.dataset.id)" data-id="'+id+'" style="background:rgba(239,68,68,0.1);border:none;color:#ef4444;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px">🗑️</button>',
            '<button onclick="printNote(this.dataset.id)" data-id="'+id+'" style="background:rgba(255,255,255,0.08);border:none;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px">🖨️</button>',
          '</div>',
        '</div>',
        (n.note_text && n.note_text.startsWith('📷 ')
          ? '<div style="font-size:11px;font-weight:900;color:#c9a84c;margin-bottom:4px;">🤖 מסמך מפוענח ע"י AI</div>'
          + '<p style="color:#ddd;font-size:11px;line-height:1.5;white-space:pre-wrap;margin-bottom:6px;max-height:80px;overflow:hidden;">'+noteTextWithLinks(n.note_text.replace(/^📷 /,''))+'</p>'
          : '<p style="color:#fff;font-size:12px;line-height:1.5;white-space:pre-wrap;margin-bottom:6px;max-height:60px;overflow:hidden;">'+noteTextWithLinks(n.note_text)+'</p>'),
        proj,
        photoHtml,
        '<div style="font-size:11px;color:#aaa;font-weight:700;margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px">📅 '+date+'</div>',
      '</div>'
    ].join('');
  }).join('');
}

function escNote(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function noteTextWithLinks(t){
  var esc = escNote(t);
  // Convert Drive/http URLs in note text to clickable links
  return esc.replace(/(https?:\/\/[^\s<]+)/g, function(url) {
    var label = url.includes('drive.google.com') ? '▶️ פתח סרטון ב-Google Drive' : url.length > 50 ? '🔗 ' + url.substring(0,47) + '...' : '🔗 ' + url;
    return '<a href="' + url + '" target="_blank" style="color:#4285f4;text-decoration:none;font-weight:700;">' + label + '</a>';
  });
}

async function saveNote(){const text=document.getElementById('note-text-input')?.value?.trim();if(!text){showToast('כתוב הערה תחילה', 'error'); return;}const projectId=document.getElementById('note-project-select')?.value||null;showLoading(true);try{const{error}=await sb.from('beni_notes').insert({note_text:text,color:currentNoteColor,project_id:projectId||null});if(error)throw error;clearNoteForm();await loadNotesWall();showToast('✅ הערה נשמרה');}catch(e){showToast('❌ שגיאה: '+e.message);}finally{showLoading(false);}}

async function deleteNote(id){
  if(!confirm('למחוק הערה זו?'))return;
  // Get photo_url before deleting
  var note = allNotes.find(function(n){return n.id===id;});
  await sb.from('beni_notes').delete().eq('id',id);
  // Delete from Cloudinary if it's a Cloudinary file
  if(note && note.photo_url && note.photo_url.includes('res.cloudinary.com')){
    try {
      var parts = note.photo_url.split('/upload/');
      if(parts[1]){
        var publicId = parts[1].replace(/^v[0-9]+\//,'').replace(/\.[^.]+$/,'');
        var isVideo = note.photo_url.includes('/video/upload/');
        var delUrl = 'https://api.cloudinary.com/v1_1/dqdku88vv/' + (isVideo?'video':'image') + '/destroy';
        // Note: unsigned delete requires API secret — skip for now, files auto-expire after 30 days if unused
      }
    } catch(e){}
  }
  await loadNotesWall();showToast('🗑️ הערה נמחקה');
}

function editNote(id){const n=allNotes.find(x=>x.id===id);if(!n)return;const inp=document.getElementById('note-text-input');if(inp)inp.value=n.note_text;selectNoteColor(n.color);const btn=document.querySelector('[onclick="saveNote()"]');if(btn){btn.textContent='💾 עדכן הערה';btn.onclick=async()=>{const text=inp.value.trim();if(!text)return;showLoading(true);await sb.from('beni_notes').update({note_text:text,color:currentNoteColor,updated_at:new Date().toISOString()}).eq('id',id);showLoading(false);btn.textContent='💾 שמור הערה';btn.onclick=saveNote;clearNoteForm();await loadNotesWall();showToast('✅ הערה עודכנה');};}document.getElementById('note-text-input')?.focus();}

function clearNoteForm(){const inp=document.getElementById('note-text-input');if(inp){inp.value='';inp.style.borderColor='';}}

function filterNotes(color){activeNoteFilter=color;document.querySelectorAll('.note-filter').forEach(b=>{b.style.opacity=(b.dataset.filter===color)?'1':'0.5';b.style.fontWeight=(b.dataset.filter===color)?'900':'700';});renderNotes(color==='all'?allNotes:allNotes.filter(n=>n.color===color));}
function filterNotesByKeyword(kw){const filtered=allNotes.filter(n=>!kw||n.note_text.toLowerCase().includes(kw.toLowerCase()));renderNotes(activeNoteFilter==='all'?filtered:filtered.filter(n=>n.color===activeNoteFilter));}
function filterNotesByDate(){const from=document.getElementById('note-date-from')?.value;const to=document.getElementById('note-date-to')?.value;let filtered=allNotes;if(from)filtered=filtered.filter(n=>n.created_at>=from);if(to)filtered=filtered.filter(n=>n.created_at<=to+'T23:59:59');renderNotes(activeNoteFilter==='all'?filtered:filtered.filter(n=>n.color===activeNoteFilter));}
function printNotes(){const visible=allNotes.filter(n=>activeNoteFilter==='all'||n.color===activeNoteFilter);if(!visible.length){showToast('אין הערות להדפסה', 'error'); return;}const rows=visible.map(n=>{const c=NOTE_COLORS[n.color]||NOTE_COLORS.yellow;const date=new Date(n.created_at).toLocaleDateString('he-IL');return'<div class="note" style="border-right:4px solid '+c.bg+';padding:12px 16px;margin-bottom:16px"><strong style="color:'+c.bg+'">'+c.label+'</strong><p style="font-size:14px;line-height:1.9;white-space:pre-wrap">'+escNote(n.note_text)+'</p><div style="font-size:11px;color:#888;margin-top:6px">'+date+'</div></div>';}).join('');const w=window.open('','_blank');w.document.write('<html dir="rtl"><head><title>יומן חכם</title></head><body style="font-family:Heebo,sans-serif;padding:30px;direction:rtl"><button onclick=\"window.close()\" style=\"position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:9999;font-family:Heebo,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.25);">✕ סגור חלון</button><h1>📝 יומן חכם — בני פרסקי</h1>'+rows+'</body></html>');w.document.close();setTimeout(()=>w.print(),500);}
function printNote(id){const n=allNotes.find(x=>x.id===id);if(!n)return;const c=NOTE_COLORS[n.color]||NOTE_COLORS.yellow;const w=window.open('','_blank');const date=new Date(n.created_at).toLocaleDateString('he-IL');w.document.write('<html dir="rtl"><head><title>הערה</title></head><body style="font-family:Heebo,sans-serif;padding:40px;direction:rtl"><button onclick=\"window.close()\" style=\"position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:9999;font-family:Heebo,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.25);">✕ סגור חלון</button><span style="background:'+c.bg+';color:#fff;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;">'+c.label+'</span><p style="font-size:16px;line-height:2;white-space:pre-wrap;margin-top:16px">'+escNote(n.note_text)+'</p><div style="font-size:12px;color:#888;margin-top:20px">'+date+'</div></body></html>');w.document.close();setTimeout(()=>w.print(),300);}
function toggleNoteVoice(){if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){showToast('דפדפן זה אינו תומך בזיהוי קול', 'error'); return;}if(noteVoiceActive){if(noteVoiceRecog)noteVoiceRecog.stop();noteVoiceActive=false;const btn=document.getElementById('note-voice-btn');if(btn){btn.textContent='🎤 הקלט';btn.style.background='rgba(154,111,0,0.2)';}return;}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;noteVoiceRecog=new SR();noteVoiceRecog.lang='he-IL';noteVoiceRecog.continuous=true;noteVoiceRecog.interimResults=false;noteVoiceRecog.onresult=e=>{const transcript=Array.from(e.results).map(r=>r[0].transcript).join(' ');const inp=document.getElementById('note-text-input');if(inp)inp.value=(inp.value?inp.value+' ':'')+transcript;};noteVoiceRecog.onerror=()=>{noteVoiceActive=false;const btn=document.getElementById('note-voice-btn');if(btn){btn.textContent='🎤 הקלט';btn.style.background='rgba(154,111,0,0.2)';}};noteVoiceRecog.start();noteVoiceActive=true;const btn=document.getElementById('note-voice-btn');if(btn){btn.textContent='⏹ עצור';btn.style.background='rgba(239,68,68,0.3)';btn.style.borderColor='#ef4444';btn.style.color='#ef4444';}}



// ══════════════════════════════════════════════════════════════════════
