import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { joggingService } from '@/services/joggingService'
import { JoggingData, JoggingConfig, WeatherInfo } from '@/types'

const JoggingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { config, weather } = (location.state as {
    config?: JoggingConfig
    weather?: WeatherInfo[]
  }) || {}
  
  const [isTracking, setIsTracking] = useState(false)
  const [joggingData, setJoggingData] = useState<JoggingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isTracking) {
      const interval = setInterval(() => {
        const data = joggingService.getCurrentData()
        if (data) {
          setJoggingData(data)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isTracking])

  const handleStart = async () => {
    try {
      setError(null)
      const data = await joggingService.startTracking()
      setJoggingData(data)
      setIsTracking(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '조깅 추적을 시작할 수 없습니다.')
    }
  }

  const handleStop = () => {
    const data = joggingService.stopTracking()
    if (data) {
      setJoggingData(data)
    }
    setIsTracking(false)
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          조깅 모드 🏃 {config?.mode === 'together' && '(함께)'}
        </h1>
        
        {/* 날씨 정보 표시 */}
        {weather && weather.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">날씨 정보</h2>
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
                    {w.pm10 !== undefined && (
                      <div>미세먼지: PM10 {w.pm10}㎍/㎥</div>
                    )}
                    {w.pm25 !== undefined && (
                      <div>초미세먼지: PM2.5 {w.pm25}㎍/㎥</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        
        {/* 목표 정보 표시 */}
        {config && (config.targetDistance || config.targetTime) && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">목표</h2>
            <div className="grid grid-cols-2 gap-4">
              {config.targetDistance && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {config.targetDistance} km
                  </div>
                  <div className="text-gray-400">목표 거리</div>
                </div>
              )}
              {config.targetTime && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {config.targetTime} 분
                  </div>
                  <div className="text-gray-400">목표 시간</div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500 text-white p-4 rounded-xl mb-6">{error}</div>
        )}

        {!isTracking && !joggingData && (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-white mb-6">
              위치 추적을 시작하여 조깅 경로, 속도, 시간, 거리를 자동으로 기록합니다.
            </p>
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition text-lg font-bold"
            >
              조깅 시작
            </button>
          </div>
        )}

        {joggingData && (
          <div className="space-y-6">
            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-800 rounded-xl p-6 text-center"
              >
                <div className="text-3xl font-bold text-green-400">
                  {joggingData.distance.toFixed(2)} km
                </div>
                <div className="text-gray-400 mt-2">거리</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800 rounded-xl p-6 text-center"
              >
                <div className="text-3xl font-bold text-blue-400">
                  {joggingData.averageSpeed.toFixed(2)} km/h
                </div>
                <div className="text-gray-400 mt-2">평균 속도</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-800 rounded-xl p-6 text-center"
              >
                <div className="text-3xl font-bold text-yellow-400">
                  {formatTime(joggingData.averageTime)}
                </div>
                <div className="text-gray-400 mt-2">시간</div>
              </motion.div>
            </div>

            {/* 경로 정보 */}
            {joggingData.route.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">경로 정보</h3>
                <p className="text-gray-300">
                  기록된 위치 포인트: {joggingData.route.length}개
                </p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-4">
              {isTracking ? (
                <button
                  onClick={handleStop}
                  className="flex-1 px-6 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition"
                >
                  조깅 종료
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStart}
                    className="flex-1 px-6 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition"
                  >
                    다시 시작
                  </button>
                  <button
                    onClick={() => navigate('/mode-select')}
                    className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
                  >
                    나가기
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default JoggingPage

