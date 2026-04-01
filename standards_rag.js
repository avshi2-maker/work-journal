// ══════════════════════════════════════════════════════════════════════
// BUILDING STANDARDS RAG — standards_rag.js
// ══════════════════════════════════════════════════════════════════════
var _stdResults  = [];
var _stdInited   = false;

async function standardsRagInit() {
  if (_stdInited) { standardsRagSearch(); return; }
  _stdInited = true;
  var si = document.getElementById('std-search-input');
  var cf = document.getElementById('std-category-filter');
  var af = document.getElementById('std-authority-filter');
  var mf = document.getElementById('std-mandatory-filter');
  if (si) si.addEventListener('input',  _stdDebounce(standardsRagSearch, 400));
  if (cf) cf.addEventListener('change', standardsRagSearch);
  if (af) af.addEventListener('change', standardsRagSearch);
  if (mf) mf.addEventListener('change', standardsRagSearch);
  await _stdLoadCategories();
  standardsRagSearch();
}

async function _stdLoadCategories() {
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/building_standards?select=industry_category&order=industry_category',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    var rows = await res.json();
    var cats = [...new Set((rows||[]).map(function(r){ return r.industry_category; }).filter(Boolean))].sort();
    var sel  = document.getElementById('std-category-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="">כל הקטגוריות (' + cats.length + ')</option>' +
      cats.map(function(c){ return '<option value="'+_stdEsc(c)+'">'+c+'</option>'; }).join('');
  } catch(e) { console.error('_stdLoadCategories:', e); }
}

async function standardsRagSearch() {
  var query = (document.getElementById('std-search-input')   ||{}).value || '';
  var cat   = (document.getElementById('std-category-filter')||{}).value || '';
  var auth  = (document.getElementById('std-authority-filter')||{}).value || '';
  var mand  = (document.getElementById('std-mandatory-filter')||{}).value || '';
  var list  = document.getElementById('std-results-list');
  var stats = document.getElementById('std-stats-bar');
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:13px;">מחפש...</div>';

  try {
    var params = 'select=*&order=mandatory_in_israel.desc,standard_id.asc&limit=50';
    if (cat)  params += '&industry_category=eq.' + encodeURIComponent(cat);
    if (auth) params += '&authority=ilike.' + encodeURIComponent('%' + auth + '%');
    if (mand) params += '&mandatory_in_israel=eq.' + encodeURIComponent(mand);
    if (query) {
      var q = encodeURIComponent('%' + query + '%');
      params += '&or=(standard_id.ilike.'+q+',title_he.ilike.'+q+',title_en.ilike.'+q+',scope.ilike.'+q+',notes.ilike.'+q+')';
    }
    var res  = await fetch(SB_URL + '/rest/v1/building_standards?' + params,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    _stdResults = (await res.json()) || [];
    if (stats) stats.textContent = _stdResults.length + ' תקנים נמצאו' +
      (cat ? ' — ' + cat : '') + (_stdResults.length===50?' (מוצגים 50 ראשונים)':'');
    if (!_stdResults.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#555;font-size:14px;">לא נמצאו תקנים — נסה מונח אחר</div>';
      return;
    }
    _stdRenderResults(_stdResults);
  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:12px;">שגיאה: ' + e.message + '</div>';
  }
}

function _stdRenderResults(rows) {
  var list = document.getElementById('std-results-list');
  if (!list) return;
  var MCOL = { yes:'#22c55e', no:'#ef4444', partial:'#f59e0b' };
  var MLBL = { yes:'✅ מחייב', no:'❌ לא מחייב', partial:'⚠️ חלקי', 'כן':'✅ מחייב', 'לא':'❌ לא מחייב', 'חלקי':'⚠️ חלקי' };

  list.innerHTML = rows.map(function(r, idx) {
    var mc  = MCOL[r.mandatory_in_israel] || '#888';
    var ml  = MLBL[r.mandatory_in_israel] || r.mandatory_in_israel;
    var ac  = r.authority && r.authority.includes('SII') ? '#1a3d5c' : r.authority && r.authority.includes('EU') ? '#1e40af' : '#6d28d9';
    var reqs= Array.isArray(r.key_requirements) ? r.key_requirements : [];
    var waText = encodeURIComponent('📋 *תקן בנייה*\nמזהה: '+(r.standard_id||'')+'\n'+(r.title_he?'שם: '+r.title_he+'\n':'')+(r.scope?'תחולה: '+r.scope.substring(0,120)+'\n':'')+'רשות: '+(r.authority||'')+'\nמחייב: '+ml+(r.notes?'\n\n💡 '+r.notes.substring(0,120):''));
    var mailSubj = encodeURIComponent('תקן ' + (r.standard_id||''));
    var mailBody = encodeURIComponent((r.title_he||r.title_en||'')+'\n\n'+(r.scope||'')+'\n\n'+(r.notes||''));

    return '<div id="std-card-'+r.id+'" style="background:#1e1e35;border:1px solid rgba(255,255,255,0.07);border-right:4px solid '+mc+';border-radius:14px;padding:14px 16px;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<div style="background:'+ac+';color:#fff;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:800;white-space:nowrap;flex-shrink:0;">'+_stdH(r.standard_id)+'</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:14px;font-weight:800;color:#fff;line-height:1.4;">'+_stdH(r.title_he||r.title_en||'')+'</div>' +
          (r.title_he&&r.title_en?'<div style="font-size:11px;color:#666;margin-top:2px;">'+_stdH(r.title_en)+'</div>':'') +
        '</div>' +
        '<div style="font-size:11px;font-weight:700;color:'+mc+';white-space:nowrap;flex-shrink:0;">'+ml+'</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">' +
        (r.standard_category?'<span style="background:rgba(201,168,76,0.15);color:#c9a84c;border-radius:20px;padding:3px 10px;font-size:11px;">'+_stdH(r.standard_category)+'</span>':'') +
        (r.authority?'<span style="background:rgba(255,255,255,0.06);color:#aaa;border-radius:20px;padding:3px 10px;font-size:11px;">'+_stdH(r.authority)+'</span>':'') +
        (r.applies_to?'<span style="background:rgba(255,255,255,0.06);color:#aaa;border-radius:20px;padding:3px 10px;font-size:11px;">'+_stdH(r.applies_to)+'</span>':'') +
        (r.industry_category?'<span style="background:rgba(26,61,92,0.4);color:#93c5fd;border-radius:20px;padding:3px 10px;font-size:11px;">'+_stdH(r.industry_category)+'</span>':'') +
      '</div>' +
      (r.scope?'<div style="font-size:12px;color:#ccc;margin-bottom:10px;line-height:1.7;">'+_stdH(r.scope)+'</div>':'') +
      (reqs.length?'<details style="margin-bottom:10px;"><summary style="font-size:11px;font-weight:800;color:#c9a84c;cursor:pointer;letter-spacing:.5px;">📋 דרישות מרכזיות ('+reqs.length+')</summary><div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:10px 12px;margin-top:6px;">'+reqs.map(function(req){return'<div style="font-size:12px;color:#ccc;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">▸ '+_stdH(req)+'</div>';}).join('')+'</div></details>':'') +
      (r.notes?'<div style="font-size:12px;color:#f59e0b;background:rgba(245,158,11,0.08);border-radius:6px;padding:8px 10px;margin-bottom:10px;">💡 '+_stdH(r.notes)+'</div>':'') +
      '<div style="margin-bottom:10px;"><select onchange="_stdLinkProject('+r.id+',this.value)" style="width:100%;padding:7px 10px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;"><option value="">📁 קשר לפרויקט...</option>'+(window.allProjects||[]).map(function(p){return'<option value="'+p.id+'">'+_stdH(p.project_name)+'</option>';}).join('')+'</select></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">' +
        '<button onclick="_stdPrint('+idx+')" style="background:#1a3d5c;border:none;color:#fff;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🖨️ הדפס</button>' +
        '<a href="mailto:?subject='+mailSubj+'&body='+mailBody+'" style="background:#1e3a5f;color:#93c5fd;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;text-decoration:none;">📧 מייל</a>' +
        '<a href="https://wa.me/?text='+waText+'" target="_blank" rel="noopener" style="background:#15803d;color:#fff;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;text-decoration:none;">💬 וואטסאפ</a>' +
        '<button onclick="_stdAskAI('+idx+')" style="background:#7c3aed;border:none;color:#fff;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">🧠 שאל AI</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _stdPrint(idx) {
  var r = _stdResults[idx]; if(!r) return;
  var reqs = Array.isArray(r.key_requirements) ? r.key_requirements : [];
  var w = window.open('','_blank');
  w.document.write('<html dir="rtl"><head><title>תקן '+r.standard_id+'</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:40px;direction:rtl;max-width:800px;margin:auto;}h1{color:#1a3d5c;}@media print{.noprint{display:none}}</style></head><body>');
  w.document.write('<button class="noprint" onclick="window.print()" style="background:#1a3d5c;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;margin-bottom:20px;">🖨️ הדפס</button>');
  w.document.write('<h1>'+r.standard_id+'</h1><h2>'+(r.title_he||r.title_en||'')+'</h2>');
  if(r.title_en&&r.title_he) w.document.write('<p style="color:#888;">'+r.title_en+'</p>');
  w.document.write('<p><strong>רשות:</strong> '+(r.authority||'')+'</p>');
  w.document.write('<p><strong>מחייב בישראל:</strong> '+(r.mandatory_in_israel==='yes'?'כן':r.mandatory_in_israel==='no'?'לא':'חלקי')+'</p>');
  if(r.applies_to) w.document.write('<p><strong>תחולה:</strong> '+r.applies_to+'</p>');
  if(r.scope) w.document.write('<p><strong>תיאור:</strong> '+r.scope+'</p>');
  if(reqs.length){ w.document.write('<h3>דרישות מרכזיות:</h3><ul>'); reqs.forEach(function(req){w.document.write('<li>'+req+'</li>');}); w.document.write('</ul>'); }
  if(r.notes) w.document.write('<div style="background:#fffbf0;border-right:4px solid #c9a84c;padding:10px;margin-top:10px;"><strong>הערות לשטח:</strong> '+r.notes+'</div>');
  w.document.write('<p style="color:#aaa;font-size:11px;margin-top:30px;">הופק: '+new Date().toLocaleDateString('he-IL')+'</p></body></html>');
  w.document.close(); setTimeout(function(){w.print();},400);
}

function _stdLinkProject(standardId, projectId) {
  if (!projectId) return;
  var proj = (window.allProjects||[]).find(function(p){ return p.id===projectId; });
  showToast('✅ תקן קושר לפרויקט: ' + (proj ? proj.project_name : projectId));
}

async function _stdAskAI(idx) {
  var r = _stdResults[idx]; if(!r) return;
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('נדרש מפתח API', 'error'); return; }
  var userQ = (document.getElementById('std-ai-question')||{}).value || '';
  var reqs  = Array.isArray(r.key_requirements) ? r.key_requirements : [];
  var prompt = 'אתה מומחה לתקני בנייה ישראליים.\n\nתקן: '+r.standard_id+'\nשם: '+(r.title_he||r.title_en||'')+'\nתיאור: '+(r.scope||'')+'\nדרישות:\n'+reqs.map(function(req){return'- '+req;}).join('\n')+'\nהערות: '+(r.notes||'')+'\n\n'+(userQ?'שאלה: '+userQ:'תן הסבר מעשי קצר — מה מהנדס הביצוע בשטח צריך לדעת, לבדוק ולתעד?')+'\n\nענה בעברית, 4-5 נקודות מעשיות.';
  var answer = document.getElementById('std-ai-answer');
  if (answer) { answer.style.display='block'; answer.innerHTML='<div style="color:#c4b5fd;font-size:13px;">🧠 שולח ל-AI...</div>'; answer.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  try {
    var res  = await claudeFetch(JSON.stringify({_apiKey:apiKey,model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:prompt}]}),null);
    var data = await res.json();
    var text = (data.content&&data.content[0]&&data.content[0].text)||'';
    if(answer) answer.innerHTML='<div style="font-size:11px;font-weight:800;color:#c4b5fd;margin-bottom:8px;">🧠 AI — '+_stdH(r.standard_id)+'</div><div style="font-size:13px;color:#fff;line-height:1.8;white-space:pre-wrap;">'+_stdH(text)+'</div>';
  } catch(e) { if(answer) answer.innerHTML='<div style="color:#ef4444;">שגיאה: '+e.message+'</div>'; }
}

function _stdH(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _stdEsc(s){ if(!s)return''; return String(s).replace(/"/g,'&quot;'); }
function _stdDebounce(fn,ms){ var t; return function(){clearTimeout(t);t=setTimeout(fn,ms);}; }
