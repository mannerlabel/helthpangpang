/**
 * 계급 시스템 서비스
 * 회원 계급 및 크루/조깅크루 계급 계산 및 관리
 */

import { databaseService } from './databaseService'
import { loginHistoryService } from './loginHistoryService'
import { supabase } from './supabaseClient'

// 계급 정보 타입
export interface RankInfo {
  level: number // 1-10
  name: string // 계급명
  icon: string // 아이콘 (이모지 또는 아이콘 코드)
  description: string // 설명
}

// 회원 계급 정보
export const USER_RANKS: RankInfo[] = [
  { level: 1, name: '새싹', icon: '🌱', description: '최초 가입 회원' },
  { level: 2, name: '스타', icon: '⭐', description: '목표 2개 이상 생성, 로그인 10일 이상' },
  { level: 3, name: '크라운', icon: '👑', description: '크루/조깅크루 생성 후 참여회원 3인 이상' },
  { level: 4, name: '파이어', icon: '🔥', description: '1개 이상의 크루/조깅크루에서 추천수 10개 이상' },
  { level: 5, name: '보스', icon: '💼', description: '크루/조깅크루 3개월 이상 운영' },
  { level: 6, name: '베테랑', icon: '🏆', description: '로그인 100일 이상, 6개월 이상 운영되는 크루방 1개 이상, 추천수 50회 이상' },
  { level: 7, name: '마스터', icon: '🌟', description: '로그인 365일 이상, 크루/조깅크루 3개 이상, 3개 이상의 크루/조깅크루 추천수 50회 이상' },
  { level: 8, name: '엘리트', icon: '💎', description: '크루/조깅크루 단계가 3단계 이상인 크루 혹은 조깅크루 보유' },
  { level: 9, name: '명예의 전당', icon: '👑', description: '크루/조깅크루 단계가 5단계 이상인 크루 혹은 조깅크루 보유' },
  { level: 10, name: '레전드', icon: '⚡', description: '크루/조깅크루 단계가 7단계 이상인 크루 혹은 조깅크루 보유' },
]

// 크루/조깅크루 계급 정보 (배지/계급장 스타일 아이콘 - 회원 계급과 구분)
// 회원 계급: 🌱⭐👑🔥💼🏆🌟💎👑⚡
// 크루 계급: 🆕📈🎯🛡️🎖️🏅🎗️🎪🎭🎬 (배지/계급장 스타일)
export const CREW_RANKS: RankInfo[] = [
  { level: 1, name: '신규 크루', icon: '🆕', description: '크루/조깅크루 생성시' },
  { level: 2, name: '성장 크루', icon: '📈', description: '참여인원 2인 이상' },
  { level: 3, name: '활동 크루', icon: '🎯', description: '참여인원 3인 이상, 30일 이상 유지' },
  { level: 4, name: '안정 크루', icon: '🛡️', description: '100일 이상 유지' },
  { level: 5, name: '인기 크루', icon: '🎖️', description: '참여인원 5인 이상, 추천수 30개 이상' },
  { level: 6, name: '명성 크루', icon: '🏅', description: '참여인원 10인 이상, 추천수 50개 이상' },
  { level: 7, name: '거대 크루', icon: '🎗️', description: '참여인원 20인 이상' },
  { level: 8, name: '메가 크루', icon: '🎪', description: '참여인원 30인 이상' },
  { level: 9, name: '엘리트 크루', icon: '🎭', description: '캡틴 회원의 단계가 8단계' },
  { level: 10, name: '레전드 크루', icon: '🎬', description: '캡틴 회원의 단계가 9단계' },
]

class RankService {
  /**
   * 사용자의 로그인 일수 계산 (중복 제외, 날짜 기준)
   */
  async getUserLoginDays(userId: string): Promise<number> {
    try {
      const history = await loginHistoryService.getUserLoginHistory(userId, 10000)
      const uniqueDates = new Set<string>()
      
      history.forEach((h) => {
        const date = new Date(h.loginAt)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        uniqueDates.add(dateStr)
      })
      
      return uniqueDates.size
    } catch (error) {
      console.error('로그인 일수 계산 실패:', error)
      return 0
    }
  }

  /**
   * 사용자가 생성한 목표 개수 조회
   */
  async getUserGoalCount(userId: string): Promise<number> {
    try {
      const singleGoals = await databaseService.getSingleGoalsByUserId(userId)
      const joggingGoals = await databaseService.getJoggingGoalsByUserId(userId)
      return singleGoals.length + joggingGoals.length
    } catch (error) {
      console.error('목표 개수 조회 실패:', error)
      return 0
    }
  }

  /**
   * 사용자가 생성한 크루/조깅크루 중 참여인원이 3인 이상인 크루 개수
   */
  async getUserCrewsWithMinMembers(userId: string, minMembers: number): Promise<number> {
    try {
      const crews = await databaseService.getCrewsByUserId(userId, 1000, 0)
      const joggingCrews = await databaseService.getJoggingCrewsByUserId(userId, 1000, 0)
      
      const allCrews = [...crews.data, ...joggingCrews.data]
      return allCrews.filter((crew) => crew.currentMembers >= minMembers).length
    } catch (error) {
      console.error('크루 조회 실패:', error)
      return 0
    }
  }

  /**
   * 사용자가 보유한 크루/조깅크루 중 추천수가 특정 개수 이상인 크루 개수
   */
  async getUserCrewsWithMinRecommendations(userId: string, minRecommendations: number, minCrewCount: number = 1): Promise<number> {
    try {
      const crews = await databaseService.getCrewsByUserId(userId, 1000, 0)
      const joggingCrews = await databaseService.getJoggingCrewsByUserId(userId, 1000, 0)
      
      const allCrews = [...crews.data, ...joggingCrews.data]
      const qualifiedCrews = allCrews.filter((crew) => crew.recommendations >= minRecommendations)
      return qualifiedCrews.length >= minCrewCount ? qualifiedCrews.length : 0
    } catch (error) {
      console.error('크루 조회 실패:', error)
      return 0
    }
  }

  /**
   * 사용자가 운영 중인 크루/조깅크루 중 특정 기간 이상 운영된 크루 개수
   */
  async getUserCrewsWithMinDuration(userId: string, minDays: number): Promise<number> {
    try {
      const crews = await databaseService.getCrewsByUserId(userId, 1000, 0)
      const joggingCrews = await databaseService.getJoggingCrewsByUserId(userId, 1000, 0)
      
      const allCrews = [...crews.data, ...joggingCrews.data]
      const now = Date.now()
      const minTimestamp = now - minDays * 24 * 60 * 60 * 1000
      
      return allCrews.filter((crew) => crew.createdAt <= minTimestamp).length
    } catch (error) {
      console.error('크루 조회 실패:', error)
      return 0
    }
  }

  /**
   * 사용자가 보유한 크루/조깅크루 중 특정 계급 이상인 크루 개수
   */
  async getUserCrewsWithMinRank(userId: string, minRank: number): Promise<number> {
    try {
      const crews = await databaseService.getCrewsByUserId(userId, 1000, 0)
      const joggingCrews = await databaseService.getJoggingCrewsByUserId(userId, 1000, 0)
      
      let count = 0
      
      // 일반 크루 확인
      for (const crew of crews.data) {
        const crewRank = await this.calculateCrewRank(crew.id, false)
        if (crewRank >= minRank) {
          count++
        }
      }
      
      // 조깅 크루 확인
      for (const crew of joggingCrews.data) {
        const crewRank = await this.calculateCrewRank(crew.id, true)
        if (crewRank >= minRank) {
          count++
        }
      }
      
      return count
    } catch (error) {
      console.error('크루 조회 실패:', error)
      return 0
    }
  }

  /**
   * 회원 계급 계산
   */
  async calculateUserRank(userId: string): Promise<number> {
    try {
      // 1단계: 최초가입회원 (항상 1단계부터 시작)
      let currentRank = 1

      // 2단계: 목표 2개 이상 생성, 로그인 10일 이상
      if (currentRank === 1) {
        const goalCount = await this.getUserGoalCount(userId)
        const loginDays = await this.getUserLoginDays(userId)
        if (goalCount >= 2 && loginDays >= 10) {
          currentRank = 2
        } else {
          return 1
        }
      }

      // 3단계: 현재 2단계 회원 중 크루/조깅크루 생성 후 참여회원이 3인 이상
      if (currentRank === 2) {
        const crewsWith3Members = await this.getUserCrewsWithMinMembers(userId, 3)
        if (crewsWith3Members >= 1) {
          currentRank = 3
        } else {
          return 2
        }
      }

      // 4단계: 현재 3단계 회원 중 1개 이상의 크루/조깅크루에서 추천수 10개 이상
      if (currentRank === 3) {
        const crewsWith10Recs = await this.getUserCrewsWithMinRecommendations(userId, 10, 1)
        if (crewsWith10Recs >= 1) {
          currentRank = 4
        } else {
          return 3
        }
      }

      // 5단계: 현재 4단계 회원 중 크루/조깅크루 3개월 이상 운영
      if (currentRank === 4) {
        const crews3Months = await this.getUserCrewsWithMinDuration(userId, 90) // 3개월 = 90일
        if (crews3Months >= 1) {
          currentRank = 5
        } else {
          return 4
        }
      }

      // 6단계: 현재 5단계 회원 중 로그인 100일 이상, 6개월 이상 운영되는 크루방 1개 이상, 추천수 50회 이상
      if (currentRank === 5) {
        const loginDays = await this.getUserLoginDays(userId)
        const crews6Months = await this.getUserCrewsWithMinDuration(userId, 180) // 6개월 = 180일
        const crewsWith50Recs = await this.getUserCrewsWithMinRecommendations(userId, 50, 1)
        if (loginDays >= 100 && crews6Months >= 1 && crewsWith50Recs >= 1) {
          currentRank = 6
        } else {
          return 5
        }
      }

      // 7단계: 현재 6단계 회원 중 로그인 365일 이상, 크루/조깅크루 3개 이상, 3개 이상의 크루/조깅크루 추천수 50회 이상
      if (currentRank === 6) {
        const loginDays = await this.getUserLoginDays(userId)
        const crews = await databaseService.getCrewsByUserId(userId, 1000, 0)
        const joggingCrews = await databaseService.getJoggingCrewsByUserId(userId, 1000, 0)
        const totalCrews = crews.data.length + joggingCrews.data.length
        const crewsWith50Recs = await this.getUserCrewsWithMinRecommendations(userId, 50, 3)
        if (loginDays >= 365 && totalCrews >= 3 && crewsWith50Recs >= 3) {
          currentRank = 7
        } else {
          return 6
        }
      }

      // 8단계: 현재 7단계 회원 중 크루/조깅크루 단계가 3단계 이상인 크루 혹은 조깅크루 보유
      if (currentRank === 7) {
        const crewsWithRank3 = await this.getUserCrewsWithMinRank(userId, 3)
        if (crewsWithRank3 >= 1) {
          currentRank = 8
        } else {
          return 7
        }
      }

      // 9단계: 현재 8단계 회원 중 크루/조깅크루 단계가 5단계 이상인 크루 혹은 조깅크루 보유
      if (currentRank === 8) {
        const crewsWithRank5 = await this.getUserCrewsWithMinRank(userId, 5)
        if (crewsWithRank5 >= 1) {
          currentRank = 9
        } else {
          return 8
        }
      }

      // 10단계: 현재 9단계 회원 중 크루/조깅크루 단계가 7단계 이상인 크루 혹은 조깅크루 보유
      if (currentRank === 9) {
        const crewsWithRank7 = await this.getUserCrewsWithMinRank(userId, 7)
        if (crewsWithRank7 >= 1) {
          currentRank = 10
        } else {
          return 9
        }
      }

      return currentRank
    } catch (error) {
      console.error('회원 계급 계산 실패:', error)
      return 1
    }
  }

  /**
   * 크루/조깅크루 계급 계산
   */
  async calculateCrewRank(crewId: string, isJoggingCrew: boolean = false): Promise<number> {
    try {
      let crew: any
      
      if (isJoggingCrew) {
        crew = await databaseService.getJoggingCrewById(crewId)
      } else {
        crew = await databaseService.getCrewById(crewId)
      }

      if (!crew) {
        return 1
      }

      // 1단계: 크루/조깅크루 생성시
      let currentRank = 1

      // 2단계: 참여인원 2인 이상
      if (currentRank === 1) {
        if (crew.currentMembers >= 2) {
          currentRank = 2
        } else {
          return 1
        }
      }

      // 3단계: 참여인원 3인 이상, 30일 이상 유지
      if (currentRank === 2) {
        const daysSinceCreation = Math.floor((Date.now() - crew.createdAt) / (24 * 60 * 60 * 1000))
        if (crew.currentMembers >= 3 && daysSinceCreation >= 30) {
          currentRank = 3
        } else {
          return 2
        }
      }

      // 4단계: 100일 이상 유지
      if (currentRank === 3) {
        const daysSinceCreation = Math.floor((Date.now() - crew.createdAt) / (24 * 60 * 60 * 1000))
        if (daysSinceCreation >= 100) {
          currentRank = 4
        } else {
          return 3
        }
      }

      // 5단계: 참여인원 5인 이상, 추천수 30개 이상
      if (currentRank === 4) {
        if (crew.currentMembers >= 5 && crew.recommendations >= 30) {
          currentRank = 5
        } else {
          return 4
        }
      }

      // 6단계: 참여인원 10인 이상, 추천수 50개 이상
      if (currentRank === 5) {
        if (crew.currentMembers >= 10 && crew.recommendations >= 50) {
          currentRank = 6
        } else {
          return 5
        }
      }

      // 7단계: 참여인원 20인 이상
      if (currentRank === 6) {
        if (crew.currentMembers >= 20) {
          currentRank = 7
        } else {
          return 6
        }
      }

      // 8단계: 참여인원 30인 이상
      if (currentRank === 7) {
        if (crew.currentMembers >= 30) {
          currentRank = 8
        } else {
          return 7
        }
      }

      // 9단계: 캡틴 회원의 단계가 8단계
      if (currentRank === 8) {
        const captainRank = await this.calculateUserRank(crew.createdBy)
        if (captainRank >= 8) {
          currentRank = 9
        } else {
          return 8
        }
      }

      // 10단계: 캡틴 회원의 단계가 9단계
      if (currentRank === 9) {
        const captainRank = await this.calculateUserRank(crew.createdBy)
        if (captainRank >= 9) {
          currentRank = 10
        } else {
          return 9
        }
      }

      return currentRank
    } catch (error) {
      console.error('크루 계급 계산 실패:', error)
      return 1
    }
  }

  /**
   * 계급 업데이트 및 승급 확인
   */
  async updateUserRank(userId: string): Promise<{ newRank: number; promoted: boolean; previousRank?: number }> {
    try {
      // 현재 계급 조회
      const currentRank = await this.getUserRank(userId)
      const newRank = await this.calculateUserRank(userId)
      
      if (newRank > currentRank) {
        // 계급 업데이트
        await this.setUserRank(userId, newRank)
        return { newRank, promoted: true, previousRank: currentRank }
      }
      
      return { newRank, promoted: false, previousRank: currentRank }
    } catch (error) {
      console.error('회원 계급 업데이트 실패:', error)
      return { newRank: 1, promoted: false }
    }
  }

  /**
   * 크루 계급 업데이트 및 승급 확인
   */
  async updateCrewRank(crewId: string, isJoggingCrew: boolean = false): Promise<{ newRank: number; promoted: boolean; previousRank?: number }> {
    try {
      // 현재 계급 조회
      const currentRank = await this.getCrewRank(crewId, isJoggingCrew)
      const newRank = await this.calculateCrewRank(crewId, isJoggingCrew)
      
      if (newRank > currentRank) {
        // 계급 업데이트
        await this.setCrewRank(crewId, newRank, isJoggingCrew)
        return { newRank, promoted: true, previousRank: currentRank }
      }
      
      return { newRank, promoted: false, previousRank: currentRank }
    } catch (error) {
      console.error('크루 계급 업데이트 실패:', error)
      return { newRank: 1, promoted: false }
    }
  }

  /**
   * 사용자 계급 조회 (데이터베이스에서)
   */
  async getUserRank(userId: string): Promise<number> {
    try {
      if (supabase) {
        // localStorage ID를 Supabase UUID로 변환
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          // localStorage ID인 경우 Supabase UUID로 변환
          supabaseUserId = await databaseService.getSupabaseUserId(userId)
        }

        const { data, error } = await supabase
          .from('users')
          .select('rank')
          .eq('id', supabaseUserId)
          .single()

        if (error) {
          console.error('사용자 계급 조회 실패:', error)
          return 1
        }

        return data?.rank || 1
      }
      return 1
    } catch (error) {
      console.error('사용자 계급 조회 실패:', error)
      return 1
    }
  }

  /**
   * 사용자 계급 설정
   */
  async setUserRank(userId: string, rank: number): Promise<void> {
    try {
      if (supabase) {
        // localStorage ID를 Supabase UUID로 변환
        let supabaseUserId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          // localStorage ID인 경우 Supabase UUID로 변환
          supabaseUserId = await databaseService.getSupabaseUserId(userId)
        }

        const { error } = await supabase
          .from('users')
          .update({ rank })
          .eq('id', supabaseUserId)

        if (error) {
          console.error('사용자 계급 설정 실패:', error)
        }
      }
    } catch (error) {
      console.error('사용자 계급 설정 실패:', error)
    }
  }

  /**
   * 크루 계급 조회 (데이터베이스에서)
   */
  async getCrewRank(crewId: string, isJoggingCrew: boolean = false): Promise<number> {
    try {
      if (supabase) {
        const tableName = isJoggingCrew ? 'jogging_crews' : 'crews'
        const { data, error } = await supabase
          .from(tableName)
          .select('rank')
          .eq('id', crewId)
          .single()

        if (error) {
          console.error('크루 계급 조회 실패:', error)
          return 1
        }

        return data?.rank || 1
      }
      return 1
    } catch (error) {
      console.error('크루 계급 조회 실패:', error)
      return 1
    }
  }

  /**
   * 크루 계급 설정
   */
  async setCrewRank(crewId: string, rank: number, isJoggingCrew: boolean = false): Promise<void> {
    try {
      if (supabase) {
        const tableName = isJoggingCrew ? 'jogging_crews' : 'crews'
        const { error } = await supabase
          .from(tableName)
          .update({ rank })
          .eq('id', crewId)

        if (error) {
          console.error('크루 계급 설정 실패:', error)
        }
      }
    } catch (error) {
      console.error('크루 계급 설정 실패:', error)
    }
  }

  /**
   * 계급별 최대 인원수 계산
   */
  getMaxMembersByRank(rank: number, isPaidMember: boolean = false): number {
    if (isPaidMember) {
      return 999999 // 유료회원은 제한없음
    }

    if (rank < 4) {
      return 5 // 1-3단계: 5명
    } else if (rank === 4) {
      return 10 // 4단계: 10명
    } else if (rank === 5) {
      return 20 // 5단계: 20명
    } else if (rank === 6) {
      return 30 // 6단계: 30명
    } else {
      return 999999 // 7단계 이상: 제한없음
    }
  }
}

export const rankService = new RankService()

