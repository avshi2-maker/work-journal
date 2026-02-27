# WORK-JOURNAL HANDOVER — 27/02/2026
## Project: יומן עבודה יומי — Stonhard / אבשי ספיר

---

## INFRASTRUCTURE

| Item | Value |
|------|-------|
| GitHub repo | avshi2-maker/work-journal |
| Live URL | https://avshi2-maker.github.io/work-journal/ |
| Supabase project | "Roni sapir-Clinic" (rename → Settings → General) |
| Supabase URL | https://vmcipofovheztbjmhwsl.supabase.co |
| Supabase anon key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY2lwb2ZvdmhlenRiam1od3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE2MTcsImV4cCI6MjA4NzAzNzYxN30.LPq5N2Xo8iEqjgz2UhmdzUdh5tpGT3EYzSxJcYBEJ1w |

---

## FILES IN REPO

| File | Purpose | Status |
|------|---------|--------|
| `index.html` | Main page — all 8 fixes applied | ✅ Upload today |
| `app.js` | Original app logic (reports, workers, save/send) | ✅ Existing |
| `style.css` | Original styles | ✅ Existing |
| `equipment_module_27022026.js` | Equipment + subcontractor module | ✅ Upload today |
| `equipment_module_27022026.css` | Equipment CSS | ✅ Upload today |

---

## SUPABASE TABLES

### Existing (unchanged)
- `reports` — one row per daily report
- `workers` — workers per report
- `activities` — activities per report
- `materials` — materials delivered
- `equipment` — equipment used ← **3 new columns added today**
- `safety_incidents` — safety events
- `inspections` — regulatory inspections
- `delays` — delays and stoppages
- `photos` — photo storage paths
- `approvals` — owner approvals

### New tables added today
| Table | Purpose |
|-------|---------|
| `equipment_usage` | One row per subcontractor per equipment item — hours + cost |
| `site_subcontractors` | Master list of subs per project name |
| `site_equipment_types` | Master list of equipment presets per project name |

### New columns on `equipment` table
- `owner_name` — who brings/owns the equipment
- `rate_type` — 'hourly' / 'daily' / 'none'
- `rate_value` — ₪ amount

---

## WHAT WAS BUILT TODAY

### Equipment Module (the big feature)
Each piece of equipment can be assigned to multiple subcontractors with hours per sub.
Cost splits automatically by proportion of hours.
Summary table at bottom shows total owed per contractor.

**How site lists work:**
1. Therapist types project name in פרטי פרויקט
2. Module reads `site_subcontractors` and `site_equipment_types` from Supabase for that project
3. Dropdowns auto-populate with site-specific contractors and equipment
4. Each site has its own list — different sites, different contractors

**To add contractors/equipment for a new site:**
Go to Supabase Table Editor → `site_subcontractors` → Add rows with your project_name
Same for `site_equipment_types`

### 8 Fixes Applied to index.html
1. % calculation grid bug fixed (sub-name-wrapper)
2. Added תפקיד field next to project manager name
3. Israeli ID validation (Luhn algorithm) — turns green when valid
4. שלח לאישור now opens WhatsApp with report summary in Hebrew
5. Customer section added — שם לקוח + נייד — WhatsApp sends to this number
6. Report number confirmed unique in header
7. Send confirmation banner — "נשלח ל: XYZ 🕐 14:32 📅 27/02/2026"
8. Logbook footer — scrollable list of all reports from Supabase with search + open

---

## PENDING — NEXT SESSION

### HIGH PRIORITY
**1. Wire saveEquipmentToSupabase() into app.js**
Find where app.js saves the report and adds the report_id.
Add one line after the report insert:
```javascript
await saveEquipmentToSupabase(reportId);
```
Without this, equipment data saves to UI only — not to Supabase.

**2. Seed real subcontractors and equipment**
In Supabase Table Editor → `site_subcontractors`:
- Replace `פרויקט בדיקה` with real project names
- Add all subcontractors for each site

In `site_equipment_types`:
- Add real equipment with real daily/hourly rates

**3. Test full flow**
- Open site → type real project name → verify dropdowns populate
- Add equipment → assign subs → click Save Draft
- Check Supabase → confirm equipment + equipment_usage rows created

### MEDIUM PRIORITY
**4. WhatsApp also sends report link**
Currently sends text summary only.
Next step: send the share_token URL so customer can view the full digital report.
```
https://avshi2-maker.github.io/work-journal/?token=SHARE_TOKEN
```

**5. Logbook — load on scroll**
Currently loads last 100 reports.
Add pagination or infinite scroll for large archives.

**6. Rename Supabase project**
Supabase Dashboard → work-journal project → Settings → General → Project Name
Change from "Roni sapir-Clinic" to "Work Journal" or "יומן עבודה"

**7. Mobile test**
The equipment grid (5 columns) may need adjustment on very small phones.
Test on iPhone Safari and Android Chrome.

### LOWER PRIORITY
**8. PDF export of equipment charge summary**
One-tap PDF showing all contractor charges for the day.
Useful for billing disputes and legal documentation.

**9. Customer approval flow**
Customer receives WhatsApp link → opens report → can sign digitally on their phone.
Currently owner signature exists in ownerView — needs to be reachable via share_token URL.

**10. Recurring equipment**
Equipment that appears every day (e.g. site crane) should auto-populate from previous report.
"Load yesterday's equipment" button.

---

## QUICK REFERENCE — KEY FUNCTIONS

| Function | File | Does |
|----------|------|------|
| `addEquipmentRow()` | equipment_module_27022026.js | Adds equipment card with sub rows |
| `addSubRow(equipId)` | equipment_module_27022026.js | Adds contractor usage row |
| `recalcEquipment(equipId)` | equipment_module_27022026.js | Recalculates % and cost per sub |
| `updateEquipmentSummary()` | equipment_module_27022026.js | Rebuilds daily billing table |
| `saveEquipmentToSupabase(reportId)` | equipment_module_27022026.js | Saves all equipment to DB |
| `loadEquipmentFromSupabase(reportId)` | equipment_module_27022026.js | Loads equipment when viewing report |
| `sendViaWhatsApp()` | index.html inline | Builds message + opens wa.me link |
| `loadLogbook()` | index.html inline | Fetches all reports from Supabase |
| `validateIsraeliID(input)` | index.html inline | Luhn check + green/red border |

---

## IMPORTANT NOTES

**Equipment % calculation logic:**
- Hourly rate: each sub pays hours × rate
- Daily rate: total daily cost split proportionally by hours (e.g. 4h of 8h total = 50% of daily rate)
- "ללא חיוב": equipment tracked but no cost charged

**ID validation:**
Uses Israeli Luhn algorithm (same used by Misrad Hapnim).
9-digit number padded with leading zeros.
Alternating digits ×1 and ×2, sum must be divisible by 10.

**WhatsApp format:**
Phone 050-123-4567 → sent as 972501234567 (international format, no +)

---

*Work-journal handover | 27/02/2026 | Built pro-bono for Stonhard installation team*
