import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'
import { announcementService, Announcement } from '@/services/announcementService'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

const AnnouncementsPage = () => {
  const navigate = useNavigate()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true, loading: false })
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const PAGE_SIZE = 3

  useEffect(() => {
    loadAnnouncements(true)
  }, [])

  const loadAnnouncements = async (reset: boolean = false) => {
    const offset = reset ? 0 : pagination.offset
    if (reset) {
      setLoadingAnnouncements(true)
      setPagination({ offset: 0, hasMore: true, loading: false })
      setAnnouncements([])
    } else {
      setPagination(prev => ({ ...prev, loading: true }))
    }

    try {
      const result = await announcementService.getActiveAnnouncements(PAGE_SIZE, offset)
      if (reset) {
        setAnnouncements(result.data)
      } else {
        // 중복 제거: 기존 배열에 없는 공지사항만 추가
        setAnnouncements(prev => {
          const existingIds = new Set(prev.map(a => a.id))
          const newAnnouncements = result.data.filter(a => !existingIds.has(a.id))
          return [...prev, ...newAnnouncements]
        })
      }
      
      setPagination({ 
        offset: offset + PAGE_SIZE, 
        hasMore: result.hasMore, 
        loading: false 
      })
    } catch (error) {
      console.error('공지사항 로드 실패:', error)
      setPagination(prev => ({ ...prev, loading: false }))
    } finally {
      if (reset) {
        setLoadingAnnouncements(false)
      }
    }
  }

  // 더 불러오기 (무한 스크롤)
  const loadMoreAnnouncements = async () => {
    if (pagination.loading || !pagination.hasMore) return
    await loadAnnouncements(false)
  }

  // 무한 스크롤 훅
  const { elementRef } = useInfiniteScroll({
    hasMore: pagination.hasMore,
    loading: pagination.loading,
    onLoadMore: loadMoreAnnouncements,
  })

  const handleMarkAsRead = async (announcementId: string) => {
    const result = await announcementService.markAsRead(announcementId)
    if (result.success) {
      // 읽음 상태만 업데이트
      setAnnouncements(prev => prev.map(a => 
        a.id === announcementId 
          ? { ...a, isRead: true, readAt: Date.now() }
          : a
      ))
      // 선택된 공지사항도 업데이트
      if (selectedAnnouncement && selectedAnnouncement.id === announcementId) {
        setSelectedAnnouncement(prev => prev ? { ...prev, isRead: true, readAt: Date.now() } : null)
      }
    } else {
      alert(`읽음 처리 실패: ${result.error}`)
    }
  }

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    // 읽지 않은 공지사항이면 자동으로 읽음 처리
    if (!announcement.isRead) {
      handleMarkAsRead(announcement.id)
    }
  }

  return (
    <div className="min-h-screen p-8 relative">
      <AnimatedBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">📢 공지사항</h1>
          <NavigationButtons showHome={true} />
        </div>

        {/* 공지사항 목록 */}
        <div className="bg-gray-800/90 rounded-2xl p-6">
          {loadingAnnouncements ? (
            <div className="text-center text-gray-400 py-8">로딩 중...</div>
          ) : announcements.length === 0 ? (
            <div className="text-center text-gray-400 py-8">공지사항이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {announcements.map((announcement) => {
                const priorityColors = {
                  urgent: 'bg-red-500/20 text-red-400 border-red-500/50',
                  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
                  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                  low: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
                }
                
                return (
                  <div
                    key={announcement.id}
                    onClick={() => handleAnnouncementClick(announcement)}
                    className={`rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02] ${
                      announcement.isRead
                        ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700/70'
                        : 'bg-blue-500/10 border border-blue-500/50 hover:bg-blue-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <h3 className={`text-sm font-semibold ${announcement.isRead ? 'text-gray-300' : 'text-white'}`}>
                            {announcement.title}
                          </h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityColors[announcement.priority]}`}>
                            {announcement.priority === 'urgent' ? '긴급' : 
                             announcement.priority === 'high' ? '높음' :
                             announcement.priority === 'normal' ? '보통' : '낮음'}
                          </span>
                          {!announcement.isRead && (
                            <span className="text-[10px] text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">새 공지</span>
                          )}
                        </div>
                        <p className={`text-xs mb-1.5 line-clamp-2 ${announcement.isRead ? 'text-gray-400' : 'text-gray-300'}`}>
                          {announcement.content}
                        </p>
                        <div className="text-[10px] text-gray-500">
                          {new Date(announcement.createdAt).toLocaleDateString('ko-KR')}
                          {announcement.isRead && announcement.readAt && (
                            <span> | {new Date(announcement.readAt).toLocaleDateString('ko-KR')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* 무한 스크롤 트리거 */}
              {pagination.hasMore && (
                <div ref={elementRef} className="py-4 text-center">
                  {pagination.loading && (
                    <div className="text-gray-400 text-sm">로딩 중...</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 공지사항 상세 모달 */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedAnnouncement.title}</h2>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded border ${
                selectedAnnouncement.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                selectedAnnouncement.priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' :
                selectedAnnouncement.priority === 'normal' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
                'bg-gray-500/20 text-gray-400 border-gray-500/50'
              }`}>
                {selectedAnnouncement.priority === 'urgent' ? '긴급' : 
                 selectedAnnouncement.priority === 'high' ? '높음' :
                 selectedAnnouncement.priority === 'normal' ? '보통' : '낮음'}
              </span>
              {!selectedAnnouncement.isRead && (
                <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">새 공지</span>
              )}
            </div>
            
            <div className="text-gray-300 mb-4 whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>
            
            <div className="text-sm text-gray-500 border-t border-gray-700 pt-4">
              <div>작성일: {new Date(selectedAnnouncement.createdAt).toLocaleString('ko-KR')}</div>
              {selectedAnnouncement.isRead && selectedAnnouncement.readAt && (
                <div>읽은 시간: {new Date(selectedAnnouncement.readAt).toLocaleString('ko-KR')}</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default AnnouncementsPage

