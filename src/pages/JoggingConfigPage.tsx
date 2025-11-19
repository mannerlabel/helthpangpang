import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { JoggingMode, JoggingConfig, AlarmConfig, JoggingTogetherConfig, WeatherInfo } from '@/types'

const JoggingConfigPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = (location.state as { mode: JoggingMode })?.mode || 'alone'

  // 현재 시간을 기본값으로 설정 (HH:mm 형식)
  const getCurrentTime = (): string => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const [targetDistance, setTargetDistance] = useState<number | undefined>(undefined)
  const [targetTime, setTargetTime] = useState<number | undefined>(undefined)
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTime, setAlarmTime] = useState(getCurrentTime())
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [videoShare, setVideoShare] = useState(false)
  const [audioShare, setAudioShare] = useState(false)
  const [weather, setWeather] = useState<WeatherInfo[]>([])

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']

  // 날씨 정보 가져오기 (모킹 데이터)
  useEffect(() => {
    // 실제로는 날씨 API를 호출해야 하지만, 여기서는 모킹 데이터 사용
    const mockWeather: WeatherInfo[] = [
      {
        date: '오늘',
        temperature: 22,
        humidity: 65,
        uvIndex: 5,
        condition: '맑음',
      },
      {
        date: '내일',
        temperature: 24,
        humidity: 70,
        uvIndex: 6,
        condition: '구름조금',
      },
      {
        date: '모레',
        temperature: 20,
        humidity: 60,
        uvIndex: 4,
        condition: '맑음',
      },
    ]
    setWeather(mockWeather)
  }, [])

  const handleDayToggle = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleStart = () => {
    const alarm: AlarmConfig | undefined = alarmEnabled
      ? {
          enabled: true,
          time: alarmTime,
          repeatType,
          repeatDays: repeatType === 'custom' ? repeatDays : undefined,
        }
      : undefined

    const togetherConfig: JoggingTogetherConfig | undefined =
      mode === 'together'
        ? {
            videoShare,
            audioShare,
          }
        : undefined

    const config: JoggingConfig = {
      mode,
      targetDistance,
      targetTime,
      alarm,
      togetherConfig,
    }

    navigate('/jogging', { state: { config, weather } })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">조깅 설정</h1>
          <button
            onClick={() => navigate('/jogging-mode-select')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로가기
          </button>
        </div>

        <div className="space-y-6">
          {/* 운동 설정 */}
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">운동 설정</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-white mb-2">목표 거리 (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={targetDistance || ''}
                  onChange={(e) =>
                    setTargetDistance(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="목표 거리를 입력하세요"
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-white mb-2">목표 시간 (분)</label>
                <input
                  type="number"
                  min="0"
                  value={targetTime || ''}
                  onChange={(e) =>
                    setTargetTime(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="목표 시간을 입력하세요"
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* 함께 모드 설정 */}
          {mode === 'together' && (
            <div className="bg-gray-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">함께 모드 설정</h2>
              <div className="space-y-4">
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={videoShare}
                    onChange={(e) => setVideoShare(e.target.checked)}
                    className="mr-3 w-5 h-5"
                  />
                  영상 공유
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={audioShare}
                    onChange={(e) => setAudioShare(e.target.checked)}
                    className="mr-3 w-5 h-5"
                  />
                  음성 공유
                </label>
              </div>
            </div>
          )}

          {/* 알람 설정 */}
          <div className="bg-gray-800 rounded-2xl p-6">
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
                        className="mt-4 flex gap-2"
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

          {/* 날씨 정보 */}
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">날씨 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {weather.map((w, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-700 rounded-xl p-4"
                >
                  <div className="text-lg font-bold text-white mb-2">{w.date}</div>
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {w.temperature}℃
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>습도: {w.humidity}%</div>
                    <div>자외선: {w.uvIndex}</div>
                    <div>날씨: {w.condition}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 시작 버튼 */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/jogging-mode-select')}
              className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
            >
              뒤로가기
            </button>
            <button
              onClick={handleStart}
              className="flex-1 px-6 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition"
            >
              조깅 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JoggingConfigPage

