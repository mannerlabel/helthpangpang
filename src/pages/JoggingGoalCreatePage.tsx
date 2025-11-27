import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { AlarmConfig, JoggingGoal } from '@/types'
import { audioService } from '@/services/audioService'
import { databaseService, SharedJoggingCourse } from '@/services/databaseService'
import { authService } from '@/services/authService'

// 맵 표시 컴포넌트
const MapDisplay = ({ route }: { route: Array<{ lat: number; lng: number; timestamp?: number }> }) => {
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
  }, [route])

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

const JoggingGoalCreatePage = () => {
  const navigate = useNavigate()
  const { goalId } = useParams<{ goalId?: string }>()
  const isEditMode = !!goalId
  
  const [goalName, setGoalName] = useState('')
  const [targetDistance, setTargetDistance] = useState<number | undefined>(undefined)
  const [targetTime, setTargetTime] = useState<number | undefined>(undefined)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [backgroundMusic, setBackgroundMusic] = useState(1)
  const [previewingMusicId, setPreviewingMusicId] = useState<number | null>(null)
  const [sharedCourse, setSharedCourse] = useState<SharedJoggingCourse | null>(null)
  const [showRouteModal, setShowRouteModal] = useState(false)

  // 현재 시간을 기본값으로 설정
  const getCurrentTime = (): string => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    const loadGoal = async () => {
      if (isEditMode && goalId) {
        try {
          const user = authService.getCurrentUser()
          if (!user) return
          
          const result = await databaseService.getJoggingGoalsByUserId(user.id)
          // pagination 결과인 경우 data 배열 사용, 아니면 직접 배열 사용
          const goals = Array.isArray(result) ? result : result.data
          const goal = goals.find((g: JoggingGoal) => g.id === goalId)
          
          if (goal) {
            setGoalName(goal.name)
            setTargetDistance(goal.targetDistance)
            setTargetTime(goal.targetTime)
            setAlarmEnabled(!!goal.alarm)
            if (goal.alarm) {
              setAlarmTime(goal.alarm.time)
              setRepeatType(goal.alarm.repeatType)
              setRepeatDays(goal.alarm.repeatDays || [])
            }
            setBackgroundMusic(goal.backgroundMusic || 1)
            
            // 공유 코스에서 생성된 목표인 경우 공유 코스 정보 로드
            if (goal.sharedCourseId) {
              try {
                const course = await databaseService.getSharedJoggingCourseById(goal.sharedCourseId)
                if (course) {
                  setSharedCourse(course)
                  // 목표 거리를 공유 코스의 총 거리로 설정
                  setTargetDistance(course.totalDistance)
                }
              } catch (error) {
                console.error('공유 코스 로드 실패:', error)
              }
            }
          }
        } catch (error) {
          console.error('목표 로드 실패:', error)
        }
      } else {
        setAlarmTime(getCurrentTime())
      }
    }
    loadGoal()
  }, [isEditMode, goalId])

  const handlePreviewMusic = (musicId: number) => {
    audioService.playPreview(musicId)
    setPreviewingMusicId(musicId)
    setTimeout(() => {
      audioService.stopPreview()
      setPreviewingMusicId(null)
    }, 5000)
  }

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']

  const handleSave = async () => {
    if (!goalName.trim()) {
      alert('목표명을 입력해주세요')
      return
    }

    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    const alarm: AlarmConfig | undefined = alarmEnabled
      ? {
          enabled: true,
          time: alarmTime,
          repeatType,
          repeatDays: repeatType === 'custom' ? repeatDays : undefined,
        }
      : undefined

    const goalData: Omit<JoggingGoal, 'id' | 'createdAt' | 'createdBy' | 'isActive'> = {
      name: goalName,
      targetDistance,
      targetTime,
      alarm,
      backgroundMusic,
    }

    try {
      if (isEditMode && goalId) {
        // 수정 모드
        await databaseService.updateJoggingGoal(goalId, goalData)
        alert('목표가 수정되었습니다!')
      } else {
        // 생성 모드
        await databaseService.createJoggingGoal({
          ...goalData,
          createdBy: user.id,
        })
        alert('목표가 생성되었습니다!')
      }
      
      navigate('/jogging-alone')
    } catch (error) {
      console.error('목표 저장 실패:', error)
      alert('목표 저장에 실패했습니다.')
    }
  }

  // 사용 취소 (목표 삭제)
  const handleCancelUse = async () => {
    if (!goalId) return
    
    if (!window.confirm('이 목표를 삭제하시겠습니까? 공유 코스에서 생성된 목표가 삭제됩니다.')) {
      return
    }

    try {
      await databaseService.deleteJoggingGoal(goalId)
      alert('목표가 삭제되었습니다.')
      navigate('/jogging-alone')
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
          <h1 className="text-4xl font-bold text-white">{isEditMode ? '목표 수정' : '목표 생성'}</h1>
          <NavigationButtons backPath="/jogging-alone" />
        </div>

        <div className="bg-gray-800/90 rounded-2xl p-6 space-y-6">
          {/* 목표명 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              목표명 *
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="목표명을 입력하세요"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 목표 거리 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              목표 거리 (km)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={targetDistance || ''}
              onChange={(e) =>
                setTargetDistance(e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="목표 거리를 입력하세요 (선택사항)"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 목표 시간 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              목표 시간 (분)
            </label>
            <input
              type="number"
              min="0"
              value={targetTime || ''}
              onChange={(e) =>
                setTargetTime(e.target.value ? parseInt(e.target.value) : undefined)
              }
              placeholder="목표 시간을 입력하세요 (선택사항)"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 알람 설정 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">
              알람 설정
            </label>
            <label className="flex items-center text-white mb-4">
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(e) => setAlarmEnabled(e.target.checked)}
                className="mr-3 w-5 h-5"
              />
              알람 사용
            </label>
            {alarmEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-gray-300 text-sm mb-2">알람 시간</label>
                  <input
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-2">반복 설정</label>
                  <div className="space-y-2">
                    <label className="flex items-center text-white">
                      <input
                        type="radio"
                        name="repeatType"
                        value="daily"
                        checked={repeatType === 'daily'}
                        onChange={(e) => setRepeatType(e.target.value as 'daily')}
                        className="mr-2"
                      />
                      매일
                    </label>
                    <label className="flex items-center text-white">
                      <input
                        type="radio"
                        name="repeatType"
                        value="weekly"
                        checked={repeatType === 'weekly'}
                        onChange={(e) => setRepeatType(e.target.value as 'weekly')}
                        className="mr-2"
                      />
                      매주
                    </label>
                    <label className="flex items-center text-white">
                      <input
                        type="radio"
                        name="repeatType"
                        value="custom"
                        checked={repeatType === 'custom'}
                        onChange={(e) => setRepeatType(e.target.value as 'custom')}
                        className="mr-2"
                      />
                      요일 선택
                    </label>
                  </div>
                  {repeatType === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex gap-2 flex-wrap"
                    >
                      {daysOfWeek.map((day, index) => (
                        <button
                          key={index}
                          onClick={() => handleDayToggle(index)}
                          className={`px-4 py-2 rounded-lg transition ${
                            repeatDays.includes(index)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* 배경 사운드 설정 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">
              배경 사운드
            </label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((musicId) => (
                <div key={musicId} className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      setBackgroundMusic(musicId)
                      handlePreviewMusic(musicId)
                    }}
                    className={`w-full px-4 py-3 rounded-lg font-semibold transition ${
                      backgroundMusic === musicId
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    BGM {musicId}
                  </button>
                  {previewingMusicId === musicId && (
                    <div className="mt-2 text-xs text-blue-400">재생 중...</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 경로보기 섹션 (공유 코스에서 생성된 경우만) */}
          {sharedCourse && sharedCourse.route && sharedCourse.route.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-white text-lg font-semibold">
                  경로보기
                </label>
                <button
                  onClick={() => setShowRouteModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  Map
                </button>
              </div>
              <div className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {sharedCourse.route.map((point, index) => (
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
                  총 {sharedCourse.route.length}개 위치
                </div>
              </div>
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => navigate('/jogging-alone')}
              className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              취소
            </button>
            {sharedCourse && (
              <button
                onClick={handleCancelUse}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                사용 취소
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
            >
              저장하기
            </button>
          </div>
        </div>
      </div>

      {/* 경로 지도 모달 */}
      {showRouteModal && sharedCourse && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRouteModal(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto fixed bottom-0 left-0 right-0"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">
                {sharedCourse.name || '경로 지도'}
              </h2>
              <button
                onClick={() => setShowRouteModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* 닫기 탭 버튼 */}
            <div className="flex justify-center mb-4">
              <button
                onClick={() => setShowRouteModal(false)}
                className="px-6 py-2 bg-gray-700 text-white rounded-t-lg hover:bg-gray-600 transition"
              >
                닫기
              </button>
            </div>

            <div className="mb-4 text-gray-300 text-sm">
              총 거리: {sharedCourse.totalDistance.toFixed(2)} km | 경로 포인트: {sharedCourse.route.length}개
            </div>

            {/* 지도 표시 영역 */}
            <MapDisplay route={sharedCourse.route} />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRouteModal(false)}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default JoggingGoalCreatePage

