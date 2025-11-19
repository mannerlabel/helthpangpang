import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppMode } from '@/types'
import { getVersion } from '@/utils/version'
import AnimatedBackground from '@/components/AnimatedBackground'

const ModeSelectionPage = () => {
  const navigate = useNavigate()

  const handleModeSelect = (mode: AppMode) => {
    if (mode === 'jogging') {
      navigate('/jogging-mode-select')
    } else if (mode === 'crew') {
      navigate('/crew')
    } else {
      navigate(`/exercise-select?mode=${mode}`)
    }
  }

  const modes = [
    {
      id: 'single' as AppMode,
      title: '싱글 모드',
      description: '카메라를 통해 혼자 운동',
      icon: '🏋️',
      color: 'from-blue-500 to-blue-700',
    },
    {
      id: 'crew' as AppMode,
      title: '크루 모드',
      description: '참여자들이 방에 모여 함께 운동',
      icon: '👥',
      color: 'from-purple-500 to-purple-700',
    },
    {
      id: 'jogging' as AppMode,
      title: '조깅 모드',
      description: '조깅 경로, 속도, 시간, 거리 자동 추적',
      icon: '🏃',
      color: 'from-green-500 to-green-700',
    },
  ]

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">헬스팡팡</h1>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            설정
          </button>
        </div>
        <p className="text-xl text-gray-300 text-center mb-12">운동 모드를 선택하세요</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
      
      {/* 버전 표시 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm text-gray-400">
        v{getVersion()}
      </div>
    </div>
  )
}

export default ModeSelectionPage

