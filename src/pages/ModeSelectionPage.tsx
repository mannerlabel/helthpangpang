import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppMode, ExerciseSession, ExerciseType, AIAnalysis } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { getVersion } from '@/utils/version'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { aiAnalysisService } from '@/services/aiAnalysisService'
import { authService } from '@/services/authService'
import { databaseService } from '@/services/databaseService'
import { adminService } from '@/services/adminService'
import { rankService } from '@/services/rankService'
import { announcementService } from '@/services/announcementService'
import RankBadge from '@/components/RankBadge'

const ModeSelectionPage = () => {
  const navigate = useNavigate()
  
  // 관리자는 이 페이지에 접근할 수 없음
  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user && adminService.isAdmin(user)) {
      alert('관리자는 일반 사용자 모드를 사용할 수 없습니다.')
      navigate('/admin/dashboard')
    }
  }, [navigate])
  const [sessions, setSessions] = useState<ExerciseSession[]>([])
  const [weeklyData, setWeeklyData] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  
  // 슬라이드 관련 상태
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0) // 현재 표시할 세션 인덱스
  const [sessionOffset, setSessionOffset] = useState(0) // 세션 로드 오프셋
  const [hasMoreSessions, setHasMoreSessions] = useState(true) // 더 많은 세션이 있는지
  const [loadingMore, setLoadingMore] = useState(false) // 추가 로딩 중
  const [userRank, setUserRank] = useState(1)
  
  // 스와이프 관련 상태
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // 그래프 오버레이 관련 상태
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)
  const [overlayPosition, setOverlayPosition] = useState<{ x: number; y: number } | null>(null)
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false)

  const calculateWeeklyData = (sessions: ExerciseSession[], joggingSessions: any[] = []): { 
    date: string
    count: number
    details: Array<{ type: string; count: number; distance?: number }>
    joggingCount: number
    joggingTotalTime: number
  }[] => {
    const today = new Date()
    const weekData: { 
      date: string
      count: number
      details: Array<{ type: string; count: number; distance?: number }>
      joggingCount: number
      joggingTotalTime: number
    }[] = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      // 해당 날짜의 일반 운동 세션들 찾기
      const daySessions = sessions.filter(session => {
        if (!session.endTime && !session.startTime) return false
        const sessionDate = new Date(session.endTime || session.startTime || 0)
        return sessionDate.toISOString().split('T')[0] === dateStr
      })
      
      // 해당 날짜의 조깅 세션들 찾기
      const dayJoggingSessions = joggingSessions.filter(session => {
        if (!session.endTime && !session.startTime) return false
        const sessionDate = new Date(session.endTime || session.startTime || 0)
        return sessionDate.toISOString().split('T')[0] === dateStr
      })
      
      // 해당 날짜의 총 카운트 계산 (일반 운동만)
      const totalCount = daySessions.reduce((sum, session) => {
        const sessionTotal = (session as any).totalCount || session.counts.length
        return sum + sessionTotal
      }, 0)
      
      // 종목별 내역 계산
      const detailsMap = new Map<string, { count: number; distance?: number }>()
      
      daySessions.forEach(session => {
        const sessionTotal = (session as any).totalCount || session.counts.length
        
        // 조깅 모드 확인 (mode가 'jogging'이거나 config에 distance 정보가 있는 경우)
        const isJogging = session.mode === 'jogging' || (session.config as any)?.distance !== undefined
        const distance = (session as any).distance || (session.config as any)?.distance || 0
        
        if (isJogging && distance > 0) {
          // 조깅 모드: 거리 표시
          const existing = detailsMap.get('조깅') || { count: 0, distance: 0 }
          detailsMap.set('조깅', {
            count: existing.count + 1, // 세션 수
            distance: (existing.distance || 0) + distance
          })
        } else {
          // 일반 운동 모드: 종목별 카운트
          const exerciseType = session.config?.type || 'custom'
          const exerciseName = getExerciseName(exerciseType)
          const existing = detailsMap.get(exerciseName) || { count: 0 }
          detailsMap.set(exerciseName, {
            count: existing.count + sessionTotal
          })
        }
      })
      
      const details = Array.from(detailsMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        distance: data.distance
      }))
      
      // 조깅 세션 수 및 총 시간 계산
      const joggingCount = dayJoggingSessions.length
      const joggingTotalTime = dayJoggingSessions.reduce((sum, session) => {
        const sessionTime = session.averageTime || (session.endTime && session.startTime ? session.endTime - session.startTime : 0)
        return sum + sessionTime
      }, 0)
      
      weekData.push({
        date: dateStr,
        count: totalCount,
        details,
        joggingCount,
        joggingTotalTime,
      })
    }
    
    return weekData
  }

  useEffect(() => {
    let isMounted = true // 컴포넌트가 마운트되어 있는지 추적
    
    const loadSessions = async () => {
      try {
        const user = authService.getCurrentUser()
        if (!user) {
          if (isMounted) setLoading(false)
          return
        }

        // Supabase에서 운동 세션 로드
        const result = await databaseService.getExerciseSessionsByUserId(user.id, {
          limit: 20, // 최근 20개 로드
          offset: 0,
          orderBy: 'end_time',
          orderDirection: 'desc',
        })

        // 조깅 세션 로드
        const joggingResult = await databaseService.getJoggingSessionsByUserId(user.id, {
          limit: 50, // 최근 50개 조깅 세션
          offset: 0,
          orderBy: 'end_time',
          orderDirection: 'desc',
        })

        // databaseService.getExerciseSessionsByUserId는 이미 ExerciseSession 형식으로 변환된 데이터를 반환
        // 따라서 추가 변환 없이 그대로 사용
        console.log('📊 ModeSelectionPage 세션 로드:', {
          sessionsCount: result.sessions.length,
          joggingSessionsCount: joggingResult.sessions.length,
          firstSession: result.sessions[0] ? {
            id: result.sessions[0].id,
            endTime: result.sessions[0].endTime,
            startTime: result.sessions[0].startTime,
            hasBestScore: !!result.sessions[0].bestScore,
            hasWorstScore: !!result.sessions[0].worstScore,
            hasAnalysis: !!result.sessions[0].analysis,
            countsLength: result.sessions[0].counts?.length || 0,
          } : null,
        })

        // 중복 제거: ID 기준으로 중복 제거
        const uniqueSessions = result.sessions.filter((session, index, self) =>
          index === self.findIndex(s => s.id === session.id)
        )

        if (isMounted) {
          setSessions(uniqueSessions)
          setHasMoreSessions(result.hasMore)
          setSessionOffset(20) // 다음 로드를 위한 오프셋

          // 1주일 데이터 계산 (조깅 세션 포함)
          const weekData = calculateWeeklyData(uniqueSessions, joggingResult.sessions)
          setWeeklyData(weekData)

          // 세션이 있으면 첫 번째 세션을 기본으로 설정
          if (uniqueSessions.length > 0) {
            setCurrentSessionIndex(0)
          }
          
          setLoading(false)
        }
      } catch (error) {
        console.error('운동 내역 로드 실패:', error)
        if (isMounted) setLoading(false)
      }
    }

    loadSessions()
    loadUserRank()
    
    // cleanup 함수: 컴포넌트 언마운트 시 플래그 설정
    return () => {
      isMounted = false
    }
  }, [])

  // 1주일 이내 미확인 공지사항 확인
  useEffect(() => {
    const checkNewAnnouncements = async () => {
      try {
        console.log('📢 ModeSelectionPage: 공지사항 확인 시작...')
        const hasNew = await announcementService.hasUnreadAnnouncementsWithinWeek()
        console.log('📢 ModeSelectionPage: 공지사항 확인 결과:', hasNew)
        setHasNewAnnouncement(hasNew)
      } catch (error) {
        console.error('❌ ModeSelectionPage: 공지사항 확인 실패:', error)
        setHasNewAnnouncement(false)
      }
    }

    // 초기 확인
    checkNewAnnouncements()

    // 30초마다 확인 (주기적 업데이트)
    const interval = setInterval(checkNewAnnouncements, 30000)

    // 공지사항을 읽었을 때 즉시 상태 재확인
    const handleAnnouncementRead = () => {
      console.log('📢 ModeSelectionPage: 공지사항 읽음 이벤트 수신, 상태 재확인 중...')
      // 약간의 지연 후 확인 (데이터베이스 업데이트 반영 시간)
      setTimeout(checkNewAnnouncements, 500)
    }
    
    // 페이지가 포커스를 받을 때도 상태 재확인 (다른 탭에서 돌아왔을 때)
    const handleFocus = () => {
      console.log('📢 ModeSelectionPage: 페이지 포커스, 공지사항 상태 재확인 중...')
      checkNewAnnouncements()
    }
    
    window.addEventListener('announcement-read', handleAnnouncementRead)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('announcement-read', handleAnnouncementRead)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const loadUserRank = async () => {
    const user = authService.getCurrentUser()
    if (user) {
      const rank = await rankService.getUserRank(user.id)
      setUserRank(rank)
    }
  }

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

  const getMaxCount = (): number => {
    if (weeklyData.length === 0) return 1
    return Math.max(...weeklyData.map(d => d.count), 1)
  }

  const getMaxJoggingCount = (): number => {
    if (weeklyData.length === 0) return 1
    const maxCount = Math.max(...weeklyData.map(d => d.joggingCount), 0)
    return maxCount > 0 ? maxCount : 1
  }

  const formatDuration = (ms: number): string => {
    if (!ms || isNaN(ms) || ms < 0) return '00:00'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  }

  const maxCount = getMaxCount()
  const hasData = sessions.length > 0
  const currentSession = sessions[currentSessionIndex] || null
  const currentAnalysis = currentSession?.analysis || null

  // 디버깅: currentSession이 변경될 때마다 로그 출력 (의존성 최소화)
  useEffect(() => {
    if (currentSession && sessions.length > 0) {
      // 세션이 실제로 변경되었을 때만 로그 출력
      const sessionId = currentSession.id
      console.log('🔄 현재 세션 업데이트:', {
        index: currentSessionIndex,
        sessionId: sessionId,
        endTime: currentSession.endTime,
        startTime: currentSession.startTime,
        endTimeFormatted: currentSession.endTime ? new Date(currentSession.endTime).toLocaleString('ko-KR') : null,
        hasBestScore: !!currentSession.bestScore,
        bestScoreValue: currentSession.bestScore?.score,
        hasWorstScore: !!currentSession.worstScore,
        worstScoreValue: currentSession.worstScore?.score,
        hasAnalysis: !!currentAnalysis,
        countsLength: currentSession.counts?.length || 0,
        averageScore: currentSession.averageScore,
      })
    }
  }, [currentSessionIndex, currentSession?.id]) // 의존성을 최소화하여 불필요한 재실행 방지

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

      // databaseService.getExerciseSessionsByUserId는 이미 ExerciseSession 형식으로 변환된 데이터를 반환
      // 중복 체크: 기존 세션 ID와 비교하여 중복 제거
      setSessions(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const newSessions = result.sessions.filter(s => !existingIds.has(s.id))
        return [...prev, ...newSessions]
      })
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

        // databaseService.getExerciseSessionsByUserId는 이미 ExerciseSession 형식으로 변환된 데이터를 반환
        setSessions(result.sessions)
        setSessionOffset(newOffset)
        setCurrentSessionIndex(result.sessions.length - 1)
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
      const previousLength = sessions.length
      await loadMoreSessions()
      // 새로 로드된 첫 번째 항목으로 이동
      // loadMoreSessions가 완료된 후 세션이 업데이트되므로, 
      // useEffect를 통해 sessions가 변경될 때 인덱스를 업데이트
      setTimeout(() => {
        setCurrentSessionIndex(previousLength)
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

  // 그래프 바 클릭/롤오버 핸들러
  const handleBarClick = (index: number, event: React.MouseEvent<HTMLDivElement>) => {
    const data = weeklyData[index]
    if (data.count === 0) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    
    // 오버레이가 화면 밖으로 나가지 않도록 조정
    let x = rect.left + rect.width / 2
    const overlayWidth = 150
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

  const handleModeSelect = (mode: AppMode) => {
    if (mode === 'jogging') {
      navigate('/jogging-mode-select')
    } else if (mode === 'crew') {
      navigate('/crew')
    } else if (mode === 'single') {
      navigate('/single')
    } else {
      navigate(`/exercise-select?mode=${mode}`)
    }
  }

  const modes = [
    {
      id: 'single' as AppMode,
      title: '싱글 모드',
      description: '카메라를 통해 혼자 운동',
      icon: '🏋️',
      color: 'from-blue-500 to-blue-700',
    },
    {
      id: 'crew' as AppMode,
      title: '크루 모드',
      description: '참여자들이 방에 모여 함께 운동',
      icon: '👥',
      color: 'from-purple-500 to-purple-700',
    },
    {
      id: 'jogging' as AppMode,
      title: '조깅 모드',
      description: '조깅 경로, 속도, 시간, 거리 자동 추적',
      icon: '🏃',
      color: 'from-green-500 to-green-700',
    },
  ]

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">헬스팡팡</h1>
          
          <div className="flex items-center gap-3">
            {/* 데스크톱 메뉴 */}
            <div className="hidden md:flex gap-3 items-center">
              <span className="text-white text-sm flex items-center gap-2">
                {authService.getCurrentUser()?.name || '사용자'}님
                <RankBadge rank={userRank} type="user" size="sm" showText={false} />
              </span>
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
            </div>
            
            {/* 회원 이름과 단계 레벨 표시 (홈 버튼 대신) */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-700/80 backdrop-blur-sm rounded-full">
              <span className="text-white text-sm font-semibold flex items-center gap-2">
                <span className="text-blue-400">👤</span>
                {authService.getCurrentUser()?.name || '사용자'}님
                <RankBadge rank={userRank} type="user" size="sm" showText={false} />
              </span>
            </div>
            
            {/* 홈 버튼 주석처리 */}
            {/* <NavigationButtons backPath="/home" showHome={true} showBack={false} /> */}
          </div>

          {/* 모바일 햄버거 메뉴 */}
          <div className="md:hidden relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-white hover:bg-gray-700 rounded-lg transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {menuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            {/* 모바일 메뉴 드롭다운 */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-lg shadow-xl z-50 overflow-hidden"
                >
                  <div className="py-2">
                    <div className="px-4 py-2 text-white text-sm border-b border-gray-700">
                      {authService.getCurrentUser()?.name || '사용자'}님
                    </div>
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition"
                    >
                      설정
                    </button>
                    <button
                      onClick={async () => {
                        await authService.logout()
                        navigate('/login')
                        setMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition"
                    >
                      로그아웃
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-xl text-gray-300 text-center mb-12">운동 모드를 선택하세요</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {modes.map((mode) => (
            <motion.div
              key={mode.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleModeSelect(mode.id)}
              className={`bg-gradient-to-br ${mode.color} rounded-2xl p-8 cursor-pointer shadow-2xl hover:shadow-3xl transition-all`}
            >
              <div className="text-6xl mb-4 text-center">{mode.icon}</div>
              <h2 className="text-3xl font-bold text-white mb-4 text-center">
                {mode.title}
              </h2>
              <p className="text-white/90 text-center">{mode.description}</p>
            </motion.div>
          ))}
          
          {/* 공지사항 메뉴 */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log('📢 ModeSelectionPage: 공지사항 카드 클릭됨, hasNewAnnouncement:', hasNewAnnouncement)
              navigate('/announcements')
            }}
            className="relative bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-2xl p-8 cursor-pointer shadow-2xl hover:shadow-3xl transition-all"
          >
            <div className="text-6xl mb-4 text-center">📢</div>
            <h2 className="text-3xl font-bold text-white mb-4 text-center">
              공지사항
            </h2>
            <p className="text-white/90 text-center">중요한 공지사항을 확인하세요</p>
            {hasNewAnnouncement && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.7, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
                className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 whitespace-nowrap shadow-lg"
              >
                New
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* 1주일 운동 그래프 섹션 */}
        {hasData && (
          <div className="bg-gray-800/90 rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">1주일 운동 내역</h2>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-end justify-between gap-2 h-48">
                {weeklyData.map((data, index) => {
                  const maxExercise = getMaxCount()
                  const maxJogging = getMaxJoggingCount()
                  const exerciseHeight = maxExercise > 0 ? (data.count / maxExercise) * 100 : 0
                  const joggingHeight = maxJogging > 0 ? (data.joggingCount / maxJogging) * 100 : 0
                  const date = new Date(data.date)
                  const dayLabel = date.toLocaleDateString('ko-KR', { weekday: 'short' })
                  const dayNum = date.getDate()
                  const hasData = data.count > 0 || data.joggingCount > 0
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="relative w-full h-40 flex items-end gap-0.5">
                        {/* 일반 운동 그래프 바 (blue) */}
                        {data.count > 0 && (
                        <div
                            className={`graph-bar flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all ${
                              hasData
                              ? 'cursor-pointer hover:from-blue-400 hover:to-blue-300 hover:ring-2 hover:ring-blue-300'
                              : 'cursor-default opacity-50'
                          } ${selectedDayIndex === index ? 'ring-2 ring-blue-300' : ''}`}
                            style={{ height: `${exerciseHeight}%`, minHeight: '4px' }}
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
                        )}
                        {/* 조깅 그래프 바 (yellow) */}
                        {data.joggingCount > 0 && (
                          <div
                            className={`graph-bar flex-1 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t transition-all ${
                              hasData
                                ? 'cursor-pointer hover:from-yellow-400 hover:to-yellow-300 hover:ring-2 hover:ring-yellow-300'
                                : 'cursor-default opacity-50'
                            } ${selectedDayIndex === index ? 'ring-2 ring-yellow-300' : ''}`}
                            style={{ height: `${joggingHeight}%`, minHeight: '4px' }}
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
                        )}
                        {/* 데이터가 없을 때 빈 공간 */}
                        {!hasData && (
                          <div className="flex-1 opacity-50" style={{ minHeight: '0' }} />
                        )}
                      </div>
                      <div className="text-xs text-gray-400 text-center">
                        <div>{dayLabel}</div>
                        <div className="font-semibold text-white">{dayNum}일</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* 오버레이 - 일일 종목별 내역 및 조깅 정보 표시 */}
              {selectedDayIndex !== null && overlayPosition && (weeklyData[selectedDayIndex].count > 0 || weeklyData[selectedDayIndex].joggingCount > 0) && (
                <div
                  className="graph-overlay fixed z-50 bg-gray-800/95 border border-gray-600 rounded-lg p-4 shadow-2xl min-w-[200px]"
                  style={{
                    left: `${overlayPosition.x}px`,
                    top: `${overlayPosition.y}px`,
                    transform: 'translate(-50%, -100%)',
                  }}
                  onMouseLeave={handleCloseOverlay}
                >
                  <div className="space-y-3">
                    {/* 일반 운동 내역 */}
                    {weeklyData[selectedDayIndex].count > 0 && (
                      <div>
                  <div className="text-center mb-2">
                    <div className="text-lg font-bold text-blue-400 mb-2">
                      일일 운동 내역
                    </div>
                  </div>
                  <div className="space-y-2">
                    {weeklyData[selectedDayIndex].details.length > 0 ? (
                      weeklyData[selectedDayIndex].details.map((detail, idx) => (
                        <div key={idx} className="text-sm text-white flex justify-between items-center">
                          <span className="text-gray-300">{detail.type}:</span>
                          <span className="font-semibold text-blue-400">
                            {detail.distance !== undefined 
                              ? `${detail.distance.toFixed(1)}km` 
                              : `${detail.count}개`}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-400">내역 없음</div>
                    )}
                  </div>
                </div>
              )}
                    {/* 조깅 정보 */}
                    {weeklyData[selectedDayIndex].joggingCount > 0 && (
                      <div className={`text-center ${weeklyData[selectedDayIndex].count > 0 ? 'border-t border-gray-600 pt-3' : ''}`}>
                        <div className="text-2xl font-bold text-yellow-400">
                          {weeklyData[selectedDayIndex].joggingCount}회
                        </div>
                        <div className="text-sm text-gray-400 mt-1">조깅 횟수</div>
                        <div className="text-lg font-semibold text-yellow-300 mt-2">
                          {formatDuration(weeklyData[selectedDayIndex].joggingTotalTime)}
                        </div>
                        <div className="text-xs text-gray-400">총 시간</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 최근 운동 내역 및 피드백 요약 섹션 (슬라이드) */}
        <div className={`bg-gray-800/90 rounded-2xl p-6 mb-6 min-h-[400px] ${
          !hasData ? 'stitch-border' : ''
        }`}>
          {!hasData ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-xl text-gray-400">최근 운동내역 없음</p>
            </div>
          ) : (
            <div>
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
                  {/* 좌우 화살표 버튼 */}
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
                    </>
                  )}

                  {/* 슬라이드 컨텐츠 */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSessionIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gray-700/50 rounded-lg p-6"
                    >
                      {/* 최근 운동 내역 */}
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-white mb-4">최근 운동 내역</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <div className="text-sm text-gray-400 mb-1">운동 종목</div>
                            <div className="text-lg font-semibold text-white">
                              {getExerciseName(currentSession.config.type)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">총 카운트</div>
                            <div className="text-lg font-semibold text-blue-400">
                              {currentSession.counts.length}개
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
                        {(currentSession.bestScore || currentSession.worstScore) && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-600">
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
                                    className="w-20 h-20 object-cover rounded-lg"
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
                                    className="w-20 h-20 object-cover rounded-lg"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 피드백 요약 */}
                      <div>
                        <h3 className="text-xl font-bold text-white mb-4">피드백 요약</h3>
                        {loading ? (
                          <div className="bg-gray-600/50 rounded-lg p-4 text-center text-gray-400">
                            분석 중...
                          </div>
                        ) : currentAnalysis ? (
                          <div className="bg-gray-600/50 rounded-lg p-4 space-y-3">
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
                          </div>
                        ) : (
                          <div className="bg-gray-600/50 rounded-lg p-4 text-center text-gray-400">
                            피드백 정보가 없습니다
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">운동 내역이 없습니다</div>
              )}
            </div>
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

export default ModeSelectionPage

