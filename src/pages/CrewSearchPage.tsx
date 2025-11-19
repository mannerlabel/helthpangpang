import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Crew, ExerciseType } from '@/types'

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
  },
]

const CrewSearchPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCrews, setFilteredCrews] = useState<Crew[]>(mockCrews)

  useEffect(() => {
    // TODO: Supabase에서 크루 검색 API 호출
    // 현재는 mock 데이터 필터링
    if (searchTerm.trim()) {
      setFilteredCrews(
        mockCrews.filter((crew) =>
          crew.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    } else {
      setFilteredCrews(mockCrews)
    }
  }, [searchTerm])

  const getExerciseName = (type: ExerciseType): string => {
    const names: Record<ExerciseType, string> = {
      squat: '스쿼트',
      pushup: '푸시업',
      lunge: '런지',
      custom: '커스텀',
    }
    return names[type] || type
  }

  const formatAlarmTime = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText = alarm.repeatType === 'daily' ? '매일' : alarm.repeatType === 'weekly' ? '매주' : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const handleJoin = (crew: Crew) => {
    if (crew.maxMembers && crew.currentMembers >= crew.maxMembers) {
      alert('크루 인원이 가득 찼습니다')
      return
    }

    if (window.confirm(`${crew.name} 크루에 참여하시겠습니까?`)) {
      // TODO: Supabase에서 크루 참여 API 호출
      alert('크루에 참여했습니다!')
      navigate('/crew/my-crews')
    }
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

        {/* 검색 바 */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="크루명으로 검색..."
            className="w-full px-4 py-3 bg-gray-800/90 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {filteredCrews.length === 0 ? (
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
                    <h3 className="text-2xl font-bold text-white mb-2">{crew.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

