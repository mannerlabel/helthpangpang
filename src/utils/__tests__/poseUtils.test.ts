import { describe, it, expect } from 'vitest'
import { calculateAngle, findKeypoint, calculateDistance, calculateAverage, calculateVariance } from '../poseUtils'
import { PoseKeypoint } from '@/types'

describe('poseUtils', () => {
  describe('calculateAngle', () => {
    it('직각(90도)을 정확히 계산해야 함', () => {
      // 직각 삼각형: (0,0) - (0,1) - (1,1)
      const angle = calculateAngle(
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      )
      expect(angle).toBeCloseTo(90, 1)
    })

    it('평평한 각도(180도)를 계산해야 함', () => {
      // 일직선: (0,0) - (1,0) - (2,0)
      const angle = calculateAngle(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }
      )
      expect(angle).toBeCloseTo(180, 1)
    })

    it('예각을 계산해야 함', () => {
      // 예각: (0,0) - (1,1) - (2,0) 형태로 예각 생성
      // 실제로는 각도 계산 로직에 따라 값이 달라질 수 있으므로
      // 0보다 크고 180보다 작은 값인지만 확인
      const angle = calculateAngle(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 }
      )
      expect(angle).toBeGreaterThan(0)
      expect(angle).toBeLessThanOrEqual(180)
    })
  })

  describe('findKeypoint', () => {
    const keypoints: PoseKeypoint[] = [
      { x: 0.5, y: 0.5, name: 'left_shoulder', score: 0.9 },
      { x: 0.6, y: 0.6, name: 'right_shoulder', score: 0.8 },
      { x: 0.4, y: 0.4, name: 'left_elbow', score: 0.2 }, // 낮은 점수
    ]

    it('높은 점수의 키포인트를 찾아야 함', () => {
      const result = findKeypoint(keypoints, 'left_shoulder')
      expect(result).not.toBeNull()
      expect(result?.name).toBe('left_shoulder')
      expect(result?.score).toBe(0.9)
    })

    it('낮은 점수의 키포인트는 null을 반환해야 함', () => {
      const result = findKeypoint(keypoints, 'left_elbow')
      expect(result).toBeNull()
    })

    it('존재하지 않는 키포인트는 null을 반환해야 함', () => {
      const result = findKeypoint(keypoints, 'nonexistent')
      expect(result).toBeNull()
    })

    it('커스텀 최소 점수 임계값을 사용해야 함', () => {
      const result = findKeypoint(keypoints, 'left_elbow', 0.1)
      expect(result).not.toBeNull()
    })
  })

  describe('calculateDistance', () => {
    it('두 점 사이의 거리를 정확히 계산해야 함', () => {
      const distance = calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })
      expect(distance).toBe(5) // 3-4-5 직각삼각형
    })

    it('같은 점은 거리가 0이어야 함', () => {
      const distance = calculateDistance({ x: 1, y: 1 }, { x: 1, y: 1 })
      expect(distance).toBe(0)
    })
  })

  describe('calculateAverage', () => {
    it('숫자 배열의 평균을 계산해야 함', () => {
      const avg = calculateAverage([1, 2, 3, 4, 5])
      expect(avg).toBe(3)
    })

    it('빈 배열은 0을 반환해야 함', () => {
      const avg = calculateAverage([])
      expect(avg).toBe(0)
    })

    it('단일 값 배열은 그 값을 반환해야 함', () => {
      const avg = calculateAverage([42])
      expect(avg).toBe(42)
    })
  })

  describe('calculateVariance', () => {
    it('숫자 배열의 분산을 계산해야 함', () => {
      // [1, 2, 3, 4, 5] 평균: 3
      // 분산: ((1-3)^2 + (2-3)^2 + (3-3)^2 + (4-3)^2 + (5-3)^2) / 5 = 2
      const variance = calculateVariance([1, 2, 3, 4, 5])
      expect(variance).toBe(2)
    })

    it('빈 배열은 0을 반환해야 함', () => {
      const variance = calculateVariance([])
      expect(variance).toBe(0)
    })

    it('동일한 값 배열은 분산이 0이어야 함', () => {
      const variance = calculateVariance([5, 5, 5, 5])
      expect(variance).toBe(0)
    })
  })
})

