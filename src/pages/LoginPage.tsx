import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedBackground from '@/components/AnimatedBackground'
import { authService } from '@/services/authService'
import { adminService } from '@/services/adminService'

const LoginPage = () => {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 관리자 계정 여부 확인 (vine.admin으로 시작하는 경우)
  const isAdminAccount = email === 'vine.admin' || email.startsWith('vine.admin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const result = await authService.login(email, password)
        if (result.success && result.user) {
          // 관리자 계정이면 대시보드로, 일반 사용자는 모드 선택으로
          if (adminService.isAdmin(result.user)) {
            navigate('/admin/dashboard')
          } else {
            navigate('/mode-select')
          }
        } else {
          setError(result.error || '로그인에 실패했습니다.')
        }
      } else {
        if (!name.trim()) {
          setError('이름을 입력해주세요.')
          setLoading(false)
          return
        }
        const result = await authService.register(email, password, name)
        if (result.success && result.user) {
          navigate('/mode-select')
        } else {
          setError(result.error || '회원가입에 실패했습니다.')
        }
      }
    } catch (err) {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 overflow-hidden relative">
      <AnimatedBackground />
      <div className="max-w-md mx-auto relative z-10 mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/90 rounded-2xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">헬스팡팡</h1>
            <p className="text-gray-400">
              {isLogin ? '로그인하여 시작하세요' : '새 계정을 만들어보세요'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-white text-sm font-semibold mb-2">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                이메일 {isAdminAccount && <span className="text-xs text-gray-500">(관리자 계정)</span>}
              </label>
              <input
                type={isAdminAccount ? 'text' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
              }}
              className="text-purple-400 hover:text-purple-300 text-sm"
            >
              {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default LoginPage

