import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { JoggingMode } from '@/types'
import NavigationButtons from '@/components/NavigationButtons'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'

const JoggingModeSelectPage = () => {
  const navigate = useNavigate()
  const [selectedMode, setSelectedMode] = useState<JoggingMode | null>(null)

  // 관리자는 이 페이지에 접근할 수 없음
  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user && adminService.isAdmin(user)) {
      alert('관리자는 일반 사용자 모드를 사용할 수 없습니다.')
      navigate('/admin/dashboard')
    }
  }, [navigate])

  const handleModeSelect = (mode: JoggingMode) => {
    setSelectedMode(mode)
    if (mode === 'together') {
      navigate('/jogging-crew')
    } else {
      navigate('/jogging-alone')
    }
  }

  const modes = [
    {
      id: 'alone' as JoggingMode,
      title: '혼자',
      description: '혼자 조깅하기',
      icon: '🏃',
      color: 'from-green-500 to-green-700',
    },
    {
      id: 'together' as JoggingMode,
      title: '함께',
      description: '친구들과 함께 조깅하기',
      icon: '👥',
      color: 'from-blue-500 to-blue-700',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">조깅모드</h1>
          <NavigationButtons backPath="/mode-select" />
        </div>
        <p className="text-xl text-gray-300 text-center mb-12">조깅 모드를 선택하세요</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {modes.map((mode) => (
            <motion.div
              key={mode.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleModeSelect(mode.id)}
              className={`bg-gradient-to-br ${mode.color} rounded-2xl p-8 cursor-pointer shadow-2xl hover:shadow-3xl transition-all`}
            >
              <div className="text-6xl mb-4 text-center">{mode.icon}</div>
              <h2 className="text-3xl font-bold text-white mb-4 text-center">
                {mode.title}
              </h2>
              <p className="text-white/90 text-center">{mode.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JoggingModeSelectPage

