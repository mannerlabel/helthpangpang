import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { AlarmConfig } from '@/types'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'

const JoggingCrewCreatePage = () => {
  const navigate = useNavigate()

  const [crewName, setCrewName] = useState('')
  const [maxMembers, setMaxMembers] = useState<number | null>(null)
  const [hasMemberLimit, setHasMemberLimit] = useState(false)
  const [memberLimit, setMemberLimit] = useState(10)
  const [targetDistance, setTargetDistance] = useState<number | undefined>(undefined)
  const [targetTime, setTargetTime] = useState<number | undefined>(undefined)
  const [videoShareEnabled, setVideoShareEnabled] = useState(true)
  const [audioShareEnabled, setAudioShareEnabled] = useState(true)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState('09:00')
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])

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

    const alarm: AlarmConfig | undefined = alarmEnabled
      ? {
          enabled: true,
          time: alarmTime,
          repeatType,
          repeatDays: repeatType === 'custom' ? repeatDays : undefined,
        }
      : undefined

    try {
      await databaseService.createJoggingCrew({
        name: crewName,
        maxMembers: hasMemberLimit ? (maxMembers || memberLimit) : null,
        targetDistance,
        targetTime,
        alarm,
        createdBy: user.id,
        videoShareEnabled,
        audioShareEnabled,
      })

      alert('조깅 크루가 생성되었습니다!')
      navigate('/jogging-crew/my-crews')
    } catch (error) {
      alert('조깅 크루 생성에 실패했습니다.')
      console.error(error)
    }
  }

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">조깅 크루 생성</h1>
          <button
            onClick={() => navigate('/jogging-crew')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로
          </button>
        </div>

        <div className="bg-gray-800/90 rounded-2xl p-6 space-y-6">
          {/* 크루명 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">크루명 *</label>
            <input
              type="text"
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
              placeholder="크루명을 입력하세요"
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 멤버 수 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-2">멤버 수</label>
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
                  className="w-32 px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-white">명</span>
              </div>
            )}
          </div>

          {/* 운동 설정 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">운동 설정</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">목표 거리 (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={targetDistance || ''}
                  onChange={(e) =>
                    setTargetDistance(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="선택사항"
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">목표 시간 (분)</label>
                <input
                  type="number"
                  min="0"
                  value={targetTime || ''}
                  onChange={(e) =>
                    setTargetTime(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="선택사항"
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* 함께 모드 설정 */}
          <div>
            <label className="block text-white text-lg font-semibold mb-4">함께 모드 설정</label>
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
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                            ? 'bg-green-500 text-white'
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
                              ? 'bg-green-500 text-white'
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
              onClick={() => navigate('/jogging-crew')}
              className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
            >
              크루 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JoggingCrewCreatePage

