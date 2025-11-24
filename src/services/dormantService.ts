/**
 * 휴면 모드 서비스
 * 30일 미사용 방 자동 휴면 지정
 * 휴면 해제 후 7일 자동 삭제
 */

import { supabase } from './supabaseClient'

class DormantService {
  // 30일 미사용 크루를 휴면 모드로 지정
  async markDormantCrews(): Promise<{ marked: number; errors: number }> {
    let marked = 0
    let errors = 0

    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // 일반 크루 휴면 지정
      const { data: crews, error: crewsError } = await supabase
        .from('crews')
        .select('id, last_activity_at, is_dormant')
        .eq('is_dormant', false)
        .lt('last_activity_at', thirtyDaysAgo.toISOString())

      if (!crewsError && crews) {
        for (const crew of crews) {
          try {
            const { error } = await supabase
              .from('crews')
              .update({
                is_dormant: true,
                dormant_at: new Date().toISOString(),
              })
              .eq('id', crew.id)

            if (error) {
              console.error(`크루 ${crew.id} 휴면 지정 실패:`, error)
              errors++
            } else {
              marked++
            }
          } catch (error) {
            console.error(`크루 ${crew.id} 휴면 지정 중 오류:`, error)
            errors++
          }
        }
      }

      // 조깅 크루 휴면 지정
      const { data: joggingCrews, error: joggingCrewsError } = await supabase
        .from('jogging_crews')
        .select('id, last_activity_at, is_dormant')
        .eq('is_dormant', false)
        .lt('last_activity_at', thirtyDaysAgo.toISOString())

      if (!joggingCrewsError && joggingCrews) {
        for (const crew of joggingCrews) {
          try {
            const { error } = await supabase
              .from('jogging_crews')
              .update({
                is_dormant: true,
                dormant_at: new Date().toISOString(),
              })
              .eq('id', crew.id)

            if (error) {
              console.error(`조깅 크루 ${crew.id} 휴면 지정 실패:`, error)
              errors++
            } else {
              marked++
            }
          } catch (error) {
            console.error(`조깅 크루 ${crew.id} 휴면 지정 중 오류:`, error)
            errors++
          }
        }
      }

      return { marked, errors }
    } catch (error) {
      console.error('휴면 모드 지정 중 오류:', error)
      return { marked, errors: errors + 1 }
    }
  }

  // 휴면 해제 후 7일 경과한 크루 자동 삭제
  async deleteScheduledCrews(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0
    let errors = 0

    try {
      const now = new Date()

      // 일반 크루 삭제
      const { data: crews, error: crewsError } = await supabase
        .from('crews')
        .select('id, scheduled_deletion_at')
        .not('scheduled_deletion_at', 'is', null)
        .lte('scheduled_deletion_at', now.toISOString())

      if (!crewsError && crews) {
        for (const crew of crews) {
          try {
            const { error } = await supabase
              .from('crews')
              .delete()
              .eq('id', crew.id)

            if (error) {
              console.error(`크루 ${crew.id} 삭제 실패:`, error)
              errors++
            } else {
              deleted++
            }
          } catch (error) {
            console.error(`크루 ${crew.id} 삭제 중 오류:`, error)
            errors++
          }
        }
      }

      // 조깅 크루 삭제
      const { data: joggingCrews, error: joggingCrewsError } = await supabase
        .from('jogging_crews')
        .select('id, scheduled_deletion_at')
        .not('scheduled_deletion_at', 'is', null)
        .lte('scheduled_deletion_at', now.toISOString())

      if (!joggingCrewsError && joggingCrews) {
        for (const crew of joggingCrews) {
          try {
            const { error } = await supabase
              .from('jogging_crews')
              .delete()
              .eq('id', crew.id)

            if (error) {
              console.error(`조깅 크루 ${crew.id} 삭제 실패:`, error)
              errors++
            } else {
              deleted++
            }
          } catch (error) {
            console.error(`조깅 크루 ${crew.id} 삭제 중 오류:`, error)
            errors++
          }
        }
      }

      return { deleted, errors }
    } catch (error) {
      console.error('자동 삭제 중 오류:', error)
      return { deleted, errors: errors + 1 }
    }
  }

  // 크루 활동 시간 업데이트 (크루 입장, 채팅, 운동 등 활동 시 호출)
  async updateCrewActivity(crewId: string, isJoggingCrew: boolean = false): Promise<void> {
    try {
      const tableName = isJoggingCrew ? 'jogging_crews' : 'crews'
      
      await supabase
        .from(tableName)
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', crewId)
    } catch (error) {
      console.error('크루 활동 시간 업데이트 실패:', error)
    }
  }
}

export const dormantService = new DormantService()

