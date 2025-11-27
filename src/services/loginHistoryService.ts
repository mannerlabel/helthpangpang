/**
 * 로그인 히스토리 서비스
 * 로그인/로그아웃 추적, 디바이스 정보 수집
 */

import { supabase } from './supabaseClient'

export interface LoginHistory {
  id: string
  userId: string
  loginAt: number
  logoutAt?: number
  sessionDuration?: number // 초 단위
  deviceType?: string // mobile, desktop, tablet
  os?: string // Windows, macOS, iOS, Android 등
  browser?: string // Chrome, Firefox, Safari 등
  ipAddress?: string
  userAgent?: string
}

// 디바이스 정보 추출
function getDeviceInfo(): { deviceType: string; os: string; browser: string; userAgent: string } {
  const userAgent = navigator.userAgent
  let deviceType = 'desktop'
  let os = 'Unknown'
  let browser = 'Unknown'

  // 디바이스 타입 판별
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    deviceType = 'tablet'
  } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
    deviceType = 'mobile'
  }

  // OS 판별
  if (/windows/i.test(userAgent)) {
    os = 'Windows'
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    os = 'macOS'
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux'
  } else if (/android/i.test(userAgent)) {
    os = 'Android'
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    os = 'iOS'
  }

  // 브라우저 판별
  if (/edg/i.test(userAgent)) {
    browser = 'Edge'
  } else if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) {
    browser = 'Chrome'
  } else if (/firefox/i.test(userAgent)) {
    browser = 'Firefox'
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = 'Safari'
  } else if (/opera|opr/i.test(userAgent)) {
    browser = 'Opera'
  }

  return { deviceType, os, browser, userAgent }
}

class LoginHistoryService {
  private currentSessionId: string | null = null
  private loginTime: number | null = null

  // 로그인 기록 생성
  async recordLogin(userId: string): Promise<LoginHistory | null> {
    try {
      const deviceInfo = getDeviceInfo()
      const loginAt = new Date()

      const { data, error } = await supabase
        .from('login_history')
        .insert({
          user_id: userId,
          login_at: loginAt.toISOString(),
          device_type: deviceInfo.deviceType,
          os: deviceInfo.os,
          browser: deviceInfo.browser,
          user_agent: deviceInfo.userAgent,
        })
        .select()
        .single()

      if (error) {
        console.error('로그인 히스토리 기록 실패:', error)
        return null
      }

      this.currentSessionId = data.id
      this.loginTime = loginAt.getTime()

      return {
        id: data.id,
        userId: data.user_id,
        loginAt: new Date(data.login_at).getTime(),
        deviceType: data.device_type,
        os: data.os,
        browser: data.browser,
        userAgent: data.user_agent,
      }
    } catch (error) {
      console.error('로그인 히스토리 기록 중 오류:', error)
      return null
    }
  }

  // 로그아웃 기록 업데이트
  async recordLogout(): Promise<void> {
    if (!this.currentSessionId || !this.loginTime) {
      return
    }

    try {
      const logoutAt = new Date()
      const sessionDuration = Math.floor((logoutAt.getTime() - this.loginTime) / 1000) // 초 단위

      await supabase
        .from('login_history')
        .update({
          logout_at: logoutAt.toISOString(),
          session_duration: sessionDuration,
        })
        .eq('id', this.currentSessionId)

      this.currentSessionId = null
      this.loginTime = null
    } catch (error) {
      console.error('로그아웃 히스토리 기록 중 오류:', error)
    }
  }

  // 사용자의 로그인 히스토리 조회 (페이지네이션 지원)
  async getUserLoginHistory(userId: string, limit: number = 100, offset: number = 0): Promise<{ data: LoginHistory[]; hasMore: boolean }> {
    try {
      // 전체 개수 조회
      const { count } = await supabase
        .from('login_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      const { data, error } = await supabase
        .from('login_history')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('로그인 히스토리 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const hasMore = count ? offset + limit < count : false

      return {
        data: (data || []).map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          loginAt: new Date(item.login_at).getTime(),
          logoutAt: item.logout_at ? new Date(item.logout_at).getTime() : undefined,
          sessionDuration: item.session_duration || undefined,
          deviceType: item.device_type,
          os: item.os,
          browser: item.browser,
          ipAddress: item.ip_address,
          userAgent: item.user_agent,
        })),
        hasMore,
      }
    } catch (error) {
      console.error('로그인 히스토리 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 모든 사용자의 로그인 히스토리 조회 (관리자용, 페이지네이션 지원)
  async getAllLoginHistory(limit: number = 100, offset: number = 0): Promise<{ data: LoginHistory[]; hasMore: boolean }> {
    try {
      // 전체 개수 조회
      const { count } = await supabase
        .from('login_history')
        .select('*', { count: 'exact', head: true })

      const { data, error } = await supabase
        .from('login_history')
        .select('*')
        .order('login_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('전체 로그인 히스토리 조회 실패:', error)
        return { data: [], hasMore: false }
      }

      const hasMore = count ? offset + limit < count : false

      return {
        data: (data || []).map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          loginAt: new Date(item.login_at).getTime(),
          logoutAt: item.logout_at ? new Date(item.logout_at).getTime() : undefined,
          sessionDuration: item.session_duration || undefined,
          deviceType: item.device_type,
          os: item.os,
          browser: item.browser,
          ipAddress: item.ip_address,
          userAgent: item.user_agent,
        })),
        hasMore,
      }
    } catch (error) {
      console.error('전체 로그인 히스토리 조회 중 오류:', error)
      return { data: [], hasMore: false }
    }
  }

  // 기간별 로그인 통계
  async getLoginStats(startDate: Date, endDate: Date): Promise<{
    daily: Array<{ date: string; count: number }>
    weekly: Array<{ week: string; count: number }>
    monthly: Array<{ month: string; count: number }>
  }> {
    try {
      const { data, error } = await supabase
        .from('login_history')
        .select('login_at')
        .gte('login_at', startDate.toISOString())
        .lte('login_at', endDate.toISOString())
        .order('login_at', { ascending: true })

      if (error) {
        console.error('로그인 통계 조회 실패:', error)
        return { daily: [], weekly: [], monthly: [] }
      }

      // 일별 통계
      const dailyMap = new Map<string, number>()
      // 주별 통계
      const weeklyMap = new Map<string, number>()
      // 월별 통계
      const monthlyMap = new Map<string, number>()

      data?.forEach((item: any) => {
        const date = new Date(item.login_at)
        const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
        const weekStr = getWeekString(date)
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` // YYYY-MM

        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1)
        weeklyMap.set(weekStr, (weeklyMap.get(weekStr) || 0) + 1)
        monthlyMap.set(monthStr, (monthlyMap.get(monthStr) || 0) + 1)
      })

      const daily = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const weekly = Array.from(weeklyMap.entries())
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => a.week.localeCompare(b.week))

      const monthly = Array.from(monthlyMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))

      return { daily, weekly, monthly }
    } catch (error) {
      console.error('로그인 통계 조회 중 오류:', error)
      return { daily: [], weekly: [], monthly: [] }
    }
  }
}

// 주 문자열 생성 (YYYY-WW 형식)
function getWeekString(date: Date): string {
  const year = date.getFullYear()
  const oneJan = new Date(year, 0, 1)
  const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export const loginHistoryService = new LoginHistoryService()

