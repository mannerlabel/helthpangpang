import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { databaseService, JoggingCrew } from '@/services/databaseService'
import { authService } from '@/services/authService'

// Mock 데이터 (차후 Supabase에서 가져올 데이터)
const mockJoggingCrews: JoggingCrew[] = [
  {
    id: 'jcrew1',
    name: '아침 조깅 크루',
    maxMembers: 20,
    currentMembers: 12,
    targetDistance: 5,
    targetTime: 30,
    alarm: { enabled: true, time: '06:00', repeatType: 'daily' },
    videoShareEnabled: true,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 10,
    createdBy: 'user10',
    memberIds: [],
  },
  {
    id: 'jcrew2',
    name: '저녁 러닝 크루',
    maxMembers: null,
    currentMembers: 15,
    targetDistance: 10,
    alarm: { enabled: true, time: '19:00', repeatType: 'daily' },
    videoShareEnabled: false,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 7,
    createdBy: 'user11',
    memberIds: [],
  },
  {
    id: 'jcrew3',
    name: '주말 마라톤 크루',
    maxMembers: 15,
    currentMembers: 8,
    targetDistance: 21,
    targetTime: 120,
    alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
    videoShareEnabled: true,
    audioShareEnabled: false,
    createdAt: Date.now() - 86400000 * 14,
    createdBy: 'user12',
    memberIds: [],
  },
  {
    id: 'jcrew4',
    name: '올데이 조깅',
    maxMembers: 30,
    currentMembers: 25,
    targetTime: 60,
    alarm: { enabled: true, time: '08:00', repeatType: 'daily' },
    videoShareEnabled: true,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 20,
    createdBy: 'user13',
    memberIds: [],
  },
  {
    id: 'jcrew5',
    name: '초보자 조깅 크루',
    maxMembers: null,
    currentMembers: 18,
    targetDistance: 3,
    targetTime: 20,
    alarm: { enabled: true, time: '07:30', repeatType: 'daily' },
    videoShareEnabled: false,
    audioShareEnabled: false,
    createdAt: Date.now() - 86400000 * 3,
    createdBy: 'user14',
    memberIds: [],
  },
  {
    id: 'jcrew6',
    name: '점심 조깅 크루',
    maxMembers: 10,
    currentMembers: 6,
    targetDistance: 5,
    alarm: { enabled: true, time: '12:00', repeatType: 'daily' },
    videoShareEnabled: true,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 1,
    createdBy: 'user15',
    memberIds: [],
  },
  {
    id: 'jcrew7',
    name: '저녁 러닝 크루',
    maxMembers: 25,
    currentMembers: 20,
    targetDistance: 8,
    targetTime: 45,
    alarm: { enabled: true, time: '20:00', repeatType: 'daily' },
    videoShareEnabled: true,
    audioShareEnabled: false,
    createdAt: Date.now() - 86400000 * 5,
    createdBy: 'user16',
    memberIds: [],
  },
  {
    id: 'jcrew8',
    name: '주중 조깅 크루',
    maxMembers: null,
    currentMembers: 22,
    targetTime: 40,
    alarm: { enabled: true, time: '18:30', repeatType: 'custom' },
    videoShareEnabled: false,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 8,
    createdBy: 'user17',
    memberIds: [],
  },
  {
    id: 'jcrew9',
    name: '프로 러너 크루',
    maxMembers: 15,
    currentMembers: 9,
    targetDistance: 15,
    targetTime: 90,
    alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
    videoShareEnabled: true,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 12,
    createdBy: 'user18',
    memberIds: [],
  },
  {
    id: 'jcrew10',
    name: '올데이 마라톤 크루',
    maxMembers: 50,
    currentMembers: 45,
    targetDistance: 42,
    targetTime: 240,
    alarm: { enabled: true, time: '06:30', repeatType: 'daily' },
    videoShareEnabled: true,
    audioShareEnabled: true,
    createdAt: Date.now() - 86400000 * 30,
    createdBy: 'user19',
    memberIds: [],
  },
]

const JoggingCrewSearchPage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCrews, setFilteredCrews] = useState<JoggingCrew[]>(mockJoggingCrews)

  useEffect(() => {
    if (searchTerm.trim()) {
      setFilteredCrews(
        mockJoggingCrews.filter((crew) =>
          crew.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    } else {
      setFilteredCrews(mockJoggingCrews)
    }
  }, [searchTerm])

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
        await databaseService.joinJoggingCrew(crew.id, user.id)
        alert('조깅 크루에 참여했습니다!')
        navigate('/jogging-crew/my-crews')
      } catch (error) {
        alert('조깅 크루 참여에 실패했습니다.')
      }
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">조깅 크루 검색</h1>
          <button
            onClick={() => navigate('/jogging-crew')}
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
            className="w-full px-4 py-3 bg-gray-800/90 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleJoin(crew)}
                      disabled={crew.maxMembers !== null && crew.currentMembers >= crew.maxMembers}
                      className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition ${
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

