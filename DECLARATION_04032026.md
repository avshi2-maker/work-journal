# 📋 STONHARD SYSTEM — ARCHITECTURE DECLARATION
## Avshi Sapir + Beni Perski | 04/03/2026

---

## ✅ AUDIT RESULT — index_04032026.html

| Check | Result |
|-------|--------|
| Duplicate JS functions | 0 — CLEAN |
| Supabase createClient calls | 1 — SINGLE INSTANCE |
| Local .html file references | 0 — NONE |
| Local .js / .css file references | 0 — NONE |
| CRM panel present | ✅ |
| Journal panel present | ✅ |
| All CRM functions | ✅ |
| All Journal functions | ✅ |
| File size | 168KB — OK |

**VERDICT: 18/18 checks passed. Code is clean.**

---

## 🏗️ ARCHITECTURE DECLARATION

### The Golden Rule — effective immediately:

> **ALL development lives in ONE file: `index.html` on GitHub Pages.**
> **ALL data lives in ONE place: Supabase (`vmcipofovheztbjmhwsl`).**
> **NO separate HTML files. NO separate JS files. NO separate CSS files.**

---

### Structure

```
GitHub Pages
  └── index.html  ← THE ONLY FILE (168KB, self-contained)
        ├── 📊 Tab 1: CRM (לוח בקרה)
        │     ├── Contractors (ספר קבלנים)
        │     ├── Projects (פרויקטים)
        │     ├── Finance (כספים)
        │     └── Reports (דוחות)
        └── 📝 Tab 2: Journal (יומן עבודה)
              ├── Daily report form
              ├── Voice recognition
              ├── Signature pad
              └── WhatsApp sharing

Supabase: vmcipofovheztbjmhwsl.supabase.co
  ├── contractors_master
  ├── projects
  ├── contractor_transactions
  ├── project_contractors_master
  ├── reports
  ├── workers / activities / materials
  ├── equipment / safety / inspections
  ├── delays / project_contractors
  ├── VIEW: contractor_balances
  └── VIEW: project_summary
```

---

### Rules for all future development

1. **New feature?** → Add it inside `index.html`. Never create a new HTML file.
2. **New data?** → Add a table in Supabase. Never use localStorage for real data.
3. **New module?** → Add a new tab or section inside the existing shell.
4. **External libraries?** → CDN links in `<head>` only. No downloaded files.
5. **Images/PDFs/audio?** → Upload to Supabase Storage. Link via URL.
6. **One upload to GitHub** → One URL forever: `avshi2-maker.github.io/work-journal/`

---

### Next development phases (all inside index.html)

| Phase | Feature | Where |
|-------|---------|-------|
| S4 | Mobile Field Wizard | New tab inside index.html |
| S5 | PDF auto-generation | JS function inside index.html |
| S6 | Contractor sign portal | New tab or modal inside index.html |
| S7 | Full integration | All tabs connected via Supabase |

---

*DECLARATION_04032026.md | Stonhard System | Avshi Sapir*
