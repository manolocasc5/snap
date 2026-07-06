import { apiRequest } from './client'
import type { UrlRecord, UrlWithClicks } from '../types'

export function getMyUrls(): Promise<UrlWithClicks[]> {
  return apiRequest<UrlWithClicks[]>('/urls/mine')
}

export function createUrl(url: string, alias?: string): Promise<UrlRecord> {
  return apiRequest<UrlRecord>('/urls', {
    method: 'POST',
    body: JSON.stringify({ url, alias: alias || undefined }),
  })
}

export function deleteUrl(id: number): Promise<void> {
  return apiRequest<void>(`/urls/${id}`, { method: 'DELETE' })
}
