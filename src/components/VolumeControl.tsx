import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioService } from '@/services/audioService'

interface VolumeControlProps {
  className?: string
}

const VolumeControl = ({ className = '' }: VolumeControlProps) => {
  const [volume, setVolume] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [showSlider, setShowSlider] = useState(false)
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

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleMute}
        onMouseEnter={() => setShowSlider(true)}
        onMouseLeave={() => setShowSlider(false)}
        className="p-2 bg-black/70 rounded-lg hover:bg-black/80 transition text-white"
        aria-label={isMuted ? '음소거 해제' : '음소거'}
      >
        {isMuted ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : volume === 0 ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : volume < 0.5 ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      <AnimatePresence>
        {showSlider && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black/90 rounded-lg p-4 z-50"
            onMouseEnter={() => setShowSlider(true)}
            onMouseLeave={() => setShowSlider(false)}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-white text-sm w-10 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default VolumeControl

