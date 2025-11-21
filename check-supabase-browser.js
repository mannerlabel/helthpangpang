/**
 * 브라우저 콘솔에서 실행할 수 있는 Supabase 데이터 확인 스크립트
 * 
 * 사용법:
 * 1. 앱을 실행한 상태에서 브라우저 개발자 도구 열기 (F12)
 * 2. Console 탭 선택
 * 3. 아래 코드를 복사하여 붙여넣고 Enter
 * 
 * 또는 이 파일의 내용을 브라우저 콘솔에 직접 붙여넣기
 */

(async function checkSupabaseData() {
  console.log('🔍 Supabase 데이터 확인 시작...\n')
  
  // Supabase 클라이언트 가져오기 (앱에서 이미 초기화되어 있어야 함)
  // 만약 직접 접근이 안 되면, databaseService를 통해 확인
  
  try {
    // 방법 1: databaseService를 통한 확인 (권장)
    if (typeof window !== 'undefined' && window.databaseService) {
      const user = window.authService?.getCurrentUser()
      if (!user) {
        console.error('❌ 로그인된 사용자가 없습니다.')
        return
      }
      
      console.log('👤 현재 사용자:', user.email || user.name)
      console.log('📋 사용자 ID:', user.id)
      console.log('')
      
      // 운동 세션 조회
      const result = await window.databaseService.getExerciseSessionsByUserId(user.id, {
        limit: 20,
        offset: 0,
        orderBy: 'end_time',
        orderDirection: 'desc',
      })
      
      console.log('📊 조회 결과:')
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
        console.log('⚠️  조회된 세션이 없습니다.')
        console.log('')
        console.log('🔍 문제 해결 방법:')
        console.log('   1. 운동을 완료했는지 확인 (ResultPage에서 "저장" 버튼 클릭)')
        console.log('   2. Supabase 대시보드에서 exercise_sessions 테이블 확인')
        console.log('   3. 브라우저 콘솔의 에러 메시지 확인')
      }
    } else {
      // 방법 2: 직접 Supabase 클라이언트 사용
      console.log('⚠️  databaseService를 찾을 수 없습니다.')
      console.log('   앱이 실행 중인지 확인하거나, Supabase 대시보드에서 직접 확인하세요.')
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    console.error('   에러 상세:', error.message)
    console.error('   스택:', error.stack)
  }
  
  console.log('\n✅ 확인 완료!')
})()

