/**
 * 토스트 메시지 컴포넌트
 * 재사용 가능한 토스트 알림 컴포넌트
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

export interface ToastMessage {
  id?: string
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number // 밀리초 단위, 기본값 3000
}

interface ToastProps {
  message: ToastMessage | null
  onClose: () => void
}

const Toast = ({ message, onClose }: ToastProps) => {
  useEffect(() => {
    if (message) {
      const duration = message.duration || 3000
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [message, onClose])

  if (!message) return null

  const getToastStyles = () => {
    switch (message.type) {
      case 'success':
        return 'bg-green-500 text-white'
      case 'error':
        return 'bg-red-500 text-white'
      case 'warning':
        return 'bg-orange-500 text-white'
      case 'info':
      default:
        return 'bg-blue-500 text-white'
    }
  }

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[100]"
        >
          <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${getToastStyles()}`}>
            <span className="text-xl">{getIcon()}</span>
            <span className="font-semibold">{message.message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Toast

