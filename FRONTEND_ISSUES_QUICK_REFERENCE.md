# Frontend Issues - Quick Reference

## Critical Issues (Fix First)

1. **Pattern Builder - No Backend Save**
   - File: `/home/user/rowlyknit/frontend/src/pages/PatternBuilder.tsx`
   - Lines: 124-136
   - Issue: `savePattern()` only saves to localStorage
   - Fix: Add API call to `/api/patterns` endpoint

2. **ProjectDetail - totalRows Hardcoded**
   - File: `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
   - Lines: 854
   - Issue: `totalRows={0}` breaks row tracking
   - Fix: Get actual row count from pattern/project

3. **SessionManager - Empty Counter Values**
   - File: `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
   - Lines: 855-858
   - Issue: `getCurrentCounterValues()` returns empty object
   - Fix: Lift counter state from CounterManager

4. **ProjectDetail - Structured Memos Disabled**
   - File: `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
   - Line: 102
   - Issue: Feature disabled with "not yet implemented"
   - Fix: Implement fetchStructuredMemos()

## High Priority Issues

5. **PatternDetail - Bookmark Jump Not Implemented**
   - File: `/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx`
   - Lines: 533
   - Issue: TODO comment - doesn't navigate to page
   - Fix: Implement PDF viewer navigation

6. **SessionManager - Undefined Values**
   - File: `/home/user/rowlyknit/frontend/src/components/sessions/SessionManager.tsx`
   - Lines: 70-72
   - Issue: Sends undefined for mood, location, notes
   - Fix: Add UI to capture session metadata

7. **CounterCard - Unused Refs**
   - File: `/home/user/rowlyknit/frontend/src/components/counters/CounterCard.tsx`
   - Lines: 26-27
   - Issue: handleIncrementRef/handleDecrementRef not updated
   - Fix: Wire up to voice recognition or remove

8. **WebSocket - Event Listener Cleanup**
   - File: `/home/user/rowlyknit/frontend/src/contexts/WebSocketContext.tsx`
   - Issue: Socket listeners might accumulate
   - Fix: Add proper cleanup in useEffect return

## Medium Priority Issues

9. **Magic Markers - Unused State**
   - File: `/home/user/rowlyknit/frontend/src/components/magic-markers/MagicMarkerManager.tsx`
   - Line: 48
   - Issue: `_editingMarker` declared but not used
   - Fix: Implement edit functionality or remove

10. **Offline Sync - Missing Last Sync Time**
    - File: `/home/user/rowlyknit/frontend/src/utils/offline/syncManager.tsx`
    - Line: 58
    - Issue: `lastSyncTime` always undefined
    - Fix: Track in localStorage

11. **SyncIndicator - Hardcoded Number**
    - File: `/home/user/rowlyknit/frontend/src/components/offline/SyncIndicator.tsx`
    - Line: 141
    - Issue: "{3}" should use MAX_RETRIES constant
    - Fix: Import and use constant

12. **Type Safety Issues**
    - Files with @ts-nocheck:
      - PatternDetail.tsx (line 1)
      - ChartEditor.tsx (line 1)
      - AudioNotes.tsx (line 1)
      - SyncIndicator.tsx (line 1)
      - SessionTimer.tsx (line 1)
    - Fix: Remove @ts-nocheck and fix type errors

13. **Dashboard - Field Mismatch**
    - File: `/home/user/rowlyknit/frontend/src/pages/Dashboard.tsx`
    - Lines: 93-96
    - Issue: `quantity_remaining` vs `skeins` vs `y.skeins`
    - Fix: Standardize field names

14. **ProjectDetail - Performance Issue**
    - File: `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`
    - Lines: 171-176
    - Issue: Loads all items on page open
    - Fix: Use lazy loading or pagination

## Low Priority Issues

15. **PatternBuilder - Incomplete Features**
    - Cannot load/edit existing patterns
    - No delete functionality

16. **Error Handling - Inconsistent**
    - Multiple files lack user-friendly toast messages
    - Many console.error() without user feedback

17. **Form Validation - Missing**
    - Patterns.tsx
    - Recipients.tsx
    - YarnStash.tsx

18. **ChartViewer - Unused Touch State**
    - Line: 63
    - touchStart declared but pinch-zoom not implemented

19. **RowCounter - Voice Recognition**
    - Browser compatibility issues
    - Limited fallback support

20. **GlobalSearch - Subtitle Fallback**
    - Can show empty or " - " subtitles

---

## Quick Stats
- **Total Issues Found:** 30
- **Critical:** 4
- **High:** 6  
- **Medium:** 11
- **Low:** 9

**Estimated Fix Time:** 40-60 hours for all issues
**Priority Issues:** 4 critical + 6 high = 10 hours minimum

---

## Files Needing Attention (Most Issues)

1. `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx` - 4 major issues
2. `/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx` - 2 major issues
3. `/home/user/rowlyknit/frontend/src/pages/PatternBuilder.tsx` - 2 major issues
4. `/home/user/rowlyknit/frontend/src/components/sessions/SessionManager.tsx` - 1 critical issue
5. `/home/user/rowlyknit/frontend/src/components/counters/CounterCard.tsx` - 1 high issue
6. `/home/user/rowlyknit/frontend/src/contexts/WebSocketContext.tsx` - 1 high issue
7. `/home/user/rowlyknit/frontend/src/utils/offline/syncManager.tsx` - 2 medium issues

