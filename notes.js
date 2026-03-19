// ══════════════════════════════════════════════════════
// SMART NOTES MODULE
// ══════════════════════════════════════════════════════
const NOTE_COLORS = {
  yellow:{ bg:'#f59e0b', light:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)', label:'🟡 כללי' },
  red:   { bg:'#ef4444', light:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.35)',  label:'🔴 דחוף' },
  green: { bg:'#22c55e', light:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.35)',  label:'🟢 בוצע' },
  blue:  { bg:'#3b82f6', light:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.35)', label:'🔵 תכנון' },
  purple:{ bg:'#a855f7', light:'rgba(168,85,247,0.12)', border:'rgba(168,85,247,0.35)', label:'🟣 אישי' },
};
let currentNoteColor='yellow', allNotes=[], activeNoteFilter='all', noteVoiceRecog=null, noteVoiceActive=false;

function selectNoteColor(color){currentNoteColor=color;document.querySelectorAll('.note-color-btn').forEach(b=>{const isActive=b.dataset.color===color;b.style.border=isActive?'3px solid #fff':'3px solid transparent';b.style.transform=isActive?'scale(1.2)':'scale(1)';});}

async function loadNotes(){const wall=document.getElementById('notes-wall');if(!wall)return;try{const{data,error}=await sb.from('beni_notes').select('*, projects(project_name)').eq('is_archived',false).order('created_at',{ascending:false});if(error)throw error;allNotes=data||[];renderNotes(allNotes);const sel=document.getElementById('note-project-select');if(sel&&window.allProjects&&window.allProjects.length){sel.innerHTML='<option value="">📁 כל הפרויקטים</option>'+(window.allProjects||[]).map(p=>'<option value="'+p.id+'">'+p.project_name+'</option>').join('');}}catch(e){console.error('loadNotes:',e);}}

function renderNotes(notes){
  const wall=document.getElementById('notes-wall');
  if(!wall)return;
  if(!notes.length){
    wall.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#444"><div style="font-size:48px;margin-bottom:12px">📝</div><div style="font-size:14px">אין הערות עדיין</div></div>';
    return;
  }
  wall.innerHTML=notes.map(function(n){
    var c=NOTE_COLORS[n.color]||NOTE_COLORS.yellow;
    var date=new Date(n.created_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    var proj=n.projects ? '<span style="font-size:10px;color:#888;margin-top:4px;display:block">📁 '+n.projects.project_name+'</span>' : '';
    var id=n.id;
    return [
      '<div style="background:'+c.light+';border:1px solid '+c.border+';border-right:4px solid '+c.bg+';border-radius:12px;padding:16px;position:relative">',
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">',
          '<span style="background:'+c.bg+';color:#fff;border-radius:8px;padding:3px 10px;font-size:10px;font-weight:900;">'+c.label+'</span>',
          '<div style="display:flex;gap:6px">',
            '<button onclick="editNote(this.dataset.id)" data-id="'+id+'" style="background:rgba(255,255,255,0.08);border:none;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px">✏️</button>',
            '<button onclick="deleteNote(this.dataset.id)" data-id="'+id+'" style="background:rgba(239,68,68,0.1);border:none;color:#ef4444;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px">🗑️</button>',
            '<button onclick="printNote(this.dataset.id)" data-id="'+id+'" style="background:rgba(255,255,255,0.08);border:none;color:#aaa;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px">🖨️</button>',
          '</div>',
        '</div>',
        '<p style="color:#fff;font-size:14px;line-height:1.8;white-space:pre-wrap;margin-bottom:10px">'+escNote(n.note_text)+'</p>',
        proj,
        '<div style="font-size:10px;color:#555;margin-top:8px;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">'+date+'</div>',
      '</div>'
    ].join('');
  }).join('');
}

function escNote(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

async function saveNote(){const text=document.getElementById('note-text-input')?.value?.trim();if(!text){alert('כתוב הערה תחילה');return;}const projectId=document.getElementById('note-project-select')?.value||null;showLoading(true);try{const{error}=await sb.from('beni_notes').insert({note_text:text,color:currentNoteColor,project_id:projectId||null});if(error)throw error;clearNoteForm();await loadNotes();showToast('✅ הערה נשמרה');}catch(e){showToast('❌ שגיאה: '+e.message);}finally{showLoading(false);}}

async function deleteNote(id){if(!confirm('למחוק הערה זו?'))return;await sb.from('beni_notes').delete().eq('id',id);await loadNotes();showToast('🗑️ הערה נמחקה');}

function editNote(id){const n=allNotes.find(x=>x.id===id);if(!n)return;const inp=document.getElementById('note-text-input');if(inp)inp.value=n.note_text;selectNoteColor(n.color);const btn=document.querySelector('[onclick="saveNote()"]');if(btn){btn.textContent='💾 עדכן הערה';btn.onclick=async()=>{const text=inp.value.trim();if(!text)return;showLoading(true);await sb.from('beni_notes').update({note_text:text,color:currentNoteColor,updated_at:new Date().toISOString()}).eq('id',id);showLoading(false);btn.textContent='💾 שמור הערה';btn.onclick=saveNote;clearNoteForm();await loadNotes();showToast('✅ הערה עודכנה');};}document.getElementById('note-text-input')?.focus();}

function clearNoteForm(){const inp=document.getElementById('note-text-input');if(inp){inp.value='';inp.style.borderColor='';}}

function filterNotes(color){activeNoteFilter=color;document.querySelectorAll('.note-filter').forEach(b=>{b.style.opacity=(b.dataset.filter===color)?'1':'0.5';b.style.fontWeight=(b.dataset.filter===color)?'900':'700';});renderNotes(color==='all'?allNotes:allNotes.filter(n=>n.color===color));}
function filterNotesByKeyword(kw){const filtered=allNotes.filter(n=>!kw||n.note_text.toLowerCase().includes(kw.toLowerCase()));renderNotes(activeNoteFilter==='all'?filtered:filtered.filter(n=>n.color===activeNoteFilter));}
function filterNotesByDate(){const from=document.getElementById('note-date-from')?.value;const to=document.getElementById('note-date-to')?.value;let filtered=allNotes;if(from)filtered=filtered.filter(n=>n.created_at>=from);if(to)filtered=filtered.filter(n=>n.created_at<=to+'T23:59:59');renderNotes(activeNoteFilter==='all'?filtered:filtered.filter(n=>n.color===activeNoteFilter));}
function printNotes(){const visible=allNotes.filter(n=>activeNoteFilter==='all'||n.color===activeNoteFilter);if(!visible.length){alert('אין הערות להדפסה');return;}const rows=visible.map(n=>{const c=NOTE_COLORS[n.color]||NOTE_COLORS.yellow;const date=new Date(n.created_at).toLocaleDateString('he-IL');return'<div class="note" style="border-right:4px solid '+c.bg+';padding:12px 16px;margin-bottom:16px"><strong style="color:'+c.bg+'">'+c.label+'</strong><p style="font-size:14px;line-height:1.9;white-space:pre-wrap">'+escNote(n.note_text)+'</p><div style="font-size:11px;color:#888;margin-top:6px">'+date+'</div></div>';}).join('');const w=window.open('','_blank');w.document.write('<html dir="rtl"><head><title>יומן חכם</title></head><body style="font-family:Heebo,sans-serif;padding:30px;direction:rtl"><h1>📝 יומן חכם — בני פרסקי</h1>'+rows+'</body></html>');w.document.close();setTimeout(()=>w.print(),500);}
function printNote(id){const n=allNotes.find(x=>x.id===id);if(!n)return;const c=NOTE_COLORS[n.color]||NOTE_COLORS.yellow;const w=window.open('','_blank');const date=new Date(n.created_at).toLocaleDateString('he-IL');w.document.write('<html dir="rtl"><head><title>הערה</title></head><body style="font-family:Heebo,sans-serif;padding:40px;direction:rtl"><span style="background:'+c.bg+';color:#fff;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;">'+c.label+'</span><p style="font-size:16px;line-height:2;white-space:pre-wrap;margin-top:16px">'+escNote(n.note_text)+'</p><div style="font-size:12px;color:#888;margin-top:20px">'+date+'</div></body></html>');w.document.close();setTimeout(()=>w.print(),300);}
function toggleNoteVoice(){if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){alert('דפדפן זה אינו תומך בזיהוי קול');return;}if(noteVoiceActive){if(noteVoiceRecog)noteVoiceRecog.stop();noteVoiceActive=false;const btn=document.getElementById('note-voice-btn');if(btn){btn.textContent='🎤 הקלט';btn.style.background='rgba(154,111,0,0.2)';}return;}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;noteVoiceRecog=new SR();noteVoiceRecog.lang='he-IL';noteVoiceRecog.continuous=true;noteVoiceRecog.interimResults=false;noteVoiceRecog.onresult=e=>{const transcript=Array.from(e.results).map(r=>r[0].transcript).join(' ');const inp=document.getElementById('note-text-input');if(inp)inp.value=(inp.value?inp.value+' ':'')+transcript;};noteVoiceRecog.onerror=()=>{noteVoiceActive=false;const btn=document.getElementById('note-voice-btn');if(btn){btn.textContent='🎤 הקלט';btn.style.background='rgba(154,111,0,0.2)';}};noteVoiceRecog.start();noteVoiceActive=true;const btn=document.getElementById('note-voice-btn');if(btn){btn.textContent='⏹ עצור';btn.style.background='rgba(239,68,68,0.3)';btn.style.borderColor='#ef4444';btn.style.color='#ef4444';}}

