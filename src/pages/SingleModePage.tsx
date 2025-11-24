import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { SingleGoal, ExerciseType } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { databaseService } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

// Mock 데이터 (차후 Supabase에서 가져올 데이터)
const mockGoals: SingleGoal[] = [
  {
    id: 'goal1',
    name: '아침 스쿼트 챌린지',
    exerciseType: 'squat',
    exerciseConfig: { type: 'squat', sets: 3, reps: 15, restTime: 10 },
    alarm: { enabled: true, time: '07:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 5,
    createdBy: 'user1',
    isActive: true,
  },
  {
    id: 'goal2',
    name: '저녁 푸시업',
    exerciseType: 'pushup',
    exerciseConfig: { type: 'pushup', sets: 4, reps: 20, restTime: 15 },
    alarm: { enabled: true, time: '19:00', repeatType: 'daily' },
    createdAt: Date.now() - 86400000 * 2,
    createdBy: 'user1',
    isActive: true,
  },
  {
    id: 'goal3',
    name: '주말 런지',
    exerciseType: 'lunge',
    exerciseConfig: { type: 'lunge', sets: 3, reps: 12, restTime: 10 },
    alarm: { enabled: true, time: '09:00', repeatType: 'weekly' },
    createdAt: Date.now() - 86400000 * 7,
    createdBy: 'user1',
    isActive: true,
  },
]

const SingleModePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [goals, setGoals] = useState<SingleGoal[]>([])
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
      
      const result = await databaseService.getSingleGoalsByUserId(user.id, PAGE_SIZE, offset)
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
      setPagination(prev => ({ ...prev, loading: false }))
      // localStorage 폴백 (초기 로드 시에만)
      if (reset) {
        const savedGoals = localStorage.getItem('singleGoals')
        if (savedGoals) {
          try {
            const parsed = JSON.parse(savedGoals)
            setGoals(parsed)
            setPagination({ offset: parsed.length, hasMore: false, loading: false })
          } catch (e) {
            console.error('목표 목록 파싱 오류:', e)
            setGoals([])
          }
        } else {
          setGoals([])
        }
      }
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

  const getExerciseName = (type: ExerciseType): string => {
    return EXERCISE_TYPE_NAMES[type] || '커스텀'
  }

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

  const handleStart = (goal: SingleGoal) => {
    navigate('/training', {
      state: {
        mode: 'single',
        config: goal.exerciseConfig,
        alarm: goal.alarm,
        goalId: goal.id,
        backgroundMusic: goal.backgroundMusic || 1, // 목표에 저장된 배경음악 사용
      },
    })
  }

  const handleDelete = async (goalId: string) => {
    if (!window.confirm('정말 이 목표를 삭제하시겠습니까?')) {
      return
    }

    try {
      await databaseService.deleteSingleGoal(goalId)
      // 목표 목록 다시 로드
      const user = authService.getCurrentUser()
      if (user) {
        const goals = await databaseService.getSingleGoalsByUserId(user.id)
        setGoals(goals)
      }
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
          <h1 className="text-4xl font-bold text-white">싱글 모드</h1>
          <NavigationButtons backPath="/mode-select" />
        </div>

        {/* 목표 생성 버튼 */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/single/goal/create')}
            className="w-full px-6 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition font-semibold text-lg"
          >
            ➕ 목표 생성
          </button>
        </div>

        {/* 목표 목록 */}
        {goals.length === 0 ? (
          <div className="bg-gray-800/90 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-xl text-gray-300 mb-6">등록된 목표가 없습니다</p>
            <button
              onClick={() => navigate('/single/goal/create')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
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
                      <div>
                        <span className="text-gray-400">운동 종목:</span>
                        <span className="text-white ml-2">{getExerciseName(goal.exerciseType)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">운동량:</span>
                        <span className="text-white ml-2">
                          {goal.exerciseConfig.sets}세트 × {goal.exerciseConfig.reps}회
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">알람 정보:</span>
                        <span className="text-white ml-2">{formatAlarmInfo(goal.alarm)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">운동시작까지:</span>
                        <span className="text-blue-400 ml-2 font-semibold">
                          {calculateTimeUntilAlarm(goal.alarm)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => navigate(`/single/goal/edit/${goal.id}`)}
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
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold whitespace-nowrap"
                    >
                      운동 시작
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

export default SingleModePage

