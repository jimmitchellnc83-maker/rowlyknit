# Rowly Knitting App - Comprehensive Audit Findings
**Date:** 2025-11-20
**Status:** In Progress

## Executive Summary
This document outlines all bugs, UX issues, and functional problems discovered during a comprehensive audit of the Rowly knitting application from a knitter's perspective.

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. Pattern Builder Not Persisting to Database
**File:** `frontend/src/pages/PatternBuilder.tsx` (Lines 115-126)
**Issue:** Pattern builder saves charts to localStorage instead of the database API
**Impact:**
- Patterns are lost when browser cache is cleared
- No cross-device synchronization
- Cannot be shared or linked to projects properly
- Defeats the purpose of having a database-backed pattern system

**Current Code:**
```typescript
const savePattern = () => {
  const pattern = {
    name: patternName,
    rows,
    columns: cols,
    data: gridData
  };
  const patterns = JSON.parse(localStorage.getItem('rowly-patterns') || '[]');
  patterns.push(pattern);
  localStorage.setItem('rowly-patterns', JSON.stringify(patterns));
  alert('Pattern saved successfully!');
};
```

**Expected Behavior:** Should POST to `/api/patterns/:patternId/charts` API endpoint

---

### 2. Counter Type Mismatch (Database vs Controller)
**Files:**
- `backend/migrations/20240101000004_create_counters_table.ts` (Line 8)
- `backend/src/controllers/countersController.ts` (Line 115)

**Issue:** Database schema defaults counter type to `'row'` (singular), but controller defaults to `'rows'` (plural)

**Database Schema:**
```typescript
table.string('type', 50).defaultTo('row'); // row, stitch, repeat, custom
```

**Controller Code:**
```typescript
type: type || 'rows',  // ❌ Should be 'row'
```

**Impact:** New counters created without specifying type will have inconsistent type value, potentially breaking filtering/display logic

---

### 3. Status Mismatch in Projects
**File:** `frontend/src/pages/Projects.tsx` (Line 91)
**Issue:** Frontend has 'planned' status that doesn't exist in database schema

**Database Schema:** Only supports: `active`, `paused`, `completed`, `archived`
**Frontend Code:** Also handles `planned` status (line 91-92)

**Impact:** If a user somehow sets status to 'planned', it won't be stored correctly or could cause validation errors

---

## ⚠️ HIGH PRIORITY ISSUES

### 4. Inconsistent UI Feedback (alert() vs toast())
**File:** `frontend/src/pages/PatternBuilder.tsx` (Lines 112, 125)
**Issue:** Pattern Builder uses `alert()` for notifications instead of toast

**Current:**
```typescript
alert(instructions);  // Line 112
alert('Pattern saved successfully!'); // Line 125
```

**Expected:** Should use `toast.success()` and `toast.info()` for consistency with rest of app

**Impact:** Inconsistent user experience, blocks UI with modal alerts

---

### 5. Frontend/Backend Field Name Inconsistency
**Files:** Throughout frontend and backend
**Issue:** Frontend uses camelCase, backend uses snake_case

**Examples:**
- Frontend: `projectType` → Backend: `project_type`
- Frontend: `lowStockAlert` → Backend: `low_stock_alert`
- Frontend: `fiberContent` → Backend: `fiber_content`

**Current Handling:** Axios/API layer must transform all field names

**Impact:**
- Potential for missed transformations causing null values
- Harder to maintain
- Increased chance of bugs when adding new fields

---

### 6. Yarn Stash: yardsRemaining Can Go Negative
**File:** `backend/src/controllers/projectsController.ts` (Lines 334-340)
**Issue:** When adding yarn to project, the deduction uses raw SQL that can result in negative values

**Current Code:**
```typescript
await trx('yarn')
  .where({ id: yarnId })
  .update({
    yards_remaining: trx.raw('yards_remaining - ?', [yardsUsed]),
    skeins_remaining: trx.raw('skeins_remaining - ?', [skeinsUsed]),
    updated_at: new Date(),
  });
```

**Problem:** If a knitter adjusts the yarn usage multiple times or makes an error, the remaining yarn could theoretically go negative (though there's a check before, race conditions could occur)

**Expected:** Add database constraint: `CHECK (yards_remaining >= 0)`

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. Counter History Missing user_note Field in Creation
**File:** `backend/src/controllers/countersController.ts` (Line 137)
**Issue:** When creating initial history entry, user_note is null but the field exists in history table

**Current:**
```typescript
await db('counter_history').insert({
  counter_id: counter.id,
  old_value: 0,
  new_value: currentValue,
  action: 'created',
  user_note: null,  // Always null
  created_at: new Date(),
});
```

**Impact:** Minor - users can't add a note when creating a counter, only when updating

---

### 8. Pattern Builder: No Save Confirmation or Error Handling
**File:** `frontend/src/pages/PatternBuilder.tsx`
**Issue:** Export and save functions have no error handling

**Impact:** If save fails, user gets no feedback and may lose work

---

### 9. Missing Loading States in Multiple Modals
**Files:** `frontend/src/pages/ProjectDetail.tsx`, `frontend/src/pages/YarnStash.tsx`
**Issue:** When uploading files or adding items, loading states aren't always shown

**Impact:** User doesn't know if action is processing, may click multiple times

---

### 10. No Validation on Grid Size in Pattern Builder
**File:** `frontend/src/pages/PatternBuilder.tsx` (Lines 206-221)
**Issue:** Rows and cols can be set to 0 or negative numbers

**Current:**
```typescript
onChange={(e) => setRows(parseInt(e.target.value) || 1)}
```

**Problem:** `parseInt('0')` returns 0, not 1, so the `|| 1` fallback doesn't work

**Expected:** Should use `Math.max(1, parseInt(e.target.value) || 1)`

---

## 🔵 LOW PRIORITY / UX IMPROVEMENTS

### 11. Counter Value Bounds Not Enforced in UI
**Issue:** Counter min_value and max_value are stored but not enforced when incrementing/decrementing in CounterCard

**Impact:** User can go beyond defined bounds, defeating the purpose of setting them

---

### 12. No "Are You Sure?" for Destructive Actions
**Files:** Multiple pages
**Issue:** Some delete actions use `confirm()` (good) but pattern builder's clearGrid() should also confirm

**Impact:** Accidental data loss

---

### 13. Photo Upload: No File Type Validation
**Files:** `frontend/src/pages/YarnStash.tsx`, `frontend/src/pages/ProjectDetail.tsx`
**Issue:** No client-side validation that uploaded files are images

**Impact:** User could upload non-image files, causing errors or broken UI

---

### 14. No Offline Indicator in Pattern Builder
**Issue:** Pattern Builder doesn't show offline status, but tries to save to localStorage

**Impact:** User doesn't know if work will sync later

---

### 15. Magic Markers: No Visual Indication of Active vs Inactive
**Issue:** Magic markers can be toggled active/inactive but UI might not clearly show this

**Impact:** User may think markers are active when they're not

---

### 16. Session Timer: No Warning Before Auto-Save
**Issue:** Session data is saved when ending session, but no confirmation if user accidentally clicks "End Session"

**Impact:** Could lose session notes or modifications

---

### 17. Duplicate Pattern/Yarn Detection UI
**Issue:** Backend prevents duplicates (good), but UI doesn't indicate if item already exists before user clicks "Add"

**Impact:** User must try to add, then see error, which is frustrating

---

### 18. Counter Linking: No Visual Feedback When Link Triggers
**Issue:** When one counter triggers another via counter links, there's no visual indication

**Impact:** User might not understand why counter value changed

---

### 19. Yarn Stash: No Bulk Operations
**Issue:** Cannot select multiple yarn entries for bulk operations (delete, update, etc.)

**Impact:** Tedious to manage large stash

---

### 20. Pattern PDF Viewer: No Page Number Display
**Issue:** When viewing patterns, current page number not shown

**Impact:** Hard to reference specific pages or remember location

---

## 🟢 NICE TO HAVE / FUTURE ENHANCEMENTS

### 21. No Dark Mode in Pattern Builder
**Issue:** Pattern Builder doesn't respect theme setting

**Impact:** Inconsistent with rest of app, harder to use in low light

---

### 22. Counter: No Quick Increment Presets
**Issue:** Counters can only increment by fixed amount, no quick buttons for common actions (e.g., "+10 rows")

**Impact:** Tedious for large projects

---

### 23. No Export/Import for Backup
**Issue:** No way to export all data for backup purposes

**Impact:** Data loss if server fails

---

### 24. No Keyboard Shortcuts
**Issue:** No keyboard shortcuts for common actions (increment counter, save, etc.)

**Impact:** Less efficient for power users

---

### 25. No Pattern Search/Filter
**Issue:** Pattern library page has no search or filter functionality

**Impact:** Hard to find patterns in large library

---

## 📊 TESTING GAPS

### Areas Needing Testing
1. Counter linking edge cases (circular links, multiple triggers)
2. Yarn stash race conditions (multiple projects using same yarn)
3. Session timer accuracy over long periods
4. File upload size limits and error handling
5. Database migrations on production data
6. Offline sync conflict resolution
7. Magic marker trigger conditions
8. PDF annotation save/load cycle
9. Pattern collation with many PDFs
10. Recipient data privacy/GDPR compliance

---

## 🎯 RECOMMENDED FIX PRIORITY

### Phase 1 (Critical - Fix Now)
1. Pattern Builder database persistence
2. Counter type mismatch
3. Project status mismatch
4. Yarn remaining negative value constraint

### Phase 2 (High - Fix This Week)
5. UI feedback consistency (toast vs alert)
6. Field name consistency (camelCase vs snake_case)
7. Grid size validation
8. Error handling in file uploads

### Phase 3 (Medium - Fix This Sprint)
9-18. All medium priority issues

### Phase 4 (Low - Backlog)
19-25. UX improvements and nice-to-haves

---

## 🔧 NEXT STEPS
1. Review and prioritize fixes with team
2. Create tickets for each issue
3. Begin implementing Phase 1 fixes
4. Test each fix in development
5. Deploy to production
6. Monitor for new issues

---

**Audit Completed By:** Claude (AI Assistant)
**Next Review:** After Phase 1 fixes are deployed
