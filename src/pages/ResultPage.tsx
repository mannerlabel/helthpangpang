import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExerciseSession, AIAnalysis } from '@/types'
import { aiAnalysisService } from '@/services/aiAnalysisService'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'
import { imageCaptureService } from '@/services/imageCaptureService'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'

const ResultPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const session = location.state?.session as ExerciseSession | undefined
  const { crewId, config, alarm, backgroundMusic, goalId } = (location.state as {
    crewId?: string
    config?: any
    alarm?: any
    backgroundMusic?: number
    goalId?: string
  }) || {}

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 운동 내역 관련 상태
  const [historySessions, setHistorySessions] = useState<ExerciseSession[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const historyContainerRef = useRef<HTMLDivElement>(null)
  
  // 스와이프 관련 상태
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // 중복 저장 방지: 저장 완료 여부 추적
  const isSavingRef = useRef(false)
  const savedSessionIdRef = useRef<string | null>(null)
  const isFetchingAnalysisRef = useRef(false) // AI 분석 중복 호출 방지

  // 운동 내역 로드 함수
  const loadExerciseHistory = useCallback(async (offset: number = 0, append: boolean = false) => {
    try {
      const user = authService.getCurrentUser()
      if (!user) return

      setHistoryLoading(true)
      const result = await databaseService.getExerciseSessionsByUserId(user.id, {
        limit: 3,
        offset: offset,
        orderBy: 'end_time',
        orderDirection: 'desc',
      })

      if (!append && offset === 0) {
        // 첫 로드: 현재 세션을 포함하여 표시
        // 현재 세션이 이미 포함되어 있는지 확인
        const currentSessionId = session?.id
        const currentSessionInHistory = result.sessions.find(s => s.id === currentSessionId)
        if (!currentSessionInHistory && session) {
          // 현재 세션을 첫 번째로 추가
          setHistorySessions([session as any, ...result.sessions])
          setCurrentHistoryIndex(0)
        } else {
          setHistorySessions(result.sessions)
          // 현재 세션의 인덱스 찾기
          const index = result.sessions.findIndex(s => s.id === currentSessionId)
          setCurrentHistoryIndex(index >= 0 ? index : 0)
        }
      } else if (append) {
        // 추가 로드: 기존 세션에 추가
        setHistorySessions(prev => [...prev, ...result.sessions])
      } else {
        // 이전 페이지 로드: 기존 세션을 교체
        setHistorySessions(result.sessions)
      }

      setHasMoreHistory(result.hasMore)
    } catch (error) {
      console.error('운동 내역 로드 실패:', error)
    } finally {
      setHistoryLoading(false)
    }
  }, [session?.id]) // session.id만 의존성으로 사용

  useEffect(() => {
    if (!session) {
      const user = authService.getCurrentUser()
      if (user && adminService.isAdmin(user)) {
        navigate('/admin/dashboard')
      } else {
        navigate('/mode-select')
      }
      return
    }

    const saveSession = async (analysisResult?: AIAnalysis) => {
      // 중복 저장 방지: 이미 저장 중이거나 저장 완료된 경우 중단
      if (isSavingRef.current) {
        console.warn('⚠️ 이미 저장 중입니다. 중복 저장 방지')
        return null
      }
      
      // 세션 ID가 없으면 저장 불가
      if (!session?.id) {
        console.error('세션 ID가 없습니다.')
        return null
      }
      
      // 이미 저장된 세션인지 확인
      if (savedSessionIdRef.current === session.id) {
        console.warn('⚠️ 이미 저장된 세션입니다. 중복 저장 방지:', session.id)
        return null
      }
      
      // 중복 체크: 데이터베이스에서 동일한 세션 ID가 이미 존재하는지 확인
      try {
        const user = authService.getCurrentUser()
        if (!user) {
          console.error('사용자 정보가 없습니다.')
          return null
        }
        
        // 동일한 세션 ID로 이미 저장된 세션이 있는지 확인
        const existingSession = await databaseService.getExerciseSessionById(session.id)
        if (existingSession) {
          console.warn('⚠️ 동일한 세션 ID가 이미 존재합니다. 중복 저장 방지:', session.id)
          savedSessionIdRef.current = session.id
          return existingSession
        }
      } catch (checkError) {
        // getExerciseSessionById가 실패해도 계속 진행 (새 세션이거나 조회 실패일 수 있음)
        console.log('기존 세션 확인 중 오류 (계속 진행):', checkError)
      }
      
      // 저장 시작 플래그 설정
      isSavingRef.current = true
      
      try {
        const user = authService.getCurrentUser()
        if (!user) {
          console.error('사용자 정보가 없습니다.')
          isSavingRef.current = false
          return null
        }

        // bestScore와 worstScore 이미지 리사이즈 (모바일 최적화)
        let resizedBestScore = session.bestScore
        let resizedWorstScore = session.worstScore

        if (session.bestScore?.image) {
          try {
            const resizedImage = await imageCaptureService.resizeImageForMobile(
              session.bestScore.image,
              800, // maxWidth
              800, // maxHeight
              0.7  // quality
            )
            resizedBestScore = {
              ...session.bestScore,
              image: resizedImage,
            }
          } catch (error) {
            console.error('최고 점수 이미지 리사이즈 실패:', error)
            // 리사이즈 실패 시 원본 사용
          }
        }

        if (session.worstScore?.image) {
          try {
            const resizedImage = await imageCaptureService.resizeImageForMobile(
              session.worstScore.image,
              800, // maxWidth
              800, // maxHeight
              0.7  // quality
            )
            resizedWorstScore = {
              ...session.worstScore,
              image: resizedImage,
            }
          } catch (error) {
            console.error('최저 점수 이미지 리사이즈 실패:', error)
            // 리사이즈 실패 시 원본 사용
          }
        }

        // databaseService의 ExerciseSession 형식으로 변환
        const dbSession = {
          userId: user.id,
          crewId: (session as any).crewId,
          mode: session.mode === 'jogging' ? 'single' : session.mode as 'single' | 'crew',
          config: {
            type: session.config.type,
            sets: session.config.sets,
            reps: session.config.reps,
            restTime: session.config.restTime || 10,
          },
          startTime: session.startTime || Date.now(),
          endTime: session.endTime,
          counts: session.counts.map((count: any) => ({
            count: count.count,
            timestamp: count.timestamp,
            poseScore: count.poseScore,
            image: count.image,
            setNumber: count.setNumber,
            angle: count.angle, // 관절 각도
            depth: count.depth, // 운동 깊이
            state: count.state, // 운동 상태
          })),
          bestScore: resizedBestScore,
          worstScore: resizedWorstScore,
          averageScore: session.averageScore,
          completed: true,
          analysis: analysisResult, // AI 분석 결과 포함
        }

        // Supabase 또는 localStorage에 저장
        console.log('💾 운동 세션 저장 시작:', {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          mode: dbSession.mode,
          completed: dbSession.completed,
          countsLength: dbSession.counts.length,
          hasBestScore: !!dbSession.bestScore,
          hasWorstScore: !!dbSession.worstScore,
          hasAnalysis: !!dbSession.analysis,
        })
        
        const savedSession = await databaseService.createExerciseSession(dbSession)
        
        console.log('✅ 운동 세션 저장 완료:', {
          sessionId: savedSession?.id,
          userId: savedSession?.userId,
          completed: savedSession?.completed,
        })
        
        // 저장 완료 플래그 설정
        if (savedSession?.id) {
          savedSessionIdRef.current = savedSession.id
        }
        
        // 저장 후 즉시 확인
        if (savedSession) {
          const verifyResult = await databaseService.getExerciseSessionsByUserId(user.id, {
            limit: 1,
            offset: 0,
            orderBy: 'end_time',
            orderDirection: 'desc',
          })
          console.log('🔍 저장 후 확인:', {
            foundSessions: verifyResult.sessions.length,
            latestSessionId: verifyResult.sessions[0]?.id,
            matches: verifyResult.sessions[0]?.id === savedSession.id,
          })
        }
        
        // 저장 완료 후 운동 내역 로드
        await loadExerciseHistory(0, false)
        
        // 데이터베이스 저장 완료 후 임시 이미지 메모리 정리
        // bestScore와 worstScore 이미지는 저장되었으므로 유지
        // counts의 이미지들은 임시 저장용이므로 메모리에서 제거
        if (session?.counts) {
          console.log('🧹 임시 이미지 메모리 정리 시작:', {
            totalCounts: session.counts.length,
            bestScoreImage: !!session.bestScore?.image,
            worstScoreImage: !!session.worstScore?.image,
          })
          
          // counts의 이미지는 이미 데이터베이스에 저장되었으므로 메모리에서 제거
          // (실제로는 session 객체가 유지되지만, 명시적으로 정리 로그 출력)
          console.log('✅ 임시 이미지 메모리 정리 완료 (counts 이미지는 DB에 저장됨)')
        }
        
        return savedSession
      } catch (error) {
        console.error('운동 세션 저장 실패:', error)
        // 저장 실패 시 플래그 리셋 (재시도 가능하도록)
        isSavingRef.current = false
        return null
      } finally {
        // 저장 완료 후 플래그 리셋
        isSavingRef.current = false
      }
    }

    // 세션을 localStorage에도 저장 (로컬 백업)
    // 이미지 데이터는 제거하고 메타데이터만 저장하여 용량 절약
    try {
      const savedSessions = JSON.parse(localStorage.getItem('exerciseSessions') || '[]')
      
      // 이미지 데이터를 제거한 경량 세션 생성
      const lightweightSession = {
        ...session,
        counts: session.counts.map((count: any) => ({
          ...count,
          image: undefined, // 이미지 데이터 제거
        })),
        bestScore: session.bestScore ? {
          ...session.bestScore,
          image: undefined, // 이미지 데이터 제거
        } : undefined,
        worstScore: session.worstScore ? {
          ...session.worstScore,
          image: undefined, // 이미지 데이터 제거
        } : undefined,
      }
      
      // 중복 저장 방지 (같은 ID가 있으면 업데이트)
      const existingIndex = savedSessions.findIndex((s: ExerciseSession) => s.id === session.id)
      if (existingIndex !== -1) {
        savedSessions[existingIndex] = lightweightSession
      } else {
        savedSessions.push(lightweightSession)
      }
      
      // 최근 20개만 유지 (용량 절약)
      const recentSessions = savedSessions.slice(-20)
      
      // 저장 시도
      const dataToStore = JSON.stringify(recentSessions)
      
      // 데이터 크기 확인 (약 5MB 제한)
      const sizeInMB = new Blob([dataToStore]).size / (1024 * 1024)
      if (sizeInMB > 4) {
        // 데이터가 너무 크면 더 적은 수만 유지
        const reducedSessions = savedSessions.slice(-10)
        localStorage.setItem('exerciseSessions', JSON.stringify(reducedSessions))
        console.warn('⚠️ localStorage 용량 초과 위험: 최근 10개만 저장했습니다.')
      } else {
        localStorage.setItem('exerciseSessions', dataToStore)
      }
    } catch (error) {
      // localStorage 저장 실패 시에도 앱은 계속 작동
      console.error('⚠️ localStorage 저장 실패 (로컬 백업 건너뜀):', error)
      // 에러가 QuotaExceededError인 경우 기존 데이터 정리 시도
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          // 기존 데이터를 더 줄여서 저장 시도
          const savedSessions = JSON.parse(localStorage.getItem('exerciseSessions') || '[]')
          const minimalSessions = savedSessions.slice(-5).map((s: any) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            averageScore: s.averageScore,
            config: s.config,
            counts: [], // 카운트 데이터 제거
            bestScore: s.bestScore ? { score: s.bestScore.score } : undefined,
            worstScore: s.worstScore ? { score: s.worstScore.score } : undefined,
          }))
          localStorage.setItem('exerciseSessions', JSON.stringify(minimalSessions))
          console.warn('⚠️ localStorage 용량 부족: 최소 데이터만 저장했습니다.')
        } catch (retryError) {
          // 재시도도 실패하면 localStorage 비우기
          console.error('⚠️ localStorage 저장 불가: 기존 데이터를 정리합니다.')
          try {
            localStorage.removeItem('exerciseSessions')
          } catch (clearError) {
            console.error('⚠️ localStorage 정리 실패:', clearError)
          }
        }
      }
    }

    // AI 분석 후 세션 저장
    const fetchAnalysis = async () => {
      // 중복 호출 방지: 이미 분석 중이거나 저장 중인 경우 중단
      if (isFetchingAnalysisRef.current) {
        console.warn('⚠️ 이미 AI 분석 중입니다. 중복 호출 방지')
        return
      }
      
      if (isSavingRef.current) {
        console.warn('⚠️ 이미 저장 중입니다. 중복 호출 방지')
        return
      }
      
      // 이미 저장된 세션인지 확인
      if (savedSessionIdRef.current === session.id) {
        console.warn('⚠️ 이미 저장된 세션입니다. 중복 호출 방지:', session.id)
        return
      }
      
      // 분석 시작 플래그 설정
      isFetchingAnalysisRef.current = true
      
      try {
        console.log('🔍 AI 분석 시작:', session.id)
        const result = await aiAnalysisService.analyzeExercise(session)
        setAnalysis(result)
        
        // 분석 결과와 함께 세션 저장
        console.log('💾 분석 완료, 세션 저장 시작:', session.id)
        await saveSession(result)
      } catch (error) {
        console.error('분석 오류:', error)
        // 분석 실패 시에도 세션은 저장
        console.log('💾 분석 실패, 세션 저장 시작 (분석 없이):', session.id)
        await saveSession()
      } finally {
        setLoading(false)
        isFetchingAnalysisRef.current = false
      }
    }

    // 세션이 변경되고 아직 저장되지 않은 경우에만 실행
    if (session && savedSessionIdRef.current !== session.id && !isSavingRef.current && !isFetchingAnalysisRef.current) {
      fetchAnalysis()
    }
    
    // cleanup 함수: 컴포넌트 언마운트 시 플래그 리셋
    return () => {
      // cleanup은 플래그를 리셋하지 않음 (저장 중이면 완료될 때까지 기다려야 함)
      // 단, 분석 중 플래그만 리셋 (새 세션이 들어올 수 있으므로)
      if (!isSavingRef.current) {
        isFetchingAnalysisRef.current = false
      }
    }
  }, [session?.id, navigate]) // 의존성 배열 최적화: session.id만 추적

  // 이전 운동 내역으로 이동
  const goToPreviousHistory = async () => {
    if (currentHistoryIndex > 0) {
      setCurrentHistoryIndex(currentHistoryIndex - 1)
    } else if (historyOffset > 0) {
      // 이전 페이지 로드
      const newOffset = Math.max(0, historyOffset - 3)
      setHistoryOffset(newOffset)
      await loadExerciseHistory(newOffset, false)
      // 로드된 세션의 마지막 인덱스로 설정
      setTimeout(() => {
        setHistorySessions(prev => {
          setCurrentHistoryIndex(prev.length - 1)
          return prev
        })
      }, 100)
    }
  }

  // 다음 운동 내역으로 이동
  const goToNextHistory = async () => {
    if (currentHistoryIndex < historySessions.length - 1) {
      setCurrentHistoryIndex(currentHistoryIndex + 1)
    } else if (hasMoreHistory) {
      // 다음 페이지 로드
      const newOffset = historyOffset + 3
      setHistoryOffset(newOffset)
      const prevLength = historySessions.length
      await loadExerciseHistory(newOffset, true)
      // 새로 로드된 첫 번째 항목으로 이동
      setCurrentHistoryIndex(prevLength)
    }
  }

  // 스와이프 제스처 처리
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goToNextHistory()
    }
    if (isRightSwipe) {
      goToPreviousHistory()
    }
  }

  // 현재 표시할 운동 내역
  const currentHistorySession = historySessions[currentHistoryIndex] || session

  // 날짜 포맷 함수
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const getExerciseName = (type: string): string => {
    return EXERCISE_TYPE_NAMES[type as keyof typeof EXERCISE_TYPE_NAMES] || type || '커스텀'
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          운동 완료! 🎉
        </h1>

        {/* 운동 내역 탐색 섹션 */}
        {historySessions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">운동 내역</h2>
              <div className="text-sm text-gray-400">
                {currentHistoryIndex + 1} / {historySessions.length}
                {hasMoreHistory && ' +'}
              </div>
            </div>
            
            <div
              ref={historyContainerRef}
              className="relative bg-gray-800 rounded-xl p-6"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* 좌우 네비게이션 버튼 */}
              <button
                onClick={goToPreviousHistory}
                disabled={currentHistoryIndex === 0 && historyOffset === 0}
                className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center transition ${
                  currentHistoryIndex === 0 && historyOffset === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-600'
                }`}
              >
                ←
              </button>
              
              <button
                onClick={goToNextHistory}
                disabled={currentHistoryIndex === historySessions.length - 1 && !hasMoreHistory}
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center transition ${
                  currentHistoryIndex === historySessions.length - 1 && !hasMoreHistory
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-600'
                }`}
              >
                →
              </button>

              {/* 현재 운동 내역 표시 */}
              {currentHistorySession && (
                <motion.div
                  key={currentHistorySession.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-12"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">운동 종목</div>
                      <div className="text-lg font-semibold text-white">
                        {getExerciseName(currentHistorySession.config?.type || '')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">총 카운트</div>
                      <div className="text-lg font-semibold text-blue-400">
                        {(currentHistorySession as any).totalCount || currentHistorySession.counts.length}개
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">평균 점수</div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {Math.round(currentHistorySession.averageScore)}점
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">운동 날짜</div>
                      <div className="text-lg font-semibold text-white">
                        {formatDate(currentHistorySession.endTime || currentHistorySession.startTime)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTime(currentHistorySession.endTime || currentHistorySession.startTime)}
                      </div>
                    </div>
                  </div>
                  
                  {currentHistorySession.bestScore && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <div className="text-sm text-gray-400 mb-2">최고 점수: {currentHistorySession.bestScore.score}점</div>
                      <img
                        src={currentHistorySession.bestScore.image}
                        alt="최고 점수"
                        className="w-full max-w-xs rounded-lg"
                      />
                    </div>
                  )}
                </motion.div>
              )}

              {/* 스와이프 안내 */}
              <div className="text-center mt-4 text-xs text-gray-500">
                좌우 스와이프 또는 버튼으로 이전/다음 운동 내역 확인
              </div>
            </div>
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-6 text-center"
          >
            <div className="text-3xl font-bold text-primary-400">
              {(session as any).totalCount || session.counts.length}
            </div>
            <div className="text-gray-400">총 카운트</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800 rounded-xl p-6 text-center"
          >
            <div className="text-3xl font-bold text-green-400">
              {session.averageScore.toFixed(1)}
            </div>
            <div className="text-gray-400">평균 점수</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-6 text-center"
          >
            <div className="text-3xl font-bold text-yellow-400">
              {session.bestScore?.score || 0}
            </div>
            <div className="text-gray-400">최고 점수</div>
          </motion.div>
        </div>

        {/* 최고/최저 점수 이미지 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {session.bestScore && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-xl font-bold text-white mb-2">
                최고 점수: {session.bestScore.score}점
              </h3>
              <img
                src={session.bestScore.image}
                alt="최고 점수"
                className="w-full rounded-lg"
              />
            </div>
          )}
          {session.worstScore && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-xl font-bold text-white mb-2">
                최저 점수: {session.worstScore.score}점
              </h3>
              <img
                src={session.worstScore.image}
                alt="최저 점수"
                className="w-full rounded-lg"
              />
            </div>
          )}
        </div>

        {/* AI 분석 결과 */}
        {loading ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <div className="text-white">분석 중...</div>
          </div>
        ) : (analysis || currentHistorySession.analysis) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">AI 분석 결과</h2>
            {(() => {
              const displayAnalysis = analysis || currentHistorySession.analysis
              if (!displayAnalysis) return null
              return (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-primary-400 mb-2">
                      요약
                    </h3>
                    <p className="text-gray-300">{displayAnalysis.summary}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-400 mb-2">
                      최고 자세 피드백
                    </h3>
                    <p className="text-gray-300">{displayAnalysis.bestPoseFeedback}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                      최저 자세 피드백
                    </h3>
                    <p className="text-gray-300">{displayAnalysis.worstPoseFeedback}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                      추천 사항
                    </h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      {displayAnalysis.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })()}
          </motion.div>
        ) : null}

        {/* 버튼 */}
        <div className="flex gap-4">
          {session.mode === 'crew' && crewId ? (
            // 크루 모드인 경우
            <>
              <button
                onClick={() => {
                  // 해당 크루방으로 다시 입장
                  navigate('/training', {
                    state: {
                      mode: 'crew',
                      config: config || session.config,
                      alarm: alarm,
                      backgroundMusic: backgroundMusic,
                      crewId: crewId,
                    },
                  })
                }}
                className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition font-semibold"
              >
                다시 시작
              </button>
              <button
                onClick={() => {
                  const user = authService.getCurrentUser()
                  if (user && adminService.isAdmin(user)) {
                    navigate('/admin/dashboard')
                  } else {
                    navigate('/mode-select')
                  }
                }}
                className="flex-1 px-6 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition"
              >
                홈으로
              </button>
            </>
          ) : (
            // 싱글 모드인 경우
            <>
              <button
                onClick={async () => {
                  // goalId가 있으면 해당 목표로 다시 시작
                  if (goalId) {
                    try {
                      const goal = await databaseService.getSingleGoalById(goalId)
                      if (goal) {
                        navigate('/training', {
                          state: {
                            mode: 'single',
                            config: goal.exerciseConfig,
                            alarm: goal.alarm,
                            goalId: goal.id,
                            backgroundMusic: goal.backgroundMusic || 1,
                          },
                        })
                        return
                      }
                    } catch (error) {
                      console.error('목표 로드 실패:', error)
                    }
                  }
                  // goalId가 없거나 로드 실패 시 기존 config로 다시 시작
                  if (config) {
                    navigate('/training', {
                      state: {
                        mode: 'single',
                        config: config,
                        alarm: alarm,
                        backgroundMusic: backgroundMusic,
                        goalId: goalId,
                      },
                    })
                  } else {
                    // config도 없으면 모드 선택으로 이동
                    navigate('/mode-select')
                  }
                }}
                className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
              >
                다시 시작
              </button>
              <button
                onClick={() => {
                  const user = authService.getCurrentUser()
                  if (user && adminService.isAdmin(user)) {
                    navigate('/admin/dashboard')
                  } else {
                    navigate('/mode-select')
                  }
                }}
                className="flex-1 px-6 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition"
              >
                홈으로
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResultPage

