import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { JoggingMode } from '@/types'

const JoggingModeSelectPage = () => {
  const navigate = useNavigate()
  const [selectedMode, setSelectedMode] = useState<JoggingMode | null>(null)

  const handleModeSelect = (mode: JoggingMode) => {
    setSelectedMode(mode)
    navigate('/jogging-config', { state: { mode } })
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
          <h1 className="text-5xl font-bold text-white">조깅 모드 선택</h1>
          <button
            onClick={() => navigate('/mode-select')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            뒤로가기
          </button>
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

