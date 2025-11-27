import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { JoggingGoal, JoggingConfig, WeatherInfo } from '@/types'
import { databaseService, SharedJoggingCourse } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { getWeatherInfo } from '@/services/weatherService'

// 맵 표시 컴포넌트
const MapDisplay = ({ route, goalId }: { route: Array<{ lat: number; lng: number; timestamp?: number }>, goalId: string }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  // Google Maps JavaScript API 로드
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    if (window.google && window.google.maps) {
      return
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [])

  // 맵 초기화 및 polyline 그리기
  useEffect(() => {
    if (!mapRef.current) return
    if (!window.google || !window.google.maps) return

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    if (!route || route.length === 0) return

    // 기존 맵 인스턴스 정리
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // 맵 초기화
    const map = new google.maps.Map(mapRef.current, {
      zoom: 15,
      center: { lat: route[0].lat, lng: route[0].lng },
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    })
    mapInstanceRef.current = map

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
    polylineRef.current = polyline

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
    markersRef.current.push(startMarker)

    // 종료 마커 (빨간색)
    if (route.length > 1) {
      const endMarker = new google.maps.Marker({
        position: { lat: route[route.length - 1].lat, lng: route[route.length - 1].lng },
        map: map,
        label: {
          text: '종료',
          color: '#FFFFFF',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#FF0000',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      })
      markersRef.current.push(endMarker)
    }

    // 경로가 전체적으로 보이도록 bounds 설정
    const bounds = new google.maps.LatLngBounds()
    path.forEach(point => bounds.extend(point))
    map.fitBounds(bounds, 50)

    // 정리 함수
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
      mapInstanceRef.current = null
    }
  }, [route, goalId])

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400" style={{ height: '400px' }}>
        Google Maps API 키가 설정되지 않았습니다.
      </div>
    )
  }

  if (!route || route.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400" style={{ height: '400px' }}>
        경로 데이터가 없습니다.
      </div>
    )
  }

  if (!window.google || !window.google.maps) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400" style={{ height: '400px' }}>
        지도를 로딩 중...
      </div>
    )
  }

  return (
    <div 
      ref={mapRef}
      className="bg-gray-900 rounded-lg mb-4"
      style={{ height: 'calc(90vh - 300px)', minHeight: '400px' }}
    />
  )
}

const JoggingAlonePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const sharedCourse = (location.state as { sharedCourse?: SharedJoggingCourse })?.sharedCourse
  const createdGoalId = (location.state as { createdGoalId?: string })?.createdGoalId
  const [goals, setGoals] = useState<JoggingGoal[]>([])
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [sharedCoursesMap, setSharedCoursesMap] = useState<Record<string, SharedJoggingCourse>>({})
  const [expandedRouteGoals, setExpandedRouteGoals] = useState<Set<string>>(new Set())
  const [routeModals, setRouteModals] = useState<Set<string>>(new Set())
  const PAGE_SIZE = 20

  const loadGoals = async (reset: boolean = false) => {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }
      
      const offset = reset ? 0 : pagination.offset
      if (reset) {
        setPagination({ offset: 0, hasMore: true, loading: true })
        setGoals([])
      } else {
        setPagination(prev => ({ ...prev, loading: true }))
      }
      
      const result = await databaseService.getJoggingGoalsByUserId(user.id, PAGE_SIZE, offset)
      if (reset) {
        setGoals(result.data)
      } else {
        setGoals(prev => [...prev, ...result.data])
      }
      
      setPagination({ 
        offset: offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
      
      // 공유 코스에서 생성된 목표들의 공유 코스 정보 로드
      const coursesMap: Record<string, SharedJoggingCourse> = {}
      for (const goal of result.data) {
        if (goal.sharedCourseId && !sharedCoursesMap[goal.sharedCourseId]) {
          try {
            const course = await databaseService.getSharedJoggingCourseById(goal.sharedCourseId)
            if (course) {
              coursesMap[goal.sharedCourseId] = course
            }
          } catch (error) {
            console.error(`공유 코스 ${goal.sharedCourseId} 로드 실패:`, error)
          }
        }
      }
      if (Object.keys(coursesMap).length > 0) {
        setSharedCoursesMap(prev => ({ ...prev, ...coursesMap }))
      }
    } catch (error) {
      console.error('목표 목록 로드 실패:', error)
      setGoals([])
    }
  }

  useEffect(() => {
    loadGoals(true)
  }, [navigate])

  // location이 변경될 때마다 목록 다시 로드 (생성/수정 후 돌아올 때)
  useEffect(() => {
    loadGoals(true)
  }, [location.key])

  // 생성된 목표가 있으면 수정 페이지로 이동
  useEffect(() => {
    if (createdGoalId && goals.length > 0) {
      const goal = goals.find(g => g.id === createdGoalId)
      if (goal) {
        // 목표를 찾았으면 수정 페이지로 이동
        navigate(`/jogging-goal/edit/${createdGoalId}`, { replace: true })
      }
    }
  }, [createdGoalId, goals, navigate])

  // 더 불러오기 (무한 스크롤)
  const loadMoreGoals = async () => {
    if (pagination.loading || !pagination.hasMore) return
    await loadGoals(false)
  }

  // 무한 스크롤 훅
  const { elementRef } = useInfiniteScroll({
    hasMore: pagination.hasMore,
    loading: pagination.loading,
    onLoadMore: loadMoreGoals,
  })

  const formatAlarmInfo = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText = alarm.repeatType === 'daily' ? '매일' : alarm.repeatType === 'weekly' ? '매주' : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const calculateTimeUntilAlarm = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '-'
    
    const now = new Date()
    const [hours, minutes] = alarm.time.split(':').map(Number)
    const alarmTime = new Date()
    alarmTime.setHours(hours, minutes, 0, 0)
    
    // 오늘 알람 시간이 지났으면 내일로 설정
    if (alarmTime <= now) {
      alarmTime.setDate(alarmTime.getDate() + 1)
    }
    
    const diff = alarmTime.getTime() - now.getTime()
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60))
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hoursLeft > 0) {
      return `${hoursLeft}시간 ${minutesLeft}분 후`
    } else {
      return `${minutesLeft}분 후`
    }
  }

  const handleStart = async (goal: JoggingGoal) => {
    // 실시간 날씨 정보 가져오기
    let weatherData: WeatherInfo[] = []
    try {
      const { weather } = await getWeatherInfo()
      weatherData = weather
    } catch (error) {
      console.error('날씨 정보 가져오기 실패:', error)
      // 기본값 사용
      weatherData = [
        {
          date: '오늘',
          temperature: 22,
          humidity: 65,
          uvIndex: 5,
          condition: '맑음',
          pm10: 45,
          pm25: 25,
        },
        {
          date: '내일',
          temperature: 24,
          humidity: 70,
          uvIndex: 6,
          condition: '구름조금',
          pm10: 50,
          pm25: 28,
        },
        {
          date: '모레',
          temperature: 20,
          humidity: 60,
          uvIndex: 4,
          condition: '맑음',
          pm10: 40,
          pm25: 22,
        },
      ]
    }

    const config: JoggingConfig = {
      mode: 'alone',
      targetDistance: goal.targetDistance,
      targetTime: goal.targetTime,
      alarm: goal.alarm,
    }

    // 공유 코스 정보 가져오기 (목표에 sharedCourseId가 있는 경우)
    let goalSharedCourse: SharedJoggingCourse | undefined = sharedCourse
    if (goal.sharedCourseId && !goalSharedCourse) {
      goalSharedCourse = sharedCoursesMap[goal.sharedCourseId]
    }

    // 조깅 페이지로 바로 이동
    navigate('/jogging', {
      state: {
        config,
        weather: weatherData,
        sharedCourse: goalSharedCourse, // 공유 코스가 있으면 전달
        goalName: goal.name || goalSharedCourse?.name, // 조깅 목표 이름 또는 공유 코스 이름 (방 제목)
      },
    })
  }

  // 공유 코스가 있으면 바로 조깅 시작
  useEffect(() => {
    if (sharedCourse) {
      const user = authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }
      
      handleStart({
        id: 'shared-course',
        userId: user.id,
        name: sharedCourse.name || '공유 코스', // 공유 코스 이름 또는 기본값
        targetDistance: sharedCourse.totalDistance,
        targetTime: undefined,
        alarm: undefined,
        createdAt: Date.now(),
      } as JoggingGoal)
    }
  }, [sharedCourse])

  const handleDelete = async (goalId: string) => {
    if (!window.confirm('정말 이 목표를 삭제하시겠습니까?')) {
      return
    }

    try {
      await databaseService.deleteJoggingGoal(goalId)
      // 목표 목록 다시 로드
      await loadGoals(true)
      alert('목표가 삭제되었습니다.')
    } catch (error) {
      console.error('목표 삭제 실패:', error)
      alert('목표 삭제에 실패했습니다.')
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">나의 조깅목표</h1>
          <NavigationButtons backPath="/jogging-mode-select" />
        </div>

        {/* 목표 생성 버튼 */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/jogging-goal/create')}
            className="w-full px-6 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-semibold text-lg"
          >
            ➕ 목표 생성
          </button>
        </div>

        {/* 목표 목록 */}
        {goals.length === 0 ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🏃</div>
            <p className="text-xl text-gray-300 mb-6">등록된 목표가 없습니다</p>
            <button
              onClick={() => navigate('/jogging-goal/create')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
            >
              목표 생성하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/90 rounded-2xl p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-3">{goal.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {goal.targetDistance && (
                        <div>
                          <span className="text-gray-400">목표 거리:</span>
                          <span className="text-white ml-2">{goal.targetDistance}km</span>
                        </div>
                      )}
                      {goal.targetTime && (
                        <div>
                          <span className="text-gray-400">목표 시간:</span>
                          <span className="text-white ml-2">{goal.targetTime}분</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">알람 정보:</span>
                        <span className="text-white ml-2">{formatAlarmInfo(goal.alarm)}</span>
                      </div>
                      {goal.alarm && (
                        <div>
                          <span className="text-gray-400">조깅시작까지:</span>
                          <span className="text-green-400 ml-2 font-semibold">
                            {calculateTimeUntilAlarm(goal.alarm)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* 공유 경로 목록 섹션 (공유 코스에서 생성된 경우만) */}
                    {goal.sharedCourseId && sharedCoursesMap[goal.sharedCourseId] && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedRouteGoals)
                              if (newExpanded.has(goal.id)) {
                                newExpanded.delete(goal.id)
                              } else {
                                newExpanded.add(goal.id)
                              }
                              setExpandedRouteGoals(newExpanded)
                            }}
                            className="text-white font-semibold hover:text-green-400 transition flex items-center gap-2"
                          >
                            <span>공유 경로 목록</span>
                            <span>{expandedRouteGoals.has(goal.id) ? '▼' : '▶'}</span>
                          </button>
                          <button
                            onClick={() => {
                              const newModals = new Set(routeModals)
                              newModals.add(goal.id)
                              setRouteModals(newModals)
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                          >
                            Map
                          </button>
                        </div>
                        {expandedRouteGoals.has(goal.id) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto mt-2"
                          >
                            <div className="space-y-2">
                              {sharedCoursesMap[goal.sharedCourseId].route.map((point, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between text-sm text-gray-300 bg-gray-800/50 rounded p-2"
                                >
                                  <span className="font-mono">
                                    {index + 1}. {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                                  </span>
                                  {point.timestamp && (
                                    <span className="text-xs text-gray-400">
                                      {new Date(point.timestamp).toLocaleTimeString('ko-KR')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 text-xs text-gray-400">
                              총 {sharedCoursesMap[goal.sharedCourseId].route.length}개 위치
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => navigate(`/jogging-goal/edit/${goal.id}`)}
                      className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition font-semibold whitespace-nowrap"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold whitespace-nowrap"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => handleStart(goal)}
                      className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold whitespace-nowrap"
                    >
                      입장하기
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* 경로 지도 모달들 */}
            {goals.map((goal) => {
              if (!goal.sharedCourseId || !sharedCoursesMap[goal.sharedCourseId] || !routeModals.has(goal.id)) {
                return null
              }
              
              const course = sharedCoursesMap[goal.sharedCourseId]
              
              return (
                <div
                  key={`modal-${goal.id}`}
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => {
                    const newModals = new Set(routeModals)
                    newModals.delete(goal.id)
                    setRouteModals(newModals)
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-800 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-white">
                        {course.name || '경로 지도'}
                      </h2>
                      <button
                        onClick={() => {
                          const newModals = new Set(routeModals)
                          newModals.delete(goal.id)
                          setRouteModals(newModals)
                        }}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* 경로 정보 */}
                    <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-300">
                        <div>
                          <span className="text-gray-400 text-sm">총 거리:</span>
                          <div className="text-white font-semibold text-lg">
                            {course.totalDistance.toFixed(2)} km
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">경로 포인트:</span>
                          <div className="text-white font-semibold text-lg">
                            {course.route.length}개
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">목표명:</span>
                          <div className="text-white font-semibold text-lg">
                            {goal.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 경로 목록 (간략히) */}
                    <div className="bg-gray-700/30 rounded-lg p-3 mb-4">
                      <div className="text-sm text-gray-400 mb-2">경로 미리보기 (최대 5개)</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {course.route.slice(0, 5).map((point, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-xs text-gray-300 bg-gray-800/50 rounded p-1.5"
                          >
                            <span className="font-mono">
                              {index + 1}. {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                            </span>
                            {point.timestamp && (
                              <span className="text-gray-500">
                                {new Date(point.timestamp).toLocaleTimeString('ko-KR')}
                              </span>
                            )}
                          </div>
                        ))}
                        {course.route.length > 5 && (
                          <div className="text-xs text-gray-500 text-center pt-1">
                            ... 외 {course.route.length - 5}개 위치
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 지도 표시 영역 */}
                    <MapDisplay route={course.route} goalId={goal.id} />

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          const newModals = new Set(routeModals)
                          newModals.delete(goal.id)
                          setRouteModals(newModals)
                        }}
                        className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                      >
                        닫기
                      </button>
                    </div>
                  </motion.div>
                </div>
              )
            })}
            
            {/* 무한 스크롤 트리거 */}
            {pagination.hasMore && (
              <div ref={elementRef} className="py-4 text-center">
                {pagination.loading && (
                  <div className="text-gray-400">로딩 중...</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default JoggingAlonePage

