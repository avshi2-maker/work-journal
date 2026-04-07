// smartjournal.js — Smart Journal + EOD + Weekly
// Loaded dynamically by index.html

// ══ SMART JOURNAL — inline fallback (replaces smartjournal_28032026.js) ═══
function switchSmartTab(tab) {
  var tabs    = ['notes','photos','videos','takeoffs','recordings','ocr'];
  var panels  = document.querySelectorAll('[id^="sj-panel-"]');
  var buttons = document.querySelectorAll('[id^="sj-tab-"]');
  panels.forEach(function(p){ p.style.display='none'; });
  buttons.forEach(function(b){ b.style.background='transparent'; b.style.color='#888'; });
  var panel = document.getElementById('sj-panel-'+tab);
  var btn   = document.getElementById('sj-tab-'+tab);
  if (panel) panel.style.display='block';
  if (btn)   { btn.style.background='#9a6f00'; btn.style.color='#fff'; }
  // Load content per tab
  if (tab==='photos')     loadSmartPhotos();
  if (tab==='videos')     loadSmartVideos();
  if (tab==='recordings') loadSmartRecordings();
  if (tab==='takeoffs')   { if(typeof loadTakeoffList==='function') loadTakeoffList(); }
  if (tab==='ocr')        { /* OCR panel ready */ }
}

function smartJournalFilter() {
  var tab = document.querySelector('[id^="sj-tab-"][style*="#9a6f00"]');
  var tabId = tab ? tab.id.replace('sj-tab-','') : 'notes';
  if (tabId==='notes') loadNotesWall();
  else if (tabId==='photos') loadSmartPhotos();
  else if (tabId==='videos') loadSmartVideos();
  else if (tabId==='recordings') loadSmartRecordings();
}

async function loadSmartPhotos() {
  var container = document.getElementById('sj-panel-photos');
  if (!container) return;
  var pid = document.getElementById('smart-project-filter')?.value||'';
  container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;direction:rtl;">⏳ טוען תמונות...</div>';
  try {
    var pqs = 'order=created_at.desc&limit=50&select=id,note_text,photo_url,note_type,created_at,project_id';
    var { data: allPN } = await sbQ('beni_notes', pqs);
    var data = (allPN||[]).filter(function(n){
      if (pid && n.project_id !== pid) return false;
      if (n.note_type === 'photo' || n.note_type === 'doc') return true;
      var u = n.photo_url||'';
      return u && !u.includes('/beni_voice/') && !/\.(mp4|mov|avi|m4v|mp3|m4a|wav|ogg|webm)(\?|$)/i.test(u);
    });
    if (!data.length) { container.innerHTML='<div style="padding:30px;color:#555;text-align:center;direction:rtl;">📷 אין תמונות עדיין</div>'; return; }
    // Build photo grid with action buttons
    container.innerHTML = '';
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;padding:10px;';
    data.forEach(function(n) {
      var src     = n.photo_url || n.cloudinary_url || '';
      var caption = (n.note_text || '').substring(0, 40);
      if (!src) return;
      var card = document.createElement('div');
      card.style.cssText = 'border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);background:#1e1e35;';
      card.setAttribute('data-note-text', caption);
      // Photo
      var img = document.createElement('img');
      img.src = src;
      img.style.cssText = 'width:100%;height:110px;object-fit:cover;cursor:zoom-in;display:block;';
      img.setAttribute('data-src', encodeURIComponent(src));
      img.onclick = function() { openLightbox(src, caption); };
      card.appendChild(img);
      // Caption
      var cap = document.createElement('div');
      cap.style.cssText = 'padding:5px 8px;font-size:10px;color:#888;direction:rtl;';
      cap.textContent = caption;
      card.appendChild(cap);
      // Action buttons
      var acts = document.createElement('div');
      acts.style.cssText = 'display:flex;gap:4px;padding:6px 6px 8px;';
      // Scan button
      var scanBtn = document.createElement('button');
      scanBtn.style.cssText = 'flex:1;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:5px 4px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:10px;font-weight:700;';
      scanBtn.textContent = '🚀 סרוק';
      scanBtn.title = 'שלח לסריקה מהירה';
      scanBtn.onclick = (function(u,c){ return function(){ smSendToScan(u,c); }; })(src, caption);
      acts.appendChild(scanBtn);
      // Safety button
      var safeBtn = document.createElement('button');
      safeBtn.style.cssText = 'flex:1;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:5px 4px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:10px;font-weight:700;';
      safeBtn.textContent = '🛡️ בטיחות';
      safeBtn.title = 'שלח לניתוח בטיחות';
      safeBtn.onclick = (function(u,c){ return function(){ smSendToSafety(u,c); }; })(src, caption);
      acts.appendChild(safeBtn);
      // Delete button
      var delBtn = makeDeleteBtn(n.id, card, loadSmartPhotos);
      acts.appendChild(delBtn);
      card.appendChild(acts);
      grid.appendChild(card);
    });
    container.appendChild(grid);
  } catch(e) { container.innerHTML='<div style="color:#ef4444;padding:20px;direction:rtl;">שגיאה: '+e.message+'</div>'; }
}

async function loadSmartVideos() {
  var container = document.getElementById('sj-panel-videos');
  if (!container) return;
  var pid = document.getElementById('smart-project-filter')?.value||'';
  container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;direction:rtl;">⏳ טוען סרטונים...</div>';
  try {
    var vqs = 'order=created_at.desc&limit=30&select=id,note_text,photo_url,note_type,created_at,project_id';
    var { data: allVN } = await sbQ('beni_notes', vqs);
    var data = (allVN||[]).filter(function(n){
      if (pid && n.project_id !== pid) return false;
      if (n.note_type === 'video') return true;
      var u = n.photo_url||'';
      return u && /\.(mp4|mov|avi|m4v)(\?|$)/i.test(u);
    });
    if (!data.length) { container.innerHTML='<div style="padding:30px;color:#555;text-align:center;direction:rtl;">🎬 אין סרטונים עדיין</div>'; return; }
    container.innerHTML = '';
    var vlist = document.createElement('div');
    vlist.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:10px;';
    data.forEach(function(n) {
      var src = n.photo_url || n.cloudinary_url || '';
      if (!src) return;
      var vcard = document.createElement('div');
      vcard.style.cssText = 'background:rgba(255,255,255,0.05);border-radius:12px;padding:10px;';
      var vid = document.createElement('video');
      vid.src = src; vid.controls = true;
      vid.style.cssText = 'width:100%;border-radius:8px;max-height:200px;display:block;';
      vcard.appendChild(vid);
      var vmeta = document.createElement('div');
      vmeta.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:6px;';
      var vtxt = document.createElement('div');
      vtxt.style.cssText = 'font-size:11px;color:#888;direction:rtl;';
      vtxt.textContent = (n.note_text||'').substring(0,50);
      var vdel = makeDeleteBtn(n.id, vcard, loadSmartVideos);
      vmeta.appendChild(vtxt); vmeta.appendChild(vdel);
      vcard.appendChild(vmeta);
      vlist.appendChild(vcard);
    });
    container.appendChild(vlist);
  } catch(e) { container.innerHTML='<div style="color:#ef4444;padding:20px;direction:rtl;">שגיאה: '+e.message+'</div>'; }
}

async function loadSmartRecordings() {
  var container = document.getElementById('sj-panel-recordings');
  if (!container) return;
  // Populate project filter if empty
  var recFilter = document.getElementById('rec-project-filter');
  if (recFilter && recFilter.options.length <= 1 && window.allProjects) {
    (window.allProjects||[]).forEach(function(p) {
      var opt = document.createElement('option'); opt.value=p.id; opt.textContent=p.project_name; recFilter.appendChild(opt);
    });
  }
  var pid = (recFilter && recFilter.value) || (document.getElementById('smart-project-filter') ? document.getElementById('smart-project-filter').value : '');
  container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;direction:rtl;">⏳ טוען הקלטות...</div>';
  try {
    // Load from beni_notes (audio type) — where Beni Pocket sends voice files
    var qs = 'order=created_at.desc&limit=100&select=id,note_text,photo_url,note_type,created_at,project_id';
    var { data: allNotes } = await sbQ('beni_notes', qs);
    // Filter for audio: note_type=audio OR URL contains audio patterns
    var notes = (allNotes || []).filter(function(n) {
      if (n.note_type === 'audio') return true;
      var url = n.photo_url || '';
      return url.includes('/beni_voice/') || /\.(mp3|m4a|wav|ogg|webm)(\?|$)/i.test(url);
    });
    if (pid) notes = notes.filter(function(n){ return n.project_id === pid; });

    // Also load from voice_memos (project_id may not exist in table)
    var qs2 = 'order=created_at.desc&limit=50&select=id,transcript,ai_summary,duration_sec,created_at,is_processed';
    var { data: memos } = await sbQ('voice_memos', qs2);
    memos = memos || [];

    // Also check beni_notes for items with audio URL patterns (fallback)
    if (!notes.length) {
      var qs3 = 'photo_url=like.*beni_voice*&order=created_at.desc&limit=30&select=id,note_text,photo_url,created_at,project_id';
      var { data: audioNotes } = await sbQ('beni_notes', qs3);
      notes = (audioNotes || []);
    }

    if (!notes.length && !memos.length) {
      container.innerHTML = '<div style="padding:30px;color:#555;text-align:center;direction:rtl;"><div style="font-size:40px;margin-bottom:10px;">🎙️</div><div>אין הקלטות עדיין</div></div>';
      return;
    }

    container.innerHTML = '';
    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    // Render beni_notes audio files
    notes.forEach(function(n) {
      if (!n.photo_url) return;
      // Extract transcript from note_text — only if it's real Hebrew text
      var noteTranscript = null;
      var noteTitle = n.note_text || 'הקלטה קולית';
      if (n.note_text && n.note_text.startsWith('🎙️ ')) {
        var rawText = n.note_text.replace(/^🎙️ /, '').trim();
        // Real transcript = not a filename, not a duration, longer than 15 chars
        var isFilename = /\.(m4a|mp3|3gp|wav|webm|mp4)$/i.test(rawText) || rawText.includes('Call recording') || rawText.includes('Voice_');
        var isDuration = /^\d+:\d+$/.test(rawText);
        var isShort    = rawText.length < 15;
        if (!isFilename && !isDuration && !isShort) {
          noteTranscript = rawText;
          noteTitle = rawText.substring(0, 60);
        }
      }
      var card = buildRecordingCard({
        id:        'note_' + n.id,
        rawId:     n.id,
        source:    'beni_notes',
        audioUrl:  n.photo_url,
        title:     noteTitle,
        date:      n.created_at,
        transcript: noteTranscript,
        projectId: n.project_id,
        processed: !!noteTranscript
      });
      list.appendChild(card);
    });

    // Render voice_memos
    memos.forEach(function(m) {
      var audioUrl = m.transcript && m.transcript.startsWith('http') ? m.transcript : null;
      if (!audioUrl) return;
      // Real transcript = text that doesn't start with http
      var realTranscript = (m.transcript && !m.transcript.startsWith('http')) ? m.transcript : null;
      // Also check ai_summary — if it's a real sentence it IS the transcript
      if (!realTranscript && m.ai_summary && m.ai_summary.length > 20 && !m.ai_summary.startsWith('הקלטה')) {
        realTranscript = m.ai_summary;
      }
      var card = buildRecordingCard({
        id:        'memo_' + m.id,
        rawId:     m.id,
        source:    'voice_memos',
        audioUrl:  audioUrl,
        title:     m.ai_summary || ('הקלטה ' + Math.floor((m.duration_sec||0)/60) + ':' + String((m.duration_sec||0)%60).padStart(2,'0')),
        date:      m.created_at,
        transcript: realTranscript,
        processed: !!realTranscript
      });
      list.appendChild(card);
    });

    container.appendChild(list);
  } catch(e) { container.innerHTML = '<div style="color:#ef4444;padding:20px;direction:rtl;">שגיאה: ' + e.message + '</div>'; }
}

function buildRecordingCard(item) {
  var card = document.createElement('div');
  card.id = 'rec-card-' + item.id;
  card.style.cssText = 'background:#1e1e35;border:1px solid rgba(139,92,246,0.2);border-radius:14px;padding:14px;direction:rtl;';

  var date = new Date(item.date).toLocaleDateString('he-IL') + ' ' +
             new Date(item.date).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
  hdr.innerHTML = '<div style="font-size:13px;font-weight:700;color:#c4b5fd;">🎙️ ' + (item.title||'הקלטה').replace(/</g,'&lt;') + '</div>' +
                  '<div style="font-size:11px;color:#aaa;font-weight:600;margin-top:2px;">📅 ' + date + '</div>';
  card.appendChild(hdr);

  // Audio player
  var audio = document.createElement('audio');
  audio.controls = true;
  audio.style.cssText = 'width:100%;margin-bottom:10px;border-radius:8px;';
  audio.src = item.audioUrl;
  card.appendChild(audio);

  // Transcript area — show immediately if exists
  var transDiv = document.createElement('div');
  transDiv.id = 'trans-' + item.id;
  transDiv.style.cssText = 'font-size:12px;color:#e2e8f0;background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-bottom:10px;direction:rtl;line-height:1.8;display:' + (item.transcript ? 'block' : 'none') + ';';
  if (item.transcript) {
    transDiv.innerHTML = '<div style="font-size:10px;color:#555;margin-bottom:6px;">📝 תמלול:</div>' + item.transcript.replace(/</g,'&lt;').replace(/\n/g,'<br>');
  }
  card.appendChild(transDiv);

  // Action buttons
  var acts = document.createElement('div');
  acts.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  // Always show transcribe button — ElevenLabs with speaker diarization
  var transBtn = document.createElement('button');
  transBtn.id = 'trans-btn-' + item.id;
  transBtn.textContent = item.transcript ? '🔄 תמלל שוב' : '🤖 תמלל עם AI';
  transBtn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none;color:#fff;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;';
  transBtn.addEventListener('click', (function(itm){ return function(){ transcribeRecording(itm); }; })(item));
  acts.appendChild(transBtn);
  
  // Transcript actions — copy + project selector + save
  if (item.transcript) {
    // Project selector for saving
    var recProjSel = document.createElement('select');
    recProjSel.style.cssText = 'font-size:11px;background:#1a1a2e;border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:6px 8px;border-radius:8px;font-family:Heebo,sans-serif;direction:rtl;cursor:pointer;max-width:150px;flex-shrink:0;';
    var defOpt2 = document.createElement('option');
    defOpt2.value = item.projectId || '';
    defOpt2.textContent = item.projectId ? '🏗️ מקושר' : '📁 בחר פרויקט';
    recProjSel.appendChild(defOpt2);
    (window.allProjects || []).forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.project_name;
      if (p.id == item.projectId) opt.selected = true;
      recProjSel.appendChild(opt);
    });
    acts.appendChild(recProjSel);

    // Copy button
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 העתק';
    copyBtn.style.cssText = 'background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;padding:8px 10px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    copyBtn.addEventListener('click', (function(t){ return function(){
      navigator.clipboard.writeText(t).then(function(){ showToast('✅ הועתק', 'success'); });
    }; })(item.transcript));
    acts.appendChild(copyBtn);

    // Save to notes with selected project
    var toNotesBtn = document.createElement('button');
    toNotesBtn.textContent = '📝 שמור להערות';
    toNotesBtn.style.cssText = 'background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:8px 10px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    toNotesBtn.addEventListener('click', (function(itm, sel){ return function(){
      var pid = sel.value || itm.projectId || null;
      if (!pid) { showToast('בחר פרויקט תחילה', 'error'); return; }
      sb.from('beni_notes').insert({
        note_text: itm.transcript, color:'yellow', note_type:'text',
        project_id: pid, created_at: new Date().toISOString()
      }).then(function(){
        // Also update the recording itself with project_id
        var table = itm.source === 'voice_memos' ? 'voice_memos' : 'beni_notes';
        fetch(SB_URL+'/rest/v1/'+table+'?id=eq.'+itm.rawId,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({project_id:pid})});
        var pname = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
        showToast('✅ נשמר להערות — ' + pname, 'success');
        sel.style.borderColor = '#22c55e'; sel.style.color = '#86efac';
      });
    }; })(item, recProjSel));
    acts.appendChild(toNotesBtn);
  }

  // Route to task button
  var taskBtn = document.createElement('button');
  taskBtn.textContent = '✅ צור משימה';
  taskBtn.style.cssText = 'background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.4);color:#86efac;padding:8px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;';
  taskBtn.addEventListener('click', (function(itm){ return function(){
    var t = document.getElementById('trans-' + itm.id);
    var text = (t && t.textContent) || itm.title || 'משימה מהקלטה';
    sb.from('reminders').insert({ text: text.substring(0,200), priority:'רגיל', is_done:false, created_at:new Date().toISOString() });
    showToast('✅ משימה נוצרה', 'success');
  }; })(item));
  acts.appendChild(taskBtn);

  // Route to safety button
  var safeBtn = document.createElement('button');
  safeBtn.textContent = '🛡️ בטיחות';
  safeBtn.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;padding:8px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;';
  safeBtn.addEventListener('click', function(){ switchTab('safety'); showToast('🛡️ עבור לניתוח בטיחות', 'success'); });
  acts.appendChild(safeBtn);

  // Delete button
  var delBtn = document.createElement('button');
  delBtn.textContent = '🗑️';
  delBtn.title = 'מחק הקלטה';
  delBtn.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#666;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;';
  delBtn.addEventListener('click', (function(itm, c){ return function() {
    if (!confirm('מחק הקלטה זו?')) return;
    var table = itm.source === 'voice_memos' ? 'voice_memos' : 'beni_notes';
    fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + itm.rawId, {
      method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }).then(function(){ c.style.opacity='0.3'; setTimeout(function(){ c.remove(); },300); showToast('🗑️ נמחק','success'); });
  }; })(item, card));
  acts.appendChild(delBtn);

  card.appendChild(acts);

  // ARC timer for transcription
  var arcEl = document.createElement('div');
  arcEl.id = 'rec-arc-' + item.id;
  arcEl.style.marginTop = '8px';
  card.appendChild(arcEl);

  return card;
}

async function transcribeRecording(item) {
  var elKey = APP && APP.config && APP.config.elevenlabs_key;
  if (!elKey) { showToast('חסר מפתח ElevenLabs — הוסף elevenlabs_key ב-app_config', 'error'); return; }

  var btn    = document.getElementById('trans-btn-' + item.id);
  var outDiv = document.getElementById('trans-' + item.id);
  var arcEl  = document.getElementById('rec-arc-' + item.id);

  if (btn) { btn.disabled = true; btn.textContent = '⏳ מתמלל...'; }
  if (arcEl && window.arc) arc.start(arcEl);

  try {
    showToast('⏳ מוריד קובץ...', 'success');
    if (!elKey) throw new Error('מפתח ElevenLabs חסר — הוסף elevenlabs_key ב-app_config');

    // Fetch original audio
    var audioRes = await fetch(item.audioUrl);
    if (!audioRes.ok) throw new Error('שגיאה בהורדת קובץ: ' + audioRes.status);
    var audioBlob = await audioRes.blob();
    if (audioBlob.size < 100) throw new Error('קובץ ריק — ייתכן שנמחק מהענן');

    // Check if format is supported by ElevenLabs
    var urlL = (item.audioUrl||'').toLowerCase();
    var is3gp = urlL.includes('.3gp') || audioBlob.type.includes('3gpp');
    var elFile;

    if (is3gp) {
      // Convert 3gp → WAV via Web Audio API (decode then encode PCM)
      showToast('🔄 ממיר 3gp → WAV...', 'success');
      try {
        var arrayBuf = await audioBlob.arrayBuffer();
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var decoded  = await audioCtx.decodeAudioData(arrayBuf);
        audioCtx.close();
        // Encode as WAV
        var numCh = decoded.numberOfChannels;
        var sr    = decoded.sampleRate;
        var len   = decoded.length;
        var buf   = new ArrayBuffer(44 + len * numCh * 2);
        var view  = new DataView(buf);
        var writeStr = function(o,s){ for(var i=0;i<s.length;i++) view.setUint8(o+i,s.charCodeAt(i)); };
        writeStr(0,'RIFF'); view.setUint32(4,36+len*numCh*2,true);
        writeStr(8,'WAVE'); writeStr(12,'fmt '); view.setUint32(16,16,true);
        view.setUint16(20,1,true); view.setUint16(22,numCh,true);
        view.setUint32(24,sr,true); view.setUint32(28,sr*numCh*2,true);
        view.setUint16(32,numCh*2,true); view.setUint16(34,16,true);
        writeStr(36,'data'); view.setUint32(40,len*numCh*2,true);
        var offset = 44;
        for (var i=0;i<len;i++) {
          for (var ch=0;ch<numCh;ch++) {
            var s = Math.max(-1,Math.min(1,decoded.getChannelData(ch)[i]));
            view.setInt16(offset,s<0?s*0x8000:s*0x7FFF,true);
            offset += 2;
          }
        }
        elFile = new File([buf], 'audio.wav', {type:'audio/wav'});
        showToast('✅ הומר ל-WAV — ' + Math.round(elFile.size/1024) + 'KB', 'success');
      } catch(convErr) {
        throw new Error('המרת 3gp נכשלה: ' + convErr.message + '. העלה קובץ m4a במקום');
      }
    } else {
      // Supported format — send as-is with correct extension
      var audioExt = 'm4a';
      if (urlL.includes('.mp3')) audioExt='mp3';
      else if (urlL.includes('.wav')) audioExt='wav';
      else if (urlL.includes('.ogg')) audioExt='ogg';
      else if (urlL.includes('.webm')) audioExt='webm';
      else if (urlL.includes('.mp4')) audioExt='mp4';
      var mimeMap2 = {mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',mp4:'audio/mp4'};
      elFile = new File([audioBlob], 'audio.' + audioExt, {type: mimeMap2[audioExt]||'audio/mp4'});
    }

    showToast('🎙️ שולח ל-ElevenLabs — ' + Math.round(elFile.size/1024) + 'KB...', 'success');
    var efd = new FormData();
    efd.append('file', elFile);
    efd.append('model_id', 'scribe_v1');
    efd.append('language_code', 'heb');
    efd.append('diarize', 'true');
    efd.append('timestamps_granularity', 'word');
    showToast('🎙️ ElevenLabs מתמלל עם זיהוי דוברים...', 'success');
    var eres = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elKey },
      body: efd
    });
    if (!eres.ok) {
      var eErrText = await eres.text().catch(function(){ return ''; });
      console.error('ElevenLabs raw error:', eErrText);
      var eErr = {};
      try { eErr = JSON.parse(eErrText); } catch(e) {}
      var errMsg = eErr.detail && typeof eErr.detail === 'string' ? eErr.detail :
                   eErr.detail && eErr.detail.message ? eErr.detail.message :
                   eErr.message || eErrText.substring(0,100) || eres.status;
      throw new Error('ElevenLabs ' + eres.status + ': ' + errMsg);
    }
    var edata = await eres.json();
    var text = formatElevenLabsTranscript(edata);
    if (!text) throw new Error('לא התקבל תמלול מ-ElevenLabs');
    if (arcEl && window.arc) arc.finish(0, text.split(' ').length);

    // Save transcript
    if (item.source === 'voice_memos') {
      await fetch(SB_URL + '/rest/v1/voice_memos?id=eq.' + item.rawId, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ transcript: text, is_processed: true, ai_summary: text.substring(0,100) })
      });
    } else {
      await fetch(SB_URL + '/rest/v1/beni_notes?id=eq.' + item.rawId, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ note_text: '🎙️ ' + text.substring(0,200) })
      });
    }

    // Show transcript with speaker formatting
    if (outDiv) {
      outDiv.style.display = 'block';
      outDiv.innerHTML = '<div style="font-size:10px;color:#555;margin-bottom:8px;direction:rtl;">📝 תמלול ElevenLabs — זיהוי דוברים:</div>' +
        text.replace(/</g,'&lt;')
            .replace(/\[\d{2}:\d{2}\] דובר \d/g, function(m){ return '<strong style="color:#c4b5fd;">' + m + '</strong>'; })
            .replace(/\n/g,'<br>');
    }
    if (btn) btn.remove(); // Remove transcribe button — already done

    // Add copy + save buttons dynamically
    var actsEl = outDiv ? outDiv.nextSibling : null;
    var actRow = document.createElement('div');
    actRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;';

    var cpyBtn = document.createElement('button');
    cpyBtn.textContent = '📋 העתק תמלול';
    cpyBtn.style.cssText = 'background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;padding:8px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    cpyBtn.onclick = function(){ navigator.clipboard.writeText(text).then(function(){ showToast('✅ הועתק','success'); }); };
    actRow.appendChild(cpyBtn);

    var saveBtn = document.createElement('button');
    saveBtn.textContent = '📝 שמור להערות';
    saveBtn.style.cssText = 'background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:8px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    saveBtn.onclick = function(){
      var cardEl = saveBtn.closest ? saveBtn.closest('[id^="rec-card-"]') : null;
      var sel = cardEl ? cardEl.querySelector('select') : null;
      var pid = sel ? sel.value : null;
      if (!pid) { showToast('בחר פרויקט תחילה','error'); return; }
      sb.from('beni_notes').insert({ note_text: text, color:'yellow', note_type:'text', project_id:pid, created_at:new Date().toISOString() })
        .then(function(){ showToast('✅ נשמר להערות','success'); saveBtn.style.borderColor='#22c55e'; saveBtn.style.color='#86efac'; });
    };
    actRow.appendChild(saveBtn);

    // Smart analysis button
    var analyzeBtn = document.createElement('button');
    analyzeBtn.textContent = '🧠 נתח שיחה';
    analyzeBtn.style.cssText = 'background:linear-gradient(135deg,#1e3a5f,#2563eb);border:none;color:#fff;padding:8px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    analyzeBtn.onclick = function(){
      var cardEl = analyzeBtn.closest ? analyzeBtn.closest('[id^="rec-card-"]') : null;
      var sel = cardEl ? cardEl.querySelector('select') : null;
      var pid = sel ? sel.value : null;
      openCallAnalysisModal(text, pid, item);
    };
    actRow.appendChild(analyzeBtn);

    if (outDiv && outDiv.parentNode) outDiv.parentNode.insertBefore(actRow, outDiv.nextSibling);
    showToast('✅ תמלול הושלם — ' + text.split(' ').length + ' מילים', 'success');

  } catch(e) {
    if (arcEl && window.arc) arc.reset();
    if (btn) { btn.disabled = false; btn.textContent = '🤖 תמלל עם AI'; }
    showToast('❌ ' + e.message, 'error');
  }
}
// ══ END SMART JOURNAL INLINE