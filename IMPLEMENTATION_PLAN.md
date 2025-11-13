# Rowly Knitting App - Production Features Implementation Plan

## Overview
This document outlines the implementation strategy for transforming Rowly into a production-ready knitting companion app with advanced counter systems, pattern viewing, visual tracking, and session management.

## Current State Assessment

### ✅ What We Have
- Basic counter with increment/decrement/reset
- Real-time sync via Socket.IO
- Voice control for counters
- File upload infrastructure for PDFs
- Solid database schema with counters and counter_history tables
- React + TypeScript + Tailwind + Zustand + React Query stack
- PWA support with offline capabilities
- Authentication and security middleware

### ❌ What's Missing
- Advanced counter features (multiple, linked, custom increments)
- PDF viewer component (only upload/download exists)
- Visual tracking tools (row markers, highlighters)
- Session management and timers
- Advanced note-taking (audio, handwritten)
- Full offline sync queue

---

## Phase 1: Enhanced Counter System (PRIORITY)

### 1.1 Multiple Counters Per Project

**Database Changes:**
- ✅ Already have `counters` table with `project_id`, `sort_order`
- ✅ Already have `type` field (row, stitch, repeat, custom)
- Need to add: `display_color` (for visual distinction)
- Need to add: `is_visible` (for showing/hiding counters)

**Frontend Components:**
```
CounterManager.tsx (new)
├── CounterCard.tsx (enhanced RowCounter.tsx)
│   ├── Large touch targets (min 60px buttons)
│   ├── Current count display
│   ├── Progress bar (if target set)
│   ├── Haptic feedback support
│   └── Visual color coding
├── CounterList.tsx (new)
│   ├── Drag-to-reorder counters
│   ├── Show/hide toggles
│   └── Add counter button
└── CounterForm.tsx (new - create/edit)
```

**Features:**
- Display multiple counters simultaneously on one screen
- Each counter has customizable name, color, type
- Reorderable via drag-and-drop (react-beautiful-dnd or dnd-kit)
- Independent operation with individual histories

**API Endpoints (additions):**
```
GET    /api/projects/:id/counters          (list all)
POST   /api/projects/:id/counters          (create new)
PUT    /api/projects/:id/counters/:cid     (update)
DELETE /api/projects/:id/counters/:cid     (delete)
PATCH  /api/projects/:id/counters/reorder  (update sort_order)
```

### 1.2 Linked Counters

**Database Changes:**
```sql
CREATE TABLE counter_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_counter_id UUID REFERENCES counters(id) ON DELETE CASCADE,
  target_counter_id UUID REFERENCES counters(id) ON DELETE CASCADE,
  link_type VARCHAR(50) NOT NULL, -- 'reset_on_target', 'advance_together', 'conditional'
  trigger_condition JSONB, -- { "when": "equals", "value": 8 }
  action JSONB, -- { "action": "reset", "to_value": 1 }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_counter_id, target_counter_id)
);

CREATE INDEX idx_counter_links_source ON counter_links(source_counter_id);
```

**Logic:**
- When counter reaches trigger value, execute action on linked counter
- Example: Row counter hits 8 → Cable counter resets to 1
- Example: Decrease counter hits target → Auto-advance to next pattern section

**Frontend:**
- LinkCounterModal.tsx - UI for creating counter links
- Visual indicators showing which counters are linked
- Link chains display (Counter A → Counter B → Counter C)

**Backend Logic:**
```typescript
// In counter update logic
async function handleCounterUpdate(counterId, newValue) {
  // Update counter
  await updateCounter(counterId, newValue);

  // Check for links where this counter is the source
  const links = await getActiveLinks(counterId);

  for (const link of links) {
    if (evaluateTriggerCondition(link.trigger_condition, newValue)) {
      await executeLinkedAction(link.target_counter_id, link.action);
      // Emit socket event for real-time update
    }
  }
}
```

### 1.3 Customizable Increment Counters

**Database Changes:**
- ✅ Already have `increment_by` field
- Add: `increment_pattern` (JSONB) - for complex patterns
  ```json
  {
    "type": "custom",
    "rule": "every_n_rows",
    "n": 2,
    "increment": 1,
    "description": "Garter stitch ridge counting"
  }
  ```

**Increment Types:**
1. **Simple:** +1 per click
2. **Custom Fixed:** +N per click (e.g., +4 for cable crosses)
3. **Every N:** +1 every N clicks (for garter ridges)
4. **Custom Pattern:** User-defined complex rules

**Frontend:**
- IncrementPatternSelector.tsx
- Preset patterns dropdown (Stockinette, Garter, Cable, Colorwork)
- Custom pattern builder

### 1.4 Counter History/Undo

**Database:**
- ✅ `counter_history` table exists with:
  - `old_value`, `new_value`, `action`, `timestamp`
- Enhance with: `user_note` field for context

**Frontend Components:**
```
CounterHistory.tsx
├── Timeline view (last 10-20 actions)
├── Timestamp display (relative: "5 minutes ago")
├── Undo button per action
├── Bulk undo to specific point
└── Export history option
```

**Features:**
- Display: "Row 23 completed at 3:45pm"
- Undo to any previous state
- Show diff: 22 → 23 → 24 → [UNDO] → 23
- Preserve history even after undo (full audit trail)
- Filter history by date range or action type

**API Endpoints:**
```
GET    /api/projects/:id/counters/:cid/history
POST   /api/projects/:id/counters/:cid/undo/:historyId
DELETE /api/projects/:id/counters/:cid/history (clear old history)
```

### 1.5 Visual Counter Displays

**Design System:**
```css
/* Large touch targets */
.counter-button {
  min-width: 60px;
  min-height: 60px;
  border-radius: 12px;
  font-size: 24px;
}

.counter-value {
  font-size: 48px;
  font-weight: 700;
  font-variant-numeric: tabular-nums; /* monospace numbers */
}
```

**Features:**
- **Prominent +/- buttons** with clear icons
- **Current count** in large, high-contrast font
- **Progress bar** showing completion percentage
- **Current row instructions** pulled from pattern bookmarks/notes
- **Haptic feedback** on mobile (navigator.vibrate API)
- **Progress visualization** (circular progress indicator)
- **Color-coded counters** for quick identification

**Haptic Feedback Implementation:**
```typescript
const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    navigator.vibrate(patterns[pattern]);
  }
};
```

**Accessibility:**
- ARIA labels for screen readers
- Keyboard navigation (Arrow keys, +/-, Enter)
- High contrast mode support
- Focus indicators

---

## Phase 2: Pattern Interaction Tools

### 2.1 PDF Viewer with Navigation

**Dependencies:**
- ✅ Already have: `pdfjs-dist`, `react-pdf`

**Component Structure:**
```
PatternViewer.tsx
├── PDFDocument (from react-pdf)
│   ├── Page thumbnails sidebar
│   ├── Main page display
│   ├── Zoom controls (50% to 200%)
│   ├── Page navigation (prev/next, jump to page)
│   └── Search text functionality
├── PDFToolbar.tsx
│   ├── Zoom in/out/fit
│   ├── Rotate page
│   ├── Page selector dropdown
│   ├── Search bar
│   └── Bookmark button
└── PDFThumbnails.tsx
    └── Clickable page previews
```

**Features:**
- Smooth scrolling between pages
- Keyboard shortcuts (PgUp, PgDn, Home, End)
- Touch gestures (pinch to zoom, swipe to change page)
- Persistent zoom level per pattern
- Text selection for copying

**Performance:**
- Lazy load pages (render only visible + 1 before/after)
- Web Worker for PDF parsing (built into pdfjs)
- Cache rendered pages in memory

### 2.2 Pattern Page Resizing

**Implementation:**
```typescript
const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface ViewSettings {
  pageZoom: number;        // Overall page zoom
  textScale: number;       // Text-only scaling
  fontWeight: number;      // 400-700 for contrast
  lineHeight: number;      // 1.2-2.0 for readability
}
```

**Controls:**
- Slider for page zoom (50% - 200%)
- Separate text scale control
- Font weight toggle (Regular/Bold)
- Line spacing adjuster
- Layout reflow that maintains pattern structure

**Storage:**
- Save view settings per pattern in localStorage
- Sync settings across devices via user preferences

### 2.3 PDF Outline/Section Organization

**Features:**
- Parse PDF table of contents (if exists)
- Auto-detect section breaks by:
  - Heading font size changes
  - Keyword detection ("Setup", "Cast On", "Ribbing", "Body", "Sleeves")
  - Page breaks
- Create clickable outline/index
- Show progress through each section

**Database Table:**
```sql
CREATE TABLE pattern_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  page_number INTEGER,
  y_position INTEGER, -- position on page
  sort_order INTEGER,
  parent_section_id UUID REFERENCES pattern_sections(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Component:**
```
PDFOutline.tsx
├── Collapsible tree view
├── Click to jump to section
├── Progress indicators per section
└── Add custom section bookmark
```

### 2.4 PDF Collation

**Features:**
- Merge multiple PDFs (main pattern + errata + sizing chart)
- Reorder pages via drag-and-drop
- Add divider pages between sections
- Create unified table of contents
- Save as new combined pattern

**Implementation:**
- Use `pdf-lib` on backend to merge PDFs
- Frontend UI for selecting files and order
- Generate combined PDF with bookmarks

**API Endpoint:**
```
POST /api/patterns/:id/collate
Body: {
  fileIds: [uuid1, uuid2, uuid3],
  pageOrder: [1, 2, 3, ...],
  dividers: [{ afterPage: 5, text: "Sizing Charts" }]
}
```

### 2.5 Pattern Bookmarking

**Database Table:**
```sql
CREATE TABLE pattern_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- "Current row", "Sleeve decreases"
  page_number INTEGER,
  y_position INTEGER,
  zoom_level NUMERIC(3,2),
  notes TEXT,
  color VARCHAR(7), -- hex color for visual coding
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Features:**
- Multiple bookmarks per pattern
- Quick-jump dropdown
- Visual indicators on pages (colored tabs)
- Named bookmarks (e.g., "Sleeve decreases start")
- Associate with specific project or global to pattern

**Component:**
```
BookmarkManager.tsx
├── Bookmark list with quick jump
├── Add bookmark at current position
├── Edit bookmark name/color
├── Delete bookmark
└── Jump between bookmarks (prev/next)
```

---

## Phase 3: Visual Tracking Tools

### 3.1 Row Markers

**Implementation:**
- SVG overlay on PDF canvas
- Moveable highlight bar (transparent yellow)
- Syncs with counter progress
- Customizable color and opacity

**Component:**
```
RowMarker.tsx
├── Draggable overlay (react-draggable)
├── Resize handles
├── Opacity slider
├── Color picker
└── Lock position toggle
```

**Features:**
- Auto-advance with counter
- Works on both text instructions and charts
- Multiple markers for complex patterns
- Persist position per project/pattern

### 3.2 "You Are Here" Marker

**Features:**
- Persistent breadcrumb trail
- Shows: Section > Subsection > Row > Instruction
- Context-aware positioning
- Visual arrow/pointer on pattern

**Component:**
```
BreadcrumbTrail.tsx
└── Section name > Row 45 > "K2tog, K to end"
```

**Integration:**
- Links to counter value
- Updates when counter advances
- Clickable breadcrumb to jump to section

### 3.3 Pattern Highlighter

**Implementation:**
- Canvas-based drawing tool
- Multiple highlight colors
- Persist highlights to database
- Sync across devices

**Database Table:**
```sql
CREATE TABLE pattern_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  page_number INTEGER,
  coordinates JSONB, -- { x, y, width, height }
  color VARCHAR(7),
  opacity NUMERIC(2,1),
  layer INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Component:**
```
HighlighterTool.tsx
├── Color palette (yellow, green, red, blue)
├── Opacity slider
├── Eraser mode
├── Clear all highlights
└── Drawing canvas overlay
```

### 3.4 Magic Markers (Smart Alerts)

**Database Table:**
```sql
CREATE TABLE magic_markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  counter_id UUID REFERENCES counters(id) ON DELETE SET NULL,
  trigger_type VARCHAR(50), -- 'counter_value', 'time_elapsed', 'date'
  trigger_condition JSONB, -- { "counter": "row", "operator": ">=", "value": 23 }
  alert_message TEXT,
  alert_type VARCHAR(50), -- 'info', 'warning', 'reminder'
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Features:**
- Counter-based triggers: "When row 23: Begin armhole shaping"
- Repeat-based: "After 3 repeats: Check measurement"
- Time-based: "After 2 hours: Stand and stretch"
- Yarn-based: "When 75% yarn used: Join new ball"

**Component:**
```
MagicMarkerManager.tsx
├── Add marker form
│   ├── Trigger type selector
│   ├── Condition builder
│   └── Alert message input
├── Active markers list
└── Marker alert toast
```

**Alert System:**
- Toast notifications (react-toastify)
- Optional sound alerts
- Persistent until dismissed
- Snooze option

### 3.5 Stitch/Chart Tools

**Features:**
- Interactive knitting chart viewer
- Symbol legend overlay
- Click-to-highlight chart squares
- Progress overlay (completed vs remaining)
- Zoom and pan for large charts
- Rotation for in-the-round charts

**Component:**
```
ChartViewer.tsx
├── SVGChart (render chart grid)
│   ├── Clickable squares
│   ├── Symbol rendering
│   └── Progress overlay
├── SymbolLegend.tsx
├── ChartControls.tsx
│   ├── Zoom controls
│   ├── Rotate chart (90°, 180°, 270°)
│   └── Toggle right-side/wrong-side view
└── ProgressOverlay.tsx
```

**Chart Data Structure:**
```typescript
interface KnittingChart {
  id: string;
  name: string;
  rows: number;
  stitches: number;
  grid: ChartCell[][];
  symbols: Symbol[];
  currentRow?: number;
  currentStitch?: number;
}

interface ChartCell {
  symbol: string;
  color?: string;
  note?: string;
  completed?: boolean;
}
```

**Storage:**
- Store chart images as pattern files
- Store chart progress in project metadata
- Sync progress with row counter

---

## Phase 4: Session Management

### 4.1 Multi-Session Support

**Database Table:**
```sql
CREATE TABLE knitting_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  rows_completed INTEGER DEFAULT 0,
  starting_counter_values JSONB,
  ending_counter_values JSONB,
  notes TEXT,
  mood VARCHAR(50), -- 'productive', 'frustrated', 'relaxed'
  location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_project ON knitting_sessions(project_id);
CREATE INDEX idx_sessions_user ON knitting_sessions(user_id);
CREATE INDEX idx_sessions_date ON knitting_sessions(start_time);
```

**Features:**
- One-tap start/stop timer
- Auto-detect when app opened/closed
- Session summary modal on end
- Track rows completed during session
- Mood tracking (optional fun feature)

**Component:**
```
SessionManager.tsx
├── SessionTimer.tsx
│   ├── Large start/stop button
│   ├── Elapsed time display
│   └── Quick session notes input
├── SessionSummary.tsx
│   ├── Duration
│   ├── Rows completed
│   ├── Average pace
│   └── Notes field
└── SessionHistory.tsx
    └── Past sessions list
```

**Timer Logic:**
```typescript
const [sessionId, setSessionId] = useState<string | null>(null);
const [elapsedTime, setElapsedTime] = useState(0);

const startSession = async () => {
  const session = await api.post('/sessions/start', {
    projectId,
    startingCounterValues: getCurrentCounterValues()
  });
  setSessionId(session.id);
  // Start interval timer
};

const endSession = async () => {
  await api.post(`/sessions/${sessionId}/end`, {
    endTime: new Date(),
    endingCounterValues: getCurrentCounterValues(),
    notes: sessionNotes
  });
  setSessionId(null);
  // Clear interval
};
```

### 4.2 Project Timer

**Features:**
- Cumulative time across all sessions
- Time per project milestone
- Estimated completion based on pace
- Time breakdown by section

**Database Additions:**
```sql
CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- "Ribbing", "Body", "Sleeves"
  target_rows INTEGER,
  actual_rows INTEGER,
  time_spent_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Component:**
```
ProjectTimer.tsx
├── Total time display
├── Milestone breakdown
│   ├── Ribbing: 2.5 hours
│   ├── Body: 12 hours (in progress)
│   └── Sleeves: Not started
├── Estimated completion
│   └── "~15 hours remaining at current pace"
└── Pace calculator
    └── "~3.2 rows per hour"
```

**Calculations:**
```typescript
const calculateEstimatedCompletion = (
  totalRows: number,
  completedRows: number,
  totalTimeSeconds: number
) => {
  const rowsPerHour = (completedRows / totalTimeSeconds) * 3600;
  const remainingRows = totalRows - completedRows;
  const estimatedHours = remainingRows / rowsPerHour;
  return estimatedHours;
};
```

### 4.3 Session Notes

**Features:**
- Quick text input during session
- Voice-to-text for hands-free notes
- Auto-save as typing
- Attach notes to specific row/counter value

**Component:**
```
SessionNotes.tsx
├── Text input with auto-save
├── Voice recording button
│   └── Web Speech API (speech-to-text)
├── Timestamp insertion
└── Notes timeline
    ├── "Row 23: Increased by 2 stitches at waist"
    ├── "Row 45: Yarn feels different in this dye lot"
    └── "Row 67: Cables are tight, try larger needle"
```

**Voice-to-Text Implementation:**
```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  appendNote(transcript);
};
```

---

## Phase 5: Advanced Note-Taking

### 5.1 Handwritten Notes

**Implementation:**
- HTML Canvas API for drawing
- Touch and stylus support
- Pressure-sensitive drawing (if supported)
- Export as PNG/SVG

**Library:**
- `react-canvas-draw` or `perfect-freehand`

**Component:**
```
HandwrittenNotes.tsx
├── Canvas drawing area
├── Tools
│   ├── Pen (multiple colors)
│   ├── Eraser
│   ├── Line thickness
│   └── Opacity
├── Export options
│   ├── Save as image
│   └── Attach to pattern page
└── Drawing layers
```

**Database:**
```sql
CREATE TABLE pattern_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  page_number INTEGER,
  annotation_type VARCHAR(50), -- 'drawing', 'text', 'arrow'
  data JSONB, -- Canvas path data or text content
  image_url VARCHAR(500), -- Exported PNG
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Audio Notes

**Features:**
- One-tap voice recording
- Automatic transcription (Web Speech API or cloud service)
- Playback controls
- Attach to specific pattern location or counter value

**Implementation:**
```typescript
const mediaRecorder = new MediaRecorder(stream);
const audioChunks: Blob[] = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', audioBlob);

  // Upload and get transcription
  const result = await api.post('/audio-notes', formData);
  setNotes([...notes, result]);
};
```

**Database:**
```sql
CREATE TABLE audio_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES patterns(id),
  audio_url VARCHAR(500),
  transcription TEXT,
  duration_seconds INTEGER,
  counter_values JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Component:**
```
AudioNotes.tsx
├── Record button (large, red when recording)
├── Recording indicator with timer
├── Notes list
│   ├── Audio player
│   ├── Transcription text
│   └── Edit transcription option
└── Filter/search transcriptions
```

### 5.3 Structured Memo Templates

**Templates:**
1. **Gauge Swatch**
   - Needle size
   - Stitches per inch
   - Rows per inch
   - Swatch dimensions

2. **Fit Adjustments**
   - Measurement name
   - Original value
   - Adjusted value
   - Reason for change

3. **Yarn Substitution**
   - Original yarn (name, weight, yardage)
   - Replacement yarn
   - Gauge comparison
   - Notes on differences

4. **Finishing Techniques**
   - Bind-off method
   - Seaming technique
   - Blocking instructions
   - Special finishing notes

**Database:**
```sql
CREATE TABLE structured_memos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  template_type VARCHAR(50),
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Component:**
```
MemoTemplates.tsx
├── Template selector dropdown
├── Dynamic form based on template
├── Saved memos list
└── Export memo as PDF/text
```

---

## Phase 6: Enhanced Offline Support

### 6.1 Complete Offline Pattern Access

**Implementation:**
- Cache all pattern files in IndexedDB
- Service Worker with aggressive caching
- Download pattern for offline button
- Storage quota management

**Service Worker Enhancement:**
```typescript
// In service-worker.ts
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/patterns/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open('patterns-cache').then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

**IndexedDB Schema:**
```typescript
const db = await openDB('rowly-offline', 1, {
  upgrade(db) {
    // Pattern files
    db.createObjectStore('patterns', { keyPath: 'id' });
    // PDF blobs
    db.createObjectStore('pdf-cache', { keyPath: 'patternId' });
    // Counters
    db.createObjectStore('counters', { keyPath: 'id' });
    // Pending sync
    db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
  },
});
```

### 6.2 Offline Counter Functionality

**Strategy:**
- Store counter state in IndexedDB
- Queue all counter operations for sync
- Optimistic UI updates
- Background sync when online

**Component:**
```typescript
const updateCounterOffline = async (counterId: string, newValue: number) => {
  // Update IndexedDB immediately
  await db.put('counters', { id: counterId, value: newValue, updatedAt: Date.now() });

  // Add to sync queue
  await db.add('sync-queue', {
    type: 'counter-update',
    data: { counterId, value: newValue },
    timestamp: Date.now(),
    synced: false
  });

  // Update UI
  setCount(newValue);
};
```

### 6.3 Sync Queue for Offline Changes

**Features:**
- Queue all mutations (counter updates, notes, highlights)
- Visual indicator of pending syncs
- Retry logic with exponential backoff
- Conflict resolution (last-write-wins or manual)

**Component:**
```
SyncIndicator.tsx
├── Online/offline status
├── Pending changes count
├── Sync now button
└── Conflict resolution modal
```

**Sync Logic:**
```typescript
const processSyncQueue = async () => {
  const queue = await db.getAll('sync-queue');
  const unsynced = queue.filter(item => !item.synced);

  for (const item of unsynced) {
    try {
      await api.post('/sync', item.data);
      await db.put('sync-queue', { ...item, synced: true });
    } catch (error) {
      console.error('Sync failed:', error);
      // Will retry on next sync attempt
    }
  }
};

// Listen for online event
window.addEventListener('online', processSyncQueue);
```

**Conflict Resolution:**
```typescript
interface Conflict {
  localValue: any;
  serverValue: any;
  lastSyncedValue: any;
  resolvedValue?: any;
}

const resolveConflict = (conflict: Conflict, strategy: 'local' | 'server' | 'manual') => {
  if (strategy === 'local') return conflict.localValue;
  if (strategy === 'server') return conflict.serverValue;
  // Manual resolution via UI
  return conflict.resolvedValue;
};
```

---

## Implementation Timeline

### Week 1-2: Enhanced Counter System
- [x] Multiple counters UI
- [x] Counter manager component
- [x] Linked counters database and logic
- [x] Custom increment patterns
- [x] Counter history/undo UI
- [x] Visual enhancements (large buttons, haptics)

### Week 3-4: Pattern Viewer
- [ ] PDF viewer component
- [ ] Zoom and navigation
- [ ] Pattern resizing controls
- [ ] Outline/section parser
- [ ] Bookmarking system

### Week 5: Visual Tracking
- [ ] Row markers
- [ ] You Are Here breadcrumbs
- [ ] Pattern highlighter
- [ ] Magic markers/alerts

### Week 6: Session Management
- [ ] Session timer
- [ ] Session history
- [ ] Project timer with milestones
- [ ] Session notes

### Week 7: Advanced Notes
- [ ] Handwritten notes canvas
- [ ] Audio recording and transcription
- [ ] Structured memo templates

### Week 8: Offline & Polish
- [ ] Enhanced offline caching
- [ ] Sync queue implementation
- [ ] Conflict resolution
- [ ] UI polish and bug fixes
- [ ] Testing and deployment

---

## Technical Considerations

### Performance
- Lazy load PDF pages
- Virtualize long lists (counters, history)
- Debounce sync operations
- Optimize re-renders with React.memo

### Mobile Optimization
- Touch-friendly UI (60px minimum touch targets)
- Haptic feedback
- Responsive design (mobile-first)
- PWA manifest and icons
- Install prompts

### Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus indicators

### Security
- File upload validation
- XSS prevention in user-generated content
- Rate limiting on sync endpoints
- Authentication on all endpoints

### Testing
- Unit tests for counter logic
- Integration tests for sync queue
- E2E tests for critical paths (Playwright)
- Performance testing for PDF rendering

---

## Success Metrics

### User Engagement
- Average session duration
- Counter increments per session
- Patterns viewed per week
- Notes created per project

### Feature Adoption
- % of users with multiple counters
- % using linked counters
- % using pattern bookmarks
- % using session timer

### Technical Health
- Offline sync success rate
- PDF rendering performance (time to first page)
- App load time
- Error rates

### User Satisfaction
- App store ratings
- Feature request themes
- Bug report frequency
- User retention rate

---

## Next Steps

1. ✅ Get approval on this implementation plan
2. Start with Phase 1: Enhanced Counter System
3. Implement in priority order
4. Deploy incrementally with feature flags
5. Gather user feedback and iterate

---

**Questions or feedback on this plan? Let's discuss before implementation begins!**
