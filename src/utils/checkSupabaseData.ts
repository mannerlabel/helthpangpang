/**
 * Supabase 데이터 확인 유틸리티
 * 브라우저 콘솔에서 실행하거나, 개발 중 디버깅용으로 사용
 */

import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { supabase } from '@/services/supabaseClient'

export async function checkSupabaseData() {
  console.log('🔍 Supabase 데이터 확인 시작...\n')
  
  try {
    const user = authService.getCurrentUser()
    if (!user) {
      console.error('❌ 로그인된 사용자가 없습니다.')
      return
    }
    
    console.log('👤 현재 사용자:', user.email || user.name)
    console.log('📋 사용자 ID:', user.id)
    console.log('')
    
    // 1. exercise_sessions 테이블의 모든 데이터 확인 (Supabase 직접 조회)
    console.log('1️⃣ exercise_sessions 테이블 전체 데이터 확인...')
    if (supabase) {
      const { data: allSessions, error: allError } = await supabase
        .from('exercise_sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(20)
      
      if (allError) {
        console.error('❌ 조회 실패:', allError.message)
      } else {
        console.log(`   ✅ 총 ${allSessions?.length || 0}개의 세션 발견`)
        if (allSessions && allSessions.length > 0) {
          console.log('   📋 최근 세션 샘플:')
          allSessions.slice(0, 3).forEach((session: any, index: number) => {
            console.log(`      ${index + 1}. ID: ${session.id}`)
            console.log(`         - user_id: ${session.user_id}`)
            console.log(`         - completed: ${session.completed}`)
            console.log(`         - mode: ${session.mode}`)
            console.log(`         - end_time: ${session.end_time || '없음'}`)
            console.log(`         - average_score: ${session.average_score || 0}`)
            console.log(`         - best_score: ${session.best_score ? '있음' : '없음'}`)
            console.log(`         - worst_score: ${session.worst_score ? '있음' : '없음'}`)
            console.log(`         - analysis: ${session.analysis ? '있음' : '없음'}`)
            console.log(`         - counts 개수: ${Array.isArray(session.counts) ? session.counts.length : 0}`)
            console.log('')
          })
        }
      }
      
      // 2. completed가 true인 세션만 확인
      console.log('2️⃣ completed=true인 세션 확인...')
      const { count: completedCount, error: completedError } = await supabase
        .from('exercise_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('completed', true)
      
      if (completedError) {
        console.error('❌ 조회 실패:', completedError.message)
      } else {
        console.log(`   ✅ completed=true인 세션: ${completedCount || 0}개`)
      }
      
      // 3. 현재 사용자의 세션 확인 (Supabase 직접 조회)
      console.log('3️⃣ 현재 사용자의 세션 확인 (Supabase 직접 조회)...')
      console.log(`   🔍 조회할 user_id: ${user.id}`)
      
      // 먼저 사용자 정보 확인
      const { data: userInfo, error: userInfoError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', user.id)
        .single()
      
      if (userInfoError) {
        console.error('❌ 사용자 정보 조회 실패:', userInfoError.message)
        console.log('   ⚠️  Supabase에 현재 사용자가 등록되어 있지 않을 수 있습니다.')
      } else {
        console.log('   ✅ 사용자 정보 확인:', {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
        })
      }
      
      const { data: userSessions, error: userSessionsError } = await supabase
        .from('exercise_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(20)
      
      if (userSessionsError) {
        console.error('❌ 사용자 세션 조회 실패:', userSessionsError.message)
      } else {
        console.log(`   ✅ 현재 사용자의 전체 세션: ${userSessions?.length || 0}개`)
        if (userSessions && userSessions.length > 0) {
          const completedSessions = userSessions.filter((s: any) => s.completed === true)
          const incompleteSessions = userSessions.filter((s: any) => s.completed !== true)
          console.log(`      - 완료된 세션: ${completedSessions.length}개`)
          console.log(`      - 미완료 세션: ${incompleteSessions.length}개`)
          console.log('')
          console.log('   📋 세션 상세:')
          userSessions.forEach((session: any, index: number) => {
            console.log(`      ${index + 1}. 세션 ID: ${session.id}`)
            console.log(`         - completed: ${session.completed}`)
            console.log(`         - mode: ${session.mode}`)
            console.log(`         - start_time: ${session.start_time || '없음'}`)
            console.log(`         - end_time: ${session.end_time || '없음'}`)
            console.log(`         - average_score: ${session.average_score || 0}`)
            console.log('')
          })
        } else {
          console.log('   ⚠️  현재 사용자의 세션이 없습니다.')
          console.log('')
          console.log('   🔍 다른 사용자의 세션 확인:')
          const { data: otherSessions } = await supabase
            .from('exercise_sessions')
            .select('user_id, completed, mode, start_time')
            .neq('user_id', user.id)
            .limit(5)
          
          if (otherSessions && otherSessions.length > 0) {
            console.log(`      - 다른 사용자의 세션: ${otherSessions.length}개 발견`)
            console.log('      - 이 세션들은 다른 사용자로 저장되었습니다.')
            console.log('      - 현재 사용자로 운동을 완료하면 세션이 표시됩니다.')
          }
        }
      }
      
      // 4. databaseService를 통한 조회 (비교용)
      console.log('4️⃣ databaseService를 통한 조회 (비교용)...')
      const result = await databaseService.getExerciseSessionsByUserId(user.id, {
        limit: 20,
        offset: 0,
        orderBy: 'end_time',
        orderDirection: 'desc',
      })
      
      console.log('📊 databaseService를 통한 조회 결과:')
      console.log(`   - 총 세션 수: ${result.total}개`)
      console.log(`   - 조회된 세션: ${result.sessions.length}개`)
      console.log(`   - 더 많은 데이터: ${result.hasMore ? '예' : '아니오'}`)
      console.log('')
      
      if (result.sessions.length > 0) {
        console.log('📋 세션 상세 정보:')
        result.sessions.forEach((session, index) => {
          console.log(`   ${index + 1}. 세션 ID: ${session.id}`)
          console.log(`      - 모드: ${session.mode}`)
          console.log(`      - 시작시간: ${session.startTime ? new Date(session.startTime).toLocaleString('ko-KR') : '없음'}`)
          console.log(`      - 종료시간: ${session.endTime ? new Date(session.endTime).toLocaleString('ko-KR') : '없음'}`)
          console.log(`      - 완료여부: ${session.completed ? '✅ 완료' : '❌ 미완료'}`)
          console.log(`      - 평균점수: ${session.averageScore || 0}`)
          console.log(`      - 카운트 개수: ${session.counts?.length || 0}`)
          console.log(`      - 최고점수: ${session.bestScore ? session.bestScore.score + '점' : '없음'}`)
          console.log(`      - 최저점수: ${session.worstScore ? session.worstScore.score + '점' : '없음'}`)
          console.log(`      - AI 분석: ${session.analysis ? '있음' : '없음'}`)
          console.log('')
        })
      } else {
        console.log('⚠️  databaseService로 조회된 세션이 없습니다.')
        console.log('')
        console.log('🔍 문제 분석:')
        console.log('   - Supabase에는 completed=true인 세션이 4개 있습니다.')
        console.log('   - 하지만 현재 사용자의 세션은 조회되지 않습니다.')
        console.log('   - 가능한 원인:')
        console.log('     1. 다른 사용자의 세션일 수 있습니다.')
        console.log('     2. user_id 매핑 문제일 수 있습니다.')
        console.log('     3. completed 필드가 true가 아닐 수 있습니다.')
        console.log('')
        console.log('💡 해결 방법:')
        console.log('   1. 위의 "3️⃣ 현재 사용자의 세션 확인" 결과를 확인하세요.')
        console.log('   2. Supabase 대시보드에서 exercise_sessions 테이블을 직접 확인하세요.')
        console.log('   3. user_id와 completed 필드를 확인하세요.')
      }
    } else {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.')
    }
    
    console.log('\n✅ 확인 완료!')
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    console.error('   에러 상세:', error instanceof Error ? error.message : String(error))
    console.error('   스택:', error instanceof Error ? error.stack : undefined)
  }
}

// 브라우저 콘솔에서 쉽게 접근할 수 있도록 전역에 등록
if (typeof window !== 'undefined') {
  (window as any).checkSupabaseData = checkSupabaseData
  console.log('💡 브라우저 콘솔에서 checkSupabaseData() 함수를 실행하여 데이터를 확인할 수 있습니다.')
}

