/**
 * 크루 채팅 패널 컴포넌트
 * 카카오톡 스타일 채팅 화면
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { databaseService, ChatMessage } from '@/services/databaseService'
import { authService } from '@/services/authService'
import { rankService } from '@/services/rankService'
import RankBadge from '@/components/RankBadge'
import { getWeatherInfo } from '@/services/weatherService'

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
  pm10: number | null
  pm25: number | null
  o3?: number | null // 오존 (O3)
  pm10Grade?: string | null // 미세먼지 등급
  pm25Grade?: string | null // 초미세먼지 등급
  o3Grade?: string | null // 오존 등급
  condition: string
  location?: string
  date?: string // 날짜 (오늘, 내일, 모레)
}

const CrewChatPanel = ({ crewId, isOpen, onClose, entryMessage, onNewMessage, onUnreadCountChange }: CrewChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [entryMessages, setEntryMessages] = useState<ChatMessage[]>([]) // 입장 메시지 (로컬만)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherList, setWeatherList] = useState<WeatherData[]>([]) // 오늘, 내일, 모레 날씨 목록
  const [weatherLoading, setWeatherLoading] = useState(false) // 날씨 로딩 상태
  const [airQualityExpanded, setAirQualityExpanded] = useState(false) // 대기질 정보 펼침/접힘 상태
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousEntryMessageRef = useRef<string | null>(null)
  const previousMessagesCountRef = useRef<number>(0)
  const previousMessageIdsRef = useRef<Set<string>>(new Set()) // 이전 메시지 ID 추적
  const currentUserIdRef = useRef<string | null>(null)
  const lastReadMessageIdRef = useRef<string | null>(null) // 마지막으로 읽은 메시지 ID
  const [userRanks, setUserRanks] = useState<Record<string, number>>({}) // 사용자별 계급 캐시
  const weatherLoadedRef = useRef(false) // 날씨 정보가 이미 로드되었는지 추적

  // localStorage에서 마지막 읽은 메시지 ID 로드
  const getLastReadMessageId = (): string | null => {
    try {
      const user = authService.getCurrentUser()
      if (!user) return null
      const key = `lastReadMessageId_${crewId}_${user.id}`
      return localStorage.getItem(key)
    } catch (error) {
      console.error('마지막 읽은 메시지 ID 로드 실패:', error)
      return null
    }
  }

  // localStorage에 마지막 읽은 메시지 ID 저장
  const saveLastReadMessageId = (messageId: string) => {
    try {
      const user = authService.getCurrentUser()
      if (!user) return
      const key = `lastReadMessageId_${crewId}_${user.id}`
      localStorage.setItem(key, messageId)
      lastReadMessageIdRef.current = messageId
      console.log('💬 마지막 읽은 메시지 ID 저장:', messageId, key)
    } catch (error) {
      console.error('마지막 읽은 메시지 ID 저장 실패:', error)
    }
  }

  // 컴포넌트 마운트 시 localStorage에서 마지막 읽은 메시지 ID 로드
  useEffect(() => {
    const savedLastReadId = getLastReadMessageId()
    if (savedLastReadId) {
      lastReadMessageIdRef.current = savedLastReadId
      console.log('💬 localStorage에서 마지막 읽은 메시지 ID 로드:', savedLastReadId)
    }
  }, [crewId])

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
      // 날씨 정보는 채팅창을 열었을 때 한 번만 로드
      if (!weatherLoadedRef.current) {
        loadWeather()
        weatherLoadedRef.current = true
      }
      // 메시지만 주기적으로 갱신 (날씨는 제외)
      const interval = setInterval(() => {
        loadMessages()
      }, 2000) // 2초마다 새 메시지 확인
      return () => clearInterval(interval)
    } else {
      // 채팅창이 닫히면 날씨 로드 플래그 리셋
      weatherLoadedRef.current = false
      // 채팅창이 닫혀있을 때도 주기적으로 메시지를 확인하여 새 메시지 알림을 받을 수 있도록 함
      const interval = setInterval(() => {
        loadMessages()
      }, 3000) // 3초마다 새 메시지 확인 (채팅창이 닫혀있을 때는 조금 더 긴 간격)
      return () => clearInterval(interval)
    }
  }, [isOpen, crewId])

  // 사용자 계급 로드
  const loadUserRanks = async (messageList: ChatMessage[]) => {
    const allUserIds = new Set<string>()
    messageList.forEach(msg => {
      if (msg.userId && msg.userId !== 'system') {
        allUserIds.add(msg.userId)
      }
    })
    
    const rankMap: Record<string, number> = {}
    for (const userId of allUserIds) {
      if (!userRanks[userId]) { // 캐시에 없을 때만 로드
        try {
          const rank = await rankService.getUserRank(userId)
          rankMap[userId] = rank
        } catch (error) {
          console.error(`사용자 ${userId}의 계급 로드 실패:`, error)
          rankMap[userId] = 1
        }
      } else {
        rankMap[userId] = userRanks[userId]
      }
    }
    if (Object.keys(rankMap).length > 0) {
      setUserRanks(prev => ({ ...prev, ...rankMap }))
    }
  }

  // 메시지가 변경될 때마다 계급 업데이트
  useEffect(() => {
    if (messages.length > 0) {
      loadUserRanks(messages)
    }
  }, [messages.length])

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
      saveLastReadMessageId(lastMessage.id) // localStorage에 저장
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
  }, [isOpen, messages.length, onUnreadCountChange, crewId])

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
            saveLastReadMessageId(lastMessage.id) // localStorage에 저장
            console.log('💬 스크롤이 맨 아래 - 마지막 메시지를 읽은 것으로 표시:', lastMessage.id)
            if (onUnreadCountChange) {
              onUnreadCountChange(0)
            }
          }
        }
      }
    }
  }, [messages, isOpen, onUnreadCountChange, crewId])

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

  const loadWeather = async (showLoading: boolean = false) => {
    if (showLoading) {
      setWeatherLoading(true)
    }
    try {
      const { weather: weatherInfoList, location } = await getWeatherInfo()
      if (weatherInfoList && weatherInfoList.length > 0) {
        // 오늘 날씨를 기본으로 설정
        const todayWeather = weatherInfoList[0]
        setWeather({
          temperature: todayWeather.temperature,
          humidity: todayWeather.humidity,
          uvIndex: todayWeather.uvIndex,
          pm10: todayWeather.pm10 ?? null,
          pm25: todayWeather.pm25 ?? null,
          o3: todayWeather.o3 ?? null,
          pm10Grade: todayWeather.pm10Grade ?? null,
          pm25Grade: todayWeather.pm25Grade ?? null,
          o3Grade: todayWeather.o3Grade ?? null,
          condition: todayWeather.condition,
          location: location,
          date: todayWeather.date,
        })
        
        // 전체 날씨 목록 저장 (오늘, 내일, 모레)
        const weatherDataList: WeatherData[] = weatherInfoList.map(w => ({
          temperature: w.temperature,
          humidity: w.humidity,
          uvIndex: w.uvIndex,
          pm10: w.pm10 ?? null,
          pm25: w.pm25 ?? null,
          o3: w.o3 ?? null,
          pm10Grade: w.pm10Grade ?? null,
          pm25Grade: w.pm25Grade ?? null,
          o3Grade: w.o3Grade ?? null,
          condition: w.condition,
          location: location,
          date: w.date,
        }))
        setWeatherList(weatherDataList)
      }
    } catch (error) {
      console.error('날씨 정보 로드 실패:', error)
      // 기본값 사용
      setWeather({
        temperature: 22,
        humidity: 65,
        uvIndex: 5,
        pm10: null,
        pm25: null,
        o3: null,
        condition: '맑음',
        location: '서울',
        date: '오늘',
      })
      setWeatherList([])
    } finally {
      if (showLoading) {
        setWeatherLoading(false)
      }
    }
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

  // 등급별 아이콘 및 색상 반환
  const getGradeIcon = (grade: string | null | undefined): { icon: string; color: string; status: string } => {
    if (!grade) return { icon: '😐', color: 'text-gray-500', status: '없음' }
    switch (grade) {
      case '좋음':
        return { icon: '😊', color: 'text-blue-500', status: '좋음' }
      case '보통':
        return { icon: '😐', color: 'text-green-500', status: '보통' }
      case '나쁨':
        return { icon: '😟', color: 'text-yellow-500', status: '나쁨' }
      case '매우나쁨':
        return { icon: '😠', color: 'text-red-500', status: '매우나쁨' }
      default:
        return { icon: '😐', color: 'text-gray-500', status: '없음' }
    }
  }
  
  // 수치 기반 등급 계산 (등급 정보가 없을 때 사용) - 에어코리아 기준
  const calculateGradeFromValue = (value: number | null, type: 'pm10' | 'pm25' | 'o3'): string | null => {
    if (value === null || value === undefined) return null
    
    if (type === 'pm25') {
      // 초미세먼지: 좋음(0~15), 보통(16~35), 나쁨(36~75), 매우나쁨(76~)
      if (value <= 15) return '좋음'
      if (value <= 35) return '보통'
      if (value <= 75) return '나쁨'
      return '매우나쁨'
    } else if (type === 'pm10') {
      // 미세먼지: 좋음(0~30), 보통(31~80), 나쁨(81~150), 매우나쁨(151~)
      if (value <= 30) return '좋음'
      if (value <= 80) return '보통'
      if (value <= 150) return '나쁨'
      return '매우나쁨'
    } else if (type === 'o3') {
      // 오존: 좋음(0~0.03), 보통(0.0301~0.09), 나쁨(0.0901~0.15), 매우나쁨(0.1501~)
      if (value <= 0.03) return '좋음'
      if (value <= 0.09) return '보통'
      if (value <= 0.15) return '나쁨'
      return '매우나쁨'
    }
    return null
  }
  
  // 수치 기반 등급 계산 (등급 정보가 없을 때 사용)
  const getPMStatus = (pm10: number | null, pm25: number | null): { status: string; color: string; icon: string } => {
    if (pm10 === null && pm25 === null) {
      return { status: '없음', color: 'text-gray-500', icon: '😐' }
    }
    // PM10과 PM25 중 하나라도 있으면 해당 등급 사용, 둘 다 있으면 더 나쁜 등급 사용
    const pm10Grade = pm10 !== null ? calculateGradeFromValue(pm10, 'pm10') : null
    const pm25Grade = pm25 !== null ? calculateGradeFromValue(pm25, 'pm25') : null
    
    // 등급 우선순위: 매우나쁨 > 나쁨 > 보통 > 좋음
    const gradePriority: Record<string, number> = { '매우나쁨': 4, '나쁨': 3, '보통': 2, '좋음': 1 }
    let finalGrade = pm10Grade || pm25Grade
    if (pm10Grade && pm25Grade) {
      finalGrade = gradePriority[pm10Grade] > gradePriority[pm25Grade] ? pm10Grade : pm25Grade
    }
    
    return getGradeIcon(finalGrade)
  }
  
  const formatAirQuality = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '없음'
    return String(value)
  }

  const currentMonth = new Date().getMonth() + 1
  const weatherBg = weather ? getWeatherBackground(weather.condition, currentMonth) : 'bg-gradient-to-br from-blue-200 via-blue-100 to-white'
  const pmStatus = weather ? getPMStatus(weather.pm10, weather.pm25) : { status: '보통', color: 'text-green-500', icon: '😐' }

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
            className="fixed inset-0 bg-black/50 z-[9998]"
          />

          {/* 채팅 패널 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 w-full max-w-md z-[9999] flex flex-col shadow-2xl ${weatherBg}`}
            style={{ 
              top: 0,
              bottom: 0,
              height: '100%',
              minHeight: '-webkit-fill-available', // iOS Safari 대응
              maxHeight: '100dvh',
              boxSizing: 'border-box',
            }}
          >
            {/* Safe area 상단 여백 - 아이폰 노치/상태바 영역 */}
            <div style={{ 
              height: 'max(env(safe-area-inset-top, 0px), 44px)', // 최소 44px (상태바 높이)
              minHeight: 'max(env(safe-area-inset-top, 0px), 44px)',
              flexShrink: 0,
              backgroundColor: 'transparent',
            }} />
            
            {/* 헤더 - 날씨 정보 포함 */}
            <div 
              className="bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm flex-shrink-0"
              style={{
                paddingTop: '1rem',
                paddingBottom: '1rem',
              }}
            >
              <div className="px-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={onClose}
                    className="text-gray-600 hover:text-gray-800 transition p-1"
                  >
                    ←
                  </button>
                  <div className="flex items-center gap-2 flex-1">
                    <h3 className="text-gray-800 font-semibold text-lg">채팅</h3>
                    {weather && weather.location && (
                      <span title="위치" className="flex items-center gap-1 text-xs text-gray-600">
                        <span>📍</span>
                        <span className="font-medium">{weather.location}</span>
                      </span>
                    )}
                  </div>
                </div>
                {/* 날씨 새로고침 버튼 - 원형 화살표 */}
                <button
                  onClick={() => loadWeather(true)}
                  disabled={weatherLoading}
                  className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="날씨 정보 새로고침"
                >
                  {weatherLoading ? (
                    <svg 
                      className="w-4 h-4 animate-spin" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                  ) : (
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* 날씨 정보 - 오늘, 내일, 모레 */}
              {weatherList.length > 0 && (
                <div className="px-4 pb-2 pt-2 bg-white/70">
                  <div className="flex gap-2">
                    {weatherList.slice(0, 3).map((w, index) => (
                      <div key={index} className="flex-1 bg-white/80 rounded-lg p-2 shadow-sm">
                        <div className="text-xs font-medium text-gray-600 mb-1">{w.date}</div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-lg">{getWeatherIcon(w.condition)}</span>
                          <span className="text-sm font-semibold text-gray-800">{w.temperature}°</span>
                        </div>
                        <div className="text-xs text-gray-600">습도 {w.humidity}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 대기질 정보 섹션 - 펼침/접힘 버튼 포함 */}
              {weather && (
                <div className="px-4 pb-3 pt-2 bg-white/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">대기환경정보</span>
                    <button
                      onClick={() => setAirQualityExpanded(!airQualityExpanded)}
                      className="p-1 rounded hover:bg-gray-200 transition-colors"
                      title={airQualityExpanded ? '접기' : '펼치기'}
                    >
                      <svg 
                        className={`w-4 h-4 text-gray-600 transition-transform ${airQualityExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19 9l-7 7-7-7" 
                        />
                      </svg>
                    </button>
                  </div>
                  {airQualityExpanded && (
                    <div className="grid grid-cols-2 gap-3">
                      {/* 자외선 */}
                      <div className="bg-white/80 rounded-lg p-2 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">☀️</span>
                          <span className="text-xs font-medium text-gray-700">자외선</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">{weather.uvIndex}</div>
                      </div>
                      
                      {/* 미세먼지 */}
                      <div className={`bg-white/80 rounded-lg p-2 shadow-sm ${getGradeIcon(weather.pm10Grade || (weather.pm10 !== null ? calculateGradeFromValue(weather.pm10, 'pm10') : null)).color || 'text-gray-700'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{getGradeIcon(weather.pm10Grade || (weather.pm10 !== null ? calculateGradeFromValue(weather.pm10, 'pm10') : null)).icon || '🌫️'}</span>
                          <span className="text-xs font-medium">미세먼지</span>
                        </div>
                        <div className="text-lg font-bold">
                          {formatAirQuality(weather.pm10)} {weather.pm10 !== null && weather.pm10 !== undefined ? '㎍/㎥' : ''}
                        </div>
                        {(weather.pm10Grade || (weather.pm10 !== null ? calculateGradeFromValue(weather.pm10, 'pm10') : null)) && (
                          <div className="text-xs mt-0.5 opacity-75">
                            ({getGradeIcon(weather.pm10Grade || (weather.pm10 !== null ? calculateGradeFromValue(weather.pm10, 'pm10') : null)).status})
                          </div>
                        )}
                      </div>
                      
                      {/* 초미세먼지 */}
                      <div className={`bg-white/80 rounded-lg p-2 shadow-sm ${getGradeIcon(weather.pm25Grade || (weather.pm25 !== null ? calculateGradeFromValue(weather.pm25, 'pm25') : null)).color}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{getGradeIcon(weather.pm25Grade || (weather.pm25 !== null ? calculateGradeFromValue(weather.pm25, 'pm25') : null)).icon || '💨'}</span>
                          <span className="text-xs font-medium">초미세먼지</span>
                        </div>
                        <div className="text-lg font-bold">
                          {formatAirQuality(weather.pm25)} {weather.pm25 !== null && weather.pm25 !== undefined ? '㎍/㎥' : ''}
                        </div>
                        {(weather.pm25Grade || (weather.pm25 !== null ? calculateGradeFromValue(weather.pm25, 'pm25') : null)) && (
                          <div className="text-xs mt-0.5 opacity-75">
                            ({getGradeIcon(weather.pm25Grade || (weather.pm25 !== null ? calculateGradeFromValue(weather.pm25, 'pm25') : null)).status})
                          </div>
                        )}
                      </div>
                      
                      {/* 오존 */}
                      <div className={`bg-white/80 rounded-lg p-2 shadow-sm ${getGradeIcon(weather.o3Grade || (weather.o3 !== null ? calculateGradeFromValue(weather.o3, 'o3') : null)).color}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{getGradeIcon(weather.o3Grade || (weather.o3 !== null ? calculateGradeFromValue(weather.o3, 'o3') : null)).icon || '☁️'}</span>
                          <span className="text-xs font-medium">오존</span>
                        </div>
                        <div className="text-lg font-bold">
                          {formatAirQuality(weather.o3)} {weather.o3 !== null && weather.o3 !== undefined ? 'ppm' : ''}
                        </div>
                        {(weather.o3Grade || (weather.o3 !== null ? calculateGradeFromValue(weather.o3, 'o3') : null)) && (
                          <div className="text-xs mt-0.5 opacity-75">
                            ({getGradeIcon(weather.o3Grade || (weather.o3 !== null ? calculateGradeFromValue(weather.o3, 'o3') : null)).status})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 날씨 상세 정보 카드 - 제거 (헤더에 이미 표시됨) */}

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ minHeight: 0 }}>
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
                              <div className="text-xs text-gray-600 mb-1 px-1 flex items-center gap-1">
                            {message.userName}
                            <RankBadge rank={userRanks[message.userId] || 1} type="user" size="sm" showText={false} />
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

            {/* Safe area 하단 여백 */}
            <div style={{ 
              height: 'env(safe-area-inset-bottom, 0px)',
              minHeight: 'env(safe-area-inset-bottom, 0px)',
              flexShrink: 0,
            }} />
            
            {/* 입력 영역 */}
            <form 
              onSubmit={handleSendMessage} 
              className="bg-white/90 backdrop-blur-sm p-3 border-t border-gray-200 flex-shrink-0" 
              style={{ 
                paddingBottom: '0.75rem',
                paddingTop: '0.75rem',
              }}
            >
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
