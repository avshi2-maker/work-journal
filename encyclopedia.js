// encyclopedia.js v3.0 — Central Knowledge Hub
// Sources: field_encyclopedia + building_standards + site_takeoffs +
//          asset_inbox + beni_notes + beni_contacts + projects (archive)
var _encItems=[], _encContacts=[], _encArchive=[];
var _encActiveSource='all', _encAssetFilter='all', _encPrioFilter='all';
var _encProjFilter='', _encSearchQ='', _encDateFilter='all';
var _encVoiceActive=[false,false,false], _encVoiceRecorder=[null,null,null];
var _encLoaded=false, _encActiveCats={};
var _encTypeTab='all', _encContactQ='', _encContactAlpha='';

async function encInit() {
  if(_encLoaded){encRender();return;}
  encBuildShell();
  await encLoadAll();
  _encLoaded=true;
}

async function encRefresh() {
  _encLoaded=false;
  _encItems=[];_encContacts=[];_encArchive=[];
  var grid=document.getElementById('enc-grid');
  if(grid)grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888;font-size:13px;">&#128260; &#1496;&#1506;&#1503; &#1502;&#1495;&#1491;&#1513;...</div>';
  await encLoadAll();
  _encLoaded=true;
}

function encBuildShell() {
  var panel=document.getElementById('encyclopedia-panel');
  if(!panel)return;
  panel.innerHTML=
    '<div style="padding:0 0 80px;direction:rtl;font-family:Heebo,Arial,sans-serif;background:#f5f0e8;min-height:100vh;font-weight:700;color:#111;">'+
    // TOP BAR
    '<div style="background:#fff;border-bottom:0.5px solid #e8ddb5;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;position:sticky;top:0;z-index:100;">'+
      '<div>'+
        '<div style="font-size:11px;letter-spacing:3px;color:#111;font-weight:800;margin-bottom:2px;">KNOWLEDGE HUB</div>'+
        '<div style="font-size:18px;font-weight:900;color:#1a3d5c;">&#128218; &#1488;&#1504;&#1510;&#1497;&#1511;&#1500;&#1493;&#1508;&#1491;&#1497;&#1492; &#1502;&#1512;&#1499;&#1494;&#1497;&#1514;</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'+
        '<select id="enc-proj-sel" onchange="encSetProj(this.value)" style="'+encInp()+'"><option value="">&#1499;&#1500; &#1492;&#1508;&#1512;&#1493;&#1497;&#1511;&#1496;&#1497;&#1501;</option><option value="__archive__">&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503; &#1489;&#1500;&#1489;&#1491;</option></select>'+
        '<button onclick="encRefresh()" title="&#1512;&#1506;&#1504;&#1503; &#1492;&#1499;&#1500;" style="background:#f5f0e8;border:1.5px solid #c9a84c;color:#7a5500;border-radius:8px;padding:8px 12px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">&#128260; &#1512;&#1506;&#1504;&#1503;</button>'+
      '</div>'+
    '</div>'+
    '<div id="enc-source-tabs" style="display:none;"></div>'+
    '<div style="padding:12px 18px 0;">'+
      '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px;">'+
        '<div style="flex:1;min-width:200px;position:relative;display:flex;align-items:center;">'+
          '<input id="enc-search" type="text" placeholder="&#128269; &#1495;&#1508;&#1513; &#1489;&#1499;&#1500; &#1492;&#1502;&#1511;&#1493;&#1512;&#1493;&#1514;..." oninput="encOnSearch(this.value)" style="width:100%;padding:8px 36px 8px 12px;border:1.5px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:#111;direction:rtl;background:#fffbf0;box-sizing:border-box;">'+
          '<button onclick="encVoiceSearch()" id="enc-voice-search-btn" title="&#1511;&#1500;&#1496; &#1511;&#1493;&#1500;&#1497;" style="position:absolute;left:8px;background:rgba(154,111,0,0.15);border:none;border-radius:50%;width:22px;height:22px;font-size:11px;cursor:pointer;">&#127908;</button>'+
        '</div>'+
        '<select id="enc-asset-filter" onchange="encSetAsset(this.value)" style="'+encInp()+';min-width:160px;">'+
          '<option value="all">&#1499;&#1500; &#1492;&#1502;&#1511;&#1493;&#1512;&#1493;&#1514;</option>'+
          '<option value="__src_enc">&#128203; &#1502;&#1502;&#1510;&#1488;&#1497; &#1513;&#1496;&#1495;</option>'+
          '<option value="__src_standards">&#128207; &#1514;&#1511;&#1504;&#1497; &#1489;&#1504;&#1497;&#1497;&#1492; (838)</option>'+
          '<option value="__src_prices">&#128176; &#1502;&#1495;&#1497;&#1512;&#1493;&#1503; &#1491;&#1511;&#1500;</option>'+
          '<option value="__src_takeoff">&#128208; &#1496;&#1497;&#1497;&#1511;&#1488;&#1493;&#1508;&#1497;&#1501;</option>'+
          '<option value="__src_contacts">&#128101; &#1488;&#1504;&#1513;&#1497; &#1511;&#1513;&#1512;</option>'+
          '<option value="__src_archive">&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503;</option>'+
          '<option value="audio">&#127897;&#65039; &#1492;&#1511;&#1500;&#1496;&#1493;&#1514;</option>'+
          '<option value="call">&#128222; &#1513;&#1497;&#1495;&#1493;&#1514; &#1489;&#1504;&#1497;</option>'+
          '<option value="finding">&#128203; &#1502;&#1502;&#1510;&#1488; &#1513;&#1496;&#1495;</option>'+
          '<option value="image">&#128247; &#1514;&#1502;&#1493;&#1504;&#1493;&#1514;</option>'+
          '<option value="note">&#9997;&#65039; &#1492;&#1506;&#1512;&#1492; &#1497;&#1491;</option>'+
          '<option value="pdf">&#128196; &#1502;&#1505;&#1502;&#1499;&#1497;&#1501;</option>'+
          '<option value="personal">&#128274; &#1488;&#1497;&#1513;&#1497;</option>'+
          '<option value="price">&#128176; &#1502;&#1495;&#1497;&#1512;&#1497;&#1501;</option>'+
          '<option value="standard">&#128207; &#1514;&#1511;&#1503; &#1489;&#1504;&#1497;&#1497;&#1492;</option>'+
          '<option value="takeoff">&#128208; &#1502;&#1491;&#1497;&#1491;&#1493;&#1514;</option>'+
        '</select>'+
        '<select id="enc-prio-filter" onchange="encSetPrio(this.value)" style="'+encInp()+'">'+
          '<option value="all">&#1512;&#1502;&#1514; &#1495;&#1513;&#1497;&#1489;&#1493;&#1514; &#8212; &#1492;&#1499;&#1500;</option>'+
          '<option value="critical">&#128308; CRITICAL</option>'+
          '<option value="high">&#128992; HIGH</option>'+
          '<option value="medium">&#128993; MEDIUM</option>'+
          '<option value="ok">&#9989; &#1514;&#1511;&#1497;&#1503;</option>'+
        '</select>'+
        '<select id="enc-date-filter" onchange="encSetDate(this.value)" style="'+encInp()+'">'+
          '<option value="all">&#1514;&#1511;&#1493;&#1508;&#1492; &#8212; &#1492;&#1499;&#1500;</option>'+
          '<option value="today">&#1492;&#1497;&#1493;&#1501;</option>'+
          '<option value="week">&#1513;&#1489;&#1493;&#1506; &#1488;&#1495;&#1512;&#1493;&#1503;</option>'+
          '<option value="month">&#1495;&#1493;&#1491;&#1513; &#1488;&#1495;&#1512;&#1493;&#1503;</option>'+
          '<option value="3months">3 &#1495;&#1493;&#1491;&#1513;&#1497;&#1501;</option>'+
        '</select>'+
      '</div>'+
      '<div style="height:6px;"></div>'+
    '</div>'+
    '<div id="enc-type-tabs" style="display:flex;gap:4px;flex-wrap:wrap;padding:8px 18px;background:#f5f0e8;border-bottom:0.5px solid #e8ddb5;"></div>'+
    '<div id="enc-stats" style="padding:0 18px 12px;display:none;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:7px;"></div>'+
    '<div id="enc-archive-banner" style="margin:0 18px 16px;display:none;"></div>'+
    '<div id="enc-rag" style="background:#f5f0e8;padding:18px;border-top:2px solid #c9a84c;display:block;"></div>'+
    '</div>';

  encBuildSourceTabs();
  encBuildCatChips();
  encBuildTypeTabs();
  encBuildRag();
}

async function encLoadAll(){
  try{
    var r1=await sbQ('field_encyclopedia','is_deleted=not.is.true&order=created_at.desc&limit=200&select=id,title,category,description,severity,source_project_id,media_url,media_type,created_at,notes,ai_report');
    var enc=(r1.data||[]).map(function(e){return Object.assign({_src:'enc',_type:encMapType(e.category,e.media_type)},e);});
    var r2=await sbQ('site_takeoffs','is_deleted=not.is.true&order=created_at.desc&limit=100&select=id,project_id,takeoff_date,total_area,notes,session_label,takeoff_type,created_at,file_url');
    var tko=(r2.data||[]).map(function(t){return Object.assign({_src:'takeoff',_type:'takeoff',title:(t.session_label||'&#1496;&#1497;&#1497;&#1511;&#1488;&#1493;&#1507;')+(t.total_area?' &#8212; '+t.total_area+' &#1502;"&#1512;':'')},t);});
    var r4c=await sbQ('building_standards','order=title_he.asc&limit=838&select=id,standard_id,title_he,title_en,industry_category,standard_category,scope,key_requirements,applies_to,authority,mandatory_in_israel,notes,created_at');
    var stds=(r4c.data||[]).map(function(s){return Object.assign({_src:'standards',_type:'standard',title:s.title_he||s.standard_id||'&#1514;&#1511;&#1503;',category:s.industry_category||s.standard_category||'&#1514;&#1511;&#1503;',description:s.scope||s.applies_to||''},s);});
    var r4d=await sbQ('price_items','is_note=not.is.true&order=item_code.asc&limit=500&select=id,item_code,chapter_name,sub_chapter_name,description,unit,price,source,price_date,created_at');
    var prices=(r4d.data||[]).map(function(p){return Object.assign({_src:'prices',_type:'price',title:p.description||p.item_code||'&#1508;&#1512;&#1497;&#1496;',category:p.sub_chapter_name||p.chapter_name||'&#1502;&#1495;&#1497;&#1512;'},p);});
    _encItems=[].concat(enc,tko,stds,prices);
    var r5=await sbQ('beni_contacts','order=full_name.asc&limit=200&select=id,full_name,profession,phone,email,rating_skills,rating_reliability,rating_price,notes,project_id');
    _encContacts=r5.data||[];
    var r6=await sbQ('projects','is_archived=eq.true&order=archived_at.desc&select=id,project_name,client_name,total_budget,archived_at,city');
    _encArchive=r6.data||[];
  }catch(e){console.warn('[enc] load:',e.message);}
  encPopulateProjFilter();
  encRenderStats();
  encRender();
  encRenderArchiveBanner();
}

var ENC_SOURCES=[
  {id:'all',label:'&#1492;&#1499;&#1500;',bg:'#1a3d5c',color:'#fff'},
  {id:'enc',label:'&#128203; &#1502;&#1502;&#1510;&#1488;&#1497; &#1513;&#1496;&#1495;',bg:'#fff5f5',color:'#c62828'},
  {id:'takeoff',label:'&#128208; &#1496;&#1497;&#1497;&#1511;&#1488;&#1493;&#1508;&#1497;&#1501;',bg:'#fff8e0',color:'#7a5500'},
  {id:'notes',label:'&#128193; &#1504;&#1499;&#1505;&#1497; &#1489;&#1504;&#1497;',bg:'#e3f2fd',color:'#1565c0'},
  {id:'inbox',label:'&#128229; &#1514;&#1497;&#1489;&#1492; &#1504;&#1499;&#1504;&#1505;&#1514;',bg:'#e3f2fd',color:'#0f766e'},
  {id:'contacts',label:'&#128101; &#1488;&#1504;&#1513;&#1497; &#1511;&#1513;&#1512;',bg:'#f3e5f5',color:'#4a148c'},
  {id:'archive',label:'&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503;',bg:'#e8f5e9',color:'#1b5e20'}
];

function encBuildSourceTabs(){
  var el=document.getElementById('enc-source-tabs');if(!el)return;
  el.innerHTML=ENC_SOURCES.map(function(s){
    var a=s.id===_encActiveSource;
    return '<button onclick="encSetSource(\''+s.id+'\')" style="padding:6px 12px;border:0.5px solid '+(a?'#1a3d5c':'#e8ddb5')+';border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;background:'+(a?'#1a3d5c':(s.bg||'#fff'))+';color:'+(a?'#fff':(s.color||'#555'))+';">'+s.label+'</button>';
  }).join('')+
  '<div style="margin-right:auto;"></div>'+'<button onclick="encRefresh()" style="background:#f5f0e8;border:1.5px solid #c9a84c;color:#7a5500;border-radius:12px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;margin-left:6px;">&#128260; &#1512;&#1506;&#1504;&#1503;</button>'+
  '<button onclick="encOpenAdd()" style="background:#1a3d5c;border:none;color:#FFD700;border-radius:12px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">+ &#1492;&#1493;&#1505;&#1507;</button>'+
  '<button onclick="var r=document.getElementById(\'enc-rag\');if(r){r.style.display=\'block\';setTimeout(function(){r.scrollIntoView({behavior:\'smooth\'});},50);}" style="background:#fffbf0;color:#38bdf8;border:0.5px solid rgba(56,189,248,0.3);border-radius:14px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">&#128269; &#1513;&#1488;&#1497;&#1500;&#1514;&#1493;&#1514; &#8595;</button>';
}

function encSetSource(s){_encActiveSource=s;encBuildSourceTabs();encRender();}

var ENC_CATS=[
  {id:'safety',label:'&#9888;&#65039; &#1489;&#1496;&#1497;&#1495;&#1493;&#1514;',bg:'#fff5f5',color:'#c62828',border:'#fca5a5'},
  {id:'hazmat',label:'&#9763;&#65039; &#1495;&#1493;&#1502;"&#1505;',bg:'#fce4e4',color:'#b71c1c',border:'#ef9a9a'},
  {id:'packaging',label:'&#9851;&#65039; &#1488;&#1512;&#1497;&#1494;&#1493;&#1514;',bg:'#e3f2fd',color:'#1565c0',border:'#90caf9'},
  {id:'laydown',label:'&#127959;&#65039; &#1492;&#1514;&#1488;&#1512;&#1490;&#1504;&#1493;&#1514;',bg:'#f3e5f5',color:'#4a148c',border:'#ce93d8'},
  {id:'traffic',label:'&#128667; &#1514;&#1504;&#1493;&#1506;&#1492;',bg:'#fff3e0',color:'#e65100',border:'#ffb74d'},
  {id:'engineering',label:'&#127959;&#65039; &#1492;&#1504;&#1491;&#1505;&#1497;',bg:'#e8f0fd',color:'#1a3d5c',border:'#93c5fd'},
  {id:'measure',label:'&#128208; &#1502;&#1491;&#1497;&#1491;&#1493;&#1514;',bg:'#fff8e0',color:'#7a5500',border:'#c9a84c'},
  {id:'ok',label:'&#9989; &#1514;&#1511;&#1497;&#1503;',bg:'#e8f5e9',color:'#1b5e20',border:'#a5d6a7'},
];

function encBuildCatChips(){/* removed - use filter dropdowns instead */}

var _ENC_TABS=[
  {id:'all',     label:'&#1492;&#1499;&#1500;'},
  {id:'enc',     label:'&#128203; &#1502;&#1502;&#1510;&#1488;&#1497;&#1501;'},
  {id:'audio',   label:'&#127908; &#1492;&#1511;&#1500;&#1496;&#1493;&#1514;'},
  {id:'video',   label:'&#127909; &#1493;&#1497;&#1491;&#1488;&#1493;'},
  {id:'image',   label:'&#128247; &#1514;&#1502;&#1493;&#1504;&#1493;&#1514;'},
  {id:'pdf',     label:'&#128196; PDF'},
  {id:'doc',     label:'&#128221; DOC'},
  {id:'xls',     label:'&#128202; XLS/CSV'},
  {id:'takeoff', label:'&#128208; &#1502;&#1491;&#1497;&#1491;&#1493;&#1514;'},
  {id:'contacts',label:'&#128101; &#1511;&#1513;&#1512;&#1497;&#1501;'},
  {id:'archive', label:'&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503;'}
];

function encBuildTypeTabs(){
  var el=document.getElementById('enc-type-tabs');
  if(!el)return;
  el.onclick=function(e){
    var btn=e.target.closest('button[data-tt]');
    if(!btn)return;
    _encTypeTab=btn.getAttribute('data-tt');
    _encContactQ='';_encContactAlpha='';
    encBuildTypeTabs();
    encRender();
  };
  el.innerHTML=_ENC_TABS.map(function(t){
    var on=t.id===_encTypeTab;
    var s='padding:5px 11px;border-radius:14px;font-size:10px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;border:0.5px solid '+(on?'#1a3d5c':'#e8ddb5')+';background:'+(on?'#1a3d5c':'#fff')+';color:'+(on?'#FFD700':'#555')+';';
    return '<button data-tt="'+t.id+'" style="'+s+'">'+t.label+'</button>';
  }).join('');
}

function encSetTypeTab(id){
  _encTypeTab=id;
  _encContactQ='';_encContactAlpha='';
  encBuildTypeTabs();
  encRender();
}

function encToggleCat(id){
  _encActiveCats[id]=!_encActiveCats[id];
  var el=document.getElementById('enc-cat-'+id);
  if(el)el.style.opacity=_encActiveCats[id]?'1':'0.45';
  encRender();
}

function encRenderStats(){
  var el=document.getElementById('enc-stats');if(!el)return;
  el.style.display='none';
  el.innerHTML='';
}

function encRender(){
  var grid=document.getElementById('enc-grid');if(!grid)return;
  if(_encTypeTab==='contacts'){encRenderContacts();return;}
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:20px;color:#888;font-size:12px;">&#9203; &#1496;&#1506;&#1503;...</div>';
  var items=[];
  if(_encActiveSource==='contacts'){items=_encContacts.map(function(c){return Object.assign({_src:'contacts'},c);});}
  else if(_encActiveSource==='archive'){items=_encArchive.map(function(a){return Object.assign({_src:'archiveproj'},a);});}
  else{
    items=_encItems.slice();
    if(_encActiveSource==='all'){
      // default view: only enc + standards + takeoffs + prices (not notes/inbox — those have dedicated tabs)
      items=items.filter(function(i){return i._src==='enc'||i._src==='standards'||i._src==='takeoff'||i._src==='prices';});
    } else if(_encActiveSource!=='all'){
      var analysisSrcs=['safety_scan','defects','std_rel','cost_est','engineering'];
      if(analysisSrcs.indexOf(_encActiveSource)>=0){
        // Filter enc items by AI report category
        items=items.filter(function(i){
          var cat=(i.category||i.ai_report||'').toLowerCase();
          if(_encActiveSource==='safety_scan')return cat.includes('&#1489;&#1496;&#1497;&#1495;&#1493;&#1514;')||cat.includes('safety');
          if(_encActiveSource==='defects')return cat.includes('&#1500;&#1497;&#1511;&#1493;&#1497;')||cat.includes('defect');
          if(_encActiveSource==='std_rel')return cat.includes('&#1514;&#1511;&#1503;')||cat.includes('standard');
          if(_encActiveSource==='cost_est')return cat.includes('&#1506;&#1500;&#1493;&#1497;&#1493;&#1514;')||cat.includes('cost')||cat.includes('&#1502;&#1495;&#1497;&#1512;');
          if(_encActiveSource==='engineering')return cat.includes('&#1492;&#1504;&#1491;&#1505;&#1497;')||cat.includes('engineer');
          return true;
        });
      } else {
        items=items.filter(function(i){return i._src===_encActiveSource||i._type===_encActiveSource;});
      }
    }
    if(_encAssetFilter!=='all')items=items.filter(function(i){return i._type===_encAssetFilter;});
    if(_encPrioFilter!=='all')items=items.filter(function(i){
      var s=(i.severity||i.color||'').toLowerCase();
      if(_encPrioFilter==='critical')return s.includes('critical')||s==='red';
      if(_encPrioFilter==='high')return s.includes('high')||s==='orange';
      if(_encPrioFilter==='medium')return s.includes('medium')||s==='yellow';
      if(_encPrioFilter==='ok')return s.includes('ok')||s.includes('guide')||s==='green';
      return true;
    });
    if(_encProjFilter&&_encProjFilter!=='__archive__')items=items.filter(function(i){return i.project_id===_encProjFilter||i.source_project_id===_encProjFilter;});
    if(_encTypeTab==='archive'){
      items=_encArchive.map(function(a){return Object.assign({_src:'archiveproj'},a);});
    } else if(_encTypeTab!=='all'&&_encTypeTab!=='contacts'){
      items=items.filter(function(i){
        if(_encTypeTab==='enc')return i._src==='enc';
        return i._type===_encTypeTab||(i.media_type&&i.media_type===_encTypeTab);
      });
    }
    if(_encSearchQ){var q=_encSearchQ.toLowerCase();items=items.filter(function(i){return(i.title||'').toLowerCase().includes(q)||(i.description||i.note_text||i.notes||'').toLowerCase().includes(q)||(i.category||'').toLowerCase().includes(q)||(i.session_label||'').toLowerCase().includes(q);});}
  }
  if(!items.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#888;"><div style="font-size:40px;margin-bottom:12px;">&#128218;</div><div style="font-size:14px;font-weight:700;">&#1488;&#1497;&#1503; &#1512;&#1513;&#1493;&#1502;&#1493;&#1514; &#1514;&#1493;&#1488;&#1502;&#1493;&#1514;</div></div>';return;}
  grid.innerHTML=items.map(function(item){
    if(item._src==='contacts')return encBuildContactCard(item);
    if(item._src==='archiveproj')return encBuildArchiveCard(item);
    if(item._src==='takeoff')return encBuildTakeoffCard(item);
    if(item._src==='notes')return encBuildNoteCard(item);
    if(item._src==='inbox')return encBuildInboxCard(item);
    if(item._src==='prices')return encBuildPriceCard(item);
    return encBuildEncCard(item);
  }).join('');
}

function encBuildEncCard(item){
  var isStd=item._src==='standards';
  var sev=(item.severity||'').toLowerCase();
  var isCrit=sev.includes('critical'),isHigh=sev.includes('high');
  var bc=isStd?'#4527a0':isCrit?'#c62828':isHigh?'#e65100':sev.includes('medium')?'#c9a84c':'#22c55e';
  var bbg=isStd?'#ede7f6':isCrit?'#fce4e4':isHigh?'#fff3e0':sev.includes('medium')?'#fff8e0':'#e8f5e9';
  var bcolor=isStd?'#4527a0':isCrit?'#b71c1c':isHigh?'#e65100':sev.includes('medium')?'#7a5500':'#1b5e20';
  var bl=isStd?(item.standard_id||'&#1514;&#1511;&#1503;'):isCrit?'CRITICAL':isHigh?'HIGH':sev.includes('medium')?'MEDIUM':(item.category||'&#1502;&#1502;&#1510;&#1488;');
  var proj=encProjName(item.source_project_id||item.project_id);
  var date=encFmtDate(item.created_at);
  var icon=isStd?'&#128207;':item.media_type==='image'?'&#128247;':item.media_type==='pdf'?'&#128196;':item.media_type==='audio'?'&#127897;&#65039;':'&#128203;';
  var desc=item.description||item.scope||item.applies_to||'';
  var subtitle=isStd?(item.standard_category||item.industry_category||''):(item.category||'');
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;border-right:3px solid '+bc+';">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div style="display:flex;gap:7px;align-items:flex-start;flex:1;">'+
        '<span>'+icon+'</span>'+
        '<div style="flex:1;">'+
          '<div style="font-size:12px;font-weight:800;color:#1a3d5c;line-height:1.4;">'+encEsc(encDec(item.title||''))+'</div>'+
          '<div style="font-size:10px;color:#888;">'+encEsc(encDec(subtitle))+(date?' &#183; '+date:'')+'</div>'+
        '</div>'+
      '</div>'+
      '<span style="background:'+bbg+';color:'+bcolor+';padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;white-space:nowrap;margin-right:8px;">'+encEsc(bl)+'</span>'+
    '</div>'+
    (desc?'<div style="font-size:11px;color:#555;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+encEsc(desc.substring(0,150))+'</div>':'')+
    (isStd&&item.applies_to?'<div style="font-size:10px;color:#4527a0;background:#ede7f6;border-radius:6px;padding:3px 7px;">&#128204; '+encEsc(item.applies_to.substring(0,80))+'</div>':'')+
    (proj?'<span style="font-size:10px;background:#e8f0fd;color:#1a3d5c;border:0.5px solid #93c5fd;border-radius:8px;padding:2px 7px;align-self:flex-start;">&#127959;&#65039; '+encEsc(proj)+'</span>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      '<button onclick="encView(\''+item.id+'\')" title="&#1510;&#1508;&#1497;&#1497;&#1492;" style="'+encAbS()+'">&#128065;&#65039; &#1510;&#1508;&#1492;</button>'+
      '<button onclick="encPrint(\''+item.id+'\')" title="&#1492;&#1491;&#1508;&#1505;" style="'+encAbS()+'">&#128424;&#65039; &#1492;&#1491;&#1508;&#1505;</button>'+
      '<button onclick="encMail(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1502;&#1497;&#1497;&#1500;" style="'+encAbS()+'">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="encWA(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1493;&#1493;&#1488;&#1496;&#1505;&#1488;&#1508;" style="'+encAbS()+'">&#128172; WA</button>'+
      (item.media_url?'<button onclick="window.open(\''+encEsc(item.media_url)+'\',\'_blank\')" title="&#1508;&#1514;&#1495; &#1511;&#1493;&#1489;&#1509;" style="'+encAbS()+'background:#e8f0fd;color:#1a3d5c;">&#128196; &#1508;&#1514;&#1495;</button>':'')+
      (proj?'<button onclick="encLinkToProject(\''+item.id+'\')" style="margin-right:auto;'+encAbS()+'color:#1a3d5c;background:#e8f0fd;border-color:rgba(26,61,92,0.3);" title="&#1513;&#1497;&#1497;&#1498; &#1500;&#1508;&#1512;&#1493;&#1497;&#1511;&#1496;">&#128279; '+encEsc(proj)+'</button>':'')+
    '</div>'+
  '</div>';
}

function encBuildTakeoffCard(item){
  var proj=encProjName(item.project_id),date=encFmtDate(item.takeoff_date||item.created_at);
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;border-right:3px solid #c9a84c;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div style="display:flex;gap:7px;align-items:center;"><span>&#128208;</span><div>'+
        '<div style="font-size:12px;font-weight:800;color:#1a3d5c;">'+encEsc(item.session_label||'&#1496;&#1497;&#1497;&#1511;&#1488;&#1493;&#1507;')+'</div>'+
        '<div style="font-size:10px;color:#888;">&#128208; &#1502;&#1491;&#1497;&#1491;&#1493;&#1514;'+(date?' &#183; '+date:'')+'</div>'+
      '</div></div>'+
      '<span style="background:#fff8e0;color:#7a5500;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;">'+encFmtArea(item.total_area)+'</span>'+
    '</div>'+
    (proj?'<span style="font-size:10px;background:#fff8e0;color:#7a5500;border:0.5px solid #c9a84c;border-radius:8px;padding:2px 7px;align-self:flex-start;">&#127959;&#65039; '+encEsc(proj)+'</span>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      '<button onclick="switchTab&&switchTab(\'takeoff\')" title="&#1508;&#1514;&#1495; &#1496;&#1497;&#1497;&#1511;&#1488;&#1493;&#1508;" style="'+encAbS()+'">&#128065;&#65039; &#1510;&#1508;&#1492;</button>'+
      '<button onclick="tkMail&&tkMail(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1502;&#1497;&#1497;&#1500;" style="'+encAbS()+'">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="tkWA&&tkWA(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1493;&#1493;&#1488;&#1496;&#1505;&#1488;&#1508;" style="'+encAbS()+'">&#128172; WA</button>'+
    '</div>'+
  '</div>';
}

function encBuildNoteCard(item){
  var isAudio=item._type==='audio',isImg=item._type==='image';
  var icon=isAudio?'&#127897;&#65039;':isImg?'&#128247;':'&#9997;&#65039;';
  var tl=isAudio?'&#1492;&#1511;&#1500;&#1496;&#1492;':isImg?'&#1514;&#1502;&#1493;&#1504;&#1492;':'&#1492;&#1506;&#1512;&#1514; &#1497;&#1491;';
  var proj=encProjName(item.project_id),date=encFmtDate(item.created_at);
  var bc=item.color==='red'?'#ef4444':item.color==='green'?'#22c55e':item.color==='blue'?'#3b82f6':'#c9a84c';
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;border-right:3px solid '+bc+';">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div style="display:flex;gap:7px;align-items:center;"><span>'+icon+'</span><div>'+
        '<div style="font-size:12px;font-weight:800;color:#1a3d5c;">'+encEsc(encDec(tl+(proj?' — '+proj:'')))+'</div>'+
        '<div style="font-size:10px;color:#888;">&#128193; &#1504;&#1499;&#1505;&#1497; &#1489;&#1504;&#1497;'+(date?' &#183; '+date:'')+'</div>'+
      '</div></div>'+
      '<span style="background:#f0fdfb;color:#0f766e;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;">'+tl+'</span>'+
    '</div>'+
    (item.note_text?'<div style="font-size:11px;color:#555;line-height:1.6;">'+encEsc(item.note_text.substring(0,100))+'</div>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      (isAudio?'<button onclick="encPlayAudio(\''+encEsc(item.photo_url||'')+'\')" title="&#1504;&#1490;&#1503;" style="'+encAbS()+'">&#9654;&#65039; &#1504;&#1490;&#1503;</button>':'')+
      (isImg?'<button onclick="openLightbox&&openLightbox(\''+encEsc(item.photo_url||'')+'\',\'\')" title="&#1510;&#1508;&#1492;" style="'+encAbS()+'">&#128065;&#65039; &#1510;&#1508;&#1492;</button>':'')+
      (!isImg&&!isAudio?'<button onclick="" title="&#1506;&#1512;&#1493;&#1498;" style="'+encAbS()+'">&#9997;&#65039; &#1506;&#1512;&#1493;&#1498;</button>':'')+
      '<button onclick="encMailNote(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1502;&#1497;&#1497;&#1500;" style="'+encAbS()+'">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="encWANote(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1493;&#1493;&#1488;&#1496;&#1505;&#1488;&#1508;" style="'+encAbS()+'">&#128172; WA</button>'+
    '</div>'+
  '</div>';
}

function encBuildInboxCard(item){
  var isPdf=item._type==='pdf',isAud=item._type==='audio';
  var icon=isPdf?'&#128196;':isAud?'&#127897;&#65039;':'&#128247;';
  var date=encFmtDate(item.created_at),proj=encProjName(item.project_id);
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;border-right:3px solid #1565c0;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div style="display:flex;gap:7px;align-items:center;"><span>'+icon+'</span><div>'+
        '<div style="font-size:12px;font-weight:800;color:#1a3d5c;">'+encEsc(encDec(item.file_name||'&#1511;&#1493;&#1489;&#1509;').substring(0,40))+'</div>'+
        '<div style="font-size:10px;color:#888;">&#128229; &#1514;&#1497;&#1489;&#1492;'+(date?' &#183; '+date:'')+'</div>'+
      '</div></div>'+
      '<span style="background:#e3f2fd;color:#1565c0;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;">'+(isPdf?'PDF':isAud?'&#1492;&#1511;&#1500;&#1496;&#1492;':'&#1514;&#1502;&#1493;&#1504;&#1492;')+'</span>'+
    '</div>'+
    (proj?'<span style="font-size:10px;background:#e8f0fd;color:#1a3d5c;border:0.5px solid #93c5fd;border-radius:8px;padding:2px 7px;align-self:flex-start;">&#127959;&#65039; '+encEsc(proj)+'</span>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      '<button onclick="tkViewFile&&tkViewFile(\''+encEsc(item.cloudinary_url||'')+'\',\''+item._type+'\')" title="&#1508;&#1514;&#1495; &#1511;&#1493;&#1489;&#1509;" style="'+encAbS()+'">&#128065;&#65039; &#1510;&#1508;&#1492;</button>'+
      '<button onclick="encMailInbox(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1502;&#1497;&#1497;&#1500;" style="'+encAbS()+'">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="encWAInbox(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1493;&#1493;&#1488;&#1496;&#1505;&#1488;&#1508;" style="'+encAbS()+'">&#128172; WA</button>'+
    '</div>'+
  '</div>';
}

function encBuildPriceCard(item){
  var hasPrice=item.price&&parseFloat(item.price)>0;
  var priceStr=hasPrice?'&#8362;'+parseFloat(item.price).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})+' / '+(item.unit||''):'&#8212;';
  var date=item.price_date?new Date(item.price_date).toLocaleDateString('he-IL',{month:'2-digit',year:'2-digit'}):'';
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;border-right:3px solid #0f766e;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div style="display:flex;gap:7px;align-items:flex-start;flex:1;">'+
        '<span>&#128176;</span>'+
        '<div style="flex:1;">'+
          '<div style="font-size:12px;font-weight:800;color:#1a3d5c;line-height:1.4;">'+encEsc(item.description||item.title||'')+'</div>'+
          '<div style="font-size:10px;color:#888;">'+encEsc(item.sub_chapter_name||item.chapter_name||'')+(item.item_code?' &#183; '+encEsc(item.item_code):'')+'</div>'+
        '</div>'+
      '</div>'+
      '<span style="background:#f0fdfb;color:#0f766e;padding:2px 7px;border-radius:7px;font-size:11px;font-weight:900;white-space:nowrap;margin-right:8px;">'+priceStr+'</span>'+
    '</div>'+
    (date||item.source?'<div style="font-size:10px;color:#888;">&#128197; '+encEsc(item.source||'')+(date?' &#183; '+date:'')+'</div>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      '<button onclick="encView(\''+item.id+'\')" title="&#1510;&#1508;&#1497;&#1497;&#1492;" style="'+encAbS()+'">&#128065;&#65039; &#1510;&#1508;&#1492;</button>'+
      '<button onclick="encMail(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1502;&#1497;&#1497;&#1500;" style="'+encAbS()+'">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="encWA(\''+item.id+'\')" title="&#1513;&#1500;&#1495; &#1489;&#1493;&#1493;&#1488;&#1496;&#1505;&#1488;&#1508;" style="'+encAbS()+'">&#128172; WA</button>'+
    '</div>'+
  '</div>';
}

function encBuildContactCard(item){
  var init=(item.full_name||'?').split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('');
  var stars='&#11088;'.repeat(Math.min(5,parseInt(item.rating_reliability)||0));
  var phone=(item.phone||'').replace(/[^0-9+]/g,'');
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:8px;border-right:3px solid #4a148c;">'+
    '<div style="display:flex;align-items:center;gap:10px;">'+
      '<div style="width:36px;height:36px;border-radius:50%;background:#f3e5f5;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#4a148c;flex-shrink:0;">'+encEsc(init)+'</div>'+
      '<div style="flex:1;">'+
        '<div style="font-size:12px;font-weight:800;color:#1a3d5c;">'+encEsc(item.full_name||'')+'</div>'+
        '<div style="font-size:10px;color:#888;">'+encEsc(item.profession||'')+(stars?' &#183; '+stars:'')+'</div>'+
      '</div>'+
      '<span style="background:#f3e5f5;color:#4a148c;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;">&#1511;&#1513;&#1512;</span>'+
    '</div>'+
    (item.phone?'<div style="font-size:11px;color:#555;">&#128241; '+encEsc(item.phone)+'</div>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      (phone?'<a href="tel:'+phone+'" style="'+encAbS()+'text-decoration:none;display:inline-block;">&#128222;</a>':'')+
      (phone?'<a href="https://wa.me/972'+phone.replace(/^0/,'')+'" target="_blank" style="'+encAbS()+'text-decoration:none;display:inline-block;">&#128172; WA</a>':'')+
      (item.email?'<a href="mailto:'+encEsc(item.email)+'" style="'+encAbS()+'text-decoration:none;display:inline-block;">&#9993;&#65039;</a>':'')+
      encAb('&#9999;&#65039;','encEditContact(\''+item.id+'\')')+
      '<button onclick="encDeleteContact(\''+item.id+'\')" style="'+encAbS()+'margin-right:auto;color:#c62828;">&#128465;&#65039;</button>'+
    '</div>'+
  '</div>';
}


function encRenderContacts(){
  var grid=document.getElementById('enc-grid');if(!grid)return;
  var q=(_encContactQ||'').toLowerCase().trim();
  var alpha=_encContactAlpha||'';
  var list=_encContacts.slice();
  if(q){list=list.filter(function(ct){
    return (ct.full_name||'').toLowerCase().includes(q)||
           (ct.phone||'').includes(q)||
           (ct.profession||'').toLowerCase().includes(q)||
           (ct.notes||'').toLowerCase().includes(q)||
           encProjName(ct.project_id).toLowerCase().includes(q);
  });}
  if(alpha){list=list.filter(function(ct){
    return (ct.full_name||'').charAt(0)===alpha;
  });}
  var heb='&#1488;&#1489;&#1490;&#1491;&#1492;&#1493;&#1494;&#1495;&#1496;&#1497;&#1499;&#1500;&#1502;&#1504;&#1505;&#1506;&#1508;&#1510;&#1511;&#1512;&#1513;&#1514;';
  var hebArr=heb.split('');
  var alphaHTML=hebArr.map(function(l){
    var on=l===alpha;
    var s='padding:3px 7px;border-radius:6px;font-size:10px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;border:0.5px solid '+(on?'#1a3d5c':'#e8ddb5')+';background:'+(on?'#1a3d5c':'#e8f0fd')+';color:'+(on?'#FFD700':'#1a3d5c')+';';
    return '<button data-alpha="'+l+'" style="'+s+'">'+l+'</button>';
  }).join('');
  var clearBtn=alpha?'<button data-alpha="" style="padding:3px 7px;border-radius:6px;font-size:10px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;border:0.5px solid #e8ddb5;background:#f5f0e8;color:#888;">&#10005;</button>':'';
  var searchBar='<div id="enc-contact-bar" style="padding:8px 0 12px;display:flex;gap:5px;flex-wrap:wrap;align-items:center;">'+
    '<input id="enc-contact-q" type="text" value="'+encEsc(q)+'" placeholder="&#128269; &#1513;&#1501; / &#1496;&#1500;&#1508;&#1493;&#1503; / &#1508;&#1512;&#1493;&#1497;&#1511;&#1496;..." style="padding:7px 10px;border:1.5px solid #c9a84c;border-radius:8px;font-size:12px;font-weight:700;color:#111;direction:rtl;background:#fffbf0;font-family:Heebo,sans-serif;min-width:180px;">'+
    '<div style="width:0.5px;background:#e8ddb5;height:24px;"></div>'+
    alphaHTML+clearBtn+
  '</div>';
  var badge='<div style="font-size:11px;font-weight:800;color:#1a3d5c;margin-bottom:8px;">'+list.length+' &#1511;&#1513;&#1512;&#1497;&#1501;</div>';
  var rows=list.length?list.map(function(ct){
    var init=(ct.full_name||'?').split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('');
    var stars='&#11088;'.repeat(Math.min(5,parseInt(ct.rating_reliability)||0));
    var phone=(ct.phone||'').replace(/[^0-9+]/g,'');
    var wa=phone?'https://wa.me/972'+phone.replace(/^0/,''):'';
    var proj=encProjName(ct.project_id);
    return '<div style="background:#fff;border-radius:10px;border:0.5px solid #e8ddb5;padding:9px 14px;display:flex;align-items:center;gap:10px;margin-bottom:5px;">'+
      '<div style="width:34px;height:34px;border-radius:50%;background:#f3e5f5;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#4a148c;flex-shrink:0;">'+encEsc(init)+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:12px;font-weight:900;color:#111;">'+encEsc(ct.full_name||'')+'</div>'+
        '<div style="font-size:10px;color:#777;font-weight:700;">'+encEsc(ct.profession||'')+(stars?' &#183; '+stars:'')+'</div>'+
        '<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">'+
          (ct.phone?'<span style="font-size:9px;background:#e8f0fd;color:#1a3d5c;border-radius:5px;padding:1px 6px;font-weight:700;">&#128241; '+encEsc(ct.phone)+'</span>':'')+
          (proj?'<span style="font-size:9px;background:#fff8e0;color:#7a5500;border-radius:5px;padding:1px 6px;font-weight:700;">&#127959;&#65039; '+encEsc(proj)+'</span>':'')+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
        (wa?'<a href="'+wa+'" target="_blank" style="padding:4px 8px;background:#25D366;border:none;color:#fff;border-radius:7px;font-size:10px;font-weight:800;font-family:Heebo,sans-serif;text-decoration:none;display:inline-block;">&#128172; WA</a>':'')+
        (ct.email?'<a href="mailto:'+encEsc(ct.email)+'" style="padding:4px 8px;background:#f5f0e8;border:0.5px solid #c9a84c;color:#111;border-radius:7px;font-size:10px;font-weight:800;font-family:Heebo,sans-serif;text-decoration:none;display:inline-block;">&#9993;&#65039;</a>':'')+
        '<button data-view="'+ct.id+'" style="padding:4px 8px;background:#1a3d5c;border:none;color:#FFD700;border-radius:7px;font-size:10px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">&#128065;&#65039;</button>'+
      '</div>'+
    '</div>';
  }).join(''):'<div style="text-align:center;padding:40px;color:#888;font-weight:700;">&#1488;&#1497;&#1503; &#1514;&#1493;&#1510;&#1488;&#1493;&#1514;</div>';
  grid.innerHTML='<div style="grid-column:1/-1;padding:0 2px;">'+searchBar+badge+rows+'</div>';
  // wire search input
  var inp=document.getElementById('enc-contact-q');
  if(inp){inp.oninput=function(){_encContactQ=this.value;encRenderContacts();};}
  // wire alpha buttons via delegation
  var bar=document.getElementById('enc-contact-bar');
  if(bar){bar.onclick=function(e){
    var btn=e.target.closest('button[data-alpha]');
    if(!btn)return;
    var l=btn.getAttribute('data-alpha');
    _encContactAlpha=(l===_encContactAlpha?'':l);
    encRenderContacts();
  };}
  // wire view buttons via delegation on grid
  grid.onclick=function(e){
    var btn=e.target.closest('button[data-view]');
    if(!btn)return;
    encView(btn.getAttribute('data-view'));
  };
}
function encBuildArchiveCard(item){
  var date=item.archived_at?new Date(item.archived_at).toLocaleDateString('he-IL'):'';
  return '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;border-right:3px solid #1b5e20;opacity:0.9;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div style="display:flex;gap:7px;align-items:center;"><span>&#128230;</span><div>'+
        '<div style="font-size:12px;font-weight:800;color:#1a3d5c;">'+encEsc(item.project_name||'&#1508;&#1512;&#1493;&#1497;&#1511;&#1496;')+'</div>'+
        '<div style="font-size:10px;color:#888;">&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503;'+(date?' &#183; '+date:'')+(item.city?' &#183; '+encEsc(item.city):'')+'</div>'+
      '</div></div>'+
      '<span style="background:#e8f5e9;color:#1b5e20;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;">&#1492;&#1493;&#1513;&#1500;&#1501;</span>'+
    '</div>'+
    (item.total_budget?'<div style="font-size:11px;color:#555;">&#128176; &#1514;&#1511;&#1510;&#1497;&#1489;: &#8362;'+parseInt(item.total_budget).toLocaleString()+'</div>':'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;border-top:0.5px solid #f0e8d0;padding-top:7px;">'+
      encAb('&#128065;&#65039; &#1508;&#1514;&#1495;','encOpenArchivedProject(\''+item.id+'\')')+
      '<button onclick="encRestoreProject(\''+item.id+'\')" style="padding:5px 9px;border:0.5px solid rgba(198,40,40,0.3);border-radius:7px;font-size:11px;cursor:pointer;background:#fff0f0;color:#c62828;font-family:Heebo,sans-serif;font-weight:700;">&#8617;&#65039; &#1513;&#1495;&#1494;&#1512;</button>'+
    '</div>'+
  '</div>';
}

function encRenderArchiveBanner(){
  var el=document.getElementById('enc-archive-banner');if(!el||!_encArchive.length)return;
  el.style.display='block';
  el.innerHTML='<div style="background:linear-gradient(135deg,#1b5e20,#2e7d32);border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">'+
    '<div><div style="font-size:9px;color:rgba(255,255,255,0.6);letter-spacing:2px;margin-bottom:2px;">PROJECT ARCHIVE</div>'+
    '<div style="font-size:15px;font-weight:900;color:#fff;">&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503; &#1508;&#1512;&#1493;&#1497;&#1511;&#1496;&#1497;&#1501; &#1502;&#1505;&#1493;&#1497;&#1497;&#1502;&#1497;&#1501;</div>'+
    '<div style="font-size:11px;color:rgba(255,255,255,0.7);">'+_encArchive.length+' &#1508;&#1512;&#1493;&#1497;&#1511;&#1496;&#1497;&#1501; &#1504;&#1513;&#1502;&#1512;&#1493;</div></div>'+
    '<button onclick="encSetSource(\'archive\')" style="background:rgba(255,255,255,0.15);border:0.5px solid rgba(255,255,255,0.3);color:#fff;border-radius:8px;padding:7px 12px;font-size:11px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">&#128065;&#65039; &#1508;&#1514;&#1495; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503;</button>'+
  '</div>'+
  '<div style="background:#fff;border:0.5px solid #e8ddb5;border-radius:8px;padding:9px 13px;margin-top:8px;font-size:11px;color:#555;">'+
    '&#128204; &#1499;&#1497;&#1510;&#1491; &#1500;&#1488;&#1512;&#1499;&#1489; &#1508;&#1512;&#1493;&#1497;&#1511;&#1496;: <b>&#1508;&#1512;&#1493;&#1497;&#1511;&#1496;&#1497;&#1501;</b> &#8592; &#1489;&#1495;&#1512; &#1508;&#1512;&#1493;&#1497;&#1511;&#1496; &#8592; <b>&#128230; &#1492;&#1506;&#1489;&#1512; &#1500;&#1488;&#1512;&#1499;&#1497;&#1493;&#1503;</b> &#8592; &#1499;&#1500; &#1492;&#1502;&#1502;&#1510;&#1488;&#1497;&#1501; &#1493;&#1491;&#1493;&#1495;&#1493;&#1514; &#1504;&#1513;&#1502;&#1512;&#1497;&#1501; &#1499;&#1488;&#1503;'+
  '</div>';
}

function encBuildRag(){
  var el=document.getElementById('enc-rag');if(!el)return;
  el.innerHTML=
    '<div style="text-align:center;margin-bottom:14px;">'+
      '<div style="font-size:9px;letter-spacing:3px;color:#111;font-weight:800;margin-bottom:3px;">AI + SUPABASE RAG &#8212; 3 PARALLEL QUERIES</div>'+
      '<div style="font-size:16px;font-weight:900;color:#1a3d5c;">&#128269; &#1513;&#1488;&#1497;&#1500;&#1514;&#1493;&#1514; &#1502;&#1511;&#1510;&#1493;&#1506;&#1497;&#1493;&#1514;</div>'+
      '<div style="font-size:11px;color:#111;font-weight:700;margin-top:3px;">3 &#1513;&#1488;&#1500;&#1493;&#1514; &#1489;&#1502;&#1511;&#1489;&#1497;&#1500; &#8212; &#1514;&#1511;&#1504;&#1497;&#1501; &#183; &#1502;&#1495;&#1497;&#1512;&#1497;&#1501; &#183; &#1502;&#1502;&#1510;&#1488;&#1497;&#1501; &#183; &#1488;&#1504;&#1513;&#1497; &#1511;&#1513;&#1512; &#183; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503;</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:10px;margin-bottom:12px;direction:ltr;">'+
      encRagBox(1,'&#1514;&#1511;&#1504;&#1497;&#1501;','#38bdf8','rgba(56,189,248,0.12)','838 &#1514;&#1511;&#1504;&#1497;&#1501;',['&#1489;&#1496;&#1493;&#1503; C25','&#1488;&#1497;&#1496;&#1493;&#1501; &#1490;&#1490;','L05'],'&#1502;&#1492; &#1491;&#1512;&#1497;&#1513;&#1493;&#1514; &#1502;&#1502;"&#1491; &#1500;&#1508;&#1497; IS?')+
      encRagBox(2,'&#1502;&#1495;&#1497;&#1512;&#1497;&#1501;','#a78bfa','rgba(167,139,250,0.12)','6,325 &#1508;&#1512;&#1497;&#1496;&#1497;&#1501;',['&#1512;&#1497;&#1510;&#1493;&#1507;','&#1494;&#1497;&#1493;&#1503;','CFRP'],'&#1499;&#1502;&#1492; &#1506;&#1493;&#1500;&#1492; &#1512;&#1497;&#1510;&#1493;&#1507; &#1508;&#1493;&#1512;&#1510;&#1500;&#1503;?')+
      encRagBox(3,'&#1513;&#1496;&#1495; / &#1511;&#1513;&#1512;&#1497;&#1501;','#22c55e','rgba(34,197,94,0.12)','247 &#1512;&#1513;&#1493;&#1502;&#1493;&#1514;',['&#1495;&#1493;&#1502;"&#1505;','&#128101; &#1511;&#1489;&#1500;&#1504;&#1497;&#1501;','&#128230;'],'&#1502;&#1492; &#1492;&#1502;&#1502;&#1510;&#1488;&#1497;&#1501; &#1489;&#1490;&#1489;&#1506;&#1493;&#1503;?')+
    '</div>'+
    '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">'+
      '<button onclick="encRagRunAll()" style="background:linear-gradient(135deg,#38bdf8,#6366f1);border:none;color:#fff;border-radius:9px;padding:9px 22px;font-size:12px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">&#128640; &#1492;&#1508;&#1506;&#1500; 3 &#1513;&#1488;&#1500;&#1493;&#1514; &#1489;&#1502;&#1511;&#1489;&#1497;&#1500;</button>'+
      encRagToggle('standards','&#1514;&#1511;&#1504;&#1497;&#1501;','#38bdf8')+
      encRagToggle('prices','&#1502;&#1495;&#1497;&#1512;&#1493;&#1503;','#a78bfa')+
      encRagToggle('findings','&#1502;&#1502;&#1510;&#1488;&#1497;&#1501;','#22c55e')+
      encRagToggle('takeoffs','&#1496;&#1497;&#1497;&#1511;&#1488;&#1493;&#1508;&#1497;&#1501;','#fbbf24')+
      encRagToggle('contacts','&#1488;&#1504;&#1513;&#1497; &#1511;&#1513;&#1512;','#c084fc')+
      encRagToggle('archive','&#1488;&#1512;&#1499;&#1497;&#1493;&#1503;','#86efac')+
    '</div>'+
    '<div id="enc-token-meter" style="display:none;background:#1a3d5c;border:2px solid #38bdf8;border-radius:10px;padding:12px 18px;margin-top:14px;font-size:14px;font-weight:800;color:#fff;font-family:Heebo,sans-serif;align-items:center;gap:10px;text-align:center;letter-spacing:0.5px;"></div>'+
    '<div id="enc-rag-results" style="margin-top:12px;"></div>'+
    '<div style="margin-top:14px;background:#fff;border:0.5px dashed #c9a84c;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;opacity:0.55;">'+
      '<span style="font-size:18px;">&#128300;</span>'+
      '<div>'+
        '<div style="font-size:11px;font-weight:900;color:#888;">OCR / &#1504;&#1497;&#1514;&#1493;&#1495; AI &#8212; &#1489;&#1511;&#1512;&#1493;&#1489;</div>'+
      '</div>'+
      '<input type="checkbox" disabled style="margin-right:auto;width:16px;height:16px;opacity:0.4;">'+
    '</div>';
}

function encRagBox(n,label,color,bg,count,chips,ph){
  var ch=chips.map(function(c){return '<span onclick="var i=document.getElementById(\'enc-q-'+n+'\');if(i)i.value=\''+c+'\'" style="font-size:10px;color:'+color+';cursor:pointer;background:'+bg+';border:0.5px solid '+color+'44;padding:2px 6px;border-radius:8px;">'+c+'</span>';}).join('');
  return '<div style="background:#fff;border:0.5px solid '+color+'33;border-radius:12px;padding:12px;">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
      '<span style="font-size:11px;font-weight:800;color:'+color+';">&#1513;&#1488;&#1500;&#1492; '+n+' &#8212; '+label+'</span>'+
      '<div style="display:flex;gap:5px;align-items:center;">'+
        '<span style="font-size:9px;color:'+color+'77;">'+count+'</span>'+
        '<button onclick="encRagVoice('+n+')" id="enc-rag-voice-'+n+'" title="&#1511;&#1500;&#1496; &#1511;&#1493;&#1500;&#1497;" style="width:26px;height:26px;border-radius:50%;background:'+bg+';border:0.5px solid '+color+'55;color:'+color+';font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#127908;</button>'+
        '<button onclick="var i=document.getElementById(\'enc-q-'+n+'\');if(i)i.value=\'\'" style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);color:#444;font-size:11px;cursor:pointer;">&#10005;</button>'+
      '</div>'+
    '</div>'+
    '<textarea id="enc-q-'+n+'" rows="2" placeholder="'+ph+'" style="width:100%;background:#fffbf0;border:0.5px solid '+color+'22;border-radius:7px;padding:7px 9px;color:#1a3d5c;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;color:#111;direction:rtl;resize:none;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\'&&event.ctrlKey)encRagRunAll()"></textarea>'+
    '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;">'+ch+'</div>'+
  '</div>';
}

function encRagToggle(id,label,color){
  return '<span id="enc-rags-'+id+'" onclick="encToggleRagSrc(\''+id+'\')" data-on="1" '+
    'style="font-size:10px;color:'+color+';background:'+color+'1a;border:0.5px solid '+color+'33;padding:3px 7px;border-radius:7px;cursor:pointer;font-family:Heebo,sans-serif;font-weight:700;">&#10003; '+label+'</span>';
}

function encToggleRagSrc(id){
  var el=document.getElementById('enc-rags-'+id);if(!el)return;
  var on=el.getAttribute('data-on')==='1';
  el.setAttribute('data-on',on?'0':'1');
  el.style.opacity=on?'0.4':'1';
}

function encRagVoice(n){
  var btn=document.getElementById('enc-rag-voice-'+n);
  var inp=document.getElementById('enc-q-'+n);
  if(!inp)return;
  if(_encVoiceActive[n-1]){if(_encVoiceRecorder[n-1])_encVoiceRecorder[n-1].stop();return;}
  // Try Web Speech API first (no server needed)
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){
    var rec=new SR();
    rec.lang='he-IL'; rec.continuous=false; rec.interimResults=false;
    _encVoiceActive[n-1]=true;
    if(btn){btn.textContent='&#9209;&#65039;';btn.style.background='rgba(239,68,68,0.2)';btn.style.color='#ef4444';}
    rec.onresult=function(e){if(inp)inp.value=e.results[0][0].transcript;};
    rec.onend=function(){_encVoiceActive[n-1]=false;if(btn){btn.textContent='&#127908;';btn.style.background='';btn.style.color='';}};
    rec.onerror=function(){_encVoiceActive[n-1]=false;if(btn){btn.textContent='&#127908;';btn.style.background='';btn.style.color='';}showToast('&#1511;&#1500;&#1496; &#1511;&#1493;&#1500;&#1497; &#1504;&#1499;&#1513;&#1500;','error');};
    rec.start();
    setTimeout(function(){try{rec.stop();}catch(e){}},10000);
    return;
  }
  showToast('&#1511;&#1500;&#1496; &#1511;&#1493;&#1500;&#1497; &#1500;&#1488; &#1504;&#1514;&#1502;&#1499; &#1489;&#1491;&#1508;&#1491;&#1508;&#1503; &#1494;&#1492;','error');
}

function encVoiceSearch(){
  var inp=document.getElementById('enc-search');
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){showToast('&#1511;&#1500;&#1496; &#1511;&#1493;&#1500;&#1497; &#1500;&#1488; &#1504;&#1514;&#1502;&#1499;','error');return;}
  var rec=new SR();
  rec.lang='he-IL'; rec.continuous=false;
  var btn=document.getElementById('enc-voice-search-btn');
  if(btn){btn.textContent='&#9209;&#65039;';btn.style.background='rgba(239,68,68,0.2)';}
  rec.onresult=function(e){if(inp){inp.value=e.results[0][0].transcript;encOnSearch(inp.value);}};
  rec.onend=function(){if(btn){btn.textContent='&#127908;';btn.style.background='';}};
  rec.start();
  setTimeout(function(){try{rec.stop();}catch(e){}},8000);
}

var _encRagStartTime=0;
var _encRagTokens={in:0,out:0};

function encShowTokenMeter(active){
  var el=document.getElementById('enc-token-meter');
  if(!el)return;
  if(active){
    _encRagStartTime=Date.now();
    el.style.display='flex';
    el.innerHTML='<div style="text-align:center;"><div style="font-size:10px;color:#38bdf8;font-weight:700;">AI עובד...</div><div id="enc-token-elapsed" style="font-size:28px;font-weight:900;color:#fff;">0ש\'</div></div>';
    var t=setInterval(function(){
      if(!document.getElementById('enc-token-elapsed')){clearInterval(t);return;}
      var s=((Date.now()-_encRagStartTime)/1000).toFixed(0);
      document.getElementById('enc-token-elapsed').textContent=s+'&#1513;&#39;';
    },500);
    el._timer=t;
  } else {
    if(el._timer)clearInterval(el._timer);
    var sec=((Date.now()-_encRagStartTime)/1000).toFixed(1);
    var cost=((_encRagTokens.in*0.000003)+(_encRagTokens.out*0.000015)).toFixed(4);
    el.innerHTML=
      '<div style="display:flex;gap:10px;justify-content:center;align-items:center;">'+
        '<div style="background:#0f2a42;border-radius:8px;padding:8px 16px;text-align:center;"><div style="font-size:10px;color:#38bdf8;font-weight:700;">זמן</div><div style="font-size:18px;font-weight:900;color:#fff;">'+sec+'ש\'</div></div>'+
        '<div style="background:#0f2a42;border-radius:8px;padding:8px 16px;text-align:center;"><div style="font-size:10px;color:#a78bfa;font-weight:700;">טוקנים</div><div style="font-size:18px;font-weight:900;color:#fff;">'+(_encRagTokens.in+_encRagTokens.out)+'</div></div>'+
        '<div style="background:#0f2a42;border-radius:8px;padding:8px 16px;text-align:center;"><div style="font-size:10px;color:#fbbf24;font-weight:700;">עלות</div><div style="font-size:18px;font-weight:900;color:#fff;">$'+cost+'</div></div>'+
      '</div>';
  }
}

async function encRagRunAll(){
  var q1=(document.getElementById('enc-q-1')||{}).value||'';
  var q2=(document.getElementById('enc-q-2')||{}).value||'';
  var q3=(document.getElementById('enc-q-3')||{}).value||'';
  encShowTokenMeter(true);
  if(!q1&&!q2&&!q3){encShowTokenMeter(false);showToast('&#1492;&#1494;&#1503; &#1500;&#1508;&#1495;&#1493;&#1514; &#1513;&#1488;&#1500;&#1492; &#1488;&#1495;&#1514;','error');return;}
  var results=document.getElementById('enc-rag-results');if(!results)return;
  results.innerHTML='<div style="color:#9a6f00;font-size:12px;padding:14px;text-align:center;">&#9203; &#1513;&#1493;&#1500;&#1495; &#1513;&#1488;&#1500;&#1493;&#1514;...</div>';
  var apiKey=(window.APP&&window.APP.config&&window.APP.config.anthropic_key)||null;
  if(!apiKey){results.innerHTML='<div style="color:#f87171;font-size:12px;padding:14px;">&#9888;&#65039; &#1502;&#1508;&#1514;&#1495; API &#1495;&#1505;&#1512;</div>';encShowTokenMeter(false);return;}
  var colors=['#38bdf8','#a78bfa','#22c55e'];
  var borders=['rgba(56,189,248,0.2)','rgba(167,139,250,0.2)','rgba(34,197,94,0.2)'];
  _encRagTokens={in:0,out:0};
  var qs=[q1,q2,q3].filter(Boolean);
  var done=await Promise.all(qs.map(function(q,i){
    return claudeFetch(JSON.stringify({
      _apiKey:apiKey,
      model:'claude-sonnet-4-20250514',
      max_tokens:800,
      messages:[{role:'user',content:'אתה יועץ הנדסי בנייה ישראלי. עברית בלבד. תשובה קצרה ומעשית.\n\n'+q}]
    }),null)
    .then(function(res){return res.json();})
    .then(function(data){if(data.usage){_encRagTokens.in+=data.usage.input_tokens||0;_encRagTokens.out+=data.usage.output_tokens||0;}return{i:i,q:q,r:(data.content&&data.content[0]&&data.content[0].text)||''};})
    .catch(function(e){return{i:i,q:q,err:e.message};});
  }));
  var html='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:10px;">';
  done.forEach(function(d){
    var text=d.err?'&#10060; &#1513;&#1490;&#1497;&#1488;&#1492;: '+d.err:(d.r||'&#1488;&#1497;&#1503; &#1514;&#1493;&#1510;&#1488;&#1492;');
    var _q=d.q; var _t=text.substring(0,600);
    var footer='<div style="display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:0.5px solid #e8ddb5;">'+
      '<button onclick="encRagPrint(this)" data-q="'+encEsc(_q)+'" data-t="'+encEsc(_t)+'" style="padding:5px 10px;background:#1a3d5c;border:none;color:#FFD700;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">&#128424;&#65039; &#1492;&#1491;&#1508;&#1505;</button>'+
      '<button onclick="encRagMail(this)" data-q="'+encEsc(_q)+'" data-t="'+encEsc(_t)+'" style="padding:5px 10px;background:#f5f0e8;border:0.5px solid #c9a84c;color:#111;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="encRagWA(this)" data-q="'+encEsc(_q)+'" data-t="'+encEsc(_t)+'" style="padding:5px 10px;background:#25D366;border:none;color:#fff;border-radius:7px;font-family:Heebo,sans-serif;font-size:11px;font-weight:800;cursor:pointer;">&#128172; WA</button>'+
    '</div>';
    html+='<div style="background:#fff;border:0.5px solid '+borders[d.i]+';border-radius:10px;padding:12px;">'+
      '<div style="font-size:10px;color:'+colors[d.i]+';font-weight:800;margin-bottom:7px;">&#1513;&#1488;&#1500;&#1492; '+(d.i+1)+': '+encEsc(d.q)+'</div>'+
      '<div style="font-size:12px;color:#111;font-weight:700;line-height:1.8;white-space:pre-wrap;">'+encEsc(text.substring(0,600))+'</div>'+
      footer+
    '</div>';
  });
  results.innerHTML=html+'</div>';
  encShowTokenMeter(false);
}


function encRagPrint(btn){
  var q=btn.getAttribute('data-q')||'';
  var t=btn.getAttribute('data-t')||'';
  var w=window.open('','_blank','width=650,height=550');
  if(!w)return;
  w.document.write('<html><head><meta charset="utf-8"><style>body{font-family:Heebo,Arial,sans-serif;direction:rtl;padding:24px;font-weight:700;color:#111;}h3{color:#1a3d5c;}pre{white-space:pre-wrap;line-height:1.8;}@media print{button{display:none}}</style></head><body><h3>'+q+'</h3><pre>'+t+'</pre><br><button onclick="window.print()">הדפס</button></body></html>');
  w.document.close();
  setTimeout(function(){w.print();},400);
}
function encRagMail(btn){
  var q=btn.getAttribute('data-q')||'';
  var t=btn.getAttribute('data-t')||'';
  window.location.href='mailto:?subject='+encodeURIComponent(q)+'&body='+encodeURIComponent(q+'\n\n'+t);
}
function encRagWA(btn){
  var q=btn.getAttribute('data-q')||'';
  var t=btn.getAttribute('data-t')||'';
  window.open('https://wa.me/?text='+encodeURIComponent('📘 '+q+'\n\n'+t),'_blank');
}

function encFmtRag(r){
  if(!r)return'&#1488;&#1497;&#1503; &#1514;&#1493;&#1510;&#1488;&#1493;&#1514;';
  if(typeof r==='string')return r;
  var p=[];
  if(r.answer)p.push(r.answer);
  if(r.building_standards&&r.building_standards.length){p.push('\n&#128207; &#1514;&#1511;&#1504;&#1497;&#1501; ('+r.building_standards.length+'):');r.building_standards.slice(0,3).forEach(function(s){p.push('&#183; '+(s.standard_name||s.name||'')+(s.description?' &#8212; '+s.description.substring(0,80):''));});}
  return p.join('\n')||JSON.stringify(r).substring(0,300);
}

// Archive project
function encOpenArchive(){encSetSource('archive');window.scrollTo({top:0,behavior:'smooth'});}
async function encRestoreProject(id){
  if(!confirm('&#1513;&#1495;&#1494;&#1512; &#1508;&#1512;&#1493;&#1497;&#1511;&#1496; &#1494;&#1492; &#1502;&#1492;&#1488;&#1512;&#1499;&#1497;&#1493;&#1503;?'))return;
  try{await window.sb.from('projects').update({is_archived:false,archived_at:null}).eq('id',id);_encArchive=_encArchive.filter(function(p){return p.id!==id;});showToast('&#9989; &#1513;&#1493;&#1495;&#1494;&#1512;','success');encRender();encRenderArchiveBanner();}
  catch(e){showToast('&#1513;&#1490;&#1497;&#1488;&#1492;: '+e.message,'error');}
}
function encOpenArchivedProject(id){switchTab&&switchTab('crm');showToast('&#1508;&#1493;&#1514;&#1495; &#1508;&#1512;&#1493;&#1497;&#1511;&#1496;...','success');}

function encRefresh(){
  _encLoaded=false;_encItems=[];_encContacts=[];_encArchive=[];
  _encSearchQ='';_encAssetFilter='all';_encPrioFilter='all';_encProjFilter='';_encDateFilter='all';_encActiveSource='all';_encActiveCats={};
  var s=document.getElementById('enc-search');if(s)s.value='';
  var af=document.getElementById('enc-asset-filter');if(af)af.value='all';
  var pf=document.getElementById('enc-prio-filter');if(pf)pf.value='all';
  var df=document.getElementById('enc-date-filter');if(df)df.value='all';
  var ps=document.getElementById('enc-proj-sel');if(ps)ps.value='';
  showToast('&#1502;&#1512;&#1506;&#1504;&#1503;...','success');
  encBuildShell();
  encLoadAll();
}

function encOpenAdd(){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  var po='<option value="">&#8212; &#1489;&#1495;&#1512; &#1508;&#1512;&#1493;&#1497;&#1511;&#1496; (&#1488;&#1493;&#1508;&#1510;&#1497;&#1493;&#1504;&#1500;&#1497;) &#8212;</option>';
  (window.allProjects||[]).forEach(function(p){po+='<option value="'+p.id+'">'+encEsc(p.project_name)+'</option>';});
  ov.innerHTML='<div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:500px;direction:rtl;font-family:Heebo,sans-serif;">'+
    '<div style="font-size:15px;font-weight:900;color:#1a3d5c;margin-bottom:14px;">+ &#1492;&#1493;&#1505;&#1507; &#1497;&#1491;&#1506;</div>'+
    '<div style="display:grid;gap:10px;">'+
      '<input id="enc-add-title" type="text" placeholder="&#1499;&#1493;&#1514;&#1512;&#1514; *" style="'+encInp()+'">'+
      '<select id="enc-add-cat" style="'+encInp()+'"><option value="&#1513;&#1496;&#1495;">&#128203; &#1502;&#1502;&#1510;&#1488; &#1513;&#1496;&#1495;</option><option value="&#1489;&#1496;&#1497;&#1495;&#1493;&#1514;">&#9888;&#65039; &#1489;&#1496;&#1497;&#1495;&#1493;&#1514;</option><option value="&#1492;&#1504;&#1491;&#1505;&#1497;">&#127959;&#65039; &#1492;&#1504;&#1491;&#1505;&#1497;</option><option value="&#1502;&#1491;&#1497;&#1491;&#1493;&#1514;">&#128208; &#1502;&#1491;&#1497;&#1491;&#1493;&#1514;</option><option value="&#1499;&#1500;&#1500;&#1497;">&#128202; &#1499;&#1500;&#1500;&#1497;</option></select>'+
      '<select id="enc-add-sev" style="'+encInp()+'"><option value="guideline">&#9989; &#1514;&#1511;&#1497;&#1503;</option><option value="medium">&#128993; MEDIUM</option><option value="high">&#128992; HIGH</option><option value="critical">&#128308; CRITICAL</option></select>'+
      '<select id="enc-add-proj" style="'+encInp()+'">'+po+'</select>'+
      '<textarea id="enc-add-desc" rows="3" placeholder="&#1514;&#1497;&#1488;&#1493;&#1512; / &#1492;&#1506;&#1512;&#1493;&#1514;..." style="'+encInp()+';resize:vertical;"></textarea>'+
    '</div>'+
    '<div style="display:flex;gap:8px;margin-top:14px;">'+
      '<button onclick="encSaveAdd()" style="flex:1;padding:10px;background:#1a3d5c;border:none;color:#FFD700;border-radius:9px;font-family:Heebo,sans-serif;font-size:13px;font-weight:900;cursor:pointer;">&#128190; &#1513;&#1502;&#1493;&#1512;</button>'+
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:10px 16px;background:#f5f5f5;border:none;border-radius:9px;font-family:Heebo,sans-serif;font-size:13px;cursor:pointer;">&#1489;&#1497;&#1496;&#1493;&#1500;</button>'+
    '</div>'+
  '</div>';
  document.body.appendChild(ov);
}

async function encSaveAdd(){
  var title=(document.getElementById('enc-add-title')||{}).value||'';
  if(!title){showToast('&#1492;&#1494;&#1503; &#1499;&#1493;&#1514;&#1512;&#1514;','error');return;}
  var cat=(document.getElementById('enc-add-cat')||{}).value||'&#1513;&#1496;&#1495;';
  var sev=(document.getElementById('enc-add-sev')||{}).value||'guideline';
  var proj=(document.getElementById('enc-add-proj')||{}).value||null;
  var desc=(document.getElementById('enc-add-desc')||{}).value||'';
  try{
    var r=await window.sb.from('field_encyclopedia').insert({title:title,category:cat,severity:sev,source_project_id:proj||null,description:desc,created_at:new Date().toISOString()}).select().single();
    if(r.error)throw r.error;
    _encItems.unshift(Object.assign({_src:'enc',_type:'finding'},r.data));
    showToast('&#9989; &#1504;&#1513;&#1502;&#1512; &#1500;&#1488;&#1504;&#1510;&#1497;&#1511;&#1500;&#1493;&#1508;&#1491;&#1497;&#1492;','success');
    document.querySelector('div[style*="position:fixed"][style*="9999"]')&&document.querySelector('div[style*="position:fixed"][style*="9999"]').remove();
    encRender();encRenderStats();
  }catch(e){showToast('&#1513;&#1490;&#1497;&#1488;&#1492;: '+e.message,'error');}
}

function encPopulateProjFilter(){
  var sel=document.getElementById('enc-proj-sel');if(!sel)return;
  sel.innerHTML='<option value="">&#1499;&#1500; &#1492;&#1508;&#1512;&#1493;&#1497;&#1511;&#1496;&#1497;&#1501;</option><option value="__archive__">&#128230; &#1488;&#1512;&#1499;&#1497;&#1493;&#1503; &#1489;&#1500;&#1489;&#1491;</option>';
  (window.allProjects||[]).forEach(function(p){var o=document.createElement('option');o.value=p.id;o.textContent=p.project_name;sel.appendChild(o);});
}

function encOnSearch(v){_encSearchQ=v;encRender();}
function encSetAsset(v){
  var srcMap={'__src_enc':'enc','__src_standards':'standards','__src_prices':'prices','__src_takeoff':'takeoff',
    '__src_notes':'notes','__src_inbox':'inbox','__src_contacts':'contacts','__src_archive':'archive'};
  // Big sources — block card load, redirect to RAG search
  if(v==='__src_standards'||v==='__src_prices'){
    var label=v==='__src_standards'?'838 &#1514;&#1511;&#1504;&#1497; &#1489;&#1504;&#1497;&#1497;&#1492;':'6,325 &#1508;&#1512;&#1497;&#1496;&#1497; &#1502;&#1495;&#1497;&#1512;&#1493;&#1503;';
    // Reset dropdown back to all
    var sel=document.getElementById('enc-asset-filter');if(sel)sel.value='all';
    // Show banner pointing to RAG
    var grid=document.getElementById('enc-grid');
    if(grid){
      grid.innerHTML='<div style="grid-column:1/-1;background:#fff;border:1.5px solid #c9a84c;border-radius:14px;padding:22px 20px;text-align:center;direction:rtl;font-family:Heebo,sans-serif;">'+
        '<div style="font-size:32px;margin-bottom:10px;">&#128269;</div>'+
        '<div style="font-size:15px;font-weight:900;color:#1a3d5c;margin-bottom:8px;">'+label+'</div>'+
        '<div style="font-size:13px;color:#7a5500;margin-bottom:16px;line-height:1.7;">&#9888;&#65039; &#1502;&#1511;&#1493;&#1512; &#1494;&#1492; &#1490;&#1491;&#1493;&#1500; &#8212; &#1492;&#1510;&#1490;&#1514; &#1499;&#1500; &#1492;&#1499;&#1512;&#1496;&#1497;&#1505;&#1497;&#1501; &#1514;&#1506;&#1502;&#1497;&#1505; &#1488;&#1514; &#1492;&#1502;&#1506;&#1512;&#1499;&#1514;.<br><b>&#1492;&#1513;&#1514;&#1502;&#1513; &#1489;&#1513;&#1488;&#1497;&#1500;&#1514;&#1493;&#1514; &#1502;&#1511;&#1510;&#1493;&#1506;&#1497;&#1493;&#1514; &#1500;&#1502;&#1496;&#1492; &#1500;&#1495;&#1508;&#1513; &#1489;&#1502;&#1493;&#1511;&#1491;</b></div>'+
        '<button onclick="document.getElementById(\'enc-rag\').scrollIntoView({behavior:\'smooth\'});this.closest(\'.enc-big-banner\')||document.getElementById(\'enc-grid\').innerHTML=\'\';" style="background:linear-gradient(135deg,#38bdf8,#6366f1);border:none;color:#fff;border-radius:10px;padding:11px 28px;font-size:13px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;">&#128640; &#1506;&#1489;&#1493;&#1512; &#1500;&#1513;&#1488;&#1497;&#1500;&#1514;&#1493;&#1514; &#1502;&#1511;&#1510;&#1493;&#1506;&#1497;&#1493;&#1514; &#8595;</button>'+
      '</div>';
      setTimeout(function(){document.getElementById('enc-rag')&&document.getElementById('enc-rag').scrollIntoView({behavior:'smooth'});},400);
    }
    return;
  }
  if(srcMap[v]){_encActiveSource=srcMap[v];_encAssetFilter='all';}
  else{_encActiveSource='all';_encAssetFilter=v;}
  encRender();
}
function encSetPrio(v){_encPrioFilter=v;encRender();}
function encSetDate(v){_encDateFilter=v;encRender();}
function encSetProj(v){_encProjFilter=v;encRender();}
function encFilter(){encOnSearch((document.getElementById('enc-search')||{}).value||'');}

function encFilterByProject(projId){
  switchTab&&switchTab('encyclopedia');
  setTimeout(function(){_encProjFilter=projId;var s=document.getElementById('enc-proj-sel');if(s)s.value=projId;encRender();},300);
}

function encView(id){
  // coerce id — Supabase returns integers, onclick passes strings
  var item=_encItems.find(function(i){return i.id==id;})||_encContacts.find(function(i){return i.id==id;})||_encArchive.find(function(i){return i.id==id;});
  if(!item)return;
  if(item.media_url&&typeof openLightbox==='function'){openLightbox(item.media_url,item.title||'');return;}
  var isStd=item._src==='standards';
  var body='';
  if(isStd){
    var reqs=item.key_requirements;
    var reqHtml='';
    if(reqs){try{var arr=typeof reqs==='string'?JSON.parse(reqs):reqs;reqHtml='<ul style="margin:8px 0 0;padding-right:18px;">'+arr.map(function(r){return'<li style="font-size:12px;color:#333;line-height:1.7;">'+encEsc(r)+'</li>';}).join('')+'</ul>';}catch(e){reqHtml='<div style="font-size:12px;color:#333;">'+encEsc(String(reqs))+'</div>';}}
    body=
      (item.scope?'<div style="font-size:12px;color:#333;line-height:1.8;margin-bottom:10px;">'+encEsc(item.scope)+'</div>':'')+
      (item.applies_to?'<div style="font-size:11px;background:#ede7f6;border-radius:6px;padding:6px 10px;color:#4527a0;margin-bottom:8px;">&#128204; <b>&#1514;&#1495;&#1493;&#1501; &#1497;&#1497;&#1513;&#1493;&#1501;:</b> '+encEsc(item.applies_to)+'</div>':'')+
      (reqHtml?'<div style="font-size:11px;font-weight:800;color:#1a3d5c;margin-bottom:4px;">&#9989; &#1491;&#1512;&#1497;&#1513;&#1493;&#1514; &#1506;&#1497;&#1511;&#1512;&#1497;&#1493;&#1514;:</div>'+reqHtml:'')+
      (item.authority?'<div style="font-size:10px;color:#888;margin-top:8px;">&#127970; &#1490;&#1493;&#1508;: '+encEsc(item.authority)+(item.mandatory_in_israel?' | &#9888;&#65039; &#1495;&#1493;&#1489;&#1492; &#1489;&#1497;&#1513;&#1512;&#1488;&#1500;':'')+'</div>':'');
  } else {
    body='<div style="font-size:13px;color:#333;line-height:1.8;white-space:pre-wrap;">'+encEsc(item.description||item.scope||item.ai_report||item.note_text||'&#1488;&#1497;&#1503; &#1514;&#1497;&#1488;&#1493;&#1512;')+'</div>';
  }
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  ov.innerHTML='<div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:580px;direction:rtl;font-family:Heebo,sans-serif;max-height:85vh;overflow-y:auto;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">'+
      '<div>'+
        (isStd?'<div style="font-size:10px;color:#4527a0;font-weight:800;margin-bottom:4px;">&#128207; '+encEsc(item.standard_id||'')+'</div>':'')+
        '<div style="font-size:16px;font-weight:900;color:#1a3d5c;line-height:1.4;">'+encEsc(encDec(item.title||item.full_name||item.project_name||''))+'</div>'+
        '<div style="font-size:11px;color:#888;margin-top:3px;">'+encEsc(encDec(item.industry_category||item.standard_category||item.category||''))+'</div>'+
      '</div>'+
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:#f5f5f5;border:none;border-radius:50%;width:28px;height:28px;font-size:14px;cursor:pointer;flex-shrink:0;">&#10005;</button>'+
    '</div>'+
    body+
    '<div style="display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;">'+
      '<button onclick="encPrint(\''+item.id+'\')" style="padding:8px 14px;background:#1a3d5c;border:none;color:#FFD700;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">&#128424;&#65039; &#1492;&#1491;&#1508;&#1505;</button>'+
      '<button onclick="encMail(\''+item.id+'\')" style="padding:8px 14px;background:#f5f5f5;border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">&#9993;&#65039; &#1502;&#1497;&#1497;&#1500;</button>'+
      '<button onclick="encWA(\''+item.id+'\')" style="padding:8px 14px;background:#f5f5f5;border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">&#128172; WA</button>'+
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:8px 14px;background:#f5f5f5;border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">&#1505;&#1490;&#1493;&#1512;</button>'+
    '</div>'+
  '</div>';
  document.body.appendChild(ov);
}

function encPrint(id){var item=_encItems.find(function(i){return i.id==id;});if(!item)return;var w=window.open('','_blank','width=700,height=600');if(!w)return;var body=item.scope||item.description||item.ai_report||'';var reqs=item.key_requirements;var reqHtml='';if(reqs){try{var arr=typeof reqs==='string'?JSON.parse(reqs):reqs;reqHtml='<ul>'+arr.map(function(r){return'<li>'+r+'</li>';}).join('')+'</ul>';}catch(e){reqHtml='<p>'+reqs+'</p>';}}w.document.write('<html><head><meta charset="utf-8"><style>body{font-family:Heebo,Arial,sans-serif;direction:rtl;padding:20px;}@media print{button{display:none}}</style></head><body><h2>'+(item.title||'')+'</h2><p style="color:#888;">'+(item.standard_id||item.category||'')+'</p><div>'+body+'</div>'+reqHtml+'</body></html>');w.document.close();setTimeout(function(){w.print();},300);}
function encMail(id){var i=_encItems.find(function(x){return x.id==id;});if(!i)return;window.location.href='mailto:?subject='+encodeURIComponent(i.title||'')+'&body='+encodeURIComponent((i.scope||i.description||i.ai_report||'').substring(0,500));}
function encWA(id){var i=_encItems.find(function(x){return x.id==id;});if(!i)return;window.open('https://wa.me/?text='+encodeURIComponent('&#128218; *'+(i.title||'')+'*\n'+(i.scope||i.description||i.ai_report||'').substring(0,300)),'_blank');}
function encMailNote(id){var n=_encItems.find(function(i){return i.id==id;});if(!n)return;window.location.href='mailto:?subject=&#1492;&#1506;&#1512;&#1492;&body='+encodeURIComponent(n.note_text||'');}
function encWANote(id){var n=_encItems.find(function(i){return i.id==id;});if(!n)return;window.open('https://wa.me/?text='+encodeURIComponent(n.note_text||''),'_blank');}
function encMailInbox(id){var n=_encItems.find(function(i){return i.id==id;});if(!n)return;window.location.href='mailto:?subject='+encodeURIComponent(n.file_name||'&#1511;&#1493;&#1489;&#1509;')+'&body='+encodeURIComponent(n.cloudinary_url||'');}
function encWAInbox(id){var n=_encItems.find(function(i){return i.id==id;});if(!n)return;window.open('https://wa.me/?text='+encodeURIComponent((n.file_name||'')+(n.cloudinary_url?'\n'+n.cloudinary_url:'')),'_blank');}
function encPlayAudio(url){if(!url)return;new Audio(url).play();}
function encLinkToProject(id){var i=_encItems.find(function(x){return x.id==id;});if(!i)return;var pid=i.source_project_id||i.project_id;if(pid&&typeof openProjectContent==='function')openProjectContent(pid,encProjName(pid),'notes');}
function encEditContact(id){if(typeof ctOpenEdit==='function')ctOpenEdit(id);else{switchTab&&switchTab('contacts');setTimeout(function(){if(typeof ctOpenEdit==='function')ctOpenEdit(id);},400);}}
async function encDeleteContact(id){if(!confirm('&#1502;&#1495;&#1511; &#1488;&#1497;&#1513; &#1511;&#1513;&#1512; &#1494;&#1492;?'))return;try{await window.sb.from('beni_contacts').delete().eq('id',id);_encContacts=_encContacts.filter(function(c){return c.id!==id;});showToast('&#128465;&#65039; &#1504;&#1502;&#1495;&#1511;','success');encRender();encRenderStats();}catch(e){showToast('&#1513;&#1490;&#1497;&#1488;&#1492;: '+e.message,'error');}}

function encEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function encDec(s){var t=document.createElement('textarea');t.innerHTML=String(s||'');return t.value;}
function encInp(){return 'width:100%;padding:8px 12px;border:1px solid #c9a84c;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;color:#111;direction:rtl;background:#fffbf0;box-sizing:border-box;';}
function encAbS(){return 'padding:5px 9px;border:0.5px solid #e8ddb5;border-radius:7px;font-size:11px;cursor:pointer;background:#f5f0e8;color:#1a3d5c;font-family:Heebo,sans-serif;font-weight:700;';}
function encAb(label,onclick){return '<button onclick="'+onclick+'" style="'+encAbS()+'">'+label+'</button>';}
function encFmtDate(d){if(!d)return'';try{return new Date(d).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit'});}catch(e){return'';}}
function encFmtArea(a){return a?parseFloat(a).toFixed(1)+' &#1502;"&#1512;':'&#8212;';}
function encProjName(id){if(!id)return'';var p=(window.allProjects||[]).find(function(x){return x.id===id;});return p?p.project_name:'';}
function encMapType(cat,mt){if(mt==='audio')return'audio';if(mt==='image')return'image';if(mt==='pdf')return'pdf';if((cat||'').includes('&#1514;&#1511;&#1503;'))return'standard';return'finding';}
