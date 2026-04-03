// ══════════════════════════════════════════════════════════════════════
// ASSET INBOX — asset_inbox.js
// CRM widget: Avshi reviews + routes Beni's uploads
// ══════════════════════════════════════════════════════════════════════

var _inboxItems  = [];
var _inboxInited = false;

// ── Route destinations ─────────────────────────────────────────────────
var INBOX_ROUTES = [
  { id:'snag',      label:'🔍 ניתוח ליקויים', color:'#3b82f6',  action: _inboxRouteToSnag      },
  { id:'safety',    label:'🛡️ ניתוח בטיחות', color:'#ef4444',  action: _inboxRouteToSafety    },
  { id:'calls',     label:'📞 הקלטת שיחה',   color:'#8b5cf6',  action: _inboxRouteToCalls     },
  { id:'notes',     label:'📝 מזכר',          color:'#c9a84c',  action: _inboxRouteToNotes     },
  { id:'takeoff',   label:'📐 טייקאוף',       color:'#059669',  action: _inboxRouteToTakeoff   },
  { id:'smartscan', label:'🚀 סריקה חכמה',    color:'#7c3aed',  action: _inboxRouteToSmartScan },
  { id:'journal',   label:'📋 יומן',          color:'#1a3d5c',  action: _inboxRouteToJournal   },
];

// ── Init ───────────────────────────────────────────────────────────────
async function assetInboxInit() {
  if (_inboxInited) { assetInboxLoad(); return; }
  _inboxInited = true;
  await assetInboxLoad();
}

// ── Load pending items ─────────────────────────────────────────────────
async function assetInboxLoad() {
  var widget = document.getElementById('asset-inbox-widget');
  var list   = document.getElementById('asset-inbox-list');
  var badge  = document.getElementById('asset-inbox-badge');
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:13px;">טוען...</div>';

  try {
    var res   = await fetch(SB_URL + '/rest/v1/asset_inbox?status=eq.pending&order=created_at.desc&limit=50',
      { headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY } });
    _inboxItems = (await res.json()) || [];

    // Update badge
    if (badge) {
      badge.textContent  = _inboxItems.length;
      badge.style.display = _inboxItems.length ? 'block' : 'none';
    }
    if (widget) {
      widget.style.display = _inboxItems.length ? 'block' : 'none';
    }

    if (!_inboxItems.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:13px;">✅ תיבת הנכנסים ריקה</div>';
      return;
    }

    // AI suggest for items without suggestion
    var needsSuggestion = _inboxItems.filter(function(i){ return !i.ai_suggestion; });
    if (needsSuggestion.length) {
      _inboxAISuggestBatch(needsSuggestion);
    }

    _inboxRender();
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:12px;font-size:12px;">שגיאה: '+e.message+'</div>';
  }
}

// ── Render ─────────────────────────────────────────────────────────────
function _inboxRender() {
  var list = document.getElementById('asset-inbox-list');
  if (!list) return;

  var TYPE_ICON = { image:'📸', audio:'🎙️', video:'🎬', pdf:'📄' };

  list.innerHTML = _inboxItems.map(function(item, idx) {
    var icon     = TYPE_ICON[item.file_type] || '📎';
    var date     = new Date(item.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    var suggestion = item.ai_suggestion || '';
    var route    = INBOX_ROUTES.find(function(r){ return r.id === suggestion; });
    var sugColor = route ? route.color : '#888';

    var routeBtns = INBOX_ROUTES
      .filter(function(r){
        // Show relevant routes per file type
        if (item.file_type === 'audio') return ['calls','notes','journal'].includes(r.id);
        if (item.file_type === 'video') return ['snag','safety','smartscan','notes'].includes(r.id);
        if (item.file_type === 'pdf')   return ['journal','notes','smartscan'].includes(r.id);
        return ['snag','safety','smartscan','notes','takeoff'].includes(r.id); // image
      })
      .map(function(r){
        var isSelected = r.id === suggestion;
        return '<button onclick="_inboxRoute('+idx+',\''+r.id+'\')" style="'+
          'background:'+(isSelected ? r.color : 'rgba(255,255,255,0.06)')+';'+
          'border:1px solid '+(isSelected ? r.color : 'rgba(255,255,255,0.1)')+';'+
          'color:'+(isSelected ? '#fff' : '#aaa')+';'+
          'border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">'+
          r.label+'</button>';
      }).join('');

    return '<div id="inbox-card-'+item.id+'" style="background:#1e1e35;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:14px 16px;margin-bottom:10px;">' +

      // Header
      '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        // Thumbnail or icon
        (item.thumbnail_url && item.file_type === 'image'
          ? '<img src="'+item.thumbnail_url+'" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;">'
          : '<div style="width:56px;height:56px;background:#242438;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">'+icon+'</div>') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(item.file_name||'קובץ')+'</div>' +
          '<div style="font-size:11px;color:#666;margin-top:2px;">📅 '+date+(item.duration_sec?' · ⏱️ '+Math.round(item.duration_sec/60)+'m':'')+'</div>' +
          (suggestion ? '<div style="font-size:11px;font-weight:700;color:'+sugColor+';margin-top:3px;">🤖 AI מציע: '+(route?route.label:suggestion)+(item.ai_reason?' — '+item.ai_reason:'')+'</div>' : '<div style="font-size:11px;color:#555;margin-top:3px;" id="ai-status-'+item.id+'">🤖 מנתח...</div>') +
        '</div>' +
        '<button onclick="_inboxDelete(\''+item.id+'\')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;flex-shrink:0;">🗑️</button>' +
      '</div>' +

      // Route buttons
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">'+routeBtns+'</div>' +

      // Confirm button (only if route selected)
      (suggestion ? '<button onclick="_inboxConfirmRoute('+idx+')" style="width:100%;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:10px;padding:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">✅ שלח ל'+( route?route.label.replace(/[🔍🛡️📞📝📐🚀📋]/g,'').trim():suggestion)+'</button>' : '') +

    '</div>';
  }).join('');
}

// ── AI Suggest batch ───────────────────────────────────────────────────
async function _inboxAISuggestBatch(items) {
  var apiKey = (APP && APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) return;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    try {
      var prompt = 'סווג קובץ זה לאחת הקטגוריות הבאות:\n' +
        'snag = ליקויי בנייה (תמונת פגם/ליקוי)\n' +
        'safety = בטיחות (סיכון/תאונה)\n' +
        'calls = הקלטת שיחה טלפונית\n' +
        'notes = מזכר/הערה\n' +
        'takeoff = מדידות שטח\n' +
        'smartscan = סריקה כללית\n' +
        'journal = יומן עבודה\n\n' +
        'שם קובץ: ' + (item.file_name||'') + '\n' +
        'סוג: ' + (item.file_type||'') + '\n' +
        (item.duration_sec ? 'אורך: '+Math.round(item.duration_sec/60)+' דקות\n' : '') +
        '\nהחזר JSON: {"route":"xxx","reason":"סיבה קצרה בעברית","confidence":"high/medium/low"}';

      var res  = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:100, messages:[{role:'user',content:prompt}] })
      });
      var data = await res.json();
      var raw  = (data.content&&data.content[0]&&data.content[0].text||'').replace(/```json|```/g,'').trim();
      var parsed = JSON.parse(raw);

      // Update Supabase
      await fetch(SB_URL + '/rest/v1/asset_inbox?id=eq.'+item.id, {
        method:'PATCH',
        headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify({ ai_suggestion: parsed.route, ai_reason: parsed.reason, ai_confidence: parsed.confidence })
      });

      // Update local item
      var local = _inboxItems.find(function(x){ return x.id===item.id; });
      if (local) { local.ai_suggestion = parsed.route; local.ai_reason = parsed.reason; }

      // Update UI status
      var statusEl = document.getElementById('ai-status-'+item.id);
      if (statusEl) {
        var route = INBOX_ROUTES.find(function(r){ return r.id===parsed.route; });
        statusEl.textContent = '🤖 AI מציע: '+(route?route.label:parsed.route)+' — '+parsed.reason;
        statusEl.style.color = route ? route.color : '#888';
      }

    } catch(e) { console.error('AI suggest:', e); }
  }
  _inboxRender();
}

// ── Select route ───────────────────────────────────────────────────────
function _inboxRoute(idx, routeId) {
  if (_inboxItems[idx]) {
    _inboxItems[idx].ai_suggestion = routeId;
    _inboxRender();
  }
}

// ── Confirm & route ────────────────────────────────────────────────────
async function _inboxConfirmRoute(idx) {
  var item  = _inboxItems[idx];
  if (!item || !item.ai_suggestion) return;
  var route = INBOX_ROUTES.find(function(r){ return r.id===item.ai_suggestion; });
  if (!route) return;

  // Call route action
  await route.action(item);

  // Mark as routed in Supabase
  await fetch(SB_URL + '/rest/v1/asset_inbox?id=eq.'+item.id, {
    method:'PATCH',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify({ status:'routed', routed_to:item.ai_suggestion, routed_at:new Date().toISOString() })
  });

  // Remove from list
  _inboxItems.splice(idx, 1);
  _inboxRender();

  // Update badge
  var badge = document.getElementById('asset-inbox-badge');
  if (badge) {
    badge.textContent = _inboxItems.length;
    badge.style.display = _inboxItems.length ? 'block' : 'none';
  }

  showToast('✅ נשלח ל' + route.label);
}

// ── Delete ─────────────────────────────────────────────────────────────
async function _inboxDelete(itemId) {
  if (!confirm('מחק קובץ זה מהתיבה?')) return;
  await fetch(SB_URL + '/rest/v1/asset_inbox?id=eq.'+itemId, {
    method:'PATCH',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify({ status:'deleted' })
  });
  _inboxItems = _inboxItems.filter(function(i){ return i.id!==itemId; });
  _inboxRender();
  showToast('🗑️ נמחק');
}

// ── Route actions ──────────────────────────────────────────────────────
async function _inboxRouteToSnag(item) {
  // Switch to safety tab, snag sub-tab, preload the asset
  await _saveSharedAsset(item);
  switchTab('safety');
  setTimeout(function(){ if(typeof switchSafetySubTab==='function') switchSafetySubTab('snag'); }, 200);
  setTimeout(function(){ _inboxPreselectAsset(item, 'snag'); }, 500);
}

async function _inboxRouteToSafety(item) {
  await _saveSharedAsset(item);
  switchTab('safety');
  setTimeout(function(){ if(typeof switchSafetySubTab==='function') switchSafetySubTab('safety'); }, 200);
  setTimeout(function(){ _inboxPreselectAsset(item, 'safety'); }, 500);
}

async function _inboxRouteToCalls(item) {
  // Save to call_log with recording_url
  await fetch(SB_URL + '/rest/v1/call_log', {
    method:'POST',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify({
      caller_name:   item.file_name || 'הקלטה מתיבת הנכנסים',
      direction:     'incoming',
      recording_url: item.cloudinary_url,
      project_id:    item.project_id || null,
      created_at:    item.created_at
    })
  });
  // Switch to journal and show recordings section
  switchTab('journal');
  setTimeout(function(){ if(typeof callRecordingsInit==='function') callRecordingsInit(); }, 300);
}

async function _inboxRouteToNotes(item) {
  await fetch(SB_URL + '/rest/v1/beni_notes', {
    method:'POST',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify({
      note_text:  (item.file_type==='image'?'📸 ':'🎙️ ') + (item.file_name||'קובץ מתיבת הנכנסים'),
      photo_url:  item.cloudinary_url,
      color:      item.file_type==='image' ? 'blue' : 'purple',
      created_at: item.created_at
    })
  });
  switchTab('notes');
}

async function _inboxRouteToTakeoff(item) {
  await _saveSharedAsset(item);
  switchTab('crm');
  setTimeout(function(){ showPage('takeoff'); }, 200);
}

async function _inboxRouteToSmartScan(item) {
  await _saveSharedAsset(item);
  switchTab('smartscan');
  setTimeout(function(){
    if(typeof smartScanInit==='function') smartScanInit();
    showToast('📥 קובץ מוכן — לחץ סריקה חכמה');
  }, 300);
}

async function _inboxRouteToJournal(item) {
  await fetch(SB_URL + '/rest/v1/beni_notes', {
    method:'POST',
    headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify({
      note_text:  '📋 יומן: ' + (item.file_name||'קובץ'),
      photo_url:  item.cloudinary_url,
      color:      'yellow',
      created_at: item.created_at
    })
  });
  switchTab('journal');
}

// ── Helpers ────────────────────────────────────────────────────────────
async function _saveSharedAsset(item) {
  // Store URL in window so safety/snag/smartscan modules can pick it up
  window._inboxAssetUrl  = item.cloudinary_url;
  window._inboxAssetType = item.file_type;
  window._inboxAssetName = item.file_name;
}

function _inboxPreselectAsset(item, target) {
  // Set the shared-use button visible with the inbox asset
  var sharedBtn = document.getElementById(target+'-use-shared-btn');
  var sharedStatus = document.getElementById(target+'-shared-status');
  if (sharedBtn) {
    sharedBtn.style.display = 'inline-flex';
    sharedBtn.textContent = '📥 השתמש בקובץ מהתיבה: ' + (item.file_name||'');
    sharedBtn.onclick = function() { _inboxLoadAssetToTarget(item, target); };
  }
  if (sharedStatus) sharedStatus.textContent = '📥 קובץ זמין מתיבת הנכנסים';
}

async function _inboxLoadAssetToTarget(item, target) {
  // Fetch the file from Cloudinary and load into safety/snag handler
  try {
    var res  = await fetch(item.cloudinary_url);
    var blob = await res.blob();
    var file = new File([blob], item.file_name||'asset', { type: blob.type });
    var dt   = new DataTransfer();
    dt.items.add(file);
    var inputEl = document.getElementById(target+'-file-input');
    if (inputEl) {
      inputEl.files = dt.files;
      inputEl.dispatchEvent(new Event('change'));
    }
  } catch(e) { showToast('שגיאה בטעינת קובץ: '+e.message, 'error'); }
}
