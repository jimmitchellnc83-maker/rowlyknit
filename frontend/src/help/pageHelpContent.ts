/**
 * Page-level help content. Each entry matches a route pattern and provides
 * the title + sections the PageHelp drawer renders.
 *
 * Patterns are matched in order — put more specific routes before general
 * ones (e.g. /projects/:id/panels/:id/setup before /projects/:id).
 *
 * Sections render as a stacked list. `body` supports double-newline paragraph
 * breaks. Keep tone direct and practical — these are for a knitter on their
 * phone, not documentation.
 */

export interface HelpSection {
  heading: string;
  body: string;
  tip?: string;
}

export interface PageHelpEntry {
  title: string;
  tagline?: string;
  sections: HelpSection[];
}

export interface PageHelpRoute {
  pattern: RegExp;
  help: PageHelpEntry;
}

export const PAGE_HELP: PageHelpRoute[] = [
  // =========================================================================
  // Panel Mode (most specific routes first)
  // =========================================================================
  {
    pattern: /^\/projects\/[^/]+\/panels\/[^/]+\/setup$/,
    help: {
      title: 'Panel setup',
      tagline: 'Add, edit, and organise the panels for this piece.',
      sections: [
        {
          heading: 'Four ways to add a panel',
          body:
            '**Paste pattern text** — fastest. Paste lines like "Row 1: K2, P2" and Rowly splits them into panels with their correct repeat lengths.\n\n**Pick a template** — ten curated stitch patterns: seed, moss, 1×1 and 2×2 rib, cables (C4F/C6F/C8F), honeycomb, stockinette, garter. Rename before adding if you want.\n\n**Copy from another piece** — only shown if this project has another panel group. Ideal for mirror sleeves — clones every panel and its rows from the source.\n\n**Build manually** — set a repeat length and fill each row. Use for patterns coming from a chart or a book photo.',
          tip: 'Paste-and-parse handles "Row 1:", "Rnd 1:", ranges like "Rows 1-4:", and multi-row callouts like "Rows 1 and 3:" — but it warns you when rows are missing.',
        },
        {
          heading: 'Editing a panel',
          body:
            'Tap **Edit** on any panel in the list to change its name, repeat length, row offset, colour, or individual row instructions. Changing repeat length keeps existing rows where possible and adds blanks for new rows.',
        },
        {
          heading: 'Row offset',
          body:
            'Use **row offset** if a panel shouldn\'t start on master row 1 — for example, a border that begins after 10 rows of plain knitting. The panel shows "Starts in N rows" until the master reaches its offset.',
        },
      ],
    },
  },
  {
    pattern: /^\/projects\/[^/]+\/panels\/[^/]+$/,
    help: {
      title: 'Panel knitting view',
      tagline: 'Advance one counter — every panel\'s instruction updates itself.',
      sections: [
        {
          heading: 'Advancing the master counter',
          body:
            '**Tap the right side** of the big number for next row, the left side for back.\n\n**Swipe** right across the counter card to advance, left to retreat.\n\n**Long-press** the counter to open the jump-to-row modal and type any specific row.',
          tip: 'Every panel\'s current row is derived from the master counter via modulo math. No per-panel state to keep in sync — one tap moves all of them.',
        },
        {
          heading: 'Voice control',
          body:
            'Tap **Voice control** to start listening. Supported commands:\n\n• "next" / "next row" / "advance" — advance\n• "back" / "back one" / "undo" — retreat\n• "jump to 20" / "go to row 47" — jump\n• "read all" / "read everything" — speaks every panel\'s current instruction\n• "read cable A" — speaks just that panel (fuzzy-matches your panel name)\n• "where am I" — speaks master row + every panel\'s current row\n• "stop" — cancels in-flight speech',
          tip: 'Keep the mic on while you knit — advance verbally without putting needles down. The mic auto-stops after a preference-configured silence window.',
        },
        {
          heading: 'Reverting to an earlier point',
          body:
            'Tap **Undo last row** to step back one row. Tap **History** to see every change with a timestamp and revert to any point — every panel snaps to its derived row at that counter value.',
        },
        {
          heading: 'Alignment math',
          body:
            'The **Alignment math** drawer shows the LCM of your panel repeats — the number of rows until every panel simultaneously returns to its first row. Useful for planning colour changes or breaks.',
        },
        {
          heading: 'Offline mode',
          body:
            'If the network drops, the banner at the top will tell you. Advances are kept locally and queued; when you reconnect, they sync automatically and Rowly\'s other devices catch up.',
        },
      ],
    },
  },
  {
    pattern: /^\/projects\/[^/]+\/panels$/,
    help: {
      title: 'Panel Mode',
      tagline: 'Multi-panel pattern tracking for this project.',
      sections: [
        {
          heading: 'What is a panel group?',
          body:
            'A **panel group** is a piece of your garment — body, left sleeve, right sleeve, collar. Each has its own master counter so row counts stay independent.',
          tip: 'For a sweater in pieces, create three groups: "Body", "Left Sleeve", "Right Sleeve". When you finish one piece and start the next, back out to this hub and open the new group.',
        },
        {
          heading: 'Creating a group',
          body:
            'Tap **New panel group**, name the piece, and choose whether to create a new master counter or reuse an existing counter from this project. New-counter is the right default unless you\'re retrofitting.',
        },
        {
          heading: 'Pieces overview',
          body:
            'Each card shows the master row plus a chip for every panel with its current row / repeat length. Tap a card to open the knitting view for that piece.',
        },
      ],
    },
  },
  // =========================================================================
  // Projects
  // =========================================================================
  {
    pattern: /^\/projects\/[^/]+$/,
    help: {
      title: 'Project detail',
      tagline: 'Everything about a single knitting project.',
      sections: [
        {
          heading: 'Pattern + yarn + tools',
          body:
            'Link a pattern from your library, assign yarn from your stash, and note which needles and tools you\'re using. Rowly cross-checks needle availability against your stash and warns if anything is double-booked.',
        },
        {
          heading: 'Counters',
          body:
            'Track row counts, stitch counts, and custom counters. Counters can be linked to charts, have auto-reset behaviour, and fire magic markers at specific rows.',
          tip: 'For multi-panel patterns (cables + borders on different repeats), use **Panel Mode** at the link below the counters — it tracks every panel\'s row from one master counter.',
        },
        {
          heading: 'Magic markers',
          body:
            'Set reminders that fire at specific rows — "decrease here", "switch colour at row 48", "start sleeve shaping". Markers can be one-shot, repeating every N rows, or span a row range.',
        },
        {
          heading: 'Sessions + notes',
          body:
            'Knitting sessions track elapsed time and row deltas. Add audio notes, handwritten notes, or structured memos — all attached to this project and searchable globally.',
        },
        {
          heading: 'Progress + feasibility',
          body:
            'The **feasibility badge** tells you if your stash + gauge + pattern yardage add up. Ratings let you revisit which projects went well.',
        },
      ],
    },
  },
  {
    pattern: /^\/projects$/,
    help: {
      title: 'Projects',
      tagline: 'Every knitting project you\'ve tracked.',
      sections: [
        {
          heading: 'Creating a project',
          body:
            'Tap **+ New project**. Give it a name and a status (planning, in progress, on hold, complete). You can link a pattern, yarn, and tools later from the project detail page.',
        },
        {
          heading: 'Status + filtering',
          body:
            'Use the filter chips to narrow by status. Favouriting a project pins it to the top. The search box above finds projects by name or pattern title.',
        },
        {
          heading: 'Feasibility badges',
          body:
            'Cards show a traffic-light feasibility badge — green means your stash + gauge covers this project, amber means it\'s close, red means you need more yarn.',
          tip: 'Click a badge to see which factor (yardage, weight, gauge match) is driving the colour.',
        },
      ],
    },
  },
  // =========================================================================
  // Patterns
  // =========================================================================
  {
    pattern: /^\/patterns\/[^/]+$/,
    help: {
      title: 'Pattern detail',
      tagline: 'Uploaded pattern with notes, complexity, and linked projects.',
      sections: [
        {
          heading: 'Viewing the PDF',
          body:
            'The PDF viewer supports pinch-to-zoom, pan, and page-by-page navigation. Use the sidebar thumbnails for quick jumps.',
        },
        {
          heading: 'Complexity score',
          body:
            'Every uploaded pattern gets a complexity score from 1–5 based on detected techniques (cables, lace, colourwork, short rows), sizes offered, and estimated time. It\'s a rough guide, not a judgement.',
        },
        {
          heading: 'Notes + structured memos',
          body:
            'Add quick notes while you\'re knitting. Structured memos capture things like "cast on +10%" or "use larger needles for sleeves" — they survive across projects that use this pattern.',
        },
        {
          heading: 'Made by N knitters',
          body:
            'The "made by" count shows how many Rowly users have completed a project against this pattern. If the pattern is linked to Ravelry, it also pulls the Ravelry project count.',
        },
      ],
    },
  },
  {
    pattern: /^\/patterns$/,
    help: {
      title: 'Patterns',
      tagline: 'Your pattern library — uploaded PDFs, imported Ravelry patterns, and designer outputs.',
      sections: [
        {
          heading: 'Uploading a pattern',
          body:
            'Tap **+ Upload**. PDF, PNG, JPG, and text all accepted. For PDFs, Rowly extracts text for search and estimates complexity. Encrypted PDFs need to be unlocked before upload.',
        },
        {
          heading: 'Searching',
          body:
            'The search box finds patterns by name, designer, detected techniques (e.g. "cables"), or any term in the extracted text.',
        },
        {
          heading: 'Importing from Ravelry',
          body:
            'If you\'ve connected Ravelry in Profile, use the Ravelry sync to bring in bookmarks, favourites, and patterns you\'ve bought.',
        },
      ],
    },
  },
  // =========================================================================
  // Yarn
  // =========================================================================
  {
    pattern: /^\/yarn\/[^/]+$/,
    help: {
      title: 'Yarn detail',
      tagline: 'Everything about one skein or colorway in your stash.',
      sections: [
        {
          heading: 'Yardage + weight',
          body:
            'Total yardage, remaining yardage (auto-decremented from projects), and yarn weight (fingering / DK / worsted, etc.). Weight is stored in the knitter vernacular — CYC numeric codes are never shown as the primary label.',
        },
        {
          heading: 'Label capture',
          body:
            'Upload a photo of the yarn label and Rowly OCRs the fibre content, weight, yardage, and care instructions into the right fields. Review before saving.',
        },
        {
          heading: 'Usage across projects',
          body:
            'Every project using this yarn is listed with its estimated yardage. Helps you decide whether a remaining partial ball is enough for another project.',
        },
      ],
    },
  },
  {
    pattern: /^\/yarn$/,
    help: {
      title: 'Yarn stash',
      tagline: 'Every yarn in your inventory.',
      sections: [
        {
          heading: 'Adding yarn',
          body:
            'Tap **+ Add**. You can enter manually, scan a barcode, or snap a photo of the label to OCR-fill the fields. Add photos of the actual yarn so you remember what you have.',
        },
        {
          heading: 'Filtering + sorting',
          body:
            'Filter by weight, fibre, colour family, or remaining yardage. Sort by name, date added, or remaining yardage to plan your next project.',
        },
        {
          heading: 'Stash value',
          body:
            'The **Stash Value** card at the top estimates your total stash worth based on the cost-per-ball you entered. Helpful for insurance or just for a reality check.',
        },
      ],
    },
  },
  // =========================================================================
  // Tools
  // =========================================================================
  {
    pattern: /^\/tools$/,
    help: {
      title: 'Tools',
      tagline: 'Needles, hooks, and other knitting tools you own.',
      sections: [
        {
          heading: 'Adding a tool',
          body:
            'Tap **+ Add**. Pick the type (circular, DPN, straight, crochet hook, notion), size, length if applicable, and the material. Use canonical mm sizes — Rowly normalises US/metric automatically.',
        },
        {
          heading: 'Conflict check',
          body:
            'When you assign tools to a project, Rowly tells you if the same needle is already assigned to another in-progress project. Prevents "where are my 4mm circulars?" confusion.',
        },
        {
          heading: 'Categories + taxonomy',
          body:
            'Tools are tagged by category (needle / hook / notion) and subcategory (circular / DPN / etc.). Browse by category using the filters.',
        },
      ],
    },
  },
  // =========================================================================
  // Recipients
  // =========================================================================
  {
    pattern: /^\/recipients$/,
    help: {
      title: 'Recipients',
      tagline: 'People you knit for — measurements, preferences, gift history.',
      sections: [
        {
          heading: 'Measurements',
          body:
            'Store chest, waist, hip, arm length, head circumference, foot length. The Gift Size Calculator reads these to recommend a garment size without asking again.',
        },
        {
          heading: 'Preferences',
          body:
            'Track fibre allergies, colour preferences, disliked fibres, and any notes. Useful when you\'re shopping yarn for a gift.',
        },
        {
          heading: 'Gift history',
          body:
            'Every project linked to a recipient appears on their profile. Stops you from knitting the same scarf for someone twice.',
        },
      ],
    },
  },
  // =========================================================================
  // Calculators
  // =========================================================================
  {
    pattern: /^\/calculators\/gauge$/,
    help: {
      title: 'Gauge calculator',
      tagline: 'Scale stitch counts when your gauge doesn\'t match the pattern.',
      sections: [
        {
          heading: 'When to use this',
          body:
            'You swatched, measured, and your stitches-per-inch or rows-per-inch are different from the pattern\'s stated gauge. This tool scales the pattern\'s stitch/row counts so you end up with the intended finished measurements.',
        },
        {
          heading: 'Inputs',
          body:
            'Enter the pattern\'s stated gauge and your measured gauge (both stitches-per-inch and rows-per-inch). Then enter the number from the pattern — e.g. "cast on 96 stitches" — and the tool scales it.',
          tip: 'Swatch at least 4×4 inches after washing to get an honest gauge. Pre-wash swatching under-reports.',
        },
        {
          heading: 'When NOT to use this',
          body:
            'If the pattern has colourwork or cables that depend on multiples of specific numbers, scaling row counts can land you on a non-multiple. Verify against the chart before casting on.',
        },
      ],
    },
  },
  {
    pattern: /^\/calculators\/yarn-sub$/,
    help: {
      title: 'Yarn substitution calculator',
      tagline: 'Check whether one yarn can stand in for another.',
      sections: [
        {
          heading: 'What it checks',
          body:
            'Weight match (are both worsted?), gauge compatibility (do their stated gauges match?), fibre behaviour (will they block similarly?), and whether you have enough total yardage.',
        },
        {
          heading: 'Running the check',
          body:
            'Pick the pattern yarn and your substitute. The tool flags each axis as green / amber / red with an explanation.',
          tip: 'Weights are labelled in knitter vernacular (DK / Worsted / Sport) — CYC codes are internal only.',
        },
      ],
    },
  },
  {
    pattern: /^\/calculators\/gift-size$/,
    help: {
      title: 'Gift size calculator',
      tagline: 'Recommend a garment size from a recipient\'s measurements.',
      sections: [
        {
          heading: 'How it works',
          body:
            'Enter the recipient\'s body chest circumference (or pull from their Recipient profile), choose a fit preference (close / classic / oversized), and Rowly returns the recommended size in women\'s / men\'s / child / baby schemes.',
        },
        {
          heading: 'Ease explained',
          body:
            '**Close fit** subtracts 2" from the body — fitted. **Classic fit** adds 2" — standard sweater fit. **Oversized** adds 6" — roomy. The finished garment measurement is body + ease.',
        },
      ],
    },
  },
  {
    pattern: /^\/calculators$/,
    help: {
      title: 'Calculators',
      tagline: 'Quick utilities for knitters.',
      sections: [
        {
          heading: 'What\'s here',
          body:
            '**Gauge** — scale pattern stitch counts to your measured gauge.\n\n**Yarn substitution** — check if a yarn can replace another in a pattern.\n\n**Gift size** — recommend a garment size from a recipient\'s body measurements.',
        },
        {
          heading: 'Feasibility calculator',
          body:
            'The feasibility calculator is surfaced per-project on project cards rather than here. Open any project to see whether your stash + gauge + pattern add up.',
        },
      ],
    },
  },
  // =========================================================================
  // Designer
  // =========================================================================
  {
    pattern: /^\/designer/,
    help: {
      title: 'Pattern designer',
      tagline: 'Parametric garment design with schematic, stitch grid, and production instructions.',
      sections: [
        {
          heading: 'Filling in the form',
          body:
            'The form is sectioned top-to-bottom: measurements, gauge, construction method, stitch selection, shaping. Fields update the schematic live on the right.',
        },
        {
          heading: 'Chart grid + schematic',
          body:
            'The schematic shows the silhouette with measurements. The stitch grid renders your repeat over the piece so you can verify fit before casting on.',
        },
        {
          heading: 'Production instructions',
          body:
            'Scroll down past the schematic for the row-by-row written instructions. **Print view** renders a printer-ready version.',
        },
      ],
    },
  },
  // =========================================================================
  // Dashboard / misc
  // =========================================================================
  {
    pattern: /^\/dashboard$/,
    help: {
      title: 'Dashboard',
      tagline: 'Your command center.',
      sections: [
        {
          heading: 'What the cards show',
          body:
            '**In-progress projects** — active projects with your current row. Tap to open.\n\n**Activity heatmap** — GitHub-style grid of rows knitted per day over the last year.\n\n**Stash value** + **pattern library** — inventory counts.\n\n**Recent sessions** — last few knitting sessions with time + rows.',
        },
        {
          heading: 'Global search',
          body:
            'Press **⌘K** (Mac) or **Ctrl+K** (Windows) anywhere in Rowly to open global search — finds projects, patterns, yarn, and tools instantly.',
          tip: 'The ⌘K tooltip appears on your first visit to the dashboard. Once dismissed it stays dismissed.',
        },
      ],
    },
  },
  {
    pattern: /^\/stats$/,
    help: {
      title: 'Stats',
      tagline: 'Long-term trends across your knitting.',
      sections: [
        {
          heading: 'What\'s shown',
          body:
            'Total projects, patterns, and yarn — cumulative counts. Time-series charts for rows knitted per week, sessions per month, average session length.',
        },
        {
          heading: 'Heatmap',
          body:
            'The full-year activity heatmap is the same one on the dashboard but with more granularity. Hover a cell for the row count on that day.',
        },
      ],
    },
  },
  {
    pattern: /^\/profile$/,
    help: {
      title: 'Profile',
      tagline: 'Your account and integrations.',
      sections: [
        {
          heading: 'Account',
          body:
            'Change your name, email, or password. Updating email triggers a verification link to the new address.',
        },
        {
          heading: 'Ravelry',
          body:
            'Link your Ravelry account to sync favourites, bookmarks, and stash. OAuth-based; you can revoke access at any time.',
        },
        {
          heading: 'Voice preferences',
          body:
            'Toggle text-to-speech for voice control, adjust the silence timeout, and pick a language for speech recognition.',
        },
      ],
    },
  },
  // =========================================================================
  // Ravelry integrations
  // =========================================================================
  {
    pattern: /^\/ravelry\/bookmarks\/sync$/,
    help: {
      title: 'Sync Ravelry bookmarks',
      tagline: 'Import selected Ravelry bookmarks as Rowly patterns.',
      sections: [
        {
          heading: 'How it works',
          body:
            'Pick the bookmarks you want to bring in. Rowly creates a pattern entry for each — name, designer, Ravelry link, and any metadata the API exposes. The original Ravelry page stays untouched.',
        },
        {
          heading: 'What doesn\'t sync',
          body:
            'Ravelry doesn\'t expose the actual PDF or full pattern instructions via its API. You\'ll get the metadata + link; upload the PDF separately if you have it.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/bookmarks$/,
    help: {
      title: 'Ravelry bookmarks',
      tagline: 'Your Ravelry bookmarks, ready to sync.',
      sections: [
        {
          heading: 'Browse + select',
          body:
            'Scroll or search your Ravelry bookmarks. Multi-select the ones you want, then tap **Sync selected** to create Rowly patterns for them.',
        },
        {
          heading: 'Already-synced bookmarks',
          body:
            'Bookmarks that have already been imported are flagged so you don\'t re-import them.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/stash\/sync$/,
    help: {
      title: 'Sync Ravelry stash',
      tagline: 'Bring your Ravelry stash into your Rowly yarn inventory.',
      sections: [
        {
          heading: 'What gets imported',
          body:
            'Yarn name, brand, fibre content, weight, yardage, photos (if present), and your notes. Colors and colorway are preserved. Remaining yardage is taken as-is from Ravelry.',
        },
        {
          heading: 'Duplicates',
          body:
            'Rowly matches by Ravelry stash ID so a re-sync updates existing entries rather than creating duplicates.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/projects\/sync$/,
    help: {
      title: 'Sync Ravelry projects',
      tagline: 'Import your Ravelry projects as Rowly projects.',
      sections: [
        {
          heading: 'What gets imported',
          body:
            'Project name, pattern link (if available), yarn used, needles, start/finish dates, and any project notes. Photos come through if Ravelry hosts them.',
        },
        {
          heading: 'Linking to existing',
          body:
            'If a Ravelry project references a pattern already in your Rowly library, the link is preserved. Otherwise a pattern stub is created so the link survives.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/favorites\/yarns\/sync$/,
    help: {
      title: 'Sync favourite yarns',
      tagline: 'Your Ravelry-favourited yarns become shoppable references in Rowly.',
      sections: [
        {
          heading: 'Why sync favourite yarns',
          body:
            'Unlike stash, these are yarns you\'ve starred as "want to try" or "keep an eye on". They come in as reference entries — not counted in your stash inventory, but available when planning projects.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/favorites$/,
    help: {
      title: 'Ravelry favourites',
      tagline: 'Patterns you\'ve favourited on Ravelry.',
      sections: [
        {
          heading: 'What\'s here',
          body:
            'Every pattern you\'ve favourited on Ravelry. Multi-select + sync to create Rowly pattern entries linked back to Ravelry.',
        },
        {
          heading: 'Keep in sync',
          body:
            'Re-syncing catches new favourites since last import. Existing patterns keep their Rowly notes, tags, and project links.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/sync$/,
    help: {
      title: 'Ravelry sync',
      tagline: 'Hub for importing from your Ravelry account.',
      sections: [
        {
          heading: 'Connect first',
          body:
            'Go to **Profile → Ravelry** to connect. Rowly uses OAuth — your password is never sent or stored. You can revoke access at any time from Ravelry settings.',
        },
        {
          heading: 'What you can sync',
          body:
            '**Bookmarks** → Rowly patterns.\n\n**Favourites** → Rowly patterns.\n\n**Stash** → Rowly yarn inventory.\n\n**Projects** → Rowly projects.\n\n**Favourite yarns** → reference entries.\n\nEach category has its own page for previewing + selecting before commit.',
          tip: 'Sync is read-only — Rowly never writes back to Ravelry. Bidirectional sync is explicitly deferred.',
        },
      ],
    },
  },
  {
    pattern: /^\/help$/,
    help: {
      title: 'Help',
      tagline: 'The full how-to index.',
      sections: [
        {
          heading: 'Page-specific help',
          body:
            'The **?** button in the bottom-right of every page opens context-specific help about the tools on that page. Start there.',
        },
        {
          heading: 'Questions?',
          body:
            'If this page or the in-page help doesn\'t cover it, reach out via the feedback link.',
        },
      ],
    },
  },
];

export function getHelpForRoute(pathname: string): PageHelpEntry | null {
  for (const entry of PAGE_HELP) {
    if (entry.pattern.test(pathname)) return entry.help;
  }
  return null;
}
