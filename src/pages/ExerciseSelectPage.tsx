import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppMode, ExerciseType, ExerciseConfig, AlarmConfig } from '@/types'
import { EXERCISE_TYPES, EXERCISE_TYPE_DETAILS } from '@/constants/exerciseTypes'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'

const ExerciseSelectPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = (searchParams.get('mode') || 'single') as AppMode

  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>(EXERCISE_TYPES.SQUAT)
  const [sets, setSets] = useState(2)
  const [reps, setReps] = useState(6)
  const [restTime, setRestTime] = useState(10) // 쉬는 시간 (초, 기본값 10초)
  const [customName, setCustomName] = useState('')
  
  // 알람 설정 (싱글/크루 모드에만)
  const getCurrentTime = (): string => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }
  
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState(getCurrentTime())
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  
  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']
  
  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const exercises = EXERCISE_TYPE_DETAILS

  const handleStart = () => {
    if (mode === 'jogging') {
      navigate('/jogging-mode-select')
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

    const config: ExerciseConfig = {
      type: selectedExercise,
      sets,
      reps,
      restTime, // 쉬는 시간 추가
      customName: selectedExercise === EXERCISE_TYPES.CUSTOM ? customName : undefined,
    }

    navigate('/training', {
      state: { mode, config, alarm },
    })
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            {mode === 'single' && '싱글 모드'}
            {mode === 'crew' && '크루 모드'}
            {mode === 'jogging' && '조깅 모드'}
          </h1>
          <NavigationButtons backPath="/mode-select" />
        </div>

        {/* 종목 선택 */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">종목 선택</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {exercises.map((exercise) => (
              <motion.button
                key={exercise.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedExercise(exercise.id)}
                className={`p-6 rounded-xl ${
                  selectedExercise === exercise.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } transition-all`}
              >
                <div className="text-4xl mb-2">{exercise.icon}</div>
                <div className="font-semibold">{exercise.name}</div>
              </motion.button>
            ))}
          </div>

          {selectedExercise === EXERCISE_TYPES.CUSTOM && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="종목 이름을 입력하세요"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </motion.div>
          )}

          {/* 선택된 종목의 인식 기준 설명 */}
          {selectedExercise !== EXERCISE_TYPES.CUSTOM && exercises.find(e => e.id === selectedExercise)?.recognitionGuide && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-gray-700 rounded-xl"
            >
              <h3 className="text-lg font-bold text-white mb-2">
                {exercises.find(e => e.id === selectedExercise)?.name} 인식 기준
              </h3>
              <p className="text-gray-300 text-sm whitespace-pre-line">
                {exercises.find(e => e.id === selectedExercise)?.recognitionGuide}
              </p>
            </motion.div>
          )}
        </div>

        {/* 운동량 설정 */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">운동량 설정</h2>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-white mb-2">세트</label>
              <input
                type="number"
                min="1"
                max="10"
                value={sets}
                onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-white mb-2">갯수</label>
              <input
                type="number"
                min="1"
                max="100"
                value={reps}
                onChange={(e) => setReps(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-white mb-2">쉬는 시간 (초)</label>
            <input
              type="number"
              min="0"
              max="120"
              value={restTime}
              onChange={(e) => setRestTime(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="mt-4 text-gray-400">
            설정: {sets}세트 × {reps}개 = {sets * reps}개 (쉬는 시간: {restTime}초)
          </div>
        </div>

        {/* 알람 설정 (싱글/크루 모드에만) */}
        {(mode === 'single' || mode === 'crew') && (
          <div className="bg-gray-800 rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">알람 설정</h2>
            <div className="space-y-4">
              <label className="flex items-center text-white">
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
                    <label className="block text-white mb-2">알람 시간</label>
                    <input
                      type="time"
                      value={alarmTime}
                      onChange={(e) => setAlarmTime(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">반복 설정</label>
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
                                ? 'bg-primary-500 text-white'
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
          </div>
        )}

        {/* 시작 버튼 */}
        <div className="flex gap-4">
          <button
            onClick={handleStart}
            disabled={selectedExercise === EXERCISE_TYPES.CUSTOM && !customName}
            className="flex-1 px-6 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            운동 시작
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExerciseSelectPage

