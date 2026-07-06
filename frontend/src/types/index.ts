export interface User {
  id: number
  email: string
  name: string
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface UrlRecord {
  id: number
  shortCode: string
  originalUrl: string
  shortUrl: string
  userId: number
  createdAt: string
}

export interface UrlWithClicks extends UrlRecord {
  clicks: number
}

export interface DashboardSummary {
  totalUrls: number
  totalClicks: number
  topUrl: {
    shortCode: string
    originalUrl: string
    shortUrl: string
    clicks: number
  } | null
}

export interface DashboardData {
  summary: DashboardSummary
  trends: {
    clicksThisWeek: number
    clicksLastWeek: number
    changePercent: number | null
    clicksByDay: { date: string; clicks: number }[]
    urlsCreatedByWeek: { week: string; urlsCreated: number }[]
  }
}
