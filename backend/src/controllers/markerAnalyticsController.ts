import { Request, Response } from 'express';
import db from '../config/database';
import {
  analyzePatternForMarkers,
  calculateMarkerAnalytics,
  generateMarkerTimeline,
  MarkerSuggestion,
} from '../services/patternAnalysisService';

/**
 * Analyze pattern and suggest markers
 * POST /api/projects/:projectId/analyze-markers
 */
export const analyzeMarkersForProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get pattern text - combine instructions, notes, and pattern content
    let patternText = '';

    // Get pattern if linked
    if (project.pattern_id) {
      const pattern = await db('patterns')
        .where({ id: project.pattern_id })
        .first();
      if (pattern) {
        patternText += (pattern.instructions || '') + '\n';
        patternText += (pattern.notes || '') + '\n';
      }
    }

    // Add project notes
    patternText += (project.notes || '') + '\n';
    patternText += (project.instructions || '');

    if (!patternText.trim()) {
      return res.status(400).json({
        error: 'No pattern text to analyze',
        suggestions: [],
      });
    }

    // Analyze pattern
    const analysis = analyzePatternForMarkers(patternText);

    // Store analysis results
    await db('pattern_analysis')
      .insert({
        project_id: projectId,
        analysis_text: patternText.substring(0, 5000), // Limit stored text
        suggested_markers: JSON.stringify(analysis.suggestions),
      });

    return res.json({
      suggestions: analysis.suggestions,
      patterns_found: analysis.patterns_found,
      summary: analysis.analysis_summary,
    });
  } catch (error) {
    console.error('Error analyzing markers:', error);
    return res.status(500).json({ error: 'Failed to analyze pattern' });
  }
};

/**
 * Accept an AI-suggested marker
 * POST /api/projects/:projectId/accept-marker-suggestion
 */
export const acceptMarkerSuggestion = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { suggestion } = req.body as { suggestion: MarkerSuggestion };
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!suggestion) {
      return res.status(400).json({ error: 'Suggestion is required' });
    }

    // Convert suggestion to marker
    const markerData = {
      project_id: projectId,
      name: suggestion.name,
      trigger_type: suggestion.type,
      trigger_value: suggestion.start_row,
      end_value: suggestion.end_row || null,
      repeat_interval: suggestion.repeat_interval || null,
      message: suggestion.message,
      suggested_by_ai: true,
      marker_color: getColorForType(suggestion.type),
      is_active: true,
      status: 'active',
    };

    const [newMarker] = await db('magic_markers')
      .insert(markerData)
      .returning('*');

    return res.status(201).json(newMarker);
  } catch (error) {
    console.error('Error accepting marker suggestion:', error);
    return res.status(500).json({ error: 'Failed to create marker' });
  }
};

/**
 * Get marker timeline for visualization
 * GET /api/projects/:projectId/marker-timeline
 */
export const getMarkerTimeline = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership and get project details
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all markers for project
    const markers = await db('magic_markers')
      .where({ project_id: projectId })
      .select('*');

    // Get current row from project counter
    const mainCounter = await db('counters')
      .where({ project_id: projectId, is_main: true })
      .first();

    const currentRow = mainCounter?.current_value || 1;

    // Estimate project length (from pattern or default)
    let projectLength = 100; // Default
    if (project.pattern_id) {
      const pattern = await db('patterns')
        .where({ id: project.pattern_id })
        .first();
      if (pattern?.total_rows) {
        projectLength = pattern.total_rows;
      }
    }

    // Generate timeline
    const timeline = generateMarkerTimeline(markers, currentRow, projectLength);

    return res.json({
      project_length: projectLength,
      current_row: currentRow,
      markers: timeline,
    });
  } catch (error) {
    console.error('Error getting marker timeline:', error);
    return res.status(500).json({ error: 'Failed to get timeline' });
  }
};

/**
 * Get marker analytics
 * GET /api/projects/:projectId/marker-analytics
 */
export const getMarkerAnalytics = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all markers with analytics data
    const markers = await db('magic_markers')
      .where({ project_id: projectId })
      .select('*');

    const analytics = calculateMarkerAnalytics(markers);

    return res.json(analytics);
  } catch (error) {
    console.error('Error getting marker analytics:', error);
    return res.status(500).json({ error: 'Failed to get analytics' });
  }
};

/**
 * Record marker event (triggered, snoozed, acknowledged)
 * POST /api/markers/:markerId/event
 */
export const recordMarkerEvent = async (req: Request, res: Response) => {
  try {
    const { markerId } = req.params;
    const { event_type, at_row } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify marker ownership
    const marker = await db('magic_markers')
      .join('projects', 'magic_markers.project_id', 'projects.id')
      .where({ 'magic_markers.id': markerId, 'projects.user_id': userId })
      .select('magic_markers.*')
      .first();

    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }

    const validEvents = ['triggered', 'snoozed', 'acknowledged', 'completed'];
    if (!validEvents.includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // Record event
    await db('marker_events').insert({
      marker_id: markerId,
      event_type,
      at_row: at_row || null,
    });

    // Update marker counters
    const updateData: Record<string, any> = {};
    if (event_type === 'triggered') {
      updateData.times_triggered = db.raw('times_triggered + 1');
    } else if (event_type === 'snoozed') {
      updateData.times_snoozed = db.raw('times_snoozed + 1');
    } else if (event_type === 'acknowledged') {
      updateData.times_acknowledged = db.raw('times_acknowledged + 1');
    } else if (event_type === 'completed') {
      updateData.status = 'completed';
    }

    await db('magic_markers').where({ id: markerId }).update(updateData);

    // Return updated marker
    const updatedMarker = await db('magic_markers')
      .where({ id: markerId })
      .first();

    return res.json(updatedMarker);
  } catch (error) {
    console.error('Error recording marker event:', error);
    return res.status(500).json({ error: 'Failed to record event' });
  }
};

/**
 * Update marker position (for drag-and-drop)
 * PATCH /api/markers/:markerId/position
 */
export const updateMarkerPosition = async (req: Request, res: Response) => {
  try {
    const { markerId } = req.params;
    const { trigger_value, end_value } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify marker ownership
    const marker = await db('magic_markers')
      .join('projects', 'magic_markers.project_id', 'projects.id')
      .where({ 'magic_markers.id': markerId, 'projects.user_id': userId })
      .select('magic_markers.*')
      .first();

    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }

    if (trigger_value === undefined || trigger_value < 1) {
      return res.status(400).json({ error: 'Invalid trigger value' });
    }

    const updateData: Record<string, any> = {
      trigger_value,
    };

    if (end_value !== undefined) {
      updateData.end_value = end_value;
    }

    await db('magic_markers').where({ id: markerId }).update(updateData);

    const updatedMarker = await db('magic_markers')
      .where({ id: markerId })
      .first();

    return res.json(updatedMarker);
  } catch (error) {
    console.error('Error updating marker position:', error);
    return res.status(500).json({ error: 'Failed to update position' });
  }
};

/**
 * Update marker color
 * PATCH /api/markers/:markerId/color
 */
export const updateMarkerColor = async (req: Request, res: Response) => {
  try {
    const { markerId } = req.params;
    const { color } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify marker ownership
    const marker = await db('magic_markers')
      .join('projects', 'magic_markers.project_id', 'projects.id')
      .where({ 'magic_markers.id': markerId, 'projects.user_id': userId })
      .select('magic_markers.*')
      .first();

    if (!marker) {
      return res.status(404).json({ error: 'Marker not found' });
    }

    const validColors = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray'];
    if (!validColors.includes(color)) {
      return res.status(400).json({ error: 'Invalid color' });
    }

    await db('magic_markers').where({ id: markerId }).update({ marker_color: color });

    const updatedMarker = await db('magic_markers')
      .where({ id: markerId })
      .first();

    return res.json(updatedMarker);
  } catch (error) {
    console.error('Error updating marker color:', error);
    return res.status(500).json({ error: 'Failed to update color' });
  }
};

/**
 * Get upcoming markers for a project
 * GET /api/projects/:projectId/upcoming-markers
 */
export const getUpcomingMarkers = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { rows_ahead = 5 } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current row
    const mainCounter = await db('counters')
      .where({ project_id: projectId, is_main: true })
      .first();

    const currentRow = mainCounter?.current_value || 1;
    const lookAheadRows = parseInt(rows_ahead as string) || 5;

    // Get markers that will trigger in the next N rows
    const upcomingMarkers = await db('magic_markers')
      .where({ project_id: projectId, status: 'active' })
      .where('trigger_value', '>', currentRow)
      .where('trigger_value', '<=', currentRow + lookAheadRows)
      .orderBy('trigger_value', 'asc')
      .select('*');

    // Also check interval markers
    const intervalMarkers = await db('magic_markers')
      .where({ project_id: projectId, status: 'active' })
      .whereNotNull('repeat_interval')
      .where('repeat_interval', '>', 0)
      .select('*');

    // Calculate which interval markers will trigger
    const upcomingIntervals = intervalMarkers.filter((marker) => {
      const interval = marker.repeat_interval;
      const start = marker.trigger_value;

      // Find next occurrence after current row
      if (currentRow < start) {
        return start <= currentRow + lookAheadRows;
      }

      const rowsSinceStart = currentRow - start;
      const nextOccurrence = start + (Math.floor(rowsSinceStart / interval) + 1) * interval;
      return nextOccurrence <= currentRow + lookAheadRows;
    });

    // Combine and deduplicate
    const allUpcoming = [...upcomingMarkers];
    for (const marker of upcomingIntervals) {
      if (!allUpcoming.some((m) => m.id === marker.id)) {
        allUpcoming.push(marker);
      }
    }

    return res.json({
      current_row: currentRow,
      look_ahead: lookAheadRows,
      markers: allUpcoming,
      count: allUpcoming.length,
    });
  } catch (error) {
    console.error('Error getting upcoming markers:', error);
    return res.status(500).json({ error: 'Failed to get upcoming markers' });
  }
};

// Helper function to get color based on marker type
function getColorForType(type: string): string {
  switch (type) {
    case 'row_interval':
      return 'purple';
    case 'row_range':
      return 'orange';
    case 'counter_value':
    default:
      return 'blue';
  }
}

export default {
  analyzeMarkersForProject,
  acceptMarkerSuggestion,
  getMarkerTimeline,
  getMarkerAnalytics,
  recordMarkerEvent,
  updateMarkerPosition,
  updateMarkerColor,
  getUpcomingMarkers,
};
