/**
 * 운동 세션 중복 확인 테스트 (브라우저 콘솔에서 바로 실행)
 * 
 * 사용법:
 * 1. 앱 실행 후 브라우저 개발자 도구 열기 (F12)
 * 2. Console 탭 선택
 * 3. 아래 코드를 복사하여 붙여넣고 Enter
 */

// 브라우저 콘솔에서 실행할 수 있도록 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.testDuplicateSessions = async function() {
    console.log('🔍 운동 세션 중복 확인 테스트 시작...\n')
    
    try {
      // 동적 import (Vite 환경)
      const { databaseService } = await import('/src/services/databaseService.ts')
      const { authService } = await import('/src/services/authService.ts')
      const { supabase } = await import('/src/services/supabaseClient.ts')
      
      const user = authService.getCurrentUser()
      if (!user) {
        console.error('❌ 로그인된 사용자가 없습니다.')
        return
      }
      
      console.log('👤 현재 사용자:', user.email || user.name)
      console.log('📋 사용자 ID:', user.id)
      console.log('')
      
      // UUID 매핑
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let supabaseUserId = user.id
      
      if (!uuidRegex.test(user.id) && supabase) {
        const userStr = localStorage.getItem(`user_${user.id}`)
        if (userStr) {
          const userData = JSON.parse(userStr)
          if (userData.email) {
            const { data: supabaseUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', userData.email)
              .single()
            
            if (supabaseUser) {
              supabaseUserId = supabaseUser.id
            }
          }
        }
      }
      
      // 1. Supabase에서 직접 조회
      console.log('📊 1. Supabase 직접 조회...\n')
      const { data: supabaseSessions, error } = await supabase
        .from('exercise_sessions')
        .select('id, user_id, start_time, end_time, mode, created_at')
        .eq('user_id', supabaseUserId)
        .eq('completed', true)
        .order('end_time', { ascending: false })
      
      if (error) {
        console.error('❌ 조회 실패:', error)
        return
      }
      
      console.log(`   총 ${supabaseSessions.length}개 세션 발견\n`)
      
      // 2. databaseService를 통한 조회
      console.log('📊 2. databaseService 조회...\n')
      const result = await databaseService.getExerciseSessionsByUserId(user.id, {
        limit: 100,
        offset: 0,
        orderBy: 'end_time',
        orderDirection: 'desc',
      })
      
      console.log(`   총 ${result.sessions.length}개 세션 발견\n`)
      
      // 3. 중복 확인: ID 기준
      console.log('🔍 3. ID 중복 확인...\n')
      const idCount = new Map()
      supabaseSessions.forEach(s => {
        idCount.set(s.id, (idCount.get(s.id) || 0) + 1)
      })
      
      const duplicateIds = Array.from(idCount.entries()).filter(([id, count]) => count > 1)
      
      if (duplicateIds.length > 0) {
        console.log(`⚠️ ID 중복 발견: ${duplicateIds.length}개\n`)
        duplicateIds.forEach(([id, count]) => {
          const sessions = supabaseSessions.filter(s => s.id === id)
          console.log(`  ID: ${id} (${count}개)`)
          sessions.forEach((s, idx) => {
            console.log(`    ${idx + 1}. start: ${s.start_time}, end: ${s.end_time || 'null'}`)
          })
        })
      } else {
        console.log('✅ ID 중복 없음\n')
      }
      
      // 4. 중복 확인: 시간 기준
      console.log('🔍 4. 시간 중복 확인...\n')
      const timeCount = new Map()
      supabaseSessions.forEach(s => {
        const key = `${s.start_time}_${s.end_time || 'null'}`
        timeCount.set(key, (timeCount.get(key) || 0) + 1)
      })
      
      const duplicateTimes = Array.from(timeCount.entries()).filter(([key, count]) => count > 1)
      
      if (duplicateTimes.length > 0) {
        console.log(`⚠️ 시간 중복 발견: ${duplicateTimes.length}개\n`)
        duplicateTimes.forEach(([key, count]) => {
          const [start, end] = key.split('_')
          const sessions = supabaseSessions.filter(s => 
            s.start_time === start && (s.end_time || 'null') === end
          )
          console.log(`  시간: ${start} ~ ${end} (${count}개)`)
          sessions.forEach((s, idx) => {
            console.log(`    ${idx + 1}. ID: ${s.id}, mode: ${s.mode}`)
          })
        })
      } else {
        console.log('✅ 시간 중복 없음\n')
      }
      
      // 5. databaseService 결과에서 중복 확인
      console.log('🔍 5. databaseService 결과 중복 확인...\n')
      const dbIdCount = new Map()
      result.sessions.forEach(s => {
        dbIdCount.set(s.id, (dbIdCount.get(s.id) || 0) + 1)
      })
      
      const dbDuplicateIds = Array.from(dbIdCount.entries()).filter(([id, count]) => count > 1)
      
      if (dbDuplicateIds.length > 0) {
        console.log(`⚠️ databaseService 결과에서 ID 중복 발견: ${dbDuplicateIds.length}개\n`)
        dbDuplicateIds.forEach(([id, count]) => {
          const sessions = result.sessions.filter(s => s.id === id)
          console.log(`  ID: ${id} (${count}개)`)
          sessions.forEach((s, idx) => {
            console.log(`    ${idx + 1}. start: ${s.startTime}, end: ${s.endTime || 'null'}`)
          })
        })
      } else {
        console.log('✅ databaseService 결과에서 ID 중복 없음\n')
      }
      
      // 6. 비교 분석
      console.log('='.repeat(80))
      console.log('📊 비교 분석')
      console.log('='.repeat(80))
      console.log(`Supabase 직접 조회: ${supabaseSessions.length}개`)
      console.log(`databaseService 조회: ${result.sessions.length}개`)
      console.log(`차이: ${Math.abs(supabaseSessions.length - result.sessions.length)}개`)
      
      if (supabaseSessions.length !== result.sessions.length) {
        console.log('\n⚠️ 조회 결과가 일치하지 않습니다!')
      }
      
      // 7. 최근 5개 세션 샘플
      console.log('\n' + '='.repeat(80))
      console.log('📋 최근 5개 세션 샘플')
      console.log('='.repeat(80))
      supabaseSessions.slice(0, 5).forEach((s, idx) => {
        console.log(`${idx + 1}. ID: ${s.id}`)
        console.log(`   시작: ${s.start_time}`)
        console.log(`   종료: ${s.end_time || 'null'}`)
        console.log(`   모드: ${s.mode}`)
        console.log('')
      })
      
    } catch (error) {
      console.error('❌ 테스트 실행 중 오류:', error)
    }
    
    console.log('\n✅ 테스트 완료!')
    console.log('💡 브라우저 콘솔에서 testDuplicateSessions()를 다시 실행할 수 있습니다.')
  }
  
  console.log('💡 testDuplicateSessions() 함수가 준비되었습니다.')
  console.log('   브라우저 콘솔에서 testDuplicateSessions()를 실행하세요.')
}

