# HANDOVER — Beni Pocket + Work Journal Sync
**Date:** 06/03/2026 | **Session:** Beni-1 | **Status:** Live

---

## SYSTEMS BUILT THIS SESSION

### 1. BENI POCKET — Mobile PWA
| Item | Value |
|---|---|
| GitHub Repo | avshi2-maker/Beni-pocket-Mobile |
| Live URL | https://avshi2-maker.github.io/Beni-pocket-Mobile/ |
| Supabase | vmcipofovheztbjmhwsl (Work Journal — shared) |
| File | beni_pocket_06032026.html → index.html |

### 2. WORK JOURNAL — Beni Tasks Widget Added
| Item | Value |
|---|---|
| GitHub Repo | avshi2-maker/work-journal |
| Live URL | https://avshi2-maker.github.io/work-journal/ |
| Supabase | vmcipofovheztbjmhwsl (same) |
| File | wj_index_06032026.html → index.html |

### 3. GIVON BOQ — Price Offer Form
| Item | Value |
|---|---|
| GitHub Repo | avshi2-maker/Givon-tel-Aviv |
| Live URL | https://avshi2-maker.github.io/Givon-tel-Aviv/ |
| Supabase | whwhokbbeluibrvmvirw |
| File | givon_boq_06032026.html → index.html |

---

## SUPABASE DATABASES

### Work Journal DB — vmcipofovheztbjmhwsl
**Anon Key:**
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE2MTcsImV4cCI6MjA4NzAzNzYxN30.LPq5N2Xo8iEqjgz2UhmdzUdh5tpGT3EYzSxJcYBEJ1w

**Tables (Beni Pocket uses these):**
- `reminders` — tasks/to-dos (shared between Pocket + Work Journal widget)
- `call_log` — logged calls with WhatsApp send tracking
- `voice_memos` — hold-to-talk transcripts
- `quick_replies` — 6 pre-seeded Hebrew reply templates

### Givon BOQ DB — whwhokbbeluibrvmvirw
**Anon Key:**
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2hva2JiZWx1aWJydm12aXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjcxNjgsImV4cCI6MjA4ODMwMzE2OH0.FwvfLeHxcTayj0yc7FWTTgifKOCHLXbfmWB4J-66cDk

**Tables:**
- `boq_items` — 6 items from PDF (editable in Supabase)
- `boq_offers` — price offer headers
- `boq_offer_items` — line prices per offer

### Beni Pocket OLD DB — mspsrwruxvcnqmucvler (ABANDONED)
**Status:** No longer used. Beni Pocket was migrated to vmcipofovheztbjmhwsl for sync.

---

## BENI POCKET — FEATURES

### Tab 1 — 📞 שיחה (Call)
- Enter caller name + phone + optional note
- Tap any of 6 quick reply buttons → modal opens with personalized message
- One tap → WhatsApp fires + call logged to Supabase automatically
- Custom reply option for free-text messages
- Log call without sending (save only)

### Tab 2 — 🎙️ הקלטה (Voice)
- **HOLD TO TALK** — press and hold mic button, release to stop
- Uses fresh SpeechRecognition instance per hold (Android Chrome bug workaround)
- continuous=false, interimResults=false — no duplicate transcripts
- Hebrew (he-IL) language
- Transcript saved to voice_memos table
- One tap → save as reminder OR send via WhatsApp

### Tab 3 — ✅ משימות (Tasks)
- Add tasks manually or from voice transcript
- Filter: all / active / done
- Badge counter on tab showing open tasks
- Tap circle to mark done → syncs to Supabase
- Source badge: 🎙️ voice / 📞 call / ✍️ manual

### Tab 4 — 📋 יומן (Log)
- Full call history from Supabase
- Shows: name, phone, reply used, WA sent badge, time ago
- One-tap callback button (tel: link)
- Refresh button

### Design
- Light gold background (#fdf6e3)
- Orange accent (#f97316) — construction site aesthetic
- PWA — add to Android home screen via Chrome → ⋮ → "Add to Home Screen"
- Bold input placeholders: שם המתקשר / מספר טלפון / הערה קצרה
- Clock + date stamp in header (יום ראשון 6 מרץ)

---

## WORK JOURNAL — BENI TASKS WIDGET

**Location:** Dashboard → between stats grid and Active Projects card
**Auto-loads:** Every time dashboard renders (renderDashboard function)
**Shows:** All open reminders (is_done=false), newest first, max 25
**Each row:** Task text + time ago + source badge (🎙️/📞/✍️)
**Tap ✓:** Marks done in Supabase → fades out → reloads list
**Sync:** Real-time — same table as Beni Pocket
**Refresh button:** Manual reload

---

## GIVON BOQ — PRICE OFFER FORM

**Project:** מתחם גבעון מבנן א׳ — שיפוץ חיזיתות, החשמונאים 119-113
**Contractor:** בני פרסקי — ביצוע פרויקטים
**Items:** 6 items loaded from boq_items Supabase table (NOT hardcoded)
**Auto-calc:** Row total, sub-chapter totals, VAT 18%, grand total
**Save:** Generates offer number GV-2026-0001, saves to boq_offers + boq_offer_items
**Send:** WhatsApp pre-filled message + Email mailto
**Offer numbers:** GV-YYYY-NNNN format

---

## PENDING FROM BENI TESTING

- [ ] Beni to test hold-to-talk voice on Android
- [ ] Beni to test quick reply WhatsApp flow
- [ ] Beni to test task sync to Work Journal widget
- [ ] Givon BOQ — GitHub Pages deployment was queued (may need force redeploy)

---

## NEXT SESSION

### Confirmed Next Job:
**Contractor Daily Site Report** — mobile form contractors fill on site,
WhatsApp back to Beni, syncs to contractor record in CRM.
See creative brief below.

### Also Pending:
- GitHub API integration — push files directly from Claude without manual upload
- Mobile sidebar bug in Work Journal CRM (from earlier session S5)

---

## CREATIVE BRIEF — CONTRACTOR DAILY REPORT (NEXT SESSION)

**Concept: "Site Pulse"**

A dead-simple mobile form contractors open on site.
No login. No app. Just a link (or QR code) Beni sends them.

**The flow:**
1. Beni sends contractor a WhatsApp link: `site-pulse.github.io/?c=CONTRACT_ID`
2. Contractor opens on phone — sees THEIR name + TODAY's date pre-filled
3. Fills 4 things only (big thumb-friendly):
   - ✅ Tasks completed today (checkboxes from project task list)
   - 🔴 Issues / problems (free text, photo optional)
   - 👷 Workers present (number + names)
   - ⭐ Day rating (1-5 stars)
4. Taps SEND → saves to Supabase → fires WhatsApp summary to Beni automatically
5. Beni sees a widget in Work Journal: new report badge → tap to review →
   two buttons: **✅ Plug into CRM** or **🗑️ Delete**
6. If plugged in → attaches to contractor record + project log

**Key design rules:**
- Zero friction — contractor fills in under 60 seconds
- No login required — contractor ID in URL
- Works 100% offline-first, syncs when signal returns
- Hebrew UI, large buttons, construction site readable in sunlight
- Beni's review widget lives in Work Journal dashboard (same pattern as Tasks widget)

*Ready to build next session after Beni's feedback.*

---

*Handover: 06/03/2026 | Claude (Anthropic) for Avshi Sapir*
