import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { JoggingGoal } from '@/types'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

const JoggingAlonePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [goals, setGoals] = useState<JoggingGoal[]>([])

  const loadGoals = async () => {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }
      
      const goals = await databaseService.getJoggingGoalsByUserId(user.id)
      setGoals(goals)
    } catch (error) {
      console.error('목표 목록 로드 실패:', error)
      setGoals([])
    }
  }

  useEffect(() => {
    loadGoals()
  }, [navigate])

  // location이 변경될 때마다 목록 다시 로드 (생성/수정 후 돌아올 때)
  useEffect(() => {
    loadGoals()
  }, [location.key])

  const formatAlarmInfo = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '알람 없음'
    const repeatText = alarm.repeatType === 'daily' ? '매일' : alarm.repeatType === 'weekly' ? '매주' : '사용자 정의'
    return `${alarm.time} (${repeatText})`
  }

  const calculateTimeUntilAlarm = (alarm?: { time: string; repeatType: string }): string => {
    if (!alarm) return '-'
    
    const now = new Date()
    const [hours, minutes] = alarm.time.split(':').map(Number)
    const alarmTime = new Date()
    alarmTime.setHours(hours, minutes, 0, 0)
    
    // 오늘 알람 시간이 지났으면 내일로 설정
    if (alarmTime <= now) {
      alarmTime.setDate(alarmTime.getDate() + 1)
    }
    
    const diff = alarmTime.getTime() - now.getTime()
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60))
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hoursLeft > 0) {
      return `${hoursLeft}시간 ${minutesLeft}분 후`
    } else {
      return `${minutesLeft}분 후`
    }
  }

  const handleStart = (goal: JoggingGoal) => {
    navigate('/jogging-config', {
      state: {
        mode: 'alone',
        goal: goal,
      },
    })
  }

  const handleDelete = async (goalId: string) => {
    if (!window.confirm('정말 이 목표를 삭제하시겠습니까?')) {
      return
    }

    try {
      await databaseService.deleteJoggingGoal(goalId)
      // 목표 목록 다시 로드
      const user = authService.getCurrentUser()
      if (user) {
        const goals = await databaseService.getJoggingGoalsByUserId(user.id)
        setGoals(goals)
      }
      alert('목표가 삭제되었습니다.')
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
          <h1 className="text-4xl font-bold text-white">조깅 혼자 모드</h1>
          <button
            onClick={() => navigate('/jogging-mode-select')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
        </div>

        {/* 목표 생성 버튼 */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/jogging-goal/create')}
            className="w-full px-6 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-semibold text-lg"
          >
            ➕ 목표 생성
          </button>
        </div>

        {/* 목표 목록 */}
        {goals.length === 0 ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🏃</div>
            <p className="text-xl text-gray-300 mb-6">등록된 목표가 없습니다</p>
            <button
              onClick={() => navigate('/jogging-goal/create')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
            >
              목표 생성하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/90 rounded-2xl p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-3">{goal.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {goal.targetDistance && (
                        <div>
                          <span className="text-gray-400">목표 거리:</span>
                          <span className="text-white ml-2">{goal.targetDistance}km</span>
                        </div>
                      )}
                      {goal.targetTime && (
                        <div>
                          <span className="text-gray-400">목표 시간:</span>
                          <span className="text-white ml-2">{goal.targetTime}분</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">알람 정보:</span>
                        <span className="text-white ml-2">{formatAlarmInfo(goal.alarm)}</span>
                      </div>
                      {goal.alarm && (
                        <div>
                          <span className="text-gray-400">조깅시작까지:</span>
                          <span className="text-green-400 ml-2 font-semibold">
                            {calculateTimeUntilAlarm(goal.alarm)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => navigate(`/jogging-goal/edit/${goal.id}`)}
                      className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition font-semibold whitespace-nowrap"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold whitespace-nowrap"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => handleStart(goal)}
                      className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold whitespace-nowrap"
                    >
                      조깅 시작
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

export default JoggingAlonePage

