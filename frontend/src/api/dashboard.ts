import { apiRequest } from './client'
import type { DashboardData } from '../types'

export function getDashboard(): Promise<DashboardData> {
  return apiRequest<DashboardData>('/dashboard')
}
