# Project-wide English Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate all user interface strings, code comments, error messages, and documentation from Turkish to English.

**Architecture:** Systematic file-by-file manual translation to ensure accuracy and maintain functionality.

**Tech Stack:** React, Node.js, Express, Markdown.

---

### Task 1: Translate SmartQuery.jsx

**Files:**
- Modify: `client/src/components/SmartQuery.jsx`

- [ ] **Step 1: Translate SQL Templates and UI labels**
Replace Turkish strings in `SQL_TEMPLATES`, `getSchemaContext`, `fetchTables` error messages, and the main `render` block.

- [ ] **Step 2: Commit**
```bash
git add client/src/components/SmartQuery.jsx
git commit -m "feat(ui): translate SmartQuery component to English"
```

### Task 2: Translate QueryPlayground.jsx

**Files:**
- Modify: `client/src/components/QueryPlayground.jsx`

- [ ] **Step 1: Translate TIPS, KEYBOARD_HINTS, and UI labels**
Replace Turkish strings in the `TIPS` array, `KEYBOARD_HINTS`, and all labels/placeholders in the `return` block.

- [ ] **Step 2: Commit**
```bash
git add client/src/components/QueryPlayground.jsx
git commit -m "feat(ui): translate QueryPlayground component to English"
```

### Task 3: Translate HealthMonitor.jsx

**Files:**
- Modify: `client/src/components/HealthMonitor.jsx`

- [ ] **Step 1: Translate Status labels and Table headers**
Replace Turkish strings in `getStatus`, `fetchHealth` error handling, and all table headers/messages in the UI.

- [ ] **Step 2: Commit**
```bash
git add client/src/components/HealthMonitor.jsx
git commit -m "feat(ui): translate HealthMonitor component to English"
```

### Task 4: Translate Server-side Services and Routes

**Files:**
- Modify: `server/services/aiService.js`
- Modify: `server/routes/ai.js`
- Modify: `server/index.js`

- [ ] **Step 1: Translate AI prompt logic and error messages**
In `aiService.js`, translate the keyword mapping and system prompt instructions. In `routes/ai.js`, update error checking logic that looks for Turkish strings.

- [ ] **Step 2: Commit**
```bash
git add server/services/aiService.js server/routes/ai.js server/index.js
git commit -m "feat(server): translate AI prompts and error messages to English"
```

### Task 5: Translate Documentation (Specs & Plans)

**Files:**
- Modify: `docs/superpowers/specs/2026-04-13-voice-to-sql-design.md`
- Modify: `docs/superpowers/specs/2026-04-13-smart-table-validation-design.md`
- Modify: `docs/superpowers/plans/2026-04-13-voice-to-sql.md`
- Modify: `docs/superpowers/plans/2026-04-13-smart-table-validation.md`
- Modify: `README.md`

- [ ] **Step 1: Translate all documentation files**
Rewrite the content of these files in English.

- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/ README.md
git commit -m "docs: translate all specs, plans, and README to English"
```

### Task 6: Final Cleanup and Verification

- [ ] **Step 1: Search for remaining Turkish characters**
Run: `grep -r "[çğışöüÇĞİŞÖÜ]" . --exclude-dir=node_modules --exclude-dir=.git`
Expected: No matches (except potentially in specific excluded files if any).

- [ ] **Step 2: Commit any fixes**
```bash
git commit -am "chore: final english translation cleanup"
```
