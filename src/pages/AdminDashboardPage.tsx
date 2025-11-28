import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { authService } from '@/services/authService'
import { adminService, DashboardStats, Announcement, ApiKey } from '@/services/adminService'
import { loginHistoryService, LoginHistory } from '@/services/loginHistoryService'
import { databaseService, User, Crew, JoggingCrew, ExerciseVideo } from '@/services/databaseService'
import { rankService } from '@/services/rankService'
import { SingleGoal, JoggingGoal } from '@/types'
import { EXERCISE_TYPE_NAMES } from '@/constants/exerciseTypes'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import RankBadge from '@/components/RankBadge'
import ExerciseVideoRegistration from '@/components/ExerciseVideoRegistration'

// 꺽은선 그래프 컴포넌트
interface LineChartProps {
  data: Array<{ date?: string; week?: string; month?: string; count: number }>
  maxValue: number
  selectedPeriod: 'daily' | 'weekly' | 'monthly'
  formatDate: (dateStr: string) => string
}

const LineChart = ({ data, maxValue, selectedPeriod, formatDate }: LineChartProps) => {
  const width = 800
  const height = 200
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  if (data.length === 0) return null

  // 좌표 계산
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1 || 1)) * chartWidth + padding.left
    const y = chartHeight - (item.count / (maxValue || 1)) * chartHeight + padding.top
    return { x, y, ...item }
  })

  // 경로 생성
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  // 영역 경로 (그래프 아래 영역)
  const areaPath = `${pathData} L ${points[points.length - 1].x} ${chartHeight + padding.top} L ${points[0].x} ${chartHeight + padding.top} Z`

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* 그리드 라인 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartHeight - ratio * chartHeight + padding.top
          const value = Math.round(ratio * maxValue)
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#374151"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                fill="#9CA3AF"
                fontSize="10"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          )
        })}

        {/* 영역 채우기 */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
          opacity="0.3"
        />

        {/* 선 그리기 */}
        <path
          d={pathData}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 점 표시 */}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#3B82F6"
              stroke="#1E40AF"
              strokeWidth="2"
            />
            {/* 호버 시 툴팁 */}
            <title>
              {formatDate(point.date || point.week || point.month || '')}: {point.count}회
            </title>
          </g>
        ))}

        {/* X축 라벨 */}
        {points.map((point, index) => {
          if (index % Math.ceil(data.length / 8) !== 0 && index !== data.length - 1) return null
          return (
            <text
              key={index}
              x={point.x}
              y={height - 10}
              fill="#9CA3AF"
              fontSize="10"
              textAnchor="middle"
            >
              {formatDate(point.date || point.week || point.month || '')}
            </text>
          )
        })}

        {/* 그라디언트 정의 */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

const AdminDashboardPage = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [deletedUsers, setDeletedUsers] = useState<User[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [joggingCrews, setJoggingCrews] = useState<JoggingCrew[]>([])
  const [singleGoals, setSingleGoals] = useState<SingleGoal[]>([])
  const [joggingGoals, setJoggingGoals] = useState<JoggingGoal[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'deleted'>('users')
  const [activeCrewTab, setActiveCrewTab] = useState<'crew' | 'jogging'>('crew')
  const [activeGoalTab, setActiveGoalTab] = useState<'single' | 'jogging'>('single')
  
  // 사용자 관리 상태
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userSortBy, setUserSortBy] = useState<'name' | 'email' | 'createdAt'>('createdAt')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  
  // 크루 관리 상태
  const [crewSearchTerm, setCrewSearchTerm] = useState('')
  const [crewSortBy, setCrewSortBy] = useState<'name' | 'createdAt' | 'members'>('createdAt')
  const [selectedCrews, setSelectedCrews] = useState<Set<string>>(new Set())
  const [selectedJoggingCrews, setSelectedJoggingCrews] = useState<Set<string>>(new Set())
  
  // 목표 관리 상태
  const [goalSearchTerm, setGoalSearchTerm] = useState('')
  const [goalSortBy, setGoalSortBy] = useState<'name' | 'createdAt'>('createdAt')
  const [selectedSingleGoals, setSelectedSingleGoals] = useState<Set<string>>(new Set())
  const [selectedJoggingGoals, setSelectedJoggingGoals] = useState<Set<string>>(new Set())
  
  // 공지사항 관리 상태
  const [announcementSearchTerm, setAnnouncementSearchTerm] = useState('')
  const [announcementSortBy, setAnnouncementSortBy] = useState<'title' | 'createdAt' | 'priority'>('createdAt')
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<Set<string>>(new Set())
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    isActive: true,
  })
  const [announcementStats, setAnnouncementStats] = useState<{
    total: number
    active: number
    readCounts: Record<string, number>
  }>({ total: 0, active: 0, readCounts: {} })
  
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({})
  const [creatorRanks, setCreatorRanks] = useState<Record<string, number>>({}) // 생성자 계급
  const [crewRanks, setCrewRanks] = useState<Record<string, number>>({}) // 크루 계급
  const [userRanks, setUserRanks] = useState<Record<string, number>>({}) // 사용자 계급
  const [goalCreatorMap, setGoalCreatorMap] = useState<Record<string, string>>({})
  const [goalCreatorRanks, setGoalCreatorRanks] = useState<Record<string, number>>({}) // 목표 생성자 계급
  const [announcementCreatorMap, setAnnouncementCreatorMap] = useState<Record<string, string>>({})
  
  // API Key 관리 상태
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null)
  const [apiKeyForm, setApiKeyForm] = useState({
    keyType: 'llm' as 'llm' | 'weather',
    apiKey: '',
    description: '',
    isActive: true,
  })
  
  // 운동 영상 관리 상태
  const [exerciseVideos, setExerciseVideos] = useState<ExerciseVideo[]>([])
  const [showVideoRegistration, setShowVideoRegistration] = useState(false)
  const [editingVideo, setEditingVideo] = useState<ExerciseVideo | null>(null)
  const [videoPagination, setVideoPagination] = useState({ offset: 0, hasMore: true, loading: false })
  
  // 페이지네이션 상태
  const [userPagination, setUserPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [crewPagination, setCrewPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [joggingCrewPagination, setJoggingCrewPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [singleGoalPagination, setSingleGoalPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [joggingGoalPagination, setJoggingGoalPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [announcementPagination, setAnnouncementPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [loginHistoryPagination, setLoginHistoryPagination] = useState({ offset: 0, hasMore: true, loading: false })
  
  const PAGE_SIZE = 20

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user || !adminService.isAdmin(user)) {
      alert('관리자 권한이 필요합니다.')
      navigate('/login')
      return
    }

    // 초기 로드 시 통계만 먼저 로드 (빠른 초기 로딩)
    loadStats(true)
    // 초기 로드 시 selectedUser를 null로 설정하여 전체 히스토리 표시
    setSelectedUser(null)
    // 초기 로드 시 각 섹션의 첫 페이지 로드
    loadUsers()
    loadCrews()
    loadGoals()
    loadAnnouncements()
    loadLoginHistory()
    loadExerciseVideos()
  }, [navigate])

  // 통계만 로드 (초기 로드 최적화 및 reload)
  const loadStats = async (isInitialLoad: boolean = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true)
      }
      const dashboardStats = await adminService.getDashboardStats()
      setStats(dashboardStats)
    } catch (error) {
      console.error('통계 로드 실패:', error)
      if (isInitialLoad) {
        alert('통계를 불러오는데 실패했습니다.')
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      }
    }
  }

  // 사용자 목록만 reload (초기화)
  const loadUsers = async () => {
    try {
      setUserPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      const [usersResult, allDeletedUsers] = await Promise.all([
        adminService.getAllUsers(PAGE_SIZE, 0),
        adminService.getDeletedUsers(),
      ])
      const filteredUsers = usersResult.data.filter(u => !u.isDeleted)
      setUsers(filteredUsers)
      setDeletedUsers(allDeletedUsers)
      
      // 사용자 계급 가져오기
      const userRankMap: Record<string, number> = {}
      for (const user of filteredUsers) {
        try {
          const rank = await rankService.getUserRank(user.id)
          userRankMap[user.id] = rank
        } catch (error) {
          console.error(`사용자 ${user.id}의 계급 가져오기 실패:`, error)
          userRankMap[user.id] = 1
        }
      }
      setUserRanks(userRankMap)
      
      setUserPagination({ offset: PAGE_SIZE, hasMore: usersResult.hasMore, loading: false })
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error)
      setUserPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 사용자 목록 더 불러오기 (무한 스크롤)
  const loadMoreUsers = async () => {
    if (userPagination.loading || !userPagination.hasMore) return
    
    try {
      setUserPagination(prev => ({ ...prev, loading: true }))
      const result = await adminService.getAllUsers(PAGE_SIZE, userPagination.offset)
      setUsers(prev => [...prev, ...result.data.filter(u => !u.isDeleted)])
      setUserPagination({ 
        offset: userPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
    } catch (error) {
      console.error('사용자 목록 추가 로드 실패:', error)
      setUserPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 크루 목록만 reload (초기화)
  const loadCrews = async () => {
    try {
      setCrewPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      setJoggingCrewPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      const [crewsResult, joggingCrewsResult] = await Promise.all([
        adminService.getAllCrewsForAdmin(PAGE_SIZE, 0),
        adminService.getAllJoggingCrewsForAdmin(PAGE_SIZE, 0),
      ])
      setCrews(crewsResult.data)
      setJoggingCrews(joggingCrewsResult.data)
      
      // 생성자 정보 가져오기
      const creatorMap: Record<string, string> = {}
      for (const crew of [...crewsResult.data, ...joggingCrewsResult.data]) {
        try {
          const creator = await databaseService.getUserById(crew.createdBy)
          if (creator) {
            creatorMap[crew.id] = creator.name
          }
        } catch (error) {
          console.error(`크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setCreatorMap(creatorMap)
      setCrewPagination({ offset: PAGE_SIZE, hasMore: crewsResult.hasMore, loading: false })
      setJoggingCrewPagination({ offset: PAGE_SIZE, hasMore: joggingCrewsResult.hasMore, loading: false })
    } catch (error) {
      console.error('크루 목록 로드 실패:', error)
      setCrewPagination(prev => ({ ...prev, loading: false }))
      setJoggingCrewPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 크루 목록 더 불러오기 (무한 스크롤)
  const loadMoreCrews = async () => {
    if (crewPagination.loading || !crewPagination.hasMore) return
    
    try {
      setCrewPagination(prev => ({ ...prev, loading: true }))
      const result = await adminService.getAllCrewsForAdmin(PAGE_SIZE, crewPagination.offset)
      setCrews(prev => [...prev, ...result.data])
      setCrewPagination({ 
        offset: crewPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
      
      // 생성자 정보 가져오기
      const creatorMap: Record<string, string> = {}
      for (const crew of result.data) {
        try {
          const creator = await databaseService.getUserById(crew.createdBy)
          if (creator) {
            creatorMap[crew.id] = creator.name
          }
        } catch (error) {
          console.error(`크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setCreatorMap(prev => ({ ...prev, ...creatorMap }))
    } catch (error) {
      console.error('크루 목록 추가 로드 실패:', error)
      setCrewPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 조깅 크루 목록 더 불러오기 (무한 스크롤)
  const loadMoreJoggingCrews = async () => {
    if (joggingCrewPagination.loading || !joggingCrewPagination.hasMore) return
    
    try {
      setJoggingCrewPagination(prev => ({ ...prev, loading: true }))
      const result = await adminService.getAllJoggingCrewsForAdmin(PAGE_SIZE, joggingCrewPagination.offset)
      setJoggingCrews(prev => [...prev, ...result.data])
      setJoggingCrewPagination({ 
        offset: joggingCrewPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
      
      // 생성자 정보 가져오기
      const creatorMap: Record<string, string> = {}
      for (const crew of result.data) {
        try {
          const creator = await databaseService.getUserById(crew.createdBy)
          if (creator) {
            creatorMap[crew.id] = creator.name
          }
        } catch (error) {
          console.error(`조깅 크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setCreatorMap(prev => ({ ...prev, ...creatorMap }))
    } catch (error) {
      console.error('조깅 크루 목록 추가 로드 실패:', error)
      setJoggingCrewPagination(prev => ({ ...prev, loading: false }))
    }
  }


  // 로그인 히스토리만 reload (초기화)
  const loadLoginHistory = async (userId: string | null | undefined = undefined) => {
    try {
      setLoginHistoryPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      // userId가 명시적으로 전달된 경우 (null 포함) 그 값을 사용
      // undefined인 경우에만 selectedUser 상태를 사용
      const targetUserId = userId !== undefined ? userId : selectedUser
      if (targetUserId) {
        const result = await loginHistoryService.getUserLoginHistory(targetUserId, PAGE_SIZE, 0)
        setLoginHistory(result.data)
        setLoginHistoryPagination({ offset: PAGE_SIZE, hasMore: result.hasMore, loading: false })
      } else {
        const result = await loginHistoryService.getAllLoginHistory(PAGE_SIZE, 0)
        setLoginHistory(result.data)
        setLoginHistoryPagination({ offset: PAGE_SIZE, hasMore: result.hasMore, loading: false })
      }
    } catch (error) {
      console.error('로그인 히스토리 로드 실패:', error)
      setLoginHistoryPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 로그인 히스토리 더 불러오기 (무한 스크롤)
  const loadMoreLoginHistory = async () => {
    if (loginHistoryPagination.loading || !loginHistoryPagination.hasMore) return
    
    try {
      setLoginHistoryPagination(prev => ({ ...prev, loading: true }))
      const targetUserId = selectedUser
      if (targetUserId) {
        const result = await loginHistoryService.getUserLoginHistory(targetUserId, PAGE_SIZE, loginHistoryPagination.offset)
        setLoginHistory(prev => [...prev, ...result.data])
        setLoginHistoryPagination({ 
          offset: loginHistoryPagination.offset + PAGE_SIZE, 
          hasMore: result.hasMore, 
          loading: false 
        })
      } else {
        const result = await loginHistoryService.getAllLoginHistory(PAGE_SIZE, loginHistoryPagination.offset)
        setLoginHistory(prev => [...prev, ...result.data])
        setLoginHistoryPagination({ 
          offset: loginHistoryPagination.offset + PAGE_SIZE, 
          hasMore: result.hasMore, 
          loading: false 
        })
      }
    } catch (error) {
      console.error('로그인 히스토리 추가 로드 실패:', error)
      setLoginHistoryPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 목표 목록만 reload (초기화)
  const loadGoals = async () => {
    try {
      setSingleGoalPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      setJoggingGoalPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      const [singleGoalsResult, joggingGoalsResult] = await Promise.all([
        adminService.getAllSingleGoalsForAdmin(PAGE_SIZE, 0),
        adminService.getAllJoggingGoalsForAdmin(PAGE_SIZE, 0),
      ])
      setSingleGoals(singleGoalsResult.data)
      setJoggingGoals(joggingGoalsResult.data)
      
      // 목표 생성자 정보 가져오기 및 계급 확인
      const goalCreatorMap: Record<string, string> = {}
      const goalCreatorRankMap: Record<string, number> = {}
      for (const goal of [...singleGoalsResult.data, ...joggingGoalsResult.data]) {
        try {
          const creator = await databaseService.getUserById(goal.createdBy)
          if (creator) {
            goalCreatorMap[goal.id] = creator.name
            // 생성자 계급 가져오기
            const creatorRank = await rankService.getUserRank(goal.createdBy)
            goalCreatorRankMap[goal.id] = creatorRank
          }
        } catch (error) {
          console.error(`목표 ${goal.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setGoalCreatorMap(goalCreatorMap)
      setGoalCreatorRanks(goalCreatorRankMap)
      setSingleGoalPagination({ offset: PAGE_SIZE, hasMore: singleGoalsResult.hasMore, loading: false })
      setJoggingGoalPagination({ offset: PAGE_SIZE, hasMore: joggingGoalsResult.hasMore, loading: false })
    } catch (error) {
      console.error('목표 목록 로드 실패:', error)
      setSingleGoalPagination(prev => ({ ...prev, loading: false }))
      setJoggingGoalPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 싱글 목표 목록 더 불러오기 (무한 스크롤)
  const loadMoreSingleGoals = async () => {
    if (singleGoalPagination.loading || !singleGoalPagination.hasMore) return
    
    try {
      setSingleGoalPagination(prev => ({ ...prev, loading: true }))
      const result = await adminService.getAllSingleGoalsForAdmin(PAGE_SIZE, singleGoalPagination.offset)
      setSingleGoals(prev => [...prev, ...result.data])
      setSingleGoalPagination({ 
        offset: singleGoalPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
      
      // 생성자 정보 가져오기 및 계급 확인
      const goalCreatorMap: Record<string, string> = {}
      const goalCreatorRankMap: Record<string, number> = {}
      for (const goal of result.data) {
        try {
          const creator = await databaseService.getUserById(goal.createdBy)
          if (creator) {
            goalCreatorMap[goal.id] = creator.name
            // 생성자 계급 가져오기
            const creatorRank = await rankService.getUserRank(goal.createdBy)
            goalCreatorRankMap[goal.id] = creatorRank
          }
        } catch (error) {
          console.error(`목표 ${goal.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setGoalCreatorMap(prev => ({ ...prev, ...goalCreatorMap }))
      setGoalCreatorRanks(prev => ({ ...prev, ...goalCreatorRankMap }))
    } catch (error) {
      console.error('싱글 목표 목록 추가 로드 실패:', error)
      setSingleGoalPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 조깅 목표 목록 더 불러오기 (무한 스크롤)
  const loadMoreJoggingGoals = async () => {
    if (joggingGoalPagination.loading || !joggingGoalPagination.hasMore) return
    
    try {
      setJoggingGoalPagination(prev => ({ ...prev, loading: true }))
      const result = await adminService.getAllJoggingGoalsForAdmin(PAGE_SIZE, joggingGoalPagination.offset)
      setJoggingGoals(prev => [...prev, ...result.data])
      setJoggingGoalPagination({ 
        offset: joggingGoalPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
      
      // 생성자 정보 가져오기 및 계급 확인
      const goalCreatorMap: Record<string, string> = {}
      const goalCreatorRankMap: Record<string, number> = {}
      for (const goal of result.data) {
        try {
          const creator = await databaseService.getUserById(goal.createdBy)
          if (creator) {
            goalCreatorMap[goal.id] = creator.name
            // 생성자 계급 가져오기
            const creatorRank = await rankService.getUserRank(goal.createdBy)
            goalCreatorRankMap[goal.id] = creatorRank
          }
        } catch (error) {
          console.error(`목표 ${goal.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setGoalCreatorMap(prev => ({ ...prev, ...goalCreatorMap }))
      setGoalCreatorRanks(prev => ({ ...prev, ...goalCreatorRankMap }))
    } catch (error) {
      console.error('조깅 목표 목록 추가 로드 실패:', error)
      setJoggingGoalPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 공지사항 목록만 reload (초기화)
  const loadAnnouncements = async () => {
    try {
      setAnnouncementPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      const [announcementsResult, announcementStatsData] = await Promise.all([
        adminService.getAllAnnouncements(PAGE_SIZE, 0),
        adminService.getAnnouncementStats(),
      ])
      setAnnouncements(announcementsResult.data)
      setAnnouncementStats(announcementStatsData)
      
      // 공지사항 생성자 정보 가져오기
      const announcementCreatorMap: Record<string, string> = {}
      for (const announcement of announcementsResult.data) {
        try {
          const creator = await databaseService.getUserById(announcement.createdBy)
          if (creator) {
            announcementCreatorMap[announcement.id] = creator.name
          }
        } catch (error) {
          console.error(`공지사항 ${announcement.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setAnnouncementCreatorMap(announcementCreatorMap)
      setAnnouncementPagination({ offset: PAGE_SIZE, hasMore: announcementsResult.hasMore, loading: false })
    } catch (error) {
      console.error('공지사항 목록 로드 실패:', error)
      setAnnouncementPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 공지사항 목록 더 불러오기 (무한 스크롤)
  const loadMoreAnnouncements = async () => {
    if (announcementPagination.loading || !announcementPagination.hasMore) return
    
    try {
      setAnnouncementPagination(prev => ({ ...prev, loading: true }))
      const result = await adminService.getAllAnnouncements(PAGE_SIZE, announcementPagination.offset)
      setAnnouncements(prev => [...prev, ...result.data])
      setAnnouncementPagination({ 
        offset: announcementPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
      
      // 생성자 정보 가져오기
      const announcementCreatorMap: Record<string, string> = {}
      for (const announcement of result.data) {
        try {
          const creator = await databaseService.getUserById(announcement.createdBy)
          if (creator) {
            announcementCreatorMap[announcement.id] = creator.name
          }
        } catch (error) {
          console.error(`공지사항 ${announcement.id}의 생성자 정보 가져오기 실패:`, error)
        }
      }
      setAnnouncementCreatorMap(prev => ({ ...prev, ...announcementCreatorMap }))
    } catch (error) {
      console.error('공지사항 목록 추가 로드 실패:', error)
      setAnnouncementPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 운동 영상 목록 로드
  const loadExerciseVideos = async () => {
    try {
      setVideoPagination(prev => ({ ...prev, loading: true, offset: 0 }))
      const result = await databaseService.getExerciseVideos(PAGE_SIZE, 0)
      setExerciseVideos(result.data)
      setVideoPagination({ offset: PAGE_SIZE, hasMore: result.hasMore, loading: false })
    } catch (error) {
      console.error('운동 영상 목록 로드 실패:', error)
      setVideoPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 운동 영상 목록 더 불러오기
  const loadMoreExerciseVideos = async () => {
    if (videoPagination.loading || !videoPagination.hasMore) return
    
    try {
      setVideoPagination(prev => ({ ...prev, loading: true }))
      const result = await databaseService.getExerciseVideos(PAGE_SIZE, videoPagination.offset)
      setExerciseVideos(prev => [...prev, ...result.data])
      setVideoPagination({ 
        offset: videoPagination.offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
    } catch (error) {
      console.error('운동 영상 목록 추가 로드 실패:', error)
      setVideoPagination(prev => ({ ...prev, loading: false }))
    }
  }

  // 운동 영상 등록 완료
  const handleVideoRegistrationComplete = async (videoData: {
    title: string
    description?: string
    poseData: ExerciseVideo['poseData']
    totalPoses: number
    durationSeconds: number
  }) => {
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }

      await databaseService.createExerciseVideo({
        ...videoData,
        createdBy: user.id,
        isActive: true,
      })

      alert(`${videoData.title} 항목을 등록했습니다.`)
      setShowVideoRegistration(false)
      loadExerciseVideos()
    } catch (error) {
      console.error('운동 영상 등록 실패:', error)
      alert('운동 영상 등록에 실패했습니다.')
    }
  }

  // 운동 영상 수정
  const handleVideoUpdate = async (id: string, updates: Partial<ExerciseVideo>) => {
    try {
      await databaseService.updateExerciseVideo(id, updates)
      alert('운동 영상이 수정되었습니다.')
      setEditingVideo(null)
      loadExerciseVideos()
    } catch (error) {
      console.error('운동 영상 수정 실패:', error)
      alert('운동 영상 수정에 실패했습니다.')
    }
  }

  // 운동 영상 삭제
  const handleVideoDelete = async (id: string) => {
    if (!confirm('정말 이 운동 영상을 삭제하시겠습니까?')) return

    try {
      await databaseService.deleteExerciseVideo(id)
      alert('운동 영상이 삭제되었습니다.')
      loadExerciseVideos()
    } catch (error) {
      console.error('운동 영상 삭제 실패:', error)
      alert('운동 영상 삭제에 실패했습니다.')
    }
  }

  // 무한 스크롤 훅 (모든 함수 정의 이후에 배치)
  const { elementRef: userScrollRef } = useInfiniteScroll({
    hasMore: userPagination.hasMore && activeTab === 'users',
    loading: userPagination.loading,
    onLoadMore: loadMoreUsers,
  })
  
  const { elementRef: crewScrollRef } = useInfiniteScroll({
    hasMore: crewPagination.hasMore && activeCrewTab === 'crew',
    loading: crewPagination.loading,
    onLoadMore: loadMoreCrews,
  })
  
  const { elementRef: joggingCrewScrollRef } = useInfiniteScroll({
    hasMore: joggingCrewPagination.hasMore && activeCrewTab === 'jogging',
    loading: joggingCrewPagination.loading,
    onLoadMore: loadMoreJoggingCrews,
  })
  
  const { elementRef: singleGoalScrollRef } = useInfiniteScroll({
    hasMore: singleGoalPagination.hasMore && activeGoalTab === 'single',
    loading: singleGoalPagination.loading,
    onLoadMore: loadMoreSingleGoals,
  })
  
  const { elementRef: joggingGoalScrollRef } = useInfiniteScroll({
    hasMore: joggingGoalPagination.hasMore && activeGoalTab === 'jogging',
    loading: joggingGoalPagination.loading,
    onLoadMore: loadMoreJoggingGoals,
  })
  
  const { elementRef: announcementScrollRef } = useInfiniteScroll({
    hasMore: announcementPagination.hasMore,
    loading: announcementPagination.loading,
    onLoadMore: loadMoreAnnouncements,
  })

  const { elementRef: loginHistoryScrollRef } = useInfiniteScroll({
    hasMore: loginHistoryPagination.hasMore,
    loading: loginHistoryPagination.loading,
    onLoadMore: loadMoreLoginHistory,
  })

  // 목표 체크박스 토글
  const toggleGoalSelection = (goalId: string) => {
    if (activeGoalTab === 'single') {
      setSelectedSingleGoals(prev => {
        const newSet = new Set(prev)
        if (newSet.has(goalId)) {
          newSet.delete(goalId)
        } else {
          newSet.add(goalId)
        }
        return newSet
      })
    } else {
      setSelectedJoggingGoals(prev => {
        const newSet = new Set(prev)
        if (newSet.has(goalId)) {
          newSet.delete(goalId)
        } else {
          newSet.add(goalId)
        }
        return newSet
      })
    }
  }

  // 모든 목표 선택/해제
  const toggleAllGoals = () => {
    const currentGoals = getFilteredAndSortedGoals()
    if (activeGoalTab === 'single') {
      if (selectedSingleGoals.size === currentGoals.length) {
        setSelectedSingleGoals(new Set())
      } else {
        setSelectedSingleGoals(new Set(currentGoals.map(g => g.id)))
      }
    } else {
      if (selectedJoggingGoals.size === currentGoals.length) {
        setSelectedJoggingGoals(new Set())
      } else {
        setSelectedJoggingGoals(new Set(currentGoals.map(g => g.id)))
      }
    }
  }

  // 선택된 목표 삭제
  const handleDeleteSelectedGoals = async () => {
    if (activeGoalTab === 'single') {
      if (selectedSingleGoals.size === 0) {
        alert('삭제할 목표를 선택해주세요.')
        return
      }

      if (!confirm(`선택한 ${selectedSingleGoals.size}개의 싱글 목표를 삭제하시겠습니까?`)) return

      const result = await adminService.deleteSingleGoals(Array.from(selectedSingleGoals))
      if (result.success) {
        alert(`${result.deleted}개의 싱글 목표가 삭제되었습니다.`)
        setSelectedSingleGoals(new Set())
        await loadGoals()
      } else {
        alert(`목표 삭제 실패: ${result.error}`)
      }
    } else {
      if (selectedJoggingGoals.size === 0) {
        alert('삭제할 목표를 선택해주세요.')
        return
      }

      if (!confirm(`선택한 ${selectedJoggingGoals.size}개의 조깅 목표를 삭제하시겠습니까?`)) return

      const result = await adminService.deleteJoggingGoals(Array.from(selectedJoggingGoals))
      if (result.success) {
        alert(`${result.deleted}개의 조깅 목표가 삭제되었습니다.`)
        setSelectedJoggingGoals(new Set())
        await loadGoals()
      } else {
        alert(`목표 삭제 실패: ${result.error}`)
      }
    }
  }

  // 필터링 및 정렬된 목표 목록
  const getFilteredAndSortedGoals = () => {
    const currentGoals = activeGoalTab === 'single' ? singleGoals : joggingGoals
    let filtered = [...currentGoals]

    // 검색 필터링
    if (goalSearchTerm.trim()) {
      filtered = filtered.filter(goal =>
        goal.name.toLowerCase().includes(goalSearchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (goalSortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else {
        return b.createdAt - a.createdAt
      }
    })

    return filtered
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('정말 이 사용자를 완전히 삭제하시겠습니까?\n관련된 모든 데이터(크루, 채팅 메시지 등)가 삭제됩니다.')) return

    const result = await adminService.permanentlyDeleteUser(userId)
    if (result.success) {
      alert('사용자가 완전히 삭제되었습니다.')
      await loadUsers()
      await loadCrews() // 사용자 삭제 시 생성한 크루도 삭제되므로 크루 목록도 reload
      await loadStats() // 통계도 업데이트
    } else {
      alert(`사용자 삭제 실패: ${result.error}`)
    }
  }

  const handleRestoreUser = async (userId: string) => {
    if (!confirm('이 사용자의 탈퇴를 취소하시겠습니까?')) return

    const result = await adminService.restoreUser(userId)
    if (result.success) {
      alert('탈퇴가 취소되었습니다.')
      await loadUsers()
      await loadStats() // 통계도 업데이트
    } else {
      alert(`탈퇴 취소 실패: ${result.error}`)
    }
  }

  const handlePermanentlyDeleteUser = async (userId: string) => {
    if (!confirm('정말 이 사용자를 완전히 삭제하시겠습니까?\n관련된 모든 데이터(크루, 채팅 메시지 등)가 삭제되며 복구할 수 없습니다.')) return

    if (!confirm('최종 확인: 정말로 삭제하시겠습니까?')) return

    const result = await adminService.permanentlyDeleteUser(userId)
    if (result.success) {
      alert('사용자가 완전히 삭제되었습니다.')
      await loadUsers()
      await loadCrews() // 사용자 삭제 시 생성한 크루도 삭제되므로 크루 목록도 reload
      await loadStats() // 통계도 업데이트
    } else {
      alert(`사용자 삭제 실패: ${result.error}`)
    }
  }

  // 사용자 체크박스 토글
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  // 모든 사용자 선택/해제
  const toggleAllUsers = () => {
    const currentUsers = getFilteredAndSortedUsers()
    if (selectedUsers.size === currentUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(currentUsers.map(u => u.id)))
    }
  }

  // 선택된 사용자 삭제
  const handleDeleteSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      alert('삭제할 사용자를 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedUsers.size}명의 사용자를 삭제하시겠습니까?\n관련된 모든 데이터가 삭제됩니다.`)) return

    const result = await adminService.deleteUsers(Array.from(selectedUsers))
    if (result.success) {
      alert(`${result.deleted}명의 사용자가 삭제되었습니다.`)
      setSelectedUsers(new Set())
      await loadUsers()
      await loadCrews() // 사용자 삭제 시 생성한 크루도 삭제되므로 크루 목록도 reload
      await loadStats() // 통계도 업데이트
    } else {
      alert(`사용자 삭제 실패: ${result.error}`)
    }
  }

  // 크루 체크박스 토글
  const toggleCrewSelection = (crewId: string) => {
    if (activeCrewTab === 'crew') {
      setSelectedCrews(prev => {
        const newSet = new Set(prev)
        if (newSet.has(crewId)) {
          newSet.delete(crewId)
        } else {
          newSet.add(crewId)
        }
        return newSet
      })
    } else {
      setSelectedJoggingCrews(prev => {
        const newSet = new Set(prev)
        if (newSet.has(crewId)) {
          newSet.delete(crewId)
        } else {
          newSet.add(crewId)
        }
        return newSet
      })
    }
  }

  // 모든 크루 선택/해제
  const toggleAllCrews = () => {
    const currentCrews = getFilteredAndSortedCrews()
    if (activeCrewTab === 'crew') {
      if (selectedCrews.size === currentCrews.length) {
        setSelectedCrews(new Set())
      } else {
        setSelectedCrews(new Set(currentCrews.map(c => c.id)))
      }
    } else {
      if (selectedJoggingCrews.size === currentCrews.length) {
        setSelectedJoggingCrews(new Set())
      } else {
        setSelectedJoggingCrews(new Set(currentCrews.map(c => c.id)))
      }
    }
  }

  // 선택된 크루 삭제
  const handleDeleteSelectedCrews = async () => {
    if (activeCrewTab === 'crew') {
      if (selectedCrews.size === 0) {
        alert('삭제할 크루를 선택해주세요.')
        return
      }

      if (!confirm(`선택한 ${selectedCrews.size}개의 크루를 삭제하시겠습니까?`)) return

      const result = await adminService.deleteCrews(Array.from(selectedCrews))
      if (result.success) {
        alert(`${result.deleted}개의 크루가 삭제되었습니다.`)
        setSelectedCrews(new Set())
        await loadCrews()
        await loadStats() // 통계도 업데이트
      } else {
        alert(`크루 삭제 실패: ${result.error}`)
      }
    } else {
      if (selectedJoggingCrews.size === 0) {
        alert('삭제할 조깅 크루를 선택해주세요.')
        return
      }

      if (!confirm(`선택한 ${selectedJoggingCrews.size}개의 조깅 크루를 삭제하시겠습니까?`)) return

      const result = await adminService.deleteJoggingCrews(Array.from(selectedJoggingCrews))
      if (result.success) {
        alert(`${result.deleted}개의 조깅 크루가 삭제되었습니다.`)
        setSelectedJoggingCrews(new Set())
        await loadCrews()
        await loadStats() // 통계도 업데이트
      } else {
        alert(`조깅 크루 삭제 실패: ${result.error}`)
      }
    }
  }

  // 필터링 및 정렬된 사용자 목록
  const getFilteredAndSortedUsers = () => {
    let filtered = activeTab === 'users' ? users : deletedUsers

    // 검색 필터링
    if (userSearchTerm.trim()) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (userSortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (userSortBy === 'email') {
        return a.email.localeCompare(b.email)
      } else {
        return b.createdAt - a.createdAt
      }
    })

    return filtered
  }

  // 필터링 및 정렬된 크루 목록
  const getFilteredAndSortedCrews = () => {
    const currentCrews = activeCrewTab === 'crew' ? crews : joggingCrews
    let filtered = [...currentCrews]

    // 검색 필터링
    if (crewSearchTerm.trim()) {
      filtered = filtered.filter(crew =>
        crew.name.toLowerCase().includes(crewSearchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (crewSortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (crewSortBy === 'members') {
        return b.currentMembers - a.currentMembers
      } else {
        return b.createdAt - a.createdAt
      }
    })

    return filtered
  }

  const getUserLoginHistory = async (userId: string) => {
    setSelectedUser(userId)
    const result = await loginHistoryService.getUserLoginHistory(userId, PAGE_SIZE, 0)
    setLoginHistory(result.data)
    setLoginHistoryPagination({ offset: PAGE_SIZE, hasMore: result.hasMore, loading: false })
  }

  const getLoginData = () => {
    if (!stats) return []
    if (selectedPeriod === 'daily') return stats.dailyLogins
    if (selectedPeriod === 'weekly') return stats.weeklyLogins
    return stats.monthlyLogins
  }

  const getMaxLoginCount = () => {
    const data = getLoginData()
    return Math.max(...data.map(d => d.count), 1)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (selectedPeriod === 'daily') {
      return `${date.getMonth() + 1}/${date.getDate()}`
    } else if (selectedPeriod === 'weekly') {
      return dateStr
    } else {
      return dateStr
    }
  }

  // 공지사항 체크박스 토글
  const toggleAnnouncementSelection = (announcementId: string) => {
    setSelectedAnnouncements(prev => {
      const newSet = new Set(prev)
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId)
      } else {
        newSet.add(announcementId)
      }
      return newSet
    })
  }

  // 모든 공지사항 선택/해제
  const toggleAllAnnouncements = () => {
    const currentAnnouncements = getFilteredAndSortedAnnouncements()
    if (selectedAnnouncements.size === currentAnnouncements.length) {
      setSelectedAnnouncements(new Set())
    } else {
      setSelectedAnnouncements(new Set(currentAnnouncements.map(a => a.id)))
    }
  }

  // 선택된 공지사항 삭제
  const handleDeleteSelectedAnnouncements = async () => {
    if (selectedAnnouncements.size === 0) {
      alert('삭제할 공지사항을 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedAnnouncements.size}개의 공지사항을 삭제하시겠습니까?`)) return

    const result = await adminService.deleteAnnouncements(Array.from(selectedAnnouncements))
    if (result.success) {
      alert(`${result.deleted}개의 공지사항이 삭제되었습니다.`)
      setSelectedAnnouncements(new Set())
      await loadAnnouncements()
    } else {
      alert(`공지사항 삭제 실패: ${result.error}`)
    }
  }

  // 필터링 및 정렬된 공지사항 목록
  const getFilteredAndSortedAnnouncements = () => {
    let filtered = [...announcements]

    // 검색 필터링
    if (announcementSearchTerm.trim()) {
      filtered = filtered.filter(announcement =>
        announcement.title.toLowerCase().includes(announcementSearchTerm.toLowerCase()) ||
        announcement.content.toLowerCase().includes(announcementSearchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (announcementSortBy === 'title') {
        return a.title.localeCompare(b.title)
      } else if (announcementSortBy === 'priority') {
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
      } else {
        return b.createdAt - a.createdAt
      }
    })

    return filtered
  }

  // 공지사항 생성/수정 핸들러
  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }
    if (!announcementForm.content.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    if (editingAnnouncement) {
      // 수정
      const result = await adminService.updateAnnouncement(editingAnnouncement.id, {
        title: announcementForm.title,
        content: announcementForm.content,
        priority: announcementForm.priority,
        isActive: announcementForm.isActive,
      })
      if (result.success) {
        alert('공지사항이 수정되었습니다.')
        setShowAnnouncementModal(false)
        setEditingAnnouncement(null)
        setAnnouncementForm({ title: '', content: '', priority: 'normal', isActive: true })
        await loadAnnouncements()
      } else {
        alert(`공지사항 수정 실패: ${result.error}`)
      }
    } else {
      // 생성
      const result = await adminService.createAnnouncement({
        title: announcementForm.title,
        content: announcementForm.content,
        priority: announcementForm.priority,
        isActive: announcementForm.isActive,
      })
      if (result.success) {
        alert('공지사항이 생성되었습니다.')
        setShowAnnouncementModal(false)
        setAnnouncementForm({ title: '', content: '', priority: 'normal', isActive: true })
        await loadAnnouncements()
      } else {
        alert(`공지사항 생성 실패: ${result.error}`)
      }
    }
  }

  // 공지사항 수정 모달 열기
  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      isActive: announcement.isActive,
    })
    setShowAnnouncementModal(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-2xl">로딩 중...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-2xl">데이터를 불러올 수 없습니다.</div>
      </div>
    )
  }

  const loginData = getLoginData()
  const maxLoginCount = getMaxLoginCount()

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="relative z-10 max-w-7xl mx-auto">
        <NavigationButtons showBack={false} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">관리자 대시보드</h1>
          <p className="text-gray-400">시스템 통계 및 관리</p>
        </motion.div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/90 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-2">
              <div className="text-gray-400 text-sm">전체 사용자</div>
              <button
                onClick={async () => {
                  await loadStats()
                }}
                className="text-gray-500 hover:text-gray-300 text-xs"
                title="Reload"
              >
                ↻
              </button>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
            <div className="text-sm text-gray-500 mt-2">활성: {stats.activeUsers}</div>
          </div>
          <div className="bg-gray-800/90 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-2">
              <div className="text-gray-400 text-sm">전체 크루</div>
              <button
                onClick={async () => {
                  await loadStats()
                }}
                className="text-gray-500 hover:text-gray-300 text-xs"
                title="Reload"
              >
                ↻
              </button>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalCrews}</div>
            <div className="text-sm text-gray-500 mt-2">휴면: {stats.dormantCrews}</div>
          </div>
          <div className="bg-gray-800/90 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-2">
              <div className="text-gray-400 text-sm">전체 조깅 크루</div>
              <button
                onClick={async () => {
                  await loadStats()
                }}
                className="text-gray-500 hover:text-gray-300 text-xs"
                title="Reload"
              >
                ↻
              </button>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalJoggingCrews}</div>
            <div className="text-sm text-gray-500 mt-2">휴면: {stats.dormantJoggingCrews}</div>
          </div>
          <div className="bg-gray-800/90 rounded-2xl p-6">
            <div className="text-gray-400 text-sm mb-2">관리 작업</div>
            <button
              onClick={() => navigate('/admin/dormant-crews')}
              className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
            >
              휴면 크루 관리 →
            </button>
          </div>
        </div>

        {/* 접속 내역 그래프 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-white">📈 접속 내역</h2>
              <button
                onClick={async () => {
                  await loadStats()
                }}
                className="text-gray-400 hover:text-gray-200 text-sm"
                title="Reload"
              >
                ↻
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPeriod('daily')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
                  selectedPeriod === 'daily'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                일별
              </button>
              <button
                onClick={() => setSelectedPeriod('weekly')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
                  selectedPeriod === 'weekly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                주별
              </button>
              <button
                onClick={() => setSelectedPeriod('monthly')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
                  selectedPeriod === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                월별
              </button>
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            {loginData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                데이터가 없습니다.
              </div>
            ) : (
              <LineChart data={loginData} maxValue={maxLoginCount} selectedPeriod={selectedPeriod} formatDate={formatDate} />
            )}
          </div>
        </div>

        {/* 방 생성/삭제 통계 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800/90 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">크루 생성 통계</h2>
                <button
                  onClick={async () => {
                    await loadStats()
                  }}
                  className="text-gray-400 hover:text-gray-200 text-sm"
                  title="Reload"
                >
                  ↻
                </button>
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-end justify-between gap-2 h-32">
                {stats.crewCreationStats.slice(-7).map((data, index) => {
                  const maxCount = Math.max(...stats.crewCreationStats.map(d => d.count), 1)
                  const height = maxCount > 0 ? (data.count / maxCount) * 100 : 0
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex items-end justify-center mb-2">
                        <div
                          className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t"
                          style={{ height: `${height}%`, minHeight: data.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 text-center">
                        <div>{data.count}</div>
                        <div className="mt-1">{formatDate(data.date)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="bg-gray-800/90 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">크루 삭제 통계</h2>
                <button
                  onClick={async () => {
                    await loadStats()
                  }}
                  className="text-gray-400 hover:text-gray-200 text-sm"
                  title="Reload"
                >
                  ↻
                </button>
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-center h-32 text-gray-400">
                삭제 기록 추적 기능 준비 중
              </div>
            </div>
          </div>
        </div>

        {/* 사용자 관리 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-white">👥 사용자 관리</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await loadUsers()
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                title="Reload"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Reload</span>
              </button>
              {selectedUsers.size > 0 && (
                <button
                  onClick={handleDeleteSelectedUsers}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                >
                  <span>🗑️</span>
                  <span>선택 삭제 ({selectedUsers.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                setActiveTab('users')
                setSelectedUsers(new Set())
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                activeTab === 'users'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              일반 ({users.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('deleted')
                setSelectedUsers(new Set())
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                activeTab === 'deleted'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              탈퇴 ({deletedUsers.length})
            </button>
          </div>

          {/* 검색 및 정렬 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <select
              value={userSortBy}
              onChange={(e) => setUserSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="createdAt">생성일순</option>
              <option value="name">이름순</option>
              <option value="email">이메일순</option>
            </select>
          </div>

          {/* 사용자 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {getFilteredAndSortedUsers().length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {activeTab === 'users' ? '사용자가 없습니다.' : '탈퇴한 사용자가 없습니다.'}
              </div>
            ) : (
              <div className="space-y-2">
                {/* 전체 선택 */}
                {activeTab === 'users' && (
                  <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-3 border-b border-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === getFilteredAndSortedUsers().length && getFilteredAndSortedUsers().length > 0}
                      onChange={toggleAllUsers}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-white text-sm font-semibold">전체 선택</span>
                    {selectedUsers.size > 0 && (
                      <span className="text-blue-400 text-sm">({selectedUsers.size}개 선택됨)</span>
                    )}
                  </div>
                )}
                
                {getFilteredAndSortedUsers().map((user, index) => (
                  <div
                    key={user.id}
                    className={`rounded-lg p-4 flex items-start gap-3 ${
                      activeTab === 'deleted'
                        ? 'bg-red-900/20 border border-red-500/50'
                        : 'bg-gray-700/50'
                    }`}
                  >
                    {activeTab === 'users' && user.role !== 'admin' && (
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 rounded mt-1"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-white font-semibold flex items-center gap-1">
                          {user.name}
                          {userRanks[user.id] && (
                            <RankBadge rank={userRanks[user.id]} type="user" size="sm" showText={true} />
                          )}
                        </div>
                        {user.role === 'admin' && (
                          <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">관리자</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 break-all">{user.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        가입일: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                      </div>
                      {activeTab === 'deleted' && (
                        <div className="text-xs text-red-400 mt-1">
                          탈퇴일: {user.deletedAt ? new Date(user.deletedAt).toLocaleDateString('ko-KR') : '-'}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <button
                        onClick={() => getUserLoginHistory(user.id)}
                        className="px-2 sm:px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 font-semibold whitespace-nowrap flex items-center gap-1"
                        title="로그인 히스토리"
                      >
                        <span>📊</span>
                        <span className="hidden sm:inline">히스토리</span>
                      </button>
                      {activeTab === 'users' && user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 font-semibold whitespace-nowrap flex items-center gap-1"
                          title="삭제"
                        >
                          <span>🗑️</span>
                          <span className="hidden sm:inline">삭제</span>
                        </button>
                      )}
                      {activeTab === 'deleted' && (
                        <>
                          <button
                            onClick={() => handleRestoreUser(user.id)}
                            className="px-2 sm:px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 font-semibold whitespace-nowrap flex items-center gap-1"
                            title="탈퇴 취소"
                          >
                            <span>↩️</span>
                            <span className="hidden sm:inline">복구</span>
                          </button>
                          <button
                            onClick={() => handlePermanentlyDeleteUser(user.id)}
                            className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 font-semibold whitespace-nowrap flex items-center gap-1"
                            title="완전 삭제"
                          >
                            <span>🗑️</span>
                            <span className="hidden sm:inline">삭제</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* 무한 스크롤 트리거 */}
                {activeTab === 'users' && userPagination.hasMore && (
                  <div ref={userScrollRef} className="py-4 text-center">
                    {userPagination.loading && (
                      <div className="text-gray-400">로딩 중...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 로그인 히스토리 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                📋 로그인 히스토리
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await loadLoginHistory()
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                title="Reload"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Reload</span>
              </button>
              <button
                onClick={async () => {
                  setSelectedUser(null)
                  await loadLoginHistory(null)
                }}
                className={`px-3 py-2 rounded-lg text-xs sm:text-sm ${
                  selectedUser 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                All user
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {loginHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-8">로그인 히스토리가 없습니다.</div>
              ) : (
                loginHistory.map((history) => {
                  const user = users.find(u => u.id === history.userId) || deletedUsers.find(u => u.id === history.userId)
                  return (
                    <div
                      key={history.id}
                      className="bg-gray-700/50 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-white text-sm font-semibold">
                            {user ? user.name : '알 수 없음'} {user && <span className="text-gray-400 text-xs">({user.email})</span>}
                          </div>
                          <div className="text-white text-sm mt-1">
                            {new Date(history.loginAt).toLocaleString('ko-KR')}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {history.os} / {history.browser} / {history.deviceType}
                          </div>
                          {history.sessionDuration && (
                            <div className="text-xs text-gray-500 mt-1">
                              세션 시간: {Math.floor(history.sessionDuration / 60)}분
                            </div>
                          )}
                        </div>
                        {!selectedUser && (
                          <button
                            onClick={() => getUserLoginHistory(history.userId)}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 whitespace-nowrap"
                          >
                            상세보기
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              
              {/* 무한 스크롤 트리거 */}
              {loginHistoryPagination.hasMore && (
                <div ref={loginHistoryScrollRef} className="py-4 text-center">
                  {loginHistoryPagination.loading && (
                    <div className="text-gray-400 text-sm">로딩 중...</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 크루 관리 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-white">🏠 크루 관리</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await loadCrews()
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                title="Reload"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Reload</span>
              </button>
              {((activeCrewTab === 'crew' && selectedCrews.size > 0) || 
                (activeCrewTab === 'jogging' && selectedJoggingCrews.size > 0)) && (
                <button
                  onClick={handleDeleteSelectedCrews}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                >
                  <span>🗑️</span>
                  <span>선택 삭제 ({activeCrewTab === 'crew' ? selectedCrews.size : selectedJoggingCrews.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                setActiveCrewTab('crew')
                setSelectedCrews(new Set())
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                activeCrewTab === 'crew'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              크루 ({crews.length})
            </button>
            <button
              onClick={() => {
                setActiveCrewTab('jogging')
                setSelectedJoggingCrews(new Set())
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                activeCrewTab === 'jogging'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              조깅 ({joggingCrews.length})
            </button>
          </div>

          {/* 검색 및 정렬 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              placeholder="크루명으로 검색..."
              value={crewSearchTerm}
              onChange={(e) => setCrewSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <select
              value={crewSortBy}
              onChange={(e) => setCrewSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="createdAt">생성일순</option>
              <option value="name">이름순</option>
              <option value="members">멤버수순</option>
            </select>
          </div>

          {/* 크루 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {getFilteredAndSortedCrews().length === 0 ? (
              <div className="text-center text-gray-400 py-8">크루가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {/* 전체 선택 */}
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-3 border-b border-gray-600">
                  <input
                    type="checkbox"
                    checked={
                      (activeCrewTab === 'crew' && selectedCrews.size === getFilteredAndSortedCrews().length && getFilteredAndSortedCrews().length > 0) ||
                      (activeCrewTab === 'jogging' && selectedJoggingCrews.size === getFilteredAndSortedCrews().length && getFilteredAndSortedCrews().length > 0)
                    }
                    onChange={toggleAllCrews}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white text-sm font-semibold">전체 선택</span>
                  {(activeCrewTab === 'crew' ? selectedCrews.size : selectedJoggingCrews.size) > 0 && (
                    <span className="text-blue-400 text-sm">
                      ({(activeCrewTab === 'crew' ? selectedCrews.size : selectedJoggingCrews.size)}개 선택됨)
                    </span>
                  )}
                </div>

                {getFilteredAndSortedCrews().map((crew) => {
                  const isSelected = activeCrewTab === 'crew' 
                    ? selectedCrews.has(crew.id) 
                    : selectedJoggingCrews.has(crew.id)
                  
                  return (
                    <div
                      key={crew.id}
                      className={`rounded-lg p-4 flex items-start gap-3 ${
                        crew.isDormant
                          ? 'bg-yellow-900/20 border border-yellow-500/50'
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCrewSelection(crew.id)}
                        className="w-4 h-4 rounded mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-white font-semibold flex items-center gap-1">
                            {crew.name}
                            {crewRanks[crew.id] && (
                              <RankBadge rank={crewRanks[crew.id]} type={('targetDistance' in crew) ? 'crew' : 'crew'} size="sm" showText={true} />
                            )}
                          </div>
                          {crew.isDormant && (
                            <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">휴면</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                          생성자: {creatorMap[crew.id] || '알 수 없음'}
                          {creatorMap[crew.id] && creatorRanks[crew.id] && (
                            <RankBadge rank={creatorRanks[crew.id]} type="user" size="sm" showText={true} />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          멤버: {crew.currentMembers}명 | 생성일: {new Date(crew.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                        {activeCrewTab === 'crew' && (
                          <div className="text-xs text-gray-500">
                            종목: {(crew as Crew).exerciseType}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <button
                          onClick={async () => {
                            if (!confirm(`정말 이 ${activeCrewTab === 'crew' ? '크루' : '조깅 크루'}를 삭제하시겠습니까?`)) return

                            if (activeCrewTab === 'crew') {
                              const result = await adminService.deleteCrew(crew.id)
                              if (result.success) {
                                alert('크루가 삭제되었습니다.')
                                await loadCrews()
                                await loadStats() // 통계도 업데이트
                              } else {
                                alert(`크루 삭제 실패: ${result.error}`)
                              }
                            } else {
                              const result = await adminService.deleteJoggingCrew(crew.id)
                              if (result.success) {
                                alert('조깅 크루가 삭제되었습니다.')
                                await loadCrews()
                                await loadStats() // 통계도 업데이트
                              } else {
                                alert(`조깅 크루 삭제 실패: ${result.error}`)
                              }
                            }
                          }}
                          className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 font-semibold whitespace-nowrap flex items-center gap-1"
                          title="삭제"
                        >
                          <span>🗑️</span>
                          <span className="hidden sm:inline">삭제</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
                
                {/* 무한 스크롤 트리거 */}
                {activeCrewTab === 'crew' && crewPagination.hasMore && (
                  <div ref={crewScrollRef} className="py-4 text-center">
                    {crewPagination.loading && (
                      <div className="text-gray-400">로딩 중...</div>
                    )}
                  </div>
                )}
                {activeCrewTab === 'jogging' && joggingCrewPagination.hasMore && (
                  <div ref={joggingCrewScrollRef} className="py-4 text-center">
                    {joggingCrewPagination.loading && (
                      <div className="text-gray-400">로딩 중...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 목표 관리 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-white">🎯 목표 관리</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await loadGoals()
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                title="Reload"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Reload</span>
              </button>
              {((activeGoalTab === 'single' && selectedSingleGoals.size > 0) || 
                (activeGoalTab === 'jogging' && selectedJoggingGoals.size > 0)) && (
                <button
                  onClick={handleDeleteSelectedGoals}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                >
                  <span>🗑️</span>
                  <span>선택 삭제 ({activeGoalTab === 'single' ? selectedSingleGoals.size : selectedJoggingGoals.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                setActiveGoalTab('single')
                setSelectedSingleGoals(new Set())
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                activeGoalTab === 'single'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              싱글 목표 ({singleGoals.length})
            </button>
            <button
              onClick={() => {
                setActiveGoalTab('jogging')
                setSelectedJoggingGoals(new Set())
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm ${
                activeGoalTab === 'jogging'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              조깅 목표 ({joggingGoals.length})
            </button>
          </div>

          {/* 검색 및 정렬 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              placeholder="목표명으로 검색..."
              value={goalSearchTerm}
              onChange={(e) => setGoalSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <select
              value={goalSortBy}
              onChange={(e) => setGoalSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="createdAt">생성일순</option>
              <option value="name">이름순</option>
            </select>
          </div>

          {/* 목표 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {getFilteredAndSortedGoals().length === 0 ? (
              <div className="text-center text-gray-400 py-8">목표가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {/* 전체 선택 */}
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-3 border-b border-gray-600">
                  <input
                    type="checkbox"
                    checked={
                      (activeGoalTab === 'single' && selectedSingleGoals.size === getFilteredAndSortedGoals().length && getFilteredAndSortedGoals().length > 0) ||
                      (activeGoalTab === 'jogging' && selectedJoggingGoals.size === getFilteredAndSortedGoals().length && getFilteredAndSortedGoals().length > 0)
                    }
                    onChange={toggleAllGoals}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white text-sm font-semibold">전체 선택</span>
                  {(activeGoalTab === 'single' ? selectedSingleGoals.size : selectedJoggingGoals.size) > 0 && (
                    <span className="text-blue-400 text-sm">
                      ({(activeGoalTab === 'single' ? selectedSingleGoals.size : selectedJoggingGoals.size)}개 선택됨)
                    </span>
                  )}
                </div>

                {getFilteredAndSortedGoals().map((goal) => {
                  const isSelected = activeGoalTab === 'single' 
                    ? selectedSingleGoals.has(goal.id) 
                    : selectedJoggingGoals.has(goal.id)
                  
                  return (
                    <div
                      key={goal.id}
                      className={`rounded-lg p-4 flex items-start gap-3 ${
                        !goal.isActive
                          ? 'bg-yellow-900/20 border border-yellow-500/50'
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGoalSelection(goal.id)}
                        className="w-4 h-4 rounded mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-white font-semibold">{goal.name}</div>
                          {!goal.isActive && (
                            <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">비활성</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                          생성자: {goalCreatorMap[goal.id] || '알 수 없음'}
                          {goalCreatorMap[goal.id] && goalCreatorRanks[goal.id] && (
                            <RankBadge rank={goalCreatorRanks[goal.id]} type="user" size="sm" showText={true} />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          생성일: {new Date(goal.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                        {activeGoalTab === 'single' && (
                          <div className="text-xs text-gray-500 mt-1">
                            종목: {EXERCISE_TYPE_NAMES[(goal as SingleGoal).exerciseType] || (goal as SingleGoal).exerciseType} | 
                            세트: {(goal as SingleGoal).exerciseConfig.sets} | 
                            횟수: {(goal as SingleGoal).exerciseConfig.reps}
                          </div>
                        )}
                        {activeGoalTab === 'jogging' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {(goal as JoggingGoal).targetDistance && `목표 거리: ${(goal as JoggingGoal).targetDistance}km`}
                            {(goal as JoggingGoal).targetDistance && (goal as JoggingGoal).targetTime && ' | '}
                            {(goal as JoggingGoal).targetTime && `목표 시간: ${(goal as JoggingGoal).targetTime}분`}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <button
                          onClick={async () => {
                            if (!confirm(`정말 이 ${activeGoalTab === 'single' ? '싱글 목표' : '조깅 목표'}를 삭제하시겠습니까?`)) return

                            if (activeGoalTab === 'single') {
                              const result = await adminService.deleteSingleGoal(goal.id)
                              if (result.success) {
                                alert('싱글 목표가 삭제되었습니다.')
                                await loadGoals()
                              } else {
                                alert(`목표 삭제 실패: ${result.error}`)
                              }
                            } else {
                              const result = await adminService.deleteJoggingGoal(goal.id)
                              if (result.success) {
                                alert('조깅 목표가 삭제되었습니다.')
                                await loadGoals()
                              } else {
                                alert(`목표 삭제 실패: ${result.error}`)
                              }
                            }
                          }}
                          className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 font-semibold whitespace-nowrap flex items-center gap-1"
                          title="삭제"
                        >
                          <span>🗑️</span>
                          <span className="hidden sm:inline">삭제</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
                
                {/* 무한 스크롤 트리거 */}
                {activeGoalTab === 'single' && singleGoalPagination.hasMore && (
                  <div ref={singleGoalScrollRef} className="py-4 text-center">
                    {singleGoalPagination.loading && (
                      <div className="text-gray-400">로딩 중...</div>
                    )}
                  </div>
                )}
                {activeGoalTab === 'jogging' && joggingGoalPagination.hasMore && (
                  <div ref={joggingGoalScrollRef} className="py-4 text-center">
                    {joggingGoalPagination.loading && (
                      <div className="text-gray-400">로딩 중...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 공지사항 관리 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-white">📢 공지사항 관리</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await loadAnnouncements()
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                title="Reload"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Reload</span>
              </button>
              <button
                onClick={() => {
                  setEditingAnnouncement(null)
                  setAnnouncementForm({ title: '', content: '', priority: 'normal', isActive: true })
                  setShowAnnouncementModal(true)
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
              >
                <span>➕</span>
                <span className="hidden sm:inline">공지사항 생성</span>
              </button>
              {selectedAnnouncements.size > 0 && (
                <button
                  onClick={handleDeleteSelectedAnnouncements}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                >
                  <span>🗑️</span>
                  <span>선택 삭제 ({selectedAnnouncements.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* 검색 및 정렬 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              placeholder="제목 또는 내용으로 검색..."
              value={announcementSearchTerm}
              onChange={(e) => setAnnouncementSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <select
              value={announcementSortBy}
              onChange={(e) => setAnnouncementSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="createdAt">생성일순</option>
              <option value="title">제목순</option>
              <option value="priority">우선순위순</option>
            </select>
          </div>

          {/* 공지사항 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {getFilteredAndSortedAnnouncements().length === 0 ? (
              <div className="text-center text-gray-400 py-8">공지사항이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {/* 전체 선택 */}
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-3 border-b border-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedAnnouncements.size === getFilteredAndSortedAnnouncements().length && getFilteredAndSortedAnnouncements().length > 0}
                    onChange={toggleAllAnnouncements}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-white text-sm font-semibold">전체 선택</span>
                  {selectedAnnouncements.size > 0 && (
                    <span className="text-blue-400 text-sm">({selectedAnnouncements.size}개 선택됨)</span>
                  )}
                </div>

                {getFilteredAndSortedAnnouncements().map((announcement) => {
                  const isSelected = selectedAnnouncements.has(announcement.id)
                  const priorityColors = {
                    urgent: 'bg-red-500/20 text-red-400 border-red-500/50',
                    high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
                    normal: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                    low: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
                  }
                  
                  return (
                    <div
                      key={announcement.id}
                      className={`rounded-lg p-4 flex items-start gap-3 ${
                        !announcement.isActive
                          ? 'bg-yellow-900/20 border border-yellow-500/50'
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAnnouncementSelection(announcement.id)}
                        className="w-4 h-4 rounded mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-white font-semibold">{announcement.title}</div>
                          <span className={`text-xs px-2 py-1 rounded border ${priorityColors[announcement.priority]}`}>
                            {announcement.priority === 'urgent' ? '긴급' : 
                             announcement.priority === 'high' ? '높음' :
                             announcement.priority === 'normal' ? '보통' : '낮음'}
                          </span>
                          {!announcement.isActive && (
                            <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">비활성</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mt-1 line-clamp-2">
                          {announcement.content}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          생성자: {announcementCreatorMap[announcement.id] || '알 수 없음'} | 
                          생성일: {new Date(announcement.createdAt).toLocaleDateString('ko-KR')} | 
                          읽은 사용자: {announcementStats.readCounts[announcement.id] || 0}명
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <button
                          onClick={() => handleEditAnnouncement(announcement)}
                          className="px-2 sm:px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 font-semibold whitespace-nowrap flex items-center gap-1"
                          title="수정"
                        >
                          <span>✏️</span>
                          <span className="hidden sm:inline">수정</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return

                            const result = await adminService.deleteAnnouncement(announcement.id)
                            if (result.success) {
                              alert('공지사항이 삭제되었습니다.')
                              await loadAnnouncements()
                            } else {
                              alert(`공지사항 삭제 실패: ${result.error}`)
                            }
                          }}
                          className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 font-semibold whitespace-nowrap flex items-center gap-1"
                          title="삭제"
                        >
                          <span>🗑️</span>
                          <span className="hidden sm:inline">삭제</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
                
                {/* 무한 스크롤 트리거 */}
                {announcementPagination.hasMore && (
                  <div ref={announcementScrollRef} className="py-4 text-center">
                    {announcementPagination.loading && (
                      <div className="text-gray-400">로딩 중...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* API Key 생성/수정 모달 */}
        {showApiKeyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">
                {editingApiKey ? 'API Key 수정' : 'API Key 생성'}
              </h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">타입</label>
                  <select
                    value={apiKeyForm.keyType}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, keyType: e.target.value as 'llm' | 'weather' }))}
                    disabled={!!editingApiKey}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="llm">🤖 LLM API Key</option>
                    <option value="weather">🌤️ Weather API Key</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-2">API Key</label>
                  <input
                    type="password"
                    value={apiKeyForm.apiKey}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="API Key를 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-2">설명</label>
                  <input
                    type="text"
                    value={apiKeyForm.description}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="API Key 설명을 입력하세요"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="apiKeyIsActive"
                    checked={apiKeyForm.isActive}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="apiKeyIsActive" className="text-white text-sm">활성화</label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowApiKeyModal(false)
                    setEditingApiKey(null)
                    setApiKeyForm({ keyType: 'llm', apiKey: '', description: '', isActive: true })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    if (!apiKeyForm.apiKey.trim()) {
                      alert('API Key를 입력해주세요.')
                      return
                    }

                    if (editingApiKey) {
                      // 수정
                      const result = await adminService.updateApiKey(editingApiKey.id, {
                        apiKey: apiKeyForm.apiKey,
                        description: apiKeyForm.description,
                        isActive: apiKeyForm.isActive,
                      })
                      if (result.success) {
                        alert('API Key가 수정되었습니다.')
                        setShowApiKeyModal(false)
                        setEditingApiKey(null)
                        setApiKeyForm({ keyType: 'llm', apiKey: '', description: '', isActive: true })
                        const keys = await adminService.getAllApiKeys()
                        setApiKeys(keys)
                      } else {
                        alert(`API Key 수정 실패: ${result.error}`)
                      }
                    } else {
                      // 생성
                      const result = await adminService.upsertApiKey(
                        apiKeyForm.keyType,
                        apiKeyForm.apiKey,
                        apiKeyForm.description
                      )
                      if (result.success) {
                        alert('API Key가 저장되었습니다.')
                        setShowApiKeyModal(false)
                        setApiKeyForm({ keyType: 'llm', apiKey: '', description: '', isActive: true })
                        const keys = await adminService.getAllApiKeys()
                        setApiKeys(keys)
                      } else {
                        alert(`API Key 저장 실패: ${result.error}`)
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 공지사항 생성/수정 모달 */}
        {showAnnouncementModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">
                {editingAnnouncement ? '공지사항 수정' : '공지사항 생성'}
              </h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">제목</label>
                  <input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="공지사항 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-2">내용</label>
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]"
                    placeholder="공지사항 내용을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-2">우선순위</label>
                  <select
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">낮음</option>
                    <option value="normal">보통</option>
                    <option value="high">높음</option>
                    <option value="urgent">긴급</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={announcementForm.isActive}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="isActive" className="text-white text-sm">활성화</label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAnnouncementModal(false)
                    setEditingAnnouncement(null)
                    setAnnouncementForm({ title: '', content: '', priority: 'normal', isActive: true })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveAnnouncement}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Key 관리 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-white">🔑 API Key 관리(개발중)</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const keys = await adminService.getAllApiKeys()
                  setApiKeys(keys)
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-xs md:text-sm font-semibold flex items-center gap-1.5"
                title="Reload"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Reload</span>
              </button>
            </div>
          </div>

          {/* API Key 목록 */}
          <div className="space-y-2">
            {apiKeys.length === 0 ? (
              <div className="text-center text-gray-400 py-8">API Key가 없습니다.</div>
            ) : (
              apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className={`rounded-lg p-4 flex items-start gap-3 ${
                    !apiKey.isActive
                      ? 'bg-yellow-900/20 border border-yellow-500/50'
                      : 'bg-gray-700/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-white font-semibold">
                        {apiKey.keyType === 'llm' ? '🤖 LLM API Key' : '🌤️ Weather API Key'}
                      </div>
                      {!apiKey.isActive && (
                        <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">비활성</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {apiKey.description || '설명 없음'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      API Key: {apiKey.apiKey ? (apiKey.apiKey.length > 0 ? '***' + apiKey.apiKey.slice(-4) : '설정되지 않음') : '설정되지 않음'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      수정일: {new Date(apiKey.updatedAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <button
                      onClick={() => {
                        setEditingApiKey(apiKey)
                        setApiKeyForm({
                          keyType: apiKey.keyType,
                          apiKey: apiKey.apiKey,
                          description: apiKey.description || '',
                          isActive: apiKey.isActive,
                        })
                        setShowApiKeyModal(true)
                      }}
                      className="px-2 sm:px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 font-semibold whitespace-nowrap flex items-center gap-1"
                      title="수정"
                    >
                      <span>✏️</span>
                      <span className="hidden sm:inline">수정</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 운동 영상 수정 모달 */}
        {editingVideo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-4">운동 영상 수정</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">제목</label>
                  <input
                    type="text"
                    value={editingVideo.title}
                    onChange={(e) => setEditingVideo(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="운동 영상 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm font-semibold mb-2">설명</label>
                  <textarea
                    value={editingVideo.description || ''}
                    onChange={(e) => setEditingVideo(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
                    placeholder="운동 영상 설명을 입력하세요"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingVideo(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    if (!editingVideo) return
                    await handleVideoUpdate(editingVideo.id, {
                      title: editingVideo.title,
                      description: editingVideo.description,
                    })
                    setEditingVideo(null)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 운동 영상 등록 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">🎥 운동등록(개발중)</h2>
            <button
              onClick={() => {
                setShowVideoRegistration(true)
                setEditingVideo(null)
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold text-sm flex items-center gap-2"
            >
              ➕ 추가
            </button>
          </div>

          {/* 개발개선사항 섹션 */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">개발개선사항</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              운동등록 테스트완료, 포즈인식, 재실행 등 기본사항 완료
            </p>
          </div>

          {showVideoRegistration && (
            <div className="mb-6">
              <ExerciseVideoRegistration
                onComplete={handleVideoRegistrationComplete}
                onCancel={() => setShowVideoRegistration(false)}
              />
            </div>
          )}

          {/* 영상 목록 */}
          <div className="space-y-3">
            {exerciseVideos.length === 0 ? (
              <div className="text-gray-400 text-center py-8">등록된 영상이 없습니다.</div>
            ) : (
              exerciseVideos.map((video) => (
                <div key={video.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-lg mb-1">{video.title}</div>
                      {video.description && (
                        <div className="text-sm text-gray-400 mb-2">
                          {video.description.length > 5 ? `${video.description.substring(0, 5)}...` : video.description}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>포즈 수: {video.totalPoses}개</div>
                        <div>유지 시간: {Math.floor(video.durationSeconds / 60)}분 {video.durationSeconds % 60}초</div>
                        <div>생성일: {new Date(video.createdAt).toLocaleDateString('ko-KR')}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          navigate('/exercise-video-test', {
                            state: {
                              video,
                              config: {
                                type: 'squat', // 기본값, 실제로는 영상 데이터에서 추론 가능
                                sets: 1,
                                reps: video.totalPoses || 10,
                                restTime: 10,
                              },
                            },
                          })
                        }}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs font-semibold"
                        title="운동 점수 및 분석 결과 테스트"
                      >
                        테스트
                      </button>
                      <button
                        onClick={() => {
                          setEditingVideo(video)
                        }}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-semibold"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleVideoDelete(video.id)}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-semibold"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            {videoPagination.hasMore && (
              <button
                onClick={loadMoreExerciseVideos}
                disabled={videoPagination.loading}
                className="w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed"
              >
                {videoPagination.loading ? '로딩 중...' : '더 보기'}
              </button>
            )}
          </div>
        </div>

        {/* 관리 작업 */}
        <div className="bg-gray-800/90 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">⚙️ 관리 작업</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/admin/dormant-crews')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold text-sm flex items-center gap-2"
            >
              😴 휴면 크루 관리
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboardPage

