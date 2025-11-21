# Frontend Codebase Issues - Comprehensive Audit Report

## Overview
This report details all identified issues in the Rowlyknit frontend codebase including incomplete features, broken functionality, missing implementations, hardcoded values, and UI/API disconnects.

---

## CRITICAL ISSUES (Blocking/Severe)

### 1. Pattern Builder - Save Not Connected to Backend
**File:** `/home/user/rowlyknit/frontend/src/pages/PatternBuilder.tsx`
**Lines:** 124-136
**Severity:** CRITICAL
**Issue:** The `savePattern()` function only saves to browser localStorage, not to the backend API. This means user-created patterns are lost on browser clear and not persisted to the database.
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
  toast.success('Pattern saved to browser storage!');
  toast.warning('Note: This is temporary storage. Use Export to save permanently.');
};
```
**What Needs Fixing:** 
- Add API endpoint call to `/api/patterns` to save the created pattern
- Integrate with the pattern creation endpoint (similar to upload pattern functionality)
- Store pattern data in backend database, not just localStorage

### 2. ProjectDetail - totalRows Hardcoded to 0
**File:** `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
**Lines:** 852-860
**Severity:** CRITICAL
**Issue:** SessionManager component receives hardcoded `totalRows={0}` with a TODO comment. This breaks row-based milestone tracking for sessions.
**Current Code:**
```typescript
<SessionManager
  projectId={id!}
  totalRows={0} // TODO: Get from project or pattern
  getCurrentCounterValues={() => {
    // Get counter values from CounterManager
    // This is a placeholder - you may need to lift state up or use context
    return {};
  }}
/>
```
**What Needs Fixing:**
- Calculate totalRows from associated pattern or project data
- Implement proper state lifting to get counter values from CounterManager
- The `getCurrentCounterValues()` callback is a placeholder returning empty object

### 3. PatternDetail - Bookmark Jump Not Implemented
**File:** `/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx`
**Lines:** 530-534
**Severity:** HIGH
**Issue:** Bookmark click handler doesn't actually jump to the specified page in the PDF viewer
**Current Code:**
```typescript
onJumpToBookmark={(bookmark) => {
  toast.info(`Jumping to page ${bookmark.page_number}`);
  setActiveTab('viewer');
  // TODO: Jump to specific page in viewer
}}
```
**What Needs Fixing:**
- Create a ref to PatternViewer and call its page jump method
- Pass page number state to PatternViewer component
- Implement scroll/navigation to specified page

### 4. ProjectDetail - Structured Memos Feature Disabled
**File:** `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
**Line:** 102
**Severity:** HIGH
**Issue:** Feature is disabled with comment "Temporarily disabled - feature not yet implemented"
**Current Code:**
```typescript
// fetchStructuredMemos(); // Temporarily disabled - feature not yet implemented
```
**What Needs Fixing:**
- Implement fetchStructuredMemos function to load from backend
- Ensure StructuredMemoTemplates component has full backend integration
- Remove temporary disabling logic once implemented

---

## HIGH SEVERITY ISSUES

### 5. CounterCard - Unused Refs and Incomplete Voice Recognition Integration
**File:** `/home/user/rowlyknit/frontend/src/components/counters/CounterCard.tsx`
**Lines:** 26-27
**Severity:** HIGH
**Issue:** Refs created but appear to be for handling stale closures in voice recognition that doesn't update them properly
**Current Code:**
```typescript
const handleIncrementRef = useRef<() => void>(() => {});
const handleDecrementRef = useRef<() => void>(() => {});
```
**What Needs Fixing:**
- Verify these refs are actually used by voice recognition handler
- Update refs when handlers change (useEffect)
- If not used, remove them to reduce confusion

### 6. SessionManager - Undefined Values in Session Start
**File:** `/home/user/rowlyknit/frontend/src/components/sessions/SessionManager.tsx`
**Lines:** 69-72
**Severity:** HIGH
**Issue:** Session start sends undefined values for mood, location, and notes instead of actually capturing them
**Current Code:**
```typescript
const response = await axios.post(`/api/projects/${projectId}/sessions/start`, {
  mood: undefined,
  location: undefined,
  notes: undefined,
});
```
**What Needs Fixing:**
- Implement UI to capture mood, location, and notes before starting session
- Pass actual values instead of undefined
- Add form or modal to collect session context

### 7. WebSocket Context - Missing Event Listener Cleanup
**File:** `/home/user/rowlyknit/frontend/src/contexts/WebSocketContext.tsx`
**Severity:** HIGH
**Issue:** Socket event listeners might accumulate if component unmounts/remounts without proper cleanup
**What Needs Fixing:**
- Verify all `socket.on()` handlers have corresponding `socket.off()` in cleanup
- Check if listeners are properly removed in useEffect return

---

## MEDIUM SEVERITY ISSUES

### 8. PatternBuilder - Feature Incomplete (Export-Only)
**File:** `/home/user/rowlyknit/frontend/src/pages/PatternBuilder.tsx`
**Severity:** MEDIUM
**Issue:** PatternBuilder can create patterns but cannot load/edit existing patterns from the database
**What Needs Fixing:**
- Add ability to load pattern by ID when accessed via `/patterns/:id/builder`
- Implement pattern update API call (PUT endpoint)
- Add delete pattern functionality
- Create pattern from existing library or start fresh

### 9. Offline Sync Manager - Missing Last Sync Time Tracking
**File:** `/home/user/rowlyknit/frontend/src/utils/offline/syncManager.tsx`
**Line:** 58
**Severity:** MEDIUM
**Issue:** `lastSyncTime` is always undefined, making it impossible to show when last sync occurred
**Current Code:**
```typescript
lastSyncTime: undefined, // Could track this in localStorage
```
**What Needs Fixing:**
- Implement localStorage-based tracking of last sync timestamp
- Update on successful sync completion
- Display in UI for user awareness

### 10. AudioNotes - Transcription Update Missing Dependency
**File:** `/home/user/rowlyknit/frontend/src/components/notes/AudioNotes.tsx`
**Lines:** 23-24
**Severity:** MEDIUM
**Issue:** `onUpdateTranscription` callback is optional but may not be fully wired in ProjectDetail
**What Needs Fixing:**
- Verify all call sites properly implement transcription update handler
- Ensure backend endpoint exists for updating transcriptions
- Add error handling for failed updates

### 11. Dashboard - Low Stock Threshold Field Mismatch
**File:** `/home/user/rowlyknit/frontend/src/pages/Dashboard.tsx`
**Lines:** 93-96
**Severity:** MEDIUM
**Issue:** Dashboard checks `y.low_stock_threshold` but also tries `y.quantity_remaining || y.skeins || 0` - inconsistent field naming
**Current Code:**
```typescript
const currentQuantity = y.quantity_remaining || y.skeins || 0;
return currentQuantity <= y.low_stock_threshold;
```
**What Needs Fixing:**
- Standardize field names between frontend and backend
- Ensure YarnStash.tsx uses consistent naming
- Update type definitions to be clear about field names

### 12. Magic Markers - Unused State Variable
**File:** `/home/user/rowlyknit/frontend/src/components/magic-markers/MagicMarkerManager.tsx`
**Lines:** 47-48
**Severity:** MEDIUM
**Issue:** `_editingMarker` state is declared but not actually used (underscore prefix indicates unused)
**Current Code:**
```typescript
const [_editingMarker, _setEditingMarker] = useState<MagicMarker | null>(null);
```
**What Needs Fixing:**
- Implement edit functionality for magic markers or remove the state
- If edit is planned, wire up the form to pre-populate from edited marker
- If not needed, remove to reduce code clutter

### 13. SyncIndicator - Hardcoded Retry Attempt Number
**File:** `/home/user/rowlyknit/frontend/src/components/offline/SyncIndicator.tsx`
**Line:** 141
**Severity:** MEDIUM
**Issue:** Hardcoded "{3}" in error message instead of using actual MAX_RETRIES constant
**Current Code:**
```typescript
The following changes could not be synced after {3} attempts.
```
**What Needs Fixing:**
- Import MAX_RETRIES from syncManager
- Use variable instead of hardcoded number
- Keep message in sync with actual retry logic

### 14. ChartEditor - Missing useCallback Dependencies
**File:** `/home/user/rowlyknit/frontend/src/components/patterns/ChartEditor.tsx`
**Lines:** 2, 42
**Severity:** MEDIUM
**Issue:** useCallback is imported but `fetchSymbols` may not have correct dependencies
**What Needs Fixing:**
- Verify all async functions have correct dependency arrays
- Ensure `patternId` is included in dependencies if used
- Check for potential infinite loops in effect hooks

---

## LOW-MEDIUM SEVERITY ISSUES

### 15. Multiple Pages - Inconsistent Error Handling
**Files:** Multiple (Tools.tsx, Patterns.tsx, Recipients.tsx, ProjectDetail.tsx, etc.)
**Severity:** LOW-MEDIUM
**Issue:** Some error handlers don't show user-friendly messages, just console errors
**Current Pattern:**
```typescript
catch (error) {
  console.error('Error:', error);
}
```
**What Needs Fixing:**
- Add `toast.error()` calls for all failed API operations
- Standardize error message format across all pages
- Show specific error messages from backend when available

### 16. Form Validation - Missing on Multiple Forms
**Files:** 
- `/home/user/rowlyknit/frontend/src/pages/Patterns.tsx` - Pattern creation form
- `/home/user/rowlyknit/frontend/src/pages/Recipients.tsx` - Recipient form
- `/home/user/rowlyknit/frontend/src/pages/YarnStash.tsx` - Yarn creation form
**Severity:** LOW-MEDIUM
**Issue:** Forms have minimal validation - could submit with empty required fields
**What Needs Fixing:**
- Add client-side validation before submission
- Validate field types (numbers, emails, etc.)
- Provide inline feedback on invalid inputs

### 17. ChartViewer - Unused Touch State Variables
**File:** `/home/user/rowlyknit/frontend/src/components/patterns/ChartViewer.tsx`
**Lines:** 63
**Severity:** LOW
**Issue:** `touchStart` state for touch pinch-to-zoom is declared but implementation incomplete
**What Needs Fixing:**
- Implement pinch-to-zoom for mobile touch events
- Or remove if not planned for this version

### 18. RowCounter - Incomplete Voice Recognition Conditional
**File:** `/home/user/rowlyknit/frontend/src/components/RowCounter.tsx`
**Severity:** LOW
**Issue:** Voice recognition feature may not fully handle browser support differences
**What Needs Fixing:**
- Test on different browsers (Safari, Firefox, Edge)
- Provide graceful fallbacks for unsupported browsers
- Consider using a polyfill library

### 19. GlobalSearch - Inconsistent Subtitle Fallback
**File:** `/home/user/rowlyknit/frontend/src/components/GlobalSearch.tsx`
**Lines:** 90-91, 101, 123
**Severity:** LOW
**Issue:** Some search results show empty subtitles if field doesn't exist
**Current Code:**
```typescript
subtitle: p.designer || p.pattern_type,  // Could both be undefined
subtitle: `${y.color_name || ''} - ${y.weight || ''}`,  // Shows " - " for undefined
```
**What Needs Fixing:**
- Provide better fallback text
- Hide subtitle div if all fields undefined
- Standardize subtitle display format

### 20. SessionTimer - Missing Mood State Display
**File:** `/home/user/rowlyknit/frontend/src/components/sessions/SessionTimer.tsx`
**Line:** 27
**Severity:** LOW
**Issue:** Mood state is undefined initially but no default selection shown in UI
**What Needs Fixing:**
- Initialize with a default mood or null
- Show visual feedback for selected mood
- Test mood persistence across page reloads

---

## MISSING IMPLEMENTATIONS & INCOMPLETE FEATURES

### 21. Knitting Mode - getCurrentCounterValues Returns Empty Object
**File:** `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
**Lines:** 855-858
**Severity:** MEDIUM
**Issue:** Placeholder implementation that doesn't actually get counter values
**What Needs Fixing:**
- Lift counter state from CounterManager into ProjectDetail
- Pass actual counter values to SessionManager
- Use context/reducer pattern if state management becomes complex

### 22. Pattern Sections - No Save to Backend Feedback
**File:** `/home/user/rowlyknit/frontend/src/components/patterns/PatternSectionsManager.tsx`
**Severity:** LOW-MEDIUM
**Issue:** Sections can be created but unclear if persisted to backend
**What Needs Fixing:**
- Add loading state while saving
- Show success/error toast messages
- Verify backend integration with pattern sections API

### 23. PDF Collation - No Validation of PDF Compatibility
**File:** `/home/user/rowlyknit/frontend/src/components/patterns/PDFCollation.tsx`
**Severity:** LOW
**Issue:** Allows collating PDFs without checking if they're actually PDF files or corrupted
**What Needs Fixing:**
- Add file type validation on selection
- Verify PDF can be parsed before including in collation
- Show error message for invalid files

---

## PERFORMANCE ISSUES

### 24. ProjectDetail - Multiple API Calls in Parallel (Inefficient)
**File:** `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
**Lines:** 171-176
**Severity:** LOW-MEDIUM
**Issue:** Fetches all available items (patterns, yarn, tools, recipients) on page load - could be slow with large datasets
**What Needs Fixing:**
- Implement pagination/lazy loading for available items
- Only fetch when user opens the add modal
- Cache results to avoid repeated fetches

### 25. Offline Sync - No Exponential Backoff Upper Limit
**File:** `/home/user/rowlyknit/frontend/src/utils/offline/syncManager.tsx`
**Line:** 115
**Severity:** LOW
**Issue:** Exponential backoff could get very large - `2^3 * 2000 = 16000ms` for item with 3 retries
**Current Code:**
```typescript
const delay = RETRY_DELAY * Math.pow(2, item.retries);
```
**What Needs Fixing:**
- Implement maximum backoff cap (e.g., max 60 seconds)
- Add jitter to prevent thundering herd
- Log backoff delays for debugging

### 26. Socket.IO Reconnection - Could Cause Memory Leak
**File:** `/home/user/rowlyknit/frontend/src/contexts/WebSocketContext.tsx`
**Severity:** LOW
**Issue:** Multiple reconnection attempts without cooldown period
**What Needs Fixing:**
- Implement exponential backoff for reconnection attempts
- Add maximum retry limit
- Clean up abandoned connections

---

## TYPE SAFETY & CODE QUALITY ISSUES

### 27. @ts-nocheck Comments (Avoiding Type Checking)
**Files:**
- `/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx`
- `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx` (implicit - uses any types)
- `/home/user/rowlyknit/frontend/src/components/patterns/ChartEditor.tsx`
- `/home/user/rowlyknit/frontend/src/components/notes/AudioNotes.tsx`
- `/home/user/rowlyknit/frontend/src/components/offline/SyncIndicator.tsx`
- `/home/user/rowlyknit/frontend/src/components/sessions/SessionTimer.tsx`

**Severity:** MEDIUM
**Issue:** Files are disabling TypeScript checking, hiding potential type errors
**What Needs Fixing:**
- Remove @ts-nocheck comments
- Fix underlying type issues
- Use proper typing for all function parameters and return values
- Avoid using `any` type

### 28. Inconsistent Axios Error Handling
**File:** `/home/user/rowlyknit/frontend/src/lib/axios.ts`
**Severity:** MEDIUM
**Issue:** Some errors fall through to the final `Promise.reject()` without specific handling
**What Needs Fixing:**
- Add specific handling for 400 Bad Request
- Handle 422 Unprocessable Entity (validation errors)
- Document all handled error codes
- Consider custom error types instead of generic Error

---

## INCOMPLETE API INTEGRATIONS

### 29. Audio Notes - Optional Transcription Update
**File:** `/home/user/rowlyknit/frontend/src/components/notes/AudioNotes.tsx`
**Lines:** 24
**Severity:** LOW
**Issue:** onUpdateTranscription is optional, unclear if transcription feature works
**What Needs Fixing:**
- Ensure backend endpoint exists: `PATCH /api/projects/{projectId}/audio-notes/{noteId}`
- Test full transcription workflow
- Add error handling for transcription updates

### 30. Handwritten Notes - Canvas Undo/Redo State
**File:** `/home/user/rowlyknit/frontend/src/components/notes/HandwrittenNotes.tsx`
**Lines:** 250-251, 258-259
**Severity:** LOW
**Issue:** Undo/redo buttons disabled based on stack length, but unclear if backend persists drawing state
**What Needs Fixing:**
- Verify drawing data is properly encoded when saved
- Test undo/redo doesn't cause sync issues
- Ensure large drawings don't cause performance problems

---

## SUMMARY TABLE

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Missing/Broken Features | 5 | 3 | 2 | - | - |
| Hardcoded Values | 3 | 1 | 1 | 1 | - |
| API Disconnects | 8 | - | 3 | 4 | 1 |
| Type Safety | 6 | - | - | 2 | 4 |
| Performance | 3 | - | - | 2 | 1 |
| Error Handling | 2 | - | - | 2 | - |
| **TOTAL** | **27** | **4** | **6** | **11** | **6** |

---

## RECOMMENDED PRIORITY FIX ORDER

1. **Pattern Builder Save API Integration** (CRITICAL) - Users lose data
2. **ProjectDetail SessionManager totalRows** (CRITICAL) - Core feature broken
3. **CounterCard Refs & SessionManager Undefined Values** (HIGH) - Data integrity
4. **Bookmark Jump Implementation** (HIGH) - Core UI feature
5. **Type Safety (@ts-nocheck removal)** (MEDIUM) - Technical debt
6. **Form Validation** (MEDIUM) - User experience
7. **Error Handling Standardization** (MEDIUM) - User feedback
8. **Offline Sync Improvements** (LOW-MEDIUM) - Progressive enhancement

---

## TESTING RECOMMENDATIONS

1. Test PatternBuilder save flow end-to-end
2. Test SessionManager with actual counter values
3. Test offline sync with various network conditions
4. Test voice recognition across browsers
5. Test PDF collation with multiple files
6. Test audio recording in different browsers
7. Test responsive design on mobile devices
8. Load test with large datasets (many counters, yarn items, patterns)

