// ══════════════════════════════════════════════════════════════
// WIZARD.JS — יומן יומי wizard
// Edit this file on GitHub to change wizard UI/logic.
// Loaded dynamically by index.html via _fetchWizardModule().
// ══════════════════════════════════════════════════════════════

// ── 1. Inject HTML into #journal-panel ──────────────────────
(function injectWizardHTML() {
  var panel = document.getElementById('journal-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="app-panel" id="journal-panel">\n<style>\n/* ── JOURNAL WIZARD LAYOUT ─────────────────────────── */\n#journal-wizard{display:flex;flex-direction:column;min-height:100vh;background:linear-gradient(160deg,#e8f5e9 0%,#f1f8e9 60%,#e0f2f1 100%);font-family:Heebo,sans-serif;direction:rtl;}\n#jw-topbar{background:linear-gradient(135deg,#1b5e20,#2e7d32);color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}\n#jw-topbar-title{font-size:15px;font-weight:800;}\n#jw-topbar-sub{font-size:10px;opacity:.6;margin-top:2px;}\n#jw-topbar-num{font-size:11px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:3px 10px;color:#fff;font-weight:700;}\n#jw-body{display:flex;flex:1;min-height:0;}\n/* STEP SIDEBAR */\n#jw-steps{width:130px;flex-shrink:0;background:rgba(255,255,255,0.65);border-left:2px solid #c8e6c9;padding:10px 0;overflow-y:auto;}\n.jw-step{display:flex;align-items:flex-start;gap:7px;padding:9px 10px;cursor:pointer;border-right:3px solid transparent;transition:all .15s;}\n.jw-step.active{background:rgba(255,255,255,0.9);border-right-color:#2e7d32;}\n.jw-step.done{opacity:.8;}\n.jw-step-num{width:20px;height:20px;border-radius:50%;border:2px solid #c9a84c;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#9a6f00;flex-shrink:0;margin-top:2px;}\n.jw-step.active .jw-step-num{background:#2e7d32;border-color:#2e7d32;color:#fff;}\n.jw-step.done .jw-step-num{background:#c9a84c;border-color:#c9a84c;color:#fff;}\n.jw-step-label{font-size:10px;font-weight:700;color:#5a4010;line-height:1.4;}\n.jw-step.active .jw-step-label{color:#1b5e20;font-weight:900;}\n.jw-conn{width:2px;height:6px;background:#e2d0a0;margin-right:19px;}\n/* MAIN STEP AREA */\n#jw-main{flex:1;overflow-y:auto;padding:20px 24px 16px;}\n.jw-step-panel{display:none;}\n.jw-step-panel.active{display:block;}\n/* STEP HEADER */\n.jw-step-hdr{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #c8e6c9;}\n.jw-step-ico{font-size:24px;}\n.jw-step-title{font-size:17px;font-weight:900;color:#1b5e20;}\n.jw-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;}\n.jw-badge-law{background:#fef3c7;color:#92400e;}\n.jw-badge-crit{background:#fee2e2;color:#991b1b;}\n.jw-badge-opt{background:#dbeafe;color:#1e40af;}\n/* FOOTER NAV */\n#jw-footer{background:rgba(255,255,255,0.75);border-top:2px solid #c8e6c9;padding:12px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0;}\n#jw-btn-back{background:none;border:1.5px solid #a5d6a7;color:#2e7d32;border-radius:9px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;}\n#jw-btn-next{background:linear-gradient(135deg,#1b5e20,#43a047);color:#fff;border:none;border-radius:9px;padding:10px 24px;font-size:13px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;}\n#jw-btn-save{background:rgba(22,163,74,.15);border:1.5px solid rgba(22,163,74,.4);color:#15803d;border-radius:9px;padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;}\n#jw-progress-wrap{flex:1;}\n#jw-progress-lbl{font-size:10px;color:#9a6f00;font-weight:700;margin-bottom:3px;}\n#jw-progress-bar{height:6px;background:#e2d0a0;border-radius:3px;}\n#jw-progress-fill{height:100%;background:#c9a84c;border-radius:3px;transition:width .3s;}\n/* FIELDS */\n.jw-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}\n.jw-field label{font-size:11px;font-weight:800;color:#5a4010;text-transform:uppercase;letter-spacing:.4px;}\n.jw-field input,.jw-field select,.jw-field textarea{padding:10px 13px;border:1.5px solid #e2d0a0;border-radius:9px;font-family:Heebo,sans-serif;font-size:14px;color:#2c1f00;background:#fff;direction:rtl;outline:none;width:100%;}\n.jw-field input:focus,.jw-field select:focus,.jw-field textarea:focus{border-color:#c9a84c;}\n.jw-field textarea{resize:vertical;min-height:80px;}\n.jw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}\n.jw-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}\n@media(max-width:600px){.jw-grid2,.jw-grid3{grid-template-columns:1fr;}}\n/* HERO (step 1) */\n#jw-hero{background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border-radius:14px;padding:18px 20px 14px;margin-bottom:16px;}\n#jw-hero-name{font-size:20px;font-weight:900;color:#fff;margin-bottom:8px;}\n#jw-hero-tags{display:flex;gap:8px;flex-wrap:wrap;}\n.jw-hero-tag{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:3px 10px;font-size:11px;color:rgba(255,255,255,.85);}\n.jw-hero-tag.gold{background:rgba(201,168,76,.25);border-color:rgba(201,168,76,.5);color:#fde68a;}\n/* TASKS (step 1) */\n.jw-task{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;border:1px solid #e2d0a0;background:#fff;margin-bottom:7px;}\n.jw-task-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}\n.jw-task-name{font-size:13px;font-weight:700;color:#1a3d5c;flex:1;}\n.jw-task-meta{font-size:10px;color:#888;margin-top:2px;}\n.jw-task-badge{font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;}\n/* DRAWINGS */\n.jw-draw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100px,100%),1fr));gap:8px;margin-top:8px;}\n.jw-draw-card{border:1px solid #e2d0a0;border-radius:9px;overflow:hidden;cursor:pointer;text-decoration:none;}\n.jw-draw-card:hover{border-color:#c9a84c;}\n.jw-draw-thumb{height:55px;display:flex;align-items:center;justify-content:center;font-size:22px;}\n.jw-draw-info{padding:5px 7px;background:#fff;}\n.jw-draw-name{font-size:9px;font-weight:700;color:#1a3d5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.jw-draw-date{font-size:8px;color:#aaa;}\n.jw-draw-upload{border:2px dashed #c9a84c;border-radius:9px;height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:#9a6f00;font-size:10px;font-weight:700;}\n/* CONTRACTORS */\n.jw-contr{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f5f0e8;border-radius:9px;margin-bottom:7px;}\n.jw-contr-av{width:34px;height:34px;border-radius:50%;background:#1a3d5c;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}\n.jw-contr-name{font-size:13px;font-weight:700;color:#1a3d5c;}\n.jw-contr-scope{font-size:10px;color:#888;}\n/* DYNAMIC ROWS */\n.jw-row{background:#fff;border:1.5px solid #e2d0a0;border-radius:9px;padding:12px;margin-bottom:8px;position:relative;}\n.jw-row.critical{border-color:#fca5a5;background:#fff5f5;}\n.jw-remove{position:absolute;top:8px;left:8px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;}\n.jw-add-btn{background:none;border:2px dashed #c9a84c;color:#9a6f00;border-radius:9px;padding:9px;width:100%;cursor:pointer;font-size:13px;font-weight:700;font-family:Heebo,sans-serif;margin-top:4px;}\n.jw-total-box{background:#f0f7ff;border-right:4px solid #2d6a9f;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:700;color:#1a3d5c;margin-top:10px;}\n/* HOURS */\n.jw-time-display{font-size:32px;font-weight:900;color:#c9a84c;text-align:center;margin:10px 0;}\n/* CTA go-to-field */\n#jw-cta{background:#f5f0e8;border:2px solid #c9a84c;border-radius:14px;padding:16px 20px;display:flex;align-items:center;gap:14px;margin-top:16px;}\n#jw-cta-btn{background:linear-gradient(135deg,#c9a84c,#9a6f00);color:#fff;border:none;border-radius:12px;padding:12px 22px;font-size:14px;font-weight:900;cursor:pointer;white-space:nowrap;font-family:Heebo,sans-serif;}\n/* SIGNATURE */\n.jw-sig-pad{border:2px solid #c9a84c;border-radius:10px;width:100%;height:100px;background:#fafafa;cursor:crosshair;display:block;margin-bottom:8px;}\n/* SEND BUTTONS */\n.jw-send-row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;}\n.jw-send-btn{flex:1;padding:13px;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;}\n.jw-send-primary{background:#1a3d5c;color:#fff;}\n.jw-send-success{background:#16a34a;color:#fff;}\n.jw-send-wa{background:#25d366;color:#fff;}\n</style>\n\n<div id="journal-wizard">\n  <!-- TOPBAR -->\n  <div id="jw-topbar">\n    <div>\n      <div id="jw-topbar-title">🌅 בריפינג בוקר — יומן יומי</div>\n      <div id="jw-topbar-sub">אישור עבודה — <span id="jw-report-num">טוען...</span></div>\n    </div>\n    <div id="jw-topbar-num">שלב <span id="jw-step-indicator">1</span> / 8</div>\n  </div>\n\n  <div id="jw-body">\n    <!-- STEP SIDEBAR -->\n    <div id="jw-steps">\n      <div class="jw-step active" onclick="jwGoto(1)" id="jw-sideitem-1"><div class="jw-step-num">1</div><div class="jw-step-label">בוקר טוב — הכן את היום</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(2)" id="jw-sideitem-2"><div class="jw-step-num">2</div><div class="jw-step-label">שעות + קבלנים</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(3)" id="jw-sideitem-3"><div class="jw-step-num">3</div><div class="jw-step-label">כוח אדם</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(4)" id="jw-sideitem-4"><div class="jw-step-num">4</div><div class="jw-step-label">פעילויות</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(5)" id="jw-sideitem-5"><div class="jw-step-num">5</div><div class="jw-step-label">חומרים וציוד</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(6)" id="jw-sideitem-6"><div class="jw-step-num">6</div><div class="jw-step-label">בטיחות</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(7)" id="jw-sideitem-7"><div class="jw-step-num">7</div><div class="jw-step-label">ביקורות ועיכובים</div></div>\n      <div class="jw-conn"></div>\n      <div class="jw-step" onclick="jwGoto(8)" id="jw-sideitem-8"><div class="jw-step-num">8</div><div class="jw-step-label">סיכום וחתימות</div></div>\n    </div>\n\n    <!-- MAIN STEP PANELS -->\n    <div id="jw-main">\n\n      <!-- ═══ STEP 1: MORNING BRIEFING ═══════════════════════════ -->\n      <div class="jw-step-panel active" id="jw-panel-1">\n        <div class="jw-step-hdr"><span class="jw-step-ico">🌅</span><span class="jw-step-title">בוקר טוב — הכן את היום</span></div>\n\n        <!-- Briefing from Avshi — loads from daily_briefings table -->\n        <div id="jw-briefing-banner" style="display:none;background:linear-gradient(135deg,#1b5e20,#43a047);border-radius:12px;padding:14px 16px;margin-bottom:16px;">\n          <div style="font-size:13px;font-weight:900;color:#fff;margin-bottom:6px;">📨 בריפינג מאבשי</div>\n          <div id="jw-briefing-text" style="font-size:12px;color:rgba(255,255,255,0.92);line-height:1.8;white-space:pre-wrap;direction:rtl;"></div>\n          <div id="jw-briefing-time" style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:6px;"></div>\n        </div>\n\n        <!-- ═══ MORNING TASKS PANEL (OCR + manual tasks + send to Beni) ═══════ -->\n        <div id="fj-morning-panel" style="margin-bottom:16px;">\n          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">\n            <!-- LEFT: Upload handwriting / OCR -->\n            <div style="display:flex;flex-direction:column;gap:10px;">\n              <div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(76,175,80,0.08);">\n                <div style="font-size:12px;font-weight:900;color:#2e7d32;margin-bottom:10px;">📝 דף בוקר — כתב יד</div>\n                <div style="border:2px dashed #a5d6a7;border-radius:10px;padding:16px;text-align:center;cursor:pointer;background:#f1f8e9;" onclick="document.getElementById(\'fj-morning-upload\').click()">\n                  <div style="font-size:28px;margin-bottom:6px;">📷</div>\n                  <div style="font-size:12px;color:#2e7d32;font-weight:800;">צלם את דף המשימות</div>\n                  <div style="font-size:10px;color:#558b2f;margin-top:3px;">Claude קורא ומחלץ משימות</div>\n                  <input type="file" id="fj-morning-upload" accept="image/*" style="display:none;" onchange="fjHandleMorningUpload(this)">\n                </div>\n                <div id="fj-morning-ocr" style="display:none;margin-top:8px;"></div>\n                <button onclick="fjExtractTasks()" id="fj-extract-btn" style="display:none;width:100%;padding:9px;background:linear-gradient(135deg,#388e3c,#66bb6a);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;margin-top:8px;">🤖 חלץ משימות + לוח זמנים</button>\n              </div>\n              <div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(76,175,80,0.08);">\n                <div style="font-size:12px;font-weight:900;color:#2e7d32;margin-bottom:10px;">➕ הוסף משימה ידנית</div>\n                <div style="display:flex;gap:6px;margin-bottom:8px;direction:rtl;">\n                  <input id="fj-task-input" type="text" placeholder="תיאור המשימה..."\n                    style="flex:1;background:#f1f8e9;border:1.5px solid #a5d6a7;color:#1b5e20;padding:7px 9px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">\n                  <select id="fj-task-tag" style="background:#f1f8e9;border:1.5px solid #a5d6a7;color:#1b5e20;padding:7px;border-radius:8px;font-family:Heebo,sans-serif;font-size:11px;">\n                    <option value="site">שטח</option>\n                    <option value="urgent">דחוף</option>\n                    <option value="schedule">לוח זמנים</option>\n                    <option value="safety">בטיחות</option>\n                    <option value="other">אחר</option>\n                  </select>\n                </div>\n                <button onclick="fjAddTaskManual()" style="width:100%;padding:8px;background:linear-gradient(135deg,#388e3c,#66bb6a);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✅ הוסף משימה</button>\n              </div>\n            </div>\n            <!-- RIGHT: Task list + Send to Beni -->\n            <div style="background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(76,175,80,0.08);">\n              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">\n                <div style="font-size:12px;font-weight:900;color:#2e7d32;">✅ משימות היום</div>\n                <div id="fj-task-stats" style="font-size:11px;color:#558b2f;"></div>\n              </div>\n              <!-- Hidden project selector — used by fjLoadTasks/fjSendBriefing -->\n              <select id="fj-project-sel" style="display:none;"></select>\n              <div id="fj-task-list" style="display:flex;flex-direction:column;gap:5px;max-height:200px;overflow-y:auto;"></div>\n              <div style="margin-top:12px;padding-top:10px;border-top:1px solid #c8e6c9;">\n                <button onclick="fjSendBriefing()" style="width:100%;padding:10px;background:linear-gradient(135deg,#1b5e20,#43a047);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">📲 שלח בריפינג לבני</button>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <!-- No-projects warning — shown if zero projects exist -->\n        <div id="jw-no-projects-warn" style="display:none;background:#fff3e0;border:2px solid #ff9800;border-radius:12px;padding:14px 16px;margin-bottom:16px;direction:rtl;">\n          <div style="font-size:14px;font-weight:900;color:#e65100;margin-bottom:6px;">⚠️ אין פרויקטים פעילים במערכת</div>\n          <div style="font-size:12px;color:#bf360c;line-height:1.8;">\n            כדי להתחיל יומן עבודה יש קודם לפתוח פרויקט חדש:<br>\n            1. עבור ל<strong>לוח בקרה</strong> (הטאב הראשון בחלק העליון)<br>\n            2. פתח את הקטגוריה <strong>פרויקטים</strong> מהתפריט הצדדי<br>\n            3. הוסף פרויקט חדש ושמור<br>\n            4. חזור לכאן ולחץ <strong>רענן</strong>\n          </div>\n          <button onclick="location.reload()" style="margin-top:10px;padding:8px 18px;background:#e65100;color:#fff;border:none;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">🔄 רענן עמוד</button>\n        </div>\n\n        <div class="jw-field">\n          <label>בחר פרויקט</label>\n          <select id="projectName" onchange="jwOnProjectChange(this);">\n            <option value="">— בחר פרויקט —</option>\n          </select>\n          <div id="jw-pick-prompt" style="display:none;background:#e8f5e9;border:1.5px solid #a5d6a7;border-radius:8px;padding:8px 12px;margin-top:6px;font-size:12px;color:#1b5e20;font-weight:700;">\n            👆 בחר פרויקט מהרשימה כדי להתחיל את היום\n          </div>\n          <div id="jw-proj-err" style="display:none;color:#c62828;font-size:11px;font-weight:700;margin-top:4px;">⚠️ חובה לבחור פרויקט לפני המשך</div>\n        </div>\n        <div id="project-custom-name-row" style="display:none;" class="jw-field">\n          <label>שם פרויקט ידני</label>\n          <input type="text" id="projectNameCustom" placeholder="הזן שם פרויקט...">\n        </div>\n        <div class="jw-grid2">\n          <div class="jw-field"><label>תאריך</label><input type="date" id="reportDate" required></div>\n          <div class="jw-field"><label>מזג אוויר</label>\n            <select id="weather">\n              <option value="בהיר">☀️ בהיר</option>\n              <option value="מעונן חלקית">⛅ מעונן חלקית</option>\n              <option value="מעונן">☁️ מעונן</option>\n              <option value="גשום">🌧️ גשום</option>\n              <option value="סוער">⛈️ סוער</option>\n              <option value="חם מאוד">🌡️ חם מאוד</option>\n            </select>\n          </div>\n        </div>\n\n        <!-- Project hero — loads after project selection -->\n        <div id="mb-hero" style="display:none;background:linear-gradient(135deg,#1a3d5c,#2d6a9f);border-radius:14px;padding:18px 20px 14px;margin:12px 0;">\n          <div id="mb-proj-name" style="font-size:20px;font-weight:900;color:#fff;margin-bottom:8px;"></div>\n          <div id="mb-proj-tags" style="display:flex;gap:8px;flex-wrap:wrap;"></div>\n        </div>\n\n        <!-- ══ משימות היום — TWO OPTIONS ══════════════════════════════ -->\n        <div id="mb-tasks-section" style="display:none;margin:14px 0;">\n          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">\n            <div style="font-size:12px;font-weight:900;color:#1b5e20;text-transform:uppercase;letter-spacing:.5px;">📋 משימות היום</div>\n            <div id="mb-tasks-count" style="font-size:11px;color:#558b2f;font-weight:600;"></div>\n          </div>\n\n          <!-- Option toggle -->\n          <div style="display:flex;gap:8px;margin-bottom:14px;">\n            <button id="jw-opt-table-btn" onclick="jwTasksShowOption(\'table\')"\n              style="flex:1;padding:10px;border-radius:10px;border:2px solid #2e7d32;background:#2e7d32;color:#fff;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">\n              📝 מלא טבלת משימות\n            </button>\n            <button id="jw-opt-ocr-btn" onclick="jwTasksShowOption(\'ocr\')"\n              style="flex:1;padding:10px;border-radius:10px;border:2px solid #a5d6a7;background:transparent;color:#2e7d32;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">\n              📷 צלם / העלה כתב יד\n            </button>\n          </div>\n\n          <!-- OPTION A: Table editor -->\n          <div id="jw-tasks-table-section">\n            <div id="jw-tasks-rows" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;"></div>\n            <button onclick="jwAddTaskRow()"\n              style="width:100%;padding:9px;border:2px dashed #a5d6a7;border-radius:9px;background:transparent;color:#2e7d32;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">\n              ➕ הוסף משימה\n            </button>\n            <button onclick="jwSaveWizardTasks()"\n              style="width:100%;margin-top:8px;padding:10px;background:linear-gradient(135deg,#1b5e20,#43a047);border:none;color:#fff;border-radius:9px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">\n              💾 שמור משימות\n            </button>\n          </div>\n\n          <!-- OPTION B: OCR / handwrite upload -->\n          <div id="jw-tasks-ocr-section" style="display:none;">\n            <div onclick="document.getElementById(\'jw-task-img-input\').click()"\n              style="border:2px dashed #a5d6a7;border-radius:12px;padding:28px;text-align:center;cursor:pointer;background:#f1f8e9;">\n              <div style="font-size:36px;margin-bottom:8px;">📷</div>\n              <div style="font-size:13px;color:#2e7d32;font-weight:800;">צלם דף משימות בכתב יד</div>\n              <div style="font-size:11px;color:#558b2f;margin-top:4px;">Claude קורא ומחלץ משימות אוטומטית</div>\n              <input type="file" id="jw-task-img-input" accept="image/*" style="display:none;" onchange="jwHandleTaskOCR(this)">\n            </div>\n            <div id="jw-ocr-preview" style="display:none;margin-top:12px;"></div>\n            <div id="jw-ocr-result" style="display:none;margin-top:10px;background:#fff;border:1.5px solid #c8e6c9;border-radius:10px;padding:12px;">\n              <div style="font-size:11px;font-weight:800;color:#2e7d32;margin-bottom:8px;">✅ משימות שחולצו:</div>\n              <div id="jw-ocr-tasks" style="display:flex;flex-direction:column;gap:6px;"></div>\n              <button onclick="jwApproveOCRTasks()" style="margin-top:10px;width:100%;padding:9px;background:linear-gradient(135deg,#1b5e20,#43a047);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;">\n                ✅ אשר משימות ושמור\n              </button>\n            </div>\n          </div>\n\n          <!-- Existing tasks from DB -->\n          <div id="mb-tasks-list" style="margin-top:12px;"></div>\n        </div>\n\n        <!-- Drawings browser -->\n        <div id="mb-drawings-section" style="display:none;margin:14px 0;">\n          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">\n            <div style="font-size:12px;font-weight:900;color:#1a3d5c;text-transform:uppercase;letter-spacing:.5px;">📐 תוכניות ומסמכים</div>\n            <label style="background:#1a3d5c;color:#fff;border-radius:8px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;">＋ העלה<input type="file" multiple accept=".pdf,.dwg,.jpg,.jpeg,.png" style="display:none;" onchange="mbUploadFiles(this)"></label>\n          </div>\n          <div style="display:flex;gap:6px;margin-bottom:8px;" id="mb-draw-filters">\n            <button onclick="mbFilterDrawings(\'all\')" class="mb-dflt" data-f="all" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid #1a3d5c;background:#1a3d5c;color:#fff;cursor:pointer;">הכל</button>\n            <button onclick="mbFilterDrawings(\'pdf\')" class="mb-dflt" data-f="pdf" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid #ddd;background:none;color:#888;cursor:pointer;">📄 PDF</button>\n            <button onclick="mbFilterDrawings(\'img\')" class="mb-dflt" data-f="img" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid #ddd;background:none;color:#888;cursor:pointer;">🖼️ תמונות</button>\n          </div>\n          <div id="mb-drawings-grid" class="jw-draw-grid"></div>\n        </div>\n\n        <!-- Contractors today -->\n        <div id="mb-contractors-section" style="display:none;margin:14px 0;">\n          <div style="font-size:12px;font-weight:900;color:#1a3d5c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">👷 קבלנים באתר היום</div>\n          <div id="mb-contractors-list"></div>\n        </div>\n\n        <!-- CTA -->\n        <div id="jw-cta" style="display:none;">\n          <div style="flex:1;">\n            <div style="font-size:14px;font-weight:800;color:#1a3d5c;margin-bottom:3px;">מוכן לצאת לשטח?</div>\n            <div style="font-size:11px;color:#888;">לחץ — סיכום היום ישלח לטלפון אוטומטית</div>\n          </div>\n          <button id="jw-cta-btn" onclick="mbSendToField()">🚀 צא לשטח</button>\n        </div>\n      </div>\n\n      <!-- ═══ STEP 2: HOURS + CONTRACTORS ═══════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-2">\n        <div class="jw-step-hdr"><span class="jw-step-ico">⏰</span><span class="jw-step-title">שעות עבודה וקבלנים</span></div>\n        <div class="jw-grid3">\n          <div class="jw-field"><label>שעת התחלה</label><input type="time" id="startTime" onchange="calculateWorkHours()"></div>\n          <div class="jw-field"><label>שעת סיום</label><input type="time" id="endTime" onchange="calculateWorkHours()"></div>\n          <div class="jw-field"><label>הפסקות (שעות)</label><input type="number" id="breakHours" value="0" step="0.5" oninput="calculateWorkHours()"></div>\n        </div>\n        <div class="jw-total-box">⏱️ סה"כ שעות עבודה: <span id="totalWorkHours" style="font-size:20px;color:#c9a84c;">0</span> שעות</div>\n\n        <div style="margin-top:18px;margin-bottom:10px;">\n          <div style="font-size:12px;font-weight:900;color:#1a3d5c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🏗️ קבלני הפרויקט</div>\n          <table style="width:100%;border-collapse:collapse;font-size:13px;" id="contractorsTable">\n            <thead><tr style="background:#f5e9c4;">\n              <th style="padding:9px 10px;text-align:right;font-weight:800;color:#1a3d5c;border-bottom:2px solid #e2d0a0;">שם קבלן</th>\n              <th style="padding:9px 10px;text-align:right;font-weight:800;color:#1a3d5c;border-bottom:2px solid #e2d0a0;">מקצוע</th>\n              <th style="padding:9px 10px;text-align:right;font-weight:800;color:#1a3d5c;border-bottom:2px solid #e2d0a0;">מס\' עובדים</th>\n              <th style="padding:9px 10px;border-bottom:2px solid #e2d0a0;"></th>\n            </tr></thead>\n            <tbody id="contractorsBody"></tbody>\n          </table>\n          <button class="jw-add-btn" onclick="addContractorRow()">➕ הוסף קבלן</button>\n        </div>\n      </div>\n\n      <!-- ═══ STEP 3: WORKERS ════════════════════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-3">\n        <div class="jw-step-hdr"><span class="jw-step-ico">👷</span><span class="jw-step-title">כוח אדם באתר</span><span class="jw-badge jw-badge-law">חובה לפי חוק</span></div>\n        <div id="workersContainer"></div>\n        <button class="jw-add-btn" onclick="addWorkerRow()">➕ הוסף עובד</button>\n        <div class="jw-total-box">👷 סה"כ שעות כוח אדם: <span id="totalWorkerHours" style="font-size:20px;color:#c9a84c;">0</span> שעות</div>\n      </div>\n\n      <!-- ═══ STEP 4: ACTIVITIES ═════════════════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-4">\n        <div class="jw-step-hdr"><span class="jw-step-ico">🔨</span><span class="jw-step-title">פעילויות שבוצעו</span></div>\n        <div id="activitiesContainer"></div>\n        <button class="jw-add-btn" onclick="addActivityRow()">➕ הוסף פעילות</button>\n      </div>\n\n      <!-- ═══ STEP 5: MATERIALS + EQUIPMENT ═════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-5">\n        <div class="jw-step-hdr"><span class="jw-step-ico">📦</span><span class="jw-step-title">חומרים וציוד</span><span class="jw-badge jw-badge-law">חובה לפי חוק</span></div>\n\n        <div style="font-size:13px;font-weight:800;color:#1a3d5c;margin-bottom:8px;">📦 אספקות חומרים</div>\n        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">\n          <select id="materialQuickSelect" style="flex:2;min-width:160px;padding:10px;border:1.5px solid #e2d0a0;border-radius:9px;font-size:14px;font-family:Heebo,sans-serif;direction:rtl;background:#fff;"></select>\n          <button onclick="addMaterialFromList()" style="background:#1a3d5c;color:#fff;border:none;border-radius:9px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;">➕ הוסף</button>\n        </div>\n        <div id="materialsContainer"></div>\n        <button class="jw-add-btn" onclick="addMaterialRow(\'\')">➕ הוסף שורה ריקה</button>\n\n        <div style="font-size:13px;font-weight:800;color:#1a3d5c;margin:16px 0 8px;">🚜 ציוד ומכונות</div>\n        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">\n          <select id="equipmentQuickSelect" style="flex:2;min-width:160px;padding:10px;border:1.5px solid #e2d0a0;border-radius:9px;font-size:14px;font-family:Heebo,sans-serif;direction:rtl;background:#fff;"></select>\n          <button onclick="addEquipmentFromList()" style="background:#1a3d5c;color:#fff;border:none;border-radius:9px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;">➕ הוסף</button>\n        </div>\n        <div id="equipmentContainer"></div>\n        <button class="jw-add-btn" onclick="addEquipmentRow(\'\')">➕ הוסף שורה ריקה</button>\n      </div>\n\n      <!-- ═══ STEP 6: SAFETY ════════════════════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-6">\n        <div class="jw-step-hdr"><span class="jw-step-ico">⚠️</span><span class="jw-step-title">בטיחות ואירועים</span><span class="jw-badge jw-badge-crit">קריטי</span></div>\n        <div id="safetyContainer"></div>\n        <button class="jw-add-btn" onclick="addSafetyRow()">➕ הוסף אירוע בטיחות</button>\n      </div>\n\n      <!-- ═══ STEP 7: INSPECTIONS + DELAYS ═════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-7">\n        <div class="jw-step-hdr"><span class="jw-step-ico">👮</span><span class="jw-step-title">ביקורות ועיכובים</span><span class="jw-badge jw-badge-law">חובה לפי חוק</span></div>\n\n        <div style="font-size:13px;font-weight:800;color:#1a3d5c;margin-bottom:8px;">👮 ביקורות ופיקוח</div>\n        <div id="inspectionsContainer"></div>\n        <button class="jw-add-btn" onclick="addInspectionRow()">➕ הוסף ביקורת</button>\n\n        <div style="font-size:13px;font-weight:800;color:#1a3d5c;margin:16px 0 8px;">⏰ עיכובים והפסקות</div>\n        <div id="delaysContainer"></div>\n        <button class="jw-add-btn" onclick="addDelayRow()">➕ הוסף עיכוב</button>\n      </div>\n\n      <!-- ═══ STEP 8: NOTES + SIGNATURES ═══════════════════════ -->\n      <div class="jw-step-panel" id="jw-panel-8">\n        <div class="jw-step-hdr"><span class="jw-step-ico">✍️</span><span class="jw-step-title">הערות, תמונות וחתימות</span></div>\n\n        <div class="jw-field">\n          <label>📝 הערות כלליות</label>\n          <div style="position:relative;">\n            <textarea id="generalNotes" placeholder="הערות כלליות לאתר... (לחץ 🎤 להקלטה)" style="padding-left:50px;"></textarea>\n            <button type="button" class="btn-voice" id="voiceNotesBtn" style="position:absolute;left:8px;top:8px;">🎤</button>\n          </div>\n        </div>\n\n        <div class="jw-field">\n          <label>📅 תוכנית עבודה למחר</label>\n          <div style="position:relative;">\n            <textarea id="tomorrowPlan" placeholder="מה מתוכנן למחר?" rows="3" style="padding-left:50px;"></textarea>\n            <button type="button" class="btn-voice" id="voiceTomorrowBtn" style="position:absolute;left:8px;top:8px;">🎤</button>\n          </div>\n          <input type="date" id="tomorrowDate" style="margin-top:6px;">\n        </div>\n\n        <div class="jw-field">\n          <label>📸 תמונות מהאתר</label>\n          <div onclick="document.getElementById(\'photoInput\').click()" style="border:2px dashed #c9a84c;border-radius:10px;padding:24px;text-align:center;cursor:pointer;background:#fffbf0;color:#9a6f00;font-size:13px;font-weight:700;">📷 לחץ להוספת תמונות</div>\n          <input type="file" id="photoInput" accept="image/*" capture="environment" multiple style="display:none">\n          <div id="photoPreview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(120px,100%),1fr));gap:8px;margin-top:8px;"></div>\n        </div>\n\n        <div class="jw-field">\n          <label>✍️ חתימת מנהל</label>\n          <canvas id="signatureCanvas" class="jw-sig-pad"></canvas>\n          <button onclick="clearSignature()" style="background:none;border:1px solid #ddd;border-radius:7px;padding:5px 12px;font-size:11px;color:#888;cursor:pointer;">🗑️ נקה חתימה</button>\n        </div>\n\n        <div id="jw-report-number-display" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:10px;padding:14px;text-align:center;margin:12px 0;">\n          <div id="reportNumber" style="font-size:11px;opacity:.8;margin-bottom:4px;">אישור עבודה</div>\n          <div id="jw-report-num-display" style="font-size:22px;font-weight:900;letter-spacing:2px;font-family:monospace;">טוען...</div>\n        </div>\n\n        <div class="jw-send-row">\n          <button class="jw-send-btn jw-send-primary" id="saveBtn">💾 שמור טיוטה</button>\n          <button class="jw-send-btn jw-send-success" id="sendBtn">📤 שלח לאישור</button>\n          <button class="jw-send-btn jw-send-wa" onclick="sendReportWhatsApp()">💬 WhatsApp</button>\n        </div>\n        <div style="display:flex;gap:8px;margin-top:8px;">\n          <button onclick="clearAllData()" style="flex:1;background:none;border:1px solid #ddd;border-radius:9px;padding:9px;font-size:12px;color:#888;cursor:pointer;font-family:Heebo,sans-serif;">🗑️ נקה הכל</button>\n          <button onclick="startNewReport()" style="flex:1;background:none;border:1px solid #ddd;border-radius:9px;padding:9px;font-size:12px;color:#888;cursor:pointer;font-family:Heebo,sans-serif;">🆕 דוח חדש</button>\n        </div>\n      </div>\n\n    </div><!-- /jw-main -->\n  </div><!-- /jw-body -->\n\n  <!-- FOOTER NAV -->\n  <div id="jw-footer">\n    <button id="jw-btn-back" onclick="jwBack()" style="display:none;">→ קודם</button>\n    <div id="jw-progress-wrap">\n      <div id="jw-progress-lbl">שלב 1 מתוך 8</div>\n      <div id="jw-progress-bar"><div id="jw-progress-fill" style="width:12%;"></div></div>\n    </div>\n    <button id="jw-btn-save" onclick="saveDraft()">💾 שמור</button>\n    <button id="jw-btn-fieldcard" onclick="jwGenerateFieldCard()" style="background:linear-gradient(135deg,#1b5e20,#43a047);color:#fff;border:none;border-radius:9px;padding:10px 16px;font-size:12px;font-weight:800;cursor:pointer;font-family:Heebo,sans-serif;display:flex;align-items:center;gap:6px;">\n      🚀 שלח לבני\n    </button>\n    <button id="jw-btn-next" onclick="jwNext()">הבא ←</button>\n  </div>\n</div><!-- /journal-wizard -->\n\n<!-- ══ FIELD CARD PREVIEW MODAL ═══════════════════════════════════════ -->\n<div id="jw-fieldcard-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:8000;align-items:center;justify-content:center;padding:16px;">\n  <div style="background:#1a1a2e;border-radius:20px;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">\n    <!-- Phone-style header -->\n    <div style="background:linear-gradient(135deg,#1b5e20,#2e7d32);border-radius:20px 20px 0 0;padding:16px 20px;">\n      <div style="font-size:10px;color:rgba(255,255,255,0.6);letter-spacing:2px;margin-bottom:4px;">BENI FIELD CARD</div>\n      <div style="font-size:17px;font-weight:900;color:#fff;" id="fc-project-name">—</div>\n      <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;" id="fc-date-weather">—</div>\n    </div>\n\n    <!-- Content -->\n    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;" id="fc-content">\n      <div style="text-align:center;color:#555;font-size:13px;padding:20px;">⏳ מייצר כרטיס שטח...</div>\n    </div>\n\n    <!-- Actions -->\n    <div style="padding:12px 16px 20px;display:flex;gap:8px;flex-direction:column;">\n      <button onclick="jwSendFieldCardWhatsApp()" style="width:100%;padding:14px;background:#25d366;border:none;color:#fff;border-radius:12px;font-family:Heebo,sans-serif;font-size:14px;font-weight:900;cursor:pointer;">\n        💬 שלח ל-WhatsApp של בני\n      </button>\n      <button onclick="jwSaveFieldCardToDB()" style="width:100%;padding:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#ccc;border-radius:12px;font-family:Heebo,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">\n        💾 שמור לבניי פוקט\n      </button>\n      <button onclick="document.getElementById(\'jw-fieldcard-modal\').style.display=\'none\'" style="width:100%;padding:10px;background:none;border:none;color:#555;font-family:Heebo,sans-serif;font-size:12px;cursor:pointer;">\n        סגור\n      </button>\n    </div>\n  </div>\n</div>\n\n<!-- ══ CALL RECORDINGS SECTION (inside journal-panel, after wizard) ══ -->\n<div id="call-recordings-section" style="display:none;background:#1a1a2e;font-family:Heebo,sans-serif;direction:rtl;padding:24px;min-height:400px;">\n\n  <!-- Header -->\n  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">\n    <div>\n      <div style="font-size:10px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:4px;">AI Transcription</div>\n      <h2 style="font-size:20px;font-weight:900;color:#fff;margin:0;">📞 הקלטות שיחות — ניתוח AI</h2>\n      <div style="font-size:12px;color:#666;margin-top:3px;">העלה הקלטה מהאנדרואיד — Claude יתמלל, ינתח ויצור משימות</div>\n    </div>\n    <button onclick="crLoadHistory()" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#888;border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;">🔄 רענן</button>\n  </div>\n\n  <!-- Upload section -->\n  <div style="background:#242438;border-radius:14px;padding:16px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.06);">\n    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">\n      <input type="text" id="cr-caller-name" placeholder="שם המתקשר / נושא השיחה..."\n        style="flex:2;min-width:180px;padding:10px 14px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;">\n      <select id="cr-project-sel"\n        style="flex:1;min-width:160px;padding:10px 14px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;direction:rtl;">\n        <option value="">📁 קשר לפרויקט</option>\n      </select>\n    </div>\n    <label style="display:flex;align-items:center;gap:10px;background:rgba(201,168,76,0.15);border:1.5px solid rgba(201,168,76,0.4);color:#c9a84c;padding:12px 20px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:800;width:fit-content;">\n      <span id="cr-upload-btn">📤 העלה הקלטות</span>\n      <input type="file" id="cr-file-input" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" multiple style="display:none;">\n    </label>\n    <div id="cr-upload-status" style="font-size:12px;color:#888;margin-top:8px;"></div>\n    <div style="font-size:11px;color:#555;margin-top:6px;">תומך ב: MP3 · M4A · WAV · OGG · AAC · כל קובץ שמע</div>\n  </div>\n\n  <!-- History -->\n  <div id="cr-history-list">\n    <div style="text-align:center;padding:30px;color:#555;font-size:13px;">טוען הקלטות...</div>\n  </div>\n\n</div>\n\n<!-- OWNER VIEW (approval page - unchanged) -->\n<div id="ownerView" style="display:none;padding:20px;font-family:Heebo,sans-serif;direction:rtl;">\n  <button onclick="switchTab(\'crm\')" style="background:linear-gradient(135deg,#1a3d5c,#2d6a9f);color:white;border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px;">← חזור ללוח בקרה</button>\n  <button class="btn-print" onclick="printReport()">🖨️ הדפס</button>\n  <div class="print-report-number" id="printReportNumber"></div>\n  <main class="container" id="printableArea">\n    <div id="reportDetails"></div>\n    <section class="section no-print">\n      <h2>📸 הוסף תמונות שלך</h2>\n      <div class="photo-upload" onclick="document.getElementById(\'ownerPhotoInput\').click()"><span>📷 לחץ להוספת תמונות</span></div>\n      <input type="file" id="ownerPhotoInput" accept="image/*" capture="environment" multiple style="display:none">\n      <div id="ownerPhotoPreview" class="photo-preview"></div>\n    </section>\n    <section class="section no-print">\n      <h2>✍️ אישור</h2>\n      <input type="text" id="ownerName" placeholder="שם מלא" style="width:100%;padding:10px;border:1.5px solid #e2d0a0;border-radius:9px;font-size:14px;font-family:Heebo,sans-serif;margin-bottom:10px;">\n      <div style="position:relative;margin-bottom:10px;">\n        <textarea id="ownerRemarks" placeholder="הערות (אופציונלי)" style="width:100%;padding:10px 50px 10px 10px;border:1.5px solid #e2d0a0;border-radius:9px;font-size:14px;font-family:Heebo,sans-serif;resize:vertical;min-height:70px;direction:rtl;"></textarea>\n        <button type="button" class="btn-voice" id="voiceRemarksBtn">🎤</button>\n      </div>\n      <canvas id="ownerSignature" class="signature-pad"></canvas>\n      <div style="display:flex;gap:8px;">\n        <button onclick="clearOwnerSignature()" class="btn-secondary" style="flex:1;">🗑️ נקה</button>\n        <button onclick="approveReport()" class="btn-success" style="flex:2;">✅ אשר ושלח</button>\n      </div>\n    </section>\n  </main>\n</div>\n\n</div><!-- /journal-panel -->';
})();

// ── 2. FIELD JOURNAL JS ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
// FIELD JOURNAL — יומן שטח יומי
// ══════════════════════════════════════════════════════════════════════
var _fjPhase = 'morning';
var _fjJournalId = null;
var _fjTasks = [];
var _fjObs = [];

async function fjInit() {
  // Set today's date
  var today = new Date().toISOString().split('T')[0];
  var dateSel = document.getElementById('fj-date-sel');
  if (dateSel && !dateSel.value) dateSel.value = today;
  var dateDisp = document.getElementById('fj-date-display');
  if (dateDisp) dateDisp.textContent = new Date().toLocaleDateString('he-IL', {weekday:'long', year:'numeric', month:'long', day:'numeric'});

  // Populate project selector
  var sel = document.getElementById('fj-project-sel');
  if (sel && sel.options.length <= 1) {
    (window.allProjects||[]).forEach(function(p) {
      var o = document.createElement('option'); o.value=p.id; o.textContent=p.project_name; sel.appendChild(o);
    });
  }

  fjSetPhase('morning');
}

function fjSetPhase(phase) {
  _fjPhase = phase;
  var phases = ['morning','field','takeoff','eod'];
  phases.forEach(function(p) {
    var btn = document.getElementById('fj-tab-' + p);
    if (!btn) return;
    if (p === phase) {
      btn.style.border = '2px solid #7F77DD';
      btn.style.background = 'rgba(127,119,221,0.15)';
      btn.style.color = '#c4b5fd';
    } else {
      btn.style.border = '1px solid rgba(255,255,255,0.1)';
      btn.style.background = 'rgba(255,255,255,0.03)';
      btn.style.color = '#ccc';
    }
  });
  var content = document.getElementById('fj-phase-content');
  if (!content) return;
  if (phase === 'morning')  fjRenderMorning(content);
  if (phase === 'field')    fjRenderField(content);
  if (phase === 'takeoff')  fjRenderTakeoff(content);
  if (phase === 'eod')      fjRenderEOD(content);
}

function fjRenderMorning(container) {
  container.innerHTML = '';
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;';

  // LEFT: Upload handwriting
  var left = document.createElement('div');
  left.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  var uploadCard = fjCard('📝 דף בוקר — כתב יד', `
    <div style="border:2px dashed #a5d6a7;border-radius:10px;padding:20px;text-align:center;cursor:pointer;direction:rtl;background:#f1f8e9;" onclick="document.getElementById('fj-morning-upload').click()">
      <div style="font-size:32px;margin-bottom:8px;">📷</div>
      <div style="font-size:13px;color:#2e7d32;font-weight:800;">צלם את דף המשימות</div>
      <div style="font-size:11px;color:#558b2f;margin-top:4px;">Claude קורא ומחלץ משימות אוטומטית</div>
      <input type="file" id="fj-morning-upload" accept="image/*" style="display:none;" onchange="fjHandleMorningUpload(this)">
    </div>
    <div id="fj-morning-ocr" style="display:none;margin-top:10px;"></div>
    <button onclick="fjExtractTasks()" id="fj-extract-btn" style="display:none;width:100%;padding:11px;background:linear-gradient(135deg,#388e3c,#66bb6a);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;margin-top:8px;">
      🤖 חלץ משימות + לוח זמנים
    </button>
  `);
  left.appendChild(uploadCard);

  // Manual task add
  var addCard = fjCard('➕ הוסף משימה ידנית', `
    <div style="display:flex;gap:8px;margin-bottom:8px;direction:rtl;">
      <input id="fj-task-input" type="text" placeholder="תיאור המשימה..."
        style="flex:1;background:#f1f8e9;border:1.5px solid #a5d6a7;color:#1b5e20;padding:8px 10px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">
      <select id="fj-task-tag" style="background:#f1f8e9;border:1.5px solid #a5d6a7;color:#1b5e20;padding:8px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;">
        <option value="site">שטח</option>
        <option value="urgent">דחוף</option>
        <option value="schedule">לוח זמנים</option>
        <option value="safety">בטיחות</option>
        <option value="other">אחר</option>
      </select>
    </div>
    <button onclick="fjAddTaskManual()" style="width:100%;padding:9px;background:linear-gradient(135deg,#388e3c,#66bb6a);border:none;color:#fff;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
      ✅ הוסף משימה
    </button>
  `);
  left.appendChild(addCard);

  // RIGHT: Task list
  var right = document.createElement('div');
  var taskCard = document.createElement('div');
  taskCard.style.cssText = 'background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:16px;height:100%;box-shadow:0 2px 8px rgba(76,175,80,0.08);';
  taskCard.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:13px;font-weight:800;color:#2e7d32;">✅ משימות היום</div><div id="fj-task-stats" style="font-size:11px;color:#558b2f;"></div></div><div id="fj-task-list" style="display:flex;flex-direction:column;gap:6px;"></div><div style="margin-top:14px;padding-top:12px;border-top:1px solid #c8e6c9;"><button onclick="fjSendBriefing()" style="width:100%;padding:10px;background:linear-gradient(135deg,#1b5e20,#43a047);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📲 שלח בריפינג לבני</button></div>';
  right.appendChild(taskCard);

  grid.appendChild(left);
  grid.appendChild(right);
  container.appendChild(grid);

  fjLoadTasks();
}

async function fjHandleMorningUpload(input) {
  var file = input.files[0];
  if (!file) return;
  var ocrDiv = document.getElementById('fj-morning-ocr');
  var extractBtn = document.getElementById('fj-extract-btn');
  if (ocrDiv) { ocrDiv.style.display='block'; ocrDiv.innerHTML='<div style="color:#888;font-size:12px;direction:rtl;">⏳ קורא כתב יד...</div>'; }

  // Upload to Cloudinary first
  showToast('📤 מעלה תמונה...','success');
  var fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', 'beni_field');
  fd.append('folder', 'daily_journal');
  var cldRes = await fetch('https://api.cloudinary.com/v1_1/dqdku88vv/image/upload', {method:'POST',body:fd});
  var cldData = await cldRes.json();
  var imgUrl = cldData.secure_url;

  // Run OCR via Claude Vision
  var apiKey = APP && APP.config && APP.config.anthropic_key;
  if (!apiKey) { showToast('מפתח Claude חסר','error'); return; }

  var b64 = await new Promise(function(res){ var r=new FileReader(); r.onload=function(e){res(e.target.result);}; r.readAsDataURL(file); });
  var b64data = b64.split(',')[1];

  var resp = await claudeFetch({
    _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:1000,
    system:'אתה קורא כתב יד עברי. קרא את הטקסט בדיוק כפי שכתוב. אחר כך הצג רשימת משימות מספרת.',
    messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64data}},{type:'text',text:'קרא כתב יד זה וחלץ את כל המשימות כרשימה.'}]}]
  }, null);
  var data = await resp.json();
  var text = data.content && data.content[0] ? data.content[0].text : '';
  window._fjMorningOcrText = text;
  window._fjMorningImgUrl = imgUrl;

  if (ocrDiv) {
    ocrDiv.innerHTML = '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px;font-size:12px;color:#e2e8f0;direction:rtl;line-height:1.7;white-space:pre-wrap;">' + text.replace(/</g,'&lt;') + '</div>';
  }
  if (extractBtn) extractBtn.style.display='block';
  showToast('✅ כתב יד נקרא','success');
}

async function fjExtractTasks() {
  var text = window._fjMorningOcrText || '';
  if (!text) { showToast('העלה תמונה תחילה','error'); return; }
  var apiKey = APP && APP.config && APP.config.anthropic_key;
  showToast('🤖 מחלץ משימות...','success');

  var resp = await claudeFetch({
    _apiKey: apiKey, model:'claude-sonnet-4-20250514', max_tokens:800,
    system:'חלץ משימות מהטקסט. החזר JSON בלבד: {"tasks":[{"text":"...","tag":"urgent|schedule|site|safety|other"}]}',
    messages:[{role:'user',content:'חלץ משימות: ' + text}]
  }, null);
  var data = await resp.json();
  var raw = data.content && data.content[0] ? data.content[0].text : '{}';
  try {
    var parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : null;
    var today = new Date().toISOString().split('T')[0];
    for (var t of (parsed.tasks||[])) {
      await sb.from('daily_tasks').insert({
        task_text: t.text, tag: t.tag || 'other',
        task_date: today, project_id: pid || null,
        is_done: false, created_at: new Date().toISOString()
      });
    }
    showToast('✅ ' + (parsed.tasks||[]).length + ' משימות נוצרו','success');
    fjLoadTasks();
  } catch(e) { showToast('❌ ' + e.message,'error'); }
}

async function fjAddTaskManual() {
  var inp = document.getElementById('fj-task-input');
  var tag = document.getElementById('fj-task-tag');
  if (!inp || !inp.value.trim()) { showToast('הכנס תיאור משימה','error'); return; }
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : null;
  await sb.from('daily_tasks').insert({
    task_text: inp.value.trim(), tag: tag ? tag.value : 'other',
    task_date: new Date().toISOString().split('T')[0],
    project_id: pid || null, is_done: false,
    created_at: new Date().toISOString()
  });
  inp.value = '';
  showToast('✅ משימה נוספה','success');
  fjLoadTasks();
}

async function fjLoadTasks() {
  var today = document.getElementById('fj-date-sel') ? document.getElementById('fj-date-sel').value : new Date().toISOString().split('T')[0];
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : '';
  var qs = 'task_date=eq.' + today + '&order=created_at.asc&select=id,task_text,tag,is_done,created_at,project_id';
  if (pid) qs += '&project_id=eq.' + pid;
  var { data: tasks } = await sbQ('daily_tasks', qs);
  tasks = tasks || [];
  _fjTasks = tasks;

  var listEl = document.getElementById('fj-task-list');
  var statsEl = document.getElementById('fj-task-stats');
  if (!listEl) return;

  var done = tasks.filter(function(t){ return t.is_done; }).length;
  if (statsEl) statsEl.textContent = done + '/' + tasks.length + ' הושלמו';

  listEl.innerHTML = '';
  var tagColors = {urgent:'#ffcdd2',schedule:'#bbdefb',site:'#c8e6c9',safety:'#fff9c4',other:'#f5f5f5'};
  var tagText = {urgent:'דחוף',schedule:'לוח זמנים',site:'שטח',safety:'בטיחות',other:'אחר'};

  tasks.forEach(function(t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:#f1f8e9;border:1px solid #c8e6c9;border-radius:8px;direction:rtl;';
    var chk = document.createElement('div');
    chk.style.cssText = 'width:20px;height:20px;border-radius:6px;border:2px solid ' + (t.is_done?'#43a047':'#a5d6a7') + ';background:' + (t.is_done?'#43a047':'transparent') + ';cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;';
    if (t.is_done) chk.textContent = '✓';
    chk.addEventListener('click', (function(id, done){ return function(){
      fetch(SB_URL+'/rest/v1/daily_tasks?id=eq.'+id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({is_done:!done,done_at:!done?new Date().toISOString():null})}).then(fjLoadTasks);
    }; })(t.id, t.is_done));

    var txt = document.createElement('div');
    txt.style.cssText = 'flex:1;font-size:12px;color:' + (t.is_done?'#888':'#1b5e20') + ';text-decoration:' + (t.is_done?'line-through':'none') + ';font-weight:600;';
    txt.textContent = t.task_text;

    var tag = document.createElement('div');
    tag.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:20px;background:' + (tagColors[t.tag]||tagColors.other) + ';color:#1b5e20;font-weight:700;flex-shrink:0;';
    tag.textContent = tagText[t.tag] || t.tag;

    var del = document.createElement('button');
    del.textContent = '🗑️';
    del.style.cssText = 'background:none;border:none;cursor:pointer;font-size:11px;opacity:0.5;';
    del.onclick = (function(id){ return function(){ fetch(SB_URL+'/rest/v1/daily_tasks?id=eq.'+id,{method:'DELETE',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}}).then(fjLoadTasks); }; })(t.id);

    row.appendChild(chk); row.appendChild(txt); row.appendChild(tag); row.appendChild(del);
    listEl.appendChild(row);
  });
}

// Load today's briefing from Avshi into wizard Step 1 banner
async function jwLoadBriefing() {
  // Check projects state
  jwCheckProjects();
  // Default to table option
  jwTasksShowOption('table');

  var today = new Date().toISOString().split('T')[0];
  var banner = document.getElementById('jw-briefing-banner');
  var textEl = document.getElementById('jw-briefing-text');
  var timeEl = document.getElementById('jw-briefing-time');
  if (!banner || !textEl) return;
  try {
    var { data } = await sbQ('daily_briefings', 'briefing_date=eq.' + today + '&order=created_at.desc&limit=1&select=briefing_text,created_at');
    if (data && data.length > 0) {
      textEl.textContent = data[0].briefing_text || '';
      if (timeEl) timeEl.textContent = 'נשלח: ' + new Date(data[0].created_at).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit'});
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  } catch(e) { banner.style.display = 'none'; }
}

async function fjSendBriefing() {
  var today = new Date().toISOString().split('T')[0];
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : null;
  var pending = _fjTasks.filter(function(t){ return !t.is_done; });
  var done = _fjTasks.filter(function(t){ return t.is_done; });

  var briefText = '📋 בריפינג לבני — ' + new Date().toLocaleDateString('he-IL') + '\n\n';
  if (done.length) briefText += '✅ הושלם:\n' + done.map(function(t){ return '• ' + t.task_text; }).join('\n') + '\n\n';
  if (pending.length) briefText += '⏳ ממתין:\n' + pending.map(function(t){ return '• ' + t.task_text; }).join('\n');

  var { error } = await sb.from('daily_briefings').insert({
    project_id: pid || null,
    briefing_date: today,
    briefing_text: briefText,
    task_ids: _fjTasks.map(function(t){ return t.id; }),
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });

  if (error) { showToast('❌ ' + error.message,'error'); return; }
  showToast('📲 בריפינג נשלח לבני!','success');
  jwLoadBriefing(); // refresh banner in wizard
}

function fjRenderField(container) {
  container.innerHTML = '';
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;';

  // Photos + AI analysis
  var leftCard = fjCard('📸 תמונות ותצפיות שטח', `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <label style="background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">
        📷 צלם / העלה<input type="file" accept="image/*,video/*" style="display:none;" onchange="fjHandleFieldUpload(this,'photo')">
      </label>
      <label style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.4);color:#c4b5fd;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;">
        🖼️ גלריה<input type="file" accept="image/*,video/*,audio/*" multiple style="display:none;" onchange="fjHandleFieldUpload(this,'gallery')">
      </label>
    </div>
    <div id="fj-field-obs" style="display:flex;flex-direction:column;gap:8px;max-height:350px;overflow-y:auto;"></div>
  `);

  // Voice memos
  var rightCard = fjCard('🎙️ הערות קוליות + ממצאים', `
    <label style="display:block;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fde68a;padding:10px;border-radius:8px;cursor:pointer;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;text-align:center;margin-bottom:10px;">
      🎙️ העלה הקלטה קולית<input type="file" accept="audio/*" multiple style="display:none;" onchange="fjHandleFieldUpload(this,'audio')">
    </label>
    <div id="fj-field-audio" style="display:flex;flex-direction:column;gap:8px;max-height:350px;overflow-y:auto;"></div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.07);">
      <textarea id="fj-field-note" placeholder="הוסף הערה כתובה..." rows="3"
        style="width:100%;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:8px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;resize:vertical;"></textarea>
      <button onclick="fjSaveNote()" style="margin-top:6px;width:100%;padding:8px;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);color:#93c5fd;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        💾 שמור הערה
      </button>
    </div>
  `);

  grid.appendChild(leftCard);
  grid.appendChild(rightCard);
  container.appendChild(grid);
  fjLoadFieldObs();
}

async function fjHandleFieldUpload(input, type) {
  var files = Array.from(input.files||[]);
  if (!files.length) return;
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : null;
  showToast('📤 מעלה ' + files.length + ' קבצים...','success');
  for (var file of files) {
    var isAudio = file.type.startsWith('audio/');
    var isVideo = file.type.startsWith('video/');
    var endpoint = (isAudio||isVideo) ? 'https://api.cloudinary.com/v1_1/dqdku88vv/video/upload' : 'https://api.cloudinary.com/v1_1/dqdku88vv/image/upload';
    var fd = new FormData();
    fd.append('file', file); fd.append('upload_preset','beni_field'); fd.append('folder','field_journal');
    var res = await fetch(endpoint,{method:'POST',body:fd});
    var data = await res.json();
    if (!data.secure_url) continue;
    var mediaType = isAudio ? 'audio' : isVideo ? 'video' : 'photo';
    await sb.from('field_observations').insert({
      project_id: pid||null, obs_date: new Date().toISOString().split('T')[0],
      media_url: data.secure_url, media_type: mediaType,
      description: file.name, created_at: new Date().toISOString()
    });
  }
  showToast('✅ נשמר ביומן שטח','success');
  fjLoadFieldObs();
}

async function fjSaveNote() {
  var note = document.getElementById('fj-field-note');
  if (!note||!note.value.trim()) return;
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : null;
  await sb.from('field_observations').insert({
    project_id: pid||null, obs_date: new Date().toISOString().split('T')[0],
    media_type:'note', description: note.value.trim(), created_at: new Date().toISOString()
  });
  note.value='';
  showToast('✅ הערה נשמרה','success');
  fjLoadFieldObs();
}

async function fjLoadFieldObs() {
  var today = document.getElementById('fj-date-sel') ? document.getElementById('fj-date-sel').value : new Date().toISOString().split('T')[0];
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : '';
  var qs = 'obs_date=eq.' + today + '&order=created_at.desc&select=id,media_url,media_type,description,ai_analysis,severity,saved_to_encyclopedia,created_at';
  if (pid) qs += '&project_id=eq.' + pid;
  var { data: obs } = await sbQ('field_observations', qs);
  obs = obs || [];

  var photoEl = document.getElementById('fj-field-obs');
  var audioEl = document.getElementById('fj-field-audio');
  if (photoEl) photoEl.innerHTML = '';
  if (audioEl) audioEl.innerHTML = '';

  obs.forEach(function(o) {
    var card = document.createElement('div');
    card.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px;';
    var date = new Date(o.created_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});

    if (o.media_type === 'photo') {
      card.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start;"><img src="'+o.media_url+'" style="width:80px;height:60px;object-fit:cover;border-radius:6px;cursor:zoom-in;flex-shrink:0;" onclick="openLightbox(\''+o.media_url+'\',\'\')"><div style="flex:1;"><div style="font-size:11px;color:#888;margin-bottom:4px;">📸 '+date+'</div><div style="font-size:12px;color:#ccc;">'+(o.description||'')+'</div>'+(o.ai_analysis?'<div style="font-size:11px;color:#86efac;margin-top:4px;">✅ '+o.ai_analysis.substring(0,80)+'...</div>':'')+'</div></div><div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;"><button onclick="fjAnalyzeObs(\''+o.id+'\',\''+o.media_url+'\')" style="font-size:10px;padding:3px 8px;border-radius:20px;border:1px solid rgba(139,92,246,0.4);background:rgba(139,92,246,0.15);color:#c4b5fd;cursor:pointer;font-family:Heebo,sans-serif;">🚀 נתח</button><button onclick="fjSaveToEnc(\''+o.id+'\')" style="font-size:10px;padding:3px 8px;border-radius:20px;border:1px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.15);color:#c9a84c;cursor:pointer;font-family:Heebo,sans-serif;">📚 אנציקלופדיה</button></div>';
      if (photoEl) photoEl.appendChild(card);
    } else if (o.media_type === 'audio') {
      card.innerHTML = '<div style="font-size:11px;color:#888;margin-bottom:4px;">🎙️ '+date+'</div><audio src="'+o.media_url+'" controls style="width:100%;border-radius:6px;"></audio><div style="font-size:12px;color:#ccc;margin-top:4px;">'+(o.description||'')+'</div>';
      if (audioEl) audioEl.appendChild(card);
    } else if (o.media_type === 'note') {
      card.innerHTML = '<div style="font-size:11px;color:#888;margin-bottom:4px;">📝 '+date+'</div><div style="font-size:12px;color:#e2e8f0;">'+o.description+'</div>';
      if (photoEl) photoEl.appendChild(card);
    } else if (o.media_type === 'video') {
      card.innerHTML = '<div style="font-size:11px;color:#888;margin-bottom:4px;">🎬 '+date+'</div><video src="'+o.media_url+'" controls style="width:100%;max-height:150px;border-radius:6px;"></video><div style="display:flex;gap:4px;margin-top:6px;"><button onclick="fjAnalyzeObs(\''+o.id+'\',\''+o.media_url+'\')" style="font-size:10px;padding:3px 8px;border-radius:20px;border:1px solid rgba(139,92,246,0.4);background:rgba(139,92,246,0.15);color:#c4b5fd;cursor:pointer;font-family:Heebo,sans-serif;">📸 חלץ פריים + נתח</button></div>';
      if (photoEl) photoEl.appendChild(card);
    }
  });
}

async function fjAnalyzeObs(obsId, mediaUrl) {
  var apiKey = APP && APP.config && APP.config.anthropic_key;
  if (!apiKey) { showToast('מפתח Claude חסר','error'); return; }
  showToast('🤖 מנתח...','success');
  var isVideo = mediaUrl.includes('/video/upload/') && !mediaUrl.includes('/beni_voice/');
  var analyzeUrl = isVideo ? mediaUrl.replace('/upload/','/upload/so_1,w_1200,f_jpg/').replace(/\.(mp4|mov|3gp)(\?.*)?$/i,'.jpg') : mediaUrl;
  var imageContent;
  try {
    var r = await fetch(analyzeUrl);
    if (r.ok) {
      var blob = await r.blob();
      var b64 = await new Promise(function(res){var rd=new FileReader();rd.onload=function(e){res(e.target.result.split(',')[1]);};rd.readAsDataURL(blob);});
      imageContent = {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}};
    }
  } catch(e) {}
  if (!imageContent) imageContent = {type:'image',source:{type:'url',url:analyzeUrl}};

  var resp = await claudeFetch({
    _apiKey:apiKey, model:'claude-sonnet-4-20250514', max_tokens:600,
    system:'אתה מהנדס בנייה ישראלי. נתח בקצרה (3-4 משפטים) מה רואים בתמונה: בעיות בטיחות, ליקויים, ממצאים חשובים.',
    messages:[{role:'user',content:[imageContent,{type:'text',text:'נתח את הממצאים בתמונה זו.'}]}]
  }, null);
  var data = await resp.json();
  var analysis = data.content && data.content[0] ? data.content[0].text : '';
  await fetch(SB_URL+'/rest/v1/field_observations?id=eq.'+obsId,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({ai_analysis:analysis})});
  showToast('✅ ניתוח הושלם','success');
  fjLoadFieldObs();
}

async function fjSaveToEnc(obsId) {
  var { data: obs } = await sbQ('field_observations','id=eq.'+obsId+'&select=*');
  if (!obs||!obs[0]) return;
  var o = obs[0];
  // Open a quick modal to categorize
  var category = prompt('קטגוריה (בטיחות/ריצוף/איטום/גמר/מבנה/ביקורת):', 'ביקורת שטח');
  if (!category) return;
  var title = prompt('כותרת:', o.description ? o.description.substring(0,60) : 'ממצא שטח');
  if (!title) return;
  await sb.from('field_encyclopedia').insert({
    category: category, title: title,
    description: o.ai_analysis || o.description,
    media_url: o.media_url, media_type: o.media_type,
    source_project_id: o.project_id,
    source_observation_id: o.id,
    severity: 'important',
    tags: ['שטח'],
    created_at: new Date().toISOString()
  });
  await fetch(SB_URL+'/rest/v1/field_observations?id=eq.'+obsId,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({saved_to_encyclopedia:true})});
  showToast('📚 נשמר באנציקלופדיה','success');
}

function fjRenderTakeoff(container) {
  container.innerHTML = '';
  var card = document.createElement('div');
  card.style.cssText = 'background:#1e1e35;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;direction:rtl;';
  card.innerHTML = `
    <div style="font-size:14px;font-weight:900;color:#c9a84c;margin-bottom:14px;">📐 כמויות שטח — Takeoffs</div>
    <div id="fj-takeoff-list" style="margin-bottom:14px;"></div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center;direction:rtl;margin-bottom:8px;">
      <input id="fj-tk-desc" placeholder="תיאור עבודה..." style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:8px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;">
      <input id="fj-tk-qty" type="number" placeholder="כמות" style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:8px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;">
      <select id="fj-tk-unit" style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:8px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;">
        <option>מ"ר</option><option>מ"ל</option><option>יח'</option><option>ק"ג</option><option>טון</option>
      </select>
      <button onclick="fjAddTakeoff()" style="padding:8px 14px;background:rgba(34,197,94,0.2);border:1px solid rgba(34,197,94,0.4);color:#86efac;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;font-weight:700;cursor:pointer;">➕</button>
    </div>
    <button onclick="fjExportTakeoffs()" style="width:100%;padding:10px;background:linear-gradient(135deg,#c9a84c,#9a6f00);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;margin-top:8px;">
      📊 ייצא ל-CRM
    </button>
  `;
  container.appendChild(card);
  fjLoadTakeoffs();
}

async function fjLoadTakeoffs() {
  var today = document.getElementById('fj-date-sel') ? document.getElementById('fj-date-sel').value : new Date().toISOString().split('T')[0];
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : '';
  var qs = 'session_date=eq.' + today + '&order=created_at.asc&select=id,description,quantity,unit,created_at';
  if (pid) qs += '&project_id=eq.' + pid;
  var { data: items } = await sbQ('site_takeoffs', qs);
  items = items || [];
  var listEl = document.getElementById('fj-takeoff-list');
  if (!listEl) return;
  var total = items.reduce(function(s,i){ return s + (parseFloat(i.quantity)||0); },0);
  listEl.innerHTML = items.map(function(i){ return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;"><span style="color:#ccc;">'+(i.description||'')+'</span><span style="color:#c9a84c;font-weight:700;">'+(i.quantity||0)+' '+(i.unit||'מ"ר')+'</span></div>'; }).join('') + '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;font-weight:800;"><span style="color:#fff;">סה"כ</span><span style="color:#7F77DD;">'+total.toFixed(1)+' מ"ר</span></div>';
}

async function fjAddTakeoff() {
  var desc = document.getElementById('fj-tk-desc'); var qty = document.getElementById('fj-tk-qty'); var unit = document.getElementById('fj-tk-unit');
  if (!desc||!desc.value.trim()||!qty||!qty.value) { showToast('מלא תיאור וכמות','error'); return; }
  var pid = document.getElementById('fj-project-sel') ? document.getElementById('fj-project-sel').value : null;
  await sb.from('site_takeoffs').insert({
    description:desc.value.trim(), quantity:parseFloat(qty.value), unit:unit?unit.value:'מ"ר',
    project_id:pid||null, session_date:new Date().toISOString().split('T')[0],
    created_at:new Date().toISOString()
  });
  desc.value=''; qty.value='';
  showToast('✅ כמות נוספה','success');
  fjLoadTakeoffs();
}

function fjExportTakeoffs() {
  showToast('📊 הכמויות זמינות ב-CRM תחת הפרויקט','success');
  switchTab('crm'); showPage('quotes');
}

function fjRenderEOD(container) {
  container.innerHTML = '';
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;';

  var leftCard = fjCard('📝 סיכום יום — כתב יד', `
    <div style="border:2px dashed rgba(201,168,76,0.4);border-radius:10px;padding:20px;text-align:center;cursor:pointer;" onclick="document.getElementById('fj-eod-upload').click()">
      <div style="font-size:32px;margin-bottom:8px;">📷</div>
      <div style="font-size:13px;color:#c9a84c;font-weight:800;">צלם דף סיכום</div>
      <div style="font-size:11px;color:#555;margin-top:4px;">Claude מכין בריפינג לבוקר מחר</div>
      <input type="file" id="fj-eod-upload" accept="image/*" style="display:none;" onchange="fjHandleEODUpload(this)">
    </div>
    <div id="fj-eod-ocr" style="display:none;margin-top:10px;"></div>
    <textarea id="fj-eod-manual" rows="4" placeholder="או כתוב ישירות סיכום יום..." style="width:100%;margin-top:10px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:8px;border-radius:8px;font-family:Heebo,sans-serif;font-size:12px;direction:rtl;resize:vertical;"></textarea>
  `);

  var rightCard = fjCard('🌅 בריפינג מחר', `
    <div id="fj-briefing-preview" style="background:rgba(127,119,221,0.08);border:1px solid rgba(127,119,221,0.2);border-radius:10px;padding:12px;font-size:12px;color:#e2e8f0;line-height:1.8;direction:rtl;min-height:120px;">
      <div style="color:#555;font-size:11px;">לחץ "צור בריפינג" להפקה אוטומטית</div>
    </div>
    <button onclick="fjGenerateBriefing()" style="margin-top:10px;width:100%;padding:10px;background:linear-gradient(135deg,#7F77DD,#534AB7);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
      🤖 צור בריפינג לבוקר
    </button>
    <button onclick="fjSendBriefing()" style="margin-top:6px;width:100%;padding:10px;background:linear-gradient(135deg,#1e6b30,#22c55e);border:none;color:#fff;border-radius:10px;font-family:Heebo,sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
      📲 שלח לבני לבוקר
    </button>
  `);

  grid.appendChild(leftCard);
  grid.appendChild(rightCard);
  container.appendChild(grid);
}

async function fjHandleEODUpload(input) {
  var file = input.files[0]; if (!file) return;
  var ocrDiv = document.getElementById('fj-eod-ocr');
  if (ocrDiv) { ocrDiv.style.display='block'; ocrDiv.innerHTML='<div style="color:#888;font-size:12px;">⏳ קורא כתב יד...</div>'; }
  var apiKey = APP && APP.config && APP.config.anthropic_key;
  var b64 = await new Promise(function(res){var r=new FileReader();r.onload=function(e){res(e.target.result.split(',')[1]);};r.readAsDataURL(file);});
  var resp = await claudeFetch({_apiKey:apiKey,model:'claude-sonnet-4-20250514',max_tokens:600,system:'קרא כתב יד עברי בדיוק.',messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:'קרא את הטקסט.'}]}]},null);
  var data = await resp.json();
  var text = data.content&&data.content[0]?data.content[0].text:'';
  window._fjEodText = text;
  if (ocrDiv) ocrDiv.innerHTML='<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px;font-size:12px;color:#e2e8f0;direction:rtl;white-space:pre-wrap;">'+text.replace(/</g,'&lt;')+'</div>';
  document.getElementById('fj-eod-manual').value = text;
}

async function fjGenerateBriefing() {
  var eodText = window._fjEodText || document.getElementById('fj-eod-manual').value;
  var pending = _fjTasks.filter(function(t){ return !t.is_done; });
  var done = _fjTasks.filter(function(t){ return t.is_done; });
  var apiKey = APP && APP.config && APP.config.anthropic_key;
  if (!apiKey) { showToast('מפתח Claude חסר','error'); return; }
  showToast('🤖 מכין בריפינג...','success');

  var context = 'הושלם היום:\n' + done.map(function(t){ return '• '+t.task_text; }).join('\n') +
    '\n\nממתין:\n' + pending.map(function(t){ return '• '+t.task_text; }).join('\n') +
    (eodText ? '\n\nסיכום יום מהשטח:\n' + eodText : '');

  var resp = await claudeFetch({_apiKey:apiKey,model:'claude-sonnet-4-20250514',max_tokens:400,system:'אתה עוזר אישי של מנהל פרויקטים. כתוב בריפינג בוקר קצר וממוקד לבני פרסקי לבוקר מחר. כלול: מה הושלם, מה דחוף, מה לעשות ראשון. קצר וברור.',messages:[{role:'user',content:context}]},null);
  var data = await resp.json();
  var briefing = data.content&&data.content[0]?data.content[0].text:'';
  window._fjGeneratedBriefing = briefing;
  var prev = document.getElementById('fj-briefing-preview');
  if (prev) prev.innerHTML = briefing.replace(/</g,'&lt;').replace(/\n/g,'<br>');
  showToast('✅ בריפינג מוכן','success');
}

function fjCard(title, html) {
  var div = document.createElement('div');
  div.style.cssText = 'background:#fff;border:1.5px solid #c8e6c9;border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(76,175,80,0.08);';
  div.innerHTML = '<div style="font-size:13px;font-weight:800;color:#2e7d32;margin-bottom:12px;">'+title+'</div>' + html;
  return div;
}

function fjLoadDate() { fjSetPhase(_fjPhase); }

// ── 3. WIZARD PROJECT SELECT + FIELD CARD + TASKS ────────────
// ══ PROJECT SELECT — auto-select guard ══════════════════════════════
// Trap removed — was breaking user interaction.
// UUID is restored in jwOnProjectChange after module call.
var _jwTrapInstalled = false;
function jwInstallProjectTrap() { /* no-op — trap removed */ }

function jwAllowProjectSet(sel, val) {
  sel.value = val;
}

// ══ FIELD CARD — AI BRIEFING FOR BENI ════════════════════════════════
var _jwFieldCard = null; // current generated card

async function jwGenerateFieldCard() {
  var modal = document.getElementById('jw-fieldcard-modal');
  var content = document.getElementById('fc-content');
  if (!modal || !content) return;

  // Validate project selected
  var sel = document.getElementById('projectName');
  if (!sel || !sel.value) {
    showToast('בחר פרויקט קודם','error'); return;
  }
  var projName = sel.options[sel.selectedIndex].text;
  var dateVal  = document.getElementById('reportDate') ? document.getElementById('reportDate').value : new Date().toISOString().split('T')[0];
  var weather  = document.getElementById('weather') ? document.getElementById('weather').value : '';

  // Show modal with loading state
  modal.style.display = 'flex';
  document.getElementById('fc-project-name').textContent = projName;
  document.getElementById('fc-date-weather').textContent = new Date(dateVal).toLocaleDateString('he-IL', {weekday:'long',day:'numeric',month:'long'}) + (weather ? ' · ' + weather : '');
  content.innerHTML = '<div style="text-align:center;color:#888;font-size:13px;padding:30px;"><div style="font-size:32px;margin-bottom:12px;">⏳</div>Claude מנתח את היומן ומכין כרטיס שטח...</div>';

  // Collect data from all wizard steps
  var tasks = _jwTaskRows.filter(function(t){ return t.text.trim(); });
  var taskLines = tasks.map(function(t){ return (t.priority===1?'🔴':t.priority===3?'🟢':'🟡') + ' ' + t.text; }).join('\n');

  // Also grab tasks from DB if table was used
  var dbTasks = [];
  try {
    var today = dateVal || new Date().toISOString().split('T')[0];
    // UUID guard — use global safe UUID, not sel.value which may be a Hebrew name
    var safePid = (/^[0-9a-f\-]{10,}$/i.test(sel.value)) ? sel.value : (window._jwCurrentProjectId || null);
    var {data} = safePid
      ? await sbQ('daily_tasks','task_date=eq.'+today+'&project_id=eq.'+safePid+'&order=created_at.asc&select=task_text,tag,is_done')
      : {data:[]};
    dbTasks = (data||[]).filter(function(t){ return !t.is_done; });
  } catch(e){}
  var dbTaskLines = dbTasks.map(function(t){ return '• ' + t.task_text; }).join('\n');

  // Collect contractors from table
  var contractors = [];
  document.querySelectorAll('#contractorsBody tr').forEach(function(tr){
    var cells = tr.querySelectorAll('input,select');
    if (cells[0] && cells[0].value) contractors.push(cells[0].value + (cells[1]&&cells[1].value?' ('+cells[1].value+')':'') + (cells[2]&&cells[2].value?' — '+cells[2].value+' עובדים':''));
  });

  // Collect activities
  var activities = [];
  document.querySelectorAll('#activitiesContainer input[type=text]').forEach(function(inp){ if(inp.value) activities.push(inp.value); });

  // Collect materials
  var materials = [];
  document.querySelectorAll('#materialsContainer input[type=text]').forEach(function(inp){ if(inp.value) materials.push(inp.value); });

  // Collect safety
  var safety = [];
  document.querySelectorAll('#safetyContainer input[type=text], #safetyContainer textarea').forEach(function(inp){ if(inp.value) safety.push(inp.value); });

  // Collect delays/inspections
  var delays = [];
  document.querySelectorAll('#delaysContainer input[type=text], #inspectionsContainer input[type=text]').forEach(function(inp){ if(inp.value) delays.push(inp.value); });

  // General notes
  var notes = document.getElementById('generalNotes') ? document.getElementById('generalNotes').value : '';
  var tomorrowPlan = document.getElementById('tomorrowPlan') ? document.getElementById('tomorrowPlan').value : '';

  // Build context for Claude
  var context = [
    'פרויקט: ' + projName,
    'תאריך: ' + dateVal + (weather ? ' | מזג אוויר: ' + weather : ''),
    '',
    'משימות היום (מהיומן):',
    taskLines || dbTaskLines || 'לא הוזנו משימות',
    '',
    'קבלנים באתר:',
    contractors.length ? contractors.join('\n') : 'לא צוינו',
    '',
    'פעילויות מתוכננות:',
    activities.length ? activities.join('\n') : 'לא צוינו',
    '',
    'חומרים וציוד:',
    materials.length ? materials.join('\n') : 'לא צוינו',
    '',
    'בטיחות:',
    safety.length ? safety.join('\n') : 'אין',
    '',
    'עיכובים/ביקורות:',
    delays.length ? delays.join('\n') : 'אין',
    '',
    'הערות מנהל:',
    notes || 'אין',
    '',
    'תוכנית למחר:',
    tomorrowPlan || 'לא צוין',
  ].join('\n');

  var apiKey = APP && APP.config && APP.config.anthropic_key;
  if (!apiKey) { content.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">מפתח Claude חסר ב-app_config</div>'; return; }

  try {
    var resp = await claudeFetch({
      _apiKey: apiKey,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `אתה עוזר של מנהל פרויקטים בנייה. קרא את נתוני היומן וצור כרטיס שטח קצר ועוצמתי לבני — הנדסאי שטח שעובד בתנאי שטח קשים.
הכרטיס חייב:
- להיות קצר ולעניין — מקסימום 5 שורות עיקריות
- להשתמש באמוג'י לזיהוי מהיר
- לסדר לפי עדיפות: מה לעשות ראשון, מי בא לאתר, מה חשוב לבדוק, אזהרות
- לא לכלול מידע מיותר
- שפה: עברית פשוטה, פסקאות קצרות

החזר JSON בדיוק בפורמט הזה, ללא טקסט נוסף:
{
  "headline": "משפט אחד — הכי חשוב להיום",
  "tasks": [{"emoji":"🔴","text":"...","priority":1}, ...],
  "onsite": "מי בא לאתר — שורה קצרה",
  "materials": "חומרים/ציוד חשוב — שורה קצרה או null",
  "safety_alert": "אזהרת בטיחות אם יש — שורה קצרה או null",
  "note_from_avshi": "הערה אישית מאבשי אם יש — או null",
  "whatsapp_text": "טקסט מוכן לשליחה בווצאפ — קצר, עם שורות חדשות"
}`,
      messages: [{ role: 'user', content: context }]
    }, null);

    var data = await resp.json();
    var raw = (data.content||[]).map(function(c){ return c.text||''; }).join('');
    var clean = raw.replace(/```json|```/g,'').trim();
    _jwFieldCard = JSON.parse(clean);
    _jwFieldCard._projectName = projName;
    _jwFieldCard._date = dateVal;
    _jwFieldCard._projectId = sel.value;

    // Render the field card
    jwRenderFieldCard(_jwFieldCard, content);

  } catch(e) {
    content.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">שגיאה: ' + e.message + '</div>';
    console.error('Field card error:', e);
  }
}

function jwRenderFieldCard(card, container) {
  var tasksHtml = (card.tasks||[]).map(function(t){
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:8px;">' +
      '<span style="font-size:16px;flex-shrink:0;">' + (t.emoji||'•') + '</span>' +
      '<span style="font-size:13px;color:#e2e8f0;font-weight:600;line-height:1.5;">' + t.text + '</span>' +
      '</div>';
  }).join('');

  container.innerHTML =
    // Headline
    '<div style="background:rgba(255,255,255,0.08);border-right:4px solid #43a047;border-radius:0 10px 10px 0;padding:12px 14px;direction:rtl;">' +
      '<div style="font-size:10px;color:#86efac;font-weight:700;margin-bottom:4px;letter-spacing:1px;">ההנחיה החשובה</div>' +
      '<div style="font-size:14px;font-weight:900;color:#fff;line-height:1.5;">' + (card.headline||'') + '</div>' +
    '</div>' +

    // Tasks
    (tasksHtml ? '<div>' +
      '<div style="font-size:10px;color:#86efac;font-weight:700;margin-bottom:8px;letter-spacing:1px;">משימות</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' + tasksHtml + '</div>' +
    '</div>' : '') +

    // On-site
    (card.onsite ? '<div style="background:rgba(59,130,246,0.12);border-radius:10px;padding:10px 12px;direction:rtl;">' +
      '<div style="font-size:10px;color:#93c5fd;font-weight:700;margin-bottom:4px;">👷 באתר היום</div>' +
      '<div style="font-size:13px;color:#e2e8f0;">' + card.onsite + '</div>' +
    '</div>' : '') +

    // Materials
    (card.materials ? '<div style="background:rgba(245,158,11,0.1);border-radius:10px;padding:10px 12px;direction:rtl;">' +
      '<div style="font-size:10px;color:#fde68a;font-weight:700;margin-bottom:4px;">📦 חומרים וציוד</div>' +
      '<div style="font-size:13px;color:#e2e8f0;">' + card.materials + '</div>' +
    '</div>' : '') +

    // Safety alert
    (card.safety_alert ? '<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 12px;direction:rtl;">' +
      '<div style="font-size:10px;color:#fca5a5;font-weight:700;margin-bottom:4px;">⚠️ אזהרת בטיחות</div>' +
      '<div style="font-size:13px;color:#fecaca;font-weight:700;">' + card.safety_alert + '</div>' +
    '</div>' : '') +

    // Note from Avshi
    (card.note_from_avshi ? '<div style="background:rgba(139,92,246,0.12);border-radius:10px;padding:10px 12px;direction:rtl;">' +
      '<div style="font-size:10px;color:#c4b5fd;font-weight:700;margin-bottom:4px;">📨 מאבשי</div>' +
      '<div style="font-size:13px;color:#e2e8f0;font-style:italic;">' + card.note_from_avshi + '</div>' +
    '</div>' : '');
}

function jwSendFieldCardWhatsApp() {
  if (!_jwFieldCard || !_jwFieldCard.whatsapp_text) { showToast('צור כרטיס שטח קודם','error'); return; }
  var text = encodeURIComponent(_jwFieldCard.whatsapp_text);
  // Open WhatsApp — works on mobile and desktop
  window.open('https://wa.me/?text=' + text, '_blank');
}

async function jwSaveFieldCardToDB() {
  if (!_jwFieldCard) { showToast('צור כרטיס שטח קודם','error'); return; }
  var btn = event && event.target;
  if (btn) { btn.textContent = '⏳ שומר...'; btn.disabled = true; }

  var today = _jwFieldCard._date || new Date().toISOString().split('T')[0];
  try {
    // Delete today's existing briefing for this project first (upsert logic)
    await fetch(SB_URL + '/rest/v1/daily_briefings?briefing_date=eq.' + today + '&project_id=eq.' + _jwFieldCard._projectId,
      {method:'DELETE', headers:{apikey:SB_KEY, Authorization:'Bearer '+SB_KEY}});

    var briefText = _jwFieldCard.whatsapp_text || '';
    var { error } = await sb.from('daily_briefings').insert({
      project_id: _jwFieldCard._projectId,
      briefing_date: today,
      briefing_text: briefText,
      field_card_json: JSON.stringify(_jwFieldCard),
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    if (error) throw error;
    showToast('✅ כרטיס שטח נשמר — בני יראה אותו בפוקט!', 'success');
    document.getElementById('jw-fieldcard-modal').style.display = 'none';
  } catch(e) {
    showToast('שגיאה: ' + e.message, 'error');
    if (btn) { btn.textContent = '💾 שמור לבני פוקט'; btn.disabled = false; }
  }
}
function jwOnProjectChange(sel) {
  var errEl = document.getElementById('jw-proj-err');
  var pickPrompt = document.getElementById('jw-pick-prompt');
  var pid = sel.value;

  if (!pid) {
    if (errEl) errEl.style.display = 'block';
    if (pickPrompt) pickPrompt.style.display = 'block';
    ['mb-tasks-section','mb-hero','mb-drawings-section','mb-contractors-section','jw-cta'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    return;
  }

  // Valid UUID project selected
  if (errEl) errEl.style.display = 'none';
  if (pickPrompt) pickPrompt.style.display = 'none';

  // Store UUID globally so mbInit and other modules can read it safely
  window._jwCurrentProjectId = pid;

  // Call module hook — then immediately restore correct UUID in case module changed it
  if (typeof onJournalProjectChange === 'function') onJournalProjectChange(sel);
  // Force UUID back — module may have corrupted sel.value with Hebrew name
  sel.value = pid;

  if (typeof mbInit === 'function') mbInit();

  // Show tasks section
  var ts = document.getElementById('mb-tasks-section');
  if (ts) ts.style.display = 'block';

  jwTasksShowOption('table');
  jwLoadWizardTasks(pid);
}

// Called when wizard opens — check no-projects state
function jwCheckProjects() {
  var sel = document.getElementById('projectName');
  var warn = document.getElementById('jw-no-projects-warn');
  var pickPrompt = document.getElementById('jw-pick-prompt');
  if (!sel) return;
  var projects = window.allProjects || [];

  if (projects.length === 0) {
    if (warn) warn.style.display = 'block';
    if (pickPrompt) pickPrompt.style.display = 'none';
    sel.disabled = true;
  } else {
    if (warn) warn.style.display = 'none';
    sel.disabled = false;
    // Populate select if empty
    if (sel.options.length <= 1) {
      projects.forEach(function(p) {
        var o = document.createElement('option');
        o.value = p.id; o.textContent = p.project_name;
        sel.appendChild(o);
      });
    }
    // Force blank — never auto-select
    sel.value = '';
    if (pickPrompt) pickPrompt.style.display = 'block';
  }
}

// ══ WIZARD TASKS EDITOR ═══════════════════════════════════════════════
var _jwTaskRows = [];   // {id, text, priority, done}
var _jwOcrTasks = [];

function jwTasksShowOption(opt) {
  var tableBtn = document.getElementById('jw-opt-table-btn');
  var ocrBtn   = document.getElementById('jw-opt-ocr-btn');
  var tableDiv = document.getElementById('jw-tasks-table-section');
  var ocrDiv   = document.getElementById('jw-tasks-ocr-section');
  if (opt === 'table') {
    tableDiv.style.display = 'block'; ocrDiv.style.display = 'none';
    tableBtn.style.background = '#2e7d32'; tableBtn.style.color = '#fff'; tableBtn.style.border = '2px solid #2e7d32';
    ocrBtn.style.background = 'transparent'; ocrBtn.style.color = '#2e7d32'; ocrBtn.style.border = '2px solid #a5d6a7';
    if (_jwTaskRows.length === 0) jwAddTaskRow();
  } else {
    tableDiv.style.display = 'none'; ocrDiv.style.display = 'block';
    ocrBtn.style.background = '#2e7d32'; ocrBtn.style.color = '#fff'; ocrBtn.style.border = '2px solid #2e7d32';
    tableBtn.style.background = 'transparent'; tableBtn.style.color = '#2e7d32'; tableBtn.style.border = '2px solid #a5d6a7';
  }
}

function jwAddTaskRow(text, priority, done) {
  text = text || ''; priority = priority || 2; done = done || false;
  var id = 'jtr-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
  _jwTaskRows.push({id: id, text: text, priority: priority, done: done});
  var container = document.getElementById('jw-tasks-rows');
  if (!container) return;
  var row = document.createElement('div');
  row.id = 'row-' + id;
  row.style.cssText = 'display:grid;grid-template-columns:24px 1fr 90px 28px;gap:8px;align-items:center;background:#fff;border:1.5px solid #c8e6c9;border-radius:9px;padding:8px 10px;';

  // Checkbox
  var chk = document.createElement('div');
  chk.style.cssText = 'width:20px;height:20px;border-radius:6px;border:2px solid ' + (done ? '#43a047' : '#a5d6a7') + ';background:' + (done ? '#43a047' : 'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;flex-shrink:0;';
  if (done) chk.textContent = '✓';
  chk.onclick = function() {
    var t = _jwTaskRows.find(function(r){ return r.id === id; });
    if (!t) return;
    t.done = !t.done;
    chk.style.background = t.done ? '#43a047' : 'transparent';
    chk.style.borderColor = t.done ? '#43a047' : '#a5d6a7';
    chk.textContent = t.done ? '✓' : '';
    row.style.opacity = t.done ? '0.6' : '1';
  };

  // Text input
  var inp = document.createElement('input');
  inp.type = 'text'; inp.placeholder = 'תיאור המשימה...'; inp.value = text;
  inp.style.cssText = 'border:none;outline:none;font-family:Heebo,sans-serif;font-size:13px;color:#1b5e20;background:transparent;direction:rtl;width:100%;';
  inp.oninput = function() {
    var t = _jwTaskRows.find(function(r){ return r.id === id; });
    if (t) t.text = inp.value;
  };

  // Priority select
  var pri = document.createElement('select');
  pri.style.cssText = 'border:1px solid #c8e6c9;border-radius:6px;font-family:Heebo,sans-serif;font-size:11px;background:#f1f8e9;color:#2e7d32;padding:4px;';
  var priorities = [{v:1,l:'🔴 דחוף'},{v:2,l:'🟡 רגיל'},{v:3,l:'🟢 נמוך'}];
  priorities.forEach(function(p) {
    var o = document.createElement('option'); o.value = p.v; o.textContent = p.l;
    if (p.v === priority) o.selected = true;
    pri.appendChild(o);
  });
  pri.onchange = function() {
    var t = _jwTaskRows.find(function(r){ return r.id === id; });
    if (t) t.priority = parseInt(pri.value);
  };

  // Delete button
  var del = document.createElement('button');
  del.textContent = '✕'; del.type = 'button';
  del.style.cssText = 'background:none;border:none;color:#ef9a9a;font-size:14px;cursor:pointer;font-family:Heebo,sans-serif;';
  del.onclick = function() {
    _jwTaskRows = _jwTaskRows.filter(function(r){ return r.id !== id; });
    row.remove();
  };

  row.appendChild(chk); row.appendChild(inp); row.appendChild(pri); row.appendChild(del);
  container.appendChild(row);
  inp.focus();
}

async function jwSaveWizardTasks() {
  var sel = document.getElementById('projectName');
  var pid = sel ? sel.value : null;
  var today = new Date().toISOString().split('T')[0];
  var tasks = _jwTaskRows.filter(function(t){ return t.text.trim(); });
  if (!tasks.length) return;
  var tagMap = {1:'urgent', 2:'other', 3:'other'};
  for (var t of tasks) {
    await sb.from('daily_tasks').insert({
      project_id: pid || null,
      task_date: today,
      task_text: t.text.trim(),
      tag: tagMap[t.priority] || 'other',
      is_done: t.done,
      created_at: new Date().toISOString()
    });
  }
  showToast('✅ ' + tasks.length + ' משימות נשמרו!', 'success');
  jwLoadWizardTasks(pid);
}

async function jwLoadWizardTasks(pid) {
  // UUID guard — never send Hebrew name as project_id to Supabase
  if (pid && !/^[0-9a-f\-]{10,}$/i.test(pid)) {
    console.warn('[jwLoadWizardTasks] blocked non-UUID pid:', pid);
    pid = window._jwCurrentProjectId || null;
  }
  var today = new Date().toISOString().split('T')[0];
  var qs = 'task_date=eq.' + today + '&order=created_at.asc&select=id,task_text,tag,is_done,created_at';
  if (pid) qs += '&project_id=eq.' + pid;
  var { data: tasks } = await sbQ('daily_tasks', qs);
  tasks = tasks || [];
  var listEl = document.getElementById('mb-tasks-list');
  var cntEl  = document.getElementById('mb-tasks-count');
  if (!listEl) return;
  var done = tasks.filter(function(t){ return t.is_done; }).length;
  if (cntEl) cntEl.textContent = done + '/' + tasks.length + ' הושלמו';
  listEl.innerHTML = '';
  tasks.forEach(function(t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff;border:1.5px solid #c8e6c9;border-radius:8px;margin-bottom:6px;direction:rtl;' + (t.is_done ? 'opacity:0.6;' : '');
    var chk = document.createElement('div');
    chk.style.cssText = 'width:20px;height:20px;border-radius:6px;border:2px solid ' + (t.is_done?'#43a047':'#a5d6a7') + ';background:' + (t.is_done?'#43a047':'transparent') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0;';
    if (t.is_done) chk.textContent = '✓';
    chk.onclick = (function(id, isDone){ return function(){
      fetch(SB_URL+'/rest/v1/daily_tasks?id=eq.'+id,{method:'PATCH',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({is_done:!isDone,done_at:!isDone?new Date().toISOString():null})}).then(function(){ jwLoadWizardTasks(pid); });
    }; })(t.id, t.is_done);
    var txt = document.createElement('div');
    txt.style.cssText = 'flex:1;font-size:12px;color:#1b5e20;font-weight:600;' + (t.is_done ? 'text-decoration:line-through;color:#888;' : '');
    txt.textContent = t.task_text;
    var tagLabel = {urgent:'🔴 דחוף', schedule:'📅 לוח זמנים', site:'🏗️ שטח', safety:'⚠️ בטיחות', other:'✅ רגיל'};
    var tag = document.createElement('div');
    tag.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:20px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;flex-shrink:0;';
    tag.textContent = tagLabel[t.tag] || t.tag;
    row.appendChild(chk); row.appendChild(txt); row.appendChild(tag);
    listEl.appendChild(row);
  });
}

async function jwHandleTaskOCR(input) {
  var file = input.files[0]; if (!file) return;
  var preview = document.getElementById('jw-ocr-preview');
  var resultDiv = document.getElementById('jw-ocr-result');
  if (preview) { preview.style.display='block'; preview.innerHTML='<div style="font-size:12px;color:#558b2f;padding:10px;">⏳ שולח ל-Claude לקריאה...</div>'; }
  var b64 = await new Promise(function(res){ var r=new FileReader(); r.onload=function(e){ res(e.target.result); }; r.readAsDataURL(file); });
  var b64data = b64.split(',')[1];
  var imgType = file.type || 'image/jpeg';
  var apiKey = APP && APP.config && APP.config.anthropic_key;
  if (!apiKey) { showToast('מפתח Claude חסר ב-app_config','error'); return; }
  var resp = await claudeFetch({_apiKey:apiKey, model:'claude-sonnet-4-20250514', max_tokens:800,
    system:'אתה עוזר לקריאת כתב יד בעברית. חלץ רשימת משימות מהתמונה. החזר JSON בלבד: {"tasks":[{"text":"...","priority":1}]} כאשר priority: 1=דחוף, 2=רגיל, 3=נמוך. ללא טקסט נוסף.',
    messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:imgType,data:b64data}},{type:'text',text:'חלץ את רשימת המשימות מהכתב יד'}]}]
  }, null);
  var data = await resp.json();
  var raw = (data.content||[]).map(function(c){ return c.text||''; }).join('');
  try {
    var clean = raw.replace(/```json|```/g,'').trim();
    var parsed = JSON.parse(clean);
    _jwOcrTasks = parsed.tasks || [];
    var tasksEl = document.getElementById('jw-ocr-tasks');
    if (tasksEl && resultDiv) {
      tasksEl.innerHTML = '';
      _jwOcrTasks.forEach(function(t, i) {
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:#f1f8e9;border-radius:7px;direction:rtl;';
        var priLabel = {1:'🔴',2:'🟡',3:'🟢'};
        div.innerHTML = '<span style="font-size:14px;">'+(priLabel[t.priority]||'🟡')+'</span><span style="font-size:12px;color:#1b5e20;font-weight:600;flex:1;">'+t.text+'</span>';
        tasksEl.appendChild(div);
      });
      resultDiv.style.display = 'block';
      if (preview) preview.innerHTML = '<img src="'+b64+'" style="max-width:100%;border-radius:8px;border:1px solid #c8e6c9;">';
    }
  } catch(e) { showToast('שגיאה בחילוץ משימות','error'); }
}

async function jwApproveOCRTasks() {
  var sel = document.getElementById('projectName');
  var pid = sel ? sel.value : null;
  var today = new Date().toISOString().split('T')[0];
  var tagMap = {1:'urgent', 2:'other', 3:'other'};
  for (var t of _jwOcrTasks) {
    await sb.from('daily_tasks').insert({
      project_id: pid || null, task_date: today,
      task_text: t.text, tag: tagMap[t.priority]||'other',
      is_done: false, created_at: new Date().toISOString()
    });
  }
  _jwOcrTasks = [];
  document.getElementById('jw-ocr-result').style.display = 'none';
  document.getElementById('jw-ocr-preview').style.display = 'none';
  document.getElementById('jw-task-img-input').value = '';
  showToast('✅ משימות נשמרו!', 'success');
  jwLoadWizardTasks(pid);
}