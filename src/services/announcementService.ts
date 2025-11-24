/**
 * 공지사항 서비스
 * 공지사항 조회, 읽음 처리 등
 */

import { supabase } from './supabaseClient'
import { authService } from './authService'

export interface Announcement {
  id: string
  title: string
  content: string
  createdBy: string
  createdAt: number
  updatedAt: number
  isActive: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent'
  isRead?: boolean // 사용자별 읽음 여부
  readAt?: number // 읽은 시간
}

class AnnouncementService {
  // localStorage 사용자 ID를 Supabase UUID로 변환하는 헬퍼 함수
  private async getSupabaseUserId(localStorageUserId: string): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(localStorageUserId)) {
      return localStorageUserId
    }

    const userStr = localStorage.getItem(`user_${localStorageUserId}`)
    if (!userStr) {
      throw new Error('사용자 정보를 찾을 수 없습니다.')
    }

    const user = JSON.parse(userStr)
    if (!user.email) {
      throw new Error('사용자 이메일 정보가 없습니다.')
    }

    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userError || !supabaseUser) {
      throw new Error('Supabase에 사용자가 등록되어 있지 않습니다.')
    }

    return supabaseUser.id
  }

  // 모든 활성화된 공지사항 조회 (사용자용, 페이지네이션 지원)
  async getActiveAnnouncements(limit: number = 10, offset: number = 0): Promise<{ data: Announcement[]; hasMore: boolean; total?: number }> {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        return { data: [], hasMore: false }
      }

      // localStorage 사용자 ID를 Supabase UUID로 변환
      let supabaseUserId: string
      try {
        supabaseUserId = await this.getSupabaseUserId(user.id)
      } catch (error) {
        console.error('사용자 ID 변환 실패:', error)
        return { data: [], hasMore: false }
      }

      const { data, error, count } = await supabase
        .from('announcements')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('공지사항 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      // 읽음 상태 조회
      const { data: readData } = await supabase
        .from('announcement_reads')
        .select('announcement_id, read_at')
        .eq('user_id', supabaseUserId)

      const readMap = new Map<string, number>()
      readData?.forEach((read: any) => {
        readMap.set(read.announcement_id, new Date(read.read_at).getTime())
      })

      const announcements = (data || []).map((announcement: any) => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        createdBy: announcement.created_by,
        createdAt: new Date(announcement.created_at).getTime(),
        updatedAt: new Date(announcement.updated_at).getTime(),
        isActive: announcement.is_active !== false,
        priority: announcement.priority || 'normal',
        isRead: readMap.has(announcement.id),
        readAt: readMap.get(announcement.id),
      }))

      const hasMore = count ? offset + limit < count : false
      return { data: announcements, hasMore, total: count || undefined }
    } catch (error) {
      console.error('공지사항 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 공지사항 읽음 처리
  async markAsRead(announcementId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        return { success: false, error: '로그인이 필요합니다.' }
      }

      // localStorage 사용자 ID를 Supabase UUID로 변환
      const supabaseUserId = await this.getSupabaseUserId(user.id)

      const { error } = await supabase
        .from('announcement_reads')
        .upsert({
          announcement_id: announcementId,
          user_id: supabaseUserId,
          read_at: new Date().toISOString(),
        }, {
          onConflict: 'announcement_id,user_id'
        })

      if (error) {
        console.error('공지사항 읽음 처리 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('공지사항 읽음 처리 중 오류:', error)
      return { success: false, error: error.message || '공지사항 읽음 처리 중 오류가 발생했습니다.' }
    }
  }

  // 공지사항 읽음 취소 (삭제)
  async markAsUnread(announcementId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        return { success: false, error: '로그인이 필요합니다.' }
      }

      // localStorage 사용자 ID를 Supabase UUID로 변환
      const supabaseUserId = await this.getSupabaseUserId(user.id)

      const { error } = await supabase
        .from('announcement_reads')
        .delete()
        .eq('announcement_id', announcementId)
        .eq('user_id', supabaseUserId)

      if (error) {
        console.error('공지사항 읽음 취소 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('공지사항 읽음 취소 중 오류:', error)
      return { success: false, error: error.message || '공지사항 읽음 취소 중 오류가 발생했습니다.' }
    }
  }

  // 읽지 않은 공지사항 개수 조회
  async getUnreadCount(): Promise<number> {
    try {
      const result = await this.getActiveAnnouncements(1000, 0) // 충분히 많은 수를 가져와서 필터링
      return result.data.filter(a => !a.isRead).length
    } catch (error) {
      console.error('읽지 않은 공지사항 개수 조회 중 오류:', error)
      return 0
    }
  }
}

export const announcementService = new AnnouncementService()

