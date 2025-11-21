/**
 * Supabase 데이터 확인 스크립트
 * 
 * 사용법:
 * 1. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 설정되어 있어야 합니다.
 * 2. 터미널에서 실행: node check-supabase-data.js
 * 
 * 또는 환경 변수로 직접 설정:
 * SUPABASE_URL=your-url SUPABASE_KEY=your-key node check-supabase-data.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

// 현재 파일의 디렉토리 경로
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env 파일 로드
config({ path: join(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.')
  console.error('   .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log('🔍 Supabase 데이터 확인 시작...\n')
  console.log('📊 Supabase URL:', supabaseUrl)
  console.log('')

  try {
    // 1. exercise_sessions 테이블의 모든 데이터 확인
    console.log('1️⃣ exercise_sessions 테이블 데이터 확인...')
    const { data: allSessions, error: allError } = await supabase
      .from('exercise_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (allError) {
      console.error('❌ 조회 실패:', allError.message)
    } else {
      console.log(`   ✅ 총 ${allSessions?.length || 0}개의 세션 발견`)
      if (allSessions && allSessions.length > 0) {
        console.log('   📋 최근 세션 샘플:')
        allSessions.slice(0, 3).forEach((session, index) => {
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

    // 3. completed가 false이거나 null인 세션 확인
    console.log('3️⃣ completed=false 또는 null인 세션 확인...')
    const { count: incompleteCount, error: incompleteError } = await supabase
      .from('exercise_sessions')
      .select('*', { count: 'exact', head: true })
      .or('completed.is.null,completed.eq.false')

    if (incompleteError) {
      console.error('❌ 조회 실패:', incompleteError.message)
    } else {
      console.log(`   ⚠️  미완료 세션: ${incompleteCount || 0}개`)
    }

    // 4. 사용자별 세션 개수 확인
    console.log('4️⃣ 사용자별 세션 개수 확인...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')

    if (usersError) {
      console.error('❌ 사용자 조회 실패:', usersError.message)
    } else {
      console.log(`   ✅ 총 ${users?.length || 0}명의 사용자`)
      
      if (users && users.length > 0) {
        for (const user of users) {
          const { count: userSessionCount, error: userSessionError } = await supabase
            .from('exercise_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

          const { count: completedSessionCount, error: completedSessionError } = await supabase
            .from('exercise_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('completed', true)

          if (!userSessionError && !completedSessionError) {
            console.log(`   👤 ${user.name} (${user.email}):`)
            console.log(`      - 전체 세션: ${userSessionCount || 0}개`)
            console.log(`      - 완료된 세션: ${completedSessionCount || 0}개`)
          }
        }
      }
    }

    // 5. 최근 저장된 세션 상세 확인
    console.log('5️⃣ 최근 저장된 세션 상세 확인...')
    const { data: recentSessions, error: recentError } = await supabase
      .from('exercise_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) {
      console.error('❌ 조회 실패:', recentError.message)
    } else if (recentSessions && recentSessions.length > 0) {
      console.log('   📋 최근 5개 세션:')
      recentSessions.forEach((session, index) => {
        console.log(`      ${index + 1}. 세션 ID: ${session.id}`)
        console.log(`         - 생성일: ${session.created_at || '없음'}`)
        console.log(`         - 시작시간: ${session.start_time || '없음'}`)
        console.log(`         - 종료시간: ${session.end_time || '없음'}`)
        console.log(`         - 완료여부: ${session.completed ? '✅ 완료' : '❌ 미완료'}`)
        console.log(`         - 평균점수: ${session.average_score || 0}`)
        console.log(`         - 카운트 개수: ${Array.isArray(session.counts) ? session.counts.length : 0}`)
        console.log('')
      })
    } else {
      console.log('   ⚠️  저장된 세션이 없습니다.')
    }

    console.log('\n✅ 데이터 확인 완료!')
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  }
}

checkData()

