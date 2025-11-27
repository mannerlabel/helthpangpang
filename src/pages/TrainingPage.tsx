import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCamera } from '@/hooks/useCamera'
import { usePoseDetection } from '@/hooks/usePoseDetection'
import { handDetectionService } from '@/services/handDetectionService'
import { countService } from '@/services/countService'
import { audioService } from '@/services/audioService'
import { imageCaptureService } from '@/services/imageCaptureService'
import { silhouetteService } from '@/services/silhouetteService'
import { analyzePose } from '@/utils/poseAnalyzer'
import { createCountEffect, createPoseScoreEffect } from '@/utils/effects'
import CameraView from '@/components/CameraView'
import PoseCanvas from '@/components/PoseCanvas'
import CountDisplay from '@/components/CountDisplay'
import EffectOverlay from '@/components/EffectOverlay'
import SilhouetteCanvas from '@/components/SilhouetteCanvas'
import DebugInfo from '@/components/DebugInfo'
import VolumeControl from '@/components/VolumeControl'
import CrewMeetingView from '@/components/CrewMeetingView'
import CrewChatPanel from '@/components/CrewChatPanel'
import NavigationButtons from '@/components/NavigationButtons'
import { AppMode, ExerciseConfig, ExerciseSession, ExerciseCount, Effect, AlarmConfig, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES, EXERCISE_TYPES } from '@/constants/exerciseTypes'
import { getVersion } from '@/utils/version'
import { alarmService } from '@/services/alarmService'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'

// 숫자를 한국어로 변환 (하나, 둘, 셋...)
const convertToKorean = (num: number): string => {
  const koreanNumbers = [
    '', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
    '열하나', '열둘', '열셋', '열넷', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스무',
  ]
  
  if (num <= 20) {
    return koreanNumbers[num] || num.toString()
  }
  
  // 20 이상은 숫자로 반환
  return num.toString()
}

const TrainingPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { mode, config, alarm, backgroundMusic, crewId, videoEnabled: initialVideoEnabled, audioEnabled: initialAudioEnabled } = (location.state as {
    mode: AppMode
    config: ExerciseConfig
    alarm?: AlarmConfig
    backgroundMusic?: number
    crewId?: string
    videoEnabled?: boolean
    audioEnabled?: boolean
  }) || { mode: 'single', config: { type: 'squat', sets: 2, reps: 6 } }
  
  const [alarmNotification, setAlarmNotification] = useState<{ message: string; type: 'info' | 'warning' | 'start' } | null>(null)
  const [showStartDialog, setShowStartDialog] = useState(false)

  const [isStarted, setIsStarted] = useState(false)
  const [isExercisePaused, setIsExercisePaused] = useState(false) // 운동 일시정지 상태
  const [currentSet, setCurrentSet] = useState(1)
  const [currentCount, setCurrentCount] = useState(0)
  const [poseScore, setPoseScore] = useState(0)
  const [lastCountScore, setLastCountScore] = useState<number | null>(null) // 마지막 카운트 점수
  const [setAverageScores, setSetAverageScores] = useState<Map<number, number>>(new Map()) // 세트별 평균점수
  const [currentFeedback, setCurrentFeedback] = useState<string>('') // 실시간 피드백
  const [effects, setEffects] = useState<Effect[]>([])
  const [session, setSession] = useState<ExerciseSession | null>(null)
  const [bestScore, setBestScore] = useState<{ score: number; image: string } | null>(null)
  const [worstScore, setWorstScore] = useState<{ score: number; image: string } | null>(null)
  const [isResting, setIsResting] = useState(false) // 쉬는 시간 중인지
  const [restCountdown, setRestCountdown] = useState(config.restTime || 10) // 쉬는 시간 카운트다운 (초, 기본값 10초)
  const [nextSetNumber, setNextSetNumber] = useState<number | null>(null) // 다음 세트 번호
  const [startCountdown, setStartCountdown] = useState<number | null>(null) // 시작 카운트다운 (10초)
  const [totalCount, setTotalCount] = useState(0) // 전체 카운트 (모든 세트 합계)
  const hasStartedRef = useRef(false) // 운동이 시작되었는지 추적 (리렌더링과 무관)
  
  // 관리자는 이 페이지에 접근할 수 없음
  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user && adminService.isAdmin(user)) {
      alert('관리자는 일반 사용자 모드를 사용할 수 없습니다.')
      navigate('/admin/dashboard')
    }
  }, [navigate])
  
  // 크루 모드 관련 상태 (목록에서 설정한 값으로 초기화)
  const [myVideoEnabled, setMyVideoEnabled] = useState(initialVideoEnabled ?? false)
  const [myAudioEnabled, setMyAudioEnabled] = useState(initialAudioEnabled ?? false)
  
  // 입장 시 초기 미디어 설정을 즉시 데이터베이스에 반영
  useEffect(() => {
    if (mode === 'crew' && crewId) {
      const user = authService.getCurrentUser()
      if (!user) return

      // 초기값이 설정되어 있으면 즉시 데이터베이스 업데이트
      const updateInitialSettings = async () => {
        try {
          await databaseService.updateCrewMember(crewId, user.id, {
            videoEnabled: initialVideoEnabled ?? false,
            audioEnabled: initialAudioEnabled ?? false,
          })
          console.log('✅ 입장 시 초기 미디어 설정 반영 완료', {
            videoEnabled: initialVideoEnabled ?? false,
            audioEnabled: initialAudioEnabled ?? false,
          })
        } catch (error) {
          console.error('❌ 입장 시 초기 미디어 설정 반영 실패:', error)
        }
      }
      updateInitialSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 마운트 시 한 번만 실행
  const [chatOpen, setChatOpen] = useState(false)
  const [crewVideoShareEnabled, setCrewVideoShareEnabled] = useState(true) // 크루 영상 공유 설정
  const [crewAudioShareEnabled, setCrewAudioShareEnabled] = useState(true) // 크루 음성 공유 설정
  const [meetingViewHeight, setMeetingViewHeight] = useState(120) // 바텀시트 높이
  const [isCompleted, setIsCompleted] = useState(false)
  const [entryMessage, setEntryMessage] = useState<string | null>(null) // 입장 메시지 (데이터베이스에 저장하지 않음)
  const [hasNewMessage, setHasNewMessage] = useState(false) // 새 메시지 알림 상태
  const [hasEntryNotification, setHasEntryNotification] = useState(false) // 입장 알림 상태
  const [unreadMessageCount, setUnreadMessageCount] = useState(0) // 미확인 메시지 수
  const [hasRecommended, setHasRecommended] = useState(false) // 추천 상태
  const [showExitConfirm, setShowExitConfirm] = useState(false) // 나가기 확인 모달
  const [isExiting, setIsExiting] = useState(false) // 나가기 처리 중 상태 (중복 클릭 방지)
  const [recommendations, setRecommendations] = useState(0) // 추천수
  const [hasCancelled, setHasCancelled] = useState(false) // 추천 취소 상태
  const [recommendToast, setRecommendToast] = useState<{ message: string; type: 'success' | 'cancel' } | null>(null) // 추천 토스트 메시지

  // hasNewMessage 상태 변경 추적
  useEffect(() => {
    console.log('💬 TrainingPage: hasNewMessage 상태 변경:', hasNewMessage)
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

  // 크루 모드: 활성 세션 등록/해제 (localStorage + Supabase)
  useEffect(() => {
    if (mode === 'crew' && crewId) {
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

      // Supabase에 활성 세션 업데이트 (crew_members 테이블의 updated_at 갱신)
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

            // crew_members의 video_enabled/audio_enabled를 업데이트하여 활성 상태 표시
            // 주기적으로 업데이트하여 활성 상태 유지
            // 활성 상태를 나타내기 위해 video_enabled를 true로 설정 (실제 카메라 상태와 무관)
            // 참고: 실제 카메라 on/off는 별도로 관리하고, 여기서는 활성 상태만 표시
            await supabase
              .from('crew_members')
              .update({ 
                video_enabled: true, // 활성 상태 표시 (TrainingPage에 있으면 항상 true)
                audio_enabled: myAudioEnabled,
              })
              .eq('crew_id', crewId)
              .eq('user_id', supabaseUserId)
          }
        } catch (e) {
          console.error('Supabase 활성 세션 업데이트 실패:', e)
        }
      }

      registerLocalSession()
      updateSupabaseActivity()

      // 주기적으로 활성 상태 업데이트 (5초마다 - 더 빠른 동기화)
      const activityInterval = setInterval(() => {
        registerLocalSession()
        updateSupabaseActivity()
      }, 5000)

      return () => {
        clearInterval(activityInterval)
        // 컴포넌트 언마운트 시 세션 제거 및 Supabase에서 비활성 상태로 설정
        const cleanup = async () => {
          try {
            // localStorage에서 세션 제거
            const activeSessions = JSON.parse(localStorage.getItem('active_training_sessions') || '[]')
            const filtered = activeSessions.filter(
              (s: { userId: string; crewId: string }) => !(s.userId === user.id && s.crewId === crewId)
            )
            localStorage.setItem('active_training_sessions', JSON.stringify(filtered))
            
            // Supabase에서 video_enabled를 false로 설정하여 비활성 상태 표시
            try {
              const { supabase } = await import('@/services/supabaseClient')
              if (supabase && crewId) {
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
                
                // video_enabled를 false로 설정하여 비활성 상태 표시
                await supabase
                  .from('crew_members')
                  .update({ 
                    video_enabled: false, // 나갔으므로 false로 설정
                    audio_enabled: false,
                  })
                  .eq('crew_id', crewId)
                  .eq('user_id', supabaseUserId)
                
                console.log('✅ 비활성 상태로 설정 완료:', supabaseUserId)
              }
            } catch (e) {
              console.error('Supabase 비활성 상태 설정 실패:', e)
            }
          } catch (e) {
            console.error('활성 세션 제거 실패:', e)
          }
        }
        
        cleanup()
      }
    }
  }, [mode, crewId])

  // 크루 정보 및 추천 상태 로드
  useEffect(() => {
    if (mode === 'crew' && crewId) {
      const loadCrewInfo = async () => {
        const user = authService.getCurrentUser()
        if (!user) return

        try {
          const crew = await databaseService.getCrewById(crewId)
          if (crew) {
            setRecommendations(crew.recommendations || 0)
            // 크루 설정에서 영상/음성 공유 설정 가져오기
            setCrewVideoShareEnabled(crew.videoShareEnabled ?? true)
            setCrewAudioShareEnabled(crew.audioShareEnabled ?? true)
            console.log('✅ 크루 설정 로드:', {
              videoShareEnabled: crew.videoShareEnabled,
              audioShareEnabled: crew.audioShareEnabled,
            })
          }

          const hasRec = await databaseService.hasUserRecommendedCrew(crewId, user.id)
          const hasCancel = await databaseService.hasUserCancelledCrewRecommendation(crewId, user.id)
          setHasRecommended(hasRec)
          setHasCancelled(hasCancel)
        } catch (error) {
          console.error('크루 정보 로드 실패:', error)
        }
      }
      loadCrewInfo()
    }
  }, [mode, crewId])

  // 조깅 모드는 별도 페이지로 리다이렉트
  useEffect(() => {
    if (mode === 'jogging') {
      navigate('/jogging')
    }
  }, [mode, navigate])

  // 알람 설정
  useEffect(() => {
    if (alarm && alarm.enabled) {
      const alarmId = `alarm_${Date.now()}`
      
      // 크루 이름 가져오기
      const loadCrewName = async () => {
        if (mode === 'crew' && crewId) {
          try {
            const crew = await databaseService.getCrewById(crewId)
            return crew?.name
          } catch (error) {
            console.error('크루 이름 로드 실패:', error)
            return undefined
          }
        }
        return undefined
      }
      
      loadCrewName().then((crewName) => {
        alarmService.setAlarm(
          alarmId,
          alarm,
          config,
          (message, type) => {
            // 알람 알림 시 딩동 사운드 출력
            audioService.playCountSound(1)
            setAlarmNotification({ message, type })
            // 5초 후 알림 자동 닫기 (start 타입 제외)
            if (type !== 'start') {
              setTimeout(() => setAlarmNotification(null), 5000)
            } else {
              setShowStartDialog(true)
            }
          },
          () => {
            // 운동 시작
            setShowStartDialog(false)
            setAlarmNotification(null)
            // 운동 시작 로직은 이미 구현되어 있음
          },
          crewName
        )
      })

      return () => {
        alarmService.clearAlarm(alarmId)
      }
    }
  }, [alarm, config, mode, crewId])

  // 설정 불러오기 (로컬 스토리지에서)
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      audioService.setConfig({
        enabled: parsed.audioEnabled,
        volume: parsed.audioVolume,
        voiceType: parsed.voiceType,
        backgroundMusic: parsed.backgroundMusic || 1,
      })
    }
  }, [])

  // 마지막 갯수 미션 상태
  const [lastCountMission, setLastCountMission] = useState<{ type: 'one' | 'two'; bonus: number } | null>(null)
  const [missionCompleted, setMissionCompleted] = useState(false)

  const silhouetteCanvasRef = useRef<HTMLCanvasElement>(null)

  const { state: cameraState, videoRef: cameraVideoRef, start: startCamera } = useCamera({
    width: 1280,
    height: 720,
    facingMode: 'user',
  })

  // 자세 인식: 카메라가 활성화되어 있고, 운동이 시작되었거나 쉬는 시간 중일 때도 활성화 (화면 유지)
  // 쉬는 시간 중에도 자세 인식을 유지하여 화면이 꺼지지 않도록 함
  const poseDetectionEnabled = cameraState.isActive && (isStarted || isResting) && !isExercisePaused
  const { poses, isInitialized: poseInitialized } = usePoseDetection(
    cameraVideoRef,
    poseDetectionEnabled
  )
  
  // 디버깅: 자세 인식 상태 로그 (상태 변경 시마다)
  useEffect(() => {
    console.log('🎯 자세 인식 상태:', {
      enabled: poseDetectionEnabled,
      isActive: cameraState.isActive,
      isStarted,
      isResting,
      isInitialized: poseInitialized,
      posesLength: poses.length,
      hasVideoRef: !!cameraVideoRef.current,
      videoReady: cameraVideoRef.current?.readyState === 4,
      videoWidth: cameraVideoRef.current?.videoWidth,
      videoHeight: cameraVideoRef.current?.videoHeight,
    })
  }, [poseDetectionEnabled, cameraState.isActive, isStarted, isResting, poseInitialized, poses.length])
  
  // 디버깅: isStarted 변경 추적
  useEffect(() => {
    console.log('🔄 isStarted 변경:', isStarted, {
      timestamp: Date.now(),
      poseDetectionEnabled: cameraState.isActive && (isStarted || isResting),
      hasStartedRef: hasStartedRef.current,
    })
  }, [isStarted, cameraState.isActive, isResting])

  // 카메라 시작
  useEffect(() => {
    if (!cameraState.isActive && mode !== 'jogging') {
      // video 요소가 마운트될 때까지 약간의 지연
      const timer = setTimeout(() => {
        console.log('카메라 시작 시도...')
        startCamera()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [mode, cameraState.isActive])

  // 카메라가 활성화되면 자동으로 10초 카운트다운 시작
  useEffect(() => {
    // isStarted가 true이거나 이미 시작했으면 카운트다운을 다시 시작하지 않음
    if (cameraState.isActive && !isStarted && !hasStartedRef.current && startCountdown === null) {
      console.log('🎬 카운트다운 시작')
      setStartCountdown(10)
    }
  }, [cameraState.isActive, isStarted, startCountdown])

  // 시작 카운트다운
  useEffect(() => {
    // isStarted가 이미 true이거나 이미 시작했으면 카운트다운을 시작하지 않음
    if (isStarted || hasStartedRef.current || startCountdown === null || startCountdown <= 0) {
      return
    }

    let lastSpokenCount = -1 // 마지막으로 말한 카운트 (중복 방지)
    let countdownStartTime = Date.now() // 카운트다운 시작 시간
    let initialCountdown = startCountdown // 초기 카운트다운 값 저장

    console.log('⏱️ 카운트다운 시작:', startCountdown)

    // iOS에서 백그라운드 전환 시 타이머가 느려지는 문제 해결
    // Page Visibility API를 사용하여 페이지가 활성화되어 있을 때만 카운트다운 진행
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⚠️ 페이지가 백그라운드로 전환됨')
      } else {
        console.log('✅ 페이지가 포그라운드로 전환됨, 시간 동기화')
        // 포그라운드로 돌아올 때 시간 동기화
        countdownStartTime = Date.now() - (initialCountdown - (startCountdown || initialCountdown)) * 1000
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    const interval = setInterval(() => {
      // isStarted가 true가 되거나 이미 시작했으면 즉시 정지
      if (isStarted || hasStartedRef.current) {
        clearInterval(interval)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        return
      }

      // iOS에서 정확한 시간 측정을 위해 실제 경과 시간 사용
      const elapsed = Math.floor((Date.now() - countdownStartTime) / 1000)
      const currentCount = Math.max(0, initialCountdown - elapsed)

      // 실제 경과 시간 기반으로 카운트다운 업데이트
      setStartCountdown((prev) => {
        // 이미 업데이트된 값이면 스킵
        if (prev === currentCount) {
          return prev
        }
        
        const newCount = currentCount
        
        // newCount가 0 이하이면 카운트다운 종료
        if (newCount <= 0) {
          // 중복 시작 방지
          if (hasStartedRef.current) {
            console.log('⚠️ 이미 시작됨, 중복 시작 방지')
            return null
          }
          
          // ref를 먼저 설정하여 중복 시작 방지
          hasStartedRef.current = true
          
          console.log('🚀 운동 시작!')
          
          // 카운트다운 종료, 운동 시작
          // 상태 업데이트를 콜백 외부에서 처리 (React 배치 업데이트 문제 방지)
          // setTimeout을 사용하여 다음 이벤트 루프에서 실행
          setTimeout(() => {
            console.log('📝 상태 업데이트 시작')
            setIsStarted(true)
            setCurrentSet(1)
            setCurrentCount(0)
            setTotalCount(0)
            setLastCountScore(null)
            setSetAverageScores(new Map())
            setIsResting(false)
            setRestCountdown(config.restTime || 10)
            setNextSetNumber(null)
            setStartCountdown(null) // 명시적으로 null로 설정
            
            const newSession: ExerciseSession = {
              id: `session_${Date.now()}`,
              mode,
              config,
              startTime: Date.now(),
              counts: [],
              averageScore: 0,
            }
            setSession(newSession)
            countService.setExerciseType(config.type)
            countService.reset() // 첫 세트 시작 전 카운터 리셋
            console.log('첫 세트 시작! 카운터 리셋 완료')
            
             // 배경음악 재생 (목표에 저장된 배경음악 우선, 없으면 설정에서 가져옴)
             const bgmId = backgroundMusic || (() => {
               const savedSettings = localStorage.getItem('appSettings')
               if (savedSettings) {
                 const parsed = JSON.parse(savedSettings)
                 return parsed.backgroundMusic || 1
               }
               return 1
             })()
             audioService.playBackgroundMusic(bgmId)
          }, 0)
          
          lastSpokenCount = -1 // 리셋
          return null
        }
        
        // 5초 이하일 때만 음성 안내 (중복 방지)
        if (newCount <= 5 && newCount > 0 && newCount !== lastSpokenCount) {
          const koreanNumber = convertToKorean(newCount)
          audioService.speak(koreanNumber)
          lastSpokenCount = newCount // 마지막으로 말한 카운트 저장
        }
        
        return newCount
      })
    }, 100) // 100ms마다 체크하여 더 정확한 시간 측정

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      lastSpokenCount = -1
    }
  }, [startCountdown, isStarted, mode, config])

  // video 요소에 스트림 설정 (srcObject prop 경고 방지)
  useEffect(() => {
    if (cameraVideoRef.current && cameraState.stream) {
      // srcObject를 직접 DOM 속성으로 설정
      if ('srcObject' in cameraVideoRef.current) {
        (cameraVideoRef.current as any).srcObject = cameraState.stream
      }
    }
  }, [cameraState.stream, cameraVideoRef])

  // 손가락 인식 코드 제거됨 (10초 카운트다운으로 대체)

  // 자세 분석 및 카운트
  useEffect(() => {
    // 디버깅: 왜 분석이 스킵되는지 로그 (조건 불만족 시마다)
    if (isStarted && !isResting) {
      if (!poses.length || !cameraVideoRef.current) {
        // 주기적으로 로그 출력 (너무 많이 출력되지 않도록)
        if (Math.random() < 0.1) {
          console.log('⏸️ 자세 분석 스킵:', {
            isStarted,
            isResting,
            posesLength: poses.length,
            hasVideo: !!cameraVideoRef.current,
            videoReady: cameraVideoRef.current?.readyState === 4,
            videoWidth: cameraVideoRef.current?.videoWidth,
            videoHeight: cameraVideoRef.current?.videoHeight,
          })
        }
        return
      }
    }
    
    if (!isStarted || isResting || !poses.length || !cameraVideoRef.current) {
      return
    }
    
    // 자세 분석 시작 로그 (너무 많이 출력되지 않도록 빈도 감소)
    if (Math.random() < 0.02) { // 2% 확률로 로그 출력
      console.log('✅ 자세 분석 시작:', {
        posesLength: poses.length,
        exerciseType: config.type,
        currentCount,
      })
    }
    
    // 세트 시작 시 카운터가 제대로 리셋되었는지 확인 및 동기화
    if (currentCount === 0) {
      const serviceCount = countService.getCurrentCount()
      if (serviceCount !== 0) {
        console.warn(`세트 시작 시 카운터 불일치: 서비스 ${serviceCount}, 화면 ${currentCount}, 강제 리셋`)
        countService.reset()
      }
    }

    const pose = poses[0]
    
    // 키포인트가 충분하지 않으면 스킵
    if (!pose.keypoints || pose.keypoints.length < 10) {
      // 디버깅: 키포인트 부족 로그 (주기적으로)
      if (Math.random() < 0.1) {
        console.log('⚠️ 키포인트 부족:', {
          keypointsLength: pose.keypoints?.length || 0,
          keypoints: pose.keypoints?.map(kp => ({ name: kp.name, score: kp.score })) || [],
        })
      }
      return
    }
    
    // 운동 타입별 필수 키포인트 확인
    if (config.type === EXERCISE_TYPES.SQUAT) {
      const requiredKeypoints = ['left_hip', 'right_hip', 'left_knee', 'right_knee']
      const hasRequired = requiredKeypoints.every(name => 
        pose.keypoints.some(kp => kp.name === name && kp.score && kp.score > 0.2) // 신뢰도 임계값을 0.3 -> 0.2로 낮춤
      )
      
      if (!hasRequired) {
        // 디버깅: 어떤 키포인트가 부족한지 로그 출력
        const missingKeypoints = requiredKeypoints.filter(name => 
          !pose.keypoints.some(kp => kp.name === name && kp.score && kp.score > 0.2)
        )
        if (missingKeypoints.length > 0) {
          console.log('⚠️ 필수 키포인트 부족:', missingKeypoints, {
            전체키포인트: pose.keypoints.map(kp => ({ name: kp.name, score: kp.score })),
          })
        }
        return // 필수 키포인트가 없으면 스킵
      }
    } else if (config.type === EXERCISE_TYPES.PUSHUP) {
      const requiredKeypoints = ['left_shoulder', 'right_shoulder', 'left_wrist', 'right_wrist']
      const hasRequired = requiredKeypoints.every(name => 
        pose.keypoints.some(kp => kp.name === name && kp.score && kp.score > 0.3)
      )
      
      if (!hasRequired) {
        return // 필수 키포인트가 없으면 스킵
      }
    }
    
    const analyzedScore = analyzePose(pose, config.type)
    const score = analyzedScore.overall

    setPoseScore(score)

    // 매 프레임마다 이미지 캡처 제거 (메모리 낭비 방지)
    // 최고/최저 점수 이미지는 카운트 증가 시점의 이미지만 사용

    // 카운트 체크 (스쿼트는 SquatCounter 사용)
    // 매 프레임마다 분석 수행
    // 비디오 높이 전달 (푸시업 카운터에서 좌표 타입 판단용)
    const videoHeight = cameraVideoRef.current?.videoHeight || 720
    const result = countService.analyzePose(pose, videoHeight)
    
    // 디버깅: 스쿼트 분석 결과 로그 (주기적으로, 너무 많이 출력되지 않도록)
    if (config.type === EXERCISE_TYPES.SQUAT && Math.random() < 0.02) { // 2% 확률로 로그 출력
      console.log('🔍 스쿼트 분석 결과:', {
        shouldIncrement: result.shouldIncrement,
        count: result.count,
        feedback: result.feedback,
        poseScore: result.poseScore.overall,
        currentCount,
      })
    }
    
    // 실시간 피드백 업데이트
    if (result.feedback) {
      setCurrentFeedback(result.feedback)
    }
    
    // 실시간 자세 점수 업데이트는 항상 수행
    // (카운트가 증가하지 않아도 자세 점수는 계속 업데이트)
    
    if (result.shouldIncrement) {
      const newCount = result.count
      
      // 현재 세트의 카운트와 일치하는지 확인 (세트별 카운트 동기화)
      // 첫 번째 카운트는 1이어야 하고, 이후는 currentCount + 1이어야 함
      const expectedCount = currentCount === 0 ? 1 : currentCount + 1
      if (newCount !== expectedCount) {
        // 카운트가 일치하지 않으면 무시 (중복 카운트 방지)
        console.warn(`카운트 불일치: 현재 ${currentCount}, 예상 ${expectedCount}, 새 카운트 ${newCount}`)
        return
      }
      
      setCurrentCount(newCount)
      
      // 카운트 완료 시 점수 저장 및 표시
      setLastCountScore(score)
      
      // 카운트 증가 시점에만 이미지 캡처 (메모리 최적화)
      // 이 이미지는 해당 카운트의 기록과 최고/최저 점수 판단에 사용됨
      const image = cameraVideoRef.current 
        ? imageCaptureService.captureImage(cameraVideoRef.current)
        : undefined
      
      // 최고 점수 업데이트 (카운트 증가 시점의 점수와 이미지 사용)
      if (!bestScore || score > bestScore.score) {
        setBestScore({ score, image: image || '' })
      }
      // 최저 점수 업데이트 (카운트 증가 시점의 점수와 이미지 사용)
      if (!worstScore || score < worstScore.score) {
        setWorstScore({ score, image: image || '' })
      }
      
      // countService에서 분석 결과 가져오기 (관절 각도, 깊이, 상태 정보 포함)
      // strategy.analyze()의 결과를 가져오기 위해 countService의 내부 상태 확인
      // 또는 analyzePose 호출 시 반환된 정보 사용
      const strategyResult = (countService as any).strategy?.lastResult || null
      
      setSession((prev) => {
        if (!prev) return prev
        
        const updatedCounts = [
          ...prev.counts,
          {
            count: newCount,
            timestamp: Date.now(),
            poseScore: score,
            image, // 카운트 증가 시점의 이미지 저장 (임시)
            setNumber: currentSet,
            angle: strategyResult?.angle, // 관절 각도 (스쿼트-무릎각도, 푸시업-팔꿈치각도, 런지-무릎각도)
            depth: strategyResult?.depth, // 운동 깊이 (스쿼트, 런지 등)
            state: strategyResult?.state, // 운동 상태 (standing, down, up 등)
          },
        ]
        
        // 현재 세트의 평균점수 계산
        const currentSetCounts = updatedCounts.filter(c => c.setNumber === currentSet)
        const currentSetAverage = currentSetCounts.length > 0
          ? currentSetCounts.reduce((sum, c) => sum + c.poseScore, 0) / currentSetCounts.length
          : 0
        
        // 세트별 평균점수 업데이트
        setSetAverageScores((prev) => {
          const newMap = new Map(prev)
          newMap.set(currentSet, Math.round(currentSetAverage))
          return newMap
        })
        
        console.log(`카운트 ${newCount} 완료! 점수: ${score}점, 총 카운트: ${updatedCounts.length}, 세트: ${currentSet}`)
        
        // totalCount를 session.counts.length와 동기화
        setTotalCount(updatedCounts.length)
        
        // 업데이트된 세션 생성
        const updatedSession: ExerciseSession = {
          ...prev,
          counts: updatedCounts,
        }
        
        // 세트 완료 체크 (setSession 업데이트 후에 실행되도록)
        const isLastCount = newCount === config.reps
        if (isLastCount && currentSet >= config.sets) {
          // 모든 세트 완료 - 최신 세션 데이터를 사용하여 handleFinish 호출
          setTimeout(() => {
            handleFinish(updatedSession)
          }, 0)
        }
        
        return updatedSession
      })
      
      // 2초 후 점수 표시 제거
      setTimeout(() => {
        setLastCountScore(null)
      }, 2000)

      // 마지막 갯수 체크 및 미션 생성
      if (newCount === config.reps - 1) {
        // 마지막 갯수 전에 미션 랜덤 생성
        const missionType = Math.random() < 0.5 ? 'one' : 'two'
        const bonus = missionType === 'one' ? 10 : 20
        setLastCountMission({ type: missionType, bonus })
        
        // 미션 음성 안내
        const missionText = missionType === 'one' ? '한개만 더!' : '두개만 더!'
        audioService.speak(missionText)
      }

      // 마지막 갯수인지 확인
      const isLastCount = newCount === config.reps
      
      // 음성 카운트 안내 (하나, 둘, 셋...)
      const koreanNumber = convertToKorean(newCount)
      audioService.speak(koreanNumber)
      
      // 카운트 사운드 (딩동)
      audioService.playCountSound(newCount)
      
      // 마지막 갯수면 팡파레
      if (isLastCount) {
        audioService.playFanfareSound()
        // 마지막 갯수 미션 완료 처리
        if (lastCountMission && !missionCompleted) {
          setMissionCompleted(true)
          // 추가 보상점수 적용
          const bonusScore = lastCountMission.bonus
          setPoseScore((prev) => Math.min(100, prev + bonusScore))
          // 에너지 효과음 재생
          audioService.playEnergySound()
          // 미션 완료 효과
          setEffects((prev) => [
            ...prev,
            { type: 'emoji', content: '⚡', position: { x: 50, y: 50 }, duration: 2000 },
            { type: 'emoji', content: '🎉', position: { x: 50, y: 50 }, duration: 2000 },
          ])
        }
      }

      // 효과 생성
      const countEffects = createCountEffect(newCount)
      setEffects((prev) => [...prev, ...countEffects])

      // 세트 완료 체크 (다음 세트로 넘어가는 경우만 처리, 모든 세트 완료는 setSession 콜백에서 처리)
      if (newCount === config.reps && currentSet < config.sets) {
        // 다음 세트로 넘어가기 전 쉬는 시간
        const nextSet = currentSet + 1
        setNextSetNumber(nextSet)
        setIsResting(true)
        setRestCountdown(config.restTime || 10) // 설정된 쉬는 시간 사용
        setCurrentCount(0) // 현재 세트 카운트만 0으로 리셋
        setLastCountScore(null)
        // 카운터 서비스 리셋 (다음 세트를 위해)
        countService.reset()
        // 전체 카운트는 유지 (세트별 카운트만 리셋)
        console.log(`세트 ${currentSet} 완료! 다음 세트: ${nextSet}, 총 카운트: ${totalCount}`)
      } else if (newCount > config.reps) {
        // 설정된 갯수를 초과한 경우 더 이상 카운트하지 않음
        console.warn(`카운트가 목표 갯수(${config.reps})를 초과했습니다. 현재: ${newCount}`)
      }
    }

    // 자세 점수 효과 (카운트 증가와 무관하게 항상 체크)
    const scoreEffects = createPoseScoreEffect(score)
    if (scoreEffects.length > 0) {
      setEffects((prev) => [...prev, ...scoreEffects])
    }
  }, [poses, isStarted, isResting, config, currentCount, currentSet, totalCount, cameraState.isActive])

  // 쉬는 시간 카운트다운
  useEffect(() => {
    if (!isResting) return

    let lastSpokenCount = -1 // 마지막으로 말한 카운트 (중복 방지)

    const interval = setInterval(() => {
      setRestCountdown((prev) => {
        if (prev <= 1) {
          // 카운트다운 종료, 다음 세트 시작
          setIsResting(false)
          if (nextSetNumber !== null) {
            const nextSet = nextSetNumber
            setCurrentSet(nextSet)
            setCurrentCount(0) // 다음 세트 시작 시 카운트를 0으로 초기화 (전체 카운트는 유지)
            setNextSetNumber(null)
            // 카운터 서비스 리셋 (중요: 세트 시작 전에 리셋)
            countService.reset()
            console.log(`세트 ${nextSet} 시작! 카운터 리셋 완료`)
            audioService.speak('시작!')
            lastSpokenCount = -1 // 리셋
          }
          return 0
        }
        
        const newCount = prev - 1
        // 10초 이하일 때만 음성 안내 (숫자만, 중복 방지)
        if (newCount <= 10 && newCount > 0 && newCount !== lastSpokenCount) {
          const koreanNumber = convertToKorean(newCount)
          audioService.speak(koreanNumber)
          lastSpokenCount = newCount // 마지막으로 말한 카운트 저장
        }
        return newCount
      })
    }, 1000)

    return () => {
      clearInterval(interval)
      lastSpokenCount = -1
    }
  }, [isResting, nextSetNumber])

  // 컴포넌트 언마운트 시 배경음악 정지 (한 번만 실행)
  useEffect(() => {
    return () => {
      // 페이지를 벗어날 때 확실히 배경음악 정지
      audioService.stopAll()
    }
  }, [])

  // 페이지를 벗어날 때 배경음악 정지 (추가 안전장치)
  useEffect(() => {
    const handleBeforeUnload = () => {
      audioService.stopAll()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // 실루엣 그리기 (쉬는 시간 중에는 그리지 않음)
  useEffect(() => {
    if (!silhouetteCanvasRef.current || !cameraVideoRef.current) return
    
    const canvas = silhouetteCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 캔버스 크기 설정
    canvas.width = cameraVideoRef.current.videoWidth || 1280
    canvas.height = cameraVideoRef.current.videoHeight || 720
    
    // 항상 먼저 초기화 (잔상 제거)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // 쉬는 시간 중이거나 자세가 없으면 여기서 종료
    if (!isStarted || isResting || !poses.length) {
      return
    }

    const pose = poses[0]
    const config = silhouetteService.getSilhouetteConfig(pose, poseScore)
    silhouetteService.drawSilhouette(ctx, pose, config)
  }, [poses, poseScore, isStarted, isResting])

  const handleStart = () => {
    setIsStarted(true)
    setCurrentSet(1)
    setCurrentCount(0)
    setTotalCount(0) // 총 카운트 초기화
    setLastCountScore(null)
    setSetAverageScores(new Map())
    setIsResting(false)
    setRestCountdown(20)
    setNextSetNumber(null)
    setLastCountMission(null)
    setMissionCompleted(false)
    const newSession: ExerciseSession = {
      id: `session_${Date.now()}`,
      mode,
      config,
      startTime: Date.now(),
      counts: [],
      averageScore: 0,
    }
    setSession(newSession)
    countService.setExerciseType(config.type)
    countService.reset()
  }

  const handleFinish = (latestSession?: ExerciseSession) => {
    // 배경음악 정지 (확실하게)
    audioService.stopBackgroundMusic()
    audioService.stopPreview()
    
    // latestSession이 제공되면 사용, 아니면 현재 session state 사용
    const sessionToUse = latestSession || session
    if (!sessionToUse) return

    // session.counts.length를 사용하여 정확한 총 카운트 계산 (totalCount와 동기화)
    const actualTotalCount = sessionToUse.counts.length

    const finalSession: ExerciseSession & { totalCount?: number } = {
      ...sessionToUse,
      endTime: Date.now(),
      bestScore: bestScore
        ? { ...bestScore, timestamp: Date.now() }
        : undefined,
      worstScore: worstScore
        ? { ...worstScore, timestamp: Date.now() }
        : undefined,
      averageScore:
        sessionToUse.counts.length > 0
          ? sessionToUse.counts.reduce((sum, c) => sum + c.poseScore, 0) / sessionToUse.counts.length
          : 0,
      totalCount: actualTotalCount, // totalCount를 세션에 추가
    }

    // 디버깅: 실제 카운트 확인
    if (session) {
      console.log('운동 종료:', {
        sessionCounts: session.counts.length,
        totalCount: totalCount,
        actualTotalCount: actualTotalCount,
        counts: session.counts.map(c => ({ count: c.count, set: c.setNumber }))
      })
    }

    // 크루 모드일 때 완료 상태 설정
    if (mode === 'crew') {
      setIsCompleted(true)
    }
    
    // 크루 모드인 경우 crewId도 함께 전달
    // 싱글 모드인 경우 goalId도 함께 전달 (다시 시작을 위해)
    const { goalId } = (location.state as { goalId?: string }) || {}
    navigate('/result', { 
      state: { 
        session: finalSession,
        crewId: mode === 'crew' ? crewId : undefined,
        config: config,
        alarm: alarm,
        backgroundMusic: backgroundMusic,
        goalId: mode === 'single' ? goalId : undefined,
      } 
    })
  }

  // 운동 종목 이름 변환
  const getExerciseName = (type: string) => {
    return EXERCISE_TYPE_NAMES[type as ExerciseType] || config.customName || '커스텀'
  }

  // 크루 모드: 영상/음성 토글 업데이트
  useEffect(() => {
    if (mode === 'crew' && crewId) {
      const updateMemberSettings = async () => {
        const user = authService.getCurrentUser()
        if (!user) return

        try {
          await databaseService.updateCrewMember(crewId, user.id, {
            videoEnabled: myVideoEnabled,
            audioEnabled: myAudioEnabled,
          })
        } catch (error) {
          console.error('멤버 설정 업데이트 실패:', error)
        }
      }
      updateMemberSettings()
    }
  }, [mode, crewId, myVideoEnabled, myAudioEnabled])

  // 운동 완료 시 크루 모드 상태 업데이트
  useEffect(() => {
    if (isCompleted && mode === 'crew' && crewId) {
      const updateCompletionStatus = async () => {
        const user = authService.getCurrentUser()
        if (!user) return

        try {
          // 완료 상태를 데이터베이스에 저장 (실제로는 세션에서 가져와야 함)
          // 여기서는 예시로만 처리
        } catch (error) {
          console.error('완료 상태 업데이트 실패:', error)
        }
      }
      updateCompletionStatus()
    }
  }, [isCompleted, mode, crewId])

  // 추천 버튼 클릭 핸들러
  const handleRecommend = async () => {
    if (!crewId) return
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    try {
      const result = await databaseService.toggleCrewRecommendation(crewId, user.id)
      if (result.success) {
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
        alert('이미 추천한 크루입니다.')
      } else {
        const errorMessage = error?.message || error?.details || String(error)
        alert(`추천 처리 중 오류가 발생했습니다: ${errorMessage}\n\n에러 코드: ${error?.code || 'N/A'}`)
      }
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-900 text-white relative overflow-hidden pb-safe">
      <div className="relative md:flex md:flex-col">
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto md:flex-1"
          style={{ display: cameraState.stream ? 'block' : 'none' }}
          onLoadedMetadata={() => {
            if (cameraVideoRef.current) {
              const width = cameraVideoRef.current.videoWidth
              const height = cameraVideoRef.current.videoHeight
              // 비디오 메타데이터가 유효한 경우에만 로그 출력
              if (width > 10 && height > 10) {
                console.log('비디오 메타데이터 로드됨', {
                  videoWidth: width,
                  videoHeight: height,
                })
              } else {
                console.warn('비디오 메타데이터가 유효하지 않음:', { width, height })
              }
            }
          }}
          onError={(e) => {
            console.error('비디오 오류:', e)
          }}
        />
        {cameraState.stream && cameraVideoRef.current && (
          <>
            {/* 쉬는 시간 중에는 관절 라인을 그리지 않음 (빈 배열 전달) */}
            <PoseCanvas
              poses={isResting ? [] : poses} // 쉬는 시간 중에는 빈 배열로 잔상 제거
              videoWidth={cameraVideoRef.current.videoWidth || 1280}
              videoHeight={cameraVideoRef.current.videoHeight || 720}
              canvasWidth={cameraVideoRef.current.clientWidth || cameraVideoRef.current.videoWidth || 1280}
              canvasHeight={cameraVideoRef.current.clientHeight || cameraVideoRef.current.videoHeight || 720}
            />
            <canvas
              ref={silhouetteCanvasRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: cameraVideoRef.current.videoWidth || 1280,
                height: cameraVideoRef.current.videoHeight || 720,
              }}
            />
          </>
        )}

        {!cameraState.isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="text-white mb-4">카메라를 초기화하는 중...</div>
              {cameraState.error && (
                <div className="text-red-400 mb-4">{cameraState.error}</div>
              )}
            </div>
          </div>
        )}
        {/* 시작 카운트다운 화면 */}
        {cameraState.isActive && !isStarted && startCountdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-center">
              <motion.div
                key={startCountdown}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-9xl font-bold text-primary-400 mb-4"
              >
                {startCountdown > 0 ? startCountdown : '시작'}
              </motion.div>
              <div className="text-2xl text-gray-300">준비하세요!</div>
            </div>
          </div>
        )}

        {/* 쉬는 시간 화면 */}
        {isResting && nextSetNumber !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-8"
              >
                <div className="text-6xl font-bold text-white mb-4">
                  {nextSetNumber}세트
                </div>
                <div className="text-2xl text-gray-300">쉬는 시간</div>
              </motion.div>
              <motion.div
                key={restCountdown}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-9xl font-bold text-primary-400 mb-4"
              >
                {restCountdown > 0 ? restCountdown : '시작'}
              </motion.div>
              {restCountdown <= 10 && restCountdown > 0 && (
                <div className="text-xl text-gray-400">준비하세요!</div>
              )}
            </div>
          </div>
        )}

        {isStarted && !isResting && (
          <>
            <CountDisplay 
              count={currentCount} 
              poseScore={poseScore}
              lastCountScore={lastCountScore}
              currentSet={currentSet}
              setAverageScores={setAverageScores}
            />
            <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-4">
              <div>세트: {currentSet} / {config.sets}</div>
              <div>목표: {config.reps}개</div>
              <div className="text-sm text-gray-400 mt-1">현재: {currentCount}개</div>
              <div className="text-sm text-primary-400 mt-1 font-bold">총: {totalCount}개</div>
            </div>
            {/* 실시간 피드백 표시 */}
            {currentFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute left-1/2 transform -translate-x-1/2 bg-black/80 rounded-lg px-6 py-3 z-20"
                style={{ 
                  bottom: mode === 'crew' 
                    ? `calc(${meetingViewHeight + 80}px + env(safe-area-inset-bottom, 0px))`
                    : 'calc(8rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <div className="text-white text-lg font-semibold text-center">
                  {currentFeedback}
                </div>
              </motion.div>
            )}
          </>
        )}

        <EffectOverlay effects={effects} />
        <DebugInfo 
          poses={poses} 
          isEnabled={isStarted && (config.type === EXERCISE_TYPES.SQUAT || config.type === EXERCISE_TYPES.PUSHUP)}
          isCrewMode={mode === 'crew'}
          meetingViewHeight={mode === 'crew' ? meetingViewHeight : 0}
        />
        
        {/* 알람 알림 모달 */}
        {alarmNotification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]"
            onClick={() => {
              if (alarmNotification.type !== 'start') {
                setAlarmNotification(null)
              }
            }}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="bg-gray-800 rounded-xl p-8 max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className={`text-4xl mb-4 ${
                  alarmNotification.type === 'start' ? 'text-primary-400' :
                  alarmNotification.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                }`}>
                  {alarmNotification.type === 'start' ? '⏰' :
                   alarmNotification.type === 'warning' ? '⚠️' : 'ℹ️'}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {alarmNotification.message}
                </h3>
                {alarmNotification.type === 'start' && (
                  <div className="flex gap-4 justify-center mt-6">
                    <button
                      onClick={() => {
                        setShowStartDialog(false)
                        setAlarmNotification(null)
                      }}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => {
                        setShowStartDialog(false)
                        setAlarmNotification(null)
                        // 운동 시작 (이미 구현된 로직 사용)
                        if (!isStarted) {
                          setIsStarted(true)
                        }
                      }}
                      className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
                    >
                      운동 시작
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* 모바일 환경에서 영상 아래 운동 정보 섹션 */}
      <div className="md:hidden bg-gray-800/95 border-t border-gray-700 p-4 space-y-3">
        {/* 운동 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">운동 종목</div>
            <div className="text-lg font-semibold">{getExerciseName(config.type)}</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">세트</div>
            <div className="text-lg font-semibold">{currentSet} / {config.sets}</div>
          </div>
        </div>

        {/* 카운트 정보 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">현재</div>
            <div className="text-2xl font-bold text-primary-400">{currentCount}</div>
            <div className="text-xs text-gray-500">/ {config.reps}</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">총 카운트</div>
            <div className="text-2xl font-bold text-green-400">{totalCount}</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">자세 점수</div>
            <div className={`text-2xl font-bold ${
              poseScore >= 90 ? 'text-red-400' :
              poseScore >= 80 ? 'text-orange-400' :
              poseScore >= 70 ? 'text-yellow-400' :
              poseScore >= 60 ? 'text-green-400' :
              poseScore >= 50 ? 'text-blue-400' :
              'text-purple-400'
            }`}>
              {Math.round(poseScore)}
            </div>
          </div>
        </div>

        {/* 상태 정보 */}
        {currentFeedback && (
          <div className="bg-primary-500/20 border border-primary-500/50 rounded-lg p-3">
            <div className="text-xs text-primary-300 mb-1">실시간 피드백</div>
            <div className="text-sm font-medium text-primary-200">{currentFeedback}</div>
          </div>
        )}

        {/* 세트 평균 점수 */}
        {setAverageScores.has(currentSet) && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">세트 {currentSet} 평균 점수</div>
            <div className="text-lg font-semibold text-yellow-400">
              {setAverageScores.get(currentSet)}점
            </div>
          </div>
        )}

        {/* 운동 상태 */}
        <div className="flex gap-2">
          {isResting ? (
            <div className="flex-1 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-center">
              <div className="text-xs text-yellow-300 mb-1">쉬는 시간</div>
              <div className="text-lg font-bold text-yellow-200">{restCountdown}초</div>
            </div>
          ) : isStarted ? (
            <div className="flex-1 bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-center">
              <div className="text-xs text-green-300 mb-1">운동 중</div>
              <div className="text-lg font-bold text-green-200">진행 중</div>
            </div>
          ) : (
            <div className="flex-1 bg-gray-500/20 border border-gray-500/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-300 mb-1">대기 중</div>
              <div className="text-lg font-bold text-gray-200">준비</div>
            </div>
          )}
        </div>

      </div>

      {/* 볼륨 컨트롤 - 나가기 버튼 위에 배치 */}
      {(isStarted || isResting) && (
        <div 
          className={`${mode === 'crew' ? 'fixed' : 'absolute'} left-2 right-2 md:left-4 md:right-4 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:p-4`}
          style={mode === 'crew' ? { 
            bottom: `calc(${meetingViewHeight + 80}px + env(safe-area-inset-bottom, 0px))` // 나가기 버튼 위에 배치
          } : {
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' // 나가기 버튼 위에 배치
          }}
        >
          <div className="bg-gray-700/50 rounded-lg p-2 md:p-3">
            <div className="flex items-center justify-center gap-1.5 md:gap-3 flex-wrap">
              <div className="flex-shrink-0">
                <VolumeControl 
                  onExercisePause={setIsExercisePaused}
                  isExercisePaused={isExercisePaused}
                />
              </div>
              {/* 크루 모드: 추천 버튼 (볼륨 컨트롤 오른쪽) */}
              {mode === 'crew' && crewId && (
                <button
                  onClick={handleRecommend}
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg transition flex-shrink-0 ${
                    hasRecommended
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-yellow-500 hover:bg-yellow-600'
                  }`}
                  title={hasRecommended ? '추천 취소' : '추천하기'}
                >
                  <span className="text-base md:text-lg relative">
                    ⭐
                    {recommendations > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center font-bold text-[9px] md:text-[10px]">
                        {recommendations > 9 ? '9+' : recommendations}
                      </span>
                    )}
                  </span>
                </button>
              )}
              {/* 크루 모드: 채팅 버튼 (볼륨 컨트롤 오른쪽) */}
              {mode === 'crew' && crewId && (
                <motion.button
                  onClick={() => {
                    console.log('💬 TrainingPage: 채팅 버튼 클릭', { hasNewMessage, hasEntryNotification })
                    setChatOpen(true)
                    setHasNewMessage(false) // 채팅창 열면 알림 해제
                    setHasEntryNotification(false) // 입장 알림도 해제
                    console.log('💬 TrainingPage: 알림 상태를 false로 설정')
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg transition flex-shrink-0"
                  style={{ 
                    backgroundColor: (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? '#fbbf24' : '#a855f7' // 새 메시지, 입장 알림, 또는 미확인 메시지 있으면 노란색
                  }}
                  title={`채팅 열기${unreadMessageCount > 0 ? ` (${unreadMessageCount}개 미확인)` : ''}`}
                  animate={(hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? {
                    x: [0, -3, 3, -3, 3, 0],
                    scale: [1, 1.03, 1, 1.03, 1],
                  } : {}}
                  transition={{
                    duration: 0.5,
                    repeat: (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) ? Infinity : 0,
                    repeatDelay: 1,
                  }}
                  onAnimationStart={() => {
                    if (hasNewMessage || hasEntryNotification || unreadMessageCount > 0) {
                      console.log('💬 TrainingPage: 채팅 아이콘 애니메이션 시작 (흔들림)')
                    }
                  }}
                >
                  <motion.span 
                    className="text-base md:text-lg relative"
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
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center font-bold text-[9px] md:text-[10px]">
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </span>
                    )}
                  </motion.span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      )}

      <div 
        className={`${mode === 'crew' ? 'fixed' : 'absolute'} left-2 right-2 md:left-4 md:right-4 flex gap-2 md:gap-4 items-center z-[100] md:relative md:bottom-auto md:left-auto md:right-auto md:p-4 mobile-bottom-safe flex-wrap`}
        style={mode === 'crew' ? { 
          bottom: `calc(${meetingViewHeight + 16}px + env(safe-area-inset-bottom, 0px))`, // 바텀시트 높이 + 여백 + safe area
          pointerEvents: 'auto', // 모바일에서 터치 이벤트 보장
        } : {
          bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          pointerEvents: 'auto', // 모바일에서 터치 이벤트 보장
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <NavigationButtons 
            exitMode={true}
            exitTitle="나가기"
            onBack={() => {
              // 삼성 갤럭시에서 window.confirm이 제대로 작동하지 않을 수 있으므로 커스텀 모달 사용
              setShowExitConfirm(true)
            }}
          />
          {/* 운동 중 강제 종료 버튼 (항상 표시) */}
          {isStarted && (
            <button
              onClick={() => {
                if (window.confirm('운동을 종료하시겠습니까?')) {
                  handleFinish()
                }
              }}
              className="px-3 py-2 md:px-6 md:py-3 bg-red-500 rounded-lg hover:bg-red-600 font-bold text-sm md:text-base whitespace-nowrap"
            >
              강제 종료
            </button>
          )}
        </div>
        {/* 데스크톱 환경 볼륨 컨트롤 */}
        <div className="hidden md:flex items-center gap-2">
          <VolumeControl 
            onExercisePause={setIsExercisePaused}
            isExercisePaused={isExercisePaused}
          />
        </div>
        {/* 버전 표시 */}
        <div className="ml-auto text-xs md:text-sm text-gray-400 flex-shrink-0">
          v{getVersion()}
        </div>
      </div>

      {/* 크루 모드: 미팅 화면 (하단) */}
      {mode === 'crew' && crewId && (
        <div className="fixed left-0 right-0 z-30" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <CrewMeetingView
            crewId={crewId}
            myVideoEnabled={myVideoEnabled}
            myAudioEnabled={myAudioEnabled}
            onVideoToggle={setMyVideoEnabled}
            onAudioToggle={setMyAudioEnabled}
            myStatus={isCompleted ? 'completed' : isResting ? 'resting' : 'active'}
            myScore={session ? session.averageScore : undefined}
            myCurrentCount={totalCount}
            onHeightChange={setMeetingViewHeight}
            onEntryMessage={setEntryMessage}
            sharedVideoStream={cameraState.stream} // 카메라 스트림 공유 (성능 최적화)
            videoShareEnabled={crewVideoShareEnabled}
            audioShareEnabled={crewAudioShareEnabled}
          />
        </div>
      )}

      {/* 크루 모드: 채팅 패널 */}
      {mode === 'crew' && crewId && (
          <CrewChatPanel 
            crewId={crewId} 
            isOpen={chatOpen} 
          onClose={() => {
            console.log('💬 TrainingPage: 채팅창 닫기')
            setChatOpen(false)
          }}
            entryMessage={entryMessage}
          onNewMessage={() => {
            console.log('💬 TrainingPage: onNewMessage 콜백 호출됨!', { chatOpen })
            if (!chatOpen) {
              console.log('💬 TrainingPage: hasNewMessage를 true로 설정')
              setHasNewMessage(true)
            } else {
              console.log('💬 TrainingPage: 채팅창이 열려있어서 알림 설정 안함')
            }
          }}
          onUnreadCountChange={(count) => {
            console.log('💬 TrainingPage: 미확인 메시지 수 변경:', count)
            setUnreadMessageCount(count)
          }}
        />
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
      
      {/* 나가기 확인 모달 */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4"
          >
            <h3 className="text-xl font-bold text-white mb-4">나가기 확인</h3>
            <p className="text-gray-300 mb-6">운동을 종료하고 나가시겠습니까?</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // 중복 클릭 방지
                  if (isExiting) {
                    return
                  }
                  
                  setIsExiting(true)
                  
                  // 모달을 먼저 닫아서 UI 반응성 향상
                  setShowExitConfirm(false)
                  
                  // 비동기로 오디오 정지 및 네비게이션 처리 (UI 블로킹 방지)
                  setTimeout(() => {
                    try {
                      // 나가기 시 모든 오디오 즉시 정지
                      audioService.stopAll()
                      
                      // 추가 안전장치: 강제로 모든 Howl 인스턴스 정지
                      if (typeof window !== 'undefined' && (window as any).Howl) {
                        try {
                          const howlInstances = (window as any).Howl._howls || []
                          howlInstances.forEach((howl: any) => {
                            if (howl && typeof howl.stop === 'function') {
                              howl.stop()
                              if (typeof howl.unload === 'function') {
                                howl.unload()
                              }
                            }
                          })
                        } catch (e) {
                          console.warn('Howl 인스턴스 정지 중 오류:', e)
                        }
                      }
                    } catch (e) {
                      console.warn('오디오 정지 중 오류:', e)
                    }
                    
                    // 모드에 따라 이전 화면으로 이동
                    if (mode === 'single') {
                      navigate('/single')
                    } else if (mode === 'crew') {
                      navigate('/crew/my-crews')
                    } else {
                      navigate('/mode-select')
                    }
                    
                    // 상태 리셋 (다음에 다시 사용할 수 있도록)
                    setTimeout(() => {
                      setIsExiting(false)
                    }, 1000)
                  }, 50) // 짧은 지연으로 UI 반응성 향상
                }}
                disabled={isExiting}
                className={`flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition-all ${
                  isExiting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  pointerEvents: isExiting ? 'none' : 'auto',
                  touchAction: 'manipulation', // 모바일 터치 최적화
                }}
              >
                {isExiting ? '처리 중...' : '나가기'}
              </button>
              <button
                onClick={() => {
                  if (!isExiting) {
                    setShowExitConfirm(false)
                  }
                }}
                disabled={isExiting}
                className={`flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-semibold transition-all ${
                  isExiting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  pointerEvents: isExiting ? 'none' : 'auto',
                  touchAction: 'manipulation', // 모바일 터치 최적화
                }}
              >
                취소
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default TrainingPage
