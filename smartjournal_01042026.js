// ══ SMART JOURNAL — 6 TABS ═════════════════════════════════════════
var _sjActiveTab    = 'notes';
var _sjProjectId    = '';
var _sjProjects     = []; // cached projects for dropdowns

async function sjGetProjects() {
  if (_sjProjects.length) return _sjProjects;
  // Try window.allProjects first
  if (window.allProjects && window.allProjects.length) {
    _sjProjects = (window.allProjects||[]).slice();
    return _sjProjects;
  }
  // Fetch directly from Supabase
  try {
    var res = await fetch(SB_URL + '/rest/v1/projects?select=id,project_name&order=project_name.asc&limit=100',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    _sjProjects = res.ok ? await res.json() : [];
  } catch(e) { _sjProjects = []; }
  return _sjProjects;
}

function sjProjectOptionsHtml(projects) {
  return '<option value="">📁 קשר לפרויקט...</option>'
    + projects.map(function(p){
        return '<option value="'+p.id+'">'+(p.project_name||'').replace(/</g,'&lt;')+'</option>';
      }).join('');
}
var _sjProjectName  = '';

function _switchSmartTabReal(tab) {
  _sjActiveTab = tab;
  ['notes','photos','videos','takeoffs','recordings','ocr'].forEach(function(t) {
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

// ── AUDIO TRANSCRIBE via OpenAI Whisper ─────────────────────────────
async function sjTranscribeAudio(noteId, audioUrl) {
  var btn = document.getElementById('trans-btn-' + noteId);
  var result = document.getElementById('trans-result-' + noteId);
  if (!btn || !result) return;
  var openaiKey = (APP.config && APP.config.openai_key) || null;
  if (!openaiKey) { alert('הוסף openai_key לטבלת app_config'); return; }
  btn.textContent = '⏳ מתמלל...';
  btn.disabled = true;
  var _wStartTime = Date.now();
  try {
    // Fetch audio from Cloudinary
    var audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error('לא ניתן להוריד את ההקלטה');
    var audioBlob = await audioRes.blob();
    // OpenAI Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB)
    var ext = audioUrl.split('.').pop().split('?')[0] || 'mp3';
    var mimeMap = { mp3:'audio/mpeg', mp4:'audio/mp4', m4a:'audio/mp4', wav:'audio/wav', webm:'audio/webm', ogg:'audio/ogg' };
    var mime = mimeMap[ext] || 'audio/mpeg';
    // Convert audio to WAV via Web Audio API — works for any format Android produces
    var arrayBuffer = await audioBlob.arrayBuffer();
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var audioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch(decodeErr) {
      // Can't decode — try sending as-is with mp4 mime
      console.warn('Audio decode failed, sending raw:', decodeErr);
      var audioFile = new File([audioBlob], 'recording.mp4', { type: 'audio/mp4' });
      var fd = new FormData();
      fd.append('file', audioFile);
      fd.append('model', 'whisper-1');
      fd.append('language', 'he');
      fd.append('response_format', 'text');
      var res2 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + openaiKey }, body: fd
      });
      if (!res2.ok) throw new Error('פורמט לא נתמך — נסה לשמור ההקלטה כ-MP3');
      var text2 = (await res2.text()).trim();
      result.innerHTML = '<div style="font-weight:700;color:#fde68a;margin-bottom:4px;">📝 תמלול:</div>' + text2.replace(/</g,'&lt;');
      result.style.display = 'block';
      btn.textContent = '✅ תומלל';
      await window.sb.from('beni_notes').update({ note_text: '🎙️ ' + text2 }).eq('id', noteId);
      return;
    }
    audioCtx.close();
    // Encode to WAV
    var numChannels = audioBuffer.numberOfChannels;
    var sampleRate = audioBuffer.sampleRate;
    var pcmData = audioBuffer.getChannelData(0); // mono
    var wavBuffer = new ArrayBuffer(44 + pcmData.length * 2);
    var view = new DataView(wavBuffer);
    var writeStr = function(offset, str) { for (var i=0;i<str.length;i++) view.setUint8(offset+i, str.charCodeAt(i)); };
    writeStr(0,'RIFF'); view.setUint32(4,36+pcmData.length*2,true);
    writeStr(8,'WAVE'); writeStr(12,'fmt '); view.setUint32(16,16,true);
    view.setUint16(20,1,true); view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
    view.setUint16(32,2,true); view.setUint16(34,16,true);
    writeStr(36,'data'); view.setUint32(40,pcmData.length*2,true);
    var offset = 44;
    for (var i=0;i<pcmData.length;i++,offset+=2) {
      var s = Math.max(-1,Math.min(1,pcmData[i]));
      view.setInt16(offset,s<0?s*0x8000:s*0x7FFF,true);
    }
    var audioFile = new File([wavBuffer], 'recording.wav', { type: 'audio/wav' });
    // Send to Whisper API
    var fd = new FormData();
    fd.append('file', audioFile);
    fd.append('model', 'whisper-1');
    fd.append('language', 'he'); // Hebrew
    fd.append('response_format', 'text');
    var res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + openaiKey },
      body: fd
    });
    if (!res.ok) {
      var errData = await res.json();
      throw new Error(errData.error ? errData.error.message : 'Whisper error ' + res.status);
    }
    var text = await res.text();
    text = text.trim();
    if (!text) throw new Error('לא זוהה טקסט בהקלטה');
    var elapsed = ((Date.now() - _wStartTime) / 1000).toFixed(1);
    result.innerHTML = '<div style="font-weight:700;color:#fde68a;margin-bottom:4px;">📝 תמלול:</div>'
      + '<div style="white-space:pre-wrap;line-height:1.6;">' + text.replace(/</g,'&lt;') + '</div>'
      + '<div style="font-size:10px;color:#555;margin-top:4px;">⏱ ' + elapsed + 'שנ · Whisper API</div>'
      + '<button onclick="sjTranscribeAudio(&quot;' + noteId + '&quot;,&quot;' + audioUrl + '&quot;)" style="margin-top:6px;width:100%;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;border-radius:6px;padding:5px;font-size:10px;cursor:pointer;">🔄 תמלל שוב</button>';
    result.style.display = 'block';
    btn.textContent = '✅ תומלל';
    await window.sb.from('beni_notes').update({ note_text: '🎙️ ' + text }).eq('id', noteId);
    if (typeof showToast === 'function') showToast('✅ תמלול נשמר');
  } catch(e) {
    btn.textContent = '🔄 נסה שוב';
    btn.disabled = false;
    result.innerHTML = '<div style="color:#fca5a5;">שגיאה: ' + e.message + '</div>';
    result.style.display = 'block';
    console.error('whisper:', e);
  }
}

// ── OCR STOP ────────────────────────────────────────────────────────
var _ocrAborted = false;
var _ocrTimerInterval = null;
function journalOcrStop() {
  _ocrAborted = true;
  if (_ocrTimerInterval) { clearInterval(_ocrTimerInterval); _ocrTimerInterval = null; }
  var loading = document.getElementById('journal-ocr-loading');
  var runBtn  = document.getElementById('ocr-run-btn');
  if (loading) loading.style.display = 'none';
  if (runBtn)  { runBtn.textContent = '🔄 הרץ שוב'; runBtn.disabled = false; }
  if (typeof showToast === 'function') showToast('⏹️ עצרת את התהליך');
}

// ── AI METER HELPER ─────────────────────────────────────────────────
// Returns {startTimer, stopTimer, showMeter, hideMeter}
function sjAIMeter(resultEl, stopBtnId) {
  var startTime = Date.now();
  var interval = setInterval(function() {
    var el = document.getElementById(stopBtnId + '-time');
    if (el) el.textContent = Math.round((Date.now()-startTime)/1000) + 's';
  }, 500);
  return {
    startTime: startTime,
    interval: interval,
    stop: function() { clearInterval(interval); },
    showResult: function(data, el) {
      clearInterval(interval);
      var inTok  = data.usage ? data.usage.input_tokens  : 0;
      var outTok = data.usage ? data.usage.output_tokens : 0;
      var cost   = (inTok*0.000003 + outTok*0.000015).toFixed(4);
      var secs   = ((Date.now()-startTime)/1000).toFixed(1);
      if (el) {
        var meter = document.createElement('div');
        meter.style.cssText = 'font-size:10px;color:#555;margin-top:4px;';
        meter.textContent = '⏱ ' + secs + 'שנ · 🪙 ' + (inTok+outTok) + ' טוקנים · 💰 $' + cost;
        el.appendChild(meter);
      }
    }
  };
}

// ── PHOTO AI ANALYSIS ───────────────────────────────────────────────
async function sjPhotoSafetyAnalysis(noteId, imgUrl) {
  var resultDiv = document.getElementById('photo-ai-result-' + noteId);
  if (!resultDiv) return;
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { alert('מפתח Anthropic חסר'); return; }
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div style="color:#888;font-size:11px;">⏳ מנתח בטיחות... <span id="saf-time-'+noteId+'">0s</span></div>'
    + '<button onclick="this.parentElement.innerHTML=\'בוטל\'" style="font-size:10px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:4px;padding:2px 6px;cursor:pointer;margin-top:4px;">⏹️ עצור</button>';
  var meter = sjAIMeter(resultDiv, 'saf-'+noteId);
  try {
    var imgRes = await fetch(imgUrl);
    var imgBlob = await imgRes.blob();
    var base64 = await new Promise(function(r){ var reader=new FileReader(); reader.onload=function(e){r(e.target.result.split(',')[1]);}; reader.readAsDataURL(imgBlob); });
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/jpeg',data:base64}},
        {type:'text',text:'נתח את התמונה מבחינת בטיחות באתר בנייה. זהה סכנות בטיחות, הפרות של תקני בטיחות, ציוד מגן אישי חסר. ענה בעברית בצורה קצרה ותכליתית. פורמט: ✅/⚠️/🚨 לכל ממצא.'}
      ]}]})
    });
    var data = await res.json();
    var text = data.content && data.content[0] ? data.content[0].text : 'אין ממצאים';
    resultDiv.innerHTML = '<div style="white-space:pre-wrap;line-height:1.6;">' + text.replace(/</g,'&lt;') + '</div>';
    meter.showResult(data, resultDiv);
    resultDiv.innerHTML += '<button onclick="sjPhotoSafetyAnalysis(&quot;'+noteId+'&quot;,&quot;'+imgUrl+'&quot;)" style="margin-top:6px;width:100%;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;border-radius:6px;padding:5px;font-size:10px;cursor:pointer;">🔄 הרץ שוב</button>';
  } catch(e) { meter.stop(); resultDiv.textContent = 'שגיאה: ' + e.message; }
}

async function sjPhotoSnagAnalysis(noteId, imgUrl) {
  var resultDiv = document.getElementById('photo-ai-result-' + noteId);
  if (!resultDiv) return;
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { alert('מפתח Anthropic חסר'); return; }
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div style="color:#888;font-size:11px;">⏳ מזהה ליקויים... <span id="snag-time-'+noteId+'">0s</span></div>'
    + '<button onclick="this.parentElement.innerHTML=\'בוטל\'" style="font-size:10px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;border-radius:4px;padding:2px 6px;cursor:pointer;margin-top:4px;">⏹️ עצור</button>';
  var meter = sjAIMeter(resultDiv, 'snag-'+noteId);
  try {
    var imgRes = await fetch(imgUrl);
    var imgBlob = await imgRes.blob();
    var base64 = await new Promise(function(r){ var reader=new FileReader(); reader.onload=function(e){r(e.target.result.split(',')[1]);}; reader.readAsDataURL(imgBlob); });
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/jpeg',data:base64}},
        {type:'text',text:'זהה ליקויים ופגמים בתמונה זו מאתר בנייה/שיפוץ. קטגוריות: בטון, מתכת, טיח, צבע, אינסטלציה, חשמל, ריצוף, דלתות, עבודת נגרות. ענה בעברית: קטגוריה + תיאור הליקוי + חומרת: קל/בינוני/חמור.'}
      ]}]})
    });
    var data = await res.json();
    var text = data.content && data.content[0] ? data.content[0].text : 'לא נמצאו ליקויים';
    resultDiv.innerHTML = '<div style="white-space:pre-wrap;line-height:1.6;">' + text.replace(/</g,'&lt;') + '</div>';
    meter.showResult(data, resultDiv);
    resultDiv.innerHTML += '<button onclick="sjPhotoSnagAnalysis(&quot;'+noteId+'&quot;,&quot;'+imgUrl+'&quot;)" style="margin-top:6px;width:100%;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;border-radius:6px;padding:5px;font-size:10px;cursor:pointer;">🔄 הרץ שוב</button>';
  } catch(e) { meter.stop(); resultDiv.textContent = 'שגיאה: ' + e.message; }
}

// ── DELETE + LINK HELPERS ───────────────────────────────────────────
async function sjDeleteTakeoff(id) {
  if (!confirm('מחוק מדידה זו?')) return;
  await window.sb.from('site_takeoffs').delete().eq('id', id);
  sjLoadTakeoffs();
  if (typeof showToast === 'function') showToast('🗑️ מדידה נמחקה');
}

async function sjLinkProject(table, id, projectId) {
  if (!projectId) return;
  var proj = (window.allProjects||[]).find(function(p){ return p.id === projectId; });
  var updateData = { project_id: projectId };
  if (proj) updateData.project_name = proj.project_name;
  await window.sb.from(table).update(updateData).eq('id', id);
  if (typeof showToast === 'function') showToast('✅ קושר לפרויקט: ' + (proj ? proj.project_name : ''));
}

async function sjDeleteNote(id, type) {
  if (!confirm('מחוק?')) return;
  if (typeof deleteNote === 'function') await deleteNote(id);
  else await window.sb.from('beni_notes').delete().eq('id', id);
  if (type === 'photo') sjLoadPhotos();
  else if (type === 'video') sjLoadVideos();
  else if (type === 'audio') sjLoadVoiceMemos();
  if (typeof showToast === 'function') showToast('🗑️ נמחק');
}

// ── PHOTOS TAB ──────────────────────────────────────────────────────
async function sjLoadPhotos() {
  var grid     = document.getElementById('sj-photos-grid');
  var countEl  = document.getElementById('sj-photos-count');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#555;font-size:13px;">טוען תמונות...</div>';
  var _projects = await sjGetProjects();

  try {
    var query = 'select=id,note_text,photo_url,color,created_at,project_id&photo_url=not.is.null&order=created_at.desc&limit=60';
    if (_sjProjectId) query += '&project_id=eq.' + _sjProjectId;

    var res  = await sbQ('beni_notes', query);
    var notes = (res.data || []).filter(function(n) {
      var url = n.photo_url || '';
      var isVideo = url.includes('drive.google.com') || url.includes('/beni_field/') && url.includes('/video/') || /\.(mp4|mov|avi)/i.test(url);
      var isAudio = url.includes('/beni_voice/') || /\.(mp3|m4a|ogg|wav|webm)/i.test(url);
      return !isVideo && !isAudio; // photos only
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

      var imgSrc = url;
      if (imgSrc.includes('res.cloudinary.com') && /\.heic/i.test(imgSrc)) {
        imgSrc = imgSrc.replace('/upload/', '/upload/f_jpg,q_auto/');
      }
      var div = document.createElement('div');
      div.style.cssText = 'position:relative;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);aspect-ratio:1;background:#0a0a1a;';

      var img = document.createElement('img');
      img.src = imgSrc;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;cursor:pointer;';
      img.onerror = function(){ this.style.display='none'; };
      img.addEventListener('click', function(){ openLightbox(imgSrc, n.note_text||''); });

      var cap = document.createElement('div');
      cap.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));padding:16px 8px 6px;display:flex;align-items:flex-end;justify-content:space-between;';
      cap.innerHTML = '<div style="font-size:10px;color:#fff;">' + date + (proj ? ' · ' + proj.project_name.substring(0,12) : '') + '</div>'
        + '<button onclick="sjDeleteNote(\'' + n.id + '\',\'' + 'photo' + '\')" style="background:rgba(239,68,68,0.8);border:none;color:#fff;border-radius:6px;padding:3px 7px;font-size:10px;cursor:pointer;">🗑️</button>';

      div.appendChild(img); div.appendChild(cap);

      // Wrap div+project-select in container
      var wrap = document.createElement('div');
      var projSel = document.createElement('select');
      projSel.style.cssText = 'width:100%;margin-top:4px;padding:7px 10px;background:#1a3d5c;border:1px solid rgba(201,168,76,0.4);border-radius:8px;color:#fde68a;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;cursor:pointer;';
      projSel.innerHTML = sjProjectOptionsHtml(_projects);
      var nid = n.id;
      projSel.addEventListener('change', function() { sjLinkProject('beni_notes', nid, this.value); });
      // Add safety + snag buttons
      var actionRow = document.createElement('div');
      actionRow.style.cssText = 'display:flex;gap:4px;margin-top:4px;';
      var nid2 = n.id;
      var imgUrl2 = imgSrc;
      actionRow.innerHTML = '<button onclick="sjPhotoSafetyAnalysis(&quot;' + nid2 + '&quot;,&quot;' + imgUrl2 + '&quot;)" style="flex:1;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:5px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🦺 בטיחות AI</button>'
        + '<button onclick="sjPhotoSnagAnalysis(&quot;' + nid2 + '&quot;,&quot;' + imgUrl2 + '&quot;)" style="flex:1;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;padding:5px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🔍 ליקויים</button>';
      var resultDiv = document.createElement('div');
      resultDiv.id = 'photo-ai-result-' + nid2;
      resultDiv.style.cssText = 'display:none;margin-top:4px;background:rgba(0,0,0,0.4);border-radius:6px;padding:8px;font-size:11px;color:#e8e6f0;line-height:1.6;';
      wrap.appendChild(div);
      wrap.appendChild(projSel);
      wrap.appendChild(actionRow);
      wrap.appendChild(resultDiv);
      grid.appendChild(wrap);
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
  var _projects = await sjGetProjects();

  try {
    // Query both Google Drive videos AND Cloudinary videos
    var query = 'select=id,note_text,photo_url,color,created_at,project_id&photo_url=not.is.null&order=created_at.desc&limit=60';
    if (_sjProjectId) query += '&project_id=eq.' + _sjProjectId;
    var res   = await sbQ('beni_notes', query);
    var notes = (res.data || []).filter(function(n) {
      var url = n.photo_url || '';
      var isAudio = url.includes('/beni_voice/') || /\.(mp3|m4a|ogg|wav)/i.test(url);
      var isDriveVideo = url.includes('drive.google.com');
      // Cloudinary videos: must be in video/upload path AND have video extension
      var isCldVideo = url.includes('/video/upload/') && /\.(mp4|mov|avi|webm)/i.test(url);
      var isDirectVideo = /\.(mp4|mov|avi)/i.test(url);
      return !isAudio && (isDriveVideo || isCldVideo || isDirectVideo);
    });

    if (countEl) countEl.textContent = notes.length + ' סרטונים';

    if (!notes.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#444;"><div style="font-size:40px;margin-bottom:10px;">🎬</div><div style="font-size:13px;">אין סרטונים' + (_sjProjectId ? ' לפרויקט זה' : '') + '</div></div>';
      return;
    }

    grid.innerHTML = '';
    notes.forEach(function(n) {
      var url  = n.photo_url;
      var date = new Date(n.created_at).toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'2-digit'});
      var desc = (n.note_text||'').replace(/\n.*$/,'').replace('🎬','').trim() || 'סרטון שטח';
      var proj = _projects.find(function(p){ return p.id===n.project_id; });
      var nid = n.id;

      var card = document.createElement('div');
      card.style.cssText = 'background:#1e1e35;border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:14px;margin-bottom:10px;';

      var videoHtml = url.includes('res.cloudinary.com')
        ? '<video src="'+url+'" controls playsinline style="width:100%;border-radius:8px;margin-top:8px;max-height:180px;"></video>'
        : '<a href="'+url+'" target="_blank" style="display:block;text-align:center;padding:10px;background:rgba(66,133,244,0.2);border-radius:8px;color:#4285f4;font-weight:700;text-decoration:none;margin-top:8px;">▶️ פתח סרטון</a>';

      var projOpts = sjProjectOptionsHtml(_projects);

      card.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        + '<div style="font-size:12px;font-weight:700;color:#c4b5fd;">' + desc.substring(0,50).replace(/</g,'&lt;') + '</div>'
        + '<button onclick="sjDeleteNote(&quot;'+nid+'&quot;,&quot;video&quot;)" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;">🗑️</button>'
        + '</div>'
        + '<div style="font-size:10px;color:#aaa;font-weight:700;margin-bottom:8px;">📅 ' + date + (proj ? ' · 📁 ' + proj.project_name.substring(0,15) : '') + '</div>'
        + videoHtml
        + '<div style="display:flex;gap:6px;margin-top:8px;">'
        + '<button onclick="sjSafetyAnalysis(&quot;'+nid+'&quot;,&quot;'+url+'&quot;)" style="flex:1;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🦺 בטיחות AI</button>'
        + '<button onclick="sjPhotoSnagAnalysis(&quot;'+nid+'&quot;,&quot;'+url+'&quot;)" style="flex:1;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🔍 ליקויים</button>'
        + '</div>'
        + '<select onchange="sjLinkProject(&quot;beni_notes&quot;,&quot;'+nid+'&quot;,this.value)" style="width:100%;margin-top:8px;padding:7px 10px;background:#1a3d5c;border:1px solid rgba(201,168,76,0.4);border-radius:8px;color:#fde68a;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;cursor:pointer;">'
        + projOpts + '</select>'
        + '<div id="safety-result-'+nid+'" style="display:none;margin-top:8px;font-size:11px;line-height:1.6;color:#e8e6f0;background:rgba(0,0,0,0.3);border-radius:8px;padding:8px;"></div>';

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
  var _projects = await sjGetProjects();

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
      var date = new Date(t.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      var icon = typeIcon[t.takeoff_type||'standard'] || '📐';
      var area = t.total_area ? Number(t.total_area).toFixed(1) + ' מ"ר' : '—';
      var tid = t.id;
      var projOpts = _projects.map(function(p){
        return '<option value="'+p.id+'">'+(p.project_name||'').replace(/</g,'&lt;')+'</option>';
      }).join('');
      return '<div style="background:#242438;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 16px;margin-bottom:8px;">'
        + '<div style="display:flex;align-items:center;gap:12px;">'
        + '<span style="font-size:22px;">' + icon + '</span>'
        + '<div style="flex:1;">'
        + '<div style="font-size:13px;font-weight:700;color:#fff;">' + (t.project_name||'ללא פרויקט').replace(/</g,'&lt;') + '</div>'
        + '<div style="font-size:10px;color:#aaa;margin-top:2px;font-weight:700;">📅 ' + date + ' · ' + area + '</div>'
        + '</div>'
        + '<button onclick="sjDeleteTakeoff(&quot;' + tid + '&quot;)" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">🗑️</button>'
        + '</div>'
        + '<select onchange="sjLinkProject(&quot;site_takeoffs&quot;,&quot;' + tid + '&quot;,this.value)" style="width:100%;margin-top:8px;padding:7px 10px;background:#1a3d5c;border:1px solid rgba(201,168,76,0.4);border-radius:8px;color:#fde68a;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;cursor:pointer;">'
        + '<option value="">📁 קשר לפרויקט...</option>' + projOpts
        + '</select>'
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
  var _projects = await sjGetProjects();

  try {
    var from = new Date();
    from.setDate(from.getDate() - 30);
    var fromISO = from.toISOString();

    // Load from voice_memos (old) AND beni_notes with audio URLs (new sync)
    var vmUrl = SB_URL + '/rest/v1/voice_memos?created_at=gte.' + fromISO + '&order=created_at.desc&limit=50';
    var bnUrl = SB_URL + '/rest/v1/beni_notes?photo_url=ilike.*beni_voice*&created_at=gte.' + fromISO + '&order=created_at.desc&limit=50';
    var [vmRes, bnRes] = await Promise.all([
      fetch(vmUrl, { headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } }),
      fetch(bnUrl, { headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } })
    ]);
    var memos = vmRes.ok ? await vmRes.json() : [];
    var bnNotes = bnRes.ok ? await bnRes.json() : [];
    if (countEl) countEl.textContent = (memos.length + bnNotes.length) + ' הקלטות (30 ימים אחרונים)';
    if (!memos.length && !bnNotes.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#444;"><div style="font-size:40px;margin-bottom:10px;">🎙️</div><div style="font-size:13px;">אין הקלטות מ-30 הימים האחרונים</div></div>';
      return;
    }
    var PCOLOR = { 'גבוה':'#ef4444','רגיל':'#f59e0b','נמוך':'#22c55e' };
    var CICON  = { 'משימה':'📋','בעיית_אתר':'⚠️','חומרים':'📦','לקוח':'👤','כספים':'💰','כללי':'📝' };
    var newCards = bnNotes.map(function(n) {
      var time = new Date(n.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      var nid = n.id;
      return '<div style="background:#1e1e35;border:1px solid rgba(201,168,76,0.2);border-right:4px solid #c9a84c;border-radius:12px;padding:12px 14px;margin-bottom:8px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
        + '<div style="font-size:13px;font-weight:700;color:#fde68a;">' + (n.note_text||'🎙️ הקלטה').replace(/</g,'&lt;') + '</div>'
        + '<button onclick="sjDeleteNote(&quot;' + nid + '&quot;,&quot;audio&quot;)" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">🗑️</button>'
        + '</div>'
        + '<audio controls style="width:100%;border-radius:8px;margin-bottom:8px;" src="' + n.photo_url + '"></audio>'
        + '<div style="display:flex;gap:6px;margin-bottom:6px;">'
        + '<button onclick="sjTranscribeAudio(&quot;' + nid + '&quot;,&quot;' + n.photo_url + '&quot;)" id="trans-btn-' + nid + '" style="flex:1;background:rgba(201,168,76,0.2);border:1px solid rgba(201,168,76,0.4);color:#fde68a;padding:7px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">🧠 תמלל עם AI</button>'
        + '</div>'
        + '<div id="trans-result-' + nid + '" style="display:none;background:rgba(0,0,0,0.3);border-radius:8px;padding:10px;font-size:12px;color:#e8e6f0;line-height:1.7;white-space:pre-wrap;margin-bottom:6px;"></div>'
        + '<select onchange="sjLinkProject(&quot;beni_notes&quot;,&quot;' + nid + '&quot;,this.value)" style="width:100%;margin-top:6px;padding:7px 10px;background:#1a3d5c;border:1px solid rgba(201,168,76,0.4);border-radius:8px;color:#fde68a;font-size:12px;font-weight:700;font-family:Heebo,sans-serif;cursor:pointer;">'
        + '<option value="">📁 קשר לפרויקט...</option>'
        + _projects.map(function(p){return '<option value="'+p.id+'">'+p.project_name.replace(/</g,'&lt;')+'</option>';}).join('')
        + '</select>'
        + '<div style="font-size:10px;color:#aaa;margin-top:4px;font-weight:700;">📅 ' + time + '</div>'
        + '</div>';
    }).join('');
    var oldCards = memos.map(function(m) {
      var ai = null;
      try { ai = m.ai_result ? (typeof m.ai_result==='string' ? JSON.parse(m.ai_result) : m.ai_result) : null; } catch(e){}
      var time = new Date(m.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      var summary = (ai&&ai.summary)||(m.transcript||'').substring(0,80)||'ללא תיאור';
      var pri = (ai&&ai.priority)||'רגיל';
      var cat = (ai&&ai.category)||'כללי';
      var pColor = PCOLOR[pri]||'#f59e0b';
      var cIcon = CICON[cat]||'📝';
      return '<div style="background:#242438;border:1px solid rgba(255,255,255,0.06);border-right:4px solid '+pColor+';border-radius:12px;padding:12px 14px;margin-bottom:8px;">'
        + '<div style="display:flex;align-items:flex-start;gap:8px;">'
        + '<span style="font-size:18px;">' + cIcon + '</span>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">' + summary.replace(/</g,'&lt;') + '</div>'
        + '<div style="font-size:10px;color:#555;margin-top:3px;">' + time + '</div>'
        + '</div>'
        + '<span style="background:'+pColor+'20;color:'+pColor+';border-radius:20px;padding:2px 8px;font-size:10px;font-weight:800;">'+pri+'</span>'
        + '</div></div>';
    }).join('');
    list.innerHTML = newCards + oldCards;
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:16px;font-size:13px;">שגיאה: ' + e.message + '</div>';
  }
}

// Populate smart journal project filter when notes tab opens
function _sjPopulateProjectFilterReal() {
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
  var list    = document.getElementById('eod-list');
  var picker  = document.getElementById('eod-date-picker');
  var label   = document.getElementById('eod-date-label');
  var stats   = document.getElementById('eod-stats-bar');
  var actions = document.getElementById('eod-action-bar');
  if (!list) return;

  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }
  _eodDate = dateStr;
  if (picker) picker.value = dateStr;

  // Format label
  var d = new Date(dateStr + 'T12:00:00');
  var isToday = dateStr === new Date().toISOString().split('T')[0];
  if (label) {
    label.textContent = isToday
      ? 'היום — ' + d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'})
      : d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  }

  list.innerHTML = '<div style="text-align:center;padding:30px;color:#555;font-size:13px;">טוען הקלטות...</div>';
  if (stats)   stats.style.display = 'none';
  if (actions) actions.style.display = 'none';

  try {
    var from = dateStr + 'T00:00:00.000Z';
    var to   = dateStr + 'T23:59:59.999Z';

    // Load both eod_sessions AND voice_memos for the day
    var [eodRes, voiceRes] = await Promise.all([
      fetch(SB_URL + '/rest/v1/eod_sessions?session_date=eq.' + dateStr + '&order=created_at.asc',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }),
      fetch(SB_URL + '/rest/v1/voice_memos?created_at=gte.' + from + '&created_at=lte.' + to + '&order=created_at.asc',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    ]);

    var eodSessions = eodRes.ok  ? await eodRes.json()   : [];
    var voiceMemos  = voiceRes.ok ? await voiceRes.json() : [];

    // Merge and deduplicate — mark source
    var all = [
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
    var totalTasks = 0, highCount = 0, totalSecs = 0;
    all.forEach(m => {
      var ai = _parseAI(m.ai_result);
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
  var list = document.getElementById('eod-list');
  if (!list) return;

  var PRI_COLOR  = { 'גבוה':'#ef4444', 'רגיל':'#f59e0b', 'נמוך':'#22c55e' };
  var CAT_ICON   = { 'משימה':'📋', 'בעיית_אתר':'⚠️', 'חומרים':'📦', 'לקוח':'👤', 'כספים':'💰', 'כללי':'📝', 'ביטחון':'🦺' };
  var SRC_LABEL  = { 'eod':'🧠 EOD', 'voice':'🎙️ Voice' };

  list.innerHTML = memos.map(function(m, idx) {
    var ai       = _parseAI(m.ai_result);
    var time     = new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
    var summary  = (ai?.summary) || (m.transcript||'').substring(0, 100) || 'ללא תיאור';
    var priority = ai?.priority  || 'רגיל';
    var category = ai?.category  || 'כללי';
    var actions  = ai?.action_items || [];
    var projHint = ai?.project_hint || '';
    var priColor = PRI_COLOR[priority] || '#f59e0b';
    var catIcon  = CAT_ICON[category]  || '📝';
    var srcLabel = SRC_LABEL[m._src]   || '📝';
    var mins     = m.duration_sec ? Math.round(m.duration_sec / 60) + 'ד׳' : '';

    var actionsHtml = actions.length
      ? '<div style="margin:8px 0;padding:8px 10px;background:rgba(0,0,0,0.15);border-radius:8px;">'
        + actions.map(a => '<div style="font-size:12px;color:#ccc;padding:2px 0;">▸ ' + a.replace(/</g,'&lt;') + '</div>').join('')
        + '</div>'
      : '';

    var transcriptHtml = m.transcript
      ? '<div style="font-size:11px;color:#555;font-style:italic;line-height:1.6;margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:6px;">'
        + '"' + m.transcript.substring(0,200).replace(/</g,'&lt;') + (m.transcript.length>200?'...':'') + '"'
        + '</div>'
      : '';

    var projHtml = projHint
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
  var d = new Date(_eodDate + 'T12:00:00');
  var dateLabel = d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'});
  var msg = '🧠 *יומן שטח — ' + dateLabel + '*\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';

  var taskCount = 0, highCount = 0;
  _eodData.forEach(function(m, i) {
    var ai   = _parseAI(m.ai_result);
    var time = new Date(m.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
    var sum  = ai?.summary || (m.transcript||'').substring(0,80);
    var pri  = ai?.priority || 'רגיל';
    var priEmoji = pri === 'גבוה' ? '🔴' : pri === 'נמוך' ? '🟢' : '🟡';
    if (pri === 'גבוה') highCount++;
    msg += (i+1) + '. ' + priEmoji + ' *[' + time + ']* ' + sum + '\n';
    if (ai?.action_items?.length) {
      ai.action_items.forEach(a => { msg += '   ▸ ' + a + '\n'; taskCount++; });
    }
    msg += '\n';
  });
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += '📊 סה״כ: ' + _eodData.length + ' הקלטות · ' + taskCount + ' משימות · ' + highCount + ' דחוף';

  var waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(waUrl, '_blank');
}

async function eodSaveReport() {
  if (!_eodData.length) { showToast('אין נתונים לשמירה', 'error'); return; }

  // Ask which project to attach to
  var projName = prompt('שם פרויקט (אופציונלי — לקישור לדוח):', '');

  var d = new Date(_eodDate + 'T12:00:00');
  var dateLabel = d.toLocaleDateString('he-IL', {weekday:'long', day:'numeric', month:'long'});
  var reportNum = 'EOD-' + _eodDate.replace(/-/g,'');

  var totalTasks = 0, highCount = 0, totalSecs = 0;
  var summaries = [];
  _eodData.forEach(m => {
    var ai = _parseAI(m.ai_result);
    if (ai?.summary) summaries.push(ai.summary);
    if (ai?.action_items?.length) totalTasks += ai.action_items.length;
    if (ai?.priority === 'גבוה') highCount++;
    totalSecs += (m.duration_sec || 0);
  });

  var generalNotes = _eodData.length + ' הקלטות קוליות · '
    + totalTasks + ' משימות · '
    + highCount + ' דחוף · '
    + Math.round(totalSecs/60) + ' דקות הקלטה\n\n'
    + summaries.slice(0,5).join(' | ');

  var projMatch = projName ? (allProjects||[]).find(p =>
    p.project_name.includes(projName) || projName.includes(p.project_name)) : null;

  showLoading(true);
  try {
    var { error } = await sb.from('reports').insert({
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
  var now   = new Date();
  var day   = now.getDay(); // 0=Sun
  var sunday = new Date(now);
  sunday.setDate(now.getDate() - day + (offset * 7));
  sunday.setHours(0,0,0,0);
  var saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23,59,59,999);
  return { from: sunday, to: saturday };
}

function weeklyShift(dir) {
  _weeklyOffset += dir;
  var nextBtn = document.getElementById('weekly-next-btn');
  if (nextBtn) nextBtn.style.opacity = _weeklyOffset >= 0 ? '0.3' : '1';
  loadWeeklyData();
}

async function loadWeeklyData() {
  var { from, to } = weeklyGetRange(_weeklyOffset);
  var fromISO = from.toISOString();
  var toISO   = to.toISOString();
  var fromDate = from.toISOString().split('T')[0];
  var toDate   = to.toISOString().split('T')[0];

  var label = document.getElementById('weekly-range-label');
  if (label) {
    var fStr = from.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
    var tStr = to.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
    label.textContent = fStr + ' – ' + tStr;
  }

  var nextBtn = document.getElementById('weekly-next-btn');
  if (nextBtn) nextBtn.style.opacity = _weeklyOffset >= 0 ? '0.3' : '1';

  // Hide old report
  var out = document.getElementById('weekly-report-out');
  var waBar = document.getElementById('weekly-wa-bar');
  if (out)   out.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">טוען נתונים...</div>';
  if (waBar) waBar.style.display = 'none';
  _weeklyRawData = {};
  _weeklyAIReport = '';

  try {
    var H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

    var [callRes, taskRes, takeoffRes, txnRes, memoRes, insRes] = await Promise.all([
      fetch(SB_URL+'/rest/v1/call_log?created_at=gte.'+fromISO+'&created_at=lte.'+toISO+'&order=created_at.desc&select=caller_name,direction,wa_sent,created_at', {headers:H}),
      fetch(SB_URL+'/rest/v1/reminders?is_done=eq.true&done_at=gte.'+fromISO+'&done_at=lte.'+toISO+'&select=text,source,done_at', {headers:H}),
      fetch(SB_URL+'/rest/v1/site_takeoffs?created_at=gte.'+fromISO+'&created_at=lte.'+toISO+'&select=project_name,total_area,takeoff_type,created_at', {headers:H}),
      fetch(SB_URL+'/rest/v1/contractor_transactions?transaction_date=gte.'+fromDate+'&transaction_date=lte.'+toDate+'&select=amount,type,contractors_master(company_name),projects(project_name)', {headers:H}),
      fetch(SB_URL+'/rest/v1/eod_sessions?session_date=gte.'+fromDate+'&session_date=lte.'+toDate+'&select=transcript,ai_result,duration_sec,session_date', {headers:H}),
      fetch(SB_URL+'/rest/v1/site_inspections?inspection_date=gte.'+fromDate+'&inspection_date=lte.'+toDate+'&select=inspection_date,status,project_name', {headers:H})
    ]);

    var calls      = callRes.ok     ? await callRes.json()     : [];
    var tasks      = taskRes.ok     ? await taskRes.json()     : [];
    var takeoffs   = takeoffRes.ok  ? await takeoffRes.json()  : [];
    var txns       = txnRes.ok      ? await txnRes.json()      : [];
    var memos      = memoRes.ok     ? await memoRes.json()     : [];
    var inspections= insRes.ok      ? await insRes.json()      : [];

    _weeklyRawData = { calls, tasks, takeoffs, txns, memos, inspections };

    // Stats
    var totalPaid  = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);
    var statIds    = ['ws-calls','ws-tasks','ws-takeoffs','ws-payments','ws-memos','ws-inspections'];
    var statVals   = [
      calls.length,
      tasks.length,
      takeoffs.length,
      totalPaid ? '₪'+totalPaid.toLocaleString('he-IL',{maximumFractionDigits:0}) : '0',
      memos.length,
      inspections.length
    ];
    statIds.forEach((id,i) => { var el=document.getElementById(id); if(el) el.textContent=statVals[i]; });

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
  var keyRow = document.getElementById('weekly-key-row');
  if (!keyRow) return;

  // Try APP.config first
  if (APP.config && APP.config.anthropic_key) {
    _weeklyAnthropicKey = APP.config.anthropic_key;
    keyRow.style.display = 'none';
    return;
  }
  // Try fetching from app_config table
  try {
    var res = await sbQ('app_config', 'select=key,value&key=eq.anthropic_key');
    if (res.data && res.data.length && res.data[0].value) {
      _weeklyAnthropicKey = res.data[0].value;
      keyRow.style.display = 'none';
      return;
    }
  } catch(e) {}
  keyRow.style.display = 'block';
}

async function weeklySaveKey() {
  var inp = document.getElementById('weekly-api-key');
  var key = inp ? inp.value.trim() : '';
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

  var out    = document.getElementById('weekly-report-out');
  var btn    = document.getElementById('weekly-gen-btn');
  var waBar  = document.getElementById('weekly-wa-bar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ מייצר...'; }
  if (out) out.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;"><div style="font-size:32px;margin-bottom:8px;">🧠</div>Claude מנתח את השבוע...</div>';

  var { calls=[], tasks=[], takeoffs=[], txns=[], memos=[], inspections=[] } = _weeklyRawData;
  var { from, to } = weeklyGetRange(_weeklyOffset);
  var fStr = from.toLocaleDateString('he-IL',{day:'numeric',month:'long'});
  var tStr = to.toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'});
  var totalPaid = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);
  var totalIncome = txns.filter(t=>t.type==='client_income').reduce((s,t)=>s+Number(t.amount||0),0);

  var memoSummaries = memos.slice(0,10).map(m => {
    var ai = m.ai_result ? (typeof m.ai_result==='string' ? (() => { try { return JSON.parse(m.ai_result); } catch(e){ return null; } })() : m.ai_result) : null;
    return ai?.summary || (m.transcript||'').substring(0,80);
  }).filter(Boolean).join(' | ');

  var contractorsPaid = [...new Set(txns.filter(t=>t.type==='sent').map(t=>t.contractors_master?.company_name).filter(Boolean))].join(', ');
  var projectsActive  = [...new Set([
    ...takeoffs.map(t=>t.project_name),
    ...txns.map(t=>t.projects?.project_name)
  ].filter(Boolean))].join(', ');

  var prompt = `אתה מנהל בנייה בכיר. סכם את השבוע בשטח של בני פרסקי (מנהל שטח) עבור הנהלת סטונהרד.

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
    var res = await claudeFetch(JSON.stringify({ _apiKey: _weeklyAnthropicKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      }), null);

    var data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);

    var text = data.content?.[0]?.text || '';
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
  var { from, to } = weeklyGetRange(_weeklyOffset);
  var fStr = from.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'});
  var tStr = to.toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
  var { calls=[], tasks=[], takeoffs=[], txns=[], memos=[], inspections=[] } = _weeklyRawData;
  var totalPaid = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);

  var msg = '📊 *דוח שבועי סטונהרד — ' + fStr + ' – ' + tStr + '*\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += _weeklyAIReport + '\n\n';
  msg += '━━━━━━━━━━━━━━━━━━━━\n';
  msg += '📞 שיחות: ' + calls.length + '  ✅ משימות: ' + tasks.length + '  📐 מדידות: ' + takeoffs.length + '\n';
  msg += '💸 שולם: ₪' + totalPaid.toLocaleString('he-IL',{maximumFractionDigits:0}) + '  🎙️ הקלטות: ' + memos.length + '  🔍 ביקורות: ' + inspections.length;

  var a=document.createElement('a');a.href='https://wa.me/?text='+encodeURIComponent(msg);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);
}

async function weeklySaveAsReport() {
  if (!_weeklyAIReport) return;
  var { from, to } = weeklyGetRange(_weeklyOffset);
  var reportNum = 'WKL-' + from.toISOString().split('T')[0].replace(/-/g,'');
  var { calls=[], tasks=[], takeoffs=[], txns=[] } = _weeklyRawData;
  var totalPaid = txns.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount||0),0);
  showLoading(true);
  try {
    var { error } = await sb.from('reports').insert({
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
  var el = document.getElementById('weekly-raw');
  if (!el) return;

  var section = (icon, title, count, rows) => {
    if (!count) return '';
    return '<details style="margin-bottom:10px;">'
      + '<summary style="cursor:pointer;padding:10px 14px;background:var(--surface2);border-radius:10px;font-size:13px;font-weight:700;color:var(--text);list-style:none;display:flex;justify-content:space-between;align-items:center;">'
      + '<span>' + icon + ' ' + title + '</span>'
      + '<span style="background:var(--accent);color:white;border-radius:20px;padding:1px 8px;font-size:11px;">' + count + '</span>'
      + '</summary>'
      + '<div style="padding:10px 14px;background:var(--surface);border-radius:0 0 10px 10px;border:1px solid var(--border);border-top:none;">'
      + rows + '</div></details>';
  };

  var callRows = calls.slice(0,10).map(c => {
    var t = new Date(c.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    var icon = c.direction==='missed' ? '📵' : c.direction==='outgoing' ? '📲' : '📞';
    return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">' + icon + ' ' + (c.caller_name||'לא ידוע').replace(/</g,'&lt;') + ' · ' + t + (c.wa_sent?' 💬':'') + '</div>';
  }).join('');

  var taskRows = tasks.slice(0,10).map(t =>
    '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">✅ ' + (t.text||'').substring(0,80).replace(/</g,'&lt;') + '</div>'
  ).join('');

  var takeoffRows = takeoffs.map(t =>
    '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2);">📐 ' + (t.project_name||'ללא פרויקט').replace(/</g,'&lt;') + (t.total_area ? ' · ' + Number(t.total_area).toFixed(1) + ' מ"ר' : '') + '</div>'
  ).join('');

  var txnRows = txns.slice(0,8).map(t => {
    var amt = Number(t.amount||0).toLocaleString('he-IL',{maximumFractionDigits:0});
    var type = t.type==='sent' ? '💸' : '✅';
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


function onJournalProjectChange(sel){var customRow=document.getElementById('project-custom-name-row');if(!customRow)return;if(sel.value==='__custom__'){customRow.style.display='block';document.getElementById('projectNameCustom').focus();}else{customRow.style.display='none';}}


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
    var filtered = allNotes.filter(n => n.project_id === projectId);
    renderNotes(filtered);
  }
}

// Alias — sjLoadVoiceMemos was called but function was named sjLoadRecordings
function sjLoadVoiceMemos() {
  sjLoadRecordings();
}

