/**
 * Pattern Analysis Service
 * Analyzes pattern text to suggest optimal marker placements
 */

export interface MarkerSuggestion {
  type: 'counter_value' | 'row_range' | 'row_interval';
  name: string;
  start_row: number;
  end_row?: number;
  repeat_interval?: number;
  message: string;
  confidence: number; // 0-1
  reason: string;
}

interface AnalysisResult {
  suggestions: MarkerSuggestion[];
  patterns_found: string[];
  analysis_summary: string;
}

/**
 * Analyze pattern text and suggest markers
 */
export const analyzePatternForMarkers = (
  patternText: string
): AnalysisResult => {
  const suggestions: MarkerSuggestion[] = [];
  const patternsFound: string[] = [];

  if (!patternText || patternText.trim().length < 10) {
    return {
      suggestions: [],
      patterns_found: [],
      analysis_summary: 'Pattern too short to analyze',
    };
  }

  // Pattern 1: "at the same time" phrases - simultaneous instructions
  const atSameTimeRegex = /(?:at the same time|simultaneously|while working|meanwhile)[,:]?\s*(.{10,150})/gi;
  let match;

  while ((match = atSameTimeRegex.exec(patternText)) !== null) {
    const instruction = match[1].trim();

    // Try to extract row numbers from surrounding context
    const context = patternText.substring(
      Math.max(0, match.index - 100),
      Math.min(patternText.length, match.index + 200)
    );

    const rowRangeMatch = context.match(/rows?\s*(\d+)\s*(?:[-–to]+|through)\s*(\d+)/i);
    const singleRowMatch = context.match(/(?:on|at|from)\s*rows?\s*(\d+)/i);

    if (rowRangeMatch) {
      const startRow = parseInt(rowRangeMatch[1]);
      const endRow = parseInt(rowRangeMatch[2]);

      suggestions.push({
        type: 'row_range',
        name: 'Simultaneous Instruction',
        start_row: startRow,
        end_row: endRow,
        message: `Remember: ${instruction.substring(0, 80)}${instruction.length > 80 ? '...' : ''}`,
        confidence: 0.9,
        reason: 'Found "at the same time" instruction spanning rows',
      });
      patternsFound.push('simultaneous_instruction');
    } else if (singleRowMatch) {
      suggestions.push({
        type: 'counter_value',
        name: 'Simultaneous Instruction',
        start_row: parseInt(singleRowMatch[1]),
        message: `Remember: ${instruction.substring(0, 80)}${instruction.length > 80 ? '...' : ''}`,
        confidence: 0.85,
        reason: 'Found "at the same time" instruction',
      });
      patternsFound.push('simultaneous_instruction');
    }
  }

  // Pattern 2: "every N rows" repeating instructions
  const everyNRowsRegex = /(?:every|each)\s+(\d+)(?:th|st|nd|rd)?\s*rows?/gi;

  while ((match = everyNRowsRegex.exec(patternText)) !== null) {
    const interval = parseInt(match[1]);

    // Look for what action to perform
    const context = patternText.substring(
      Math.max(0, match.index - 80),
      Math.min(patternText.length, match.index + 120)
    );

    // Detect action type
    const actionPatterns = [
      { regex: /decrease/i, action: 'decrease', name: 'Decrease Reminder' },
      { regex: /increase/i, action: 'increase', name: 'Increase Reminder' },
      { regex: /cable/i, action: 'cable', name: 'Cable Row' },
      { regex: /twist/i, action: 'twist', name: 'Twist Row' },
      { regex: /change\s*color/i, action: 'change color', name: 'Color Change' },
      { regex: /repeat/i, action: 'repeat pattern', name: 'Pattern Repeat' },
      { regex: /yarn\s*over/i, action: 'yarn over', name: 'YO Row' },
    ];

    let actionFound = false;
    for (const ap of actionPatterns) {
      if (ap.regex.test(context)) {
        suggestions.push({
          type: 'row_interval',
          name: ap.name,
          start_row: interval,
          repeat_interval: interval,
          message: `Time to ${ap.action}`,
          confidence: 0.85,
          reason: `Found "every ${interval} rows" instruction for ${ap.action}`,
        });
        patternsFound.push(`interval_${ap.action}`);
        actionFound = true;
        break;
      }
    }

    if (!actionFound) {
      suggestions.push({
        type: 'row_interval',
        name: `Every ${interval} rows reminder`,
        start_row: interval,
        repeat_interval: interval,
        message: `Check pattern - action every ${interval} rows`,
        confidence: 0.7,
        reason: `Found "every ${interval} rows" instruction`,
      });
      patternsFound.push('interval_generic');
    }
  }

  // Pattern 3: Specific row instructions "on row N" or "at row N"
  const onRowRegex = /(?:on|at|from|starting\s*(?:at|on)?)\s*rows?\s*(\d+)/gi;

  while ((match = onRowRegex.exec(patternText)) !== null) {
    const rowNum = parseInt(match[1]);

    const context = patternText.substring(
      Math.max(0, match.index - 40),
      Math.min(patternText.length, match.index + 100)
    );

    // Skip if already captured by another pattern
    if (suggestions.some(s => s.start_row === rowNum && s.confidence > 0.8)) {
      continue;
    }

    // Extract action from context
    const actionMatch = context.match(/(begin|start|cast\s*off|bind\s*off|shape|decrease|increase|join|switch)/i);
    const action = actionMatch ? actionMatch[1] : 'special instruction';

    suggestions.push({
      type: 'counter_value',
      name: `Row ${rowNum}: ${action}`,
      start_row: rowNum,
      message: `Check pattern for row ${rowNum}: ${action}`,
      confidence: 0.8,
      reason: 'Found specific row instruction',
    });
    patternsFound.push('specific_row');
  }

  // Pattern 4: Shaping instructions
  const shapingRegex = /(decrease|increase|bind\s*off|cast\s*on|shape)\s+(?:for\s+)?(armhole|neckline|sleeve|shoulder|waist|bust|hip)s?/gi;

  while ((match = shapingRegex.exec(patternText)) !== null) {
    const action = match[1].toLowerCase();
    const location = match[2].toLowerCase();

    // Look for row number in context
    const context = patternText.substring(
      Math.max(0, match.index - 50),
      Math.min(patternText.length, match.index + 100)
    );

    const rowMatch = context.match(/rows?\s*(\d+)/i);
    const startRow = rowMatch ? parseInt(rowMatch[1]) : 1;

    // Avoid duplicate suggestions
    if (suggestions.some(s => s.name.includes(location) && Math.abs(s.start_row - startRow) < 5)) {
      continue;
    }

    suggestions.push({
      type: 'counter_value',
      name: `${capitalize(location)} shaping`,
      start_row: startRow,
      message: `${capitalize(action)} for ${location}`,
      confidence: 0.75,
      reason: `Found ${location} shaping instruction`,
    });
    patternsFound.push(`shaping_${location}`);
  }

  // Pattern 5: "until piece measures" - length markers
  const measureRegex = /until\s+(?:piece\s+)?measures?\s+(\d+(?:\.\d+)?)\s*(inches?|cm|centimeters?|")/gi;

  while ((match = measureRegex.exec(patternText)) !== null) {
    const measurement = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    // Estimate row number (rough: ~5 rows per inch for worsted)
    const estimatedRow = unit.includes('cm') ? Math.round(measurement * 2) : Math.round(measurement * 5);

    suggestions.push({
      type: 'counter_value',
      name: `Length check: ${measurement} ${unit}`,
      start_row: estimatedRow,
      message: `Check if piece measures ${measurement} ${unit}`,
      confidence: 0.6,
      reason: 'Found length measurement instruction (row estimate may vary)',
    });
    patternsFound.push('length_check');
  }

  // Pattern 6: Color/yarn changes
  const colorChangeRegex = /(?:change\s*to|switch\s*to|join|using)\s+(color\s*[a-z]|yarn\s*[a-z]|[A-Z]{2,}|new\s*yarn)/gi;

  while ((match = colorChangeRegex.exec(patternText)) !== null) {
    const colorYarn = match[1];

    const context = patternText.substring(
      Math.max(0, match.index - 40),
      Math.min(patternText.length, match.index + 60)
    );

    const rowMatch = context.match(/rows?\s*(\d+)/i);
    const startRow = rowMatch ? parseInt(rowMatch[1]) : 1;

    suggestions.push({
      type: 'counter_value',
      name: `Color/Yarn change`,
      start_row: startRow,
      message: `Change to ${colorYarn}`,
      confidence: 0.7,
      reason: 'Found color or yarn change instruction',
    });
    patternsFound.push('color_change');
  }

  // Remove duplicates and sort by row number, then confidence
  const uniqueSuggestions = suggestions.filter(
    (s, idx, arr) =>
      arr.findIndex(
        (s2) => s2.start_row === s.start_row && s2.name === s.name
      ) === idx
  );

  const sortedSuggestions = uniqueSuggestions.sort((a, b) => {
    if (a.start_row !== b.start_row) return a.start_row - b.start_row;
    return b.confidence - a.confidence;
  });

  // Generate summary
  const uniquePatterns = [...new Set(patternsFound)];
  let summary = `Found ${sortedSuggestions.length} potential markers. `;
  if (uniquePatterns.length > 0) {
    summary += `Detected patterns: ${uniquePatterns.slice(0, 3).join(', ')}`;
    if (uniquePatterns.length > 3) {
      summary += ` and ${uniquePatterns.length - 3} more`;
    }
  }

  return {
    suggestions: sortedSuggestions,
    patterns_found: uniquePatterns,
    analysis_summary: summary,
  };
};

/**
 * Get marker analytics for a project
 */
export interface MarkerAnalytics {
  total_markers: number;
  active_markers: number;
  completed_markers: number;
  total_triggers: number;
  total_snoozes: number;
  total_acknowledgements: number;
  average_snooze_rate: number;
  ai_suggested_count: number;
  most_effective_marker: { name: string; id: string } | null;
  markers_by_type: Record<string, number>;
}

export const calculateMarkerAnalytics = (
  markers: Array<{
    id: string;
    name: string;
    status: string;
    times_triggered: number;
    times_snoozed: number;
    times_acknowledged: number;
    suggested_by_ai: boolean;
    trigger_type: string;
  }>
): MarkerAnalytics => {
  const totalMarkers = markers.length;
  const activeMarkers = markers.filter((m) => m.status === 'active').length;
  const completedMarkers = markers.filter((m) => m.status === 'completed').length;

  const totalTriggers = markers.reduce((sum, m) => sum + (m.times_triggered || 0), 0);
  const totalSnoozes = markers.reduce((sum, m) => sum + (m.times_snoozed || 0), 0);
  const totalAcknowledgements = markers.reduce((sum, m) => sum + (m.times_acknowledged || 0), 0);

  const averageSnoozeRate = totalTriggers > 0 ? totalSnoozes / totalTriggers : 0;

  const aiSuggestedCount = markers.filter((m) => m.suggested_by_ai).length;

  // Find most effective marker (highest acknowledgement rate)
  let mostEffectiveMarker: { name: string; id: string } | null = null;
  let highestEffectiveness = 0;

  for (const marker of markers) {
    if (marker.times_triggered > 0) {
      const effectiveness = marker.times_acknowledged / marker.times_triggered;
      if (effectiveness > highestEffectiveness) {
        highestEffectiveness = effectiveness;
        mostEffectiveMarker = { name: marker.name, id: marker.id };
      }
    }
  }

  // Count markers by type
  const markersByType: Record<string, number> = {};
  for (const marker of markers) {
    const type = marker.trigger_type || 'unknown';
    markersByType[type] = (markersByType[type] || 0) + 1;
  }

  return {
    total_markers: totalMarkers,
    active_markers: activeMarkers,
    completed_markers: completedMarkers,
    total_triggers: totalTriggers,
    total_snoozes: totalSnoozes,
    total_acknowledgements: totalAcknowledgements,
    average_snooze_rate: Math.round(averageSnoozeRate * 100) / 100,
    ai_suggested_count: aiSuggestedCount,
    most_effective_marker: mostEffectiveMarker,
    markers_by_type: markersByType,
  };
};

/**
 * Generate timeline data for markers
 */
export interface TimelineMarker {
  id: string;
  name: string;
  row_position: number;
  type: string;
  color: string;
  status: 'upcoming' | 'active' | 'completed';
  message?: string;
}

export const generateMarkerTimeline = (
  markers: Array<{
    id: string;
    name: string;
    trigger_type: string;
    trigger_value: number;
    end_value?: number;
    repeat_interval?: number;
    marker_color: string;
    status: string;
    message?: string;
  }>,
  currentRow: number,
  projectLength: number
): TimelineMarker[] => {
  const timeline: TimelineMarker[] = [];

  for (const marker of markers) {
    // Determine status based on current position
    let status: 'upcoming' | 'active' | 'completed';

    if (marker.status === 'completed') {
      status = 'completed';
    } else if (marker.trigger_value <= currentRow) {
      if (marker.end_value && marker.end_value >= currentRow) {
        status = 'active';
      } else if (!marker.end_value) {
        status = marker.trigger_value === currentRow ? 'active' : 'completed';
      } else {
        status = 'completed';
      }
    } else {
      status = 'upcoming';
    }

    // Add main marker
    timeline.push({
      id: marker.id,
      name: marker.name,
      row_position: marker.trigger_value,
      type: marker.trigger_type,
      color: marker.marker_color || 'blue',
      status,
      message: marker.message,
    });

    // For interval markers, add repeated instances
    if (marker.repeat_interval && marker.repeat_interval > 0) {
      let repeatRow = marker.trigger_value + marker.repeat_interval;
      let repeatCount = 0;
      const maxRepeats = 20; // Limit repeats shown

      while (repeatRow <= projectLength && repeatCount < maxRepeats) {
        const repeatStatus: 'upcoming' | 'active' | 'completed' =
          repeatRow < currentRow ? 'completed' :
          repeatRow === currentRow ? 'active' : 'upcoming';

        timeline.push({
          id: `${marker.id}-repeat-${repeatCount}`,
          name: `${marker.name} (repeat)`,
          row_position: repeatRow,
          type: marker.trigger_type,
          color: marker.marker_color || 'blue',
          status: repeatStatus,
          message: marker.message,
        });

        repeatRow += marker.repeat_interval;
        repeatCount++;
      }
    }
  }

  // Sort by row position
  return timeline.sort((a, b) => a.row_position - b.row_position);
};

// Utility function
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default {
  analyzePatternForMarkers,
  calculateMarkerAnalytics,
  generateMarkerTimeline,
};
