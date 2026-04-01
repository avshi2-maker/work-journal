
// ── Print helper — uses Blob URL to render full HTML document ─────────────
function _showPrintOverlay(html) {
  var blob = new Blob([html], {type: 'text/html;charset=utf-8'});
  var url  = URL.createObjectURL(blob);
  var ov = document.getElementById('_print_overlay_');
  if (!ov) { ov = document.createElement('div'); ov.id = '_print_overlay_'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;';
  ov.innerHTML = '<iframe id="_print_frame_" src="' + url + '" style="width:100%;height:100%;border:none;"></iframe>';
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ סגור';
  closeBtn.style.cssText = 'position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:100000;font-family:Heebo,sans-serif;';
  closeBtn.onclick = function(){ ov.style.display='none'; URL.revokeObjectURL(url); };
  var printBtn = document.createElement('button');
  printBtn.textContent = '🖨️ הדפס';
  printBtn.style.cssText = 'position:fixed;top:12px;left:12px;background:#2d6a9f;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:100000;font-family:Heebo,sans-serif;';
  printBtn.onclick = function(){
    var fr = document.getElementById('_print_frame_');
    if (fr && fr.contentWindow) fr.contentWindow.print();
  };
  ov.appendChild(closeBtn);
  ov.appendChild(printBtn);
}

// ══ SAFETY INTELLIGENCE ENGINE ══════════════════════════════════════
var _safetyCurrentFile   = null;
var _safetyFrames        = [];   // array of base64 jpeg strings
var _safetyIsVideo       = false;
var _safetyMediaType     = 'image/jpeg';  // actual uploaded file media type
var _safetyHtmlText      = '';   // extracted text from HTML files

// ── Shared media store — uploaded once, used by both Safety & Snag ────
var SHARED_MEDIA = {
  files:     [],   // original File objects
  frames:    [],   // array of arrays of base64 frames per file
  types:     [],   // media type per file
  isVideo:   [],   // bool per file
  htmlTexts: [],   // extracted HTML text per file
  thumbs:    [],   // first frame/thumb per file for display
  names:     [],   // filenames
  loaded:    false
};

function sharedMediaLoad(files) {
  SHARED_MEDIA.files     = Array.from(files);
  SHARED_MEDIA.frames    = [];
  SHARED_MEDIA.types     = [];
  SHARED_MEDIA.isVideo   = [];
  SHARED_MEDIA.htmlTexts = [];
  SHARED_MEDIA.thumbs    = [];
  SHARED_MEDIA.names     = SHARED_MEDIA.files.map(function(f){ return f.name; });
  SHARED_MEDIA.loaded    = false;
  return SHARED_MEDIA.files.length;
}

function sharedMediaStatus() {
  if (!SHARED_MEDIA.files.length) return null;
  return SHARED_MEDIA.files.length + ' קבצים טעונים: ' + SHARED_MEDIA.names.join(', ');
}

function sharedMediaRender(containerId) {
  var el = document.getElementById(containerId);
  if (!el || !SHARED_MEDIA.files.length) return;
  el.innerHTML = '';
  var d = document.createElement('div');
  d.style.cssText = 'background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:10px 14px;margin-bottom:10px;direction:rtl;';
  var title = document.createElement('div');
  title.style.cssText = 'font-size:11px;font-weight:800;color:#22c55e;margin-bottom:6px;';
  title.textContent = '✅ ' + SHARED_MEDIA.files.length + ' קבצים טעונים — משותף לשני הדוחות';
  d.appendChild(title);
  var thumbs = document.createElement('div');
  thumbs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;';
  SHARED_MEDIA.files.forEach(function(f, i) {
    var chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 8px;font-size:11px;color:#ccc;';
    chip.textContent = (fileIsVideo(f)?'🎬':'📸') + ' ' + f.name.substring(0,20);
    thumbs.appendChild(chip);
  });
  d.appendChild(thumbs);
  var clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'margin-top:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:Heebo,sans-serif;font-size:10px;font-weight:700;';
  clearBtn.textContent = '🗑️ נקה קבצים';
  clearBtn.onclick = function() {
    SHARED_MEDIA.files = []; SHARED_MEDIA.loaded = false;
    document.getElementById('safety-shared-status') && (document.getElementById('safety-shared-status').innerHTML = '');
    document.getElementById('snag-shared-status')   && (document.getElementById('snag-shared-status').innerHTML   = '');
    showToast('קבצים נמחקו');
  };
  d.appendChild(clearBtn);
  el.appendChild(d);
}

// ── Safety categories with icons, keywords & severity weights ─────────
// SAFETY_CATEGORIES loaded from Supabase safety_categories table
// Fallback to minimal set if table not yet created
var SAFETY_CATEGORIES = [];
var _safetyCatsLoaded = false;

async function safetyLoadCategories() {
  if (_safetyCatsLoaded && SAFETY_CATEGORIES.length > 0) return;
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/safety_categories?is_active=eq.true&order=sort_order.asc',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var rows = await res.json();
    if (rows && rows.length > 0) {
      SAFETY_CATEGORIES = rows.map(function(r) {
        return {
          id:     r.id,
          icon:   r.icon,
          name:   r.name_he,
          en:     r.name_en,
          items:  typeof r.items_he === 'string' ? JSON.parse(r.items_he) : (r.items_he || []),
          prompt: r.prompt_en
        };
      });
      _safetyCatsLoaded = true;
      safetyRenderCategoryGrid();
      return;
    }
  } catch(e) {
    console.warn('Safety categories table not found — using fallback. Run SQL to create it.', e.message);
  }
  // ── Fallback (used until SQL is run) ──────────────────────────────
  SAFETY_CATEGORIES = [
    { id:'ppe',        icon:'🦺', name:'ציוד מגן אישי (PPE)',          en:'PPE',             items:['קסדה','אפוד','נעלי בטיחות'],    prompt:'Check all workers for hard hats, safety vests, gloves, safety boots, eye protection. Count workers missing PPE.' },
    { id:'heights',    icon:'🪜', name:'עבודה בגובה',                  en:'Working at Heights', items:['סולם','פיגום','מעקה','רתמה'], prompt:'Check elevated work, ladder safety, scaffold guardrails, harnesses clipped to anchors, unguarded edges.' },
    { id:'hot_work',   icon:'🔥', name:'עבודות חמות',                  en:'Hot Work',        items:['ריתוך','זוויתן','מפח'],          prompt:'Check for welding/grinding/cutting, fire extinguisher within 5m, flammable materials cleared, face shields in use.' },
    { id:'confined',   icon:'⬛', name:'חלל מוקף',                     en:'Confined Space',  items:['בור','מיכל','מנהרה'],           prompt:'Check enclosed work areas for standby person, ventilation, entry permit, rescue equipment.' },
    { id:'electrical', icon:'⚡', name:'חשמל',                          en:'Electrical',      items:['חיוטים גלויים','לוח פתוח'],     prompt:'Check for exposed wiring, open panels, damaged cables, makeshift connections.' },
    { id:'excavation', icon:'⛏️', name:'חפירות',                       en:'Excavations',     items:['תמיכת דפנות','גידור','גישה'],   prompt:'Check trench/excavation wall support, perimeter fencing, safe access, spoil distance from edge.' },
    { id:'machinery',  icon:'🏗️', name:'מכונות כבדות',                 en:'Heavy Machinery', items:['עגורן','מלגזה'],               prompt:'Check workers under crane loads, pedestrian separation from plant, operator seatbelts.' },
    { id:'housekeeping',icon:'🗑️',name:'סדר וניקיון',                  en:'Housekeeping',    items:['מכשולי נפילה','מעברים'],        prompt:'Check trip hazards, blocked exits, unstable material stacks, standing water.' }
  ];
  _safetyCatsLoaded = true;
  safetyRenderCategoryGrid();
}

function safetyRenderCategoryGrid() {
  var grid = document.getElementById('safety-categories-grid');
  if (!grid) return;
  grid.innerHTML = SAFETY_CATEGORIES.map(function(cat) {
    return '<label style="display:flex;align-items:center;gap:8px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;cursor:pointer;user-select:none;">'      + '<input type="checkbox" class="safety-cat-cb" data-id="' + cat.id + '" checked'      + ' style="width:16px;height:16px;cursor:pointer;accent-color:#ef4444;">'      + '<span style="font-size:16px;">' + (cat.icon||'🔧') + '</span>'      + '<span style="font-size:12px;font-weight:700;color:#ccc;direction:rtl;">' + cat.name + '</span>'      + '</label>';
  }).join('');
}

function safetySelectAll(checked) {
  document.querySelectorAll('.safety-cat-cb').forEach(function(cb){ cb.checked = checked; });
}

// ── Severity scoring ───────────────────────────────────────────────
var SEVERITY = {
  CRITICAL: { level: 3, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '🔴 קריטי — פעולה מיידית', border: '#ef4444' },
  MODERATE: { level: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '🟡 בינוני — טיפול נדרש',  border: '#f59e0b' },
  MINOR:    { level: 1, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: '🔵 קל — לתשומת לב',     border: '#3b82f6' },
  OK:       { level: 0, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  label: '✅ תקין',                 border: '#22c55e' }
};

// ── TIMER / TOKEN METER ─────────────────────────────────────────────
var _safetyTimer     = null;
var _safetyStartTime = null;
var _safetyLastFindings = null;  // stored for WhatsApp export

function safetyStartMeter(estimatedTokens) {
  _safetyStartTime = Date.now();
  var elapsed  = 0;
  // Estimate token count based on frames: ~1700 tokens per image + ~800 prompt
  var estInput  = (estimatedTokens || (_safetyFrames.length * 1700 + 800));
  var estOutput = 600; // roughly 600 output tokens
  clearInterval(_safetyTimer);
  _safetyTimer = setInterval(function() {
    elapsed = Math.floor((Date.now() - _safetyStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var clockEl  = document.getElementById('safety-clock');
    var tokenEl  = document.getElementById('safety-tokens');
    var costEl   = document.getElementById('safety-cost');
    if (clockEl) clockEl.textContent = mins + ':' + (secs<10?'0':'') + secs;
    // Animate token count up to estimated over ~15 seconds
    var pct     = Math.min(1, elapsed / 15);
    var curTok  = Math.round((estInput + estOutput) * pct);
    if (tokenEl) tokenEl.textContent = '~' + curTok.toLocaleString();
    // Cost: $3/M input + $15/M output
    var cost = (estInput * 3 / 1000000) + (estOutput * 15 / 1000000);
    if (costEl) costEl.textContent = '$' + cost.toFixed(3);
  }, 500);
}

function safetyStopMeter(actualInputTokens, actualOutputTokens) {
  clearInterval(_safetyTimer);
  var elapsed = Math.floor((Date.now() - (_safetyStartTime||Date.now())) / 1000);
  var mins = Math.floor(elapsed / 60);
  var secs = elapsed % 60;
  var inTok  = actualInputTokens  || (_safetyFrames.length * 1700 + 800);
  var outTok = actualOutputTokens || 500;
  var cost   = (inTok * 3 / 1000000) + (outTok * 15 / 1000000);
  var clockEl = document.getElementById('safety-clock');
  var tokenEl = document.getElementById('safety-tokens');
  var costEl  = document.getElementById('safety-cost');
  if (clockEl) clockEl.textContent = mins + ':' + (secs<10?'0':'') + secs;
  if (tokenEl) tokenEl.textContent = (inTok + outTok).toLocaleString();
  if (costEl)  costEl.textContent  = '$' + cost.toFixed(3);
}

// ── FILE TYPE HELPERS ────────────────────────────────────────────────
function fileIsImage(file) {
  return file.type.startsWith('image/');
}
function fileIsVideo(file) {
  return file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|avi|m4v|mkv|wmv)$/i.test(file.name);
}
function fileIsPDF(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
function fileIsHTML(file) {
  return file.type === 'text/html' || /\.html?$/i.test(file.name);
}

// Read file as base64 (images/pdf)
function readFileAsBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function(e){ resolve(e.target.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Read file as text (HTML)
function readFileAsText(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function(e){ resolve(e.target.result); };
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// Strip HTML tags to plain text
function htmlToText(html) {
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Remove scripts, styles
  tmp.querySelectorAll('script,style,noscript').forEach(function(el){ el.remove(); });
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g,' ').trim().substring(0, 8000);
}


// ── INIT ──────────────────────────────────────────────────────────────
function safetyTabInit() {
  safetyPopulateProjects();
  safetyLoadCategories().then(function() {
    safetyLoadHistory();
  });
  // Ensure the correct sub-tab is visible on load
  _switchSafetySubTabReal('safety');
  // Pre-load snag categories in background
  setTimeout(snagLoadCategories, 500);
}

function safetyPopulateProjects() {
  var sel = document.getElementById('safety-project-sel');
  if (!sel || !window.allProjects) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">📁 כל הפרויקטים</option>';
  (window.allProjects||[]).forEach(function(p){
    var o = document.createElement('option');
    o.value = p.id; o.textContent = p.project_name;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}

// ── FILE HANDLER ───────────────────────────────────────────────────────
async function safetyHandleFile(input) {
  var files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';
  // Save to shared media — makes files available to snag tab
  sharedMediaLoad(files);
  var snagBtn = document.getElementById('snag-use-shared-btn');
  if (snagBtn) snagBtn.style.display = 'inline-flex';
  sharedMediaRender('safety-shared-status');
  sharedMediaRender('snag-shared-status');

  if (files.length > 1) {
    await safetyHandleMultipleFiles(files);
    return;
  }

  var file = files[0];
  _safetyCurrentFile = file;
  _safetyIsVideo     = fileIsVideo(file);
  _safetyFrames      = [];
  _safetyMediaType   = file.type || 'image/jpeg';

  var prog    = document.getElementById('safety-progress');
  var progTxt = document.getElementById('safety-progress-text');
  var progBar = document.getElementById('safety-progress-bar');
  var preview = document.getElementById('safety-frames-preview');

  prog.style.display    = 'block';
  preview.innerHTML     = '';
  progBar.style.width   = '0%';

  try {
    if (_safetyIsVideo) {
      // ── Video: extract up to 8 frames ─────────────────────────
      progTxt.textContent = '🎞️ מחלץ פריימים מהסרטון (' + file.name + ')...';
      progBar.style.width = '20%';
      _safetyFrames = await safetyExtractFrames(file, 8);
      progBar.style.width = '40%';
      _safetyFrames.forEach(function(b64, i) {
        var img = document.createElement('img');
        img.src = 'data:image/jpeg;base64,' + b64;
        img.style.cssText = 'width:80px;height:55px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.15);';
        img.title = 'פריים ' + (i+1);
        preview.appendChild(img);
      });
      if (_safetyFrames.length === 0) throw new Error('לא ניתן לחלץ פריימים — נסה MP4 או MOV');
      progTxt.textContent = '✅ ' + _safetyFrames.length + ' פריימים — שולח לניתוח AI...';

    } else if (fileIsPDF(file)) {
      // ── PDF: send as document type to Claude ──────────────────
      progTxt.textContent = '📄 קורא PDF...';
      progBar.style.width = '30%';
      var pdfB64 = await readFileAsBase64(file);
      _safetyFrames = [pdfB64];
      _safetyMediaType = 'application/pdf';
      progTxt.textContent = '📄 PDF מוכן — שולח לניתוח AI...';
      // Show PDF label
      var lbl = document.createElement('div');
      lbl.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;';
      lbl.textContent = '📄 ' + file.name;
      preview.appendChild(lbl);

    } else if (fileIsHTML(file)) {
      // ── HTML: extract text → send as text message ─────────────
      progTxt.textContent = '🌐 מחלץ טקסט מקובץ HTML...';
      progBar.style.width = '30%';
      var htmlText = await readFileAsText(file);
      var plainText = htmlToText(htmlText);
      _safetyHtmlText = plainText;  // stored separately, not as image frame
      _safetyFrames = [];           // no frames for HTML
      _safetyMediaType = 'text/html';
      progTxt.textContent = '🌐 HTML מוכן (' + plainText.length + ' תווים) — שולח לניתוח...';
      var lbl = document.createElement('div');
      lbl.style.cssText = 'background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;';
      lbl.textContent = '🌐 ' + file.name + ' — ' + plainText.length + ' תווים';
      preview.appendChild(lbl);

    } else {
      // ── Image ─────────────────────────────────────────────────
      progTxt.textContent = '📸 מכין תמונה לניתוח...';
      progBar.style.width = '30%';
      _safetyMediaType = file.type || 'image/jpeg';
      if (!['image/jpeg','image/png','image/gif','image/webp'].includes(_safetyMediaType)) {
        _safetyMediaType = 'image/jpeg';
      }
      var b64 = await readFileAsBase64(file);
      _safetyFrames = [b64];
      var img = document.createElement('img');
      img.src = 'data:' + _safetyMediaType + ';base64,' + b64;
      img.style.cssText = 'width:120px;height:80px;object-fit:cover;border-radius:8px;border:2px solid rgba(239,68,68,0.4);';
      preview.appendChild(img);
      progTxt.textContent = '🧠 שולח לניתוח AI...';
    }

    progBar.style.width = '55%';
    // Show the scan button — don't auto-run
    var scanBtn = document.getElementById('safety-scan-btn');
    if (scanBtn) {
      scanBtn.style.display = 'block';
      scanBtn.scrollIntoView({behavior:'smooth', block:'center'});
    }
    prog.style.display = 'none';

  } catch(e) {
    progTxt.textContent = '❌ שגיאה: ' + e.message;
    progBar.style.background = '#ef4444';
    progBar.style.width = '100%';
  }
}

// ── FRAME EXTRACTION ──────────────────────────────────────────────────
function safetyExtractFrames(file, maxFrames) {
  return new Promise(function(resolve) {
    var url   = URL.createObjectURL(file);
    var video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'metadata';
    // Hide completely — no layout impact
    video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);
    video.src = url;

    var frames  = [];
    var times   = [];
    var idx     = 0;
    var seeking = false;

    function cleanup() {
      try { URL.revokeObjectURL(url); } catch(e){}
      try { video.remove(); } catch(e){}
    }

    function captureAndAdvance() {
      if (seeking) return; // guard against double-fire
      seeking = false;
      try {
        var ratio  = Math.min(640 / (video.videoWidth || 640), 1);
        var canvas = document.createElement('canvas');
        canvas.width  = Math.round((video.videoWidth  || 640) * ratio);
        canvas.height = Math.round((video.videoHeight || 360) * ratio);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        var b64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
        if (b64) frames.push(b64);
      } catch(e) {}
      idx++;
      seekToNext();
    }

    function seekToNext() {
      if (idx >= times.length) {
        cleanup();
        resolve(frames);
        return;
      }
      seeking = true;
      video.currentTime = times[idx];
    }

    video.addEventListener('seeked', function onSeeked() {
      seeking = false;
      captureAndAdvance();
    });

    video.addEventListener('loadedmetadata', function() {
      var dur   = isFinite(video.duration) ? video.duration : 10;
      var count = Math.min(maxFrames, Math.max(1, Math.floor(dur / 2)));
      for (var i = 0; i < count; i++) {
        times.push(0.3 + (i / Math.max(count - 1, 1)) * (dur - 0.6));
      }
      seekToNext();
    });

    video.addEventListener('error', function() { cleanup(); resolve(frames); });
    // Timeout safety — if nothing happens after 30s, resolve with what we have
    setTimeout(function() { if (frames.length === 0 && times.length === 0) { cleanup(); resolve(frames); } }, 30000);
  });
}

// ── MAIN AI ANALYSIS ──────────────────────────────────────────────────
async function safetyRunAnalysis() {
  // Guard: must have a file loaded before running
  if (!_safetyFrames || !_safetyFrames.length) {
    showToast('יש להעלות קובץ לפני הפעלת הניתוח', 'error');
    return;
  }

  // Hide scan button while running
  var safetyBtn = document.getElementById('safety-scan-btn');
  if (safetyBtn) safetyBtn.style.display = 'none';

  // Ensure categories are loaded from Supabase
  await safetyLoadCategories();

  var progTxt = document.getElementById('safety-progress-text');
  var progBar = document.getElementById('safety-progress-bar');
  var results = document.getElementById('safety-results');
  var apiKey  = (APP.config && APP.config.anthropic_key) || null;

  if (!apiKey) {
    showToast('הגדר מפתח Anthropic API תחילה', 'error');
    document.getElementById('safety-progress').style.display = 'none';
    if (safetyBtn) safetyBtn.style.display = 'block';
    return;
  }

  var findings = {};
  // Use only checked categories (all if none checked)
  var checkedIds = Array.from(document.querySelectorAll('.safety-cat-cb:checked')).map(function(cb){ return cb.dataset.id; });
  var activeCats = checkedIds.length > 0 ? SAFETY_CATEGORIES.filter(function(c){ return checkedIds.includes(c.id); }) : SAFETY_CATEGORIES;
  var totalCategories = activeCats.length;

  // Build image content blocks — one per frame (max 8)
  // Build content blocks based on file type
  var imageBlocks = [];
  if (_safetyMediaType === 'text/html' && _safetyHtmlText) {
    // HTML: send as text
    imageBlocks = [{ type: 'text', text: 'תוכן הדף/הדוח לניתוח:\n\n' + _safetyHtmlText }];
  } else if (_safetyMediaType === 'application/pdf') {
    // PDF: use document type
    imageBlocks = _safetyFrames.map(function(b64) {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
    });
  } else {
    // Images / video frames
    imageBlocks = _safetyFrames.map(function(b64, idx) {
      var mtype = (_safetyIsVideo || idx > 0) ? 'image/jpeg' : (_safetyMediaType || 'image/jpeg');
      if (!['image/jpeg','image/png','image/gif','image/webp'].includes(mtype)) mtype = 'image/jpeg';
      return { type: 'image', source: { type: 'base64', media_type: mtype, data: b64 } };
    });
  }

  // ── Single API call with ALL frames + comprehensive safety prompt ───
  var safetyPrompt = 'You are an expert construction site safety inspector with 20+ years experience in Israeli building sites.\n\n'
    + 'Analyze ' + (_safetyIsVideo ? 'these ' + _safetyFrames.length + ' frames from a site video' : 'this site photo')
    + ' for the following safety categories.\n\n'
    + 'For EACH category return a JSON object. Respond ONLY with a valid JSON object, no markdown.\n\n'
    + 'Required JSON structure:\n'
    + '{\n'
    + activeCats.map(function(cat) {
        return '  "' + cat.id + '": {\n'
          + '    "severity": "OK|MINOR|MODERATE|CRITICAL",\n'
          + '    "found": ["specific finding 1 in Hebrew", "finding 2"],\n'
          + '    "action": "required action in Hebrew or null if OK",\n'
          + '    "frame_ref": "which frame number shows main issue, or null"\n'
          + '  }';
      }).join(',\n')
    + '\n}\n\n'
    + 'Category analysis instructions:\n'
    + activeCats.map(function(cat, i){
        return (i+1) + '. ' + cat.en + ' (id: "' + cat.id + '"): ' + cat.prompt;
      }).join('\n')
    + '\n\nSeverity rules:\n'
    + '- CRITICAL: Immediate danger to life, work must stop\n'
    + '- MODERATE: Significant risk, fix within hours\n'
    + '- MINOR: Low risk, fix within the day\n'
    + '- OK: No issues found\n'
    + '\nIf a category is not visible in the images, mark as OK with found: []\n'
    + 'IMPORTANT: ALL text in "found" and "action" fields MUST be written in Hebrew (עברית) only. No English text in any field values.\n'
    + 'BE SPECIFIC about frame numbers when relevant. Return ONLY valid JSON.';

  var messages = [{ role: 'user', content: [...imageBlocks, { type: 'text', text: safetyPrompt }] }];

  progTxt.textContent = '🧠 Claude מנתח ' + _safetyFrames.length + ' פריימים ב-8 קטגוריות בטיחות...';
  progBar.style.width = '70%';
  safetyStartMeter();

  try {
    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:2000, messages }), 'safety-progress-text');

    var data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);

    var raw = data.content && data.content[0] && data.content[0].text;
    safetyStopMeter(data.usage && data.usage.input_tokens, data.usage && data.usage.output_tokens);
    raw = raw.replace(/```json|```/g,'').trim();

    // Parse JSON safely — local fallback (ragSafeParseJSON lives in rag module which may not be loaded)
    try {
      findings = JSON.parse(raw);
    } catch(parseErr) {
      // Try to extract JSON object from text
      var match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { findings = JSON.parse(match[0]); } catch(e2) { findings = null; }
      } else { findings = null; }
    }
    if (!findings || typeof findings !== 'object' || Array.isArray(findings)) {
      throw new Error('תגובת AI לא תקינה — נסה שוב');
    }

    progBar.style.width = '90%';
    progTxt.textContent = '✅ ניתוח הושלם — מכין דוח...';

    await new Promise(function(r){ setTimeout(r,300); });

    // ── Render the report ──────────────────────────────────────────
    safetyRenderReport(findings);

    // ── Save to Supabase ───────────────────────────────────────────
    var projId   = document.getElementById('safety-project-sel')?.value || null;
    var projName = projId ? ((window.allProjects||[]).find(function(p){return p.id===projId;})||{}).project_name : null;
    await safetySaveReport(findings, projId, projName);

    progBar.style.width = '100%';
    setTimeout(function(){ document.getElementById('safety-progress').style.display='none'; }, 1500);
    safetyLoadHistory();

  } catch(e) {
    progTxt.textContent = '❌ ' + e.message;
    progBar.style.background = '#ef4444';
    progBar.style.width = '100%';
    showToast('שגיאה בניתוח: ' + e.message, 'error');
    // Always restore scan button on error
    var safetyBtnRestore = document.getElementById('safety-scan-btn');
    if (safetyBtnRestore) safetyBtnRestore.style.display = 'block';
  }
}

// ── REPORT RENDERER ───────────────────────────────────────────────────
function safetyRenderReport(findings, metadata) {
  var results = document.getElementById('safety-results');
  if (!results) return;

  var now     = metadata ? new Date(metadata.created_at) : new Date();
  var dateStr = now.toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  var projName = metadata ? (metadata.project_name||'') : (document.getElementById('safety-project-sel')?.selectedOptions[0]?.textContent||'');

  // Score each category
  // Use only categories that were actually analysed (present in findings keys or all)
  // Always show all categories — findings default to OK if AI didn't return them
  var scored = SAFETY_CATEGORIES.map(function(cat) {
    var f   = findings[cat.id] || { severity:'OK', found:[], action:null };
    var sev = SEVERITY[f.severity] || SEVERITY.OK;
    return { cat, f, sev };
  }).sort(function(a,b){ return b.sev.level - a.sev.level; });

  // Overall score
  var maxSev  = scored[0].sev;
  var critCount = scored.filter(function(s){ return s.sev.level === 3; }).length;
  var modCount  = scored.filter(function(s){ return s.sev.level === 2; }).length;
  var okCount   = scored.filter(function(s){ return s.sev.level === 0; }).length;

  var overallColor = maxSev.level >= 3 ? '#ef4444' : maxSev.level >= 2 ? '#f59e0b' : maxSev.level >= 1 ? '#3b82f6' : '#22c55e';
  var overallLabel = maxSev.level >= 3 ? '🔴 אתר — סיכון גבוה' : maxSev.level >= 2 ? '🟡 אתר — דורש טיפול' : maxSev.level >= 1 ? '🔵 אתר — תקין ברובו' : '✅ אתר — תקין לחלוטין';

  var html = '';

  // ── Summary banner ────────────────────────────────────────────────
  html += '<div style="background:linear-gradient(135deg,' + overallColor + '25,' + overallColor + '10);border:2px solid ' + overallColor + ';border-radius:16px;padding:18px 22px;margin-bottom:20px;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900;color:' + overallColor + ';">' + overallLabel + '</div>'
    + '<div style="font-size:12px;color:#888;margin-top:4px;">' + dateStr + (projName ? ' · 📁 ' + projName.replace(/[📁 ]/g,'').trim() : '') + ' · ' + (_safetyIsVideo ? _safetyFrames.length + ' פריימים מסרטון' : 'תמונה') + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:12px;text-align:center;">'
    + (critCount ? '<div><div style="font-size:24px;font-weight:900;color:#ef4444;">' + critCount + '</div><div style="font-size:10px;color:#888;">קריטי</div></div>' : '')
    + (modCount  ? '<div><div style="font-size:24px;font-weight:900;color:#f59e0b;">' + modCount  + '</div><div style="font-size:10px;color:#888;">בינוני</div></div>' : '')
    + '<div><div style="font-size:24px;font-weight:900;color:#22c55e;">' + okCount + '</div><div style="font-size:10px;color:#888;">תקין</div></div>'
    + '</div>'
    + '</div>'
    + '</div>';

  // ── Category cards — critical/moderate first ──────────────────────
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:14px;margin-bottom:20px;">';

  scored.forEach(function(s) {
    if (s.sev.level === 0 && s.f.found && s.f.found.length === 0) {
      // Compact OK card
      html += '<div style="background:' + s.sev.bg + ';border:1px solid ' + s.sev.border + '40;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;">'
        + '<span style="font-size:22px;">' + s.cat.icon + '</span>'
        + '<div style="flex:1;">'
        + '<div style="font-size:13px;font-weight:700;color:#fff;">' + s.cat.name + '</div>'
        + '<div style="font-size:11px;color:#22c55e;margin-top:2px;">✅ תקין — לא נמצאו בעיות</div>'
        + '</div></div>';
      return;
    }

    // Full card for issues
    html += '<div style="background:' + s.sev.bg + ';border:2px solid ' + s.sev.border + ';border-radius:14px;padding:16px;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<span style="font-size:26px;">' + s.cat.icon + '</span>'
      + '<div style="flex:1;">'
      + '<div style="font-size:14px;font-weight:900;color:#fff;">' + s.cat.name + '</div>'
      + '<div style="font-size:11px;margin-top:2px;font-weight:700;color:' + s.sev.color + ';">' + s.sev.label + '</div>'
      + '</div></div>';

    // Findings list
    if (s.f.found && s.f.found.length) {
      html += '<div style="margin-bottom:10px;">';
      s.f.found.forEach(function(finding){
        html += '<div style="font-size:12px;color:#ccc;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">▸ ' + (finding||'').replace(/</g,'&lt;') + '</div>';
      });
      html += '</div>';
    }

    // Required action
    if (s.f.action) {
      html += '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:8px 12px;font-size:12px;color:' + s.sev.color + ';font-weight:700;">'
        + '⚡ פעולה נדרשת: ' + s.f.action.replace(/</g,'&lt;') + '</div>';
    }

    // Frame reference
    if (s.f.frame_ref && _safetyIsVideo) {
      html += '<div style="font-size:10px;color:#555;margin-top:6px;">📹 פריים ' + s.f.frame_ref + '</div>';
    }

    html += '</div>';
  });

  html += '</div>';

  // ── WhatsApp export button ─────────────────────────────────────────
  _safetyLastFindings = findings;  // store for WhatsApp export
  // ── Action bar ────────────────────────────────────────────────────
  var sProjSel  = document.getElementById('safety-project-sel');
  var sProjOpts = sProjSel ? sProjSel.innerHTML : '<option value="">📁 כל הפרויקטים</option>';
  var sProjCurr = sProjSel ? sProjSel.value : '';

  html += '<div id="safety-action-bar" style="background:#242438;border-radius:14px;padding:16px;margin-top:16px;border:1px solid rgba(255,255,255,0.08);">'
    + '<div style="font-size:11px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">פעולות לדוח בטיחות</div>'
    + '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">'
    + '<div style="font-size:12px;color:#888;white-space:nowrap;">📁 קשר לפרויקט:</div>'
    + '<select id="safety-action-project" style="flex:1;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);color:#fff;padding:7px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">'
    + sProjOpts
    + '</select>'
    + '</div>'
    + '<div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;">'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="safety-cb-critical" checked style="accent-color:#ef4444;"> 🔴 קריטי</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="safety-cb-moderate" checked style="accent-color:#f59e0b;"> 🟡 בינוני</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="safety-cb-minor" checked style="accent-color:#3b82f6;"> 🔵 קל</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="safety-cb-ok"> ✅ תקין</label>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button onclick="safetyExportWhatsApp()" style="flex:1;min-width:120px;background:rgba(37,211,102,0.15);border:1.5px solid rgba(37,211,102,0.4);color:#25d366;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">💬 WhatsApp</button>'
    + '<button onclick="safetyPrintReport()" style="flex:1;min-width:120px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#ccc;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">🖨️ הדפס</button>'
    + '<button onclick="safetyEmailReport()" style="flex:1;min-width:120px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">📧 מייל</button>'
    + '<button onclick="safetyOpenCAP()" style="flex:2;min-width:160px;background:linear-gradient(135deg,#7c3aed,#2d6a9f);border:none;color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;">🔧 צור תוכנית תיקון (CAP)</button>'
    + '<button onclick="switchTab(\'crm\');showPage(\'dashboard\')" style="flex:1;min-width:120px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">🏠 לוח בקרה</button>'
    + '</div>'
    + '</div>';

  // ── Wrap with checkbox + thumbnail ──────────────────────────────────
  results.innerHTML = '';
  var safetyWrap = document.createElement('div');
  safetyWrap.className = 'safety-single-result-wrap';
  safetyWrap.style.cssText = 'border:1.5px solid rgba(255,255,255,0.08);border-radius:16px;';

  var safetyHdr = document.createElement('div');
  safetyHdr.style.cssText = 'background:#242438;padding:10px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);';

  var safetySelCb = document.createElement('input');
  safetySelCb.type = 'checkbox'; safetySelCb.checked = true;
  safetySelCb.className = 'report-card-cb';
  safetySelCb.style.cssText = 'accent-color:#ef4444;width:16px;height:16px;cursor:pointer;flex-shrink:0;';
  safetySelCb.title = 'בחר דוח להדפסה';
  safetySelCb.onchange = (function(w){ return function(){
    w.style.opacity = this.checked ? '1' : '0.45';
    w.style.borderColor = this.checked ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
  }; })(safetyWrap);
  safetyHdr.appendChild(safetySelCb);

  if (_safetyFrames && _safetyFrames.length > 0 && _safetyMediaType !== 'application/pdf') {
    var safetyThumbC = document.createElement('canvas');
    safetyThumbC.width = 40; safetyThumbC.height = 40;
    safetyThumbC.className = 'report-thumb-canvas';
    safetyThumbC.style.cssText = 'width:40px;height:40px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;vertical-align:middle;';
    safetyThumbC.dataset.b64 = _safetyFrames[0];
    (function(cv, b64){
      var tImg = new Image();
      tImg.onload = function(){ var cx = cv.getContext('2d'); if(cx) cx.drawImage(tImg,0,0,40,40); };
      tImg.src = 'data:image/jpeg;base64,' + b64;
    })(safetyThumbC, _safetyFrames[0]);
    safetyHdr.appendChild(safetyThumbC);
  }

  var safetyHdrLabel = document.createElement('span');
  safetyHdrLabel.style.cssText = 'font-size:12px;font-weight:700;color:#fca5a5;';
  safetyHdrLabel.textContent = '🛡️ דוח בטיחות — בחר להדפסה';
  safetyHdr.appendChild(safetyHdrLabel);
  safetyWrap.appendChild(safetyHdr);

  var safetyContent = document.createElement('div');
  safetyContent.style.cssText = 'padding:16px;';
  safetyContent.innerHTML = html;
  safetyWrap.appendChild(safetyContent);
  results.appendChild(safetyWrap);

  var sap = document.getElementById('safety-action-project');
  if (sap && sProjCurr) sap.value = sProjCurr;
}

// ── WHATSAPP EXPORT ───────────────────────────────────────────────────
function safetyExportWhatsApp() {
  var findings = _safetyLastFindings;
  if (!findings) { showToast('אין נתוני דוח', 'error'); return; }
  var projName = document.getElementById('safety-project-sel')?.selectedOptions[0]?.textContent || '';
  var now = new Date().toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  var msg = '🛡️ *דוח בטיחות — ' + now + '*\n';
  if (projName && projName !== '📁 כל הפרויקטים') msg += '📁 ' + projName.replace('📁 ','').trim() + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  SAFETY_CATEGORIES.forEach(function(cat) {
    var f   = findings[cat.id] || { severity:'OK', found:[], action:null };
    var sev = f.severity;
    if (sev === 'OK') return;
    var emoji = sev === 'CRITICAL' ? '🔴' : sev === 'MODERATE' ? '🟡' : '🔵';
    msg += emoji + ' *' + cat.name + '*\n';
    (f.found||[]).forEach(function(item){ msg += '  ▸ ' + item + '\n'; });
    if (f.action) msg += '  ⚡ ' + f.action + '\n';
    msg += '\n';
  });

  var crits = SAFETY_CATEGORIES.filter(function(c){ return (findings[c.id]||{}).severity==='CRITICAL'; }).length;
  var mods  = SAFETY_CATEGORIES.filter(function(c){ return (findings[c.id]||{}).severity==='MODERATE'; }).length;
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += (crits ? '🔴 קריטי: ' + crits + '  ' : '') + (mods ? '🟡 בינוני: ' + mods : '');

  var waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
  var a = document.createElement('a'); a.href = waUrl; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── SAVE TO SUPABASE ──────────────────────────────────────────────────
async function safetySaveReport(findings, projId, projName) {
  try {
    var maxSev = 'OK';
    SAFETY_CATEGORIES.forEach(function(cat){
      var s = (findings[cat.id]||{}).severity||'OK';
      if (s === 'CRITICAL') maxSev = 'CRITICAL';
      else if (s === 'MODERATE' && maxSev !== 'CRITICAL') maxSev = 'MODERATE';
      else if (s === 'MINOR' && maxSev === 'OK') maxSev = 'MINOR';
    });

    await fetch(SB_URL + '/rest/v1/safety_analyses', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        project_id:   projId || null,
        project_name: projName || null,
        findings:     findings,
        max_severity: maxSev,
        frame_count:  _safetyFrames.length,
        is_video:     _safetyIsVideo,
        created_at:   new Date().toISOString()
      })
    });
  } catch(e) { console.error('Safety save:', e); }
}

// ── HISTORY LOADER ────────────────────────────────────────────────────
async function safetyLoadHistory() {
  var list = document.getElementById('safety-history-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:12px;color:#555;font-size:12px;">טוען...</div>';
  try {
    var res   = await sbQ('safety_analyses', 'select=id,project_name,project_id,max_severity,frame_count,is_video,created_at,findings,file_url&order=created_at.desc&limit=50');
    var items = res.data || [];
    if (!items.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#444;font-size:13px;">אין ניתוחים עדיין — העלה תמונה או סרטון כדי להתחיל</div>';
      return;
    }
    var SEV_EMOJI = { CRITICAL:'🔴', MODERATE:'🟡', MINOR:'🔵', OK:'✅' };
    var SEV_COLOR = { CRITICAL:'#ef4444', MODERATE:'#f59e0b', MINOR:'#3b82f6', OK:'#22c55e' };
    var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    items.forEach(function(item, idx) {
      var num      = String(idx + 1).padStart(2, '0');
      var date     = new Date(item.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      var sev      = item.max_severity || 'OK';
      var col      = SEV_COLOR[sev] || '#22c55e';
      var fileUrl  = item.file_url || '';
      var cardTitle = (item.project_name||'ניתוח בטיחות') + ' · ' + date;
      var findings = '{}';
      try { findings = typeof item.findings === 'string' ? JSON.parse(item.findings) : (item.findings || {}); } catch(e){}
      var issues = (typeof SAFETY_CATEGORIES !== 'undefined' ? SAFETY_CATEGORIES : []).filter(function(c){ return findings && (findings[c.id]||{}).severity !== 'OK'; });

      html +=
        '<div id="sh-card-' + item.id + '" style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-right:4px solid ' + col + ';border-radius:12px;padding:12px 14px;">' +
          // Header row: number + title + date stamp + delete
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
            '<span style="font-size:10px;font-weight:800;background:rgba(255,255,255,0.07);color:#666;border-radius:6px;padding:2px 7px;flex-shrink:0;">#' + num + '</span>' +
            '<span style="font-size:20px;flex-shrink:0;">' + (SEV_EMOJI[sev]||'✅') + '</span>' +
            '<div style="flex:1;min-width:0;cursor:pointer;" onclick="safetyShowHistoryItem(' + item.id + ')">' +
              '<div style="font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.project_name||'ללא פרויקט') + '</div>' +
              '<div style="font-size:10px;color:#555;margin-top:2px;">📅 ' + date + ' · ' + (item.is_video ? item.frame_count + ' פריימים' : 'תמונה') + '</div>' +
            '</div>' +
            '<button onclick="safetyDeleteAnalysis(' + item.id + ')" title="מחק" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:6px;padding:3px 7px;font-size:11px;cursor:pointer;flex-shrink:0;">🗑️</button>' +
          '</div>' +
          // Issues tags
          (issues.length
            ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">' + issues.map(function(c){ return '<span style="font-size:10px;background:rgba(255,255,255,0.06);color:#aaa;border-radius:6px;padding:2px 7px;">' + (c.icon||'') + ' ' + (c.name||'').split(' ')[0] + '</span>'; }).join('') + '</div>'
            : '<div style="font-size:11px;color:#22c55e;margin-bottom:8px;">✅ לא נמצאו בעיות</div>') +
          // Project link dropdown
          '<div style="margin-bottom:8px;">' +
            '<select onchange="safetyLinkProjectFromHistory(' + item.id + ',this.value)" style="width:100%;padding:6px 10px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#ccc;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;direction:rtl;">' +
              '<option value="">📁 ' + (item.project_name ? item.project_name : 'קשר לפרויקט...') + '</option>' +
              '<!-- projects injected by safetyFillProjectOptions -->' +
            '</select>' +
          '</div>' +
          // Action bar: print / mail / whatsapp
          '<div style="display:flex;gap:4px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">' +
            (fileUrl ? '<a href="' + fileUrl + '" target="_blank" rel="noopener" style="padding:4px 10px;background:#1a3d5c;color:white;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">👁️ צפה</a>' : '') +
            (fileUrl ? '<a href="' + fileUrl + '" target="_blank" style="padding:4px 10px;background:#374151;color:white;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">🖨️ הדפס</a>' : '') +
            (fileUrl ? '<a href="mailto:?subject=' + encodeURIComponent('ניתוח בטיחות #' + num + ': ' + cardTitle) + '&body=' + encodeURIComponent(cardTitle + '\n\n' + fileUrl) + '" style="padding:4px 10px;background:#1e3a5f;color:#93c5fd;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">📧 מייל</a>' : '') +
            (fileUrl ? '<a href="https://wa.me/?text=' + encodeURIComponent('🛡️ ניתוח בטיחות #' + num + '\n' + cardTitle + '\n' + fileUrl) + '" target="_blank" style="padding:4px 10px;background:#15803d;color:white;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">💬 וואטסאפ</a>' : '') +
            '<button onclick="safetyShowHistoryItem(' + item.id + ')" style="padding:4px 10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;border:none;font-family:Heebo,sans-serif;">📋 פתח</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    list.innerHTML = html;
    safetyFillProjectOptions('safety');
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:12px;font-size:12px;">שגיאה: ' + e.message + '</div>';
  }
}

async function safetyDeleteAnalysis(id) {
  if (!confirm('מחק ניתוח זה לצמיתות?')) return;
  try {
    await fetch(SB_URL + '/rest/v1/safety_analyses?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' }
    });
    var card = document.getElementById('sh-card-' + id);
    if (card) { card.style.opacity = '0'; card.style.transition = 'opacity 0.3s'; setTimeout(function(){ card.remove(); }, 300); }
    if (typeof showToast === 'function') showToast('🗑️ ניתוח נמחק');
  } catch(e) { if (typeof showToast === 'function') showToast('שגיאה: ' + e.message, 'error'); }
}

async function safetyLinkProjectFromHistory(analysisId, projectId) {
  if (!projectId) return;
  var proj = (window.allProjects||[]).find(function(p){ return p.id === projectId; });
  try {
    await fetch(SB_URL + '/rest/v1/safety_analyses?id=eq.' + analysisId, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ project_id: projectId, project_name: proj ? proj.project_name : '' })
    });
    if (typeof showToast === 'function') showToast('✅ קושר לפרויקט: ' + (proj ? proj.project_name : ''));
  } catch(e) { if (typeof showToast === 'function') showToast('שגיאה: ' + e.message, 'error'); }
}

function safetyFillProjectOptions(type) {
  var projects = window.allProjects || [];
  // If projects not loaded yet, retry after short delay
  if (!projects.length) {
    setTimeout(function(){ safetyFillProjectOptions(type); }, 800);
    return;
  }
  var selectors = type === 'safety'
    ? document.querySelectorAll('#safety-history-list select')
    : document.querySelectorAll('#snag-history-list select');
  selectors.forEach(function(sel) {
    var cur = sel.value;
    var firstOpt = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(firstOpt);
    projects.forEach(function(p) {
      var o = document.createElement('option');
      o.value = p.id; o.textContent = p.project_name;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  });
}

async function safetyShowHistoryItem(id) {
  var res = await sbQ('safety_analyses', 'select=*&id=eq.' + id);
  var item = res.data && res.data[0];
  if (!item) return;
  var findings = typeof item.findings === 'string' ? JSON.parse(item.findings) : item.findings;
  _safetyFrames = new Array(item.frame_count||1).fill('');
  _safetyIsVideo = item.is_video;
  safetyRenderReport(findings, item);
  window.scrollTo(0, document.getElementById('safety-results').offsetTop - 80);
}


// ══ SAFETY / SNAG SUB-TAB SWITCHER ════════════════════════════════════
function _switchSafetySubTabReal(tab) {
  var tabs = ['annexes','safety','safetyreports','snagannexes','snag','snagreports'];
  var colors = { annexes:'#185FA5', safety:'#A32D2D', safetyreports:'#3B6D11', snagannexes:'#854F0B', snag:'#533AB7', snagreports:'#0F6E56' };
  tabs.forEach(function(t) {
    var el  = document.getElementById('safety-sub-' + t);
    var btn = document.getElementById('subtab-' + t);
    if (el)  el.style.display      = (t === tab) ? 'block' : 'none';
    if (btn) btn.style.background  = (t === tab) ? (colors[t]||'#2d6a9f') : 'transparent';
    if (btn) btn.style.color       = (t === tab) ? '#fff' : '#888';
  });
  if (tab === 'snag')    { snagLoadCategories(); }
  if (tab === 'safetyreports') { safetyLoadHistory(); }
  if (tab === 'snagreports')   { snagLoadHistory(); }
}


// ══════════════════════════════════════════════════════════════════════


// ══ SNAG LIST + CAP MODULE ════════════════════════════════════════
var SNAG_CATEGORIES      = [];
var _snagCatsLoaded      = false;
var _snagFrames          = [];
var _snagIsVideo         = false;
var _snagMediaType       = 'image/jpeg';  // actual file media type
var _snagHtmlText        = '';   // extracted text from HTML files
var _snagLastFindings    = null;
var _snagTimer           = null;
var _snagStartTime       = null;

// ── Load categories from Supabase ─────────────────────────────────────
async function snagLoadCategories() {
  if (_snagCatsLoaded && SNAG_CATEGORIES.length > 0) {
    snagRenderCategoryGrid();
    return;
  }
  try {
    var res  = await fetch(
      SB_URL + '/rest/v1/snag_categories?is_active=eq.true&order=sort_order.asc',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var rows = await res.json();
    if (rows && rows.length > 0) {
      SNAG_CATEGORIES = rows;
      _snagCatsLoaded = true;
      snagRenderCategoryGrid();
      return;
    }
  } catch(e) {
    console.warn('snag_categories fetch failed:', e.message);
  }
  SNAG_CATEGORIES = [
    { id:'concrete',    icon:'🧱', name_he:'ליקויי בטון',           sort_order:1 },
    { id:'iron',        icon:'🔩', name_he:'ברזל ופלדה',            sort_order:2 },
    { id:'painting',    icon:'🎨', name_he:'צביעה וטיח',            sort_order:3 },
    { id:'waterproof',  icon:'💧', name_he:'איטום ורטיבות',          sort_order:4 },
    { id:'tiling',      icon:'⬜', name_he:'ריצוף וחיפוי',           sort_order:5 },
    { id:'carpentry',   icon:'🚪', name_he:'נגרות ואלומיניום',       sort_order:6 },
    { id:'plumbing',    icon:'🚿', name_he:'אינסטלציה',              sort_order:7 },
    { id:'electrical',  icon:'⚡', name_he:'חשמל ותקשורת',           sort_order:8 },
  ];
  _snagCatsLoaded = true;
  snagRenderCategoryGrid();
}

function snagRenderCategoryGrid() {
  var grid = document.getElementById('snag-categories-grid');
  if (!grid) return;
  grid.innerHTML = SNAG_CATEGORIES.map(function(cat) {
    return '<label style="display:flex;align-items:center;gap:8px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;cursor:pointer;user-select:none;">'
      + '<input type="checkbox" class="snag-cat-cb" data-id="' + cat.id + '" checked'
      + ' style="width:16px;height:16px;cursor:pointer;accent-color:#3b82f6;">'
      + '<span style="font-size:16px;">' + (cat.icon||'🔧') + '</span>'
      + '<span style="font-size:12px;font-weight:700;color:#ccc;direction:rtl;">' + cat.name_he + '</span>'
      + '</label>';
  }).join('');
}

function snagSelectAll(checked) {
  document.querySelectorAll('.snag-cat-cb').forEach(function(cb){ cb.checked = checked; });
}

// ── File handler ──────────────────────────────────────────────────────
async function snagHandleFile(input) {
  var files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';
  // Save to shared media — available to safety tab
  sharedMediaLoad(files);
  var safetyBtn = document.getElementById('safety-use-shared-btn');
  if (safetyBtn) safetyBtn.style.display = 'inline-flex';
  sharedMediaRender('safety-shared-status');
  sharedMediaRender('snag-shared-status');

  if (files.length > 1) {
    // Multi-file mode — queue all and process sequentially
    await snagHandleMultipleFiles(files);
    return;
  }

  var file = files[0];
  _snagIsVideo   = fileIsVideo(file);
  _snagFrames    = [];
  _snagMediaType = file.type || 'image/jpeg';
  _snagHtmlText  = '';

  var btn = document.getElementById('snag-scan-btn');
  // Remove old preview
  var ep = document.getElementById('snag-image-preview-wrap');
  if (ep) ep.remove();

  if (_snagIsVideo) {
    // ── Video: extract frames ─────────────────────────────────────
    var prog = document.getElementById('snag-progress');
    var txt  = document.getElementById('snag-progress-text');
    var bar  = document.getElementById('snag-progress-bar');
    var prev = document.getElementById('snag-frames-preview');
    if (prog) prog.style.display = 'block';
    if (prev) prev.innerHTML = '';
    if (bar) bar.style.width = '0%';
    if (txt) txt.textContent = '🎞️ מחלץ פריימים (' + file.name + ')...';
    _snagFrames = await safetyExtractFrames(file, 8);
    if (_snagFrames.length === 0) {
      if (txt) txt.textContent = '❌ לא ניתן לחלץ פריימים — נסה MP4 או MOV';
      return;
    }
    if (bar) bar.style.width = '40%';
    _snagFrames.forEach(function(b64, i) {
      var img = document.createElement('img');
      img.src = 'data:image/jpeg;base64,' + b64;
      img.style.cssText = 'width:80px;height:55px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.15);';
      if (prev) prev.appendChild(img);
    });
    if (txt) txt.textContent = '✅ ' + _snagFrames.length + ' פריימים — לחץ "הפעל סריקה"';
    if (bar) bar.style.width = '100%';
    if (btn) { btn.textContent = '🔍 הפעל סריקת ליקויים AI — ' + _snagFrames.length + ' פריימים ✅'; btn.style.background = 'linear-gradient(135deg,#22c55e,#15803d)'; btn.scrollIntoView({behavior:'smooth',block:'center'}); }
    setTimeout(function(){ if(prog) prog.style.display='none'; }, 2500);

  } else if (fileIsPDF(file)) {
    // ── PDF ───────────────────────────────────────────────────────
    _snagMediaType = 'application/pdf';
    var pdfB64 = await readFileAsBase64(file);
    _snagFrames = [pdfB64];
    snagShowFilePreview('📄 ' + file.name + ' — PDF מוכן לסריקה ✅', '#f59e0b');
    if (btn) { btn.textContent = '🔍 הפעל סריקת ליקויים AI — PDF ✅'; btn.style.background = 'linear-gradient(135deg,#9a6f00,#c9a84c)'; btn.scrollIntoView({behavior:'smooth',block:'center'}); }

  } else if (fileIsHTML(file)) {
    // ── HTML ──────────────────────────────────────────────────────
    _snagMediaType = 'text/html';
    var htmlRaw  = await readFileAsText(file);
    _snagHtmlText = htmlToText(htmlRaw);
    snagShowFilePreview('🌐 ' + file.name + ' — ' + _snagHtmlText.length + ' תווים חולצו ✅', '#93c5fd');
    if (btn) { btn.textContent = '🔍 הפעל סריקת ליקויים AI — HTML ✅'; btn.style.background = 'linear-gradient(135deg,#1a3d5c,#2d6a9f)'; btn.scrollIntoView({behavior:'smooth',block:'center'}); }

  } else {
    // ── Image ─────────────────────────────────────────────────────
    if (!['image/jpeg','image/png','image/gif','image/webp'].includes(_snagMediaType)) {
      _snagMediaType = 'image/jpeg';
    }
    var b64 = await readFileAsBase64(file);
    _snagFrames = [b64];

    var wrap = document.createElement('div');
    wrap.id = 'snag-image-preview-wrap';
    wrap.style.cssText = 'margin-bottom:16px;border-radius:12px;overflow:hidden;border:2px solid rgba(59,130,246,0.4);position:relative;';
    var pImg = document.createElement('img');
    pImg.src = 'data:' + _snagMediaType + ';base64,' + b64;
    pImg.style.cssText = 'width:100%;max-height:280px;object-fit:contain;background:#0a0a1a;display:block;';
    var pLbl = document.createElement('div');
    pLbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.75);padding:8px 14px;font-size:12px;color:#93c5fd;font-weight:700;font-family:Heebo,sans-serif;direction:rtl;';
    pLbl.textContent = '📸 ' + file.name + ' — מוכן לסריקה ✅';
    wrap.appendChild(pImg); wrap.appendChild(pLbl);
    var scanBtn = document.getElementById('snag-scan-btn');
    if (scanBtn) scanBtn.parentNode.insertBefore(wrap, scanBtn);
    if (btn) { btn.textContent = '🔍 הפעל סריקת ליקויים AI'; btn.style.background = 'linear-gradient(135deg,#22c55e,#15803d)'; btn.scrollIntoView({behavior:'smooth',block:'center'}); }
  }
}

function snagShowFilePreview(label, color) {
  var scanBtn = document.getElementById('snag-scan-btn');
  if (!scanBtn) return;
  var ep = document.getElementById('snag-image-preview-wrap');
  if (ep) ep.remove();
  var wrap = document.createElement('div');
  wrap.id = 'snag-image-preview-wrap';
  wrap.style.cssText = 'margin-bottom:16px;border-radius:10px;border:2px solid ' + color + '60;background:' + color + '15;padding:12px 16px;font-size:13px;font-weight:700;color:' + color + ';font-family:Heebo,sans-serif;direction:rtl;';
  wrap.textContent = label;
  scanBtn.parentNode.insertBefore(wrap, scanBtn);
}

// ── Main scan ─────────────────────────────────────────────────────────
async function snagRunScan() {
  if (!_snagFrames.length && !_snagHtmlText) {
    showToast('בחר תמונה, סרטון, PDF או HTML תחילה', 'error');
    return;
  }

  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('הגדר מפתח Anthropic API תחילה', 'error'); return; }

  // Get selected categories
  var selectedIds = Array.from(document.querySelectorAll('.snag-cat-cb:checked')).map(function(cb){ return cb.dataset.id; });
  var customCats  = Array.from(document.querySelectorAll('.snag-custom-cat'))
    .map(function(el){ return el.value.trim(); }).filter(Boolean);
  var allCats     = SNAG_CATEGORIES.filter(function(c){ return selectedIds.includes(c.id); });

  if (!allCats.length && !customCats.length) {
    showToast('בחר לפחות קטגוריה אחת לסריקה', 'error');
    return;
  }

  var prog   = document.getElementById('snag-progress');
  var txt    = document.getElementById('snag-progress-text');
  var bar    = document.getElementById('snag-progress-bar');
  var btn    = document.getElementById('snag-scan-btn');
  var results= document.getElementById('snag-results');

  prog.style.display  = 'block';
  bar.style.width     = '0%';
  if (btn) btn.disabled = true;
  if (results) results.innerHTML = '';
  // Remove image preview
  var ep = document.getElementById('snag-image-preview-wrap');
  if (ep) ep.remove();

  // Start timer
  snagStartMeter();

  // Build content blocks based on file type
  var imageBlocks = [];
  if (_snagMediaType === 'text/html' && _snagHtmlText) {
    imageBlocks = [{ type: 'text', text: 'תוכן הדף/הדוח לניתוח:\n\n' + _snagHtmlText }];
  } else if (_snagMediaType === 'application/pdf') {
    imageBlocks = _snagFrames.map(function(b64) {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
    });
  } else {
    imageBlocks = _snagFrames.map(function(b64, idx) {
      var mtype = (_snagIsVideo || idx > 0) ? 'image/jpeg' : (_snagMediaType || 'image/jpeg');
      if (!['image/jpeg','image/png','image/gif','image/webp'].includes(mtype)) mtype = 'image/jpeg';
      return { type:'image', source:{ type:'base64', media_type:mtype, data:b64 } };
    });
  }

  // Build comprehensive snag prompt
  var catList = allCats.map(function(c, i) {
    var p = c.prompt_en || ('Inspect for defects and poor workmanship in: ' + c.name_he);
    return (i+1) + '. ' + c.name_he + ' (id:"' + c.id + '"): ' + p;
  });
  if (customCats.length) {
    customCats.forEach(function(name, i) {
      catList.push((allCats.length + i + 1) + '. ' + name + ' (id:"custom_' + i + '"): Inspect for any defects, poor workmanship, or quality issues related to: ' + name);
    });
  }

  // Add ממ"ד regulatory context if that category is selected
  var mamadContext = '';
  if (allCats.some(function(c){ return c.id === 'mamad_snag'; }) || customCats.some(function(t){ return t.includes('ממ'); })) {
    mamadContext = '\n\nREGULATORY CONTEXT for ממ"ד inspection (Israeli Safe Room):\n'
      + 'תקנות ההתגוננות האזרחית (מפרטים לבניית מקלטים) תש"ן-1990:\n'
      + '• Minimum floor area: 9m² net, volume 22.5m³\n'
      + '• Ceiling height: min 2.5m, max 2.8m\n'
      + '• Walls: cast-in-place reinforced concrete only (ת"י 118 + ת"י 466)\n'
      + '• Blast door (דלת הדף): steel, opens outward, approved manufacturer\n'
      + '• Blast window (חלון הדף): external steel + internal sealed aluminum\n'
      + '• Air filtration (מנת"ר): NBC filter required per ת"י 4570\n'
      + '• Airtightness test required per ת"י 4577\n'
      + '• FORBIDDEN: gas/water/sewage pipes passing through (not serving room)\n'
      + 'Post-blast assessment: prioritize structural integrity and blast door operability.\n';
  }

  var snagPrompt = 'You are a senior construction quality inspector and defect surveyor with 25+ years experience on Israeli building sites.\n\n'
    + 'Analyze ' + (_snagIsVideo ? 'these ' + _snagFrames.length + ' frames from a site video' : 'this site photo')
    + ' for construction defects and quality issues.' + mamadContext + '\n\n'
    + 'For EACH category, return a JSON object. Respond ONLY with valid JSON, no markdown.\n\n'
    + 'JSON structure:\n{\n'
    + [...allCats.map(function(c){ return c.id; }), ...customCats.map(function(_,i){ return 'custom_'+i; })].map(function(id) {
        return '  "' + id + '": {\n'
          + '    "severity": "NONE|MINOR|MODERATE|CRITICAL",\n'
          + '    "findings": ["specific defect 1 in Hebrew", "defect 2"],\n'
          + '    "location": "where in the image/frame",\n'
          + '    "remedy": "recommended fix in Hebrew",\n'
          + '    "responsible_trade": "trade responsible in Hebrew",\n'
          + '    "frame_ref": "frame number or null"\n'
          + '  }';
      }).join(',\n')
    + '\n}\n\n'
    + 'Categories to inspect:\n' + catList.join('\n')
    + '\n\nSeverity definitions:\n'
    + '- CRITICAL: Structural safety risk or major defect requiring immediate stop-work\n'
    + '- MODERATE: Significant quality defect requiring repair before next stage\n'
    + '- MINOR: Cosmetic or minor defect to fix before handover\n'
    + '- NONE: No defects found in this category\n'
    + '\nBe SPECIFIC about exact locations. '
    + 'CRITICAL LANGUAGE RULE: ALL values in findings, location, remedy, responsible_trade fields MUST be in Hebrew (עברית) ONLY. Absolutely no English text in any field values.\n'
    + 'If category not visible in images, mark NONE.\n'
    + 'Return ONLY valid JSON.';

  if (txt) txt.textContent = '🧠 Claude בודק ' + (allCats.length + customCats.length) + ' קטגוריות...';
  bar.style.width = '55%';

  try {
    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:3000,
        messages:[{ role:'user', content:[...imageBlocks, { type:'text', text:snagPrompt }] }] }), 'snag-progress-text');
    var data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);

    var raw = data.content && data.content[0] && data.content[0].text;
    raw = raw.replace(/```json|```/g,'').trim();
    var findings = {};
    try { findings = JSON.parse(raw); } catch(e) { throw new Error('תגובת AI לא תקינה'); }

    snagStopMeter(data.usage?.input_tokens, data.usage?.output_tokens);
    bar.style.width = '90%';
    if (txt) txt.textContent = '✅ הסריקה הושלמה — מכין דוח...';

    _snagLastFindings = findings;

    await new Promise(function(r){ setTimeout(r,300); });
    snagRenderReport(findings, allCats, customCats);

    // Save to Supabase
    var projId   = document.getElementById('safety-project-sel')?.value || null;
    var projName = projId ? ((window.allProjects||[]).find(function(p){return p.id===projId;})||{}).project_name : null;
    await snagSaveReport(findings, allCats, customCats, projId, projName);

    bar.style.width = '100%';
    setTimeout(function(){ prog.style.display='none'; if(btn){btn.disabled=false;btn.textContent='🔍 הפעל סריקת ליקויים AI';btn.style.background='linear-gradient(135deg,#1a3d5c,#2d6a9f)';} }, 1500);
    snagLoadHistory();

  } catch(e) {
    if (txt) txt.textContent = '❌ ' + e.message;
    bar.style.background = '#ef4444'; bar.style.width = '100%';
    if (btn) { btn.disabled = false; btn.style.background = 'linear-gradient(135deg,#1a3d5c,#2d6a9f)'; }
    showToast('שגיאה: ' + e.message, 'error');
    snagStopMeter();
  }
}

// ── Timers ─────────────────────────────────────────────────────────────
function snagStartMeter() {
  _snagStartTime = Date.now();
  clearInterval(_snagTimer);
  _snagTimer = setInterval(function() {
    var elapsed = Math.floor((Date.now() - _snagStartTime) / 1000);
    var mins = Math.floor(elapsed/60), secs = elapsed%60;
    var pct  = Math.min(1, elapsed/20);
    var est  = Math.round((_snagFrames.length * 1700 + 1000) * pct);
    var cost = (est * 3 / 1e6) + (800 * 15 / 1e6);
    var c = document.getElementById('snag-clock');
    var t = document.getElementById('snag-tokens');
    var d = document.getElementById('snag-cost');
    if (c) c.textContent = mins + ':' + (secs<10?'0':'') + secs;
    if (t) t.textContent = '~' + est.toLocaleString();
    if (d) d.textContent = '$' + cost.toFixed(3);
  }, 500);
}

function snagStopMeter(inTok, outTok) {
  clearInterval(_snagTimer);
  var elapsed = Math.floor((Date.now() - (_snagStartTime||Date.now())) / 1000);
  var mins = Math.floor(elapsed/60), secs = elapsed%60;
  var iT = inTok || (_snagFrames.length * 1700 + 1000);
  var oT = outTok || 600;
  var cost = (iT * 3 / 1e6) + (oT * 15 / 1e6);
  var c = document.getElementById('snag-clock');
  var t = document.getElementById('snag-tokens');
  var d = document.getElementById('snag-cost');
  if (c) c.textContent = mins + ':' + (secs<10?'0':'') + secs;
  if (t) t.textContent = (iT+oT).toLocaleString();
  if (d) d.textContent = '$' + cost.toFixed(3);
}

// ── Report renderer ────────────────────────────────────────────────────
function snagRenderReport(findings, allCats, customCats, metadata) {
  // Store file_url globally so CAP modal can attach it to WhatsApp as photo evidence
  window._snagLastFileUrl = (metadata && metadata.file_url) ? metadata.file_url : '';
  var results = document.getElementById('snag-results');
  if (!results) return;

  var now      = metadata ? new Date(metadata.created_at) : new Date();
  var dateStr  = now.toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  var projName = metadata?.project_name || document.getElementById('safety-project-sel')?.selectedOptions[0]?.textContent||'';

  // Merge all cats
  var allCatDefs = [...allCats, ...customCats.map(function(name,i){ return {id:'custom_'+i, name_he:name, icon:'📝'}; })];

  var SEV = {
    CRITICAL: { color:'#ef4444', bg:'rgba(239,68,68,0.15)', border:'#ef4444', label:'🔴 קריטי — פעולה מיידית' },
    MODERATE: { color:'#f59e0b', bg:'rgba(245,158,11,0.12)', border:'#f59e0b', label:'🟡 בינוני — לתקן לפני השלב הבא' },
    MINOR:    { color:'#3b82f6', bg:'rgba(59,130,246,0.1)',  border:'#3b82f6', label:'🔵 קל — לתקן לפני מסירה' },
    NONE:     { color:'#22c55e', bg:'rgba(34,197,94,0.08)',  border:'#22c55e', label:'✅ תקין' }
  };

  // Score and sort
  var sevOrder = { CRITICAL:3, MODERATE:2, MINOR:1, NONE:0 };
  var scored = allCatDefs.map(function(cat) {
    var f   = findings[cat.id] || { severity:'NONE', findings:[], remedy:null };
    var sev = SEV[f.severity] || SEV.NONE;
    return { cat, f, sev, level: sevOrder[f.severity]||0 };
  }).sort(function(a,b){ return b.level - a.level; });

  var critCount = scored.filter(function(s){ return s.level===3; }).length;
  var modCount  = scored.filter(function(s){ return s.level===2; }).length;
  var minorCount= scored.filter(function(s){ return s.level===1; }).length;
  var okCount   = scored.filter(function(s){ return s.level===0; }).length;
  var maxLevel  = scored[0]?.level || 0;
  var overallColor = maxLevel>=3?'#ef4444':maxLevel>=2?'#f59e0b':maxLevel>=1?'#3b82f6':'#22c55e';
  var overallLabel = maxLevel>=3?'🔴 ליקויים קריטיים':maxLevel>=2?'🟡 ליקויים משמעותיים':maxLevel>=1?'🔵 ליקויים קלים':'✅ לא נמצאו ליקויים';

  var html = '';

  // Summary banner
  html += '<div style="background:linear-gradient(135deg,' + overallColor + '20,' + overallColor + '08);border:2px solid ' + overallColor + ';border-radius:16px;padding:18px 22px;margin-bottom:20px;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
    + '<div><div style="font-size:18px;font-weight:900;color:' + overallColor + ';">' + overallLabel + '</div>'
    + '<div style="font-size:12px;color:#888;margin-top:4px;">' + dateStr + (projName && projName !== '📁 כל הפרויקטים' ? ' · 📁 ' + projName.replace('📁 ','').trim() : '') + ' · ' + (_snagIsVideo ? _snagFrames.length + ' פריימים' : 'תמונה') + '</div></div>'
    + '<div style="display:flex;gap:14px;text-align:center;">'
    + (critCount  ? '<div><div style="font-size:22px;font-weight:900;color:#ef4444;">' + critCount  + '</div><div style="font-size:10px;color:#888;">קריטי</div></div>' : '')
    + (modCount   ? '<div><div style="font-size:22px;font-weight:900;color:#f59e0b;">' + modCount   + '</div><div style="font-size:10px;color:#888;">בינוני</div></div>' : '')
    + (minorCount ? '<div><div style="font-size:22px;font-weight:900;color:#3b82f6;">' + minorCount + '</div><div style="font-size:10px;color:#888;">קל</div></div>' : '')
    + '<div><div style="font-size:22px;font-weight:900;color:#22c55e;">' + okCount + '</div><div style="font-size:10px;color:#888;">תקין</div></div>'
    + '</div></div></div>';

  // Category cards
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:14px;margin-bottom:20px;">';
  scored.forEach(function(s) {
    if (s.level === 0) {
      html += '<div style="background:' + s.sev.bg + ';border:1px solid ' + s.sev.border + '40;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;">'
        + '<span style="font-size:22px;">' + (s.cat.icon||'🔧') + '</span>'
        + '<div><div style="font-size:13px;font-weight:700;color:#fff;">' + s.cat.name_he + '</div>'
        + '<div style="font-size:11px;color:#22c55e;margin-top:2px;">✅ לא נמצאו ליקויים</div></div></div>';
      return;
    }
    html += '<div style="background:' + s.sev.bg + ';border:2px solid ' + s.sev.border + ';border-radius:14px;padding:16px;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<span style="font-size:26px;">' + (s.cat.icon||'🔧') + '</span>'
      + '<div style="flex:1;"><div style="font-size:14px;font-weight:900;color:#fff;">' + s.cat.name_he + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:' + s.sev.color + ';margin-top:2px;">' + s.sev.label + '</div></div></div>';

    if (s.f.location) {
      html += '<div style="font-size:11px;color:#888;margin-bottom:8px;padding:4px 8px;background:rgba(0,0,0,0.2);border-radius:6px;">📍 ' + s.f.location.replace(/</g,'&lt;') + '</div>';
    }

    if (s.f.findings && s.f.findings.length) {
      html += '<div style="margin-bottom:10px;">';
      s.f.findings.forEach(function(item) {
        html += '<div style="font-size:12px;color:#ccc;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">▸ ' + (item||'').replace(/</g,'&lt;') + '</div>';
      });
      html += '</div>';
    }

    if (s.f.remedy) {
      html += '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;">'
        + '<span style="color:' + s.sev.color + ';font-weight:700;">🔧 תיקון: </span>'
        + '<span style="color:#ccc;">' + s.f.remedy.replace(/</g,'&lt;') + '</span></div>';
    }

    if (s.f.responsible_trade) {
      html += '<div style="font-size:11px;color:#888;">👷 אחראי: ' + s.f.responsible_trade.replace(/</g,'&lt;') + '</div>';
    }

    if (s.f.frame_ref && _snagIsVideo) {
      html += '<div style="font-size:10px;color:#555;margin-top:4px;">📹 פריים ' + s.f.frame_ref + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  // ── Action bar ────────────────────────────────────────────────────
  var projSel   = document.getElementById('safety-project-sel');
  var projOpts  = projSel ? projSel.innerHTML : '<option value="">📁 כל הפרויקטים</option>';
  var projCurr  = projSel ? projSel.value : '';

  html += '<div id="snag-action-bar" style="background:#242438;border-radius:14px;padding:16px;margin-top:16px;border:1px solid rgba(255,255,255,0.08);">'
    + '<div style="font-size:11px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">פעולות לדוח</div>'
    // Project selector
    + '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">'
    + '<div style="font-size:12px;color:#888;white-space:nowrap;">📁 קשר לפרויקט:</div>'
    + '<select id="snag-action-project" onchange="snagUpdateReportProject(this.value)" style="flex:1;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);color:#fff;padding:7px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">'
    + projOpts
    + '</select>'
    + '</div>'
    // Checkboxes
    + '<div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;">'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="snag-cb-critical" checked style="accent-color:#ef4444;"> 🔴 קריטי</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="snag-cb-moderate" checked style="accent-color:#f59e0b;"> 🟡 בינוני</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="snag-cb-minor" checked style="accent-color:#3b82f6;"> 🔵 קל</label>'
    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#ccc;font-family:Heebo,sans-serif;"><input type="checkbox" id="snag-cb-ok"> ✅ תקין</label>'
    + '</div>'
    // Action buttons
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button onclick="snagExportWhatsApp()" style="flex:1;min-width:120px;background:rgba(37,211,102,0.15);border:1.5px solid rgba(37,211,102,0.4);color:#25d366;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">💬 WhatsApp</button>'
    + '<button onclick="snagPrintReport()" style="flex:1;min-width:120px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#ccc;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">🖨️ הדפס</button>'
    + '<button onclick="snagEmailReport()" style="flex:1;min-width:120px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">📧 מייל</button>'
    + '<button onclick="capOpenModal()" style="flex:2;min-width:160px;background:linear-gradient(135deg,#7c3aed,#2d6a9f);border:none;color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;">🔧 צור תוכנית תיקון (CAP)</button>'
    + '<button onclick="switchTab(\'crm\');showPage(\'dashboard\')" style="flex:1;min-width:120px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">🏠 לוח בקרה</button>'
    + '</div>'
    + '</div>';

  // ── Wrap with checkbox + thumbnail for print selection ─────────────
  results.innerHTML = '';
  var snagWrap = document.createElement('div');
  snagWrap.className = 'snag-single-result-wrap';
  snagWrap.style.cssText = 'border:1.5px solid rgba(255,255,255,0.08);border-radius:16px;';

  // Card header with checkbox + thumbnail
  var snagHdr = document.createElement('div');
  snagHdr.style.cssText = 'background:#242438;padding:10px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);';

  var snagSelCb = document.createElement('input');
  snagSelCb.type = 'checkbox'; snagSelCb.checked = true;
  snagSelCb.className = 'report-card-cb';
  snagSelCb.style.cssText = 'accent-color:#3b82f6;width:16px;height:16px;cursor:pointer;flex-shrink:0;';
  snagSelCb.title = 'בחר דוח להדפסה';
  snagSelCb.onchange = (function(w){ return function(){
    w.style.opacity = this.checked ? '1' : '0.45';
    w.style.borderColor = this.checked ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
  }; })(snagWrap);
  snagHdr.appendChild(snagSelCb);

  // Thumbnail canvas
  if (_snagFrames && _snagFrames.length > 0 && _snagMediaType !== 'application/pdf' && _snagMediaType !== 'text/html') {
    var snagThumbC = document.createElement('canvas');
    snagThumbC.width = 40; snagThumbC.height = 40;
    snagThumbC.className = 'report-thumb-canvas';
    snagThumbC.style.cssText = 'width:40px;height:40px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;vertical-align:middle;';
    snagThumbC.dataset.b64 = _snagFrames[0];
    (function(cv, b64){
      var tImg = new Image();
      tImg.onload = function(){ var cx = cv.getContext('2d'); if(cx) cx.drawImage(tImg,0,0,40,40); };
      tImg.src = 'data:image/jpeg;base64,' + b64;
    })(snagThumbC, _snagFrames[0]);
    snagHdr.appendChild(snagThumbC);
  }

  var snagHdrLabel = document.createElement('span');
  snagHdrLabel.style.cssText = 'font-size:12px;font-weight:700;color:#93c5fd;';
  snagHdrLabel.textContent = '🔍 דוח ליקויים — בחר להדפסה';
  snagHdr.appendChild(snagHdrLabel);
  snagWrap.appendChild(snagHdr);

  // Content
  var snagContent = document.createElement('div');
  snagContent.style.cssText = 'padding:16px;';
  snagContent.innerHTML = html;
  snagWrap.appendChild(snagContent);
  results.appendChild(snagWrap);

  // Set project selector to current value
  var ap = document.getElementById('snag-action-project');
  if (ap && projCurr) ap.value = projCurr;
}

// ── WhatsApp export ────────────────────────────────────────────────────
function snagExportWhatsApp() {
  var findings = _snagLastFindings;
  if (!findings) return;
  var projName = document.getElementById('safety-project-sel')?.selectedOptions[0]?.textContent||'';
  var now = new Date().toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  var msg = '🔍 *דוח ליקויים — ' + now + '*\n';
  if (projName && projName !== '📁 כל הפרויקטים') msg += '📁 ' + projName.replace('📁 ','').trim() + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
  // Note about photo — WA text-only, remind user to attach manually
  var sevOrder = { CRITICAL:3, MODERATE:2, MINOR:1, NONE:0 };
  var allCatDefs = SNAG_CATEGORIES;
  var issues = allCatDefs.filter(function(c){ return findings[c.id] && (findings[c.id].severity||'NONE') !== 'NONE'; })
    .sort(function(a,b){ return (sevOrder[(findings[b.id]||{}).severity]||0) - (sevOrder[(findings[a.id]||{}).severity]||0) });

  if (!issues.length) { msg += '✅ לא נמצאו ליקויים משמעותיים\n'; }
  else {
    issues.forEach(function(cat) {
      var f = findings[cat.id] || {};
      var emoji = f.severity==='CRITICAL'?'🔴':f.severity==='MODERATE'?'🟡':'🔵';
      msg += emoji + ' *' + cat.name_he + '*\n';
      (f.findings||[]).forEach(function(item){ msg += '  ▸ ' + item + '\n'; });
      if (f.remedy) msg += '  🔧 ' + f.remedy + '\n';
      if (f.responsible_trade) msg += '  👷 ' + f.responsible_trade + '\n';
      msg += '\n';
    });
  }

  var a=document.createElement('a');a.href='https://wa.me/?text='+encodeURIComponent(msg);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}

// ── Save to Supabase ───────────────────────────────────────────────────
async function snagSaveReport(findings, allCats, customCats, projId, projName) {
  try {
    var maxSev = 'NONE';
    var sevOrder = { CRITICAL:3, MODERATE:2, MINOR:1, NONE:0 };
    Object.values(findings).forEach(function(f) {
      if ((sevOrder[f.severity]||0) > (sevOrder[maxSev]||0)) maxSev = f.severity;
    });
    await fetch(SB_URL + '/rest/v1/snag_reports', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        project_id:    projId || null,
        project_name:  projName || null,
        findings:      findings,
        categories_scanned: [...allCats.map(function(c){return c.id;}), ...customCats.map(function(_,i){return 'custom_'+i;})],
        custom_categories: customCats,
        max_severity:  maxSev,
        frame_count:   _snagFrames.length,
        is_video:      _snagIsVideo,
        created_at:    new Date().toISOString()
      })
    });
  } catch(e) { console.error('Snag save:', e); }
}

// ── History ─────────────────────────────────────────────────────────────
async function snagLoadHistory() {
  var list = document.getElementById('snag-history-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:12px;color:#555;font-size:12px;">טוען...</div>';
  try {
    var res   = await sbQ('snag_reports','select=id,project_name,project_id,max_severity,frame_count,is_video,created_at,file_url&order=created_at.desc&limit=50');
    var items = res.data || [];
    if (!items.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#444;font-size:13px;">אין סריקות עדיין — העלה תמונה ולחץ ניתוח</div>';
      return;
    }
    var SE = {CRITICAL:'🔴',MODERATE:'🟡',MINOR:'🔵',NONE:'✅'};
    var SC = {CRITICAL:'#ef4444',MODERATE:'#f59e0b',MINOR:'#3b82f6',NONE:'#22c55e'};
    var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    items.forEach(function(item, idx) {
      var num     = String(idx + 1).padStart(2, '0');
      var date    = new Date(item.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      var sev     = item.max_severity || 'NONE';
      var col     = SC[sev] || '#22c55e';
      var fileUrl = item.file_url || '';
      var cardTitle = (item.project_name||'ניתוח ליקויים') + ' · ' + date;

      html +=
        '<div id="snag-card-' + item.id + '" style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-right:4px solid ' + col + ';border-radius:12px;padding:12px 14px;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
            '<span style="font-size:10px;font-weight:800;background:rgba(255,255,255,0.07);color:#666;border-radius:6px;padding:2px 7px;flex-shrink:0;">#' + num + '</span>' +
            '<span style="font-size:20px;flex-shrink:0;">' + (SE[sev]||'✅') + '</span>' +
            '<div style="flex:1;min-width:0;cursor:pointer;" onclick="snagShowHistoryItem(' + item.id + ')">' +
              '<div style="font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.project_name||'ללא פרויקט') + '</div>' +
              '<div style="font-size:10px;color:#555;margin-top:2px;">📅 ' + date + ' · ' + (item.is_video ? item.frame_count + ' פריימים' : 'תמונה') + '</div>' +
            '</div>' +
            '<button onclick="snagDeleteReport(' + item.id + ')" title="מחק" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:6px;padding:3px 7px;font-size:11px;cursor:pointer;flex-shrink:0;">🗑️</button>' +
          '</div>' +
          '<div style="margin-bottom:8px;">' +
            '<select onchange="snagLinkProjectFromHistory(' + item.id + ',this.value)" style="width:100%;padding:6px 10px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#ccc;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;direction:rtl;">' +
              '<option value="">📁 ' + (item.project_name ? item.project_name : 'קשר לפרויקט...') + '</option>' +
            '</select>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">' +
            (fileUrl ? '<a href="' + fileUrl + '" target="_blank" rel="noopener" style="padding:4px 10px;background:#1a3d5c;color:white;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">👁️ צפה</a>' : '') +
            (fileUrl ? '<a href="' + fileUrl + '" target="_blank" style="padding:4px 10px;background:#374151;color:white;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">🖨️ הדפס</a>' : '') +
            (fileUrl ? '<a href="mailto:?subject=' + encodeURIComponent('ניתוח ליקויים #' + num + ': ' + cardTitle) + '&body=' + encodeURIComponent(cardTitle + '\n\n' + fileUrl) + '" style="padding:4px 10px;background:#1e3a5f;color:#93c5fd;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">📧 מייל</a>' : '') +
            (fileUrl ? '<a href="https://wa.me/?text=' + encodeURIComponent('🔍 ניתוח ליקויים #' + num + '\n' + cardTitle + '\n' + fileUrl) + '" target="_blank" style="padding:4px 10px;background:#15803d;color:white;border-radius:6px;font-size:10px;font-weight:700;text-decoration:none;">💬 וואטסאפ</a>' : '') +
            '<button onclick="snagShowHistoryItem(' + item.id + ')" style="padding:4px 10px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">📋 פתח דוח</button>' +
            '<button onclick="snagOpenCAPFromHistory(' + item.id + ')" style="padding:4px 10px;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(45,106,159,0.3));border:1px solid rgba(124,58,237,0.5);color:#c4b5fd;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🔧 CAP</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    list.innerHTML = html;
    safetyFillProjectOptions('snag');
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:12px;font-size:12px;">שגיאה: ' + e.message + '</div>';
  }
}

async function snagDeleteReport(id) {
  if (!confirm('מחק סריקה זו לצמיתות?')) return;
  try {
    await fetch(SB_URL + '/rest/v1/snag_reports?id=eq.' + id, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' }
    });
    var card = document.getElementById('snag-card-' + id);
    if (card) { card.style.opacity = '0'; card.style.transition = 'opacity 0.3s'; setTimeout(function(){ card.remove(); }, 300); }
    if (typeof showToast === 'function') showToast('🗑️ סריקה נמחקה');
  } catch(e) { if (typeof showToast === 'function') showToast('שגיאה: ' + e.message, 'error'); }
}

async function snagLinkProjectFromHistory(reportId, projectId) {
  if (!projectId) return;
  var proj = (window.allProjects||[]).find(function(p){ return p.id === projectId; });
  try {
    await fetch(SB_URL + '/rest/v1/snag_reports?id=eq.' + reportId, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ project_id: projectId, project_name: proj ? proj.project_name : '' })
    });
    if (typeof showToast === 'function') showToast('✅ קושר לפרויקט: ' + (proj ? proj.project_name : ''));
  } catch(e) { if (typeof showToast === 'function') showToast('שגיאה: ' + e.message, 'error'); }
}

async function snagOpenCAPFromHistory(id) {
  // Load the full report, set globals, then open CAP modal
  var res = await sbQ('snag_reports','select=*&id=eq.' + id);
  var item = res.data && res.data[0];
  if (!item) { if (typeof showToast==='function') showToast('לא נמצא דוח','error'); return; }
  var findings = typeof item.findings==='string' ? JSON.parse(item.findings) : item.findings;
  _snagLastFindings = findings;
  window._snagLastFileUrl = item.file_url || '';
  // Set project context
  if (item.project_id) {
    var projSel = document.getElementById('safety-project-sel');
    if (projSel) projSel.value = item.project_id;
  }
  // Load categories needed by CAP
  await snagLoadCategories();
  // Set scanned frames to empty (base64 not stored — use file_url instead)
  _snagFrames = [];
  capOpenModal();
}

async function snagShowHistoryItem(id) {
  var res = await sbQ('snag_reports','select=*&id=eq.' + id);
  var item = res.data && res.data[0];
  if (!item) return;
  var findings = typeof item.findings==='string' ? JSON.parse(item.findings) : item.findings;
  var cats = (item.categories_scanned||[]).map(function(id) {
    return SNAG_CATEGORIES.find(function(c){ return c.id===id; }) || {id:id, name_he:id, icon:'🔧'};
  });
  var customs = item.custom_categories || [];
  _snagFrames = new Array(item.frame_count||1).fill('');
  _snagIsVideo = item.is_video;
  _snagLastFindings = findings;
  snagRenderReport(findings, cats, customs, item);
  window.scrollTo(0, document.getElementById('snag-results').offsetTop - 80);
}


// ══════════════════════════════════════════════════════════════════════
// CAP — CORRECTION ACTION PLAN ENGINE
// ══════════════════════════════════════════════════════════════════════

var _capItems        = [];   // array of {catId, catName, icon, severity, findings, location, remedy, responsible_trade}
var _capContractors  = [];   // contractors_master list
var _capProjectId    = null;
var _capProjectName  = '';
var _capFileUrl      = '';   // Cloudinary URL of scanned asset — sent as evidence in WhatsApp

// Deadline days per severity
var CAP_DEADLINES = { CRITICAL: 1, MODERATE: 7, MINOR: 30 };

// Israeli standards mapping per snag category
var CAP_STANDARDS = {
  concrete_cracks:   'ת"י 118 — בטון מזוין / תקנות הבנייה (קורות ועמודים)',
  rusted_iron:       'ת"י 118 חלק 1 — כיסוי בטון על ברזל מינימלי',
  painting:          'ת"י 1939 — צביעת בניינים / מפרט בינ"ל 02900',
  plaster_render:    'ת"י 1125 — טיח פנים וחוץ',
  waterproofing:     'ת"י 1364 — איטום מבנים / ת"י 1434',
  tiling:            'ת"י 1555 — ריצוף קרמיקה',
  doors_windows:     'ת"י 1099 — חלונות ודלתות אלומיניום',
  excavation_found:  'ת"י 940 — יסודות ועבודות עפר',
  foundation_iron:   'ת"י 118 + ת"י 466 — ברזל בנייה',
  aluminum_curtain:  'ת"י 1099 + ת"י 1591 — חזיתות אלומיניום',
  metal_framing:     'ת"י 1505 — קירות גבס ופרופילים קלים',
  ac_ducts:          'ת"י 5381 — מיזוג אוויר בבניינים',
  electrical_ducts:  'תקנות החשמל 1954 / ת"י 61439',
  plumbing_pipes:    'ת"י 1205 — אינסטלציה סניטרית',
  floor_levels:      'ת"י 1555 + מפרט טכני כללי — סטיות מותרות',
  structural_alignment: 'ת"י 466 — דרישות ביצוע בטון מזוין',
  roof_terrace:      'ת"י 1364 — איטום גגות',
  finishes_general:  'מפרט בינ"ל — גימורי בנייה',
  fire_protection:   'ת"י 1220 — מערכות כיבוי אש / חוק הבנייה',
  mamad_snag:        'תקנות ההתגוננות האזרחית (מפרטים לבניית מקלטים) תש"ן-1990 · ת"י 4577 (אטימות) · ת"י 4570 (מנת"ר) · ת"י 118+466 (בטון)',
  mamad_safety:      'תקנות ההתגוננות האזרחית תש"ן-1990 · פיקוד העורף · ת"י 4577 · ת"י 4570'
};

// ── Open modal ─────────────────────────────────────────────────────────
function safetyOpenCAP() {
  var findings = _safetyLastFindings;
  if (!findings || !Object.keys(findings).length) {
    showToast('הפעל ניתוח בטיחות תחילה', 'error');
    return;
  }
  // Convert safety findings format to snag findings format for CAP modal
  // Safety: { id: { severity, found, action } }
  // Snag:   { id: { severity, findings[], remedy } }
  var snagFormatFindings = {};
  SAFETY_CATEGORIES.forEach(function(cat) {
    var f = findings[cat.id];
    if (!f || f.severity === 'OK') return;
    snagFormatFindings[cat.id] = {
      severity:  f.severity,
      findings:  f.found || [],
      remedy:    f.action || '',
      location:  '',
      responsible_trade: ''
    };
  });
  // Temporarily set snag findings and categories for CAP modal
  _snagLastFindings = snagFormatFindings;
  // Add safety categories to SNAG_CATEGORIES temporarily if not present
  var origSnagCats = SNAG_CATEGORIES;
  var safetyCapsNeeded = SAFETY_CATEGORIES.filter(function(sc) {
    return snagFormatFindings[sc.id];
  }).map(function(sc) {
    return { id: sc.id, icon: sc.icon, name_he: sc.name };
  });
  // Merge: keep existing snag cats, add safety ones not already present
  var merged = origSnagCats.slice();
  safetyCapsNeeded.forEach(function(sc) {
    if (!merged.find(function(c){ return c.id === sc.id; })) merged.push(sc);
  });
  SNAG_CATEGORIES = merged;
  capOpenModal().then(function(){
    // Restore after modal opens
  }).catch(function(){});
}

async function capOpenModal() {
  var findings = _snagLastFindings;
  if (!findings || !Object.keys(findings).length) {
    showToast('הפעל סריקת ליקויים תחילה', 'error');
    return;
  }

  document.getElementById('cap-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';

  // Set project label
  var projSel = document.getElementById('safety-project-sel');
  _capProjectId   = projSel?.value || null;
  _capProjectName = projSel?.selectedOptions[0]?.textContent?.replace('📁 ','').trim() || '';
  var projLabel = document.getElementById('cap-project-label');
  if (projLabel) projLabel.textContent = _capProjectName ? '📁 ' + _capProjectName : '';
  // Carry file_url from the last snag report (set by snagRenderReport)
  _capFileUrl = (typeof _snagLastFileUrl !== 'undefined' && _snagLastFileUrl) ? _snagLastFileUrl : '';

  // Show scanned photo in CAP header
  var capPhotoDiv = document.getElementById('cap-photo-wrap');
  if (!capPhotoDiv) {
    capPhotoDiv = document.createElement('div');
    capPhotoDiv.id = 'cap-photo-wrap';
    capPhotoDiv.style.cssText = 'padding:12px 24px;background:#1a1a2e;border-bottom:1px solid rgba(255,255,255,0.06);';
    var capItemsList = document.getElementById('cap-items-list');
    if (capItemsList && capItemsList.parentNode) {
      capItemsList.parentNode.insertBefore(capPhotoDiv, capItemsList);
    }
  }
  if (_snagFrames && _snagFrames.length && _snagFrames[0]) {
    capPhotoDiv.innerHTML = '<div style="font-size:11px;color:#666;margin-bottom:6px;">📸 תמונה שנסרקה:</div>'
      + '<img src="data:image/jpeg;base64,' + _snagFrames[0] + '" style="max-width:100%;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">';
    capPhotoDiv.style.display = 'block';
  } else {
    capPhotoDiv.style.display = 'none';
  }

  // Build items from findings — only non-NONE
  var sevOrder = { CRITICAL:3, MODERATE:2, MINOR:1, NONE:0 };
  var allCatDefs = [...SNAG_CATEGORIES];
  _capItems = allCatDefs
    .filter(function(cat) {
      var f = findings[cat.id];
      return f && f.severity && f.severity !== 'NONE';
    })
    .map(function(cat) {
      var f = findings[cat.id];
      return {
        catId:      cat.id,
        catName:    cat.name_he,
        icon:       cat.icon || '🔧',
        severity:   f.severity,
        findings:   f.findings || [],
        location:   f.location || '',
        remedy:     f.remedy || '',
        responsible_trade: f.responsible_trade || '',
        // CAP fields — to be filled
        instruction:    '',   // AI-generated technical instruction
        standard:       CAP_STANDARDS[cat.id] || '',
        contractor_id:  '',
        contractor_name:'',
        contractor_mobile:'',
        deadline:       capCalcDeadline(f.severity),
        cost_min:       '',
        cost_max:       '',
        status:         'open'  // open / in_progress / fixed / closed
      };
    })
    .sort(function(a,b){ return (sevOrder[b.severity]||0) - (sevOrder[a.severity]||0); });

  if (!_capItems.length) {
    document.getElementById('cap-items-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:#22c55e;font-size:15px;font-weight:700;">✅ לא נמצאו ליקויים הדורשים תיקון</div>';
    return;
  }

  // Load contractors
  await capLoadContractors();

  // Render items
  capRenderItems();
}

function capCloseModal() {
  document.getElementById('cap-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function capCalcDeadline(severity) {
  var days = CAP_DEADLINES[severity] || 7;
  var d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Load contractors ────────────────────────────────────────────────────
async function capLoadContractors() {
  if (_capContractors.length > 0) return;
  try {
    var res  = await fetch(
      SB_URL + '/rest/v1/contractors_master?is_active=eq.true&select=id,company_name,contact_name,mobile,main_occupation&order=company_name',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    _capContractors = res.ok ? await res.json() : [];
  } catch(e) { _capContractors = []; }
}

// ── Render all CAP items ────────────────────────────────────────────────
function capRenderItems() {
  var list = document.getElementById('cap-items-list');
  if (!list) return;

  var SEV_COLOR  = { CRITICAL:'#ef4444', MODERATE:'#f59e0b', MINOR:'#3b82f6' };
  var SEV_BG     = { CRITICAL:'rgba(239,68,68,0.08)', MODERATE:'rgba(245,158,11,0.06)', MINOR:'rgba(59,130,246,0.06)' };
  var SEV_LABEL  = { CRITICAL:'🔴 קריטי', MODERATE:'🟡 בינוני', MINOR:'🔵 קל' };
  var SEV_DAYS   = { CRITICAL:'24 שעות', MODERATE:'7 ימים', MINOR:'30 ימים' };

  // Build contractor options HTML
  var contractorOptions = '<option value="">— בחר קבלן —</option>'
    + _capContractors.map(function(c) {
        return '<option value="' + c.id + '" data-name="' + (c.company_name||'').replace(/"/g,'') + '" data-mobile="' + (c.mobile||'') + '">'
          + (c.company_name||'') + (c.main_occupation ? ' · ' + c.main_occupation : '')
          + '</option>';
      }).join('');

  list.innerHTML = _capItems.map(function(item, idx) {
    var sevColor = SEV_COLOR[item.severity] || '#888';
    var sevBg    = SEV_BG[item.severity]    || 'transparent';
    var sevLabel = SEV_LABEL[item.severity] || item.severity;
    var sevDays  = SEV_DAYS[item.severity]  || '7 ימים';

    return '<div id="cap-item-' + idx + '" style="background:' + sevBg + ';border:1.5px solid ' + sevColor + '40;border-right:4px solid ' + sevColor + ';border-radius:14px;padding:18px;font-family:Heebo,sans-serif;">'

      // ── Item header ──────────────────────────────────────────────────
      + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<span style="font-size:28px;">' + item.icon + '</span>'
      + '<div style="flex:1;">'
      + '<div style="font-size:15px;font-weight:900;color:#fff;">' + item.catName + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:' + sevColor + ';margin-top:3px;">' + sevLabel + ' — דדליין: ' + sevDays + '</div>'
      + (item.location ? '<div style="font-size:11px;color:#888;margin-top:4px;">📍 ' + item.location.replace(/</g,'&lt;') + '</div>' : '')
      + '</div>'
      // Status badge
      + '<select onchange="capUpdateStatus(' + idx + ',this.value)" style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);color:#ccc;padding:6px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;">'
      + '<option value="open" ' + (item.status==='open'?'selected':'') + '>🔴 פתוח</option>'
      + '<option value="in_progress" ' + (item.status==='in_progress'?'selected':'') + '>🟡 בטיפול</option>'
      + '<option value="fixed" ' + (item.status==='fixed'?'selected':'') + '>🟢 תוקן</option>'
      + '<option value="closed" ' + (item.status==='closed'?'selected':'') + '>✅ סגור</option>'
      + '</select>'
      + '</div>'

      // ── Findings summary ─────────────────────────────────────────────
      + '<div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:10px 12px;margin-bottom:12px;">'
      + item.findings.map(function(f){ return '<div style="font-size:12px;color:#ccc;padding:2px 0;">▸ ' + f.replace(/</g,'&lt;') + '</div>'; }).join('')
      + '</div>'

      // ── Technical instruction (AI-generated or editable) ─────────────
      + '<div style="margin-bottom:12px;">'
      + '<div style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">🔧 הוראת תיקון טכנית:</div>'
      + '<div style="position:relative;">'
      + '<textarea id="cap-instruction-' + idx + '" rows="3" oninput="_capItems[' + idx + '].instruction=this.value"'
      + ' style="width:100%;background:#1a1a2e;border:1px solid rgba(139,92,246,0.3);color:#fff;padding:10px 80px 10px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;resize:vertical;direction:rtl;outline:none;line-height:1.6;box-sizing:border-box;"'
      + ' placeholder="לחץ \'צור הוראות AI\' לייצור אוטומטי, או הקלד ידנית...">'
      + (item.instruction || '') + '</textarea>'
      + '<button onclick="capGenerateOne(' + idx + ')" title="צור עם AI" style="position:absolute;top:8px;left:8px;background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);color:#c4b5fd;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;font-family:Heebo,sans-serif;">🧠 AI</button>'
      + '</div></div>'

      // ── Israeli standard ─────────────────────────────────────────────
      + '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      + '<div style="font-size:11px;font-weight:800;color:#9a6f00;white-space:nowrap;">📋 תקן ישראלי:</div>'
      + '<input id="cap-standard-' + idx + '" value="' + item.standard.replace(/"/g,'&quot;') + '" oninput="_capItems[' + idx + '].standard=this.value"'
      + ' style="flex:1;background:#1a1a2e;border:1px solid rgba(154,111,0,0.3);color:#c9a84c;padding:6px 10px;border-radius:6px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;outline:none;min-width:120px;">'
      + '</div>'

      // ── Contractor assignment + deadline + cost ───────────────────────
      + '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">'
      // Contractor picker
      + '<div style="flex:2;min-width:180px;">'
      + '<div style="font-size:10px;font-weight:800;color:#666;text-transform:uppercase;margin-bottom:4px;">👷 קבלן אחראי</div>'
      + '<select id="cap-contractor-' + idx + '" onchange="capAssignContractor(' + idx + ',this)"'
      + ' style="width:100%;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#fff;padding:8px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">'
      + contractorOptions.replace(
          'value="' + item.contractor_id + '"',
          'value="' + item.contractor_id + '" selected'
        )
      + '</select></div>'
      // Deadline
      + '<div style="flex:1;min-width:140px;">'
      + '<div style="font-size:10px;font-weight:800;color:#666;text-transform:uppercase;margin-bottom:4px;">📅 דדליין</div>'
      + '<input type="date" id="cap-deadline-' + idx + '" value="' + item.deadline + '" oninput="_capItems[' + idx + '].deadline=this.value"'
      + ' style="width:100%;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#fff;padding:8px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;box-sizing:border-box;">'
      + '</div>'
      // Cost estimate
      + '<div style="flex:1;min-width:140px;">'
      + '<div style="font-size:10px;font-weight:800;color:#666;text-transform:uppercase;margin-bottom:4px;">💰 עלות משוערת (₪)</div>'
      + '<input placeholder="מ... עד..." id="cap-cost-' + idx + '" oninput="_capItems[' + idx + '].cost_min=this.value"'
      + ' style="width:100%;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#fff;padding:8px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;outline:none;box-sizing:border-box;">'
      + '</div>'
      + '</div>'

      // ── Send to contractor button ─────────────────────────────────────
      + '<div style="display:flex;gap:8px;margin-top:4px;">'
      + '<button onclick="capSendItemWA(' + idx + ')" style="flex:1;background:rgba(37,211,102,0.15);border:1.5px solid rgba(37,211,102,0.4);color:#25d366;padding:9px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">💬 שלח לקבלן ב-WhatsApp</button>'
      + '<button onclick="capMarkFixed(' + idx + ')" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e;padding:9px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">✅ סמן כתוקן</button>'
      + '</div>'

      + '</div>';
  }).join('');
}

// ── Assign contractor ───────────────────────────────────────────────────
function capAssignContractor(idx, sel) {
  var opt = sel.selectedOptions[0];
  if (!opt || !opt.value) return;
  _capItems[idx].contractor_id     = opt.value;
  _capItems[idx].contractor_name   = opt.dataset.name || opt.textContent.split(' · ')[0];
  _capItems[idx].contractor_mobile = opt.dataset.mobile || '';
}

function capUpdateStatus(idx, status) {
  _capItems[idx].status = status;
}

function capMarkFixed(idx) {
  _capItems[idx].status = 'fixed';
  var sel = document.querySelector('#cap-item-' + idx + ' select');
  if (sel) sel.value = 'fixed';
  showToast('✅ ' + _capItems[idx].catName + ' — סומן כתוקן');
}

// ── Generate AI instructions for ONE item ──────────────────────────────
async function capGenerateOne(idx) {
  var item   = _capItems[idx];
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('הגדר מפתח API תחילה', 'error'); return; }

  var ta = document.getElementById('cap-instruction-' + idx);
  if (ta) ta.value = '🧠 מייצר הוראת תיקון...';

  var prompt = 'אתה מהנדס בנייה מנוסה המנסח הוראות תיקון טכניות לאתרי בנייה בישראל.\n\n'
    + 'ליקוי שזוהה: ' + item.catName + '\n'
    + 'חומרה: ' + item.severity + '\n'
    + 'ממצאים: ' + item.findings.join(', ') + '\n'
    + (item.location ? 'מיקום: ' + item.location + '\n' : '')
    + (item.standard ? 'תקן רלוונטי: ' + item.standard + '\n' : '')
    + '\nכתוב הוראת תיקון טכנית בעברית הכוללת:\n'
    + '1. תיאור התיקון הנדרש בדיוק\n'
    + '2. חומרים/שיטות עבודה נדרשות\n'
    + '3. בדיקה שיש לבצע לאחר התיקון\n'
    + '4. הפניה לתקן ישראלי רלוונטי\n\n'
    + 'כתוב 3-4 משפטים טכניים וברורים בעברית בלבד. ללא כותרות, ללא מספור.';

  try {
    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:300, messages:[{role:'user',content:prompt}] }), null);
    var data = await res.json();
    var text = data.content && data.content[0] && data.content[0].text;
    if (text) {
      _capItems[idx].instruction = text.trim();
      if (ta) ta.value = text.trim();
    }
  } catch(e) {
    if (ta) ta.value = 'שגיאה: ' + e.message;
  }
}

// ── Generate AI instructions for ALL items ─────────────────────────────
async function capGenerateAll() {
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('הגדר מפתח API תחילה', 'error'); return; }

  var btn = document.getElementById('cap-generate-btn');
  var status = document.getElementById('cap-generate-status');
  if (btn) btn.disabled = true;

  for (var i = 0; i < _capItems.length; i++) {
    if (status) status.textContent = 'מייצר ' + (i+1) + '/' + _capItems.length + '...';
    await capGenerateOne(i);
    await new Promise(function(r){ setTimeout(r, 400); }); // avoid rate limit
  }

  if (btn) btn.disabled = false;
  if (status) status.textContent = '✅ הוראות תיקון נוצרו לכל הליקויים';
  showToast('✅ כל הוראות התיקון נוצרו');
}

// ── Send single item WhatsApp ───────────────────────────────────────────
function capSendItemWA(idx) {
  var item     = _capItems[idx];
  var projName = _capProjectName || '';
  var deadline = item.deadline ? new Date(item.deadline + 'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

  var SEV_LABEL = { CRITICAL:'🔴 קריטי', MODERATE:'🟡 בינוני', MINOR:'🔵 קל' };
  var sevLabel  = SEV_LABEL[item.severity] || item.severity;

  var msg = '🔧 *הוראת תיקון רשמית*\n';
  if (projName) msg += '📁 פרויקט: ' + projName + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += sevLabel + ' | *' + item.catName + '*\n';
  if (item.location) msg += '📍 מיקום: ' + item.location + '\n';
  msg += '\n*ממצאים:*\n';
  item.findings.forEach(function(f){ msg += '▸ ' + f + '\n'; });
  if (item.instruction) msg += '\n*הוראת תיקון:*\n' + item.instruction + '\n';
  if (item.standard) msg += '\n📋 תקן: ' + item.standard + '\n';
  if (deadline) msg += '\n⏰ *דדליין לתיקון: ' + deadline + '*\n';
  if (item.cost_min) msg += '💰 עלות משוערת: ' + item.cost_min + '\n';
  if (_capFileUrl) msg += '\n📸 תמונת ממצא: ' + _capFileUrl + '\n';
  msg += '\n━━━━━━━━━━━━━━━━━━━━\n';
  msg += 'נא לאשר קבלת הוראה זו ולעדכן על מועד ביצוע.';

  // Send to specific contractor if assigned, else open picker
  var url;
  if (item.contractor_mobile) {
    var phone = '972' + item.contractor_mobile.replace(/[^0-9]/g,'').replace(/^0/,'');
    url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
  } else {
    url = 'https://wa.me/?text=' + encodeURIComponent(msg);
  }

  var a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Send ALL items grouped by contractor ───────────────────────────────
function capDispatchAll() {
  // Group items by contractor
  var byContractor = {};
  _capItems.forEach(function(item) {
    var key  = item.contractor_id || '_unassigned';
    var name = item.contractor_name || 'לא שויך';
    var mob  = item.contractor_mobile || '';
    if (!byContractor[key]) byContractor[key] = { name, mobile: mob, items: [] };
    byContractor[key].items.push(item);
  });

  var projName = _capProjectName || '';
  var keys     = Object.keys(byContractor);

  if (keys.length === 0) { showToast('אין ליקויים לשליחה', 'error'); return; }

  // Open one WA per contractor with slight delay
  keys.forEach(function(key, i) {
    setTimeout(function() {
      var group    = byContractor[key];
      var SEV_LABEL= { CRITICAL:'🔴 קריטי', MODERATE:'🟡 בינוני', MINOR:'🔵 קל' };
      var now      = new Date().toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});

      var msg = '🔧 *תוכנית תיקון ליקויים — ' + now + '*\n';
      if (projName) msg += '📁 פרויקט: ' + projName + '\n';
      if (group.name !== 'לא שויך') msg += '👷 לידי: ' + group.name + '\n';
      msg += '━━━━━━━━━━━━━━━━━━━━\n\n';

      group.items.forEach(function(item, j) {
        var sevLabel = SEV_LABEL[item.severity] || item.severity;
        var deadline = item.deadline ? new Date(item.deadline + 'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
        msg += (j+1) + '. ' + sevLabel + ' | *' + item.catName + '*\n';
        if (item.location) msg += '   📍 ' + item.location + '\n';
        item.findings.forEach(function(f){ msg += '   ▸ ' + f + '\n'; });
        if (item.instruction) msg += '   🔧 ' + item.instruction.substring(0,120) + (item.instruction.length>120?'...':'') + '\n';
        if (item.standard) msg += '   📋 ' + item.standard + '\n';
        if (deadline) msg += '   ⏰ דדליין: ' + deadline + '\n';
        msg += '\n';
      });

      msg += '━━━━━━━━━━━━━━━━━━━━\nנא לאשר קבלה ולעדכן מועד ביצוע.';

      var url;
      if (group.mobile) {
        var phone = '972' + group.mobile.replace(/[^0-9]/g,'').replace(/^0/,'');
        url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
      } else {
        url = 'https://wa.me/?text=' + encodeURIComponent(msg);
      }

      var a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }, i * 1200); // 1.2s apart so browser doesn't block popups
  });

  showToast('💬 שולח ל-' + keys.length + ' קבלנים...');
}

// ── Save CAP to Supabase ───────────────────────────────────────────────
async function capSavePlan() {
  try {
    // Read current values from DOM before saving
    _capItems.forEach(function(item, idx) {
      var ta  = document.getElementById('cap-instruction-' + idx);
      var std = document.getElementById('cap-standard-' + idx);
      var dl  = document.getElementById('cap-deadline-' + idx);
      var cost= document.getElementById('cap-cost-' + idx);
      if (ta)   item.instruction = ta.value;
      if (std)  item.standard    = std.value;
      if (dl)   item.deadline    = dl.value;
      if (cost) item.cost_min    = cost.value;
    });

    var res = await fetch(SB_URL + '/rest/v1/snag_cap', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        project_id:   _capProjectId || null,
        project_name: _capProjectName || null,
        items:        _capItems,
        status:       'active',
        created_at:   new Date().toISOString()
      })
    });

    if (res.ok || res.status === 201) {
      showToast('✅ תוכנית התיקון נשמרה');
    } else {
      var err = await res.json().catch(()=>({}));
      showToast('שגיאה בשמירה: ' + (err.message || res.status), 'error');
    }
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
  }
}


// ══ MULTI-FILE PROCESSING ═════════════════════════════════════════════

// Snag: process multiple files sequentially
async function snagHandleMultipleFiles(files) {
  var results = document.getElementById('snag-results');
  if (results) results.innerHTML = '';

  // Remove old preview
  var ep = document.getElementById('snag-image-preview-wrap');
  if (ep) ep.remove();

  // Show queue header
  var queueWrap = document.createElement('div');
  queueWrap.id  = 'snag-multi-queue';
  queueWrap.style.cssText = 'margin-bottom:20px;';
  queueWrap.innerHTML = '<div style="font-size:13px;font-weight:800;color:#93c5fd;margin-bottom:10px;">📂 ' + files.length + ' קבצים בתור לניתוח:</div>'
    + files.map(function(f,i){
        return '<div id="snag-q-' + i + '" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#242438;border-radius:8px;margin-bottom:6px;font-family:Heebo,sans-serif;direction:rtl;">'
          + '<span id="snag-q-icon-' + i + '" style="font-size:16px;">⏳</span>'
          + '<span style="font-size:12px;color:#ccc;flex:1;">' + f.name.replace(/</g,'&lt;') + '</span>'
          + '<span id="snag-q-status-' + i + '" style="font-size:11px;color:#555;">ממתין...</span>'
          + '</div>';
      }).join('');

  var scanBtn = document.getElementById('snag-scan-btn');
  if (scanBtn) scanBtn.parentNode.insertBefore(queueWrap, scanBtn);

  // Results container for multi-mode
  var multiResults = document.createElement('div');
  multiResults.id = 'snag-multi-results';
  multiResults.style.cssText = 'display:flex;flex-direction:column;gap:24px;';
  if (results) results.appendChild(multiResults);

  // Process each file
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var iconEl   = document.getElementById('snag-q-icon-' + i);
    var statusEl = document.getElementById('snag-q-status-' + i);
    var rowEl    = document.getElementById('snag-q-' + i);

    if (iconEl)   iconEl.textContent   = '🔄';
    if (statusEl) statusEl.textContent = 'מעבד...';
    if (statusEl) statusEl.style.color = '#f59e0b';
    if (rowEl)    rowEl.style.background = 'rgba(59,130,246,0.1)';

    try {
      // Prepare file
      _snagIsVideo   = fileIsVideo(file);
      _snagFrames    = [];
      _snagMediaType = file.type || 'image/jpeg';
      _snagHtmlText  = '';

      if (_snagIsVideo) {
        _snagFrames = await safetyExtractFrames(file, 6);
      } else if (fileIsPDF(file)) {
        _snagMediaType = 'application/pdf';
        _snagFrames    = [await readFileAsBase64(file)];
      } else if (fileIsHTML(file)) {
        _snagMediaType = 'text/html';
        _snagHtmlText  = htmlToText(await readFileAsText(file));
      } else {
        if (!['image/jpeg','image/png','image/gif','image/webp'].includes(_snagMediaType)) _snagMediaType = 'image/jpeg';
        _snagFrames = [await readFileAsBase64(file)];
      }

      // Run scan and capture result
      var fileFindings = await snagRunAnalysisForFile(file, i);

      if (fileFindings) {
        if (iconEl)   iconEl.textContent   = '✅';
        if (statusEl) { statusEl.textContent = 'הושלם'; statusEl.style.color = '#22c55e'; }
        if (rowEl)    rowEl.style.background = 'rgba(34,197,94,0.08)';
      } else {
        throw new Error('אין תוצאות');
      }

    } catch(e) {
      if (iconEl)   iconEl.textContent   = '❌';
      if (statusEl) { statusEl.textContent = 'שגיאה: ' + e.message; statusEl.style.color = '#ef4444'; }
      if (rowEl)    rowEl.style.background = 'rgba(239,68,68,0.08)';
    }

    // Small pause between files to avoid rate limiting
    if (i < files.length - 1) await new Promise(function(r){ setTimeout(r, 800); });
  }

  showToast('✅ ' + files.length + ' קבצים עובדו');
}

// Run analysis for a single file and render into multi-results container
async function snagRunAnalysisForFile(file, fileIdx) {
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) return null;

  var selectedIds = Array.from(document.querySelectorAll('.snag-cat-cb:checked')).map(function(cb){ return cb.dataset.id; });
  var customCats  = Array.from(document.querySelectorAll('.snag-custom-cat')).map(function(el){ return el.value.trim(); }).filter(Boolean);
  var allCats     = SNAG_CATEGORIES.filter(function(c){ return selectedIds.includes(c.id); });
  if (!allCats.length && !customCats.length) return null;

  // Build image blocks
  var imageBlocks = [];
  if (_snagMediaType === 'text/html' && _snagHtmlText) {
    imageBlocks = [{ type:'text', text:'תוכן לניתוח:\n\n' + _snagHtmlText }];
  } else if (_snagMediaType === 'application/pdf') {
    imageBlocks = _snagFrames.map(function(b64){ return { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } }; });
  } else {
    imageBlocks = _snagFrames.map(function(b64, idx) {
      var mtype = (_snagIsVideo || idx > 0) ? 'image/jpeg' : (_snagMediaType || 'image/jpeg');
      if (!['image/jpeg','image/png','image/gif','image/webp'].includes(mtype)) mtype = 'image/jpeg';
      return { type:'image', source:{ type:'base64', media_type:mtype, data:b64 } };
    });
  }

  var snagPrompt = 'You are a senior construction quality inspector. Analyze this '
    + (_snagIsVideo ? 'video (' + _snagFrames.length + ' frames)' : 'image/document')
    + ' for construction defects. Respond ONLY with valid JSON, no markdown.\n\n'
    + 'JSON structure:\n{\n'
    + allCats.map(function(c){ return '  "' + c.id + '": { "severity":"NONE|MINOR|MODERATE|CRITICAL", "findings":[], "location":"", "remedy":"", "responsible_trade":"" }'; }).join(',\n')
    + '\n}\n\nCategories:\n'
    + allCats.map(function(c,i){ return (i+1)+'. '+c.name_he+' (id:"'+c.id+'"): '+(c.prompt_en||'Inspect for defects'); }).join('\n')
    + '\n\nCRITICAL=immediate danger, MODERATE=fix before next stage, MINOR=fix before handover, NONE=ok.\n'
    + 'ALL field values MUST be in Hebrew (עברית) only. Return ONLY JSON.';

  var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:2000,
      messages:[{ role:'user', content:[...imageBlocks, { type:'text', text:snagPrompt }] }] }), 'snag-progress-text');
  var data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'API ' + res.status);
  var raw = (data.content&&data.content[0]&&data.content[0].text||'').replace(/```json|```/g,'').trim();
  var findings = {};
  try { findings = JSON.parse(raw); } catch(e) { throw new Error('JSON parse error'); }

  // Save to Supabase
  var projId   = document.getElementById('safety-project-sel')?.value || null;
  var projName = projId ? ((window.allProjects||[]).find(function(p){return p.id===projId;})||{}).project_name : null;
  await snagSaveReport(findings, allCats, customCats, projId, projName);

  // Render into multi-results container
  var container = document.getElementById('snag-multi-results') || document.getElementById('snag-results');
  if (!container) return findings;

  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;';

  // File header with checkbox + thumbnail
  var fileHeader = document.createElement('div');
  fileHeader.style.cssText = 'background:#242438;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);';

  var snagCb = document.createElement('input');
  snagCb.type = 'checkbox'; snagCb.checked = true;
  snagCb.style.cssText = 'accent-color:#3b82f6;width:16px;height:16px;cursor:pointer;flex-shrink:0;';
  snagCb.title = 'בחר כרטיס לדוח';
  snagCb.onchange = (function(w){ return function() {
    w.style.opacity = this.checked ? '1' : '0.45';
    w.style.borderColor = this.checked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
  }; })(wrapper);
  fileHeader.appendChild(snagCb);

  if (_snagFrames.length > 0 && _snagMediaType !== 'application/pdf' && _snagMediaType !== 'text/html') {
    var snagThumb = document.createElement('canvas');
    snagThumb.width = 40; snagThumb.height = 40;
    snagThumb.className = 'report-thumb-canvas';
    snagThumb.style.cssText = 'width:40px;height:40px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;vertical-align:middle;';
    snagThumb.dataset.b64 = _snagFrames[0];
    (function(cv, b64) {
      var img2 = new Image();
      img2.onload = function() {
        var cx = cv.getContext('2d');
        if (cx) cx.drawImage(img2, 0, 0, 40, 40);
      };
      img2.src = 'data:image/jpeg;base64,' + b64;
    })(snagThumb, _snagFrames[0]);
    fileHeader.appendChild(snagThumb);
  } else {
    var snagIcon = document.createElement('span');
    snagIcon.style.fontSize = '22px';
    snagIcon.textContent = _snagIsVideo ? '🎬' : fileIsPDF({type:_snagMediaType}) ? '📄' : '🌐';
    fileHeader.appendChild(snagIcon);
  }

  var snagNameSpan = document.createElement('span');
  snagNameSpan.style.cssText = 'font-size:13px;font-weight:700;color:#fff;direction:rtl;flex:1;';
  snagNameSpan.textContent = file.name;
  fileHeader.appendChild(snagNameSpan);

  var snagFrameCount = document.createElement('span');
  snagFrameCount.style.cssText = 'font-size:11px;color:#555;';
  snagFrameCount.textContent = _snagIsVideo ? _snagFrames.length + ' פריימים' : 'קובץ יחיד';
  fileHeader.appendChild(snagFrameCount);

  wrapper.appendChild(fileHeader);

  // Report content
  var reportDiv = document.createElement('div');
  reportDiv.style.cssText = 'padding:16px;';

  // Store findings temporarily and render
  var prevFindings = _snagLastFindings;
  var prevFrames   = _snagFrames.slice();
  var prevIsVideo  = _snagIsVideo;
  _snagLastFindings = findings;

  // Build mini report HTML
  var SEV = { CRITICAL:{c:'#ef4444',bg:'rgba(239,68,68,0.12)',l:'🔴 קריטי'}, MODERATE:{c:'#f59e0b',bg:'rgba(245,158,11,0.1)',l:'🟡 בינוני'}, MINOR:{c:'#3b82f6',bg:'rgba(59,130,246,0.08)',l:'🔵 קל'}, NONE:{c:'#22c55e',bg:'rgba(34,197,94,0.06)',l:'✅ תקין'} };
  var sevOrd = {CRITICAL:3,MODERATE:2,MINOR:1,NONE:0};
  var scored = allCats.map(function(cat){ var f=findings[cat.id]||{severity:'NONE',findings:[]}; return {cat,f,s:SEV[f.severity]||SEV.NONE,lv:sevOrd[f.severity]||0}; }).sort(function(a,b){return b.lv-a.lv;});
  var maxLv  = scored[0]?.lv||0;
  var banner = maxLv>=3?'🔴 ליקויים קריטיים':maxLv>=2?'🟡 ליקויים משמעותיים':maxLv>=1?'🔵 ליקויים קלים':'✅ לא נמצאו ליקויים';
  var bannerColor = maxLv>=3?'#ef4444':maxLv>=2?'#f59e0b':maxLv>=1?'#3b82f6':'#22c55e';

  var html = '<div style="font-size:15px;font-weight:900;color:' + bannerColor + ';margin-bottom:12px;">' + banner + '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:10px;margin-bottom:12px;">';
  scored.forEach(function(s) {
    if (s.lv === 0) {
      html += '<div style="background:' + s.s.bg + ';border:1px solid ' + s.s.c + '30;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;">'
        + '<span style="font-size:18px;">' + (s.cat.icon||'🔧') + '</span>'
        + '<div><div style="font-size:12px;font-weight:700;color:#fff;">' + s.cat.name_he + '</div>'
        + '<div style="font-size:10px;color:#22c55e;">✅ תקין</div></div></div>';
      return;
    }
    html += '<div style="background:' + s.s.bg + ';border:1.5px solid ' + s.s.c + ';border-radius:10px;padding:12px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
      + '<span style="font-size:20px;">' + (s.cat.icon||'🔧') + '</span>'
      + '<div><div style="font-size:12px;font-weight:800;color:#fff;">' + s.cat.name_he + '</div>'
      + '<div style="font-size:10px;color:' + s.s.c + ';font-weight:700;">' + s.s.l + '</div></div></div>';
    if (s.f.findings&&s.f.findings.length) {
      s.f.findings.forEach(function(fi){ html += '<div style="font-size:11px;color:#ccc;padding:2px 0;">▸ ' + (fi||'').replace(/</g,'&lt;') + '</div>'; });
    }
    if (s.f.remedy) html += '<div style="font-size:11px;color:' + s.s.c + ';font-weight:700;margin-top:6px;">🔧 ' + s.f.remedy.replace(/</g,'&lt;') + '</div>';
    html += '</div>';
  });
  html += '</div>';
  reportDiv.innerHTML = html;
  wrapper.appendChild(reportDiv);
  container.appendChild(wrapper);

  _snagLastFindings = prevFindings; // restore
  return findings;
}

// ── Use shared media in safety tab ────────────────────────────────────
function safetyUseShared() {
  if (!SHARED_MEDIA.files.length) { showToast('אין קבצים משותפים — העלה קודם', 'error'); return; }
  sharedMediaRender('safety-shared-status');
  showToast('✅ ' + SHARED_MEDIA.files.length + ' קבצים טעונים לניתוח בטיחות');
  // Trigger analysis with shared files
  safetyHandleMultipleFiles(SHARED_MEDIA.files);
}

// ── Use shared media in snag tab ───────────────────────────────────────
function snagUseShared() {
  if (!SHARED_MEDIA.files.length) { showToast('אין קבצים משותפים — העלה קודם', 'error'); return; }
  sharedMediaRender('snag-shared-status');
  showToast('✅ ' + SHARED_MEDIA.files.length + ' קבצים טעונים לסריקת ליקויים');
  snagHandleMultipleFiles(SHARED_MEDIA.files);
}


// Safety: process multiple files
async function safetyHandleMultipleFiles(files) {
  var results = document.getElementById('safety-results');
  if (results) results.innerHTML = '';

  var queueWrap = document.createElement('div');
  queueWrap.id  = 'safety-multi-queue';
  queueWrap.style.cssText = 'margin-bottom:20px;';
  queueWrap.innerHTML = '<div style="font-size:13px;font-weight:800;color:#fca5a5;margin-bottom:10px;">📂 ' + files.length + ' קבצים בתור לניתוח בטיחות:</div>'
    + files.map(function(f,i){
        return '<div id="safety-q-' + i + '" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#242438;border-radius:8px;margin-bottom:6px;font-family:Heebo,sans-serif;direction:rtl;">'
          + '<span id="safety-q-icon-' + i + '" style="font-size:16px;">⏳</span>'
          + '<span style="font-size:12px;color:#ccc;flex:1;">' + f.name.replace(/</g,'&lt;') + '</span>'
          + '<span id="safety-q-status-' + i + '" style="font-size:11px;color:#555;">ממתין...</span>'
          + '</div>';
      }).join('');

  var prog = document.getElementById('safety-progress');
  if (prog) prog.parentNode.insertBefore(queueWrap, prog);

  var multiResults = document.createElement('div');
  multiResults.id = 'safety-multi-results';
  multiResults.style.cssText = 'display:flex;flex-direction:column;gap:24px;';
  if (results) results.appendChild(multiResults);

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var iconEl   = document.getElementById('safety-q-icon-' + i);
    var statusEl = document.getElementById('safety-q-status-' + i);
    var rowEl    = document.getElementById('safety-q-' + i);
    if (iconEl)   iconEl.textContent   = '🔄';
    if (statusEl) { statusEl.textContent = 'מעבד...'; statusEl.style.color = '#f59e0b'; }
    if (rowEl)    rowEl.style.background = 'rgba(59,130,246,0.1)';

    try {
      _safetyIsVideo   = fileIsVideo(file);
      _safetyFrames    = [];
      _safetyMediaType = file.type || 'image/jpeg';
      _safetyHtmlText  = '';

      if (_safetyIsVideo) {
        _safetyFrames = await safetyExtractFrames(file, 6);
      } else if (fileIsPDF(file)) {
        _safetyMediaType = 'application/pdf';
        _safetyFrames    = [await readFileAsBase64(file)];
      } else if (fileIsHTML(file)) {
        _safetyMediaType = 'text/html';
        _safetyHtmlText  = htmlToText(await readFileAsText(file));
      } else {
        if (!['image/jpeg','image/png','image/gif','image/webp'].includes(_safetyMediaType)) _safetyMediaType = 'image/jpeg';
        _safetyFrames    = [await readFileAsBase64(file)];
      }

      await safetyRunAnalysisForFile(file, i);

      if (iconEl)   iconEl.textContent   = '✅';
      if (statusEl) { statusEl.textContent = 'הושלם'; statusEl.style.color = '#22c55e'; }
      if (rowEl)    rowEl.style.background = 'rgba(34,197,94,0.08)';
    } catch(e) {
      if (iconEl)   iconEl.textContent   = '❌';
      if (statusEl) { statusEl.textContent = e.message; statusEl.style.color = '#ef4444'; }
    }
    if (i < files.length - 1) await new Promise(function(r){ setTimeout(r, 800); });
  }
  showToast('✅ ' + files.length + ' קבצים עובדו');
}

async function safetyRunAnalysisForFile(file, fileIdx) {
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) return;
  await safetyLoadCategories();

  var imageBlocks = [];
  if (_safetyMediaType === 'text/html' && _safetyHtmlText) {
    imageBlocks = [{ type:'text', text:'תוכן לניתוח:\n\n' + _safetyHtmlText }];
  } else if (_safetyMediaType === 'application/pdf') {
    imageBlocks = _safetyFrames.map(function(b64){ return { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } }; });
  } else {
    imageBlocks = _safetyFrames.map(function(b64, idx) {
      var mtype = (_safetyIsVideo || idx > 0) ? 'image/jpeg' : (_safetyMediaType || 'image/jpeg');
      if (!['image/jpeg','image/png','image/gif','image/webp'].includes(mtype)) mtype = 'image/jpeg';
      return { type:'image', source:{ type:'base64', media_type:mtype, data:b64 } };
    });
  }

  var safetyPrompt = 'You are a construction site safety inspector. Analyze this '
    + (_safetyIsVideo ? 'video (' + _safetyFrames.length + ' frames)' : 'image/document')
    + '. Respond ONLY with valid JSON.\n\n{'
    + SAFETY_CATEGORIES.map(function(cat){
        return '"' + cat.id + '":{"severity":"OK|MINOR|MODERATE|CRITICAL","found":[],"action":null}';
      }).join(',')
    + '}\n\nFor each: ' + SAFETY_CATEGORIES.map(function(c){return c.id+': '+c.prompt;}).join(' | ')
    + '\nALL field values (found, action) MUST be in Hebrew (עברית) only. Return ONLY JSON.';

  var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:2000,
      messages:[{ role:'user', content:[...imageBlocks, { type:'text', text:safetyPrompt }] }] }), 'safety-progress-text');
  var data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'API ' + res.status);

  var raw = (data.content&&data.content[0]&&data.content[0].text||'').replace(/```json|```/g,'').trim();
  var findings = {};
  try { findings = JSON.parse(raw); } catch(e) { throw new Error('JSON error'); }

  // Save + render
  var projId   = document.getElementById('safety-project-sel')?.value || null;
  var projName = projId ? ((window.allProjects||[]).find(function(p){return p.id===projId;})||{}).project_name : null;
  await safetySaveReport(findings, projId, projName);

  var container = document.getElementById('safety-multi-results') || document.getElementById('safety-results');
  if (!container) return;

  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'border:1.5px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;';
  // Unique card ID for checkbox selection
  var cardId = 'safety-card-' + fileIdx + '-' + Date.now();
  wrapper.id = cardId;

  var fh = document.createElement('div');
  fh.style.cssText = 'background:#242438;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);';

  // Checkbox — uses closure to lock wrapper reference
  var cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = true;
  cb.className = 'report-card-cb';
  cb.style.cssText = 'accent-color:#22c55e;width:16px;height:16px;cursor:pointer;flex-shrink:0;';
  cb.title = 'בחר כרטיס לדוח';
  cb.onchange = (function(w){ return function() {
    w.style.opacity = this.checked ? '1' : '0.45';
    w.style.borderColor = this.checked ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
  }; })(wrapper);
  fh.appendChild(cb);

  // Thumbnail via canvas — bypasses ad blocker
  if (_safetyFrames.length > 0 && _safetyMediaType !== 'application/pdf') {
    var thumb = document.createElement('canvas');
    thumb.width = 40; thumb.height = 40;
    thumb.className = 'report-thumb-canvas';
    thumb.style.cssText = 'width:40px;height:40px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;vertical-align:middle;';
    thumb.dataset.b64 = _safetyFrames[0];
    (function(cv, b64) {
      var img2 = new Image();
      img2.onload = function() {
        var cx = cv.getContext('2d');
        if (cx) cx.drawImage(img2, 0, 0, 40, 40);
      };
      img2.src = 'data:image/jpeg;base64,' + b64;
    })(thumb, _safetyFrames[0]);
    fh.appendChild(thumb);
  } else {
    var icon = document.createElement('span');
    icon.style.fontSize = '22px';
    icon.textContent = _safetyIsVideo ? '🎬' : fileIsPDF({name:file.name}) ? '📄' : '📸';
    fh.appendChild(icon);
  }

  var nameSpan = document.createElement('span');
  nameSpan.style.cssText = 'font-size:13px;font-weight:700;color:#fff;direction:rtl;flex:1;';
  nameSpan.textContent = file.name;
  fh.appendChild(nameSpan);

  wrapper.appendChild(fh);

  var rd = document.createElement('div');
  rd.style.cssText = 'padding:16px;';
  var prevF = _safetyLastFindings;
  _safetyLastFindings = findings;
  var fr = _safetyFrames.slice();
  var iv = _safetyIsVideo;
  safetyRenderReport(findings);
  var rendered = document.getElementById('safety-results');
  if (rendered && rendered.children.length > 0) {
    rd.appendChild(rendered.children[0].cloneNode(true));
  }
  wrapper.appendChild(rd);
  container.appendChild(wrapper);
  _safetyLastFindings = prevF;
}


// ══ REPORT PRINT / EMAIL / PROJECT HELPERS ═══════════════════════════

function snagUpdateReportProject(projId) {
  var sel = document.getElementById('safety-project-sel');
  if (sel) sel.value = projId;
  // Save project link to last snag report in Supabase
  if (!projId) return;
  var projName = '';
  (window.allProjects||[]).forEach(function(p){ if(p.id===projId) projName=p.project_name; });
  showToast('📁 הדוח קושר ל: ' + projName);
}

// ── Snag Print ──────────────────────────────────────────────────────
function snagPrintReport() {
  var findings  = _snagLastFindings;
  if (!findings) { showToast('אין דוח להדפסה', 'error'); return; }
  var inclCrit = document.getElementById('snag-cb-critical')?.checked !== false;
  var inclMod  = document.getElementById('snag-cb-moderate')?.checked !== false;
  var inclMin  = document.getElementById('snag-cb-minor')?.checked !== false;
  var inclOk   = document.getElementById('snag-cb-ok')?.checked;
  var projName = document.getElementById('snag-action-project')?.selectedOptions[0]?.textContent || '';
  var now      = new Date().toLocaleString('he-IL');
  var SEV_HE   = { CRITICAL:'קריטי', MODERATE:'בינוני', MINOR:'קל', NONE:'תקין' };
  var SEV_COL  = { CRITICAL:'#c00', MODERATE:'#b8860b', MINOR:'#1a3a8f', NONE:'#1a7a3a' };

  var issues = SNAG_CATEGORIES.filter(function(cat) {
    var f = findings[cat.id];
    if (!f) return inclOk;
    var sev = f.severity || 'NONE';
    if (sev==='CRITICAL' && !inclCrit) return false;
    if (sev==='MODERATE' && !inclMod)  return false;
    if (sev==='MINOR'    && !inclMin)  return false;
    if (sev==='NONE'     && !inclOk)   return false;
    return true;
  });

  // Collect thumbnails from checked cards only
  var snagPrintThumbs = [];
  // Search top-level cards in both multi and single result containers
  var snagCardSelector = '#snag-multi-results > div, #snag-results > div, #snag-results .snag-single-result-wrap';
  document.querySelectorAll(snagCardSelector).forEach(function(card) {
    var cb = card.querySelector('.report-card-cb');
    if (cb && !cb.checked) return;
    var canvas = card.querySelector('.report-thumb-canvas');
    if (canvas && canvas.dataset.b64) snagPrintThumbs.push('data:image/jpeg;base64,' + canvas.dataset.b64);
  });
  // Fallback: if no canvas thumbs found, use _snagFrames directly
  if (!snagPrintThumbs.length && _snagFrames && _snagFrames.length && _snagFrames[0]) {
    snagPrintThumbs.push('data:image/jpeg;base64,' + _snagFrames[0]);
  }
  var snagManagerName = (APP.config && APP.config.manager_name) || 'בני פרסקי';
  var snagThumbsHtml = snagPrintThumbs.length
    ? '<div style="margin:12px 0;"><div style="font-size:11px;color:#666;margin-bottom:6px;">📸 תמונה שנסרקה:</div>'
      + snagPrintThumbs.map(function(src){ return '<img src="' + src + '" style="max-width:100%;width:480px;height:auto;object-fit:contain;border-radius:8px;border:1px solid #ddd;display:block;margin-bottom:6px;">'; }).join('')
      + '</div>'
    : '';

  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">'
    + '<title>דוח ליקויים</title>'
    + '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:30px;color:#111;font-size:13px;}'
    + 'h1{font-size:20px;margin-bottom:4px;}h2{font-size:14px;margin:0 0 4px;}'
    + '.header{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px;}'
    + '.meta{font-size:11px;color:#666;margin-bottom:4px;}'
    + '.item{border:1px solid #ddd;border-right:5px solid #ccc;border-radius:6px;padding:12px;margin-bottom:12px;break-inside:avoid;}'
    + '.finding{font-size:12px;color:#333;padding:2px 0;}li{margin:2px 0;}'
    + '.remedy{font-size:12px;font-weight:700;margin-top:6px;}'
    + '@media print{body{padding:10px}.no-print{display:none}}'
    + '</style></head><body>'
    + '<div class="header">'
    + '<h1>🔍 דוח ליקויים — בדיקת איכות בנייה</h1>'
    + (projName && projName!=='📁 כל הפרויקטים' ? '<div class="meta">📁 פרויקט: ' + projName.replace('📁 ','') + '</div>' : '')
    + '<div class="meta">📅 תאריך: ' + now + ' | ' + snagManagerName + '</div>'
    + snagThumbsHtml
    + '<div class="meta">⚠️ קריטי: ' + issues.filter(function(c){return (findings[c.id]||{}).severity==='CRITICAL';}).length
    + ' | 🟡 בינוני: ' + issues.filter(function(c){return (findings[c.id]||{}).severity==='MODERATE';}).length
    + ' | 🔵 קל: ' + issues.filter(function(c){return (findings[c.id]||{}).severity==='MINOR';}).length + '</div>'
    + '</div>';

  issues.forEach(function(cat) {
    var f = findings[cat.id] || { severity:'NONE', findings:[] };
    var sev = f.severity || 'NONE';
    var col = SEV_COL[sev] || '#888';
    html += '<div class="item" style="border-right-color:' + col + ';">'
      + '<h2>' + (cat.icon||'') + ' ' + cat.name_he + ' — <span style="color:' + col + ';">' + (SEV_HE[sev]||sev) + '</span></h2>'
      + (f.location ? '<div class="meta">📍 ' + f.location + '</div>' : '')
      + '<ul>' + (f.findings||[]).map(function(fi){ return '<li class="finding">' + fi + '</li>'; }).join('') + '</ul>'
      + (f.remedy ? '<div class="remedy" style="color:' + col + ';">🔧 תיקון נדרש: ' + f.remedy + '</div>' : '')
      + (f.responsible_trade ? '<div class="meta">👷 אחראי: ' + f.responsible_trade + '</div>' : '')
      + '</div>';
  });

  html += '<div class="meta" style="margin-top:20px;border-top:1px solid #ddd;padding-top:10px;">הופק ע"י מערכת Beni Work Journal</div>';
  html += '</body></html>';

  _showPrintOverlay(html);
}

// ── Safety Print ────────────────────────────────────────────────────
function safetyPrintReport() {
  var findings = _safetyLastFindings;
  if (!findings) { showToast('אין דוח להדפסה', 'error'); return; }
  var inclCrit = document.getElementById('safety-cb-critical')?.checked !== false;
  var inclMod  = document.getElementById('safety-cb-moderate')?.checked !== false;
  var inclMin  = document.getElementById('safety-cb-minor')?.checked !== false;
  var inclOk   = document.getElementById('safety-cb-ok')?.checked;
  var projName = document.getElementById('safety-action-project')?.selectedOptions[0]?.textContent || '';
  var now      = new Date().toLocaleString('he-IL');
  var SEV_HE   = { CRITICAL:'קריטי — עצירת עבודה', MODERATE:'בינוני — תיקון דחוף', MINOR:'קל — לתיקון', OK:'תקין' };
  var SEV_COL  = { CRITICAL:'#c00', MODERATE:'#b8860b', MINOR:'#1a3a8f', OK:'#1a7a3a' };

  var cats = SAFETY_CATEGORIES.filter(function(cat) {
    var f = findings[cat.id];
    if (!f) return inclOk;
    var sev = f.severity || 'OK';
    if (sev==='CRITICAL' && !inclCrit) return false;
    if (sev==='MODERATE' && !inclMod)  return false;
    if (sev==='MINOR'    && !inclMin)  return false;
    if (sev==='OK'       && !inclOk)   return false;
    return true;
  });

  // Collect selected cards only
  var selectedWrappers = document.querySelectorAll('[id^="safety-card-"]');
  var selectedFindings = findings; // default to all

  // Collect thumbnails from checked cards
  var printThumbs = [];
  var safetyCardSel = '#safety-multi-results > div, #safety-results > div, #safety-results .safety-single-result-wrap';
  document.querySelectorAll(safetyCardSel).forEach(function(card) {
    var cb = card.querySelector('.report-card-cb');
    if (cb && !cb.checked) return;
    var canvas = card.querySelector('.report-thumb-canvas');
    if (canvas && canvas.dataset.b64) printThumbs.push('data:image/jpeg;base64,' + canvas.dataset.b64);
  });

  var managerName = (APP.config && APP.config.manager_name) || 'בני פרסקי';
  var thumbsHtml = printThumbs.length
    ? '<div style="margin:14px 0;"><div style="font-size:11px;color:#666;margin-bottom:6px;">📸 תמונת האתר שנותחה:</div>'      + printThumbs.map(function(src){ return '<img src="' + src + '" style="max-width:100%;width:480px;height:auto;object-fit:contain;border-radius:8px;border:1px solid #ddd;display:block;margin-bottom:6px;">'; }).join('')      + '</div>'    : '';

  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוח בטיחות</title>'
    + '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:30px;color:#111;font-size:13px;}'
    + 'h1{font-size:20px;}h2{font-size:14px;margin:0 0 4px;}.meta{font-size:11px;color:#666;}'
    + '.header{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px;}'
    + '.item{border:1px solid #ddd;border-right:5px solid #ccc;border-radius:6px;padding:12px;margin-bottom:12px;break-inside:avoid;}'
    + '@media print{body{padding:10px}}</style></head><body>'
    + '<div class="header"><h1>🛡️ דוח בטיחות — בדיקת אתר בנייה</h1>'
    + (projName && projName!=='📁 כל הפרויקטים' ? '<div class="meta">📁 פרויקט: ' + projName.replace('📁 ','') + '</div>' : '')
    + '<div class="meta">📅 ' + now + ' | ' + managerName + '</div>'
    + thumbsHtml
    + '</div>';

  cats.forEach(function(cat) {
    var f = findings[cat.id] || { severity:'OK', found:[], action:null };
    var sev = f.severity || 'OK';
    var col = SEV_COL[sev] || '#888';
    html += '<div class="item" style="border-right-color:' + col + ';">'
      + '<h2>' + (cat.icon||'') + ' ' + cat.name + ' — <span style="color:' + col + ';">' + (SEV_HE[sev]||sev) + '</span></h2>'
      + '<ul>' + (f.found||[]).map(function(fi){ return '<li>' + fi + '</li>'; }).join('') + '</ul>'
      + (f.action ? '<div style="font-weight:700;color:' + col + ';margin-top:6px;">⚡ פעולה נדרשת: ' + f.action + '</div>' : '')
      + '</div>';
  });

  html += '</body></html>';
  _showPrintOverlay(html);
}

// ── Email helpers ────────────────────────────────────────────────────
function snagEmailReport() {
  var findings = _snagLastFindings;
  if (!findings) { showToast('אין דוח לשליחה', 'error'); return; }
  var projName = document.getElementById('snag-action-project')?.selectedOptions[0]?.textContent?.replace('📁 ','').trim() || 'אתר בנייה';
  var now      = new Date().toLocaleDateString('he-IL');
  var sevOrder = {CRITICAL:3,MODERATE:2,MINOR:1,NONE:0};
  var lines    = ['דוח ליקויים — ' + projName + ' — ' + now, ''];
  SNAG_CATEGORIES.filter(function(c){ return findings[c.id] && (findings[c.id].severity||'NONE')!=='NONE'; })
    .sort(function(a,b){ return (sevOrder[(findings[b.id]||{}).severity]||0)-(sevOrder[(findings[a.id]||{}).severity]||0); })
    .forEach(function(cat) {
      var f   = findings[cat.id];
      var sev = f.severity==='CRITICAL'?'קריטי':f.severity==='MODERATE'?'בינוני':'קל';
      lines.push(cat.icon + ' ' + cat.name_he + ' [' + sev + ']');
      (f.findings||[]).forEach(function(fi){ lines.push('  • ' + fi); });
      if (f.remedy) lines.push('  תיקון: ' + f.remedy);
      lines.push('');
    });
  lines.push('הופק ע"י מערכת Beni Work Journal');
  var bodyText = lines.join('\n');
  // Show copy overlay — mailto breaks Hebrew in most clients
  var ov = document.getElementById('_print_overlay_');
  if (!ov) { ov = document.createElement('div'); ov.id = '_print_overlay_'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#1a1a2e;z-index:99999;overflow:auto;padding:70px 20px 20px;box-sizing:border-box;direction:rtl;font-family:Heebo,sans-serif;';
  ov.innerHTML = '<h2 style="color:#fff;font-size:18px;margin-bottom:12px;">📧 העתק לאימייל</h2>'
    + '<p style="color:#888;font-size:12px;margin-bottom:12px;">לחץ "העתק" ← פתח אימייל ← הדבק</p>'
    + '<textarea id="_email_ta_" dir="rtl" style="width:100%;height:60vh;background:#242438;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;resize:none;">' + bodyText.replace(/</g,'&lt;') + '</textarea>';
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ סגור';
  closeBtn.style.cssText = 'position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:100000;font-family:Heebo,sans-serif;';
  closeBtn.onclick = function(){ ov.style.display='none'; };
  var copyBtn = document.createElement('button');
  copyBtn.textContent = '📋 העתק';
  copyBtn.style.cssText = 'position:fixed;top:12px;left:12px;background:#22c55e;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:100000;font-family:Heebo,sans-serif;';
  copyBtn.onclick = function(){
    var ta = document.getElementById('_email_ta_');
    ta.select(); ta.setSelectionRange(0,99999);
    try{ navigator.clipboard.writeText(ta.value).then(function(){ copyBtn.textContent='✅ הועתק!'; setTimeout(function(){ copyBtn.textContent='📋 העתק'; },2000); }); }
    catch(e){ document.execCommand('copy'); copyBtn.textContent='✅ הועתק!'; setTimeout(function(){ copyBtn.textContent='📋 העתק'; },2000); }
  };
  ov.insertBefore(closeBtn, ov.firstChild);
  ov.insertBefore(copyBtn, ov.firstChild);
}

function safetyEmailReport() {
  var findings = _safetyLastFindings;
  if (!findings) { showToast('אין דוח לשליחה', 'error'); return; }
  var projName = document.getElementById('safety-action-project')?.selectedOptions[0]?.textContent?.replace('📁 ','').trim() || 'אתר בנייה';
  var now      = new Date().toLocaleDateString('he-IL');
  var body     = 'דוח בטיחות — ' + projName + ' — ' + now + '\n\n';
  if (_safetyFrames && _safetyFrames.length && _safetyFrames[0]) {
    body += '📸 ' + (_safetyIsVideo ? 'צורף פריים מסרטון' : 'צורפה תמונת האתר') + ' — ראה בדוח המודפס\n\n';
  }
  SAFETY_CATEGORIES.filter(function(c){ return findings[c.id] && (findings[c.id].severity||'OK')!=='OK'; })
    .forEach(function(cat) {
      var f = findings[cat.id];
      body += cat.name + ' [' + f.severity + ']\n';
      (f.found||[]).forEach(function(fi){ body += '  • ' + fi + '\n'; });
      if (f.action) body += '  פעולה: ' + f.action + '\n';
      body += '\n';
    });
  var subject = encodeURIComponent('דוח בטיחות — ' + projName + ' — ' + now);
  window.location.href = 'mailto:?subject=' + subject + '&body=' + encodeURIComponent(body);
}





