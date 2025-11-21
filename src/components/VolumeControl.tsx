import { useState, useEffect } from 'react'
import { audioService } from '@/services/audioService'

interface VolumeControlProps {
  className?: string
  onExercisePause?: (paused: boolean) => void // 운동 일시정지 콜백
  isExercisePaused?: boolean // 운동 일시정지 상태
}

const VolumeControl = ({ className = '', onExercisePause, isExercisePaused = false }: VolumeControlProps) => {
  const [volume, setVolume] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [savedVolume, setSavedVolume] = useState(1.0) // 음소거 전 볼륨 저장

  useEffect(() => {
    // 설정에서 볼륨 불러오기
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      const vol = parsed.audioVolume || 1.0
      setVolume(vol)
      setSavedVolume(vol)
      audioService.setConfig({ volume: vol })
    }
  }, [])

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    setIsMuted(false)
    audioService.setConfig({ volume: newVolume })
    
    // 로컬 스토리지에 저장
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      parsed.audioVolume = newVolume
      localStorage.setItem('appSettings', JSON.stringify(parsed))
    }
  }

  const handleMute = () => {
    if (isMuted) {
      // 음소거 해제
      setIsMuted(false)
      handleVolumeChange(savedVolume)
    } else {
      // 음소거
      setSavedVolume(volume)
      setIsMuted(true)
      audioService.setConfig({ volume: 0 })
    }
  }

  const handleExercisePause = () => {
    if (onExercisePause) {
      // 운동 일시정지/재개
      onExercisePause(!isExercisePaused)
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {onExercisePause && (
        <button
          onClick={handleExercisePause}
          className="px-3 py-2 bg-orange-500/80 rounded-lg hover:bg-orange-600/80 transition text-white flex-shrink-0 flex items-center gap-2"
          aria-label={isExercisePaused ? '운동 재개' : '운동 일시정지'}
          title={isExercisePaused ? '운동 재개' : '운동 일시정지'}
        >
          {isExercisePaused ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">운동 재개</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">운동일시정지</span>
            </>
          )}
        </button>
      )}
      <button
        onClick={handleMute}
        className="p-2 bg-black/70 rounded-lg hover:bg-black/80 transition text-white flex-shrink-0"
        aria-label={isMuted ? '음소거 해제' : '음소거'}
      >
        {isMuted ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : volume === 0 ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : volume < 0.5 ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>
      
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-white text-sm w-10 text-right flex-shrink-0">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  )
}

export default VolumeControl

