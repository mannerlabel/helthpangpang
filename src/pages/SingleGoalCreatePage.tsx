import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { ExerciseType, ExerciseConfig, AlarmConfig, SingleGoal } from '@/types'

const SingleGoalCreatePage = () => {
  const navigate = useNavigate()
  
  const [goalName, setGoalName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('squat')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [restTime, setRestTime] = useState(10)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])

  const exercises: { value: ExerciseType; label: string }[] = [
    { value: 'squat', label: '스쿼트' },
    { value: 'pushup', label: '푸시업' },
    { value: 'lunge', label: '런지' },
  ]

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토']

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSave = () => {
    if (!goalName.trim()) {
      alert('목표명을 입력해주세요')
      return
    }

    const config: ExerciseConfig = {
      type: exerciseType,
      sets,
      reps,
      restTime,
    }

    const alarm: AlarmConfig | undefined = alarmEnabled
      ? {
          enabled: true,
          time: alarmTime,
          repeatType,
          repeatDays: repeatType === 'custom' ? repeatDays : undefined,
        }
      : undefined

    // 차후 Supabase에 저장할 데이터 구조
    const goalData: Omit<SingleGoal, 'id' | 'createdAt' | 'createdBy' | 'isActive'> = {
      name: goalName,
      exerciseType,
      exerciseConfig: config,
      alarm,
    }

    console.log('목표 생성 데이터:', goalData)
    
    // TODO: Supabase에 목표 생성 API 호출
    // 현재는 localStorage에 저장 (임시)
    const savedGoals = JSON.parse(localStorage.getItem('singleGoals') || '[]')
    const newGoal: SingleGoal = {
      ...goalData,
      id: `goal_${Date.now()}`,
      createdAt: Date.now(),
      createdBy: 'user1', // 차후 Supabase user_id로 대체
      isActive: true,
    }
    savedGoals.push(newGoal)
    localStorage.setItem('singleGoals', JSON.stringify(savedGoals))
    
    alert('목표가 생성되었습니다!')
    navigate('/single')
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">목표 생성</h1>
          <button
            onClick={() => navigate('/single')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
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

          {/* 운동 종목 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              운동 종목 *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {exercises.map((exercise) => (
                <button
                  key={exercise.value}
                  onClick={() => setExerciseType(exercise.value)}
                  className={`px-4 py-3 rounded-lg font-semibold transition ${
                    exerciseType === exercise.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {exercise.label}
                </button>
              ))}
            </div>
          </div>

          {/* 운동량 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">
              운동량 *
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">세트</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sets}
                  onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">횟수</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={reps}
                  onChange={(e) => setReps(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">쉬는 시간(초)</label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={restTime}
                  onChange={(e) => setRestTime(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 알람 설정 */}
          <div>
            <label className="flex items-center gap-2 text-white text-lg font-semibold mb-4">
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(e) => setAlarmEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <span>알람 설정</span>
            </label>
            {alarmEnabled && (
              <div className="space-y-4 pl-7">
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
                  <label className="block text-gray-300 text-sm mb-2">반복</label>
                  <div className="flex gap-3 mb-3">
                    {(['daily', 'weekly', 'custom'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setRepeatType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                          repeatType === type
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {type === 'daily' ? '매일' : type === 'weekly' ? '매주' : '사용자 정의'}
                      </button>
                    ))}
                  </div>
                  {repeatType === 'custom' && (
                    <div className="flex gap-2">
                      {dayLabels.map((label, index) => (
                        <button
                          key={index}
                          onClick={() => handleDayToggle(index)}
                          className={`w-10 h-10 rounded-lg text-sm font-semibold transition ${
                            repeatDays.includes(index)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => navigate('/single')}
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

export default SingleGoalCreatePage

