import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { ExerciseType, ExerciseConfig, AlarmConfig, SingleGoal } from '@/types'
import { EXERCISE_TYPES, EXERCISE_TYPE_OPTIONS } from '@/constants/exerciseTypes'
import { audioService } from '@/services/audioService'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

const SingleGoalCreatePage = () => {
  const navigate = useNavigate()
  const { goalId } = useParams<{ goalId?: string }>()
  const isEditMode = !!goalId
  
  const [goalName, setGoalName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>(EXERCISE_TYPES.SQUAT)
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [restTime, setRestTime] = useState(10)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [backgroundMusic, setBackgroundMusic] = useState(1)
  const [previewingMusicId, setPreviewingMusicId] = useState<number | null>(null)

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (isEditMode && goalId) {
      const savedGoals = JSON.parse(localStorage.getItem('singleGoals') || '[]')
      const goal = savedGoals.find((g: SingleGoal) => g.id === goalId)
      if (goal) {
        setGoalName(goal.name)
        setExerciseType(goal.exerciseType)
        setSets(goal.exerciseConfig.sets)
        setReps(goal.exerciseConfig.reps)
        setRestTime(goal.exerciseConfig.restTime || 10)
        setBackgroundMusic(goal.backgroundMusic || 1)
        if (goal.alarm) {
          setAlarmEnabled(goal.alarm.enabled)
          setAlarmTime(goal.alarm.time)
          setRepeatType(goal.alarm.repeatType)
          setRepeatDays(goal.alarm.repeatDays || [])
        }
      }
    }

    // 컴포넌트 언마운트 시 미리듣기 정지
    return () => {
      audioService.stopPreview()
    }
  }, [isEditMode, goalId])

  const exercises = EXERCISE_TYPE_OPTIONS

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토']

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handlePreviewMusic = (musicId: number) => {
    if (previewingMusicId === musicId) {
      audioService.stopPreview()
      setPreviewingMusicId(null)
    } else {
      audioService.stopPreview()
      audioService.playBackgroundMusic(musicId, true) // preview 모드
      setPreviewingMusicId(musicId)
      // 5초 후 자동 정지
      setTimeout(() => {
        audioService.stopPreview()
        setPreviewingMusicId(null)
      }, 5000)
    }
  }

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

    const goalData: Omit<SingleGoal, 'id' | 'createdAt' | 'createdBy' | 'isActive'> = {
      name: goalName,
      exerciseType,
      exerciseConfig: config,
      alarm,
      backgroundMusic,
    }

    try {
      if (isEditMode && goalId) {
        // 수정 모드
        await databaseService.updateSingleGoal(goalId, goalData)
        alert('목표가 수정되었습니다!')
      } else {
        // 생성 모드
        await databaseService.createSingleGoal({
          ...goalData,
          createdBy: user.id,
        })
        alert('목표가 생성되었습니다!')
      }
      
      navigate('/single')
    } catch (error) {
      console.error('목표 저장 실패:', error)
      alert('목표 저장에 실패했습니다.')
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">{isEditMode ? '목표 수정' : '목표 생성'}</h1>
          <NavigationButtons backPath="/single" />
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

