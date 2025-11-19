import { motion, AnimatePresence } from 'framer-motion'

interface CountDisplayProps {
  count: number
  poseScore: number
  lastCountScore: number | null
  currentSet: number
  setAverageScores: Map<number, number>
}

const CountDisplay = ({ 
  count, 
  poseScore, 
  lastCountScore,
  currentSet,
  setAverageScores 
}: CountDisplayProps) => {
  // 현재 세트의 평균점수
  const currentSetAverage = setAverageScores.get(currentSet) || 0

  return (
    <>
      {/* 화면 상단에 세트별 평균점수 표시 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 rounded-lg px-6 py-3 z-10">
        <div className="flex items-center gap-6">
          {Array.from(setAverageScores.entries()).map(([setNum, avgScore]) => (
            <div key={setNum} className="text-center">
              <div className="text-xs text-gray-400">세트 {setNum}</div>
              <div className={`text-lg font-bold ${
                setNum === currentSet ? 'text-primary-400' : 'text-gray-300'
              }`}>
                {avgScore}점
              </div>
            </div>
          ))}
          {setAverageScores.size === 0 && (
            <div className="text-sm text-gray-400">세트별 평균점수가 여기에 표시됩니다</div>
          )}
        </div>
      </div>

      {/* 왼쪽 상단에 카운트 및 현재 점수 */}
      <div className="absolute top-4 left-4 bg-black/70 rounded-lg p-6 text-white z-10">
        <div className="text-center">
          <motion.div
            key={count}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-6xl font-bold text-primary-400 mb-2"
          >
            {count}
          </motion.div>
          <div className="text-sm text-gray-300 mb-2">
            현재 자세 점수: <span className="text-primary-400 font-bold">{poseScore}</span>
          </div>
        </div>
      </div>

      {/* 카운트 완료 시 점수 표시 (중앙 하단) */}
      <AnimatePresence>
        {lastCountScore !== null && (
          <motion.div
            key={lastCountScore}
            initial={{ scale: 0, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl px-8 py-4 shadow-2xl z-20"
          >
            <div className="text-center text-white">
              <div className="text-sm mb-1">카운트 완료!</div>
              <div className="text-4xl font-bold">
                {lastCountScore}점
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default CountDisplay

