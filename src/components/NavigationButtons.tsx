import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'

interface NavigationButtonsProps {
  onBack?: () => void
  backPath?: string
  showHome?: boolean
  showBack?: boolean // 뒤로가기 버튼 표시 여부
  className?: string
  exitMode?: boolean // 나가기 모드 (아이콘 변경)
  exitTitle?: string // 나가기 버튼 제목
}

const NavigationButtons = ({ 
  onBack, 
  backPath, 
  showHome = true,
  showBack = true,
  className = '',
  exitMode = false,
  exitTitle = '나가기'
}: NavigationButtonsProps) => {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backPath) {
      navigate(backPath)
    } else {
      navigate(-1)
    }
  }

  const handleHome = () => {
    const user = authService.getCurrentUser()
    if (user && adminService.isAdmin(user)) {
      navigate('/admin/dashboard')
    } else {
      navigate('/mode-select')
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showBack && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-all shadow-lg ${
            exitMode 
              ? 'bg-red-500/80 hover:bg-red-600/80' 
              : 'bg-gray-700/80 hover:bg-gray-600/80'
          }`}
          title={exitTitle}
        >
        {exitMode ? (
          // 나가기 아이콘 (문 아이콘)
          <svg 
            className="w-5 h-5 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
            />
          </svg>
        ) : (
          // 뒤로가기 아이콘
          <svg 
            className="w-5 h-5 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
        )}
        </motion.button>
      )}
      
      {showHome && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleHome}
          className="w-10 h-10 rounded-full bg-blue-500/80 backdrop-blur-sm flex items-center justify-center hover:bg-blue-600/80 transition-all shadow-lg"
          title="홈"
        >
          <svg 
            className="w-5 h-5 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
            />
          </svg>
        </motion.button>
      )}
    </div>
  )
}

export default NavigationButtons

