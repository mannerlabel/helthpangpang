/**
 * 크루 채팅 패널 컴포넌트
 * 오른쪽에서 슬라이드되는 채팅 화면
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { databaseService, ChatMessage } from '@/services/databaseService'
import { authService } from '@/services/authService'

interface CrewChatPanelProps {
  crewId: string
  isOpen: boolean
  onClose: () => void
}

const CrewChatPanel = ({ crewId, isOpen, onClose }: CrewChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadMessages()
      const interval = setInterval(loadMessages, 1000) // 1초마다 새 메시지 확인
      return () => clearInterval(interval)
    }
  }, [isOpen, crewId])

  useEffect(() => {
    // 메시지가 추가되면 스크롤
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const chatMessages = await databaseService.getChatMessages(crewId, 50)
      setMessages(chatMessages)
    } catch (error) {
      console.error('메시지 로드 실패:', error)
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
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 z-50 flex flex-col shadow-2xl"
          >
            {/* 헤더 */}
            <div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
              <h3 className="text-white font-semibold">채팅</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  메시지가 없습니다
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.userId === authService.getCurrentUser()?.id
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isMe
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        {!isMe && (
                          <div className="text-xs text-gray-300 mb-1">
                            {message.userName}
                          </div>
                        )}
                        <div className="text-sm">{message.message}</div>
                        <div
                          className={`text-xs mt-1 ${
                            isMe ? 'text-purple-100' : 'text-gray-400'
                          }`}
                        >
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form onSubmit={handleSendMessage} className="bg-gray-800 p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || loading}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  전송
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

