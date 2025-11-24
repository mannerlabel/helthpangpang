import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'
import { databaseService, Crew, JoggingCrew } from '@/services/databaseService'
import { rankService } from '@/services/rankService'
import RankBadge from '@/components/RankBadge'

const AdminDormantCrewsPage = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'crew' | 'jogging'>('crew')
  const [crews, setCrews] = useState<Crew[]>([])
  const [joggingCrews, setJoggingCrews] = useState<JoggingCrew[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'dormantAt' | 'createdAt'>('dormantAt')
  const [loading, setLoading] = useState(true)
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({})
  const [creatorRanks, setCreatorRanks] = useState<Record<string, number>>({}) // 생성자 계급
  const [crewRanks, setCrewRanks] = useState<Record<string, number>>({}) // 크루 계급

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user || !adminService.isAdmin(user)) {
      alert('관리자 권한이 필요합니다.')
      navigate('/login')
      return
    }

    loadCrews()
  }, [navigate, activeTab])

  const loadCrews = async () => {
    try {
      setLoading(true)
      if (activeTab === 'crew') {
        const dormantCrews = await adminService.getDormantCrews()
        setCrews(dormantCrews)
        
        // 생성자 정보 가져오기 및 계급 확인
        const creatorMap: Record<string, string> = {}
        const creatorRankMap: Record<string, number> = {}
        const crewRankMap: Record<string, number> = {}
        for (const crew of dormantCrews) {
          try {
            const creator = await databaseService.getUserById(crew.createdBy)
            if (creator) {
              creatorMap[crew.id] = creator.name
              // 생성자 계급 가져오기
              const creatorRank = await rankService.getUserRank(crew.createdBy)
              creatorRankMap[crew.id] = creatorRank
            }
            // 크루 계급 가져오기
            const crewRank = await rankService.getCrewRank(crew.id, false)
            crewRankMap[crew.id] = crewRank
          } catch (error) {
            console.error(`크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
          }
        }
        setCreatorMap(creatorMap)
        setCreatorRanks(creatorRankMap)
        setCrewRanks(crewRankMap)
      } else {
        const dormantJoggingCrews = await adminService.getDormantJoggingCrews()
        setJoggingCrews(dormantJoggingCrews)
        
        // 생성자 정보 가져오기 및 계급 확인
        const creatorMap: Record<string, string> = {}
        const creatorRankMap: Record<string, number> = {}
        const crewRankMap: Record<string, number> = {}
        for (const crew of dormantJoggingCrews) {
          try {
            const creator = await databaseService.getUserById(crew.createdBy)
            if (creator) {
              creatorMap[crew.id] = creator.name
              // 생성자 계급 가져오기
              const creatorRank = await rankService.getUserRank(crew.createdBy)
              creatorRankMap[crew.id] = creatorRank
            }
            // 조깅 크루 계급 가져오기
            const crewRank = await rankService.getCrewRank(crew.id, true)
            crewRankMap[crew.id] = crewRank
          } catch (error) {
            console.error(`조깅 크루 ${crew.id}의 생성자 정보 가져오기 실패:`, error)
          }
        }
        setCreatorMap(creatorMap)
        setCreatorRanks(creatorRankMap)
        setCrewRanks(crewRankMap)
      }
    } catch (error) {
      console.error('휴면 크루 로드 실패:', error)
      alert('휴면 크루를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleReleaseDormant = async (crewId: string) => {
    if (!confirm('이 크루를 휴면 해제하시겠습니까? 7일 후 자동 삭제됩니다.')) return

    const result = activeTab === 'crew'
      ? await adminService.releaseDormantCrew(crewId)
      : await adminService.releaseDormantJoggingCrew(crewId)

    if (result.success) {
      alert('휴면 해제되었습니다. 7일 후 자동 삭제됩니다.')
      loadCrews()
    } else {
      alert(`휴면 해제 실패: ${result.error}`)
    }
  }

  const handleDelete = async (crewId: string) => {
    if (!confirm('정말 이 크루를 삭제하시겠습니까?')) return

    const result = activeTab === 'crew'
      ? await adminService.deleteCrew(crewId)
      : await adminService.deleteJoggingCrew(crewId)

    if (result.success) {
      alert('크루가 삭제되었습니다.')
      loadCrews()
    } else {
      alert(`크루 삭제 실패: ${result.error}`)
    }
  }

  const getFilteredAndSortedCrews = () => {
    const items = activeTab === 'crew' ? crews : joggingCrews
    
    // 검색 필터링
    let filtered = items
    if (searchTerm.trim()) {
      filtered = items.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'dormantAt') {
        const aTime = a.dormantAt || 0
        const bTime = b.dormantAt || 0
        return bTime - aTime
      } else {
        return b.createdAt - a.createdAt
      }
    })

    return filtered
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDaysUntilDeletion = (scheduledDeletionAt?: number) => {
    if (!scheduledDeletionAt) return null
    const now = Date.now()
    const diff = scheduledDeletionAt - now
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 0
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-2xl">로딩 중...</div>
      </div>
    )
  }

  const filteredCrews = getFilteredAndSortedCrews()

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="relative z-10 max-w-7xl mx-auto">
        <NavigationButtons />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">휴면 크루 관리</h1>
          <p className="text-gray-400">휴면 모드 크루 검색, 정렬, 휴면 해제, 삭제</p>
        </motion.div>

        {/* 탭 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('crew')}
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'crew'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            크루 ({crews.length})
          </button>
          <button
            onClick={() => setActiveTab('jogging')}
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'jogging'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            조깅 크루 ({joggingCrews.length})
          </button>
        </div>

        {/* 검색 및 정렬 */}
        <div className="bg-gray-800/90 rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="크루명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">이름순</option>
              <option value="dormantAt">휴면 지정일순</option>
              <option value="createdAt">생성일순</option>
            </select>
          </div>
        </div>

        {/* 크루 목록 */}
        <div className="bg-gray-800/90 rounded-2xl p-6">
          {filteredCrews.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">😴</div>
              <p className="text-xl text-gray-400">휴면 크루가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCrews.map((crew) => {
                const daysUntilDeletion = getDaysUntilDeletion(crew.scheduledDeletionAt)
                return (
                  <div
                    key={crew.id}
                    className="bg-gray-700/50 rounded-lg p-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white flex items-center gap-1">
                            {crew.name}
                            {crewRanks[crew.id] && (
                              <RankBadge rank={crewRanks[crew.id]} type={activeTab === 'crew' ? 'crew' : 'crew'} size="sm" showText={true} />
                            )}
                          </h3>
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                            휴면
                          </span>
                          {daysUntilDeletion !== null && daysUntilDeletion > 0 && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                              {daysUntilDeletion}일 후 삭제 예정
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 space-y-1">
                          <div className="flex items-center gap-1">
                            생성자: {creatorMap[crew.id] || '알 수 없음'}
                            {creatorMap[crew.id] && creatorRanks[crew.id] && (
                              <RankBadge rank={creatorRanks[crew.id]} type="user" size="sm" showText={true} />
                            )}
                          </div>
                          <div>생성일: {formatDate(crew.createdAt)}</div>
                          <div>휴면 지정일: {formatDate(crew.dormantAt)}</div>
                          <div>마지막 활동: {formatDate(crew.lastActivityAt)}</div>
                          {activeTab === 'crew' && (
                            <div>종목: {(crew as Crew).exerciseType}</div>
                          )}
                          {activeTab === 'jogging' && (
                            <>
                              {(crew as JoggingCrew).targetDistance && (
                                <div>목표 거리: {(crew as JoggingCrew).targetDistance}km</div>
                              )}
                              {(crew as JoggingCrew).targetTime && (
                                <div>목표 시간: {(crew as JoggingCrew).targetTime}분</div>
                              )}
                            </>
                          )}
                          <div>멤버 수: {crew.currentMembers}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!crew.scheduledDeletionAt && (
                          <button
                            onClick={() => handleReleaseDormant(crew.id)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
                          >
                            휴면 해제
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(crew.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDormantCrewsPage

