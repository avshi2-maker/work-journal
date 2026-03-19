// ══════════════════════════════════════════════════════
// FIELD INTELLIGENCE — הקלטות שדה → CRM
// ══════════════════════════════════════════════════════

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
      SUPABASE_URL_CONST + '/rest/v1/voice_memos?created_at=gte.' + from + '&order=created_at.desc&limit=30',
      { headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST } }
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
        btnNote.dataset.priority = priority;
        btnNote.addEventListener('click', function(){ fiSaveNote(this.dataset.id, this.dataset.summary, this.dataset.priority); });
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

async function fiCreateTask(memoId, summary) {
  try {
    // Save to reminders (Beni Pocket) regardless
    await fetch(SUPABASE_URL_CONST + '/rest/v1/reminders', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ text: summary, source: 'voice', is_done: false, created_at: new Date().toISOString() })
    });
    await fiMarkDone(memoId);
    showToast('✅ משימה נוצרה — מסונכרן ב-Beni Pocket', 'success');
    loadBeniTasks();
  } catch(e) { showToast('שגיאה: ' + e.message, 'error'); }
}

async function fiSaveNote(memoId, summary, priority) {
  var colorMap = { 'גבוה':'red', 'רגיל':'yellow', 'נמוך':'green' };
  var color = colorMap[priority] || 'yellow';
  try {
    var res = await sb.from('beni_notes').insert({ note_text: summary, color: color, project_id: null });
    if (res.error) throw res.error;
    await fiMarkDone(memoId);
    showToast('📝 נשמר ביומן החכם', 'success');
  } catch(e) { showToast('שגיאה: ' + e.message, 'error'); }
}

async function fiLinkProject(memoId, projectId) {
  if (!projectId) return;
  try {
    var mRes = await fetch(
      SUPABASE_URL_CONST + '/rest/v1/voice_memos?id=eq.' + memoId + '&select=transcript,ai_result',
      { headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST } }
    );
    var mData = await mRes.json();
    var memo = mData[0];
    var ai = null;
    try { ai = memo && memo.ai_result ? (typeof memo.ai_result === 'string' ? JSON.parse(memo.ai_result) : memo.ai_result) : null; } catch(e){}
    var text = (ai && ai.summary) || (memo && memo.transcript ? memo.transcript.substring(0, 200) : 'הקלטת שדה');
    var proj = (window.allProjects || []).find(function(p){ return p.id === projectId; });
    var noteText = (proj ? '📁 ' + proj.project_name + '\n' : '') + text;
    var res2 = await sb.from('beni_notes').insert({ note_text: noteText, color: 'blue', project_id: projectId });
    if (res2.error) throw res2.error;
    await fiMarkDone(memoId);
    showToast('📁 קושר לפרויקט ' + (proj ? proj.project_name : ''), 'success');
  } catch(e) { showToast('שגיאה: ' + e.message, 'error'); }
}

async function fiMarkDone(memoId) {
  try {
    await fetch(SUPABASE_URL_CONST + '/rest/v1/voice_memos?id=eq.' + memoId, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ is_processed: true })
    });
    var card = document.getElementById('fi-memo-' + memoId);
    if (card) { card.style.opacity = '0.35'; card.style.transition = 'opacity 0.4s'; }
    setTimeout(function(){ loadFieldIntel(); }, 900);
  } catch(e) { console.error(e); }
}


