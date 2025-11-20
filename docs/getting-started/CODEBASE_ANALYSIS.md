# Codebase Analysis Report: Orphaned Components and Unused Endpoints

## 1. ORPHANED COMPONENTS (Unused Frontend Components)

### Components That Exist But Are NOT Used Anywhere:

#### 1.1 AudioNotes Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/notes/AudioNotes.tsx`
- **Status**: ORPHANED - Not imported in any page or component
- **Exports From**: `/home/user/rowlyknit/frontend/src/components/notes/index.ts`
- **Purpose**: Audio recording and playback for project notes
- **API Endpoints Used**: 
  - POST /api/projects/:id/audio-notes
  - GET /api/projects/:id/audio-notes
  - PUT /api/projects/:id/audio-notes/:noteId
  - DELETE /api/projects/:id/audio-notes/:noteId

#### 1.2 HandwrittenNotes Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/notes/HandwrittenNotes.tsx`
- **Status**: ORPHANED - Not imported in any page or component
- **Exports From**: `/home/user/rowlyknit/frontend/src/components/notes/index.ts`
- **Purpose**: Drawing canvas for handwritten annotations
- **Related Backend**: Pattern enhancement endpoints for annotations

#### 1.3 ChartViewer Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/patterns/ChartViewer.tsx`
- **Status**: ORPHANED - Not imported in any page or component
- **Exports From**: `/home/user/rowlyknit/frontend/src/components/patterns/index.ts`
- **Purpose**: Display knitting charts with interactive zoom and rotation

### Components That ARE Being Used:

#### 1.4 PatternViewer Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/patterns/PatternViewer.tsx`
- **Status**: ACTIVE - Used in PatternFileUpload
- **Imports**: PatternFileUpload.tsx (line 3)
- **Nested Components Used**: BookmarkManager, RowMarker, PatternHighlighter
- **Features**: PDF viewing with zoom, rotation, search, bookmarks, highlighting

#### 1.5 BookmarkManager Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/patterns/BookmarkManager.tsx`
- **Status**: ACTIVE - Used in PatternViewer
- **Imports**: PatternViewer.tsx (line 18)
- **API Endpoints**:
  - GET /api/patterns/:patternId/bookmarks
  - POST /api/patterns/:patternId/bookmarks
  - PUT /api/patterns/:patternId/bookmarks/:bookmarkId
  - DELETE /api/patterns/:patternId/bookmarks/:bookmarkId

#### 1.6 RowMarker Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/patterns/RowMarker.tsx`
- **Status**: ACTIVE - Used in PatternViewer
- **Imports**: PatternViewer.tsx (line 19)
- **Purpose**: Overlay row tracking marker on PDF

#### 1.7 PatternHighlighter Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/patterns/PatternHighlighter.tsx`
- **Status**: ACTIVE - Used in PatternViewer
- **Imports**: PatternViewer.tsx (line 20)
- **API Endpoints**:
  - GET /api/patterns/:patternId/highlights
  - POST /api/patterns/:patternId/highlights
  - PUT /api/patterns/:patternId/highlights/:highlightId
  - DELETE /api/patterns/:patternId/highlights/:highlightId

#### 1.8 PDFCollation Component
- **Location**: `/home/user/rowlyknit/frontend/src/components/patterns/PDFCollation.tsx`
- **Status**: ACTIVE - Used in Patterns.tsx page
- **Imports**: Patterns.tsx (line 6)
- **API Endpoints**:
  - POST /api/patterns/collate

---

## 2. PATTERNDETAIL PAGE STRUCTURE

**File**: `/home/user/rowlyknit/frontend/src/pages/PatternDetail.tsx`

### Imports:
- PatternFileUpload (custom component)
- React hooks: useState, useEffect, useParams, useNavigate
- Icon library: react-icons/fi
- HTTP: axios

### Key Features:
1. **Pattern Information Display**: Name, description, designer, difficulty, category, notes
2. **File Management**: 
   - Upload pattern files (PDFs, images, documents)
   - Download files
   - Delete files
3. **Pattern Edit Modal**: Update all pattern attributes
4. **Pattern Delete**: With confirmation
5. **Statistics Panel**: Times used, files attached, created/updated dates
6. **File Types Supported**: PDF, images (JPEG, PNG, WebP), Word documents, text files

### API Endpoints Used:
- GET /api/patterns/:id - Fetch single pattern
- GET /api/uploads/patterns/:id/files - Get pattern files
- POST /api/uploads/patterns/:id/files - Upload file
- GET /api/uploads/patterns/:id/files/:fileId/download - Download file
- DELETE /api/uploads/patterns/:id/files/:fileId - Delete file
- PUT /api/patterns/:id - Update pattern
- DELETE /api/patterns/:id - Delete pattern

### Components Integrated:
- PatternFileUpload (which internally uses PatternViewer for PDF viewing)

---

## 3. PROJECTDETAIL PAGE STRUCTURE

**File**: `/home/user/rowlyknit/frontend/src/pages/ProjectDetail.tsx`

### Imports:
- PhotoGallery (custom component)
- FileUpload (custom component)
- CounterManager (from components/counters)
- SessionManager (from components/sessions)
- WebSocket context
- React hooks and Router

### Key Features:
1. **Project Information**: Name, type, status, recipient
2. **Timeline**: Start date, target completion, completion date
3. **Description & Notes**: Long-form project notes
4. **Photo Gallery**: Upload and manage project photos
5. **Yarn Usage Tracking**: 
   - Add yarn to project
   - Track yarn usage vs. stash level
   - Low stock warnings
   - Visual progress bars
6. **Counters Management**: Row/stitch counters linked to sessions
7. **Session Management**: Track knitting sessions
8. **Patterns Management**: Add/remove patterns from project
9. **Tools Management**: Add/remove tools from project
10. **Edit Modal**: Update project details
11. **Add Modals**: For patterns, yarn, and tools

### API Endpoints Used:
- GET /api/projects/:id - Fetch project
- GET /api/patterns - Available patterns list
- GET /api/yarn - Available yarn list
- GET /api/tools - Available tools list
- GET /api/recipients - Available recipients list
- PUT /api/projects/:id - Update project
- DELETE /api/projects/:id - Delete project
- POST /api/projects/:id/patterns - Add pattern
- DELETE /api/projects/:id/patterns/:patternId - Remove pattern
- POST /api/projects/:id/yarn - Add yarn
- DELETE /api/projects/:id/yarn/:yarnId - Remove yarn
- POST /api/projects/:id/tools - Add tool
- DELETE /api/projects/:id/tools/:toolId - Remove tool
- GET /api/uploads/projects/:id/photos - Get project photos
- POST /api/uploads/projects/:id/photos - Upload photo
- DELETE /api/uploads/projects/:id/photos/:photoId - Delete photo
- GET /api/projects/:id/counters - Get counters
- GET /api/projects/:id/sessions - Get sessions

### WebSocket Integration:
- joinProject() - Subscribe to project updates
- leaveProject() - Unsubscribe from project updates

### Components Integrated:
- PhotoGallery
- FileUpload
- CounterManager
- SessionManager

---

## 4. BACKEND API ENDPOINTS ANALYSIS

### Routes Files and Their Endpoints:

#### 4.1 `/api/patterns` (patterns.ts)
**Used in Frontend**: ✓
- GET / - Get all patterns
- GET /stats - Pattern statistics  ✓ Used (Dashboard)
- GET /:id - Get single pattern ✓ Used
- POST / - Create pattern ✓ Used
- PUT /:id - Update pattern ✓ Used
- DELETE /:id - Delete pattern ✓ Used
- POST /collate - Merge PDFs ✓ Used

#### 4.2 `/api/projects` (projects.ts)
**Used in Frontend**: ✓
- GET / - Get all projects ✓ Used
- GET /stats - Project statistics ✓ Used (Dashboard)
- GET /:id - Get single project ✓ Used
- POST / - Create project ✓ Used
- PUT /:id - Update project ✓ Used
- DELETE /:id - Delete project ✓ Used
- POST /:id/yarn - Add yarn ✓ Used
- PUT /:id/yarn/:yarnId - Update yarn (LIKELY UNUSED)
- DELETE /:id/yarn/:yarnId - Remove yarn ✓ Used
- POST /:id/patterns - Add pattern ✓ Used
- DELETE /:id/patterns/:patternId - Remove pattern ✓ Used
- POST /:id/tools - Add tool ✓ Used
- DELETE /:id/tools/:toolId - Remove tool ✓ Used

#### 4.3 `/api/uploads` (uploads.ts)
**Used in Frontend**: ✓
- POST /projects/:projectId/photos - Upload project photo ✓ Used
- GET /projects/:projectId/photos - Get project photos ✓ Used
- DELETE /projects/:projectId/photos/:photoId - Delete project photo ✓ Used
- POST /patterns/:patternId/files - Upload pattern file ✓ Used
- GET /patterns/:patternId/files - Get pattern files ✓ Used
- GET /patterns/:patternId/files/:fileId/download - Download file ✓ Used
- DELETE /patterns/:patternId/files/:fileId - Delete pattern file ✓ Used
- POST /yarn/:yarnId/photos - Upload yarn photo (LIKELY UNUSED)
- GET /yarn/:yarnId/photos - Get yarn photos (LIKELY UNUSED)
- DELETE /yarn/:yarnId/photos/:photoId - Delete yarn photo (LIKELY UNUSED)

#### 4.4 `/api/counters` (counters.ts)
**Used in Frontend**: Partial
- GET /projects/:id/counters - Get counters ✓ Used
- GET /projects/:id/counters/:counterId - Get single counter (LIKELY UNUSED)
- POST /projects/:id/counters - Create counter ✓ Used
- PUT /projects/:id/counters/:counterId - Update counter ✓ Used
- DELETE /projects/:id/counters/:counterId - Delete counter ✓ Used
- PATCH /projects/:id/counters/reorder - Reorder counters (LIKELY UNUSED)
- GET /projects/:id/counters/:counterId/history - Get counter history (LIKELY UNUSED)
- POST /projects/:id/counters/:counterId/undo/:historyId - Undo counter (LIKELY UNUSED)
- POST /projects/:id/counter-links - Create counter link (LIKELY UNUSED)
- PUT /projects/:id/counter-links/:linkId - Update counter link (LIKELY UNUSED)
- DELETE /projects/:id/counter-links/:linkId - Delete counter link (LIKELY UNUSED)
- PATCH /projects/:id/counter-links/:linkId/toggle - Toggle link (LIKELY UNUSED)

#### 4.5 `/api/sessions` (sessions.ts)
**Used in Frontend**: ✓ (via SessionManager)
- GET /projects/:id/sessions - Get sessions ✓ Used
- GET /projects/:id/sessions/stats - Session stats (LIKELY UNUSED)
- GET /projects/:id/sessions/active - Get active session (LIKELY UNUSED)
- GET /projects/:id/sessions/:sessionId - Get single session (LIKELY UNUSED)
- POST /projects/:id/sessions/start - Start session ✓ Used
- POST /projects/:id/sessions/:sessionId/end - End session ✓ Used
- PUT /projects/:id/sessions/:sessionId - Update session (LIKELY UNUSED)
- DELETE /projects/:id/sessions/:sessionId - Delete session (LIKELY UNUSED)
- GET /projects/:id/milestones - Get milestones (LIKELY UNUSED)
- POST /projects/:id/milestones - Create milestone (LIKELY UNUSED)
- PUT /projects/:id/milestones/:milestoneId - Update milestone (LIKELY UNUSED)
- DELETE /projects/:id/milestones/:milestoneId - Delete milestone (LIKELY UNUSED)

#### 4.6 `/api/notes` (notes.ts)
**Used in Frontend**: NOT USED
- GET /projects/:id/audio-notes - (UNUSED - AudioNotes component not integrated)
- GET /projects/:id/audio-notes/:noteId - (UNUSED)
- POST /projects/:id/audio-notes - (UNUSED)
- PUT /projects/:id/audio-notes/:noteId - (UNUSED)
- DELETE /projects/:id/audio-notes/:noteId - (UNUSED)
- GET /projects/:id/memos - (UNUSED - StructuredMemoTemplates not used)
- GET /projects/:id/memos/:memoId - (UNUSED)
- POST /projects/:id/memos - (UNUSED)
- PUT /projects/:id/memos/:memoId - (UNUSED)
- DELETE /projects/:id/memos/:memoId - (UNUSED)

#### 4.7 `/api/pattern-enhancements` (pattern-enhancements.ts)
**Used in Frontend**: Partial
- GET /patterns/:patternId/sections - (LIKELY UNUSED)
- POST /patterns/:patternId/sections - (LIKELY UNUSED)
- PUT /patterns/:patternId/sections/:sectionId - (LIKELY UNUSED)
- DELETE /patterns/:patternId/sections/:sectionId - (LIKELY UNUSED)
- GET /patterns/:patternId/bookmarks - ✓ Used (in BookmarkManager via PatternViewer)
- POST /patterns/:patternId/bookmarks - ✓ Used
- PUT /patterns/:patternId/bookmarks/:bookmarkId - ✓ Used
- DELETE /patterns/:patternId/bookmarks/:bookmarkId - ✓ Used
- GET /patterns/:patternId/highlights - ✓ Used (in PatternHighlighter)
- POST /patterns/:patternId/highlights - ✓ Used
- PUT /patterns/:patternId/highlights/:highlightId - ✓ Used
- DELETE /patterns/:patternId/highlights/:highlightId - ✓ Used
- GET /patterns/:patternId/annotations - (UNUSED - no annotation viewer)
- POST /patterns/:patternId/annotations - (UNUSED)
- PUT /patterns/:patternId/annotations/:annotationId - (UNUSED)
- DELETE /patterns/:patternId/annotations/:annotationId - (UNUSED)

#### 4.8 `/api/pattern-bookmarks` (patternBookmarks.ts) - DUPLICATE!
**Status**: DUPLICATE ROUTE FILE
**Note**: Routes conflict with pattern-enhancements.ts bookmarks routes
- Similar bookmark endpoints (likely legacy)

#### 4.9 `/api/magic-markers` (magic-markers.ts)
**Used in Frontend**: ✓ (MagicMarkerManager exists but usage unclear)
- GET /projects/:id/magic-markers - Likely used
- POST /projects/:id/magic-markers - Likely used
- PUT /projects/:id/magic-markers/:markerId - Likely used
- DELETE /projects/:id/magic-markers/:markerId - Likely used
- PATCH /projects/:id/magic-markers/:markerId/toggle - Likely used

#### 4.10 `/api/yarn` (yarn.ts)
**Used in Frontend**: ✓
- GET / - Get yarn stash ✓ Used
- GET /stats - Yarn statistics ✓ Used (Dashboard)
- GET /:id - Get single yarn (LIKELY UNUSED)
- POST / - Create yarn ✓ Used
- PUT /:id - Update yarn (LIKELY UNUSED)
- DELETE /:id - Delete yarn (LIKELY UNUSED)

#### 4.11 `/api/tools` (tools.ts)
**Used in Frontend**: ✓
- GET / - Get tools ✓ Used
- GET /stats - Tool statistics ✓ Used (Dashboard)
- GET /:id - Get single tool (LIKELY UNUSED)
- POST / - Create tool ✓ Used
- PUT /:id - Update tool (LIKELY UNUSED)
- DELETE /:id - Delete tool (LIKELY UNUSED)

#### 4.12 `/api/recipients` (recipients.ts)
**Used in Frontend**: ✓
- GET / - Get recipients ✓ Used
- POST / - Create recipient ✓ Used
- PUT /:id - Update recipient (LIKELY UNUSED)
- DELETE /:id - Delete recipient (LIKELY UNUSED)

#### 4.13 `/api/auth` (auth.ts)
**Used in Frontend**: ✓
- POST /login - Login ✓ Used
- POST /register - Register ✓ Used
- POST /logout - Logout ✓ Used
- POST /refresh - Refresh token (LIKELY UNUSED)
- GET /profile - Get profile ✓ Used
- GET /verify-email - Verify email (LIKELY UNUSED)
- POST /request-password-reset - (LIKELY UNUSED)
- POST /reset-password - (LIKELY UNUSED)

---

## 5. UNUSED API ENDPOINTS SUMMARY

### Completely Unused Endpoints (No Frontend Integration):
1. **Audio Notes API** - Full suite unused
   - /api/projects/:id/audio-notes*
   
2. **Structured Memos API** - Full suite unused
   - /api/projects/:id/memos*
   
3. **Pattern Sections API** - Full suite unused
   - /api/patterns/:patternId/sections*
   
4. **Pattern Annotations API** - Full suite unused
   - /api/patterns/:patternId/annotations*
   
5. **Yarn Photos API** - Full suite unused
   - /api/uploads/yarn/:yarnId/photos*

### Partially Unused Endpoints:
1. Counter history and undo functionality
   - /api/projects/:id/counters/:counterId/history
   - /api/projects/:id/counters/:counterId/undo/:historyId
   
2. Counter links (automation) - Advanced feature
   - /api/projects/:id/counter-links*
   
3. Session statistics and milestones
   - /api/projects/:id/sessions/stats
   - /api/projects/:id/milestones*
   
4. Single resource GET endpoints
   - /api/yarn/:id
   - /api/tools/:id
   - /api/recipients/:id
   - /api/projects/:id/sessions/:sessionId
   - /api/projects/:id/counters/:counterId
   
5. Update endpoints that are rarely used
   - PUT /api/yarn/:id
   - PUT /api/tools/:id
   - PUT /api/recipients/:id
   - PUT /api/projects/:id/yarn/:yarnId
   - PUT /api/projects/:id/sessions/:sessionId

6. Authentication endpoints
   - POST /api/auth/refresh
   - POST /api/auth/verify-email
   - POST /api/auth/request-password-reset
   - POST /api/auth/reset-password

---

## 6. MISSING API INTEGRATION FILES

**Status**: Service/API client layer is **EMPTY**
- Directory: `/home/user/rowlyknit/frontend/src/services/`
- Content: Empty (0 files)
- Current Practice: All API calls made directly via axios in components
- Recommendation: Create service layer for API abstraction

---

## 7. SUMMARY STATISTICS

### Frontend Components:
- **Total Component Files**: 35
- **Orphaned Components**: 3
  - AudioNotes
  - HandwrittenNotes
  - ChartViewer

### Backend Endpoints:
- **Total Endpoint Routes**: ~85+
- **Backend Route Files**: 13
- **Fully Unused**: ~5 suites (25+ endpoints)
- **Partially Unused**: ~12 endpoints
- **Actively Used**: ~45 endpoints

### Code Quality Observations:
1. No centralized API service layer
2. Duplicate route definitions (patternBookmarks.ts vs pattern-enhancements.ts)
3. Frontend-backend mismatch on available features
4. Advanced features (annotations, audio notes, counter links, milestones) backend-ready but not integrated

