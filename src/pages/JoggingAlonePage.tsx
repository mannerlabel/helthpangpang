import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { JoggingGoal, JoggingConfig, WeatherInfo } from '@/types'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { getWeatherInfo } from '@/services/weatherService'

const JoggingAlonePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [goals, setGoals] = useState<JoggingGoal[]>([])
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const PAGE_SIZE = 20

  const loadGoals = async (reset: boolean = false) => {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }
      
      const offset = reset ? 0 : pagination.offset
      if (reset) {
        setPagination({ offset: 0, hasMore: true, loading: true })
        setGoals([])
      } else {
        setPagination(prev => ({ ...prev, loading: true }))
      }
      
      const result = await databaseService.getJoggingGoalsByUserId(user.id, PAGE_SIZE, offset)
      if (reset) {
        setGoals(result.data)
      } else {
        setGoals(prev => [...prev, ...result.data])
      }
      
      setPagination({ 
        offset: offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
    } catch (error) {
      console.error('목표 목록 로드 실패:', error)
      setGoals([])
    }
  }

  useEffect(() => {
    loadGoals(true)
  }, [navigate])

  // location이 변경될 때마다 목록 다시 로드 (생성/수정 후 돌아올 때)
  useEffect(() => {
    loadGoals(true)
  }, [location.key])

  // 더 불러오기 (무한 스크롤)
  const loadMoreGoals = async () => {
    if (pagination.loading || !pagination.hasMore) return
    await loadGoals(false)
  }

  // 무한 스크롤 훅
  const { elementRef } = useInfiniteScroll({
    hasMore: pagination.hasMore,
    loading: pagination.loading,
    onLoadMore: loadMoreGoals,
  })

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

  const handleStart = async (goal: JoggingGoal) => {
    // 실시간 날씨 정보 가져오기
    let weatherData: WeatherInfo[] = []
    try {
      const { weather } = await getWeatherInfo()
      weatherData = weather
    } catch (error) {
      console.error('날씨 정보 가져오기 실패:', error)
      // 기본값 사용
      weatherData = [
        {
          date: '오늘',
          temperature: 22,
          humidity: 65,
          uvIndex: 5,
          condition: '맑음',
          pm10: 45,
          pm25: 25,
        },
        {
          date: '내일',
          temperature: 24,
          humidity: 70,
          uvIndex: 6,
          condition: '구름조금',
          pm10: 50,
          pm25: 28,
        },
        {
          date: '모레',
          temperature: 20,
          humidity: 60,
          uvIndex: 4,
          condition: '맑음',
          pm10: 40,
          pm25: 22,
        },
      ]
    }

    const config: JoggingConfig = {
      mode: 'alone',
      targetDistance: goal.targetDistance,
      targetTime: goal.targetTime,
      alarm: goal.alarm,
    }

    // 조깅 페이지로 바로 이동
    navigate('/jogging', {
      state: {
        config,
        weather: weatherData,
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
      await loadGoals(true)
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
          <h1 className="text-4xl font-bold text-white">나의 조깅목표</h1>
          <NavigationButtons backPath="/jogging-mode-select" />
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
            
            {/* 무한 스크롤 트리거 */}
            {pagination.hasMore && (
              <div ref={elementRef} className="py-4 text-center">
                {pagination.loading && (
                  <div className="text-gray-400">로딩 중...</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default JoggingAlonePage

