/**
 * EQUIPMENT MODULE — SUPABASE CONNECTED
 * work-journal — equipment_module_27022026.js
 * Date: 27/02/2026
 *
 * INSTALL:
 *   1. Run workjournal_equipment_sql_27022026.sql in Supabase
 *   2. Upload this file + CSS to GitHub repo
 *   3. Add to index.html:
 *      <link rel="stylesheet" href="equipment_module_27022026.css"> (in head)
 *      <div id="equipmentSummary"></div>  (after equipmentContainer)
 *      <script src="equipment_module_27022026.js"></script> (before </body>)
 *   4. Fill in SUPABASE_URL and SUPABASE_KEY below
 *   5. In app.js sendReport(): add  await saveEquipmentToSupabase(reportId);
 */

// ── CONFIG — paste your work-journal project values ─────────────────
// Supabase Dashboard → work-journal project → Settings → API
const WJ_URL = 'https://vmcipofovheztbjmhwsl.supabase.co';
const WJ_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE2MTcsImV4cCI6MjA4NzAzNzYxN30.LPq5N2Xo8iEqjgz2UhmdzUdh5tpGT3EYzSxJcYBEJ1w';

// ── STATE ─────────────────────────────────────────────────────────────
let wjSB             = null;
let equipmentCounter = 0;
let siteSubsList     = [];
let siteEquipList    = [];
let currentProject   = '';

// ── INIT ──────────────────────────────────────────────────────────────
function initEquipmentModule() {
  try {
    if (!window.supabase) { setTimeout(initEquipmentModule, 300); return; }
    wjSB = window.supabase.createClient(WJ_URL, WJ_KEY);
    console.log('✅ Equipment module ready');

    const projectInput = document.getElementById('projectName');
    if (projectInput) {
      const tryLoad = () => {
        const name = projectInput.value.trim();
        if (name && name !== currentProject) {
          currentProject = name;
          loadSiteLists(name);
        }
      };
      projectInput.addEventListener('change', tryLoad);
      projectInput.addEventListener('blur', tryLoad);
      setTimeout(tryLoad, 800);
    }
  } catch(e) { console.warn('Equipment init error:', e.message); }
}

// ── LOAD SITE LISTS ───────────────────────────────────────────────────
async function loadSiteLists(project) {
  if (!wjSB || !project) return;
  try {
    const [s, e] = await Promise.all([
      wjSB.from('site_subcontractors').select('sub_name,sub_type')
          .eq('project_name', project).eq('is_active', true).order('sort_order'),
      wjSB.from('site_equipment_types').select('*')
          .eq('project_name', project).eq('is_active', true).order('sort_order')
    ]);
    siteSubsList  = s.data || [];
    siteEquipList = e.data || [];
    console.log(`✅ Site "${project}": ${siteSubsList.length} subs, ${siteEquipList.length} equipment`);
    document.querySelectorAll('.equip-card').forEach(c => refreshCardDropdowns(c.id));
  } catch(e) { console.warn('loadSiteLists error:', e.message); }
}

// ── ADD EQUIPMENT CARD ────────────────────────────────────────────────
function addEquipmentRow() {
  equipmentCounter++;
  const id = `equip_${equipmentCounter}`;
  const subOpts  = buildSubOptions();
  const equipOpts = buildEquipOptions();

  const card = document.createElement('div');
  card.className = 'equip-card'; card.id = id; card.dir = 'rtl';
  card.innerHTML = `
    <div class="equip-header">
      <div class="equip-header-row">
        <div class="equip-field-group">
          <label class="equip-label">🚜 ציוד / כלי</label>
          <select class="equip-input equip-name" onchange="onEquipTypeChange('${id}',this)">
            <option value="">בחר ציוד...</option>${equipOpts}
            <option value="__custom__">✏️ אחר</option>
          </select>
          <input type="text" class="equip-input equip-name-custom" placeholder="שם ציוד"
            style="display:none;margin-top:4px;" onchange="recalcEquipment('${id}')">
        </div>
        <div class="equip-field-group">
          <label class="equip-label">🏢 מביא / בעלים</label>
          <select class="equip-input equip-owner" onchange="recalcEquipment('${id}')">
            <option value="">בחר...</option>${subOpts}
            <option value="__custom__">✏️ אחר</option>
          </select>
          <input type="text" class="equip-input equip-owner-custom" placeholder="שם"
            style="display:none;margin-top:4px;" onchange="recalcEquipment('${id}')">
        </div>
        <div class="equip-field-group">
          <label class="equip-label">💰 תמחור</label>
          <select class="equip-input equip-rate-type" onchange="recalcEquipment('${id}')">
            <option value="none">ללא חיוב</option>
            <option value="hourly">₪ לשעה</option>
            <option value="daily">₪ ליום</option>
          </select>
        </div>
        <div class="equip-field-group">
          <label class="equip-label">₪ תעריף</label>
          <input type="number" class="equip-input equip-rate" placeholder="0" min="0" step="50"
            oninput="recalcEquipment('${id}')" onchange="recalcEquipment('${id}')">
        </div>
        <button type="button" class="equip-remove-btn" onclick="removeEquipCard('${id}')">✕</button>
      </div>
      <input type="text" class="equip-input equip-notes"
        placeholder="הערות: מספר סידורי, מצב, ספק..." style="width:100%;margin-top:8px;">
    </div>
    <div class="equip-subs-section">
      <div class="equip-subs-title">
        👷 שיוך שימוש לקבלנים
        <button type="button" class="btn-add-sub" onclick="addSubRow('${id}')">➕ הוסף קבלן</button>
      </div>
      <div class="equip-subs-header">
        <span>קבלן</span><span>שעות</span><span>%</span><span>לחיוב</span><span></span>
      </div>
      <div class="equip-subs-rows" id="subs_${id}"></div>
      <div class="equip-totals" id="totals_${id}">
        <span class="equip-total-label">סה"כ:</span>
        <span class="equip-total-hours" id="total_hours_${id}">0 שע'</span>
        <span></span>
        <span class="equip-total-cost" id="total_cost_${id}">₪0</span>
        <span></span>
      </div>
    </div>`;

  wireCustom(card.querySelector('.equip-name'),  card.querySelector('.equip-name-custom'));
  wireCustom(card.querySelector('.equip-owner'), card.querySelector('.equip-owner-custom'));
  document.getElementById('equipmentContainer').appendChild(card);
  addSubRow(id);
  updateEquipmentSummary();
}

// ── EQUIPMENT TYPE SELECTED — auto-fill rate from site config ────────
function onEquipTypeChange(equipId, sel) {
  const card = document.getElementById(equipId);
  if (!card) return;
  const opt = sel.selectedOptions[0];
  if (!opt) return;
  const rt = opt.getAttribute('data-rate-type');
  const rv = opt.getAttribute('data-rate');
  const ow = opt.getAttribute('data-owner');
  const rateTypeEl = card.querySelector('.equip-rate-type');
  const rateEl     = card.querySelector('.equip-rate');
  const ownerEl    = card.querySelector('.equip-owner');
  if (rateTypeEl && rt) rateTypeEl.value = rt;
  if (rateEl     && rv) rateEl.value     = rv;
  if (ownerEl    && ow) {
    const m = [...ownerEl.options].find(o => o.value === ow);
    if (m) ownerEl.value = ow;
  }
  recalcEquipment(equipId);
}

// ── ADD SUB ROW ───────────────────────────────────────────────────────
function addSubRow(equipId) {
  const container = document.getElementById(`subs_${equipId}`);
  if (!container) return;
  const subId = `sub_${equipId}_${Date.now()}`;
  const subOpts = buildSubOptions();
  const row = document.createElement('div');
  row.className = 'equip-sub-row'; row.id = subId;
  row.innerHTML = `
    <select class="equip-input sub-name" onchange="onSubChange(this,'${equipId}')">
      <option value="">בחר קבלן...</option>${subOpts}
      <option value="__custom__">✏️ אחר</option>
    </select>
    <input type="text" class="equip-input sub-name-custom" placeholder="שם"
      style="display:none;" onchange="recalcEquipment('${equipId}')">
    <input type="number" class="equip-input sub-hours" placeholder="שעות"
      min="0" max="24" step="0.5"
      oninput="recalcEquipment('${equipId}')" onchange="recalcEquipment('${equipId}')">
    <span class="sub-percent">—</span>
    <span class="sub-cost">₪—</span>
    <button type="button" class="sub-remove-btn"
      onclick="document.getElementById('${subId}').remove();recalcEquipment('${equipId}')">✕</button>`;
  wireCustom(row.querySelector('.sub-name'), row.querySelector('.sub-name-custom'));
  container.appendChild(row);
}

function onSubChange(sel, equipId) {
  const card    = document.getElementById(equipId);
  const allVals = [...card.querySelectorAll(`.equip-sub-row .sub-name`)]
    .filter(s => s !== sel).map(s => s.value).filter(Boolean);
  if (sel.value && allVals.includes(sel.value)) {
    alert(`⚠️ "${sel.value}" כבר נבחר`);
    sel.value = '';
    return;
  }
  recalcEquipment(equipId);
}

// ── RECALC ────────────────────────────────────────────────────────────
function recalcEquipment(equipId) {
  const card = document.getElementById(equipId);
  if (!card) return;
  const rt  = card.querySelector('.equip-rate-type')?.value || 'none';
  const rv  = parseFloat(card.querySelector('.equip-rate')?.value) || 0;
  const rows = card.querySelectorAll('.equip-sub-row');
  let totalH = 0;
  rows.forEach(r => { totalH += parseFloat(r.querySelector('.sub-hours')?.value) || 0; });
  rows.forEach(r => {
    const h    = parseFloat(r.querySelector('.sub-hours')?.value) || 0;
    const pct  = totalH > 0 ? Math.round(h/totalH*100) : 0;
    let   cost = rt === 'hourly' ? h*rv : (rt === 'daily' && totalH > 0 ? h/totalH*rv : 0);
    const pe = r.querySelector('.sub-percent');
    const ce = r.querySelector('.sub-cost');
    if (pe) pe.textContent = h > 0 ? `${pct}%` : '—';
    if (ce) ce.textContent = cost > 0 ? `₪${cost.toFixed(0)}` : '₪—';
  });
  const totalCost = rt === 'hourly' ? totalH*rv : rt === 'daily' ? rv : 0;
  const he = document.getElementById(`total_hours_${equipId}`);
  const ce = document.getElementById(`total_cost_${equipId}`);
  if (he) he.textContent = `${totalH} שע'`;
  if (ce) ce.textContent = totalCost > 0 ? `₪${totalCost.toFixed(0)}` : '₪0';
  updateEquipmentSummary();
}

// ── SUMMARY TABLE ─────────────────────────────────────────────────────
function updateEquipmentSummary() {
  const el = document.getElementById('equipmentSummary');
  if (!el) return;
  const cards = document.querySelectorAll('.equip-card');
  if (!cards.length) { el.innerHTML=''; return; }

  const charges = []; let grand = 0;
  cards.forEach(card => {
    const nEl  = card.querySelector('.equip-name');
    const nCus = card.querySelector('.equip-name-custom');
    const name = nEl?.value === '__custom__' ? (nCus?.value||'?') : (nEl?.value||'?');
    const rt   = card.querySelector('.equip-rate-type')?.value || 'none';
    const rv   = parseFloat(card.querySelector('.equip-rate')?.value) || 0;
    const rows = card.querySelectorAll('.equip-sub-row');
    let totalH = 0;
    rows.forEach(r => { totalH += parseFloat(r.querySelector('.sub-hours')?.value)||0; });
    rows.forEach(r => {
      const sEl = r.querySelector('.sub-name');
      const sCu = r.querySelector('.sub-name-custom');
      const sub = sEl?.value === '__custom__' ? (sCu?.value||'') : (sEl?.value||'');
      const h   = parseFloat(r.querySelector('.sub-hours')?.value) || 0;
      if (!sub || !h) return;
      const cost = rt==='hourly' ? h*rv : (rt==='daily'&&totalH>0 ? h/totalH*rv : 0);
      charges.push({ sub, name, h, cost }); grand += cost;
    });
  });

  if (!charges.length) { el.innerHTML=''; return; }
  const bySub = {};
  charges.forEach(c => {
    if (!bySub[c.sub]) bySub[c.sub] = { items:[], total:0 };
    bySub[c.sub].items.push(c); bySub[c.sub].total += c.cost;
  });

  let rows = '';
  Object.entries(bySub).forEach(([sub, d]) => {
    d.items.forEach((it,i) => {
      rows += `<tr class="${i===0?'sub-first-row':'sub-cont-row'}">
        <td>${i===0?`<strong>${sub}</strong>`:''}</td>
        <td>${it.name}</td><td>${it.h} שע'</td>
        <td>${it.cost>0?`<strong>₪${it.cost.toFixed(0)}</strong>`:'—'}</td></tr>`;
    });
    if (d.total>0) rows += `<tr class="sub-total-row">
      <td colspan="3">סה"כ ${sub}</td><td><strong>₪${d.total.toFixed(0)}</strong></td></tr>`;
  });

  el.innerHTML = `<div class="equip-summary">
    <div class="equip-summary-title">📊 סיכום חיובי ציוד — ${currentProject||'הפרויקט'}</div>
    <table class="equip-summary-table">
      <thead><tr><th>קבלן</th><th>ציוד</th><th>שעות</th><th>לחיוב</th></tr></thead>
      <tbody>${rows}
        <tr class="grand-total-row"><td colspan="3">💰 סה"כ כל הציוד</td>
        <td><strong>₪${grand.toFixed(0)}</strong></td></tr>
      </tbody></table></div>`;
}

// ── SAVE TO SUPABASE ──────────────────────────────────────────────────
// Call from app.js: await saveEquipmentToSupabase(reportId)
async function saveEquipmentToSupabase(reportId) {
  if (!wjSB || !reportId) return;
  try {
    await wjSB.from('equipment').delete().eq('report_id', reportId);
    await wjSB.from('equipment_usage').delete().eq('report_id', reportId);

    for (const card of document.querySelectorAll('.equip-card')) {
      const nEl = card.querySelector('.equip-name');
      const nCu = card.querySelector('.equip-name-custom');
      const name = nEl?.value==='__custom__' ? (nCu?.value||'') : (nEl?.value||'');
      if (!name) continue;

      const oEl  = card.querySelector('.equip-owner');
      const oCu  = card.querySelector('.equip-owner-custom');
      const owner = oEl?.value==='__custom__' ? (oCu?.value||'') : (oEl?.value||'');
      const rt   = card.querySelector('.equip-rate-type')?.value || 'none';
      const rv   = parseFloat(card.querySelector('.equip-rate')?.value) || 0;
      let   totalH = 0;
      card.querySelectorAll('.sub-hours').forEach(h => { totalH += parseFloat(h.value)||0; });

      const { data: eq, error: eErr } = await wjSB.from('equipment').insert({
        report_id: reportId, equipment_type: name, hours_used: totalH,
        issues: card.querySelector('.equip-notes')?.value || '',
        rental: rt !== 'none', owner_name: owner, rate_type: rt, rate_value: rv
      }).select().single();
      if (eErr) { console.error('equip insert:', eErr); continue; }

      const inserts = [];
      card.querySelectorAll('.equip-sub-row').forEach(row => {
        const sEl  = row.querySelector('.sub-name');
        const sCu  = row.querySelector('.sub-name-custom');
        const sub  = sEl?.value==='__custom__' ? (sCu?.value||'') : (sEl?.value||'');
        const h    = parseFloat(row.querySelector('.sub-hours')?.value) || 0;
        const cTx  = row.querySelector('.sub-cost')?.textContent || '0';
        const cost = parseFloat(cTx.replace('₪','').replace('—','0')) || 0;
        if (sub && h>0) inserts.push({ equipment_id: eq.id, report_id: reportId,
          sub_name: sub, hours_used: h, cost_charged: cost });
      });
      if (inserts.length) {
        const { error: uErr } = await wjSB.from('equipment_usage').insert(inserts);
        if (uErr) console.error('usage insert:', uErr);
      }
    }
    console.log('✅ Equipment saved');
  } catch(e) { console.error('saveEquipmentToSupabase:', e.message); }
}

// ── LOAD FROM SUPABASE (viewing existing report) ──────────────────────
async function loadEquipmentFromSupabase(reportId) {
  if (!wjSB || !reportId) return;
  try {
    const { data, error } = await wjSB.from('equipment')
      .select('*, equipment_usage(sub_name,hours_used,cost_charged)')
      .eq('report_id', reportId).order('created_at');
    if (error) throw error;
    if (!data?.length) return;

    document.getElementById('equipmentContainer').innerHTML = '';
    equipmentCounter = 0;

    for (const eq of data) {
      addEquipmentRow();
      const cId  = `equip_${equipmentCounter}`;
      const card = document.getElementById(cId);
      if (!card) continue;

      // Fill name
      const nEl = card.querySelector('.equip-name');
      const nCu = card.querySelector('.equip-name-custom');
      if ([...nEl.options].find(o => o.value===eq.equipment_type)) {
        nEl.value = eq.equipment_type;
      } else { nEl.value='__custom__'; if(nCu){nCu.style.display='block';nCu.value=eq.equipment_type;} }

      // Fill owner
      const oEl = card.querySelector('.equip-owner');
      if (oEl && eq.owner_name) {
        const m = [...oEl.options].find(o => o.value===eq.owner_name);
        if (m) oEl.value = eq.owner_name;
      }
      const rtEl = card.querySelector('.equip-rate-type');
      const rvEl = card.querySelector('.equip-rate');
      if (rtEl) rtEl.value = eq.rate_type || 'none';
      if (rvEl) rvEl.value = eq.rate_value || 0;
      const ntEl = card.querySelector('.equip-notes');
      if (ntEl) ntEl.value = eq.issues || '';

      // Fill subs
      document.getElementById(`subs_${cId}`).innerHTML = '';
      for (const u of (eq.equipment_usage||[])) {
        addSubRow(cId);
        const last = document.querySelector(`#subs_${cId} .equip-sub-row:last-child`);
        if (!last) continue;
        const sEl = last.querySelector('.sub-name');
        const sCu = last.querySelector('.sub-name-custom');
        if ([...sEl.options].find(o => o.value===u.sub_name)) {
          sEl.value = u.sub_name;
        } else { sEl.value='__custom__'; if(sCu){sCu.style.display='block';sCu.value=u.sub_name;} }
        const hEl = last.querySelector('.sub-hours');
        if (hEl) hEl.value = u.hours_used;
      }
      recalcEquipment(cId);
    }
    console.log(`✅ Equipment loaded: ${data.length} items`);
  } catch(e) { console.error('loadEquipmentFromSupabase:', e.message); }
}

// ── HELPERS ───────────────────────────────────────────────────────────
function buildSubOptions() {
  return siteSubsList.map(s =>
    `<option value="${s.sub_name}">${s.sub_name}${s.sub_type?` (${s.sub_type})`:''}</option>`
  ).join('');
}

function buildEquipOptions() {
  return siteEquipList.map(e =>
    `<option value="${e.equipment_name}"
      data-rate-type="${e.default_rate_type||'none'}"
      data-rate="${e.default_rate_value||0}"
      data-owner="${e.default_owner||''}"
    >${e.equipment_name}${e.default_rate_value?` — ₪${e.default_rate_value}`:''}</option>`
  ).join('');
}

function wireCustom(sel, inp) {
  if (!sel || !inp) return;
  sel.addEventListener('change', () => {
    inp.style.display = sel.value==='__custom__' ? 'block' : 'none';
  });
}

function refreshCardDropdowns(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const subOpts = buildSubOptions();
  ['.equip-owner', '.sub-name'].forEach(cls => {
    card.querySelectorAll(cls).forEach(sel => {
      const cur = sel.value;
      sel.innerHTML = cls==='.equip-owner'
        ? `<option value="">בחר...</option>${subOpts}<option value="__custom__">✏️ אחר</option>`
        : `<option value="">בחר קבלן...</option>${subOpts}<option value="__custom__">✏️ אחר</option>`;
      if (cur) sel.value = cur;
    });
  });
}

function removeEquipCard(id) {
  document.getElementById(id)?.remove();
  updateEquipmentSummary();
}

function getEquipmentData() {
  const result = [];
  document.querySelectorAll('.equip-card').forEach(card => {
    const nEl=card.querySelector('.equip-name'), nCu=card.querySelector('.equip-name-custom');
    const name = nEl?.value==='__custom__'?(nCu?.value||''):(nEl?.value||'');
    const oEl=card.querySelector('.equip-owner'), oCu=card.querySelector('.equip-owner-custom');
    const owner = oEl?.value==='__custom__'?(oCu?.value||''):(oEl?.value||'');
    const rt=card.querySelector('.equip-rate-type')?.value||'none';
    const rv=parseFloat(card.querySelector('.equip-rate')?.value)||0;
    const notes=card.querySelector('.equip-notes')?.value||'';
    const subs=[];
    card.querySelectorAll('.equip-sub-row').forEach(r=>{
      const sEl=r.querySelector('.sub-name'),sCu=r.querySelector('.sub-name-custom');
      const sub=sEl?.value==='__custom__'?(sCu?.value||''):(sEl?.value||'');
      const h=parseFloat(r.querySelector('.sub-hours')?.value)||0;
      const c=parseFloat((r.querySelector('.sub-cost')?.textContent||'0').replace('₪','').replace('—','0'))||0;
      if(sub||h>0) subs.push({sub,hours:h,cost:c});
    });
    if(name) result.push({name,owner,rateType:rt,rateVal:rv,notes,subs});
  });
  return result;
}

// ── AUTO INIT ─────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEquipmentModule);
} else {
  setTimeout(initEquipmentModule, 500);
}
