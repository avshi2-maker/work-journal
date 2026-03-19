async function crmInit() {
  document.getElementById('dashboard-date').textContent =
    new Date().toLocaleDateString('he-IL', {weekday:'long',year:'numeric',month:'long',day:'numeric'});
  await loadAll();
  loadSiteReports();
  loadBeniTasks();
  loadDailyCalls();
  loadFieldIntel();
  loadRecentInspections();
}

async function loadAll() {
  window.showLoading && window.showLoading(true);
  try {
    await Promise.all([loadContractors(), loadProjects(), loadTransactions(), loadReports()]);
    renderDashboard();
  } catch(e){ showToast('שגיאה בטעינת נתונים: '+e.message,'error'); }
  finally { window.showLoading && window.showLoading(false); }
}

// ── LOAD ─────────────────────────────────────────────────
async function loadContractors() {
  const {data,error} = await sb.from('contractors_master').select('*').order('company_name');
  if(error) throw error;
  allContractors = data || [];
  window.allContractors = allContractors;
  document.getElementById('badge-contractors').textContent = allContractors.filter(c=>c.is_active).length;
  renderContractors();
  populateContractorSelects();
  populateOccupationFilter();
  _spFillSelects();
  renderAnnexWidget();
}

async function loadProjects() {
  const [{data,error},{data:quotesData},{data:quoteItemsData}] = await Promise.all([
    sb.from('projects').select('*').order('created_at',{ascending:false}),
    sb.from('quotes').select('id,project_id,title,status'),
    sb.from('quote_items').select('quote_id,unit_cost,quantity'),
  ]);
  if(error) throw error;
  allProjects = data || [];
  window.allProjects = allProjects;
  window.allQuotes = quotesData || [];
  window.allQuoteItems = quoteItemsData || [];
  document.getElementById('badge-projects').textContent = allProjects.length;
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
  const {data,error} = await sb.from('contractor_transactions')
    .select('*, contractors_master(company_name), projects(project_name)')
    .order('transaction_date',{ascending:false});
  if(error) throw error;
  allTransactions = data || [];
  renderBalances();
  renderTransactions();
}

async function loadReports() {
  const {data,error} = await sb.from('reports').select('*').order('report_date',{ascending:false}).limit(100);
  if(error) throw error;
  allReports = data || [];
  renderReports();
  populateReportProjectFilter();
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
  const special = {gantt:loadGantt, quotes:loadQuotes, forecast:renderForecast, 'purchase-orders':loadPurchaseOrders};
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
    return`<tr><td><strong>${esc(p.project_name)}</strong></td><td>${esc(p.client_name||'—')}</td><td style="font-size:13px;color:var(--text3)">${esc(p.city||p.address||'—')}</td><td style="font-size:13px">${p.start_date?fmtDate(p.start_date):'—'}</td><td>${p.total_budget?'₪'+fmtMoney(p.total_budget):'—'}</td><td class="col-quote-sum">${qs?'₪'+fmtMoney(qs):'—'}</td><td style="color:${profit>=0?'#22c55e':'#ef4444'};font-weight:700">${p.total_budget?'₪'+fmtMoney(profit):'—'}</td><td style="text-align:center"><span class="badge badge-blue">${reportCount[p.id]||0} 📝</span></td><td><span class="badge ${STATUS_BADGE[p.status]||'badge-gray'}">${STATUS_HE[p.status]||p.status}</span></td><td>${(()=>{if(!p.start_date||!p.planned_end_date)return'<span style="color:#aaa;font-size:11px">ללא</span>';const start=new Date(p.start_date),end=new Date(p.planned_end_date),now=new Date();const pct=Math.min(100,Math.max(0,Math.round((now-start)/(end-start)*100)));return'<div style="background:#f0f0f0;border-radius:4px;height:7px;"><div style="width:'+pct+'%;background:#3b82f6;height:7px;border-radius:4px;"></div></div><div style="font-size:10px;color:#666">'+pct+'%</div>';})()}</td><td class="td-actions"><div class="btn-group"><button class="btn btn-ghost btn-sm btn-icon" onclick="openProjectModal('${p.id}')">✏️</button><button class="btn btn-ghost btn-sm btn-icon" onclick="openPhotoGallery('${p.id}','${esc(p.project_name)}')">📸</button></div></td></tr>`;
  }).join('');
}

function filterProjects() {
  const q=document.getElementById('project-search').value.toLowerCase();
  const st=document.getElementById('project-filter-status').value;
  renderProjects(allProjects.filter(p=>{const txt=(p.project_name+(p.client_name||'')+(p.city||'')).toLowerCase();return(!q||txt.includes(q))&&(!st||p.status===st);}));
}

function openProjectModal(id=null) {
  editingProjectId=id;window._editingProjectId=null;
  ['name','client','client-mobile','address','city','status','start','end','budget','contract','scope'].forEach(f=>{const el=document.getElementById('p-'+f);if(el)el.value='';});
  document.getElementById('p-status').value='active';
  document.getElementById('btn-delete-project').style.display=id?'block':'none';
  document.getElementById('modal-project-title').textContent=id?'עריכת פרויקט':'פרויקט חדש';
  if(id){const p=allProjects.find(x=>x.id===id);if(p){window._editingProjectId=id;document.getElementById('p-name').value=p.project_name||'';document.getElementById('p-client').value=p.client_name||'';document.getElementById('p-client-mobile').value=p.client_mobile||'';document.getElementById('p-address').value=p.address||'';document.getElementById('p-city').value=p.city||'';document.getElementById('p-status').value=p.status||'active';document.getElementById('p-start').value=p.start_date||'';document.getElementById('p-end').value=p.planned_end_date||'';document.getElementById('p-budget').value=p.total_budget||'';document.getElementById('p-contract').value=p.contract_amount||'';document.getElementById('p-scope').value=p.scope_of_work||'';updateModalProfitDisplay();}}
  document.getElementById('modal-project').style.display='flex';
}

async function saveProject() {
  const name=document.getElementById('p-name').value.trim();
  if(!name){showToast('שם פרויקט הוא שדה חובה','error');return;}
  window.showLoading&&window.showLoading(true);
  try{
    const payload={project_name:name,client_name:document.getElementById('p-client').value.trim()||null,client_mobile:document.getElementById('p-client-mobile').value.trim()||null,address:document.getElementById('p-address').value.trim()||null,city:document.getElementById('p-city').value.trim()||null,status:document.getElementById('p-status').value,start_date:document.getElementById('p-start').value||null,planned_end_date:document.getElementById('p-end').value||null,total_budget:parseFloat(document.getElementById('p-budget').value)||null,contract_amount:parseFloat(document.getElementById('p-contract').value)||null,scope_of_work:document.getElementById('p-scope').value.trim()||null,updated_at:new Date().toISOString()};
    if(editingProjectId){const{error}=await sb.from('projects').update(payload).eq('id',editingProjectId);if(error)throw error;showToast('פרויקט עודכן ✅','success');}
    else{const{error}=await sb.from('projects').insert(payload);if(error)throw error;showToast('פרויקט חדש נוסף ✅','success');}
    closeModal('modal-project');await loadProjects();renderDashboard();
  }catch(e){showToast('שגיאה: '+e.message,'error');}
  finally{window.showLoading&&window.showLoading(false);}
}

async function deleteProject() {
  if(!editingProjectId||!confirm('האם למחוק פרויקט זה?'))return;
  window.showLoading&&window.showLoading(true);
  try{const{error}=await sb.from('projects').delete().eq('id',editingProjectId);if(error)throw error;showToast('פרויקט נמחק','success');closeModal('modal-project');await loadProjects();renderDashboard();}
  catch(e){showToast('שגיאה: '+e.message,'error');}
  finally{window.showLoading&&window.showLoading(false);}
}

function updateModalProfitDisplay() {
  const budget=parseFloat(document.getElementById('p-budget').value)||0;
  const qs=window._editingProjectId&&window.quoteSum?(window.quoteSum[window._editingProjectId]||0):0;
  const cos=window._editingProjectId&&window.coApprovedSum?(window.coApprovedSum[window._editingProjectId]||0):0;
  const profit=budget-qs-cos;
  const el=document.getElementById('p-profit-display');
  if(!el)return;
  if(!budget){el.textContent='מחושב אוטומטית מתקציב − הצעות מחיר';el.style.color='#22c55e';return;}
  el.textContent='₪'+fmtMoney(profit);el.style.color=profit>=0?'#22c55e':'#ef4444';
}

// ── FINANCE ──────────────────────────────────────────────
function onTransactionTypeChange(sel) {
  const row=document.getElementById('t-client-row');
  if(row)row.style.display=sel.value==='client_income'?'block':'none';
}

function renderPnL() {
  const income=allTransactions.filter(t=>t.type==='client_income');
  const expense=allTransactions.filter(t=>t.type==='sent');
  const totalInc=income.reduce((s,t)=>s+Number(t.amount),0);
  const totalExp=expense.reduce((s,t)=>s+Number(t.amount),0);
  const balance=totalInc-totalExp;
  const upd=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  upd('pnl-income',totalInc?'₪'+fmtMoney(totalInc):'—');
  upd('pnl-expense',totalExp?'₪'+fmtMoney(totalExp):'—');
  upd('pnl-balance',balance!==0?(balance>0?'+':'')+'₪'+fmtMoney(Math.abs(balance)):'—');
  const balCard=document.getElementById('pnl-balance-card');
  if(balCard){balCard.style.background=balance>=0?'linear-gradient(135deg,#1e6b30,#22c55e)':'linear-gradient(135deg,#7f1d1d,#ef4444)';balCard.style.color='white';}
  const projInc={},projExp={};
  income.forEach(t=>{if(t.project_id)projInc[t.project_id]=(projInc[t.project_id]||0)+Number(t.amount);});
  expense.forEach(t=>{if(t.project_id)projExp[t.project_id]=(projExp[t.project_id]||0)+Number(t.amount);});
  const projTbody=document.getElementById('pnl-projects-tbody');
  if(projTbody){const rows=allProjects.map(p=>{const inc=projInc[p.id]||0,exp=projExp[p.id]||0,bal=inc-exp,bud=p.total_budget||0,pct=bud?Math.round(exp/bud*100):null;if(!inc&&!exp)return'';return`<tr><td style="padding:9px 14px;font-weight:700">${esc(p.project_name)}</td><td style="padding:9px 14px;color:#1e6b30;font-weight:700">${inc?'₪'+fmtMoney(inc):'—'}</td><td style="padding:9px 14px;color:#b52a1d;font-weight:700">${exp?'₪'+fmtMoney(exp):'—'}</td><td style="padding:9px 14px;font-weight:800;color:${bal>=0?'#1e6b30':'#b52a1d'}">${bal===0?'—':(bal>0?'+':'')+'₪'+fmtMoney(Math.abs(bal))}</td><td style="padding:9px 14px;color:#666">${bud?'₪'+fmtMoney(bud):'—'}</td><td style="padding:9px 14px">${pct!==null?pct+'%':'—'}</td></tr>`;}).filter(Boolean);projTbody.innerHTML=rows.length?rows.join(''):'<tr><td colspan="6" style="text-align:center;padding:24px;color:#aaa;">אין נתונים עדיין</td></tr>';}
  const incTbody=document.getElementById('pnl-income-tbody');
  if(incTbody){incTbody.innerHTML=income.length?income.map(t=>{const proj=allProjects.find(p=>p.id===t.project_id);return`<tr><td style="padding:8px 12px;font-size:13px">${fmtDate(t.transaction_date)}</td><td style="padding:8px 12px;font-weight:700">${esc(proj?.project_name||'—')}</td><td style="padding:8px 12px;color:#666">${esc(t.description||'—')}</td><td style="padding:8px 12px;color:#1e6b30;font-weight:800">₪${fmtMoney(t.amount)}</td><td style="padding:8px 12px;font-size:13px;color:#888">${esc(t.description||'—')}</td><td style="padding:8px 12px;font-size:12px;color:#aaa">${esc(t.reference_number||'—')}</td></tr>`;}).join(''):'<tr><td colspan="6" style="text-align:center;padding:24px;color:#aaa;">אין הכנסות עדיין</td></tr>';}
}

function renderBalances() {
  const tbody=document.getElementById('balances-tbody');
  if(!allContractors.length){tbody.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💰</div><h3>אין קבלנים</h3></div></td></tr>';return;}
  const balMap={};
  allTransactions.filter(t=>t.type!=='client_income').forEach(t=>{if(!balMap[t.contractor_id])balMap[t.contractor_id]={sent:0,received:0};if(t.type==='sent')balMap[t.contractor_id].sent+=Number(t.amount);else balMap[t.contractor_id].received+=Number(t.amount);});
  const rows=allContractors.filter(c=>c.is_active).map(c=>{const b=balMap[c.id]||{sent:0,received:0};const balance=b.sent-b.received;const cls=balance>0?'balance-positive':balance<0?'balance-negative':'balance-zero';const balStr=balance===0?'—':(balance>0?'שולם ':'קיבלנו ')+'₪'+fmtMoney(Math.abs(balance));return`<tr><td><strong>${esc(c.company_name)}</strong><br><span style="font-size:12px;color:var(--text3)">${esc(c.contact_name)}</span></td><td style="font-size:13px;color:var(--text3)">${esc(c.main_occupation||'—')}</td><td class="amount-sent">${b.sent?'₪'+fmtMoney(b.sent):'—'}</td><td class="amount-received">${b.received?'₪'+fmtMoney(b.received):'—'}</td><td class="${cls}" style="font-size:15px">${balStr}</td></tr>`;});
  tbody.innerHTML=rows.join('')||'<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💰</div><h3>אין נתונים</h3></div></td></tr>';
}

function renderTransactions(list) {
  const data=list||allTransactions;
  const tbody=document.getElementById('transactions-tbody');
  if(!data.length){tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><h3>אין תנועות</h3></div></td></tr>';return;}
  tbody.innerHTML=data.map(t=>`<tr><td style="font-size:13px">${fmtDate(t.transaction_date)}</td><td><strong>${esc(t.contractors_master?.company_name||'—')}</strong></td><td style="font-size:13px;color:var(--text3)">${esc(t.projects?.project_name||'—')}</td><td><span class="badge ${t.type==='sent'?'badge-red':t.type==='client_income'?'badge-green':'badge-blue'}">${t.type==='sent'?'💸 שולם':t.type==='client_income'?'🏦 הכנסה':'✅ התקבל'}</span></td><td class="${t.type==='sent'?'amount-sent':'amount-received'}" style="font-weight:700">${t.type==='sent'?'':'+'}₪${fmtMoney(t.amount)}</td><td style="font-size:13px;color:var(--text3)">${esc(t.description||'—')}</td><td style="font-size:12px;color:var(--text3)">${esc(t.reference_number||'—')}</td><td class="td-actions"><div class="btn-group"><button class="btn btn-ghost btn-sm btn-icon" onclick="openTransactionModal('${t.id}')">✏️</button></div></td></tr>`).join('');
}

function filterTransactions() {
  const q=document.getElementById('transaction-search').value.toLowerCase();
  const type=document.getElementById('transaction-filter-type').value;
  renderTransactions(allTransactions.filter(t=>{const txt=((t.contractors_master?.company_name||'')+(t.description||'')+(t.reference_number||'')).toLowerCase();return(!q||txt.includes(q))&&(!type||t.type===type);}));
}

function openTransactionModal(id=null) {
  editingTransactionId=id;
  ['contractor','project','type','date','amount','ref','desc'].forEach(f=>{const el=document.getElementById('t-'+f);if(el)el.value='';});
  document.getElementById('t-type').value='sent';
  const cr=document.getElementById('t-client-row');if(cr)cr.style.display='none';
  const cn=document.getElementById('t-client-name');if(cn)cn.value='';
  document.getElementById('t-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('btn-delete-transaction').style.display=id?'block':'none';
  document.getElementById('modal-transaction-title').textContent=id?'עריכת תנועה':'תנועה כספית חדשה';
  if(id){const t=allTransactions.find(x=>x.id===id);if(t){document.getElementById('t-contractor').value=t.contractor_id||'';document.getElementById('t-project').value=t.project_id||'';document.getElementById('t-type').value=t.type;document.getElementById('t-date').value=t.transaction_date||'';document.getElementById('t-amount').value=t.amount||'';document.getElementById('t-ref').value=t.reference_number||'';document.getElementById('t-desc').value=t.description||'';}}
  document.getElementById('modal-transaction').style.display='flex';
}

async function saveTransaction() {
  const cid=document.getElementById('t-contractor').value;
  const amount=parseFloat(document.getElementById('t-amount').value);
  const date=document.getElementById('t-date').value;
  if(!cid||!amount||!date){showToast('שדות חובה: קבלן, סכום, תאריך','error');return;}
  window.showLoading&&window.showLoading(true);
  try{
    const payload={contractor_id:cid,project_id:document.getElementById('t-project').value||null,type:document.getElementById('t-type').value,transaction_date:date,amount,reference_number:document.getElementById('t-ref').value.trim()||null,description:document.getElementById('t-desc').value.trim()||null};
    if(editingTransactionId){const{error}=await sb.from('contractor_transactions').update(payload).eq('id',editingTransactionId);if(error)throw error;showToast('תנועה עודכנה ✅','success');}
    else{const{error}=await sb.from('contractor_transactions').insert(payload);if(error)throw error;showToast('תנועה נוספה ✅','success');}
    closeModal('modal-transaction');await loadTransactions();renderDashboard();
  }catch(e){showToast('שגיאה: '+e.message,'error');}
  finally{window.showLoading&&window.showLoading(false);}
}

async function deleteTransaction() {
  if(!editingTransactionId||!confirm('למחוק תנועה זו?'))return;
  window.showLoading&&window.showLoading(true);
  try{const{error}=await sb.from('contractor_transactions').delete().eq('id',editingTransactionId);if(error)throw error;showToast('תנועה נמחקה','success');closeModal('modal-transaction');await loadTransactions();renderDashboard();}
  catch(e){showToast('שגיאה: '+e.message,'error');}
  finally{window.showLoading&&window.showLoading(false);}
}

// ── REPORTS ──────────────────────────────────────────────
function renderReports(list) {
  const data=list||allReports;
  const tbody=document.getElementById('reports-tbody');
  const SRHE={draft:'טיוטה',sent:'נשלח',approved:'אושר'};
  const SRCSS={draft:'badge-amber',sent:'badge-blue',approved:'badge-green'};
  if(!data.length){tbody.innerHTML='<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📄</div><h3>אין דוחות עדיין</h3></div></td></tr>';return;}
  tbody.innerHTML=data.map(r=>`<tr id="report-row-${r.id}"><td style="text-align:center;width:36px"><input type="checkbox" class="report-cb" data-id="${r.id}" data-number="${esc(r.report_number||'')}" data-project="${esc(r.project_name||allProjects.find(p=>p.id===r.project_id)?.project_name||'')}" data-date="${r.report_date||''}" onchange="onReportCbChange()" style="width:16px;height:16px;cursor:pointer;"></td><td style="font-family:monospace;font-size:13px">${esc(r.report_number||'—')}</td><td>${esc(r.project_name||allProjects.find(p=>p.id===r.project_id)?.project_name||'—')}</td><td>${r.report_date?fmtDate(r.report_date):'—'}</td><td style="font-size:13px">${esc(r.manager_name||'—')}</td><td style="text-align:center">${r.total_work_hours||'—'}</td><td><span class="badge ${SRCSS[r.status]||'badge-gray'}">${SRHE[r.status]||r.status||'—'}</span></td><td class="td-actions"><div class="btn-group"><button class="btn btn-ghost btn-sm btn-icon" onclick="openJournalForProject('${r.project_id||''}','${esc(r.project_name||allProjects.find(p=>p.id===r.project_id)?.project_name||'')}')">📝</button></div></td></tr>`).join('');
  const sa=document.getElementById('reports-select-all');if(sa)sa.checked=false;
  updateReportToolbar();
}

function toggleAllReports(cb){document.querySelectorAll('.report-cb').forEach(c=>c.checked=cb.checked);updateReportToolbar();}
function onReportCbChange(){const all=document.querySelectorAll('.report-cb');const checked=document.querySelectorAll('.report-cb:checked');const sa=document.getElementById('reports-select-all');if(sa)sa.checked=all.length>0&&checked.length===all.length;updateReportToolbar();}
function updateReportToolbar(){const checked=document.querySelectorAll('.report-cb:checked');const toolbar=document.getElementById('reports-send-toolbar');const countEl=document.getElementById('reports-selected-count');if(!toolbar)return;if(checked.length>0){toolbar.style.display='flex';if(countEl)countEl.textContent=checked.length+' נבחרו';}else{toolbar.style.display='none';}}
function clearReportSelection(){document.querySelectorAll('.report-cb').forEach(c=>c.checked=false);const sa=document.getElementById('reports-select-all');if(sa)sa.checked=false;updateReportToolbar();}
function getSelectedReportIds(){return Array.from(document.querySelectorAll('.report-cb:checked')).map(c=>c.dataset.id);}
function filterReports(){const q=document.getElementById('reports-search').value.toLowerCase();const pid=document.getElementById('reports-filter-project').value;const date=document.getElementById('reports-filter-date').value;renderReports(allReports.filter(r=>{const txt=(r.report_number||'').toLowerCase();return(!q||txt.includes(q))&&(!pid||r.project_id===pid)&&(!date||r.report_date===date);}));}
function populateReportProjectFilter(){const sel=document.getElementById('reports-filter-project');sel.innerHTML='<option value="">כל הפרויקטים</option>'+allProjects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');}
function populateContractorSelects(){const sel=document.getElementById('t-contractor');sel.innerHTML='<option value="">— בחר קבלן —</option>'+allContractors.filter(c=>c.is_active).map(c=>`<option value="${c.id}">${esc(c.company_name)}</option>`).join('');}
function populateProjectSelects(){const sel=document.getElementById('t-project');sel.innerHTML='<option value="">— ללא פרויקט —</option>'+allProjects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');}

// ── CSV EXPORT ────────────────────────────────────────────
function downloadCSV(rows,filename){const BOM='\uFEFF';const csv=BOM+rows.map(r=>r.map(c=>{const s=String(c==null?'':c).replace(/"/g,'""');return/[",\n\r]/.test(s)?'"'+s+'"':s;}).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=Object.assign(document.createElement('a'),{href:url,download:filename});document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);}
function exportContractorsCSV(){const today=new Date().toLocaleDateString('he-IL');downloadCSV([['שם חברה','איש קשר','טלפון','דוא״ל','עיסוק','פעיל'],...allContractors.map(c=>[c.company_name||'',c.contact_name||'',c.mobile||'',c.email||'',c.main_occupation||'',c.is_active?'כן':'לא'])],'קבלנים_'+today.replace(/\//g,'-')+'.csv');showToast('📥 ייוצאו '+allContractors.length+' קבלנים','success');}
function exportProjectsCSV(){const today=new Date().toLocaleDateString('he-IL');downloadCSV([['שם פרויקט','לקוח','עיר','תאריך התחלה','תאריך סיום','תקציב','סטטוס'],...allProjects.map(p=>[p.project_name||'',p.client_name||'',p.city||'',p.start_date||'',p.planned_end_date||'',p.total_budget||'',STATUS_HE[p.status]||p.status])],'פרויקטים_'+today.replace(/\//g,'-')+'.csv');showToast('📥 ייוצאו '+allProjects.length+' פרויקטים','success');}

// ── MODAL HELPERS ─────────────────────────────────────────
function closeModal(id){document.getElementById(id).style.display='none';}
function closeModalOnOverlay(e,id){if(e.target===e.currentTarget)closeModal(id);}

// ── UI HELPERS ────────────────────────────────────────────
let toastTimer;
function showToast(msg,type='success'){clearTimeout(toastTimer);let t=document.querySelector('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}t.className='toast '+(type==='error'?'error':'success');t.textContent=msg;t.style.display='flex';toastTimer=setTimeout(()=>{t.style.display='none';},3200);}
function fmtMoney(n){return Number(n).toLocaleString('he-IL',{maximumFractionDigits:0});}
function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});}catch{return d;}}
function esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function sendSelectedReports(type){const ids=getSelectedReportIds();if(!ids.length)return;if(type==='print'){const rows=Array.from(document.querySelectorAll('.report-cb:checked')).map(c=>`<tr><td>${c.dataset.number}</td><td>${c.dataset.project}</td><td>${c.dataset.date}</td></tr>`).join('');const win=window.open('','_blank');win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>דוחות</title><style>body{font-family:Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}th{background:#1a3d5c;color:white;padding:10px}td{padding:9px;border-bottom:1px solid #ddd}</style></head><body><h1>דוחות נבחרים</h1><button onclick="window.print()" style="background:#1a3d5c;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px">🖨️ הדפס</button><table><thead><tr><th>מספר דוח</th><th>פרויקט</th><th>תאריך</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);win.document.close();}}

// ── REPORT SEND MODULE ────────────────────────────────────
let _sendMode='email';
function openReportSendModal(mode){_sendMode=mode;const ids=getSelectedReportIds();if(!ids.length)return;document.getElementById('send-modal-title').textContent=mode==='whatsapp'?'💬 שליחה ב-WhatsApp':'📧 שליחה בדוא״ל';document.getElementById('send-modal-btn-label').textContent=mode==='whatsapp'?'💬 שלח WhatsApp':'📧 שלח דוא״ל';const checked=Array.from(document.querySelectorAll('.report-cb:checked'));document.getElementById('send-modal-report-list').innerHTML=checked.map(c=>`<div>• דוח ${c.dataset.number} — ${c.dataset.project} (${c.dataset.date})</div>`).join('');const clist=document.getElementById('send-contractors-list');const isWA=mode==='whatsapp';clist.innerHTML=(allContractors||[]).filter(c=>c.is_active).map(c=>{const phone=c.mobile||'';const email=c.email||'';const hasContact=isWA?!!phone:!!email;const detail=isWA?(phone?'📱 '+phone:'—'):(email?'✉️ '+email:'—');return`<label style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:7px;cursor:pointer;${hasContact?'':'opacity:0.45;pointer-events:none;'}"><input type="checkbox" class="send-contractor-cb" data-id="${c.id}" data-phone="${phone}" data-email="${email}" style="width:15px;height:15px;cursor:pointer;" ${hasContact?'':'disabled'}><div style="flex:1"><div style="font-weight:700;font-size:13px">${esc(c.company_name)}</div><div style="font-size:11px;color:var(--text3)">${detail}</div></div></label>`;}).join('');['new-rcpt-name','new-rcpt-company','new-rcpt-phone','new-rcpt-email'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('new-rcpt-save').checked=false;document.getElementById('send-rcpt-message').value='';switchRcptTab('contractors');document.getElementById('modal-send-reports').style.display='flex';}
function switchRcptTab(tab){const isCont=tab==='contractors';document.getElementById('rcpt-panel-contractors').style.display=isCont?'block':'none';document.getElementById('rcpt-panel-new').style.display=isCont?'none':'block';}
async function executeSendReports(){const isWA=_sendMode==='whatsapp';const msg=document.getElementById('send-rcpt-message').value.trim();const checked=Array.from(document.querySelectorAll('.report-cb:checked'));const reportSummary=checked.map(c=>`דוח ${c.dataset.number} - ${c.dataset.project} (${c.dataset.date})`).join('\n');const fullMsg=(msg?msg+'\n\n':'')+reportSummary;const activeTab=document.getElementById('rcpt-panel-new').style.display==='block'?'new':'contractors';if(activeTab==='contractors'){const selected=Array.from(document.querySelectorAll('.send-contractor-cb:checked'));if(!selected.length){alert('יש לבחור לפחות קבלן אחד');return;}for(const cb of selected){if(isWA){const ph=cb.dataset.phone.replace(/[-\s]/g,'');const intl=ph.startsWith('0')?'972'+ph.slice(1):ph;(function(){var _a=document.createElement('a');_a.href=`https://wa.me/${intl}?text=${encodeURIComponent(fullMsg)}`;_a.target='_blank';_a.rel='noopener';document.body.appendChild(_a);_a.click();document.body.removeChild(_a);})();}else{window.location.href=`mailto:${cb.dataset.email}?subject=${encodeURIComponent('דוחות עבודה')}&body=${encodeURIComponent(fullMsg)}`;}};}else{const name=document.getElementById('new-rcpt-name').value.trim();const phone=document.getElementById('new-rcpt-phone').value.trim();const email=document.getElementById('new-rcpt-email').value.trim();if(!name){alert('יש להזין שם');return;}if(isWA&&!phone){alert('יש להזין טלפון');return;}if(!isWA&&!email){alert('יש להזין דוא״ל');return;}if(isWA){const intl=phone.replace(/[-\s]/g,'').replace(/^0/,'972');(function(){var _a=document.createElement('a');_a.href=`https://wa.me/${intl}?text=${encodeURIComponent(fullMsg)}`;_a.target='_blank';_a.rel='noopener';document.body.appendChild(_a);_a.click();document.body.removeChild(_a);})();}else{window.location.href=`mailto:${email}?subject=${encodeURIComponent('דוחות עבודה')}&body=${encodeURIComponent(fullMsg)}`;}}closeModal('modal-send-reports');clearReportSelection();}

// ── QUOTES MODULE ─────────────────────────────────────────
const QSTATUS_HE={draft:'טיוטה',sent:'נשלחה',approved:'אושרה',rejected:'נדחתה'};
const QSTATUS_CSS={draft:'qstatus-draft',sent:'qstatus-sent',approved:'qstatus-approved',rejected:'qstatus-rejected'};

async function loadQuotes(){
  const list=document.getElementById('quotes-list');
  list.innerHTML='<div class="quote-empty"><div class="empty-icon">⏳</div><h3>טוען...</h3></div>';
  const psel=document.getElementById('quotes-filter-project');
  psel.innerHTML='<option value="">כל הפרויקטים</option>'+(allProjects||[]).map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
  const nqsel=document.getElementById('nq-project');
  nqsel.innerHTML='<option value="">בחר פרויקט...</option>'+(allProjects||[]).map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');
  const{data:quotes,error}=await sb.from('quotes').select('*').order('created_at',{ascending:false});
  if(error){list.innerHTML='<div class="quote-empty"><div class="empty-icon">❌</div><h3>שגיאה בטעינה</h3></div>';return;}
  const{data:items}=await sb.from('quote_items').select('*').order('sort_order',{ascending:true});
  window._quotesAll=quotes||[];window._quoteItemsAll=items||[];
  await loadAllChangeOrders();
  renderQuotesList(window._quotesAll,window._quoteItemsAll);
}

function filterQuotes(){const proj=document.getElementById('quotes-filter-project').value;const status=document.getElementById('quotes-filter-status').value;const q=document.getElementById('quotes-search').value.toLowerCase();let filtered=(window._quotesAll||[]).filter(qt=>{const pn=(allProjects||[]).find(p=>p.id===qt.project_id)?.project_name||'';return(!proj||qt.project_id===proj)&&(!status||qt.status===status)&&(!q||(qt.title||'').toLowerCase().includes(q)||pn.toLowerCase().includes(q));});renderQuotesList(filtered,window._quoteItemsAll||[]);}

function renderQuotesList(quotes,allItems){const list=document.getElementById('quotes-list');if(!quotes.length){list.innerHTML='<div class="quote-empty"><div class="empty-icon">📋</div><h3>אין הצעות מחיר עדיין</h3></div>';return;}list.innerHTML=quotes.map(q=>renderQuoteCard(q,allItems.filter(i=>i.quote_id===q.id))).join('');quotes.forEach(q=>{const cos=(window._allCOs||[]).filter(c=>c.quote_id===q.id);const countEl=document.getElementById('co-count-'+q.id);const totalEl=document.getElementById('co-total-'+q.id);if(countEl)countEl.textContent=cos.length?cos.length+' פקודות':'אין פקודות';if(totalEl){const approved=cos.reduce((a,co)=>{return a+(window._allCOItems||[]).filter(i=>i.change_order_id===co.id&&i.approved).reduce((b,i)=>b+parseFloat(i.approved_amount||0),0);},0);if(cos.length)totalEl.textContent='₪'+fmtMoney(approved)+' מאושר';}});}

function renderQuoteCard(q,items){const proj=(allProjects||[]).find(p=>p.id===q.project_id);const projName=proj?esc(proj.project_name):'—';const total=items.reduce((a,i)=>a+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);const statusCss=QSTATUS_CSS[q.status]||'qstatus-draft';const statusHe=QSTATUS_HE[q.status]||q.status;const rows=items.map((item,idx)=>`<tr id="qrow-${item.id}"><td style="min-width:160px"><select onchange="qItemChange('${item.id}','contractor_id',this.value)" style="width:100%"><option value="">בחר קבלן...</option>${(allContractors||[]).map(c=>`<option value="${c.id}" ${item.contractor_id===c.id?'selected':''}>${esc(c.company_name)}</option>`).join('')}</select></td><td style="min-width:180px"><input type="text" value="${esc(item.description||'')}" placeholder="תיאור..." onchange="qItemChange('${item.id}','description',this.value)"></td><td style="min-width:100px"><input type="number" value="${item.unit_cost||''}" placeholder="0" oninput="qItemChange('${item.id}','unit_cost',this.value);updateQuoteTotal('${q.id}')"></td><td style="min-width:70px"><input type="number" value="${item.quantity||1}" placeholder="1" oninput="qItemChange('${item.id}','quantity',this.value);updateQuoteTotal('${q.id}')"></td><td style="min-width:110px;font-weight:700;color:#1a3d5c" id="qrow-total-${item.id}">₪${fmtMoney(parseFloat(item.unit_cost||0)*parseFloat(item.quantity||1))}</td><td style="min-width:110px"><input type="date" value="${item.start_date||''}" onchange="qItemChange('${item.id}','start_date',this.value)"></td><td style="min-width:110px"><input type="date" value="${item.end_date||''}" onchange="qItemChange('${item.id}','end_date',this.value)"></td><td style="min-width:150px"><input type="text" value="${esc(item.remarks||'')}" placeholder="הערות..." onchange="qItemChange('${item.id}','remarks',this.value)"></td><td style="text-align:center"><button onclick="deleteQuoteItem('${item.id}','${q.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td></tr>`).join('');
return`<div class="quote-card" id="qcard-${q.id}"><div class="quote-card-header" onclick="toggleQuoteCard('${q.id}')" id="qhdr-${q.id}"><div><div class="qh-title">${esc(q.title||'הצעה ללא כותרת')}</div><div class="qh-project">📁 ${projName}</div></div><span class="qh-status ${statusCss}">${statusHe}</span><div class="qh-total" id="qtotal-${q.id}">₪${fmtMoney(total)}</div><span class="qh-toggle">▼</span></div><div class="quote-card-body" id="qbody-${q.id}"><div style="overflow-x:auto"><table class="quote-items-table"><thead><tr><th>קבלן</th><th>תיאור</th><th>עלות יחידה</th><th>כמות</th><th>סה״כ</th><th>התחלה</th><th>סיום</th><th>הערות</th><th>🗑️</th></tr></thead><tbody id="qitems-${q.id}">${rows}</tbody><tfoot><tr class="quote-total-row"><td colspan="4" style="text-align:left;padding-right:16px">סה״כ</td><td id="qtfoot-${q.id}">₪${fmtMoney(total)}</td><td colspan="4"></td></tr></tfoot></table></div><div class="quote-card-footer"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-quote-add-item" onclick="addQuoteItem('${q.id}')">➕ הוסף שורה</button><select onchange="updateQuoteStatus('${q.id}',this.value)" style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;font-family:inherit;"><option value="draft" ${q.status==='draft'?'selected':''}>טיוטה</option><option value="sent" ${q.status==='sent'?'selected':''}>נשלחה</option><option value="approved" ${q.status==='approved'?'selected':''}>אושרה</option><option value="rejected" ${q.status==='rejected'?'selected':''}>נדחתה</option></select></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-co-new" onclick="openNewCOModal('${q.id}','${q.project_id}')">⚡ פקודת שינוי</button><button class="btn-po-new" onclick="openPOModal('${q.id}')">📋 הזמנת עבודה</button><button class="btn-quote-pdf" onclick="printQuote('${q.id}')">🖨️ הדפס</button><button class="btn-quote-delete" onclick="deleteQuote('${q.id}')">🗑️ מחק</button></div></div></div><div class="co-section" id="co-section-${q.id}"><div class="co-section-header" onclick="toggleCOSection('${q.id}')"><span class="co-title">⚡ שינויים ותוספות</span><span class="co-badge" id="co-count-${q.id}">טוען...</span><span class="co-total-badge" id="co-total-${q.id}"></span><span style="color:white;font-size:16px;" id="co-toggle-${q.id}">▼</span></div><div class="co-body" id="co-body-${q.id}"><div id="co-cards-${q.id}"><div style="padding:16px;color:#999;text-align:center">טוען...</div></div><div class="co-add-bar"><button class="btn-co-new" onclick="openNewCOModal('${q.id}','${q.project_id}')">➕ פקודת שינוי חדשה</button></div></div></div></div>`;}

function toggleQuoteCard(qid){const body=document.getElementById('qbody-'+qid);const hdr=document.getElementById('qhdr-'+qid);const isOpen=body.classList.contains('open');body.classList.toggle('open',!isOpen);hdr.classList.toggle('open',!isOpen);}
window._qPending={};
function qItemChange(itemId,field,value){if(!window._qPending[itemId])window._qPending[itemId]={};window._qPending[itemId][field]=value;const cached=(window._quoteItemsAll||[]).find(i=>i.id===itemId);if(cached)cached[field]=field==='unit_cost'||field==='quantity'?parseFloat(value)||0:value;clearTimeout(window._qPending[itemId]._timer);window._qPending[itemId]._timer=setTimeout(()=>saveQuoteItem(itemId),800);if(field==='unit_cost'||field==='quantity'){const item=(window._quoteItemsAll||[]).find(i=>i.id===itemId);if(item){const rowTotal=document.getElementById('qrow-total-'+itemId);if(rowTotal)rowTotal.textContent='₪'+fmtMoney(parseFloat(item.unit_cost||0)*parseFloat(item.quantity||1));}}}
async function saveQuoteItem(itemId){const changes={...window._qPending[itemId]};delete changes._timer;if(!Object.keys(changes).length)return;await sb.from('quote_items').update(changes).eq('id',itemId);delete window._qPending[itemId];}
function updateQuoteTotal(qid){const items=(window._quoteItemsAll||[]).filter(i=>i.quote_id===qid);const total=items.reduce((a,i)=>a+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);const el=document.getElementById('qtotal-'+qid);const ft=document.getElementById('qtfoot-'+qid);if(el)el.textContent='₪'+fmtMoney(total);if(ft)ft.textContent='₪'+fmtMoney(total);if(!window.quoteSum)window.quoteSum={};const q=(window._quotesAll||[]).find(x=>x.id===qid);if(q){window.quoteSum[q.project_id]=(window._quotesAll||[]).filter(x=>x.project_id===q.project_id).reduce((a,x)=>{const its=(window._quoteItemsAll||[]).filter(i=>i.quote_id===x.id);return a+its.reduce((b,i)=>b+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);},0);}}
async function addQuoteItem(qid){const maxOrder=Math.max(0,...(window._quoteItemsAll||[]).filter(i=>i.quote_id===qid).map(i=>i.sort_order||0));const{data:newItem,error}=await sb.from('quote_items').insert({quote_id:qid,description:'',unit_cost:0,quantity:1,sort_order:maxOrder+1}).select().single();if(error||!newItem)return;window._quoteItemsAll=[...(window._quoteItemsAll||[]),newItem];const q=(window._quotesAll||[]).find(x=>x.id===qid);const tbody=document.getElementById('qitems-'+qid);if(tbody){tbody.innerHTML=(window._quoteItemsAll||[]).filter(i=>i.quote_id===qid).map(item=>renderQuoteItemRow(item,q||{id:qid})).join('');}updateQuoteTotal(qid);}
function renderQuoteItemRow(item,q){return`<tr id="qrow-${item.id}"><td style="min-width:160px"><select onchange="qItemChange('${item.id}','contractor_id',this.value)" style="width:100%"><option value="">בחר קבלן...</option>${(allContractors||[]).map(c=>`<option value="${c.id}" ${item.contractor_id===c.id?'selected':''}>${esc(c.company_name)}</option>`).join('')}</select></td><td style="min-width:180px"><input type="text" value="${esc(item.description||'')}" placeholder="תיאור..." onchange="qItemChange('${item.id}','description',this.value)"></td><td style="min-width:100px"><input type="number" value="${item.unit_cost||''}" placeholder="0" oninput="qItemChange('${item.id}','unit_cost',this.value);updateQuoteTotal('${q.id}')"></td><td style="min-width:70px"><input type="number" value="${item.quantity||1}" placeholder="1" oninput="qItemChange('${item.id}','quantity',this.value);updateQuoteTotal('${q.id}')"></td><td style="min-width:110px;font-weight:700;color:#1a3d5c" id="qrow-total-${item.id}">₪${fmtMoney(parseFloat(item.unit_cost||0)*parseFloat(item.quantity||1))}</td><td style="min-width:110px"><input type="date" value="${item.start_date||''}" onchange="qItemChange('${item.id}','start_date',this.value)"></td><td style="min-width:110px"><input type="date" value="${item.end_date||''}" onchange="qItemChange('${item.id}','end_date',this.value)"></td><td style="min-width:150px"><input type="text" value="${esc(item.remarks||'')}" placeholder="הערות..." onchange="qItemChange('${item.id}','remarks',this.value)"></td><td style="text-align:center"><button onclick="deleteQuoteItem('${item.id}','${q.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td></tr>`;}
async function deleteQuoteItem(itemId,qid){if(!confirm('מחק שורה זו?'))return;await sb.from('quote_items').delete().eq('id',itemId);window._quoteItemsAll=(window._quoteItemsAll||[]).filter(i=>i.id!==itemId);const row=document.getElementById('qrow-'+itemId);if(row)row.remove();updateQuoteTotal(qid);}
async function updateQuoteStatus(qid,newStatus){await sb.from('quotes').update({status:newStatus}).eq('id',qid);const q=(window._quotesAll||[]).find(x=>x.id===qid);if(q)q.status=newStatus;}
async function deleteQuote(qid){if(!confirm('מחק הצעה זו לגמרי?'))return;await sb.from('quote_items').delete().eq('quote_id',qid);await sb.from('quotes').delete().eq('id',qid);window._quotesAll=(window._quotesAll||[]).filter(q=>q.id!==qid);window._quoteItemsAll=(window._quoteItemsAll||[]).filter(i=>i.quote_id!==qid);const card=document.getElementById('qcard-'+qid);if(card)card.remove();}
function openNewQuoteModal(){const nqsel=document.getElementById('nq-project');nqsel.innerHTML='<option value="">בחר פרויקט...</option>'+(allProjects||[]).map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');document.getElementById('nq-title').value='';document.getElementById('nq-status').value='draft';document.getElementById('modal-new-quote').style.display='flex';}
async function saveNewQuote(){const project_id=document.getElementById('nq-project').value;const title=document.getElementById('nq-title').value.trim();const status=document.getElementById('nq-status').value;if(!project_id){alert('יש לבחור פרויקט');return;}const{data:newQ,error}=await sb.from('quotes').insert({project_id,title:title||'הצעה חדשה',status}).select().single();if(error||!newQ){alert('שגיאה ביצירת הצעה');return;}window._quotesAll=[newQ,...(window._quotesAll||[])];closeModal('modal-new-quote');const list=document.getElementById('quotes-list');const emptyMsg=list.querySelector('.quote-empty');if(emptyMsg)list.innerHTML='';const div=document.createElement('div');div.innerHTML=renderQuoteCard(newQ,[]);list.prepend(div.firstElementChild);toggleQuoteCard(newQ.id);}
function printQuote(qid){const q=(window._quotesAll||[]).find(x=>x.id===qid);const items=(window._quoteItemsAll||[]).filter(i=>i.quote_id===qid);const proj=(allProjects||[]).find(p=>p.id===q?.project_id);const total=items.reduce((a,i)=>a+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);const rows=items.map((item,i)=>{const con=(allContractors||[]).find(c=>c.id===item.contractor_id);return`<tr style="background:${i%2?'#f9f9f9':'white'}"><td>${i+1}</td><td>${esc(con?.company_name||'—')}</td><td>${esc(item.description||'')}</td><td style="text-align:left">₪${fmtMoney(item.unit_cost||0)}</td><td style="text-align:center">${item.quantity||1}</td><td style="text-align:left;font-weight:700">₪${fmtMoney(parseFloat(item.unit_cost||0)*parseFloat(item.quantity||1))}</td></tr>`;}).join('');const win=window.open('','_blank');win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>הצעת מחיר</title><style>body{font-family:Arial;padding:30px;direction:rtl}table{width:100%;border-collapse:collapse}th{background:#1a3d5c;color:white;padding:9px}td{padding:8px;border-bottom:1px solid #ddd}.total-row{background:#eef5ff;font-weight:800}@media print{button{display:none}}</style></head><body><h1>📋 ${esc(q?.title||'הצעת מחיר')}</h1><div>פרויקט: ${esc(proj?.project_name||'—')} | ${new Date().toLocaleDateString('he-IL')}</div><button onclick="window.print()" style="background:#1a3d5c;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin:16px 0">🖨️ הדפס</button><table><thead><tr><th>#</th><th>קבלן</th><th>תיאור</th><th>עלות יחידה</th><th>כמות</th><th>סה״כ</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td colspan="5" style="text-align:right">סה״כ</td><td>₪${fmtMoney(total)}</td></tr></tfoot></table></body></html>`);win.document.close();}

// ── CHANGE ORDERS ─────────────────────────────────────────
window._allCOs=[];window._allCOItems=[];window._newCOquoteId=null;window._newCOprojectId=null;
const CO_STATUS_HE={open:'פתוח',negotiating:'במו"מ',approved:'אושר',rejected:'נדחה'};
const CO_STATUS_CSS={open:'costatus-open',negotiating:'costatus-negotiating',approved:'costatus-approved',rejected:'costatus-rejected'};

async function loadAllChangeOrders(){const{data:cos}=await sb.from('change_orders').select('*').order('created_at',{ascending:false});const{data:items}=await sb.from('change_order_items').select('*').order('sort_order',{ascending:true});window._allCOs=cos||[];window._allCOItems=items||[];rebuildCoApprovedSum();}
function rebuildCoApprovedSum(){window.coApprovedSum={};(window._allCOs||[]).forEach(co=>{const projId=co.project_id;if(!projId)return;const approved=(window._allCOItems||[]).filter(i=>i.change_order_id===co.id&&i.approved).reduce((a,i)=>a+parseFloat(i.approved_amount||0),0);window.coApprovedSum[projId]=(window.coApprovedSum[projId]||0)+approved;});}
function toggleCOSection(qid){const body=document.getElementById('co-body-'+qid);const toggle=document.getElementById('co-toggle-'+qid);const isOpen=body.classList.contains('open');if(!isOpen){body.classList.add('open');if(toggle)toggle.textContent='▲';renderCOCards(qid);}else{body.classList.remove('open');if(toggle)toggle.textContent='▼';}}
function renderCOCards(qid){const cos=window._allCOs.filter(c=>c.quote_id===qid);const countEl=document.getElementById('co-count-'+qid);const totalEl=document.getElementById('co-total-'+qid);const container=document.getElementById('co-cards-'+qid);if(!container)return;const totalApproved=cos.reduce((a,co)=>{return a+(window._allCOItems||[]).filter(i=>i.change_order_id===co.id&&i.approved).reduce((b,i)=>b+parseFloat(i.approved_amount||0),0);},0);if(countEl)countEl.textContent=cos.length+' פקודות';if(totalEl&&cos.length)totalEl.textContent='₪'+fmtMoney(totalApproved)+' מאושר';if(!cos.length){container.innerHTML='<div style="padding:20px;text-align:center;color:#9a6f00;">אין פקודות שינוי עדיין</div>';return;}container.innerHTML=cos.map(co=>renderCOCard(co,qid)).join('');}
function renderCOCard(co,qid){const items=window._allCOItems.filter(i=>i.change_order_id===co.id);const qItems=(window._quoteItemsAll||[]).filter(i=>i.quote_id===qid);const contr=(allContractors||[]).find(c=>c.id===co.contractor_id);const demand=items.reduce((a,i)=>a+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);const approved=items.reduce((a,i)=>i.approved?(a+parseFloat(i.approved_amount||0)):a,0);const origTotal=qItems.reduce((a,i)=>a+(parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1)),0);const finalPrice=origTotal+approved;const statusCss=CO_STATUS_CSS[co.status]||'costatus-open';const statusHe=CO_STATUS_HE[co.status]||co.status;return`<div class="co-card" id="cocard-${co.id}"><div class="co-card-hdr" onclick="toggleCOCard('${co.id}')"><div class="co-card-title">⚡ ${esc(co.title||'פקודת שינוי')}</div>${contr?`<span style="font-size:12px;color:#666;">👷 ${esc(contr.company_name)}</span>`:''}  <span class="co-status ${statusCss}">${statusHe}</span><span style="font-size:13px;font-weight:800;color:#c9860a;">₪${fmtMoney(demand)}</span><span style="font-size:13px;font-weight:800;color:#1e6b30;">₪${fmtMoney(approved)} מאושר</span><span style="font-size:14px;color:#888;" id="cotoggle-${co.id}">▼</span></div><div class="co-body" id="cobody-${co.id}"><div class="co-add-bar"><select onchange="updateCOStatus('${co.id}','${qid}',this.value)" style="padding:6px 10px;border:1.5px solid #f0d080;border-radius:7px;font-size:12px;font-family:inherit;background:#fffdf4;"><option value="open" ${co.status==='open'?'selected':''}>פתוח</option><option value="negotiating" ${co.status==='negotiating'?'selected':''}>במו"מ</option><option value="approved" ${co.status==='approved'?'selected':''}>אושר</option><option value="rejected" ${co.status==='rejected'?'selected':''}>נדחה</option></select><button class="btn-co-add" onclick="addCOItem('${co.id}','${qid}')">➕ הוסף דרישה</button><button onclick="deleteCO('${co.id}','${qid}')" style="background:#fee;color:#c00;border:1px solid #fcc;border-radius:7px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;">🗑️ מחק</button></div></div></div>`;}
function toggleCOCard(coid){const body=document.getElementById('cobody-'+coid);const toggle=document.getElementById('cotoggle-'+coid);const isOpen=body.classList.contains('open');body.classList.toggle('open',!isOpen);if(toggle)toggle.textContent=isOpen?'▼':'▲';}
function openNewCOModal(qid,projectId){window._newCOquoteId=qid;window._newCOprojectId=projectId;document.getElementById('co-title').value='';document.getElementById('co-contractor-notes').value='';document.getElementById('co-status').value='open';const sel=document.getElementById('co-contractor');sel.innerHTML='<option value="">בחר קבלן...</option>'+(allContractors||[]).filter(c=>c.is_active).map(c=>`<option value="${c.id}">${esc(c.company_name)}</option>`).join('');document.getElementById('modal-new-co').style.display='flex';}
async function saveNewCO(){const title=document.getElementById('co-title').value.trim();if(!title){alert('יש להזין כותרת');return;}const{data:co,error}=await sb.from('change_orders').insert({quote_id:window._newCOquoteId,project_id:window._newCOprojectId,contractor_id:document.getElementById('co-contractor').value||null,title,contractor_notes:document.getElementById('co-contractor-notes').value.trim(),status:document.getElementById('co-status').value}).select().single();if(error||!co){alert('שגיאה');return;}window._allCOs.unshift(co);closeModal('modal-new-co');const body=document.getElementById('co-body-'+co.quote_id);if(body&&!body.classList.contains('open'))toggleCOSection(co.quote_id);else renderCOCards(co.quote_id);}
window._coPending={};
function coItemChange(itemId,field,value){if(!window._coPending[itemId])window._coPending[itemId]={};window._coPending[itemId][field]=value;const cached=window._allCOItems.find(i=>i.id===itemId);if(cached)cached[field]=value;clearTimeout(window._coPending[itemId]._t);window._coPending[itemId]._t=setTimeout(async()=>{const ch={...window._coPending[itemId]};delete ch._t;if(Object.keys(ch).length)await sb.from('change_order_items').update(ch).eq('id',itemId);delete window._coPending[itemId];},800);}
async function coBeniApprove(itemId,coId,qid,checked){window._allCOItems.find(i=>i.id===itemId).approved=checked;await sb.from('change_order_items').update({approved:checked}).eq('id',itemId);rebuildCoApprovedSum();renderCOCards(qid);}
async function addCOItem(coId,qid){const maxOrd=Math.max(0,...window._allCOItems.filter(i=>i.change_order_id===coId).map(i=>i.sort_order||0));const{data:item,error}=await sb.from('change_order_items').insert({change_order_id:coId,description:'',unit_cost:0,quantity:1,sort_order:maxOrd+1}).select().single();if(error||!item)return;window._allCOItems.push(item);const co=window._allCOs.find(c=>c.id===coId);if(co)renderCOCards(co.quote_id);}
async function deleteCOItem(itemId,coId,qid){if(!confirm('מחק שורה זו?'))return;await sb.from('change_order_items').delete().eq('id',itemId);window._allCOItems=window._allCOItems.filter(i=>i.id!==itemId);const co=window._allCOs.find(c=>c.id===coId);if(co)renderCOCards(co.quote_id);}
async function updateCOStatus(coId,qid,status){await sb.from('change_orders').update({status}).eq('id',coId);const co=window._allCOs.find(c=>c.id===coId);if(co)co.status=status;}
async function deleteCO(coId,qid){if(!confirm('מחק פקודת שינוי זו?'))return;await sb.from('change_order_items').delete().eq('change_order_id',coId);await sb.from('change_orders').delete().eq('id',coId);window._allCOs=window._allCOs.filter(c=>c.id!==coId);window._allCOItems=window._allCOItems.filter(i=>i.change_order_id!==coId);renderCOCards(qid);}
function printCOReport(coId,qid){showToast('הדפסת דוח CO...');/* simplified - full version in original */}

// ── MOBILE HAMBURGER ──────────────────────────────────────
function toggleMobileSidebar(){const sidebar=document.querySelector('#crm-panel .sidebar');if(!sidebar)return;const isOpen=sidebar.classList.contains('mobile-open');sidebar.classList.toggle('mobile-open',!isOpen);const ov=document.getElementById('crm-overlay');if(ov)ov.style.display=isOpen?'none':'block';const btn=document.getElementById('btn-hamburger-fixed');if(btn)btn.textContent=isOpen?'☰':'✕';}
// Create overlay
(function(){const overlay=document.createElement('div');overlay.id='crm-overlay';overlay.style.cssText='display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:149;';overlay.onclick=toggleMobileSidebar;document.getElementById('crm-panel').appendChild(overlay);})();

// ── DIGITAL CLOCK ─────────────────────────────────────────
function updateSidebarClock(){const now=new Date();const h=String(now.getHours()).padStart(2,'0');const m=String(now.getMinutes()).padStart(2,'0');const s=String(now.getSeconds()).padStart(2,'0');const timeEl=document.getElementById('sidebar-clock-time');if(timeEl)timeEl.textContent=h+':'+m+':'+s;const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];const months=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];const dateStr='יום '+days[now.getDay()]+', '+now.getDate()+' '+months[now.getMonth()]+' '+now.getFullYear();const dateEl=document.getElementById('sidebar-clock-date');if(dateEl)dateEl.textContent=dateStr;}
updateSidebarClock();setInterval(updateSidebarClock,1000);

// ── FORECAST ──────────────────────────────────────────────
async function renderForecast(){
  window.showLoading&&window.showLoading(true);
  try{
    const _fqSum=window.quoteSum||{};const _coSum=window.coApprovedSum||{};
    const totalBudget=allProjects.reduce((s,p)=>s+(p.total_budget||0),0);
    const totalProfit=allProjects.reduce((s,p)=>s+((p.total_budget||0)-(_fqSum[p.id]||0)-(_coSum[p.id]||0)),0);
    const totalROI=totalBudget?((totalProfit/totalBudget)*100).toFixed(1):0;
    const cards=[{label:'סה"כ תקציב',value:fmtMoney(totalBudget),color:'#3b82f6',icon:'💰'},{label:'רווח צפוי כולל',value:fmtMoney(totalProfit),color:'#22c55e',icon:'📈'},{label:'ROI ממוצע',value:totalROI+'%',color:'#f59e0b',icon:'🎯'}];
    const summaryEl=document.getElementById('forecast-summary');
    if(summaryEl)summaryEl.innerHTML=cards.map(c=>`<div style="background:${c.color}18;border:1px solid ${c.color}30;border-radius:12px;padding:16px;text-align:center"><div style="font-size:24px;margin-bottom:6px">${c.icon}</div><div style="font-size:11px;color:#666;font-weight:700;margin-bottom:4px">${c.label}</div><div style="font-size:18px;font-weight:900;color:${c.color}">₪${c.value}</div></div>`).join('');
    const tbody=document.getElementById('forecast-tbody');
    if(tbody)tbody.innerHTML=allProjects.map(p=>{const prof=(p.total_budget||0)-(_fqSum[p.id]||0)-(_coSum[p.id]||0);const roi=(p.total_budget)?((prof/(p.total_budget||1))*100).toFixed(1):'—';const rc=Number(roi)>20?'#22c55e':Number(roi)>10?'#f59e0b':'#ef4444';return`<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:10px 12px;font-weight:700">${p.project_name}</td><td style="padding:10px 12px">₪${fmtMoney(p.total_budget||0)}</td><td style="padding:10px 12px;color:${prof>=0?'#22c55e':'#ef4444'};font-weight:700">₪${fmtMoney(prof)}</td><td style="padding:10px 12px;font-weight:900;color:${rc}">${roi}%</td><td style="padding:10px 12px">—</td><td style="padding:10px 12px">—</td><td style="padding:10px 12px"><span style="background:#22c55e20;color:#22c55e;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">${STATUS_HE[p.status]||p.status}</span></td></tr>`;}).join('');
    const sel=document.getElementById('forecast-project-sel');
    if(sel){sel.innerHTML=allProjects.map(p=>`<option value="${p.id}">${p.project_name}</option>`).join('');sel.onchange=function(){const p=allProjects.find(x=>x.id===this.value);document.getElementById('forecast-budget').value=p?.total_budget||'';document.getElementById('forecast-profit').value='';};if(sel.options.length)sel.dispatchEvent(new Event('change'));}
  }catch(e){console.error('renderForecast:',e);}
  finally{window.showLoading&&window.showLoading(false);}
}

async function saveForecast(){const sel=document.getElementById('forecast-project-sel');const id=sel&&sel.value;if(!id)return;const budget=parseFloat(document.getElementById('forecast-budget').value)||0;window.showLoading&&window.showLoading(true);const{error}=await sb.from('projects').update({total_budget:budget}).eq('id',id);window.showLoading&&window.showLoading(false);if(error){showToast('שגיאה: '+error.message);return;}showToast('תחזית עודכנה');await loadProjects();renderForecast();}

// ── GANTT ─────────────────────────────────────────────────
const GANTT_COLORS={planned:{bar:'#3b82f6',light:'#dbeafe',label:'מתוכנן'},active:{bar:'#22c55e',light:'#dcfce7',label:'בביצוע'},done:{bar:'#64748b',light:'#f1f5f9',label:'הושלם'},delayed:{bar:'#ef4444',light:'#fee2e2',label:'מאחר'},blocked:{bar:'#f97316',light:'#ffedd5',label:'חסום'}};
const CONTRACTOR_PALETTE=['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f43f5e','#14b8a6'];
let ganttTasks=[],ganttView='combined',ganttProjectFilter='',ganttContractorFilter='',ganttScale='month';

async function loadGantt(){
  window.showLoading&&window.showLoading(true);
  try{const{data,error}=await sb.from('gantt_tasks').select('*,projects(project_name),contractors_master(company_name,contact_name)').order('start_date',{ascending:true});if(error)throw error;ganttTasks=data||[];populateGanttFilters();renderGantt();}
  catch(e){showToast('שגיאה בגאנט: '+e.message);}
  finally{window.showLoading&&window.showLoading(false);}
}

function populateGanttFilters(){
  const projSel=document.getElementById('gantt-project-filter');
  if(projSel){const projects=[...new Map(ganttTasks.filter(t=>t.projects).map(t=>[t.project_id,t.projects.project_name])).entries()];projSel.innerHTML='<option value="">כל הפרויקטים</option>'+projects.map(([id,name])=>`<option value="${id}">${name}</option>`).join('');}
  const modalProj=document.getElementById('gtask-project');
  if(modalProj&&allProjects&&allProjects.length){modalProj.innerHTML=allProjects.map(p=>`<option value="${p.id}">${p.project_name}</option>`).join('');}
}

function setGanttView(view){ganttView=view;const ctFilter=document.getElementById('gantt-contractor-filter');if(ctFilter)ctFilter.style.display=view==='individual'?'':'none';renderGantt();}

function renderGantt(){
  ganttProjectFilter=document.getElementById('gantt-project-filter')?.value||'';
  ganttScale=document.getElementById('gantt-scale')?.value||'month';
  let tasks=ganttTasks;
  if(ganttProjectFilter)tasks=tasks.filter(t=>t.project_id===ganttProjectFilter);
  const rowsEl=document.getElementById('gantt-rows');
  const emptyEl=document.getElementById('gantt-empty');
  const headerEl=document.getElementById('gantt-timeline-header');
  if(!rowsEl)return;
  if(!tasks.length){rowsEl.innerHTML='';if(emptyEl)emptyEl.style.display='block';if(headerEl)headerEl.innerHTML='';return;}
  if(emptyEl)emptyEl.style.display='none';
  const allDates=tasks.flatMap(t=>[new Date(t.start_date),new Date(t.end_date)]);
  let minDate=new Date(Math.min(...allDates));let maxDate=new Date(Math.max(...allDates));
  minDate.setDate(minDate.getDate()-3);maxDate.setDate(maxDate.getDate()+7);
  const totalDays=Math.ceil((maxDate-minDate)/86400000);
  const today=new Date();
  if(headerEl)headerEl.innerHTML=buildTimelineHeader(minDate,maxDate,totalDays);
  buildGanttLegend(tasks);
  const ctColors=buildContractorColorMap(tasks);
  const todayOff=Math.ceil((today-minDate)/86400000);
  const todayPct=Math.min(100,Math.max(0,todayOff/totalDays*100));
  let html='';
  tasks.forEach(t=>{
    const sc=GANTT_COLORS[t.status]||GANTT_COLORS.planned;
    const ctName=t.contractors_master?.company_name||'ללא קבלן';
    const ctColor=ctColors[t.contractor_id]||'#667eea';
    const startOff=Math.max(0,Math.ceil((new Date(t.start_date)-minDate)/86400000));
    const endOff=Math.min(totalDays,Math.ceil((new Date(t.end_date)-minDate)/86400000));
    const leftPct=(startOff/totalDays*100).toFixed(2);
    const widthPct=Math.max(0.5,((endOff-startOff)/totalDays*100)).toFixed(2);
    const progress=Math.min(100,Math.max(0,t.progress||0));
    html+=`<div style="display:grid;grid-template-columns:220px 1fr;border-bottom:1px solid #f5f5f5"><div style="padding:8px 12px;border-left:2px solid #e1e8ed;display:flex;flex-direction:column;justify-content:center;gap:2px"><div style="font-size:12px;font-weight:700;color:#1a3d5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.task_name}</div><div style="font-size:10px;color:#888">${ctName}</div></div><div style="position:relative;height:44px;cursor:pointer" onclick="editGanttTask('${t.id}')"><div style="position:absolute;left:${todayPct.toFixed(2)}%;top:0;height:100%;border-left:2px dashed #ef444466;z-index:5;pointer-events:none"></div><div style="position:absolute;left:${leftPct}%;width:${widthPct}%;top:10px;height:24px;background:${sc.light};border:1px solid ${sc.bar}40;border-radius:6px;overflow:hidden;z-index:6"><div style="height:100%;width:${progress}%;background:${ctColor};opacity:0.7;border-radius:6px;"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px">${t.task_name} ${progress>0?'('+progress+'%)':''}</div></div></div></div>`;
  });
  rowsEl.innerHTML=html;
}

function buildTimelineHeader(minDate,maxDate,totalDays){const today=new Date();let html='<div style="position:relative;height:40px;min-width:100%">';let current=new Date(minDate.getFullYear(),minDate.getMonth(),1);while(current<=maxDate){const dayOffset=Math.max(0,Math.ceil((current-minDate)/86400000));const pct=(dayOffset/totalDays*100).toFixed(2);const monthName=current.toLocaleDateString('he-IL',{month:'short',year:'2-digit'});html+=`<div style="position:absolute;left:${pct}%;top:0;height:100%;font-size:11px;color:#666;font-weight:700;padding-top:6px;border-left:2px solid #e1e8ed;padding-right:6px;white-space:nowrap">${monthName}</div>`;current.setMonth(current.getMonth()+1);}const todayOffset=Math.ceil((today-minDate)/86400000);if(todayOffset>=0&&todayOffset<=totalDays){const pct=(todayOffset/totalDays*100).toFixed(2);html+=`<div style="position:absolute;left:${pct}%;top:0;height:100%;border-left:2px dashed #ef4444;z-index:10"></div>`;}html+='</div>';return html;}
function buildGanttLegend(tasks){const legendEl=document.getElementById('gantt-legend');if(!legendEl)return;const statusItems=Object.entries(GANTT_COLORS).map(([k,v])=>`<span style="display:inline-flex;align-items:center;gap:5px;background:${v.light};border:1px solid ${v.bar}40;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:${v.bar}"><span style="width:10px;height:10px;background:${v.bar};border-radius:50%"></span>${v.label}</span>`).join('');legendEl.innerHTML=statusItems;}
function buildContractorColorMap(tasks){const ids=[...new Set(tasks.map(t=>t.contractor_id).filter(Boolean))];const map={};ids.forEach((id,i)=>{map[id]=CONTRACTOR_PALETTE[i%CONTRACTOR_PALETTE.length];});return map;}

function openAddTaskModal(){document.getElementById('gantt-task-id').value='';document.getElementById('gtask-name').value='';document.getElementById('gtask-start').value=new Date().toISOString().split('T')[0];document.getElementById('gtask-end').value='';document.getElementById('gtask-status').value='planned';document.getElementById('gtask-progress').value='0';document.getElementById('gtask-notes').value='';document.getElementById('gantt-modal-title').textContent='➕ הוסף משימה';document.getElementById('gantt-delete-btn').style.display='none';populateGanttFilters();document.getElementById('gantt-modal').style.display='flex';}
function editGanttTask(id){const t=ganttTasks.find(x=>x.id===id);if(!t)return;document.getElementById('gantt-task-id').value=id;document.getElementById('gtask-name').value=t.task_name||'';document.getElementById('gtask-start').value=t.start_date||'';document.getElementById('gtask-end').value=t.end_date||'';document.getElementById('gtask-status').value=t.status||'planned';document.getElementById('gtask-progress').value=t.progress||0;document.getElementById('gtask-notes').value=t.notes||'';document.getElementById('gantt-modal-title').textContent='✏️ ערוך משימה';document.getElementById('gantt-delete-btn').style.display='';populateGanttFilters();const projSel=document.getElementById('gtask-project');if(projSel){projSel.value=t.project_id||'';updateGanttContractors();}setTimeout(()=>{const ctSel=document.getElementById('gtask-contractor');if(ctSel)ctSel.value=t.contractor_id||'';},100);document.getElementById('gantt-modal').style.display='flex';}
function closeGanttModal(){document.getElementById('gantt-modal').style.display='none';}
async function saveGanttTask(){const id=document.getElementById('gantt-task-id').value;const data={task_name:document.getElementById('gtask-name').value.trim(),project_id:document.getElementById('gtask-project').value||null,contractor_id:document.getElementById('gtask-contractor').value||null,start_date:document.getElementById('gtask-start').value,end_date:document.getElementById('gtask-end').value,status:document.getElementById('gtask-status').value,progress:parseInt(document.getElementById('gtask-progress').value)||0,notes:document.getElementById('gtask-notes').value};if(!data.task_name||!data.start_date||!data.end_date){alert('נא למלא שם, תחילה וסיום');return;}window.showLoading&&window.showLoading(true);try{let error;if(id){({error}=await sb.from('gantt_tasks').update(data).eq('id',id));}else{({error}=await sb.from('gantt_tasks').insert(data));}if(error)throw error;closeGanttModal();await loadGantt();showToast(id?'✅ משימה עודכנה':'✅ משימה נוספה');}catch(e){showToast('שגיאה: '+e.message);}finally{window.showLoading&&window.showLoading(false);}}
async function deleteGanttTask(){const id=document.getElementById('gantt-task-id').value;if(!id||!confirm('למחוק משימה זו?'))return;window.showLoading&&window.showLoading(true);await sb.from('gantt_tasks').delete().eq('id',id);window.showLoading&&window.showLoading(false);closeGanttModal();await loadGantt();showToast('🗑️ משימה נמחקה');}
async function updateGanttContractors(){const sel=document.getElementById('gtask-contractor');if(!sel)return;sel.innerHTML='<option value="">ללא קבלן ספציפי</option>'+(allContractors||[]).filter(c=>c.is_active).map(c=>`<option value="${c.id}">${esc(c.company_name)}</option>`).join('');}

// ── GANTT IMPORT FROM QUOTE ───────────────────────────────
function openImportFromQuoteModal(){const psel=document.getElementById('iq-project');psel.innerHTML='<option value="">— בחר פרויקט —</option>'+(allProjects||[]).map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');document.getElementById('iq-quote-row').style.display='none';document.getElementById('iq-items-wrap').style.display='none';document.getElementById('iq-no-dates').style.display='none';document.getElementById('iq-quote').innerHTML='<option value="">— בחר הצעה —</option>';document.getElementById('btn-do-import').disabled=true;document.getElementById('modal-import-quote').style.display='flex';}
async function loadQuotesForImport(){const pid=document.getElementById('iq-project').value;document.getElementById('iq-quote-row').style.display='none';document.getElementById('iq-items-wrap').style.display='none';document.getElementById('iq-no-dates').style.display='none';document.getElementById('btn-do-import').disabled=true;if(!pid)return;const{data:quotes}=await sb.from('quotes').select('id,title,status').eq('project_id',pid).order('created_at',{ascending:false});const qsel=document.getElementById('iq-quote');qsel.innerHTML='<option value="">— בחר הצעה —</option>'+(quotes||[]).map(q=>`<option value="${q.id}">${esc(q.title||'הצעה')} [${q.status||''}]</option>`).join('');document.getElementById('iq-quote-row').style.display='block';}
async function loadItemsForImport(){const qid=document.getElementById('iq-quote').value;document.getElementById('iq-items-wrap').style.display='none';document.getElementById('iq-no-dates').style.display='none';document.getElementById('btn-do-import').disabled=true;if(!qid)return;const{data:items}=await sb.from('quote_items').select('*').eq('quote_id',qid).order('sort_order',{ascending:true});const withDates=(items||[]).filter(i=>i.start_date&&i.end_date);if(!withDates.length){document.getElementById('iq-no-dates').style.display='block';return;}const pid=document.getElementById('iq-project').value;const listEl=document.getElementById('iq-items-list');listEl.innerHTML=withDates.map((item,idx)=>{const contr=(allContractors||[]).find(c=>c.id===item.contractor_id);const days=Math.ceil((new Date(item.end_date)-new Date(item.start_date))/86400000);return`<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid #fde68a;cursor:pointer;"><input type="checkbox" class="iq-item-cb" value="${item.id}" data-desc="${esc(item.description||'סעיף '+(idx+1))}" data-start="${item.start_date}" data-end="${item.end_date}" data-contractor="${item.contractor_id||''}" data-project="${pid}" checked style="margin-top:3px;width:16px;height:16px;"><div style="flex:1;"><div style="font-weight:700;font-size:13px;">${esc(item.description||'סעיף '+(idx+1))}</div><div style="font-size:11px;color:#888;margin-top:2px;">📅 ${item.start_date} → ${item.end_date} (${days} ימים)${contr?' | 👷 '+esc(contr.company_name):''}</div></div></label>`;}).join('');document.getElementById('iq-items-wrap').style.display='block';document.getElementById('btn-do-import').disabled=false;}
async function executeImportFromQuote(){const checked=[...document.querySelectorAll('.iq-item-cb:checked')];if(!checked.length)return;let imported=0,skipped=0;for(const cb of checked){const exists=ganttTasks.some(t=>t.task_name===cb.dataset.desc&&t.project_id===cb.dataset.project&&t.start_date===cb.dataset.start&&t.end_date===cb.dataset.end);if(exists){skipped++;continue;}const{data,error}=await sb.from('gantt_tasks').insert({task_name:cb.dataset.desc,project_id:cb.dataset.project,contractor_id:cb.dataset.contractor||null,start_date:cb.dataset.start,end_date:cb.dataset.end,progress:0,notes:'יובא מהצעת מחיר'}).select().single();if(!error&&data){ganttTasks.push(data);imported++;}}closeModal('modal-import-quote');renderGantt();showToast(`✅ יובאו ${imported} משימות`+(skipped?` (${skipped} כבר קיימות)`:''),(imported?'success':'error'));}

// ── PURCHASE ORDERS ───────────────────────────────────────
let _poSignaturePad=null,_poCurrentQuoteId=null,_poCurrentQuoteData=null;
let allPOs=[];

async function openPOModal(quoteId){_poCurrentQuoteId=quoteId;const q=(window._quotesAll||[]).find(x=>x.id===quoteId);if(!q){showToast('לא נמצאה הצעת מחיר','error');return;}const items=(window._quoteItemsAll||[]).filter(i=>i.quote_id===quoteId);const proj=(allProjects||[]).find(p=>p.id===q.project_id);const contr=items.length?(allContractors||[]).find(c=>c.id===items[0].contractor_id):null;_poCurrentQuoteData={q,items,proj,contr};const poNum=await generatePONumber();document.getElementById('po-number').value=poNum;document.getElementById('po-date').valueAsDate=new Date();document.getElementById('po-start-date').value='';document.getElementById('po-end-date').value='';document.getElementById('po-remarks').value='';const contrName=contr?contr.company_name:(q.contractor_name||'הקבלן');document.getElementById('po-banner-title').textContent=`📁 ${proj?.project_name||'—'}  |  👷 ${contrName}`;document.getElementById('po-banner-details').textContent=`הצעה: "${q.title||'ללא כותרת'}" | ${items.length} סעיפים`;renderPOItemsPreview(items);document.getElementById('modal-po').style.display='flex';setTimeout(()=>initPOSignaturePad(),120);}
async function generatePONumber(){try{const{count}=await sb.from('purchase_orders').select('*',{count:'exact',head:true});const next=(count||0)+1;const year=new Date().getFullYear();return`PO-${year}-${String(next).padStart(4,'0')}`;}catch(e){return'PO-'+Date.now().toString().slice(-6);}}
function renderPOItemsPreview(items){const tbody=document.getElementById('po-items-preview');const tfoot=document.getElementById('po-totals-preview');const subtotal=items.reduce((a,i)=>a+parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1),0);const vat=subtotal*0.18;const grand=subtotal+vat;tbody.innerHTML=items.map((item,idx)=>`<tr style="background:${idx%2===0?'#fff':'#f9fafb'}"><td style="padding:7px 10px">${esc(item.description||'—')}</td><td style="padding:7px 10px;text-align:center">${item.quantity||1}</td><td style="padding:7px 10px;text-align:left">₪${fmtMoney(parseFloat(item.unit_cost||0))}</td><td style="padding:7px 10px;text-align:left;font-weight:700">₪${fmtMoney(parseFloat(item.unit_cost||0)*parseFloat(item.quantity||1))}</td></tr>`).join('');tfoot.innerHTML=`<tr><td colspan="3" style="padding:7px 10px;font-weight:700;text-align:right">לפני מע״מ</td><td style="padding:7px 10px;font-weight:700;text-align:left">₪${fmtMoney(subtotal)}</td></tr><tr><td colspan="3" style="padding:7px 10px;color:#666;text-align:right">מע״מ 18%</td><td style="padding:7px 10px;color:#666;text-align:left">₪${fmtMoney(vat)}</td></tr><tr style="background:#1a3d5c"><td colspan="3" style="padding:9px 10px;font-weight:900;color:white;text-align:right">סה״כ כולל מע״מ</td><td style="padding:9px 10px;font-weight:900;color:white;text-align:left;font-size:15px">₪${fmtMoney(grand)}</td></tr>`;}
function initPOSignaturePad(){const canvas=document.getElementById('po-signature-canvas');if(!canvas||canvas._poInited)return;canvas._poInited=true;const ctx=canvas.getContext('2d');canvas.width=canvas.offsetWidth||500;canvas.height=90;let drawing=false,lx=0,ly=0;const getPos=e=>{const r=canvas.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)*(canvas.width/r.width),y:(t.clientY-r.top)*(canvas.height/r.height)};};canvas.addEventListener('mousedown',e=>{drawing=true;const p=getPos(e);lx=p.x;ly=p.y;});canvas.addEventListener('mousemove',e=>{if(!drawing)return;const p=getPos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.strokeStyle='#1a3d5c';ctx.lineWidth=2;ctx.stroke();lx=p.x;ly=p.y;});canvas.addEventListener('mouseup',()=>{drawing=false;});canvas.addEventListener('mouseout',()=>{drawing=false;});canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=getPos(e);lx=p.x;ly=p.y;},{passive:false});canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const p=getPos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.strokeStyle='#1a3d5c';ctx.lineWidth=2;ctx.stroke();lx=p.x;ly=p.y;},{passive:false});canvas.addEventListener('touchend',()=>{drawing=false;});_poSignaturePad=canvas;}
function clearPOSignature(){if(!_poSignaturePad)return;_poSignaturePad.getContext('2d').clearRect(0,0,_poSignaturePad.width,_poSignaturePad.height);}
async function savePurchaseOrder(){const poNum=document.getElementById('po-number').value;const poDate=document.getElementById('po-date').value;const startD=document.getElementById('po-start-date').value;const endD=document.getElementById('po-end-date').value;const remarks=document.getElementById('po-remarks').value.trim();if(!poDate||!startD||!endD){showToast('נא למלא תאריכים','error');return;}const{q,items,proj,contr}=_poCurrentQuoteData;const subtotal=items.reduce((a,i)=>a+parseFloat(i.unit_cost||0)*parseFloat(i.quantity||1),0);const vat=subtotal*0.18;const grand=subtotal+vat;let sigData=null;if(_poSignaturePad){const blank=document.createElement('canvas');blank.width=_poSignaturePad.width;blank.height=_poSignaturePad.height;const isSigned=_poSignaturePad.toDataURL()!==blank.toDataURL();if(isSigned)sigData=_poSignaturePad.toDataURL('image/png');}window.showLoading&&window.showLoading(true);try{const payload={po_number:poNum,quote_id:q.id,project_id:q.project_id,contractor_id:contr?.id||null,contractor_name:contr?.company_name||'',contractor_email:contr?.email||'',project_name:proj?.project_name||'',quote_title:q.title||'',po_date:poDate,start_date:startD,end_date:endD,subtotal,vat_amount:vat,grand_total:grand,remarks,signature_data:sigData,status:'active',items_json:JSON.stringify(items)};const{data:savedPO,error}=await sb.from('purchase_orders').insert(payload).select().single();if(error)throw error;await sb.from('gantt_tasks').insert({task_name:`🏷️ ${poNum} — ${contr?.company_name||'קבלן'}`,project_id:q.project_id,contractor_id:contr?.id||null,start_date:startD,end_date:endD,progress:0,notes:`הזמנת עבודה ${poNum} | ₪${fmtMoney(grand)} כולל מע״מ`});closeModal('modal-po');showToast(`✅ הזמנת עבודה ${poNum} נשמרה`,'success');setTimeout(()=>generatePOPdf({...payload,id:savedPO.id,items_json:payload.items_json}),400);}catch(e){showToast('שגיאה: '+e.message,'error');}finally{window.showLoading&&window.showLoading(false);}}
async function loadPurchaseOrders(){const tbody=document.getElementById('po-tbody');if(!tbody)return;tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:20px;color:#888;">⏳ טוען...</td></tr>';const{data,error}=await sb.from('purchase_orders').select('*').order('created_at',{ascending:false});if(error){tbody.innerHTML=`<tr><td colspan="10" style="color:#c00;padding:12px;">${error.message}</td></tr>`;return;}allPOs=data||[];const badge=document.getElementById('badge-po');if(badge)badge.textContent=allPOs.length;const pf=document.getElementById('po-filter-project');if(pf){const projects=[...new Set(allPOs.map(p=>p.project_name).filter(Boolean))].sort();pf.innerHTML='<option value="">כל הפרויקטים</option>'+projects.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');}renderPOList(allPOs);renderPOStats(allPOs);}
function renderPOStats(list){const total=list.length;const sentWA=list.filter(p=>p.sent_whatsapp).length;const sentEmail=list.filter(p=>p.sent_email).length;const grand=list.reduce((a,p)=>a+parseFloat(p.grand_total||0),0);const el=id=>document.getElementById(id);if(el('po-stat-total'))el('po-stat-total').textContent=total;if(el('po-stat-sent-wa'))el('po-stat-sent-wa').textContent=sentWA;if(el('po-stat-sent-email'))el('po-stat-sent-email').textContent=sentEmail;if(el('po-stat-grand'))el('po-stat-grand').textContent='₪'+fmtMoney(grand);}
function filterPOs(){const q=(document.getElementById('po-search')?.value||'').toLowerCase();const proj=document.getElementById('po-filter-project')?.value||'';const stat=document.getElementById('po-filter-status')?.value||'';renderPOList(allPOs.filter(p=>{const txt=(p.po_number+' '+p.contractor_name+' '+p.project_name).toLowerCase();return(!q||txt.includes(q))&&(!proj||p.project_name===proj)&&(!stat||p.status===stat);}));}
function renderPOList(list){const tbody=document.getElementById('po-tbody');if(!tbody)return;if(!list.length){tbody.innerHTML='<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">🏷️</div><h3>אין הזמנות</h3></div></td></tr>';return;}tbody.innerHTML=list.map(po=>{const grand=parseFloat(po.grand_total||0);const waStamp=po.sent_whatsapp?`<span style="background:#25D366;color:white;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700;">💬 WA</span>`:'<span style="color:#ccc;font-size:11px;">—</span>';const emailStamp=po.sent_email?`<span style="background:#4285f4;color:white;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700;">📧</span>`:'<span style="color:#ccc;font-size:11px;">—</span>';const anySent=po.sent_whatsapp||po.sent_email||po.sent_hard_copy;const stamp=anySent?`<div style="border:2px solid #1a3d5c;border-radius:6px;padding:3px 8px;transform:rotate(-3deg);font-size:9px;font-weight:900;color:#1a3d5c;display:inline-block;">✅ נשלח</div>`:`<div style="color:#f59e0b;font-size:11px;font-weight:700;">⏳ טרם נשלח</div>`;return`<tr><td style="font-family:monospace;font-weight:700;color:#1a3d5c;font-size:12px;">${esc(po.po_number||'—')}</td><td><strong>${esc(po.contractor_name||'—')}</strong></td><td>${esc(po.project_name||'—')}</td><td style="font-size:12px;color:#666;">${po.po_date?fmtDate(po.po_date):'—'}</td><td style="font-size:12px;color:#1e6b30;font-weight:700;">${po.start_date?fmtDate(po.start_date):'—'}</td><td style="font-size:12px;color:#b52a1d;font-weight:700;">${po.end_date?fmtDate(po.end_date):'—'}</td><td style="font-weight:800;color:#1a3d5c;">₪${fmtMoney(grand)}</td><td style="text-align:center;"><div style="display:flex;flex-direction:column;gap:3px;align-items:center;">${waStamp}${emailStamp}</div></td><td style="text-align:center;">${stamp}</td><td class="td-actions"><div class="btn-group" style="gap:4px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px;color:#1a3d5c;border-color:#1a3d5c;" onclick="generatePOPdf(allPOs.find(x=>x.id==='${po.id}'))" title="הפק PDF הזמנה">📄 PDF</button><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px;color:#1e6b30;border-color:#1e6b30;" onclick="downloadMockupXLS()" title="הורד מוק-אפ XLS">📊 מוק-אפ</button><button class="btn btn-ghost btn-sm btn-icon" onclick="deletePO('${po.id}')" title="מחק">🗑️</button></div></td></tr>`;}).join('');}
function exportPOsCSV(){const today=new Date().toLocaleDateString('he-IL').replace(/\//g,'-');downloadCSV([['מס׳ הזמנה','קבלן','פרויקט','תאריך','תחילה','סיום','סה״כ','סטטוס'],...allPOs.map(p=>[p.po_number||'',p.contractor_name||'',p.project_name||'',p.po_date||'',p.start_date||'',p.end_date||'',p.grand_total||0,p.status||''])],'הזמנות_עבודה_'+today+'.csv');showToast('📥 ייוצאו '+allPOs.length+' הזמנות','success');}
async function deletePO(poId){if(!confirm('למחוק הזמנת עבודה זו?'))return;const{error}=await sb.from('purchase_orders').delete().eq('id',poId);if(error){showToast('שגיאה: '+error.message,'error');return;}showToast('🗑️ הזמנה נמחקה','success');await loadPurchaseOrders();}

// ── SITE PULSE WIDGET ─────────────────────────────────────
// (SUPABASE_URL_CONST and SUPABASE_ANON_KEY_CONST are defined at top of script)

async function loadSiteReports() {
  var list  = document.getElementById('sp-reports-list');
  var badge = document.getElementById('sp-badge');
  if (!list) return;
  list.innerHTML = '<div class="sp-empty">Loading reports...</div>';
  try {
    var res = await fetch(
      SUPABASE_URL_CONST + '/rest/v1/site_reports?status=eq.pending&order=submitted_at.desc&limit=30',
      { headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var reports = await res.json();

    if (!reports || !reports.length) {
      list.innerHTML = '<div class="sp-empty">✅ No pending reports</div>';
      if (badge) badge.style.display = 'none';
      return;
    }

    if (badge) { badge.textContent = reports.length; badge.style.display = 'inline'; }

    list.innerHTML = '';
    reports.forEach(function(r) {
      var card = document.createElement('div');
      card.className = 'sp-report-card';
      card.id = 'spr-' + r.id;
      _spReportCache[r.id] = r;

      // Parse workers
      var workers = [];
      try { workers = typeof r.workers === 'string' ? JSON.parse(r.workers) : (r.workers || []); } catch(e){}
      var totalWorkers = workers.reduce(function(s,w){ return s+(w.count||1); }, 0);
      var workerSummary = workers.map(function(w){ return (w.count||1)+'x '+w.role; }).join(', ');

      // Parse photos
      var photos = [];
      try { photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []); } catch(e){}

      // Rating stars
      var stars = r.day_rating > 0 ? '⭐'.repeat(r.day_rating) : '';

      // Date
      var dateStr = r.report_date ? new Date(r.report_date+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

      // Build card HTML using DOM
      card.innerHTML = [
        '<div class="sp-report-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">',
          '<div>',
            '<div style="font-size:14px;font-weight:900;color:var(--text);">' + esc(r.contractor_name||'Unknown Contractor') + '</div>',
            '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' +
              (r.project_name ? '📁 ' + esc(r.project_name) + ' · ' : '') +
              dateStr + (r.weather ? ' · ' + r.weather : '') +
            '</div>',
          '</div>',
          '<div style="text-align:left;">',
            stars ? '<div style="font-size:13px;">' + stars + '</div>' : '',
            '<div style="font-size:10px;color:var(--text3);">by ' + esc(r.submitted_by||'') + '</div>',
          '</div>',
        '</div>',

        // Workers
        '<div style="background:rgba(59,130,246,0.08);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
          '<div style="font-size:11px;font-weight:800;color:#3b82f6;margin-bottom:3px;">👷 WORKERS (' + totalWorkers + ')</div>',
          '<div style="font-size:12px;color:var(--text2);">' + esc(workerSummary || 'Not specified') + '</div>',
        '</div>',

        // Activities
        '<div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
          '<div style="font-size:11px;font-weight:800;color:#16a34a;margin-bottom:3px;">🔨 WORK COMPLETED</div>',
          '<div style="font-size:12px;color:var(--text2);line-height:1.6;white-space:pre-wrap;">' + esc(r.activities||'—') + '</div>',
        '</div>',

        // Tools (if any)
        r.tools_equipment ? [
          '<div style="background:rgba(245,158,11,0.08);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
            '<div style="font-size:11px;font-weight:800;color:#d97706;margin-bottom:3px;">🔧 TOOLS & EQUIPMENT</div>',
            '<div style="font-size:12px;color:var(--text2);">' + esc(r.tools_equipment) + '</div>',
          '</div>'
        ].join('') : '',

        // Issues (highlighted if present)
        r.issues ? [
          '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px 10px;margin-bottom:8px;">',
            '<div style="font-size:11px;font-weight:800;color:#dc2626;margin-bottom:3px;">⚠️ ISSUES / PROBLEMS</div>',
            '<div style="font-size:12px;color:#dc2626;">' + esc(r.issues) + '</div>',
          '</div>'
        ].join('') : '',

        // Remarks
        r.remarks ? [
          '<div style="font-size:12px;color:var(--text2);padding:6px 0;border-top:1px solid var(--border);margin-bottom:8px;">',
            '<span style="font-weight:700;">📝 Notes: </span>' + esc(r.remarks),
          '</div>'
        ].join('') : '',

        // Photos thumbnails
        photos.length ? [
          '<div style="margin-bottom:10px;">',
            '<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:6px;">📸 PHOTOS (' + photos.length + ')</div>',
            '<div style="display:flex;gap:6px;overflow-x:auto;">',
              photos.slice(0,5).map(function(path) {
                var url = SUPABASE_URL_CONST + '/storage/v1/object/public/photos/' + path;
                return '<img src="' + url + '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;" onclick="window.open(\'' + url + '\',\'_blank\')">';
              }).join(''),
            '</div>',
          '</div>'
        ].join('') : '',

        // Action buttons
        '<div style="display:flex;gap:8px;margin-top:4px;">',
          '<button data-id="' + r.id + '" onclick="spApprove(this.dataset.id)" ',
            'style="flex:2;padding:9px;background:linear-gradient(135deg,#15803d,#16a34a);color:white;',
            'border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">',
            '✅ Approve & Sync to CRM',
          '</button>',
          '<button data-id="' + r.id + '" onclick="spReject(this.dataset.id)" ',
            'style="flex:1;padding:9px;background:rgba(220,38,38,0.1);color:var(--red);',
            'border:1px solid rgba(220,38,38,0.3);border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">',
            '❌ Reject',
          '</button>',
        '</div>',

      ].join('');

      list.appendChild(card);
    });

  } catch(e) {
    list.innerHTML = '<div class="sp-empty" style="color:var(--red);">Error: ' + e.message + '</div>';
  }
}

// ── Approve Site Pulse report ─────────────────────────────
async function spApprove(reportId) {
  var r = _spReportCache[reportId] || {};
  var contractorName = r.contractor_name || '';
  var projectName    = r.project_name   || '';
  var reportDate     = r.report_date    || new Date().toISOString().slice(0,10);
  var activities     = r.activities     || '';
  var workers = [];
  try { workers = typeof r.workers==='string' ? JSON.parse(r.workers) : (r.workers||[]); } catch(e2){}
  var totalWorkers = workers.reduce(function(s,w){ return s+(parseInt(w.count)||1); }, 0);
  var photos = [];
  try { photos = typeof r.photos==='string' ? JSON.parse(r.photos) : (r.photos||[]); } catch(e3){}
  var projectId    = r.project_id   || null;
  var contractorId = r.contractor_id|| null;
  var contractor   = (allContractors||[]).find(function(c){ return c.id===contractorId; });
  var mobile       = contractor ? (contractor.mobile||'') : '';
  try {
    // 1. Mark approved in Supabase
    await fetch(SUPABASE_URL_CONST + '/rest/v1/site_reports?id=eq.' + reportId, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST,
                 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'Beni Persky' })
    });
    // 2. Auto-create daily journal entry
    try {
      await fetch(SUPABASE_URL_CONST + '/rest/v1/reports', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST,
                   'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          project_name: projectName || 'Site Pulse Report',
          report_date:  reportDate,
          manager_name: contractorName,
          source:       'site_pulse',
          status:       'approved',
          general_notes: activities,
          workers:      workers,
          project_id:   projectId
        })
      });
    } catch(e4) { console.warn('Journal entry non-critical:', e4.message); }
    // 3. Photos appear in gallery automatically (galleryLoad reads approved site_reports)
    // 4. Send WhatsApp confirmation to contractor
    if (mobile) {
      var NL    = '\n';
      var phone = '972' + mobile.replace(/[^0-9]/g,'').replace(/^0/,'');
      var dHe   = new Date(reportDate+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
      var waMsg = 'Beni Persky approved your report' + NL +
                  (projectName ? 'Project: '+projectName+NL : '') +
                  'Date: '+dHe+NL +
                  (totalWorkers>0 ? 'Workers: '+totalWorkers+NL : '') +
                  NL + 'Report received and approved. Thank you!';
      var waUrl = 'https://wa.me/'+phone+'?text='+encodeURIComponent(waMsg);
      var _a=document.createElement('a'); _a.href=waUrl; _a.target='_blank'; _a.rel='noopener';
      document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
    }
    var card = document.getElementById('spr-'+reportId);
    if (card) { card.style.transition='all 0.4s'; card.style.opacity='0'; card.style.maxHeight='0'; }
    setTimeout(function(){ loadSiteReports(); }, 500);
    showToast('Report approved — WA sent to contractor', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); console.error('spApprove:',e); }
}

// ── Reject Site Pulse report — show reason modal ─────────
function spReject(reportId) {
  var r = _spReportCache[reportId] || {};
  document.getElementById('sp-reject-id').value = reportId;
  document.getElementById('sp-reject-contractor-label').textContent =
    (r.contractor_name || 'Unknown') + (r.project_name ? ' | ' + r.project_name : '');
  document.getElementById('sp-reject-report-label').textContent =
    'Date: ' + (r.report_date || '') + (r.submitted_by ? ' | by: '+r.submitted_by : '');
  document.getElementById('sp-reject-reason').value = '';
  document.getElementById('modal-sp-reject').style.display = 'flex';
}

async function _spConfirmReject() {
  var reportId = document.getElementById('sp-reject-id').value;
  var reason   = document.getElementById('sp-reject-reason').value.trim();
  if (!reason) { alert('Please enter rejection reason'); return; }
  var r            = _spReportCache[reportId] || {};
  var contractorId = r.contractor_id || null;
  var contractor   = (allContractors||[]).find(function(c){ return c.id===contractorId; });
  var mobile       = contractor ? (contractor.mobile||'') : '';
  try {
    await fetch(SUPABASE_URL_CONST + '/rest/v1/site_reports?id=eq.' + reportId, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_ANON_KEY_CONST, Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST,
                 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'rejected', rejection_reason: reason })
    });
    if (mobile) {
      var NL2   = '\n';
      var phone = '972' + mobile.replace(/[^0-9]/g,'').replace(/^0/,'');
      var dHe   = r.report_date ? new Date(r.report_date+'T12:00:00').toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
      var waMsg = 'Your site report was rejected by Beni Persky.' + NL2 +
                  (r.project_name ? 'Project: '+r.project_name+NL2 : '') +
                  (dHe ? 'Date: '+dHe+NL2 : '') +
                  NL2 + 'Reason: '+reason+NL2+NL2 +
                  'Please correct and resubmit. Thank you.';
      var waUrl = 'https://wa.me/'+phone+'?text='+encodeURIComponent(waMsg);
      var _a=document.createElement('a'); _a.href=waUrl; _a.target='_blank'; _a.rel='noopener';
      document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
    }
    closeModal('modal-sp-reject');
    var card = document.getElementById('spr-'+reportId);
    if (card) { card.style.opacity='0'; card.style.transition='opacity 0.3s'; }
    setTimeout(function(){ loadSiteReports(); }, 400);
    showToast('Report rejected — WA sent to contractor', 'success');
  } catch(e) { showToast('Error: '+e.message,'error'); console.error('spReject:',e); }
}
async function _spPlug(id,a,b){const card=document.getElementById('spr-'+id);if(card)card.style.opacity='0.4';try{await fetch(SUPABASE_URL_CONST+'/rest/v1/site_reports?id=eq.'+id,{method:'PATCH',headers:{apikey:SUPABASE_ANON_KEY_CONST,Authorization:'Bearer '+SUPABASE_ANON_KEY_CONST,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'approved',plugged_in:true,plugged_in_at:new Date().toISOString()})});setTimeout(loadSiteReports,800);}catch(e){console.error(e);if(card)card.style.opacity='1';}}
async function _spDelete(id){if(!confirm('מחוק דוח זה?'))return;try{await fetch(SUPABASE_URL_CONST+'/rest/v1/site_reports?id=eq.'+id,{method:'PATCH',headers:{apikey:SUPABASE_ANON_KEY_CONST,Authorization:'Bearer '+SUPABASE_ANON_KEY_CONST,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'deleted'})});setTimeout(loadSiteReports,500);}catch(e){console.error(e);}}
function _spParseTasks(json){try{return JSON.parse(json||'[]');}catch(e){return[];}}
async function _spSendLink() {
  var cSel  = document.getElementById('sp-contractor-sel');
  var pSel  = document.getElementById('sp-project-sel');
  var cId   = cSel ? cSel.value : '';
  var cName = cSel && cSel.selectedOptions[0] ? cSel.selectedOptions[0].text : '';
  var pId   = pSel ? pSel.value : '';
  var pName = pSel && pSel.selectedOptions[0] ? pSel.selectedOptions[0].text : '';
  if (!cId) { alert('בחר קבלן תחילה'); return; }
  var contractor = (allContractors || []).find(function(c){ return c.id === cId; });
  var mobile = contractor ? (contractor.mobile || '') : '';
  var preview = document.getElementById('sp-link-preview');
  if (preview) { preview.textContent = 'יוצר בקשה...'; preview.style.display = 'block'; }
  try {
    var res = await fetch(SUPABASE_URL_CONST + '/rest/v1/site_pulse_requests', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY_CONST,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY_CONST,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        contractor_id:     cId,
        project_id:        pId   || null,
        contractor_name:   cName,
        project_name:      pName || null,
        contractor_mobile: mobile || null,
        requested_by:      'Beni Persky',
        report_date:       new Date().toISOString().slice(0,10),
        status:            'pending'
      })
    });
    if (!res.ok) throw new Error('Supabase error ' + res.status);
    var rows = await res.json();
    if (!rows || !rows[0] || !rows[0].id) throw new Error('No ID returned');
    var reqId = rows[0].id;
    var formUrl = 'https://avshi2-maker.github.io/site-pulse/?req=' + reqId;
    if (preview) { preview.textContent = formUrl; }
    var projLine   = pName ? 'פרויקט: ' + pName + '\n' : '';
    var textBefore = 'שלום ' + cName + ',\n\nבני פרסקי שולח לך בקשה למלא דוח עבודה יומי.\n' +
                     projLine + 'תאריך: ' + new Date().toLocaleDateString('he-IL') + '\nנא למלא את הטופס:\n\n';
    var textAfter  = '\n\nתודה!';
    var phone      = mobile ? '972' + mobile.replace(/[^0-9]/g,'').replace(/^0/,'') : '';
    var waText     = encodeURIComponent(textBefore) + formUrl + encodeURIComponent(textAfter);
    var waUrl      = phone
      ? 'https://wa.me/' + phone + '?text=' + waText
      : 'https://wa.me/?text=' + waText;
    var _a = document.createElement('a');
    _a.href = waUrl; _a.target = '_blank'; _a.rel = 'noopener';
    document.body.appendChild(_a); _a.click(); document.body.removeChild(_a);
    showToast('קישור נשלח לוואטסאפ', 'success');
  } catch(e) {
    if (preview) { preview.textContent = 'שגיאה: ' + e.message; }
    showToast('שגיאה: ' + e.message, 'error');
    console.error('_spSendLink:', e);
  }
}
function _spFillSelects(){const cSel=document.getElementById('sp-contractor-sel');if(cSel&&allContractors.length){cSel.innerHTML='<option value="">בחר קבלן...</option>'+(allContractors||[]).filter(c=>c.is_active).map(c=>`<option value="${c.id}">${esc(c.company_name)}</option>`).join('');}const pSel=document.getElementById('sp-project-sel');if(pSel&&allProjects.length){pSel.innerHTML='<option value="">כל הפרויקטים</option>'+(allProjects||[]).map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');}}

// ── BENI TASKS WIDGET ─────────────────────────────────────
async function loadBeniTasks(){const list=document.getElementById('beni-tasks-list');const badge=document.getElementById('beni-count');if(!list)return;try{const res=await fetch(SUPABASE_URL_CONST+'/rest/v1/reminders?is_done=eq.false&order=created_at.desc&limit=25',{headers:{apikey:SUPABASE_ANON_KEY_CONST,Authorization:'Bearer '+SUPABASE_ANON_KEY_CONST}});if(!res.ok)throw new Error('HTTP '+res.status);const tasks=await res.json();if(!Array.isArray(tasks)||tasks.length===0){list.innerHTML='<div style="text-align:center;padding:18px;color:var(--text3);font-size:13px;">✅ אין משימות פתוחות לבני</div>';if(badge)badge.style.display='none';return;}if(badge){badge.textContent=tasks.length;badge.style.display='inline';}list.innerHTML=tasks.map(t=>{const srcClass=t.source==='voice'?'beni-src-voice':t.source==='call'?'beni-src-call':'beni-src-manual';const srcLabel=t.source==='voice'?'🎙️ קול':t.source==='call'?'📞 שיחה':'✍️ ידני';const txt=(t.text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const ago=_beniAgo(t.created_at);return`<div class="beni-task-row" id="btr-${t.id}"><div class="beni-check" onclick="_beniDone('${t.id}')" title="סמן כבוצע"></div><div style="flex:1"><div class="beni-task-txt">${txt}</div><div class="beni-task-ago">${ago}</div></div><span class="beni-src ${srcClass}">${srcLabel}</span></div>`;}).join('');}catch(e){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">שגיאה: '+e.message+'</div>';}}
async function _beniDone(id){const row=document.getElementById('btr-'+id);const check=row&&row.querySelector('.beni-check');const txt=row&&row.querySelector('.beni-task-txt');if(check){check.classList.add('done');check.textContent='✓';}if(txt)txt.classList.add('done');try{await fetch(SUPABASE_URL_CONST+'/rest/v1/reminders?id=eq.'+id,{method:'PATCH',headers:{apikey:SUPABASE_ANON_KEY_CONST,Authorization:'Bearer '+SUPABASE_ANON_KEY_CONST,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({is_done:true,done_at:new Date().toISOString()})});}catch(e){console.error(e);}setTimeout(()=>{if(row)row.style.opacity='0.25';},500);setTimeout(loadBeniTasks,1400);}
function _beniAgo(iso){if(!iso)return'';const d=Math.floor((Date.now()-new Date(iso))/1000);if(d<60)return'עכשיו';if(d<3600)return Math.floor(d/60)+' דק׳';if(d<86400)return Math.floor(d/3600)+' שע׳';return Math.floor(d/86400)+' ימים';}

// ── DAILY CALLS WIDGET ────────────────────────────────────
async function loadDailyCalls(dateStr){const list=document.getElementById('dc-calls-list');if(!list)return;const picker=document.getElementById('dc-date-picker');if(!dateStr){dateStr=new Date().toISOString().split('T')[0];if(picker)picker.value=dateStr;}const label=document.getElementById('dc-date-label');if(label){const d=new Date(dateStr+'T00:00:00');const isToday=dateStr===new Date().toISOString().split('T')[0];label.textContent=isToday?'היום — '+d.toLocaleDateString('he-IL',{day:'numeric',month:'long'}):d.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});}const from=dateStr+'T00:00:00.000Z';const to=dateStr+'T23:59:59.999Z';try{const res=await fetch(SUPABASE_URL_CONST+'/rest/v1/call_log?created_at=gte.'+from+'&created_at=lte.'+to+'&order=created_at.desc',{headers:{apikey:SUPABASE_ANON_KEY_CONST,Authorization:'Bearer '+SUPABASE_ANON_KEY_CONST}});if(!res.ok)throw new Error('HTTP '+res.status);const calls=await res.json();document.getElementById('dc-in').textContent=calls.filter(r=>r.direction==='incoming').length;document.getElementById('dc-out').textContent=calls.filter(r=>r.direction==='outgoing').length;document.getElementById('dc-miss').textContent=calls.filter(r=>r.direction==='missed').length;document.getElementById('dc-wa').textContent=calls.filter(r=>r.wa_sent).length;if(!calls||calls.length===0){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">אין שיחות מוקלטות ליום זה</div>';return;}const dirIcon={incoming:'📞',outgoing:'📲',missed:'📵'};list.innerHTML=calls.map(r=>{const t=new Date(r.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});const dir=r.direction||'incoming';const name=(r.caller_name||'לא ידוע').replace(/</g,'&lt;');const ph=(r.phone||'').replace(/</g,'&lt;');const dot=r.wa_sent?'<div class="dc-wa-dot"></div>':dir==='missed'?'<div class="dc-miss-dot"></div>':'';const noteText=r.note||r.notes||'';const note=noteText?'<div style="font-size:11px;color:var(--amber);margin-top:2px;">📝 '+noteText.replace(/</g,'&lt;')+'</div>':'';return`<div class="dc-call-row"><div class="dc-dir-icon">${dirIcon[dir]||'📞'}</div><div style="flex:1"><div class="dc-name">${name}</div><div class="dc-phone">${ph}</div>${note}</div>${dot}<div class="dc-time">${t}</div></div>`;}).join('');}catch(e){list.innerHTML='<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">שגיאה: '+e.message+'</div>';}}

// ── JOURNAL INTEGRATION ───────────────────────────────────
function openJournalForProject(projectId,projectName){
  window.switchTab&&window.switchTab('journal');
  const fill=()=>{const sel=document.getElementById('projectName');if(!sel){setTimeout(fill,100);return;}populateJournalProjectDropdown(projectName);const dateEl=document.getElementById('reportDate');if(dateEl&&!dateEl.value)dateEl.valueAsDate=new Date();sel.style.border='2px solid #667eea';sel.style.boxShadow='0 0 0 3px rgba(102,126,234,0.25)';setTimeout(()=>{sel.style.border='';sel.style.boxShadow='';},1800);showToast('📝 יומן חדש עבור: '+(projectName||'פרוייקט'),'success');};
  setTimeout(fill,80);
}

function populateJournalProjectDropdown(preselectName){
  const sel=document.getElementById('projectName');if(!sel)return;
  const current=preselectName||sel.value||'';
  sel.innerHTML='<option value="">— בחר פרוייקט —</option>'+(allProjects||[]).filter(p=>p.status==='active'||p.status==='paused').sort((a,b)=>(a.project_name||'').localeCompare(b.project_name||'','he')).map(p=>`<option value="${esc(p.project_name)}" data-id="${p.id}" ${esc(p.project_name)===current?'selected':''}>${esc(p.project_name)}</option>`).join('')+'<option value="__custom__">✏️ הזן שם ידנית...</option>';
  if(current)sel.value=current;
  const customRow=document.getElementById('project-custom-name-row');if(customRow)customRow.style.display=current==='__custom__'?'block':'none';
}


// ══════════════════════════════════════════════════════════════════
// GENERATE PO PDF — Professional Hebrew purchase order
// Replaces the old basic printQuote with a fully designed PDF
// ══════════════════════════════════════════════════════════════════
function generatePOPdf(po) {
  if (!po) { showToast('שגיאה: לא נמצאו נתוני הזמנה', 'error'); return; }
  const now    = new Date();
  const today  = now.toLocaleDateString('he-IL', {day:'2-digit',month:'2-digit',year:'numeric'});
  const timeStr= now.toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'});
  const items  = (() => { try { return JSON.parse(po.items_json||'[]'); } catch(e){ return []; } })();
  const sub    = parseFloat(po.subtotal||0);
  const vat    = parseFloat(po.vat_amount||0);
  const grand  = parseFloat(po.grand_total||0);

  // Build items rows HTML
  const itemRows = items.length ? items.map((item,i) => {
    const unitCost = parseFloat(item.unit_cost||0);
    const qty      = parseFloat(item.quantity||1);
    const lineTotal = unitCost * qty;
    const lineVat   = lineTotal * 0.18;
    return `
      <tr style="background:${i%2===0?'#fdf6e3':'#fff'}">
        <td style="text-align:center;font-weight:700;color:#1a3d5c;">${i+1}</td>
        <td style="text-align:right;font-weight:700;color:#1a1a2e;">${item.description||'—'}</td>
        <td style="text-align:center;">${qty}</td>
        <td style="text-align:center;color:#5a6e7f;">${item.unit||'סעיף'}</td>
        <td style="text-align:left;direction:ltr;">₪${fmtMoney(unitCost)}</td>
        <td style="text-align:left;direction:ltr;">₪${fmtMoney(lineTotal)}</td>
        <td style="text-align:left;direction:ltr;color:#5a6e7f;">₪${fmtMoney(lineVat)}</td>
        <td style="text-align:left;direction:ltr;font-weight:800;color:#1a3d5c;">₪${fmtMoney(lineTotal+lineVat)}</td>
      </tr>`;
  }).join('') : `<tr><td colspan="8" style="text-align:center;padding:16px;color:#888;">לא נמצאו סעיפים</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>הזמנת עבודה ${esc(po.po_number||'')}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Heebo',Arial,sans-serif;direction:rtl;background:#f0f4f8;color:#1a1a2e;}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:0;}
  @media screen{.page{box-shadow:0 4px 30px rgba(0,0,0,.15);margin:20px auto;}}
  @media print{body{background:#fff;}.page{box-shadow:none;margin:0;}.no-print{display:none!important;} @page{margin:0;size:A4;}}

  /* HEADER */
  .hdr{background:#1a3d5c;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;}
  .hdr-right .po-num{font-size:20px;font-weight:900;color:#c9a84c;letter-spacing:1px;}
  .hdr-right .po-date{font-size:11px;color:#fff;margin-top:3px;}
  .hdr-left .po-title{font-size:15px;font-weight:800;color:#fff;}
  .hdr-left .po-sub{font-size:10px;color:#c9a84c;margin-top:2px;}
  .gold-line{height:3px;background:#c9a84c;}

  /* PARTY BOXES */
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 20px;}
  .party-box{border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;}
  .party-box.orderer{border-color:#c9a84c;}
  .party-hdr{padding:7px 12px;font-weight:800;font-size:10px;color:#fff;}
  .orderer .party-hdr{background:#1a3d5c;}
  .contractor .party-hdr{background:#334155;}
  .party-row{display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;}
  .party-row:nth-child(even){background:#fdf6e3;}
  .contractor .party-row:nth-child(even){background:#f5f7fa;}
  .party-label{font-weight:700;color:#1a3d5c;white-space:nowrap;}
  .contractor .party-label{color:#334155;}
  .party-val{color:#1a1a2e;text-align:left;}

  /* PROJECT DETAILS */
  .proj-section{margin:0 20px 12px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;}
  .proj-hdr{background:#0f4c75;color:#fff;padding:7px 12px;font-weight:800;font-size:10px;}
  .proj-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;}
  .proj-cell{display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;border-bottom:1px solid #eef0f3;}
  .proj-cell:nth-child(4n+1),.proj-cell:nth-child(4n+2){background:#eaf0f7;}
  .proj-cell:nth-child(4n+3),.proj-cell:nth-child(4n+4){background:#f1f5f9;}
  .proj-label{font-weight:700;color:#0f4c75;}

  /* ITEMS TABLE */
  .tbl-section{margin:0 20px 10px;}
  .tbl-hdr{background:#1a3d5c;color:#fff;font-size:10px;font-weight:800;padding:7px 12px;border-radius:4px 4px 0 0;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  thead tr{background:#1a3d5c!important;}
  thead th{color:#fff;font-weight:700;padding:8px 6px;text-align:right;border-right:1px solid #2d5a8a;}
  thead th:nth-child(3),thead th:nth-child(4){text-align:center;}
  thead th:nth-child(5),thead th:nth-child(6),thead th:nth-child(7),thead th:nth-child(8){text-align:left;}
  tbody td{padding:6px 6px;border-bottom:1px solid #e8e8e8;border-right:1px solid #eee;}

  /* TOTALS */
  .totals{display:flex;justify-content:flex-start;margin:0 20px 12px;}
  .totals-box{width:280px;}
  .tot-row{display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;}
  .tot-row:nth-child(odd){background:#fdf6e3;}
  .tot-row:nth-child(even){background:#fff;}
  .tot-row.grand{background:#1a3d5c!important;color:#fff;}
  .tot-row.grand .tot-lbl{font-weight:800;}
  .tot-row.grand .tot-val{color:#c9a84c;font-weight:900;font-size:13px;}
  .tot-lbl{font-weight:600;color:#1a1a2e;}
  .tot-val{font-weight:700;direction:ltr;color:#1e6b30;}

  /* NOTES */
  .notes-box{margin:0 20px 12px;background:#fffbeb;border:1px solid #c9a84c;border-radius:4px;padding:10px 14px;font-size:11px;}
  .notes-title{font-weight:800;color:#1a3d5c;margin-bottom:4px;font-size:10px;}

  /* SIGNATURES */
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 20px 20px;}
  .sig-box{background:#fdf6e3;border:1px solid #c9a84c;border-radius:6px;padding:12px 14px;min-height:80px;}
  .sig-name{font-weight:800;font-size:10px;color:#1a3d5c;margin-bottom:8px;}
  .sig-line{border-bottom:1px solid #aaa;margin-bottom:4px;height:30px;}
  .sig-label{font-size:9px;color:#888;text-align:center;}

  /* FOOTER */
  .footer{background:#1a3d5c;padding:8px 20px;text-align:center;font-size:9px;color:#90b4d0;}
  .footer span{color:#c9a84c;}

  /* PRINT BUTTON */
  .print-bar{background:#fff;padding:12px 20px;display:flex;gap:10px;justify-content:center;border-bottom:2px solid #c9a84c;}
  .btn-print{background:#1a3d5c;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-family:'Heebo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;}
  .btn-close{background:#f1f5f9;color:#1a3d5c;border:1px solid #1a3d5c;padding:10px 20px;border-radius:6px;font-family:'Heebo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;}
</style>
</head>
<body>

<div class="no-print print-bar">
  <button class="btn-print" onclick="window.print()">🖨️ הדפס / שמור PDF</button>
  <button class="btn-close" onclick="window.close()">✕ סגור</button>
</div>

<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-right">
      <div class="po-num">${esc(po.po_number||'—')}</div>
      <div class="po-date">${today}  ${timeStr}</div>
    </div>
    <div class="hdr-left">
      <div class="po-title">הזמנת עבודה רשמית</div>
      <div class="po-sub">Official Purchase Order</div>
    </div>
  </div>
  <div class="gold-line"></div>

  <!-- PARTY BOXES -->
  <div class="parties">
    <div class="party-box orderer">
      <div class="party-hdr">המזמין</div>
      <div class="party-row"><span class="party-label">שם:</span><span class="party-val">בני פרסקי ניהול פרויקטים</span></div>
      <div class="party-row"><span class="party-label">ח.פ:</span><span class="party-val">123456789</span></div>
      <div class="party-row"><span class="party-label">טלפון:</span><span class="party-val">054-1234567</span></div>
      <div class="party-row"><span class="party-label">כתובת:</span><span class="party-val">הרצליה, ישראל</span></div>
      <div class="party-row"><span class="party-label">אימייל:</span><span class="party-val">beni@example.com</span></div>
    </div>
    <div class="party-box contractor">
      <div class="party-hdr">הקבלן</div>
      <div class="party-row"><span class="party-label">שם:</span><span class="party-val">${esc(po.contractor_name||'—')}</span></div>
      <div class="party-row"><span class="party-label">אימייל:</span><span class="party-val">${esc(po.contractor_email||'—')}</span></div>
      <div class="party-row"><span class="party-label">פרויקט:</span><span class="party-val">${esc(po.project_name||'—')}</span></div>
      <div class="party-row"><span class="party-label">הצעה:</span><span class="party-val">${esc(po.quote_title||'—')}</span></div>
    </div>
  </div>

  <!-- PROJECT DETAILS -->
  <div class="proj-section">
    <div class="proj-hdr">פרטי ההזמנה</div>
    <div class="proj-grid">
      <div class="proj-cell"><span class="proj-label">מספר הזמנה:</span><span>${esc(po.po_number||'—')}</span></div>
      <div class="proj-cell"><span class="proj-label">תאריך הזמנה:</span><span>${po.po_date?fmtDate(po.po_date):today}</span></div>
      <div class="proj-cell"><span class="proj-label">תאריך התחלה:</span><span>${po.start_date?fmtDate(po.start_date):'—'}</span></div>
      <div class="proj-cell"><span class="proj-label">תאריך סיום:</span><span>${po.end_date?fmtDate(po.end_date):'—'}</span></div>
      <div class="proj-cell" style="grid-column:span 2"><span class="proj-label">הערות:</span><span>${esc(po.remarks||'—')}</span></div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <div class="tbl-section">
    <div class="tbl-hdr">פירוט סעיפים</div>
    <table>
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th>תיאור עבודה</th>
          <th style="width:40px;text-align:center">כמות</th>
          <th style="width:44px;text-align:center">יחידה</th>
          <th style="width:72px;text-align:left">מחיר יחידה</th>
          <th style="width:72px;text-align:left">ללא מעמ</th>
          <th style="width:60px;text-align:left">מעמ 18%</th>
          <th style="width:72px;text-align:left">כולל מעמ</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="totals">
    <div class="totals-box">
      <div class="tot-row"><span class="tot-lbl">סכום ללא מעמ:</span><span class="tot-val">₪${fmtMoney(sub)}</span></div>
      <div class="tot-row"><span class="tot-lbl">מעמ (18%):</span><span class="tot-val">₪${fmtMoney(vat)}</span></div>
      <div class="tot-row grand"><span class="tot-lbl">סה"כ לתשלום:</span><span class="tot-val">₪${fmtMoney(grand)}</span></div>
    </div>
  </div>

  <!-- NOTES -->
  <div class="notes-box">
    <div class="notes-title">הערות ותנאים</div>
    <div>תנאי תשלום: שוטף+ 30 ימים מאישור חשבון מול חשבונית מס כדין.</div>
    <div>הזמנה זו כפופה לחוזה הראשי ולנספחי הבטיחות המצורפים.</div>
  </div>

  <!-- SIGNATURES -->
  <div class="sigs">
    <div class="sig-box">
      <div class="sig-name">המזמין — בני פרסקי ניהול פרויקטים</div>
      <div class="sig-line"></div>
      <div class="sig-label">חתימה ותאריך</div>
    </div>
    <div class="sig-box" style="background:#f5f7fa;border-color:#d1d9e0;">
      <div class="sig-name">הקבלן — ${esc(po.contractor_name||'—')}</div>
      <div class="sig-line"></div>
      <div class="sig-label">חתימה ותאריך</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>בני פרסקי ניהול פרויקטים</span>  |  הזמנה מספר ${esc(po.po_number||'')}  |  תאריך ${today}
    <br>מסמך זה הופק ממערכת ניהול הפרויקטים ומהווה הזמנת עבודה חוקית.
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) { showToast('אפשר חלונות קופצים בדפדפן', 'error'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Download Mockup XLS from Supabase Storage ────────────────────
function downloadMockupXLS() {
  const url = `${SB_URL}/storage/v1/object/public/app-assets/mockup_selector.xlsx`;
  const a = document.createElement('a');
  a.href     = url;
  a.download = 'מוק-אפ_בחירת_רכיבים.xlsx';
  a.target   = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('📊 מוריד קובץ מוק-אפ...', 'success');
}

console.log('✅ CRM Panel JS loaded OK');
