import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { ExerciseType, ExerciseConfig, AlarmConfig, Crew } from '@/types'
import { EXERCISE_TYPES, EXERCISE_TYPE_OPTIONS } from '@/constants/exerciseTypes'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { rankService, USER_RANKS } from '@/services/rankService'
import Toast, { ToastMessage } from '@/components/Toast'

const CrewCreatePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const crew = (location.state as { crew?: Crew })?.crew
  const isEditMode = !!crew
  
  const [crewName, setCrewName] = useState('')
  const [maxMembers, setMaxMembers] = useState<number | null>(null)
  const [hasMemberLimit, setHasMemberLimit] = useState(true) // 기본적으로 제한있음
  const [memberLimit, setMemberLimit] = useState(5) // 기본 5명 제한
  const [exerciseType, setExerciseType] = useState<ExerciseType>(EXERCISE_TYPES.SQUAT)
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [restTime, setRestTime] = useState(10)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [videoShareEnabled, setVideoShareEnabled] = useState(true)
  const [audioShareEnabled, setAudioShareEnabled] = useState(true)
  const [userRank, setUserRank] = useState(1)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const exercises = EXERCISE_TYPE_OPTIONS

  // 사용자 계급 로드 및 인원수 제한 설정
  useEffect(() => {
    const loadUserRank = async () => {
      const user = authService.getCurrentUser()
      if (user) {
        const rank = await rankService.getUserRank(user.id)
        setUserRank(rank)
        // 계급에 따른 최대 인원수 설정 (5단계부터 자동 증가)
        const maxMembers = rankService.getMaxMembersByRank(rank, false)
        setMemberLimit(maxMembers)
      }
    }
    loadUserRank()
  }, [])

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (isEditMode && crew) {
      setCrewName(crew.name)
      setMaxMembers(crew.maxMembers)
      setHasMemberLimit(crew.maxMembers !== null)
      setMemberLimit(crew.maxMembers || 10)
      setExerciseType(crew.exerciseType)
      setSets(crew.exerciseConfig.sets)
      setReps(crew.exerciseConfig.reps)
      setRestTime(crew.exerciseConfig.restTime)
      setAlarmEnabled(!!crew.alarm)
      if (crew.alarm) {
        setAlarmTime(crew.alarm.time)
        setRepeatType(crew.alarm.repeatType)
        setRepeatDays(crew.alarm.repeatDays || [])
      }
      setVideoShareEnabled(crew.videoShareEnabled || false)
      setAudioShareEnabled(crew.audioShareEnabled || false)
    }
  }, [isEditMode, crew])

  const handleSubmit = async () => {
    if (!crewName.trim()) {
      alert('크루명을 입력해주세요')
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

    try {
      if (isEditMode && crew) {
        // 수정 모드
        await databaseService.updateCrew(crew.id, {
          name: crewName,
          maxMembers: hasMemberLimit ? (maxMembers || memberLimit) : memberLimit,
          exerciseType,
          exerciseConfig: {
            type: config.type,
            sets: config.sets,
            reps: config.reps,
            restTime: config.restTime || 10,
          },
          alarm,
          videoShareEnabled,
          audioShareEnabled,
        })
        alert('크루가 수정되었습니다!')
      } else {
        // 생성 모드
        const newCrew = await databaseService.createCrew({
          name: crewName,
          maxMembers: hasMemberLimit ? (maxMembers || memberLimit) : memberLimit,
          exerciseType,
          exerciseConfig: {
            type: config.type,
            sets: config.sets,
            reps: config.reps,
            restTime: config.restTime || 10,
          },
          alarm,
          createdBy: user.id,
          videoShareEnabled,
          audioShareEnabled,
        })
        
        // 크루 계급 초기화 (1단계)
        await rankService.setCrewRank(newCrew.id, 1, false)
        
        // 사용자 계급 업데이트 및 승급 확인
        const rankResult = await rankService.updateUserRank(user.id)
        if (rankResult.promoted && rankResult.previousRank) {
          const rankInfo = USER_RANKS.find(r => r.level === rankResult.newRank)
          if (rankInfo) {
            setToast({
              message: `축하드립니다. ${rankResult.newRank}단계로 승급하셨습니다. 더욱 화이팅 해주세요`,
              type: 'success',
              duration: 5000
            })
            // 토스트 메시지 표시 후 페이지 이동
            setTimeout(() => {
              navigate('/crew/my-crews')
            }, 2000)
            return
          }
        }
        
        alert('크루가 생성되었습니다!')
      }
      navigate('/crew/my-crews')
    } catch (error) {
      alert(isEditMode ? '크루 수정에 실패했습니다.' : '크루 생성에 실패했습니다.')
      console.error(error)
    }
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
          <h1 className="text-4xl font-bold text-white">{isEditMode ? '크루 수정' : '크루 생성'}</h1>
          <NavigationButtons backPath="/crew/my-crews" />
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
            {/* 제한없음 버튼 주석처리 - 우선 출력하지 않음 */}
            {/* <div className="flex items-center gap-4 mb-3">
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
            </div> */}
            {/* 기본적으로 제한있음으로 설정, 계급에 따라 자동으로 제한 설정 */}
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="2"
                max={rankService.getMaxMembersByRank(userRank, false)}
                value={memberLimit}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 5
                  const maxValue = rankService.getMaxMembersByRank(userRank, false)
                  setMemberLimit(Math.min(value, maxValue))
                }}
                className="w-32 px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-white">명</span>
              <span className="text-gray-400 text-sm">
                (최대 {rankService.getMaxMembersByRank(userRank, false)}명, 현재 {userRank}단계)
              </span>
            </div>
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

          {/* 함께 모드 설정 (영상/음성 공유) */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">
              함께 모드 설정
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-white">
                <input
                  type="checkbox"
                  checked={videoShareEnabled}
                  onChange={(e) => setVideoShareEnabled(e.target.checked)}
                  className="w-5 h-5"
                />
                <span>영상 공유</span>
              </label>
              <label className="flex items-center gap-3 text-white">
                <input
                  type="checkbox"
                  checked={audioShareEnabled}
                  onChange={(e) => setAudioShareEnabled(e.target.checked)}
                  className="w-5 h-5"
                />
                <span>음성 공유</span>
              </label>
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

          {/* 생성/수정 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => navigate('/crew/my-crews')}
              className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
            >
              {isEditMode ? '크루 수정' : '크루 생성'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 토스트 메시지 */}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default CrewCreatePage

