// ════════════════════════════════════════════════════════
// ANNEXES WIDGET — Subcontractor Safety Annexes
// ════════════════════════════════════════════════════════
var ANNEX_CONFIRM_URL = 'https://avshi2-maker.github.io/site-pulse/annex-confirm.html';

var ANNEX_LIST = [
  {num:'01', title:'ציוד מגן אישי (PPE)'},
  {num:'02', title:'עבודה בחללים מוקפים (Confined Space)'},
  {num:'03', title:'עבודה בגובה (Work at Heights)'},
  {num:'04', title:'עבודה בשעות חושך (Dark Hours)'},
  {num:'05', title:'עבודות חפירה ותעלות (Excavations)'},
  {num:'06', title:'מגבלות מזג אוויר (Weather Limitations)'},
  {num:'07', title:'איסור עישון (Smoking Regulation)'},
  {num:'08', title:'עבודה תחת מנוף (Working under a Crane)'},
  {num:'09', title:'תכנון מקדים (Pre-task Planning)'},
  {num:'10', title:'ציות לחוק ותקנות (Additional Regulation)'},
  {num:'11', title:'ביטוח צד שלישי ועובדים (Insurance)'},
  {num:'12', title:'הוראות נוספות חובה (Additional Mandatory)'},
  {num:'13', title:'פסולת מסוכנת, קרטון ומיכלים ריקים'},
  {num:'14', title:'שימוש בסמים ואלכוהול באתר'},
  {num:'15', title:'שטחי Lay-Down ומחנה קבלן'},
  {num:'16', title:'נסיעה בכלי רכב באתר הבנייה'},
  {num:'17', title:'שימוש בלוחות חשמל וכלי עבודה חשמליים'},
  {num:'18', title:'שימוש במלגזה, מניטו וטרקטור'},
  {num:'19', title:'הסעדת עובדים ואזורי אכילה ומנוחה'},
  {num:'20', title:'מדיניות אי-אלימות והטרדה באתר'},
];

var _annexStorageBase = SB_URL + '/storage/v1/object/public/app-assets/annexes/';

function renderAnnexWidget() {
  var container = document.getElementById('annexes-widget-inner');
  if (!container) return;

  var html = [
    // Send section
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">',
      '<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:12px;">📤 שלח נספחים לקבלן</div>',
      // Contractor + Project selects
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">',
        '<div style="flex:1;min-width:140px;">',
          '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">קבלן *</div>',
          '<select id="annex-contractor-sel" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;background:var(--surface);color:var(--text);">',
            '<option value="">בחר קבלן...</option>',
          '</select>',
        '</div>',
        '<div style="flex:1;min-width:120px;">',
          '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">פרויקט</div>',
          '<select id="annex-project-sel" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;background:var(--surface);color:var(--text);">',
            '<option value="">בחר פרויקט...</option>',
          '</select>',
        '</div>',
      '</div>',
      // Annex checkboxes
      '<div style="font-size:11px;font-weight:800;color:var(--text2);margin-bottom:8px;">בחר נספחים לשליחה:</div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px;" id="annex-checkboxes">',
  ].join('');

  ANNEX_LIST.forEach(function(a) {
    var pdfUrl = _annexStorageBase + 'annex_' + a.num + '.pdf';
    html +=
      '<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:6px;background:var(--surface);border:1px solid var(--border);">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;min-width:0;">' +
          '<input type="checkbox" class="annex-cb" value="' + a.num + '" style="width:14px;height:14px;cursor:pointer;flex-shrink:0;">' +
          '<span style="font-size:11px;font-weight:600;color:var(--text2);">' + a.num + '. ' + a.title + '</span>' +
        '</label>' +
        '<a href="' + pdfUrl + '" target="_blank" rel="noopener" ' +
           'style="flex-shrink:0;padding:3px 7px;background:#1a3d5c;color:white;border-radius:5px;font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap;" ' +
           'title="צפה ב-PDF">👁️ צפה</a>' +
      '</div>';
  });

  html += [
      '</div>',
      // Select all + Send button
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">',
        '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);cursor:pointer;">',
          '<input type="checkbox" id="annex-select-all" onchange="toggleAllAnnexes(this.checked)" style="width:13px;height:13px;">',
          'בחר הכל',
        '</label>',
        '<div style="flex:1;"></div>',
        '<button onclick="sendAnnexes()" style="padding:9px 16px;background:linear-gradient(135deg,#15803d,#16a34a);color:white;border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">',
          '💬 שלח נספחים בוואטסאפ',
        '</button>',
      '</div>',
    '</div>',
    // Sent history
    '<div id="annexes-history"><div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">טוען היסטוריה...</div></div>',
  ].join('');

  container.innerHTML = html;

  // Fill selects
  var cSel = document.getElementById('annex-contractor-sel');
  var pSel = document.getElementById('annex-project-sel');
  (allContractors || []).filter(function(c){ return c.is_active; }).forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.id; opt.dataset.name = c.company_name;
    opt.dataset.mobile = c.mobile || '';
    opt.textContent = c.company_name;
    cSel.appendChild(opt);
  });
  (allProjects || []).forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = p.id; opt.dataset.name = p.project_name;
    opt.textContent = p.project_name;
    pSel.appendChild(opt);
  });

  loadAnnexHistory();
}

function toggleAllAnnexes(checked) {
  document.querySelectorAll('.annex-cb').forEach(function(cb){ cb.checked = checked; });
}

async function sendAnnexes() {
  var cSel = document.getElementById('annex-contractor-sel');
  var pSel = document.getElementById('annex-project-sel');
  var cId   = cSel ? cSel.value : '';
  var cName = cSel && cSel.selectedOptions[0] ? cSel.selectedOptions[0].dataset.name : '';
  var cMob  = cSel && cSel.selectedOptions[0] ? cSel.selectedOptions[0].dataset.mobile : '';
  var pId   = pSel ? pSel.value : '';
  var pName = pSel && pSel.selectedOptions[0] ? pSel.selectedOptions[0].dataset.name : '';

  if (!cId) { alert('בחר קבלן תחילה'); return; }

  var selected = Array.from(document.querySelectorAll('.annex-cb:checked')).map(function(cb){ return cb.value; });
  if (!selected.length) { alert('בחר לפחות נספח אחד'); return; }

  try {
    // INSERT into contractor_annexes_sent → get confirm_token
    var res = await fetch(SB_URL + '/rest/v1/contractor_annexes_sent', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        contractor_id:   cId || null,
        contractor_name: cName,
        project_id:      pId  || null,
        project_name:    pName || null,
        annexes_sent:    selected,
        sent_by:         'Beni Persky',
        status:          'pending'
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var rows = await res.json();
    var token = rows[0] && rows[0].confirm_token;
    if (!token) throw new Error('No token returned');

    var confirmUrl = ANNEX_CONFIRM_URL + '?token=' + token;
    var NL = '\n';
    var phone = cMob ? '972' + cMob.replace(/[^0-9]/g,'').replace(/^0/,'') : '';

    // Build WA message with links to each PDF + confirmation link
    var annexLines = selected.map(function(num, i) {
      var meta = ANNEX_LIST.find(function(a){ return a.num === num; });
      var title = meta ? meta.title : 'נספח ' + num;
      return (i+1) + '. נספח ' + num + ' — ' + title + NL +
             '   📄 ' + _annexStorageBase + 'annex_' + num + '.pdf';
    }).join(NL);

    var msg = 'שלום ' + cName + ',' + NL + NL +
              'בני פרסקי שולח לך את נספחי הבטיחות הבאים לחוזה:' + NL +
              (pName ? 'פרויקט: ' + pName : '') + NL + NL +
              annexLines + NL + NL +
              '✅ לאישור קבלת הנספחים — לחץ כאן:' + NL +
              confirmUrl + NL + NL +
              'תודה — בני פרסקי 🏗️';

    var waUrl = (phone ? 'https://wa.me/' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(msg);
    var _a = document.createElement('a');
    _a.href = waUrl; _a.target = '_blank'; _a.rel = 'noopener';
    document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);

    showToast('נספחים נשלחו בוואטסאפ', 'success');
    loadAnnexHistory();

  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
    console.error('sendAnnexes:', e);
  }
}

async function loadAnnexHistory() {
  var list = document.getElementById('annexes-history');
  if (!list) return;
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/contractor_annexes_sent?order=sent_at.desc&limit=20',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    var rows = await res.json();
    if (!rows || !rows.length) {
      list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">אין שליחות עדיין</div>';
      return;
    }
    list.innerHTML = '<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">היסטוריית שליחות</div>';
    rows.forEach(function(r) {
      var date = new Date(r.sent_at).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
      var annexCount = (r.annexes_sent || []).length;
      var isConfirmed = r.status === 'confirmed';
      var badge = isConfirmed
        ? '<span style="background:rgba(34,197,94,.15);color:#15803d;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:800;">✅ אושר</span>'
        : '<span style="background:rgba(245,158,11,.15);color:#d97706;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:800;">⏳ ממתין</span>';
      var confirmedInfo = isConfirmed
        ? '<div style="font-size:10px;color:#15803d;margin-top:2px;">אושר ע"י: ' + esc(r.confirmed_by||'') + ' — ' + new Date(r.confirmed_at).toLocaleDateString('he-IL') + '</div>'
        : '';

      list.innerHTML +=
        '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">' +
          '<div style="width:34px;height:34px;border-radius:8px;background:rgba(26,61,92,.08);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📋</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:800;color:var(--text);">' + esc(r.contractor_name||'—') + '</div>' +
            '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' +
              (r.project_name ? esc(r.project_name) + ' · ' : '') +
              date + ' · ' + annexCount + ' נספחים' +
            '</div>' +
            confirmedInfo +
          '</div>' +
          badge +
        '</div>';
    });
  } catch(e) {
    list.innerHTML = '<div style="color:var(--red);font-size:13px;padding:12px;">שגיאה: ' + e.message + '</div>';
  }
}


