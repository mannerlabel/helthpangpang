import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Crew, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'

// Mock 데이터 (차후 Supabase에서 가져올 데이터)
const mockMyCrews: Crew[] = [
  {
    id: 'crew1',
    name: '헬스킹 크루',
    maxMembers: 10,
    currentMembers: 5,
    exerciseType: 'squat',
    exerciseConfig: { type: 'squat', sets: 3, reps: 15, restTime: 10 },
    alarm: { enabled: true, time: '07:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 5,
    createdBy: 'user1',
    memberIds: ['user1', 'user2', 'user3', 'user4', 'user5'],
  },
  {
    id: 'crew2',
    name: '푸시업 마스터',
    maxMembers: null,
    currentMembers: 8,
    exerciseType: 'pushup',
    exerciseConfig: { type: 'pushup', sets: 4, reps: 20, restTime: 15 },
    alarm: { enabled: true, time: '18:00', repeatType: 'weekly' },
    createdAt: Date.now() - 86400000 * 2,
    createdBy: 'user2',
    memberIds: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8'],
  },
]

const CrewListPage = () => {
  const navigate = useNavigate()
  const [myCrews, setMyCrews] = useState<Crew[]>([])

  useEffect(() => {
    // TODO: Supabase에서 나의 크루 목록 가져오기
    // 현재는 mock 데이터 사용
    setMyCrews(mockMyCrews)
  }, [])

  const getExerciseName = (type: ExerciseType): string => {
    return EXERCISE_TYPE_NAMES[type] || '커스텀'
  }

  const formatAlarmTime = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText = alarm.repeatType === 'daily' ? '매일' : alarm.repeatType === 'weekly' ? '매주' : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const handleEnter = (crew: Crew) => {
    // 크루 입장 - TrainingPage로 이동
    navigate('/training', {
      state: {
        mode: 'crew',
        config: crew.exerciseConfig,
        alarm: crew.alarm,
        crewId: crew.id,
      },
    })
  }

  const handleLeave = (crewId: string) => {
    if (window.confirm('정말 이 크루에서 탈퇴하시겠습니까?')) {
      // TODO: Supabase에서 크루 탈퇴 API 호출
      setMyCrews((prev) => prev.filter((crew) => crew.id !== crewId))
      alert('크루에서 탈퇴했습니다')
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">나의 크루 목록</h1>
          <button
            onClick={() => navigate('/crew')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
        </div>

        {myCrews.length === 0 ? (
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
            {myCrews.map((crew) => (
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
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEnter(crew)}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold whitespace-nowrap"
                    >
                      입장하기
                    </button>
                    <button
                      onClick={() => handleLeave(crew.id)}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold whitespace-nowrap"
                    >
                      탈퇴하기
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

export default CrewListPage

