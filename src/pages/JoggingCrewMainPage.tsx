import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import NavigationButtons from '@/components/NavigationButtons'

const JoggingCrewMainPage = () => {
  const navigate = useNavigate()

  const menuItems = [
    {
      id: 'create',
      title: '조깅 크루 생성',
      description: '새로운 조깅 크루를 만들어보세요',
      icon: '➕',
      color: 'from-green-500 to-green-700',
      onClick: () => navigate('/jogging-crew/create'),
    },
    {
      id: 'my-crews',
      title: '나의 조깅 크루',
      description: '참여 중인 조깅 크루를 확인하세요',
      icon: '👥',
      color: 'from-blue-500 to-blue-700',
      onClick: () => navigate('/jogging-crew/my-crews'),
    },
    {
      id: 'search',
      title: '조깅 크루 검색',
      description: '다른 조깅 크루를 찾아보세요',
      icon: '🔍',
      color: 'from-purple-500 to-purple-700',
      onClick: () => navigate('/jogging-crew/search'),
    },
  ]

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">함께 조깅</h1>
          <NavigationButtons backPath="/jogging-mode-select" />
        </div>
        <p className="text-xl text-gray-300 text-center mb-12">조깅 크루를 생성하거나 참여하세요</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {menuItems.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={item.onClick}
              className={`bg-gradient-to-br ${item.color} rounded-2xl p-8 cursor-pointer shadow-2xl hover:shadow-3xl transition-all`}
            >
              <div className="text-6xl mb-4 text-center">{item.icon}</div>
              <h2 className="text-3xl font-bold text-white mb-4 text-center">{item.title}</h2>
              <p className="text-white/90 text-center">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JoggingCrewMainPage

