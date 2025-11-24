/**
 * 운동 세션 중복 확인 테스트 스크립트 (브라우저 콘솔용)
 * 
 * 사용법:
 * 1. 앱을 실행한 상태에서 브라우저 개발자 도구 열기 (F12)
 * 2. Console 탭 선택
 * 3. 이 파일의 내용을 복사하여 붙여넣고 Enter
 * 
 * 또는 Node.js에서 실행:
 * node check-duplicate-sessions.js
 */

(async function checkDuplicateSessions() {
  console.log('🔍 운동 세션 중복 확인 테스트 시작...\n')
  
  try {
    // 브라우저 환경에서 실행하는 경우
    if (typeof window !== 'undefined') {
      // 앱이 로드되어 있어야 함
      const { databaseService } = await import('./src/services/databaseService.js')
      const { authService } = await import('./src/services/authService.js')
      const { supabase } = await import('./src/services/supabaseClient.js')
      
      const user = authService.getCurrentUser()
      if (!user) {
        console.error('❌ 로그인된 사용자가 없습니다.')
        return
      }
      
      console.log('👤 현재 사용자:', user.email || user.name)
      console.log('📋 사용자 ID:', user.id)
      console.log('')
      
      // UUID 매핑 확인
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
              console.log('🔄 UUID 매핑 완료:', { original: user.id, mapped: supabaseUserId })
            }
          }
        }
      }
      
      console.log('\n📊 Supabase에서 직접 조회 중...\n')
      
      if (!supabase) {
        console.error('❌ Supabase 클라이언트가 없습니다.')
        return
      }
      
      // Supabase에서 모든 운동 세션 조회
      const { data: allSessions, error: queryError } = await supabase
        .from('exercise_sessions')
        .select('id, user_id, start_time, end_time, mode, config, created_at')
        .eq('user_id', supabaseUserId)
        .eq('completed', true)
        .order('end_time', { ascending: false })
      
      if (queryError) {
        console.error('❌ 세션 조회 실패:', queryError)
        return
      }
      
      console.log(`📋 총 세션 수 (Supabase 직접 조회): ${allSessions.length}개\n`)
      
      // 중복 확인: ID 기준
      const idMap = new Map()
      const duplicateById = []
      
      allSessions.forEach(session => {
        if (idMap.has(session.id)) {
          const existing = idMap.get(session.id + '_list') || []
          existing.push(session)
          idMap.set(session.id + '_list', existing)
          idMap.set(session.id, idMap.get(session.id) + 1)
        } else {
          idMap.set(session.id, 1)
          idMap.set(session.id + '_list', [session])
        }
      })
      
      // ID 중복 찾기
      idMap.forEach((count, id) => {
        if (id.endsWith('_list')) return
        if (count > 1) {
          duplicateById.push({
            id: id,
            count: count,
            sessions: idMap.get(id + '_list') || []
          })
        }
      })
      
      // 중복 확인: 시간 기준 (동일한 start_time과 end_time)
      const timeMap = new Map()
      const duplicateByTime = []
      
      allSessions.forEach(session => {
        const timeKey = `${session.start_time}_${session.end_time || 'null'}`
        if (timeMap.has(timeKey)) {
          const existing = timeMap.get(timeKey)
          existing.push(session)
          timeMap.set(timeKey, existing)
        } else {
          timeMap.set(timeKey, [session])
        }
      })
      
      // 시간 중복 찾기
      timeMap.forEach((sessions, timeKey) => {
        if (sessions.length > 1) {
          duplicateByTime.push({
            timeKey,
            startTime: sessions[0].start_time,
            endTime: sessions[0].end_time,
            sessions: sessions
          })
        }
      })
      
      // databaseService를 통한 조회 결과와 비교
      console.log('\n📊 databaseService를 통한 조회 결과...\n')
      const result = await databaseService.getExerciseSessionsByUserId(user.id, {
        limit: 100,
        offset: 0,
        orderBy: 'end_time',
        orderDirection: 'desc',
      })
      
      console.log(`📋 총 세션 수 (databaseService): ${result.sessions.length}개\n`)
      
      // databaseService 결과에서 중복 확인
      const dbIdMap = new Map()
      const dbDuplicateById = []
      
      result.sessions.forEach(session => {
        if (dbIdMap.has(session.id)) {
          const existing = dbIdMap.get(session.id + '_list') || []
          existing.push(session)
          dbIdMap.set(session.id + '_list', existing)
          dbIdMap.set(session.id, dbIdMap.get(session.id) + 1)
        } else {
          dbIdMap.set(session.id, 1)
          dbIdMap.set(session.id + '_list', [session])
        }
      })
      
      dbIdMap.forEach((count, id) => {
        if (id.endsWith('_list')) return
        if (count > 1) {
          dbDuplicateById.push({
            id: id,
            count: count,
            sessions: dbIdMap.get(id + '_list') || []
          })
        }
      })
      
      // 결과 출력
      console.log('='.repeat(80))
      console.log('🔍 중복 확인 결과')
      console.log('='.repeat(80))
      
      // Supabase 직접 조회 결과
      console.log('\n📊 Supabase 직접 조회 결과:')
      console.log(`   총 세션 수: ${allSessions.length}개`)
      console.log(`   고유 ID 수: ${Array.from(idMap.keys()).filter(k => !k.endsWith('_list')).length}개`)
      
      // ID 중복 확인
      if (duplicateById.length > 0) {
        console.log(`\n⚠️ ID 중복 발견: ${duplicateById.length}개`)
        duplicateById.forEach(dup => {
          console.log(`\n  ID: ${dup.id}`)
          console.log(`  중복 개수: ${dup.count}개`)
          dup.sessions.forEach((s, idx) => {
            console.log(`    ${idx + 1}. start_time: ${s.start_time}, end_time: ${s.end_time || 'null'}`)
            console.log(`       created_at: ${s.created_at}`)
          })
        })
      } else {
        console.log('\n✅ ID 중복 없음')
      }
      
      // 시간 중복 확인
      if (duplicateByTime.length > 0) {
        console.log(`\n⚠️ 시간 중복 발견: ${duplicateByTime.length}개`)
        duplicateByTime.forEach(dup => {
          console.log(`\n  시간: ${dup.startTime} ~ ${dup.endTime || 'null'}`)
          console.log(`  중복 개수: ${dup.sessions.length}개`)
          dup.sessions.forEach((s, idx) => {
            console.log(`    ${idx + 1}. ID: ${s.id}, mode: ${s.mode}`)
          })
        })
      } else {
        console.log('\n✅ 시간 중복 없음')
      }
      
      // databaseService 조회 결과
      console.log('\n📊 databaseService 조회 결과:')
      console.log(`   총 세션 수: ${result.total}개`)
      console.log(`   조회된 세션: ${result.sessions.length}개`)
      
      if (dbDuplicateById.length > 0) {
        console.log(`\n⚠️ databaseService 결과에서 ID 중복 발견: ${dbDuplicateById.length}개`)
        dbDuplicateById.forEach(dup => {
          console.log(`\n  ID: ${dup.id}`)
          console.log(`  중복 개수: ${dup.count}개`)
          dup.sessions.forEach((s, idx) => {
            console.log(`    ${idx + 1}. startTime: ${s.startTime ? new Date(s.startTime).toISOString() : 'null'}`)
            console.log(`       endTime: ${s.endTime ? new Date(s.endTime).toISOString() : 'null'}`)
          })
        })
      } else {
        console.log('\n✅ databaseService 결과에서 ID 중복 없음')
      }
      
      // 비교 분석
      console.log('\n' + '='.repeat(80))
      console.log('📊 비교 분석')
      console.log('='.repeat(80))
      console.log(`Supabase 직접 조회: ${allSessions.length}개`)
      console.log(`databaseService 조회: ${result.sessions.length}개`)
      console.log(`차이: ${Math.abs(allSessions.length - result.sessions.length)}개`)
      
      if (allSessions.length !== result.sessions.length) {
        console.log('\n⚠️ 조회 결과가 일치하지 않습니다!')
        console.log('가능한 원인:')
        console.log('  1. mapSupabaseExerciseSession에서 중복 생성')
        console.log('  2. 쿼리 결과 자체에 중복')
        console.log('  3. 페이지네이션 문제')
      }
      
      // ID별 그룹화하여 중복 확인
      const idGroups = new Map()
      allSessions.forEach(s => {
        if (!idGroups.has(s.id)) {
          idGroups.set(s.id, [])
        }
        idGroups.get(s.id).push(s)
      })
      
      const duplicateIds = Array.from(idGroups.entries()).filter(([id, sessions]) => sessions.length > 1)
      
      if (duplicateIds.length > 0) {
        console.log('\n' + '='.repeat(80))
        console.log('⚠️ 동일한 ID를 가진 중복 세션 상세')
        console.log('='.repeat(80))
        duplicateIds.forEach(([id, sessions]) => {
          console.log(`\nID: ${id} (${sessions.length}개)`)
          sessions.forEach((s, idx) => {
            console.log(`  ${idx + 1}. start_time: ${s.start_time}`)
            console.log(`     end_time: ${s.end_time || 'null'}`)
            console.log(`     created_at: ${s.created_at}`)
            console.log(`     mode: ${s.mode}`)
          })
        })
      }
      
      // 샘플 데이터 출력 (최근 10개)
      console.log('\n' + '='.repeat(80))
      console.log('📋 최근 10개 세션 샘플 (Supabase 직접 조회)')
      console.log('='.repeat(80))
      allSessions.slice(0, 10).forEach((s, idx) => {
        console.log(`${idx + 1}. ID: ${s.id}`)
        console.log(`   시작: ${s.start_time}`)
        console.log(`   종료: ${s.end_time || 'null'}`)
        console.log(`   모드: ${s.mode}`)
        console.log('')
      })
      
      console.log('\n📋 최근 10개 세션 샘플 (databaseService 조회)')
      console.log('='.repeat(80))
      result.sessions.slice(0, 10).forEach((s, idx) => {
        console.log(`${idx + 1}. ID: ${s.id}`)
        console.log(`   시작: ${s.startTime ? new Date(s.startTime).toISOString() : 'null'}`)
        console.log(`   종료: ${s.endTime ? new Date(s.endTime).toISOString() : 'null'}`)
        console.log(`   모드: ${s.mode}`)
        console.log('')
      })
      
    } else {
      console.error('❌ 브라우저 환경에서만 실행 가능합니다.')
    }
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error)
    console.error('에러 상세:', error.message)
    if (error.stack) {
      console.error('스택:', error.stack)
    }
  }
  
  console.log('\n✅ 테스트 완료!')
})()

