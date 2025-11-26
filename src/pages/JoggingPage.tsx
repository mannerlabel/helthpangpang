import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { joggingService } from '@/services/joggingService'
import { JoggingData, JoggingConfig, WeatherInfo } from '@/types'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

import CrewChatPanel from '@/components/CrewChatPanel'
import CrewMeetingView from '@/components/CrewMeetingView'
import NavigationButtons from '@/components/NavigationButtons'

const JoggingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { config, weather, crewId } = (location.state as {
    config?: JoggingConfig
    weather?: WeatherInfo[]
    crewId?: string
  }) || {}
  
  // 목록에서 설정한 미디어 공유 설정 가져오기
  const initialVideoEnabled = config?.togetherConfig?.videoShare ?? false
  const initialAudioEnabled = config?.togetherConfig?.audioShare ?? false
  
  const [isTracking, setIsTracking] = useState(false)
  const [joggingData, setJoggingData] = useState<JoggingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [meetingViewHeight, setMeetingViewHeight] = useState(120)
  const [entryMessage, setEntryMessage] = useState<string | null>(null)
  const [myVideoEnabled, setMyVideoEnabled] = useState(initialVideoEnabled)
  const [myAudioEnabled, setMyAudioEnabled] = useState(initialAudioEnabled)
  const [hasNewMessage, setHasNewMessage] = useState(false) // 새 메시지 알림 상태
  const [hasEntryNotification, setHasEntryNotification] = useState(false) // 입장 알림 상태
  const [unreadMessageCount, setUnreadMessageCount] = useState(0) // 미확인 메시지 수
  const [isPaused, setIsPaused] = useState(false) // 운동 일시정지 상태
  const [routeExpanded, setRouteExpanded] = useState(false) // 경로 정보 펼침 상태
  const [routePage, setRoutePage] = useState(1) // 경로 정보 페이지 (10개 단위)
  const [hasRecommended, setHasRecommended] = useState(false) // 추천 상태
  const [recommendations, setRecommendations] = useState(0) // 추천수
  const [hasCancelled, setHasCancelled] = useState(false) // 추천 취소 상태
  const [recommendToast, setRecommendToast] = useState<{ message: string; type: 'success' | 'cancel' } | null>(null) // 추천 토스트 메시지

  // hasNewMessage 상태 변경 추적
  useEffect(() => {
    console.log('💬 JoggingPage: hasNewMessage 상태 변경:', hasNewMessage)
  }, [hasNewMessage])

  // entryMessage가 변경되면 입장 알림 활성화
  useEffect(() => {
    if (entryMessage && !chatOpen) {
      setHasEntryNotification(true)
      // 5초 후 자동으로 알림 해제
      const timer = setTimeout(() => {
        setHasEntryNotification(false)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setHasEntryNotification(false)
    }
  }, [entryMessage, chatOpen])

  useEffect(() => {
    if (isTracking) {
      const interval = setInterval(() => {
        const data = joggingService.getCurrentData()
        const paused = joggingService.getIsPaused()
        if (data) {
          setJoggingData(data)
        }
        setIsPaused(paused)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isTracking])

  // 조깅 크루 모드: 활성 세션 등록/해제 (localStorage + Supabase)
  useEffect(() => {
    if (config?.mode === 'together' && crewId) {
      const user = authService.getCurrentUser()
      if (!user) return

      // localStorage에 활성 세션 등록
      const registerLocalSession = () => {
        try {
          const activeSessions = JSON.parse(localStorage.getItem('active_training_sessions') || '[]')
          const sessionExists = activeSessions.some(
            (s: { userId: string; crewId: string }) => s.userId === user.id && s.crewId === crewId
          )
          if (!sessionExists) {
            activeSessions.push({ userId: user.id, crewId, timestamp: Date.now() })
            localStorage.setItem('active_training_sessions', JSON.stringify(activeSessions))
          } else {
            // 타임스탬프 업데이트
            const sessionIndex = activeSessions.findIndex(
              (s: { userId: string; crewId: string }) => s.userId === user.id && s.crewId === crewId
            )
            if (sessionIndex !== -1) {
              activeSessions[sessionIndex].timestamp = Date.now()
              localStorage.setItem('active_training_sessions', JSON.stringify(activeSessions))
            }
          }
        } catch (e) {
          console.error('활성 세션 등록 실패:', e)
        }
      }

      // Supabase에 활성 세션 업데이트 (jogging_crew_members 테이블이 있다면)
      const updateSupabaseActivity = async () => {
        try {
          const { supabase } = await import('@/services/supabaseClient')
          if (supabase) {
            // UUID 매핑
            let supabaseUserId = user.id
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(user.id)) {
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

            // 조깅 크루는 jogging_crew_members 테이블이 없으므로 업데이트하지 않음
            // 활성 세션은 localStorage만 사용
          }
        } catch (e) {
          console.error('Supabase 활성 세션 업데이트 실패:', e)
        }
      }

      registerLocalSession()
      updateSupabaseActivity()

      // 주기적으로 활성 상태 업데이트 (5초마다)
      const interval = setInterval(() => {
        registerLocalSession()
        updateSupabaseActivity()
      }, 5000)

      // 컴포넌트 언마운트 시 활성 세션 제거
      return () => {
        clearInterval(interval)
        try {
          const activeSessions = JSON.parse(localStorage.getItem('active_training_sessions') || '[]')
          const filtered = activeSessions.filter(
            (s: { userId: string; crewId: string }) => !(s.userId === user.id && s.crewId === crewId)
          )
          localStorage.setItem('active_training_sessions', JSON.stringify(filtered))
          
          // Supabase에서도 비활성 상태로 설정
          ;(async () => {
            try {
              const { supabase } = await import('@/services/supabaseClient')
              if (supabase) {
                let supabaseUserId = user.id
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                if (!uuidRegex.test(user.id)) {
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
                
                // 조깅 크루는 jogging_crew_members 테이블이 없으므로 업데이트하지 않음
                // 활성 세션은 localStorage만 사용
              }
            } catch (e) {
              // 무시
            }
          })()
        } catch (e) {
          console.error('활성 세션 제거 실패:', e)
        }
      }
    }
  }, [config?.mode, crewId, myAudioEnabled])

  // 입장 시 초기 미디어 설정을 즉시 데이터베이스에 반영
  useEffect(() => {
    if (config?.mode === 'together' && crewId) {
      const user = authService.getCurrentUser()
      if (!user) return

      // 초기값이 설정되어 있으면 즉시 데이터베이스 업데이트
      const updateInitialSettings = async () => {
        try {
          await databaseService.updateCrewMember(crewId, user.id, {
            videoEnabled: initialVideoEnabled ?? false,
            audioEnabled: initialAudioEnabled ?? false,
          })
          console.log('✅ 조깅 모드: 입장 시 초기 미디어 설정 반영 완료', {
            videoEnabled: initialVideoEnabled ?? false,
            audioEnabled: initialAudioEnabled ?? false,
          })
        } catch (error) {
          console.error('❌ 조깅 모드: 입장 시 초기 미디어 설정 반영 실패:', error)
        }
      }
      updateInitialSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 마운트 시 한 번만 실행

  // 조깅 함께 모드: 영상/음성 토글 업데이트 (크루 모드와 동일하게)
  useEffect(() => {
    if (config?.mode === 'together' && crewId) {
      const updateMemberSettings = async () => {
        const user = authService.getCurrentUser()
        if (!user) return

        try {
          await databaseService.updateCrewMember(crewId, user.id, {
            videoEnabled: myVideoEnabled,
            audioEnabled: myAudioEnabled,
          })
          console.log('✅ 조깅 모드: 멤버 설정 업데이트 완료', {
            crewId,
            userId: user.id,
            videoEnabled: myVideoEnabled,
            audioEnabled: myAudioEnabled,
          })
        } catch (error) {
          console.error('❌ 조깅 모드: 멤버 설정 업데이트 실패:', error)
        }
      }
      updateMemberSettings()
    }
  }, [config?.mode, crewId, myVideoEnabled, myAudioEnabled])

  // 조깅 크루 정보 및 추천 상태 로드
  useEffect(() => {
    if (config?.mode === 'together' && crewId) {
      const loadCrewInfo = async () => {
        const user = authService.getCurrentUser()
        if (!user) return

        try {
          const crew = await databaseService.getJoggingCrewById(crewId)
          if (crew) {
            setRecommendations(crew.recommendations || 0)
          }

          const hasRec = await databaseService.hasUserRecommendedJoggingCrew(crewId, user.id)
          const hasCancel = await databaseService.hasUserCancelledJoggingCrewRecommendation(crewId, user.id)
          setHasRecommended(hasRec)
          setHasCancelled(hasCancel)
        } catch (error) {
          console.error('조깅 크루 정보 로드 실패:', error)
        }
      }
      loadCrewInfo()
    }
  }, [config?.mode, crewId])

  // 추천 버튼 클릭 핸들러
  const handleRecommend = async () => {
    if (!crewId) return
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    try {
      console.log('🔘 조깅 크루 추천 버튼 클릭:', { crewId, userId: user.id })
      const result = await databaseService.toggleJoggingCrewRecommendation(crewId, user.id)
      console.log('📊 조깅 크루 추천 처리 결과:', result)
      
      if (result.success) {
        console.log('✅ 조깅 크루 추천 처리 성공')
        setHasRecommended(result.isRecommended)
        setRecommendations(result.recommendations)
        // 추천 취소 시에만 hasCancelled를 true로 설정
        if (!result.isRecommended) {
          setHasCancelled(true)
          // 추천 취소 메시지 표시
          setRecommendToast({ message: '추천이 취소되었습니다', type: 'cancel' })
        } else {
          // 다시 추천하면 취소 상태 해제
          setHasCancelled(false)
          // 추천 성공 메시지 표시
          setRecommendToast({ message: '추천되었습니다', type: 'success' })
        }
        // 2초 후 토스트 메시지 자동 제거
        setTimeout(() => {
          setRecommendToast(null)
        }, 2000)
      } else {
        console.warn('⚠️ 조깅 크루 추천 처리 실패:', result)
        alert('추천 처리에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('추천 처리 중 오류:', error)
      console.error('에러 상세:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint
      })
      
      // RLS 정책 관련 에러
      if (error?.code === '42501' || error?.message?.includes('permission denied') || error?.message?.includes('권한')) {
        alert('추천 기능을 사용하려면 Supabase에서 DATABASE_SETUP.sql 파일을 실행하여 RLS 정책을 설정해주세요.')
      } else if (error?.code === 'PGRST205' || error?.code === '42P01' || error?.message?.includes('table') || error?.message?.includes('테이블')) {
        alert('추천 취소 기능을 사용하려면 Supabase에서 DATABASE_SETUP.sql 파일을 실행하여 테이블을 생성해주세요.')
      } else if (error?.code === '23505' || error?.message?.includes('unique constraint')) {
        alert('이미 추천한 조깅 크루입니다.')
      } else {
        const errorMessage = error?.message || error?.details || String(error)
        alert(`추천 처리 중 오류가 발생했습니다: ${errorMessage}\n\n에러 코드: ${error?.code || 'N/A'}`)
      }
    }
  }

  const handleStart = async () => {
    try {
      setError(null)
      const data = await joggingService.startTracking()
      setJoggingData(data)
      setIsTracking(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '조깅 추적을 시작할 수 없습니다.')
    }
  }

  const handleStop = () => {
    const data = joggingService.stopTracking()
    if (data) {
      setJoggingData(data)
    }
    setIsTracking(false)
    setIsPaused(false)
  }

  const handlePause = () => {
    if (isPaused) {
      joggingService.resumeTracking()
      setIsPaused(false)
    } else {
      joggingService.pauseTracking()
      setIsPaused(true)
    }
  }

  const handleLeave = () => {
    if (isTracking) {
      if (window.confirm('조깅을 종료하고 나가시겠습니까?')) {
        handleStop()
        // 모드에 따라 이전 화면으로 이동
        if (config?.mode === 'alone') {
          navigate('/jogging-alone')
        } else if (config?.mode === 'together') {
          navigate('/jogging-crew/my-crews')
        } else {
          navigate('/jogging-mode-select')
        }
      }
    } else {
      // 모드에 따라 이전 화면으로 이동
      if (config?.mode === 'alone') {
        navigate('/jogging-alone')
      } else if (config?.mode === 'together') {
        navigate('/jogging-crew/my-crews')
      } else {
        navigate('/jogging-mode-select')
      }
    }
  }

  const formatTime = (ms: number): string => {
    // NaN이나 0 이하 값 처리
    if (!ms || isNaN(ms) || ms < 0) {
      return '00:00'
    }
    
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    // 시간이 1시간 이상일 때만 시간 표시, 그 외에는 MM:SS 형식
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  }

  // 날씨 아이콘 가져오기
  const getWeatherIcon = (condition: string): string => {
    if (condition.includes('맑음') || condition.includes('맑은')) return '☀️'
    if (condition.includes('비') || condition.includes('소나기')) return '🌧️'
    if (condition.includes('눈')) return '❄️'
    if (condition.includes('구름') || condition.includes('흐림')) return '☁️'
    return '🌤️'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">
          조깅 모드 🏃 {config?.mode === 'together' && '(함께)'}
        </h1>
          <NavigationButtons 
            showBack={true}
            showHome={true}
            backPath={config?.mode === 'alone' ? '/jogging-alone' : config?.mode === 'together' ? '/jogging-crew/my-crews' : '/jogging-mode-select'}
          />
        </div>
        
        {/* 날씨 정보 표시 - 애플워치 스타일 */}
        {weather && weather.length > 0 && config?.mode === 'alone' && (
                <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-black/30 backdrop-blur-md rounded-3xl p-4 border border-white/10">
              <div className="flex items-center justify-between gap-3">
                {/* 오늘 날씨 - 메인 */}
                {weather[0] && (
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-4xl">{getWeatherIcon(weather[0].condition)}</div>
                    <div className="flex-1">
                      <div className="text-xs text-white/60 mb-1 font-medium">오늘</div>
                      <div className="text-2xl font-bold text-white tabular-nums">
                        {weather[0].temperature}°
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 추가 정보 - 컴팩트 */}
                <div className="flex items-center gap-4 text-white/80">
                  <div className="text-center">
                    <div className="text-xs text-white/50 mb-0.5">습도</div>
                    <div className="text-sm font-semibold tabular-nums">{weather[0]?.humidity}%</div>
                  </div>
                  <div className="w-px h-8 bg-white/20"></div>
                  <div className="text-center">
                    <div className="text-xs text-white/50 mb-0.5">자외선</div>
                    <div className="text-sm font-semibold tabular-nums">{weather[0]?.uvIndex}</div>
                  </div>
                  {weather[0]?.pm10 !== undefined && (
                    <>
                      <div className="w-px h-8 bg-white/20"></div>
                      <div className="text-center">
                        <div className="text-xs text-white/50 mb-0.5">미세먼지</div>
                        <div className="text-sm font-semibold tabular-nums">{weather[0].pm10}</div>
                      </div>
                    </>
                    )}
                  </div>
              </div>
              
              {/* 내일/모레 날씨 - 미니 카드 */}
              {weather.length > 1 && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                  {weather.slice(1, 3).map((w, index) => (
                    <div key={index} className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-xl">{getWeatherIcon(w.condition)}</div>
                        <div className="flex-1">
                          <div className="text-xs text-white/50">{w.date}</div>
                          <div className="text-sm font-semibold text-white tabular-nums">{w.temperature}°</div>
                        </div>
                      </div>
                      {/* 습도와 자외선 정보 */}
                      <div className="flex items-center gap-3 text-xs text-white/70">
                        <div className="flex items-center gap-1">
                          <span>💧</span>
                          <span className="tabular-nums">{w.humidity}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>☀️</span>
                          <span className="tabular-nums">{w.uvIndex}</span>
                        </div>
                      </div>
                    </div>
              ))}
            </div>
              )}
          </div>
          </motion.div>
        )}
        
        {/* 목표 정보 표시 - 애플워치 스타일 */}
        {config && (config.targetDistance || config.targetTime) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-black/30 backdrop-blur-md rounded-3xl p-5 border border-white/10">
              <div className="text-xs text-white/60 mb-3 font-medium uppercase tracking-wider">목표</div>
            <div className="grid grid-cols-2 gap-4">
              {config.targetDistance && (
                <div className="text-center">
                    <div className="text-3xl font-bold text-green-400 tabular-nums mb-1">
                      {config.targetDistance}
                  </div>
                    <div className="text-xs text-white/50 uppercase tracking-wide">km</div>
                </div>
              )}
              {config.targetTime && (
                <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400 tabular-nums mb-1">
                      {config.targetTime}
                  </div>
                    <div className="text-xs text-white/50 uppercase tracking-wide">분</div>
                </div>
              )}
            </div>
          </div>
          </motion.div>
        )}

        {error && (
          <div className="bg-red-500 text-white p-4 rounded-xl mb-6">{error}</div>
        )}

        {!isTracking && !joggingData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/30 backdrop-blur-md rounded-3xl p-8 text-center border border-white/10"
          >
            <div className="text-6xl mb-4">🏃</div>
            <p className="text-white/80 mb-6 text-sm leading-relaxed">
              위치 추적을 시작하여 조깅 경로, 속도, 시간, 거리를 자동으로 기록합니다.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStart}
              className="px-8 py-4 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition text-lg font-semibold shadow-lg"
            >
              조깅 시작
            </motion.button>
          </motion.div>
        )}

        {joggingData && (
          <div className="space-y-6">
            {/* 통계 - 애플워치 스타일 */}
            <div className="grid grid-cols-3 gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-black/30 backdrop-blur-md rounded-3xl p-5 text-center border border-white/10"
              >
                <div className="text-xs text-white/60 mb-2 font-medium uppercase tracking-wider">거리</div>
                <div className="text-2xl font-bold text-green-400 mb-1 tabular-nums">
                  {joggingData.distance.toFixed(2)}
                </div>
                <div className="text-xs text-white/50 uppercase">km</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-black/30 backdrop-blur-md rounded-3xl p-5 text-center border border-white/10"
              >
                <div className="text-xs text-white/60 mb-2 font-medium uppercase tracking-wider">속도</div>
                <div className="text-2xl font-bold text-blue-400 mb-1 tabular-nums">
                  {joggingData.averageSpeed.toFixed(2)}
                </div>
                <div className="text-xs text-white/50 uppercase">km/h</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-black/30 backdrop-blur-md rounded-3xl p-5 text-center border border-white/10"
              >
                <div className="text-xs text-white/60 mb-2 font-medium uppercase tracking-wider">시간</div>
                <div className="text-2xl font-bold text-yellow-400 mb-1 tabular-nums font-mono">
                  {formatTime(joggingData.averageTime)}
                </div>
                <div className="text-xs text-white/50 uppercase">경과</div>
              </motion.div>
            </div>

            {/* 경로 정보 */}
            {joggingData.route.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 backdrop-blur-md rounded-3xl p-6 border border-white/10"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-bold text-white">경로 정보</h3>
                  <button
                    onClick={() => {
                      if (!routeExpanded) {
                        setRoutePage(1) // 펼칠 때 첫 페이지로 리셋
                      }
                      setRouteExpanded(!routeExpanded)
                    }}
                    className="px-4 py-2 bg-gray-700/50 text-white rounded-lg hover:bg-gray-600/50 transition text-sm"
                  >
                    {routeExpanded ? '접기' : '펼침목록보기'}
                  </button>
                </div>
                <p className="text-xs text-white/50 mb-3">
                  위치 기록은 30초 간격으로 이루어 집니다.
                </p>
                <p className="text-gray-300 mb-4">
                  기록된 위치 포인트: {joggingData.route.length}개
                </p>
                
                {routeExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-2"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400">
                        {((routePage - 1) * 10) + 1} - {Math.min(routePage * 10, joggingData.route.length)} / {joggingData.route.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRoutePage(Math.max(1, routePage - 1))}
                          disabled={routePage === 1}
                          className="px-3 py-1 bg-gray-700/50 text-white rounded hover:bg-gray-600/50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          이전
                        </button>
                        <button
                          onClick={() => setRoutePage(Math.min(Math.ceil(joggingData.route.length / 10), routePage + 1))}
                          disabled={routePage >= Math.ceil(joggingData.route.length / 10)}
                          className="px-3 py-1 bg-gray-700/50 text-white rounded hover:bg-gray-600/50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          다음
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {joggingData.route
                        .slice((routePage - 1) * 10, routePage * 10)
                        .map((point, index) => {
                          // 안전하게 좌표 값 가져오기 (lat/lng 또는 latitude/longitude 지원)
                          const lat = point.lat ?? (point as any).latitude
                          const lng = point.lng ?? (point as any).longitude
                          
                          if (lat === undefined || lng === undefined) {
                            return null
                          }
                          
                          return (
                            <div
                              key={index}
                              className="bg-gray-800/50 rounded-lg p-3 text-sm"
                            >
                              <div className="text-white">
                                <span className="text-gray-400">#{((routePage - 1) * 10) + index + 1}</span>
                                {' '}
                                <span className="text-green-400">
                                  {typeof lat === 'number' ? lat.toFixed(6) : 'N/A'}, {typeof lng === 'number' ? lng.toFixed(6) : 'N/A'}
                                </span>
                              </div>
                              {point.timestamp && (
                                <div className="text-gray-500 text-xs mt-1">
                                  {new Date(point.timestamp).toLocaleTimeString()}
              </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* 버튼 */}
            <div className="flex gap-4">
              {isTracking ? (
                <>
                  <button
                    onClick={handlePause}
                    className={`flex-1 px-6 py-4 rounded-xl transition font-semibold ${
                      isPaused
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {isPaused ? '운동 재개' : '운동일시정지'}
                  </button>
                <button
                  onClick={handleStop}
                    className="flex-1 px-6 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-semibold"
                >
                  조깅 종료
                </button>
                  <button
                    onClick={handleLeave}
                    className="px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition font-semibold"
                  >
                    나가기
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleStart}
                    className="flex-1 px-6 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-semibold"
                  >
                    다시 시작
                  </button>
                  <button
                    onClick={handleLeave}
                    className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition font-semibold"
                  >
                    나가기
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 조깅 함께 모드: 미팅 화면 (하단) */}
        {config?.mode === 'together' && crewId && (
          <div className="fixed left-0 right-0 z-30" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <CrewMeetingView
              crewId={crewId}
              myVideoEnabled={myVideoEnabled}
              myAudioEnabled={myAudioEnabled}
              onVideoToggle={setMyVideoEnabled}
              onAudioToggle={setMyAudioEnabled}
              myStatus={isTracking ? 'active' : 'inactive'}
              onHeightChange={setMeetingViewHeight}
              onEntryMessage={setEntryMessage}
              crewType="jogging"
            />
          </div>
        )}

        {/* 조깅 함께 모드: 추천 버튼 및 채팅 버튼 (오른쪽 끝) - 운동 시작 후에만 표시 */}
        {config?.mode === 'together' && crewId && (isTracking || isPaused) && (
          <>
            {/* 추천 버튼 */}
            <button
              onClick={handleRecommend}
              className={`fixed right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${
                hasRecommended
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
              style={{ 
                bottom: `calc(${meetingViewHeight + 80}px + env(safe-area-inset-bottom, 0px))`,
              }}
              title={hasRecommended ? '추천 취소' : '추천하기'}
            >
              <span className="text-2xl relative">
                ⭐
                {recommendations > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {recommendations > 9 ? '9+' : recommendations}
                  </span>
                )}
              </span>
            </button>
            {/* 채팅 버튼 */}
            <motion.button
              onClick={() => {
                console.log('💬 JoggingPage: 채팅 버튼 클릭', { hasNewMessage, hasEntryNotification })
                setChatOpen(true)
                setHasNewMessage(false) // 채팅창 열면 알림 해제
                setHasEntryNotification(false) // 입장 알림도 해제
                console.log('💬 JoggingPage: 알림 상태를 false로 설정')
              }}
              className="fixed right-20 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition"
              style={{ 
                bottom: `calc(${meetingViewHeight + 80}px + env(safe-area-inset-bottom, 0px))`,
                backgroundColor: (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? '#fbbf24' : '#a855f7' // 새 메시지, 입장 알림, 또는 미확인 메시지 있으면 노란색
              }}
              title={`채팅 열기${unreadMessageCount > 0 ? ` (${unreadMessageCount}개 미확인)` : ''}`}
              animate={(hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? {
                x: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1],
              } : {}}
              transition={{
                duration: 0.5,
                repeat: (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? Infinity : 0,
                repeatDelay: 1,
              }}
              onAnimationStart={() => {
                if (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) {
                  console.log('💬 JoggingPage: 채팅 아이콘 애니메이션 시작 (흔들림)')
                }
              }}
            >
              <motion.span 
                className="text-2xl relative"
                animate={(hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? {
                  opacity: [1, 0.5, 1, 0.5, 1],
                } : {}}
                transition={{
                  duration: 0.5,
                  repeat: (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? Infinity : 0,
                  repeatDelay: 1,
                }}
              >
                💬
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </motion.span>
            </motion.button>
            <CrewChatPanel 
              crewId={crewId} 
              isOpen={chatOpen} 
              onClose={() => {
                console.log('💬 JoggingPage: 채팅창 닫기')
                setChatOpen(false)
              }}
              entryMessage={entryMessage}
              onNewMessage={() => {
                console.log('💬 JoggingPage: onNewMessage 콜백 호출됨!', { chatOpen })
                if (!chatOpen) {
                  console.log('💬 JoggingPage: hasNewMessage를 true로 설정')
                  setHasNewMessage(true)
                } else {
                  console.log('💬 JoggingPage: 채팅창이 열려있어서 알림 설정 안함')
                }
              }}
              onUnreadCountChange={(count) => {
                console.log('💬 JoggingPage: 미확인 메시지 수 변경:', count)
                setUnreadMessageCount(count)
              }}
            />
          </>
        )}

        {/* 추천 토스트 메시지 */}
        {recommendToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[100]"
          >
            <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
              recommendToast.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-orange-500 text-white'
            }`}>
              <span className="text-xl">
                {recommendToast.type === 'success' ? '✅' : '⚠️'}
              </span>
              <span className="font-semibold">{recommendToast.message}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default JoggingPage

