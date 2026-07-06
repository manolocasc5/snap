import type Database from "better-sqlite3";

export interface ClickRecord {
  readonly id: number;
  readonly urlId: number;
  readonly clickedAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly referer: string | null;
}

export interface ClickStats {
  readonly totalClicks: number;
  readonly clicksByDay: Array<{ date: string; clicks: number }>;
  readonly topReferers: Array<{ referer: string | null; clicks: number }>;
}

export interface TopUrl {
  readonly urlId: number;
  readonly shortCode: string;
  readonly originalUrl: string;
  readonly totalClicks: number;
}

interface ClickRow {
  id: number;
  url_id: number;
  clicked_at: string;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
}

export function insertClick(
  db: Database.Database,
  urlId: number,
  ipAddress: string | null,
  userAgent: string | null,
  referer: string | null,
): void {
  db.prepare("INSERT INTO clicks (url_id, ip_address, user_agent, referer) VALUES (?, ?, ?, ?)").run(
    urlId,
    ipAddress,
    userAgent,
    referer,
  );
}

export function getUrlClickStats(db: Database.Database, urlId: number): ClickStats {
  const totalRow = db
    .prepare<[number], { total: number }>("SELECT COUNT(*) AS total FROM clicks WHERE url_id = ?")
    .get(urlId);

  const clicksByDay = db
    .prepare<[number], { date: string; clicks: number }>(
      `SELECT date(clicked_at) AS date, COUNT(*) AS clicks
       FROM clicks WHERE url_id = ?
       GROUP BY date(clicked_at)
       ORDER BY date DESC
       LIMIT 30`,
    )
    .all(urlId);

  const topReferers = db
    .prepare<[number], { referer: string | null; clicks: number }>(
      `SELECT referer, COUNT(*) AS clicks
       FROM clicks WHERE url_id = ?
       GROUP BY referer
       ORDER BY clicks DESC
       LIMIT 10`,
    )
    .all(urlId);

  return {
    totalClicks: totalRow?.total ?? 0,
    clicksByDay,
    topReferers,
  };
}

export function getTopUrls(db: Database.Database, limit = 10): TopUrl[] {
  return db
    .prepare<[number], { url_id: number; short_code: string; original_url: string; total_clicks: number }>(
      `SELECT u.id AS url_id, u.short_code, u.original_url, COUNT(c.id) AS total_clicks
       FROM urls u LEFT JOIN clicks c ON c.url_id = u.id
       GROUP BY u.id
       ORDER BY total_clicks DESC
       LIMIT ?`,
    )
    .all(limit)
    .map((row) => ({
      urlId: row.url_id,
      shortCode: row.short_code,
      originalUrl: row.original_url,
      totalClicks: row.total_clicks,
    }));
}