import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Crew, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

const CrewListPage = () => {
  const navigate = useNavigate()
  const [myCrews, setMyCrews] = useState<Crew[]>([])
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)

  useEffect(() => {
    loadMyCrews()
    
    // storage 이벤트 리스너 추가 (다른 탭/창에서 변경사항 감지)
    const handleStorageChange = () => {
      loadMyCrews()
    }
    window.addEventListener('storage', handleStorageChange)
    
    // 주기적으로 목록 새로고침 (다른 PC에서의 변경사항 감지)
    const interval = setInterval(loadMyCrews, 3000) // 3초마다
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const loadMyCrews = async () => {
    const user = authService.getCurrentUser()
    if (!user) return

    try {
      console.log('사용자 ID:', user.id)
      const crews = await databaseService.getCrewsByUserId(user.id)
      console.log('로드된 내 크루:', crews)
      setMyCrews(crews)
    } catch (error: any) {
      console.error('크루 목록 로드 실패:', error)
      console.error('에러 상세:', error?.message, error?.code, error?.details, error?.hint)
      alert(`크루 목록을 불러오는데 실패했습니다: ${error?.message || String(error)}`)
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

