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

  // 1주일 이내 생성된 미확인 공지사항이 있는지 확인
  async hasUnreadAnnouncementsWithinWeek(): Promise<boolean> {
    try {
      console.log('🔍 hasUnreadAnnouncementsWithinWeek() 호출됨')
      const user = authService.getCurrentUser()
      if (!user) {
        console.log('⚠️ 사용자가 로그인하지 않았습니다.')
        return false
      }

      // localStorage 사용자 ID를 Supabase UUID로 변환
      let supabaseUserId: string
      try {
        supabaseUserId = await this.getSupabaseUserId(user.id)
        console.log('✅ 사용자 ID 변환 완료:', supabaseUserId)
      } catch (error) {
        console.error('❌ 사용자 ID 변환 실패:', error)
        return false
      }

      // 1주일 전 날짜 계산
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const oneWeekAgoISO = oneWeekAgo.toISOString()
      console.log('📅 1주일 전 날짜:', oneWeekAgoISO)

      // 1주일 이내 생성된 활성 공지사항 조회
      const { data: announcements, error: announcementsError } = await supabase
        .from('announcements')
        .select('id')
        .eq('is_active', true)
        .gte('created_at', oneWeekAgoISO)

      if (announcementsError) {
        console.error('❌ 공지사항 조회 실패:', announcementsError)
        return false
      }

      console.log('📋 1주일 이내 공지사항 개수:', announcements?.length || 0)

      if (!announcements || announcements.length === 0) {
        console.log('📋 1주일 이내 공지사항이 없습니다.')
        return false
      }

      // 읽음 상태 조회
      const announcementIds = announcements.map(a => a.id)
      const { data: readData } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', supabaseUserId)
        .in('announcement_id', announcementIds)

      const readIds = new Set(readData?.map((read: any) => read.announcement_id) || [])
      console.log('✅ 읽은 공지사항 ID:', Array.from(readIds))
      
      // 읽지 않은 공지사항이 있는지 확인
      const unreadAnnouncements = announcements.filter(a => !readIds.has(a.id))
      const hasUnread = unreadAnnouncements.length > 0
      console.log('📢 읽지 않은 공지사항 개수:', unreadAnnouncements.length, hasUnread ? '(New 표시 필요)' : '(New 표시 불필요)')
      
      return hasUnread
    } catch (error) {
      console.error('❌ 1주일 이내 미확인 공지사항 확인 중 오류:', error)
      return false
    }
  }
}

export const announcementService = new AnnouncementService()

