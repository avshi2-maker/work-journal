// encyclopedia.js — Field Encyclopedia
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

