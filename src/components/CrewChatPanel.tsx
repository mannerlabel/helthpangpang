/**
 * 크루 채팅 패널 컴포넌트
 * 카카오톡 스타일 채팅 화면
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { databaseService, ChatMessage } from '@/services/databaseService'
import { authService } from '@/services/authService'

interface CrewChatPanelProps {
  crewId: string
  isOpen: boolean
  onClose: () => void
  entryMessage?: string | null // 입장 메시지 (데이터베이스에 저장하지 않음)
  onNewMessage?: () => void // 새 메시지 알림 콜백
  onUnreadCountChange?: (count: number) => void // 미확인 메시지 수 변경 콜백
}

interface WeatherData {
  temperature: number
  humidity: number
  uvIndex: number
  pm10: number
  pm25: number
  condition: string
}

const CrewChatPanel = ({ crewId, isOpen, onClose, entryMessage, onNewMessage, onUnreadCountChange }: CrewChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [entryMessages, setEntryMessages] = useState<ChatMessage[]>([]) // 입장 메시지 (로컬만)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousEntryMessageRef = useRef<string | null>(null)
  const previousMessagesCountRef = useRef<number>(0)
  const previousMessageIdsRef = useRef<Set<string>>(new Set()) // 이전 메시지 ID 추적
  const currentUserIdRef = useRef<string | null>(null)
  const lastReadMessageIdRef = useRef<string | null>(null) // 마지막으로 읽은 메시지 ID

  useEffect(() => {
    // 현재 사용자 ID 저장
    const user = authService.getCurrentUser()
    if (user) {
      currentUserIdRef.current = user.id
      console.log('💬 CrewChatPanel: 현재 사용자 ID 저장:', user.id, user.name)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadMessages()
      loadWeather()
      const interval = setInterval(() => {
        loadMessages()
        loadWeather()
      }, 2000) // 2초마다 새 메시지 및 날씨 확인
      return () => clearInterval(interval)
    }
  }, [isOpen, crewId])

  // 새 메시지 감지 및 알림
  useEffect(() => {
    console.log('💬 새 메시지 감지 체크:', {
      isOpen,
      messagesCount: messages.length,
      previousCount: previousMessagesCountRef.current,
      previousIds: Array.from(previousMessageIdsRef.current),
      lastReadMessageId: lastReadMessageIdRef.current,
    })

    const user = authService.getCurrentUser()
    if (!user) {
      console.log('💬 사용자 정보 없음, 알림 건너뜀')
      return
    }

    // 현재 메시지 ID 집합 생성
    const currentMessageIds = new Set(messages.map(m => m.id))
    
    // 새 메시지 찾기 (이전에 없던 메시지)
    const newMessages = messages.filter(msg => 
      !previousMessageIdsRef.current.has(msg.id) && 
      msg.userId !== user.id && 
      msg.userId !== 'system' &&
      msg.type !== 'system'
    )

    // 미확인 메시지 찾기 (마지막으로 읽은 메시지 이후의 메시지)
    let unreadMessages: ChatMessage[] = []
    if (lastReadMessageIdRef.current) {
      const lastReadIndex = messages.findIndex(m => m.id === lastReadMessageIdRef.current)
      if (lastReadIndex >= 0) {
        unreadMessages = messages.slice(lastReadIndex + 1).filter(msg => 
          msg.userId !== user.id && 
          msg.userId !== 'system' &&
          msg.type !== 'system'
        )
      } else {
        // 마지막 읽은 메시지를 찾을 수 없으면 모든 메시지를 미확인으로 처리
        unreadMessages = messages.filter(msg => 
          msg.userId !== user.id && 
          msg.userId !== 'system' &&
          msg.type !== 'system'
        )
      }
    } else if (messages.length > 0 && !isOpen) {
      // 처음 열 때는 모든 메시지를 읽은 것으로 처리하지 않고, 채팅창이 닫혀있으면 미확인으로 처리
      unreadMessages = messages.filter(msg => 
        msg.userId !== user.id && 
        msg.userId !== 'system' &&
        msg.type !== 'system'
      )
    }

    console.log('💬 새 메시지 감지 결과:', {
      newMessagesCount: newMessages.length,
      unreadMessagesCount: unreadMessages.length,
      lastReadMessageId: lastReadMessageIdRef.current,
    })

    // 미확인 메시지 수 변경 알림
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadMessages.length)
      console.log('💬 미확인 메시지 수 전달:', unreadMessages.length)
    }

    // 채팅창이 닫혀있을 때 새 메시지 알림
    if (!isOpen && newMessages.length > 0) {
      // 가장 최신 메시지 확인 (메시지는 오름차순 정렬이므로 마지막이 최신)
      const latestNewMessage = newMessages[newMessages.length - 1]
      console.log('💬 최신 새 메시지:', {
        id: latestNewMessage.id,
        userName: latestNewMessage.userName,
        message: latestNewMessage.message,
        userId: latestNewMessage.userId,
      })

      if (onNewMessage) {
        console.log('💬 onNewMessage 콜백 호출!')
        onNewMessage()
      } else {
        console.log('💬 onNewMessage 콜백이 없음')
      }
    }

    // 이전 메시지 정보 업데이트
    previousMessagesCountRef.current = messages.length
    previousMessageIdsRef.current = new Set(messages.map(m => m.id))
    
    console.log('💬 메시지 상태 업데이트:', {
      count: messages.length,
      ids: Array.from(previousMessageIdsRef.current),
    })
  }, [messages, isOpen, onNewMessage, onUnreadCountChange])

  // 채팅창이 열릴 때 마지막 메시지를 읽은 것으로 표시
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      lastReadMessageIdRef.current = lastMessage.id
      console.log('💬 채팅창 열림 - 마지막 메시지를 읽은 것으로 표시:', lastMessage.id)
      // 미확인 메시지 수 초기화
      if (onUnreadCountChange) {
        onUnreadCountChange(0)
        console.log('💬 미확인 메시지 수 초기화: 0')
      }
    } else if (!isOpen && messages.length > 0) {
      // 채팅창이 닫힐 때는 마지막 읽은 메시지 ID를 유지 (초기화하지 않음)
      console.log('💬 채팅창 닫힘 - 마지막 읽은 메시지 ID 유지:', lastReadMessageIdRef.current)
    }
  }, [isOpen, messages.length, onUnreadCountChange])

  // 채팅창이 열려있을 때 새 메시지가 오면 자동으로 읽은 것으로 표시 (스크롤이 맨 아래에 있을 때)
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      // 스크롤이 맨 아래에 있는지 확인
      const messagesContainer = messagesEndRef.current?.parentElement
      if (messagesContainer) {
        const isScrolledToBottom = 
          messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100 // 100px 여유
        
        if (isScrolledToBottom) {
          // 스크롤이 맨 아래에 있으면 마지막 메시지를 읽은 것으로 표시
          const lastMessage = messages[messages.length - 1]
          if (lastReadMessageIdRef.current !== lastMessage.id) {
            lastReadMessageIdRef.current = lastMessage.id
            console.log('💬 스크롤이 맨 아래 - 마지막 메시지를 읽은 것으로 표시:', lastMessage.id)
            if (onUnreadCountChange) {
              onUnreadCountChange(0)
            }
          }
        }
      }
    }
  }, [messages, isOpen, onUnreadCountChange])

  useEffect(() => {
    // 메시지가 추가되면 스크롤
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, entryMessages])

  // 입장 메시지 처리 (데이터베이스에 저장하지 않음)
  useEffect(() => {
    if (entryMessage && entryMessage !== previousEntryMessageRef.current) {
      const entryMsg: ChatMessage = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        crewId,
        userId: 'system',
        userName: '시스템',
        message: entryMessage,
        timestamp: Date.now(),
        type: 'system',
      }
      setEntryMessages(prev => [...prev, entryMsg])
      previousEntryMessageRef.current = entryMessage
    }
  }, [entryMessage, crewId])

  const loadWeather = async () => {
    // 실제로는 날씨 API를 호출해야 하지만, 여기서는 모킹 데이터 사용
    const mockWeather: WeatherData = {
      temperature: 22,
      humidity: 65,
      uvIndex: 5,
      pm10: 45, // 미세먼지
      pm25: 25, // 초미세먼지
      condition: '맑음',
    }
    setWeather(mockWeather)
  }

  const loadMessages = async () => {
    try {
      const chatMessages = await databaseService.getChatMessages(crewId, 50)
      console.log('💬 메시지 로드 완료:', {
        count: chatMessages.length,
        latestMessage: chatMessages.length > 0 ? {
          id: chatMessages[chatMessages.length - 1].id,
          userName: chatMessages[chatMessages.length - 1].userName,
          message: chatMessages[chatMessages.length - 1].message.substring(0, 30),
          timestamp: new Date(chatMessages[chatMessages.length - 1].timestamp).toLocaleString(),
        } : null,
      })
      setMessages(chatMessages)
    } catch (error) {
      console.error('💬 메시지 로드 실패:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || loading) return

    const user = authService.getCurrentUser()
    if (!user) return

    setLoading(true)
    try {
      await databaseService.addChatMessage({
        crewId,
        userId: user.id,
        userName: user.name,
        message: newMessage.trim(),
        type: 'text',
      })
      setNewMessage('')
      await loadMessages()
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      alert('메시지 전송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' +
             date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const getWeatherBackground = (condition: string, month: number): string => {
    // 5월에는 벚꽃 배경
    if (month === 5) {
      return 'bg-gradient-to-br from-pink-200 via-pink-100 to-white'
    }
    
    switch (condition) {
      case '맑음':
      case '맑은':
        return 'bg-gradient-to-br from-blue-300 via-blue-200 to-yellow-100'
      case '비':
      case '비옴':
      case '소나기':
        return 'bg-gradient-to-br from-gray-400 via-gray-300 to-gray-200'
      case '눈':
      case '눈옴':
        return 'bg-gradient-to-br from-blue-100 via-white to-gray-100'
      case '흐림':
      case '구름':
        return 'bg-gradient-to-br from-gray-300 via-gray-200 to-gray-100'
      default:
        return 'bg-gradient-to-br from-blue-200 via-blue-100 to-white'
    }
  }

  const getWeatherIcon = (condition: string): string => {
    switch (condition) {
      case '맑음':
      case '맑은':
        return '☀️'
      case '비':
      case '비옴':
      case '소나기':
        return '🌧️'
      case '눈':
      case '눈옴':
        return '❄️'
      case '흐림':
      case '구름':
        return '☁️'
      default:
        return '🌤️'
    }
  }

  const getPMStatus = (pm10: number, pm25: number): { status: string; color: string } => {
    const avg = (pm10 + pm25) / 2
    if (avg <= 30) return { status: '좋음', color: 'text-blue-500' }
    if (avg <= 50) return { status: '보통', color: 'text-green-500' }
    if (avg <= 100) return { status: '나쁨', color: 'text-yellow-500' }
    return { status: '매우나쁨', color: 'text-red-500' }
  }

  const currentMonth = new Date().getMonth() + 1
  const weatherBg = weather ? getWeatherBackground(weather.condition, currentMonth) : 'bg-gradient-to-br from-blue-200 via-blue-100 to-white'
  const pmStatus = weather ? getPMStatus(weather.pm10, weather.pm25) : { status: '보통', color: 'text-green-500' }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* 채팅 패널 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-2xl ${weatherBg}`}
          >
            {/* 헤더 - 날씨 정보 포함 */}
            <div className="bg-white/90 backdrop-blur-sm p-4 flex items-center justify-between border-b border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                  className="text-gray-600 hover:text-gray-800 transition p-1"
              >
                  ←
              </button>
                <div>
                  <h3 className="text-gray-800 font-semibold text-lg">채팅</h3>
                  {weather && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1 flex-wrap">
                      <span title="날씨" className="flex items-center gap-1">
                        {getWeatherIcon(weather.condition)}
                        <span className="font-medium">날씨</span>
                        <span className="hidden sm:inline">: {weather.condition}</span>
                      </span>
                      <span>•</span>
                      <span title="온도" className="flex items-center gap-1">
                        <span>🌡️</span>
                        <span className="font-medium">온도</span>
                        <span>: {weather.temperature}℃</span>
                      </span>
                      <span>•</span>
                      <span title="습도" className="flex items-center gap-1">
                        <span>💧</span>
                        <span className="font-medium">습도</span>
                        <span>: {weather.humidity}%</span>
                      </span>
                      <span>•</span>
                      <span title="자외선" className="flex items-center gap-1">
                        <span>☀️</span>
                        <span className="font-medium">자외선</span>
                        <span>: {weather.uvIndex}</span>
                      </span>
                      <span>•</span>
                      <span title="미세먼지" className={`flex items-center gap-1 ${pmStatus.color}`}>
                        <span>🌫️</span>
                        <span className="font-medium">미세먼지</span>
                        <span>: {pmStatus.status}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 날씨 상세 정보 카드 - 제거 (헤더에 이미 표시됨) */}

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && entryMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  메시지가 없습니다
                </div>
              ) : (
                [...entryMessages, ...messages].sort((a, b) => a.timestamp - b.timestamp).map((message, index) => {
                  const currentUser = authService.getCurrentUser()
                  // userId 비교: 시스템 메시지가 아니고, 현재 사용자와 일치하는지 확인
                  let isMe = false
                  if (currentUser && message.userId !== 'system') {
                    // UUID 형식인 경우 직접 비교
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                    if (uuidRegex.test(message.userId)) {
                      // Supabase UUID인 경우, 현재 사용자의 email로 Supabase 사용자 찾기
                      const userStr = localStorage.getItem(`user_${currentUser.id}`)
                      if (userStr) {
                        const user = JSON.parse(userStr)
                        // 실제로는 Supabase에서 email로 사용자를 찾아서 비교해야 하지만,
                        // 여기서는 간단히 userName으로 비교
                        isMe = message.userName === user.name
                      }
                    } else {
                      // localStorage ID인 경우 직접 비교
                      isMe = message.userId === currentUser.id
                    }
                  }
                  const prevMessage = index > 0 ? messages[index - 1] : null
                  const showTime = !prevMessage || 
                    message.timestamp - prevMessage.timestamp > 300000 || // 5분 이상 차이
                    prevMessage.userId !== message.userId
                  
                  return (
                    <div key={message.id}>
                      {showTime && (
                        <div className="text-center text-xs text-gray-500 my-2">
                          {formatTime(message.timestamp)}
                        </div>
                      )}
                      {message.type === 'system' ? (
                        <div className="text-center my-2">
                          <span className="bg-gray-200/80 text-gray-600 text-xs px-3 py-1 rounded-full">
                            {message.message}
                          </span>
                        </div>
                      ) : (
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
                              {message.userName.charAt(0)}
                            </div>
                          )}
                          <div className={`max-w-[70%] ${isMe ? 'order-2' : ''}`}>
                        {!isMe && (
                              <div className="text-xs text-gray-600 mb-1 px-1">
                            {message.userName}
                          </div>
                        )}
                            <div
                              className={`rounded-2xl px-4 py-2 ${
                                isMe
                                  ? 'bg-yellow-300 text-gray-800 rounded-tr-sm'
                                  : 'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {message.message}
                              </div>
                            </div>
                            <div className={`text-xs text-gray-500 mt-1 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form onSubmit={handleSendMessage} className="bg-white/90 backdrop-blur-sm p-3 border-t border-gray-200 mobile-bottom-safe" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}>
              <div className="flex gap-2 items-end">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || loading}
                  className="w-10 h-10 bg-yellow-300 text-gray-800 rounded-full hover:bg-yellow-400 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
                >
                  ➤
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default CrewChatPanel
