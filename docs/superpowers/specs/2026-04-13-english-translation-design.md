# Design: Project-wide English Translation

**Date:** 2026-04-13
**Author:** Gemini CLI
**Status:** Approved

## Overview
This document outlines the strategy for migrating the entire DataSphereExplorer project from Turkish to English. This includes user interface strings, code comments, error messages, AI prompt templates, and documentation.

## Goals
- Provide a consistent English user experience.
- Ensure all technical documentation (specs, plans, README) is in English.
- Maintain code functionality while translating human-readable strings.
- Remove all Turkish characters (ç, ğ, ı, ş, ö, ü) from the codebase except where necessary for logic (though none identified so far).

## Scope

### 1. Frontend (Client)
- **Components:** `SmartQuery.jsx`, `QueryPlayground.jsx`, `HealthMonitor.jsx`, `Dashboard.jsx`, `CsvImport.jsx`, `ConnectionForm.jsx`, `AiQueryBuilder.jsx`, `TableList.jsx`, `VoiceQueryModal.jsx`.
- **Items to Translate:**
  - Labels and Titles
  - Tooltips and Placeholder text
  - Success/Error/Status messages shown to users
  - Quick-start SQL templates in `SmartQuery.jsx` and `QueryPlayground.jsx`.

### 2. Backend (Server)
- **Services:** `aiService.js`, `hanaService.js`, `tableValidationService.js`, `validationService.js`.
- **Routes:** `ai.js`, `query.js`, `stats.js`, `tables.js`.
- **Items to Translate:**
  - AI System Prompts and Instruction templates in `aiService.js`.
  - Logic comments explaining complex operations.
  - Error messages returned to the frontend.
  - Mapping objects (e.g., date keywords like 'bugün' to 'today').

### 3. Documentation
- **Specs:** All files in `docs/superpowers/specs/`.
- **Plans:** All files in `docs/superpowers/plans/`.
- **Project Root:** `README.md`, `LICENSE`.

## Implementation Strategy

### Manual Translation
I will perform a file-by-file update to ensure contextually accurate translations.
- **UI:** Standard English terminology (e.g., "Sorgu" -> "Query", "Çalıştır" -> "Run", "Hata" -> "Error").
- **AI Prompts:** Ensure the AI instructions are clear and professional in English.
- **Comments:** Maintain the same level of technical detail in the English versions.

### Non-Goals
- Changing database schema or table names (e.g., `TASK_LOGS` is already in English).
- Translating variable names unless they are exclusively in Turkish and hinder readability (most are already English).

## Verification Plan
1. **Automated Search:** Run `grep` for Turkish characters `[çğışöüÇĞİŞÖÜ]` across the workspace.
2. **Visual Check:** Briefly review main UI screens to ensure no Turkish text was missed in hard-coded areas.
3. **AI Test:** Verify `SmartQuery` and `VoiceQuery` still work correctly with English prompts.
