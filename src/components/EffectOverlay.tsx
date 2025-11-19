import { motion, AnimatePresence } from 'framer-motion'
import { Effect } from '@/types'
import { useState, useEffect } from 'react'

interface EffectOverlayProps {
  effects: Effect[]
}

const EffectOverlay = ({ effects }: EffectOverlayProps) => {
  const [visibleEffects, setVisibleEffects] = useState<Effect[]>([])

  useEffect(() => {
    setVisibleEffects(effects)
    
    effects.forEach((effect) => {
      setTimeout(() => {
        setVisibleEffects((prev) => prev.filter((e) => e !== effect))
      }, effect.duration)
    })
  }, [effects])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {visibleEffects.map((effect, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute"
            style={{
              left: `${effect.position.x}%`,
              top: `${effect.position.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {effect.type === 'emoji' && (
              <span className="text-6xl">{effect.content}</span>
            )}
            {effect.type === 'icon' && (
              <div className="text-6xl">{effect.content}</div>
            )}
            {effect.type === 'particle' && (
              <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default EffectOverlay

