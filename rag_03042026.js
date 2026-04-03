var _ragHistory = [];  // conversation history for multi-turn

// System prompt from topic4_example_prompts.md
var RAG_SYSTEM_PROMPT = `אתה מסייע הנדסי מתמחה בבניית ממ"ד (מרחב מוגן דירתי) ובנייה עמידת הדף בישראל.
אתה עונה לקבלנים, מהנדסים ומפקחים בשטח על בסיס מסמכים טכניים שנשלפים ממאגר הידע.

## כללי ציטוט (חובה)
- כל עובדה טכנית חייבת להיות מלווה בציטוט: [מקור: <שם_רכיב>, <סעיף>]
- ציין תקנים במפורש: ת"י 4422, ת"י 466, ת"י 118, הנחיות פיקוד העורף
- אל תשנה מספרים, מידות ואחוזים — ציטוט מדויק בלבד

## מבנה תשובה
**תכנון:** מפרטים הנדסיים ומידות
**שיטת ביצוע:** שלבי עבודה מעשיים לקבלן
**עלות ותמחור:** אומדן עלויות לפי אזור (אם נשאל)
**בקרת איכות:** בדיקות ואישורים נדרשים
**תיקון (אם רלוונטי):** שיטת תיקון לנזק שתואר

## הצהרת אחריות (הוסף לכל תשובה)
⚠️ המידע מבוסס על מסמכי מאגר הידע. כל החלטה הנדסית בפועל חייבת אישור מהנדס קונסטרוקציה מורשה ופיקוד העורף.

ענה בעברית בלבד. היה תמציתי ומעשי — הקבלן באתר.`;

// ── Main RAG query function ───────────────────────────────────────────
async function ragQuery(userQuery, projectId) {
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) return { error: 'הגדר מפתח Anthropic API' };
  if (!userQuery || !userQuery.trim()) return { error: 'הכנס שאלה' };

  try {
    // ── Step 1: Retrieve relevant components from Supabase ───────────
    var retrieved = await ragRetrieve(userQuery);

    // ── Step 2: Build context from retrieved records ─────────────────
    var context = ragBuildContext(retrieved, userQuery);

    // ── Step 3: Query Claude with context + conversation history ─────
    var messages = [
      ..._ragHistory,
      { role: 'user', content: context + '\n\n---\nשאלה: ' + userQuery }
    ];

    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: RAG_SYSTEM_PROMPT,
        messages: messages
      }), 'rag-progress-text');

    var data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);

    var answer = data.content && data.content[0] && data.content[0].text;
    var inTok  = data.usage?.input_tokens  || 0;
    var outTok = data.usage?.output_tokens || 0;
    var cost   = (inTok * 3 / 1e6) + (outTok * 15 / 1e6);

    // Add to conversation history (keep last 6 turns)
    _ragHistory.push({ role: 'user', content: userQuery });
    _ragHistory.push({ role: 'assistant', content: answer });
    if (_ragHistory.length > 12) _ragHistory = _ragHistory.slice(-12);

    // Log to Supabase
    var _retFlat = (retrieved.mamad||[]).concat(retrieved.spec||[]).concat(retrieved.building_standards||[]).concat(retrieved.renovation||[]);
    await ragLogQuery(userQuery, _retFlat.map(function(r){ return r.component_id||r.standard_id||''; }),
      answer, inTok + outTok, cost, projectId);

    return {
      answer:     answer,
      retrieved:  retrieved,
      tokens:     inTok + outTok,
      cost:       cost
    };

  } catch(e) {
    return { error: e.message };
  }
}

// ── Retrieve: keyword search against Supabase ─────────────────────────
async function ragRetrieve(query) {
  var results = { mamad: [], spec: [], building_standards: [], renovation: [] };
  var q = encodeURIComponent(query.substring(0, 200));
  var h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  var qLow = query.toLowerCase();

  // ── 1. mamad components ───────────────────────────────────────────
  try {
    var tierMatch = query.match(/T([123])|דרגה\s*([123])/i);
    var tier = tierMatch ? 'T' + (tierMatch[1] || tierMatch[2]) : null;
    var typeHints = { 'קיר':'קיר','wall':'קיר','תקרה':'תקרה','slab':'תקרה',
      'דלת':'דלת','door':'דלת','חלון':'חלון','window':'חלון',
      'אוורור':'אוורור','nbc':'אוורור','vent':'אוורור' };
    var compType = null;
    for (var hint in typeHints) { if (qLow.includes(hint)) { compType = typeHints[hint]; break; } }
    var params = { search_query: query.substring(0, 200), max_results: 3 };
    if (tier)     params.tier_filter = tier;
    if (compType) params.type_filter = compType;
    var rpcRes = await fetch(
      SB_URL + '/rest/v1/rpc/mamad_keyword_search?' +
      Object.keys(params).map(function(k){ return k + '=' + encodeURIComponent(params[k]); }).join('&'),
      { headers: h });
    results.mamad = rpcRes.ok ? (await rpcRes.json() || []) : [];
    if (!results.mamad.length) {
      var fb = await fetch(SB_URL + '/rest/v1/mamad_components?select=component_id,component_name,component_type,blast_tier,full_record' + (tier ? '&blast_tier=eq.' + tier : '') + '&limit=3', { headers: h });
      results.mamad = fb.ok ? (await fb.json() || []) : [];
    }
  } catch(e) {}

  // ── 2. mamad spec chapters ────────────────────────────────────────
  try {
    var specRes = await fetch(SB_URL + '/rest/v1/rpc/mamad_spec_search?search_query=' + q + '&max_results=2', { headers: h });
    results.spec = specRes.ok ? (await specRes.json() || []) : [];
    if (!results.spec.length) {
      var sWord = query.split(' ').filter(function(w){ return w.length > 3; })[0] || query.substring(0,10);
      var sfb = await fetch(SB_URL + '/rest/v1/mamad_spec_chapters?select=spec_id,title_he,topic,key_specs,standards,text_content&text_content=ilike.*' + encodeURIComponent(sWord) + '*&limit=2', { headers: h });
      results.spec = sfb.ok ? (await sfb.json() || []) : [];
    }
  } catch(e) {}

  // ── 3. building_standards encyclopedia (838 standards) ───────────
  try {
    var words = query.split(/\s+/).filter(function(w){ return w.length > 2; }).slice(0,5);
    var bsFilter = words.map(function(w){
      return 'scope.ilike.*'+encodeURIComponent(w)+'*,title_he.ilike.*'+encodeURIComponent(w)+'*,notes.ilike.*'+encodeURIComponent(w)+'*,industry_category.ilike.*'+encodeURIComponent(w)+'*';
    }).join(',');
    // Also catch standard numbers mentioned in query (e.g. "413", "1045", "5281")
    var numMatch = query.match(/\b(\d{3,5})\b/g);
    if (numMatch) {
      numMatch.slice(0,2).forEach(function(num){
        bsFilter += ',standard_id.ilike.*'+num+'*,title_he.ilike.*'+num+'*';
      });
    }
    var bsRes = await fetch(SB_URL + '/rest/v1/building_standards?or=('+bsFilter+')&limit=8&select=standard_id,title_he,scope,key_requirements,notes,industry_category',
      { headers: h });
    results.building_standards = bsRes.ok ? (await bsRes.json() || []) : [];
  } catch(e) { results.building_standards = []; }

  // ── 4. renovation spec ────────────────────────────────────────────
  try {
    var catMap = {
      concrete:      ['בטון','זיון','פלדה','יציקה','חוזק','cfrp','jacketing','ליבה','חשיפה'],
      paint:         ['טיח','צבע','צביעה','איטום','חזית','הדבקות','ריסוס'],
      renovation:    ['שיפוץ','היתר','אסבסט','גובה','פירוק','רישוי'],
      accessibility: ['נגישות','מדרגות','כבש','מדרכה','מעקה','עולה','מדרך']
    };
    var detCat = null;
    for (var cat in catMap) {
      if (catMap[cat].some(function(kw){ return qLow.includes(kw); })) { detCat = cat; break; }
    }
    var renUrl = SB_URL + '/rest/v1/rpc/renovation_spec_search?search_query=' + q + '&max_results=3' + (detCat ? '&cat_filter=' + encodeURIComponent(detCat) : '');
    var renRes = await fetch(renUrl, { headers: h });
    results.renovation = renRes.ok ? (await renRes.json() || []) : [];
    if (!results.renovation.length) {
      var rWord = query.split(' ').filter(function(w){ return w.length > 3; })[0] || query.substring(0,10);
      var rfb = await fetch(SB_URL + '/rest/v1/renovation_spec?select=spec_id,category,title_he,standard_ref,key_rules,numeric_vals,text_content&text_content=ilike.*' + encodeURIComponent(rWord) + '*&limit=3', { headers: h });
      results.renovation = rfb.ok ? (await rfb.json() || []) : [];
    }
  } catch(e) {}

  return results;
}

// ── Build context string for Claude ──────────────────────────────────
function ragBuildContext(retrieved, query) {
  // Support both old array format and new {mamad, spec, building_standards, renovation} dict
  var mamadItems   = Array.isArray(retrieved) ? retrieved : (retrieved.mamad              || []);
  var specItems    = Array.isArray(retrieved) ? []        : (retrieved.spec               || []);
  var renovItems   = Array.isArray(retrieved) ? []        : (retrieved.renovation         || []);
  var bsItems      = Array.isArray(retrieved) ? []        : (retrieved.building_standards || []);
  var hasAny = mamadItems.length || specItems.length || renovItems.length || bsItems.length;
  if (!hasAny) {
    return 'לא נמצאו רשומות ספציפיות במאגר — ענה לפי ידע הנדסי כללי ותקנים ישראליים.';
  }

  var ctx = '## רשומות רלוונטיות ממאגר הידע ממ"ד\n\n';
  mamadItems.forEach(function(item, i) {
    var rec = item.full_record || item;
    ctx += '### רשומה ' + (i+1) + ': ' + (item.component_name || rec['שם_רכיב'] || '') + '\n';
    ctx += '**מזהה:** ' + (item.component_id || rec['רכיב_מזהה']) + '\n';
    ctx += '**דרגה:** ' + (item.blast_tier || rec['דרגת_הדף']) + '\n';

    // Design params (key numbers)
    var dp = rec['פרמטרי_תכנון'];
    if (dp) {
      if (dp['עובי_מ"מ']) ctx += '**עובי:** ' + JSON.stringify(dp['עובי_מ"מ']) + ' מ"מ\n';
      if (dp['חוזק_בטון_fck_MPa']) ctx += '**בטון:** ' + JSON.stringify(dp['חוזק_בטון_fck_MPa']) + ' MPa\n';
      if (dp['קוטר_מוט_מ"מ']) ctx += '**זיון:** ø' + (Array.isArray(dp['קוטר_מוט_מ"מ']) ? dp['קוטר_מוט_מ"מ'].join('/') : dp['קוטר_מוט_מ"מ']) + ' מ"מ\n';
    }

    // Construction overview
    var bld = rec['שיטת_בנייה'];
    if (bld && bld['היקף_ושימוש']) {
      ctx += '**היקף:** ' + bld['היקף_ושימוש'].substring(0, 300) + '\n';
    }

    // Repair methods if relevant
    var rep = rec['שיטת_תיקון'];
    if (rep && rep['סוגי_נזק'] && query.match(/תיקון|נזק|סדק|תיקן|repair|damage|crack/i)) {
      ctx += '**שיטות תיקון:**\n';
      (rep['סוגי_נזק'] || []).slice(0, 2).forEach(function(dmg) {
        ctx += '- ' + dmg['סוג_נזק'] + ': ' + (dmg['חומר_תיקון'] || '').substring(0, 150) + '\n';
      });
    }

    // Standards
    var stds = rec['תקנים'];
    if (stds && stds.length) {
      ctx += '**תקנים:** ' + stds.map(function(s){ return s['מספר_תקן']; }).join(', ') + '\n';
    }

    ctx += '\n';
  });


  // ── building_standards encyclopedia ──────────────────────────────
  var bsItems = retrieved.building_standards || [];
  if (bsItems.length) {
    ctx += '\n## אנציקלופדיית תקני בנייה — ' + bsItems.length + ' תקנים רלוונטיים\n\n';
    bsItems.forEach(function(s) {
      ctx += '### ' + (s.standard_id||'') + ': ' + (s.title_he||'') + '\n';
      ctx += '**קטגוריה:** ' + (s.industry_category||'') + '\n';
      if (s.scope) ctx += '**תיאור:** ' + s.scope.substring(0,200) + '\n';
      var reqs = s.key_requirements || [];
      if (typeof reqs === 'string') { try { reqs = JSON.parse(reqs); } catch(e) { reqs = []; } }
      if (reqs.length) ctx += '**דרישות:** ' + reqs.slice(0,3).join(' | ') + '\n';
      if (s.notes) ctx += '**הערות שטח:** ' + s.notes.substring(0,150) + '\n';
      ctx += '\n';
    });
  }

  // ── ממ"ד Spec chapters ────────────────────────────────────────────
  if (specItems.length) {
    ctx += '\n## מפרט בלמ"ס — הנחיות הנדסיות\n\n';
    specItems.forEach(function(s) {
      ctx += '### ' + (s.title_he || '') + '\n';
      if (s.standard_ref || s.standards) ctx += '**תקן:** ' + (s.standard_ref || (s.standards||[]).join(', ')) + '\n';
      var ks = s.key_specs || [];
      if (typeof ks === 'string') { try { ks = JSON.parse(ks); } catch(e) { ks = []; } }
      if (ks.length) ctx += '**דרישות עיקריות:** ' + ks.slice(0,4).join(' | ') + '\n';
      if (s.text_snippet || s.text_content) ctx += (s.text_snippet || (s.text_content||'').substring(0,300)) + '\n';
      ctx += '\n';
    });
  }

  // ── Renovation + Concrete + Paint spec ───────────────────────────
  if (renovItems.length) {
    ctx += '\n## מפרט שיפוץ, בטון וצבע — תקנות ישראליות\n\n';
    renovItems.forEach(function(r) {
      ctx += '### ' + (r.title_he || '') + ' [' + (r.category||'') + ']\n';
      if (r.standard_ref) ctx += '**תקן:** ' + r.standard_ref + '\n';
      var kr = r.key_rules || [];
      if (typeof kr === 'string') { try { kr = JSON.parse(kr); } catch(e) { kr = []; } }
      if (kr.length) ctx += '**כללים:** ' + kr.slice(0,4).join(' | ') + '\n';
      var nv = r.numeric_vals || [];
      if (typeof nv === 'string') { try { nv = JSON.parse(nv); } catch(e) { nv = []; } }
      if (nv.length) {
        ctx += '**ערכים מספריים:** ' + nv.map(function(v){ return v.param + ': ' + v.value + (v.unit?' '+v.unit:''); }).slice(0,4).join(', ') + '\n';
      }
      if (r.text_snippet || r.text_content) ctx += (r.text_snippet || (r.text_content||'').substring(0,250)) + '\n';
      ctx += '\n';
    });
  }


  // Building standards encyclopedia section
  if (bsItems && bsItems.length) {
    ctx += '\n== אנציקלופדיית תקני בנייה (' + bsItems.length + ' תקנים רלוונטיים) ==\n';
    bsItems.forEach(function(s) {
      ctx += (s.standard_id||'') + ': ' + (s.title_he||'') + '\n';
      if (s.scope) ctx += (s.scope||'').substring(0,200) + '\n';
      var reqs = s.key_requirements || [];
      if (typeof reqs === 'string') { try { reqs = JSON.parse(reqs); } catch(_e) { reqs = []; } }
      if (Array.isArray(reqs) && reqs.length) ctx += 'דרישות: ' + reqs.slice(0,3).join(' | ') + '\n';
      if (s.notes) ctx += 'הערה: ' + (s.notes||'').substring(0,100) + '\n';
      ctx += '\n';
    });
  }

  return ctx;
}

// ── Fetch cost summary for a component ───────────────────────────────
async function ragGetCosts(componentId, region) {
  region = region || 'מרכז';
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/rpc/mamad_cost_summary?p_component_id=' +
      encodeURIComponent(componentId) + '&p_region=' + encodeURIComponent(region),
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    return res.ok ? await res.json() : [];
  } catch(e) { return []; }
}

// ── Log query to Supabase ─────────────────────────────────────────────
async function ragLogQuery(query, componentIds, response, tokens, cost, projectId) {
  try {
    await fetch(SB_URL + '/rest/v1/mamad_query_log', {
      method: 'POST',
      headers: { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY,
        'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({
        query_text:           query,
        components_retrieved: componentIds,
        response_text:        response,
        tokens_used:          tokens,
        cost_usd:             cost,
        project_id:           projectId || null
      })
    });
  } catch(e) { /* non-critical */ }
}

// ── Clear conversation history ────────────────────────────────────────
function ragClearHistory() {
  _ragHistory = [];
}


// ══ RAG TAB UI CONTROLLER ═════════════════════════════════════════════

function ragTabInit() {
  var input = document.getElementById('rag-input');
  if (input) input.focus();
  // Pre-load history count silently
  ragHistLoadCount();
}

async function ragHistLoadCount() {
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/mamad_query_log?select=id&limit=1&order=created_at.desc',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (res.ok) {
      var countRes = await fetch(
        SB_URL + '/rest/v1/mamad_query_log?select=id',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
          'Prefer': 'count=exact', 'Range': '0-0' } }
      );
      var range = countRes.headers.get('Content-Range');
      var total = range ? range.split('/')[1] : null;
      if (total && parseInt(total) > 0) {
        var histBtn = document.getElementById('rag-subtab-history');
        if (histBtn) histBtn.textContent = '📋 היסטוריה (' + total + ')';
      }
    }
  } catch(e) { /* non-critical */ }
}

function ragClearChat() {
  var history = document.getElementById('rag-chat-history');
  if (history) history.innerHTML = '<div style="text-align:center;padding:40px;color:#333;font-size:13px;"><div style="font-size:32px;margin-bottom:8px;">🏗️</div><div>שיחה נקתה — שאל שאלה חדשה</div></div>';
  var status = document.getElementById('rag-status');
  if (status) status.textContent = '';
  document.getElementById('rag-retrieved-bar')?.style && (document.getElementById('rag-retrieved-bar').style.display = 'none');
}

function ragQuickAsk(question) {
  var input = document.getElementById('rag-input');
  if (input) input.value = question;
  ragSubmit();
}

async function ragSubmit() {
  var input  = document.getElementById('rag-input');
  var query  = (input?.value || '').trim();
  if (!query) return;

  var btn      = document.getElementById('rag-send-btn');
  var status   = document.getElementById('rag-status');
  var history  = document.getElementById('rag-chat-history');
  var retBar   = document.getElementById('rag-retrieved-bar');
  var tokEl    = document.getElementById('rag-token-count');
  var costEl   = document.getElementById('rag-cost-display');

  if (btn) { btn.disabled = true; btn.textContent = '⏳ שולף...'; }
  if (status) status.textContent = '🔍 מחפש במאגר הידע...';

  // Add user message to chat
  var userBubble = document.createElement('div');
  userBubble.style.cssText = 'display:flex;justify-content:flex-end;';
  userBubble.innerHTML = '<div style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);color:#fff;padding:12px 16px;border-radius:14px 14px 4px 14px;max-width:75%;font-size:14px;line-height:1.6;direction:rtl;text-align:right;">'
    + query.replace(/</g,'&lt;') + '</div>';

  // Remove empty state if present
  var emptyState = history?.querySelector('[style*="text-align:center"]');
  if (emptyState) emptyState.remove();
  history?.appendChild(userBubble);
  history?.scrollTo(0, history.scrollHeight);
  input.value = '';

  // Show typing indicator
  var typingEl = document.createElement('div');
  typingEl.id  = 'rag-typing';
  typingEl.style.cssText = 'display:flex;align-items:center;gap:8px;';
  typingEl.innerHTML = '<div style="background:#242438;border:1px solid rgba(255,255,255,0.08);border-radius:14px 14px 14px 4px;padding:12px 16px;font-size:13px;color:#888;">🧠 Claude מנתח ושולף רכיבים...</div>';
  history?.appendChild(typingEl);
  history?.scrollTo(0, history.scrollHeight);

  // Get region
  var region = document.getElementById('rag-region-sel')?.value || 'מרכז';

  // Live timer for ייעוץ הנדסי chat
  var _ragStartTime = Date.now();
  var _ragTimerInterval = setInterval(function() {
    var secs = ((Date.now() - _ragStartTime) / 1000).toFixed(1);
    if (status) status.innerHTML = '<span style="color:#7c3aed;font-weight:700;">⏱ '+secs+'s</span> &nbsp; <span style="color:#444;">מחשב...</span>';
  }, 200);

  try {
    if (status) status.textContent = '🔍 שולף מ-838 תקנים...';

    var result = await ragQuery(query, null);
    clearInterval(_ragTimerInterval);
    typingEl.remove();

    if (result.error) {
      var errBubble = document.createElement('div');
      errBubble.innerHTML = '<div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:12px 16px;border-radius:14px;font-size:13px;direction:rtl;">❌ שגיאה: ' + result.error + '</div>';
      history?.appendChild(errBubble);
    } else {
      // Format and display answer
      var answerBubble = document.createElement('div');
      answerBubble.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

      // Format markdown-like response
      var formattedAnswer = (result.answer || '')
        .replace(/</g,'&lt;')
        .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
        .replace(/^## (.+)$/gm,'<div style="font-size:14px;font-weight:800;color:#c4b5fd;margin:10px 0 4px;">$1</div>')
        .replace(/^⚠️(.+)$/gm,'<div style="font-size:11px;color:#888;border-top:1px solid rgba(255,255,255,0.06);margin-top:10px;padding-top:8px;">⚠️$1</div>')
        .replace(/\\n/g,'<br>')
        .split('\n').join('<br>');

      answerBubble.innerHTML = '<div style="background:#1e1e35;border:1px solid rgba(139,92,246,0.25);color:#e2e8f0;padding:14px 18px;border-radius:14px 14px 14px 4px;max-width:90%;font-size:13px;line-height:1.7;direction:rtl;text-align:right;">'
        + formattedAnswer + '</div>';

      // Retrieved components bar
      var _flatRet = Array.isArray(result.retrieved) ? result.retrieved : ((result.retrieved&&result.retrieved.mamad)||[]).concat((result.retrieved&&result.retrieved.building_standards)||[]);
      if (_flatRet.length > 0) {
        retBar.style.display = 'block';
        retBar.innerHTML = '📚 רכיבים שנשלפו: ' + _flatRet.map(function(r) {
          return '<span style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);color:#c4b5fd;padding:2px 8px;border-radius:10px;margin-right:4px;font-size:10px;">'
            + (r.component_id || r.component_name || '') + '</span>';
        }).join('');
      }

      // Prominent token+time+$ display under answer
      var elapsed = ((Date.now() - _ragStartTime) / 1000).toFixed(1);
      var toks = result.tokens || 0;
      var costVal = (result.cost || 0).toFixed(4);
      var metricsBar = document.createElement('div');
      metricsBar.style.cssText = 'display:flex;gap:12px;font-size:11px;color:#555;margin-top:6px;flex-wrap:wrap;align-items:center;';
      metricsBar.innerHTML = '<span style="color:#7c3aed;font-weight:700;">⏱ '+elapsed+'s</span>'
        + '<span style="color:#3b82f6;">🔢 '+toks.toLocaleString()+' tokens</span>'
        + '<span style="color:#22c55e;">💰 $'+costVal+'</span>'
        + '<span style="color:#555;font-size:10px;">838 תקנים · 3 מקורות</span>';
      answerBubble.appendChild(metricsBar);

      // ── Follow-up questions bar ────────────────────────────────
      var followBar = document.createElement('div');
      followBar.style.cssText = 'margin-top:10px;background:#1a1a2e;border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:10px 12px;';
      followBar.innerHTML = '<div style="font-size:10px;color:#7c3aed;font-weight:700;margin-bottom:6px;">&#x1F4AC; שאלות המשך על התשובה הזו:</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
        + '<button data-q="האם יש חריגות נפוצות מהתקן בשטח?" onclick="ragFollowUpBtn(this)" style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);color:#c4b5fd;padding:4px 10px;border-radius:14px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;">האם יש חריגות נפוצות?</button>'
        + '<button data-q="מה עלות התיקון לפי מחירון הבינוי?" onclick="ragFollowUpBtn(this)" style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:4px 10px;border-radius:14px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;">מה עלות התיקון?</button>'
        + '<button data-q="מה צעדי הביצוע המומלצים בשטח?" onclick="ragFollowUpBtn(this)" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#86efac;padding:4px 10px;border-radius:14px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;">צעדי ביצוע בשטח</button>'
        + '<button data-q="האם נדרש היתר או אישור מיוחד?" onclick="ragFollowUpBtn(this)" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:4px 10px;border-radius:14px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;">נדרש היתר?</button>'
        + '</div>'
        + '<div style="display:flex;gap:8px;">'
        + '<input id="rag-followup-input" type="text" placeholder="שאל שאלת המשך..." dir="rtl" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(139,92,246,0.3);color:#fff;padding:7px 12px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;">'
        + '<button onclick="ragFollowUpCustom()" style="background:rgba(139,92,246,0.3);border:none;color:#fff;padding:7px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">שאל ←</button>'
        + '</div>';
      answerBubble.appendChild(followBar);

      if (tokEl) tokEl.textContent = toks.toLocaleString() + ' טוקנים';
      if (costEl) costEl.textContent = '$' + costVal;

      history?.appendChild(answerBubble);
    }

    if (status) status.textContent = '';
  } catch(e) {
    typingEl?.remove();
    if (status) status.textContent = '❌ ' + e.message;
  }

  if (btn) { btn.disabled = false; btn.textContent = '🏗️ שאל'; }
  history?.scrollTo(0, history.scrollHeight);
}
// ── Follow-up question helpers ────────────────────────────────────────
function ragFollowUpBtn(btn) {
  var q = btn.getAttribute('data-q') || '';
  if (!q) return;
  var input = document.getElementById('rag-input');
  if (input) { input.value = q; ragSubmit(); }
}
function ragFollowUpCustom() {
  var fi = document.getElementById('rag-followup-input');
  var q = fi ? fi.value.trim() : '';
  if (!q) return;
  var input = document.getElementById('rag-input');
  if (input) { input.value = q; ragSubmit(); }
  if (fi) fi.value = '';
}



var _ragPhotoB64       = null;   // current uploaded photo base64
var _ragPhotoMediaType = 'image/jpeg';
var _ragDamageContext  = null;   // structured damage assessment from vision
var _ragPOPlan         = null;   // last generated PO plan

// ── SYSTEM PROMPT for PO generation (structured JSON output) ──────────
// System prompt built with string concat — no quote nesting issues
var RAG_PO_SYSTEM = 'אתה מהנדס בנייה בכיר המתמחה בבנייה עמידת הדף בישראל.\n'
  + 'תפקידך: לנתח נזק מתמונה + מסמכים טכניים ולייצר תוכנית תיקון מלאה כ-JSON.\n\n'
  + 'חוקים:\n'
  + '1. ענה ONLY ב-JSON תקני — אין markdown, אין טקסט לפני או אחרי\n'
  + '2. כל שדות טקסט — בעברית בלבד\n'
  + '3. מחירים — בשקלים, מנתוני Supabase שצורפו\n'
  + '4. זמנים — בימי עבודה\n'
  + '5. תקנים — ציין מספר תקן מדויק\n'
  + '6. אסור גרשיים כפולים בתוך ערכי מחרוזת — במקום ממ"ד כתוב ממד, במקום ת"י כתוב תי';

// ── PO JSON schema that Claude must return ────────────────────────────
// Schema built with string concat to avoid ANY quote issues in Hebrew strings
var RAG_PO_SCHEMA = '{'
  + '"damage_assessment":{'
  +   '"severity":"CRITICAL",'
  +   '"blast_tier":"T2",'
  +   '"damage_types":["נזק הדף","חשיפת זיון","התקלפות"],'
  +   '"affected_area_m2":0.5,'
  +   '"immediate_danger":true,'
  +   '"engineering_note":"נדרש שחזור מבני מלא"'
  + '},'
  + '"recommended_method":{'
  +   '"method_id":"RECAST",'
  +   '"method_name":"יציקה מחדש",'
  +   '"rationale":"שחזור מלא עם בטון B35 מאפשר הסמכה מחדש",'
  +   '"certifiable":true,'
  +   '"hfc_approval_required":true'
  + '},'
  + '"po_data":{'
  +   '"project_name":"שיקום ממד",'
  +   '"project_location":"",'
  +   '"start_date_days_from_now":2,'
  +   '"duration_days":14,'
  +   '"notes":"הזמנה כפופה לאישור מהנדס קונסטרוקציה ופיקוד העורף",'
  +   '"sections":['
  +     '{'
  +       '"section_title":"פיקוח ותמיכה זמנית",'
  +       '"section_type":"LABOR",'
  +       '"items":['
  +         '{'
  +           '"description":"הקמת פיגום ותמיכה זמנית",'
  +           '"unit":"se",'
  +           '"quantity":8,'
  +           '"unit_price":210,'
  +           '"labor_hours":8,'
  +           '"trade":"תבניתן",'
  +           '"standard_ref":"ti118",'
  +           '"notes":""'
  +         '}'
  +       ']'
  +     '}'
  +   ']'
  + '}'
  + '}';


// ── Handle photo upload ───────────────────────────────────────────────
async function ragHandlePhoto(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  input.value = '';

  _ragPhotoMediaType = file.type || 'image/jpeg';
  if (!['image/jpeg','image/png','image/gif','image/webp'].includes(_ragPhotoMediaType))
    _ragPhotoMediaType = 'image/jpeg';

  // Show preview
  var previewWrap = document.getElementById('rag-photo-preview');
  var previewImg  = document.getElementById('rag-photo-img');
  var analysisDiv = document.getElementById('rag-photo-analysis');
  var actionsDiv  = document.getElementById('rag-photo-actions');

  if (previewWrap) previewWrap.style.display = 'block';
  if (actionsDiv)  actionsDiv.style.display  = 'none';
  if (analysisDiv) analysisDiv.innerHTML = '🔍 מנתח תמונת נזק עם Claude Vision...';

  _ragPhotoB64 = await readFileAsBase64(file);
  if (previewImg) previewImg.src = 'data:' + _ragPhotoMediaType + ';base64,' + _ragPhotoB64;

  // Run vision analysis
  await ragAnalyzeDamagePhoto();
}

// ── Vision: analyze damage photo ──────────────────────────────────────
async function ragAnalyzeDamagePhoto() {
  var analysisDiv = document.getElementById('rag-photo-analysis');
  var actionsDiv  = document.getElementById('rag-photo-actions');
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { if(analysisDiv) analysisDiv.innerHTML = '❌ הגדר מפתח API'; return; }

  var visionPrompt = 'אתה מהנדס בנייה ישראלי המתמחה בממ"ד. נתח תמונה זו של נזק לממ"ד.\n\n'
    + 'זהה בעברית:\n'
    + '1. סוג הנזק: סדקים/התקלפות/חשיפת זיון/מכתש פגיעה/נזק הדף/קורוזיה\n'
    + '2. הערכת שטח פגוע (מ"ר)\n'
    + '3. עצמת הנזק: T1 (קל) / T2 (בינוני) / T3 (כבד)\n'
    + '4. האם הדלת/חלון הדף שלמים?\n'
    + '5. שיטת תיקון מומלצת: יציקה מחדש / jacketing / טיח תיקון\n'
    + '6. האם נדרשת תמיכה זמנית מיידית?\n\n'
    + 'ענה בעברית, 3-4 משפטים תמציתיים. היה ספציפי.';

  try {
    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:500,
        messages:[{ role:'user', content:[
          { type:'image', source:{ type:'base64', media_type:_ragPhotoMediaType, data:_ragPhotoB64 } },
          { type:'text',  text: visionPrompt }
        ]}]
      }), 'rag-progress-text');
    var data = await res.json();
    var analysis = data.content && data.content[0] && data.content[0].text;
    _ragDamageContext = analysis;

    if (analysisDiv) {
      analysisDiv.innerHTML = '<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:6px;">🔍 ניתוח Vision — זוהה:</div>'
        + '<div style="color:#e2e8f0;direction:rtl;line-height:1.8;">' + ragFormatAnalysis(analysis) + '</div>';
    }
    if (actionsDiv) actionsDiv.style.display = 'flex';

    // Analysis already shown in the photo preview zone — no duplicate bubble needed

  } catch(e) {
    if (analysisDiv) analysisDiv.innerHTML = '❌ שגיאה: ' + e.message;
  }
}

// ── Ask about photo in chat ───────────────────────────────────────────
function ragAskAboutPhoto() {
  var input = document.getElementById('rag-input');
  if (input && _ragDamageContext) {
    input.value = 'בהתבסס על הנזק שזוהה בתמונה — ' + _ragDamageContext.substring(0,100) + '... מה שיטת התיקון הטובה ביותר והעלות הצפויה?';
    input.focus();
  }
}

async function ragGeneratePO() {
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { ragShowError('מפתח Anthropic API חסר — הגדר ב-app_config בסופאבייס'); return; }
  if (!_ragPhotoB64 && !_ragDamageContext) {
    ragShowError('לא הועלתה תמונה — העלה תמונת נזק תחילה'); return;
  }

  var btn = document.getElementById('rag-gen-po-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ מייצר...'; }

  var region = document.getElementById('rag-region-sel')?.value || 'מרכז';

  // ── Show persistent live progress panel in chat ───────────────────
  var progressEl = ragShowProgress();

  // Timer + token counter
  var _poStartTime = Date.now();
  var _poTimerInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - _poStartTime) / 1000);
    var mins = Math.floor(elapsed / 60), secs = elapsed % 60;
    var timeStr = (mins > 0 ? mins + ':' : '') + (secs < 10 ? '0' : '') + secs + 'ש';
    ragUpdateProgress(null, null, timeStr);
  }, 500);

  try {
    // ── Step 1: Retrieve repair records + cost data from Supabase ────
    ragUpdateProgress('🔍 שולף נתוני תיקון ממאגר הידע...', 15);
    var wallT2 = await ragFetchComponent('WALL-BLAST-T2-001');
    var costData = await ragFetchCosts('WALL-BLAST-T2-001', region);

    // ── Step 2: Build rich context for Claude ────────────────────────
    ragUpdateProgress('📋 בונה הקשר הנדסי מ-' + (costData.length||0) + ' שורות עלות...', 30);
    var ctx = ragBuildPOContext(wallT2, costData, region);

    // ── Step 3: Build message content (image + context + instruction) ─
    var msgContent = [];
    if (_ragPhotoB64) {
      msgContent.push({ type:'image', source:{ type:'base64', media_type:_ragPhotoMediaType, data:_ragPhotoB64 } });
    }
    if (_ragDamageContext) {
      msgContent.push({ type:'text', text:'ניתוח Vision שכבר בוצע:\n' + _ragDamageContext + '\n\n' });
    }

    // ── FIX 1: Include conversation Q&A so Beni's 2 questions feed in ─
    // Pull the last 6 turns from _ragHistory (user+assistant pairs)
    var historyContext = '';
    if (_ragHistory && _ragHistory.length > 0) {
      var recentHistory = _ragHistory.slice(-6);
      historyContext = '## שאלות ותשובות מהשיחה הנוכחית (כלול בניתוח):\n';
      recentHistory.forEach(function(turn) {
        historyContext += (turn.role === 'user' ? 'שאלה: ' : 'תשובה: ') + turn.content.substring(0, 400) + '\n\n';
      });
      historyContext += '---\n\n';
    }

    msgContent.push({ type:'text', text: historyContext + ctx + '\n\n'
      + '## משימה\n'
      + 'צור תוכנית תיקון ממ"ד מלאה בפורמט JSON בלבד.\n'
      + 'כלול 4 חלקים נפרדים:\n'
      + 'חלק א — עבודה: תבניתן, ברזלן, בטונאי, מסגר לפי שיטת התיקון שנבחרה\n'
      + 'חלק ב — חומרים: בטון, פלדת זיון, חומרי איטום, עוגנים\n'
      + 'חלק ג — בדיקות QA: UPV, core drilling, אטימות, אישור פיקוד העורף\n'
      + 'חלק ד — תקורה: פיקוח, ביטוח, רווח קבלני 12%\n\n'
      + 'מחירים: השתמש בנתוני העלות מ-Supabase שסופקו למעלה\n'
      + 'כלול 12-16 שורות סה"כ\n\n'
      + 'JSON Schema:\n' + RAG_PO_SCHEMA
      + '\n\nכללי JSON קריטיים:\n'
      + '1. התחל עם { ישירות ללא טקסט לפני\n'
      + '2. אסור גרשיים כפולים בתוך ערכי מחרוזת — שמות כמו ממד ולא ממ"ד, תי118 ולא ת"י 118\n'
      + '3. מספרים ללא גרשיים: 8 ולא "8"\n'
      + '4. null ללא גרשיים לערכים ריקים\n'
      + '5. אין markdown, אין ```json\n'
      + 'ענה ב-JSON בלבד. אסור כל טקסט אחר.'
    });

    // ── Step 4: Call Claude ───────────────────────────────────────────
    ragUpdateProgress('🧠 Claude מייצר תוכנית תיקון + הזמנת עבודה...', 55);
    if (btn) btn.textContent = '🧠 מייצר...';
    var _tokenCheckInterval = setInterval(function() {
      var elapsed = Math.floor((Date.now() - _poStartTime) / 1000);
      var estTokens = Math.min(elapsed * 80, 3800);
      ragUpdateProgress(null, null, null, estTokens);
    }, 1000);
    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,                        // FIX 3: was 3000, not enough for full plan
        system: RAG_PO_SYSTEM,
        messages:[{ role:'user', content: msgContent }]
      }), 'rag-progress-text');
    var data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'API error ' + res.status);

    // ── FIX 2: Robust JSON extraction — handles preamble + markdown ───
    var raw = (data.content&&data.content[0]&&data.content[0].text)||'';
    // Strip markdown fences
    raw = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    // Find first { and last } — extract only the JSON object
    var jsonStart = raw.indexOf('{');
    var jsonEnd   = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('Raw response:', raw.substring(0, 500));
      throw new Error('Claude לא החזיר JSON תקני. בדוק console לפרטים.');
    }
    raw = raw.substring(jsonStart, jsonEnd + 1);

    var plan = ragSafeParseJSON(raw);
    if (!plan) {
      console.error('JSON parse failed. Raw response was:', raw.substring(0, 1000));
      throw new Error('Claude החזיר JSON לא תקני. בדוק Console (F12) לראות את התגובה המלאה ושלח לתמיכה.');
    }

    _ragPOPlan = plan;
    clearInterval(_tokenCheckInterval);
    ragUpdateProgress('✅ תוכנית מוכנה — שומר ומכין תצוגה...', 90);

    // Save the full QA session to mamad_query_log
    var qaQuestions = _ragHistory.filter(function(t){ return t.role==='user'; }).map(function(t){ return t.content; });
    var qaAnswers   = _ragHistory.filter(function(t){ return t.role==='assistant'; }).map(function(t){ return t.content; });
    ragSavePhotoQA(_ragPhotoB64, _ragDamageContext, plan, qaQuestions, qaAnswers, null);

    // ── Step 5: Show preview in chat, then fill PO ───────────────────
    await new Promise(function(r){ setTimeout(r, 400); });
    ragUpdateProgress('✅ הזמנת עבודה מוכנה לאישור', 100);
    setTimeout(function(){ ragRemoveProgress(); }, 800);
    ragShowPOPreview(plan, region);

    // Persistent success notification with navigation instruction
    ragShowSuccessNav('✅ תוכנית תיקון ממ"ד נוצרה', 'לחץ "פתח הזמנת עבודה" למטה → יועבר ל-לוח בקרה ← הזמנות עבודה');

  } catch(e) {
    clearInterval(_poTimerInterval);
    clearInterval(_tokenCheckInterval || 0);
    ragRemoveProgress();
    ragShowError(e.message, e.toString());
    console.error('ragGeneratePO error:', e);
  }

  clearInterval(_poTimerInterval);
  if (btn) { btn.disabled = false; btn.textContent = '📄 צור הזמנת עבודה מהניתוח'; }
}

// ── Fetch full component record ───────────────────────────────────────
async function ragFetchComponent(compId) {
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/mamad_components?component_id=eq.' + encodeURIComponent(compId) + '&select=*',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    var rows = res.ok ? await res.json() : [];
    return rows[0] || null;
  } catch(e) { return null; }
}

// ── Fetch cost rows ───────────────────────────────────────────────────
async function ragFetchCosts(compId, region) {
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/mamad_costs?component_id=eq.' + encodeURIComponent(compId)
        + '&region=in.("' + region + '",ארצי)&order=cost_type.asc',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    return res.ok ? await res.json() : [];
  } catch(e) { return []; }
}

// ── Build context string with costs ──────────────────────────────────
function ragBuildPOContext(comp, costs, region) {
  var ctx = '## נתוני מאגר הידע — רכיב WALL-BLAST-T2-001\n\n';

  if (comp && comp.repair_methods) {
    var rep = typeof comp.repair_methods === 'string' ? JSON.parse(comp.repair_methods) : comp.repair_methods;
    ctx += '### שיטות תיקון מאושרות:\n';
    (rep['סוגי_נזק']||[]).forEach(function(d) {
      ctx += '**' + d['סוג_נזק'] + ':** ' + (d['חומר_תיקון']||'') + '\n';
      if (d['חיפוי_jacketing']) ctx += 'Jacketing: ' + d['חיפוי_jacketing'] + '\n';
    });
    ctx += '\n';
  }

  if (costs && costs.length) {
    ctx += '### נתוני עלות אזור ' + region + ' (₪, 2026):\n';
    var byType = {};
    costs.forEach(function(c) {
      var t = c.cost_type || 'אחר';
      if (!byType[t]) byType[t] = [];
      byType[t].push(c);
    });
    Object.keys(byType).forEach(function(type) {
      ctx += '\n**' + type + ':**\n';
      byType[type].forEach(function(c) {
        ctx += '- ' + c.line_item + ': ₪' + c.unit_price_ils + ' ל-' + c.unit
          + (c.quantity ? ' (כמות: ' + c.quantity + ' ' + c.quantity_unit + ')' : '')
          + (c.labor_hours ? ' · ' + c.labor_hours + ' שעות עבודה' : '') + '\n';
      });
    });
  }

  return ctx;
}

// ── Show PO preview in chat + "Fill PO" button ───────────────────────
function ragShowPOPreview(plan, region) {
  var history = document.getElementById('rag-chat-history');
  if (!history) return;

  var da = plan.damage_assessment || {};
  var rm = plan.recommended_method || {};
  var pd = plan.po_data || {};

  // Calculate totals
  var totalLabor = 0, totalMaterials = 0, totalQA = 0, totalOverhead = 0;
  (pd.sections||[]).forEach(function(sec) {
    var secTotal = (sec.items||[]).reduce(function(s,item){ return s + (item.quantity||0)*(item.unit_price||0); }, 0);
    if (sec.section_type==='LABOR')    totalLabor     += secTotal;
    if (sec.section_type==='MATERIALS')totalMaterials += secTotal;
    if (sec.section_type==='QA')       totalQA        += secTotal;
    if (sec.section_type==='OVERHEAD') totalOverhead  += secTotal;
  });
  var totalEx = totalLabor + totalMaterials + totalQA + totalOverhead;
  var vatAmt  = totalEx * 0.18;
  var totalInc= totalEx + vatAmt;
  var fmt = function(n){ return '₪' + Math.round(n).toLocaleString('he-IL'); };

  var sevColor = da.severity==='CRITICAL' ? '#ef4444' : da.severity==='MODERATE' ? '#f59e0b' : '#3b82f6';

  var html = '<div style="background:#1e1e35;border:2px solid rgba(201,168,76,0.4);border-radius:14px;padding:18px;direction:rtl;font-family:Heebo,sans-serif;">';

  // Header
  html += '<div style="font-size:16px;font-weight:900;color:#c9a84c;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:10px;">📄 תוכנית תיקון ממ"ד — ' + (pd.project_name||'שיקום ממ"ד') + '</div>';

  // Damage + method badges
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">'
    + '<div style="background:' + sevColor + '20;border:1px solid ' + sevColor + ';color:' + sevColor + ';padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;">'
    + (da.severity==='CRITICAL'?'🔴':da.severity==='MODERATE'?'🟡':'🔵') + ' ' + (da.severity||'') + ' · ' + (da.blast_tier||'T2') + '</div>'
    + '<div style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);color:#c4b5fd;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;">🔧 ' + (rm.method_name||'שיקום מבני') + '</div>'
    + '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#888;padding:5px 12px;border-radius:20px;font-size:11px;">' + (da.affected_area_m2||'?') + ' מ"ר · ' + (pd.duration_days||'?') + ' ימים</div>'
    + (rm.hfc_approval_required ? '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:5px 12px;border-radius:20px;font-size:11px;">⚠️ נדרש אישור פיקוד העורף</div>' : '')
    + '</div>';

  // Rationale
  if (rm.rationale) {
    html += '<div style="background:rgba(201,168,76,0.08);border-right:3px solid #c9a84c;padding:8px 14px;margin-bottom:14px;font-size:12px;color:#ccc;">' + rm.rationale.replace(/</g,'&lt;') + '</div>';
  }

  // Cost breakdown table
  html += '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">'
    + '<thead><tr style="background:#242438;">'
    + '<th style="padding:8px;text-align:right;color:#c9a84c;border-bottom:1px solid rgba(255,255,255,0.1);">שלב</th>'
    + '<th style="padding:8px;text-align:center;color:#c9a84c;border-bottom:1px solid rgba(255,255,255,0.1);">פריטים</th>'
    + '<th style="padding:8px;text-align:left;color:#c9a84c;border-bottom:1px solid rgba(255,255,255,0.1);">סה"כ</th>'
    + '</tr></thead><tbody>';

  (pd.sections||[]).forEach(function(sec) {
    var secTotal = (sec.items||[]).reduce(function(s,item){ return s + (item.quantity||0)*(item.unit_price||0); }, 0);
    var typeColors = { LABOR:'rgba(59,130,246,0.2)', MATERIALS:'rgba(34,197,94,0.15)', QA:'rgba(245,158,11,0.15)', OVERHEAD:'rgba(156,163,175,0.15)' };
    var bg = typeColors[sec.section_type] || 'transparent';
    html += '<tr style="background:' + bg + ';border-bottom:1px solid rgba(255,255,255,0.05);">'
      + '<td style="padding:7px 10px;font-weight:700;color:#fff;">' + (sec.section_title||'') + '</td>'
      + '<td style="padding:7px 10px;text-align:center;color:#888;">' + (sec.items||[]).length + '</td>'
      + '<td style="padding:7px 10px;text-align:left;font-weight:700;color:#22c55e;direction:ltr;">' + fmt(secTotal) + '</td>'
      + '</tr>';
  });

  html += '</tbody></table>';

  // Totals summary
  html += '<div style="background:#242438;border-radius:10px;padding:12px 16px;margin-bottom:14px;">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:12px;">'
    + '<div style="color:#888;">🔵 עבודה:</div><div style="text-align:left;direction:ltr;color:#93c5fd;font-weight:700;">' + fmt(totalLabor) + '</div>'
    + '<div style="color:#888;">🟢 חומרים:</div><div style="text-align:left;direction:ltr;color:#86efac;font-weight:700;">' + fmt(totalMaterials) + '</div>'
    + (totalQA ? '<div style="color:#888;">🟡 בדיקות QA:</div><div style="text-align:left;direction:ltr;color:#fde68a;font-weight:700;">' + fmt(totalQA) + '</div>' : '')
    + (totalOverhead ? '<div style="color:#888;">⚪ תקורה:</div><div style="text-align:left;direction:ltr;color:#d1d5db;font-weight:700;">' + fmt(totalOverhead) + '</div>' : '')
    + '</div>'
    + '<div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:13px;">'
    + '<div style="color:#aaa;">סה"כ לפני מע"מ:</div><div style="text-align:left;direction:ltr;color:#fff;font-weight:700;">' + fmt(totalEx) + '</div>'
    + '<div style="color:#aaa;">מע"מ 18%:</div><div style="text-align:left;direction:ltr;color:#fff;">' + fmt(vatAmt) + '</div>'
    + '<div style="color:#c9a84c;font-size:15px;font-weight:900;">סה"כ לתשלום:</div><div style="text-align:left;direction:ltr;color:#c9a84c;font-size:15px;font-weight:900;">' + fmt(totalInc) + '</div>'
    + '</div></div>';

  // Engineering note + action button
  if (da.engineering_note) {
    html += '<div style="font-size:11px;color:#888;margin-bottom:12px;padding:6px 10px;background:rgba(239,68,68,0.08);border-radius:6px;">⚠️ ' + da.engineering_note.replace(/</g,'&lt;') + '</div>';
  }

  html += '<button onclick="ragFillPOForm()" style="width:100%;background:linear-gradient(135deg,#9a6f00,#c9a84c);border:none;color:#1a1a2e;padding:13px;border-radius:12px;cursor:pointer;font-family:Heebo,sans-serif;font-size:14px;font-weight:900;">'
    + '📄 פתח הזמנת עבודה ומלא אוטומטית ←'
    + '</button>';

  html += '</div>';

  var bubble = document.createElement('div');
  bubble.innerHTML = html;
  history.appendChild(bubble);
  history.scrollTo(0, history.scrollHeight);
}



// ══════════════════════════════════════════════════════════════════════
// FILL THE EXISTING PO FORM — the money shot
// ══════════════════════════════════════════════════════════════════════
function ragFillPOForm() {
  var plan = _ragPOPlan;
  if (!plan || !plan.po_data) { showToast('אין תוכנית — צור קודם', 'error'); return; }

  var pd = plan.po_data;
  var da = plan.damage_assessment || {};
  var rm = plan.recommended_method || {};

  // ── Navigate to PO form ──────────────────────────────────────────
  switchTab('crm');
  setTimeout(function() {
    showPage('new-po');

    // ── Fill project details ───────────────────────────────────────
    var setVal = function(id, val) {
      var el = document.getElementById(id);
      if (el && val) el.value = val;
    };

    setVal('pof-project-name', pd.project_name || 'שיקום ממ"ד — נזק הדף');
    setVal('pof-project-location', pd.project_location || '');

    // Dates
    var today    = new Date();
    var startDay = new Date(today);
    startDay.setDate(today.getDate() + (pd.start_date_days_from_now || 2));
    var endDay   = new Date(startDay);
    endDay.setDate(startDay.getDate() + (pd.duration_days || 14));

    setVal('pof-start-date', startDay.toISOString().split('T')[0]);
    setVal('pof-end-date',   endDay.toISOString().split('T')[0]);
    setVal('pof-quote-ref',  'Q-MAMAD-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*900)+100));
    setVal('pof-tender-ref', 'שיקום ממ"ד · ' + (da.blast_tier||'T2') + ' · ' + (rm.method_id||'RECAST'));

    // ── Build notes from damage assessment ────────────────────────
    var notes = '📋 תוכנית שיקום ממ"ד — נוצרה אוטומטית מ-RAG\n\n';
    notes += '🔍 אבחון נזק: ' + (da.damage_types||[]).join(', ') + '\n';
    notes += '📐 שטח פגוע: ' + (da.affected_area_m2||'?') + ' מ"ר\n';
    notes += '🔧 שיטת תיקון: ' + (rm.method_name||'שיקום מבני') + '\n';
    notes += '⚡ מוסמך לממ"ד: ' + (rm.certifiable ? 'כן' : 'לא') + '\n';
    if (da.engineering_note) notes += '⚠️ ' + da.engineering_note + '\n';
    if (rm.hfc_approval_required) notes += '🔴 נדרש אישור פיקוד העורף לפני תחילת עבודה\n';
    notes += '\n' + (pd.notes || 'הזמנה זו כפופה לחוזה הראשי ולנספחי הבטיחות');
    setVal('pof-notes', notes);

    // ── Clear existing rows + fill new ones ───────────────────────
    var tbody = document.getElementById('pof-items-body');
    if (tbody) tbody.innerHTML = '';
    window.pofRowCount = 0;

    var allItems = [];

    // Add section header rows + items
    (pd.sections||[]).forEach(function(sec) {
      // Section divider row
      var secTypeLabel = { LABOR:'🔵 עבודה', MATERIALS:'🟢 חומרים', QA:'🟡 בדיקות QA', OVERHEAD:'⚪ תקורה' };
      var headerDesc = '━━━ ' + (secTypeLabel[sec.section_type]||sec.section_type) + ': ' + (sec.section_title||'') + ' ━━━';
      pofAddRow(headerDesc, 'ס"ע', '', '', false);

      // Lock the header row (make desc readonly, grey background)
      if (tbody) {
        var lastRow = tbody.rows[tbody.rows.length-1];
        if (lastRow) {
          lastRow.style.background = 'rgba(255,255,255,0.03)';
          var descInput = lastRow.querySelector('input[type="text"]');
          if (descInput) {
            descInput.readOnly = true;
            descInput.style.fontWeight = '700';
            descInput.style.color = '#c9a84c';
            descInput.style.background = 'transparent';
            descInput.style.border = 'none';
          }
        }
      }

      // Item rows
      (sec.items||[]).forEach(function(item) {
        var unitMap = {
          'מ"ר': 'מ"ר', 'מ"ק': 'מ"ק', 'ק"ג': 'ק"ג', 'ס"ע': 'ס"ע',
          'יחידה': 'יח\'', 'מ\'': 'מ\'', 'ל': 'ל\'', 'ק"ג': 'ק"ג'
        };
        var unit = unitMap[item.unit] || item.unit || 'ס"ע';
        var desc = item.description
          + (item.standard_ref ? ' [' + item.standard_ref + ']' : '')
          + (item.trade ? ' · ' + item.trade : '');
        pofAddRow(desc, unit, item.quantity||1, item.unit_price||0, true);
      });
    });

    pofRecalc();
    showToast('✅ הזמנת עבודה מולאה — ' + (pd.sections||[]).reduce(function(s,sec){return s+(sec.items||[]).length;},0) + ' פריטים', 'success');

    // Scroll to top of PO form
    setTimeout(function(){
      document.getElementById('page-new-po')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 300);

  }, 400);
}


// ── Format Claude markdown/HTML analysis text for display ────────────
function ragFormatAnalysis(text) {
  if (!text) return '';
  var NL = String.fromCharCode(10);
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#c4b5fd;">$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .split(NL).join('<br>')
    .replace(/\\n/g, '<br>');
}


// ── RAG Progress Panel Helpers ─────────────────────────────────────────

function ragShowProgress() {
  var history = document.getElementById('rag-chat-history');
  if (!history) return null;
  var emptyState = history.querySelector('[style*="text-align:center"]');
  if (emptyState) emptyState.remove();

  var el = document.createElement('div');
  el.id = 'rag-po-progress';
  el.style.cssText = 'background:#1e1e35;border:2px solid rgba(201,168,76,0.5);border-radius:14px;padding:18px 20px;margin-bottom:4px;font-family:Heebo,sans-serif;direction:rtl;';
  el.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap;">'
    + '<div style="font-size:14px;font-weight:800;color:#c9a84c;" id="rag-prog-msg">⏳ מתחיל יצירת הזמנת עבודה...</div>'
    + '<div style="display:flex;gap:16px;align-items:center;">'
    +   '<div style="text-align:center;">'
    +     '<div id="rag-prog-time" style="font-size:20px;font-weight:900;color:#f59e0b;font-family:monospace;">0ש</div>'
    +     '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;">זמן</div>'
    +   '</div>'
    +   '<div style="text-align:center;">'
    +     '<div id="rag-prog-tokens" style="font-size:20px;font-weight:900;color:#c4b5fd;font-family:monospace;">~0</div>'
    +     '<div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;">טוקנים</div>'
    +   '</div>'
    + '</div></div>'
    + '<div style="background:rgba(255,255,255,0.06);border-radius:20px;height:10px;overflow:hidden;margin-bottom:12px;">'
    +   '<div id="rag-prog-bar" style="height:100%;background:linear-gradient(90deg,#9a6f00,#c9a84c);border-radius:20px;width:5%;transition:width 0.5s ease;"></div>'
    + '</div>'
    + '<div style="font-size:11px;color:#555;direction:rtl;">'
    +   '🔍 שולף נתונים מ-Supabase → 🧠 Claude מנתח תמונה + RAG → 📄 מייצר JSON → ממלא הזמנת עבודה'
    + '</div>';

  history.appendChild(el);
  history.scrollTo(0, history.scrollHeight);
  return el;
}

function ragUpdateProgress(msg, pct, timeStr, tokens) {
  var msgEl    = document.getElementById('rag-prog-msg');
  var barEl    = document.getElementById('rag-prog-bar');
  var timeEl   = document.getElementById('rag-prog-time');
  var tokensEl = document.getElementById('rag-prog-tokens');
  if (msg    && msgEl)    msgEl.textContent    = msg;
  if (pct    && barEl)    barEl.style.width    = pct + '%';
  if (timeStr && timeEl)  timeEl.textContent   = timeStr;
  if (tokens  && tokensEl) tokensEl.textContent = '~' + Math.round(tokens).toLocaleString();
  var history = document.getElementById('rag-chat-history');
  if (history) history.scrollTo(0, history.scrollHeight);
}

function ragRemoveProgress() {
  var el = document.getElementById('rag-po-progress');
  if (el) el.remove();
}

// ── Persistent error display in chat (not toast) ─────────────────────
function ragShowError(shortMsg, fullDetail) {
  var hist = document.getElementById('rag-chat-history');
  if (!hist) return;
  var wrap = document.createElement('div');
  wrap.style.cssText = 'background:rgba(239,68,68,0.08);border:2px solid rgba(239,68,68,0.5);border-radius:14px;padding:16px 18px;font-family:Heebo,sans-serif;direction:rtl;';
  var h = document.createElement('div');
  h.style.cssText = 'font-size:14px;font-weight:900;color:#ef4444;margin-bottom:8px;';
  h.textContent = '❌ שגיאה ביצירת הזמנת עבודה';
  var m = document.createElement('div');
  m.style.cssText = 'font-size:13px;color:#fca5a5;margin-bottom:10px;line-height:1.6;';
  m.textContent = shortMsg || 'שגיאה לא ידועה';
  wrap.appendChild(h); wrap.appendChild(m);
  if (fullDetail && fullDetail !== shortMsg) {
    var det = document.createElement('details');
    det.style.cssText = 'font-size:11px;color:#888;cursor:pointer;margin-bottom:8px;';
    var sum = document.createElement('summary'); sum.textContent = 'פרטים טכניים';
    var pre = document.createElement('pre');
    pre.style.cssText = 'overflow:auto;max-height:100px;background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;direction:ltr;white-space:pre-wrap;font-size:10px;';
    pre.textContent = String(fullDetail).substring(0, 500);
    det.appendChild(sum); det.appendChild(pre); wrap.appendChild(det);
  }
  var acts = document.createElement('div');
  acts.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';
  var retry = document.createElement('button');
  retry.style.cssText = 'background:rgba(201,168,76,0.2);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;';
  retry.textContent = '🔄 נסה שוב';
  retry.onclick = function(){ wrap.remove(); ragGeneratePO(); };
  var close = document.createElement('button');
  close.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#888;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;';
  close.textContent = '✕ סגור';
  close.onclick = function(){ wrap.remove(); };
  acts.appendChild(retry); acts.appendChild(close); wrap.appendChild(acts);
  hist.appendChild(wrap); hist.scrollTo(0, hist.scrollHeight);
}

// ── Persistent success + navigation instruction ──────────────────────
function ragShowSuccessNav(title, instruction) {
  var hist = document.getElementById('rag-chat-history');
  if (!hist) return;
  var wrap = document.createElement('div');
  wrap.style.cssText = 'background:rgba(34,197,94,0.08);border:2px solid rgba(34,197,94,0.4);border-radius:14px;padding:14px 18px;font-family:Heebo,sans-serif;direction:rtl;display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
  var icon = document.createElement('div');
  icon.style.cssText = 'font-size:22px;'; icon.textContent = '✅';
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;min-width:160px;';
  var t = document.createElement('div');
  t.style.cssText = 'font-size:14px;font-weight:900;color:#22c55e;margin-bottom:4px;';
  t.textContent = title;
  var ins = document.createElement('div');
  ins.style.cssText = 'font-size:12px;color:#86efac;line-height:1.5;';
  ins.textContent = instruction;
  body.appendChild(t); body.appendChild(ins);
  var navBtn = document.createElement('button');
  navBtn.style.cssText = 'background:linear-gradient(135deg,#9a6f00,#c9a84c);border:none;color:#1a1a2e;padding:10px 18px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:900;white-space:nowrap;';
  navBtn.textContent = '→ לוח בקרה · הזמנות עבודה';
  navBtn.onclick = function(){ switchTab('crm'); setTimeout(function(){ showPage('new-po'); }, 400); };
  wrap.appendChild(icon); wrap.appendChild(body); wrap.appendChild(navBtn);
  hist.appendChild(wrap); hist.scrollTo(0, hist.scrollHeight);
}


function ragSafeParseJSON(raw) {
  if (!raw) return null;

  // Step 1: Strip markdown fences
  raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Step 2: Extract JSON object boundaries
  var start = raw.indexOf('{');
  var end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  raw = raw.substring(start, end + 1);

  // Step 3: Try direct parse first
  try { return JSON.parse(raw); } catch(e1) { /* continue to repair */ }

  // Step 4: Repair common issues line by line (avoids regex-with-newlines)
  var lines = raw.split('\n');
  var repaired = lines.map(function(line) {
    // Replace Hebrew double-quote chars that break JSON
    return line.replace(/״/g, '\"').replace(/׳/g, "'");
  }).join('\n');

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  // Fix <number> placeholders
  repaired = repaired.replace(/:\s*<number>/g, ': 0');
  repaired = repaired.replace(/:\s*<number or null>/g, ': null');
  repaired = repaired.replace(/:\s*"true\|false"/g, ': false');
  repaired = repaired.replace(/:\s*"RECAST\|JACKETING"/g, ': "RECAST"');
  repaired = repaired.replace(/:\s*"T1\|T2\|T3"/g, ': "T2"');
  repaired = repaired.replace(/:\s*"CRITICAL\|MODERATE\|MINOR"/g, ': "MODERATE"');

  try { return JSON.parse(repaired); } catch(e2) { /* continue */ }

  // Step 5: Most aggressive — remove all actual newlines inside string values
  // Walk char by char tracking if inside a string
  var chars  = repaired.split('');
  var result = [];
  var inStr  = false;
  var esc    = false;
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    if (esc) { result.push(ch); esc = false; continue; }
    if (ch === '\\') { result.push(ch); esc = true; continue; }
    if (ch === '"') { inStr = !inStr; result.push(ch); continue; }
    if (inStr && (ch === '\n' || ch === '\r')) {
      result.push(' '); // replace bare newline inside string with space
      continue;
    }
    result.push(ch);
  }
  var cleaned = result.join('');
  // One more trailing-comma pass
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try { return JSON.parse(cleaned); } catch(e3) {
    console.error('ragSafeParseJSON all attempts failed. First 500 chars:', raw.substring(0, 500));
    return null;
  }
}


async function ragSavePhotoQA(photoB64, damageAnalysis, poJsonPlan, questions, answers, projectId) {
  try {
    var region = document.getElementById('rag-region-sel')?.value || 'מרכז';
    var payload = {
      query_text:           '📸 ניתוח תמונת נזק — ' + new Date().toLocaleString('he-IL'),
      query_lang:           'he',
      components_retrieved: ['WALL-BLAST-T2-001'],
      response_text:        JSON.stringify({
        damage_analysis:  damageAnalysis || '',
        po_plan_summary:  poJsonPlan ? {
          method:   (poJsonPlan.recommended_method||{}).method_name,
          severity: (poJsonPlan.damage_assessment||{}).severity,
          area_m2:  (poJsonPlan.damage_assessment||{}).affected_area_m2,
          sections: (poJsonPlan.po_data?.sections||[]).length
        } : null,
        conversation_qa: (questions||[]).map(function(q,i){
          return { question: q, answer: (answers||[])[i] || '' };
        }),
        region: region
      }, null, 2),
      project_id:  projectId || null,
      user_context: 'photo_analysis_with_po'
    };

    await fetch(SB_URL + '/rest/v1/mamad_query_log', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(payload)
    });
  } catch(e) {
    console.warn('ragSavePhotoQA save failed (non-critical):', e.message);
  }
}


// ══ RAG HISTORY TAB ═══════════════════════════════════════════════════

function ragSwitchSubTab(tab) {
  document.getElementById('rag-sub-chat').style.display    = tab === 'chat'    ? 'block' : 'none';
  document.getElementById('rag-sub-history').style.display = tab === 'history' ? 'block' : 'none';
  var cb = document.getElementById('rag-subtab-chat');
  var hb = document.getElementById('rag-subtab-history');
  if (cb) { cb.style.background = tab==='chat'    ? '#7c3aed' : 'transparent'; cb.style.color = tab==='chat'    ? '#fff' : '#888'; }
  if (hb) { hb.style.background = tab==='history' ? '#7c3aed' : 'transparent'; hb.style.color = tab==='history' ? '#fff' : '#888'; }
  if (tab === 'history') ragHistLoad();
}

// ── Load history from mamad_query_log ────────────────────────────────
async function ragHistLoad() {
  var list    = document.getElementById('rag-hist-list');
  var stats   = document.getElementById('rag-hist-stats');
  var filter  = document.getElementById('rag-hist-filter')?.value || 'all';
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:12px;">⏳ טוען...</div>';

  try {
    var res = await fetch(
      SB_URL + '/rest/v1/mamad_query_log?select=id,query_text,user_context,tokens_used,cost_usd,created_at&order=created_at.desc&limit=50',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    var items = res.ok ? await res.json() : [];

    if (!items || !items.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#444;font-size:13px;">אין ניתוחים שמורים עדיין</div>';
      return;
    }

    // Filter
    var filtered = items.filter(function(item) {
      if (filter === 'all')   return true;
      if (filter === 'photo') return (item.user_context||'').includes('photo') || (item.query_text||'').includes('📸');
      if (filter === 'po')    return (item.user_context||'').includes('po') || (item.query_text||'').includes('הזמנת');
      if (filter === 'chat')  return !(item.user_context||'').includes('photo') && !(item.user_context||'').includes('po');
      return true;
    });

    // Stats
    var totalTokens = items.reduce(function(s,i){ return s + (i.tokens_used||0); }, 0);
    var totalCost   = items.reduce(function(s,i){ return s + (parseFloat(i.cost_usd)||0); }, 0);
    var photoCount  = items.filter(function(i){ return (i.user_context||'').includes('photo'); }).length;
    var poCount     = items.filter(function(i){ return (i.user_context||'').includes('po'); }).length;

    if (stats) {
      var sc = function(bg, val, label) {
        return '<div style="background:' + bg + ';border-radius:10px;padding:10px 14px;text-align:center;">'
          + '<div style="font-size:18px;font-weight:900;color:#fff;">' + val + '</div>'
          + '<div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:2px;">' + label + '</div></div>';
      };
      stats.innerHTML =
        sc('rgba(139,92,246,0.25)', filtered.length, 'ניתוחים')
        + sc('rgba(59,130,246,0.2)', photoCount, '📸 תמונות')
        + sc('rgba(201,168,76,0.25)', poCount, '📄 הזמנות')
        + sc('rgba(34,197,94,0.2)', '$' + totalCost.toFixed(2), 'עלות AI');
    }

    if (!filtered.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:12px;">אין תוצאות לסינון זה</div>';
      return;
    }

    // Render list
    list.innerHTML = filtered.map(function(item) {
      var date = new Date(item.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      var ctx  = item.user_context || 'chat';
      var icon = ctx.includes('photo') ? '📸' : ctx.includes('po') ? '📄' : '💬';
      var title = (item.query_text || '').substring(0, 80).replace(/</g,'&lt;');
      var tokens= item.tokens_used ? item.tokens_used.toLocaleString() + ' טוקנים' : '';
      var cost  = item.cost_usd ? '$' + parseFloat(item.cost_usd).toFixed(3) : '';
      var borderColor = ctx.includes('photo') ? '#3b82f6' : ctx.includes('po') ? '#c9a84c' : '#7c3aed';

      return '<div style="background:#242438;border:1px solid rgba(255,255,255,0.06);border-right:4px solid ' + borderColor + ';border-radius:12px;padding:12px 16px;cursor:pointer;transition:background .15s;" '
        + 'onclick="ragHistShowDetail(\'' + item.id + '\')" '
        + 'onmouseover="this.style.background=\'rgba(139,92,246,0.08)\'" onmouseout="this.style.background=\'#242438\'">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span style="font-size:20px;">' + icon + '</span>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;">' + title + '</div>'
        + '<div style="font-size:11px;color:#555;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;">'
        + '<span>📅 ' + date + '</span>'
        + (tokens ? '<span>⚡ ' + tokens + '</span>' : '')
        + (cost   ? '<span>💰 ' + cost   + '</span>' : '')
        + '</div></div>'
        + '<span style="font-size:18px;color:#444;">›</span>'
        + '</div></div>';
    }).join('');

  } catch(e) {
    list.innerHTML = '<div style="color:#ef4444;padding:14px;font-size:12px;direction:rtl;">שגיאה: ' + e.message + '</div>';
  }
}

// ── Show full detail of one history item ─────────────────────────────
async function ragHistShowDetail(id) {
  var modal   = document.getElementById('rag-hist-detail');
  var titleEl = document.getElementById('rag-detail-title');
  var bodyEl  = document.getElementById('rag-detail-body');
  if (!modal || !bodyEl) return;

  modal.style.display = 'block';
  if (bodyEl) bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:#555;">⏳ טוען...</div>';

  try {
    var res  = await fetch(
      SB_URL + '/rest/v1/mamad_query_log?id=eq.' + id + '&select=*',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    var rows = res.ok ? await res.json() : [];
    var item = rows[0];
    if (!item) throw new Error('לא נמצא');

    var date = new Date(item.created_at).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    var ctx  = item.user_context || 'chat';
    var icon = ctx.includes('photo') ? '📸' : ctx.includes('po') ? '📄' : '💬';
    if (titleEl) titleEl.textContent = icon + ' ' + date;

    var resp = null;
    try { resp = typeof item.response_text === 'string' ? JSON.parse(item.response_text) : item.response_text; } catch(e){}

    var html = '';

    // Meta bar
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;font-size:11px;">';
    if (item.tokens_used) html += '<div style="background:rgba(139,92,246,0.15);border-radius:20px;padding:4px 12px;color:#c4b5fd;">⚡ ' + item.tokens_used.toLocaleString() + ' טוקנים</div>';
    if (item.cost_usd)    html += '<div style="background:rgba(34,197,94,0.12);border-radius:20px;padding:4px 12px;color:#86efac;">💰 $' + parseFloat(item.cost_usd).toFixed(4) + '</div>';
    if (item.project_id)  html += '<div style="background:rgba(59,130,246,0.12);border-radius:20px;padding:4px 12px;color:#93c5fd;">📁 פרויקט</div>';
    html += '</div>';

    // Query
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">שאלה / נושא:</div>';
    html += '<div style="background:rgba(139,92,246,0.1);border-radius:8px;padding:10px 14px;font-size:13px;color:#e2e8f0;direction:rtl;">' + (item.query_text||'').replace(/</g,'&lt;') + '</div>';
    html += '</div>';

    // If it's a photo analysis — show damage analysis
    if (resp && resp.damage_analysis) {
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-size:11px;font-weight:800;color:#ef4444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">🔍 ניתוח נזק Vision:</div>';
      html += '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;font-size:12px;color:#fca5a5;direction:rtl;line-height:1.8;">' + ragFormatAnalysis(resp.damage_analysis||'') + '</div>';
      html += '</div>';
    }

    // PO plan summary
    if (resp && resp.po_plan_summary) {
      var s = resp.po_plan_summary;
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-size:11px;font-weight:800;color:#c9a84c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📄 סיכום הזמנת עבודה:</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      var sc2 = function(label, val, color) {
        return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 12px;">'
          + '<div style="font-size:10px;color:#666;margin-bottom:2px;">' + label + '</div>'
          + '<div style="font-size:13px;font-weight:700;color:' + (color||'#fff') + ';">' + (val||'—') + '</div></div>';
      };
      html += sc2('שיטת תיקון', s.method, '#c4b5fd');
      html += sc2('חומרה', s.severity, s.severity==='CRITICAL'?'#ef4444':s.severity==='MODERATE'?'#f59e0b':'#3b82f6');
      html += sc2('שטח פגוע', s.area_m2 ? s.area_m2 + ' מ"ר' : '—', '#93c5fd');
      html += sc2('מספר שלבים', s.sections ? s.sections + ' שלבים' : '—', '#86efac');
      html += '</div></div>';
    }

    // Q&A from conversation
    if (resp && resp.conversation_qa && resp.conversation_qa.length) {
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-size:11px;font-weight:800;color:#93c5fd;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">💬 שאלות ותשובות (' + resp.conversation_qa.length + '):</div>';
      resp.conversation_qa.forEach(function(qa, i) {
        html += '<div style="margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">';
        html += '<div style="background:rgba(139,92,246,0.12);padding:8px 12px;font-size:12px;font-weight:700;color:#c4b5fd;direction:rtl;">'
          + 'ש' + (i+1) + ': ' + (qa.question||'').substring(0,120).replace(/</g,'&lt;') + '</div>';
        html += '<div style="padding:8px 12px;font-size:12px;color:#ccc;direction:rtl;line-height:1.7;">'
          + (qa.answer||'').substring(0,400).replace(/</g,'&lt;').replace(/\n/g,'<br>')
          + (qa.answer && qa.answer.length > 400 ? '...' : '') + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Raw response fallback (chat-only queries)
    if (!resp || (!resp.damage_analysis && !resp.conversation_qa)) {
      var rawText = typeof item.response_text === 'string' ? item.response_text : JSON.stringify(item.response_text, null, 2);
      if (rawText) {
        html += '<div style="margin-bottom:12px;">';
        html += '<div style="font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">תגובת AI:</div>';
        html += '<div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:10px 14px;font-size:12px;color:#aaa;direction:rtl;line-height:1.7;max-height:300px;overflow-y:auto;">'
          + rawText.substring(0,1500).replace(/</g,'&lt;').replace(/\n/g,'<br>')
          + (rawText.length > 1500 ? '<div style="color:#555;margin-top:8px;">... ' + (rawText.length-1500) + ' תווים נוספים</div>' : '')
          + '</div></div>';
      }
    }

    // Components retrieved
    if (item.components_retrieved && item.components_retrieved.length) {
      var comps = typeof item.components_retrieved === 'string' ? JSON.parse(item.components_retrieved) : item.components_retrieved;
      if (comps.length) {
        html += '<div style="margin-top:8px;font-size:11px;color:#555;">📚 רכיבים: '
          + comps.map(function(c){ return '<span style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);color:#a78bfa;padding:2px 8px;border-radius:8px;margin-right:4px;">' + c + '</span>'; }).join('')
          + '</div>';
      }
    }

    if (bodyEl) bodyEl.innerHTML = html;

  } catch(e) {
    if (bodyEl) bodyEl.innerHTML = '<div style="color:#ef4444;padding:14px;font-size:12px;">שגיאה: ' + e.message + '</div>';
  }
}



var MC = {
  all:      [],    // full dataset
  filtered: [],    // after search/filter
  selected: {},    // { item_code: item }
  page:     0,
  pageSize: 50,
  lastQ:    '',
  timer:    null
};

// ── Init ──────────────────────────────────────────────────────────────
async function micharonTabInit() {
  if (MC.all.length > 0) { mcRender(); return; }
  mcStatus('⏳ טוען 2,683 סעיפי מחירון...', true);
  try {
    var res = await fetch(
      SB_URL + '/rest/v1/price_items?select=item_code,chapter,chapter_name,sub_chapter_name,description,unit,price&order=item_code.asc&limit=3000',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Range: '0-2999' } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status + ' — הרץ micharon_schema SQL תחילה');
    MC.all = (await res.json()) || [];
    MC.filtered = MC.all;
    mcBuildChapterFilter();
    mcRenderStats();
    mcRender();
    mcStatus('');
  } catch(e) {
    mcStatus('❌ ' + e.message, true);
    var b = document.getElementById('mc-body');
    if (b) {
      b.innerHTML = '';
      var tr = b.insertRow(); var td = tr.insertCell();
      td.colSpan = 6; td.style.cssText = 'text-align:center;padding:30px;color:#ef4444;font-size:12px;';
      td.textContent = '❌ ' + e.message + ' — הרץ micharon_schema_25032026.sql + micharon_data_25032026.sql בסופאבייס';
    }
  }
}

function mcBuildChapterFilter() {
  var sel = document.getElementById('mc-chapter-sel');
  if (!sel) return;
  var chapters = {};
  MC.all.forEach(function(i) { if (!chapters[i.chapter]) chapters[i.chapter] = i.chapter_name || ('פרק ' + i.chapter); });
  sel.innerHTML = '';
  var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = 'כל הפרקים (' + MC.all.length + ')'; sel.appendChild(opt0);
  Object.keys(chapters).sort(function(a,b){ return parseInt(a)-parseInt(b); }).forEach(function(ch) {
    var cnt = MC.all.filter(function(i){ return i.chapter===ch; }).length;
    var opt = document.createElement('option'); opt.value = ch;
    opt.textContent = (chapters[ch]||'').replace('פרק 0','פ ').split(':').pop().trim().substring(0,28) + ' (' + cnt + ')';
    sel.appendChild(opt);
  });
}

function mcRenderStats() {
  var el = document.getElementById('mc-stats');
  if (!el) return;
  var chs = new Set(MC.all.map(function(i){ return i.chapter; })).size;
  var maxP = Math.max.apply(null, MC.all.map(function(i){ return parseFloat(i.price)||0; }));
  el.innerHTML = '';
  [
    ['rgba(34,197,94,0.18)',  MC.all.length.toLocaleString(), 'סעיפים'],
    ['rgba(59,130,246,0.18)', chs, 'פרקים'],
    ['rgba(245,158,11,0.18)', '₪' + Math.round(maxP/1000) + 'K', 'מחיר מקס'],
    ['rgba(139,92,246,0.18)', 'דצ׳ 2025', 'עדכון']
  ].forEach(function(s) {
    var d = document.createElement('div');
    d.style.cssText = 'background:' + s[0] + ';border-radius:9px;padding:9px 12px;text-align:center;';
    var v = document.createElement('div'); v.style.cssText = 'font-size:15px;font-weight:900;color:#fff;'; v.textContent = s[1];
    var l = document.createElement('div'); l.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;'; l.textContent = s[2];
    d.appendChild(v); d.appendChild(l); el.appendChild(d);
  });
}

// ── Search & Filter ───────────────────────────────────────────────────
function mcSearchDebounce(q) {
  clearTimeout(MC.timer);
  MC.timer = setTimeout(function(){ mcSearch(q); }, 280);
}

function mcSearch(q) {
  MC.lastQ = (q||'').trim();
  mcFilter();
}

function mcFilter() {
  var q  = MC.lastQ.toLowerCase();
  var ch = (document.getElementById('mc-chapter-sel')?.value) || '';
  var un = (document.getElementById('mc-unit-sel')?.value)    || '';

  MC.filtered = MC.all.filter(function(item) {
    if (ch && item.chapter !== ch) return false;
    if (un && item.unit    !== un) return false;
    if (!q) return true;
    return (item.description||'').toLowerCase().includes(q)
        || (item.item_code||'').includes(q)
        || (item.sub_chapter_name||'').toLowerCase().includes(q);
  });
  MC.page = 0;
  mcRender();
}

// ── Render table ──────────────────────────────────────────────────────
function mcRender() {
  var body = document.getElementById('mc-body');
  var cntEl  = document.getElementById('mc-count');
  var pagerEl= document.getElementById('mc-pager');
  if (!body) return;

  var start = MC.page * MC.pageSize;
  var end   = Math.min(start + MC.pageSize, MC.filtered.length);
  var slice = MC.filtered.slice(start, end);

  if (cntEl)  cntEl.textContent  = MC.filtered.length.toLocaleString() + ' סעיפים';
  if (pagerEl) pagerEl.textContent = 'עמוד ' + (MC.page+1) + ' / ' + Math.max(1, Math.ceil(MC.filtered.length/MC.pageSize));

  body.innerHTML = '';
  if (!slice.length) {
    var tr0 = body.insertRow(); var td0 = tr0.insertCell();
    td0.colSpan = 6; td0.style.cssText = 'text-align:center;padding:24px;color:#555;font-size:12px;';
    td0.textContent = 'לא נמצאו סעיפים';
    return;
  }

  var q = MC.lastQ.toLowerCase();
  slice.forEach(function(item) {
    var tr = body.insertRow();
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
    if (MC.selected[item.item_code]) tr.style.background = 'rgba(34,197,94,0.07)';

    // Checkbox
    var tdCb = tr.insertCell(); tdCb.style.cssText = 'padding:6px 10px;text-align:center;';
    var cb = document.createElement('input'); cb.type = 'checkbox';
    cb.style.cssText = 'accent-color:#22c55e;width:13px;height:13px;cursor:pointer;';
    cb.checked = !!MC.selected[item.item_code];
    cb.onchange = (function(it){ return function(){ if(this.checked) MC.selected[it.item_code]=it; else delete MC.selected[it.item_code]; }; })(item);
    tdCb.appendChild(cb);

    // Code
    var tdCode = tr.insertCell(); tdCode.style.cssText = 'padding:6px 10px;font-family:monospace;font-size:11px;color:#22c55e;white-space:nowrap;direction:ltr;';
    tdCode.textContent = item.item_code || '';

    // Description (with highlight)
    var tdDesc = tr.insertCell(); tdDesc.style.cssText = 'padding:6px 10px;font-size:12px;color:#e2e8f0;direction:rtl;line-height:1.5;max-width:380px;';
    var descText = (item.description||'');
    if (q && descText.toLowerCase().includes(q)) {
      var idx = descText.toLowerCase().indexOf(q);
      var mark = document.createElement('mark');
      mark.style.cssText = 'background:rgba(34,197,94,0.3);color:#fff;border-radius:2px;padding:0 2px;';
      mark.textContent = descText.substring(idx, idx + q.length);
      var span = document.createElement('span');
      span.appendChild(document.createTextNode(descText.substring(0, idx)));
      span.appendChild(mark);
      span.appendChild(document.createTextNode(descText.substring(idx + q.length)));
      tdDesc.appendChild(span);
    } else {
      tdDesc.textContent = descText;
    }

    // Unit
    var tdUnit = tr.insertCell(); tdUnit.style.cssText = 'padding:6px 10px;text-align:center;font-size:11px;color:#93c5fd;white-space:nowrap;';
    tdUnit.textContent = item.unit || '—';

    // Price
    var tdPrice = tr.insertCell(); tdPrice.style.cssText = 'padding:6px 10px;text-align:left;font-weight:700;color:#c9a84c;white-space:nowrap;direction:ltr;';
    var p = parseFloat(item.price)||0;
    tdPrice.textContent = p > 0 ? '₪' + p.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

    // Add button
    var tdBtn = tr.insertCell(); tdBtn.style.cssText = 'padding:6px 10px;text-align:center;';
    var btn = document.createElement('button');
    btn.textContent = '+ הזמנה';
    btn.style.cssText = 'background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:3px 8px;border-radius:5px;cursor:pointer;font-family:Heebo,sans-serif;font-size:10px;font-weight:700;';
    btn.onclick = (function(it){ return function(){ mcAddToPO(it); }; })(item);
    tdBtn.appendChild(btn);
  });
}

function mcPage(dir) {
  var max = Math.ceil(MC.filtered.length / MC.pageSize) - 1;
  MC.page = Math.max(0, Math.min(max, MC.page + dir));
  mcRender();
  document.getElementById('micharon-content')?.scrollTo(0, 0);
}

function mcSelectAll(checked) {
  MC.all.forEach(function(item) {
    if (checked) MC.selected[item.item_code] = item;
    else delete MC.selected[item.item_code];
  });
  mcRender();
}

// ── Add to PO ─────────────────────────────────────────────────────────
function mcAddToPO(item) {
  var desc  = '[' + item.item_code + '] ' + (item.description||'').substring(0, 70);
  var price = parseFloat(item.price)||0;
  var unit  = item.unit || "יח'";
  switchTab('crm');
  setTimeout(function(){
    showPage('new-po');
    setTimeout(function(){
      pofAddRow(desc, unit, '', price, true);
      showToast('✅ ' + item.item_code + ' נוסף — קבע כמות', 'success');
    }, 350);
  }, 250);
}

function mcSendToPO() {
  var items = Object.values(MC.selected);
  if (!items.length) { showToast('סמן סעיפים תחילה', 'error'); return; }
  switchTab('crm');
  setTimeout(function(){
    showPage('new-po');
    setTimeout(function(){
      items.forEach(function(item) {
        pofAddRow('[' + item.item_code + '] ' + (item.description||'').substring(0,70),
          item.unit||"יח'", '', parseFloat(item.price)||0, true);
      });
      showToast('✅ ' + items.length + ' סעיפים נוספו — קבע כמויות', 'success');
      MC.selected = {};
    }, 350);
  }, 250);
}

function mcExportCSV() {
  var items = Object.keys(MC.selected).length > 0 ? Object.values(MC.selected) : MC.filtered;
  var BOM = '\uFEFF';
  var csv = BOM + 'קוד,פרק,תיאור,יחידה,מחיר\n' + items.map(function(item) {
    var d = (item.description||'').replace(/"/g,'""');
    return '"' + item.item_code + '","' + (item.chapter_name||'') + '","' + d + '","' + (item.unit||'') + '",' + (item.price||'');
  }).join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a = Object.assign(document.createElement('a'), {href:url, download:'micharon_' + new Date().toISOString().split('T')[0] + '.csv'});
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 500);
  showToast('📥 ' + items.length + ' סעיפים יוצאו');
}

async function mcAIMatch() {
  var apiKey = (APP.config && APP.config.anthropic_key) || null;
  if (!apiKey) { showToast('הגדר מפתח Anthropic API', 'error'); return; }
  if (!MC.all.length) { showToast('טוען מחירון תחילה...', 'error'); return; }

  // Collect PO items currently in the open PO form
  var poItems = [];
  document.querySelectorAll('#pof-items-body tr').forEach(function(tr) {
    var inp = tr.querySelector('input[type="text"]');
    var txt = inp?.value?.trim() || '';
    if (txt && !txt.startsWith('━━━')) poItems.push(txt);
  });

  if (!poItems.length) {
    showToast('פתח הזמנת עבודה עם פריטים תחילה (לוח בקרה ← הזמנות עבודה)', 'error');
    return;
  }

  var panel = document.getElementById('mc-ai-panel');
  mcStatus('🧠 Claude מתאים ' + poItems.length + ' פריטים למחירון...', true);
  if (panel) { panel.style.display = 'block'; panel.innerHTML = ''; }
  var loadDiv = document.createElement('div');
  loadDiv.style.cssText = 'text-align:center;padding:20px;color:#888;font-size:13px;';
  loadDiv.textContent = '🧠 Claude מנתח ומתאים...';
  if (panel) panel.appendChild(loadDiv);

  // Build smart relevant subset of price list for Claude
  // Search each PO word against מחירון descriptions
  var queryWords = poItems.join(' ').split(/\s+/).filter(function(w){ return w.length > 2; });
  var scored = MC.all.map(function(item) {
    var score = queryWords.filter(function(w){ return (item.description||'').includes(w); }).length;
    return { item: item, score: score };
  }).filter(function(x){ return x.score > 0; })
    .sort(function(a,b){ return b.score - a.score; })
    .slice(0, 300)
    .map(function(x){ return x.item; });

  // Fallback: add all chapter-2 items (concrete) as baseline
  var ch2 = MC.all.filter(function(i){ return i.chapter === '2'; });
  var combined = scored.concat(ch2.filter(function(i){
    return !scored.find(function(s){ return s.item_code === i.item_code; });
  })).slice(0, 350);

  var priceList = combined.map(function(item) {
    return item.item_code + ' | ' + (item.description||'').substring(0, 55) + ' | ' + (item.unit||'') + ' | ' + (item.price||'0');
  }).join('\n');

  var prompt = 'אתה מומחה כתב כמויות ומחירון בנייה ישראלי. עברית בלבד.\n\n'
    + 'פריטים בהזמנת העבודה:\n'
    + poItems.map(function(d,i){ return (i+1) + '. ' + d; }).join('\n')
    + '\n\nמחירון משרד הבינוי (קוד | תיאור | יחידה | מחיר):\n'
    + priceList
    + '\n\nמשימה: עבור כל פריט — מצא ההתאמה הטובה ביותר:\n'
    + '- EXACT: זהה ממש\n- SIMILAR: דומה/קרוב\n- NONE: לא קיים במחירון\n\n'
    + 'ענה JSON בלבד — אין טקסט אחר:\n'
    + '{"matches":[{"po_item":"תיאור","item_code":"XX.XXX.XXXX","match_type":"EXACT","unit_price":0,"unit":"","rationale":"הסבר קצר בעברית"}]}';

  try {
    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:2500,
        messages:[{role:'user', content:prompt}] }), null);
    var data = await res.json();
    if (!res.ok) throw new Error((data.error?.message) || 'API error ' + res.status);

    var raw = ((data.content||[])[0]?.text||'').replace(/```json\s*/gi,'').replace(/```/g,'').trim();
    var s = raw.indexOf('{'); var e = raw.lastIndexOf('}');
    if (s < 0 || e < 0) throw new Error('תגובת JSON לא תקינה');
    var result = JSON.parse(raw.substring(s, e+1));
    mcRenderMatches(result.matches || []);
    mcStatus('✅ ' + (result.matches||[]).length + ' פריטים הותאמו', false);

  } catch(err) {
    mcStatus('❌ ' + err.message, true);
    if (panel) {
      panel.innerHTML = '';
      var errDiv = document.createElement('div');
      errDiv.style.cssText = 'color:#ef4444;padding:14px;font-size:12px;direction:rtl;';
      errDiv.textContent = '❌ ' + err.message;
      var retryBtn = document.createElement('button');
      retryBtn.textContent = '🔄 נסה שוב'; retryBtn.style.cssText = 'margin-top:8px;background:rgba(201,168,76,0.2);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:6px 14px;border-radius:7px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;';
      retryBtn.onclick = mcAIMatch;
      panel.appendChild(errDiv); panel.appendChild(retryBtn);
    }
  }
}

function mcRenderMatches(matches) {
  var panel = document.getElementById('mc-ai-panel');
  if (!panel) return;
  panel.innerHTML = '';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'font-size:14px;font-weight:800;color:#c4b5fd;margin-bottom:12px;';
  hdr.textContent = '🧠 התאמות AI — מחירון משרד הבינוי והשיכון';
  panel.appendChild(hdr);

  var sub = document.createElement('div');
  sub.style.cssText = 'font-size:11px;color:#555;margin-bottom:14px;';
  sub.textContent = matches.length + ' פריטים · לחץ "עדכן מחיר" להחלת המחיר על ההזמנה הפתוחה';
  panel.appendChild(sub);

  if (!matches.length) {
    var noResult = document.createElement('div');
    noResult.style.cssText = 'color:#888;padding:12px;font-size:12px;';
    noResult.textContent = 'לא נמצאו התאמות';
    panel.appendChild(noResult);
    return;
  }

  var COLORS = { EXACT: '#22c55e', SIMILAR: '#f59e0b', NONE: '#555' };
  var ICONS  = { EXACT: '🟢', SIMILAR: '🟡', NONE: '⚫' };

  matches.forEach(function(m) {
    var hasMatch = m.item_code && m.item_code !== 'null' && m.match_type !== 'NONE';
    var color    = COLORS[m.match_type] || '#555';

    var card = document.createElement('div');
    card.style.cssText = 'background:#242438;border-radius:10px;padding:12px 14px;margin-bottom:10px;border-right:4px solid ' + color + ';';

    // Row: left=info, right=price+button
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;';

    // Left: PO item + match info
    var left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0;';

    var label = document.createElement('div');
    label.style.cssText = 'font-size:10px;color:#888;margin-bottom:4px;';
    label.textContent = 'פריט בהזמנה:';
    left.appendChild(label);

    var poText = document.createElement('div');
    poText.style.cssText = 'font-size:13px;color:#fff;direction:rtl;margin-bottom:6px;font-weight:600;';
    poText.textContent = m.po_item || '';
    left.appendChild(poText);

    if (hasMatch) {
      var codeEl = document.createElement('div');
      codeEl.style.cssText = 'font-size:11px;color:' + color + ';font-family:monospace;margin-bottom:2px;';
      codeEl.textContent = (ICONS[m.match_type]||'') + ' ' + m.item_code + ' · ' + m.match_type;
      left.appendChild(codeEl);

      if (m.rationale) {
        var rat = document.createElement('div');
        rat.style.cssText = 'font-size:11px;color:#888;direction:rtl;';
        rat.textContent = m.rationale;
        left.appendChild(rat);
      }
    } else {
      var noMatch = document.createElement('div');
      noMatch.style.cssText = 'font-size:11px;color:#555;';
      noMatch.textContent = '⚫ לא נמצאה התאמה במחירון';
      left.appendChild(noMatch);
    }

    row.appendChild(left);

    // Right: price + button
    if (hasMatch && m.unit_price > 0) {
      var right = document.createElement('div');
      right.style.cssText = 'text-align:left;direction:ltr;flex-shrink:0;';

      var priceEl = document.createElement('div');
      priceEl.style.cssText = 'font-size:18px;font-weight:900;color:#c9a84c;';
      priceEl.textContent = '₪' + parseFloat(m.unit_price).toLocaleString('he-IL', {maximumFractionDigits:2});
      right.appendChild(priceEl);

      var unitEl = document.createElement('div');
      unitEl.style.cssText = 'font-size:9px;color:#555;text-align:center;margin-bottom:6px;';
      unitEl.textContent = 'לכל ' + (m.unit||'יח');
      right.appendChild(unitEl);

      var btn = document.createElement('button');
      btn.textContent = '✓ עדכן מחיר';
      btn.style.cssText = 'background:rgba(201,168,76,0.18);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:5px 10px;border-radius:6px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;white-space:nowrap;display:block;width:100%;';
      btn.onclick = (function(match){ return function(){ mcApplyPrice(match); }; })(m);
      right.appendChild(btn);

      row.appendChild(right);
    }

    card.appendChild(row);
    panel.appendChild(card);
  });

  // Apply all button
  var goodMatches = matches.filter(function(m){ return m.item_code && m.match_type !== 'NONE' && m.unit_price > 0; });
  if (goodMatches.length > 1) {
    var applyAllBtn = document.createElement('button');
    applyAllBtn.style.cssText = 'width:100%;margin-top:6px;background:linear-gradient(135deg,#166534,#22c55e);border:none;color:#fff;padding:12px;border-radius:10px;cursor:pointer;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;';
    applyAllBtn.textContent = '✅ החל את כל המחירים על ההזמנה (' + goodMatches.length + ' סעיפים)';
    applyAllBtn.onclick = function() {
      goodMatches.forEach(function(m){ mcApplyPrice(m, true); });
      showToast('✅ ' + goodMatches.length + ' מחירים עודכנו — בדוק הזמנה');
      switchTab('crm');
      setTimeout(function(){ showPage('new-po'); }, 400);
    };
    panel.appendChild(applyAllBtn);
  }
}

// ── Apply a matched price to the open PO form ─────────────────────────
function mcApplyPrice(m, silent) {
  var poRows = document.querySelectorAll('#pof-items-body tr');
  var updated = false;

  // Try to find matching row by text similarity
  var poItemLower = (m.po_item||'').toLowerCase().substring(0, 30);
  poRows.forEach(function(tr) {
    if (updated) return;
    var inp = tr.querySelector('input[type="text"]');
    var priceInp = tr.querySelectorAll('input[type="number"]')[1];
    if (!inp || !priceInp) return;
    var trTxt = inp.value.toLowerCase();
    if (trTxt.includes(poItemLower.substring(0,20)) || trTxt.includes(m.item_code||'')) {
      priceInp.value = m.unit_price;
      if (!inp.value.includes('[' + m.item_code)) {
        inp.value = '[' + m.item_code + '] ' + inp.value.replace(/^\[.*?\]\s*/, '');
      }
      tr.style.background = 'rgba(34,197,94,0.09)';
      updated = true;
    }
  });

  // Not found → add new row
  if (!updated) {
    pofAddRow('[' + m.item_code + '] ' + (m.po_item||'').substring(0,70), m.unit||"יח'", 1, m.unit_price, true);
  }
  pofRecalc();
  if (!silent) showToast('✅ ₪' + parseFloat(m.unit_price).toLocaleString() + ' עודכן');
}

function mcStatus(msg, show) {
  var el = document.getElementById('mc-ai-status');
  if (!el) return;
  el.style.display = (msg && show !== false) ? 'block' : 'none';
  el.textContent   = msg || '';
}



// ══════════════════════════════════════════════════════════════════════
// QUERY TAB ENGINE — 3 parallel professional queries
// Sources: mamad_spec_chapters + renovation_spec + price_items + Claude
// ══════════════════════════════════════════════════════════════════════

var Q = {
  voices:  [null, null, null],
  running: false
};

function queryTabInit() {
  // Nothing to pre-load — queries are on demand
}

// ── Voice input ────────────────────────────────────────────────────────
function qVoice(num) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('קלט קולי לא נתמך בדפדפן זה', 'error'); return;
  }
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Q.voices[num-1]) {
    Q.voices[num-1].stop(); Q.voices[num-1] = null; return;
  }
  var rec = new SpeechRec();
  rec.lang = 'he-IL'; rec.continuous = false; rec.interimResults = false;
  rec.onresult = function(e) {
    var txt = e.results[0][0].transcript;
    document.getElementById('q-input-' + num).value = txt;
    Q.voices[num-1] = null;
  };
  rec.onerror = function() { Q.voices[num-1] = null; };
  rec.onend   = function() { Q.voices[num-1] = null; };
  rec.start();
  Q.voices[num-1] = rec;
  showToast('🎤 מקשיב לשאלה ' + num + '...', 'success');
}

function qChip(num, text) {
  document.getElementById('q-input-' + num).value = text;
}

function qClear(num) {
  document.getElementById('q-input-' + num).value = '';
  var res = document.getElementById('q-result-' + num);
  if (res) res.remove();
}

function qClearAll() {
  [1,2,3].forEach(function(n){ qClear(n); });
  document.getElementById('q-results').innerHTML = '';
  document.getElementById('q-status').style.display = 'none';
}

// ── Main runner ────────────────────────────────────────────────────────
async function qRunAll() {
  if (Q.running) return;
  var apiKey = APP.config && APP.config.anthropic_key;
  if (!apiKey) { showToast('מפתח Anthropic API חסר', 'error'); return; }

  var questions = [1,2,3].map(function(n) {
    return (document.getElementById('q-input-' + n).value || '').trim();
  }).filter(function(q) { return q.length > 0; });

  if (!questions.length) { showToast('הכנס לפחות שאלה אחת', 'error'); return; }

  Q.running = true;
  document.getElementById('q-results').innerHTML = '';
  qStatus('⏳ מחפש מפרטים ומחירים עבור ' + questions.length + ' שאלות...');

  // Create placeholder cards immediately so results show in order
  [1,2,3].forEach(function(n) {
    var q = (document.getElementById('q-input-' + n).value || '').trim();
    if (!q) return;
    var existing = document.getElementById('q-result-' + n);
    if (existing) existing.remove();

    var colors = ['#38bdf8','#a78bfa','#22c55e'];
    var card = document.createElement('div');
    card.id = 'q-result-' + n;
    card.style.cssText = 'background:#1a1a2e;border:1.5px solid rgba(255,255,255,0.06);border-right:4px solid ' + colors[n-1] + ';border-radius:14px;padding:18px 20px;';
    card.innerHTML = '<div style="font-size:11px;color:' + colors[n-1] + ';font-weight:800;margin-bottom:8px;">שאלה ' + n + '</div>'
      + '<div style="font-size:14px;color:#fff;direction:rtl;margin-bottom:12px;font-weight:600;">' + q.replace(/</g,'&lt;') + '</div>'
      + '<div id="q-meter-' + n + '" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;font-size:11px;color:#475569;font-family:monospace;">'
      + '  <span id="q-timer-' + n + '">⏱ 0.0s</span>'
      + '  <span id="q-tokens-' + n + '">🔢 0 tokens</span>'
      + '  <span id="q-cost-' + n + '">💰 $0.000</span>'
      + '  <span id="q-progress-' + n + '" style="flex:1;background:rgba(255,255,255,0.05);border-radius:4px;height:4px;overflow:hidden;">'
      + '    <span id="q-bar-' + n + '" style="display:block;height:4px;background:linear-gradient(90deg,#38bdf8,#a78bfa);width:0%;transition:width 0.3s;"></span>'
      + '  </span>'
      + '</div>'
      + '<div id="q-answer-' + n + '" style="font-size:14px;color:#f1f5f9;direction:rtl;line-height:1.9;font-weight:600;">⏳ מחפש...</div>';
    document.getElementById('q-results').appendChild(card);
  });

  // Run all queries in parallel
  var promises = [1,2,3].map(function(n) {
    var q = (document.getElementById('q-input-' + n).value || '').trim();
    if (!q) return Promise.resolve();
    return qRunSingle(n, q, apiKey);
  });

  try {
    await Promise.all(promises);
    qStatus('✅ הושלם — ' + questions.length + ' תשובות');
  } catch(e) {
    qStatus('⚠️ חלק מהשאלות נכשלו');
  }
  Q.running = false;
}

// ── Single query: fetch specs + prices + ask Claude ───────────────────
async function qRunSingle(num, question, apiKey) {
  var ansEl = document.getElementById('q-answer-' + num);
  if (!ansEl) return;

  // Start live timer + progress bar
  var _startTime = Date.now();
  var _timerEl   = document.getElementById('q-timer-'    + num);
  var _tokensEl  = document.getElementById('q-tokens-'   + num);
  var _costEl    = document.getElementById('q-cost-'     + num);
  var _barEl     = document.getElementById('q-bar-'      + num);
  var _meterEl   = document.getElementById('q-meter-'    + num);
  var _timerInterval = setInterval(function() {
    var secs = ((Date.now() - _startTime) / 1000).toFixed(1);
    if (_timerEl) _timerEl.textContent = '⏱ ' + secs + 's';
    var pct = Math.min(85, (Date.now() - _startTime) / 80);
    if (_barEl) _barEl.style.width = pct + '%';
  }, 100);

  // ── Off-topic detector ────────────────────────────────────────────
  // Keywords that belong to the construction RAG
  var RAG_KEYWORDS = [
    'ממד','ממ"ד','בטון','זיון','פלדה','קיר','תקרה','רצפה','יציקה',
    'טיח','צבע','איטום','שיפוץ','בנייה','בניין','מבנה','היתר',
    'מדרגות','נגישות','כבש','מעקה','גדר','חיזוק','cfrp','jacketing',
    'מחירון','כתב כמויות','הזמנת עבודה','קבלן','פרויקט','אתר',
    'ת"י','תקן','תקנות','מפרט','בלמ"ס','מידות','עובי','קוטר',
    'סטייה','חוזק','דרישה','ביצוע','אחריות','בדיקה','פיגום'
  ];

  var qLow = question.toLowerCase();
  var isConstruction = RAG_KEYWORDS.some(function(kw) {
    return qLow.includes(kw.toLowerCase());
  });

  if (!isConstruction) {
    // Off-topic — show redirect card, open Claude.ai, stop
    clearInterval(_timerInterval);
    if (_barEl) { _barEl.style.width = '100%'; _barEl.style.background = '#f59e0b'; }
    var claudeUrl = 'https://claude.ai/new?q=' + encodeURIComponent(question);
    ansEl.innerHTML = qRenderOffTopic(question, claudeUrl);
    // Auto-open Claude.ai in new tab after 1.5s
    setTimeout(function() { window.open(claudeUrl, '_blank'); }, 1500);
    return;
  }

  try {
    // 1. Parallel: search all 3 spec tables + price items
    // Also fetch from building_standards encyclopedia (safe — never crashes)
    var buildingStds = [];
    try {
      var bsWords = question.split(/\s+/).filter(function(w){return w.length>2;}).slice(0,3);
      var bsFilter = bsWords.map(function(w){return 'scope.ilike.*'+encodeURIComponent(w)+'*,title_he.ilike.*'+encodeURIComponent(w)+'*';}).join(',');
      var bsUrl = (typeof SB_URL !== 'undefined' ? SB_URL : window.SB_URL || '') +
        '/rest/v1/building_standards?or=('+bsFilter+')&limit=5&select=standard_id,title_he,scope,key_requirements,notes,industry_category';
      var bsKey = typeof SB_KEY !== 'undefined' ? SB_KEY : window.SB_KEY || '';
      var bsRes = await fetch(bsUrl, {headers:{apikey:bsKey,Authorization:'Bearer '+bsKey}});
      buildingStds = bsRes.ok ? (await bsRes.json()||[]) : [];
    } catch(_e) { buildingStds = []; }

    var [mamadRes, renovRes, priceRes] = await Promise.all([
      qFetchSpec('mamad_spec_chapters', question),
      qFetchSpec('renovation_spec', question),
      qFetchPrices(question)
    ]);

    // 2. Build context
    var context = '';
    if (mamadRes.length) {
      context += '== מפרט ממ״ד (בלמ״ס) ==\n';
      mamadRes.forEach(function(r) {
        context += r.title_he + '\n';
        if (r.key_specs) {
          try { var ks = typeof r.key_specs==='string'?JSON.parse(r.key_specs):r.key_specs; if(Array.isArray(ks)) context += ks.join('\n') + '\n'; } catch(e){}
        }
        if (r.text_content) context += (r.text_content||'').substring(0,400) + '\n';
        context += '\n';
      });
    }
    if (renovRes.length) {
      context += '== מפרט שיפוץ ותקנות ==\n';
      renovRes.forEach(function(r) {
        context += (r.title_he||'') + ' [' + (r.standard_ref||'') + ']\n';
        if (r.key_rules) {
          try { var kr = typeof r.key_rules==='string'?JSON.parse(r.key_rules):r.key_rules; if(Array.isArray(kr)) context += kr.join('\n') + '\n'; } catch(e){}
        }
        if (r.numeric_vals) {
          try { var nv = typeof r.numeric_vals==='string'?JSON.parse(r.numeric_vals):r.numeric_vals; if(Array.isArray(nv)) nv.forEach(function(v){ context += v.param+': '+v.value+' '+v.unit+'\n'; }); } catch(e){}
        }
        context += '\n';
      });
    }
    if (priceRes.length) {
      context += '== מחירון משרד הבינוי (דצמבר 2025) ==\n';
      priceRes.forEach(function(r) {
        context += r.item_code + ' | ' + (r.description||'').substring(0,60) + ' | ' + r.unit + ' | ₪' + r.price + '\n';
      });
    }

    // Add building_standards context
    if (buildingStds && buildingStds.length) {
      context += '== אנציקלופדיית תקני בנייה (' + buildingStds.length + ' תקנים) ==\n';
      buildingStds.forEach(function(s) {
        context += s.standard_id + ': ' + (s.title_he||'') + '\n';
        if (s.scope) context += (s.scope||'').substring(0,200) + '\n';
        var reqs = s.key_requirements || [];
        if (typeof reqs === 'string') { try { reqs = JSON.parse(reqs); } catch(e) { reqs = []; } }
        if (reqs.length) context += 'דרישות: ' + reqs.slice(0,3).join(' | ') + '\n';
        if (s.notes) context += 'הערות: ' + (s.notes||'').substring(0,100) + '\n';
        context += '\n';
      });
    }

    if (!context.trim()) context = 'אין נתונים ספציפיים בבסיס הנתונים — ענה מידע הנדסי כללי.';

    // 3. Ask Claude
    var prompt = 'אתה יועץ הנדסי בנייה ישראלי מקצועי עם גישה לאנציקלופדיית 838 תקנים ישראליים ובינלאומיים. עברית בלבד. תשובה ממוקדת ומעשית.\n\n'
      + 'בסיס ידע רלוונטי:\n' + context + '\n'
      + 'שאלה: ' + question + '\n\n'
      + 'ענה בפורמט הבא (השתמש ב-** לכותרות):\n'
      + '**תשובה:** [תשובה ישירה 1-2 משפטים]\n'
      + '**מפרט/תקן:** [הדרישות המדויקות עם מספרים]\n'
      + '**הוראות ביצוע:** [3-5 שלבי ביצוע]\n'
      + '**מחיר:** [סעיף מחירון + מחיר אם רלוונטי]\n'
      + 'אם המידע לא קיים בבסיס הנתונים — ציין זאת וענה מידע כללי.';

    var res = await claudeFetch(JSON.stringify({ _apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      }), null);

    var data = await res.json();
    clearInterval(_timerInterval);
    if (!res.ok) throw new Error((data.error && data.error.message) || 'API error');
    var text = (data.content && data.content[0] && data.content[0].text) || '';

    // Show final metrics
    var elapsed = ((Date.now() - _startTime) / 1000).toFixed(1);
    var inputTok  = (data.usage && data.usage.input_tokens)  || 0;
    var outputTok = (data.usage && data.usage.output_tokens) || 0;
    var totalTok  = inputTok + outputTok;
    // Sonnet pricing: $3/M input, $15/M output
    var cost = ((inputTok * 3 + outputTok * 15) / 1000000).toFixed(4);
    if (_timerEl)  _timerEl.textContent  = '⏱ ' + elapsed + 's';
    if (_tokensEl) _tokensEl.textContent = '🔢 ' + totalTok.toLocaleString() + ' tokens';
    if (_costEl)   _costEl.textContent   = '💰 $' + cost;
    if (_barEl)    _barEl.style.width    = '100%';
    if (_barEl)    _barEl.style.background = 'linear-gradient(90deg,#22c55e,#38bdf8)';

    // 4. Render answer
    var formatted = qFormatAnswer(text);
    ansEl.innerHTML = formatted;

    // Add action buttons
    var actBar = document.createElement('div');
    actBar.style.cssText = 'margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.05);padding-top:12px;';

    // Send to PO button
    var poBtn = document.createElement('button');
    poBtn.textContent = '📄 שלח להזמנה';
    poBtn.style.cssText = 'background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:5px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    poBtn.onclick = (function(q){ return function(){ qSendToPO(q); }; })(question);
    actBar.appendChild(poBtn);

    // Copy answer button
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 העתק';
    copyBtn.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:5px 12px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:11px;font-weight:700;';
    copyBtn.onclick = function(){ navigator.clipboard.writeText(text).then(function(){ showToast('✅ הועתק'); }); };
    actBar.appendChild(copyBtn);

    // Source chips
    if (mamadRes.length || renovRes.length) {
      var srcSpan = document.createElement('span');
      srcSpan.style.cssText = 'font-size:10px;color:#475569;align-self:center;margin-right:auto;';
      var sources = [];
      if (mamadRes.length) sources.push('מפרט בלמ״ס');
      if (renovRes.length) sources.push('תקנות/מפרט');
      if (priceRes.length) sources.push('מחירון 2025');
      srcSpan.textContent = 'מקורות: ' + sources.join(' · ');
      actBar.appendChild(srcSpan);
    }

    ansEl.parentElement.appendChild(actBar);

  } catch(err) {
    clearInterval(_timerInterval);
    if (_barEl) { _barEl.style.width='100%'; _barEl.style.background='#ef4444'; }
    ansEl.innerHTML = '<span style="color:#ef4444;">❌ שגיאה: ' + err.message + '</span>';
  }
}

// ── Fetch specs from Supabase ──────────────────────────────────────────
async function qFetchSpec(table, question) {
  try {
    // Search by keyword in title and text content
    var words = question.replace(/[?!.]/g,'').split(/\s+/)
      .filter(function(w){ return w.length > 2; }).slice(0, 4);
    if (!words.length) return [];

    var filters = words.map(function(w) {
      return 'text_content.ilike.*' + encodeURIComponent(w) + '*,title_he.ilike.*' + encodeURIComponent(w) + '*';
    }).join(',');

    var url = SB_URL + '/rest/v1/' + table + '?or=(' + filters + ')&limit=4';
    var res = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    if (!res.ok) return [];
    return (await res.json()) || [];
  } catch(e) { return []; }
}

// ── Fetch prices from price_items ─────────────────────────────────────
async function qFetchPrices(question) {
  try {
    var words = question.replace(/[?!.]/g,'').split(/\s+/)
      .filter(function(w){ return w.length > 2; }).slice(0, 3);
    if (!words.length) return [];

    var filters = words.map(function(w) {
      return 'description.ilike.*' + encodeURIComponent(w) + '*';
    }).join(',');

    var url = SB_URL + '/rest/v1/price_items?or=(' + filters + ')&price=not.is.null&limit=6&select=item_code,description,unit,price';
    var res = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    if (!res.ok) return [];
    return (await res.json()) || [];
  } catch(e) { return []; }
}

// ── Format Claude response ─────────────────────────────────────────────
function qFormatAnswer(text) {
  if (!text) return '<span style="color:#94a3b8;">אין תשובה</span>';
  var NL = String.fromCharCode(10);
  return text
    // Section headers **bold**
    .replace(/\*\*([^*\n]+)\*\*/g,
      '<div style="color:#38bdf8;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-top:14px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(56,189,248,0.2);">$1</div>')
    // Numbered list items
    .replace(/^(\d+\. )(.+)$/gm,
      '<div style="display:flex;gap:8px;margin-bottom:6px;"><span style="color:#38bdf8;font-weight:800;min-width:18px;">$1</span><span style="color:#f1f5f9;font-weight:600;line-height:1.7;">$2</span></div>')
    // Bullet list items
    .replace(/^[•\-] (.+)$/gm,
      '<div style="display:flex;gap:8px;margin-bottom:5px;"><span style="color:#a78bfa;font-weight:900;">▸</span><span style="color:#f1f5f9;font-weight:600;line-height:1.7;">$1</span></div>')
    // Newlines
    .split(NL).join('<br>')
    .replace(/(<br>){3,}/g, '<br><br>');
}

// ── Off-topic redirect card ────────────────────────────────────────────
function qRenderOffTopic(question, claudeUrl) {
  var d = document.createElement('div');
  d.style.cssText = 'background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 16px;';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:13px;font-weight:800;color:#fbbf24;margin-bottom:8px;';
  title.textContent = '📡 שאלה זו אינה קשורה לבנייה';
  d.appendChild(title);

  var msg = document.createElement('div');
  msg.style.cssText = 'font-size:13px;color:#e2e8f0;font-weight:600;direction:rtl;margin-bottom:10px;line-height:1.7;';
  msg.innerHTML = 'המערכת מתמחה ב: ממ"ד · בטון · טיח · צבע · שיפוץ · מחירון בנייה · תקנות.<br>שאלתך נשלחת לקלוד — תיפתח בחלון חדש.';
  d.appendChild(msg);

  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;';

  var link = document.createElement('a');
  link.href = claudeUrl; link.target = '_blank';
  link.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#92400e,#f59e0b);color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;text-decoration:none;';
  link.textContent = '🌐 פתח ב-Claude.ai';
  bar.appendChild(link);

  var clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;';
  clearBtn.textContent = '🔄 שאל שאלת בנייה';
  clearBtn.onclick = function(){ qClearAll(); };
  bar.appendChild(clearBtn);
  d.appendChild(bar);

  var tip = document.createElement('div');
  tip.style.cssText = 'font-size:10px;color:#78716c;';
  tip.textContent = '💡 דוגמאות: "מה חוזק בטון לממ"ד?" · "עלות טיח חוץ למ"ר?" · "מה נדרש להיתר שיפוץ?"';
  d.appendChild(tip);

  return d.outerHTML;
}

// ── Send question to PO form ───────────────────────────────────────────
function qSendToPO(question) {
  switchTab('crm');
  setTimeout(function(){
    showPage('new-po');
    setTimeout(function(){
      pofAddRow(question, "יח'", 1, 0, true);
      showToast('✅ שאלה נוספה להזמנה — עדכן מחיר וכמות');
    }, 350);
  }, 250);
}

// ── Print ──────────────────────────────────────────────────────────────
function qPrint() {
  var results = document.getElementById('q-results');
  if (!results || !results.children.length) { showToast('אין תשובות להדפסה', 'error'); return; }

  var managerName = (APP.config && APP.config.manager_name) || 'בני פרסקי';
  var w = window.open('', '_blank');
  var NL = String.fromCharCode(10);

  w.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">'
    + '<title>שאילתות מקצועיות — ' + managerName + '</title>'
    + '<style>body{font-family:Arial,sans-serif;direction:rtl;padding:30px;color:#1a1a2e;max-width:900px;margin:0 auto;}'
    + 'h1{font-size:20px;border-bottom:2px solid #38bdf8;padding-bottom:8px;}'
    + '.card{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px;break-inside:avoid;}'
    + '.q-title{color:#38bdf8;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:6px;}'
    + '.q-text{font-size:15px;font-weight:700;margin-bottom:10px;}'
    + '.answer{font-size:13px;line-height:1.8;}'
    + 'strong{color:#0369a1;display:block;margin-top:8px;}'
    + '.footer{font-size:10px;color:#999;margin-top:20px;text-align:center;}'
    + '@media print{.no-print{display:none}}'
    + '</style></head><body>'
    + '<h1>🔍 שאילתות מקצועיות</h1>'
    + '<div style="font-size:11px;color:#999;margin-bottom:20px;">'
    + new Date().toLocaleDateString('he-IL') + ' | ' + managerName
    + '</div>');

  Array.from(results.children).forEach(function(card, idx) {
    var qText = card.querySelector('div[style*="font-weight:600"]');
    var answer = card.querySelector('[id^="q-answer-"]');
    var actions = card.querySelectorAll('button, span');

    w.document.write('<div class="card">'
      + '<div class="q-title">שאלה ' + (idx+1) + '</div>'
      + '<div class="q-text">' + (qText ? qText.innerHTML : '') + '</div>'
      + '<div class="answer">' + (answer ? answer.innerHTML : '') + '</div>'
      + '</div>');
  });

  w.document.write('<div class="footer">הופק ממערכת ' + managerName + ' | ' + new Date().toLocaleDateString('he-IL') + '</div>'
    + '</body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

function qStatus(msg) {
  var el = document.getElementById('q-status');
  if (!el) return;
  el.style.display = msg ? 'block' : 'none';
  el.textContent = msg;
}



