import { Request, Response } from 'express';
import db from '../config/database';

/**
 * Stats Response Types
 */
interface StatsResponse {
  totalCompleted: number;
  totalRows: number;
  totalSeconds: number;
  currentStreak: number;
  longestStreak: number;
  activityData: Array<{ date: string; rows: number }>;
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    rows_completed: number;
    total_seconds: number;
    updated_at: string;
  }>;
}

/**
 * Get filter date based on time period
 */
function getFilterDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'today':
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return today;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo;
    case 'all':
    default:
      return new Date(0); // Beginning of time
  }
}

/**
 * Get total completed projects
 */
async function getTotalCompletedProjects(userId: string, filterDate: Date): Promise<number> {
  const result = await db('projects')
    .where({ user_id: userId, status: 'completed' })
    .whereNull('deleted_at')
    .where('completed_at', '>=', filterDate)
    .count('* as count')
    .first();

  return Number(result?.count || 0);
}

/**
 * Get total rows knitted from counter history
 */
async function getTotalRowsKnitted(userId: string, filterDate: Date): Promise<number> {
  const result = await db('counter_history as ch')
    .join('counters as c', 'c.id', 'ch.counter_id')
    .join('projects as p', 'p.id', 'c.project_id')
    .where('p.user_id', userId)
    .whereNull('p.deleted_at')
    .where('ch.created_at', '>=', filterDate)
    .whereRaw('ch.new_value > ch.old_value') // Only count increments
    .sum(db.raw('ch.new_value - ch.old_value') as any)
    .first();

  // The result key varies by database driver
  const sum = result?.sum || result?.['sum(`ch`.`new_value` - `ch`.`old_value`)'] || 0;
  return Number(sum) || 0;
}

/**
 * Get total knitting time in seconds
 */
async function getTotalKnittingTime(userId: string, filterDate: Date): Promise<number> {
  const result = await db('knitting_sessions as ks')
    .join('projects as p', 'p.id', 'ks.project_id')
    .where('p.user_id', userId)
    .whereNull('p.deleted_at')
    .where('ks.start_time', '>=', filterDate)
    .whereNotNull('ks.duration_seconds')
    .sum('ks.duration_seconds as total')
    .first();

  return Number(result?.total || 0);
}

/**
 * Calculate current streak (consecutive days with sessions)
 */
async function getCurrentStreak(userId: string): Promise<number> {
  // Get all unique session dates for the user, ordered descending
  const sessions = await db('knitting_sessions as ks')
    .join('projects as p', 'p.id', 'ks.project_id')
    .where('p.user_id', userId)
    .whereNull('p.deleted_at')
    .whereNotNull('ks.end_time')
    .select(db.raw('DATE(ks.start_time) as session_date'))
    .groupBy(db.raw('DATE(ks.start_time)'))
    .orderBy('session_date', 'desc');

  if (sessions.length === 0) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Convert session dates to Date objects for comparison
  const sessionDates = sessions.map(s => {
    const d = new Date(s.session_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  // Check if the streak is still active (either today or yesterday has a session)
  const todayTime = today.getTime();
  const yesterdayTime = yesterday.getTime();

  if (!sessionDates.includes(todayTime) && !sessionDates.includes(yesterdayTime)) {
    return 0; // Streak is broken
  }

  // Count consecutive days
  let streak = 0;
  let checkDate = sessionDates.includes(todayTime) ? todayTime : yesterdayTime;

  for (const sessionDate of sessionDates) {
    if (sessionDate === checkDate) {
      streak++;
      checkDate -= 24 * 60 * 60 * 1000; // Move to previous day
    } else if (sessionDate < checkDate) {
      break; // Gap found, streak ends
    }
  }

  return streak;
}

/**
 * Calculate longest streak ever
 */
async function getLongestStreak(userId: string): Promise<number> {
  const sessions = await db('knitting_sessions as ks')
    .join('projects as p', 'p.id', 'ks.project_id')
    .where('p.user_id', userId)
    .whereNull('p.deleted_at')
    .whereNotNull('ks.end_time')
    .select(db.raw('DATE(ks.start_time) as session_date'))
    .groupBy(db.raw('DATE(ks.start_time)'))
    .orderBy('session_date', 'asc');

  if (sessions.length === 0) {
    return 0;
  }

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sessions.length; i++) {
    const prevDate = new Date(sessions[i - 1].session_date);
    const currDate = new Date(sessions[i].session_date);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
}

/**
 * Get activity graph data (rows per day)
 */
async function getActivityGraphData(
  userId: string,
  filterDate: Date
): Promise<Array<{ date: string; rows: number }>> {
  const result = await db('counter_history as ch')
    .join('counters as c', 'c.id', 'ch.counter_id')
    .join('projects as p', 'p.id', 'c.project_id')
    .where('p.user_id', userId)
    .whereNull('p.deleted_at')
    .where('ch.created_at', '>=', filterDate)
    .whereRaw('ch.new_value > ch.old_value')
    .select(db.raw('DATE(ch.created_at) as date'))
    .sum(db.raw('ch.new_value - ch.old_value as rows'))
    .groupBy(db.raw('DATE(ch.created_at)'))
    .orderBy('date', 'asc');

  return result.map(r => ({
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
    rows: Number(r.rows) || 0
  }));
}

/**
 * Get recent projects with stats
 */
async function getRecentProjectsStats(userId: string): Promise<StatsResponse['recentProjects']> {
  // First get the 5 most recent projects
  const projects = await db('projects')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select('id', 'name', 'status', 'updated_at')
    .orderBy('updated_at', 'desc')
    .limit(5);

  // Then get stats for each project
  const projectsWithStats = await Promise.all(
    projects.map(async (project) => {
      // Get rows completed
      const rowsResult = await db('counter_history as ch')
        .join('counters as c', 'c.id', 'ch.counter_id')
        .where('c.project_id', project.id)
        .whereRaw('ch.new_value > ch.old_value')
        .sum(db.raw('ch.new_value - ch.old_value as rows'))
        .first();

      // Get time spent
      const timeResult = await db('knitting_sessions')
        .where({ project_id: project.id })
        .whereNotNull('duration_seconds')
        .sum('duration_seconds as total')
        .first();

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        rows_completed: Number(rowsResult?.rows || 0),
        total_seconds: Number(timeResult?.total || 0),
        updated_at: project.updated_at
      };
    })
  );

  return projectsWithStats;
}

/**
 * GET /api/stats
 * Get user knitting statistics
 */
export async function getStats(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const period = (req.query.period as string) || 'week';

  const filterDate = getFilterDate(period);

  try {
    const [
      totalCompleted,
      totalRows,
      totalSeconds,
      currentStreak,
      longestStreak,
      activityData,
      recentProjects
    ] = await Promise.all([
      getTotalCompletedProjects(userId, filterDate),
      getTotalRowsKnitted(userId, filterDate),
      getTotalKnittingTime(userId, filterDate),
      getCurrentStreak(userId),
      getLongestStreak(userId),
      getActivityGraphData(userId, filterDate),
      getRecentProjectsStats(userId)
    ]);

    const stats: StatsResponse = {
      totalCompleted,
      totalRows,
      totalSeconds,
      currentStreak,
      longestStreak,
      activityData,
      recentProjects
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
}

/**
 * GET /api/stats/summary
 * Get a quick summary of key stats (for dashboard widgets)
 */
export async function getStatsSummary(req: Request, res: Response) {
  const userId = (req as any).user.userId;

  try {
    const [
      currentStreak,
      totalRowsAllTime,
      totalTimeAllTime
    ] = await Promise.all([
      getCurrentStreak(userId),
      getTotalRowsKnitted(userId, new Date(0)),
      getTotalKnittingTime(userId, new Date(0))
    ]);

    // Get active projects count
    const activeResult = await db('projects')
      .where({ user_id: userId, status: 'active' })
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    res.json({
      success: true,
      data: {
        summary: {
          currentStreak,
          totalRows: totalRowsAllTime,
          totalSeconds: totalTimeAllTime,
          activeProjects: Number(activeResult?.count || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics summary'
    });
  }
}
