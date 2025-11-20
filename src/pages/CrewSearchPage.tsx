import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Crew, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

// Mock 데이터 (차후 Supabase에서 가져올 데이터)
const mockCrews: Crew[] = [
  {
    id: 'search1',
    name: '아침 운동 크루',
    maxMembers: 20,
    currentMembers: 12,
    exerciseType: 'squat',
    exerciseConfig: { type: 'squat', sets: 3, reps: 10, restTime: 10 },
    alarm: { enabled: true, time: '06:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 10,
    createdBy: 'user10',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: true,
    recommendations: 15,
  },
  {
    id: 'search2',
    name: '저녁 헬스크루',
    maxMembers: null,
    currentMembers: 15,
    exerciseType: 'pushup',
    exerciseConfig: { type: 'pushup', sets: 4, reps: 15, restTime: 15 },
    alarm: { enabled: true, time: '19:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 7,
    createdBy: 'user11',
    memberIds: [],
    videoShareEnabled: false,
    audioShareEnabled: true,
    recommendations: 23,
  },
  {
    id: 'search3',
    name: '주말 런지 크루',
    maxMembers: 15,
    currentMembers: 8,
    exerciseType: 'lunge',
    exerciseConfig: { type: 'lunge', sets: 3, reps: 12, restTime: 10 },
    alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
    createdAt: Date.now() - 86400000 * 14,
    createdBy: 'user12',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: false,
    recommendations: 8,
  },
  {
    id: 'search4',
    name: '올데이 스쿼트',
    maxMembers: 30,
    currentMembers: 25,
    exerciseType: 'squat',
    exerciseConfig: { type: 'squat', sets: 5, reps: 20, restTime: 20 },
    alarm: { enabled: true, time: '08:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 20,
    createdBy: 'user13',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: true,
    recommendations: 42,
  },
  {
    id: 'search5',
    name: '푸시업 챌린지',
    maxMembers: null,
    currentMembers: 18,
    exerciseType: 'pushup',
    exerciseConfig: { type: 'pushup', sets: 3, reps: 25, restTime: 10 },
    alarm: { enabled: true, time: '07:30', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 3,
    createdBy: 'user14',
    memberIds: [],
    videoShareEnabled: false,
    audioShareEnabled: false,
    recommendations: 5,
  },
  {
    id: 'search6',
    name: '점심 운동 크루',
    maxMembers: 10,
    currentMembers: 6,
    exerciseType: 'squat',
    exerciseConfig: { type: 'squat', sets: 2, reps: 15, restTime: 5 },
    alarm: { enabled: true, time: '12:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 1,
    createdBy: 'user15',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: true,
    recommendations: 2,
  },
  {
    id: 'search7',
    name: '저녁 런지 크루',
    maxMembers: 25,
    currentMembers: 20,
    exerciseType: 'lunge',
    exerciseConfig: { type: 'lunge', sets: 4, reps: 10, restTime: 15 },
    alarm: { enabled: true, time: '20:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 5,
    createdBy: 'user16',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: false,
    recommendations: 18,
  },
  {
    id: 'search8',
    name: '주중 운동 크루',
    maxMembers: null,
    currentMembers: 22,
    exerciseType: 'pushup',
    exerciseConfig: { type: 'pushup', sets: 3, reps: 20, restTime: 12 },
    alarm: { enabled: true, time: '18:30', repeatType: 'custom' },
    createdAt: Date.now() - 86400000 * 8,
    createdBy: 'user17',
    memberIds: [],
    videoShareEnabled: false,
    audioShareEnabled: true,
    recommendations: 31,
  },
  {
    id: 'search9',
    name: '초보자 크루',
    maxMembers: 15,
    currentMembers: 9,
    exerciseType: 'squat',
    exerciseConfig: { type: 'squat', sets: 2, reps: 8, restTime: 20 },
    alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
    createdAt: Date.now() - 86400000 * 12,
    createdBy: 'user18',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: true,
    recommendations: 12,
  },
  {
    id: 'search10',
    name: '프로 운동 크루',
    maxMembers: 50,
    currentMembers: 45,
    exerciseType: 'pushup',
    exerciseConfig: { type: 'pushup', sets: 5, reps: 30, restTime: 10 },
    alarm: { enabled: true, time: '06:30', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 30,
    createdBy: 'user19',
    memberIds: [],
    videoShareEnabled: true,
    audioShareEnabled: true,
    recommendations: 67,
  },
]

const CrewSearchPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCrews, setFilteredCrews] = useState<Crew[]>([])
  const [sortBy, setSortBy] = useState<'created' | 'recommendations'>('recommendations')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCrews()
  }, [searchTerm, sortBy])

  const loadCrews = async () => {
    try {
      setLoading(true)
      // 실제 데이터베이스에서 모든 크루 가져오기
      let crews = await databaseService.getAllCrews()
      console.log('로드된 크루 수:', crews.length, crews)

      // 사용자가 이미 참여한 크루는 제외
      const user = authService.getCurrentUser()
      if (user) {
        const myCrews = await databaseService.getCrewsByUserId(user.id)
        const myCrewIds = new Set(myCrews.map((c) => c.id))
        crews = crews.filter((crew) => !myCrewIds.has(crew.id))
        console.log('참여한 크루 제외 후:', crews.length)
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
      console.log('최종 필터링된 크루:', crews.length)
    } catch (error: any) {
      console.error('크루 목록 로드 실패:', error)
      console.error('에러 상세:', error?.message, error?.code, error?.details, error?.hint)
      setFilteredCrews([])
      // 에러 메시지를 사용자에게 표시
      alert(`크루 목록을 불러오는데 실패했습니다: ${error?.message || String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const getExerciseName = (type: ExerciseType): string => {
    return EXERCISE_TYPE_NAMES[type] || '커스텀'
  }

  const formatAlarmTime = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText = alarm.repeatType === 'daily' ? '매일' : alarm.repeatType === 'weekly' ? '매주' : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const handleJoin = async (crew: Crew) => {
    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    // 멤버 제한 확인: 제한없음이면 항상 활성화, 제한있으면 확인
    if (crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers) {
      alert('크루 인원이 가득 찼습니다')
      return
    }

    if (window.confirm(`${crew.name} 크루에 참여하시겠습니까?`)) {
      try {
        // TODO: Supabase에서 크루 참여 API 호출
        // 현재는 databaseService 사용
        await databaseService.addCrewMember(crew.id, user.id, 'member')
        alert('크루에 참여했습니다!')
        // 크루 목록 다시 로드하여 참여한 크루 제거
        await loadCrews()
        // 다른 탭/창에 변경사항 알림 (localStorage 이벤트)
        window.dispatchEvent(new Event('storage'))
      } catch (error) {
        console.error('크루 참여 실패:', error)
        const errorMessage = error instanceof Error ? error.message : '크루 참여에 실패했습니다.'
        alert(errorMessage)
      }
    }
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">크루 검색</h1>
          <button
            onClick={() => navigate('/crew')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
        </div>

        {/* 검색 바 및 정렬 */}
        <div className="mb-6 space-y-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="크루명으로 검색..."
            className="w-full px-4 py-3 bg-gray-800/90 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex gap-3">
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
          </div>
        </div>

        {loading ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-300">크루 목록을 불러오는 중...</p>
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
                      <div>
                        <span className="text-gray-400">생성일:</span>
                        <span className="text-white ml-2">{formatDate(crew.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-white">{crew.recommendations || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleJoin(crew)}
                      disabled={crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers}
                      className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition ${
                        crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
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

export default CrewSearchPage

