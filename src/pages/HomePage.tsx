import { useNavigate } from 'react-router-dom'
import { getVersion } from '@/utils/version'

const HomePage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">헬스팡팡</h1>
        <p className="text-xl mb-8">카메라 기반 실시간 운동 카운트 및 자세 분석</p>
        <div className="space-x-4">
          <button
            onClick={() => navigate('/mode-select')}
            className="px-6 py-3 bg-primary-500 rounded-lg hover:bg-primary-600 transition"
          >
            시작하기
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
          >
            설정
          </button>
        </div>
      </div>
      
      {/* 버전 표시 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-sm text-gray-400">
        v{getVersion()}
      </div>
    </div>
  )
}

export default HomePage

