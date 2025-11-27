import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { joggingService } from '@/services/joggingService'
import { JoggingData, JoggingConfig, WeatherInfo } from '@/types'
import { databaseService, SharedJoggingCourse, RealtimeJoggingRoute } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'
import { getWeatherInfo } from '@/services/weatherService'

import CrewChatPanel from '@/components/CrewChatPanel'
import CrewMeetingView from '@/components/CrewMeetingView'
import NavigationButtons from '@/components/NavigationButtons'

const JoggingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { config, weather, crewId, sharedCourse, crewName, goalName } = (location.state as {
    config?: JoggingConfig
    weather?: WeatherInfo[]
    crewId?: string
    sharedCourse?: SharedJoggingCourse
    crewName?: string // 조깅크루 방 제목
    goalName?: string // 조깅 목표 이름 (혼자 모드 방 제목)
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
  const [crewVideoShareEnabled, setCrewVideoShareEnabled] = useState(true) // 크루 영상 공유 설정
  const [crewAudioShareEnabled, setCrewAudioShareEnabled] = useState(true) // 크루 음성 공유 설정
  const [isPaused, setIsPaused] = useState(false) // 운동 일시정지 상태
  const [routeExpanded, setRouteExpanded] = useState(false) // 경로 정보 펼침 상태
  const [routePage, setRoutePage] = useState(1) // 경로 정보 페이지 (10개 단위)
  const [hasRecommended, setHasRecommended] = useState(false) // 추천 상태
  const [recommendations, setRecommendations] = useState(0) // 추천수
  const [hasCancelled, setHasCancelled] = useState(false) // 추천 취소 상태
  const [recommendToast, setRecommendToast] = useState<{ message: string; type: 'success' | 'cancel' } | null>(null) // 추천 토스트 메시지
  const [currentWeather, setCurrentWeather] = useState<WeatherInfo[]>(weather || []) // 현재 날씨 정보
  const [weatherLocation, setWeatherLocation] = useState<string>('') // 날씨 위치 정보
  const [weatherLoading, setWeatherLoading] = useState(false) // 날씨 로딩 상태
  const [airQualityExpanded, setAirQualityExpanded] = useState(false) // 대기질 정보 펼침/접힘 상태
  const weatherLoadedRef = useRef(false) // 날씨 정보가 이미 로드되었는지 추적
  const [isRealtimeSharing, setIsRealtimeSharing] = useState(false) // 실시간 경로 공유 상태
  const [crewRoutes, setCrewRoutes] = useState<RealtimeJoggingRoute[]>([]) // 크루 참여자들의 실시간 경로
  const [routesExpanded, setRoutesExpanded] = useState(false) // 참여자 경로 목록 펼침 상태
  const routeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null) // 경로 업데이트 인터벌
  const crewRoutesUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null) // 크루 경로 목록 업데이트 인터벌
  const [isCompleted, setIsCompleted] = useState(false) // 정상 종료 여부 (조깅종료 버튼 클릭 시 true)
  
  // 실시간 참여자 경로 맵 모달 관련 상태
  const [showRouteModal, setShowRouteModal] = useState(false) // 경로 맵 모달 표시 여부
  const [selectedRoute, setSelectedRoute] = useState<RealtimeJoggingRoute | null>(null) // 선택된 경로
  const routeMapRef = useRef<HTMLDivElement>(null) // 맵 컨테이너 ref
  const routeMapInstanceRef = useRef<google.maps.Map | null>(null) // 맵 인스턴스 ref
  const routePolylineRef = useRef<google.maps.Polyline | null>(null) // polyline ref
  const routeMarkersRef = useRef<google.maps.Marker[]>([]) // 마커 refs
  
  // 조깅 경로 공유 설정 (시작 전 설정)
  const [shareCourseName, setShareCourseName] = useState('') // 공유 코스 이름
  const [shareToPublic, setShareToPublic] = useState(false) // 공유 저장 토글 (조깅경로공유목록에 저장)
  const [enableRealtimeSharing, setEnableRealtimeSharing] = useState(false) // 실시간 경로 공유 토글 (조깅(함께)에서만)

  // hasNewMessage 상태 변경 추적
  useEffect(() => {
    console.log('💬 JoggingPage: hasNewMessage 상태 변경:', hasNewMessage)
  }, [hasNewMessage])

  // 날씨 정보 로드 함수 (혼자 모드와 함께 모드 모두 사용)
  const loadWeather = async (showLoading: boolean = false) => {
    if (config?.mode !== 'alone' && config?.mode !== 'together') return
    
    if (showLoading) {
      setWeatherLoading(true)
    }
    try {
      const { weather: weatherData, location } = await getWeatherInfo()
      setCurrentWeather(weatherData)
      setWeatherLocation(location)
    } catch (error) {
      console.error('날씨 정보 로드 실패:', error)
      // 기본값 설정
      setWeatherLocation('서울')
    } finally {
      if (showLoading) {
        setWeatherLoading(false)
      }
    }
  }

  // 입장 시 한 번만 날씨 정보 로드 (혼자 모드와 함께 모드 모두)
  useEffect(() => {
    if ((config?.mode === 'alone' || config?.mode === 'together') && !weatherLoadedRef.current) {
      if (weather && weather.length > 0) {
        // 전달받은 날씨 정보가 있으면 사용
        setCurrentWeather(weather)
        weatherLoadedRef.current = true
      } else {
        // 날씨 정보가 없으면 로드
        loadWeather()
        weatherLoadedRef.current = true
      }
    } else if (weather && weather.length > 0) {
      setCurrentWeather(weather)
    }
  }, [config?.mode])

  // Google Maps JavaScript API 로드
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    // 이미 로드되어 있는지 확인
    if (window.google && window.google.maps) {
      return
    }

    // 이미 스크립트가 있는지 확인
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async`
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거하지 않음 (다른 컴포넌트에서도 사용 가능)
    }
  }, [])

  // 실시간 참여자 경로 맵 초기화 및 polyline 그리기
  useEffect(() => {
    if (!showRouteModal || !selectedRoute || !routeMapRef.current) return
    if (!window.google || !window.google.maps) return

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    const route = selectedRoute.route
    if (!route || route.length === 0) return

    // 기존 맵 인스턴스 정리
    if (routeMapInstanceRef.current) {
      routeMapInstanceRef.current = null
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }
    // 기존 마커 제거
    routeMarkersRef.current.forEach(marker => marker.setMap(null))
    routeMarkersRef.current = []

    // 맵 초기화
    const map = new google.maps.Map(routeMapRef.current, {
      zoom: 15,
      center: { lat: route[0].lat, lng: route[0].lng },
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    })
    routeMapInstanceRef.current = map

    // 경로 포인트를 LatLng 배열로 변환
    const path = route.map(point => new google.maps.LatLng(point.lat, point.lng))

    // Polyline 그리기
    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 4,
    })
    polyline.setMap(map)
    routePolylineRef.current = polyline

    // 시작 마커 (녹색)
    const startMarker = new google.maps.Marker({
      position: { lat: route[0].lat, lng: route[0].lng },
      map: map,
      label: {
        text: '시작',
        color: '#FFFFFF',
        fontWeight: 'bold',
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#00FF00',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      },
    })
    routeMarkersRef.current.push(startMarker)

    // 종료 마커 (빨간색) - 현재 위치 또는 마지막 위치
    if (route.length > 1) {
      const endMarker = new google.maps.Marker({
        position: { lat: route[route.length - 1].lat, lng: route[route.length - 1].lng },
        map: map,
        label: {
          text: selectedRoute.isActive ? '현재' : '종료',
          color: '#FFFFFF',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: selectedRoute.isActive ? '#0000FF' : '#FF0000',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      })
      routeMarkersRef.current.push(endMarker)
    }

    // 경로가 전체적으로 보이도록 bounds 설정
    const bounds = new google.maps.LatLngBounds()
    path.forEach(point => bounds.extend(point))
    map.fitBounds(bounds)

    // 패딩 추가
    const padding = 50
    map.fitBounds(bounds, padding)

    // 정리 함수
    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null)
        routePolylineRef.current = null
      }
      routeMarkersRef.current.forEach(marker => marker.setMap(null))
      routeMarkersRef.current = []
      routeMapInstanceRef.current = null
    }
  }, [showRouteModal, selectedRoute])

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
      let animationFrameId: number | null = null
      let lastUpdateTime = Date.now()
      const UPDATE_INTERVAL = 1000 // 1초마다 업데이트

      const updateData = () => {
        const now = Date.now()
        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
          const data = joggingService.getCurrentData()
          const paused = joggingService.getIsPaused()
          if (data) {
            setJoggingData(data)
          }
          setIsPaused(paused)
          lastUpdateTime = now
        }
        animationFrameId = requestAnimationFrame(updateData)
      }

      animationFrameId = requestAnimationFrame(updateData)

      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
      }
    }
  }, [isTracking])

  // 실시간 경로 공유 업데이트 (조깅크루 모드, 30초마다)
  useEffect(() => {
    if (isTracking && isRealtimeSharing && config?.mode === 'together' && crewId && joggingData) {
      const updateRealtimeRoute = async () => {
        try {
          const user = authService.getCurrentUser()
          if (!user) return

          // 사용자 이름 가져오기
          const userProfile = await databaseService.getUserById(user.id)
          const userName = userProfile?.name || 'Unknown'

          await databaseService.upsertRealtimeJoggingRoute({
            userId: user.id,
            crewId: crewId,
            userName: userName,
            route: joggingData.route,
            totalDistance: joggingData.distance,
            startTime: joggingData.startTime,
            lastUpdateTime: Date.now(),
            isActive: true,
          })
          console.log('✅ 실시간 경로 공유 업데이트 완료:', { crewId, distance: joggingData.distance, routePoints: joggingData.route.length })
        } catch (error) {
          console.error('실시간 경로 공유 업데이트 실패:', error)
        }
      }

      // 즉시 업데이트
      updateRealtimeRoute()

      // 30초마다 업데이트
      routeUpdateIntervalRef.current = setInterval(updateRealtimeRoute, 30000)

      return () => {
        if (routeUpdateIntervalRef.current) {
          clearInterval(routeUpdateIntervalRef.current)
        }
      }
    }
  }, [isTracking, isRealtimeSharing, config?.mode, crewId, joggingData])

  // 크루 참여자들의 실시간 경로 목록 로드 함수 (useCallback으로 정의하여 외부에서 호출 가능)
  const loadCrewRoutes = useCallback(async () => {
    if (!(config?.mode === 'together' && crewId && isTracking)) {
      return
    }
    
    try {
      const user = authService.getCurrentUser()
      if (!user) return

      console.log('🔍 실시간 경로 목록 로드 시작:', { crewId, isTracking, currentUserId: user.id })
      const routes = await databaseService.getRealtimeJoggingRoutesByCrew(crewId)
      
      // getRealtimeJoggingRoutesByCrew는 이미 isActive=true인 경로만 반환하므로
      // 추가 필터링 없이 자신의 경로만 제외하면 됨
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      
      // 최근 5분 이내에 업데이트된 경로만 표시 (이전 운동 내역 제외)
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000 // 5분 전
      const recentRoutes = routes.filter(route => {
        // lastUpdateTime이 5분 이내인 경로만 포함
        return route.lastUpdateTime >= fiveMinutesAgo
      })
      
      console.log('🔍 최근 경로 필터링:', {
        totalRoutes: routes.length,
        recentRoutes: recentRoutes.length,
        filteredOut: routes.length - recentRoutes.length,
        routes: recentRoutes.map(r => ({
          userId: r.userId,
          userName: r.userName,
          lastUpdateTime: new Date(r.lastUpdateTime).toISOString(),
          minutesAgo: Math.round((now - r.lastUpdateTime) / 60000)
        }))
      })
      
      // 자신의 경로 제외 (userId 비교)
      const otherUserRoutes = recentRoutes.filter(route => {
        const routeIsUuid = uuidRegex.test(route.userId)
        const currentUserIsUuid = uuidRegex.test(user.id)
        
        if (routeIsUuid && currentUserIsUuid) {
          // 둘 다 UUID인 경우 직접 비교
          return route.userId !== user.id
        } else if (!routeIsUuid && !currentUserIsUuid) {
          // 둘 다 localStorage ID인 경우 직접 비교
          return route.userId !== user.id
        } else {
          // 하나는 UUID, 하나는 localStorage ID인 경우
          // UUID 매핑 시도
          if (routeIsUuid && !currentUserIsUuid) {
            // route.userId는 UUID, user.id는 localStorage ID
            // user.id를 UUID로 변환하여 비교
            try {
              const userStr = localStorage.getItem(`user_${user.id}`)
              if (userStr) {
                const userData = JSON.parse(userStr)
                if (userData.email) {
                  // 비동기 변환은 복잡하므로, 일단 다른 것으로 간주
                  // (실제로는 같은 사용자일 가능성이 낮음)
                  return true
                }
              }
            } catch (e) {
              // 무시
            }
          } else if (!routeIsUuid && currentUserIsUuid) {
            // route.userId는 localStorage ID, user.id는 UUID
            // route.userId를 UUID로 변환하여 비교
            // 비동기 변환이 필요하므로 일단 다른 것으로 간주
            return true
          }
          return true
        }
      })
      
      console.log('✅ 실시간 경로 목록 로드 완료:', { 
        totalRoutesCount: routes.length,
        otherUserRoutesCount: otherUserRoutes.length,
        filteredOut: routes.length - otherUserRoutes.length,
        routes: otherUserRoutes.map(r => ({ 
          userId: r.userId, 
          userName: r.userName, 
          isActive: r.isActive, 
          routePoints: r.route.length,
          totalDistance: r.totalDistance 
        })) 
      })
      setCrewRoutes(otherUserRoutes)
    } catch (error) {
      console.error('❌ 크루 경로 목록 로드 실패:', error)
    }
  }, [config?.mode, crewId, isTracking])

  // 크루 참여자들의 실시간 경로 목록 로드 (1분마다 + 참여자 변경 시) - 자신의 경로 제외
  useEffect(() => {
    if (config?.mode === 'together' && crewId && isTracking) {
      // 즉시 로드
      loadCrewRoutes()

      // 1분마다 자동 갱신
      crewRoutesUpdateIntervalRef.current = setInterval(loadCrewRoutes, 60000)

      return () => {
        if (crewRoutesUpdateIntervalRef.current) {
          clearInterval(crewRoutesUpdateIntervalRef.current)
        }
      }
    } else {
      // 조깅이 시작되지 않았거나 함께 모드가 아니면 경로 목록 초기화
      setCrewRoutes([])
    }
  }, [config?.mode, crewId, isTracking, loadCrewRoutes])

  // 조깅 종료 시 실시간 경로 목록 초기화
  useEffect(() => {
    if (!isTracking && crewRoutes.length > 0) {
      setCrewRoutes([])
      console.log('✅ 조깅 종료: 실시간 경로 목록 초기화')
    }
  }, [isTracking, crewRoutes.length])

  // 조깅 크루 입장 시 이전 실시간 경로 비활성화 (한 번만 실행)
  useEffect(() => {
    if (config?.mode === 'together' && crewId && !isTracking) {
      const cleanupOldRoutes = async () => {
        try {
          console.log('🧹 조깅크루 입장: 이전 실시간 경로 비활성화 시작')
          await databaseService.deactivateAllRealtimeJoggingRoutesByCrew(crewId)
          console.log('✅ 조깅크루 입장: 이전 실시간 경로 비활성화 완료')
          // 경로 목록 초기화
          setCrewRoutes([])
        } catch (error) {
          console.error('❌ 조깅크루 입장: 이전 실시간 경로 비활성화 실패:', error)
        }
      }
      
      // 입장 시 한 번만 실행
      cleanupOldRoutes()
    }
  }, [config?.mode, crewId]) // isTracking을 dependency에서 제외하여 입장 시 한 번만 실행

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

  // 나가기 처리 함수 (실제 나가기 실행) - useEffect보다 먼저 정의 필요
  const executeLeave = useCallback(() => {
    // handleStop()을 호출하지 않음 (정상 종료가 아니므로)
    // 실시간 경로 공유가 활성화되어 있으면 비활성화
    if (isRealtimeSharing && crewId) {
      const user = authService.getCurrentUser()
      if (user) {
        databaseService.deactivateRealtimeJoggingRoute(user.id, crewId).catch((error) => {
          console.error('실시간 경로 공유 비활성화 실패:', error)
        })
      }
    }
    
    // 조깅 추적 중지
    joggingService.stopTracking()
    
    // 모드에 따라 목록으로 이동 (분석 없이)
    if (config?.mode === 'alone') {
      navigate('/jogging-alone')
    } else if (config?.mode === 'together') {
      navigate('/jogging-crew/my-crews')
    } else {
      navigate('/jogging-mode-select')
    }
  }, [isRealtimeSharing, crewId, config?.mode, navigate])

  // 모바일 환경에서 뒤로가기, 홈버튼, 나가기 감지 및 경고 메시지 표시
  useEffect(() => {
    if (!isTracking) {
      // 조깅 중이 아닐 때는 히스토리 상태만 초기화
      return
    }

    // 히스토리에 현재 위치 추가 (뒤로가기 감지를 위해)
    // 조깅 시작 시 한 번만 추가
    window.history.pushState({ preventBack: true }, '', window.location.href)

    // 뒤로가기 버튼 감지 (popstate 이벤트) - 모바일 포함
    const handlePopState = (event: PopStateEvent) => {
      // 조깅 중일 때만 경고 표시
      if (isTracking) {
        // 현재 상태를 다시 추가하여 뒤로가기 방지
        window.history.pushState({ preventBack: true }, '', window.location.href)
        
        // 경고 메시지 표시
        if (window.confirm('지금 방을 나가시면 운동이 정상적으로 종료되지 않으며, 분석정보도 제공되지 않습니다.')) {
          // 사용자가 확인하면 실제로 나가기 실행
          executeLeave()
        }
        // 사용자가 취소하면 이미 pushState로 현재 위치에 머물러 있음
      }
    }

    // 페이지를 떠날 때 경고 (beforeunload 이벤트)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isTracking) {
        // 표준 메시지는 브라우저가 무시하므로, 커스텀 메시지는 표시되지 않음
        // 하지만 이벤트를 preventDefault하면 브라우저 기본 경고가 표시됨
        event.preventDefault()
        event.returnValue = '지금 방을 나가시면 운동이 정상적으로 종료되지 않으며, 분석정보도 제공되지 않습니다.'
        return event.returnValue
      }
    }

    // 앱이 백그라운드로 이동할 때 (visibilitychange 이벤트)
    const handleVisibilityChange = () => {
      if (isTracking && document.hidden) {
        // 앱이 백그라운드로 이동했을 때는 경고를 표시할 수 없지만,
        // 사용자에게 알림을 표시할 수 있음 (선택사항)
        console.warn('⚠️ 조깅 중 앱이 백그라운드로 이동했습니다.')
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 정리 함수
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isTracking, executeLeave])

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
            // 크루 설정에서 영상/음성 공유 설정 가져오기
            setCrewVideoShareEnabled(crew.videoShareEnabled ?? true)
            setCrewAudioShareEnabled(crew.audioShareEnabled ?? true)
            console.log('✅ 조깅 크루 설정 로드:', {
              videoShareEnabled: crew.videoShareEnabled,
              audioShareEnabled: crew.audioShareEnabled,
            })
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
      
      // 실시간 경로 공유가 활성화되어 있으면 즉시 시작
      if (enableRealtimeSharing && config?.mode === 'together' && crewId) {
        setIsRealtimeSharing(true)
        console.log('✅ 실시간 경로 공유 시작:', { enableRealtimeSharing, crewId })
        
        // 조깅 시작 시 즉시 실시간 경로 초기 기록 생성 (참여자 목록에 즉시 반영되도록)
        const user = authService.getCurrentUser()
        if (user && data.route.length > 0) {
          try {
            const userProfile = await databaseService.getUserById(user.id)
            const userName = userProfile?.name || user.name || user.email || 'Unknown'
            
            await databaseService.upsertRealtimeJoggingRoute({
              crewId: crewId,
              userId: user.id,
              userName: userName,
              route: data.route,
              totalDistance: data.distance,
              startTime: data.startTime,
              lastUpdateTime: Date.now(),
              isActive: true,
            })
            console.log('✅ 조깅 시작: 실시간 경로 초기 기록 생성 완료')
          } catch (error) {
            console.error('❌ 조깅 시작: 실시간 경로 초기 기록 생성 실패:', error)
          }
        }
      }
      
      // 조깅 시작 후 다른 참여자 경로 목록 로드 (함께 모드인 경우)
      if (config?.mode === 'together' && crewId) {
        // 경로가 DB에 저장되는 시간을 고려하여 약간의 지연 후 로드
        setTimeout(() => {
          loadCrewRoutes()
        }, 1500) // 1.5초 후 로드
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '조깅 추적을 시작할 수 없습니다.')
    }
  }

  const handleStop = async () => {
    if (!joggingData) return

    // 정상 종료 확인
    if (!window.confirm('조깅을 종료하시겠습니까? 종료 후 결과를 확인할 수 있습니다.')) {
      return
    }

    const data = joggingService.stopTracking()
    if (data) {
      setJoggingData(data)
    }
    setIsTracking(false)
    setIsPaused(false)
    setIsCompleted(true) // 정상 종료 플래그 설정

    // 조깅 종료 시 크루의 모든 실시간 경로 비활성화 (함께 모드인 경우)
    if (config?.mode === 'together' && crewId) {
      try {
        // 크루의 모든 참여자의 실시간 경로를 비활성화
        await databaseService.deactivateAllRealtimeJoggingRoutesByCrew(crewId)
        setIsRealtimeSharing(false)
        // 실시간 경로 목록 초기화
        setCrewRoutes([])
        console.log('✅ 조깅 종료: 크루의 모든 실시간 경로 비활성화 완료')
      } catch (error) {
        console.error('크루의 모든 실시간 경로 비활성화 실패:', error)
      }
    }

    // 공유 저장이 활성화되어 있으면 조깅 코스 공유 목록에 저장
    if (shareToPublic && data.route.length > 0) {
      try {
        const user = authService.getCurrentUser()
        if (user) {
          await databaseService.createSharedJoggingCourse({
            userId: user.id,
            name: shareCourseName || undefined,
            route: data.route,
            totalDistance: data.distance,
          })
        }
      } catch (error) {
        console.error('조깅 코스 공유 저장 실패:', error)
      }
    }

    // 조깅 세션 저장
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }

      const session = await databaseService.createJoggingSession({
        userId: user.id,
        crewId: config?.mode === 'together' ? crewId : undefined,
        mode: config?.mode || 'alone',
        distance: data.distance,
        averageSpeed: data.averageSpeed,
        averageTime: data.averageTime,
        route: data.route,
        startTime: data.startTime,
        endTime: Date.now(),
        completed: true,
      })

      // ResultPage로 이동 (조깅 세션을 ExerciseSession 형식으로 변환)
      const exerciseSession = {
        id: session.id,
        userId: session.userId,
        mode: session.mode === 'alone' ? 'jogging' : 'jogging-crew',
        config: {
          type: 'jogging',
          sets: 1,
          reps: 1,
          restTime: 0,
        },
        startTime: session.startTime,
        endTime: session.endTime || Date.now(),
        counts: [], // 조깅은 counts가 없음
        averageScore: 0,
        completed: true,
        joggingData: {
          distance: session.distance,
          averageSpeed: session.averageSpeed,
          averageTime: session.averageTime,
          route: session.route,
        },
      }

      navigate('/result', {
        state: {
          session: exerciseSession,
          crewId: config?.mode === 'together' ? crewId : undefined,
          config: config,
        },
      })
    } catch (error) {
      console.error('조깅 세션 저장 실패:', error)
      alert('조깅 세션 저장에 실패했습니다.')
    }
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

  // 뒤로가기 버튼 핸들러 (조깅 중일 때 경고 표시)
  const handleBack = () => {
    if (isTracking) {
      // 조깅 중일 때는 경고 메시지 표시
      if (window.confirm('지금 방을 나가시면 운동이 정상적으로 종료되지 않으며, 분석정보도 제공되지 않습니다.')) {
        executeLeave()
      }
    } else {
      // 조깅 중이 아닐 때는 바로 뒤로가기
        if (config?.mode === 'alone') {
          navigate('/jogging-alone')
        } else if (config?.mode === 'together') {
          navigate('/jogging-crew/my-crews')
        } else {
          navigate('/jogging-mode-select')
        }
      }
  }

  // 홈 버튼 핸들러 (조깅 중일 때 경고 표시)
  const handleHome = () => {
    if (isTracking) {
      // 조깅 중일 때는 경고 메시지 표시
      if (window.confirm('지금 방을 나가시면 운동이 정상적으로 종료되지 않으며, 분석정보도 제공되지 않습니다.')) {
        // 홈 버튼이므로 홈으로 이동 (executeLeave 대신)
        // 실시간 경로 공유가 활성화되어 있으면 비활성화
        if (isRealtimeSharing && crewId) {
          const user = authService.getCurrentUser()
          if (user) {
            databaseService.deactivateRealtimeJoggingRoute(user.id, crewId).catch((error) => {
              console.error('실시간 경로 공유 비활성화 실패:', error)
            })
          }
        }
        
        // 조깅 추적 중지
        joggingService.stopTracking()
        
        // 홈으로 이동
        const user = authService.getCurrentUser()
        if (user && adminService.isAdmin(user)) {
          navigate('/admin/dashboard')
    } else {
          navigate('/mode-select')
        }
      }
    } else {
      // 조깅 중이 아닐 때는 바로 홈으로 이동
      const user = authService.getCurrentUser()
      if (user && adminService.isAdmin(user)) {
        navigate('/admin/dashboard')
      } else {
        navigate('/mode-select')
      }
    }
  }

  const handleLeave = () => {
    if (isTracking) {
      // 조깅 중일 때는 경고 메시지 표시
      if (window.confirm('지금 방을 나가시면 운동이 정상적으로 종료되지 않으며, 분석정보도 제공되지 않습니다.')) {
        executeLeave()
      }
    } else {
      // 조깅 중이 아닐 때는 바로 목록으로 이동
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

  // 수치 기반 등급 계산 (에어코리아 기준)
  const calculateGradeFromValue = (value: number | null, type: 'pm10' | 'pm25' | 'o3'): string | null => {
    if (value === null || value === undefined) return null
    
    if (type === 'pm25') {
      // 초미세먼지: 좋음(0~15), 보통(16~35), 나쁨(36~75), 매우나쁨(76~)
      if (value <= 15) return '좋음'
      if (value <= 35) return '보통'
      if (value <= 75) return '나쁨'
      return '매우나쁨'
    } else if (type === 'pm10') {
      // 미세먼지: 좋음(0~30), 보통(31~80), 나쁨(81~150), 매우나쁨(151~)
      if (value <= 30) return '좋음'
      if (value <= 80) return '보통'
      if (value <= 150) return '나쁨'
      return '매우나쁨'
    } else if (type === 'o3') {
      // 오존: 좋음(0~0.03), 보통(0.0301~0.09), 나쁨(0.0901~0.15), 매우나쁨(0.1501~)
      if (value <= 0.03) return '좋음'
      if (value <= 0.09) return '보통'
      if (value <= 0.15) return '나쁨'
      return '매우나쁨'
    }
    return null
  }

  // 등급별 아이콘 및 색상 반환
  const getGradeIcon = (grade: string | null | undefined): { icon: string; color: string; status: string } => {
    if (!grade) return { icon: '😐', color: 'text-gray-500', status: '없음' }
    switch (grade) {
      case '좋음':
        return { icon: '😊', color: 'text-blue-500', status: '좋음' }
      case '보통':
        return { icon: '😐', color: 'text-green-500', status: '보통' }
      case '나쁨':
        return { icon: '😟', color: 'text-yellow-500', status: '나쁨' }
      case '매우나쁨':
        return { icon: '😠', color: 'text-red-500', status: '매우나쁨' }
      default:
        return { icon: '😐', color: 'text-gray-500', status: '없음' }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-8">
      <div 
        className="max-w-4xl mx-auto"
        style={{
          paddingBottom: config?.mode === 'together' && crewId 
            ? `${meetingViewHeight + 20}px` 
            : '0px'
        }}
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">
            {config?.mode === 'together' && crewName 
              ? `${crewName} 🏃` 
              : config?.mode === 'alone' && goalName
              ? `${goalName} 🏃`
              : `조깅 모드 🏃 ${config?.mode === 'together' ? '(함께)' : ''}`}
        </h1>
          <NavigationButtons 
            showBack={true}
            showHome={true}
            onBack={handleBack}
            onHome={handleHome}
            backPath={config?.mode === 'alone' ? '/jogging-alone' : config?.mode === 'together' ? '/jogging-crew/my-crews' : '/jogging-mode-select'}
          />
        </div>
        
        {/* 날씨 정보 표시 - 애플워치 스타일 (혼자 모드와 함께 모드 모두) */}
        {currentWeather && currentWeather.length > 0 && (config?.mode === 'alone' || config?.mode === 'together') && (
                <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-black/30 backdrop-blur-md rounded-3xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                {weatherLocation && (
                  <div className="text-xs text-white/60 font-medium flex items-center gap-1">
                    <span>📍</span>
                    <span>{weatherLocation}</span>
                  </div>
                )}
                {/* 날씨 새로고침 버튼 - 원형 화살표 */}
                <button
                  onClick={() => loadWeather(true)}
                  disabled={weatherLoading}
                  className="ml-auto w-8 h-8 rounded-full bg-green-600/80 backdrop-blur-sm flex items-center justify-center hover:bg-green-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title="날씨 정보 새로고침"
                >
                  {weatherLoading ? (
                    <svg 
                      className="w-4 h-4 text-white animate-spin" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                  ) : (
                    <svg 
                      className="w-4 h-4 text-white" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                  )}
                </button>
              </div>
              <div className="space-y-3">
                {/* 날씨 정보 - 오늘, 내일, 모레 */}
                {currentWeather.length > 0 && (
                  <div className="flex gap-2">
                    {currentWeather.slice(0, 3).map((w, index) => (
                      <div key={index} className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg p-2.5">
                        <div className="text-xs font-medium text-white/70 mb-1">{w.date}</div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xl">{getWeatherIcon(w.condition)}</span>
                          <span className="text-lg font-bold text-white tabular-nums">{w.temperature}°</span>
                        </div>
                        <div className="text-xs text-white/60">습도 {w.humidity}%</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 대기질 정보 섹션 - 펼침/접힘 버튼 포함 */}
                {currentWeather[0] && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white/80">대기환경정보</span>
                      <button
                        onClick={() => setAirQualityExpanded(!airQualityExpanded)}
                        className="p-1 rounded hover:bg-white/20 transition-colors"
                        title={airQualityExpanded ? '접기' : '펼치기'}
                      >
                        <svg 
                          className={`w-4 h-4 text-white transition-transform ${airQualityExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 9l-7 7-7-7" 
                          />
                        </svg>
                      </button>
                    </div>
                    {airQualityExpanded && (
                      <div className="grid grid-cols-2 gap-2">
                        {/* 자외선 */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm">☀️</span>
                            <span className="text-xs font-medium text-white/90">자외선</span>
                          </div>
                          <div className="text-lg font-bold text-white tabular-nums">{currentWeather[0]?.uvIndex}</div>
                        </div>
                        
                        {/* 미세먼지 */}
                        {currentWeather[0]?.pm10 !== undefined && currentWeather[0]?.pm10 !== null && (
                          <div className={`bg-white/20 backdrop-blur-sm rounded-lg p-2.5 ${getGradeIcon(currentWeather[0].pm10Grade || (currentWeather[0].pm10 !== null ? calculateGradeFromValue(currentWeather[0].pm10, 'pm10') : null)).color || 'text-white'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-sm">{getGradeIcon(currentWeather[0].pm10Grade || (currentWeather[0].pm10 !== null ? calculateGradeFromValue(currentWeather[0].pm10, 'pm10') : null)).icon || '🌫️'}</span>
                              <span className="text-xs font-medium text-white/90">미세먼지</span>
                            </div>
                            <div className="text-lg font-bold text-white tabular-nums">{currentWeather[0].pm10}</div>
                            <div className="text-xs text-white/70 mt-0.5">㎍/㎥</div>
                            {(currentWeather[0].pm10Grade || (currentWeather[0].pm10 !== null ? calculateGradeFromValue(currentWeather[0].pm10, 'pm10') : null)) && (
                              <div className="text-xs mt-0.5 text-white/60">
                                ({getGradeIcon(currentWeather[0].pm10Grade || (currentWeather[0].pm10 !== null ? calculateGradeFromValue(currentWeather[0].pm10, 'pm10') : null)).status})
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 초미세먼지 */}
                        {currentWeather[0]?.pm25 !== undefined && currentWeather[0]?.pm25 !== null && (
                          <div className={`bg-white/20 backdrop-blur-sm rounded-lg p-2.5 ${getGradeIcon(currentWeather[0].pm25Grade || (currentWeather[0].pm25 !== null ? calculateGradeFromValue(currentWeather[0].pm25, 'pm25') : null)).color || 'text-white'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-sm">{getGradeIcon(currentWeather[0].pm25Grade || (currentWeather[0].pm25 !== null ? calculateGradeFromValue(currentWeather[0].pm25, 'pm25') : null)).icon || '💨'}</span>
                              <span className="text-xs font-medium text-white/90">초미세먼지</span>
                            </div>
                            <div className="text-lg font-bold text-white tabular-nums">{currentWeather[0].pm25}</div>
                            <div className="text-xs text-white/70 mt-0.5">㎍/㎥</div>
                            {(currentWeather[0].pm25Grade || (currentWeather[0].pm25 !== null ? calculateGradeFromValue(currentWeather[0].pm25, 'pm25') : null)) && (
                              <div className="text-xs mt-0.5 text-white/60">
                                ({getGradeIcon(currentWeather[0].pm25Grade || (currentWeather[0].pm25 !== null ? calculateGradeFromValue(currentWeather[0].pm25, 'pm25') : null)).status})
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 오존 */}
                        {currentWeather[0]?.o3 !== undefined && currentWeather[0]?.o3 !== null && (
                          <div className={`bg-white/20 backdrop-blur-sm rounded-lg p-2.5 ${getGradeIcon(currentWeather[0].o3Grade || (currentWeather[0].o3 !== null ? calculateGradeFromValue(currentWeather[0].o3, 'o3') : null)).color || 'text-white'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-sm">{getGradeIcon(currentWeather[0].o3Grade || (currentWeather[0].o3 !== null ? calculateGradeFromValue(currentWeather[0].o3, 'o3') : null)).icon || '☁️'}</span>
                              <span className="text-xs font-medium text-white/90">오존</span>
                            </div>
                            <div className="text-lg font-bold text-white tabular-nums">{currentWeather[0].o3}</div>
                            <div className="text-xs text-white/70 mt-0.5">ppm</div>
                            {(currentWeather[0].o3Grade || (currentWeather[0].o3 !== null ? calculateGradeFromValue(currentWeather[0].o3, 'o3') : null)) && (
                              <div className="text-xs mt-0.5 text-white/60">
                                ({getGradeIcon(currentWeather[0].o3Grade || (currentWeather[0].o3 !== null ? calculateGradeFromValue(currentWeather[0].o3, 'o3') : null)).status})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
          <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-black/30 backdrop-blur-md rounded-3xl p-8 text-center border border-white/10 ${
              config?.mode === 'together' && crewId ? 'mb-32 sm:mb-40' : ''
            }`}
          >
            <div className="text-6xl mb-4">🏃</div>
            <p className="text-white/80 mb-6 text-sm leading-relaxed">
              위치 추적을 시작하여 조깅 경로, 속도, 시간, 거리를 자동으로 기록합니다.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStart}
              className="px-8 py-4 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition text-lg font-semibold shadow-lg relative z-50"
            >
              조깅 시작
            </motion.button>
          </motion.div>

            {/* 조깅 경로 공유 설정 섹션 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`bg-black/30 backdrop-blur-md rounded-3xl p-6 border border-white/10 ${
                config?.mode === 'together' && crewId ? 'mb-32 sm:mb-40' : ''
              }`}
            >
              <h3 className="text-xl font-bold text-white mb-4">조깅 경로 공유 설정</h3>
              
              {/* 이름 설정 */}
              <div className="mb-4">
                <label className="block text-sm text-white/80 mb-2">코스 이름 (선택사항)</label>
                <input
                  type="text"
                  value={shareCourseName}
                  onChange={(e) => setShareCourseName(e.target.value)}
                  placeholder="예: 한강공원 조깅 코스"
                  className="w-full px-4 py-2 bg-gray-800/50 text-white rounded-lg border border-white/10 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 공유 저장 토글 */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="block text-sm text-white/80 mb-1">공유 저장</label>
                    <p className="text-xs text-white/50">
                      해당 버튼을 on 상태라면 조깅경로공유목록에 저장됩니다
                    </p>
                  </div>
                  <button
                    onClick={() => setShareToPublic(!shareToPublic)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      shareToPublic ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        shareToPublic ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 실시간 경로 공유 토글 (조깅(함께)에서만) */}
              {config?.mode === 'together' && crewId && (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm text-white/80 mb-1">내 경로 실시간 경로 공유</label>
                      <p className="text-xs text-white/50">
                        해당 버튼이 on 상태라면 모든 참여자들에게 내 경로가 실시간으로 공유됩니다.
                        <br />
                        (실시간 경로 공유는 해당 조깅크루에서만 적용됩니다.)
                      </p>
                    </div>
                    <button
                      onClick={() => setEnableRealtimeSharing(!enableRealtimeSharing)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        enableRealtimeSharing ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                          enableRealtimeSharing ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
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

            {/* 공유 코스 정보 */}
            {sharedCourse && !isTracking && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-500/20 backdrop-blur-md rounded-3xl p-6 border border-blue-500/30 mb-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🗺️</span>
                  <h3 className="text-xl font-bold text-white">공유 코스 사용 중</h3>
                </div>
                <p className="text-white/90 mb-2">
                  <strong>{sharedCourse.name || '이름 없음'}</strong>
                </p>
                <p className="text-sm text-white/70">
                  총 거리: {sharedCourse.totalDistance.toFixed(2)} km | 경로 포인트: {sharedCourse.route.length}개
                </p>
                <p className="text-xs text-white/50 mt-2">
                  이 코스를 참고하여 조깅을 시작하세요. 실제 경로는 GPS로 추적됩니다.
                </p>
              </motion.div>
            )}

            {/* 조깅(함께): 실시간 참여자 경로 목록 */}
            {config?.mode === 'together' && crewId && isTracking && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 backdrop-blur-md rounded-3xl p-6 border border-white/10"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">실시간 참여자 경로</h3>
                    <p className="text-xs text-white/50 mt-1">1분 간격으로 자동 갱신됩니다</p>
                  </div>
                  <div className="flex gap-2">
                    {/* 새로고침 버튼 (원형 화살표) */}
                    <button
                      onClick={async () => {
                        try {
                          const user = authService.getCurrentUser()
                          if (!user) return

                          const routes = await databaseService.getRealtimeJoggingRoutesByCrew(crewId)
                          
                          // 자신의 경로 제외 (userId 비교)
                          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                          const otherUserRoutes = routes.filter(route => {
                            const routeIsUuid = uuidRegex.test(route.userId)
                            const currentUserIsUuid = uuidRegex.test(user.id)
                            
                            if (routeIsUuid && currentUserIsUuid) {
                              return route.userId !== user.id
                            } else if (!routeIsUuid && !currentUserIsUuid) {
                              return route.userId !== user.id
                            } else {
                              return true
                            }
                          })
                          
                          setCrewRoutes(otherUserRoutes)
                        } catch (error) {
                          console.error('경로 목록 새로고침 실패:', error)
                          alert('경로 목록 새로고침에 실패했습니다.')
                        }
                      }}
                      className="w-10 h-10 bg-gray-700/50 text-white rounded-full hover:bg-gray-600/50 transition flex items-center justify-center"
                      title="새로고침"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {crewRoutes.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">
                      실시간 경로를 공유하는 참여자가 없습니다.
                    </div>
                  ) : (
                    crewRoutes.map((route) => {
                        const currentUser = authService.getCurrentUser()
                        const isMe = currentUser && route.userId === currentUser.id
                        const userName = route.userName || (isMe ? (currentUser?.name || '나') : `사용자 ${route.userId.slice(0, 8)}`)
                        const lastPoint = route.route.length > 0 ? route.route[route.route.length - 1] : null
                        const totalTime = Date.now() - route.startTime
                        
                        return (
                          <div
                            key={route.id}
                            className={`bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition ${
                              !route.isActive ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-lg font-semibold text-white">
                                    {userName}
                                  </h4>
                                  {isMe && (
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                      나
                                    </span>
                                  )}
                                  {!route.isActive && (
                                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                                      중지
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm">
                                  {route.isActive ? (
                                    <>
                                      <div className="text-gray-300">
                                        <span className="text-gray-400">현재 위치:</span>{' '}
                                        {lastPoint 
                                          ? `${lastPoint.lat.toFixed(6)}, ${lastPoint.lng.toFixed(6)}`
                                          : '위치 정보 없음'}
                                      </div>
                                      <div className="text-gray-300">
                                        <span className="text-gray-400">총 거리:</span> {route.totalDistance.toFixed(2)} km
                                      </div>
                                      <div className="text-gray-300">
                                        <span className="text-gray-400">총 시간:</span> {formatTime(totalTime)}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-gray-400 italic">
                                      경로 공유가 중지되었습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {route.route.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedRoute(route)
                                      setShowRouteModal(true)
                                    }}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                                    title="맵보기"
                                  >
                                    🗺️ 맵보기
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              </motion.div>
            )}

            {/* 내 경로 정보 */}
            {joggingData.route.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 backdrop-blur-md rounded-3xl p-6 border border-white/10"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-bold text-white">내경로</h3>
                  <div className="flex gap-2 items-center">
                    {/* 경로 공유 토글 버튼 (조깅(함께)에서만 표시) */}
                    {config?.mode === 'together' && crewId && isTracking && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/80">공유</span>
                        <button
                          onClick={async () => {
                            const user = authService.getCurrentUser()
                            if (!user) return

                            if (isRealtimeSharing) {
                              // 경로 공유 중지
                              if (!window.confirm('경로 공유를 중지하시겠습니까? 중지하면 목록에 저장되지 않으며, 실시간 경로 공유가 중지됩니다.')) {
                                return
                              }
                              
                              try {
                                // 실시간 경로 공유 비활성화
                                await databaseService.deactivateRealtimeJoggingRoute(user.id, crewId)
                                setIsRealtimeSharing(false)
                                
                                // 공유 저장 비활성화 (목록에 저장되지 않도록)
                                setShareToPublic(false)
                                
                                // 경로 업데이트 인터벌 정리
                                if (routeUpdateIntervalRef.current) {
                                  clearInterval(routeUpdateIntervalRef.current)
                                  routeUpdateIntervalRef.current = null
                                }
                                
                                alert('경로 공유가 중지되었습니다.')
                              } catch (error) {
                                console.error('경로 공유 중지 실패:', error)
                                alert('경로 공유 중지에 실패했습니다.')
                              }
                            } else {
                              // 경로 공유 시작 (재개)
                              try {
                                // 즉시 실시간 경로 초기 기록 생성
                                if (joggingData && joggingData.route.length > 0) {
                                  const userProfile = await databaseService.getUserById(user.id)
                                  const userName = userProfile?.name || 'Unknown'
                                  
                                  await databaseService.upsertRealtimeJoggingRoute({
                                    crewId: crewId,
                                    userId: user.id,
                                    userName: userName,
                                    route: joggingData.route,
                                    totalDistance: joggingData.distance,
                                    startTime: joggingData.startTime,
                                    lastUpdateTime: Date.now(),
                                    isActive: true,
                                  })
                                  console.log('✅ 경로 공유 재개: 실시간 경로 초기 기록 생성 완료')
                                }
                                
                                // 상태 변경 (useEffect가 자동으로 인터벌 시작)
                                setIsRealtimeSharing(true)
                                
                                alert('경로 공유가 재개되었습니다.')
                              } catch (error) {
                                console.error('경로 공유 재개 실패:', error)
                                alert('경로 공유 재개에 실패했습니다.')
                                setIsRealtimeSharing(false)
                              }
                            }
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            isRealtimeSharing ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                          title={isRealtimeSharing ? '경로 공유 중지' : '경로 공유 시작'}
                        >
                          <span
                            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                              isRealtimeSharing ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                    {/* 새로고침 버튼 (원형 화살표) */}
                    <button
                      onClick={() => {
                        // 경로 정보 새로고침 (실제로는 데이터를 다시 로드할 필요는 없지만 UI 업데이트)
                        setRoutePage(1)
                      }}
                      className="w-10 h-10 bg-gray-700/50 text-white rounded-full hover:bg-gray-600/50 transition flex items-center justify-center"
                      title="새로고침"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  <button
                    onClick={() => {
                      if (!routeExpanded) {
                        setRoutePage(1) // 펼칠 때 첫 페이지로 리셋
                      }
                      setRouteExpanded(!routeExpanded)
                    }}
                    className="px-4 py-2 bg-gray-700/50 text-white rounded-lg hover:bg-gray-600/50 transition text-sm"
                  >
                    {routeExpanded ? '접기' : '펼침'}
                  </button>
                  </div>
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
          </div>
        )}
        
        {/* 버튼 - 페이지와 함께 스크롤되도록 relative로 변경 */}
        {joggingData && (
          <div 
            className="flex gap-4 relative z-20 px-4 py-4"
            style={{
              marginBottom: config?.mode === 'together' && crewId 
                ? `${meetingViewHeight + 20}px` 
                : '20px',
            }}
          >
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
        )}

        {/* 조깅 함께 모드: 미팅 화면 (하단) */}
        {config?.mode === 'together' && crewId && (
          <div className="fixed left-0 right-0 z-50" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
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
              videoShareEnabled={crewVideoShareEnabled}
              audioShareEnabled={crewAudioShareEnabled}
              onParticipantsChange={loadCrewRoutes}
            />
          </div>
        )}

        {/* 조깅 함께 모드: 추천 버튼 및 채팅 버튼 (오른쪽 끝) - 조깅 시작 전/후 모두 표시 */}
        {config?.mode === 'together' && crewId && (
          <div className="fixed right-4 z-50 flex flex-col gap-3" style={{
            bottom: isTracking || isPaused 
              ? `calc(${meetingViewHeight + 80}px + env(safe-area-inset-bottom, 0px))`
              : `calc(${meetingViewHeight + 20}px + env(safe-area-inset-bottom, 0px))`,
          }}>
            {/* 추천 버튼 */}
            <button
              onClick={handleRecommend}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${
                hasRecommended
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
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
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition"
              style={{ 
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
          </div>
        )}
        
        {/* 채팅 패널 - 조건부 렌더링 밖에 위치 */}
        {config?.mode === 'together' && crewId && (
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

        {/* 실시간 참여자 경로 맵 모달 */}
        {showRouteModal && selectedRoute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowRouteModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-gray-900 rounded-t-3xl w-full max-w-4xl h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">
                    {selectedRoute.userName || '참여자'} 경로
                  </h3>
                  <div className="text-sm text-gray-400 mt-1">
                    제공자: {selectedRoute.userName || 'Unknown'} | 총 거리: {selectedRoute.totalDistance.toFixed(2)} km | 경로 포인트: {selectedRoute.route.length}개
                  </div>
                </div>
                <button
                  onClick={() => setShowRouteModal(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  닫기
                </button>
              </div>

              {/* 맵 컨테이너 */}
              <div className="flex-1 relative">
                <div
                  ref={routeMapRef}
                  className="w-full h-full"
                  style={{ minHeight: 'calc(90vh - 150px)' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default JoggingPage

