import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { AlarmConfig, JoggingGoal } from '@/types'
import { audioService } from '@/services/audioService'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

const JoggingGoalCreatePage = () => {
  const navigate = useNavigate()
  const { goalId } = useParams<{ goalId?: string }>()
  const isEditMode = !!goalId
  
  const [goalName, setGoalName] = useState('')
  const [targetDistance, setTargetDistance] = useState<number | undefined>(undefined)
  const [targetTime, setTargetTime] = useState<number | undefined>(undefined)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [backgroundMusic, setBackgroundMusic] = useState(1)
  const [previewingMusicId, setPreviewingMusicId] = useState<number | null>(null)

  // 현재 시간을 기본값으로 설정
  const getCurrentTime = (): string => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    const loadGoal = async () => {
      if (isEditMode && goalId) {
        try {
          const user = authService.getCurrentUser()
          if (!user) return
          
          const goals = await databaseService.getJoggingGoalsByUserId(user.id)
          const goal = goals.find((g: JoggingGoal) => g.id === goalId)
          
          if (goal) {
            setGoalName(goal.name)
            setTargetDistance(goal.targetDistance)
            setTargetTime(goal.targetTime)
            setAlarmEnabled(!!goal.alarm)
            if (goal.alarm) {
              setAlarmTime(goal.alarm.time)
              setRepeatType(goal.alarm.repeatType)
              setRepeatDays(goal.alarm.repeatDays || [])
            }
            setBackgroundMusic(goal.backgroundMusic || 1)
          }
        } catch (error) {
          console.error('목표 로드 실패:', error)
        }
      } else {
        setAlarmTime(getCurrentTime())
      }
    }
    loadGoal()
  }, [isEditMode, goalId])

  const handlePreviewMusic = (musicId: number) => {
    audioService.playPreview(musicId)
    setPreviewingMusicId(musicId)
    setTimeout(() => {
      audioService.stopPreview()
      setPreviewingMusicId(null)
    }, 5000)
  }

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']

  const handleSave = async () => {
    if (!goalName.trim()) {
      alert('목표명을 입력해주세요')
      return
    }

    const user = authService.getCurrentUser()
    if (!user) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }

    const alarm: AlarmConfig | undefined = alarmEnabled
      ? {
          enabled: true,
          time: alarmTime,
          repeatType,
          repeatDays: repeatType === 'custom' ? repeatDays : undefined,
        }
      : undefined

    const goalData: Omit<JoggingGoal, 'id' | 'createdAt' | 'createdBy' | 'isActive'> = {
      name: goalName,
      targetDistance,
      targetTime,
      alarm,
      backgroundMusic,
    }

    try {
      if (isEditMode && goalId) {
        // 수정 모드
        await databaseService.updateJoggingGoal(goalId, goalData)
        alert('목표가 수정되었습니다!')
      } else {
        // 생성 모드
        await databaseService.createJoggingGoal({
          ...goalData,
          createdBy: user.id,
        })
        alert('목표가 생성되었습니다!')
      }
      
      navigate('/jogging-alone')
    } catch (error) {
      console.error('목표 저장 실패:', error)
      alert('목표 저장에 실패했습니다.')
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">{isEditMode ? '목표 수정' : '목표 생성'}</h1>
          <NavigationButtons backPath="/jogging-alone" />
        </div>

        <div className="bg-gray-800/90 rounded-2xl p-6 space-y-6">
          {/* 목표명 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              목표명 *
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="목표명을 입력하세요"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 목표 거리 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              목표 거리 (km)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={targetDistance || ''}
              onChange={(e) =>
                setTargetDistance(e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="목표 거리를 입력하세요 (선택사항)"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 목표 시간 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              목표 시간 (분)
            </label>
            <input
              type="number"
              min="0"
              value={targetTime || ''}
              onChange={(e) =>
                setTargetTime(e.target.value ? parseInt(e.target.value) : undefined)
              }
              placeholder="목표 시간을 입력하세요 (선택사항)"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 알람 설정 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">
              알람 설정
            </label>
            <label className="flex items-center text-white mb-4">
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(e) => setAlarmEnabled(e.target.checked)}
                className="mr-3 w-5 h-5"
              />
              알람 사용
            </label>
            {alarmEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-gray-300 text-sm mb-2">알람 시간</label>
                  <input
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-2">반복 설정</label>
                  <div className="space-y-2">
                    <label className="flex items-center text-white">
                      <input
                        type="radio"
                        name="repeatType"
                        value="daily"
                        checked={repeatType === 'daily'}
                        onChange={(e) => setRepeatType(e.target.value as 'daily')}
                        className="mr-2"
                      />
                      매일
                    </label>
                    <label className="flex items-center text-white">
                      <input
                        type="radio"
                        name="repeatType"
                        value="weekly"
                        checked={repeatType === 'weekly'}
                        onChange={(e) => setRepeatType(e.target.value as 'weekly')}
                        className="mr-2"
                      />
                      매주
                    </label>
                    <label className="flex items-center text-white">
                      <input
                        type="radio"
                        name="repeatType"
                        value="custom"
                        checked={repeatType === 'custom'}
                        onChange={(e) => setRepeatType(e.target.value as 'custom')}
                        className="mr-2"
                      />
                      요일 선택
                    </label>
                  </div>
                  {repeatType === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex gap-2 flex-wrap"
                    >
                      {daysOfWeek.map((day, index) => (
                        <button
                          key={index}
                          onClick={() => handleDayToggle(index)}
                          className={`px-4 py-2 rounded-lg transition ${
                            repeatDays.includes(index)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* 배경 사운드 설정 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">
              배경 사운드
            </label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((musicId) => (
                <div key={musicId} className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      setBackgroundMusic(musicId)
                      handlePreviewMusic(musicId)
                    }}
                    className={`w-full px-4 py-3 rounded-lg font-semibold transition ${
                      backgroundMusic === musicId
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    BGM {musicId}
                  </button>
                  {previewingMusicId === musicId && (
                    <div className="mt-2 text-xs text-blue-400">재생 중...</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => navigate('/jogging-alone')}
              className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
            >
              저장하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JoggingGoalCreatePage

