// ══════════════════════════════════════════════════════════════════════
// contacts.js — ספר אנשי קשר של בני
// Tables: beni_contacts, beni_professions, beni_contact_projects
// ══════════════════════════════════════════════════════════════════════

var _ctContacts    = [];
var _ctProfessions = [];
var _ctCatFilter   = '';
var _ctSearch      = '';
var _ctSort        = 'name';
var _ctEditId      = null;  // null = new, uuid = edit

// ── INIT ──────────────────────────────────────────────────────────────
async function ctInit() {
  var wrap = document.getElementById('ct-wrap');
  if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-size:13px;">טוען אנשי קשר...</div>';
  try {
    var p = await sbQ('beni_professions', 'order=id.asc&limit=100');
    _ctProfessions = p.data || [];
    var c = await sbQ('beni_contacts', 'order=full_name.asc&limit=500&is_active=eq.true');
    _ctContacts = c.data || [];
  } catch(e) {
    if (wrap) wrap.innerHTML = '<div style="color:#c62828;padding:20px;text-align:center;">שגיאה: '+e.message+'</div>';
    return;
  }
  ctRenderHeader();
  ctApplyFilters();
}

// ── HEADER ─────────────────────────────────────────────────────────────
function ctRenderHeader() {
  var hdr = document.getElementById('ct-header');
  if (!hdr) return;

  // Build category chips from professions
  var cats = {};
  _ctProfessions.forEach(function(p){ cats[p.category]=(cats[p.category]||0)+1; });

  var chips = '<button onclick="ctSetCat(\'\')" style="'+ctChipStyle(_ctCatFilter==='')+' ">הכל ('+_ctContacts.length+')</button>';
  Object.keys(cats).sort().forEach(function(cat){
    var cnt = _ctContacts.filter(function(c){ return c.category===cat; }).length;
    chips += '<button onclick="ctSetCat(\''+ctEsc(cat)+'\')" style="'+ctChipStyle(_ctCatFilter===cat)+'">'+ctEsc(cat)+(cnt?' ('+cnt+')':'')+'</button>';
  });

  hdr.innerHTML =
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">' +
      '<input id="ct-search" type="text" placeholder="🔍 חפש שם, טלפון, חברה..." oninput="ctApplyFilters()" ' +
        'style="flex:1;min-width:180px;padding:9px 14px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;background:#fffbf0;">' +
      '<select id="ct-sort" onchange="ctApplyFilters()" style="padding:9px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;background:#fff;">' +
        '<option value="name">מיון: שם</option>' +
        '<option value="skill">מיון: כישורים</option>' +
        '<option value="cat">מיון: קטגוריה</option>' +
        '<option value="recent">מיון: חדש</option>' +
      '</select>' +
      '<span id="ct-count" style="font-size:11px;color:#888;white-space:nowrap;font-weight:700;"></span>' +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+chips+'</div>';
}

function ctChipStyle(active) {
  return active
    ? 'padding:5px 14px;border-radius:16px;border:1.5px solid #c9a84c;background:#c9a84c;color:#fff;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;'
    : 'padding:5px 14px;border-radius:16px;border:1px solid #c9a84c;background:#fff;color:#9a6f00;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
}

function ctSetCat(cat) { _ctCatFilter = cat; ctApplyFilters(); }

// ── FILTER + SORT ──────────────────────────────────────────────────────
function ctApplyFilters() {
  var q    = ((document.getElementById('ct-search')||{}).value||'').toLowerCase();
  var sort = ((document.getElementById('ct-sort')||{}).value||'name');

  var filtered = _ctContacts.filter(function(c){
    if (_ctCatFilter && c.category !== _ctCatFilter) return false;
    if (q) {
      var hay = ((c.full_name||'')+' '+(c.phone||'')+' '+(c.company||'')+' '+(c.profession_free||'')).toLowerCase();
      var prof = _ctProfessions.find(function(p){ return p.id===c.profession_id; });
      if (prof) hay += ' '+prof.profession_he.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort(function(a,b){
    if (sort==='skill')  return (b.skill_score||0)-(a.skill_score||0);
    if (sort==='cat')    return (a.category||'').localeCompare(b.category||'');
    if (sort==='recent') return new Date(b.created_at)-new Date(a.created_at);
    return (a.full_name||'').localeCompare(b.full_name||'');
  });

  var cnt = document.getElementById('ct-count');
  if (cnt) cnt.textContent = filtered.length+' / '+_ctContacts.length+' אנשי קשר';

  var grid = document.getElementById('ct-grid');
  if (!grid) return;
  if (!filtered.length) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:#aaa;font-size:13px;">אין אנשי קשר תואמים</div>';
    return;
  }
  grid.innerHTML = '';
  filtered.forEach(function(c){ grid.appendChild(ctBuildCard(c)); });
}

// ── CARD ───────────────────────────────────────────────────────────────
function ctBuildCard(contact) {
  var prof = _ctProfessions.find(function(p){ return p.id===contact.profession_id; });
  var profName = contact.profession_free || (prof ? prof.profession_he : '—');
  var cat  = contact.category || (prof ? prof.category : '');
  var catColors = {
    'Trades':'#e8f0fd:#1a3d5c', 'Engineering':'#e8f5e9:#1b5e20',
    'Design & Planning':'#f3e5f5:#4a148c', 'Management':'#fff8e1:#e65100',
    'Specialist Consultant':'#fce4ec:#880e4f', 'Safety':'#fff3e0:#bf360c',
    'Legal/Financial':'#e0f2f1:#004d40', 'Surveying':'#ede7f6:#311b92',
    'Specialist':'#e3f2fd:#0d47a1', 'Quality Control':'#f9fbe7:#33691e'
  };
  var cc = (catColors[cat]||'#f5f0e8:#1a3d5c').split(':');
  var catBg = cc[0], catFg = cc[1];

  var stars = function(n, color) {
    if (!n) return '<span style="color:#ddd;font-size:11px;">—</span>';
    var s='';
    for(var i=1;i<=5;i++) s+='<span style="color:'+(i<=n?color:'#ddd')+';font-size:12px;">★</span>';
    return s;
  };

  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border:1px solid #e8ddb5;border-radius:12px;padding:16px;direction:rtl;display:flex;flex-direction:column;gap:8px;transition:box-shadow .15s;';
  card.onmouseover = function(){ this.style.boxShadow='0 3px 12px rgba(201,168,76,0.2)'; };
  card.onmouseout  = function(){ this.style.boxShadow=''; };

  // Avatar + name
  var initials = (contact.full_name||'?').split(' ').map(function(w){return w[0];}).slice(0,2).join('');
  card.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:10px;">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:'+catBg+';color:'+catFg+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0;">'+ctEsc(initials)+'</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:14px;font-weight:900;color:#1a3d5c;line-height:1.3;">'+ctEsc(contact.full_name||'')+'</div>' +
        '<div style="font-size:11px;color:#9a6f00;font-weight:700;background:'+catBg+';border-radius:6px;padding:1px 7px;display:inline-block;margin-top:2px;">'+ctEsc(profName)+'</div>' +
      '</div>' +
      '<button onclick="ctDelete(\''+contact.id+'\')" style="background:none;border:none;color:#ddd;font-size:14px;cursor:pointer;padding:0;" onmouseover="this.style.color=\'#c62828\'" onmouseout="this.style.color=\'#ddd\'">🗑</button>' +
    '</div>' +

    // Phone + email
    (contact.phone ? '<div style="font-size:12px;color:#333;"><a href="tel:'+ctEsc(contact.phone)+'" style="color:#1a3d5c;font-weight:700;text-decoration:none;">📞 '+ctEsc(contact.phone)+'</a>'+
      (contact.phone2 ? ' &nbsp; <a href="tel:'+ctEsc(contact.phone2)+'" style="color:#555;font-size:11px;text-decoration:none;">'+ctEsc(contact.phone2)+'</a>' : '')+'</div>' : '') +
    (contact.email  ? '<div style="font-size:11px;"><a href="mailto:'+ctEsc(contact.email)+'" style="color:#2563eb;text-decoration:none;">✉️ '+ctEsc(contact.email)+'</a></div>' : '') +
    (contact.company? '<div style="font-size:11px;color:#666;font-weight:700;">🏢 '+ctEsc(contact.company)+'</div>' : '') +

    // Stars
    '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
      '<div><div style="font-size:9px;color:#aaa;font-weight:700;margin-bottom:1px;">כישורים</div>'+stars(contact.skill_score,'#c9a84c')+'</div>' +
      '<div><div style="font-size:9px;color:#aaa;font-weight:700;margin-bottom:1px;">אמינות</div>'+stars(contact.reliability,'#1b6b35')+'</div>' +
      '<div><div style="font-size:9px;color:#aaa;font-weight:700;margin-bottom:1px;">מחיר</div>'+stars(contact.price_level,'#2563eb')+'</div>' +
    '</div>' +

    // Remarks
    (contact.remarks ? '<div style="font-size:11px;color:#666;background:#fffbf0;border-right:3px solid #c9a84c;padding:5px 8px;border-radius:0 6px 6px 0;line-height:1.6;">'+ctEsc(contact.remarks.substring(0,100))+(contact.remarks.length>100?'…':'')+'</div>' : '') +

    // Action buttons
    '<div style="display:flex;gap:6px;padding-top:6px;border-top:1px solid #f0e8d0;">' +
      '<button onclick="ctOpenEdit(\''+contact.id+'\')" style="flex:1;padding:6px;background:#fff8e0;border:1.5px solid #c9a84c;color:#7a5500;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;">✏️ ערוך</button>' +
      '<button onclick="ctCallWA(\''+contact.id+'\')" style="flex:1;padding:6px;background:#e8faf0;border:1.5px solid #1b6b35;color:#1b6b35;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;">💬 WA</button>' +
      '<button onclick="ctLinkProject(\''+contact.id+'\')" style="flex:1;padding:6px;background:#e8f0fd;border:1.5px solid #1a3d5c;color:#1a3d5c;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;">🔗 פרויקט</button>' +
    '</div>';

  return card;
}

// ── OPEN ADD/EDIT MODAL ────────────────────────────────────────────────
function ctOpenAdd() { ctOpenEdit(null); }

function ctOpenEdit(id) {
  _ctEditId = id;
  var contact = id ? _ctContacts.find(function(c){ return c.id===id; }) : null;
  var c = contact || {};

  var ov = document.createElement('div');
  ov.id = 'ct-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;';
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});

  // Build profession options grouped by category
  var profOpts = '<option value="">— בחר מקצוע —</option>';
  var lastCat = '';
  _ctProfessions.forEach(function(p){
    if (p.category !== lastCat) {
      if (lastCat) profOpts += '</optgroup>';
      profOpts += '<optgroup label="'+ctEsc(p.category)+'">';
      lastCat = p.category;
    }
    profOpts += '<option value="'+p.id+'"'+(c.profession_id===p.id?' selected':'')+'>'+ctEsc(p.profession_he)+'</option>';
  });
  if (lastCat) profOpts += '</optgroup>';

  // Project options
  var projOpts = '<option value="">— קשר לפרויקט —</option>';
  (window.allProjects||[]).forEach(function(p){
    projOpts += '<option value="'+p.id+'">'+ctEsc(p.project_name)+'</option>';
  });

  var inp = 'width:100%;padding:9px 12px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;background:#fffbf0;box-sizing:border-box;';

  var starsInput = function(field, label, color) {
    var val = c[field]||0;
    var html = '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">'+label+'</div><div style="display:flex;gap:4px;">';
    for (var i=1;i<=5;i++) {
      html += '<button type="button" id="ct-'+field+'-'+i+'" onclick="ctSetStar(\''+field+'\','+i+')" '+
        'style="width:28px;height:28px;border:1.5px solid '+(i<=val?color:'#ddd')+';border-radius:6px;background:'+(i<=val?color:'#fff')+';color:'+(i<=val?'#fff':'#bbb')+';cursor:pointer;font-size:14px;font-weight:700;">'+i+'</button>';
    }
    html += '</div><input type="hidden" id="ct-inp-'+field+'" value="'+val+'"></div>';
    return html;
  };

  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:560px;direction:rtl;font-family:Heebo,Arial,sans-serif;overflow:hidden;">' +

      '<div style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="font-size:17px;font-weight:800;color:#fff;">'+(id?'✏️ עריכת איש קשר':'➕ איש קשר חדש')+'</div>' +
        '<button onclick="document.getElementById(\'ct-modal\').remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;">✕</button>' +
      '</div>' +

      '<div style="padding:20px;display:flex;flex-direction:column;gap:12px;">' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">שם מלא *</div>'+
            '<input id="ct-inp-name" type="text" value="'+ctEsc(c.full_name||'')+'" placeholder="שם פרטי ומשפחה" style="'+inp+'"></div>' +
          '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">חברה / עסק</div>'+
            '<input id="ct-inp-company" type="text" value="'+ctEsc(c.company||'')+'" placeholder="שם החברה" style="'+inp+'"></div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">טלפון ראשי</div>'+
            '<input id="ct-inp-phone" type="tel" value="'+ctEsc(c.phone||'')+'" placeholder="05X-XXXXXXX" style="'+inp+';direction:ltr;text-align:right;"></div>' +
          '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">טלפון נוסף</div>'+
            '<input id="ct-inp-phone2" type="tel" value="'+ctEsc(c.phone2||'')+'" placeholder="05X-XXXXXXX" style="'+inp+';direction:ltr;text-align:right;"></div>' +
        '</div>' +

        '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">אימייל</div>'+
          '<input id="ct-inp-email" type="email" value="'+ctEsc(c.email||'')+'" placeholder="name@example.com" style="'+inp+';direction:ltr;"></div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">מקצוע מהרשימה</div>'+
            '<select id="ct-inp-prof" style="'+inp+'">'+profOpts+'</select></div>' +
          '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">מקצוע חופשי</div>'+
            '<input id="ct-inp-prof-free" type="text" value="'+ctEsc(c.profession_free||'')+'" placeholder="כתוב מקצוע חופשי..." style="'+inp+'"></div>' +
        '</div>' +

        '<div style="background:#f8f9fc;border-radius:10px;padding:12px;">' +
          '<div style="font-size:12px;font-weight:800;color:#1a3d5c;margin-bottom:10px;">דירוג (1=נמוך, 5=מצוין)</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">' +
            starsInput('skill_score','⭐ כישורים','#c9a84c') +
            starsInput('reliability','🤝 אמינות','#1b6b35') +
            starsInput('price_level','💰 מחיר','#2563eb') +
          '</div>' +
        '</div>' +

        '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">קשר לפרויקט</div>'+
          '<select id="ct-inp-proj" style="'+inp+'">'+projOpts+'</select></div>' +

        '<div><div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:700;">הערות חופשיות</div>'+
          '<textarea id="ct-inp-remarks" rows="3" placeholder="כל הערה רלוונטית — ניסיון, המלצות, אזהרות..." style="'+inp+'resize:vertical;">'+ctEsc(c.remarks||'')+'</textarea></div>' +

        '<div id="ct-modal-status" style="display:none;"></div>' +

        '<div style="display:flex;gap:8px;">' +
          '<button onclick="ctSave()" style="flex:1;padding:12px;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;">💾 שמור</button>' +
          '<button onclick="document.getElementById(\'ct-modal\').remove()" style="padding:12px 18px;background:#f5f0e8;border:1px solid #c9a84c;color:#7a5500;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">ביטול</button>' +
        '</div>' +

      '</div>' +
    '</div>';

  document.body.appendChild(ov);
}

function ctSetStar(field, val) {
  var inp = document.getElementById('ct-inp-'+field);
  if (inp) inp.value = val;
  var colors = {skill_score:'#c9a84c', reliability:'#1b6b35', price_level:'#2563eb'};
  var color = colors[field]||'#c9a84c';
  for (var i=1;i<=5;i++) {
    var btn = document.getElementById('ct-'+field+'-'+i);
    if (!btn) continue;
    btn.style.background = i<=val ? color : '#fff';
    btn.style.color      = i<=val ? '#fff' : '#bbb';
    btn.style.borderColor= i<=val ? color : '#ddd';
  }
}

// ── SAVE ───────────────────────────────────────────────────────────────
async function ctSave() {
  var name = (document.getElementById('ct-inp-name')||{}).value||'';
  if (!name.trim()) { showToast('הכנס שם','error'); return; }

  var profId   = parseInt((document.getElementById('ct-inp-prof')||{}).value)||null;
  var profFree = (document.getElementById('ct-inp-prof-free')||{}).value||'';
  var prof     = profId ? _ctProfessions.find(function(p){return p.id===profId;}) : null;

  var payload = {
    full_name:      name.trim(),
    company:        (document.getElementById('ct-inp-company')||{}).value||null,
    phone:          (document.getElementById('ct-inp-phone')||{}).value||null,
    phone2:         (document.getElementById('ct-inp-phone2')||{}).value||null,
    email:          (document.getElementById('ct-inp-email')||{}).value||null,
    profession_id:  profId,
    profession_free:profFree||null,
    category:       prof ? prof.category : null,
    role_level:     prof ? prof.role_level : null,
    skill_score:    parseInt((document.getElementById('ct-inp-skill_score')||{}).value)||null,
    reliability:    parseInt((document.getElementById('ct-inp-reliability')||{}).value)||null,
    price_level:    parseInt((document.getElementById('ct-inp-price_level')||{}).value)||null,
    remarks:        (document.getElementById('ct-inp-remarks')||{}).value||null,
    updated_at:     new Date().toISOString()
  };

  var statusEl = document.getElementById('ct-modal-status');

  try {
    var method = _ctEditId ? 'PATCH' : 'POST';
    var url = SB_URL+'/rest/v1/beni_contacts'+(_ctEditId ? '?id=eq.'+_ctEditId : '');
    if (!_ctEditId) payload.created_at = new Date().toISOString();

    var res = await fetch(url, {
      method: method,
      headers: {
        apikey: SB_KEY, Authorization: 'Bearer '+SB_KEY,
        'Content-Type': 'application/json',
        Prefer: _ctEditId ? 'return=minimal' : 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { var et=await res.text(); throw new Error('HTTP '+res.status+' '+et.substr(0,80)); }

    // Link to project if selected
    var projId = (document.getElementById('ct-inp-proj')||{}).value||'';
    if (projId && !_ctEditId) {
      var savedData = await res.json().catch(function(){return [{}];});
      var newId = savedData[0] && savedData[0].id;
      if (newId) {
        var proj = (window.allProjects||[]).find(function(p){return p.id===projId;});
        await fetch(SB_URL+'/rest/v1/beni_contact_projects', {
          method: 'POST',
          headers: {apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal'},
          body: JSON.stringify({contact_id:newId, project_id:projId, project_name:proj?proj.project_name:'', role_in_project:''})
        });
      }
    }

    var modal = document.getElementById('ct-modal');
    if (modal) modal.remove();
    showToast(_ctEditId ? '✅ עודכן' : '✅ נשמר','success');
    await ctInit();

  } catch(e) {
    if (statusEl) { statusEl.style.display='block'; statusEl.innerHTML='<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:10px;font-size:12px;color:#c62828;">שגיאה: '+e.message+'</div>'; }
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────
async function ctDelete(id) {
  if (!confirm('מחק איש קשר זה?')) return;
  try {
    await fetch(SB_URL+'/rest/v1/beni_contacts?id=eq.'+id, {
      method: 'PATCH',
      headers: {apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal'},
      body: JSON.stringify({is_active: false})
    });
    showToast('🗑️ נמחק','success');
    _ctContacts = _ctContacts.filter(function(c){return c.id!==id;});
    ctRenderHeader();
    ctApplyFilters();
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

// ── WHATSAPP ───────────────────────────────────────────────────────────
function ctCallWA(id) {
  var c = _ctContacts.find(function(x){return x.id===id;});
  if (!c||!c.phone) { showToast('אין מספר טלפון','error'); return; }
  var phone = c.phone.replace(/[-\s]/g,'').replace(/^0/,'972');
  window.open('https://wa.me/'+phone,'_blank');
}

// ── LINK TO PROJECT ────────────────────────────────────────────────────
function ctLinkProject(id) {
  var c = _ctContacts.find(function(x){return x.id===id;});
  if (!c) return;

  var ov = document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});

  var projOpts = '<option value="">— בחר פרויקט —</option>';
  (window.allProjects||[]).forEach(function(p){
    projOpts += '<option value="'+p.id+'">'+ctEsc(p.project_name)+'</option>';
  });

  ov.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:380px;padding:20px;direction:rtl;font-family:Heebo,Arial,sans-serif;">' +
      '<div style="font-size:15px;font-weight:800;color:#1a3d5c;margin-bottom:14px;">🔗 קשר לפרויקט — '+ctEsc(c.full_name)+'</div>' +
      '<select id="ct-link-proj" style="width:100%;padding:10px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;margin-bottom:10px;">'+projOpts+'</select>' +
      '<input id="ct-link-role" type="text" placeholder="תפקיד בפרויקט (אופציונלי)..." style="width:100%;padding:10px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;box-sizing:border-box;margin-bottom:14px;">' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="ctSaveProjectLink(\''+id+'\')" style="flex:1;padding:10px;background:#1a3d5c;border:none;color:#FFD700;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">💾 קשר</button>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:10px 16px;background:#f5f0e8;border:1px solid #c9a84c;color:#7a5500;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">ביטול</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(ov);
}

async function ctSaveProjectLink(contactId) {
  var projId = (document.getElementById('ct-link-proj')||{}).value||'';
  var role   = (document.getElementById('ct-link-role')||{}).value||'';
  if (!projId) { showToast('בחר פרויקט','error'); return; }
  var proj = (window.allProjects||[]).find(function(p){return p.id===projId;});
  try {
    await fetch(SB_URL+'/rest/v1/beni_contact_projects', {
      method: 'POST',
      headers: {apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json', Prefer:'return=minimal'},
      body: JSON.stringify({contact_id:contactId, project_id:projId, project_name:proj?proj.project_name:'', role_in_project:role})
    });
    document.querySelector('div[style*="position:fixed"]') && document.querySelector('div[style*="position:fixed"]').remove();
    showToast('✅ קושר לפרויקט: '+(proj?proj.project_name:''),'success');
  } catch(e) { showToast('שגיאה: '+e.message,'error'); }
}

// ── UTIL ───────────────────────────────────────────────────────────────
function ctEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
