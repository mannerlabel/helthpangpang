import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { databaseService, JoggingCrew } from '@/services/databaseService'
import { authService } from '@/services/authService'

const JoggingCrewSearchPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCrews, setFilteredCrews] = useState<JoggingCrew[]>([])
  const [sortBy, setSortBy] = useState<'created' | 'recommendations'>('recommendations')
  const [loading, setLoading] = useState(true)
  const [hasRecommendedMap, setHasRecommendedMap] = useState<Record<string, boolean>>({})
  const [hasCancelledMap, setHasCancelledMap] = useState<Record<string, boolean>>({})
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({})

  useEffect(() => {
    loadCrews()
  }, [searchTerm, sortBy])

  const loadCrews = async () => {
    try {
      setLoading(true)
      // 실제 데이터베이스에서 모든 조깅 크루 가져오기
      let crews = await databaseService.getAllJoggingCrews()
      console.log('로드된 조깅 크루 수:', crews.length, crews)

      // 사용자가 이미 참여한 크루는 제외
      const user = authService.getCurrentUser()
      if (user) {
        const myCrews = await databaseService.getJoggingCrewsByUserId(user.id)
        const myCrewIds = new Set(myCrews.map((c) => c.id))
        crews = crews.filter((crew) => !myCrewIds.has(crew.id))
        console.log('참여한 크루 제외 후:', crews.length)

        // 각 크루에 대해 추천 여부 확인 및 생성자 정보 가져오기
        const recommendedMap: Record<string, boolean> = {}
        const cancelledMap: Record<string, boolean> = {}
        const creatorNameMap: Record<string, string> = {}
        for (const crew of crews) {
          const hasRecommended = await databaseService.hasUserRecommendedJoggingCrew(crew.id, user.id)
          const hasCancelled = await databaseService.hasUserCancelledJoggingCrewRecommendation(crew.id, user.id)
          recommendedMap[crew.id] = hasRecommended
          cancelledMap[crew.id] = hasCancelled
          
          // 생성자 정보 가져오기
          try {
            const creator = await databaseService.getUserById(crew.createdBy)
            if (creator) {
              creatorNameMap[crew.id] = creator.name
            }
          } catch (error) {
            console.error(`조깅 크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
          }
        }
        setHasRecommendedMap(recommendedMap)
        setHasCancelledMap(cancelledMap)
        setCreatorMap(creatorNameMap)
      }

      // 검색 필터링
      if (searchTerm.trim()) {
        crews = crews.filter((crew) =>
          crew.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      // 정렬: 생성일 또는 추천수 기준
      crews.sort((a, b) => {
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

      setFilteredCrews(crews)
      console.log('최종 필터링된 조깅 크루:', crews.length)
    } catch (error: any) {
      console.error('조깅 크루 목록 로드 실패:', error)
      console.error('에러 상세:', error?.message, error?.code, error?.details, error?.hint)
      setFilteredCrews([])
      alert(`조깅 크루 목록을 불러오는데 실패했습니다: ${error?.message || String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const formatAlarmTime = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText =
      alarm.repeatType === 'daily'
        ? '매일'
        : alarm.repeatType === 'weekly'
          ? '매주'
          : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const handleJoin = async (crew: JoggingCrew) => {
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
      alert('조깅 크루 인원이 가득 찼습니다')
      return
    }

    if (window.confirm(`${crew.name} 조깅 크루에 참여하시겠습니까?`)) {
      try {
        const result = await databaseService.joinJoggingCrew(crew.id, user.id)
        if (result) {
          alert('조깅 크루에 참여했습니다!')
          await loadCrews()
          // 다른 탭/창에 변경사항 알림
          window.dispatchEvent(new Event('storage'))
        } else {
          alert('조깅 크루 참여에 실패했습니다.')
        }
      } catch (error: any) {
        console.error('조깅 크루 참여 실패:', error)
        const errorMessage = error instanceof Error ? error.message : '조깅 크루 참여에 실패했습니다.'
        alert(errorMessage)
      }
    }
  }

  const handleRecommend = async (crew: JoggingCrew) => {
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    try {
      console.log('🔘 조깅 크루 추천 버튼 클릭:', { crewId: crew.id, userId: user.id, crewName: crew.name })
      const result = await databaseService.toggleJoggingCrewRecommendation(crew.id, user.id)
      console.log('📊 조깅 크루 추천 처리 결과:', result)
      
      if (result.success) {
        console.log('✅ 조깅 크루 추천 처리 성공')
        setHasRecommendedMap(prev => ({ ...prev, [crew.id]: result.isRecommended }))
        if (!result.isRecommended) {
          setHasCancelledMap(prev => ({ ...prev, [crew.id]: true }))
        }
        
        // 추천수 업데이트를 위해 조깅 크루 정보만 다시 가져오기
        try {
          const updatedCrew = await databaseService.getJoggingCrewById(crew.id)
          if (updatedCrew) {
            // 해당 조깅 크루만 목록에서 업데이트
            setFilteredCrews(prev => prev.map(c => c.id === crew.id ? updatedCrew : c))
            // 추천 상태만 다시 확인
            const hasRecommended = await databaseService.hasUserRecommendedJoggingCrew(crew.id, user.id)
            setHasRecommendedMap(prev => ({ ...prev, [crew.id]: hasRecommended }))
          }
        } catch (loadError) {
          console.warn('조깅 크루 정보 새로고침 중 오류 (추천은 성공):', loadError)
          // 추천은 성공했으므로 전체 목록 새로고침 시도
          try {
            await loadCrews()
          } catch (fullLoadError) {
            console.warn('전체 목록 새로고침도 실패:', fullLoadError)
          }
        }
      } else {
        console.warn('⚠️ 조깅 크루 추천 처리 실패:', result)
        if (hasCancelledMap[crew.id]) {
          alert('이미 취소한 조깅 크루는 다시 추천할 수 없습니다.')
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
        alert('이미 추천한 조깅 크루입니다.')
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
          <h1 className="text-4xl font-bold text-white">조깅 크루 검색</h1>
          <NavigationButtons backPath="/jogging-crew" />
        </div>

        {/* 검색 바 및 정렬 */}
        <div className="mb-6 space-y-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="크루명으로 검색..."
            className="w-full px-4 py-3 bg-gray-800/90 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setSortBy('recommendations')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                sortBy === 'recommendations'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              추천수순
            </button>
            <button
              onClick={() => setSortBy('created')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                sortBy === 'created'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              최신순
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-300">조깅 크루 목록을 불러오는 중...</p>
          </div>
        ) : filteredCrews.length === 0 ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-xl text-gray-300">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCrews.map((crew) => (
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
                          <span
                            className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded"
                            title="영상 공유"
                          >
                            📹
                          </span>
                        )}
                        {crew.audioShareEnabled && (
                          <span
                            className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded"
                            title="음성 공유"
                          >
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
                        <span className="text-gray-400">운동 설정:</span>
                        <span className="text-white ml-2">
                          {crew.targetDistance ? `${crew.targetDistance}km` : ''}
                          {crew.targetDistance && crew.targetTime ? ' / ' : ''}
                          {crew.targetTime ? `${crew.targetTime}분` : ''}
                          {!crew.targetDistance && !crew.targetTime && '설정 없음'}
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
                      <div>
                        <span className="text-gray-400">추천:</span>
                        <span className="text-white ml-2 flex items-center gap-1">
                          <span className="text-yellow-400">⭐</span>
                          {crew.recommendations || 0}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm mb-2">
                      <span className="text-gray-400">생성일:</span>
                      <span className="text-white ml-2">{formatDate(crew.createdAt)}</span>
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
                      title={hasCancelledMap[crew.id] ? '이미 취소한 조깅 크루는 다시 추천할 수 없습니다' : hasRecommendedMap[crew.id] ? '추천 취소' : '추천하기'}
                    >
                      {hasRecommendedMap[crew.id] ? '⭐ 추천됨' : '⭐ 추천'}
                    </button>
                    <button
                      onClick={() => handleJoin(crew)}
                      disabled={crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers}
                      className={`flex-1 md:flex-none px-3 py-2 text-sm md:px-6 md:py-3 md:text-base rounded-lg font-semibold whitespace-nowrap transition ${
                        crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers
                        ? '인원 마감'
                        : '크루참여'}
                    </button>
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

export default JoggingCrewSearchPage

