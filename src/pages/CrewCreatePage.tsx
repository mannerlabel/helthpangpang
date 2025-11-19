import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { ExerciseType, ExerciseConfig, AlarmConfig } from '@/types'
import { EXERCISE_TYPES, EXERCISE_TYPE_OPTIONS } from '@/constants/exerciseTypes'

const CrewCreatePage = () => {
  const navigate = useNavigate()
  
  const [crewName, setCrewName] = useState('')
  const [maxMembers, setMaxMembers] = useState<number | null>(null)
  const [hasMemberLimit, setHasMemberLimit] = useState(false)
  const [memberLimit, setMemberLimit] = useState(10)
  const [exerciseType, setExerciseType] = useState<ExerciseType>(EXERCISE_TYPES.SQUAT)
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [restTime, setRestTime] = useState(10)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])

  const exercises = EXERCISE_TYPE_OPTIONS

  const handleSubmit = () => {
    if (!crewName.trim()) {
      alert('크루명을 입력해주세요')
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
    const crewData = {
      name: crewName,
      maxMembers: hasMemberLimit ? (maxMembers || memberLimit) : null,
      exerciseType,
      exerciseConfig: config,
      alarm,
    }

    console.log('크루 생성 데이터:', crewData)
    
    // TODO: Supabase에 크루 생성 API 호출
    // 현재는 mock 데이터로 처리
    alert('크루가 생성되었습니다! (현재는 mock 데이터입니다)')
    navigate('/crew/my-crews')
  }

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">크루 생성</h1>
          <button
            onClick={() => navigate('/crew')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
        </div>

        <div className="bg-gray-800/90 rounded-2xl p-6 space-y-6">
          {/* 크루명 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              크루명 *
            </label>
            <input
              type="text"
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
              placeholder="크루명을 입력하세요"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* 멤버 수 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              멤버 수
            </label>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-white">
                <input
                  type="checkbox"
                  checked={!hasMemberLimit}
                  onChange={(e) => setHasMemberLimit(!e.target.checked)}
                  className="w-4 h-4"
                />
                <span>제한없음</span>
              </label>
              <label className="flex items-center gap-2 text-white">
                <input
                  type="checkbox"
                  checked={hasMemberLimit}
                  onChange={(e) => setHasMemberLimit(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>제한있음</span>
              </label>
            </div>
            {hasMemberLimit && (
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={memberLimit}
                  onChange={(e) => setMemberLimit(parseInt(e.target.value) || 10)}
                  className="w-32 px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-white">명</span>
              </div>
            )}
          </div>

          {/* 종목 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">
              종목 *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {exercises.map((exercise) => (
                <button
                  key={exercise.value}
                  onClick={() => setExerciseType(exercise.value)}
                  className={`px-4 py-3 rounded-lg font-semibold transition ${
                    exerciseType === exercise.value
                      ? 'bg-purple-500 text-white'
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
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                            ? 'bg-purple-500 text-white'
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
                              ? 'bg-purple-500 text-white'
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

          {/* 생성 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => navigate('/crew')}
              className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
            >
              크루 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrewCreatePage

