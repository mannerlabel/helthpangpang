import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getVersion } from '@/utils/version'
import { ExerciseSession, ExerciseType, AIAnalysis } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { aiAnalysisService } from '@/services/aiAnalysisService'
import { authService } from '@/services/authService'
import { databaseService } from '@/services/databaseService'
import { adminService } from '@/services/adminService'
import AnimatedBackground from '@/components/AnimatedBackground'
import '@/utils/checkSupabaseData' // 데이터 확인 유틸리티 로드

const HomePage = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ExerciseSession[]>([])
  const [weeklyData, setWeeklyData] = useState<{ 
    date: string
    averageScore: number
    totalCount: number
    bestScore: number
    worstScore: number
  }[]>([])
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0) // 현재 표시할 세션 인덱스
  const [loading, setLoading] = useState(true)
  const [sessionOffset, setSessionOffset] = useState(0) // 세션 로드 오프셋
  const [hasMoreSessions, setHasMoreSessions] = useState(true) // 더 많은 세션이 있는지
  const [loadingMore, setLoadingMore] = useState(false) // 추가 로딩 중
  
  // 스와이프 관련 상태
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // 그래프 오버레이 관련 상태
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)
  const [overlayPosition, setOverlayPosition] = useState<{ x: number; y: number } | null>(null)

  const calculateWeeklyData = (sessions: ExerciseSession[]): { 
    date: string
    averageScore: number
    totalCount: number
    bestScore: number
    worstScore: number
  }[] => {
    const today = new Date()
    const weekData: { 
      date: string
      averageScore: number
      totalCount: number
      bestScore: number
      worstScore: number
    }[] = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      // 해당 날짜의 세션들 찾기
      const daySessions = sessions.filter(session => {
        if (!session.endTime && !session.startTime) return false
        const sessionDate = new Date(session.endTime || session.startTime || 0)
        return sessionDate.toISOString().split('T')[0] === dateStr
      })
      
      if (daySessions.length === 0) {
        weekData.push({
          date: dateStr,
          averageScore: 0,
          totalCount: 0,
          bestScore: 0,
          worstScore: 0,
        })
        continue
      }
      
      // 해당 날짜의 총 카운트 계산
      const totalCount = daySessions.reduce((sum, session) => {
        const sessionTotal = (session as any).totalCount || session.counts.length
        return sum + sessionTotal
      }, 0)
      
      // 해당 날짜의 평균 점수 계산
      const averageScores = daySessions
        .map(session => session.averageScore)
        .filter((score): score is number => score !== undefined && score > 0)
      const averageScore = averageScores.length > 0 
        ? averageScores.reduce((sum, score) => sum + score, 0) / averageScores.length 
        : 0
      
      // 해당 날짜의 최고점수 계산
      const bestScores = daySessions
        .map(session => session.bestScore?.score)
        .filter((score): score is number => score !== undefined)
      const bestScore = bestScores.length > 0 ? Math.max(...bestScores) : 0
      
      // 해당 날짜의 최저점수 계산
      const worstScores = daySessions
        .map(session => session.worstScore?.score)
        .filter((score): score is number => score !== undefined)
      const worstScore = worstScores.length > 0 ? Math.min(...worstScores) : 0
      
      weekData.push({
        date: dateStr,
        averageScore: Math.round(averageScore * 10) / 10, // 소수점 첫째자리까지
        totalCount,
        bestScore,
        worstScore,
      })
    }
    
    return weekData
  }
  
  // 그래프 바 클릭/롤오버 핸들러
  const handleBarClick = (index: number, event: React.MouseEvent<HTMLDivElement>) => {
    const data = weeklyData[index]
    if (data.averageScore === 0 && data.totalCount === 0) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    const containerRect = event.currentTarget.closest('.bg-gray-700\\/50')?.getBoundingClientRect()
    
    // 오버레이가 화면 밖으로 나가지 않도록 조정
    let x = rect.left + rect.width / 2
    const overlayWidth = 200 // 오버레이 예상 너비
    const padding = 10
    
    // 화면 왼쪽 경계 체크
    if (x - overlayWidth / 2 < padding) {
      x = overlayWidth / 2 + padding
    }
    // 화면 오른쪽 경계 체크
    if (x + overlayWidth / 2 > window.innerWidth - padding) {
      x = window.innerWidth - overlayWidth / 2 - padding
    }
    
    setOverlayPosition({
      x: x,
      y: rect.top - 10, // 바 위에 표시
    })
    setSelectedDayIndex(index)
  }
  
  // 오버레이 닫기
  const handleCloseOverlay = () => {
    setSelectedDayIndex(null)
    setOverlayPosition(null)
  }
  
  // 외부 클릭 시 오버레이 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedDayIndex !== null) {
        const target = event.target as HTMLElement
        if (!target.closest('.graph-bar') && !target.closest('.graph-overlay')) {
          handleCloseOverlay()
        }
      }
    }
    
    if (selectedDayIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [selectedDayIndex])

  // 관리자 체크 및 리다이렉트
  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user && adminService.isAdmin(user)) {
      navigate('/admin/dashboard')
      return
    }
  }, [navigate])

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const user = authService.getCurrentUser()
        if (!user) {
          setLoading(false)
          return
        }
        
        // 관리자는 대시보드로 리다이렉트되므로 여기서는 일반 사용자만 처리
        if (adminService.isAdmin(user)) {
          return
        }

        // 데이터베이스에서 운동 세션 로드 (초기 20개)
        // 주의: 콘솔에서 "📖 운동 세션 조회 시작" 로그를 확인하여
        // Supabase에서 가져오는지 localStorage에서 가져오는지 확인 가능
        const result = await databaseService.getExerciseSessionsByUserId(user.id, {
          limit: 20, // 초기 20개 로드
          offset: 0,
          orderBy: 'end_time',
          orderDirection: 'desc',
        })
        
        // 데이터 소스 확인 로그
        console.log('📊 HomePage 데이터 로드 완료:', {
          sessionsCount: result.sessions.length,
          total: result.total,
          hasMore: result.hasMore,
          dataSource: '콘솔의 "📖 운동 세션 조회 시작" 로그를 확인하세요',
        })

        // ExerciseSession 형식으로 변환 (databaseService의 형식과 타입의 형식이 다를 수 있음)
        const convertedSessions: ExerciseSession[] = result.sessions.map((s: any) => ({
          id: s.id,
          mode: s.mode,
          config: s.config,
          startTime: s.startTime,
          endTime: s.endTime,
          counts: s.counts || [],
          bestScore: s.bestScore,
          worstScore: s.worstScore,
          averageScore: s.averageScore,
          analysis: s.analysis,
        }))

        setSessions(convertedSessions)
        setHasMoreSessions(result.hasMore)
        setSessionOffset(20) // 다음 로드를 위한 오프셋

        // 1주일 데이터 계산
        const weekData = calculateWeeklyData(convertedSessions)
        setWeeklyData(weekData)

        // 세션이 있으면 첫 번째 세션을 기본으로 설정
        if (convertedSessions.length > 0) {
          setCurrentSessionIndex(0)
        }
        setLoading(false)
      } catch (error) {
        console.error('❌ 운동 내역 로드 실패:', error)
        console.error('에러 상세:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        // Supabase 전용이므로 에러만 표시
        setSessions([])
        setWeeklyData([])
        setLoading(false)
      }
    }

    loadSessions()
  }, [])

  const getExerciseName = (type: ExerciseType): string => {
    return EXERCISE_TYPE_NAMES[type] || '커스텀'
  }

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const getMaxAverageScore = (): number => {
    if (weeklyData.length === 0) return 100
    const maxScore = Math.max(...weeklyData.map(d => d.averageScore), 0)
    return maxScore > 0 ? maxScore : 100
  }

  const maxAverageScore = getMaxAverageScore()

  const hasData = sessions.length > 0
  const currentSession = sessions[currentSessionIndex] || null
  const currentAnalysis = currentSession?.analysis || null

  // 추가 세션 로드
  const loadMoreSessions = async () => {
    if (loadingMore || !hasMoreSessions) return
    
    try {
      setLoadingMore(true)
      const user = authService.getCurrentUser()
      if (!user) return

      const result = await databaseService.getExerciseSessionsByUserId(user.id, {
        limit: 20,
        offset: sessionOffset,
        orderBy: 'end_time',
        orderDirection: 'desc',
      })

      const convertedSessions: ExerciseSession[] = result.sessions.map((s: any) => ({
        id: s.id,
        mode: s.mode,
        config: s.config,
        startTime: s.startTime,
        endTime: s.endTime,
        counts: s.counts || [],
        bestScore: s.bestScore,
        worstScore: s.worstScore,
        averageScore: s.averageScore,
        analysis: s.analysis,
      }))

      setSessions(prev => [...prev, ...convertedSessions])
      setHasMoreSessions(result.hasMore)
      setSessionOffset(prev => prev + 20)
    } catch (error) {
      console.error('추가 세션 로드 실패:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  // 이전 세션으로 이동
  const goToPreviousSession = async () => {
    if (currentSessionIndex > 0) {
      setCurrentSessionIndex(currentSessionIndex - 1)
    } else if (sessionOffset > 0) {
      // 이전 페이지 로드
      const newOffset = Math.max(0, sessionOffset - 20)
      setLoadingMore(true)
      try {
        const user = authService.getCurrentUser()
        if (!user) return

        const result = await databaseService.getExerciseSessionsByUserId(user.id, {
          limit: 20,
          offset: newOffset,
          orderBy: 'end_time',
          orderDirection: 'desc',
        })

        const convertedSessions: ExerciseSession[] = result.sessions.map((s: any) => ({
          id: s.id,
          mode: s.mode,
          config: s.config,
          startTime: s.startTime,
          endTime: s.endTime,
          counts: s.counts || [],
          bestScore: s.bestScore,
          worstScore: s.worstScore,
          averageScore: s.averageScore,
          analysis: s.analysis,
        }))

        setSessions(convertedSessions)
        setSessionOffset(newOffset)
        setCurrentSessionIndex(convertedSessions.length - 1)
      } catch (error) {
        console.error('이전 세션 로드 실패:', error)
      } finally {
        setLoadingMore(false)
      }
    }
  }

  // 다음 세션으로 이동
  const goToNextSession = async () => {
    if (currentSessionIndex < sessions.length - 1) {
      setCurrentSessionIndex(currentSessionIndex + 1)
    } else if (hasMoreSessions) {
      // 다음 페이지 로드
      await loadMoreSessions()
      // 새로 로드된 첫 번째 항목으로 이동
      setTimeout(() => {
        setCurrentSessionIndex(sessions.length)
      }, 100)
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
      goToNextSession()
    }
    if (isRightSwipe) {
      goToPreviousSession()
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">헬스팡팡</h1>
          <div className="flex gap-3 items-center">
            <span className="text-white text-sm">
              {authService.getCurrentUser()?.name || '사용자'}님
            </span>
            <button
              onClick={() => navigate('/announcements')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              📢 공지사항
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              설정
            </button>
            <button
              onClick={async () => {
                await authService.logout()
                navigate('/login')
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              로그아웃
            </button>
            {!adminService.isAdmin(authService.getCurrentUser()) && (
              <button
                onClick={() => navigate('/mode-select')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
              >
                시작하기
              </button>
            )}
            {adminService.isAdmin(authService.getCurrentUser()) && (
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                관리자 대시보드
              </button>
            )}
          </div>
        </div>

        {/* 운동 내역 섹션 */}
        <div className={`bg-gray-800/90 rounded-2xl p-6 mb-6 min-h-[400px] ${
          !hasData ? 'stitch-border' : ''
        }`}>
          {!hasData ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-xl text-gray-400">최근 운동내역 없음</p>
            </div>
          ) : (
            <>
              {/* 1주일 운동 그래프 */}
              <div className="mb-8 relative">
                <h2 className="text-2xl font-bold text-white mb-4">1주일 운동 내역</h2>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-end justify-between gap-2 h-48">
                    {weeklyData.map((data, index) => {
                      const height = maxAverageScore > 0 ? (data.averageScore / maxAverageScore) * 100 : 0
                      const date = new Date(data.date)
                      const dayLabel = date.toLocaleDateString('ko-KR', { weekday: 'short' })
                      const dayNum = date.getDate()
                      const isSelected = selectedDayIndex === index
                      const hasData = data.averageScore > 0 || data.totalCount > 0
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2">
                          <div className="relative w-full h-40 flex items-end">
                            <div
                              className={`graph-bar w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all ${
                                hasData
                                  ? 'cursor-pointer hover:from-blue-400 hover:to-blue-300 hover:ring-2 hover:ring-blue-300 active:from-blue-300 active:to-blue-200' 
                                  : 'cursor-default opacity-50'
                              } ${isSelected ? 'ring-2 ring-blue-300' : ''}`}
                              style={{ height: `${height}%`, minHeight: hasData ? '4px' : '0' }}
                              onClick={(e) => hasData && handleBarClick(index, e)}
                              onMouseEnter={(e) => hasData && handleBarClick(index, e)}
                              onTouchStart={(e) => {
                                if (hasData) {
                                  const touch = e.touches[0]
                                  const target = e.currentTarget
                                  const fakeEvent = {
                                    currentTarget: target,
                                    clientX: touch.clientX,
                                    clientY: touch.clientY,
                                  } as React.MouseEvent<HTMLDivElement>
                                  handleBarClick(index, fakeEvent)
                                }
                              }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 text-center">
                            <div>{dayLabel}</div>
                            <div className="font-semibold text-white">{dayNum}일</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* 오버레이 - 일일 운동 횟수만 표시 */}
                {selectedDayIndex !== null && overlayPosition && weeklyData[selectedDayIndex].totalCount > 0 && (
                  <div
                    className="graph-overlay fixed z-50 bg-gray-800/95 border border-gray-600 rounded-lg p-4 shadow-2xl min-w-[150px]"
                    style={{
                      left: `${overlayPosition.x}px`,
                      top: `${overlayPosition.y}px`,
                      transform: 'translate(-50%, -100%)',
                    }}
                    onMouseLeave={handleCloseOverlay}
                  >
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400">
                        {weeklyData[selectedDayIndex].totalCount}회
                      </div>
                      <div className="text-sm text-gray-400 mt-1">일일 운동 횟수</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 최근 운동 내역 및 피드백 요약 (통합 슬라이드) */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">최근 운동 내역 및 피드백</h2>
                  {sessions.length > 0 && (
                    <div className="text-sm text-gray-400">
                      {currentSessionIndex + 1} / {sessions.length}
                      {hasMoreSessions && ' +'}
                    </div>
                  )}
                </div>
                {currentSession ? (
                  <div 
                    className="relative"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    {/* 좌우 화살표 버튼 (삼각형) */}
                    {sessions.length > 0 && (
                      <>
                        <button
                          onClick={goToPreviousSession}
                          disabled={(currentSessionIndex === 0 && sessionOffset === 0) || loadingMore}
                          className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-gray-700/90 text-white flex items-center justify-center transition shadow-lg ${
                            (currentSessionIndex === 0 && sessionOffset === 0) || loadingMore
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-600 active:scale-95'
                          }`}
                          aria-label="이전 운동 내역"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={goToNextSession}
                          disabled={(!hasMoreSessions && currentSessionIndex === sessions.length - 1) || loadingMore}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-gray-700/90 text-white flex items-center justify-center transition shadow-lg ${
                            (!hasMoreSessions && currentSessionIndex === sessions.length - 1) || loadingMore
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-600 active:scale-95'
                          }`}
                          aria-label="다음 운동 내역"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {loadingMore && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-700/50 rounded-lg z-20">
                            <div className="text-white text-sm">로딩 중...</div>
                          </div>
                        )}
                      </>
                    )}
                    
                    <motion.div
                      key={currentSession.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-gray-700/50 rounded-lg p-4 space-y-4"
                    >
                      {/* 운동 내역 섹션 */}
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-3">운동 내역</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-gray-400 mb-1">운동 종목</div>
                            <div className="text-lg font-semibold text-white">
                              {getExerciseName(currentSession.config.type)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">총 카운트</div>
                            <div className="text-lg font-semibold text-blue-400">
                              {(currentSession as any).totalCount || currentSession.counts.length}개
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">평균 점수</div>
                            <div className="text-lg font-semibold text-yellow-400">
                              {Math.round(currentSession.averageScore)}점
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">운동 날짜</div>
                            <div className="text-lg font-semibold text-white">
                              {formatDate(currentSession.endTime || currentSession.startTime)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTime(currentSession.endTime || currentSession.startTime)}
                            </div>
                          </div>
                        </div>
                        
                        {/* 최고/최저 점수 이미지 */}
                        {(currentSession.bestScore || currentSession.worstScore) && (
                          <div className="mt-4 pt-4 border-t border-gray-600 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentSession.bestScore && (
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-400 mb-1">최고 점수</div>
                                  <div className="text-xl font-bold text-green-400">
                                    {Math.round(currentSession.bestScore.score)}점
                                  </div>
                                </div>
                                {currentSession.bestScore.image && (
                                  <img
                                    src={currentSession.bestScore.image}
                                    alt="최고 점수"
                                    className="w-24 h-24 object-cover rounded-lg"
                                  />
                                )}
                              </div>
                            )}
                            {currentSession.worstScore && (
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-400 mb-1">최저 점수</div>
                                  <div className="text-xl font-bold text-red-400">
                                    {Math.round(currentSession.worstScore.score)}점
                                  </div>
                                </div>
                                {currentSession.worstScore.image && (
                                  <img
                                    src={currentSession.worstScore.image}
                                    alt="최저 점수"
                                    className="w-24 h-24 object-cover rounded-lg"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* 피드백 요약 섹션 */}
                      <div className="pt-4 border-t border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-3">피드백 요약</h3>
                        {loading ? (
                          <div className="text-center text-gray-400 py-4">
                            분석 중...
                          </div>
                        ) : currentAnalysis ? (
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm text-gray-400 mb-1">요약</div>
                              <div className="text-white">{currentAnalysis.summary}</div>
                            </div>
                            {currentAnalysis.recommendations && currentAnalysis.recommendations.length > 0 && (
                              <div>
                                <div className="text-sm text-gray-400 mb-2">추천 사항</div>
                                <ul className="list-disc list-inside space-y-1 text-white">
                                  {currentAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                                    <li key={index} className="text-sm">{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {currentAnalysis.bestPoseFeedback && (
                              <div>
                                <div className="text-sm text-gray-400 mb-1">최고 자세 피드백</div>
                                <div className="text-green-400 text-sm">{currentAnalysis.bestPoseFeedback}</div>
                              </div>
                            )}
                            {currentAnalysis.worstPoseFeedback && (
                              <div>
                                <div className="text-sm text-gray-400 mb-1">최저 자세 피드백</div>
                                <div className="text-red-400 text-sm">{currentAnalysis.worstPoseFeedback}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 py-4">
                            피드백 정보가 없습니다
                          </div>
                        )}
                      </div>
                    </motion.div>
                    
                    {/* 스와이프 안내 */}
                    {sessions.length > 1 && (
                      <div className="text-center mt-4 text-xs text-gray-500">
                        좌우 스와이프 또는 화살표 버튼으로 이전/다음 운동 내역 확인
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">최근 운동 내역이 없습니다</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 버전 표시 */}
      <div className="absolute left-1/2 transform -translate-x-1/2 text-sm text-gray-400 mobile-bottom-4">
        v{getVersion()}
      </div>
    </div>
  )
}

export default HomePage
