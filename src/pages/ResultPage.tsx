import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExerciseSession, AIAnalysis } from '@/types'
import { aiAnalysisService } from '@/services/aiAnalysisService'

const ResultPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const session = location.state?.session as ExerciseSession | undefined

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      navigate('/mode-select')
      return
    }

    // 세션을 localStorage에 저장 (차후 Supabase로 대체)
    const savedSessions = JSON.parse(localStorage.getItem('exerciseSessions') || '[]')
    // 중복 저장 방지 (같은 ID가 있으면 업데이트)
    const existingIndex = savedSessions.findIndex((s: ExerciseSession) => s.id === session.id)
    if (existingIndex !== -1) {
      savedSessions[existingIndex] = session
    } else {
      savedSessions.push(session)
    }
    // 최근 100개만 유지
    const recentSessions = savedSessions.slice(-100)
    localStorage.setItem('exerciseSessions', JSON.stringify(recentSessions))

    const fetchAnalysis = async () => {
      try {
        const result = await aiAnalysisService.analyzeExercise(session)
        setAnalysis(result)
      } catch (error) {
        console.error('분석 오류:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [session, navigate])

  if (!session) return null

  const exerciseName =
    session.config.type === 'custom'
      ? session.config.customName || '커스텀 운동'
      : session.config.type === 'squat'
      ? '스쿼트'
      : session.config.type === 'pushup'
      ? '푸시업'
      : '런지'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          운동 완료! 🎉
        </h1>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-6 text-center"
          >
            <div className="text-3xl font-bold text-primary-400">
              {(session as any).totalCount || session.counts.length}
            </div>
            <div className="text-gray-400">총 카운트</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800 rounded-xl p-6 text-center"
          >
            <div className="text-3xl font-bold text-green-400">
              {session.averageScore.toFixed(1)}
            </div>
            <div className="text-gray-400">평균 점수</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-xl p-6 text-center"
          >
            <div className="text-3xl font-bold text-yellow-400">
              {session.bestScore?.score || 0}
            </div>
            <div className="text-gray-400">최고 점수</div>
          </motion.div>
        </div>

        {/* 최고/최저 점수 이미지 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {session.bestScore && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-xl font-bold text-white mb-2">
                최고 점수: {session.bestScore.score}점
              </h3>
              <img
                src={session.bestScore.image}
                alt="최고 점수"
                className="w-full rounded-lg"
              />
            </div>
          )}
          {session.worstScore && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-xl font-bold text-white mb-2">
                최저 점수: {session.worstScore.score}점
              </h3>
              <img
                src={session.worstScore.image}
                alt="최저 점수"
                className="w-full rounded-lg"
              />
            </div>
          )}
        </div>

        {/* AI 분석 결과 */}
        {loading ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <div className="text-white">분석 중...</div>
          </div>
        ) : analysis ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">AI 분석 결과</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-primary-400 mb-2">
                  요약
                </h3>
                <p className="text-gray-300">{analysis.summary}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">
                  최고 자세 피드백
                </h3>
                <p className="text-gray-300">{analysis.bestPoseFeedback}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-2">
                  최저 자세 피드백
                </h3>
                <p className="text-gray-300">{analysis.worstPoseFeedback}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                  추천 사항
                </h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  {analysis.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* 버튼 */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/mode-select')}
            className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
          >
            다시 시작
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 px-6 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultPage

