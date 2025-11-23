import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { Crew, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

const CrewListPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [myCrews, setMyCrews] = useState<Crew[]>([])
  const [sortedCrews, setSortedCrews] = useState<Crew[]>([])
  const [sortBy, setSortBy] = useState<'created' | 'recommendations'>('created')
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [hasRecommendedMap, setHasRecommendedMap] = useState<Record<string, boolean>>({})
  const [hasCancelledMap, setHasCancelledMap] = useState<Record<string, boolean>>({})
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({})

  useEffect(() => {
    loadMyCrews()
    
    // storage 이벤트 리스너 추가 (다른 탭/창에서 변경사항 감지)
    const handleStorageChange = () => {
      loadMyCrews()
    }
    window.addEventListener('storage', handleStorageChange)
    
    // 주기적으로 목록 새로고침 (다른 PC에서의 변경사항 감지) - 간격을 늘림
    const interval = setInterval(loadMyCrews, 10000) // 10초마다 (3초 -> 10초로 변경)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // location이 변경될 때마다 목록 다시 로드 (생성/수정 후 돌아올 때)
  useEffect(() => {
    loadMyCrews()
  }, [location.key])

  const loadMyCrews = async () => {
    const user = authService.getCurrentUser()
    if (!user) return

    try {
      const crews = await databaseService.getCrewsByUserId(user.id)
      setMyCrews(crews as Crew[])
      
      // 각 크루에 대해 추천 여부 확인 및 생성자 정보 가져오기
      const recommendedMap: Record<string, boolean> = {}
      const cancelledMap: Record<string, boolean> = {}
      const creatorNameMap: Record<string, string> = {}
      for (const crew of crews) {
        const hasRecommended = await databaseService.hasUserRecommendedCrew(crew.id, user.id)
        const hasCancelled = await databaseService.hasUserCancelledCrewRecommendation(crew.id, user.id)
        recommendedMap[crew.id] = hasRecommended
        cancelledMap[crew.id] = hasCancelled
        
        // 생성자 정보 가져오기
        try {
          const creator = await databaseService.getUserById(crew.createdBy)
          if (creator) {
            creatorNameMap[crew.id] = creator.name
          }
        } catch (error) {
          console.error(`크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setHasRecommendedMap(recommendedMap)
      setHasCancelledMap(cancelledMap)
      setCreatorMap(creatorNameMap)
    } catch (error: any) {
      console.error('크루 목록 로드 실패:', error)
      console.error('에러 상세:', error?.message, error?.code, error?.details, error?.hint)
      alert(`크루 목록을 불러오는데 실패했습니다: ${error?.message || String(error)}`)
    }
  }

  // 정렬 적용
  useEffect(() => {
    const sorted = [...myCrews].sort((a, b) => {
      if (sortBy === 'recommendations') {
        const aRec = a.recommendations || 0
        const bRec = b.recommendations || 0
        if (bRec !== aRec) return bRec - aRec
        // 추천수가 같으면 생성일 최신순
        return b.createdAt - a.createdAt
      } else {
        // 생성일 최신순
        return b.createdAt - a.createdAt
      }
    })
    setSortedCrews(sorted)
  }, [myCrews, sortBy])

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getExerciseName = (type: ExerciseType): string => {
    return EXERCISE_TYPE_NAMES[type] || '커스텀'
  }

  const formatAlarmTime = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText = alarm.repeatType === 'daily' ? '매일' : alarm.repeatType === 'weekly' ? '매주' : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const handleEnter = async (crew: Crew) => {
    // 크루 입장 - TrainingPage로 이동
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    // 크루 멤버 설정 초기화 (영상/음성 off로 시작)
    try {
      await databaseService.updateCrewMember(crew.id, user.id, {
        videoEnabled: videoEnabled,
        audioEnabled: audioEnabled,
      })
    } catch (error) {
      console.error('멤버 설정 업데이트 실패:', error)
    }

    navigate('/training', {
      state: {
        mode: 'crew',
        config: crew.exerciseConfig,
        alarm: crew.alarm,
        crewId: crew.id,
      },
    })
  }

  const handleLeave = async (crewId: string) => {
    const user = authService.getCurrentUser()
    if (!user) return

    if (window.confirm('정말 이 크루에서 탈퇴하시겠습니까?')) {
      try {
        await databaseService.removeCrewMember(crewId, user.id)
        await loadMyCrews()
        alert('크루에서 탈퇴했습니다')
      } catch (error) {
        alert('크루 탈퇴에 실패했습니다.')
      }
    }
  }

  const handleEdit = (crew: Crew) => {
    navigate('/crew/create', { state: { crew } })
  }

  const handleDelete = async (crew: Crew) => {
    const user = authService.getCurrentUser()
    if (!user) return

    // 크루장인지 확인
    if (crew.createdBy !== user.id) {
      alert('크루장만 크루를 삭제할 수 있습니다.')
      return
    }

    if (window.confirm('정말 이 크루를 삭제하시겠습니까? 크루와 관련된 모든 데이터(채팅 메시지 포함)가 삭제됩니다.')) {
      try {
        await databaseService.deleteCrew(crew.id)
        await loadMyCrews()
        alert('크루가 삭제되었습니다.')
      } catch (error) {
        console.error('크루 삭제 실패:', error)
        alert('크루 삭제에 실패했습니다.')
      }
    }
  }

  const isOwner = (crew: Crew): boolean => {
    const user = authService.getCurrentUser()
    return user ? crew.createdBy === user.id : false
  }

  const handleRecommend = async (crew: Crew) => {
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    try {
      console.log('🔘 추천 버튼 클릭:', { crewId: crew.id, userId: user.id, crewName: crew.name })
      const result = await databaseService.toggleCrewRecommendation(crew.id, user.id)
      console.log('📊 추천 처리 결과:', result)
      
      if (result.success) {
        console.log('✅ 추천 처리 성공')
        setHasRecommendedMap(prev => ({ ...prev, [crew.id]: result.isRecommended }))
        if (!result.isRecommended) {
          setHasCancelledMap(prev => ({ ...prev, [crew.id]: true }))
        }
        
        // 추천수 업데이트를 위해 크루 정보만 다시 가져오기
        try {
          const updatedCrew = await databaseService.getCrewById(crew.id)
          if (updatedCrew) {
            // 해당 크루만 목록에서 업데이트
            setMyCrews(prev => prev.map(c => c.id === crew.id ? updatedCrew as Crew : c))
            // 추천 상태만 다시 확인
            const hasRecommended = await databaseService.hasUserRecommendedCrew(crew.id, user.id)
            setHasRecommendedMap(prev => ({ ...prev, [crew.id]: hasRecommended }))
          }
        } catch (loadError) {
          console.warn('크루 정보 새로고침 중 오류 (추천은 성공):', loadError)
          // 추천은 성공했으므로 전체 목록 새로고침 시도
          try {
            await loadMyCrews()
          } catch (fullLoadError) {
            console.warn('전체 목록 새로고침도 실패:', fullLoadError)
          }
        }
      } else {
        console.warn('⚠️ 추천 처리 실패:', result)
        if (hasCancelledMap[crew.id]) {
          alert('이미 취소한 크루는 다시 추천할 수 없습니다.')
        } else {
          alert('추천 처리에 실패했습니다.')
        }
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
      if (error?.code === '42501' || error?.message?.includes('permission denied') || error?.message?.includes('권한') || error?.message?.includes('RLS')) {
        alert('추천 기능을 사용하려면 Supabase에서 FIX_RLS_POLICIES.sql 파일을 실행하여 RLS 정책을 설정해주세요.')
      } else if (error?.code === 'PGRST205' || error?.code === '42P01' || error?.message?.includes('table') || error?.message?.includes('테이블')) {
        alert('추천 기능을 사용하려면 Supabase에서 ADD_RECOMMENDATIONS_FEATURE.sql 파일을 실행하여 테이블을 생성해주세요.')
      } else if (error?.code === '23505' || error?.message?.includes('unique constraint')) {
        alert('이미 추천한 크루입니다.')
      } else {
        const errorMessage = error?.message || error?.details || String(error)
        alert(`추천 처리 중 오류가 발생했습니다: ${errorMessage}\n\n에러 코드: ${error?.code || 'N/A'}`)
      }
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">나의 크루 목록</h1>
          <NavigationButtons backPath="/crew" />
        </div>

        {/* 정렬 버튼 */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setSortBy('created')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              sortBy === 'created'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            최신순
          </button>
          <button
            onClick={() => setSortBy('recommendations')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              sortBy === 'recommendations'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            추천수순
          </button>
        </div>

        {/* 영상/음성 토글 버튼 */}
        <div className="bg-gray-800/90 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">나의 공유 설정</span>
            <div className="flex gap-4">
              <button
                onClick={() => setVideoEnabled(!videoEnabled)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                  videoEnabled
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span>📹</span>
                <span>영상 {videoEnabled ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                  audioEnabled
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span>🎤</span>
                <span>음성 {audioEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>

        {sortedCrews.length === 0 ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-xl text-gray-300 mb-6">참여 중인 크루가 없습니다</p>
            <button
              onClick={() => navigate('/crew/create')}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
            >
              크루 생성하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedCrews.map((crew) => (
              <motion.div
                key={crew.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/90 rounded-2xl p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{crew.name}</h3>
                      <div className="flex items-center gap-2">
                        {crew.videoShareEnabled && (
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded" title="영상 공유">
                            📹
                          </span>
                        )}
                        {crew.audioShareEnabled && (
                          <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded" title="음성 공유">
                            🎤
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-2">
                      <div>
                        <span className="text-gray-400">캡틴:</span>
                        <span className="text-white ml-2">{creatorMap[crew.id] ? `${creatorMap[crew.id]}님` : '알 수 없음'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">종목:</span>
                        <span className="text-white ml-2">{getExerciseName(crew.exerciseType)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">운동량:</span>
                        <span className="text-white ml-2">
                          {crew.exerciseConfig.sets}세트 × {crew.exerciseConfig.reps}회
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">멤버:</span>
                        <span className="text-white ml-2">
                          {crew.currentMembers}명
                          {crew.maxMembers ? ` / ${crew.maxMembers}명` : ' (제한없음)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">알람시간:</span>
                        <span className="text-white ml-2">{formatAlarmTime(crew.alarm)}</span>
                      </div>
                    </div>
                    <div className="text-sm mb-2">
                      <span className="text-gray-400">생성일:</span>
                      <span className="text-white ml-2">{formatDate(crew.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-white">{crew.recommendations || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button
                      onClick={() => handleRecommend(crew)}
                      disabled={hasCancelledMap[crew.id]}
                      className={`flex-1 md:flex-none px-3 py-2 text-sm md:px-4 md:py-2 md:text-base rounded-lg font-semibold whitespace-nowrap transition ${
                        hasCancelledMap[crew.id]
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : hasRecommendedMap[crew.id]
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-yellow-500 text-white hover:bg-yellow-600'
                      }`}
                      title={hasCancelledMap[crew.id] ? '이미 취소한 크루는 다시 추천할 수 없습니다' : hasRecommendedMap[crew.id] ? '추천 취소' : '추천하기'}
                    >
                      {hasRecommendedMap[crew.id] ? '⭐ 추천됨' : '⭐ 추천'}
                    </button>
                    <button
                      onClick={() => handleEnter(crew)}
                      className="flex-1 md:flex-none px-3 py-2 text-sm md:px-6 md:py-3 md:text-base bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold whitespace-nowrap"
                    >
                      입장하기
                    </button>
                    {isOwner(crew) && (
                      <>
                        <button
                          onClick={() => handleEdit(crew)}
                          className="flex-1 md:flex-none px-3 py-2 text-sm md:px-4 md:py-3 md:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition font-semibold whitespace-nowrap"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(crew)}
                          className="flex-1 md:flex-none px-3 py-2 text-sm md:px-4 md:py-3 md:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold whitespace-nowrap"
                        >
                          삭제
                        </button>
                      </>
                    )}
                    {!isOwner(crew) && (
                      <button
                        onClick={() => handleLeave(crew.id)}
                        className="flex-1 md:flex-none px-3 py-2 text-sm md:px-6 md:py-3 md:text-base bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold whitespace-nowrap"
                      >
                        탈퇴하기
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CrewListPage

