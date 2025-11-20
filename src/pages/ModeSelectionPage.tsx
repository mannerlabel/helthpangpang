import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppMode, ExerciseSession, ExerciseType, AIAnalysis } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { getVersion } from '@/utils/version'
import AnimatedBackground from '@/components/AnimatedBackground'
import { aiAnalysisService } from '@/services/aiAnalysisService'
import { authService } from '@/services/authService'

const ModeSelectionPage = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ExerciseSession[]>([])
  const [weeklyData, setWeeklyData] = useState<{ date: string; count: number }[]>([])
  const [recentSession, setRecentSession] = useState<ExerciseSession | null>(null)
  const [recentAnalysis, setRecentAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  const calculateWeeklyData = (sessions: ExerciseSession[]): { date: string; count: number }[] => {
    const today = new Date()
    const weekData: { date: string; count: number }[] = []
    
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
      
      // 해당 날짜의 총 카운트 계산
      const totalCount = daySessions.reduce((sum, session) => {
        const sessionTotal = (session as any).totalCount || session.counts.length
        return sum + sessionTotal
      }, 0)
      
      weekData.push({
        date: dateStr,
        count: totalCount,
      })
    }
    
    return weekData
  }

  useEffect(() => {
    // localStorage에서 세션 데이터 불러오기 (차후 Supabase로 대체)
    const savedSessions = JSON.parse(localStorage.getItem('exerciseSessions') || '[]') as ExerciseSession[]
    setSessions(savedSessions)

    // 1주일 데이터 계산
    const weekData = calculateWeeklyData(savedSessions)
    setWeeklyData(weekData)

    // 최근 세션 찾기
    if (savedSessions.length > 0) {
      const sorted = [...savedSessions].sort((a, b) => (b.endTime || b.startTime || 0) - (a.endTime || a.startTime || 0))
      const latest = sorted[0]
      setRecentSession(latest)

      // 최근 세션의 AI 분석 가져오기
      aiAnalysisService.analyzeExercise(latest).then((analysis) => {
        setRecentAnalysis(analysis)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
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

  const getMaxCount = (): number => {
    if (weeklyData.length === 0) return 1
    return Math.max(...weeklyData.map(d => d.count), 1)
  }

  const maxCount = getMaxCount()
  const hasData = sessions.length > 0

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
          
          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex gap-3 items-center">
            <span className="text-white text-sm">
              {authService.getCurrentUser()?.name || '사용자'}님
            </span>
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              설정
            </button>
            <button
              onClick={() => {
                authService.logout()
                navigate('/login')
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              로그아웃
            </button>
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
                      onClick={() => {
                        authService.logout()
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
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">1주일 운동 내역</h2>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-end justify-between gap-2 h-48">
                    {weeklyData.map((data, index) => {
                      const height = maxCount > 0 ? (data.count / maxCount) * 100 : 0
                      const date = new Date(data.date)
                      const dayLabel = date.toLocaleDateString('ko-KR', { weekday: 'short' })
                      const dayNum = date.getDate()
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2">
                          <div className="relative w-full h-40 flex items-end">
                            <div
                              className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-400 hover:to-blue-300"
                              style={{ height: `${height}%`, minHeight: data.count > 0 ? '4px' : '0' }}
                              title={`${data.date}: ${data.count}개`}
                            />
                          </div>
                          <div className="text-xs text-gray-400 text-center">
                            <div>{dayLabel}</div>
                            <div className="font-semibold text-white">{dayNum}일</div>
                            <div className="text-blue-400 font-bold">{data.count}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 최근 운동 내역 */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">최근 운동 내역</h2>
                {recentSession ? (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 mb-1">운동 종목</div>
                        <div className="text-lg font-semibold text-white">
                          {getExerciseName(recentSession.config.type)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">총 카운트</div>
                        <div className="text-lg font-semibold text-blue-400">
                          {(recentSession as any).totalCount || recentSession.counts.length}개
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">평균 점수</div>
                        <div className="text-lg font-semibold text-yellow-400">
                          {Math.round(recentSession.averageScore)}점
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">운동 날짜</div>
                        <div className="text-lg font-semibold text-white">
                          {formatDate(recentSession.endTime || recentSession.startTime)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(recentSession.endTime || recentSession.startTime)}
                        </div>
                      </div>
                    </div>
                    {recentSession.bestScore && (
                      <div className="mt-4 pt-4 border-t border-gray-600">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="text-sm text-gray-400 mb-1">최고 점수</div>
                            <div className="text-xl font-bold text-green-400">
                              {Math.round(recentSession.bestScore.score)}점
                            </div>
                          </div>
                          {recentSession.bestScore.image && (
                            <img
                              src={recentSession.bestScore.image}
                              alt="최고 점수"
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">최근 운동 내역이 없습니다</div>
                )}
              </div>

              {/* 피드백 요약 */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">피드백 요약</h2>
                {loading ? (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center text-gray-400">
                    분석 중...
                  </div>
                ) : recentAnalysis ? (
                  <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">요약</div>
                      <div className="text-white">{recentAnalysis.summary}</div>
                    </div>
                    {recentAnalysis.recommendations && recentAnalysis.recommendations.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-400 mb-2">추천 사항</div>
                        <ul className="list-disc list-inside space-y-1 text-white">
                          {recentAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                            <li key={index} className="text-sm">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {recentAnalysis.bestPoseFeedback && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">최고 자세 피드백</div>
                        <div className="text-green-400 text-sm">{recentAnalysis.bestPoseFeedback}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center text-gray-400">
                    피드백 정보가 없습니다
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 버전 표시 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm text-gray-400">
        v{getVersion()}
      </div>
    </div>
  )
}

export default ModeSelectionPage

