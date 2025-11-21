import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { databaseService, JoggingCrew } from '@/services/databaseService'
import { authService } from '@/services/authService'

const JoggingCrewListPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [myCrews, setMyCrews] = useState<JoggingCrew[]>([])

  useEffect(() => {
    loadMyCrews()
  }, [])

  // location이 변경될 때마다 목록 다시 로드 (생성/수정 후 돌아올 때)
  useEffect(() => {
    loadMyCrews()
  }, [location.key])

  const loadMyCrews = async () => {
    const user = authService.getCurrentUser()
    if (!user) return

    try {
      const crews = await databaseService.getJoggingCrewsByUserId(user.id)
      setMyCrews(crews)
    } catch (error) {
      console.error('조깅 크루 목록 로드 실패:', error)
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

  const handleEnter = (crew: JoggingCrew) => {
    navigate('/jogging', {
      state: {
        config: {
          mode: 'together',
          targetDistance: crew.targetDistance,
          targetTime: crew.targetTime,
          alarm: crew.alarm,
          togetherConfig: {
            videoShare: crew.videoShareEnabled,
            audioShare: crew.audioShareEnabled,
          },
        },
        crewId: crew.id,
      },
    })
  }

  const handleLeave = async (crewId: string) => {
    const user = authService.getCurrentUser()
    if (!user) return

    if (window.confirm('정말 이 조깅 크루에서 탈퇴하시겠습니까?')) {
      try {
        await databaseService.leaveJoggingCrew(crewId, user.id)
        await loadMyCrews()
        alert('조깅 크루에서 탈퇴했습니다')
      } catch (error) {
        alert('조깅 크루 탈퇴에 실패했습니다.')
      }
    }
  }

  const handleEdit = (crew: JoggingCrew) => {
    navigate(`/jogging-crew/edit/${crew.id}`, { state: { crew } })
  }

  const handleDelete = async (crew: JoggingCrew) => {
    const user = authService.getCurrentUser()
    if (!user) return

    // 크루장인지 확인
    if (crew.createdBy !== user.id) {
      alert('크루장만 크루를 삭제할 수 있습니다.')
      return
    }

    if (window.confirm('정말 이 조깅 크루를 삭제하시겠습니까? 크루와 관련된 모든 데이터가 삭제됩니다.')) {
      try {
        await databaseService.deleteJoggingCrew(crew.id)
        await loadMyCrews()
        alert('조깅 크루가 삭제되었습니다.')
      } catch (error) {
        console.error('조깅 크루 삭제 실패:', error)
        alert('조깅 크루 삭제에 실패했습니다.')
      }
    }
  }

  const isOwner = (crew: JoggingCrew): boolean => {
    const user = authService.getCurrentUser()
    return user ? crew.createdBy === user.id : false
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">나의 조깅 크루 목록</h1>
          <button
            onClick={() => navigate('/jogging-crew')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
        </div>

        {myCrews.length === 0 ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-xl text-gray-300 mb-6">참여 중인 조깅 크루가 없습니다</p>
            <button
              onClick={() => navigate('/jogging-crew/create')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
            >
              조깅 크루 생성하기
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEnter(crew)}
                      className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold whitespace-nowrap"
                    >
                      입장하기
                    </button>
                    {isOwner(crew) && (
                      <>
                        <button
                          onClick={() => handleEdit(crew)}
                          className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition font-semibold whitespace-nowrap"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(crew)}
                          className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold whitespace-nowrap"
                        >
                          삭제
                        </button>
                      </>
                    )}
                    {!isOwner(crew) && (
                      <button
                        onClick={() => handleLeave(crew.id)}
                        className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold whitespace-nowrap"
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

export default JoggingCrewListPage

