import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { JoggingMode } from '@/types'
import NavigationButtons from '@/components/NavigationButtons'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'
import { databaseService, SharedJoggingCourse } from '@/services/databaseService'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

const JoggingModeSelectPage = () => {
  const navigate = useNavigate()
  const [selectedMode, setSelectedMode] = useState<JoggingMode | null>(null)
  const [sharedCourses, setSharedCourses] = useState<SharedJoggingCourse[]>([])
  const [coursePagination, setCoursePagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'distance' | 'createdAt' | 'name'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedCourse, setSelectedCourse] = useState<SharedJoggingCourse | null>(null)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [showMyCoursesOnly, setShowMyCoursesOnly] = useState(false)
  const PAGE_SIZE = 20
  
  // Google Maps 관련 refs
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  // 관리자는 이 페이지에 접근할 수 없음
  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user && adminService.isAdmin(user)) {
      alert('관리자는 일반 사용자 모드를 사용할 수 없습니다.')
      navigate('/admin/dashboard')
    }
  }, [navigate])

  // 공유 코스 목록 로드
  const loadSharedCourses = async (reset: boolean = false) => {
    const offset = reset ? 0 : coursePagination.offset
    if (reset) {
      setCoursePagination({ offset: 0, hasMore: true, loading: true })
      setSharedCourses([])
    } else {
      setCoursePagination(prev => ({ ...prev, loading: true }))
    }

    try {
      const result = await databaseService.getSharedJoggingCourses(PAGE_SIZE, offset)
      if (reset) {
        setSharedCourses(result.data)
      } else {
        setSharedCourses(prev => [...prev, ...result.data])
      }
      setCoursePagination({ 
        offset: offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
    } catch (error) {
      console.error('공유 코스 로드 실패:', error)
      setCoursePagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 더 불러오기
  const loadMoreCourses = async () => {
    if (coursePagination.loading || !coursePagination.hasMore) return
    await loadSharedCourses(false)
  }

  // 무한 스크롤
  const { elementRef: courseScrollRef } = useInfiniteScroll({
    hasMore: coursePagination.hasMore,
    loading: coursePagination.loading,
    onLoadMore: loadMoreCourses,
  })

  useEffect(() => {
    loadSharedCourses(true)
  }, [])

  // 코스 삭제
  const handleDeleteCourse = async (courseId: string) => {
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    if (!confirm('정말 이 코스를 삭제하시겠습니까?')) {
      return
    }

    try {
      const success = await databaseService.deleteSharedJoggingCourse(courseId, user.id)
      if (success) {
        setSharedCourses(prev => prev.filter(c => c.id !== courseId))
        alert('코스가 삭제되었습니다.')
      } else {
        alert('코스 삭제에 실패했습니다. 본인이 생성한 코스만 삭제할 수 있습니다.')
      }
    } catch (error) {
      console.error('코스 삭제 실패:', error)
      alert('코스 삭제에 실패했습니다.')
    }
  }

  // 코스 사용 (목표 생성 목록에 추가)
  const handleUseCourse = async (course: SharedJoggingCourse) => {
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    try {
      // 조깅 목표 생성
      const goalName = course.name || `공유 코스 ${new Date().toLocaleDateString('ko-KR')}`
      const newGoal = await databaseService.createJoggingGoal({
        name: goalName,
        targetDistance: course.totalDistance,
        targetTime: undefined,
        alarm: undefined,
        backgroundMusic: undefined,
        sharedCourseId: course.id, // 공유 코스 ID 저장
        createdBy: user.id,
      })

      // 저장완료 메시지 표시
      alert('목표가 저장되었습니다.')
      
      // 목표 생성 후 목표 목록 페이지로 이동 (수정 가능하도록)
      navigate('/jogging-alone', {
        state: {
          createdGoalId: newGoal.id,
        },
      })
    } catch (error) {
      console.error('목표 생성 실패:', error)
      alert('목표 생성에 실패했습니다.')
    }
  }

  // 내 코스만 필터링
  const myCoursesCount = useMemo(() => {
    const user = authService.getCurrentUser()
    if (!user) return 0
    return sharedCourses.filter(course => course.userId === user.id).length
  }, [sharedCourses])

  // 필터링 및 정렬된 코스 목록
  const filteredAndSortedCourses = sharedCourses
    .filter(course => {
      const user = authService.getCurrentUser()
      // 내 코스만 보기 필터
      if (showMyCoursesOnly && user) {
        if (course.userId !== user.id) return false
      }
      
      // 검색 필터
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      const userName = course.userId // userId로 검색 (나중에 사용자 이름으로 개선 가능)
      return (
        (course.name?.toLowerCase().includes(searchLower) || false) ||
        userName.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      let comparison = 0
      if (sortBy === 'distance') {
        comparison = a.totalDistance - b.totalDistance
      } else if (sortBy === 'createdAt') {
        comparison = a.createdAt - b.createdAt
      } else if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '')
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // 사용자 이름 가져오기
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({})
  
  useEffect(() => {
    const loadUserNames = async () => {
      const names: Record<string, string> = {}
      const currentUser = authService.getCurrentUser()
      
      // 현재 사용자 이름 저장
      if (currentUser) {
        names[currentUser.id] = currentUser.name || '나'
      }
      
      // 공유 코스의 사용자 이름 가져오기
      for (const course of sharedCourses) {
        if (!names[course.userId] && course.userId !== currentUser?.id) {
          try {
            const user = await databaseService.getUserById(course.userId)
            if (user) {
              names[course.userId] = user.name || `사용자 ${course.userId.slice(0, 8)}`
            } else {
              names[course.userId] = `사용자 ${course.userId.slice(0, 8)}`
            }
          } catch (error) {
            names[course.userId] = `사용자 ${course.userId.slice(0, 8)}`
          }
        }
      }
      
      setUserNameMap(names)
    }
    
    if (sharedCourses.length > 0) {
      loadUserNames()
    }
  }, [sharedCourses])

  const getUserName = (userId: string) => {
    return userNameMap[userId] || `사용자 ${userId.slice(0, 8)}`
  }

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

  // 맵 초기화 및 polyline 그리기
  useEffect(() => {
    if (!showCourseModal || !selectedCourse || !mapRef.current) return
    if (!window.google || !window.google.maps) return

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    const route = selectedCourse.route
    if (!route || route.length === 0) return

    // 기존 맵 인스턴스 정리
    if (mapInstanceRef.current) {
      mapInstanceRef.current = null
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }
    // 기존 마커 제거
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
    map.fitBounds(bounds)

    // 패딩 추가 (선택사항)
    const padding = 50
    map.fitBounds(bounds, padding)

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
  }, [showCourseModal, selectedCourse])

  const handleModeSelect = (mode: JoggingMode) => {
    setSelectedMode(mode)
    if (mode === 'together') {
      navigate('/jogging-crew')
    } else {
      navigate('/jogging-alone')
    }
  }

  const modes = [
    {
      id: 'alone' as JoggingMode,
      title: '혼자',
      description: '혼자 조깅하기',
      icon: '🏃',
      color: 'from-green-500 to-green-700',
    },
    {
      id: 'together' as JoggingMode,
      title: '함께',
      description: '친구들과 함께 조깅하기',
      icon: '👥',
      color: 'from-blue-500 to-blue-700',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">조깅모드</h1>
          <NavigationButtons backPath="/mode-select" />
        </div>
        <p className="text-xl text-gray-300 text-center mb-12">조깅 모드를 선택하세요</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
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

        {/* 공유 조깅 코스 목록 */}
        <div className="bg-gray-800/90 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">🏃 공유 조깅 코스</h2>
          
          {/* 검색 및 정렬 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="코스 이름 또는 제공자로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowMyCoursesOnly(!showMyCoursesOnly)}
                disabled={myCoursesCount === 0}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  showMyCoursesOnly
                    ? 'bg-blue-600 text-white'
                    : myCoursesCount === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
                title={myCoursesCount === 0 ? '내 코스가 없습니다' : '내 코스만 보기'}
              >
                내코스만
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'distance' | 'createdAt' | 'name')}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt">생성일</option>
                <option value="distance">거리</option>
                <option value="name">이름</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
              >
                {sortOrder === 'asc' ? '⬆️' : '⬇️'}
              </button>
            </div>
          </div>

          {/* 코스 목록 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAndSortedCourses.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {coursePagination.loading ? '로딩 중...' : '공유된 코스가 없습니다.'}
              </div>
            ) : (
              filteredAndSortedCourses.map((course) => {
                const user = authService.getCurrentUser()
                const isOwner = user && user.id === course.userId
                
                return (
                  <div
                    key={course.id}
                    className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition"
                  >
                    {/* 코스 제목 (별도 라인) */}
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-lg font-semibold text-white">
                        {course.name || '이름 없음'}
                      </h3>
                      {isOwner && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                          내 코스
                        </span>
                      )}
                    </div>
                    
                    {/* 코스 정보 및 버튼 */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm text-gray-300 mb-1">
                          제공자: {getUserName(course.userId)}
                        </div>
                        <div className="text-sm text-gray-400">
                          총 거리: {course.totalDistance.toFixed(2)} km
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          생성일: {new Date(course.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedCourse(course)
                            setShowCourseModal(true)
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                          title="지도 보기"
                        >
                          Map
                        </button>
                        <button
                          onClick={() => handleUseCourse(course)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                          title="코스 사용"
                        >
                          사용
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteCourse(course.id)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                            title="삭제"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            
            {/* 무한 스크롤 트리거 */}
            {coursePagination.hasMore && (
              <div ref={courseScrollRef} className="py-4 text-center">
                {coursePagination.loading && (
                  <div className="text-gray-400 text-sm">로딩 중...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 코스 지도 모달 */}
      {showCourseModal && selectedCourse && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCourseModal(false)}
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
                {selectedCourse.name || '이름 없음'}
              </h2>
              <button
                onClick={() => setShowCourseModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            {/* 닫기 탭 버튼 */}
            <div className="flex justify-center mb-4">
              <button
                onClick={() => setShowCourseModal(false)}
                className="px-6 py-2 bg-gray-700 text-white rounded-t-lg hover:bg-gray-600 transition"
              >
                닫기
              </button>
            </div>

            <div className="mb-4 text-gray-300 text-sm">
              제공자: {getUserName(selectedCourse.userId)} | 총 거리: {selectedCourse.totalDistance.toFixed(2)} km | 경로 포인트: {selectedCourse.route.length}개
            </div>

            {/* 지도 표시 영역 */}
            <div 
              ref={mapRef}
              className="bg-gray-900 rounded-lg mb-4"
              style={{ height: 'calc(90vh - 150px)', minHeight: '400px' }}
            >
              {(() => {
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
                if (!apiKey) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Google Maps API 키가 설정되지 않았습니다.
                    </div>
                  )
                }

                const route = selectedCourse.route
                if (!route || route.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      경로 데이터가 없습니다.
                    </div>
                  )
                }

                if (!window.google || !window.google.maps) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      지도를 로딩 중...
                    </div>
                  )
                }

                return null // 맵은 useEffect에서 렌더링됨
              })()}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCourseModal(false)
                  handleUseCourse(selectedCourse)
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                이 코스 사용하기
              </button>
              <button
                onClick={() => setShowCourseModal(false)}
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

export default JoggingModeSelectPage

