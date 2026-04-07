// encyclopedia.js — Field Encyclopedia + CRM render functions
// Loaded dynamically by index.html

// ══ ENCYCLOPEDIA ═════════════════════════════════════════════════════
var _encItems = [];
var _encCatFilter = '';

async function encInit() {
  var { data: items } = await sbQ('field_encyclopedia', 'order=created_at.desc&limit=100&select=id,category,title,description,media_url,media_type,severity,tags,created_at,source_project_id');
  _encItems = items || [];
  encRenderCats();
  encRenderGrid(_encItems);
}

function encRenderCats() {
  var el = document.getElementById('enc-cat-filters');
  if (!el) return;
  var cats = {};
  _encItems.forEach(function(i){ cats[i.category] = (cats[i.category]||0)+1; });
  el.innerHTML = '<button onclick="encSetCat(\'\')" style="padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#ccc;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;">הכל ('+_encItems.length+')</button>';
  Object.keys(cats).forEach(function(cat) {
    var btn = document.createElement('button');
    btn.textContent = cat + ' (' + cats[cat] + ')';
    btn.style.cssText = 'padding:6px 14px;border-radius:20px;border:1px solid rgba(201,168,76,0.3);background:rgba(201,168,76,0.1);color:#c9a84c;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;';
    btn.onclick = (function(c){ return function(){ encSetCat(c); }; })(cat);
    el.appendChild(btn);
  });
}

function encSetCat(cat) { _encCatFilter = cat; encFilter(); }

function encFilter() {
  var search = (document.getElementById('enc-search')||{}).value || '';
  var filtered = _encItems.filter(function(i) {
    if (_encCatFilter && i.category !== _encCatFilter) return false;
    if (search && !(i.title+i.description+i.category).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  encRenderGrid(filtered);
}

function encRenderGrid(items) {
  var grid = document.getElementById('enc-grid');
  if (!grid) return;
  if (!items.length) { grid.innerHTML = '<div style="color:#555;padding:40px;text-align:center;direction:rtl;">אין פריטים תואמים</div>'; return; }
  grid.innerHTML = '';
  var sevColors = {critical:'rgba(239,68,68,0.15)',important:'rgba(245,158,11,0.15)',guideline:'rgba(34,197,94,0.15)'};
  var sevBorder = {critical:'rgba(239,68,68,0.4)',important:'rgba(245,158,11,0.4)',guideline:'rgba(34,197,94,0.4)'};
  var sevText = {critical:'🔴 קריטי',important:'🟡 חשוב',guideline:'🟢 הנחיה'};

  items.forEach(function(item) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#1e1e35;border:1px solid '+(sevBorder[item.severity]||'rgba(255,255,255,0.07)')+';border-radius:14px;overflow:hidden;direction:rtl;';

    var media = '';
    if (item.media_url && item.media_type === 'photo') {
      media = '<img src="'+item.media_url+'" style="width:100%;height:140px;object-fit:cover;display:block;cursor:zoom-in;" onclick="openLightbox(\''+item.media_url+'\',\''+item.title+'\')">';
    } else if (item.media_url && item.media_type === 'video') {
      media = '<video src="'+item.media_url+'" controls style="width:100%;height:140px;object-fit:cover;display:block;"></video>';
    } else {
      media = '<div style="height:60px;background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;font-size:28px;">'+(item.media_type==='audio'?'🎙️':'📄')+'</div>';
    }

    card.innerHTML = media + '<div style="padding:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
        '<div style="font-size:13px;font-weight:800;color:#fff;flex:1;">'+item.title+'</div>' +
        '<div style="font-size:10px;padding:2px 8px;border-radius:20px;background:'+(sevColors[item.severity]||'rgba(255,255,255,0.06)')+';color:#ccc;white-space:nowrap;margin-right:6px;">'+(sevText[item.severity]||item.severity)+'</div>' +
      '</div>' +
      '<div style="font-size:11px;color:#c9a84c;margin-bottom:6px;">📁 '+item.category+'</div>' +
      '<div style="font-size:12px;color:#888;line-height:1.6;">'+((item.description||'').substring(0,100))+(item.description&&item.description.length>100?'...':'')+'</div>' +
      '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">' +
        '<button onclick="encSendWithPO(\''+item.id+'\')" style="font-size:10px;padding:4px 10px;border-radius:20px;border:1px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.1);color:#c9a84c;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">📋 שלח עם PO</button>' +
        '<button onclick="encDelete(\''+item.id+'\')" style="font-size:10px;padding:4px 10px;border-radius:20px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#fca5a5;cursor:pointer;font-family:Heebo,sans-serif;">🗑️</button>' +
      '</div>' +
    '</div>';
    grid.appendChild(card);
  });
}

function encOpenAdd() {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  var box = document.createElement('div');
  box.style.cssText = 'background:#1a1a2e;border-radius:16px;width:100%;max-width:500px;padding:20px;direction:rtl;font-family:Heebo,sans-serif;';
  box.innerHTML = '<div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:14px;">📚 הוסף לאנציקלופדיה</div>' +
    '<input id="enc-add-title" placeholder="כותרת" style="width:100%;background:#242438;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:9px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;margin-bottom:8px;">' +
    '<input id="enc-add-cat" placeholder="קטגוריה (בטיחות/ריצוף/איטום/...)" style="width:100%;background:#242438;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:9px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;margin-bottom:8px;">' +
    '<textarea id="enc-add-desc" rows="3" placeholder="תיאור..." style="width:100%;background:#242438;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:9px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;resize:vertical;margin-bottom:8px;"></textarea>' +
    '<select id="enc-add-sev" style="width:100%;background:#242438;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:9px;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;margin-bottom:8px;direction:rtl;">' +
      '<option value="critical">🔴 קריטי</option><option value="important" selected>🟡 חשוב</option><option value="guideline">🟢 הנחיה</option>' +
    '</select>' +
    '<label style="display:block;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:9px;border-radius:8px;cursor:pointer;text-align:center;margin-bottom:10px;font-size:12px;font-weight:700;">' +
      '📷 צרף תמונה/וידאו (אופציונלי)<input type="file" id="enc-add-file" accept="image/*,video/*" style="display:none;" onchange="encAddFilePreview(this)">' +
    '</label>' +
    '<div id="enc-add-preview" style="display:none;margin-bottom:10px;"></div>' +
    '<div style="display:flex;gap:8px;">' +
      '<button onclick="encSaveNew()" style="flex:1;padding:11px;background:linear-gradient(135deg,#c9a84c,#9a6f00);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">💾 שמור</button>' +
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:11px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#888;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">ביטול</button>' +
    '</div>';
  overlay.appendChild(box);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function encAddFilePreview(input) {
  var file = input.files[0]; if(!file) return;
  var prev = document.getElementById('enc-add-preview');
  var isVideo = file.type.startsWith('video/');
  var b64 = await new Promise(function(res){var r=new FileReader();r.onload=function(e){res(e.target.result);};r.readAsDataURL(file);});
  if (prev) {
    prev.style.display='block';
    prev.innerHTML = isVideo ? '<video src="'+b64+'" controls style="width:100%;max-height:120px;border-radius:8px;"></video>' : '<img src="'+b64+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;">';
  }
}

async function encSaveNew() {
  var title = (document.getElementById('enc-add-title')||{}).value||'';
  var cat   = (document.getElementById('enc-add-cat')||{}).value||'כללי';
  var desc  = (document.getElementById('enc-add-desc')||{}).value||'';
  var sev   = (document.getElementById('enc-add-sev')||{}).value||'important';
  var file  = document.getElementById('enc-add-file') ? document.getElementById('enc-add-file').files[0] : null;
  if (!title) { showToast('הכנס כותרת','error'); return; }

  var mediaUrl='', mediaType='';
  if (file) {
    var isV = file.type.startsWith('video/');
    var ep = isV ? 'https://api.cloudinary.com/v1_1/dqdku88vv/video/upload' : 'https://api.cloudinary.com/v1_1/dqdku88vv/image/upload';
    var fd=new FormData(); fd.append('file',file); fd.append('upload_preset','beni_field'); fd.append('folder','encyclopedia');
    var r=await fetch(ep,{method:'POST',body:fd}); var d=await r.json();
    mediaUrl=d.secure_url||''; mediaType=isV?'video':'photo';
  }

  await sb.from('field_encyclopedia').insert({
    title,category:cat,description:desc,severity:sev,
    media_url:mediaUrl||null,media_type:mediaType||null,
    tags:[],created_at:new Date().toISOString()
  });
  document.querySelector('div[style*="position:fixed"]') && document.querySelector('div[style*="position:fixed"]').remove();
  showToast('📚 נשמר באנציקלופדיה','success');
  encInit();
}

async function encDelete(id) {
  if (!confirm('מחק פריט זה?')) return;
  await fetch(SB_URL+'/rest/v1/field_encyclopedia?id=eq.'+id,{method:'DELETE',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
  showToast('🗑️ נמחק','success');
  encInit();
}

function encSendWithPO(id) {
  var item = _encItems.find(function(i){ return i.id===id; });
  if (!item) return;
  var msg = '📚 הנחיות מהאנציקלופדיה:\n\n' + item.title + '\n' + (item.description||'') + '\n\nחומרה: ' + (item.severity==='critical'?'קריטי':item.severity==='important'?'חשוב':'הנחיה');
  navigator.clipboard.writeText(msg).then(function(){ showToast('✅ הועתק — הוסף ל-PO','success'); });
}


async function bootstrap() {
  try {
    // 1. Load lookups + config — graceful if tables don't exist yet
    try {
      const [lkpRes, cfgRes] = await Promise.all([
        sbQ('lookup_values','select=category,value,group_name,sort_order&is_active=eq.true&order=sort_order.asc'),
        sbQ('app_config','select=key,value')
      ]);
      (lkpRes.data||[]).forEach(r => {
        if (!APP.lookup[r.category]) APP.lookup[r.category] = [];
        APP.lookup[r.category].push({ value: r.value, group: r.group_name });
      });
      (cfgRes.data||[]).forEach(r => { APP.config[r.key] = r.value; });
      // Populate PO orderer fields from app_config
      // ── Apply app_config to PO orderer form ─────────────────────────
      var _cfg = function(id, key) {
        var el = document.getElementById(id);
        if (el && APP.config[key]) el.value = APP.config[key];
      };
      _cfg('pof-orderer-name-val',  'orderer_name');
      _cfg('pof-orderer-hp-val',    'orderer_hp');
      _cfg('pof-orderer-addr-val',  'orderer_address');
      _cfg('pof-orderer-phone-val', 'orderer_phone');
      _cfg('pof-orderer-email-val', 'orderer_email');
      if (APP.config.vat_rate) POF_VAT = parseFloat(APP.config.vat_rate) || 0.18;
      // Update dynamic name/title elements
      if (APP.config.app_title) {
        var titleTag = document.getElementById('app-title-tag');
        if (titleTag) titleTag.textContent = APP.config.app_title;
      }
      if (APP.config.manager_name) {
        var nameEl = document.getElementById('app-manager-name');
        if (nameEl) nameEl.textContent = APP.config.manager_name;
      }
    } catch(e) {
    }

    // Run CRM init
    try {
      if (typeof crmInit === 'function') await crmInit();
    } catch(e) {
      console.error('crmInit failed:', e.message, e.stack);
    }

    // 7. Load dashboard widgets (after data is loaded)
    setTimeout(() => {
      try { if (typeof loadSiteReports     === 'function') loadSiteReports(); }     catch(e){}
      try { if (typeof loadRecentInspections === 'function') loadRecentInspections(); } catch(e){}
      try { if (typeof renderAnnexWidget   === 'function') renderAnnexWidget(); }   catch(e){}
      try { if (typeof loadBeniTasks       === 'function') loadBeniTasks(); }       catch(e){}
      try { if (typeof loadDailyCalls      === 'function') loadDailyCalls(); }      catch(e){}
      try { if (typeof loadFieldIntel      === 'function') loadFieldIntel(); }      catch(e){}
      try { if (typeof sjPopulateProjectFilter === 'function') sjPopulateProjectFilter(); } catch(e){}
    }, 500);

    _createStopButton(); // floating stop button for AI operations
  // Auto-refresh Field Intel + Beni Tasks every 60 seconds (only when CRM tab visible)
    setInterval(function() {
      const crmActive = document.getElementById('crm-panel')?.classList.contains('active');
      if (!crmActive) return;
      try { if (typeof loadFieldIntel === 'function') loadFieldIntel(); } catch(e){}
      try { if (typeof loadBeniTasks  === 'function') loadBeniTasks();  } catch(e){}
    }, 60000);

    // 7. Done — hide loading screen
    const loadingEl = document.getElementById('global-loading');
    if (loadingEl) loadingEl.style.display = 'none';

  } catch(e) {
    console.error('Bootstrap error:', e);
    const gl = document.getElementById('global-loading');
    if (gl) gl.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// TAB SWITCHER
// ══════════════════════════════════════════════════════
async function switchTab(tab) {
  // Close mobile sidebar
  const sidebar = document.querySelector('#crm-panel .sidebar');
  if (sidebar?.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    const ov = document.getElementById('crm-overlay');
    if (ov) ov.style.display = 'none';
  }

  ['crm','notes','eod','safety','rag','micharon','query','gcal','journal','standards','smartscan','inbox','misc','encyclopedia'].forEach(t => {
    var panel = document.getElementById(t+'-panel');
    var tabEl  = document.getElementById('tab-'+t);
    if (panel) panel.style.display = (t===tab) ? 'block' : 'none';
    if (tabEl)  tabEl.classList.toggle('active', t===tab);
  });
  window.scrollTo(0,0);
  // Scroll active tab into view in the top tabs bar
  const activeTab = document.getElementById('tab-' + tab);
  if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  try { localStorage.setItem('beni_active_tab', tab); } catch(e){}

  // Panel-specific post-init
  if (tab === 'notes')   { _fetchSmartJournal().then(function(){ setTimeout(function(){ sjPopulateProjectFilter(); loadNotesWall(); }, 100); }); }
  if (tab === 'crm')     { setTimeout(function(){ if(typeof assetInboxLoad==='function') assetInboxLoad(); }, 200); }
  if (tab === 'eod')     { Promise.all([_fetchJournalModule(), _fetchSmartJournal()]).then(function(){ setTimeout(loadEODReport, 100); }); }
  if (tab === 'safety')  { _fetchSafetyModule().then(function(){ setTimeout(function(){ safetyTabInit(); if(typeof _switchSafetySubTabReal==='function') _switchSafetySubTabReal('safety'); }, 100); }); }
  if (tab === 'rag')      { _fetchRagModule().then(function(){ setTimeout(ragTabInit, 100); }); }
  if (tab === 'micharon') { _fetchRagModule().then(function(){ setTimeout(micharonTabInit, 100); }); }
  if (tab === 'query')    { _fetchRagModule().then(function(){ setTimeout(queryTabInit, 100); }); }
  if (tab === 'gcal')    { _fetchSmartJournal().then(function(){ if (typeof initGcal === 'function') initGcal(); }); }
  if (tab === 'journal') {
    // Highlight the בריפינג בוקר top tab
    var fjTabEl = document.getElementById('tab-fieldjournal');
    if (fjTabEl) fjTabEl.classList.add('active');
    // Load wizard.js (HTML + fj/jw logic) then journal module (jwGoto etc.)
    Promise.all([_fetchWizardModule(), _fetchJournalModule()]).then(async function(){
      if (!allProjects || !allProjects.length) { try { await loadProjects(); } catch(e){} }
      if (typeof initializeManagerView === 'function') initializeManagerView();
      // Rebuild select with real UUIDs immediately after initializeManagerView
      (function(){
        var sel = document.getElementById('projectName');
        if (sel) {
          sel.innerHTML = '<option value="">— בחר פרויקט —</option>';
          (window.allProjects||[]).forEach(function(p){
            var o = document.createElement('option');
            o.value = p.id;
            o.textContent = p.project_name;
            sel.appendChild(o);
          });
          sel.value = '';
        }
      })();
      if (typeof jwGoto === 'function') jwGoto(1);
      jwInstallProjectTrap();
      setTimeout(function(){
        ['mb-tasks-section','mb-hero','mb-drawings-section','mb-contractors-section','jw-cta'].forEach(function(id){
          var el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        jwLoadBriefing();
        jwCheckProjects();
        jwTasksShowOption('table');
        if (typeof fjInit === 'function') fjInit();
      }, 100);
    }).catch(function(e){ console.error('wizard/journal load:', e); });
    _fetchCallRecordingsModule().then(function(){ setTimeout(function(){ if(typeof callRecordingsInit==='function') callRecordingsInit(); },200); });
  }
  if (tab === 'standards') { _fetchStandardsModule().then(function(){ setTimeout(standardsRagInit, 100); }); }
  if (tab === 'smartscan')  { _fetchSmartScanModule().then(function(){ setTimeout(function(){ smartScanInit(); _ssPopulateProjects(); }, 100); }); }
  if (tab === 'encyclopedia') { setTimeout(function(){ encInit(); }, 100); }
  if (tab === 'inbox')      { setTimeout(function(){ assetInboxLoad(); }, 100); }
  if (tab === 'misc')       { setTimeout(loadMiscTab, 100); }
}

// ══════════════════════════════════════════════════════
// CRM DATA LOADER (shared across panels)
// ══════════════════════════════════════════════════════
async function loadCRMData() {
  const cRes = await sbQ('contractors_master','select=*&order=company_name.asc');
  const pRes = await sbQ('projects','select=*&order=created_at.desc');
  const tRes = await sbQ('contractor_transactions','select=*,contractors_master(company_name),projects(project_name)&order=transaction_date.desc');
  const rRes = await sbQ('reports','select=*&order=report_date.desc&limit=100');
  APP.contractors  = cRes.data || [];
  APP.projects     = pRes.data || [];
  APP.transactions = tRes.data || [];
  APP.reports      = rRes.data || [];

  // Sync to global state arrays used by CRM render functions
  allContractors  = APP.contractors;
  allProjects     = APP.projects;
  allTransactions = APP.transactions;
  allReports      = APP.reports;
  window.allContractors  = allContractors;
  window.allProjects     = allProjects;
  window.allTransactions = allTransactions;
  window.allReports      = allReports;
}

// ══════════════════════════════════════════════════════
// LOOKUP HELPERS — replace hardcoded arrays
// ══════════════════════════════════════════════════════

// Build <select> options from lookup category, grouped
function buildLookupSelect(category, selected='', placeholder='— בחר —') {
  const items = APP.lookup[category] || [];
  const groups = {};
  items.forEach(i => {
    const g = i.group || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(i.value);
  });
  let html = `<option value="">${placeholder}</option>`;
  Object.entries(groups).forEach(([g, vals]) => {
    if (g) html += `<optgroup label="${g}">`;
    vals.forEach(v => {
      html += `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`;
    });
    if (g) html += `</optgroup>`;
  });
  html += `<option value="__custom__">✏️ הזן ידנית...</option>`;
  return html;
}

// Build worker role select
function buildRoleSelect(selectedVal='') {
  const opts = buildLookupSelect('worker_role', selectedVal, '— בחר תפקיד —');
  return `<select class="worker-role" style="flex:2;padding:7px 10px;border:1.5px solid #dde3ec;border-radius:8px;font-size:13px;font-family:inherit;">${opts}</select>`;
}

// Build activity phase select
function buildActivitySelect(selectedVal='') {
  const opts = buildLookupSelect('activity_phase', selectedVal, '— בחר פעילות —');
  return `<select class="activity-desc" style="flex:2;padding:7px 10px;border:1.5px solid #dde3ec;border-radius:8px;font-size:13px;font-family:inherit;">${opts}</select>`;
}

// Build occupation <select> for contractor modal
function buildOccupationSelect(selectedVal='') {
  const items = APP.lookup['occupation'] || [];
  let html = '<option value="">— בחר —</option>';
  items.forEach(i => {
    html += `<option value="${esc(i.value)}" ${i.value===selectedVal?'selected':''}>${esc(i.value)}</option>`;
  });
  return html;
}

// Populate material quick-add <select> from Supabase lookup
function populateMaterialSelect() {
  const sel = document.getElementById('materialQuickSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- בחר חומר מהרשימה --</option>';
  const items = APP.lookup['material'] || [];
  const groups = {};
  items.forEach(i => {
    const g = i.group || 'כללי';
    if (!groups[g]) groups[g] = [];
    groups[g].push(i.value);
  });
  Object.entries(groups).forEach(([g, vals]) => {
    sel.innerHTML += `<optgroup label="${g}">`;
    vals.forEach(v => sel.innerHTML += `<option value="${esc(v)}">${esc(v)}</option>`);
    sel.innerHTML += `</optgroup>`;
  });
  sel.innerHTML += '<option value="__other__">✏️ אחר — הוסף ידנית</option>';
}

// Populate equipment quick-add <select> from Supabase lookup
function populateEquipmentSelect() {
  const sel = document.getElementById('equipmentQuickSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- בחר ציוד/מכונה --</option>';
  const items = APP.lookup['equipment'] || [];
  const groups = {};
  items.forEach(i => {
    const g = i.group || 'כללי';
    if (!groups[g]) groups[g] = [];
    groups[g].push(i.value);
  });
  Object.entries(groups).forEach(([g, vals]) => {
    sel.innerHTML += `<optgroup label="${g}">`;
    vals.forEach(v => sel.innerHTML += `<option value="${esc(v)}">${esc(v)}</option>`);
    sel.innerHTML += `</optgroup>`;
  });
  sel.innerHTML += '<option value="__other__">✏️ אחר — הוסף ידנית</option>';
}


// ══════════════════════════════════════════════════════
// PO FORM — פתיחת הזמנות עבודה
// ══════════════════════════════════════════════════════
var POF_VAT = 0.18; // overridden by app_config vat_rate in bootstrap()
let pofRowCount = 0;
const POF_UNITS = ["ס\"ע","מ\"ר","מ\"ל","יח'","טון","שעות","פאושלי","קג","מ\"ק"];

function pofInit() {
  // Generate PO number
  const now = new Date();
  const poNum = 'PO-' + now.getFullYear() + '-' + String(Math.floor(Math.random()*9000)+1000);
  const badge = document.getElementById('po-form-number-badge');
  if (badge) badge.textContent = poNum;
  badge.dataset.poNum = poNum;

  // Default start date
  const sd = document.getElementById('pof-start-date');
  if (sd && !sd.value) sd.value = now.toISOString().split('T')[0];

  // Add 3 default rows if empty
  const tbody = document.getElementById('pof-items-body');
  if (tbody && tbody.rows.length === 0) {
    pofAddRow(); pofAddRow(); pofAddRow();
  }
}

function pofAddRow(desc='', unit="ס\"ע", qty='', price='', vatOn=true) {
  pofRowCount++;
  const tbody = document.getElementById('pof-items-body');
  const tr = document.createElement('tr');
  tr.dataset.rid = pofRowCount;
  tr.style.borderBottom = '1px solid #eee';

  const unitOpts = POF_UNITS.map(u =>
    `<option value="${u}" ${u===unit?'selected':''}>${u}</option>`
  ).join('');

  tr.innerHTML = `
    <td style="text-align:center;color:#aaa;font-size:12px;padding:4px;">${tbody.rows.length+1}</td>
    <td style="padding:4px;"><input type="text" value="${desc}" placeholder="תיאור הפריט / העבודה" oninput="pofRecalc()" style="width:100%;font-size:13px;"></td>
    <td style="padding:4px;"><select onchange="pofRecalc()" style="width:100%;font-size:13px;">${unitOpts}</select></td>
    <td style="padding:4px;"><input type="number" value="${qty}" placeholder="0" min="0" oninput="pofRecalc()" style="width:100%;text-align:center;font-size:13px;"></td>
    <td style="padding:4px;"><input type="number" value="${price}" placeholder="0" min="0" oninput="pofRecalc()" style="width:100%;text-align:left;font-size:13px;direction:ltr;"></td>
    <td style="text-align:center;padding:4px;"><input type="checkbox" ${vatOn?'checked':''} onchange="pofRecalc()" style="width:16px;height:16px;accent-color:#c9a84c;cursor:pointer;"></td>
    <td style="padding:4px;font-weight:600;color:#1a3d5c;direction:ltr;text-align:left;" id="pof-row-total-${pofRowCount}">₪ 0.00</td>
    <td style="text-align:center;padding:4px;"><button onclick="this.closest('tr').remove();pofRecalc();pofRenumber();" style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:14px;padding:2px 6px;">✕</button></td>
  `;
  tbody.appendChild(tr);
  pofRecalc();
  pofRenumber();
}

function pofRenumber() {
  document.querySelectorAll('#pof-items-body tr').forEach((tr,i) => {
    tr.cells[0].textContent = i+1;
  });
}

function pofRecalc() {
  let sumNoVat = 0;
  document.querySelectorAll('#pof-items-body tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input[type="number"]');
    const qty   = parseFloat(inputs[0]?.value)||0;
    const price = parseFloat(inputs[1]?.value)||0;
    const vat   = tr.querySelector('input[type="checkbox"]')?.checked;
    const rid   = tr.dataset.rid;
    const line  = qty * price;
    const total = vat ? line*(1+POF_VAT) : line;
    sumNoVat += line;
    const cell = document.getElementById('pof-row-total-'+rid);
    if (cell) cell.textContent = '₪ '+total.toLocaleString('he-IL',{minimumFractionDigits:2});
  });
  const vatAmt = sumNoVat * POF_VAT;
  const grand  = sumNoVat + vatAmt;
  const fmt = n => '₪ '+n.toLocaleString('he-IL',{minimumFractionDigits:2});
  document.getElementById('pof-total-no-vat').textContent = fmt(sumNoVat);
  document.getElementById('pof-total-vat').textContent    = fmt(vatAmt);
  document.getElementById('pof-total-all').textContent    = fmt(grand);
}

function pofCollect() {
  const rows = [];
  document.querySelectorAll('#pof-items-body tr').forEach((tr,i) => {
    const inputs = tr.querySelectorAll('input[type="number"]');
    const qty   = parseFloat(inputs[0]?.value)||0;
    const price = parseFloat(inputs[1]?.value)||0;
    const desc  = tr.querySelector('input[type="text"]')?.value||'';
    const unit  = tr.querySelector('select')?.value||'';
    const vat   = tr.querySelector('input[type="checkbox"]')?.checked;
    if (desc||qty) rows.push({num:i+1,desc,unit,qty,price,vat});
  });
  const sumNoVat = rows.reduce((s,r)=>s+r.qty*r.price,0);
  const vatAmt   = sumNoVat*POF_VAT;
  const total    = sumNoVat+vatAmt;
  const badge    = document.getElementById('po-form-number-badge');
  return {
    poNumber:          badge?.dataset.poNum || badge?.textContent || 'PO-2026-0000',
    date:              new Date().toISOString(),
    ordererName:       document.getElementById('pof-orderer-name')?.value||'',
    ordererHP:         document.getElementById('pof-orderer-hp')?.value||'',
    ordererAddress:    document.getElementById('pof-orderer-address')?.value||'',
    ordererPhone:      document.getElementById('pof-orderer-phone')?.value||'',
    ordererEmail:      document.getElementById('pof-orderer-email')?.value||'',
    contractorName:    document.getElementById('pof-contractor-name')?.value||'',
    contractorHP:      document.getElementById('pof-contractor-hp')?.value||'',
    contractorAddress: document.getElementById('pof-contractor-address')?.value||'',
    contractorPhone:   document.getElementById('pof-contractor-phone')?.value||'',
    contractorEmail:   document.getElementById('pof-contractor-email')?.value||'',
    projectName:       document.getElementById('pof-project-name')?.value||'',
    projectLocation:   document.getElementById('pof-project-location')?.value||'',
    startDate:         document.getElementById('pof-start-date')?.value||'',
    endDate:           document.getElementById('pof-end-date')?.value||'',
    quoteRef:          document.getElementById('pof-quote-ref')?.value||'',
    tenderRef:         document.getElementById('pof-tender-ref')?.value||'',
    budgetSource:      document.getElementById('pof-budget-source')?.value||'',
    paymentTerms:      document.getElementById('pof-payment-terms')?.value||'',
    notes:             document.getElementById('pof-notes')?.value||'',
    rows, sumNoVat, vatAmt, total
  };
}

async function pofSaveToSupabase(d) {
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('purchase_orders').insert({
      po_number:          d.poNumber,
      created_at:         d.date,
      contractor_name:    d.contractorName,
      contractor_hp:      d.contractorHP,
      contractor_address: d.contractorAddress,
      contractor_phone:   d.contractorPhone,
      contractor_email:   d.contractorEmail,
      project_name:       d.projectName,
      project_location:   d.projectLocation,
      start_date:         d.startDate || null,
      end_date:           d.endDate   || null,
      quote_ref:          d.quoteRef,
      tender_ref:         d.tenderRef,
      budget_source:      d.budgetSource,
      payment_terms:      d.paymentTerms,
      notes:              d.notes,
      items:              JSON.stringify(d.rows),
      total_no_vat:       d.sumNoVat,
      total_vat:          d.vatAmt,
      total_with_vat:     d.total,
      status:             'active'
    }).select().single();
    if (error) {
      console.error('PO save error — Supabase:', error.message, error.details, error.hint);
      console.error('Missing column? Run purchase_orders_fix_25032026.sql in Supabase SQL editor');
      return null;
    }
    return data;
  } catch(e) {
    console.error('PO save exception:', e);
    return null;
  }
}

async function pofSaveAndPDF() {
  const d = pofCollect();
  if (!d.contractorName) { showToast('נא למלא שם קבלן', 'error'); return; }
  if (!d.projectName)    { showToast('נא למלא שם פרויקט', 'error'); return; }
  if (d.rows.length === 0){ showToast('נא להוסיף לפחות שורת עבודה', 'error'); return; }

  // Save to Supabase (non-blocking — PDF opens regardless)
  const saved = await pofSaveToSupabase(d);
  if (saved) {
    showToast('✅ הזמנה נשמרה: ' + d.poNumber, 'success');
  } else {
    // Don't block PDF — just show a non-intrusive toast
    showToast('⚠️ הזמנה נשמרה כ-PDF (שגיאת Supabase — הרץ purchase_orders_fix SQL)', 'error');
  }

  // Generate print preview regardless of save status
  pofOpenPrintPreview(d);

  // Refresh badge count
  if (typeof loadPOs === 'function') loadPOs();
}

function pofOpenPrintPreview(d) {
  const fmt = n => '₪ '+n.toLocaleString('he-IL',{minimumFractionDigits:2});
  const rowsHTML = d.rows.map(r => {
    const line  = r.qty*r.price;
    const total = r.vat ? line*1.18 : line;
    return `<tr>
      <td style="text-align:center;">${r.num}</td>
      <td>${r.desc}</td>
      <td style="text-align:center;">${r.unit}</td>
      <td style="text-align:center;">${r.qty}</td>
      <td style="text-align:left;direction:ltr;">${r.price.toLocaleString('he-IL')}</td>
      <td style="text-align:center;">${r.vat?'18%':'—'}</td>
      <td style="text-align:left;font-weight:600;direction:ltr;">${fmt(total)}</td>
    </tr>`;
  }).join('');

  const dateStr = new Date(d.date).toLocaleDateString('he-IL');
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>הזמנת עבודה ${d.poNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Heebo',sans-serif;color:#111;background:#fff;font-size:11pt;padding:0;}
  @page{size:A4;margin:18mm 15mm;}
  @media print{.no-print{display:none!important}}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C9A84C;padding-bottom:12px;margin-bottom:14px;}
  .header h1{font-size:20pt;font-weight:800;color:#1a1a2e;}
  .po-num{font-size:13pt;font-weight:700;color:#C9A84C;}
  .boxes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
  .box{border:1.5px solid #ddd;border-radius:6px;overflow:hidden;}
  .box-h{background:#1a1a2e;color:#C9A84C;font-weight:700;font-size:10pt;padding:6px 12px;}
  .box-b{padding:10px 12px;font-size:9.5pt;line-height:1.9;}
  .box-b span{color:#666;font-size:8.5pt;}
  .proj{border:1.5px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:14px;}
  .proj-grid{display:grid;grid-template-columns:repeat(4,1fr);}
  .proj-cell{padding:7px 12px;border-left:1px solid #eee;font-size:9.5pt;}
  .proj-cell:last-child{border-left:none;}
  .proj-cell span{display:block;font-size:8pt;color:#888;margin-bottom:2px;}
  table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:12px;}
  th{background:#1a1a2e;color:#C9A84C;padding:8px 7px;font-weight:700;}
  td{padding:6px 7px;border-bottom:1px solid #eee;}
  .tot-row{display:flex;justify-content:space-between;padding:4px 12px;max-width:300px;margin-left:auto;font-size:10pt;border-bottom:1px solid #eee;}
  .tot-row.grand{font-weight:800;font-size:12pt;border-top:2px solid #C9A84C;border-bottom:none;padding-top:8px;}
  .notes{border:1px solid #ddd;border-radius:6px;padding:10px 14px;font-size:9pt;color:#444;margin-bottom:16px;background:#fafaf8;}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:20px;}
  .sig-box{text-align:center;}
  .sig-line{border-bottom:1.5px solid #aaa;margin:28px 20px 5px;}
  .footer{text-align:center;font-size:8pt;color:#aaa;border-top:1px solid #eee;padding-top:8px;margin-top:14px;}
  .print-btn{display:block;margin:16px auto;padding:9px 30px;background:#C9A84C;border:none;border-radius:8px;font-size:13pt;font-family:'Heebo',sans-serif;font-weight:700;cursor:pointer;color:#fff;}
</style>
</head>
<body><button onclick="window.close()" style="position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:9999;font-family:Heebo,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.25);">✕ סגור חלון</button><button onclick=\"window.close()\" style=\"position:fixed;top:12px;right:12px;background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:9999;font-family:Heebo,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.25);">✕ סגור חלון</button><button onclick="window.close()" style="position:fixed;top:12px;right:12px;background:#1a3d5c;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;z-index:9999;font-family:Heebo,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);">✕ סגור</button>
<button class="print-btn no-print" onclick="window.print()">🖨️ הדפס / שמור PDF</button>
<div class="header">
  <div><h1>הזמנת עבודה</h1><div style="font-size:10pt;color:#555;margin-top:3px;">Work Purchase Order</div></div>
  <div style="text-align:left;"><div class="po-num">${d.poNumber}</div><div style="font-size:9pt;color:#555;margin-top:3px;">${dateStr}</div></div>
</div>
<div class="boxes">
  <div class="box"><div class="box-h">המזמין</div><div class="box-b">
    <div><span>שם: </span>${d.ordererName}</div>
    <div><span>ח.פ: </span>${d.ordererHP}</div>
    <div><span>כתובת: </span>${d.ordererAddress}</div>
    <div><span>טלפון: </span>${d.ordererPhone}</div>
    <div><span>אימייל: </span>${d.ordererEmail}</div>
  </div></div>
  <div class="box"><div class="box-h">הקבלן</div><div class="box-b">
    <div><span>שם: </span>${d.contractorName||'—'}</div>
    <div><span>ת.ז/ח.פ: </span>${d.contractorHP||'—'}</div>
    <div><span>כתובת: </span>${d.contractorAddress||'—'}</div>
    <div><span>טלפון: </span>${d.contractorPhone||'—'}</div>
    <div><span>אימייל: </span>${d.contractorEmail||'—'}</div>
  </div></div>
</div>
<div class="proj">
  <div class="box-h">פרטי הפרויקט</div>
  <div class="proj-grid">
    <div class="proj-cell"><span>שם הפרויקט</span>${d.projectName}</div>
    <div class="proj-cell"><span>מיקום</span>${d.projectLocation}</div>
    <div class="proj-cell"><span>התחלה</span>${d.startDate}</div>
    <div class="proj-cell"><span>סיום</span>${d.endDate}</div>
    <div class="proj-cell"><span>הצעת מחיר</span>${d.quoteRef}</div>
    <div class="proj-cell"><span>מינוי/מכרז</span>${d.tenderRef}</div>
    <div class="proj-cell"><span>מקור תקציב</span>${d.budgetSource}</div>
    <div class="proj-cell"><span>תנאי תשלום</span>${d.paymentTerms}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:28px;">#</th><th>תיאור העבודה</th>
    <th style="width:60px;">יחידה</th><th style="width:60px;">כמות</th>
    <th style="width:90px;">מחיר יחידה</th><th style="width:50px;">מע"מ</th>
    <th style="width:110px;">סה"כ כולל מע"מ</th>
  </tr></thead>
  <tbody>${rowsHTML}</tbody>
</table>
<div class="tot-row"><span>סכום ללא מע"מ</span><span style="direction:ltr;">${fmt(d.sumNoVat)}</span></div>
<div class="tot-row"><span>מע"מ (18%)</span><span style="direction:ltr;">${fmt(d.vatAmt)}</span></div>
<div class="tot-row grand"><span>סה"כ לתשלום</span><span style="direction:ltr;">${fmt(d.total)}</span></div>
${d.notes?`<div class="notes" style="margin-top:14px;"><strong>הערות:</strong> ${d.notes}</div>`:''}
<div class="sigs">
  <div class="sig-box"><div style="font-weight:700;font-size:10pt;">${d.contractorName||'הקבלן'}</div><div class="sig-line"></div><div style="font-size:8.5pt;color:#888;">חתימה ותאריך</div></div>
  <div class="sig-box"><div style="font-weight:700;font-size:10pt;">${d.ordererName}</div><div class="sig-line"></div><div style="font-size:8.5pt;color:#888;">אישור מנהל פרויקט ויועץ פיקוח</div></div>
</div>
<div class="footer">מסמך זה הופק ממערכת ניהול הפרויקטים של בני פרסקי | ${d.poNumber} | ${dateStr}</div>
</body></html>`);
  win.document.close();
}

function pofSendWhatsApp() {
  const d = pofCollect();
  if (!d.contractorPhone) { showToast('נא למלא טלפון קבלן', 'error'); return; }
  const phone = d.contractorPhone.replace(/\D/g,'');
  const il = phone.startsWith('0') ? '972'+phone.slice(1) : phone;
  const fmt = n => '₪'+n.toLocaleString('he-IL',{minimumFractionDigits:2});
  const msg = `שלום,\nמצורפת הזמנת עבודה ${d.poNumber}\nפרויקט: ${d.projectName}\nסה"כ לתשלום: ${fmt(d.total)}\n\nבברכה,\n${d.ordererName}`;
  const a = document.createElement('a');
  a.href = 'https://wa.me/'+il+'?text='+encodeURIComponent(msg);
  a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function pofReset() {
  if (!confirm('לאפס את כל הטופס?')) return;
  ['pof-contractor-name','pof-contractor-hp','pof-contractor-address','pof-contractor-phone','pof-contractor-email',
   'pof-project-name','pof-project-location','pof-end-date','pof-quote-ref','pof-tender-ref','pof-budget-source'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('pof-items-body').innerHTML='';
  pofRowCount=0;
  pofAddRow(); pofAddRow(); pofAddRow();

  // New PO number
  const badge = document.getElementById('po-form-number-badge');
  const now = new Date();
  const poNum = 'PO-'+now.getFullYear()+'-'+String(Math.floor(Math.random()*9000)+1000);
  if(badge){badge.textContent=poNum;badge.dataset.poNum=poNum;}
}


// ══════════════════════════════════════════════════════
// ENGINEERING CALCULATOR
// ══════════════════════════════════════════════════════
(function(){
  // Inject CSS once
  if(!document.getElementById('calc-styles')){
    var s=document.createElement('style');
    s.id='calc-styles';
    s.textContent=`
      .calc-tab-btn{padding:10px 14px;border-radius:9px;cursor:pointer;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:var(--text2);background:var(--surface);border:1.5px solid var(--border);transition:all 0.15s;text-align:right;}
      .calc-tab-btn:hover{border-color:#1a3d5c;color:#1a3d5c;}
      .active-calc-tab{background:#1a3d5c!important;color:white!important;border-color:#1a3d5c!important;}
      .calc-panel-title{font-size:17px;font-weight:800;color:var(--text);margin-bottom:16px;}
      .calc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:14px;}
      .calc-card{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:16px;}
      .calc-card-title{font-size:12px;font-weight:800;color:#1a3d5c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border);}
      .calc-row{display:flex;flex-direction:column;gap:3px;margin-bottom:8px;}
      .calc-row label{font-size:11px;font-weight:600;color:var(--text3);}
      .calc-row input{padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:Heebo,sans-serif;font-size:14px;background:var(--surface2);color:var(--text);transition:border-color 0.15s;}
      .calc-row input:focus{outline:none;border-color:#1a3d5c;}
      .calc-result{background:linear-gradient(135deg,#1a3d5c,#2d6a9f);color:white;border-radius:9px;padding:11px 14px;font-size:14px;font-weight:800;margin-top:6px;min-height:42px;display:flex;align-items:center;direction:rtl;}
    `;
    document.head.appendChild(s);
  }
})();

function showCalc(name){
  document.querySelectorAll('.calc-panel').forEach(function(p){p.style.display='none';});
  document.querySelectorAll('.calc-tab-btn').forEach(function(b){b.classList.remove('active-calc-tab');});
  var panel=document.getElementById('calc-panel-'+name);
  var btn=document.getElementById('calc-tab-btn-'+name);
  if(panel)panel.style.display='block';
  if(btn)btn.classList.add('active-calc-tab');
}

function r(n,d){return Math.round(n*(Math.pow(10,d||2)))/(Math.pow(10,d||2));}

// AREA
function calcArea(){var l=parseFloat(document.getElementById('rect-l').value)||0,w=parseFloat(document.getElementById('rect-w').value)||0;document.getElementById('rect-result').textContent=l&&w?'שטח: '+r(l*w)+' מ״ר':'הכנס נתונים';}
function calcCircle(){var rd=parseFloat(document.getElementById('circ-r').value)||0;document.getElementById('circ-result').textContent=rd?'שטח: '+r(Math.PI*rd*rd)+' מ״ר  |  היקף: '+r(2*Math.PI*rd)+' מ׳':'הכנס נתונים';}
function calcTriangle(){var b=parseFloat(document.getElementById('tri-b').value)||0,h=parseFloat(document.getElementById('tri-h').value)||0;document.getElementById('tri-result').textContent=b&&h?'שטח: '+r(b*h/2)+' מ״ר':'הכנס נתונים';}
function calcTrap(){var a=parseFloat(document.getElementById('trap-a').value)||0,b=parseFloat(document.getElementById('trap-b').value)||0,h=parseFloat(document.getElementById('trap-h').value)||0;document.getElementById('trap-result').textContent=a&&b&&h?'שטח: '+r((a+b)/2*h)+' מ״ר':'הכנס נתונים';}

// VOLUME
function calcBox(){var l=parseFloat(document.getElementById('box-l').value)||0,w=parseFloat(document.getElementById('box-w').value)||0,h=parseFloat(document.getElementById('box-h').value)||0;document.getElementById('box-result').textContent=l&&w&&h?'נפח: '+r(l*w*h)+' מ״ק':'הכנס נתונים';}
function calcCyl(){var rd=parseFloat(document.getElementById('cyl-r').value)||0,h=parseFloat(document.getElementById('cyl-h').value)||0;document.getElementById('cyl-result').textContent=rd&&h?'נפח: '+r(Math.PI*rd*rd*h)+' מ״ק':'הכנס נתונים';}
function calcSlab(){var l=parseFloat(document.getElementById('slab-l').value)||0,w=parseFloat(document.getElementById('slab-w').value)||0,t=parseFloat(document.getElementById('slab-t').value)||0;document.getElementById('slab-result').textContent=l&&w&&t?'נפח: '+r(l*w*(t/100))+' מ״ק  |  שטח: '+r(l*w)+' מ״ר':'הכנס נתונים';}

// CONCRETE
function calcConcrete(){var l=parseFloat(document.getElementById('con-l').value)||0,w=parseFloat(document.getElementById('con-w').value)||0,t=parseFloat(document.getElementById('con-t').value)||0,wst=(parseFloat(document.getElementById('con-waste').value)||0)/100;if(!l||!w||!t){document.getElementById('con-result').textContent='הכנס נתונים';return;}var vol=l*w*(t/100);var volWaste=vol*(1+wst);document.getElementById('con-result').textContent='נפח נטו: '+r(vol)+' מ״ק  |  כולל בזבוז: '+r(volWaste)+' מ״ק  |  משקל: ~'+r(volWaste*2400/1000)+' טון';}
function calcColumn(){var d=parseFloat(document.getElementById('col-d').value)||0,h=parseFloat(document.getElementById('col-h').value)||0,n=parseFloat(document.getElementById('col-n').value)||1;if(!d||!h){document.getElementById('col-result').textContent='הכנס נתונים';return;}var vol=Math.PI*Math.pow(d/100/2,2)*h*n;document.getElementById('col-result').textContent=n+' עמודים: '+r(vol)+' מ״ק  |  ~'+r(vol*2400/1000)+' טון';}
function calcWall(){var l=parseFloat(document.getElementById('wall-l').value)||0,h=parseFloat(document.getElementById('wall-h').value)||0,t=parseFloat(document.getElementById('wall-t').value)||0;if(!l||!h||!t){document.getElementById('wall-result').textContent='הכנס נתונים';return;}var vol=l*h*(t/100);document.getElementById('wall-result').textContent='נפח: '+r(vol)+' מ״ק  |  שטח: '+r(l*h)+' מ״ר  |  ~'+r(vol*2200/1000)+' טון';}

// FLOORING
function calcTile(){var area=parseFloat(document.getElementById('tile-area').value)||0,tl=parseFloat(document.getElementById('tile-l').value)||0,tw=parseFloat(document.getElementById('tile-w').value)||0,wst=(parseFloat(document.getElementById('tile-waste').value)||0)/100;if(!area||!tl||!tw){document.getElementById('tile-result').textContent='הכנס נתונים';return;}var tileArea=tl/100*tw/100;var tiles=Math.ceil(area/tileArea*(1+wst));document.getElementById('tile-result').textContent='כמות אריחים: '+tiles+' יח׳  |  שטח אריח: '+r(tileArea*10000)+' ס״מ²';}
function calcPaint(){var area=parseFloat(document.getElementById('paint-area').value)||0,cov=parseFloat(document.getElementById('paint-cov').value)||10,coats=parseFloat(document.getElementById('paint-coats').value)||2;if(!area){document.getElementById('paint-result').textContent='הכנס נתונים';return;}var liters=r(area*coats/cov);document.getElementById('paint-result').textContent='צריך: '+liters+' ליטר  |  '+coats+' שכבות על '+area+' מ״ר';}

// WEIGHT
function calcWeight(){var vol=parseFloat(document.getElementById('wt-vol').value)||0,dens=parseFloat(document.getElementById('wt-mat').value)||2400;if(!vol){document.getElementById('wt-result').textContent='הכנס נתונים';return;}var kg=vol*dens;document.getElementById('wt-result').textContent='משקל: '+r(kg)+' ק״ג  |  '+r(kg/1000)+' טון';}

// SLOPE
function calcSlope1(){var run=parseFloat(document.getElementById('sl-run').value)||0,pct=parseFloat(document.getElementById('sl-pct').value)||0;if(!run||!pct){document.getElementById('sl-result1').textContent='הכנס נתונים';return;}var rise=run*pct/100;var deg=r(Math.atan(pct/100)*180/Math.PI);document.getElementById('sl-result1').textContent='גובה: '+r(rise)+' מ׳  |  זווית: '+deg+'°  |  אורך נטוי: '+r(Math.sqrt(run*run+rise*rise))+' מ׳';}
function calcSlope2(){var rise=parseFloat(document.getElementById('sl-rise').value)||0,run=parseFloat(document.getElementById('sl-run2').value)||0;if(!rise||!run){document.getElementById('sl-result2').textContent='הכנס נתונים';return;}var pct=r(rise/run*100);var deg=r(Math.atan(rise/run)*180/Math.PI);document.getElementById('sl-result2').textContent='שיפוע: '+pct+'%  |  זווית: '+deg+'°';}
function calcPyth(){var a=parseFloat(document.getElementById('py-a').value)||0,b=parseFloat(document.getElementById('py-b').value)||0;if(!a||!b){document.getElementById('py-result').textContent='הכנס נתונים';return;}document.getElementById('py-result').textContent='אלכסון: '+r(Math.sqrt(a*a+b*b))+' מ׳';}

// CONVERT
function calcConvLen(){var val=parseFloat(document.getElementById('cv-len-val').value)||0,f=parseFloat(document.getElementById('cv-len-from').value)||1;var m=val*f;document.getElementById('cv-len-result').textContent=val?r(m,4)+' מ׳  |  '+r(m*100,2)+' ס״מ  |  '+r(m/0.3048,3)+' פיט  |  '+r(m/0.0254,2)+' אינץ׳':'הכנס ערך';}
function calcConvArea(){var val=parseFloat(document.getElementById('cv-area-val').value)||0,f=parseFloat(document.getElementById('cv-area-from').value)||1;var m=val*f;document.getElementById('cv-area-result').textContent=val?r(m,4)+' מ״ר  |  '+r(m*10000,2)+' ס״מ²  |  '+r(m/10000,6)+' דונם':'הכנס ערך';}
function calcConvVol(){var val=parseFloat(document.getElementById('cv-vol-val').value)||0,f=parseFloat(document.getElementById('cv-vol-from').value)||1;var m=val*f;document.getElementById('cv-vol-result').textContent=val?r(m,4)+' מ״ק  |  '+r(m*1000,2)+' ליטר  |  '+r(m*1000,2)+' ק״ג (מים)':'הכנס ערך';}

// COST
function calcCost(){var qty=parseFloat(document.getElementById('cost-qty').value)||0,price=parseFloat(document.getElementById('cost-price').value)||0,wst=(parseFloat(document.getElementById('cost-waste').value)||0)/100,vat=parseFloat(document.getElementById('cost-vat').value)||1.18;if(!qty||!price){document.getElementById('cost-result').textContent='הכנס נתונים';return;}var qtyWaste=qty*(1+wst);var net=qtyWaste*price;var total=net*vat;var el=document.getElementById('cost-result');el.innerHTML='כמות כולל בזבוז: '+r(qtyWaste)+' | עלות נטו: ₪'+r(net).toLocaleString('he-IL')+(vat>1?' | סה״כ כולל מע״מ: ₪'+r(total).toLocaleString('he-IL'):'');}

document.addEventListener('DOMContentLoaded', async () => {
  await bootstrap();
  setTimeout(updateMiscBadge, 3000);
  // Restore last tab
  try {
    const saved = localStorage.getItem('beni_active_tab');
    if (saved && saved !== 'crm') await switchTab(saved);
    else {
      // Scroll the active (CRM) tab into view in case it's off-screen
      const t = document.getElementById('tab-crm');
      if (t) t.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
    }
  } catch(e){}
});


// ===== INLINED MODULES =====

// -- crm --
async function crmInit() {
  document.getElementById('dashboard-date').textContent =
    new Date().toLocaleDateString('he-IL', {weekday:'long',year:'numeric',month:'long',day:'numeric'});
  await loadAll();
}

async function loadAll() {
  window.showLoading && window.showLoading(true);
  try {
    // Sequential loads — avoids DataCloneError from Promise.allSettled + Headers
    try { await loadContractors(); } catch(e) { console.error('loadContractors:', e.message); }
    try { await loadProjects();    } catch(e) { console.error('loadProjects:', e.message); }
    try { await loadTransactions();} catch(e) { console.error('loadTransactions:', e.message); }
    try { await loadReports();     } catch(e) { console.error('loadReports:', e.message); }
    renderDashboard();
    // Update PO badge without loading full table (avoids tbody guard)
    try {
      const { data: poData } = await sbQ('purchase_orders','select=id');
      const poBadge = document.getElementById('badge-po');
      if (poBadge && poData) poBadge.textContent = poData.length;
    } catch(e) {}
  } catch(e){ console.error('loadAll:', e.message); }
  finally { window.showLoading && window.showLoading(false); }
}

// ── LOAD ─────────────────────────────────────────────────
async function loadContractors() {
  const {data,error} = await sbQ('contractors_master','select=*&order=company_name.asc');
  if(error) throw error;
  allContractors = data || [];
  window.allContractors = allContractors;
  const activeCount = allContractors.filter(c=>c.is_active).length;
  // Fallback: if no is_active column, show total count
  const badgeCount = activeCount > 0 ? activeCount : allContractors.length;
  document.querySelectorAll('#badge-contractors').forEach(el => el.textContent = badgeCount);
  renderContractors();
  populateContractorSelects();
  populateOccupationFilter();
  _spFillSelects();
  renderAnnexWidget();
}

async function loadProjects() {
  const projRes    = await sbQ('projects','select=*&order=created_at.desc');
  const quotesRes  = await sbQ('quotes','select=id,project_id,title,status');
  const quoteItemsRes = await sbQ('quote_items','select=quote_id,unit_cost,quantity');
  const {data,error} = projRes;
  const quotesData = quotesRes.data||[];
  const quoteItemsData = quoteItemsRes.data||[];
  if(error) throw error;
  allProjects = data || [];
  window.allProjects = allProjects;
  window.allQuotes = quotesData || [];
  window.allQuoteItems = quoteItemsData || [];
  document.querySelectorAll('#badge-projects').forEach(el => el.textContent = allProjects.length);
  window.quoteSum = {};
  (window.allQuotes||[]).forEach(q=>{
    const items = (window.allQuoteItems||[]).filter(i=>i.quote_id===q.id);
    const sum = items.reduce((a,i)=>a+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);
    window.quoteSum[q.project_id] = (window.quoteSum[q.project_id]||0) + sum;
  });
  rebuildCoApprovedSum();
  renderProjects();
  populateProjectSelects();
  if(typeof journalInitialized !== 'undefined' && journalInitialized) {
    populateJournalProjectDropdown();
  }
}

async function loadTransactions() {
  const {data,error} = await sbQ('contractor_transactions','select=*,contractors_master(company_name),projects(project_name)&order=transaction_date.desc');
  if(error) { console.error('loadTransactions error:', error.message); allTransactions = []; return; }
  allTransactions = data || [];
  renderBalances();
  renderTransactions();
}

async function loadReports() {
  try {
    var r = await sbQ('reports','select=*&order=report_date.desc&limit=100');
    allReports = (r && !r.error ? r.data : []) || [];
    if (typeof renderReports==='function') renderReports();
    if (typeof populateReportProjectFilter==='function') populateReportProjectFilter();
  } catch(e){ console.warn('loadReports:',e.message); allReports=[]; }
}

// ── NAVIGATION ───────────────────────────────────────────
function showPage(page) {
  var sidebar = document.querySelector('#crm-panel .sidebar');
  if(sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    var ov = document.getElementById('crm-overlay');
    if(ov) ov.style.display = 'none';
  }
  var main = document.querySelector('#crm-panel .main');
  if(main) Array.from(main.children).forEach(function(c){
    if(c.classList.contains('page')) { c.classList.remove('active'); c.style.display = ''; }
  });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  document.getElementById('crm-panel').classList.add('active');
  document.getElementById('tab-crm') && document.getElementById('tab-crm').classList.add('active');
  const special = {gantt:loadGantt, quotes:loadQuotes, forecast:renderForecast, 'purchase-orders':loadPurchaseOrders, weekly: function(){ loadWeeklyData(); }, takeoff: async function(){
    // Ensure projects are loaded before takeoff page renders
    if (!allProjects || !allProjects.length) {
      try { await loadProjects(); } catch(e) {}
    }
    await loadTakeoffs();
    // Populate project filter dropdown
    const sel = document.getElementById('takeoff-project-filter');
    if(sel && allProjects && allProjects.length > 0) {
      sel.innerHTML = '<option value="">כל הפרויקטים</option><option value="unlinked">ללא קישור ⚠️</option>' +
        allProjects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
    }
  }};
  if(special[page]) {
    var el = document.getElementById('page-'+page);
    if(el) el.style.display = 'block';
    var nav = document.getElementById('nav-'+page);
    if(nav) nav.classList.add('active');
    special[page]();
    return;
  }
  var target = document.getElementById('page-'+page);
  if(target) target.classList.add('active');
  var nav = document.getElementById('nav-'+page);
  if(nav) nav.classList.add('active');
  if(page==='finance') renderBalances();
}

function showFinanceTab(tab) {
  document.getElementById('finance-balances').style.display    = tab==='balances'?'block':'none';
  document.getElementById('finance-transactions').style.display = tab==='transactions'?'block':'none';
  document.getElementById('finance-pnl').style.display          = tab==='pnl'?'block':'none';
  ['balances','transactions','pnl'].forEach(t=>{
    document.getElementById('ftab-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='pnl') renderPnL();
}

// ── DASHBOARD ────────────────────────────────────────────
function renderDashboard() {
  const activeProjects = allProjects.filter(p=>p.status==='active');
  const totalSent = allTransactions.filter(t=>t.type==='sent').reduce((s,t)=>s+Number(t.amount),0);
  const totalIncome = allTransactions.filter(t=>t.type==='client_income').reduce((s,t)=>s+Number(t.amount),0);
  const now = new Date();
  const monthReports = allReports.filter(r=>{const d=new Date(r.report_date||r.created_at);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
  document.getElementById('stat-active-projects').textContent = activeProjects.length;
  document.getElementById('stat-total-projects').textContent = allProjects.length;
  const overdueCount = activeProjects.filter(p=>p.planned_end_date&&new Date(p.planned_end_date)<new Date()).length;
  const overdueEl = document.getElementById('stat-overdue-projects');
  if(overdueEl){overdueEl.textContent=overdueCount?overdueCount+' באיחור ⚠️':'הכל בזמן ✓';overdueEl.style.color=overdueCount?'#ef4444':'#22c55e';}
  document.getElementById('stat-active-contractors').textContent = allContractors.filter(c=>c.is_active).length;
  document.getElementById('stat-total-sent').textContent = '₪'+fmtMoney(totalSent);
  const incEl=document.getElementById('stat-total-income');if(incEl)incEl.textContent=totalIncome?'₪'+fmtMoney(totalIncome):'—';
  document.getElementById('stat-reports-month').textContent = monthReports.length;
  const totalBudget = allProjects.reduce((s,p)=>s+(p.total_budget||0),0);
  const totalQuotes = allProjects.reduce((s,p)=>s+(window.quoteSum&&window.quoteSum[p.id]||0),0);
  const totalCO = allProjects.reduce((s,p)=>s+(window.coApprovedSum&&window.coApprovedSum[p.id]||0),0);
  document.getElementById('stat-total-profit').textContent = totalBudget?'₪'+fmtMoney(totalBudget-totalQuotes-totalCO):'—';
  const plist = document.getElementById('dashboard-projects-list');
  if(!activeProjects.length){plist.innerHTML='<div class="empty-state"><div class="empty-icon">🏗️</div><h3>אין פרויקטים פעילים</h3></div>';}
  else{plist.innerHTML=activeProjects.map(p=>`<div class="contractor-mini" onclick="showPage('projects')"><div class="contractor-avatar" style="background:linear-gradient(135deg,#1e6b30,#0e7490)">${(p.project_name||'?')[0]}</div><div class="contractor-info"><div class="contractor-name">${esc(p.project_name)}</div><div class="contractor-role">${esc(p.client_name||'')} ${p.start_date?'| '+fmtDate(p.start_date):''}</div></div></div>`).join('');}
  const tlist=document.getElementById('dashboard-transactions');
  const recent=allTransactions.slice(0,5);
  if(!recent.length){tlist.innerHTML='<div class="empty-state"><div class="empty-icon">💰</div><h3>אין תנועות עדיין</h3></div>';}
  else{tlist.innerHTML=`<table style="width:100%"><tbody>${recent.map(t=>`<tr><td style="padding:10px 8px;font-size:13px;color:var(--text3)">${fmtDate(t.transaction_date)}</td><td style="padding:10px 8px;font-weight:600">${esc(t.contractors_master?.company_name||'')}</td><td style="padding:10px 8px;font-size:13px;color:var(--text3)">${esc(t.description||'')}</td><td style="padding:10px 8px;text-align:left;font-weight:700" class="${t.type==='sent'?'amount-sent':'amount-received'}">${t.type==='sent'?'−':'+'} ₪${fmtMoney(t.amount)}</td></tr>`).join('')}</tbody></table>`;}
}

// ── CONTRACTORS ──────────────────────────────────────────
function renderContractors(list) {
  const data = list||allContractors;
  const tbody = document.getElementById('contractors-tbody');
  if(!data.length){tbody.innerHTML='<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">👷</div><h3>אין קבלנים</h3></div></td></tr>';return;}
  tbody.innerHTML = data.map(c=>{
    const phone=c.mobile||'';
    const phoneIntl=phone.replace(/[^0-9]/g,'').replace(/^0/,'972');
    const phoneBtns=phone?`<div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:600;color:#1a3d5c">${esc(phone)}</span><a href="tel:${esc(phone)}" onclick="event.stopPropagation()" style="background:#2d6a9f;color:white;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;text-decoration:none;">📞</a><a href="https://wa.me/${phoneIntl}" target="_blank" onclick="event.stopPropagation()" style="background:#25D366;color:white;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;text-decoration:none;">💬</a></div>`:'<span style="color:#aaa">—</span>';
    return `<tr style="cursor:pointer" onclick="openContractorModal('${c.id}')"><td><strong>${esc(c.company_name)}</strong></td><td>${esc(c.contact_name||'—')}</td><td>${phoneBtns}</td><td>${esc(c.main_occupation||'—')}</td></tr>`;
  }).join('');
}

function filterContractors() {
  const q=document.getElementById('contractor-search').value.toLowerCase();
  const occ=document.getElementById('contractor-filter-occupation').value;
  const st=document.getElementById('contractor-filter-status').value;
  renderContractors(allContractors.filter(c=>{
    const txt=(c.company_name+c.contact_name+(c.mobile||'')+(c.main_occupation||'')).toLowerCase();
    return(!q||txt.includes(q))&&(!occ||c.main_occupation===occ)&&(!st||(st==='active'?c.is_active:!c.is_active));
  }));
}

function populateOccupationFilter() {
  const occupations=[...new Set(allContractors.map(c=>c.main_occupation).filter(Boolean))].sort();
  const sel=document.getElementById('contractor-filter-occupation');
  sel.innerHTML='<option value="">כל העיסוקים</option>'+occupations.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('');
}

function openContractorModal(id=null) {
  editingContractorId=id;
  ['company','contact','mobile','office','email','occupation','id','license','license-expiry','rating','notes'].forEach(f=>{const el=document.getElementById('c-'+f);if(el)el.value='';});
  document.getElementById('btn-delete-contractor').style.display=id?'block':'none';
  document.getElementById('modal-contractor-title').textContent=id?'עריכת קבלן':'קבלן חדש';
  if(id){const c=allContractors.find(x=>x.id===id);if(c){document.getElementById('c-company').value=c.company_name||'';document.getElementById('c-contact').value=c.contact_name||'';document.getElementById('c-mobile').value=c.mobile||'';document.getElementById('c-office').value=c.office_tel||'';document.getElementById('c-email').value=c.email||'';document.getElementById('c-occupation').value=c.main_occupation||'';document.getElementById('c-id').value=c.id_number||'';document.getElementById('c-license').value=c.license_number||'';document.getElementById('c-license-expiry').value=c.license_expiry||'';document.getElementById('c-rating').value=c.rating||'';document.getElementById('c-notes').value=c.internal_notes||'';}}
  document.getElementById('modal-contractor').style.display='flex';
}

async function saveContractor() {
  const company=document.getElementById('c-company').value.trim();
  const contact=document.getElementById('c-contact').value.trim();
  if(!company||!contact){showToast('שדות חובה: שם חברה ואיש קשר','error');return;}
  window.showLoading&&window.showLoading(true);
  try{
    const payload={company_name:company,contact_name:contact,mobile:document.getElementById('c-mobile').value.trim()||null,office_tel:document.getElementById('c-office').value.trim()||null,email:document.getElementById('c-email').value.trim()||null,main_occupation:document.getElementById('c-occupation').value||null,id_number:document.getElementById('c-id').value.trim()||null,license_number:document.getElementById('c-license').value.trim()||null,license_expiry:document.getElementById('c-license-expiry').value||null,rating:parseInt(document.getElementById('c-rating').value)||null,internal_notes:document.getElementById('c-notes').value.trim()||null,updated_at:new Date().toISOString()};
    if(editingContractorId){const{error}=await sb.from('contractors_master').update(payload).eq('id',editingContractorId);if(error)throw error;showToast('קבלן עודכן ✅','success');}
    else{const{error}=await sb.from('contractors_master').insert({...payload,is_active:true});if(error)throw error;showToast('קבלן חדש נוסף ✅','success');}
    closeModal('modal-contractor');await loadContractors();
  }catch(e){showToast('שגיאה: '+e.message,'error');}
  finally{window.showLoading&&window.showLoading(false);}
}

async function deleteContractor() {
  if(!editingContractorId||!confirm('האם למחוק קבלן זה?'))return;
  window.showLoading&&window.showLoading(true);
  try{const{error}=await sb.from('contractors_master').delete().eq('id',editingContractorId);if(error)throw error;showToast('קבלן נמחק','success');closeModal('modal-contractor');await loadContractors();}
  catch(e){showToast('שגיאה: '+e.message,'error');}
  finally{window.showLoading&&window.showLoading(false);}
}

// ── PROJECTS ─────────────────────────────────────────────
const STATUS_HE   = {active:'פעיל',completed:'הושלם',paused:'מושהה',cancelled:'בוטל'};
const STATUS_BADGE = {active:'badge-green',completed:'badge-blue',paused:'badge-amber',cancelled:'badge-red'};

function renderProjects(list) {
  const data=list||allProjects;
  const tbody=document.getElementById('projects-tbody');
  if(!data.length){tbody.innerHTML='<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">🏗️</div><h3>אין פרויקטים</h3></div></td></tr>';return;}
  const reportCount={};allReports.forEach(r=>{if(r.project_id)reportCount[r.project_id]=(reportCount[r.project_id]||0)+1;});
  tbody.innerHTML=data.map(p=>{
    const qs=window.quoteSum&&window.quoteSum[p.id]||0;
    const cos=window.coApprovedSum&&window.coApprovedSum[p.id]||0;
    const profit=((p.total_budget||0)-qs-cos);
    return`<tr><td><strong>${esc(p.project_name)}</strong></td><td>${esc(p.client_name||'—')}</td><td style="font-size:13px;color:var(--text3)">${esc(p.city||p.address||'—')}</td><td style="font-size:13px">${p.start_date?fmtDate(p.start_date):'—'}</td><td>${p.total_budget?'₪'+fmtMoney(p.total_budget):'—'}</td><td class="col-quote-sum">${qs?'₪'+fmtMoney(qs):'—'}</td><td style="color:${profit>=0?'#22c55e':'#ef4444'};font-weight:700">${p.total_budget?'₪'+fmtMoney(profit):'—'}</td><td style="text-align:center"><span class="badge badge-blue">${reportCount[p.id]||0} 📝</span></td><td><span class="badge ${STATUS_BADGE[p.status]||'badge-gray'}">${STATUS_HE[p.status]||p.status}</span></td><td>${(()=>{if(!p.start_date||!p.planned_end_date)return'<span style="color:#aaa;font-size:11px">ללא</span>';const start=new Date(p.start_date),end=new Date(p.planned_end_date),now=new Date();const pct=Math.min(100,Math.max(0,Math.round((now-start)/(end-start)*100)));return'<div style="background:#f0f0f0;border-radius:4px;height:7px;"><div style="width:'+pct+'%;background:#3b82f6;height:7px;border-radius:4px;"></div></div><div style="font-size:10px;color:#666">'+pct+'%</div>';})()}</td><td class="td-actions"><div class="btn-group"><button class="btn btn-ghost btn-sm btn-icon" onclick="openProjectModal('${p.id}')">✏️</button><button class="btn btn-ghost btn-sm btn-icon" onclick="openPhotoGallery('${p.id}','${esc(p.project_name)}')">📸</button><button class="btn btn-ghost btn-sm btn-icon" onclick="sendBriefToBeni('${p.id}')" title="שלח בריפינג לבני">📲</button><button class="btn btn-ghost btn-sm btn-icon" onclick="openProjectContent('${p.id}','${esc(p.project_name)}','notes')" title="כל תוכן הפרויקט">📂</button></div></td></tr>`;
  }).join('');
}
