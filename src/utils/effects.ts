import { Effect } from '@/types'

export const createCountEffect = (count: number): Effect[] => {
  const effects: Effect[] = []

  // 10의 배수마다 특별한 효과
  if (count % 10 === 0 && count > 0) {
    effects.push({
      type: 'emoji',
      content: '🎉',
      position: { x: 50, y: 30 },
      duration: 2000,
    })
    effects.push({
      type: 'emoji',
      content: '🔥',
      position: { x: 40, y: 40 },
      duration: 2000,
    })
    effects.push({
      type: 'emoji',
      content: '💪',
      position: { x: 60, y: 40 },
      duration: 2000,
    })
  }

  // 5의 배수마다 작은 효과
  if (count % 5 === 0 && count > 0 && count % 10 !== 0) {
    effects.push({
      type: 'emoji',
      content: '⭐',
      position: { x: 50, y: 50 },
      duration: 1500,
    })
  }

  // 매 카운트마다 작은 파티클
  effects.push({
    type: 'particle',
    content: '',
    position: {
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50 + (Math.random() - 0.5) * 20,
    },
    duration: 1000,
  })

  return effects
}

export const createPoseScoreEffect = (score: number): Effect[] => {
  const effects: Effect[] = []

  if (score >= 90) {
    effects.push({
      type: 'emoji',
      content: '✨',
      position: { x: 50, y: 70 },
      duration: 1500,
    })
  } else if (score < 60) {
    effects.push({
      type: 'emoji',
      content: '⚠️',
      position: { x: 50, y: 70 },
      duration: 1500,
    })
  }

  return effects
}

