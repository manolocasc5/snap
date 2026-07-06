import type Database from "better-sqlite3";
import { config } from "../config.js";

export interface TopUrlSummary {
  readonly shortCode: string;
  readonly originalUrl: string;
  readonly shortUrl: string;
  readonly clicks: number;
}

export interface DashboardSummary {
  readonly totalUrls: number;
  readonly totalClicks: number;
  readonly topUrl: TopUrlSummary | null;
}

export interface DashboardTrends {
  readonly clicksThisWeek: number;
  readonly clicksLastWeek: number;
  readonly changePercent: number | null;
  readonly clicksByDay: Array<{ date: string; clicks: number }>;
  readonly urlsCreatedByWeek: Array<{ week: string; urlsCreated: number }>;
}

export interface DashboardData {
  readonly summary: DashboardSummary;
  readonly trends: DashboardTrends;
}

function getSummary(db: Database.Database, userId: number): DashboardSummary {
  const { total_urls } = db
    .prepare<[number], { total_urls: number }>("SELECT COUNT(*) AS total_urls FROM urls WHERE user_id = ?")
    .get(userId)!;

  const { total_clicks } = db
    .prepare<[number], { total_clicks: number }>(
      `SELECT COUNT(c.id) AS total_clicks
       FROM clicks c JOIN urls u ON c.url_id = u.id
       WHERE u.user_id = ?`,
    )
    .get(userId)!;

  const topRow = db
    .prepare<[number], { short_code: string; original_url: string; clicks: number } | undefined>(
      `SELECT u.short_code, u.original_url, COUNT(c.id) AS clicks
       FROM urls u LEFT JOIN clicks c ON c.url_id = u.id
       WHERE u.user_id = ?
       GROUP BY u.id ORDER BY clicks DESC LIMIT 1`,
    )
    .get(userId);

  const topUrl =
    topRow != null
      ? {
          shortCode: topRow.short_code,
          originalUrl: topRow.original_url,
          shortUrl: `${config.baseUrl}/${topRow.short_code}`,
          clicks: topRow.clicks,
        }
      : null;

  return { totalUrls: total_urls, totalClicks: total_clicks, topUrl };
}

function getTrends(db: Database.Database, userId: number): DashboardTrends {
  const weekRow = db
    .prepare<[number], { this_week: number; last_week: number }>(
      `SELECT
         SUM(CASE WHEN c.clicked_at >= date('now', '-7 days')  THEN 1 ELSE 0 END) AS this_week,
         SUM(CASE WHEN c.clicked_at >= date('now', '-14 days')
                   AND c.clicked_at <  date('now', '-7 days')  THEN 1 ELSE 0 END) AS last_week
       FROM clicks c JOIN urls u ON c.url_id = u.id
       WHERE u.user_id = ?`,
    )
    .get(userId)!;

  const thisWeek = weekRow.this_week ?? 0;
  const lastWeek = weekRow.last_week ?? 0;
  const changePercent =
    lastWeek === 0 ? null : Math.round(((thisWeek - lastWeek) / lastWeek) * 100 * 10) / 10;

  const clicksByDay = db
    .prepare<[number], { date: string; clicks: number }>(
      `SELECT date(c.clicked_at) AS date, COUNT(*) AS clicks
       FROM clicks c JOIN urls u ON c.url_id = u.id
       WHERE u.user_id = ?
         AND c.clicked_at >= date('now', '-30 days')
       GROUP BY date(c.clicked_at)
       ORDER BY date ASC`,
    )
    .all(userId);

  const urlsCreatedByWeek = db
    .prepare<[number], { week: string; urls_created: number }>(
      `SELECT strftime('%Y-W%W', created_at) AS week, COUNT(*) AS urls_created
       FROM urls
       WHERE user_id = ?
         AND created_at >= date('now', '-28 days')
       GROUP BY week ORDER BY week ASC`,
    )
    .all(userId)
    .map((row) => ({ week: row.week, urlsCreated: row.urls_created }));

  return { clicksThisWeek: thisWeek, clicksLastWeek: lastWeek, changePercent, clicksByDay, urlsCreatedByWeek };
}

export function getUserDashboard(db: Database.Database, userId: number): DashboardData {
  return {
    summary: getSummary(db, userId),
    trends: getTrends(db, userId),
  };
}
