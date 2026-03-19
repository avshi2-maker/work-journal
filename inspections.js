// ══════════════════════════════════════════════════════
// SITE INSPECTIONS — CRM Dashboard Widget
// Shows recent inspections with status, filters by
// contractor and project, safety alerts prominent
// ══════════════════════════════════════════════════════

async function loadRecentInspections() {
  var list  = document.getElementById('inspections-list');
  var badge = document.getElementById('inspect-safety-badge');
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:18px;color:var(--text3);font-size:13px;">Loading...</div>';

  try {
    // Last 7 days
    var from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    var res  = await fetch(
      SUPABASE_URL_CONST + '/rest/v1/site_inspections?inspection_date=gte.' + from +
      '&order=created_at.desc&limit=20',
      { headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST } }
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
            var url = SUPABASE_URL_CONST + '/storage/v1/object/public/photos/' + path;
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

