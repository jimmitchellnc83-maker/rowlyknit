/**
 * Page-level help content. Each entry matches a route pattern and describes
 * every tool/button/control on that page as a step-by-step how-to.
 *
 * Structure:
 * - One section per TOOL the user can interact with (not per concept)
 * - Section heading = the tool's visible name on the page
 * - Section body = numbered/bullet how-to: "Tap X. Type Y. Save."
 *
 * Tone: imperative, concrete, no summaries. If removing a sentence wouldn't
 * confuse a knitter mid-task, cut it.
 *
 * Patterns matched in order — most specific first.
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
  // Panel Mode — setup
  // =========================================================================
  {
    pattern: /^\/projects\/[^/]+\/panels\/[^/]+\/setup$/,
    help: {
      title: 'Set up your pieces',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Add panel button',
          body:
            '1. Tap **Add panel** (blue button, bottom of the list).\n2. Pick one of four ways:\n   • **Paste pattern text** — fastest\n   • **Pick a template** — 10 curated stitch patterns\n   • **Copy from another piece** — only shown if this project has another panel group\n   • **Build manually** — fill each row by hand\n3. Complete the flow you picked. The new panel appears in the list.',
        },
        {
          heading: 'Paste pattern text (Path A)',
          body:
            '1. In the picker, tap **Paste pattern text**.\n2. Paste lines like `Row 1: K2, P2, C4F, P2, K2` into the textarea. Leave a blank line between panels if the source has more than one.\n3. Tap **Preview**.\n4. Review each row in the card on the right. Amber rows are gaps the parser couldn\'t find — type the missing instruction.\n5. Rename the panel at the top of each card if you want.\n6. Tap **Save N panels**.',
          tip: 'The parser handles `Row 1:`, `Rnd 1:`, bare `1:`, ranges (`Rows 1-4: knit`), and multi-row callouts (`Rows 1 and 3: knit`). It warns on gaps but never fabricates rows.',
        },
        {
          heading: 'Pick a template (Path B)',
          body:
            '1. In the picker, tap **Pick a template**.\n2. Find a template card (stockinette, garter, seed, moss, 1×1 rib, 2×2 rib, C4F, C6F, C8F, honeycomb).\n3. Type a custom name in the card if you want to override the default.\n4. Tap **Add this template**. The panel appears in the list immediately.',
        },
        {
          heading: 'Copy from another piece (Path C)',
          body:
            '1. In the picker, tap **Copy from another piece**. (Only visible if the project has other groups.)\n2. Pick the source group from the dropdown (e.g. "Left Sleeve" → copying into "Right Sleeve").\n3. Tap **Copy panels**. Every panel + its rows is cloned into this group. The source is untouched.',
        },
        {
          heading: 'Build manually (Path D)',
          body:
            '1. In the picker, tap **Build manually**.\n2. Type a **Name** (e.g. "Cable A").\n3. Set **Repeat length** — how many rows before the panel repeats.\n4. (Optional) Set **Row offset** if the panel shouldn\'t start until master row N+1.\n5. Pick a **Color** — shows up as the left-accent on the panel card.\n6. Fill the instruction for every numbered row.\n7. Tap **Save panel**. Save is disabled until every row has an instruction.',
        },
        {
          heading: 'Edit an existing panel',
          body:
            '1. Find the panel in the list.\n2. Tap **Edit** (blue text, right side of the row).\n3. Change name, repeat length, offset, color, or row instructions. The same editor opens.\n4. Tap **Save panel**. Row-count changes keep existing rows where they fit and blank out any new ones.',
        },
        {
          heading: 'Delete a panel',
          body:
            '1. In the list, tap the **trash icon** at the far right of the row.\n2. Confirm in the browser prompt. The panel and every row it contained are removed.',
          tip: 'Deletion cascades: panel_rows are removed too. The master counter is NOT affected.',
        },
      ],
    },
  },
  // =========================================================================
  // Panel Mode — knitting view
  // =========================================================================
  {
    pattern: /^\/projects\/[^/]+\/panels\/[^/]+$/,
    help: {
      title: 'Knit view',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Master counter (big number)',
          body:
            '• **Tap the right side** of the counter card → next row.\n• **Tap the left side** → back one row.\n• **Swipe right** across the card → next row (mobile).\n• **Swipe left** → back one row.\n• **Long-press** the counter (hold ~0.6s) → opens "Jump to row" modal. Type any row number and tap **Jump**.',
          tip: 'Advancing the master once updates every panel\'s current instruction via modulo math. There\'s no per-panel counter to sync.',
        },
        {
          heading: 'Panel cards',
          body:
            '• Each panel card shows its current row (e.g. "Row 7 of 10"), the instruction, and "N rows until repeat".\n• **Tap the panel header** (with the chevron) to collapse/expand it. Collapsed cards show just the name + row number.\n• The coloured bar on the left matches the panel\'s chosen color.\n• Panels where master row is still below their offset show "Starts in N rows" with no instruction box.',
        },
        {
          heading: 'Undo last row',
          body:
            '1. Tap **Undo last row** (bottom controls).\n2. Master drops by 1. Every panel\'s row recomputes.\n3. Disabled when master is already at row 1.',
        },
        {
          heading: 'History scrubber',
          body:
            '1. Tap **History** (bottom controls).\n2. A modal opens with every counter change — timestamp, old → new, and delta.\n3. The current row is highlighted; its Revert button is disabled and reads "Here".\n4. Tap **Revert** on any earlier entry.\n5. Confirm the browser prompt. Master snaps to that value; every panel\'s row derives to match.',
        },
        {
          heading: 'Voice control',
          body:
            '1. Tap **Voice control** (bottom controls). The button turns red and reads "Listening…".\n2. Say one of the commands. The cheat-sheet below lists all of them:\n   • "next" / "back" → advance / retreat\n   • "jump to 20" → jump\n   • "read all" → TTS every panel\'s current instruction\n   • "read cable A" → TTS just that panel\n   • "where am I" → TTS master row + every panel\'s row\n   • "stop" → cancel in-flight speech\n3. Tap the red button again to stop listening. Mic auto-stops after the silence timeout in Profile → Voice preferences.',
        },
        {
          heading: 'Read all button',
          body:
            '1. Tap **Read all** (bottom controls).\n2. TTS speaks master row + every started panel\'s current instruction.\n3. Doesn\'t require voice-control to be on — it\'s a one-shot.',
        },
        {
          heading: 'Alignment math drawer',
          body:
            '1. Scroll below the panel cards to the "Alignment math" panel.\n2. Tap the header to expand.\n3. Shows the LCM of your panel repeats + rows-until-next-alignment (countdown until every panel returns to row 1 simultaneously).',
        },
        {
          heading: 'Settings icon (gear, top-right)',
          body:
            'Tap the **gear icon** in the page header to jump to Panel setup for this group — where you can add, edit, or delete panels.',
        },
        {
          heading: 'Magic marker banner',
          body:
            'When a marker you\'ve set up fires at the current master row, a coloured band appears above the counter with the marker name and message. Tap the **X** to dismiss for this row — it reappears if you advance past and back.',
          tip: 'Set up markers from the Project detail page → Magic Markers section.',
        },
        {
          heading: 'Offline banner',
          body:
            'If the network drops, an amber "Offline" banner appears above the counter. Advances still work — they update the cached counter locally and queue for sync. When you reconnect, the queue drains automatically and the banner disappears.',
        },
      ],
    },
  },
  // =========================================================================
  // Panel Mode — hub
  // =========================================================================
  {
    pattern: /^\/projects\/[^/]+\/panels$/,
    help: {
      title: 'Guided Pieces',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'New panel group button',
          body:
            '1. Tap **New panel group**.\n2. Type a **Name** for the piece (e.g. "Body", "Left Sleeve").\n3. Choose the master counter:\n   • **Create a new master counter** (default) — Rowly makes one named "[your name] — Master Row".\n   • **Use an existing counter** — only pick this if you want to bind the group to a counter you already have.\n4. Tap **Create + add panels**. You\'ll land on the Panel setup page for the new group.',
          tip: 'For a multi-piece sweater, make one group per piece. Body + Left Sleeve + Right Sleeve → three groups. Each has its own master counter so row counts stay independent.',
        },
        {
          heading: 'Your pieces list',
          body:
            '• Each card is one panel group.\n• Shows the group name, panel count, master row, and chips for each panel (name + current row / repeat).\n• **Tap a card** to open the knitting view for that piece.\n• Cards update in real time if another device bumps the master counter.',
        },
        {
          heading: 'Editing or deleting a group',
          body:
            'Open the group → tap the **gear icon** in the knitting view header → that opens Panel setup. Panel groups themselves don\'t have an in-hub delete yet; delete all panels in setup if you want to empty a group.',
        },
      ],
    },
  },
  // =========================================================================
  // Project detail
  // =========================================================================
  {
    pattern: /^\/projects\/[^/]+$/,
    help: {
      title: 'Project detail',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Edit project (pencil icon)',
          body:
            '1. Tap the **pencil** near the project name.\n2. Change name, status (planning / in-progress / on-hold / complete), start date, or target date.\n3. Tap **Save**.',
        },
        {
          heading: 'Delete project',
          body:
            '1. Tap **Delete** in the project actions menu.\n2. Confirm in the modal.\n3. Project is soft-deleted — pattern/yarn/counter data stays tied to it but it won\'t show in lists.',
        },
        {
          heading: 'Link a pattern',
          body:
            '1. Scroll to the **Patterns** card.\n2. Tap **Link Pattern**.\n3. Search for the pattern in the modal (by name or designer).\n4. Tap a result → the pattern is linked and appears in the card with a link to its detail page.\n5. To unlink: tap the **X** next to the pattern name.',
        },
        {
          heading: 'Assign yarn',
          body:
            '1. Scroll to the **Yarn** card.\n2. Tap **Add yarn**.\n3. Pick from your stash in the modal, enter estimated yardage needed.\n4. Tap **Save**. Remaining yardage is auto-decremented from your stash.',
        },
        {
          heading: 'Needle inventory cross-check',
          body:
            'When you assign needles, Rowly shows a badge next to each needle that conflicts (the same needle is already assigned to another active project). Click the badge to see which project is holding it.',
        },
        {
          heading: 'Add a counter',
          body:
            '1. Scroll to the **Counters** card.\n2. Tap **New Counter**.\n3. Type a **Name**.\n4. Pick a **Type** (rows, stitches, repeats, custom).\n5. Set **Start value** (usually 1 or 0).\n6. (Optional) Set a **Target** and enable **Auto-reset** to cycle the counter.\n7. Pick a color.\n8. Tap **Save**.\n\nTo use: tap **+** to advance, **–** to retreat. Long-press to reset.',
        },
        {
          heading: 'Guided Pieces link',
          body:
            'Below the counters card, tap **Guided Pieces →**. Opens the hub where you can track every piece of a multi-panel pattern with one master counter.',
          tip: 'Use Guided Pieces when your pattern has multiple stitch-pattern sections repeating on different cycles (e.g. cables + borders + lace).',
        },
        {
          heading: 'Magic markers',
          body:
            '1. Scroll to the **Magic Markers** card.\n2. Tap **+ New Marker**.\n3. Pick a **Trigger type**:\n   • **Row range** — fires between rows X and Y\n   • **Counter value** — fires at exact row N\n   • **Row interval** — fires every N rows\n4. Set the trigger condition.\n5. Type the **Alert message**.\n6. Pick **Alert type** (notification / sound / vibration).\n7. Tap **Save**. The marker will fire at the configured row in Guided Pieces and counter views.',
        },
        {
          heading: 'Sessions',
          body:
            '1. Scroll to the **Sessions** card.\n2. Tap **Start session**. A timer starts; row deltas are recorded.\n3. Knit.\n4. Tap **Pause** or **Stop** when done. Sessions auto-pause after 5 minutes of inactivity.\n5. Session history shows elapsed time + row count per session.',
        },
        {
          heading: 'Notes (tabs)',
          body:
            '1. Scroll to the **Notes** tabs.\n2. **Audio** — tap the mic to record a voice note. Auto-transcribed.\n3. **Handwritten** — sketch with the drawing pad.\n4. **Structured** — plain text memos. Searchable via global search.',
        },
        {
          heading: 'Rate this project',
          body:
            '1. Tap the stars in the **Rating** card.\n2. Leave a comment if you want.\n3. Ratings show on the pattern\'s "Made by N knitters" count and help you decide which patterns to return to.',
        },
      ],
    },
  },
  {
    pattern: /^\/projects$/,
    help: {
      title: 'Projects',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: '+ New project button',
          body:
            '1. Tap **+ New project** (top-right).\n2. Type a **Name**.\n3. Pick a **Status** (planning / in-progress / on-hold / complete).\n4. Tap **Create**. You\'ll land on the project detail page to add pattern, yarn, and tools.',
        },
        {
          heading: 'Status filter chips',
          body:
            '• Tap a chip ("All", "In Progress", "Planning", "On Hold", "Complete") to filter the list.\n• Multi-select is not supported — one chip at a time.\n• Combine with the search box to narrow further.',
        },
        {
          heading: 'Search box',
          body:
            'Type in the search box to filter by project name or linked pattern title. Search is instant as you type.',
        },
        {
          heading: 'Favourite (star icon on card)',
          body:
            '1. Tap the **star** on any project card.\n2. Favourited projects pin to the top of the list.\n3. Tap again to unfavourite.',
        },
        {
          heading: 'Feasibility badge (traffic light)',
          body:
            '• **Green** = your stash + gauge covers this project\n• **Amber** = close but tight\n• **Red** = you need more yarn\n\nTap the badge on a card to see which factor (yardage, weight, or gauge match) is driving the colour.',
        },
        {
          heading: 'Open a project',
          body:
            'Tap anywhere on a project card (outside the star/badge) to open its detail page.',
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
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'PDF viewer',
          body:
            '• **Scroll** to move through the pattern.\n• **Pinch** (mobile) or **Ctrl/Cmd + scroll** (desktop) to zoom.\n• **Page thumbnails** — tap any thumbnail in the sidebar to jump to that page.\n• **Text search** — Ctrl/Cmd+F inside the viewer finds any word in the extracted text.',
        },
        {
          heading: 'Complexity score badge',
          body:
            '• A 1–5 score at the top based on detected techniques (cables, lace, colourwork, short rows), size range, and estimated time.\n• **Tap the badge** to see the breakdown — which techniques were detected, estimated hours, size range.',
        },
        {
          heading: '"Made by N knitters" card',
          body:
            '• Shows how many Rowly users have completed a project from this pattern.\n• If linked to Ravelry, it also pulls Ravelry\'s project count.\n• Your own completed projects for this pattern are listed.',
        },
        {
          heading: 'Notes tabs',
          body:
            '• **Quick notes** — plain text, shows up across projects that use this pattern.\n• **Structured memos** — tagged text like "Use +10% on sleeves for size L". Survive project-to-project.\n• Type → auto-saves.',
        },
        {
          heading: 'Delete pattern',
          body:
            '1. Tap the menu (three dots) → **Delete**.\n2. Confirm.\n3. Pattern file + notes are removed. Projects that linked to this pattern will have their link cleared.',
        },
      ],
    },
  },
  {
    pattern: /^\/patterns$/,
    help: {
      title: 'Patterns',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: '+ Upload button',
          body:
            '1. Tap **+ Upload** (top-right).\n2. Pick a file — PDF, PNG, JPG, or plain text.\n3. (Optional) Enter the designer name.\n4. Tap **Upload**. Rowly extracts text for search and computes a complexity score. Encrypted PDFs need to be unlocked before upload.',
        },
        {
          heading: 'Search box',
          body:
            'Type to filter by pattern name, designer, detected techniques (e.g. "cables"), or any word in the extracted text.',
        },
        {
          heading: 'Import from Ravelry',
          body:
            '1. Tap **Ravelry sync** (top-right bar).\n2. Connect your Ravelry account (Profile → Ravelry) if you haven\'t.\n3. Choose bookmarks or favourites to import. Each becomes a pattern entry in your library.',
        },
        {
          heading: 'Open a pattern',
          body:
            'Tap any pattern card to open its detail page (PDF viewer + notes + complexity).',
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
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Edit yarn fields',
          body:
            '1. Tap any field (brand, colorway, weight, fibre, yardage).\n2. Change the value.\n3. Tap outside or press Enter — auto-saves.',
        },
        {
          heading: 'Upload / replace label photo',
          body:
            '1. Tap **Upload label** (camera icon).\n2. Take or pick a photo.\n3. Rowly OCRs the fibre content, yardage, weight, and care symbols.\n4. Review the auto-filled fields and tap **Save** — reject any wrong read.',
        },
        {
          heading: 'Projects using this yarn',
          body:
            'The **Usage** card lists every project linked to this colorway with the yardage each consumes. Helps you decide whether a partial ball is enough for another project.',
        },
        {
          heading: 'Remaining yardage',
          body:
            '• Shown as total - consumed by projects.\n• To manually override (e.g. you measured a remaining ball), tap the yardage value and edit directly.',
        },
        {
          heading: 'Delete yarn',
          body:
            '1. Tap the menu (three dots) → **Delete**.\n2. Confirm. If projects reference this yarn, their link is cleared.',
        },
      ],
    },
  },
  {
    pattern: /^\/yarn$/,
    help: {
      title: 'Yarn stash',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: '+ Add yarn button',
          body:
            '1. Tap **+ Add** (top-right). Three paths appear.\n2. **Manual** — type fields by hand.\n3. **Label photo** — snap a yarn label and OCR auto-fills brand, fibre, yardage.\n4. **Barcode** — point your camera at the yarn\'s barcode to look it up.',
        },
        {
          heading: 'Filter chips',
          body:
            '• Tap a weight chip (Lace / Fingering / DK / Worsted / Aran / Bulky) to filter.\n• Fibre and colour-family chips work the same.\n• Chips are single-select within each group.',
        },
        {
          heading: 'Sort dropdown',
          body:
            '1. Tap the **Sort** dropdown.\n2. Pick: Name / Date Added / Remaining Yardage / Brand.\n3. Toggle the arrow to flip ascending / descending.',
        },
        {
          heading: 'Stash Value card',
          body:
            '• Top of the page. Sums every yarn\'s `cost × remaining yardage / total yardage`.\n• Hover (desktop) or tap (mobile) to see the breakdown per weight class.',
          tip: 'To get accurate values, fill in the cost-per-ball when you add yarn. Missing costs are excluded from the total.',
        },
        {
          heading: 'Open a yarn',
          body:
            'Tap any yarn card to open its detail page (edit, label photo, project usage).',
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
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: '+ Add tool button',
          body:
            '1. Tap **+ Add**.\n2. Pick a **Type** (circular needle / DPN / straight / crochet hook / notion).\n3. Enter **Size** (mm or US — Rowly normalises).\n4. For circulars, enter **Length** (inches or cm).\n5. Pick **Material** (metal / wood / bamboo / plastic).\n6. (Optional) Add a photo.\n7. Tap **Save**.',
        },
        {
          heading: 'Category filter',
          body:
            'Tap a category chip (Needles / Hooks / Notions) to filter. Subcategory chips appear below — tap a subcategory to narrow further.',
        },
        {
          heading: 'Conflict badge',
          body:
            'A red badge on a tool card means it\'s assigned to more than one active project simultaneously. Tap the badge to see which projects — and decide which one actually has the tool right now.',
        },
        {
          heading: 'Edit a tool',
          body:
            '1. Tap a tool card.\n2. Change fields.\n3. Tap **Save**. Conflicts are re-checked live.',
        },
        {
          heading: 'Delete a tool',
          body:
            '1. Tap the tool\'s menu → **Delete**.\n2. Confirm. Projects that used this tool keep the reference but it\'s marked as removed.',
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
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: '+ Add recipient',
          body:
            '1. Tap **+ Add recipient**.\n2. Enter a **Name**.\n3. Fill in **Measurements** (chest, waist, hip, arm length, head circumference, foot length — any you know).\n4. Add **Preferences** — fibre allergies, disliked colours, notes.\n5. Tap **Save**.',
        },
        {
          heading: 'Link a recipient to a project',
          body:
            '1. Open the project detail page.\n2. Scroll to Recipient.\n3. Pick from your recipients dropdown.\n4. The project now shows on the recipient\'s **Gift history**.',
        },
        {
          heading: 'Use measurements in Gift Size Calculator',
          body:
            '1. Open Calculators → Gift Size.\n2. Tap **Load from recipient**.\n3. Pick the recipient. Their chest measurement auto-fills.\n4. Pick a fit (close / classic / oversized). Rowly recommends a size.',
        },
        {
          heading: 'Edit / delete recipient',
          body:
            '1. Tap a recipient card to open.\n2. Edit fields inline — auto-saves.\n3. Delete from the card menu (three dots). Project links are cleared; project data remains.',
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
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Step 1: Enter the pattern\'s stated gauge',
          body:
            '• **Stitches per 4"** (or per 10 cm) — what the pattern says.\n• **Rows per 4"** — same.\n• Toggle units (inches / cm) if needed.',
        },
        {
          heading: 'Step 2: Enter your measured gauge',
          body:
            '• Swatch at least 4×4 inches.\n• Wash + block the swatch before measuring — pre-wash gauge under-reports.\n• Measure on a flat surface.\n• Enter **Stitches per 4"** and **Rows per 4"** as you measured.',
        },
        {
          heading: 'Step 3: Enter the pattern number to scale',
          body:
            '1. Pick the **Axis** (stitches or rows).\n2. Enter the pattern\'s stitch/row count (e.g. "cast on 96 stitches").\n3. The scaled number appears instantly. Tap **Copy** to put it on the clipboard.',
        },
        {
          heading: 'Warnings to heed',
          body:
            '• If the pattern is a cable/colourwork chart, the scaled count may not land on a multiple of the repeat. Round to the nearest multiple and recheck fit.\n• If your gauge is wildly off (>20%), change needle size before trying to scale the whole pattern.',
          tip: 'A gauge mismatch of just 10% over a 40" chest adds 4" of ease. Always swatch for anything fitted.',
        },
      ],
    },
  },
  {
    pattern: /^\/calculators\/yarn-sub$/,
    help: {
      title: 'Yarn substitution calculator',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Step 1: Pattern yarn (left column)',
          body:
            '• **Weight** — DK, worsted, etc. (labelled in knitter vernacular).\n• **Yardage per 100g** — from the pattern\'s ball-band info.\n• **Fibre** — wool, cotton, alpaca, etc.\n• **Total yardage needed** — from the pattern.',
        },
        {
          heading: 'Step 2: Your substitute (right column)',
          body:
            '• Same fields.\n• Or tap **Load from stash** to pick an existing yarn — fields auto-fill.',
        },
        {
          heading: 'Read the compatibility grid',
          body:
            '• **Weight** — green if identical, amber if adjacent (DK↔sport), red if mismatched.\n• **Gauge** — green if within 5%, amber ±10%, red above.\n• **Fibre** — green if similar family (wool/wool), amber if different but compatible (wool/alpaca), red if very different (wool/cotton).\n• **Yardage** — green if you have enough, red if short.',
        },
        {
          heading: 'Swatch before committing',
          body:
            'The calculator is a go/no-go first pass. Any "amber" result is a swatch conversation, not a veto.',
        },
      ],
    },
  },
  {
    // Match both the canonical /calculators/size and the legacy
    // /calculators/gift-size alias so help loads on either URL while
    // search engines transition.
    pattern: /^\/calculators\/(size|gift-size)$/,
    help: {
      title: 'Gift size calculator',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Enter body measurement',
          body:
            '1. Type the **Body chest circumference**.\n2. Toggle inches/cm if needed.\n3. Or tap **Load from recipient** and pick a recipient whose chest you\'ve recorded.',
        },
        {
          heading: 'Pick a fit',
          body:
            '• **Close fit** — finished garment is 2" smaller than body. Fitted.\n• **Classic fit** — 2" larger than body. Standard sweater.\n• **Oversized** — 6" larger. Roomy, slouchy.\n\nChanging fit re-runs the recommendation instantly.',
        },
        {
          heading: 'Read the recommendations',
          body:
            '• Three size schemes appear: **Women\'s**, **Men\'s**, **Children\'s** (and **Baby** for small measurements).\n• Each scheme shows the recommended size letter/number and the finished chest range.\n• The recommendation is the size whose finished chest is closest to body + ease.',
        },
      ],
    },
  },
  {
    pattern: /^\/calculators$/,
    help: {
      title: 'Calculators',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Gauge tile',
          body:
            'Tap **Gauge** to scale a pattern\'s stitch/row counts to your measured gauge. Use when your swatch doesn\'t match the pattern.',
        },
        {
          heading: 'Yarn substitution tile',
          body:
            'Tap **Yarn substitution** to check whether one yarn can stand in for another — compares weight, gauge, fibre, and yardage.',
        },
        {
          heading: 'Gift size tile',
          body:
            'Tap **Gift size** to get a recommended garment size from a recipient\'s body measurements. Pulls from your Recipients list.',
        },
        {
          heading: 'Feasibility (on project cards)',
          body:
            'The feasibility calc is surfaced per-project — look for the traffic-light badge on any project card. Tap a badge to see whether your stash, gauge, and pattern yardage add up.',
        },
      ],
    },
  },
  // =========================================================================
  // Designer
  // =========================================================================
  {
    pattern: /^\/designer\/print$/,
    help: {
      title: 'Designer — print view',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Print the pattern',
          body:
            '1. Tap your browser\'s print (Cmd/Ctrl+P).\n2. The layout is pre-formatted for A4 / Letter — schematic, stitch grid, and row-by-row instructions in order.\n3. Use "Save as PDF" if you want a file rather than paper.',
        },
        {
          heading: 'Back to designer',
          body:
            'Tap **Back to designer** (top-left) to return to the form. Any field changes there will update the print view live.',
        },
      ],
    },
  },
  {
    pattern: /^\/designer/,
    help: {
      title: 'Pattern designer',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Fill the form (left column)',
          body:
            '1. **Measurements** — chest, waist, hip, length, arm length.\n2. **Gauge** — stitches + rows per 4".\n3. **Construction** — bottom-up, top-down, seamed, raglan, etc.\n4. **Stitch pattern** — pick from the library or type a custom repeat.\n5. **Shaping** — waist shaping, sleeve taper, neckline depth.\n\nThe schematic on the right updates live as you change fields.',
        },
        {
          heading: 'Schematic (right column)',
          body:
            'Shows the garment silhouette with measurements labelled. Rotate with the icon in the top-right of the schematic to see front / back / side views.',
        },
        {
          heading: 'Stitch grid',
          body:
            'Below the schematic. Renders your chosen stitch pattern over the garment piece so you can see where cables/motifs land.',
        },
        {
          heading: 'Row-by-row instructions',
          body:
            'Scroll below the schematic. Every row is listed with its stitch count and any shaping. Copy-paste any row into another editor, or print the whole thing via the **Print view** button.',
        },
        {
          heading: 'Print view button',
          body:
            'Tap **Print view** (top-right). Opens a printer-friendly layout. Use browser print to save as PDF or print on paper.',
        },
      ],
    },
  },
  // =========================================================================
  // Dashboard
  // =========================================================================
  {
    pattern: /^\/dashboard$/,
    help: {
      title: 'Dashboard',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Global search (⌘K / Ctrl+K)',
          body:
            '1. Press **⌘K** (Mac) or **Ctrl+K** (Windows).\n2. A search bar opens.\n3. Type any term — Rowly searches projects, patterns, yarn, tools, and notes.\n4. Arrow keys to navigate, Enter to open.',
          tip: 'The ⌘K hint appears on your first dashboard visit. Once dismissed it stays dismissed.',
        },
        {
          heading: 'In-progress project cards',
          body:
            '• Each card shows a project name, current row, and progress bar.\n• **Tap a card** to open the project detail page and keep knitting.',
        },
        {
          heading: 'Activity heatmap',
          body:
            '• GitHub-style grid — rows knitted per day over the last year.\n• Darker squares = more rows knitted that day.\n• **Hover a square** (desktop) or **tap** (mobile) to see the exact row count + date.',
        },
        {
          heading: 'Stash value tile',
          body:
            'Tap the tile to jump to the Yarn Stash page. Total is your current stash worth based on entered cost-per-ball.',
        },
        {
          heading: 'Pattern library tile',
          body:
            'Tap to jump to Patterns. Count is your total saved patterns.',
        },
        {
          heading: 'Recent sessions',
          body:
            'Last few knitting sessions with duration + rows. Tap one to open that session\'s project.',
        },
      ],
    },
  },
  {
    pattern: /^\/stats$/,
    help: {
      title: 'Stats',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Summary tiles',
          body:
            'Total projects, patterns, yarn (by weight), tools. Tap any tile to jump to that section.',
        },
        {
          heading: 'Rows-per-week chart',
          body:
            'Bar chart of rows knitted per week. Hover a bar (desktop) or tap (mobile) for the exact count.',
        },
        {
          heading: 'Session history',
          body:
            'List of every session — date, duration, rows, project. Tap any row to open the project.',
        },
        {
          heading: 'Activity heatmap',
          body:
            'Full-year grid. Same as the dashboard widget but larger and more legible. Hover or tap a square for the day\'s count.',
        },
      ],
    },
  },
  {
    pattern: /^\/profile$/,
    help: {
      title: 'Profile',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Change name / email',
          body:
            '1. Tap the field, change, tap outside to save.\n2. Changing email triggers a verification link sent to the new address. You stay logged in; the old email is removed when you click verify.',
        },
        {
          heading: 'Change password',
          body:
            '1. Scroll to **Password**.\n2. Enter current password.\n3. Enter new password (twice).\n4. Tap **Update**. You remain logged in.',
        },
        {
          heading: 'Ravelry integration',
          body:
            '1. Tap **Connect Ravelry**.\n2. You\'re bounced to Ravelry to authorise — enter your Ravelry login.\n3. Back in Rowly, the section shows "Connected as [your Ravelry handle]".\n4. Tap **Disconnect** to revoke — Ravelry sync pages will stop working until you reconnect.',
        },
        {
          heading: 'Voice preferences',
          body:
            '1. Scroll to **Voice**.\n2. **TTS enabled** — toggle text-to-speech for voice commands.\n3. **Silence timeout** — how long (seconds) the mic can hear nothing before auto-stopping.\n4. **Language** — pick the recognition language. Defaults to browser default.',
        },
        {
          heading: 'Theme',
          body:
            'Tap the theme toggle in the sidebar header to switch dark / light. Choice persists per browser.',
        },
        {
          heading: 'Delete account',
          body:
            '1. Tap **Delete account** at the bottom (red).\n2. Type your email to confirm.\n3. Account + all data is scheduled for deletion. GDPR export is available before final delete.',
        },
      ],
    },
  },
  // =========================================================================
  // Ravelry pages
  // =========================================================================
  {
    pattern: /^\/ravelry\/bookmarks\/sync$/,
    help: {
      title: 'Sync Ravelry bookmarks',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Select bookmarks',
          body:
            '• Tap checkboxes on bookmark cards to queue them.\n• Or tap **Select all** / **Clear all** at the top.',
        },
        {
          heading: 'Sync selected button',
          body:
            '1. Tap **Sync selected**.\n2. Rowly creates a pattern entry for each — name, designer, Ravelry link, and available metadata.\n3. Wait for the progress bar. Count of successes / failures appears at the end.',
        },
        {
          heading: 'Already-synced tag',
          body:
            'Bookmarks previously imported show an "Already synced" tag. They\'re skipped if you re-select them.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/bookmarks$/,
    help: {
      title: 'Ravelry bookmarks',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Browse your bookmarks',
          body:
            'Cards load on scroll. Each shows title, designer, and a Ravelry link.',
        },
        {
          heading: 'Sync button',
          body:
            'Tap **Sync to patterns** to jump to the selection page (`/ravelry/bookmarks/sync`) where you can pick which bookmarks to import as Rowly patterns.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/stash\/sync$/,
    help: {
      title: 'Sync Ravelry stash',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Preview your Ravelry stash',
          body:
            'Every stash entry is listed with brand, colorway, weight, and remaining yardage.',
        },
        {
          heading: 'Import all button',
          body:
            '1. Tap **Import all**.\n2. Rowly matches by Ravelry stash ID — existing entries are updated, new ones created. No duplicates.\n3. Progress + counts shown at the end.',
        },
        {
          heading: 'Selective import',
          body:
            'Uncheck any entry you don\'t want to import before tapping the button.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/projects\/sync$/,
    help: {
      title: 'Sync Ravelry projects',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Preview Ravelry projects',
          body:
            'Cards show project name, linked pattern, yarn used, dates, and status.',
        },
        {
          heading: 'Import button',
          body:
            '1. Tap **Import selected** (or individual card buttons).\n2. Each becomes a Rowly project. Patterns already in your library stay linked; new patterns get stub entries.\n3. Wait for the import to complete. Counts shown.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/favorites\/yarns\/sync$/,
    help: {
      title: 'Sync favourite yarns',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Select + import',
          body:
            '1. Tap checkboxes on yarn cards you want to import.\n2. Tap **Import selected**.\n3. Yarns come in as **reference entries** — NOT counted in your stash inventory. Useful for "I want to try this yarn someday".',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/favorites$/,
    help: {
      title: 'Ravelry favourites',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Browse favourites',
          body:
            'Cards load on scroll. Filtered by type (patterns / yarns / projects). Use the tabs at the top to switch.',
        },
        {
          heading: 'Sync button',
          body:
            'Tap **Sync to patterns** to jump to the selection page where you choose which to import.',
        },
      ],
    },
  },
  {
    pattern: /^\/ravelry\/sync$/,
    help: {
      title: 'Ravelry sync',
      tagline: 'Every tool on this page, step by step.',
      sections: [
        {
          heading: 'Connect Ravelry',
          body:
            'If you see "Not connected", tap **Connect Ravelry**. You\'ll be bounced to Ravelry to authorise. Back in Rowly, the other buttons become active.',
        },
        {
          heading: 'Sync Bookmarks tile',
          body:
            'Tap → opens `/ravelry/bookmarks/sync` where you pick which bookmarks to import as Rowly patterns.',
        },
        {
          heading: 'Sync Favourites tile',
          body:
            'Tap → opens the favourites page with pattern/yarn tabs.',
        },
        {
          heading: 'Sync Stash tile',
          body:
            'Tap → imports your Ravelry stash into your Rowly yarn inventory. Matches by Ravelry stash ID so re-syncing updates rather than duplicates.',
        },
        {
          heading: 'Sync Projects tile',
          body:
            'Tap → imports Ravelry projects as Rowly projects. Pattern links preserved where possible.',
        },
        {
          heading: 'Disconnect',
          body:
            'Go to **Profile → Ravelry** and tap **Disconnect** to revoke access. Sync pages stop working until you reconnect.',
          tip: 'Rowly\'s Ravelry sync is read-only. Nothing is written back to your Ravelry account.',
        },
      ],
    },
  },
  // =========================================================================
  // Help index
  // =========================================================================
  {
    pattern: /^\/help$/,
    help: {
      title: 'Help',
      tagline: 'Where to find what.',
      sections: [
        {
          heading: 'Page-specific help (this ? button)',
          body:
            'Every authenticated page has a floating **?** button in the bottom-right. Tap it to see a step-by-step how-to for every tool on that page. Start there.',
        },
        {
          heading: 'This help index',
          body:
            'The /help route has general onboarding content, FAQs, and the feedback link. For "how do I do X on this specific page?", use the ? button on that page instead.',
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
