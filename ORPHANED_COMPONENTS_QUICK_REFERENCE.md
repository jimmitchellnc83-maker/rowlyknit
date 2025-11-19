# Orphaned Components & Unused Endpoints - Quick Reference

## ORPHANED COMPONENTS (NOT BEING USED)

### 1. AudioNotes
- **File**: `/home/user/rowlyknit/frontend/src/components/notes/AudioNotes.tsx`
- **Purpose**: Audio recording and playback for project notes
- **Backend Ready**: YES - 5 API endpoints ready
- **Frontend Integration**: NO - Not imported anywhere
- **Recommendation**: Either delete or integrate into ProjectDetail page

### 2. HandwrittenNotes
- **File**: `/home/user/rowlyknit/frontend/src/components/notes/HandwrittenNotes.tsx`
- **Purpose**: Drawing canvas for pattern annotations
- **Backend Ready**: YES - Pattern annotation endpoints ready
- **Frontend Integration**: NO - Not imported anywhere
- **Recommendation**: Either delete or integrate into PatternViewer

### 3. ChartViewer
- **File**: `/home/user/rowlyknit/frontend/src/components/patterns/ChartViewer.tsx`
- **Purpose**: Display and interact with knitting charts
- **Backend Ready**: NO direct endpoints (would use pattern files)
- **Frontend Integration**: NO - Not imported anywhere
- **Recommendation**: Delete or create standalone chart page

---

## ACTIVE COMPONENTS (BEING USED)

### Pattern Viewing Components
- **PatternViewer** → Used in PatternFileUpload → Imported in PatternDetail page
  - Imports: BookmarkManager, RowMarker, PatternHighlighter
  
- **BookmarkManager** → Used in PatternViewer (nested)
  - API: GET/POST/PUT/DELETE bookmarks
  
- **RowMarker** → Used in PatternViewer (nested)
  - Provides visual row tracking overlay
  
- **PatternHighlighter** → Used in PatternViewer (nested)
  - API: GET/POST/PUT/DELETE highlights

- **PDFCollation** → Used in Patterns page
  - API: POST /api/patterns/collate

---

## PAGES STRUCTURE

### PatternDetail (`/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx`)
- Uses: PatternFileUpload component
- Features: File upload/download, pattern metadata, edit/delete
- NOT Integrated: AudioNotes, HandwrittenNotes, ChartViewer

### ProjectDetail (`/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`)
- Uses: PhotoGallery, FileUpload, CounterManager, SessionManager
- Features: Yarn tracking, counters, sessions, photos
- NOT Integrated: AudioNotes (full backend ready), other note types

---

## BACKEND ENDPOINTS - COMPLETELY UNUSED

### Audio Notes Suite (5 endpoints)
```
GET    /api/projects/:id/audio-notes
GET    /api/projects/:id/audio-notes/:noteId
POST   /api/projects/:id/audio-notes
PUT    /api/projects/:id/audio-notes/:noteId
DELETE /api/projects/:id/audio-notes/:noteId
```
- Backend File: `/home/user/rowlyknit/backend/src/routes/notes.ts`
- Frontend: No integration

### Structured Memos Suite (5 endpoints)
```
GET    /api/projects/:id/memos
GET    /api/projects/:id/memos/:memoId
POST   /api/projects/:id/memos
PUT    /api/projects/:id/memos/:memoId
DELETE /api/projects/:id/memos/:memoId
```
- Backend File: `/home/user/rowlyknit/backend/src/routes/notes.ts`
- Frontend: Component exists (StructuredMemoTemplates) but not used

### Pattern Sections Suite (4 endpoints)
```
GET    /api/patterns/:patternId/sections
POST   /api/patterns/:patternId/sections
PUT    /api/patterns/:patternId/sections/:sectionId
DELETE /api/patterns/:patternId/sections/:sectionId
```
- Backend File: `/home/user/rowlyknit/backend/src/routes/pattern-enhancements.ts`
- Frontend: No integration

### Pattern Annotations Suite (4 endpoints)
```
GET    /api/patterns/:patternId/annotations
POST   /api/patterns/:patternId/annotations
PUT    /api/patterns/:patternId/annotations/:annotationId
DELETE /api/patterns/:patternId/annotations/:annotationId
```
- Backend File: `/home/user/rowlyknit/backend/src/routes/pattern-enhancements.ts`
- Frontend: No integration

### Yarn Photos Suite (3 endpoints)
```
POST   /api/uploads/yarn/:yarnId/photos
GET    /api/uploads/yarn/:yarnId/photos
DELETE /api/uploads/yarn/:yarnId/photos/:photoId
```
- Backend File: `/home/user/rowlyknit/backend/src/routes/uploads.ts`
- Frontend: No integration

---

## PARTIALLY UNUSED ENDPOINTS

### Counter Features
- Counter reorder: `PATCH /api/projects/:id/counters/reorder`
- Counter history: `GET /api/projects/:id/counters/:counterId/history`
- Counter undo: `POST /api/projects/:id/counters/:counterId/undo/:historyId`
- Counter links: `POST/PUT/DELETE /api/projects/:id/counter-links/*`

### Session Features
- Session stats: `GET /api/projects/:id/sessions/stats`
- Milestones: `GET/POST/PUT/DELETE /api/projects/:id/milestones/*`

### Single Resource Endpoints (CRUD operations)
- Most individual GET and PUT operations are rarely used
- Example: `GET /api/yarn/:id`, `PUT /api/yarn/:id`, etc.

### Authentication
- Token refresh: `POST /api/auth/refresh`
- Email verification: `GET /api/auth/verify-email`
- Password reset: `POST /api/auth/request-password-reset`, `POST /api/auth/reset-password`

---

## DUPLICATE ROUTE DEFINITIONS

### Issue Found
- `/home/user/rowlyknit/backend/src/routes/patternBookmarks.ts`
- `/home/user/rowlyknit/backend/src/routes/pattern-enhancements.ts`
- **Problem**: Both files define similar bookmark routes
- **Recommendation**: Consolidate or remove patternBookmarks.ts

---

## MISSING INFRASTRUCTURE

### API Service Layer
- **Directory**: `/home/user/rowlyknit/frontend/src/services/`
- **Status**: EMPTY (0 files)
- **Current State**: All API calls made directly via axios in components
- **Issue**: No centralization, code duplication, hard to maintain
- **Recommendation**: Create service files like:
  - `patternService.ts`
  - `projectService.ts`
  - `yarnService.ts`
  - `projectService.ts`

---

## ACTION ITEMS

### High Priority
1. [ ] Delete or integrate AudioNotes component
2. [ ] Delete or integrate HandwrittenNotes component
3. [ ] Delete or integrate ChartViewer component
4. [ ] Consolidate patternBookmarks.ts with pattern-enhancements.ts

### Medium Priority
1. [ ] Create API service layer for abstraction
2. [ ] Document unused endpoints
3. [ ] Remove unused authentication endpoints

### Low Priority
1. [ ] Integrate counter history/undo if business requirement
2. [ ] Integrate counter links if business requirement
3. [ ] Implement milestones feature if planned

---

## FILE MANIFEST

### Orphaned Component Files
- `/home/user/rowlyknit/frontend/src/components/notes/AudioNotes.tsx`
- `/home/user/rowlyknit/frontend/src/components/notes/HandwrittenNotes.tsx`
- `/home/user/rowlyknit/frontend/src/components/patterns/ChartViewer.tsx`

### Component Index Files (Export Orphaned Components)
- `/home/user/rowlyknit/frontend/src/components/notes/index.ts`
- `/home/user/rowlyknit/frontend/src/components/patterns/index.ts`

### Backend Route Files (Define Unused Endpoints)
- `/home/user/rowlyknit/backend/src/routes/notes.ts` (audio notes & memos)
- `/home/user/rowlyknit/backend/src/routes/pattern-enhancements.ts` (sections & annotations)
- `/home/user/rowlyknit/backend/src/routes/patternBookmarks.ts` (DUPLICATE)

### Page Files
- `/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx`
- `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`

