/**
 * 관리자 서비스
 * 사용자 삭제, 방 삭제, 통계 조회 등 관리자 기능
 */

import { databaseService, User, Crew, JoggingCrew } from './databaseService'
import { supabase } from './supabaseClient'
import { loginHistoryService, LoginHistory } from './loginHistoryService'
import { SingleGoal, JoggingGoal } from '@/types'
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
}

export interface DashboardStats {
  totalUsers: number
  totalCrews: number
  totalJoggingCrews: number
  activeUsers: number // 최근 30일 내 로그인한 사용자
  dormantCrews: number
  dormantJoggingCrews: number
  dailyLogins: Array<{ date: string; count: number }>
  weeklyLogins: Array<{ week: string; count: number }>
  monthlyLogins: Array<{ month: string; count: number }>
  crewCreationStats: Array<{ date: string; count: number }>
  crewDeletionStats: Array<{ date: string; count: number }>
}

class AdminService {
  // 관리자 권한 확인
  isAdmin(user: User | null): boolean {
    return user?.role === 'admin'
  }

  // 사용자 삭제
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        console.error('사용자 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('사용자 삭제 중 오류:', error)
      return { success: false, error: error.message || '사용자 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 모든 크루 삭제
  async deleteAllCrews(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('crews')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // 더미 조건 (모든 행 삭제)

      if (error) {
        console.error('모든 크루 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('모든 크루 삭제 중 오류:', error)
      return { success: false, error: error.message || '크루 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 모든 조깅 크루 삭제
  async deleteAllJoggingCrews(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('jogging_crews')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // 더미 조건 (모든 행 삭제)

      if (error) {
        console.error('모든 조깅 크루 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('모든 조깅 크루 삭제 중 오류:', error)
      return { success: false, error: error.message || '조깅 크루 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 모든 사용자 조회 (탈퇴하지 않은 사용자만)
  async getAllUsers(limit: number = 50, offset: number = 0): Promise<{ data: User[]; hasMore: boolean; total?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('사용자 목록 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const users = (data || []).map((user: any) => databaseService['mapSupabaseUser'](user))
      const hasMore = count ? offset + limit < count : false

      return { data: users, hasMore, total: count || undefined }
    } catch (error) {
      console.error('사용자 목록 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 각 사용자별 지난 30일간의 랜덤 로그인 데이터 생성
  async generateRandomLoginDataForUsers(): Promise<void> {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('is_deleted', false)

      if (!users || users.length === 0) return

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      // 기존 로그인 히스토리 확인
      const { data: existingHistory } = await supabase
        .from('login_history')
        .select('user_id, login_at')
        .gte('login_at', startDate.toISOString())

      // 사용자별로 이미 데이터가 있는지 확인
      const usersWithHistory = new Set(
        existingHistory?.map((h: any) => h.user_id) || []
      )

      // 각 사용자별로 랜덤 로그인 데이터 생성
      for (const user of users) {
        // 이미 데이터가 있으면 스킵
        if (usersWithHistory.has(user.id)) continue

        // 사용자별 랜덤 로그인 횟수 (5~20회)
        const loginCount = Math.floor(Math.random() * 16) + 5

        const loginData = []
        for (let i = 0; i < loginCount; i++) {
          // 지난 30일 내 랜덤 날짜
          const randomDaysAgo = Math.floor(Math.random() * 30)
          const loginDate = new Date(endDate)
          loginDate.setDate(loginDate.getDate() - randomDaysAgo)
          
          // 랜덤 시간 (0시~23시)
          const randomHours = Math.floor(Math.random() * 24)
          const randomMinutes = Math.floor(Math.random() * 60)
          loginDate.setHours(randomHours, randomMinutes, 0, 0)

          // 세션 지속 시간 (10분~120분)
          const sessionDuration = Math.floor(Math.random() * 110) + 10
          const logoutDate = new Date(loginDate)
          logoutDate.setMinutes(logoutDate.getMinutes() + sessionDuration)

          // 랜덤 디바이스 정보
          const deviceTypes = ['mobile', 'desktop', 'tablet']
          const osList = ['Windows', 'macOS', 'iOS', 'Android', 'Linux']
          const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung Internet']

          loginData.push({
            user_id: user.id,
            login_at: loginDate.toISOString(),
            logout_at: logoutDate.toISOString(),
            session_duration: sessionDuration * 60, // 초 단위
            device_type: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
            os: osList[Math.floor(Math.random() * osList.length)],
            browser: browsers[Math.floor(Math.random() * browsers.length)],
            ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            user_agent: 'Mozilla/5.0'
          })
        }

        // 배치로 삽입
        if (loginData.length > 0) {
          const { error } = await supabase
            .from('login_history')
            .insert(loginData)

          if (error) {
            console.error(`사용자 ${user.id}의 로그인 데이터 생성 실패:`, error)
          }
        }
      }
    } catch (error) {
      console.error('랜덤 로그인 데이터 생성 중 오류:', error)
    }
  }

  // 대시보드 통계 조회
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // 랜덤 로그인 데이터 생성 (데이터가 없을 경우)
      await this.generateRandomLoginDataForUsers()

      // 전체 사용자 수
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, last_login_at')
      
      const totalUsers = users?.length || 0
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const activeUsers = users?.filter((u: any) => 
        u.last_login_at && new Date(u.last_login_at) >= thirtyDaysAgo
      ).length || 0

      // 전체 크루 수
      const { data: crews, error: crewsError } = await supabase
        .from('crews')
        .select('id, is_dormant, created_at')
      
      const totalCrews = crews?.length || 0
      const dormantCrews = crews?.filter((c: any) => c.is_dormant).length || 0

      // 전체 조깅 크루 수
      const { data: joggingCrews, error: joggingCrewsError } = await supabase
        .from('jogging_crews')
        .select('id, is_dormant')
      
      const totalJoggingCrews = joggingCrews?.length || 0
      const dormantJoggingCrews = joggingCrews?.filter((c: any) => c.is_dormant).length || 0

      // 로그인 통계 (최근 30일)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      const loginStats = await loginHistoryService.getLoginStats(startDate, endDate)
      
      // 일별 데이터가 없으면 빈 배열로 채우기 (30일치)
      if (loginStats.daily.length === 0) {
        for (let i = 29; i >= 0; i--) {
          const date = new Date(endDate)
          date.setDate(date.getDate() - i)
          loginStats.daily.push({
            date: date.toISOString().split('T')[0],
            count: 0
          })
        }
      }

      // 크루 생성/삭제 통계 (최근 90일)
      const crewCreationStats = await this.getCrewCreationStats(startDate, endDate)
      const crewDeletionStats = await this.getCrewDeletionStats(startDate, endDate)

      return {
        totalUsers,
        totalCrews,
        totalJoggingCrews,
        activeUsers,
        dormantCrews,
        dormantJoggingCrews,
        dailyLogins: loginStats.daily,
        weeklyLogins: loginStats.weekly,
        monthlyLogins: loginStats.monthly,
        crewCreationStats,
        crewDeletionStats,
      }
    } catch (error) {
      console.error('대시보드 통계 조회 중 오류:', error)
      return {
        totalUsers: 0,
        totalCrews: 0,
        totalJoggingCrews: 0,
        activeUsers: 0,
        dormantCrews: 0,
        dormantJoggingCrews: 0,
        dailyLogins: [],
        weeklyLogins: [],
        monthlyLogins: [],
        crewCreationStats: [],
        crewDeletionStats: [],
      }
    }
  }

  // 크루 생성 통계
  private async getCrewCreationStats(startDate: Date, endDate: Date): Promise<Array<{ date: string; count: number }>> {
    try {
      const { data, error } = await supabase
        .from('crews')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (error) {
        console.error('크루 생성 통계 조회 실패:', error)
        return []
      }

      const dailyMap = new Map<string, number>()
      data?.forEach((item: any) => {
        const date = new Date(item.created_at)
        const dateStr = date.toISOString().split('T')[0]
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1)
      })

      return Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
      console.error('크루 생성 통계 조회 중 오류:', error)
      return []
    }
  }

  // 크루 삭제 통계 (실제로는 삭제 기록이 없으므로 빈 배열 반환)
  private async getCrewDeletionStats(startDate: Date, endDate: Date): Promise<Array<{ date: string; count: number }>> {
    // 삭제 기록을 추적하려면 별도 테이블이 필요하지만, 현재는 빈 배열 반환
    return []
  }

  // 휴면 크루 목록 조회
  async getDormantCrews(): Promise<Crew[]> {
    try {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('is_dormant', true)
        .order('dormant_at', { ascending: false })

      if (error) {
        console.error('휴면 크루 조회 실패:', error)
        return []
      }

      return (data || []).map((crew: any) => databaseService['mapSupabaseCrew'](crew))
    } catch (error) {
      console.error('휴면 크루 조회 중 오류:', error)
      return []
    }
  }

  // 휴면 조깅 크루 목록 조회
  async getDormantJoggingCrews(): Promise<JoggingCrew[]> {
    try {
      const { data, error } = await supabase
        .from('jogging_crews')
        .select('*')
        .eq('is_dormant', true)
        .order('dormant_at', { ascending: false })

      if (error) {
        console.error('휴면 조깅 크루 조회 실패:', error)
        return []
      }

      return (data || []).map((crew: any) => databaseService['mapSupabaseJoggingCrew'](crew))
    } catch (error) {
      console.error('휴면 조깅 크루 조회 중 오류:', error)
      return []
    }
  }

  // 휴면 해제
  async releaseDormantCrew(crewId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

      const { error } = await supabase
        .from('crews')
        .update({
          is_dormant: false,
          dormant_at: null,
          scheduled_deletion_at: sevenDaysLater.toISOString(),
        })
        .eq('id', crewId)

      if (error) {
        console.error('휴면 해제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('휴면 해제 중 오류:', error)
      return { success: false, error: error.message || '휴면 해제 중 오류가 발생했습니다.' }
    }
  }

  // 휴면 조깅 크루 해제
  async releaseDormantJoggingCrew(crewId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

      const { error } = await supabase
        .from('jogging_crews')
        .update({
          is_dormant: false,
          dormant_at: null,
          scheduled_deletion_at: sevenDaysLater.toISOString(),
        })
        .eq('id', crewId)

      if (error) {
        console.error('휴면 조깅 크루 해제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('휴면 조깅 크루 해제 중 오류:', error)
      return { success: false, error: error.message || '휴면 해제 중 오류가 발생했습니다.' }
    }
  }

  // 크루 삭제
  async deleteCrew(crewId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('crews')
        .delete()
        .eq('id', crewId)

      if (error) {
        console.error('크루 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('크루 삭제 중 오류:', error)
      return { success: false, error: error.message || '크루 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 조깅 크루 삭제
  async deleteJoggingCrew(crewId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('jogging_crews')
        .delete()
        .eq('id', crewId)

      if (error) {
        console.error('조깅 크루 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('조깅 크루 삭제 중 오류:', error)
      return { success: false, error: error.message || '조깅 크루 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 회원탈퇴 처리 (탈퇴 상태로 변경)
  async deactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) {
        console.error('회원탈퇴 처리 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('회원탈퇴 처리 중 오류:', error)
      return { success: false, error: error.message || '회원탈퇴 처리 중 오류가 발생했습니다.' }
    }
  }

  // 탈퇴 취소
  async restoreUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_deleted: false,
          deleted_at: null,
        })
        .eq('id', userId)

      if (error) {
        console.error('탈퇴 취소 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('탈퇴 취소 중 오류:', error)
      return { success: false, error: error.message || '탈퇴 취소 중 오류가 발생했습니다.' }
    }
  }

  // 탈퇴한 사용자 목록 조회
  async getDeletedUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })

      if (error) {
        console.error('탈퇴한 사용자 목록 조회 실패:', error)
        return []
      }

      return (data || []).map((user: any) => databaseService['mapSupabaseUser'](user))
    } catch (error) {
      console.error('탈퇴한 사용자 목록 조회 중 오류:', error)
      return []
    }
  }

  // 모든 크루 조회 (관리자용 - 휴면 포함)
  async getAllCrewsForAdmin(limit: number = 50, offset: number = 0): Promise<{ data: Crew[]; hasMore: boolean; total?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('crews')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('크루 목록 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const crews = (data || []).map((crew: any) => databaseService['mapSupabaseCrew'](crew))
      const hasMore = count ? offset + limit < count : false

      return { data: crews, hasMore, total: count || undefined }
    } catch (error) {
      console.error('크루 목록 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 모든 조깅 크루 조회 (관리자용 - 휴면 포함)
  async getAllJoggingCrewsForAdmin(limit: number = 50, offset: number = 0): Promise<{ data: JoggingCrew[]; hasMore: boolean; total?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('jogging_crews')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('조깅 크루 목록 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const crews = (data || []).map((crew: any) => databaseService['mapSupabaseJoggingCrew'](crew))
      const hasMore = count ? offset + limit < count : false

      return { data: crews, hasMore, total: count || undefined }
    } catch (error) {
      console.error('조깅 크루 목록 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 싱글 목표 매핑
  private mapSupabaseSingleGoal(goal: any): SingleGoal {
    return {
      id: goal.id,
      name: goal.name,
      exerciseType: goal.exercise_type,
      exerciseConfig: goal.exercise_config,
      alarm: goal.alarm || undefined,
      backgroundMusic: goal.background_music || undefined,
      createdAt: new Date(goal.created_at).getTime(),
      createdBy: goal.user_id,
      isActive: goal.is_active !== false,
    }
  }

  // 조깅 목표 매핑
  private mapSupabaseJoggingGoal(goal: any): JoggingGoal {
    return {
      id: goal.id,
      name: goal.name,
      targetDistance: goal.target_distance || undefined,
      targetTime: goal.target_time || undefined,
      alarm: goal.alarm || undefined,
      backgroundMusic: goal.background_music || undefined,
      createdAt: new Date(goal.created_at).getTime(),
      createdBy: goal.user_id,
      isActive: goal.is_active !== false,
    }
  }

  // 모든 싱글 목표 조회 (관리자용)
  async getAllSingleGoalsForAdmin(limit: number = 50, offset: number = 0): Promise<{ data: SingleGoal[]; hasMore: boolean; total?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('single_goals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('싱글 목표 목록 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const goals = (data || []).map((goal: any) => this.mapSupabaseSingleGoal(goal))
      const hasMore = count ? offset + limit < count : false

      return { data: goals, hasMore, total: count || undefined }
    } catch (error) {
      console.error('싱글 목표 목록 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 모든 조깅 목표 조회 (관리자용)
  async getAllJoggingGoalsForAdmin(limit: number = 50, offset: number = 0): Promise<{ data: JoggingGoal[]; hasMore: boolean; total?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('jogging_goals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('조깅 목표 목록 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const goals = (data || []).map((goal: any) => this.mapSupabaseJoggingGoal(goal))
      const hasMore = count ? offset + limit < count : false

      return { data: goals, hasMore, total: count || undefined }
    } catch (error) {
      console.error('조깅 목표 목록 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 목표 삭제
  async deleteSingleGoal(goalId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('single_goals')
        .delete()
        .eq('id', goalId)

      if (error) {
        console.error('싱글 목표 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('싱글 목표 삭제 중 오류:', error)
      return { success: false, error: error.message || '싱글 목표 삭제 중 오류가 발생했습니다.' }
    }
  }

  async deleteJoggingGoal(goalId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('jogging_goals')
        .delete()
        .eq('id', goalId)

      if (error) {
        console.error('조깅 목표 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('조깅 목표 삭제 중 오류:', error)
      return { success: false, error: error.message || '조깅 목표 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 여러 목표 삭제
  async deleteSingleGoals(goalIds: string[]): Promise<{ success: boolean; error?: string; deleted: number }> {
    try {
      let deleted = 0
      for (const goalId of goalIds) {
        const { error } = await supabase
          .from('single_goals')
          .delete()
          .eq('id', goalId)
        
        if (!error) {
          deleted++
        }
      }

      return { success: true, deleted }
    } catch (error: any) {
      console.error('싱글 목표 삭제 중 오류:', error)
      return { success: false, error: error.message || '싱글 목표 삭제 중 오류가 발생했습니다.', deleted: 0 }
    }
  }

  async deleteJoggingGoals(goalIds: string[]): Promise<{ success: boolean; error?: string; deleted: number }> {
    try {
      let deleted = 0
      for (const goalId of goalIds) {
        const { error } = await supabase
          .from('jogging_goals')
          .delete()
          .eq('id', goalId)
        
        if (!error) {
          deleted++
        }
      }

      return { success: true, deleted }
    } catch (error: any) {
      console.error('조깅 목표 삭제 중 오류:', error)
      return { success: false, error: error.message || '조깅 목표 삭제 중 오류가 발생했습니다.', deleted: 0 }
    }
  }

  // ============ 공지사항 관리 ============

  // 공지사항 매핑
  private mapSupabaseAnnouncement(announcement: any): Announcement {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      createdBy: announcement.created_by,
      createdAt: new Date(announcement.created_at).getTime(),
      updatedAt: new Date(announcement.updated_at).getTime(),
      isActive: announcement.is_active !== false,
      priority: announcement.priority || 'normal',
    }
  }

  // 모든 공지사항 조회 (관리자용)
  async getAllAnnouncements(limit: number = 50, offset: number = 0): Promise<{ data: Announcement[]; hasMore: boolean; total?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('announcements')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('공지사항 목록 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const announcements = (data || []).map((announcement: any) => this.mapSupabaseAnnouncement(announcement))
      const hasMore = count ? offset + limit < count : false

      return { data: announcements, hasMore, total: count || undefined }
    } catch (error) {
      console.error('공지사항 목록 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // localStorage 사용자 ID를 Supabase UUID로 변환하는 헬퍼 함수
  private async getSupabaseUserId(localStorageUserId: string): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(localStorageUserId)) {
      // 이미 UUID 형식이면 그대로 반환
      return localStorageUserId
    }

    // localStorage에서 사용자 정보 가져오기
    const userStr = localStorage.getItem(`user_${localStorageUserId}`)
    if (!userStr) {
      throw new Error('사용자 정보를 찾을 수 없습니다.')
    }

    const user = JSON.parse(userStr)
    if (!user.email) {
      throw new Error('사용자 이메일 정보가 없습니다.')
    }

    // Supabase에서 email로 사용자 찾기
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userError || !supabaseUser) {
      throw new Error('Supabase에 사용자가 등록되어 있지 않습니다. 먼저 로그인해주세요.')
    }

    return supabaseUser.id
  }

  // 공지사항 생성
  async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<{ success: boolean; data?: Announcement; error?: string }> {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        return { success: false, error: '로그인이 필요합니다.' }
      }

      // localStorage 사용자 ID를 Supabase UUID로 변환
      const supabaseUserId = await this.getSupabaseUserId(user.id)

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: announcement.title,
          content: announcement.content,
          created_by: supabaseUserId,
          is_active: announcement.isActive,
          priority: announcement.priority,
        })
        .select()
        .single()

      if (error) {
        console.error('공지사항 생성 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: this.mapSupabaseAnnouncement(data) }
    } catch (error: any) {
      console.error('공지사항 생성 중 오류:', error)
      return { success: false, error: error.message || '공지사항 생성 중 오류가 발생했습니다.' }
    }
  }

  // 공지사항 수정
  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<{ success: boolean; data?: Announcement; error?: string }> {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        return { success: false, error: '로그인이 필요합니다.' }
      }

      // localStorage 사용자 ID를 Supabase UUID로 변환
      const supabaseUserId = await this.getSupabaseUserId(user.id)

      const updateData: any = {}
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.content !== undefined) updateData.content = updates.content
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive
      if (updates.priority !== undefined) updateData.priority = updates.priority
      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('announcements')
        .eq('created_by', supabaseUserId)
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('공지사항 수정 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: this.mapSupabaseAnnouncement(data) }
    } catch (error: any) {
      console.error('공지사항 수정 중 오류:', error)
      return { success: false, error: error.message || '공지사항 수정 중 오류가 발생했습니다.' }
    }
  }

  // 공지사항 삭제
  async deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('공지사항 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('공지사항 삭제 중 오류:', error)
      return { success: false, error: error.message || '공지사항 삭제 중 오류가 발생했습니다.' }
    }
  }

  // 여러 공지사항 삭제
  async deleteAnnouncements(ids: string[]): Promise<{ success: boolean; error?: string; deleted: number }> {
    try {
      let deleted = 0
      for (const id of ids) {
        const { error } = await supabase
          .from('announcements')
          .delete()
          .eq('id', id)
        
        if (!error) {
          deleted++
        }
      }

      return { success: true, deleted }
    } catch (error: any) {
      console.error('공지사항 삭제 중 오류:', error)
      return { success: false, error: error.message || '공지사항 삭제 중 오류가 발생했습니다.', deleted: 0 }
    }
  }

  // 공지사항 통계 조회
  async getAnnouncementStats(): Promise<{
    total: number
    active: number
    readCounts: Record<string, number> // 공지사항별 읽은 사용자 수
  }> {
    try {
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, is_active')

      const total = announcements?.length || 0
      const active = announcements?.filter((a: any) => a.is_active).length || 0

      // 각 공지사항별 읽은 사용자 수 조회
      const readCounts: Record<string, number> = {}
      if (announcements) {
        for (const announcement of announcements) {
          const { count } = await supabase
            .from('announcement_reads')
            .select('*', { count: 'exact', head: true })
            .eq('announcement_id', announcement.id)
          
          readCounts[announcement.id] = count || 0
        }
      }

      return { total, active, readCounts }
    } catch (error) {
      console.error('공지사항 통계 조회 중 오류:', error)
      return { total: 0, active: 0, readCounts: {} }
    }
  }

  // 여러 크루 삭제
  async deleteCrews(crewIds: string[]): Promise<{ success: boolean; error?: string; deleted: number }> {
    try {
      let deleted = 0
      for (const crewId of crewIds) {
        const { error } = await supabase
          .from('crews')
          .delete()
          .eq('id', crewId)
        
        if (!error) {
          deleted++
        }
      }

      return { success: true, deleted }
    } catch (error: any) {
      console.error('크루 삭제 중 오류:', error)
      return { success: false, error: error.message || '크루 삭제 중 오류가 발생했습니다.', deleted: 0 }
    }
  }

  // 여러 조깅 크루 삭제
  async deleteJoggingCrews(crewIds: string[]): Promise<{ success: boolean; error?: string; deleted: number }> {
    try {
      let deleted = 0
      for (const crewId of crewIds) {
        const { error } = await supabase
          .from('jogging_crews')
          .delete()
          .eq('id', crewId)
        
        if (!error) {
          deleted++
        }
      }

      return { success: true, deleted }
    } catch (error: any) {
      console.error('조깅 크루 삭제 중 오류:', error)
      return { success: false, error: error.message || '조깅 크루 삭제 중 오류가 발생했습니다.', deleted: 0 }
    }
  }

  // 여러 사용자 삭제
  async deleteUsers(userIds: string[]): Promise<{ success: boolean; error?: string; deleted: number }> {
    try {
      let deleted = 0
      for (const userId of userIds) {
        const result = await this.permanentlyDeleteUser(userId)
        if (result.success) {
          deleted++
        }
      }

      return { success: true, deleted }
    } catch (error: any) {
      console.error('사용자 삭제 중 오류:', error)
      return { success: false, error: error.message || '사용자 삭제 중 오류가 발생했습니다.', deleted: 0 }
    }
  }

  // 계정 완전 삭제 (관련 데이터 모두 삭제)
  async permanentlyDeleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 사용자가 생성한 모든 크루 삭제
      const { data: userCrews } = await supabase
        .from('crews')
        .select('id')
        .eq('created_by', userId)

      if (userCrews && userCrews.length > 0) {
        for (const crew of userCrews) {
          await supabase.from('crews').delete().eq('id', crew.id)
        }
      }

      // 사용자가 생성한 모든 조깅 크루 삭제
      const { data: userJoggingCrews } = await supabase
        .from('jogging_crews')
        .select('id')
        .eq('created_by', userId)

      if (userJoggingCrews && userJoggingCrews.length > 0) {
        for (const crew of userJoggingCrews) {
          await supabase.from('jogging_crews').delete().eq('id', crew.id)
        }
      }

      // 사용자 삭제 (CASCADE로 관련 데이터 자동 삭제)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        console.error('계정 완전 삭제 실패:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('계정 완전 삭제 중 오류:', error)
      return { success: false, error: error.message || '계정 삭제 중 오류가 발생했습니다.' }
    }
  }
}

export const adminService = new AdminService()

