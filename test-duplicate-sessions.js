/**
 * 운동 세션 중복 확인 테스트 스크립트
 * 
 * 사용법:
 * 1. 브라우저 개발자 도구 열기 (F12)
 * 2. Console 탭 선택
 * 3. 이 파일의 내용을 복사하여 붙여넣고 Enter
 * 
 * 또는 Node.js 환경에서 실행:
 * node test-duplicate-sessions.js
 */

(async function testDuplicateSessions() {
  console.log('🔍 운동 세션 중복 확인 테스트 시작...\n')
  
  try {
    // Supabase 클라이언트 가져오기
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    
    // 환경 변수에서 Supabase 정보 가져오기 (브라우저 환경)
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
      console.log('브라우저 콘솔에서 실행하는 경우, 앱이 이미 로드되어 있어야 합니다.')
      return
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 현재 사용자 정보 가져오기 (브라우저 환경)
    let userId = null
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('currentUser')
      if (userStr) {
        const user = JSON.parse(userStr)
        userId = user.id
        console.log('👤 현재 사용자:', user.email || user.name)
        console.log('📋 사용자 ID:', userId)
      } else {
        console.error('❌ 로그인된 사용자가 없습니다.')
        return
      }
    } else {
      console.error('❌ 브라우저 환경에서만 실행 가능합니다.')
      return
    }
    
    // UUID 매핑 확인
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let supabaseUserId = userId
    
    if (!uuidRegex.test(userId)) {
      // localStorage에서 사용자 정보 가져오기
      const userStr = localStorage.getItem(`user_${userId}`)
      if (userStr) {
        const user = JSON.parse(userStr)
        if (user.email) {
          // Supabase에서 email로 사용자 찾기
          const { data: supabaseUser, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .single()
          
          if (supabaseUser) {
            supabaseUserId = supabaseUser.id
            console.log('🔄 UUID 매핑 완료:', { original: userId, mapped: supabaseUserId })
          }
        }
      }
    }
    
    console.log('\n📊 운동 세션 조회 중...\n')
    
    // 모든 운동 세션 조회 (제한 없이)
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
    
    console.log(`📋 총 세션 수: ${allSessions.length}개\n`)
    
    // 중복 확인: ID 기준
    const idMap = new Map()
    const duplicateById = []
    
    allSessions.forEach(session => {
      if (idMap.has(session.id)) {
        duplicateById.push({
          id: session.id,
          count: idMap.get(session.id) + 1,
          sessions: [...(idMap.get(session.id + '_sessions') || []), session]
        })
        idMap.set(session.id, idMap.get(session.id) + 1)
        idMap.set(session.id + '_sessions', [...(idMap.get(session.id + '_sessions') || []), session])
      } else {
        idMap.set(session.id, 1)
        idMap.set(session.id + '_sessions', [session])
      }
    })
    
    // 중복 확인: 시간 기준 (동일한 start_time과 end_time)
    const timeMap = new Map()
    const duplicateByTime = []
    
    allSessions.forEach(session => {
      const timeKey = `${session.start_time}_${session.end_time || 'null'}`
      if (timeMap.has(timeKey)) {
        const existing = timeMap.get(timeKey)
        duplicateByTime.push({
          timeKey,
          startTime: session.start_time,
          endTime: session.end_time,
          sessions: [...existing, session]
        })
        timeMap.set(timeKey, [...existing, session])
      } else {
        timeMap.set(timeKey, [session])
      }
    })
    
    // 결과 출력
    console.log('='.repeat(60))
    console.log('🔍 중복 확인 결과')
    console.log('='.repeat(60))
    
    // ID 중복 확인
    if (duplicateById.length > 0) {
      console.log('\n⚠️ ID 중복 발견:', duplicateById.length, '개')
      duplicateById.forEach(dup => {
        console.log(`\n  ID: ${dup.id}`)
        console.log(`  중복 개수: ${dup.count}개`)
        dup.sessions.forEach((s, idx) => {
          console.log(`    ${idx + 1}. start_time: ${s.start_time}, end_time: ${s.end_time}`)
        })
      })
    } else {
      console.log('\n✅ ID 중복 없음')
    }
    
    // 시간 중복 확인
    const timeDuplicates = duplicateByTime.filter(d => d.sessions.length > 1)
    if (timeDuplicates.length > 0) {
      console.log('\n⚠️ 시간 중복 발견:', timeDuplicates.length, '개')
      timeDuplicates.forEach(dup => {
        console.log(`\n  시간: ${dup.startTime} ~ ${dup.endTime || 'null'}`)
        console.log(`  중복 개수: ${dup.sessions.length}개`)
        dup.sessions.forEach((s, idx) => {
          console.log(`    ${idx + 1}. ID: ${s.id}, mode: ${s.mode}`)
        })
      })
    } else {
      console.log('\n✅ 시간 중복 없음')
    }
    
    // 통계
    console.log('\n' + '='.repeat(60))
    console.log('📊 통계')
    console.log('='.repeat(60))
    console.log(`총 세션 수: ${allSessions.length}개`)
    console.log(`고유 ID 수: ${idMap.size}개`)
    console.log(`ID 중복: ${duplicateById.length}개`)
    console.log(`시간 중복: ${timeDuplicates.length}개`)
    
    // 샘플 데이터 출력 (최근 5개)
    console.log('\n' + '='.repeat(60))
    console.log('📋 최근 5개 세션 샘플')
    console.log('='.repeat(60))
    allSessions.slice(0, 5).forEach((s, idx) => {
      console.log(`${idx + 1}. ID: ${s.id}`)
      console.log(`   시작: ${s.start_time}`)
      console.log(`   종료: ${s.end_time || 'null'}`)
      console.log(`   모드: ${s.mode}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error)
  }
})()

