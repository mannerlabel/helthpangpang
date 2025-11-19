import { describe, it, expect, beforeEach } from 'vitest'
import { SquatStrategy } from '../SquatStrategy'
import { Pose } from '@/types'

describe('SquatStrategy', () => {
  let strategy: SquatStrategy

  beforeEach(() => {
    strategy = new SquatStrategy()
    strategy.reset()
  })

  it('리셋 후 초기 상태여야 함', () => {
    const pose: Pose = {
      keypoints: [
        { x: 0.5, y: 0.3, name: 'left_hip', score: 0.9 },
        { x: 0.5, y: 0.3, name: 'right_hip', score: 0.9 },
        { x: 0.5, y: 0.4, name: 'left_knee', score: 0.9 },
        { x: 0.5, y: 0.4, name: 'right_knee', score: 0.9 },
        { x: 0.5, y: 0.5, name: 'left_ankle', score: 0.9 },
        { x: 0.5, y: 0.5, name: 'right_ankle', score: 0.9 },
      ],
    }

    const result = strategy.analyze(pose, 0)
    expect(result.count).toBe(0)
    expect(result.isComplete).toBe(false)
  })

  it('필수 키포인트가 없으면 카운트하지 않아야 함', () => {
    const pose: Pose = {
      keypoints: [
        { x: 0.5, y: 0.5, name: 'left_shoulder', score: 0.9 },
      ],
    }

    const result = strategy.analyze(pose, 0)
    expect(result.isComplete).toBe(false)
    expect(result.count).toBe(0)
  })

  it('피드백을 생성해야 함', () => {
    const result = {
      count: 0,
      isComplete: false,
      depth: 0,
      angle: 180,
      state: 'standing',
    }

    const feedback = strategy.generateFeedback(result)
    expect(typeof feedback).toBe('string')
  })
})

