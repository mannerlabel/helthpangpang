import { ExerciseStrategy, ExerciseAnalysisResult } from './ExerciseStrategy'
import { Pose } from '@/types'
import { SquatCounter } from '@/utils/squatCounter'

/**
 * 스쿼트 전략 구현
 */
export class SquatStrategy implements ExerciseStrategy {
  private counter: SquatCounter = new SquatCounter()

  analyze(pose: Pose, currentCount: number, videoHeight?: number): ExerciseAnalysisResult {
    const result = this.counter.analyzeSquat(pose, currentCount)
    return {
      count: result.count,
      isComplete: result.isComplete,
      depth: result.depth,
      angle: result.angle,
      state: result.state,
    }
  }

  reset(): void {
    this.counter.reset()
  }

  generateFeedback(result: ExerciseAnalysisResult): string {
    if (result.isComplete) {
      // 카운트 완료 시 피드백
      if (result.angle && result.angle > 160) {
        return '무릎 각도 부족'
      } else if (result.depth && result.depth < 50) {
        return '스쿼트 깊이 부족'
      } else {
        return '정상 자세'
      }
    } else {
      // 카운트 미완료 시 피드백
      const state = result.state
      const counter = this.counter as any
      
      if (state === 'standing') {
        if (counter.standingHipY === null) {
          return ''
        } else if (result.angle && result.angle > 180) {
          return '무릎을 더 구부려주세요'
        } else if (result.depth && result.depth < 20 && result.angle && result.angle > 160) {
          return '조금 더 내려가주세요'
        } else {
          return ''
        }
      } else if (state === 'down') {
        return '일어나주세요'
      }
      return ''
    }
  }
}

